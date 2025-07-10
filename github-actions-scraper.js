const puppeteer = require('puppeteer');
const axios = require('axios');

async function scrapeBookmarks() {
    let browser;
    try {
        if (process.env.BROWSERLESS_TOKEN) {
            browser = await puppeteer.connect({
                browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
            });
        } else {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }

        const page = await browser.newPage();
        
        // Navigate to X.com login page
        await page.goto('https://x.com/login');
        
        // Wait for and fill in login form
        await page.waitForSelector('input[name="text"]', { timeout: 10000 });
        await page.type('input[name="text"]', process.env.X_USERNAME);
        
        // Log all button texts and click the first visible button after username
        await page.waitForTimeout(1000);
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.innerText, btn);
            console.log('Button text after username:', text);
        }
        for (const btn of buttons) {
            const isVisible = await btn.boundingBox() !== null;
            if (isVisible) {
                await btn.click();
                break;
            }
        }
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        // Wait for password field
        await page.waitForSelector('input[name="password"]', { timeout: 10000 });
        await page.type('input[name="password"]', process.env.X_PASSWORD);
        
        // Log all button texts and click the first visible button after password
        await page.waitForTimeout(1000);
        const buttons2 = await page.$$('button');
        for (const btn of buttons2) {
            const text = await page.evaluate(el => el.innerText, btn);
            console.log('Button text after password:', text);
        }
        for (const btn of buttons2) {
            const isVisible = await btn.boundingBox() !== null;
            if (isVisible) {
                await btn.click();
                break;
            }
        }
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        // Check for verification step
        try {
            await page.waitForSelector('input[name="text"]', { timeout: 5000 });
            console.log('Verification step detected');
            await page.type('input[name="text"]', process.env.X_USERNAME);
            
            // Log all button texts and click the first visible button for verification
            await page.waitForTimeout(1000);
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
        await page.waitForTimeout(5000);
        
        // Navigate to bookmarks page
        await page.goto('https://x.com/bookmarks');
        await page.waitForTimeout(5000);

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
