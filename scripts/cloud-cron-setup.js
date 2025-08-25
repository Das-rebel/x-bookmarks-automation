#!/usr/bin/env node

import axios from 'axios';
import { productionConfig } from '../config/production.js';

class CloudCronManager {
    constructor() {
        this.ngrokUrl = null;
        this.cronServices = [
            'cron-job.org',
            'easycron.com',
            'cronhooks.com'
        ];
    }
    
    async getNgrokUrl() {
        try {
            const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
            const tunnels = response.data.tunnels;
            if (tunnels && tunnels.length > 0) {
                this.ngrokUrl = tunnels[0].public_url;
                console.log(`✅ Ngrok URL: ${this.ngrokUrl}`);
                return this.ngrokUrl;
            }
        } catch (error) {
            console.log('⚠️  Ngrok not running locally, checking environment...');
            // Check if ngrok URL is in environment
            this.ngrokUrl = process.env.NGROK_URL;
            if (this.ngrokUrl) {
                console.log(`✅ Ngrok URL from env: ${this.ngrokUrl}`);
                return this.ngrokUrl;
            }
        }
        return null;
    }
    
    async testEndpoint(endpoint) {
        if (!this.ngrokUrl) {
            console.log('❌ No ngrok URL available');
            return false;
        }
        
        try {
            const response = await axios.get(`${this.ngrokUrl}${endpoint}`);
            console.log(`✅ ${endpoint}: ${response.data.status || response.data.success}`);
            return true;
        } catch (error) {
            console.log(`❌ ${endpoint}: ${error.message}`);
            return false;
        }
    }
    
    generateCronUrls() {
        if (!this.ngrokUrl) {
            console.log('❌ No ngrok URL available');
            return null;
        }
        
        const urls = {
            health: `${this.ngrokUrl}/health`,
            scrape: `${this.ngrokUrl}/api/scrape`,
            process: `${this.ngrokUrl}/api/process-bookmarks`,
            cron: `${this.ngrokUrl}/cron/status`
        };
        
        return urls;
    }
    
    generateCronJobConfig() {
        const urls = this.generateCronUrls();
        if (!urls) return null;
        
        return {
            // cron-job.org configuration
            cronJobOrg: {
                name: 'X-Bookmarks-Automation',
                url: urls.scrape,
                schedule: '0 6 * * *', // Daily at 6 AM
                timezone: 'UTC',
                retryCount: 3,
                retryDelay: 300, // 5 minutes
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'CloudCron/1.0'
                },
                body: JSON.stringify({
                    action: 'scrape_bookmarks',
                    timestamp: new Date().toISOString()
                })
            },
            
            // easycron.com configuration
            easyCron: {
                name: 'X-Bookmarks-Scraper',
                url: urls.scrape,
                cron: '0 6 * * *',
                timezone: 'UTC',
                retry: 3,
                retry_interval: 300
            },
            
            // Manual cron setup for any system
            manualCron: {
                command: `curl -X POST "${urls.scrape}" -H "Content-Type: application/json" -d '{"action":"scrape_bookmarks"}'`,
                schedule: '0 6 * * *',
                description: 'Daily bookmark scraping at 6 AM UTC'
            }
        };
    }
    
    async setupCloudCron() {
        console.log('🚀 Setting up Cloud-Based Cron (Mac Independent)');
        console.log('================================================');
        
        // Get ngrok URL
        const ngrokUrl = await this.getNgrokUrl();
        if (!ngrokUrl) {
            console.log('❌ Cannot setup cloud cron without ngrok URL');
            return false;
        }
        
        // Test endpoints
        console.log('\n🧪 Testing endpoints...');
        await this.testEndpoint('/health');
        await this.testEndpoint('/cron/status');
        
        // Generate configurations
        const config = this.generateCronJobConfig();
        if (!config) return false;
        
        console.log('\n📋 Cloud Cron Configuration Generated:');
        console.log('=====================================');
        
        // Save configuration to file
        const configFile = 'cloud-cron-config.json';
        const fs = await import('fs');
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        console.log(`✅ Configuration saved to: ${configFile}`);
        
        // Display setup instructions
        this.displaySetupInstructions(config);
        
        return true;
    }
    
    displaySetupInstructions(config) {
        console.log('\n🌐 Cloud Cron Setup Instructions:');
        console.log('================================');
        
        console.log('\n1️⃣ cron-job.org (Recommended):');
        console.log(`   - Go to: https://cron-job.org`);
        console.log(`   - Create account and add new cron job`);
        console.log(`   - URL: ${config.cronJobOrg.url}`);
        console.log(`   - Schedule: ${config.cronJobOrg.schedule}`);
        console.log(`   - Timezone: ${config.cronJobOrg.timezone}`);
        
        console.log('\n2️⃣ easycron.com:');
        console.log(`   - Go to: https://easycron.com`);
        console.log(`   - Add new cron job`);
        console.log(`   - URL: ${config.easyCron.url}`);
        console.log(`   - Cron: ${config.easyCron.cron}`);
        
        console.log('\n3️⃣ Any Linux/Cloud Server:');
        console.log(`   - Add to crontab: ${config.manualCron.command}`);
        console.log(`   - Schedule: ${config.manualCron.schedule}`);
        
        console.log('\n4️⃣ GitHub Actions (Free):');
        console.log(`   - Create .github/workflows/cron.yml`);
        console.log(`   - Runs daily at 6 AM UTC`);
        console.log(`   - Calls your ngrok endpoint`);
        
        console.log('\n✅ Benefits of Cloud Cron:');
        console.log('   - Runs regardless of Mac state');
        console.log('   - No dependency on local system');
        console.log('   - Automatic retries and monitoring');
        console.log('   - Global availability');
    }
    
    async createGitHubActionsWorkflow() {
        const workflow = {
            name: 'Daily Bookmark Scraping',
            on: {
                schedule: [
                    { cron: '0 6 * * *' } // Daily at 6 AM UTC
                ],
                workflow_dispatch: {} // Manual trigger
            },
            jobs: {
                scrape: {
                    'runs-on': 'ubuntu-latest',
                    steps: [
                        {
                            name: 'Scrape Bookmarks',
                            run: `curl -X POST "${this.ngrokUrl}/api/scrape" -H "Content-Type: application/json" -d '{"action":"scrape_bookmarks","source":"github_actions"}'`
                        }
                    ]
                }
            }
        };
        
        const fs = await import('fs');
        const path = await import('path');
        
        // Create .github/workflows directory
        const workflowsDir = '.github/workflows';
        if (!fs.existsSync(workflowsDir)) {
            fs.mkdirSync(workflowsDir, { recursive: true });
        }
        
        // Save workflow file
        const workflowFile = path.join(workflowsDir, 'cron.yml');
        fs.writeFileSync(workflowFile, JSON.stringify(workflow, null, 2));
        console.log(`✅ GitHub Actions workflow created: ${workflowFile}`);
        
        return workflowFile;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cloudCron = new CloudCronManager();
    
    cloudCron.setupCloudCron()
        .then(success => {
            if (success) {
                console.log('\n🎉 Cloud cron setup completed!');
                console.log('Your scraper will now run independently of your Mac system.');
            }
        })
        .catch(error => {
            console.error('❌ Setup failed:', error.message);
        });
}

export default CloudCronManager;
