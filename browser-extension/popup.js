// Popup script for Twitter Bookmark Extractor extension

class BookmarkExtractorPopup {
    constructor() {
        this.isExtracting = false;
        this.extractedCount = 0;
        this.targetCount = 500;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkCurrentTab();
        this.loadStats();
    }
    
    bindEvents() {
        document.getElementById('extractBtn').addEventListener('click', () => {
            this.startExtraction();
        });
        
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopExtraction();
        });
        
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }
    
    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && (tab.url.includes('twitter.com/i/bookmarks') || tab.url.includes('x.com/i/bookmarks'))) {
                this.updateStatus('Ready to extract bookmarks', 'success');
                document.getElementById('extractBtn').disabled = false;
            } else {
                this.updateStatus('Navigate to Twitter bookmarks page first', 'error');
                document.getElementById('extractBtn').disabled = true;
            }
        } catch (error) {
            console.error('Error checking current tab:', error);
        }
    }
    
    async startExtraction() {
        try {
            this.isExtracting = true;
            this.extractedCount = 0;
            
            this.updateStatus('Starting extraction...', 'info');
            this.showProgress();
            this.updateStats();
            
            // Send message to content script to start extraction
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'startExtraction',
                targetCount: this.targetCount
            });
            
            // Update UI
            document.getElementById('extractBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            
        } catch (error) {
            this.updateStatus(`Error starting extraction: ${error.message}`, 'error');
            this.isExtracting = false;
        }
    }
    
    async stopExtraction() {
        try {
            this.isExtracting = false;
            
            // Send message to content script to stop extraction
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'stopExtraction' });
            
            this.updateStatus('Extraction stopped', 'info');
            this.hideProgress();
            
            // Update UI
            document.getElementById('extractBtn').style.display = 'block';
            document.getElementById('stopBtn').style.display = 'none';
            
        } catch (error) {
            console.error('Error stopping extraction:', error);
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'extractionProgress':
                this.updateProgress(message.progress, message.current, message.total);
                break;
                
            case 'extractionComplete':
                this.extractionComplete(message.bookmarks);
                break;
                
            case 'extractionError':
                this.updateStatus(`Extraction error: ${message.error}`, 'error');
                this.isExtracting = false;
                break;
                
            case 'bookmarkExtracted':
                this.extractedCount++;
                this.updateStats();
                break;
        }
        
        sendResponse({ received: true });
    }
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }
    
    showProgress() {
        document.getElementById('progress').style.display = 'block';
        document.getElementById('stats').style.display = 'block';
    }
    
    hideProgress() {
        document.getElementById('progress').style.display = 'none';
    }
    
    updateProgress(percentage, current, total) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = `${percentage}% (${current}/${total})`;
        
        if (percentage >= 100) {
            this.hideProgress();
        }
    }
    
    updateStats() {
        document.getElementById('extractedCount').textContent = this.extractedCount;
        document.getElementById('progressCount').textContent = `${Math.round((this.extractedCount / this.targetCount) * 100)}%`;
        document.getElementById('extractionStatus').textContent = this.isExtracting ? 'Extracting...' : 'Ready';
    }
    
    async extractionComplete(bookmarks) {
        this.isExtracting = false;
        this.extractedCount = bookmarks.length;
        
        this.updateStatus(`Extraction complete! Found ${bookmarks.length} bookmarks`, 'success');
        this.updateStats();
        
        // Save to local storage
        await this.saveBookmarks(bookmarks);
        
        // Download JSON file
        this.downloadBookmarks(bookmarks);
        
        // Update UI
        document.getElementById('extractBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
        
        // Show completion message
        setTimeout(() => {
            this.updateStatus('Ready for next extraction', 'info');
        }, 3000);
    }
    
    async saveBookmarks(bookmarks) {
        try {
            const timestamp = new Date().toISOString();
            const key = `bookmarks_${timestamp}`;
            
            await chrome.storage.local.set({ [key]: bookmarks });
            console.log(`Saved ${bookmarks.length} bookmarks to storage`);
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }
    
    downloadBookmarks(bookmarks) {
        try {
            const dataStr = JSON.stringify(bookmarks, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `twitter-bookmarks-${timestamp}.json`;
            
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading bookmarks:', error);
        }
    }
    
    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['totalExtracted', 'lastExtraction']);
            
            if (result.totalExtracted) {
                document.getElementById('extractedCount').textContent = result.totalExtracted;
            }
            
            if (result.lastExtraction) {
                this.updateStatus(`Last extraction: ${new Date(result.lastExtraction).toLocaleDateString()}`, 'info');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BookmarkExtractorPopup();
});
