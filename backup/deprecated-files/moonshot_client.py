#!/usr/bin/env python3
"""
Client for interacting with Moonshot AI's Kimi model.
Requires environment variable: MOONSHOT_API_KEY
Install dependencies:
    pip install openai python-dotenv
Usage:
    python3 moonshot_client.py "Your prompt here"
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env and .env.backup
load_dotenv()
load_dotenv(".env.backup", override=True)
from openai import OpenAI

def main():
    if len(sys.argv) < 2:
        print("Please provide a prompt as an argument.", file=sys.stderr)
        print(f"Usage: {sys.argv[0]} \"Your prompt here\"", file=sys.stderr)
        sys.exit(1)

    api_key = os.getenv("MOONSHOT_API_KEY")
    if not api_key:
        print("Error: MOONSHOT_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # Using requests directly to ensure proper Bearer Token authentication
    import requests
    import json

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }

    try:
        user_prompt = " ".join(sys.argv[1:])
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        response = requests.post(
            "https://api.moonshot.cn/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Error {response.status_code}: {response.text}")
            
        completion = response.json()
        response_text = completion['choices'][0]['message']['content']
        print(response_text)
    except Exception as e:
        print(f"Error during request: {e}", file=sys.stderr)
        print("Please check that your API key is valid and you have access to the Moonshot AI API.")
        sys.exit(1)

if __name__ == "__main__":
    main()
