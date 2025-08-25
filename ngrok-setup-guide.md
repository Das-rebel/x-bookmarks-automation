# ngrok Setup Guide: Public URL for ChatGPT Actions

## 🎯 Problem & Solution

**Problem**: ChatGPT Actions rejects `http://localhost:3001` URLs due to origin restrictions.

**Solution**: Use ngrok to create a public HTTPS tunnel to your local AI agent server, making it accessible to ChatGPT Actions.

## 📋 Prerequisites

- AI Agent Server configured and working locally
- Node.js and npm installed
- Internet connection for ngrok tunnel

## 🚀 Quick Setup

### Step 1: Install ngrok

#### Option A: Download from Website
1. Go to [ngrok.com](https://ngrok.com/)
2. Sign up for a free account
3. Download ngrok for your operating system
4. Extract and move to your PATH

#### Option B: Install via Package Manager

**macOS (Homebrew):**
```bash
brew install ngrok/ngrok/ngrok
```

**Windows (Chocolatey):**
```bash
choco install ngrok
```

**Linux (Snap):**
```bash
snap install ngrok
```

### Step 2: Authenticate ngrok

1. **Get your auth token** from [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)

2. **Add auth token to ngrok:**
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### Step 3: Start AI Agent Server

```bash
# Start your AI agent server (leave this running)
npm run chatgpt:server
```

Verify it's running by visiting `http://localhost:3001/health`

### Step 4: Create ngrok Tunnel

**In a new terminal window:**
```bash
# Create HTTPS tunnel to localhost:3001
ngrok http 3001
```

You should see output like:
```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       20ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3001

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

### Step 5: Test Public URL

Copy the **HTTPS forwarding URL** (e.g., `https://abc123.ngrok.io`) and test:

```bash
# Test health endpoint through ngrok
curl https://8550ef790dbb.ngrok-free.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-XX...",
  "uptime": 12345,
  "stats": { ... }
}
```

## ⚙️ Update OpenAPI Schema

### Step 6: Get Your ngrok URL

From the ngrok output, copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 7: Update ChatGPT Configuration

1. **Open your ChatGPT Custom GPT** in edit mode
2. **Go to Actions** section
3. **In the OpenAPI schema**, find the `servers` section:

```json
"servers": [
  {
    "url": "https://8550ef790dbb.ngrok-free.app",
    "description": "AI Agent Server via ngrok tunnel"
  }
]
```

4. **Replace** `https://8550ef790dbb.ngrok-free.app` with your actual ngrok URL
5. **Save** the schema

### Step 8: Test ChatGPT Integration

In your ChatGPT Custom GPT, try:
```
Check the status of my AI bookmark agent
```

Expected: ChatGPT should successfully call your agent and return status information.

## 🔧 Advanced Configuration

### Custom Subdomain (ngrok Pro)

If you have ngrok Pro, you can use a custom subdomain:

```bash
ngrok http 3001 --subdomain=my-bookmark-agent
```

This gives you a consistent URL: `https://my-bookmark-agent.ngrok.io`

### Configuration File

Create `~/.ngrok2/ngrok.yml`:

```yaml
version: "2"
authtoken: YOUR_AUTH_TOKEN
tunnels:
  bookmark-agent:
    proto: http
    addr: 3001
    subdomain: my-bookmark-agent  # Pro feature
    host_header: localhost:3001
```

Then start with:
```bash
ngrok start bookmark-agent
```

### Environment Variables

Add to your `.env` file:
```bash
# ngrok configuration
NGROK_TUNNEL_URL=https://8550ef790dbb.ngrok-free.app
CHATGPT_SERVER_URL=${NGROK_TUNNEL_URL}
```

## 🛠️ Troubleshooting

### Common Issues

**1. "Tunnel not found" error**
- Check that AI agent server is running on port 3001
- Verify ngrok is pointing to the correct port
- Restart ngrok tunnel

**2. "502 Bad Gateway" through ngrok**
- Ensure AI agent server is running and healthy
- Check server logs for errors
- Verify localhost:3001 works directly

**3. "SSL certificate" errors**
- Use the HTTPS ngrok URL, not HTTP
- Ensure ChatGPT schema uses HTTPS URL
- Check ngrok status in web interface

**4. ChatGPT still rejects URL**
- Verify exact ngrok URL in schema (including https://)
- Check for typos in URL
- Ensure tunnel is active and online

### Debugging Tools

**ngrok Web Interface:**
Visit `http://127.0.0.1:4040` to see:
- Active tunnels
- Request logs
- Traffic inspection
- Error details

**Check Tunnel Status:**
```bash
curl -s http://127.0.0.1:4040/api/tunnels | jq .
```

### Performance Considerations

- **Latency**: ngrok adds ~20-100ms latency
- **Rate Limits**: Free ngrok has connection limits
- **Stability**: Tunnel may disconnect; monitor for reconnection

## 📈 Production Alternatives

While ngrok is perfect for development and testing, consider these for production:

### 1. Cloud Deployment
```bash
# Deploy to Heroku
git push heroku main

# Deploy to Vercel
vercel deploy

# Deploy to Railway
railway deploy
```

### 2. VPS with Domain
- Deploy to DigitalOcean/AWS/Linode
- Configure domain and SSL certificate
- Use nginx reverse proxy

### 3. Serverless Functions
- Convert endpoints to serverless functions
- Deploy to Vercel/Netlify Functions
- Use environment variables for configuration

## 🎯 Best Practices

### Development Workflow

1. **Start Agent Server**: `npm run chatgpt:server`
2. **Start ngrok**: `ngrok http 3001`
3. **Update ChatGPT Schema** with new ngrok URL
4. **Test Integration** through ChatGPT
5. **Keep Tunnels Running** during development sessions

### Tunnel Management

```bash
# Check running tunnels
ngrok tunnels list

# Stop all tunnels
ngrok tunnels stop-all

# Start specific tunnel
ngrok start bookmark-agent
```

### Security Notes

- **ngrok URLs are public** - don't commit them to code
- **Rotate tunnels regularly** for security
- **Use authentication** for production deployments
- **Monitor access logs** through ngrok web interface

## ✅ Success Checklist

- [ ] ngrok installed and authenticated
- [ ] AI agent server running on localhost:3001
- [ ] ngrok tunnel created with HTTPS URL
- [ ] ChatGPT schema updated with ngrok URL
- [ ] Health endpoint accessible through ngrok
- [ ] ChatGPT Custom GPT successfully calls agent
- [ ] All agent endpoints working through ChatGPT

## 🆘 Getting Help

If you encounter issues:

1. **Check ngrok status**: `http://127.0.0.1:4040`
2. **Verify agent server**: `curl localhost:3001/health`
3. **Test tunnel directly**: `curl https://8550ef790dbb.ngrok-free.app/health`
4. **Review ngrok logs** in web interface
5. **Restart both** agent server and ngrok tunnel

## 🔗 Useful Links

- [ngrok Documentation](https://ngrok.com/docs)
- [ngrok Dashboard](https://dashboard.ngrok.com/)
- [ChatGPT Actions Documentation](https://platform.openai.com/docs/actions)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)

---

**Next**: Once ngrok is working, follow the updated ChatGPT setup guide to complete your integration!
