# Twitter Bookmark Extractor Browser Extension

A Chrome/Brave browser extension that extracts Twitter bookmarks without triggering anti-bot detection.

## 🚀 Installation

### Method 1: Load Unpacked Extension (Recommended)

1. **Download the extension files** to a folder on your computer
2. **Open Chrome/Brave** and go to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Manual Installation

1. Create a new folder called `twitter-bookmark-extractor`
2. Copy all the extension files into this folder
3. Follow Method 1 steps above

## 📱 How to Use

### Step 1: Navigate to Twitter Bookmarks
1. Go to `https://twitter.com/i/bookmarks`
2. Login to your Twitter account if prompted
3. Wait for the bookmarks page to fully load

### Step 2: Start Extraction
1. **Click the extension icon** in your toolbar
2. **Click "Extract Bookmarks"** in the popup
3. **Watch the progress** as bookmarks are extracted
4. **Wait for completion** (target: 500 bookmarks)

### Step 3: Download Results
1. **JSON file will automatically download** when complete
2. **File format**: `twitter-bookmarks-YYYY-MM-DD.json`
3. **Use the processing script** to import to your database

## 🔧 Features

- **Floating extraction button** on the Twitter page
- **Real-time progress tracking**
- **Automatic scrolling** to load more bookmarks
- **Duplicate detection** to avoid re-extraction
- **Comprehensive metadata** extraction
- **JSON export** for further processing

## 📊 Extracted Data

Each bookmark includes:
- Tweet ID and text content
- Author name and handle
- Timestamp and URL
- Engagement metrics (replies, retweets, likes)
- Media presence indicator
- Extraction timestamp

## 🚨 Troubleshooting

### Extension Not Working?
1. Check if you're on the correct Twitter page
2. Refresh the page and try again
3. Ensure the extension is enabled
4. Check browser console for errors

### Extraction Stops Early?
1. Twitter may have rate limiting
2. Try again during off-peak hours
3. Check your internet connection
4. Ensure you're logged into Twitter

### Missing Bookmarks?
1. Some tweets may not have the expected structure
2. Twitter's DOM structure changes frequently
3. Check the console for extraction errors
4. Try extracting in smaller batches

## 🔄 Integration with Your System

### Process Extracted Data
```bash
# Use the manual extraction processor
npm run process-manual

# This will:
# 1. Find the downloaded JSON file
# 2. Import bookmarks to Supabase
# 3. Generate a processing report
# 4. Handle duplicates automatically
```

### Database Schema
The extension extracts data compatible with your existing `twitter_memos` table:
- `content`: Tweet text
- `author`: Twitter handle
- `url`: Tweet URL
- `is_bookmark`: Set to true
- `bookmark_hash`: MD5 hash for deduplication
- `metadata`: JSON with additional tweet data

## 💡 Pro Tips

1. **Extract during off-peak hours** to avoid rate limiting
2. **Use incognito mode** to avoid session conflicts
3. **Close other Twitter tabs** to reduce memory usage
4. **Monitor the console** for extraction progress
5. **Stop extraction early** if you have enough bookmarks

## 🆘 Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify you're on the correct Twitter page
3. Ensure the extension is properly installed
4. Try refreshing the page and restarting extraction

---

**Note**: This extension works by directly interacting with Twitter's DOM, making it more reliable than automated scraping while avoiding detection.
