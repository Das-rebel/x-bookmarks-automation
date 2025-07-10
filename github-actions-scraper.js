console.log('Script started - Version 1.5.7');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform, process.arch);

const puppeteer = require('puppeteer');
const axios = require('axios');

// Log Puppeteer version
console.log('Puppeteer version:', require('puppeteer/package.json').version);

async function clickButtonByText(page, text) {
    console.log(`Looking for button with text: ${text}`);
    
    try {
        // First try to find and click using the exact text match
        const button = await page.waitForXPath(
            `//div[@role='button' and contains(., '${text}')] | //button[contains(., '${text}')]`, 
            { visible: true, timeout: 10000 }
        );
        
        if (button) {
            console.log(`Clicking button with text: '${text}'`);
            await button.click();
            await page.waitForTimeout(2000); // Short delay after click
            return true;
        }
    } catch (error) {
        console.log(`Button with text '${text}' not found via XPath, trying alternative selectors...`);
    }
    
    // Fallback to trying all buttons
    const buttons = await page.$$('button, div[role="button"]');
    console.log(`Found ${buttons.length} potential buttons`);
    
    for (const [index, btn] of buttons.entries()) {
        try {
            const btnText = await page.evaluate(el => el.innerText, btn);
            console.log(`Button ${index + 1} text: '${btnText}'`);
            
            if (btnText && btnText.includes(text)) {
                const isVisible = await btn.isVisible();
                if (isVisible) {
                    console.log(`Clicking button with text: '${btnText}'`);
                    
                    // Take a screenshot before clicking for debugging
                    await page.screenshot({ path: `before-click-${text.replace(/\s+/g, '-').toLowerCase()}.png` });
                    
                    // Scroll the button into view and click
                    await btn.scrollIntoViewIfNeeded();
                    await btn.click({ delay: 100 });
                    
                    // Wait a bit for any potential navigation or UI updates
                    await page.waitForTimeout(3000);
                    
                    // Take a screenshot after clicking
                    await page.screenshot({ path: `after-click-${text.replace(/\s+/g, '-').toLowerCase()}.png` });
                    
                    return true;
                } else {
                    console.log(`Button '${btnText}' is not visible`);
                }
            }
        } catch (e) {
            console.log(`Error processing button: ${e.message}`);
        }
    }
    
    // If we get here, no matching button was found
    console.log(`No visible button with text '${text}' found`);
    await page.screenshot({ path: `no-${text.replace(/\s+/g, '-').toLowerCase()}-button.png` });
    return false;
}

async function scrapeBookmarks() {
    let browser;
    try {
        // Check if required environment variables are set
        if (!process.env.X_USERNAME || !process.env.X_PASSWORD) {
            console.error('Error: X_USERNAME and X_PASSWORD environment variables must be set');
            process.exit(1);
        }

        // Configure browser launch options
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
                '--disable-gpu',
                '--window-size=1920,1080',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        };

        // Use browserless if token is provided
        if (process.env.BROWSERLESS_TOKEN) {
            console.log('Connecting to browserless.io...');
            launchOptions.browserWSEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`;
        }

        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        // Set a reasonable default navigation timeout
        page.setDefaultNavigationTimeout(90000); // Increased to 90 seconds
        page.setDefaultTimeout(45000); // Increased to 45 seconds

        // Enable request interception to block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            // Block images, styles, fonts, and media to speed up loading
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navigate to X.com login page
        console.log('Navigating to X.com login page...');
        await page.goto('https://x.com/login', { 
            waitUntil: 'domcontentloaded',
            timeout: 120000 // 2 minutes
        });

        // Take a screenshot of the initial page
        await page.screenshot({ path: 'initial-page.png' });
        
        try {
            // Wait for the username input field to be visible and ready
            console.log('Waiting for username field...');
            await page.waitForSelector('input[name="text"]', { 
                visible: true,
                timeout: 30000
            });
            
            // Type the username
            console.log('Typing username...');
            const usernameInput = await page.$('input[name="text"]');
            await usernameInput.click({ clickCount: 3 }); // Select any existing text
            await usernameInput.press('Backspace'); // Clear the field
            await usernameInput.type(process.env.X_USERNAME, { delay: 50 });
            
            // Click the Next button
            console.log('Clicking Next...');
            await page.$$eval('button, [role="button"]', (buttons, text) => {
                const button = Array.from(buttons).find(btn => 
                    btn.textContent.includes(text) && 
                    !btn.disabled &&
                    btn.offsetParent !== null
                );
                if (button) {
                    button.click();
                    return true;
                }
                return false;
            }, 'Next').then(clicked => {
                if (!clicked) throw new Error('Next button not found');
            });
            
            // After clicking Next, check if we're on verification or password screen
            console.log('Checking for verification or password screen...');
            
            // Wait for either the verification input or password field to appear
            const verificationOrPassword = await Promise.race([
                page.waitForSelector('input[name="text"][data-testid="ocfEnterTextTextInput"]', { visible: true, timeout: 10000 })
                    .then(() => 'verification'),
                page.waitForSelector('input[name="password"]', { visible: true, timeout: 10000 })
                    .then(() => 'password')
            ]).catch(() => 'password'); // Default to password screen if neither is found
            
            if (verificationOrPassword === 'verification') {
                console.log('Verification screen detected. Entering email...');
                // Type the verification email
                const verificationInput = await page.$('input[name="text"][data-testid="ocfEnterTextTextInput"]');
                await verificationInput.type("sdas22@gmail.com", { delay: 50 });
                
                // Click the Next button
                console.log('Clicking Next after verification...');
                await page.$$eval('button, [role="button"]', (buttons, text) => {
                    const button = Array.from(buttons).find(btn => 
                        btn.textContent.includes(text) && 
                        !btn.disabled &&
                        btn.offsetParent !== null
                    );
                    if (button) {
                        button.click();
                        return true;
                    }
                    return false;
                }, 'Next').then(clicked => {
                    if (!clicked) throw new Error('Next button not found after verification');
                });
                
                // Wait for the password field
                console.log('Waiting for password field...');
                await page.waitForSelector('input[name="password"]', { 
                    visible: true,
                    timeout: 30000
                });
            } else {
                console.log('Password screen detected, proceeding with password entry...');
            }
            
            // Type the password
            console.log('Typing password...');
            const passwordInput = await page.$('input[name="password"]');
            await passwordInput.type(process.env.X_PASSWORD, { delay: 50 });
            
            // Click the Log in button
            console.log('Clicking Log in...');
            await page.$$eval('button, [role="button"]', (buttons, text) => {
                const button = Array.from(buttons).find(btn => 
                    btn.textContent.includes(text) && 
                    !btn.disabled &&
                    btn.offsetParent !== null
                );
                if (button) {
                    button.click();
                    return true;
                }
                return false;
            }, 'Log in').then(clicked => {
                if (!clicked) throw new Error('Log in button not found');
            });
            
            // Wait for navigation after login
            console.log('Waiting for login to complete...');
            await page.waitForNavigation({ 
                waitUntil: 'networkidle0', 
                timeout: 120000 
            });
            
            // Take a screenshot after login
            await page.screenshot({ path: 'after-login.png' });
            
        } catch (error) {
            console.error('Error during login flow:', error);
            await page.screenshot({ path: 'login-error.png' });
            throw error;
        }

        // Wait for login to complete by checking for the home timeline or bookmarks link
        console.log('Waiting for login to complete...');
        try {
            await page.waitForSelector('[data-testid="AppTabBar_Bookmarks_Link"]', { visible: true, timeout: 30000 });
            console.log('Successfully logged in!');
        } catch (e) {
            console.log('Timed out waiting for login to complete, checking current URL...');
            const currentUrl = page.url();
            console.log(`Current URL: ${currentUrl}`);
            
            // Check if we're on a verification page
            if (currentUrl.includes('account/login_challenge') || await page.$('input[name="text"]') !== null) {
                console.log('Verification step detected, attempting to handle...');
                await page.type('input[name="text"]', process.env.X_USERNAME, { delay: 100 });
                await clickButtonByText(page, 'Next');
                
                // Wait for login to complete after verification
                await page.waitForSelector('[data-testid="AppTabBar_Bookmarks_Link"]', { visible: true, timeout: 30000 });
            } else {
                // Take a screenshot for debugging
                await page.screenshot({ path: 'login-error.png' });
                console.log('Screenshot saved as login-error.png');
                throw new Error('Failed to log in - unknown page state');
            }
        }
        
        // Check for verification step
        try {
            await page.waitForSelector('input[name="text"]', { timeout: 5000 });
            console.log('Verification step detected');
            await page.type('input[name="text"]', process.env.X_USERNAME);
            
            // Log all button texts and click the first visible button for verification
            await new Promise(resolve => setTimeout(resolve, 1000));
            const verifyButtons = await page.$$('button');
            for (const btn of verifyButtons) {
                const text = await page.evaluate(el => el.innerText, btn);
                console.log('Button text in verification:', text);
            }
            for (const btn of verifyButtons) {
                const isVisible = await btn.boundingBox() !== null;
                if (isVisible) {
                    await btn.click();
                    break;
                }
            }
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        } catch (error) {
            console.log('No verification step required');
        }
        
        // Wait for login to complete
        await page.waitForSelector('[data-testid="AppTabBar"]', { timeout: 10000 });
        
        // Verify successful login
        try {
            await page.waitForSelector('[data-testid="sidebarNavigationItem-Bookmarks"]', { timeout: 5000 });
            console.log('Successfully logged in');
        } catch (error) {
            console.error('Login verification failed');
            throw error;
        }

        // Wait for bookmarks page to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Navigate to bookmarks page
        await page.goto('https://x.com/bookmarks');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Extract bookmarks
        const bookmarks = await page.evaluate(() => {
            const bookmarkElements = document.querySelectorAll('article[data-testid="tweet"]');
            return Array.from(bookmarkElements).map(element => ({
                text: element.textContent.trim(),
                url: element.querySelector('a').href,
                timestamp: element.querySelector('[data-testid="tweetTimestamp"]')?.textContent
            }));
        });

        // Save bookmarks to a local file
        const fs = require('fs');
        const data = {
            bookmarks: bookmarks,
            count: bookmarks.length,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync('bookmarks.json', JSON.stringify(data, null, 2));
        console.log(`Bookmarks saved to bookmarks.json`);

        console.log(`Successfully scraped ${bookmarks.length} bookmarks`);
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

scrapeBookmarks().catch(console.error);
