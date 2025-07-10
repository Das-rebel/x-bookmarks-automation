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
        await page.waitForSelector('input[type="text"]');
        await page.type('input[type="text"]', process.env.X_USERNAME);
        await page.type('input[type="password"]', process.env.X_PASSWORD);
        
        // Submit login form
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);

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

        // Send to n8n webhook
        await axios.post(process.env.N8N_WEBHOOK_URL, {
            bookmarks: bookmarks,
            count: bookmarks.length,
            timestamp: new Date().toISOString()
        });

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
