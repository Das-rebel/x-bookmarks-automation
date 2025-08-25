#!/usr/bin/env python3
"""
LLM Router - Intelligent model selection and switching for the Second Brain Android App
Migrated from the original Second Brain Android project for integration with the backend service.
"""

import json
import argparse
import os
import sys
import asyncio
import aiohttp
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class UserTier(Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"

class AIOperation(Enum):
    CATEGORIZE = "categorize"
    SUMMARIZE = "summarize"
    EXTRACT_INSIGHTS = "extract_insights"
    GENERATE_TAGS = "generate_tags"

@dataclass
class ModelConfig:
    name: str
    cost_per_token: float
    max_tokens: int
    api_endpoint: str
    supports_json: bool = True

@dataclass
class ProcessingResult:
    success: bool
    result: Optional[Dict] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    cost: Optional[float] = None

class LLMRouter:
    def __init__(self, openrouter_api_key: str):
        self.api_key = openrouter_api_key
        self.models = self._initialize_models()
        self.session = None
        
    def _initialize_models(self) -> Dict[UserTier, List[ModelConfig]]:
        """Initialize available models for each user tier"""
        return {
            UserTier.FREE: [
                ModelConfig(
                    name="anthropic/claude-3-haiku",
                    cost_per_token=0.00000025,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                ),
                ModelConfig(
                    name="openai/gpt-3.5-turbo",
                    cost_per_token=0.000002,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                )
            ],
            UserTier.PRO: [
                ModelConfig(
                    name="anthropic/claude-3-sonnet",
                    cost_per_token=0.000015,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                ),
                ModelConfig(
                    name="openai/gpt-4",
                    cost_per_token=0.00003,
                    max_tokens=8000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                ),
                ModelConfig(
                    name="openai/gpt-3.5-turbo",
                    cost_per_token=0.000002,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                )
            ],
            UserTier.PREMIUM: [
                ModelConfig(
                    name="anthropic/claude-3-opus",
                    cost_per_token=0.000075,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                ),
                ModelConfig(
                    name="openai/gpt-4",
                    cost_per_token=0.00003,
                    max_tokens=8000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                ),
                ModelConfig(
                    name="anthropic/claude-3-sonnet",
                    cost_per_token=0.000015,
                    max_tokens=4000,
                    api_endpoint="https://openrouter.ai/api/v1/chat/completions"
                )
            ]
        }
    
    def select_optimal_model(self, content_length: int, user_tier: UserTier, 
                           operation: AIOperation, budget_constraint: Optional[float] = None) -> ModelConfig:
        """Select the most appropriate model based on content length, user tier, and operation"""
        
        available_models = self.models[user_tier]
        
        # For simple operations like categorization, prefer faster/cheaper models
        if operation in [AIOperation.CATEGORIZE, AIOperation.GENERATE_TAGS]:
            # Sort by cost (cheapest first)
            available_models = sorted(available_models, key=lambda m: m.cost_per_token)
        
        # For complex operations, prefer quality models
        elif operation in [AIOperation.EXTRACT_INSIGHTS, AIOperation.SUMMARIZE]:
            # Sort by quality (assume higher cost = better quality for this demo)
            available_models = sorted(available_models, key=lambda m: m.cost_per_token, reverse=True)
        
        # Apply budget constraint if specified
        if budget_constraint:
            estimated_tokens = min(content_length * 2, 500)  # Rough estimate
            available_models = [m for m in available_models 
                             if m.cost_per_token * estimated_tokens <= budget_constraint]
        
        # Filter by content length (ensure model can handle the input)
        available_models = [m for m in available_models if m.max_tokens >= content_length]
        
        if not available_models:
            # Fallback to the cheapest model available
            return min(self.models[user_tier], key=lambda m: m.cost_per_token)
        
        return available_models[0]
    
    def create_prompt(self, content: str, operation: AIOperation) -> str:
        """Create operation-specific prompts"""
        
        prompts = {
            AIOperation.CATEGORIZE: f"""Analyze the following tweet and categorize it into one of these categories: 
Technology, Business, Education, Entertainment, News, Personal, Health, Sports, Travel, Food, Politics, Science, Art, Finance, Other.

Also provide 3-5 relevant tags and a brief summary (max 100 words).

Tweet: "{content}"

Respond in JSON format:
{{
    "category": "category_name",
    "tags": ["tag1", "tag2", "tag3"],
    "summary": "brief summary",
    "confidence": 0.95
}}""",
            
            AIOperation.SUMMARIZE: f"""Provide a concise summary of the following tweet content in 1-2 sentences:

Tweet: "{content}"

Focus on the main message and key points. Be clear and concise.""",
            
            AIOperation.EXTRACT_INSIGHTS: f"""Extract key insights and actionable items from the following tweet:

Tweet: "{content}"

Respond in JSON format:
{{
    "insights": ["insight1", "insight2"],
    "actionable_items": ["action1", "action2"],
    "importance": "high/medium/low",
    "topics": ["topic1", "topic2"]
}}""",
            
            AIOperation.GENERATE_TAGS: f"""Generate 5-10 relevant tags for the following tweet content:

Tweet: "{content}"

Respond in JSON format:
{{
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "primary_topic": "main_topic",
    "sentiment": "positive/negative/neutral"
}}"""
        }
        
        return prompts[operation]
    
    async def process_content(self, content: str, operation: AIOperation, 
                            user_tier: UserTier = UserTier.FREE, 
                            budget_constraint: Optional[float] = None) -> ProcessingResult:
        """Process content with the selected model"""
        
        if not self.session:
            self.session = aiohttp.ClientSession()
        
        try:
            # Select optimal model
            model = self.select_optimal_model(len(content), user_tier, operation, budget_constraint)
            
            # Create prompt
            prompt = self.create_prompt(content, operation)
            
            # Prepare request
            payload = {
                "model": model.name,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": min(500, model.max_tokens),
                "temperature": 0.3 if operation == AIOperation.CATEGORIZE else 0.7,
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-Title": "Second Brain Android App"
            }
            
            # Make API request
            async with self.session.post(model.api_endpoint, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    return ProcessingResult(
                        success=False,
                        error=f"API request failed with status {response.status}: {error_text}",
                        model_used=model.name
                    )
                
                data = await response.json()
                
                if "choices" not in data or not data["choices"]:
                    return ProcessingResult(
                        success=False,
                        error="No response from model",
                        model_used=model.name
                    )
                
                result_text = data["choices"][0]["message"]["content"]
                
                # Calculate usage and cost
                tokens_used = data.get("usage", {}).get("total_tokens", 0)
                cost = tokens_used * model.cost_per_token
                
                # Parse JSON response for structured operations
                if operation in [AIOperation.CATEGORIZE, AIOperation.EXTRACT_INSIGHTS, AIOperation.GENERATE_TAGS]:
                    try:
                        result = json.loads(result_text)
                    except json.JSONDecodeError:
                        # If JSON parsing fails, return as text
                        result = {"text": result_text}
                else:
                    result = {"text": result_text}
                
                return ProcessingResult(
                    success=True,
                    result=result,
                    model_used=model.name,
                    tokens_used=tokens_used,
                    cost=cost
                )
                
        except Exception as e:
            return ProcessingResult(
                success=False,
                error=str(e),
                model_used=model.name if 'model' in locals() else None
            )
    
    async def process_batch(self, contents: List[str], operation: AIOperation, 
                          user_tier: UserTier = UserTier.FREE, 
                          budget_constraint: Optional[float] = None) -> List[ProcessingResult]:
        """Process multiple contents in batch"""
        
        results = []
        batch_size = 5 if user_tier == UserTier.FREE else 20
        
        for i in range(0, len(contents), batch_size):
            batch = contents[i:i + batch_size]
            
            # Process batch concurrently
            batch_tasks = [
                self.process_content(content, operation, user_tier, budget_constraint)
                for content in batch
            ]
            
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append(ProcessingResult(
                        success=False,
                        error=str(result)
                    ))
                else:
                    results.append(result)
            
            # Rate limiting between batches
            if i + batch_size < len(contents):
                await asyncio.sleep(2)
        
        return results
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session:
            await self.session.close()

async def main():
    parser = argparse.ArgumentParser(description='LLM Router for Second Brain Android App')
    parser.add_argument('--content', required=True, help='Content to process')
    parser.add_argument('--operation', default='categorize', 
                       choices=['categorize', 'summarize', 'extract_insights', 'generate_tags'],
                       help='Operation to perform')
    parser.add_argument('--user-tier', default='free', 
                       choices=['free', 'pro', 'premium'],
                       help='User subscription tier')
    parser.add_argument('--budget', type=float, help='Budget constraint for processing')
    
    args = parser.parse_args()
    
    # Get API key from environment
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print(json.dumps({
            "success": False,
            "error": "OPENROUTER_API_KEY environment variable not set"
        }))
        sys.exit(1)
    
    # Initialize router
    router = LLMRouter(api_key)
    
    try:
        # Process content
        result = await router.process_content(
            content=args.content,
            operation=AIOperation(args.operation),
            user_tier=UserTier(args.user_tier),
            budget_constraint=args.budget
        )
        
        # Output result as JSON
        output = {
            "success": result.success,
            "result": result.result,
            "error": result.error,
            "model_used": result.model_used,
            "tokens_used": result.tokens_used,
            "cost": result.cost
        }
        
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)
    
    finally:
        await router.close()

if __name__ == "__main__":
    asyncio.run(main())