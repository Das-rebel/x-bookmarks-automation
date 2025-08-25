#!/usr/bin/env node

import dotenv from 'dotenv';
import { productionConfig } from '../config/production.js';
import CronManager from '../scripts/cron-manager.js';
import HealthMonitor from './utils/health-monitor.js';

// Load environment variables
dotenv.config();

class ProductionServer {
    constructor() {
        this.cronManager = new CronManager();
        this.healthMonitor = new HealthMonitor();
        this.isRunning = false;
    }
    
    async start() {
        try {
            console.log('🚀 Starting X-Bookmarks Automation Production Server...');
            console.log('==================================================');
            
            // Start health monitoring
            console.log('💓 Starting health monitoring...');
            await this.healthMonitor.checkSystemHealth();
            
            // Start cron manager
            console.log('⏰ Starting cron manager...');
            await this.cronManager.start();
            
            // Start API server
            console.log('🌐 Starting API server...');
            const { default: app } = await import('./api/server.js');
            
            // Add cron status endpoint
            app.get('/cron/status', (req, res) => {
                res.json({
                    success: true,
                    cron: this.cronManager.getStatus(),
                    health: this.healthMonitor.getMetrics()
                });
            });
            
            // Add health endpoint
            app.get('/health', async (req, res) => {
                const health = await this.healthMonitor.checkSystemHealth();
                res.json({
                    success: true,
                    status: health.overall,
                    timestamp: health.timestamp,
                    uptime: health.uptime,
                    memory: health.memory,
                    issues: health.issues
                });
            });
            
            // Add metrics endpoint
            app.get('/metrics', (req, res) => {
                res.json({
                    success: true,
                    metrics: this.healthMonitor.getMetrics(),
                    alerts: this.healthMonitor.getAlerts()
                });
            });
            
            // Start server
            const PORT = productionConfig.api.port;
            app.listen(PORT, () => {
                console.log(`✅ API Server running on port ${PORT}`);
                console.log(`📊 Health Check: http://localhost:${PORT}/health`);
                console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
                console.log(`⏰ Cron Status: http://localhost:${PORT}/cron/status`);
            });
            
            this.isRunning = true;
            
            // Schedule periodic health checks
            setInterval(async () => {
                await this.healthMonitor.checkSystemHealth();
            }, productionConfig.monitoring.healthCheckInterval);
            
            console.log('🎉 Production server started successfully!');
            console.log('==================================================');
            
        } catch (error) {
            console.error('❌ Failed to start production server:', error.message);
            process.exit(1);
        }
    }
    
    async stop() {
        console.log('🛑 Stopping production server...');
        
        if (this.cronManager) {
            this.cronManager.stop();
        }
        
        this.isRunning = false;
        console.log('✅ Production server stopped');
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            cron: this.cronManager?.getStatus(),
            health: this.healthMonitor?.getMetrics()
        };
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.productionServer) {
        await global.productionServer.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.productionServer) {
        await global.productionServer.stop();
    }
    process.exit(0);
});

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new ProductionServer();
    global.productionServer = server;
    server.start();
}

export default ProductionServer;
