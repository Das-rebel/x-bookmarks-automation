#!/usr/bin/env python3
"""
CLI client for the moonshotai/kimi-k2 model via direct Moonshot AI API using OpenAI Python SDK.
Requires environment variable: MOONSHOT_API_KEY
Install dependencies:
    pip install openai python-dotenv

Usage:
    python3 kimi_k2_client.py "Your prompt here"
"""

import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

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

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.moonshot.cn/v1"
    )

    user_prompt = " ".join(sys.argv[1:])
    try:
        response = client.chat.completions.create(
            model="moonshotai/kimi-k2",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
