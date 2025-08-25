#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

class BookmarkProcessor {
    constructor() {
        this.startTime = Date.now();
        this.sessionId = Date.now().toString();
        this.logs = [];
    }
    
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
    }
    
    async loadBookmarks() {
        try {
            // Find the most recent bookmarks data file
            const files = fs.readdirSync('.').filter(file => 
                file.startsWith('bookmarks-data-') && file.endsWith('.json')
            );
            
            if (files.length === 0) {
                throw new Error('No bookmarks data files found');
            }
            
            // Sort by creation time and get the most recent
            const mostRecentFile = files.sort().pop();
            this.log(`📄 Loading bookmarks from: ${mostRecentFile}`);
            
            const bookmarksData = fs.readFileSync(mostRecentFile, 'utf8');
            const data = JSON.parse(bookmarksData);
            
            // Handle both old and new file formats
            let bookmarks;
            if (data.bookmarks && Array.isArray(data.bookmarks)) {
                bookmarks = data.bookmarks;
                this.log(`📖 Loaded ${bookmarks.length} bookmarks from file (new format)`);
            } else if (Array.isArray(data)) {
                bookmarks = data;
                this.log(`📖 Loaded ${bookmarks.length} bookmarks from file (old format)`);
            } else {
                throw new Error('Invalid bookmarks file format');
            }
            
            return bookmarks;
            
        } catch (error) {
            this.log(`❌ Failed to load bookmarks: ${error.message}`, 'ERROR');
            return [];
        }
    }
    
    async processBookmarks(bookmarks) {
        this.log('🔧 Processing bookmarks with advanced analytics and thread detection...');
        
        // First pass: detect threads and group related bookmarks
        const threadGroups = this.detectThreads(bookmarks);
        
        // Second pass: process each bookmark with thread awareness and AI analysis
        const processedBookmarks = [];
        
        for (let i = 0; i < bookmarks.length; i++) {
            const bookmark = bookmarks[i];
            const threadInfo = this.getThreadInfo(bookmark, threadGroups);
            
            this.log(`🤖 Processing bookmark ${i + 1}/${bookmarks.length} with AI analysis...`);
            
            // Perform AI analysis
            const aiAnalysis = await this.analyzeWithAI(bookmark);
            
            const processedBookmark = {
                ...bookmark,
                processedAt: new Date().toISOString(),
                processingId: `proc_${Date.now()}_${i}`,
                // Calculate engagement score
                engagementScore: this.calculateEngagementScore(bookmark),
                // Detect content type
                contentType: this.detectContentType(bookmark.text),
                // Extract hashtags
                hashtags: this.extractHashtags(bookmark.text),
                // Extract mentions
                mentions: this.extractMentions(bookmark.text),
                // Sentiment analysis (basic)
                sentiment: this.analyzeSentiment(bookmark.text),
                // Language detection
                language: this.detectLanguage(bookmark.text),
                // Topic categorization
                topics: this.categorizeTopics(bookmark.text),
                // Priority score
                priorityScore: this.calculatePriorityScore(bookmark),
                // Thread processing enhancements
                threadInfo: threadInfo,
                isThreadStart: threadInfo.isThreadStart,
                isThreadPart: threadInfo.isThreadPart,
                threadLength: threadInfo.threadLength,
                threadPosition: threadInfo.threadPosition,
                threadContext: threadInfo.threadContext,
                threadEngagement: threadInfo.threadEngagement,
                threadComplexity: threadInfo.threadComplexity,
                // AI Analysis enhancements
                aiAnalysis: aiAnalysis,
                contentHash: this.generateContentHash(bookmark.text, bookmark.author, bookmark.url),
                // Enhanced metrics
                relevanceScore: aiAnalysis.relevance_score,
                qualityScore: aiAnalysis.quality_score,
                engagementPotential: aiAnalysis.engagement_potential,
                learningValue: aiAnalysis.learning_value,
                knowledgeCategory: aiAnalysis.knowledge_category,
                keyInsights: aiAnalysis.key_insights,
                targetAudience: aiAnalysis.target_audience,
                informationType: aiAnalysis.information_type,
                contentValue: aiAnalysis.content_value,
                bookmarkContext: aiAnalysis.bookmark_context,
                readabilityScore: aiAnalysis.readability_score,
                extractionConfidence: aiAnalysis.extraction_confidence,
                actionable: aiAnalysis.actionable,
                discussionWorthy: aiAnalysis.discussion_worthy,
                referenceWorthy: aiAnalysis.reference_worthy
            };
            
            processedBookmarks.push(processedBookmark);
            
            // Small delay to prevent overwhelming
            if (i < bookmarks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        this.log(`✅ Processed ${processedBookmarks.length} bookmarks with thread detection`);
        this.log(`🧵 Detected ${threadGroups.length} thread groups`);
        
        return processedBookmarks;
    }
    
    calculateEngagementScore(bookmark) {
        try {
            let score = 0.5;
            const likes = parseInt(bookmark.likeCount) || 0;
            const retweets = parseInt(bookmark.retweetCount) || 0;
            const replies = parseInt(bookmark.replyCount) || 0;
            
            if (likes > 1000) score += 0.3;
            else if (likes > 100) score += 0.2;
            else if (likes > 10) score += 0.1;
            
            if (retweets > 100) score += 0.2;
            else if (retweets > 10) score += 0.1;
            
            if (replies > 50) score += 0.2;
            else if (replies > 10) score += 0.1;
            
            if (bookmark.hasMedia) score += 0.1;
            
            return Math.min(score, 1.0);
        } catch (error) {
            return 0.5;
        }
    }
    
    detectContentType(text) {
        try {
            const lowerText = text.toLowerCase();
            
            if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) return 'AI/ML';
            if (lowerText.includes('programming') || lowerText.includes('code') || lowerText.includes('developer')) return 'Programming';
            if (lowerText.includes('business') || lowerText.includes('startup') || lowerText.includes('entrepreneur')) return 'Business';
            if (lowerText.includes('science') || lowerText.includes('research') || lowerText.includes('study')) return 'Science';
            if (lowerText.includes('technology') || lowerText.includes('tech') || lowerText.includes('innovation')) return 'Technology';
            if (lowerText.includes('finance') || lowerText.includes('crypto') || lowerText.includes('investment')) return 'Finance';
            
            return 'General';
        } catch (error) {
            return 'General';
        }
    }
    
    extractHashtags(text) {
        try {
            const hashtagRegex = /#\w+/g;
            return text.match(hashtagRegex) || [];
        } catch (error) {
            return [];
        }
    }
    
    extractMentions(text) {
        try {
            const mentionRegex = /@\w+/g;
            return text.match(mentionRegex) || [];
        } catch (error) {
            return [];
        }
    }
    
    analyzeSentiment(text) {
        try {
            const positiveWords = ['great', 'amazing', 'awesome', 'excellent', 'good', 'love', 'like', 'best', 'top', 'win', 'success', 'amazing', 'incredible'];
            const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'dislike', 'fail', 'lose', 'problem', 'issue', 'difficult', 'challenge', 'hard'];
            
            const lowerText = text.toLowerCase();
            let positiveCount = 0;
            let negativeCount = 0;
            
            positiveWords.forEach(word => {
                if (lowerText.includes(word)) positiveCount++;
            });
            
            negativeWords.forEach(word => {
                if (lowerText.includes(word)) negativeCount++;
            });
            
            if (positiveCount > negativeCount) return 'positive';
            if (negativeCount > positiveCount) return 'negative';
            return 'neutral';
        } catch (error) {
            return 'neutral';
        }
    }
    
    detectLanguage(text) {
        try {
            // Simple language detection based on common words
            const englishWords = ['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'from', 'they', 'are', 'you', 'not', 'but', 'his', 'had', 'by', 'word', 'their', 'time', 'if', 'way', 'about', 'many', 'then', 'them', 'would', 'write', 'like', 'so', 'these', 'her', 'long', 'make', 'thing', 'see', 'him', 'two', 'has', 'look', 'more', 'day', 'could', 'go', 'come', 'did', 'my', 'sound', 'no', 'most', 'number', 'who', 'over', 'know', 'water', 'than', 'call', 'first', 'people', 'may', 'down', 'side', 'been', 'now', 'find'];
            const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'como', 'más', 'pero', 'sus', 'me', 'hasta', 'hay', 'donde', 'han', 'quien', 'están', 'estado', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'];
            
            const lowerText = text.toLowerCase();
            let englishScore = 0;
            let spanishScore = 0;
            
            englishWords.forEach(word => {
                if (lowerText.includes(word)) englishScore++;
            });
            
            spanishWords.forEach(word => {
                if (lowerText.includes(word)) spanishScore++;
            });
            
            if (englishScore > spanishScore) return 'en';
            if (spanishScore > englishScore) return 'es';
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }
    
    categorizeTopics(text) {
        try {
            const lowerText = text.toLowerCase();
            const topics = [];
            
            if (lowerText.includes('ai') || lowerText.includes('artificial intelligence')) topics.push('AI');
            if (lowerText.includes('machine learning') || lowerText.includes('ml')) topics.push('Machine Learning');
            if (lowerText.includes('programming') || lowerText.includes('coding')) topics.push('Programming');
            if (lowerText.includes('startup') || lowerText.includes('business')) topics.push('Business');
            if (lowerText.includes('crypto') || lowerText.includes('blockchain')) topics.push('Cryptocurrency');
            if (lowerText.includes('science') || lowerText.includes('research')) topics.push('Science');
            if (lowerText.includes('technology') || lowerText.includes('tech')) topics.push('Technology');
            if (lowerText.includes('finance') || lowerText.includes('investment')) topics.push('Finance');
            if (lowerText.includes('data') || lowerText.includes('analytics')) topics.push('Data Analytics');
            if (lowerText.includes('cloud') || lowerText.includes('aws') || lowerText.includes('azure')) topics.push('Cloud Computing');
            
            return topics;
        } catch (error) {
            return [];
        }
    }
    
    calculatePriorityScore(bookmark) {
        try {
            let score = 0;
            
            // Engagement-based priority
            const likes = parseInt(bookmark.likeCount) || 0;
            if (likes > 1000) score += 30;
            else if (likes > 100) score += 20;
            else if (likes > 10) score += 10;
            
            // Recency-based priority
            const tweetDate = new Date(bookmark.timestamp);
            const now = new Date();
            const daysDiff = (now - tweetDate) / (1000 * 60 * 60 * 24);
            
            if (daysDiff < 1) score += 25; // Today
            else if (daysDiff < 7) score += 20; // This week
            else if (daysDiff < 30) score += 15; // This month
            else if (daysDiff < 90) score += 10; // Last 3 months
            
            // Content-based priority
            if (bookmark.text.includes('AI') || bookmark.text.includes('artificial intelligence')) score += 15;
            if (bookmark.text.includes('programming') || bookmark.text.includes('code')) score += 10;
            if (bookmark.text.includes('startup') || bookmark.text.includes('business')) score += 10;
            
            return Math.min(score, 100);
        } catch (error) {
            return 0;
        }
    }
    
    createSummary(processedBookmarks) {
        this.log('📊 Creating comprehensive summary...');
        
        // Group by content type
        const grouped = {};
        processedBookmarks.forEach(bookmark => {
            const contentType = bookmark.contentType;
            if (!grouped[contentType]) {
                grouped[contentType] = [];
            }
            grouped[contentType].push(bookmark);
        });
        
        // Create summary statistics
        const summary = {
            totalBookmarks: processedBookmarks.length,
            processingTimestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            byContentType: Object.keys(grouped).map(type => ({
                type: type,
                count: grouped[type].length,
                percentage: Math.round((grouped[type].length / processedBookmarks.length) * 100)
            })),
            byPriority: {
                high: processedBookmarks.filter(b => b.priorityScore >= 70).length,
                medium: processedBookmarks.filter(b => b.priorityScore >= 40 && b.priorityScore < 70).length,
                low: processedBookmarks.filter(b => b.priorityScore < 40).length
            },
            bySentiment: {
                positive: processedBookmarks.filter(b => b.sentiment === 'positive').length,
                neutral: processedBookmarks.filter(b => b.sentiment === 'neutral').length,
                negative: processedBookmarks.filter(b => b.sentiment === 'negative').length
            },
            byLanguage: {
                english: processedBookmarks.filter(b => b.language === 'en').length,
                spanish: processedBookmarks.filter(b => b.language === 'es').length,
                unknown: processedBookmarks.filter(b => b.language === 'unknown').length
            },
            // Enhanced Thread Statistics
            byThreadInfo: {
                standalone: processedBookmarks.filter(b => !b.isThreadPart).length,
                threadParts: processedBookmarks.filter(b => b.isThreadPart).length,
                threadStarts: processedBookmarks.filter(b => b.isThreadStart).length,
                byThreadLength: {
                    '2-3 tweets': processedBookmarks.filter(b => b.threadLength >= 2 && b.threadLength <= 3).length,
                    '4-5 tweets': processedBookmarks.filter(b => b.threadLength >= 4 && b.threadLength <= 5).length,
                    '6-10 tweets': processedBookmarks.filter(b => b.threadLength >= 6 && b.threadLength <= 10).length,
                    '10+ tweets': processedBookmarks.filter(b => b.threadLength > 10).length
                },
                byThreadComplexity: {
                    low: processedBookmarks.filter(b => b.threadComplexity === 'low').length,
                    medium: processedBookmarks.filter(b => b.threadComplexity === 'medium').length,
                    high: processedBookmarks.filter(b => b.threadComplexity === 'high').length,
                    'very-high': processedBookmarks.filter(b => b.threadComplexity === 'very-high').length
                }
            },
            // AI Analysis Statistics
            byAI: {
                byKnowledgeCategory: Object.entries(
                    processedBookmarks.reduce((acc, b) => {
                        const category = b.knowledgeCategory || 'General';
                        acc[category] = (acc[category] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([category, count]) => ({ category, count })),
                byContentValue: {
                    high: processedBookmarks.filter(b => b.contentValue === 'high').length,
                    medium: processedBookmarks.filter(b => b.contentValue === 'medium').length,
                    low: processedBookmarks.filter(b => b.contentValue === 'low').length
                },
                byTargetAudience: Object.entries(
                    processedBookmarks.reduce((acc, b) => {
                        const audience = b.targetAudience || 'general';
                        acc[audience] = (acc[audience] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([audience, count]) => ({ audience, count })),
                actionable: processedBookmarks.filter(b => b.actionable).length,
                discussionWorthy: processedBookmarks.filter(b => b.discussionWorthy).length,
                referenceWorthy: processedBookmarks.filter(b => b.referenceWorthy).length,
                averageRelevanceScore: parseFloat((processedBookmarks.reduce((sum, b) => sum + (b.relevanceScore || 0.5), 0) / processedBookmarks.length).toFixed(2)),
                averageQualityScore: parseFloat((processedBookmarks.reduce((sum, b) => sum + (b.qualityScore || 0.5), 0) / processedBookmarks.length).toFixed(2)),
                averageLearningValue: parseFloat((processedBookmarks.reduce((sum, b) => sum + (b.learningValue || 0.5), 0) / processedBookmarks.length).toFixed(2))
            },
            topHashtags: this.getTopHashtags(processedBookmarks),
            topMentions: this.getTopMentions(processedBookmarks),
            topEngaged: processedBookmarks
                .sort((a, b) => b.engagementScore - a.engagementScore)
                .slice(0, 10)
                .map(b => ({
                    id: b.id,
                    text: b.text.substring(0, 100) + '...',
                    author: b.authorHandle || b.author,
                    engagementScore: b.engagementScore,
                    url: b.url
                })),
            topPriority: processedBookmarks
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .slice(0, 10)
                .map(b => ({
                    id: b.id,
                    text: b.text.substring(0, 100) + '...',
                    author: b.authorHandle || b.author,
                    priorityScore: b.priorityScore,
                    url: b.url
                })),
            // Thread-specific top lists
            topThreads: processedBookmarks
                .filter(b => b.isThreadStart && b.threadLength > 1)
                .sort((a, b) => b.threadLength - a.threadLength)
                .slice(0, 10)
                .map(b => ({
                    id: b.id,
                    text: b.text.substring(0, 100) + '...',
                    author: b.authorHandle || b.author,
                    threadLength: b.threadLength,
                    threadEngagement: b.threadEngagement,
                    url: b.url
                }))
        };
        
        return summary;
    }
    
    getTopHashtags(bookmarks) {
        try {
            const hashtagCounts = {};
            bookmarks.forEach(bookmark => {
                bookmark.hashtags.forEach(hashtag => {
                    hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
                });
            });
            
            return Object.entries(hashtagCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([hashtag, count]) => ({ hashtag, count }));
        } catch (error) {
            return [];
        }
    }
    
    getTopMentions(bookmarks) {
        try {
            const mentionCounts = {};
            bookmarks.forEach(bookmark => {
                bookmark.mentions.forEach(mention => {
                    mentionCounts[mention] = (mentionCounts[mention] || 0) + 1;
                });
            });
            
            return Object.entries(mentionCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([mention, count]) => ({ mention, count }));
        } catch (error) {
            return [];
        }
    }
    
    // Enhanced Thread Detection Methods
    detectThreads(bookmarks) {
        this.log('🧵 Detecting threads and conversation patterns...');
        
        const threadGroups = [];
        const processedIds = new Set();
        
        bookmarks.forEach(bookmark => {
            if (processedIds.has(bookmark.id)) return;
            
            const threadGroup = this.findThreadGroup(bookmark, bookmarks);
            if (threadGroup.length > 1) {
                threadGroups.push(threadGroup);
                threadGroup.forEach(t => processedIds.add(t.id));
            }
        });
        
        return threadGroups;
    }
    
    findThreadGroup(bookmark, allBookmarks) {
        const threadGroup = [bookmark];
        const author = bookmark.authorHandle || bookmark.author;
        const timestamp = new Date(bookmark.timestamp);
        
        // Look for related tweets by same author within time window
        allBookmarks.forEach(other => {
            if (other.id === bookmark.id) return;
            
            const otherAuthor = other.authorHandle || other.author;
            const otherTimestamp = new Date(other.timestamp);
            const timeDiff = Math.abs(timestamp - otherTimestamp) / (1000 * 60 * 60); // hours
            
            // Check if same author and within reasonable time window
            if (otherAuthor === author && timeDiff <= 24) {
                // Check for thread indicators in text
                if (this.hasThreadIndicators(other.text)) {
                    threadGroup.push(other);
                }
            }
        });
        
        // Sort by timestamp
        threadGroup.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return threadGroup;
    }
    
    hasThreadIndicators(text) {
        if (!text) return false;
        
        const threadPatterns = [
            /thread/i,
            /🧵/,
            /1\/\d+/,
            /2\/\d+/,
            /3\/\d+/,
            /4\/\d+/,
            /5\/\d+/,
            /6\/\d+/,
            /7\/\d+/,
            /8\/\d+/,
            /9\/\d+/,
            /10\/\d+/,
            /continued/i,
            /more/i,
            /next/i,
            /part\s*\d+/i,
            /follow\s*up/i,
            /update/i
        ];
        
        return threadPatterns.some(pattern => pattern.test(text));
    }
    
    getThreadInfo(bookmark, threadGroups) {
        const threadGroup = threadGroups.find(group => 
            group.some(t => t.id === bookmark.id)
        );
        
        if (!threadGroup) {
            return {
                isThreadStart: false,
                isThreadPart: false,
                threadLength: 1,
                threadPosition: 1,
                threadContext: 'standalone',
                threadEngagement: bookmark.engagementScore || 0.5,
                threadComplexity: 'low'
            };
        }
        
        const position = threadGroup.findIndex(t => t.id === bookmark.id) + 1;
        const isStart = position === 1;
        const totalLength = threadGroup.length;
        
        // Calculate thread-level metrics
        const threadEngagement = threadGroup.reduce((sum, t) => sum + (t.engagementScore || 0.5), 0) / totalLength;
        const threadComplexity = this.calculateThreadComplexity(threadGroup);
        
        return {
            isThreadStart: isStart,
            isThreadPart: true,
            threadLength: totalLength,
            threadPosition: position,
            threadContext: this.getThreadContext(threadGroup),
            threadEngagement: threadEngagement,
            threadComplexity: threadComplexity
        };
    }
    
    calculateThreadComplexity(threadGroup) {
        if (threadGroup.length <= 2) return 'low';
        if (threadGroup.length <= 5) return 'medium';
        if (threadGroup.length <= 10) return 'high';
        return 'very-high';
    }
    
    getThreadContext(threadGroup) {
        const firstTweet = threadGroup[0];
        const lastTweet = threadGroup[threadGroup.length - 1];
        const timeSpan = (new Date(lastTweet.timestamp) - new Date(firstTweet.timestamp)) / (1000 * 60 * 60);
        
        if (timeSpan <= 1) return 'rapid-fire';
        if (timeSpan <= 6) return 'same-session';
        if (timeSpan <= 24) return 'same-day';
        return 'extended';
    }
    
    // AI Analysis Methods
    async analyzeWithAI(bookmark) {
        try {
            // Create comprehensive analysis prompt
            const prompt = `Analyze this Twitter bookmark for a knowledge management system:

Text: "${bookmark.text}"
Author: ${bookmark.author || 'Unknown'}
Author Handle: ${bookmark.authorHandle || 'Unknown'}
Timestamp: ${bookmark.timestamp}
URL: ${bookmark.url || 'N/A'}

Provide a JSON response with:
{
  "sentiment": "positive/neutral/negative",
  "topic": "main topic (1-2 words)",
  "categories": ["category1", "category2"],
  "tags": ["tag1", "tag2", "tag3"],
  "entities": ["entity1", "entity2"],
  "concepts": ["concept1", "concept2"],
  "intent": "informative/promotional/discussion/question/opinion",
  "relevance_score": 0.0-1.0,
  "quality_score": 0.0-1.0,
  "engagement_potential": 0.0-1.0,
  "virality_potential": 0.0-1.0,
  "actionable": true/false,
  "discussion_worthy": true/false,
  "reference_worthy": true/false,
  "learning_value": 0.0-1.0,
  "knowledge_category": "Technology/Business/Science/Personal/Other",
  "key_insights": ["insight1", "insight2"],
  "target_audience": "general/technical/business/academic",
  "information_type": "fact/opinion/tutorial/news/analysis",
  "content_value": "high/medium/low",
  "bookmark_context": "Why this was bookmarked",
  "readability_score": 0.0-1.0,
  "extraction_confidence": 0.0-1.0
}`;

            // For now, use rule-based analysis (can be enhanced with actual AI API calls later)
            const analysis = this.performRuleBasedAnalysis(bookmark);
            
            return analysis;
            
        } catch (error) {
            this.log(`❌ AI analysis failed for bookmark: ${error.message}`, 'ERROR');
            return this.generateFallbackAnalysis(bookmark);
        }
    }
    
    performRuleBasedAnalysis(bookmark) {
        const text = bookmark.text || '';
        const wordCount = text.split(/\s+/).length;
        const hasQuestion = text.includes('?');
        const hasURL = text.includes('http');
        const hasAI = /ai|artificial intelligence|machine learning|ml/i.test(text);
        const hasProgramming = /programming|code|coding|developer|software/i.test(text);
        const hasBusiness = /business|startup|entrepreneur|company|market/i.test(text);
        
        // Sentiment analysis based on keywords
        const positiveWords = ['great', 'amazing', 'awesome', 'excellent', 'good', 'love', 'like', 'best', 'top', 'win', 'success', 'incredible'];
        const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'dislike', 'fail', 'lose', 'problem', 'issue', 'difficult', 'challenge'];
        
        const positiveCount = positiveWords.filter(word => text.toLowerCase().includes(word)).length;
        const negativeCount = negativeWords.filter(word => text.toLowerCase().includes(word)).length;
        
        let sentiment = 'neutral';
        if (positiveCount > negativeCount) sentiment = 'positive';
        else if (negativeCount > positiveCount) sentiment = 'negative';
        
        // Topic detection
        let topic = 'general';
        if (hasAI) topic = 'AI/ML';
        else if (hasProgramming) topic = 'Programming';
        else if (hasBusiness) topic = 'Business';
        
        // Categories
        const categories = [];
        if (hasAI) categories.push('AI/ML', 'Technology');
        if (hasProgramming) categories.push('Programming', 'Technology');
        if (hasBusiness) categories.push('Business', 'Entrepreneurship');
        if (hasQuestion) categories.push('Discussion');
        if (hasURL) categories.push('Reference');
        
        // Quality and relevance scoring
        const qualityScore = Math.min(wordCount / 50, 1.0);
        const relevanceScore = hasAI || hasProgramming || hasBusiness ? 0.8 : 0.5;
        const engagementPotential = (positiveCount + negativeCount) > 0 ? 0.7 : 0.5;
        
        return {
            sentiment: sentiment,
            topic: topic,
            categories: categories.length > 0 ? categories : ['General'],
            tags: this.extractHashtags(text).map(tag => tag.substring(1)),
            entities: this.extractMentions(text).map(mention => mention.substring(1)),
            concepts: this.categorizeTopics(text),
            intent: hasQuestion ? 'question' : 'informative',
            relevance_score: relevanceScore,
            quality_score: qualityScore,
            engagement_potential: engagementPotential,
            virality_potential: 0.5,
            actionable: hasURL || hasProgramming,
            discussion_worthy: hasQuestion || (positiveCount + negativeCount) > 0,
            reference_worthy: wordCount > 50 || hasURL,
            learning_value: hasAI || hasProgramming ? 0.8 : 0.5,
            knowledge_category: hasAI ? 'Technology' : hasProgramming ? 'Technology' : hasBusiness ? 'Business' : 'General',
            key_insights: this.generateKeyInsights(text, topic),
            target_audience: hasProgramming ? 'technical' : hasBusiness ? 'business' : 'general',
            information_type: hasQuestion ? 'question' : 'informative',
            content_value: qualityScore > 0.7 ? 'high' : qualityScore > 0.4 ? 'medium' : 'low',
            bookmark_context: this.generateBookmarkContext(text, topic),
            readability_score: Math.max(0.3, Math.min(1.0, 1.0 - (wordCount / 200))),
            extraction_confidence: 0.8
        };
    }
    
    generateKeyInsights(text, topic) {
        const insights = [];
        
        if (topic === 'AI/ML') {
            if (text.includes('future')) insights.push('AI future implications');
            if (text.includes('impact')) insights.push('AI impact analysis');
            if (text.includes('trend')) insights.push('AI trend identification');
        }
        
        if (topic === 'Programming') {
            if (text.includes('best practice')) insights.push('Programming best practices');
            if (text.includes('tip')) insights.push('Programming tips');
            if (text.includes('tutorial')) insights.push('Programming tutorial');
        }
        
        if (topic === 'Business') {
            if (text.includes('strategy')) insights.push('Business strategy');
            if (text.includes('growth')) insights.push('Business growth');
            if (text.includes('market')) insights.push('Market analysis');
        }
        
        return insights.length > 0 ? insights : ['Content analysis required'];
    }
    
    generateBookmarkContext(text, topic) {
        if (topic === 'AI/ML') return 'AI/ML knowledge and insights';
        if (topic === 'Programming') return 'Programming knowledge and techniques';
        if (topic === 'Business') return 'Business insights and strategies';
        return 'General knowledge and information';
    }
    
    generateFallbackAnalysis(bookmark) {
        return {
            sentiment: 'neutral',
            topic: 'general',
            categories: ['uncategorized'],
            tags: ['bookmark'],
            entities: [],
            concepts: [],
            intent: 'informative',
            relevance_score: 0.5,
            quality_score: 0.5,
            engagement_potential: 0.5,
            virality_potential: 0.3,
            actionable: false,
            discussion_worthy: false,
            reference_worthy: false,
            learning_value: 0.5,
            knowledge_category: 'General',
            key_insights: ['Content requires manual review'],
            target_audience: 'general',
            information_type: 'content',
            content_value: 'medium',
            bookmark_context: 'Automatically bookmarked',
            readability_score: 0.7,
            extraction_confidence: 0.6
        };
    }
    
    // Generate content hash for deduplication
    generateContentHash(text, author, url) {
        const content = `${text}|${author}|${url}`;
        return crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
    }
    
    exportToCSV(processedBookmarks, csvFile) {
        this.log('📊 Creating CSV export...');
        
        const headers = [
            'ID', 'Text', 'Author', 'Author Handle', 'Timestamp', 'URL',
            'Like Count', 'Retweet Count', 'Reply Count', 'Has Media',
            'Content Type', 'Engagement Score', 'Priority Score',
            'Sentiment', 'Language', 'Topics', 'Hashtags', 'Mentions',
            'Thread Start', 'Thread Part', 'Thread Length', 'Thread Position',
            'Thread Context', 'Thread Engagement', 'Thread Complexity',
            'Content Hash', 'Relevance Score', 'Quality Score', 'Engagement Potential',
            'Learning Value', 'Knowledge Category', 'Key Insights', 'Target Audience',
            'Information Type', 'Content Value', 'Bookmark Context', 'Readability Score',
            'Extraction Confidence', 'Actionable', 'Discussion Worthy', 'Reference Worthy',
            'Processed At'
        ];
        
        const csvRows = [headers.join(',')];
        
        processedBookmarks.forEach(bookmark => {
            const row = [
                bookmark.id,
                `"${(bookmark.text || '').replace(/"/g, '""')}"`,
                `"${(bookmark.author || '').replace(/"/g, '""')}"`,
                `"${(bookmark.authorHandle || '').replace(/"/g, '""')}"`,
                bookmark.timestamp,
                bookmark.url,
                bookmark.likeCount || '0',
                bookmark.retweetCount || '0',
                bookmark.replyCount || '0',
                bookmark.hasMedia ? 'Yes' : 'No',
                bookmark.contentType,
                bookmark.engagementScore,
                bookmark.priorityScore,
                bookmark.sentiment,
                bookmark.language,
                `"${(bookmark.topics || []).join('; ')}"`,
                `"${(bookmark.hashtags || []).join('; ')}"`,
                `"${(bookmark.mentions || []).join('; ')}"`,
                bookmark.isThreadStart ? 'Yes' : 'No',
                bookmark.isThreadPart ? 'Yes' : 'No',
                bookmark.threadLength || '1',
                bookmark.threadPosition || '1',
                bookmark.threadContext || 'standalone',
                bookmark.threadEngagement || '0.5',
                bookmark.threadComplexity || 'low',
                bookmark.contentHash || '',
                bookmark.relevanceScore || '0.5',
                bookmark.qualityScore || '0.5',
                bookmark.engagementPotential || '0.5',
                bookmark.learningValue || '0.5',
                bookmark.knowledgeCategory || 'General',
                `"${(bookmark.keyInsights || []).join('; ')}"`,
                bookmark.targetAudience || 'general',
                bookmark.informationType || 'content',
                bookmark.contentValue || 'medium',
                bookmark.bookmarkContext || 'Automatically bookmarked',
                bookmark.readabilityScore || '0.7',
                bookmark.extractionConfidence || '0.8',
                bookmark.actionable ? 'Yes' : 'No',
                bookmark.discussionWorthy ? 'Yes' : 'No',
                bookmark.referenceWorthy ? 'Yes' : 'No',
                bookmark.processedAt
            ];
            csvRows.push(row.join(','));
        });
        
        fs.writeFileSync(csvFile, csvRows.join('\n'));
        this.log(`✅ CSV export saved to: ${csvFile}`);
    }
    
    async saveProcessedData(processedBookmarks, summary) {
        try {
            this.log('💾 Saving processed data...');
            
            // Create output directory
            const outputDir = `processed-bookmarks-${this.sessionId}`;
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }
            
            // Save all processed bookmarks
            const allBookmarksFile = path.join(outputDir, 'all-processed-bookmarks.json');
            fs.writeFileSync(allBookmarksFile, JSON.stringify(processedBookmarks, null, 2));
            this.log(`✅ All processed bookmarks saved to: ${allBookmarksFile}`);
            
            // Save summary
            const summaryFile = path.join(outputDir, 'processing-summary.json');
            fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
            this.log(`✅ Summary saved to: ${summaryFile}`);
            
            // Save filtered data
            const highPriority = processedBookmarks.filter(b => b.priorityScore >= 70);
            const aiContent = processedBookmarks.filter(b => b.contentType === 'AI/ML');
            const highEngagement = processedBookmarks.filter(b => b.engagementScore >= 0.8);
            
            if (highPriority.length > 0) {
                const highPriorityFile = path.join(outputDir, 'high-priority-bookmarks.json');
                fs.writeFileSync(highPriorityFile, JSON.stringify(highPriority, null, 2));
                this.log(`✅ High priority bookmarks (${highPriority.length}) saved to: ${highPriorityFile}`);
            }
            
            if (aiContent.length > 0) {
                const aiContentFile = path.join(outputDir, 'ai-content-bookmarks.json');
                fs.writeFileSync(aiContentFile, JSON.stringify(aiContent, null, 2));
                this.log(`✅ AI content bookmarks (${aiContent.length}) saved to: ${aiContentFile}`);
            }
            
            if (highEngagement.length > 0) {
                const highEngagementFile = path.join(outputDir, 'high-engagement-bookmarks.json');
                fs.writeFileSync(highEngagementFile, JSON.stringify(highEngagement, null, 2));
                this.log(`✅ High engagement bookmarks (${highEngagement.length}) saved to: ${highEngagementFile}`);
            }
            
            // Save CSV export
            const csvFile = path.join(outputDir, 'processed-bookmarks.csv');
            this.exportToCSV(processedBookmarks, csvFile);
            
            return outputDir;
            
        } catch (error) {
            this.log(`❌ Failed to save processed data: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    async run() {
        try {
            this.log('🚀 Starting bookmark processing...');
            
            // Load bookmarks
            const bookmarks = await this.loadBookmarks();
            if (bookmarks.length === 0) {
                throw new Error('No bookmarks to process');
            }
            
            // Process bookmarks
            const processedBookmarks = await this.processBookmarks(bookmarks);
            
            // Create summary
            const summary = this.createSummary(processedBookmarks);
            
            // Save processed data
            const outputDir = await this.saveProcessedData(processedBookmarks, summary);
            
            // Generate final summary
            const finalSummary = {
                totalBookmarks: bookmarks.length,
                processedBookmarks: processedBookmarks.length,
                outputDirectory: outputDir,
                executionTime: Date.now() - this.startTime,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                summary: summary
            };
            
            // Save final summary
            const finalSummaryFile = `processing-final-summary-${this.sessionId}.json`;
            fs.writeFileSync(finalSummaryFile, JSON.stringify(finalSummary, null, 2));
            
            this.log('🎉 Bookmark processing completed!');
            this.log(`📁 Final summary saved to: ${finalSummaryFile}`);
            
            return finalSummary;
            
        } catch (error) {
            this.log(`❌ Bookmark processing failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// Main execution
async function main() {
    const processor = new BookmarkProcessor();
    
    try {
        console.log('\n🔧 Starting X Bookmarks Post-Processing');
        console.log('=========================================');
        console.log(`Session ID: ${processor.sessionId}`);
        console.log('=========================================\n');
        
        const result = await processor.run();
        
        console.log('\n📈 PROCESSING SUMMARY');
        console.log('======================');
        console.log(`📖 Total Bookmarks: ${result.totalBookmarks}`);
        console.log(`🔧 Processed Bookmarks: ${result.processedBookmarks}`);
        console.log(`📁 Output Directory: ${result.outputDirectory}`);
        console.log(`⏱️ Execution Time: ${Math.round(result.executionTime / 1000)}s`);
        console.log(`📁 Final Summary: processing-final-summary-${result.sessionId}.json`);
        
        console.log('\n📊 Content Analysis:');
        result.summary.byContentType.forEach(type => {
            console.log(`  ${type.type}: ${type.count} (${type.percentage}%)`);
        });
        
        console.log('\n🎯 Priority Distribution:');
        console.log(`  High: ${result.summary.byPriority.high}`);
        console.log(`  Medium: ${result.summary.byPriority.medium}`);
        console.log(`  Low: ${result.summary.byPriority.low}`);
        
        console.log('\n😊 Sentiment Analysis:');
        console.log(`  Positive: ${result.summary.bySentiment.positive}`);
        console.log(`  Neutral: ${result.summary.bySentiment.neutral}`);
        console.log(`  Negative: ${result.summary.bySentiment.negative}`);
        
        console.log('\n🧵 Thread Analysis:');
        console.log(`  Standalone: ${result.summary.byThreadInfo.standalone}`);
        console.log(`  Thread Parts: ${result.summary.byThreadInfo.threadParts}`);
        console.log(`  Thread Starts: ${result.summary.byThreadInfo.threadStarts}`);
        
        console.log('\n📏 Thread Length Distribution:');
        Object.entries(result.summary.byThreadInfo.byThreadLength).forEach(([length, count]) => {
            if (count > 0) {
                console.log(`  ${length}: ${count}`);
            }
        });
        
        console.log('\n🎭 Thread Complexity:');
        Object.entries(result.summary.byThreadInfo.byThreadComplexity).forEach(([complexity, count]) => {
            if (count > 0) {
                console.log(`  ${complexity}: ${count}`);
            }
        });
        
        if (result.summary.topThreads.length > 0) {
            console.log('\n🏆 Top Threads by Length:');
            result.summary.topThreads.slice(0, 5).forEach((thread, index) => {
                console.log(`  ${index + 1}. ${thread.author} - ${thread.threadLength} tweets (Engagement: ${thread.threadEngagement.toFixed(2)})`);
            });
        }
        
        console.log('\n🤖 AI Analysis Summary:');
        console.log(`  Knowledge Categories:`);
        result.summary.byAI.byKnowledgeCategory.forEach(cat => {
            console.log(`    ${cat.category}: ${cat.count}`);
        });
        
        console.log(`\n  Content Value Distribution:`);
        console.log(`    High: ${result.summary.byAI.byContentValue.high}`);
        console.log(`    Medium: ${result.summary.byAI.byContentValue.medium}`);
        console.log(`    Low: ${result.summary.byAI.byContentValue.low}`);
        
        console.log(`\n  Target Audience:`);
        result.summary.byAI.byTargetAudience.forEach(aud => {
            console.log(`    ${aud.audience}: ${aud.count}`);
        });
        
        console.log(`\n  Actionable Content: ${result.summary.byAI.actionable}`);
        console.log(`  Discussion Worthy: ${result.summary.byAI.discussionWorthy}`);
        console.log(`  Reference Worthy: ${result.summary.byAI.referenceWorthy}`);
        
        console.log(`\n  Average Scores:`);
        console.log(`    Relevance: ${result.summary.byAI.averageRelevanceScore}`);
        console.log(`    Quality: ${result.summary.byAI.averageQualityScore}`);
        console.log(`    Learning Value: ${result.summary.byAI.averageLearningValue}`);
        
        console.log('\n🎉 Processing completed successfully!');
        
    } catch (error) {
        console.error('\n❌ PROCESSING FAILED');
        console.error('=====================');
        console.error(`Error: ${error.message}`);
        console.error(`Session ID: ${processor.sessionId}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { BookmarkProcessor };
export default BookmarkProcessor;
