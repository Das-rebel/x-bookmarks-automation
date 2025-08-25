const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG_PATH = path.join(__dirname, '../chatgpt-agent-openapi.json');

async function getNgrokUrl() {
    try {
        // Try to get the ngrok URL from the API (works when ngrok is running locally)
        const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
        const httpsTunnel = response.data.tunnels.find(t => t.proto === 'https');
        if (httpsTunnel) {
            return httpsTunnel.public_url;
        }
    } catch (error) {
        console.warn('Could not fetch ngrok URL from local API, using fallback');
    }
    
    // Fallback to the static URL if API is not available
    return 'https://7c68a5579af7.ngrok-free.app';
}

async function updateConfig() {
    try {
        const ngrokUrl = await getNgrokUrl();
        const config = require(CONFIG_PATH);
        
        // Update the server URL
        if (config.servers && config.servers.length > 0) {
            config.servers[0].url = ngrokUrl;
            config.servers[0].description = `AI Agent Server via ngrok tunnel (auto-updated at ${new Date().toISOString()})`;
        }
        
        // Save the updated config
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log(`✅ Updated ngrok URL to: ${ngrokUrl}`);
        return ngrokUrl;
    } catch (error) {
        console.error('❌ Error updating ngrok URL:', error.message);
        throw error;
    }
}

// Export for use in other scripts
module.exports = { updateConfig };

// Run directly if this file is executed
if (require.main === module) {
    updateConfig();
}
