#!/bin/bash

# Production Deployment Script for X-Bookmarks Automation

set -e

echo "🚀 Starting Production Deployment..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Installing..."
    curl https://cli-assets.heroku.com/install.sh | sh
fi

# Check if logged into Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please log into Heroku..."
    heroku login
fi

# Create Heroku app if it doesn't exist
APP_NAME="x-bookmarks-automation-$(date +%s)"
if heroku apps:info $APP_NAME &> /dev/null; then
    echo "✅ Using existing app: $APP_NAME"
else
    echo "🆕 Creating new Heroku app: $APP_NAME"
    heroku create $APP_NAME
fi

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL="$SUPABASE_URL"
heroku config:set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
heroku config:set X_USERNAME="$X_USERNAME"
heroku config:set X_PASSWORD="$X_PASSWORD"
heroku config:set OPENAI_API_KEY="$OPENAI_API_KEY"
heroku config:set API_KEY="$API_KEY"

# Deploy to Heroku
echo "📦 Deploying to Heroku..."
git add .
git commit -m "Production deployment $(date)"
git push heroku main

# Run database migrations
echo "🗄️  Running database migrations..."
heroku run npm run migrate:schema

# Test deployment
echo "🧪 Testing deployment..."
curl -f "https://$APP_NAME.herokuapp.com/health" || {
    echo "❌ Health check failed"
    exit 1
}

echo "✅ Production deployment completed successfully!"
echo "🌐 App URL: https://$APP_NAME.herokuapp.com"
echo "📊 Monitor: https://dashboard.heroku.com/apps/$APP_NAME"
