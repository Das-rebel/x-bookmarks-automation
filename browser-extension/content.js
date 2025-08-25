// Content script for Twitter Bookmark Extractor extension

class BookmarkExtractor {
    constructor() {
        this.isExtracting = false;
        this.bookmarks = [];
        this.targetCount = 500;
        this.lastHeight = 0;
        this.noNewContentAttempts = 0;
        this.maxNoNewContentAttempts = 10;
        
        this.init();
    }
    
    init() {
        this.log('🔍 Bookmark Extractor initialized');
        this.setupMessageListener();
        this.injectExtractionButton();
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startExtraction':
                this.targetCount = message.targetCount || 500;
                this.startExtraction();
                break;
                
            case 'stopExtraction':
                this.stopExtraction();
                break;
        }
        
        sendResponse({ received: true });
    }
    
    injectExtractionButton() {
        // Create a floating extraction button
        const button = document.createElement('div');
        button.id = 'bookmark-extractor-button';
        button.innerHTML = '🐦 Extract';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1da1f2;
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            cursor: pointer;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: all 0.2s;
        `;
        
        button.addEventListener('click', () => {
            if (!this.isExtracting) {
                this.startExtraction();
            } else {
                this.stopExtraction();
            }
        });
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        });
        
        document.body.appendChild(button);
    }
    
    async startExtraction() {
        if (this.isExtracting) {
            this.log('⚠️ Extraction already in progress');
            return;
        }
        
        this.log('🚀 Starting bookmark extraction...');
        this.isExtracting = true;
        this.bookmarks = [];
        this.lastHeight = 0;
        this.noNewContentAttempts = 0;
        
        // Update button
        const button = document.getElementById('bookmark-extractor-button');
        if (button) {
            button.innerHTML = '⏹️ Stop';
            button.style.background = '#e74c3c';
        }
        
        // Start extraction loop
        this.extractionLoop();
    }
    
    stopExtraction() {
        this.log('⏹️ Stopping extraction...');
        this.isExtracting = false;
        
        // Update button
        const button = document.getElementById('bookmark-extractor-button');
        if (button) {
            button.innerHTML = '🐦 Extract';
            button.style.background = '#1da1f2';
        }
        
        // Send completion message
        this.sendMessage({
            type: 'extractionComplete',
            bookmarks: this.bookmarks
        });
    }
    
    async extractionLoop() {
        while (this.isExtracting && this.bookmarks.length < this.targetCount) {
            try {
                // Extract visible bookmarks
                await this.extractVisibleBookmarks();
                
                // Check if we have enough
                if (this.bookmarks.length >= this.targetCount) {
                    this.log(`🎯 Reached target of ${this.targetCount} bookmarks`);
                    break;
                }
                
                // Scroll to load more
                await this.scrollToLoadMore();
                
                // Wait for content to load
                await this.wait(2000);
                
                // Check if we're getting new content
                const newHeight = document.body.scrollHeight;
                if (newHeight === this.lastHeight) {
                    this.noNewContentAttempts++;
                    this.log(`⏳ No new content loaded, attempt ${this.noNewContentAttempts}/${this.maxNoNewContentAttempts}`);
                    
                    if (this.noNewContentAttempts >= this.maxNoNewContentAttempts) {
                        this.log('🛑 No new content after multiple attempts, stopping');
                        break;
                    }
                } else {
                    this.lastHeight = newHeight;
                    this.noNewContentAttempts = 0;
                }
                
                // Send progress update
                const progress = Math.round((this.bookmarks.length / this.targetCount) * 100);
                this.sendMessage({
                    type: 'extractionProgress',
                    progress: progress,
                    current: this.bookmarks.length,
                    total: this.targetCount
                });
                
            } catch (error) {
                this.log(`❌ Error in extraction loop: ${error.message}`, 'ERROR');
                this.sendMessage({
                    type: 'extractionError',
                    error: error.message
                });
                break;
            }
        }
        
        // Extraction complete
        this.stopExtraction();
    }
    
    async extractVisibleBookmarks() {
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        this.log(`📊 Found ${tweets.length} tweets on page`);
        
        let newBookmarks = 0;
        
        tweets.forEach((tweet, index) => {
            try {
                // Skip if we already have this tweet
                const tweetId = this.extractTweetId(tweet);
                if (!tweetId || this.bookmarks.some(b => b.id === tweetId)) {
                    return;
                }
                
                // Extract tweet data
                const bookmark = this.extractTweetData(tweet, tweetId);
                if (bookmark) {
                    this.bookmarks.push(bookmark);
                    newBookmarks++;
                    
                    // Send individual bookmark update
                    this.sendMessage({
                        type: 'bookmarkExtracted',
                        bookmark: bookmark
                    });
                    
                    this.log(`✅ Extracted bookmark ${this.bookmarks.length}: ${bookmark.text.substring(0, 50)}...`);
                }
                
            } catch (error) {
                this.log(`⚠️ Error extracting tweet ${index}: ${error.message}`, 'WARN');
            }
        });
        
        if (newBookmarks > 0) {
            this.log(`📈 Extracted ${newBookmarks} new bookmarks`);
        }
    }
    
    extractTweetId(tweet) {
        const linkElement = tweet.querySelector('a[href*="/status/"]');
        if (!linkElement) return null;
        
        const href = linkElement.href;
        const match = href.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
    }
    
    extractTweetData(tweet, tweetId) {
        try {
            // Extract tweet text
            const textElement = tweet.querySelector('[data-testid="tweetText"]');
            const text = textElement ? textElement.textContent : '';
            
            // Extract author info
            const authorElement = tweet.querySelector('[data-testid="User-Name"]');
            let author = '';
            let authorHandle = '';
            
            if (authorElement) {
                const authorText = authorElement.textContent;
                const parts = authorText.split('@');
                author = parts[0]?.trim() || '';
                authorHandle = parts[1]?.split('\n')[0]?.trim() || '';
            }
            
            // Extract timestamp
            const timeElement = tweet.querySelector('time');
            const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';
            
            // Extract engagement metrics
            const replyCount = this.extractMetric(tweet, 'reply');
            const retweetCount = this.extractMetric(tweet, 'retweet');
            const likeCount = this.extractMetric(tweet, 'like');
            
            // Extract media info
            const hasMedia = tweet.querySelector('img[alt="Image"], video') !== null;
            
            // Extract URL
            const url = `https://twitter.com/${authorHandle}/status/${tweetId}`;
            
            return {
                id: tweetId,
                text: text,
                author: author,
                authorHandle: authorHandle,
                timestamp: timestamp,
                replyCount: replyCount,
                retweetCount: retweetCount,
                likeCount: likeCount,
                hasMedia: hasMedia,
                url: url,
                extractedAt: new Date().toISOString()
            };
            
        } catch (error) {
            this.log(`⚠️ Error extracting tweet data: ${error.message}`, 'WARN');
            return null;
        }
    }
    
    extractMetric(tweet, metricType) {
        try {
            const element = tweet.querySelector(`[data-testid="${metricType}"]`);
            if (!element) return '0';
            
            const text = element.textContent;
            if (!text) return '0';
            
            // Extract number from text like "1.2K", "500", etc.
            const match = text.match(/(\d+(?:\.\d+)?[KMB]?)/);
            return match ? match[1] : '0';
            
        } catch (error) {
            return '0';
        }
    }
    
    async scrollToLoadMore() {
        // Scroll to bottom to trigger lazy loading
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait a bit for content to load
        await this.wait(1000);
        
        // Scroll back up a bit to avoid being at the very bottom
        window.scrollTo(0, document.body.scrollHeight - 1000);
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    sendMessage(message) {
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            this.log(`⚠️ Error sending message: ${error.message}`, 'WARN');
        }
    }
    
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        console.log(logMessage);
        
        // Also send to popup if possible
        try {
            this.sendMessage({
                type: 'log',
                message: logMessage,
                level: level
            });
        } catch (error) {
            // Ignore errors when popup is closed
        }
    }
}

// Initialize extractor when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new BookmarkExtractor();
    });
} else {
    new BookmarkExtractor();
}
