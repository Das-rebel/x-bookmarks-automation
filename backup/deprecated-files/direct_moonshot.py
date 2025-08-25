#!/usr/bin/env python3
"""
Direct API access to Moonshot AI's Kimi model
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(".env.backup", override=True)

def main():
    if len(sys.argv) < 2:
        print("Please provide a prompt as an argument.", file=sys.stderr)
        print(f"Usage: {sys.argv[0]} \"Your prompt here\"", file=sys.stderr)
        sys.exit(1)

    api_key = os.getenv("MOONSHOT_API_KEY")
    if not api_key:
        print("Error: MOONSHOT_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please add it to your .env file: MOONSHOT_API_KEY=your_api_key_here")
        sys.exit(1)

    # Moonshot AI API endpoint
    url = "https://api.moonshot.cn/v1/chat/completions"
    
    # Headers with authentication
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        user_prompt = " ".join(sys.argv[1:])
        
        # Request payload
        payload = {
            "model": "moonshot-v1-8k",  # Moonshot's model identifier
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }

        # Make the API request
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=30  # 30 second timeout
        )
        
        # Check for errors
        if response.status_code != 200:
            print(f"Error {response.status_code}: {response.text}")
            print("\nTroubleshooting steps:")
            print("1. Verify your API key is correct")
            print("2. Check if your account has access to the Kimi model")
            print("3. Ensure your account has sufficient credits")
            print("4. Check Moonshot AI's status page for any outages")
            print("5. Try using a VPN if you're in a restricted region")
            sys.exit(1)
            
        # Parse and print the response
        completion = response.json()
        print(completion['choices'][0]['message']['content'])
        
    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
