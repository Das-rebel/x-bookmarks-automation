#!/usr/bin/env python3
"""
Standalone script to generate text using the OpenRouter API.
Requires environment variable: OPENROUTER_API_KEY or OPENAI_API_KEY
Install dependencies:
    pip install openai python-dotenv
Usage:
    python3 run_model.py "Your prompt here"
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

    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    try:
        user_prompt = " ".join(sys.argv[1:])
        completion = client.chat.completions.create(
            model="openai/gpt-3.5-turbo",  # Using GPT-3.5-turbo as a reliable alternative
            messages=[{"role": "user", "content": user_prompt}]
        )
        response = completion.choices[0].message.content
        print(response)
    except Exception as e:
        print(f"Error during request: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
