#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class MissingAIAnalysisGenerator {
    constructor() {
        this.startTime = Date.now();
        this.stats = {
            totalBookmarks: 0,
            processedCount: 0,
            errors: 0,
            newAnalysisRecords: 0,
            updatedRecords: 0
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    // AI Analysis Logic (copied from process-bookmarks-locally.js)
    performRuleBasedAnalysis(bookmark) {
        try {
            const text = (bookmark.text || '').toLowerCase();
            const wordCount = bookmark.wordCount || bookmark.textLength || text.split(/\s+/).length;
            
            // Sentiment Analysis
            let sentiment = 'neutral';
            let sentimentConfidence = 0.5;
            
            const positiveWords = ['great', 'amazing', 'awesome', 'excellent', 'good', 'love', 'like', 'happy', 'success', 'win', 'profit', 'growth', 'innovation', 'breakthrough'];
            const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'fail', 'loss', 'problem', 'issue', 'bug', 'crash', 'error', 'disaster'];
            
            const positiveCount = positiveWords.filter(word => text.includes(word)).length;
            const negativeCount = negativeWords.filter(word => text.includes(word)).length;
            
            if (positiveCount > negativeCount) {
                sentiment = 'positive';
                sentimentConfidence = Math.min(0.5 + (positiveCount * 0.1), 0.9);
            } else if (negativeCount > positiveCount) {
                sentiment = 'negative';
                sentimentConfidence = Math.min(0.5 + (negativeCount * 0.1), 0.9);
            }
            
            // Topic Detection
            const topics = [];
            if (text.includes('ai') || text.includes('machine learning') || text.includes('ml')) topics.push('AI/ML');
            if (text.includes('startup') || text.includes('business') || text.includes('entrepreneur')) topics.push('Business');
            if (text.includes('crypto') || text.includes('blockchain') || text.includes('bitcoin')) topics.push('Crypto');
            if (text.includes('tech') || text.includes('technology') || text.includes('software')) topics.push('Technology');
            if (text.includes('marketing') || text.includes('growth') || text.includes('sales')) topics.push('Marketing');
            if (text.includes('product') || text.includes('development') || text.includes('coding')) topics.push('Product');
            if (topics.length === 0) topics.push('General');
            
            // Content Type Detection
            let contentType = 'general';
            if (text.includes('thread') || text.includes('🧵')) contentType = 'thread';
            if (text.includes('idea') || text.includes('concept')) contentType = 'idea';
            if (text.includes('tutorial') || text.includes('guide') || text.includes('how to')) contentType = 'tutorial';
            if (text.includes('news') || text.includes('update') || text.includes('announcement')) contentType = 'news';
            
            // Quality Scoring
            let qualityScore = 0.5;
            if (wordCount > 100) qualityScore += 0.2;
            if (wordCount > 200) qualityScore += 0.1;
            if (bookmark.hasMedia) qualityScore += 0.1;
            if (bookmark.engagementScore > 0.7) qualityScore += 0.1;
            if (topics.length > 1) qualityScore += 0.1;
            
            // Relevance Scoring
            let relevanceScore = 0.5;
            if (topics.includes('AI/ML') || topics.includes('Technology')) relevanceScore += 0.2;
            if (bookmark.engagementScore > 0.5) relevanceScore += 0.2;
            if (contentType === 'idea' || contentType === 'tutorial') relevanceScore += 0.1;
            
            // Actionable Content Detection
            const actionable = text.includes('how to') || text.includes('steps') || text.includes('guide') || 
                              text.includes('tutorial') || text.includes('process') || text.includes('workflow');
            
            // Reference Worthy
            const referenceWorthy = contentType === 'tutorial' || contentType === 'guide' || 
                                   text.includes('research') || text.includes('study') || text.includes('analysis');
            
            return {
                sentiment,
                sentimentConfidence,
                topics,
                contentType,
                qualityScore: Math.min(qualityScore, 1.0),
                relevanceScore: Math.min(relevanceScore, 1.0),
                actionable,
                referenceWorthy,
                engagementPotential: bookmark.engagementScore || 0.5,
                readabilityScore: wordCount > 100 ? 0.8 : wordCount > 50 ? 0.6 : 0.4,
                intent: actionable ? 'actionable' : 'informative',
                viralityPotential: bookmark.engagementScore || 0.5,
                informationType: contentType,
                targetAudience: topics.includes('Business') ? 'entrepreneurs' : 'general',
                keyInsights: this.generateKeyInsights(text, topics[0]),
                discussionWorthy: topics.includes('AI/ML') || topics.includes('Business'),
                compositeScore: (qualityScore + relevanceScore) / 2,
                contentValue: actionable ? 0.8 : referenceWorthy ? 0.7 : 0.5,
                learningValue: referenceWorthy ? 0.8 : actionable ? 0.7 : 0.5,
                knowledgeCategory: topics[0] || 'general',
                bookmarkContext: `Bookmark from ${bookmark.author || 'unknown'} with ${contentType} content`,
                extractionConfidence: 0.9,
                threadTheme: bookmark.isThread ? 'thread_content' : null,
                threadCoherence: bookmark.isThread ? 0.7 : null,
                threadCompleteness: bookmark.isThread ? 0.6 : null,
                contextImportance: bookmark.threadContextImportance || 0.5,
                threadSummary: bookmark.isThread ? 'Part of a conversation thread' : null,
                keyThreadInsights: bookmark.isThread ? ['Thread context available'] : null,
                threadAnalysisMetadata: bookmark.isThread ? { threadLength: bookmark.threadLength || 1 } : null,
                recommendedReadingOrder: bookmark.isThread ? true : false
            };
        } catch (error) {
            this.log(`Error in rule-based analysis: ${error.message}`, 'ERROR');
            return this.generateFallbackAnalysis(bookmark);
        }
    }

    generateKeyInsights(text, topic) {
        try {
            const insights = [];
            const words = text.toLowerCase().split(/\s+/);
            
            if (topic === 'AI/ML') {
                if (words.includes('ai') || words.includes('machine') || words.includes('learning')) {
                    insights.push('AI/ML technology discussion');
                }
                if (words.includes('startup') || words.includes('business')) {
                    insights.push('AI business application');
                }
            }
            
            if (topic === 'Business') {
                if (words.includes('startup') || words.includes('entrepreneur')) {
                    insights.push('Startup insights');
                }
                if (words.includes('growth') || words.includes('marketing')) {
                    insights.push('Business growth strategy');
                }
            }
            
            if (topic === 'Crypto') {
                insights.push('Cryptocurrency discussion');
                if (words.includes('bitcoin') || words.includes('ethereum')) {
                    insights.push('Major cryptocurrency mention');
                }
            }
            
            if (insights.length === 0) {
                insights.push('General content insights');
            }
            
            return insights;
        } catch (error) {
            return ['Content analysis available'];
        }
    }

    generateFallbackAnalysis(bookmark) {
        return {
            sentiment: 'neutral',
            sentimentConfidence: 0.5,
            topics: ['General'],
            contentType: 'general',
            qualityScore: 0.5,
            relevanceScore: 0.5,
            actionable: false,
            referenceWorthy: false,
            engagementPotential: 0.5,
            readabilityScore: 0.5,
            intent: 'informative',
            viralityPotential: 0.5,
            informationType: 'general',
            targetAudience: 'general',
            keyInsights: ['Content analysis available'],
            discussionWorthy: false,
            compositeScore: 0.5,
            contentValue: 0.5,
            learningValue: 0.5,
            knowledgeCategory: 'general',
            bookmarkContext: 'Bookmark content',
            extractionConfidence: 0.7,
            threadTheme: null,
            threadCoherence: null,
            threadCompleteness: null,
            contextImportance: 0.5,
            threadSummary: null,
            keyThreadInsights: null,
            threadAnalysisMetadata: null,
            recommendedReadingOrder: false
        };
    }

    async getBookmarksWithoutAnalysis() {
        try {
            this.log('🔍 Finding bookmarks without AI analysis...');
            
            // Get bookmarks that don't have corresponding analysis records
            const { data: bookmarks, error } = await supabase
                .from('twitter_memos')
                .select('id, text, author, created_at, is_bookmark, engagement_score, has_media, text_length, word_count, is_thread, thread_completion_status, thread_detection_confidence, thread_context_importance')
                .eq('is_bookmark', true)
                .order('created_at', { ascending: false });
            
            if (error) {
                throw new Error(`Failed to fetch bookmarks: ${error.message}`);
            }
            
            this.log(`✅ Found ${bookmarks.length} bookmarks`);
            
            // Check which ones already have analysis
            const bookmarksWithoutAnalysis = [];
            
            for (const bookmark of bookmarks) {
                const { data: existingAnalysis, error: checkError } = await supabase
                    .from('tweet_analysis')
                    .select('tweet_id')
                    .eq('tweet_id', bookmark.id)
                    .single();
                
                if (checkError && checkError.code === 'PGRST116') {
                    // No analysis record exists
                    bookmarksWithoutAnalysis.push(bookmark);
                } else if (checkError) {
                    this.log(`⚠️ Error checking analysis for ${bookmark.id}: ${checkError.message}`, 'WARN');
                }
            }
            
            this.log(`📊 Found ${bookmarksWithoutAnalysis.length} bookmarks without AI analysis`);
            this.stats.totalBookmarks = bookmarksWithoutAnalysis.length;
            
            return bookmarksWithoutAnalysis;
            
        } catch (error) {
            this.log(`❌ Failed to get bookmarks: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async generateAnalysisForBookmark(bookmark) {
        try {
            // Generate AI analysis using the rule-based logic
            const analysis = this.performRuleBasedAnalysis(bookmark);
            
            // Prepare data for tweet_analysis table
            const analysisData = {
                tweet_id: bookmark.id,
                engagement_potential: analysis.engagementPotential,
                readability_score: analysis.readabilityScore,
                positive_indicators: null,
                negative_indicators: null,
                tech_indicators: null,
                business_indicators: null,
                topic: analysis.topics[0] || 'general',
                tags: analysis.topics,
                entities: [],
                concepts: [],
                sentiment: analysis.sentiment,
                intent: analysis.intent,
                relevance_score: analysis.relevanceScore,
                virality_potential: analysis.viralityPotential,
                actionable: analysis.actionable,
                categories: analysis.topics,
                quality_score: analysis.qualityScore,
                information_type: analysis.informationType,
                target_audience: analysis.targetAudience,
                key_insights: analysis.keyInsights,
                discussion_worthy: analysis.discussionWorthy,
                composite_score: analysis.compositeScore,
                engagement_prediction: null,
                content_value: analysis.contentValue,
                reference_worthy: analysis.referenceWorthy,
                bookmark_specific_analysis: {
                    sentiment_confidence: analysis.sentimentConfidence,
                    content_type: analysis.contentType,
                    actionable_content: analysis.actionable,
                    reference_value: analysis.referenceWorthy
                },
                learning_value: analysis.learningValue,
                knowledge_category: analysis.knowledgeCategory,
                bookmark_context: analysis.bookmarkContext,
                extraction_confidence: analysis.extractionConfidence,
                thread_theme: analysis.threadTheme,
                thread_coherence: analysis.threadCoherence,
                thread_completeness: analysis.threadCompleteness,
                context_importance: analysis.contextImportance,
                thread_summary: analysis.threadSummary,
                key_thread_insights: analysis.keyThreadInsights,
                recommended_reading_order: analysis.recommendedReadingOrder,
                thread_analysis_metadata: analysis.threadAnalysisMetadata
            };
            
            return analysisData;
            
        } catch (error) {
            this.log(`❌ Failed to generate analysis for bookmark ${bookmark.id}: ${error.message}`, 'ERROR');
            return null;
        }
    }

    async insertAnalysisRecord(analysisData) {
        try {
            const { error } = await supabase
                .from('tweet_analysis')
                .insert(analysisData);
            
            if (error) {
                throw new Error(`Insert failed: ${error.message}`);
            }
            
            this.stats.newAnalysisRecords++;
            this.log(`✅ Inserted analysis for tweet: ${analysisData.tweet_id}`);
            return true;
            
        } catch (error) {
            this.log(`❌ Failed to insert analysis: ${error.message}`, 'ERROR');
            this.stats.errors++;
            return false;
        }
    }

    async processBookmarks(bookmarks) {
        try {
            this.log(`🔄 Processing ${bookmarks.length} bookmarks for AI analysis...`);
            
            const batchSize = 10;
            const batches = [];
            
            for (let i = 0; i < bookmarks.length; i += batchSize) {
                batches.push(bookmarks.slice(i, i + batchSize));
            }
            
            this.log(`📦 Processing in ${batches.length} batches of ${batchSize}`);
            
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                this.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} bookmarks)`);
                
                for (const bookmark of batch) {
                    try {
                        const analysisData = await this.generateAnalysisForBookmark(bookmark);
                        
                        if (analysisData) {
                            const success = await this.insertAnalysisRecord(analysisData);
                            if (success) {
                                this.stats.processedCount++;
                            }
                        }
                        
                    } catch (error) {
                        this.log(`❌ Failed to process bookmark ${bookmark.id}: ${error.message}`, 'ERROR');
                        this.stats.errors++;
                    }
                }
                
                // Small delay between batches
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            this.log(`✅ Processing complete: ${this.stats.processedCount} processed, ${this.stats.errors} errors`);
            
        } catch (error) {
            this.log(`❌ Processing failed: ${error.message}`, 'ERROR');
        }
    }

    async run() {
        try {
            this.log('🚀 Starting AI analysis generation for existing bookmarks...');
            this.log(`🔗 Supabase URL: ${supabaseUrl}`);
            
            // Step 1: Get bookmarks without analysis
            const bookmarks = await this.getBookmarksWithoutAnalysis();
            
            if (bookmarks.length === 0) {
                this.log('✅ All bookmarks already have AI analysis');
                return;
            }
            
            // Step 2: Process bookmarks to generate analysis
            await this.processBookmarks(bookmarks);
            
            // Step 3: Display summary
            this.displaySummary();
            
        } catch (error) {
            this.log(`❌ AI analysis generation failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    displaySummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 AI ANALYSIS GENERATION SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`\n🔗 Database: ${supabaseUrl}`);
        console.log(`📅 Completion Time: ${new Date().toISOString()}`);
        console.log(`⏱️ Execution Time: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
        
        console.log('\n📊 PROCESSING RESULTS');
        console.log('-'.repeat(30));
        console.log(`Total Bookmarks: ${this.stats.totalBookmarks}`);
        console.log(`Successfully Processed: ${this.stats.processedCount}`);
        console.log(`New Analysis Records: ${this.stats.newAnalysisRecords}`);
        console.log(`Errors: ${this.stats.errors}`);
        
        if (this.stats.errors > 0) {
            console.log('\n⚠️ Some bookmarks failed to process. Check logs for details.');
        }
        
        console.log('\n🎉 AI analysis generation completed!');
        console.log(`🌐 Your bookmarks now have comprehensive AI analysis in Supabase`);
        
        console.log('\n' + '='.repeat(60));
    }
}

// Main execution
async function main() {
    const generator = new MissingAIAnalysisGenerator();
    
    try {
        console.log('\n🚀 Starting Missing AI Analysis Generation');
        console.log('==========================================');
        console.log(`Target: Generate AI analysis for existing bookmarks`);
        console.log(`Supabase: ${supabaseUrl}`);
        console.log('==========================================\n');
        
        await generator.run();
        
    } catch (error) {
        console.error('\n❌ AI ANALYSIS GENERATION FAILED');
        console.error('==================================');
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default MissingAIAnalysisGenerator;
