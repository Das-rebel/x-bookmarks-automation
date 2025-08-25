#!/usr/bin/env python3
"""
Standalone script to generate a haiku about space using the OpenRouter API.
Requires environment variable: OPENROUTER_API_KEY or OPENAI_API_KEY
Install dependencies:
    pip install openai python-dotenv
Usage:
    python3 haiku_openrouter.py
"""

import os
import sys
from dotenv import load_dotenv
# Load environment variables from .env and .env.backup
load_dotenv()
load_dotenv(".env.backup", override=True)
from openai import OpenAI

def main():
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENROUTER_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    try:
        completion = client.chat.completions.create(
            model="moonshotai/kimi-k2:free",
            messages=[{"role": "user", "content": "Write a haiku about space."}]
        )
        haiku = completion.choices[0].message.content
        print(haiku)
    except Exception as e:
        print(f"Error during request: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
