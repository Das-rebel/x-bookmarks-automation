#!/usr/bin/env python3
"""
OpenAI Quota Checker - Monitor usage and costs for the Second Brain Android App
Migrated from the original Second Brain Android project for integration with the backend service.
"""

import json
import argparse
import os
import sys
import asyncio
import aiohttp
from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import sqlite3
from pathlib import Path

@dataclass
class QuotaInfo:
    user_id: str
    tier: str
    used_tokens: int
    token_limit: int
    used_cost: float
    cost_limit: float
    reset_date: datetime
    remaining_tokens: int
    remaining_cost: float
    percentage_used: float

class QuotaManager:
    def __init__(self, db_path: str = "quota_tracker.db"):
        self.db_path = db_path
        self.init_database()
        self.session = None
        
    def init_database(self):
        """Initialize SQLite database for quota tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_quotas (
                user_id TEXT PRIMARY KEY,
                tier TEXT NOT NULL,
                used_tokens INTEGER DEFAULT 0,
                token_limit INTEGER NOT NULL,
                used_cost REAL DEFAULT 0.0,
                cost_limit REAL NOT NULL,
                reset_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                model_used TEXT NOT NULL,
                tokens_used INTEGER NOT NULL,
                cost REAL NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES user_quotas (user_id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_tier_limits(self, tier: str) -> Dict[str, int]:
        """Get limits for different subscription tiers"""
        tier_limits = {
            'free': {
                'token_limit': 10000,  # 10k tokens per month
                'cost_limit': 0.20,    # $0.20 per month
                'requests_limit': 100  # 100 requests per month
            },
            'pro': {
                'token_limit': 500000,  # 500k tokens per month
                'cost_limit': 50.0,     # $50 per month
                'requests_limit': 5000  # 5000 requests per month
            },
            'premium': {
                'token_limit': -1,      # Unlimited
                'cost_limit': 200.0,    # $200 per month
                'requests_limit': -1    # Unlimited
            }
        }
        
        return tier_limits.get(tier, tier_limits['free'])
    
    def create_user_quota(self, user_id: str, tier: str = 'free') -> QuotaInfo:
        """Create a new user quota entry"""
        limits = self.get_tier_limits(tier)
        reset_date = datetime.now() + timedelta(days=30)  # Monthly reset
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_quotas 
            (user_id, tier, used_tokens, token_limit, used_cost, cost_limit, reset_date, updated_at)
            VALUES (?, ?, 0, ?, 0.0, ?, ?, ?)
        ''', (user_id, tier, limits['token_limit'], limits['cost_limit'], 
              reset_date.isoformat(), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return self.get_user_quota(user_id)
    
    def get_user_quota(self, user_id: str) -> Optional[QuotaInfo]:
        """Get current quota information for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT user_id, tier, used_tokens, token_limit, used_cost, cost_limit, reset_date
            FROM user_quotas WHERE user_id = ?
        ''', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        user_id, tier, used_tokens, token_limit, used_cost, cost_limit, reset_date = row
        reset_date = datetime.fromisoformat(reset_date)
        
        # Check if quota needs to be reset
        if datetime.now() > reset_date:
            self.reset_user_quota(user_id)
            return self.get_user_quota(user_id)
        
        remaining_tokens = token_limit - used_tokens if token_limit > 0 else -1
        remaining_cost = cost_limit - used_cost if cost_limit > 0 else -1
        
        percentage_used = (used_tokens / token_limit * 100) if token_limit > 0 else 0
        
        return QuotaInfo(
            user_id=user_id,
            tier=tier,
            used_tokens=used_tokens,
            token_limit=token_limit,
            used_cost=used_cost,
            cost_limit=cost_limit,
            reset_date=reset_date,
            remaining_tokens=remaining_tokens,
            remaining_cost=remaining_cost,
            percentage_used=percentage_used
        )
    
    def update_usage(self, user_id: str, operation: str, model_used: str, 
                    tokens_used: int, cost: float) -> bool:
        """Update user usage and add to history"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Update user quota
            cursor.execute('''
                UPDATE user_quotas 
                SET used_tokens = used_tokens + ?, 
                    used_cost = used_cost + ?,
                    updated_at = ?
                WHERE user_id = ?
            ''', (tokens_used, cost, datetime.now().isoformat(), user_id))
            
            # Add to usage history
            cursor.execute('''
                INSERT INTO usage_history 
                (user_id, operation, model_used, tokens_used, cost)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, operation, model_used, tokens_used, cost))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            print(f"Error updating usage: {e}")
            return False
        finally:
            conn.close()
    
    def reset_user_quota(self, user_id: str) -> bool:
        """Reset user quota for the new billing period"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            reset_date = datetime.now() + timedelta(days=30)
            cursor.execute('''
                UPDATE user_quotas 
                SET used_tokens = 0, 
                    used_cost = 0.0,
                    reset_date = ?,
                    updated_at = ?
                WHERE user_id = ?
            ''', (reset_date.isoformat(), datetime.now().isoformat(), user_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"Error resetting quota: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def check_quota_limits(self, user_id: str, tokens_needed: int, 
                          estimated_cost: float) -> Dict[str, bool]:
        """Check if user has enough quota for the requested operation"""
        quota = self.get_user_quota(user_id)
        
        if not quota:
            return {
                'can_proceed': False,
                'reason': 'User quota not found'
            }
        
        # Check token limit
        if quota.token_limit > 0 and quota.used_tokens + tokens_needed > quota.token_limit:
            return {
                'can_proceed': False,
                'reason': 'Token limit exceeded',
                'remaining_tokens': quota.remaining_tokens,
                'requested_tokens': tokens_needed
            }
        
        # Check cost limit
        if quota.cost_limit > 0 and quota.used_cost + estimated_cost > quota.cost_limit:
            return {
                'can_proceed': False,
                'reason': 'Cost limit exceeded',
                'remaining_cost': quota.remaining_cost,
                'requested_cost': estimated_cost
            }
        
        return {
            'can_proceed': True,
            'remaining_tokens': quota.remaining_tokens,
            'remaining_cost': quota.remaining_cost
        }
    
    def get_usage_history(self, user_id: str, limit: int = 100) -> List[Dict]:
        """Get usage history for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT operation, model_used, tokens_used, cost, timestamp
            FROM usage_history 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                'operation': row[0],
                'model_used': row[1],
                'tokens_used': row[2],
                'cost': row[3],
                'timestamp': row[4]
            })
        
        return history
    
    def get_quota_summary(self) -> Dict:
        """Get summary of all users' quotas"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                tier,
                COUNT(*) as user_count,
                SUM(used_tokens) as total_tokens,
                SUM(used_cost) as total_cost,
                AVG(used_tokens) as avg_tokens,
                AVG(used_cost) as avg_cost
            FROM user_quotas
            GROUP BY tier
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        summary = {}
        for row in rows:
            tier, user_count, total_tokens, total_cost, avg_tokens, avg_cost = row
            summary[tier] = {
                'user_count': user_count,
                'total_tokens': total_tokens or 0,
                'total_cost': total_cost or 0.0,
                'avg_tokens': avg_tokens or 0,
                'avg_cost': avg_cost or 0.0
            }
        
        return summary

async def main():
    parser = argparse.ArgumentParser(description='Quota Manager for Second Brain Android App')
    parser.add_argument('--user-id', required=True, help='User ID to check')
    parser.add_argument('--action', default='check', 
                       choices=['check', 'create', 'update', 'reset', 'history', 'summary'],
                       help='Action to perform')
    parser.add_argument('--tier', default='free', 
                       choices=['free', 'pro', 'premium'],
                       help='User subscription tier (for create action)')
    parser.add_argument('--tokens', type=int, default=0, help='Tokens used (for update action)')
    parser.add_argument('--cost', type=float, default=0.0, help='Cost incurred (for update action)')
    parser.add_argument('--operation', default='unknown', help='Operation performed (for update action)')
    parser.add_argument('--model', default='unknown', help='Model used (for update action)')
    
    args = parser.parse_args()
    
    # Initialize quota manager
    quota_manager = QuotaManager()
    
    try:
        if args.action == 'check':
            quota = quota_manager.get_user_quota(args.user_id)
            if not quota:
                quota = quota_manager.create_user_quota(args.user_id, args.tier)
            
            output = {
                "success": True,
                "quota": {
                    "user_id": quota.user_id,
                    "tier": quota.tier,
                    "used_tokens": quota.used_tokens,
                    "token_limit": quota.token_limit,
                    "used_cost": quota.used_cost,
                    "cost_limit": quota.cost_limit,
                    "remaining_tokens": quota.remaining_tokens,
                    "remaining_cost": quota.remaining_cost,
                    "percentage_used": quota.percentage_used,
                    "reset_date": quota.reset_date.isoformat()
                }
            }
            
        elif args.action == 'create':
            quota = quota_manager.create_user_quota(args.user_id, args.tier)
            output = {
                "success": True,
                "message": f"Created quota for user {args.user_id} with tier {args.tier}",
                "quota": {
                    "user_id": quota.user_id,
                    "tier": quota.tier,
                    "token_limit": quota.token_limit,
                    "cost_limit": quota.cost_limit,
                    "reset_date": quota.reset_date.isoformat()
                }
            }
            
        elif args.action == 'update':
            success = quota_manager.update_usage(
                args.user_id, args.operation, args.model, args.tokens, args.cost
            )
            output = {
                "success": success,
                "message": f"Updated usage for user {args.user_id}" if success else "Failed to update usage"
            }
            
        elif args.action == 'reset':
            success = quota_manager.reset_user_quota(args.user_id)
            output = {
                "success": success,
                "message": f"Reset quota for user {args.user_id}" if success else "Failed to reset quota"
            }
            
        elif args.action == 'history':
            history = quota_manager.get_usage_history(args.user_id)
            output = {
                "success": True,
                "history": history
            }
            
        elif args.action == 'summary':
            summary = quota_manager.get_quota_summary()
            output = {
                "success": True,
                "summary": summary
            }
        
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())