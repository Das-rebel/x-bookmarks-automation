import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../chatgpt-agent-openapi.json');
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';
const CHECK_INTERVAL = 60000; // Check every minute
const DEFAULT_PORT = 3000;
const NGROK_CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.ngrok2/ngrok.yml');

let currentUrl = null;
let isUpdating = false;
let ngrokProcess = null;

class NgrokManager {
  constructor() {
    this.lastChecked = null;
    this.port = process.env.PORT || DEFAULT_PORT;
    this.ngrokAuthToken = process.env.NGROK_AUTH_TOKEN;
    this.ngrokRegion = process.env.NGROK_REGION || 'us';
    this.ngrokSubdomain = process.env.NGROK_SUBDOMAIN;
  }

  async getActiveNgrokUrl() {
    try {
      const response = await axios.get(NGROK_API, { timeout: 5000 });
      const httpsTunnel = response.data.tunnels.find(t => t.proto === 'https');
      return httpsTunnel?.public_url || null;
    } catch (error) {
      console.error('❌ Error fetching ngrok URL:', error.message);
      return null;
    }
  }

  async updateConfig(ngrokUrl) {
    if (ngrokUrl === currentUrl) return false;

    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      
      if (config.servers && config.servers.length > 0) {
        // Update the ngrok URL
        config.servers[0].url = ngrokUrl;
        config.servers[0].description = `AI Agent Server via ngrok tunnel (auto-updated at ${new Date().toISOString()})`;
        
        // Also update any other server entries that might be ngrok URLs
        config.servers.forEach(server => {
          if (server.url.includes('ngrok')) {
            server.url = ngrokUrl;
            server.description = `AI Agent Server via ngrok tunnel (auto-updated at ${new Date().toISOString()})`;
          }
        });
        
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log(`✅ Updated ngrok URL to: ${ngrokUrl}`);
        currentUrl = ngrokUrl;
        return true;
      }
    } catch (error) {
      console.error('❌ Error updating config:', error.message);
    }
    return false;
  }

  async checkAndUpdate() {
    if (isUpdating) return;
    isUpdating = true;
    
    try {
      const ngrokUrl = await this.getActiveNgrokUrl();
      if (ngrokUrl) {
        await this.updateConfig(ngrokUrl);
      } else {
        console.log('⚠️  No active ngrok tunnel found. Attempting to start one...');
        await this.startNgrokTunnel();
      }
    } catch (error) {
      console.error('❌ Error in checkAndUpdate:', error);
    } finally {
      isUpdating = false;
    }
  }

  async startNgrokTunnel() {
    if (ngrokProcess) {
      console.log('🔄 Ngrok process already running, restarting...');
      this.stopNgrokTunnel();
    }

    console.log('🚀 Starting ngrok tunnel...');
    
    // Build ngrok command with options
    let ngrokCmd = `ngrok http ${this.port}`;
    
    if (this.ngrokRegion) {
      ngrokCmd += ` --region ${this.ngrokRegion}`;
    }
    
    if (this.ngrokSubdomain) {
      ngrokCmd += ` --subdomain ${this.ngrokSubdomain}`;
    }

    console.log(`📡 Running: ${ngrokCmd}`);
    
    ngrokProcess = exec(ngrokCmd);
    
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[NGROK] ${output.trim()}`);
      
      if (output.includes('started tunnel') || output.includes('url=')) {
        console.log('✅ Ngrok tunnel started. Will update config on next check.');
      }
    });
    
    ngrokProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('msg="starting web interface"')) {
        console.error(`[NGROK ERROR] ${error.trim()}`);
      }
    });
    
    ngrokProcess.on('exit', (code) => {
      console.log(`⚠️  Ngrok process exited with code ${code}. Will attempt to restart...`);
      ngrokProcess = null;
      setTimeout(() => this.startNgrokTunnel(), 5000);
    });

    // Wait a bit for ngrok to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  stopNgrokTunnel() {
    if (ngrokProcess) {
      console.log('🛑 Stopping ngrok tunnel...');
      ngrokProcess.kill();
      ngrokProcess = null;
    }
  }

  async checkNgrokStatus() {
    try {
      const response = await axios.get(NGROK_API, { timeout: 5000 });
      const tunnels = response.data.tunnels;
      
      console.log('\n🔍 Ngrok Status:');
      console.log(`   Active tunnels: ${tunnels.length}`);
      
      tunnels.forEach(tunnel => {
        console.log(`   ${tunnel.proto.toUpperCase()}: ${tunnel.public_url}`);
        console.log(`   Local: ${tunnel.config.addr}`);
        console.log(`   Status: ${tunnel.status}`);
      });
      
      return tunnels;
    } catch (error) {
      console.log('❌ Could not fetch ngrok status');
      return [];
    }
  }

  async validateNgrokSetup() {
    console.log('\n🔧 Validating ngrok setup...');
    
    // Check if ngrok is installed
    try {
      const { execSync } = await import('child_process');
      execSync('ngrok version', { stdio: 'pipe' });
      console.log('✅ Ngrok is installed');
    } catch (error) {
      console.log('❌ Ngrok is not installed. Please install ngrok first:');
      console.log('   npm install -g ngrok');
      console.log('   or visit: https://ngrok.com/download');
      return false;
    }

    // Check auth token
    if (!this.ngrokAuthToken) {
      console.log('⚠️  NGROK_AUTH_TOKEN not set. Some features may be limited.');
      console.log('   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken');
    } else {
      console.log('✅ Ngrok auth token configured');
    }

    // Check config file
    if (fs.existsSync(CONFIG_PATH)) {
      console.log('✅ ChatGPT agent config found');
    } else {
      console.log('❌ ChatGPT agent config not found');
      return false;
    }

    return true;
  }

  startMonitoring() {
    console.log('🔍 Starting ngrok URL monitor...');
    this.validateNgrokSetup().then(isValid => {
      if (isValid) {
        this.checkAndUpdate();
        setInterval(() => this.checkAndUpdate(), CHECK_INTERVAL);
      }
    });
  }

  async getPublicUrl() {
    const url = await this.getActiveNgrokUrl();
    if (url) {
      console.log(`🌐 Public URL: ${url}`);
      return url;
    } else {
      console.log('❌ No active ngrok tunnel found');
      return null;
    }
  }
}

export default new NgrokManager();
