#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NgrokSetup {
    constructor() {
        this.ngrokPath = null;
        this.authToken = null;
        this.region = 'us';
        this.subdomain = null;
    }

    async run() {
        console.log('🚀 Ngrok Setup for Bookmark Automation');
        console.log('=====================================\n');

        try {
            // Check if ngrok is installed
            if (!await this.checkNgrokInstallation()) {
                await this.installNgrok();
            }

            // Get ngrok configuration
            await this.getConfiguration();

            // Configure ngrok
            await this.configureNgrok();

            // Test ngrok
            await this.testNgrok();

            // Update environment file
            await this.updateEnvironmentFile();

            // Create startup script
            await this.createStartupScript();

            console.log('\n✅ Ngrok setup completed successfully!');
            console.log('\n🚀 To start your bookmark automation server with ngrok:');
            console.log('   npm run start:ngrok');
            console.log('   or');
            console.log('   node start-with-ngrok.js');

        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async checkNgrokInstallation() {
        try {
            execSync('ngrok version', { stdio: 'pipe' });
            console.log('✅ Ngrok is already installed');
            return true;
        } catch (error) {
            console.log('❌ Ngrok is not installed');
            return false;
        }
    }

    async installNgrok() {
        console.log('\n📦 Installing ngrok...');
        
        const platform = process.platform;
        let installCommand = '';

        if (platform === 'darwin') {
            // macOS
            try {
                execSync('brew install ngrok/ngrok/ngrok', { stdio: 'inherit' });
            } catch (error) {
                console.log('⚠️  Homebrew installation failed, trying manual download...');
                installCommand = 'curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.agent.sig | sudo tee /usr/local/bin/ngrok > /dev/null && sudo chmod +x /usr/local/bin/ngrok';
            }
        } else if (platform === 'linux') {
            installCommand = 'curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.agent.sig | sudo tee /usr/local/bin/ngrok > /dev/null && sudo chmod +x /usr/local/bin/ngrok';
        } else if (platform === 'win32') {
            console.log('📥 Please download ngrok from https://ngrok.com/download and install manually');
            console.log('   Then run this setup script again');
            process.exit(1);
        } else {
            console.log('❌ Unsupported platform:', platform);
            process.exit(1);
        }

        if (installCommand) {
            try {
                execSync(installCommand, { stdio: 'inherit' });
            } catch (error) {
                console.error('❌ Manual installation failed');
                throw error;
            }
        }

        console.log('✅ Ngrok installed successfully');
    }

    async getConfiguration() {
        console.log('\n🔧 Ngrok Configuration');
        console.log('----------------------');

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'authToken',
                message: 'Enter your ngrok auth token (get it from https://dashboard.ngrok.com/get-started/your-authtoken):',
                validate: (input) => input.length > 0 ? true : 'Auth token is required'
            },
            {
                type: 'list',
                name: 'region',
                message: 'Select ngrok region:',
                choices: [
                    { name: 'United States (us)', value: 'us' },
                    { name: 'Europe (eu)', value: 'eu' },
                    { name: 'Asia Pacific (ap)', value: 'ap' },
                    { name: 'Australia (au)', value: 'au' },
                    { name: 'South America (sa)', value: 'sa' },
                    { name: 'Japan (jp)', value: 'jp' },
                    { name: 'India (in)', value: 'in' }
                ],
                default: 'us'
            },
            {
                type: 'input',
                name: 'subdomain',
                message: 'Enter custom subdomain (optional, leave empty for random):',
                default: ''
            }
        ]);

        this.authToken = answers.authToken;
        this.region = answers.region;
        this.subdomain = answers.subdomain || null;
    }

    async configureNgrok() {
        console.log('\n⚙️  Configuring ngrok...');

        try {
            // Add auth token
            execSync(`ngrok config add-authtoken ${this.authToken}`, { stdio: 'inherit' });
            console.log('✅ Auth token configured');

            // Create ngrok config file
            const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.ngrok2');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            const configPath = path.join(configDir, 'ngrok.yml');
            const config = {
                version: '2',
                authtoken: this.authToken,
                region: this.region,
                tunnels: {
                    bookmark-automation: {
                        proto: 'http',
                        addr: process.env.PORT || 3000,
                        subdomain: this.subdomain
                    }
                }
            };

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Ngrok configuration file created');

        } catch (error) {
            console.error('❌ Failed to configure ngrok:', error.message);
            throw error;
        }
    }

    async testNgrok() {
        console.log('\n🧪 Testing ngrok...');

        try {
            // Start ngrok in background
            const ngrok = spawn('ngrok', ['http', process.env.PORT || 3000, '--region', this.region]);
            
            // Wait for ngrok to start
            await new Promise((resolve, reject) => {
                let output = '';
                
                ngrok.stdout.on('data', (data) => {
                    output += data.toString();
                    if (output.includes('url=') || output.includes('started tunnel')) {
                        resolve();
                    }
                });

                ngrok.stderr.on('data', (data) => {
                    const error = data.toString();
                    if (error.includes('Error')) {
                        reject(new Error(error));
                    }
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    ngrok.kill();
                    reject(new Error('Ngrok startup timeout'));
                }, 10000);
            });

            // Get the public URL
            await new Promise(resolve => setTimeout(resolve, 2000));
            const response = await fetch('http://127.0.0.1:4040/api/tunnels');
            const data = await response.json();
            const httpsTunnel = data.tunnels.find(t => t.proto === 'https');

            if (httpsTunnel) {
                console.log(`✅ Ngrok tunnel active: ${httpsTunnel.public_url}`);
                this.publicUrl = httpsTunnel.public_url;
            } else {
                throw new Error('No HTTPS tunnel found');
            }

            // Stop ngrok
            ngrok.kill();

        } catch (error) {
            console.error('❌ Ngrok test failed:', error.message);
            throw error;
        }
    }

    async updateEnvironmentFile() {
        console.log('\n📝 Updating environment configuration...');

        const envPath = path.join(__dirname, '.env');
        const envExamplePath = path.join(__dirname, 'env.example');

        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        } else if (fs.existsSync(envExamplePath)) {
            envContent = fs.readFileSync(envExamplePath, 'utf8');
        }

        // Update ngrok-related variables
        envContent = envContent.replace(/NGROK_AUTH_TOKEN=.*/g, `NGROK_AUTH_TOKEN=${this.authToken}`);
        envContent = envContent.replace(/NGROK_REGION=.*/g, `NGROK_REGION=${this.region}`);
        if (this.subdomain) {
            envContent = envContent.replace(/NGROK_SUBDOMAIN=.*/g, `NGROK_SUBDOMAIN=${this.subdomain}`);
        }

        // Add NGROK_URL if not present
        if (!envContent.includes('NGROK_URL=')) {
            envContent += `\n# Current ngrok URL (auto-updated)\nNGROK_URL=${this.publicUrl}\n`;
        } else {
            envContent = envContent.replace(/NGROK_URL=.*/g, `NGROK_URL=${this.publicUrl}`);
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ Environment file updated');
    }

    async createStartupScript() {
        console.log('\n📜 Creating startup script...');

        const packageJsonPath = path.join(__dirname, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            if (!packageJson.scripts['start:ngrok']) {
                packageJson.scripts['start:ngrok'] = 'node start-with-ngrok.js';
                packageJson.scripts['ngrok:setup'] = 'node setup-ngrok.js';
                packageJson.scripts['ngrok:status'] = 'curl -s http://127.0.0.1:4040/api/tunnels | jq .';
                
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                console.log('✅ Package.json scripts updated');
            }
        }
    }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const setup = new NgrokSetup();
    setup.run().catch(console.error);
}

export default NgrokSetup;
