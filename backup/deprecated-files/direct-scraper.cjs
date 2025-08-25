require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting direct scraper workflow...');

// Run the scraper directly
const child = spawn('node', ['improved-scraper.cjs'], {
  env: process.env,
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`\nScraper process exited with code ${code}`);
  
  if (code === 0) {
    // Check if bookmarks.json was created
    const bookmarksFile = path.resolve(__dirname, 'bookmarks.json');
    
    if (fs.existsSync(bookmarksFile)) {
      try {
        const data = fs.readFileSync(bookmarksFile, 'utf8');
        const bookmarks = JSON.parse(data);
        
        console.log('✅ Scraping successful!');
        console.log(`📊 Found ${bookmarks.count || bookmarks.bookmarks?.length || 0} bookmarks`);
        console.log(`📅 Scraped at: ${bookmarks.timestamp}`);
        
        // You can add processing logic here
        // For example: send to database, process with AI, etc.
        
      } catch (error) {
        console.error('❌ Error reading bookmarks.json:', error.message);
      }
    } else {
      console.log('⚠️  No bookmarks.json file found - scraper may not have found any bookmarks');
    }
  } else {
    console.error('❌ Scraper failed with exit code:', code);
  }
});

child.on('error', (err) => {
  console.error('❌ Failed to start scraper:', err);
});
