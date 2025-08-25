import { productionConfig } from '../../config/production.js';

class HealthMonitor {
    constructor() {
        this.metrics = {
            startTime: Date.now(),
            requests: 0,
            errors: 0,
            lastHealthCheck: null,
            systemStatus: 'unknown'
        };
        
        this.alerts = [];
        this.healthChecks = [];
    }
    
    async checkSystemHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.metrics.startTime,
            memory: this.getMemoryUsage(),
            cpu: await this.getCpuUsage(),
            disk: this.getDiskUsage(),
            database: await this.checkDatabaseHealth(),
            scraper: await this.checkScraperHealth(),
            overall: 'unknown'
        };
        
        // Determine overall health
        const issues = [];
        if (health.memory.usage > productionConfig.monitoring.alertThresholds.memoryUsage) {
            issues.push('High memory usage');
        }
        if (health.database.status !== 'healthy') {
            issues.push('Database issues');
        }
        if (health.scraper.status !== 'healthy') {
            issues.push('Scraper issues');
        }
        
        health.overall = issues.length === 0 ? 'healthy' : 'degraded';
        health.issues = issues;
        
        this.metrics.lastHealthCheck = health;
        this.metrics.systemStatus = health.overall;
        
        // Store health check history
        this.healthChecks.push(health);
        if (this.healthChecks.length > 100) {
            this.healthChecks.shift(); // Keep only last 100 checks
        }
        
        return health;
    }
    
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: usage.rss,
            heapTotal: usage.heapTotal,
            heapUsed: usage.heapUsed,
            external: usage.external,
            usage: usage.heapUsed / usage.heapTotal
        };
    }
    
    async getCpuUsage() {
        // Simple CPU usage approximation
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        
        return {
            user: endUsage.user,
            system: endUsage.system,
            total: endUsage.user + endUsage.system
        };
    }
    
    getDiskUsage() {
        // This would need a native module for actual disk usage
        // For now, return basic info
        return {
            available: 'unknown',
            total: 'unknown',
            usage: 'unknown'
        };
    }
    
    async checkDatabaseHealth() {
        try {
            // Import and test database connection
            const { default: SyncManager } = await import('../../sync-to-supabase.js');
            const sync = new SyncManager();
            await sync.testSupabaseConnection();
            
            return {
                status: 'healthy',
                message: 'Database connection successful',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async checkScraperHealth() {
        try {
            // Check if scraper files exist and are accessible
            const fs = await import('fs');
            const scraperPath = '../../web-login-scraper.js';
            
            if (fs.existsSync(scraperPath)) {
                return {
                    status: 'healthy',
                    message: 'Scraper files accessible',
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    status: 'unhealthy',
                    message: 'Scraper files not found',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    recordRequest(success = true) {
        this.metrics.requests++;
        if (!success) {
            this.metrics.errors++;
        }
        
        // Check error rate
        const errorRate = this.metrics.errors / this.metrics.requests;
        if (errorRate > productionConfig.monitoring.alertThresholds.errorRate) {
            this.createAlert('HIGH_ERROR_RATE', `Error rate: ${(errorRate * 100).toFixed(1)}%`);
        }
    }
    
    createAlert(type, message, severity = 'warning') {
        const alert = {
            id: Date.now().toString(),
            type,
            message,
            severity,
            timestamp: new Date().toISOString()
        };
        
        this.alerts.push(alert);
        
        // Keep only last 50 alerts
        if (this.alerts.length > 50) {
            this.alerts.shift();
        }
        
        // Log alert
        console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${type} - ${message}`);
        
        return alert;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            errorRate: this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0,
            alerts: this.alerts.length,
            healthChecks: this.healthChecks.length
        };
    }
    
    getAlerts(severity = null) {
        if (severity) {
            return this.alerts.filter(alert => alert.severity === severity);
        }
        return this.alerts;
    }
    
    getHealthHistory(limit = 10) {
        return this.healthChecks.slice(-limit);
    }
    
    clearAlerts() {
        this.alerts = [];
        console.log('🧹 Alerts cleared');
    }
    
    generateReport() {
        const health = this.metrics.lastHealthCheck;
        const metrics = this.getMetrics();
        
        return {
            timestamp: new Date().toISOString(),
            system: {
                status: metrics.systemStatus,
                uptime: metrics.uptime,
                requests: metrics.requests,
                errors: metrics.errors,
                errorRate: metrics.errorRate
            },
            health: health || 'No health check data',
            alerts: {
                total: metrics.alerts,
                recent: this.alerts.slice(-5)
            },
            recommendations: this.generateRecommendations()
        };
    }
    
    generateRecommendations() {
        const recommendations = [];
        const metrics = this.getMetrics();
        
        if (metrics.errorRate > 0.1) {
            recommendations.push('High error rate detected. Review system logs and check for issues.');
        }
        
        if (this.alerts.length > 10) {
            recommendations.push('Many alerts generated. Consider reviewing system configuration.');
        }
        
        if (!this.metrics.lastHealthCheck) {
            recommendations.push('No recent health checks. Verify monitoring is working.');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('System appears healthy. Continue monitoring.');
        }
        
        return recommendations;
    }
}

export default HealthMonitor;
