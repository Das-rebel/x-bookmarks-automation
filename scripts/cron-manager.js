#!/usr/bin/env node

import cron from 'node-cron';
import { productionConfig } from '../config/production.js';

class CronManager {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
        this.healthStatus = {
            lastCheck: null,
            status: 'unknown',
            issues: []
        };
    }
    
    async start() {
        if (this.isRunning) {
            console.log('⚠️  Cron manager is already running');
            return;
        }
        
        console.log('🚀 Starting Cron Manager...');
        this.isRunning = true;
        
        // Schedule all jobs
        this.scheduleScrapingJob();
        this.scheduleProcessingJob();
        this.scheduleSyncJob();
        this.scheduleHealthCheck();
        
        console.log('✅ Cron Manager started successfully');
        console.log('📅 Scheduled Jobs:');
        console.log(`  - Bookmark Scraping: ${productionConfig.cron.scrapeBookmarks}`);
        console.log(`  - Bookmark Processing: ${productionConfig.cron.processBookmarks}`);
        console.log(`  - Database Sync: ${productionConfig.cron.syncToSupabase}`);
        console.log(`  - Health Check: ${productionConfig.cron.healthCheck}`);
    }
    
    scheduleScrapingJob() {
        const job = cron.schedule(productionConfig.cron.scrapeBookmarks, async () => {
            console.log('🔍 Starting scheduled bookmark scraping...');
            try {
                // Import and run the scraper
                const { WebLoginScraper } = await import('../src/scrapers/web-login-scraper.js');
                const scraper = new WebLoginScraper();
                const result = await scraper.run();
                console.log(`✅ Scraping completed: ${result.totalExtracted} bookmarks`);
                
                // Trigger processing after successful scraping
                this.triggerProcessing();
                
            } catch (error) {
                console.error('❌ Scheduled scraping failed:', error.message);
                this.recordFailure('scraping', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });
        
        this.jobs.set('scraping', job);
    }
    
    scheduleProcessingJob() {
        const job = cron.schedule(productionConfig.cron.processBookmarks, async () => {
            console.log('⚙️  Starting scheduled bookmark processing...');
            try {
                // Import and run the processor
                const { BookmarkProcessor } = await import('../process-bookmarks-locally.js');
                const processor = new BookmarkProcessor();
                const result = await processor.processAll();
                console.log(`✅ Processing completed: ${result.processed} bookmarks`);
                
            } catch (error) {
                console.error('❌ Scheduled processing failed:', error.message);
                this.recordFailure('processing', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });
        
        this.jobs.set('processing', job);
    }
    
    scheduleSyncJob() {
        const job = cron.schedule(productionConfig.cron.syncToSupabase, async () => {
            console.log('🔄 Starting scheduled database sync...');
            try {
                // Import and run the sync
                const { default: SyncManager } = await import('../sync-to-supabase.js');
                const sync = new SyncManager();
                const result = await sync.syncAll();
                console.log(`✅ Sync completed: ${result.synced} records`);
                
            } catch (error) {
                console.error('❌ Scheduled sync failed:', error.message);
                this.recordFailure('sync', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });
        
        this.jobs.set('sync', job);
    }
    
    scheduleHealthCheck() {
        const job = cron.schedule(productionConfig.cron.healthCheck, async () => {
            console.log('💓 Running health check...');
            try {
                const health = await this.checkHealth();
                
                if (health.status === 'healthy') {
                    console.log('✅ System health: GOOD');
                } else {
                    console.log('⚠️  System health: DEGRADED');
                    console.log('Issues:', health.issues);
                }
                
                this.healthStatus = health;
                
            } catch (error) {
                console.error('❌ Health check failed:', error.message);
                this.healthStatus = {
                    lastCheck: new Date().toISOString(),
                    status: 'error',
                    issues: [error.message]
                };
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });
        
        this.jobs.set('health', job);
    }
    
    async checkHealth() {
        const issues = [];
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
        
        if (memUsagePercent > productionConfig.monitoring.alertThresholds.memoryUsage) {
            issues.push(`High memory usage: ${(memUsagePercent * 100).toFixed(1)}%`);
        }
        
        // Check if jobs are running
        for (const [name, job] of this.jobs) {
            if (!job.running) {
                issues.push(`Job ${name} is not running`);
            }
        }
        
        return {
            lastCheck: new Date().toISOString(),
            status: issues.length === 0 ? 'healthy' : 'degraded',
            issues,
            memoryUsage: memUsagePercent,
            activeJobs: Array.from(this.jobs.keys()).filter(name => this.jobs.get(name).running)
        };
    }
    
    async triggerProcessing() {
        console.log('🔄 Triggering immediate bookmark processing...');
        try {
            // Import and run the processor
            const { BookmarkProcessor } = await import('../process-bookmarks-locally.js');
            const processor = new BookmarkProcessor();
            await processor.processAll();
        } catch (error) {
            console.error('❌ Immediate processing failed:', error.message);
        }
    }
    
    recordFailure(operation, error) {
        console.error(`❌ ${operation} operation failed:`, error.message);
        // Here you could add alerting logic (email, Slack, etc.)
    }
    
    stop() {
        console.log('🛑 Stopping Cron Manager...');
        
        for (const [name, job] of this.jobs) {
            job.stop();
            console.log(`✅ Stopped job: ${name}`);
        }
        
        this.jobs.clear();
        this.isRunning = false;
        console.log('✅ Cron Manager stopped');
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            health: this.healthStatus
        };
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new CronManager();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        manager.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        manager.stop();
        process.exit(0);
    });
    
    manager.start();
}

export default CronManager;
