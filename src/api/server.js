import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { BookmarkProcessor } from '../processors/process-bookmarks-locally.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
let server; // Declare server variable for graceful shutdown

// Trust first proxy (important if behind a reverse proxy like nginx, Heroku, etc.)
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : '*'
}));

// Rate limiting with improved configuration
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100, // Limit each IP to 100 requests per windowMs
    message: { 
        success: false,
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use the client's IP address as the key for rate limiting
        // This respects the X-Forwarded-For header if trust proxy is enabled
        return req.ip;
    }
});

// Apply rate limiter to all requests
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path}`);
    req.requestId = requestId;
    next();
});

// API Key Authentication Middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!process.env.API_KEY) {
        console.warn('⚠️  WARNING: No API_KEY set in environment variables. Allowing all requests.');
        return next();
    }
    
    if (!apiKey) {
        return res.status(401).json({ 
            success: false, 
            error: 'API key is required',
            requestId: req.requestId
        });
    }
    
    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({ 
            success: false, 
            error: 'Invalid API key',
            requestId: req.requestId
        });
    }
    
    next();
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        features: [
            'bookmark-scraping',
            'ai-processing',
            'thread-detection',
            'local-database',
            'ngrok-integration'
        ]
    });
});

// Get server status and ngrok info
app.get('/status', async (req, res) => {
    try {
        // Check ngrok status
        let ngrokStatus = 'unknown';
        let ngrokUrl = null;
        
        try {
            const response = await fetch('http://127.0.0.1:4040/api/tunnels');
            const data = await response.json();
            const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
            if (httpsTunnel) {
                ngrokStatus = 'active';
                ngrokUrl = httpsTunnel.public_url;
            } else {
                ngrokStatus = 'inactive';
            }
        } catch (error) {
            ngrokStatus = 'error';
        }

        // Check database status
        let dbStatus = 'unknown';
        try {
            if (fs.existsSync('bookmarks.db')) {
                const stats = fs.statSync('bookmarks.db');
                dbStatus = 'active';
            } else {
                dbStatus = 'not-found';
            }
        } catch (error) {
            dbStatus = 'error';
        }

        res.json({
            success: true,
            status: 'operational',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            ngrok: {
                status: ngrokStatus,
                url: ngrokUrl
            },
            database: {
                status: dbStatus,
                path: path.resolve('bookmarks.db')
            },
            environment: {
                node_version: process.version,
                platform: process.platform,
                port: PORT
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.requestId
        });
    }
});

// Process existing bookmarks endpoint
app.post('/process-bookmarks', authenticateApiKey, async (req, res) => {
    try {
        const { source_file, output_dir } = req.body;
        
        console.log(`[${req.requestId}] Starting bookmark processing...`);
        
        // Initialize bookmark processor
        const processor = new BookmarkProcessor();
        
        // Load bookmarks from the specified file
        let bookmarks;
        if (source_file) {
            const bookmarksData = fs.readFileSync(source_file, 'utf8');
            bookmarks = JSON.parse(bookmarksData);
        } else {
            bookmarks = await processor.loadBookmarks();
        }
        
        // Process bookmarks
        const processedBookmarks = await processor.processBookmarks(bookmarks);
        
        res.json({
            success: true,
            data: {
                processedBookmarks: processedBookmarks,
                totalCount: processedBookmarks.length,
                timestamp: new Date().toISOString()
            },
            requestId: req.requestId,
            message: `Successfully processed ${processedBookmarks.length} bookmarks`
        });
        
    } catch (error) {
        console.error(`[${req.requestId}] Processing error:`, error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while processing bookmarks',
            requestId: req.requestId,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get processing history
app.get('/processing-history', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname)
            .filter(file => file.startsWith('processing-final-summary-') && file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(__dirname, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    timestamp: stats.mtime.toISOString(),
                    size: stats.size
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            data: files,
            requestId: req.requestId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.requestId
        });
    }
});

// Get latest processing summary
app.get('/processing-summary/latest', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname)
            .filter(file => file.startsWith('processing-final-summary-') && file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(__dirname, file);
                const stats = fs.statSync(filePath);
                return { file, stats };
            })
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

        if (files.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No processing summaries found',
                requestId: req.requestId
            });
        }

        const latestFile = files[0].file;
        const summary = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

        res.json({
            success: true,
            data: summary,
            filename: latestFile,
            requestId: req.requestId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.requestId
        });
    }
});

// Database statistics endpoint
app.get('/database/stats', (req, res) => {
    try {
        if (!fs.existsSync('bookmarks.db')) {
            return res.status(404).json({
                success: false,
                error: 'Database not found',
                requestId: req.requestId
            });
        }

        const stats = fs.statSync('bookmarks.db');
        
        res.json({
            success: true,
            data: {
                exists: true,
                size_bytes: stats.size,
                size_mb: (stats.size / (1024 * 1024)).toFixed(2),
                last_modified: stats.mtime.toISOString(),
                created: stats.birthtime.toISOString()
            },
            requestId: req.requestId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.requestId
        });
    }
});

// Cron status endpoint
app.get('/cron/status', (req, res) => {
    res.json({
        success: true,
        message: 'Cron status endpoint - managed by production server',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.json({
        success: true,
        message: 'Metrics endpoint - managed by production server',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        metrics: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version,
            platform: process.platform
        }
    });
});

// Scrape endpoint for cloud cron
app.post('/api/scrape', async (req, res) => {
    try {
        console.log(`[${req.requestId}] Cloud cron triggered bookmark scraping...`);
        
        // Import and run the scraper
        const { default: WebLoginScraper } = await import('../scrapers/web-login-scraper.js');
        const scraper = new WebLoginScraper();
        
        // Run scraper in background
        scraper.run().then(result => {
            console.log(`[${req.requestId}] Cloud scraping completed: ${result.totalExtracted} bookmarks`);
        }).catch(error => {
            console.error(`[${req.requestId}] Cloud scraping failed:`, error.message);
        });
        
        // Return immediate response
        res.json({
            success: true,
            message: 'Bookmark scraping initiated',
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            source: req.body.source || 'cloud_cron'
        });
        
    } catch (error) {
        console.error(`[${req.requestId}] Scrape endpoint error:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.requestId
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requestId: req.requestId,
        available_endpoints: [
            'GET /health',
            'GET /status',
            'POST /process-bookmarks',
            'GET /processing-history',
            'GET /processing-summary/latest',
            'GET /database/stats'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(`[${req.requestId}] Unhandled error:`, err);
    
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            requestId: req.requestId,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit here, let the error handling middleware handle it
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('Process terminated');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Start server
server = app.listen(PORT, () => {
    console.log(`🚀 Bookmark Automation Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`🤖 Process bookmarks: http://localhost:${PORT}/process-bookmarks`);
    
    if (process.env.NGROK_URL) {
        console.log(`🌐 Ngrok URL: ${process.env.NGROK_URL}`);
    }
});

export default app;
