#!/bin/bash
# Simple wrapper for OpenAI API that mimics basic cline functionality

# Configuration
OPENAI_API_KEY="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"
MODEL="gpt-3.5-turbo"
MAX_TOKENS=1000
TEMPERATURE=0.7

# Check if input is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 'Your prompt here'"
    exit 1
fi

# Get the prompt from command line arguments
PROMPT="$*"

# Call OpenAI API
curl -s https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "'$MODEL'",
    "messages": [
      {
        "role": "user",
        "content": "'$PROMPT'"
      }
    ],
    "max_tokens": '$MAX_TOKENS',
    "temperature": '$TEMPERATURE'
  }' | jq -r '.choices[0].message.content'
