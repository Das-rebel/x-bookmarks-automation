import ngrokManager from './utils/ngrokManager.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the server
const startServer = () => {
  console.log('🚀 Starting bookmark processing server...');
  
  // Check if server.js exists
  const serverPath = path.join(__dirname, 'server.js');
  if (!import('fs').then(fs => fs.existsSync(serverPath))) {
    console.error('❌ server.js not found. Please ensure the server file exists.');
    process.exit(1);
  }

  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });

  server.on('close', (code) => {
    console.error(`⚠️  Server process exited with code ${code}. Attempting to restart...`);
    setTimeout(startServer, 3000);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    setTimeout(startServer, 3000);
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.kill();
    ngrokManager.stopNgrokTunnel();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    server.kill();
    ngrokManager.stopNgrokTunnel();
    process.exit(0);
  });

  return server;
};

// Main startup sequence
const main = async () => {
  try {
    console.log('🔧 Initializing enhanced ngrok manager for bookmark automation...');
    
    // Start ngrok monitoring
    ngrokManager.startMonitoring();
    
    // Give ngrok a moment to start and validate
    console.log('⏳ Waiting for ngrok to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check ngrok status
    await ngrokManager.checkNgrokStatus();
    
    // Get public URL
    const publicUrl = await ngrokManager.getPublicUrl();
    if (publicUrl) {
      console.log(`\n🌐 Your bookmark automation server is now accessible at:`);
      console.log(`   ${publicUrl}`);
      console.log(`\n📱 You can now use this URL in ChatGPT Actions or test the API directly.`);
      console.log(`\n🔗 Test endpoints:`);
      console.log(`   Health check: ${publicUrl}/health`);
      console.log(`   Scrape bookmarks: ${publicUrl}/scrape (POST with credentials)`);
    }
    
    // Start the server
    console.log('\n🚀 Starting bookmark processing server...');
    startServer();
    
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
};

// Run the main function
main().catch(console.error);
