#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

class LocalDatabaseSetup {
    constructor() {
        this.dbPath = './bookmarks.db';
        this.db = null;
    }
    
    async initialize() {
        console.log('🚀 Setting up Local SQLite Database');
        console.log('===================================\n');
        
        try {
            // Create database connection
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });
            
            console.log('✅ SQLite database initialized');
            return true;
        } catch (error) {
            console.log(`❌ Failed to initialize database: ${error.message}`);
            return false;
        }
    }
    
    async createBookmarksTable() {
        console.log('\n📋 Creating bookmarks table...');
        
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tweet_id TEXT UNIQUE NOT NULL,
                text TEXT,
                author TEXT,
                author_handle TEXT,
                timestamp TEXT,
                url TEXT,
                like_count INTEGER DEFAULT 0,
                retweet_count INTEGER DEFAULT 0,
                reply_count INTEGER DEFAULT 0,
                has_media BOOLEAN DEFAULT 0,
                engagement_score REAL DEFAULT 0.50,
                content_type TEXT,
                sentiment TEXT,
                language TEXT,
                topics TEXT,
                hashtags TEXT,
                mentions TEXT,
                priority_score INTEGER DEFAULT 0,
                content_hash TEXT UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        try {
            await this.db.exec(createTableSQL);
            console.log('✅ Table created successfully');
            return true;
        } catch (error) {
            console.log(`❌ Table creation error: ${error.message}`);
            return false;
        }
    }
    
    async createIndexes() {
        console.log('\n🔍 Creating database indexes...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_tweet_id ON bookmarks(tweet_id);',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_author_handle ON bookmarks(author_handle);',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_timestamp ON bookmarks(timestamp);',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_content_type ON bookmarks(content_type);',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_priority_score ON bookmarks(priority_score);',
            'CREATE INDEX IF NOT EXISTS idx_bookmarks_engagement_score ON bookmarks(engagement_score);'
        ];
        
        for (const indexSQL of indexes) {
            try {
                await this.db.exec(indexSQL);
                console.log('✅ Index created');
            } catch (error) {
                console.log(`⚠️  Index creation warning: ${error.message}`);
            }
        }
    }
    
    async testConnection() {
        console.log('\n🔧 Testing database connection...');
        
        try {
            const result = await this.db.get('SELECT COUNT(*) as count FROM bookmarks');
            console.log('✅ Database connection successful!');
            console.log(`📊 Current bookmarks count: ${result.count}`);
            return true;
        } catch (error) {
            console.log(`❌ Connection test failed: ${error.message}`);
            return false;
        }
    }
    
    async insertTestBookmark() {
        console.log('\n🧪 Testing bookmark insertion...');
        
        const testBookmark = {
            tweet_id: 'test_' + Date.now(),
            text: 'Test bookmark for connection verification',
            author: 'Test User',
            author_handle: 'testuser',
            timestamp: new Date().toISOString(),
            url: 'https://example.com/test',
            content_hash: 'test_hash_' + Date.now()
        };
        
        try {
            const result = await this.db.run(`
                INSERT INTO bookmarks (
                    tweet_id, text, author, author_handle, timestamp, url, content_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                testBookmark.tweet_id,
                testBookmark.text,
                testBookmark.author,
                testBookmark.author_handle,
                testBookmark.timestamp,
                testBookmark.url,
                testBookmark.content_hash
            ]);
            
            console.log('✅ Test bookmark inserted successfully');
            console.log(`📝 Inserted ID: ${result.lastID}`);
            
            // Clean up test data
            await this.db.run('DELETE FROM bookmarks WHERE tweet_id = ?', [testBookmark.tweet_id]);
            console.log('🧹 Test data cleaned up');
            return true;
            
        } catch (error) {
            console.log(`❌ Test insertion error: ${error.message}`);
            return false;
        }
    }
    
    async close() {
        if (this.db) {
            await this.db.close();
            console.log('🔒 Database connection closed');
        }
    }
    
    async run() {
        console.log('🚀 Starting local database setup...\n');
        
        try {
            // Step 1: Initialize database
            if (!(await this.initialize())) {
                return false;
            }
            
            // Step 2: Create table
            if (!(await this.createBookmarksTable())) {
                return false;
            }
            
            // Step 3: Create indexes
            await this.createIndexes();
            
            // Step 4: Test connection
            if (!(await this.testConnection())) {
                return false;
            }
            
            // Step 5: Test insertion
            if (await this.insertTestBookmark()) {
                console.log('\n🎉 Local database setup completed successfully!');
                console.log('✅ Database is ready for bookmark storage');
                return true;
            } else {
                console.log('\n❌ Setup completed with warnings');
                return false;
            }
            
        } finally {
            await this.close();
        }
    }
}

// Main execution
async function main() {
    const setup = new LocalDatabaseSetup();
    
    try {
        const success = await setup.run();
        
        if (success) {
            console.log('\n🚀 Next Steps:');
            console.log('1. Your bookmarks are stored locally in: bookmarks.db');
            console.log('2. You can view the database with any SQLite browser');
            console.log('3. Run: node save-bookmarks-locally.js (for local processing)');
            console.log('4. Or create a new Supabase project for cloud storage');
        } else {
            console.log('\n❌ Setup failed. Please check the errors above.');
        }
        
    } catch (error) {
        console.error('\n💥 Setup crashed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LocalDatabaseSetup;
