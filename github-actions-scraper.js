console.log('Script started - Version 1.0.4');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform, process.arch);

const puppeteer = require('puppeteer');
const axios = require('axios');

// Log Puppeteer version
console.log('Puppeteer version:', require('puppeteer/package.json').version);

async function clickButtonByText(page, text) {
    console.log(`Looking for button with text: ${text}`);
    const buttons = await page.$$('button');
    let clicked = false;
    
    for (const btn of buttons) {
        try {
            const btnText = await page.evaluate(el => el.innerText, btn);
            console.log(`Found button with text: '${btnText}'`);
            
            if (btnText && btnText.includes(text)) {
                const isVisible = await btn.boundingBox() !== null;
                if (isVisible) {
                    console.log(`Clicking button with text: '${btnText}'`);
                    
                    // Take a screenshot before clicking for debugging
                    await page.screenshot({ path: `before-click-${text.replace(/\s+/g, '-').toLowerCase()}.png` });
                    
                    // Click the button without waiting for navigation
                    await Promise.all([
                        btn.click(),
                        // Wait for either navigation or a timeout
                        new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
                    ]);
                    
                    clicked = true;
                    
                    // Take a screenshot after clicking
                    await page.screenshot({ path: `after-click-${text.replace(/\s+/g, '-').toLowerCase()}.png` });
                    
                    // Check if we need to handle any popups or dialogs
                    try {
                        const dialog = await new Promise(resolve => 
                            page.once('dialog', resolve)
                        );
                        console.log('Dialog detected:', dialog.message());
                        await dialog.dismiss();
                    } catch (e) {
                        // No dialog appeared, continue
                    }
                    
                    break;
                } else {
                    console.log(`Button '${btnText}' is not visible`);
                }
            }
        } catch (e) {
            console.log('Error processing button:', e.message);
        }
    }
    
    if (!clicked) {
        console.log(`No visible button with text '${text}' found`);
        // Take a screenshot of the current page for debugging
        await page.screenshot({ path: `no-${text.replace(/\s+/g, '-').toLowerCase()}-button.png` });
    }
    
    return clicked;
}

async function scrapeBookmarks() {
    let browser;
    try {
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
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        };

        if (process.env.BROWSERLESS_TOKEN) {
            browser = await puppeteer.connect({
                browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
                ...launchOptions
            });
        } else {
            browser = await puppeteer.launch(launchOptions);
        }

        const page = await browser.newPage();
        
        // Set a longer default navigation timeout (60 seconds)
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(30000);
        
        console.log('Navigating to X.com login page...');
        await page.goto('https://x.com/login', { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('Filling in username...');
        await page.waitForSelector('input[name="text"]', { visible: true, timeout: 10000 });
        await page.type('input[name="text"]', process.env.X_USERNAME, { delay: 100 });
        
        console.log('Clicking Next button...');
        await clickButtonByText(page, 'Next');
        
        // Wait for password field and fill it in
        console.log('Waiting for password field...');
        await page.waitForSelector('input[name="password"]', { visible: true, timeout: 10000 });
        await page.type('input[name="password"]', process.env.X_PASSWORD, { delay: 100 });
        
        console.log('Clicking Log in button...');
        await clickButtonByText(page, 'Log in');
        
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
