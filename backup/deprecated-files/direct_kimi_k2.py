#!/usr/bin/env python3
"""
CLI client for the moonshot-v1-8k model via direct Moonshot AI API.
Requires environment variable: MOONSHOT_API_KEY
Install dependencies:
    pip install requests python-dotenv

Usage:
    python3 direct_kimi_k2.py "Your prompt here"
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
        sys.exit(1)

    url = "https://api.moonshot.cn/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    prompt = " ".join(sys.argv[1:])
    payload = {
        "model": "moonshot-v1-8k",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        if response.status_code != 200:
            print(f"Error {response.status_code}: {response.text}", file=sys.stderr)
            sys.exit(1)
        data = response.json()
        print(data["choices"][0]["message"]["content"])
    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
