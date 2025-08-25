#!/bin/bash

# Cloud Deployment Setup Script for X-Bookmarks Automation

echo "🚀 Setting up Cloud Deployment for X-Bookmarks Automation"
echo "========================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one first."
    exit 1
fi

echo ""
echo "📋 Required Environment Variables for Cloud Deployment:"
echo ""

# Function to prompt for environment variable
prompt_for_var() {
    local var_name=$1
    local description=$2
    local current_value=$(grep "^${var_name}=" .env | cut -d'=' -f2-)
    
    echo "🔑 ${description}"
    if [ -n "$current_value" ] && [ "$current_value" != "your_${var_name,,}" ]; then
        echo "   Current value: ${current_value}"
        read -p "   Press Enter to keep current value, or type new value: " new_value
        if [ -n "$new_value" ]; then
            # Update .env file
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^${var_name}=.*|${var_name}=${new_value}|" .env
            else
                # Linux
                sed -i "s|^${var_name}=.*|${var_name}=${new_value}|" .env
            fi
            echo "   ✅ Updated ${var_name}"
        else
            echo "   ✅ Kept current value"
        fi
    else
        read -p "   Enter value for ${var_name}: " new_value
        if [ -n "$new_value" ]; then
            # Add to .env file
            echo "${var_name}=${new_value}" >> .env
            echo "   ✅ Added ${var_name}"
        else
            echo "   ⚠️  Skipped ${var_name}"
        fi
    fi
    echo ""
}

# Prompt for each required variable
prompt_for_var "SUPABASE_URL" "Supabase project URL (e.g., https://your-project.supabase.co)"
prompt_for_var "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key (from your project settings)"
prompt_for_var "X_USERNAME" "Your X.com (Twitter) username"
prompt_for_var "X_PASSWORD" "Your X.com (Twitter) password"

echo "🔍 Checking current configuration..."
echo ""

# Display current values
echo "📊 Current Environment Configuration:"
echo "====================================="
grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|X_USERNAME|X_PASSWORD|OPENAI_API_KEY)=" .env | while read line; do
    var_name=$(echo $line | cut -d'=' -f1)
    value=$(echo $line | cut -d'=' -f2-)
    if [ "$var_name" = "X_PASSWORD" ]; then
        echo "   ${var_name}: ${value:0:3}***${value: -3}"
    else
        echo "   ${var_name}: ${value}"
    fi
done

echo ""
echo "✅ Environment setup completed!"
echo ""
echo "🚀 Next steps:"
echo "   1. Verify your credentials are correct"
echo "   2. Run: npm run deploy:production"
echo "   3. Or deploy manually to your preferred cloud platform"
echo ""
echo "📚 For more deployment options, see: PRODUCTION_README.md"
