# 🚀 Enhanced Ngrok Flow for Bookmark Automation

## Overview

This guide explains the enhanced ngrok flow that integrates with your bookmark automation system, providing a public HTTPS endpoint for ChatGPT Actions and external API access.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ChatGPT      │    │     ngrok       │    │   Local Server  │
│   Actions      │◄──►│   Tunnel        │◄──►│   (Port 3000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Bookmark DB    │
                       │  (SQLite)       │
                       └─────────────────┘
```

## 🚀 Quick Start

### 1. Setup ngrok
```bash
# Run the interactive setup
npm run ngrok:setup

# Or manually install ngrok
brew install ngrok/ngrok/ngrok  # macOS
# Get auth token from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_TOKEN
```

### 2. Start the server with ngrok
```bash
npm run start:ngrok
```

### 3. Check status
```bash
npm run ngrok:status
```

## 📋 Available Endpoints

### Health Check
```bash
GET /health
```

### Server Status
```bash
GET /status
# Returns ngrok status, database info, and server details
```

### Process Bookmarks
```bash
POST /process-bookmarks
Content-Type: application/json
X-API-Key: your-api-key

{
  "source_file": "bookmarks-data-1756122030081.json",
  "output_dir": "processed-bookmarks"
}
```

### Processing History
```bash
GET /processing-history
# Returns list of all processing runs
```

### Latest Summary
```bash
GET /processing-summary/latest
# Returns the most recent processing results
```

### Database Stats
```bash
GET /database/stats
# Returns SQLite database information
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Server Configuration
PORT=3000
API_KEY=your-secret-api-key

# Ngrok Configuration
NGROK_AUTH_TOKEN=your-ngrok-auth-token
NGROK_REGION=us
NGROK_SUBDOMAIN=your-custom-subdomain

# Processing Configuration
ENABLE_AI_ANALYSIS=true
ENABLE_THREAD_DETECTION=true
MAX_BOOKMARKS=500
```

### Ngrok Configuration

The system automatically creates `~/.ngrok2/ngrok.yml`:

```yaml
version: '2'
authtoken: your-token
region: us
tunnels:
  bookmark-automation:
    proto: http
    addr: 3000
    subdomain: your-subdomain  # optional
```

## 🔄 Workflow

### 1. **Initialization**
- `start-with-ngrok.js` starts the ngrok manager
- Validates ngrok installation and configuration
- Starts monitoring for ngrok URL changes

### 2. **Tunnel Management**
- Automatically starts ngrok tunnel on port 3000
- Monitors tunnel status every minute
- Updates ChatGPT agent configuration automatically

### 3. **Server Integration**
- Express server runs on localhost:3000
- ngrok provides public HTTPS endpoint
- All API endpoints accessible via ngrok URL

### 4. **Bookmark Processing**
- Process existing bookmarks via API
- AI analysis and thread detection
- Results saved to local SQLite database
- Processing history maintained

## 🧪 Testing

### Test ngrok tunnel
```bash
# Check if tunnel is active
curl http://127.0.0.1:4040/api/tunnels

# Test health endpoint through ngrok
curl https://your-ngrok-url.ngrok.io/health
```

### Test bookmark processing
```bash
# Process bookmarks via API
curl -X POST https://your-ngrok-url.ngrok.io/process-bookmarks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "source_file": "bookmarks-data-1756122030081.json"
  }'
```

## 🔍 Monitoring

### ngrok Web Interface
- Access `http://127.0.0.1:4040` for ngrok dashboard
- View tunnel status, requests, and logs
- Monitor traffic and performance

### Server Logs
```bash
# View server logs
npm run start:ngrok

# Check ngrok status
npm run ngrok:status
```

### Health Monitoring
```bash
# Check server health
curl http://localhost:3000/health

# Check full status
curl http://localhost:3000/status
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Ngrok not starting
```bash
# Check if ngrok is installed
ngrok version

# Verify auth token
ngrok config check

# Check for port conflicts
lsof -i :3000
```

#### 2. Tunnel not accessible
```bash
# Check tunnel status
curl http://127.0.0.1:4040/api/tunnels

# Verify firewall settings
# Check ngrok region configuration
```

#### 3. API key authentication
```bash
# Set API key in .env
echo "API_KEY=your-secret-key" >> .env

# Or pass via header
curl -H "X-API-Key: your-key" https://your-url/health
```

### Debug Mode
```bash
# Enable debug logging
export ENABLE_DEBUG_LOGGING=true
npm run start:ngrok
```

## 🔐 Security

### API Key Authentication
- All endpoints require `X-API-Key` header
- Set `API_KEY` in environment variables
- Disable with `ENABLE_API_KEY_AUTH=false`

### Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables
- Disable with `ENABLE_RATE_LIMITING=false`

### CORS
- Configurable origins via `ALLOWED_ORIGINS`
- Default: allow all origins
- Restrict for production use

## 📊 Performance

### Optimization Tips
1. **Use custom subdomain** for consistent URLs
2. **Choose nearest region** for lower latency
3. **Monitor tunnel status** for automatic restarts
4. **Enable compression** for large responses

### Monitoring
```bash
# Check tunnel performance
curl http://127.0.0.1:4040/api/tunnels

# Monitor server metrics
curl http://localhost:3000/status
```

## 🔄 Integration with ChatGPT Actions

### 1. **Update ChatGPT Schema**
- Use the ngrok URL in your `chatgpt-agent-openapi.json`
- The system automatically updates the URL when ngrok starts

### 2. **Test Actions**
```bash
# Test search endpoint
curl -X POST https://your-ngrok-url.ngrok.io/api/search-bookmarks \
  -H "Content-Type: application/json" \
  -d '{"search_query": "AI"}'
```

### 3. **Monitor Usage**
- Check ngrok dashboard for request logs
- Monitor server logs for action calls
- Track processing performance

## 🚀 Production Considerations

### 1. **Replace ngrok with production hosting**
- Use Heroku, Railway, or similar services
- Update ChatGPT schema with production URL
- Implement proper SSL certificates

### 2. **Database scaling**
- Consider PostgreSQL for larger datasets
- Implement connection pooling
- Add backup and recovery procedures

### 3. **Security hardening**
- Implement proper authentication
- Add request validation
- Monitor for abuse and rate limiting

## 📚 Additional Resources

- [Ngrok Documentation](https://ngrok.com/docs)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practices-security.html)
- [ChatGPT Actions Guide](https://platform.openai.com/docs/actions)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify ngrok configuration
3. Check server logs for errors
4. Ensure all dependencies are installed
5. Verify environment variables are set correctly

---

**Happy Bookmarking! 🚀📚**
