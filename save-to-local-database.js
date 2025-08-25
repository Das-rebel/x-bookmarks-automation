#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

class LocalBookmarkSaver {
    constructor() {
        this.dbPath = './bookmarks.db';
        this.db = null;
        this.sessionId = Date.now().toString();
        this.logs = [];
    }
    
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
    }
    
    async initialize() {
        try {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });
            this.log('✅ Database connection established');
            return true;
        } catch (error) {
            this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    async loadProcessedBookmarks() {
        try {
            // Find the most recent processed bookmarks
            const files = fs.readdirSync('.').filter(file => 
                file.startsWith('processed-bookmarks-') && fs.statSync(file).isDirectory()
            );
            
            if (files.length === 0) {
                throw new Error('No processed bookmarks directory found');
            }
            
            // Sort by creation time and get the most recent
            const mostRecentDir = files.sort().pop();
            const allBookmarksFile = path.join(mostRecentDir, 'all-processed-bookmarks.json');
            
            if (!fs.existsSync(allBookmarksFile)) {
                throw new Error(`Processed bookmarks file not found: ${allBookmarksFile}`);
            }
            
            this.log(`📄 Loading processed bookmarks from: ${mostRecentDir}`);
            
            const bookmarksData = fs.readFileSync(allBookmarksFile, 'utf8');
            const bookmarks = JSON.parse(bookmarksData);
            
            this.log(`📖 Loaded ${bookmarks.length} processed bookmarks`);
            return bookmarks;
            
        } catch (error) {
            this.log(`❌ Failed to load processed bookmarks: ${error.message}`, 'ERROR');
            return [];
        }
    }
    
    async saveBookmarksToDatabase(bookmarks) {
        this.log('💾 Saving bookmarks to local database...');
        
        let savedCount = 0;
        let errorCount = 0;
        const batchSize = 50;
        
        for (let i = 0; i < bookmarks.length; i += batchSize) {
            const batch = bookmarks.slice(i, i + batchSize);
            this.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(bookmarks.length/batchSize)}`);
            
            for (const bookmark of batch) {
                try {
                    await this.db.run(`
                        INSERT OR REPLACE INTO bookmarks (
                            tweet_id, text, author, author_handle, timestamp, url,
                            like_count, retweet_count, reply_count, has_media,
                            engagement_score, content_type, sentiment, language,
                            topics, hashtags, mentions, priority_score, content_hash
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        bookmark.id,
                        bookmark.text,
                        bookmark.author,
                        bookmark.authorHandle,
                        bookmark.timestamp,
                        bookmark.url,
                        bookmark.likeCount || 0,
                        bookmark.retweetCount || 0,
                        bookmark.replyCount || 0,
                        bookmark.hasMedia ? 1 : 0,
                        bookmark.engagementScore || 0.5,
                        bookmark.contentType || 'General',
                        bookmark.sentiment || 'neutral',
                        bookmark.language || 'unknown',
                        JSON.stringify(bookmark.topics || []),
                        JSON.stringify(bookmark.hashtags || []),
                        JSON.stringify(bookmark.mentions || []),
                        bookmark.priorityScore || 0,
                        bookmark.contentHash || `hash_${bookmark.id}_${Date.now()}`
                    ]);
                    
                    savedCount++;
                    
                } catch (error) {
                    errorCount++;
                    this.log(`❌ Failed to save bookmark ${bookmark.id}: ${error.message}`, 'ERROR');
                }
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.log(`✅ Database save complete: Successfully saved: ${savedCount}, Errors: ${errorCount}`);
        return { savedCount, errorCount };
    }
    
    async getDatabaseStats() {
        try {
            const totalCount = await this.db.get('SELECT COUNT(*) as count FROM bookmarks');
            const contentTypes = await this.db.all(`
                SELECT content_type, COUNT(*) as count 
                FROM bookmarks 
                GROUP BY content_type 
                ORDER BY count DESC
            `);
            const avgEngagement = await this.db.get('SELECT AVG(engagement_score) as avg_score FROM bookmarks');
            const avgPriority = await this.db.get('SELECT AVG(priority_score) as avg_score FROM bookmarks');
            
            return {
                totalBookmarks: totalCount.count,
                contentTypes: contentTypes,
                averageEngagement: avgEngagement.avg_score || 0,
                averagePriority: avgPriority.avg_score || 0
            };
        } catch (error) {
            this.log(`❌ Failed to get database stats: ${error.message}`, 'ERROR');
            return null;
        }
    }
    
    async close() {
        if (this.db) {
            await this.db.close();
            this.log('🔒 Database connection closed');
        }
    }
    
    async run() {
        try {
            this.log('🚀 Starting local database save process...');
            
            // Step 1: Initialize database
            if (!(await this.initialize())) {
                throw new Error('Database initialization failed');
            }
            
            // Step 2: Load processed bookmarks
            const bookmarks = await this.loadProcessedBookmarks();
            if (bookmarks.length === 0) {
                throw new Error('No bookmarks to save');
            }
            
            // Step 3: Save to database
            const saveResult = await this.saveBookmarksToDatabase(bookmarks);
            
            // Step 4: Get database stats
            const stats = await this.getDatabaseStats();
            
            // Step 5: Create summary
            const summary = {
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                totalProcessed: bookmarks.length,
                saveResult: saveResult,
                databaseStats: stats,
                logs: this.logs
            };
            
            // Save summary
            const summaryFile = `local-database-save-summary-${this.sessionId}.json`;
            fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
            
            this.log(`📁 Summary saved to: ${summaryFile}`);
            
            return summary;
            
        } catch (error) {
            this.log(`❌ Local database save failed: ${error.message}`, 'ERROR');
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Main execution
async function main() {
    const saver = new LocalBookmarkSaver();
    
    try {
        console.log('\n💾 Local Database Bookmark Saver');
        console.log('==================================\n');
        
        const result = await saver.run();
        
        console.log('\n📈 SAVE SUMMARY');
        console.log('=================');
        console.log(`📖 Total Processed: ${result.totalProcessed}`);
        console.log(`✅ Successfully Saved: ${result.saveResult.savedCount}`);
        console.log(`❌ Errors: ${result.saveResult.errorCount}`);
        
        if (result.databaseStats) {
            console.log(`\n📊 Database Statistics:`);
            console.log(`   Total Bookmarks: ${result.databaseStats.totalBookmarks}`);
            console.log(`   Avg Engagement: ${(result.databaseStats.averageEngagement || 0).toFixed(2)}`);
            console.log(`   Avg Priority: ${(result.databaseStats.averagePriority || 0).toFixed(1)}`);
            
            console.log(`\n📋 Content Types:`);
            result.databaseStats.contentTypes.forEach(type => {
                console.log(`   ${type.content_type}: ${type.count}`);
            });
        }
        
        console.log(`\n📁 Summary File: local-database-save-summary-${result.sessionId}.json`);
        console.log('\n🎉 Local database save completed!');
        
    } catch (error) {
        console.error('\n❌ LOCAL DATABASE SAVE FAILED');
        console.error('==============================');
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LocalBookmarkSaver;
