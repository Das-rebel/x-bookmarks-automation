// Background script for Twitter Bookmark Extractor extension

chrome.runtime.onInstalled.addListener(() => {
    console.log('🐦 Twitter Bookmark Extractor extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Open popup when icon is clicked
    chrome.action.openPopup();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    sendResponse({ received: true });
});
