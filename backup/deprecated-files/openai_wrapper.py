#!/usr/bin/env python3
"""
OpenAI API wrapper with explicit configuration and error handling.

This wrapper ensures consistent behavior by explicitly setting the base URL
and providing robust error handling for OpenAI API calls.
"""

import os
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass
import openai
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

@dataclass
class AIResponse:
    """Container for AI response data"""
    success: bool
    content: Optional[str] = None
    error: Optional[str] = None
    model: Optional[str] = None
    usage: Optional[Dict[str, int]] = None
    response_time: Optional[float] = None

class OpenAIClient:
    """Wrapper for OpenAI API with explicit configuration"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-3.5-turbo"):
        """
        Initialize the OpenAI client.
        
        Args:
            api_key: OpenAI API key. If not provided, will use OPENAI_API_KEY from environment.
            model: Default model to use for completions.
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.client = None
        
        if not self.api_key:
            raise ValueError("OpenAI API key not provided and OPENAI_API_KEY not found in environment")
            
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize the OpenAI client with explicit configuration"""
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.openai.com/v1",  # Explicitly set the base URL
            timeout=30.0,  # 30 second timeout
            max_retries=3,  # Retry up to 3 times
            default_headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AIResponse:
        """
        Send a chat completion request to the OpenAI API.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content' keys.
            model: Model to use for completion. If not provided, uses the instance's default model.
            temperature: Controls randomness (0.0 to 2.0).
            max_tokens: Maximum number of tokens to generate.
            **kwargs: Additional arguments to pass to the API.
            
        Returns:
            AIResponse object containing the response or error information.
        """
        import time
        
        model = model or self.model
        start_time = time.time()
        
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            return AIResponse(
                success=True,
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                response_time=time.time() - start_time
            )
            
        except Exception as e:
            error_msg = str(e)
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                error_msg = e.response.text
                
            return AIResponse(
                success=False,
                error=error_msg,
                response_time=time.time() - start_time
            )
    
    @classmethod
    async def create(
        cls, 
        api_key: Optional[str] = None, 
        model: str = "gpt-3.5-turbo"
    ) -> 'OpenAIClient':
        """Create a new instance asynchronously (for compatibility with async code)"""
        return cls(api_key=api_key, model=model)

# Example usage
async def example_usage():
    # Initialize the client
    client = await OpenAIClient.create()
    
    # Example chat completion
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Tell me a short joke."}
    ]
    
    # Get completion
    response = await client.chat_completion(messages)
    
    if response.success:
        print(f"Response: {response.content}")
        print(f"Model: {response.model}")
        print(f"Tokens used: {response.usage['total_tokens']}")
        print(f"Response time: {response.response_time:.2f}s")
    else:
        print(f"Error: {response.error}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(example_usage())
