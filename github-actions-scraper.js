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
        
        // Click next button
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('div[data-testid="flowActions"] button[type="submit"]')
        ]);
        
        // Wait for password field
        await page.waitForSelector('input[name="password"]', { timeout: 10000 });
        await page.type('input[name="password"]', process.env.X_PASSWORD);
        
        // Submit password
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('div[data-testid="flowActions"] button[type="submit"]')
        ]);
        
        // Check for verification step
        try {
            await page.waitForSelector('input[name="text"]', { timeout: 5000 });
            console.log('Verification step detected');
            await page.type('input[name="text"]', process.env.X_USERNAME);
            await page.click('div[data-testid="flowActions"] button[type="submit"]');
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
