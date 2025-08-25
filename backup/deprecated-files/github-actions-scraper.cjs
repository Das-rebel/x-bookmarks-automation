// Load environment variables from .env
const dotenv = require('dotenv');
dotenv.config();
const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

// Configure logging
const log = (message, data = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
};

// Helper to auto-scroll the page with improved reliability
async function autoScroll(page) {
  log('Starting auto-scroll');
  try {
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        let totalHeight = 0;
        const distance = 500;
        const maxScrolls = 100; // Prevent infinite scrolling
        let scrolls = 0;
        
        const scrollStep = async () => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrolls++;
          
          if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
            clearInterval(timer);
            resolve();
          }
        };
        
        const timer = setInterval(scrollStep, 1000); // Increased delay to be more reliable
      });
    });
    log('Auto-scroll completed');
  } catch (error) {
    log('Error during auto-scroll:', error);
    throw error;
  }
}

// Helper function to wait for any of multiple elements with retries
async function waitForAnyElement(page, selectors, options = {}) {
  const {
    timeout = 30000, // 30 seconds default timeout
    visible = true,
    hidden = false,
    timeoutMessage = 'None of the elements were found'
  } = options;

  log(`Waiting for any of these elements: ${selectors.join(', ')}`);
  
  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms
  let lastError = null;

  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          log(`Found element with selector: ${selector}`);
          // Additional check to ensure element is in viewport
          await element.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
          await new Promise(resolve => setTimeout(resolve, 500));
          return element;
        }
      } catch (error) {
        lastError = error;
      }
    }
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // Take screenshot on error for debugging
  const screenshotPath = path.join(process.cwd(), `error-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath });
  log(`Screenshot saved to: ${screenshotPath}`);
  
  throw new Error(`${timeoutMessage}. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Helper function to handle Twitter's "unusual login attempt" detection
async function handleUnusualActivity(page) {
  try {
    // Check for unusual activity modal using data-testid which is more reliable
    const unusualActivitySelectors = [
      'div[role="dialog"]',
      'div[data-testid*="confirmationDialog"]',
      'div[data-testid*="confirmation"]',
      'div[role="alert"]',
      'div[class*="confirmation" i]',
      'div[class*="verify" i]',
      'div[class*="challenge" i]'
    ];

    for (const selector of unusualActivitySelectors) {
      const elements = await page.$$(selector).catch(() => []);
      
      for (const element of elements) {
        const text = await element.evaluate(el => el.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('unusual') || 
            lowerText.includes('suspicious') || 
            lowerText.includes('verify') ||
            lowerText.includes('confirm') ||
            lowerText.includes('challenge')) {
          
          log('Potential unusual login attempt detected, checking...');
          
          // Try to find and click the "This was me" or similar button
          const buttonSelectors = [
            'div[role="button"]',
            'button',
            'div[data-testid*="confirmation"]',
            'div[class*="confirm" i]',
            'div[class*="submit" i]',
            'div[class*="continue" i]',
            'div[class*="yes" i]',
            'div[class*="allow" i]'
          ];

          for (const btnSelector of buttonSelectors) {
            const buttons = await element.$$(btnSelector).catch(() => []);
            
            for (const btn of buttons) {
              const btnText = await btn.evaluate(el => el.textContent || '').catch(() => '');
              const lowerBtnText = btnText.toLowerCase();
              
              if (lowerBtnText.includes('yes') || 
                  lowerBtnText.includes('confirm') || 
                  lowerBtnText.includes('this was me') || 
                  lowerBtnText.includes('continue') ||
                  lowerBtnText.includes('allow')) {
                
                log(`Clicking button with text: ${btnText.trim()}`);
                await btn.click().catch(e => log('Error clicking button:', e.message));
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  } catch (error) {
    log('Error handling unusual activity:', error.message);
    return false;
  }
}

// Legacy function kept for backward compatibility
async function waitForElement(page, selector, options = {}) {
  return waitForAnyElement(page, [selector], options);
}

// Main scraping function with improved error handling and retries
async function scrapeBookmarks() {
  let browser;
  let page;
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };

  while (retryCount < MAX_RETRIES) {
    try {
      log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      
      const username = process.env.X_USERNAME;
      const password = process.env.X_PASSWORD;
      
      if (!username || !password) {
        throw new Error('Missing X_USERNAME or X_PASSWORD in environment');
      }

      log('Launching browser...');
      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();

      // Set a reasonable default navigation timeout
      page.setDefaultNavigationTimeout(60000); // 60 seconds
      page.setDefaultTimeout(30000); // 30 seconds for other operations

      // Set viewport to a common desktop size
      await page.setViewport({ width: 1280, height: 800 });

      // Set user agent to mimic a real browser
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to login page with improved error handling
      log('Navigating to login page...');
      await page.goto('https://x.com/login', { 
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000
      });
      // Navigate to login page with improved error handling
      log('Navigating to login page...');
      await page.goto('https://x.com/i/flow/login', { 
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000
      });

      // Wait for and fill in the username/email/phone
      log('Filling in username/email/phone...');
      const usernameSelectors = [
        'input[autocomplete="username"]',
        'input[type="text"]',
        'input[data-testid*="login"]',
        'input[name="text"]',
        'input[autocapitalize="none"]',
        'input[autocorrect="off"]',
        'input[spellcheck="false"]'
      ];
      
      const usernameInput = await waitForAnyElement(page, usernameSelectors, {
        timeout: 30000,
        timeoutMessage: 'Could not find username/email input field'
      });
      
      // Clear the field and type the username
      await usernameInput.click({ clickCount: 3 });
      await usernameInput.press('Backspace');
      await usernameInput.type(username, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click the next button
      log('Submitting username...');
      const nextButtonSelectors = [
        'div[role="button"][tabindex="0"]',
        'div[data-testid*="next"]',
        'div[role="button"]',
        'button[type="submit"]',
        'button:not([disabled])',
        'div[class*="next" i]',
        'div[class*="submit" i]'
      ];
      
      const nextButton = await waitForAnyElement(page, nextButtonSelectors, {
        timeout: 30000,
        timeoutMessage: 'Could not find Next button'
      });
      
      await nextButton.click();
      
      // Wait for navigation to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Log the current URL and page title for debugging
      const currentUrl = page.url();
      const pageTitle = await page.title();
      log(`Current URL: ${currentUrl}`);
      log(`Page title: ${pageTitle}`);
      
      // Log the page HTML for debugging
      const pageContent = await page.content();
      log(`Page content length: ${pageContent.length} characters`);
      
      // Save the page HTML to a file for inspection
      await fs.writeFile('page-content.html', pageContent);
      log('Saved page content to page-content.html');
      
      // Take a screenshot after navigation
      await page.screenshot({ path: 'after-next-click.png' });
      log('Took screenshot: after-next-click.png');
      
      // Handle potential unusual login attempt detection
      await handleUnusualActivity(page);

      // Wait for password field and fill it in
      log('Filling in password...');
      
      // First, try to find the password field directly
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[data-testid*="password"]',
        'input[autocomplete="current-password"]',
        'input[type*="password" i]',
        'input[data-*="password" i]',
        'input[class*="password" i]',
        'input[placeholder*="password" i]',
        'input[type*="text"][name*="password" i]',
        'input[type*="text"][data-testid*="password" i]',
        'input[type*="text"][placeholder*="password" i]'
      ];
      
      // Add a delay to ensure the password field is loaded
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take a screenshot to help with debugging
      await page.screenshot({ path: 'before-password.png' });
      log('Took screenshot: before-password.png');
      
      // Try to find the password field
      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements && elements.length > 0) {
            passwordInput = elements[0];
            log(`Found password field with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(`Error with selector ${selector}: ${error.message}`);
        }
      }
      
      // If still not found, try to find all inputs and look for password type
      if (!passwordInput) {
        log('Password field not found with direct selectors, trying fallback method...');
        const inputs = await page.$$('input');
        log(`Found ${inputs.length} input elements on the page`);
        
        for (const input of inputs) {
          try {
            const inputType = await input.evaluate(el => el.type || '');
            const inputName = await input.evaluate(el => el.name || '');
            const inputId = await input.evaluate(el => el.id || '');
            const inputClass = await input.evaluate(el => el.className || '');
            const inputPlaceholder = (await input.evaluate(el => el.placeholder || '')).toLowerCase();
            
            log(`Input - type: ${inputType}, name: ${inputName}, id: ${inputId}, class: ${inputClass}, placeholder: ${inputPlaceholder}`);
            
            if (inputType.toLowerCase() === 'password' || 
                inputName.toLowerCase().includes('password') ||
                inputId.toLowerCase().includes('password') ||
                inputClass.toLowerCase().includes('password') ||
                inputPlaceholder.includes('password')) {
              passwordInput = input;
              log('Found password field using fallback method');
              break;
            }
          } catch (error) {
            log(`Error checking input: ${error.message}`);
          }
        }
      }
      
      if (!passwordInput) {
        throw new Error('Could not find password input field on the page');
      }
      
      // Make sure the input is visible and interactable
      await passwordInput.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await page.evaluate(el => {
        el.style.border = '2px solid red';
      }, passwordInput);
      
      // Click the input first to focus it
      await passwordInput.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Type the password with a small delay between keystrokes
      await passwordInput.type(password, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Take a screenshot after entering the password
      await page.screenshot({ path: 'after-password.png' });
      log('Took screenshot: after-password.png');

      // Click the login button
      log('Submitting login form...');
      const loginButtonSelectors = [
        'div[data-testid*="Login"]',
        'button[type="submit"]',
        'div[role="button"][data-testid*="login"]',
        'div[role="button"]',
        'button:not([disabled])',
        'div[class*="login" i]',
        'div[class*="submit" i]'
      ];
      
      const loginButton = await waitForAnyElement(page, loginButtonSelectors, {
        timeout: 30000,
        timeoutMessage: 'Could not find login button'
      });
      
      await loginButton.click();

      // Wait for navigation to complete after login
      log('Waiting for login to complete...');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

      // Navigate to bookmarks
      log('Navigating to bookmarks...');
      await page.goto('https://x.com/i/bookmarks', { 
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000
      });

      // Wait for bookmarks to load
      log('Waiting for bookmarks to load...');
      const bookmarkSelector = 'article[data-testid="tweet"]';
      await waitForElement(page, bookmarkSelector, {
        timeout: 60000,
        timeoutMessage: 'Bookmarks did not load within the expected time'
      });

      // Scroll to load more bookmarks
      log('Loading more bookmarks...');
      await autoScroll(page);

      // Extract bookmarks
      log('Extracting bookmarks...');
      const bookmarks = await page.evaluate(() => {
        const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        return tweetElements.map(tweet => {
          const textElement = tweet.querySelector('div[data-testid="tweetText"]');
          const authorElement = tweet.querySelector('div[data-testid="User-Name"] a[role="link"]');
          const timeElement = tweet.querySelector('time');
          const linkElement = tweet.querySelector('a[href*="/status/"]');
          
          return {
            id: tweet.getAttribute('data-tweet-id') || '',
            text: textElement ? textElement.textContent.trim() : '',
            author: authorElement ? authorElement.textContent.trim() : '',
            timestamp: timeElement ? timeElement.getAttribute('datetime') : '',
            url: linkElement ? `https://twitter.com${linkElement.getAttribute('href')}` : ''
          };
        });
      });

      log(`Successfully extracted ${bookmarks.length} bookmarks`);
      
      // Save bookmarks to a file
      const outputFile = 'bookmarks.json';
      const outputData = {
        timestamp: new Date().toISOString(),
        count: bookmarks.length,
        bookmarks
      };
      
      await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2));
      log(`Bookmarks saved to ${outputFile}`);
      
      return bookmarks;
      
    } catch (error) {
      retryCount++;
      log(`Attempt ${retryCount} failed: ${error.message}`);
      
      // Close the browser if it exists
      if (browser) {
        await browser.close().catch(e => log('Error closing browser:', e));
      }
      
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      log(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// Handle command line execution
if (require.main === module) {
  scrapeBookmarks()
    .then(bookmarks => {
      log(`Successfully processed ${bookmarks.length} bookmarks`);
      process.exit(0);
    })
    .catch(error => {
      log('Error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeBookmarks };
