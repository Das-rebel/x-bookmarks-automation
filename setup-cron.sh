#!/bin/bash

# Setup cron job for bookmark processing
# This script will run every 24 hours to extract new bookmarks

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"
LOG_FILE="$SCRIPT_DIR/cron-logs.log"

# Create log directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Create the cron job command - Run at 6 AM daily
CRON_CMD="0 6 * * * cd $SCRIPT_DIR && $NODE_PATH src/scrapers/web-login-scraper.js >> $LOG_FILE 2>&1"

echo "Setting up cron job for bookmark processing..."
echo "Command: $CRON_CMD"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "cron-bookmark-processor.js"; then
    echo "⚠️  Cron job already exists. Removing old job..."
    crontab -l 2>/dev/null | grep -v "cron-bookmark-processor.js" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "✅ Cron job added successfully!"
echo "📅 The job will run daily at 9:00 AM"
echo "📝 Logs will be saved to: $LOG_FILE"
echo ""
echo "To view current cron jobs, run: crontab -l"
echo "To remove this cron job, run: crontab -l | grep -v 'cron-bookmark-processor.js' | crontab -"
echo ""
echo "You can also manually run the processor with:"
echo "node $SCRIPT_DIR/cron-bookmark-processor.js"