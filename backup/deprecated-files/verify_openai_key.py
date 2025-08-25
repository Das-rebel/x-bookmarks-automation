#!/usr/bin/env python3
"""Verify OpenAI API key directly from environment"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the API key from environment
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("❌ OPENAI_API_KEY not found in environment")
    sys.exit(1)

print(f"🔑 Found OPENAI_API_KEY: {api_key[:10]}...{api_key[-5:]}")
print(f"📝 Key length: {len(api_key)} characters")

# Check if the key starts with 'sk-'
if not api_key.startswith('sk-'):
    print("❌ Error: API key should start with 'sk-'")
    sys.exit(1)

print("✅ Key format appears to be valid")

# Try to make a simple API call
import openai

print("\n🔍 Testing API key with OpenAI...")
try:
    client = openai.OpenAI(api_key=api_key)
    models = client.models.list()
    print(f"✅ Successfully connected to OpenAI API")
    print(f"📊 Available models: {len(models.data)} models")
    
    # Print first 5 models
    for model in models.data[:5]:
        print(f"   - {model.id} (created: {model.created})")
    
    if len(models.data) > 5:
        print(f"   - ... and {len(models.data) - 5} more")
    
except Exception as e:
    print(f"❌ Error connecting to OpenAI API: {str(e)}")
    print("\nTroubleshooting steps:")
    print("1. Verify the API key is correct and has not expired")
    print("2. Check your internet connection")
    print("3. Make sure your account has access to the API")
    print("4. Try visiting https://platform.openai.com/account/api-keys to verify your key")
