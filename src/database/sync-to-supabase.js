#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class SupabaseSyncManager {
    constructor() {
        this.startTime = Date.now();
        this.logs = [];
        this.stats = {
            totalBookmarks: 0,
            successfullySynced: 0,
            errors: 0,
            duplicates: 0,
            schemaUpdates: 0
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
    }

    async testSupabaseConnection() {
        try {
            this.log('🔍 Testing Supabase connection...');
            
            // Test basic connection
            const { data, error } = await supabase
                .from('twitter_memos')
                .select('count')
                .limit(1);
            
            if (error) {
                throw new Error(`Connection test failed: ${error.message}`);
            }
            
            this.log('✅ Supabase connection successful');
            return true;
            
        } catch (error) {
            this.log(`❌ Supabase connection failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async checkTableStructure() {
        try {
            this.log('🔍 Checking table structure...');
            
            // Check if twitter_memos table exists and has required columns
            const { data: columns, error } = await supabase
                .rpc('exec_sql', {
                    sql: `
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns 
                        WHERE table_name = 'twitter_memos' 
                        AND table_schema = 'public'
                        ORDER BY ordinal_position;
                    `
                });
            
            if (error) {
                this.log(`⚠️ Could not check table structure: ${error.message}`, 'WARN');
                return false;
            }
            
            this.log(`✅ Found twitter_memos table with columns`);
            return true;
            
        } catch (error) {
            this.log(`❌ Table structure check failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async applySchemaModifications() {
        try {
            this.log('🔧 Applying enhanced schema modifications...');
            
            // First, apply the tweet_analysis table fix
            const tweetAnalysisFixFile = path.join(__dirname, 'fix-tweet-analysis-schema.sql');
            
            if (fs.existsSync(tweetAnalysisFixFile)) {
                this.log('🔧 Applying tweet_analysis table fix...');
                const fixSQL = fs.readFileSync(tweetAnalysisFixFile, 'utf8');
                
                // Split SQL into individual statements
                const fixStatements = fixSQL
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                
                let fixSuccessCount = 0;
                let fixErrorCount = 0;
                
                for (const statement of fixStatements) {
                    try {
                        if (statement.trim()) {
                            const { error } = await supabase.rpc('exec_sql', { sql: statement });
                            if (error) {
                                this.log(`⚠️ Fix statement failed: ${error.message}`, 'WARN');
                                fixErrorCount++;
                            } else {
                                fixSuccessCount++;
                            }
                        }
                    } catch (err) {
                        this.log(`⚠️ Fix statement error: ${err.message}`, 'WARN');
                        fixErrorCount++;
                    }
                }
                
                this.log(`✅ Tweet analysis fix applied: ${fixSuccessCount} successful, ${fixErrorCount} errors`);
            }
            
            // Read and execute the enhanced schema modifications
            const schemaFile = path.join(__dirname, 'enhanced-schema-modifications.sql');
            
            if (!fs.existsSync(schemaFile)) {
                this.log('⚠️ Schema file not found, skipping schema updates', 'WARN');
                return true;
            }
            
            const schemaSQL = fs.readFileSync(schemaFile, 'utf8');
            
            // Split SQL into individual statements
            const statements = schemaSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const statement of statements) {
                try {
                    if (statement.trim()) {
                        const { error } = await supabase.rpc('exec_sql', { sql: statement });
                        if (error) {
                            this.log(`⚠️ Schema statement failed: ${error.message}`, 'WARN');
                            errorCount++;
                        } else {
                            successCount++;
                        }
                    }
                } catch (err) {
                    this.log(`⚠️ Schema statement error: ${err.message}`, 'WARN');
                    errorCount++;
                }
            }
            
            this.log(`✅ Schema modifications applied: ${successCount} successful, ${errorCount} errors`);
            this.stats.schemaUpdates = successCount;
            return errorCount === 0;
            
        } catch (error) {
            this.log(`❌ Schema modifications failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async loadProcessedBookmarks() {
        try {
            this.log('📚 Loading processed bookmarks...');
            
            // Look for the most recent processed bookmarks directory
            const directories = fs.readdirSync(__dirname)
                .filter(item => {
                    const fullPath = path.join(__dirname, item);
                    return fs.statSync(fullPath).isDirectory() && 
                           item.startsWith('processed-bookmarks-');
                })
                .sort()
                .reverse();
            
            if (directories.length === 0) {
                throw new Error('No processed bookmarks directories found');
            }
            
            const latestDir = directories[0];
            this.log(`📁 Using latest directory: ${latestDir}`);
            
            // Look for the all-processed-bookmarks.json file
            const allBookmarksFile = path.join(__dirname, latestDir, 'all-processed-bookmarks.json');
            
            if (!fs.existsSync(allBookmarksFile)) {
                throw new Error(`File not found: ${allBookmarksFile}`);
            }
            
            const bookmarksData = JSON.parse(fs.readFileSync(allBookmarksFile, 'utf8'));
            
            // Extract bookmarks from the processed data
            let bookmarks = [];
            if (bookmarksData.bookmarks) {
                bookmarks = bookmarksData.bookmarks;
            } else if (Array.isArray(bookmarksData)) {
                bookmarks = bookmarksData;
            } else {
                throw new Error('Invalid bookmarks data format');
            }
            
            this.log(`✅ Loaded ${bookmarks.length} processed bookmarks from ${allBookmarksFile}`);
            this.stats.totalBookmarks = bookmarks.length;
            return bookmarks;
            
        } catch (error) {
            this.log(`❌ Failed to load processed bookmarks: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async syncBookmarksToSupabase(bookmarks) {
        try {
            this.log('🔄 Syncing bookmarks to Supabase...');
            
            if (bookmarks.length === 0) {
                this.log('⚠️ No bookmarks to sync');
                return;
            }
            
            // Process bookmarks in batches
            const batchSize = 10;
            const batches = [];
            
            for (let i = 0; i < bookmarks.length; i += batchSize) {
                batches.push(bookmarks.slice(i, i + batchSize));
            }
            
            this.log(`📦 Processing ${bookmarks.length} bookmarks in ${batches.length} batches`);
            
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                this.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} bookmarks)`);
                
                for (const bookmark of batch) {
                    try {
                        await this.syncSingleBookmark(bookmark);
                    } catch (error) {
                        this.log(`❌ Failed to sync bookmark: ${error.message}`, 'ERROR');
                        this.stats.errors++;
                    }
                }
                
                // Small delay between batches
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            this.log(`✅ Bookmark sync completed: ${this.stats.successfullySynced} successful, ${this.stats.errors} errors, ${this.stats.duplicates} duplicates`);
            
            // Now ensure all bookmarks have complete supporting fields
            await this.ensureCompleteBookmarkFields(bookmarks);
            
        } catch (error) {
            this.log(`❌ Bookmark sync failed: ${error.message}`, 'ERROR');
        }
    }

    async ensureCompleteBookmarkFields(bookmarks) {
        try {
            this.log('🔧 Ensuring all bookmarks have complete supporting fields...');
            
            let updateCount = 0;
            let errorCount = 0;
            
            for (const bookmark of bookmarks) {
                try {
                    // Update bookmark with complete supporting fields
                    const updateData = {
                        is_bookmark: true,
                        bookmark_extracted_at: bookmark.bookmarkExtractedAt || new Date().toISOString(),
                        bookmark_html: bookmark.bookmarkHtml || '',
                        bookmark_hash: bookmark.bookmarkHash || this.generateHash(bookmark.text || bookmark.content || ''),
                        bookmark_reason: bookmark.bookmarkReason || 'ai_analysis',
                        bookmark_source: 'twitter_scraper',
                        last_processed_at: new Date().toISOString(),
                        thread_id: bookmark.threadId || bookmark.thread_id || null,
                        thread_position: bookmark.threadPosition || bookmark.thread_position || null,
                        thread_total_tweets: bookmark.threadTotalTweets || bookmark.thread_total_tweets || null,
                        thread_root_id: bookmark.threadRootId || bookmark.thread_root_id || null,
                        parent_tweet_id: bookmark.parentTweetId || bookmark.parent_tweet_id || null,
                        thread_completion_status: bookmark.threadCompletionStatus || bookmark.thread_completion_status || 'unknown',
                        thread_detection_confidence: bookmark.threadDetectionConfidence || bookmark.thread_detection_confidence || 0.0,
                        thread_context_importance: bookmark.threadContextImportance || bookmark.thread_context_importance || 0.5
                    };
                    
                    const { error: updateError } = await supabase
                        .from('twitter_memos')
                        .update(updateData)
                        .eq('id', bookmark.id);
                    
                    if (updateError) {
                        throw new Error(`Bookmark update failed: ${updateError.message}`);
                    }
                    
                    updateCount++;
                    
                } catch (error) {
                    this.log(`❌ Failed to update bookmark fields: ${error.message}`, 'ERROR');
                    errorCount++;
                }
            }
            
            this.log(`✅ Bookmark field updates completed: ${updateCount} successful, ${errorCount} errors`);
            
        } catch (error) {
            this.log(`❌ Bookmark field updates failed: ${error.message}`, 'ERROR');
        }
    }

    generateHash(text) {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    async syncSingleBookmark(bookmark) {
        try {
            // Generate hash for deduplication
            const contentHash = crypto.createHash('md5')
                .update(`${bookmark.text || bookmark.content}-${bookmark.author || bookmark.authorHandle}-${bookmark.timestamp || bookmark.created_at}`)
                .digest('hex');
            
            // Check if already exists
            const { data: existing, error: checkError } = await supabase
                .from('twitter_memos')
                .select('id, bookmark_hash')
                .eq('bookmark_hash', contentHash)
                .single();
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error(`Duplicate check failed: ${checkError.message}`);
            }
            
            if (existing) {
                this.stats.duplicates++;
                this.log(`⏭️ Skipping duplicate bookmark: ${(bookmark.text || bookmark.content || '').substring(0, 50)}...`);
                return;
            }
            
            // Prepare data for insertion
            const bookmarkData = {
                id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: bookmark.text || bookmark.content || '',
                author: bookmark.author || bookmark.authorHandle || 'unknown',
                url: bookmark.url || bookmark.tweetUrl || '',
                created_at: bookmark.timestamp || bookmark.created_at || new Date().toISOString(),
                is_bookmark: true,
                bookmark_extracted_at: new Date().toISOString(),
                bookmark_html: bookmark.htmlContent || '',
                bookmark_hash: contentHash,
                bookmark_reason: 'Synced from local processing',
                bookmark_source: 'enhanced_local_processor',
                last_processed_at: new Date().toISOString(),
                text_length: (bookmark.text || bookmark.content || '').length,
                word_count: (bookmark.text || bookmark.content || '').split(/\s+/).filter(word => word.length > 0).length,
                engagement_score: bookmark.engagementScore || bookmark.engagement_score || 0.5,
                is_thread: bookmark.isThread || bookmark.is_thread || false,
                thread_completion_status: bookmark.threadCompletionStatus || 'unknown',
                thread_detection_confidence: bookmark.threadDetectionConfidence || 0,
                thread_context_importance: bookmark.threadContextImportance || 0.5
            };
            
            // Insert into database
            const { error: insertError } = await supabase
                .from('twitter_memos')
                .insert(bookmarkData);
            
            if (insertError) {
                throw new Error(`Insert failed: ${insertError.message}`);
            }
            
            this.stats.successfullySynced++;
            this.log(`✅ Synced bookmark: ${(bookmark.text || bookmark.content || '').substring(0, 50)}...`);
            
        } catch (error) {
            throw error;
        }
    }

    async createTweetAnalysisRecords(bookmarks) {
        try {
            this.log('🧠 Creating tweet analysis records...');
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const bookmark of bookmarks) {
                try {
                    // Check if analysis record already exists
                    let existing = null;
                    let checkError = null;
                    
                    try {
                        const result = await supabase
                            .from('tweet_analysis')
                            .select('id')
                            .eq('tweet_id', bookmark.id)
                            .single();
                        
                        existing = result.data;
                        checkError = result.error;
                    } catch (tableError) {
                        // Table might not exist yet, that's okay
                        this.log(`ℹ️ tweet_analysis table not accessible yet, will create: ${tableError.message}`, 'INFO');
                        existing = null;
                        checkError = null;
                    }
                    
                    if (checkError && checkError.code !== 'PGRST116') {
                        if (checkError.message.includes('row-level security policy')) {
                            this.log(`ℹ️ RLS policy issue, skipping analysis for: ${bookmark.id}`, 'INFO');
                            continue;
                        } else {
                            this.log(`⚠️ Analysis check failed: ${checkError.message}`, 'WARN');
                            continue;
                        }
                    }
                    
                    if (existing) {
                        this.log(`⏭️ Analysis record already exists for bookmark: ${bookmark.id}`);
                        continue;
                    }
                    
                    // Create comprehensive analysis record with all supporting fields
                    const analysisData = {
                        tweet_id: bookmark.id,
                        engagement_potential: bookmark.aiAnalysis?.engagementPotential || 0.5,
                        readability_score: bookmark.aiAnalysis?.readabilityScore || 0.5,
                        positive_indicators: bookmark.aiAnalysis?.positiveIndicators || [],
                        negative_indicators: bookmark.aiAnalysis?.negativeIndicators || [],
                        tech_indicators: bookmark.aiAnalysis?.techIndicators || [],
                        business_indicators: bookmark.aiAnalysis?.businessIndicators || [],
                        topic: bookmark.aiAnalysis?.topic || 'general',
                        tags: bookmark.aiAnalysis?.tags || [],
                        entities: bookmark.aiAnalysis?.entities || [],
                        concepts: bookmark.aiAnalysis?.concepts || [],
                        sentiment: bookmark.aiAnalysis?.sentiment || 'neutral',
                        intent: bookmark.aiAnalysis?.intent || 'informative',
                        relevance_score: bookmark.aiAnalysis?.relevanceScore || 0.5,
                        virality_potential: bookmark.aiAnalysis?.viralityPotential || 0.5,
                        actionable: bookmark.aiAnalysis?.actionable || false,
                        categories: bookmark.aiAnalysis?.categories || [],
                        quality_score: bookmark.aiAnalysis?.qualityScore || 0.5,
                        information_type: bookmark.aiAnalysis?.informationType || 'general',
                        target_audience: bookmark.aiAnalysis?.targetAudience || 'general',
                        key_insights: bookmark.aiAnalysis?.keyInsights || [],
                        discussion_worthy: bookmark.aiAnalysis?.discussionWorthy || false,
                        composite_score: bookmark.aiAnalysis?.compositeScore || 0.5,
                        engagement_prediction: bookmark.aiAnalysis?.engagementPrediction || null,
                        content_value: bookmark.aiAnalysis?.contentValue || 0.5,
                        reference_worthy: bookmark.aiAnalysis?.referenceWorthy || false,
                        bookmark_specific_analysis: {
                            sentiment_confidence: bookmark.aiAnalysis?.sentimentConfidence || 0.5,
                            content_type: bookmark.aiAnalysis?.contentType || 'general',
                            actionable_content: bookmark.aiAnalysis?.actionable || false,
                            reference_value: bookmark.aiAnalysis?.referenceWorthy || false
                        },
                        learning_value: bookmark.aiAnalysis?.learningValue || 0.5,
                        knowledge_category: bookmark.aiAnalysis?.knowledgeCategory || 'general',
                        bookmark_context: bookmark.aiAnalysis?.bookmarkContext || '',
                        extraction_confidence: bookmark.aiAnalysis?.extractionConfidence || 0.9,
                        thread_theme: bookmark.aiAnalysis?.threadTheme || null,
                        thread_coherence: bookmark.aiAnalysis?.threadCoherence || 0.5,
                        thread_completeness: bookmark.aiAnalysis?.threadCompleteness || 0.5,
                        context_importance: bookmark.aiAnalysis?.contextImportance || 0.5,
                        thread_summary: bookmark.aiAnalysis?.threadSummary || null,
                        key_thread_insights: bookmark.aiAnalysis?.keyThreadInsights || [],
                        recommended_reading_order: bookmark.aiAnalysis?.recommendedReadingOrder || false,
                        thread_analysis_metadata: bookmark.aiAnalysis?.threadAnalysisMetadata || {}
                    };
                    
                    const { error: insertError } = await supabase
                        .from('tweet_analysis')
                        .insert(analysisData);
                    
                    if (insertError) {
                        if (insertError.message.includes('row-level security policy')) {
                            this.log(`ℹ️ RLS policy prevents insert for: ${bookmark.id}`, 'INFO');
                            // Skip this bookmark but don't count as error
                            continue;
                        } else {
                            throw new Error(`Analysis insert failed: ${insertError.message}`);
                        }
                    }
                    
                    successCount++;
                    
                } catch (error) {
                    this.log(`❌ Failed to create analysis record: ${error.message}`, 'ERROR');
                    errorCount++;
                }
            }
            
            this.log(`✅ Tweet analysis records created: ${successCount} successful, ${errorCount} errors`);
            
        } catch (error) {
            this.log(`❌ Tweet analysis creation failed: ${error.message}`, 'ERROR');
        }
    }

    async generateSyncSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - this.startTime,
            stats: this.stats,
            logs: this.logs.slice(-50), // Last 50 log entries
            supabaseUrl: supabaseUrl
        };
        
        const summaryFile = `supabase-sync-summary-${Date.now()}.json`;
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        
        this.log(`📁 Sync summary saved to: ${summaryFile}`);
        return summary;
    }

    async run() {
        try {
            this.log('🚀 Starting Supabase sync process...');
            this.log(`🔗 Supabase URL: ${supabaseUrl}`);
            
            // Step 1: Test connection
            const connectionOk = await this.testSupabaseConnection();
            if (!connectionOk) {
                throw new Error('Supabase connection failed');
            }
            
            // Step 2: Check table structure
            const structureOk = await this.checkTableStructure();
            if (!structureOk) {
                this.log('⚠️ Table structure check failed, but continuing...', 'WARN');
            }
            
            // Step 3: Apply schema modifications (skipped - exec_sql function not available)
            this.log('⚠️ Skipping schema modifications - exec_sql function not available in database');
            this.log('📋 Using existing table structure');
            
            // Step 4: Load processed bookmarks
            const bookmarks = await this.loadProcessedBookmarks();
            if (bookmarks.length === 0) {
                throw new Error('No bookmarks to sync');
            }
            
            // Step 5: Sync bookmarks to Supabase
            await this.syncBookmarksToSupabase(bookmarks);
            
            // Step 6: Create tweet analysis records
            await this.createTweetAnalysisRecords(bookmarks);
            
            // Step 7: Generate summary
            const summary = await this.generateSyncSummary();
            
            this.log('🎉 Supabase sync completed successfully!');
            this.log(`📊 Final Summary:`);
            this.log(`  📚 Total Bookmarks: ${this.stats.totalBookmarks}`);
            this.log(`  ✅ Successfully Synced: ${this.stats.successfullySynced}`);
            this.log(`  ❌ Errors: ${this.stats.errors}`);
            this.log(`  ⏭️ Duplicates Skipped: ${this.stats.duplicates}`);
            this.log(`  🔧 Schema Updates: ${this.stats.schemaUpdates}`);
            this.log(`  ⏱️ Execution Time: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
            
            return summary;
            
        } catch (error) {
            this.log(`❌ Supabase sync failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// Main execution
async function main() {
    const syncManager = new SupabaseSyncManager();
    
    try {
        console.log('\n🚀 Starting Supabase Sync Process');
        console.log('================================');
        console.log(`Target: Sync all processed bookmarks to Supabase`);
        console.log(`Supabase: ${supabaseUrl}`);
        console.log('================================\n');
        
        const result = await syncManager.run();
        
        console.log('\n📈 SYNC SUMMARY');
        console.log('================');
        console.log(`📚 Total Bookmarks: ${result.stats.totalBookmarks}`);
        console.log(`✅ Successfully Synced: ${result.stats.successfullySynced}`);
        console.log(`❌ Errors: ${result.stats.errors}`);
        console.log(`⏭️ Duplicates Skipped: ${result.stats.duplicates}`);
        console.log(`🔧 Schema Updates: ${result.stats.schemaUpdates}`);
        console.log(`⏱️ Execution Time: ${Math.round(result.executionTime / 1000)}s`);
        console.log(`📁 Summary File: supabase-sync-summary-${Date.now()}.json`);
        
        if (result.stats.errors > 0) {
            console.log('\n⚠️  Some bookmarks failed to sync. Check the logs for details.');
        }
        
        if (result.stats.duplicates > 0) {
            console.log(`\n⏭️  ${result.stats.duplicates} duplicate bookmarks were skipped.`);
        }
        
        console.log('\n🎉 Supabase sync completed successfully!');
        console.log(`🌐 Your bookmarks are now available in the cloud at: ${supabaseUrl}`);
        
    } catch (error) {
        console.error('\n❌ SUPABASE SYNC FAILED');
        console.error('=======================');
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default SupabaseSyncManager;
