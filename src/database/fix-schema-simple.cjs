const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SimpleSchemaFixer {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        this.logs = [];
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
    }

    async testTableAccess() {
        try {
            this.log('🔍 Testing access to tweet_analysis table...');
            
            // Try to select from the table to see if it exists and what structure it has
            const { data, error } = await this.supabase
                .from('tweet_analysis')
                .select('*')
                .limit(1);
            
            if (error) {
                if (error.message.includes('does not exist')) {
                    this.log('📝 Table does not exist, creating it...', 'WARN');
                    return await this.createTable();
                } else if (error.message.includes('column') && error.message.includes('does not exist')) {
                    this.log('⚠️ Table exists but has missing columns, fixing structure...', 'WARN');
                  return await this.fixTableStructure();
                } else {
                    this.log(`❌ Table access error: ${error.message}`, 'ERROR');
                    return false;
                }
            } else {
                this.log('✅ Table exists and is accessible');
                return true;
            }
            
        } catch (error) {
            this.log(`❌ Table access test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async createTable() {
        try {
            this.log('🏗️ Creating tweet_analysis table...');
            
            // Try to create table by inserting a record with minimal required fields
            const testRecord = {
                tweet_id: 'test_' + Date.now(),
                topic: 'test',
                sentiment: 'neutral',
                relevance_score: 0.5,
                quality_score: 0.5
            };
            
            const { error } = await this.supabase
                .from('tweet_analysis')
                .insert(testRecord);
            
            if (error) {
                this.log(`❌ Table creation failed: ${error.message}`, 'ERROR');
                this.log('💡 You may need to manually create the table in Supabase dashboard', 'WARN');
                return false;
            } else {
                this.log('✅ Table created successfully via insert');
                // Clean up test record
                await this.supabase
                    .from('tweet_analysis')
                    .delete()
                    .eq('tweet_id', testRecord.tweet_id);
                return true;
            }
            
        } catch (error) {
            this.log(`❌ Table creation failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async fixTableStructure() {
        try {
            this.log('🔧 Fixing table structure...');
            
            // Try to insert a record with all the fields we need
            const testRecord = {
                tweet_id: 'test_' + Date.now(),
                topic: 'test',
                sentiment: 'neutral',
                relevance_score: 0.5,
                quality_score: 0.5,
                positive_indicators: ['test'],
                negative_indicators: [],
                tech_indicators: [],
                business_indicators: [],
                engagement_prediction: 0.5,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            const { error } = await this.supabase
                .from('tweet_analysis')
                .insert(testRecord);
            
            if (error) {
                this.log(`⚠️ Structure test failed: ${error.message}`, 'WARN');
                // Try with minimal fields
                const minimalRecord = {
                    tweet_id: 'test_minimal_' + Date.now(),
                    topic: 'test',
                    sentiment: 'neutral'
                };
                
                const { error: minimalError } = await this.supabase
                    .from('tweet_analysis')
                    .insert(minimalRecord);
                
                if (minimalError) {
                    this.log(`❌ Minimal insert also failed: ${minimalError.message}`, 'ERROR');
                    return false;
                } else {
                    this.log('✅ Minimal structure works, cleaning up...');
                    await this.supabase
                        .from('tweet_analysis')
                        .delete()
                        .eq('tweet_id', minimalRecord.tweet_id);
                }
            } else {
                this.log('✅ Full structure works, cleaning up...');
                await this.supabase
                    .from('tweet_analysis')
                    .delete()
                    .eq('tweet_id', testRecord.tweet_id);
            }
            
            return true;
            
        } catch (error) {
            this.log(`❌ Structure fix failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testAnalysisInsert() {
        try {
            this.log('🧪 Testing analysis record insertion...');
            
            const testAnalysis = {
                tweet_id: 'test_analysis_' + Date.now(),
                engagement_potential: 0.8,
                readability_score: 0.7,
                topic: 'test',
                tags: ['test', 'analysis'],
                sentiment: 'positive',
                intent: 'informative',
                relevance_score: 0.9,
                quality_score: 0.8,
                actionable: true,
                categories: ['test'],
                composite_score: 0.85,
                content_value: 0.8,
                reference_worthy: true,
                learning_value: 0.9,
                knowledge_category: 'test',
                extraction_confidence: 0.95
            };
            
            const { error } = await this.supabase
                .from('tweet_analysis')
                .insert(testAnalysis);
            
            if (error) {
                this.log(`❌ Analysis insert test failed: ${error.message}`, 'ERROR');
                return false;
            } else {
                this.log('✅ Analysis insert test successful');
                // Clean up
                await this.supabase
                    .from('tweet_analysis')
                    .delete()
                    .eq('tweet_id', testAnalysis.tweet_id);
                return true;
            }
            
        } catch (error) {
            this.log(`❌ Analysis insert test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async run() {
        try {
            this.log('🚀 Starting simple schema fix...');
            
            const tableAccess = await this.testTableAccess();
            if (tableAccess) {
                const analysisTest = await this.testAnalysisInsert();
                if (analysisTest) {
                    this.log('🎉 Schema is working correctly!');
                } else {
                    this.log('⚠️ Schema exists but analysis insert has issues');
                }
            } else {
                this.log('❌ Schema fix failed');
            }
            
            // Save logs
            const fs = require('fs');
            const logFile = `simple-schema-fix-logs-${Date.now()}.json`;
            fs.writeFileSync(logFile, JSON.stringify(this.logs, null, 2));
            this.log(`📁 Logs saved to: ${logFile}`);
            
        } catch (error) {
            this.log(`❌ Schema fix execution failed: ${error.message}`, 'ERROR');
        }
    }
}

// Run the schema fixer
if (require.main === module) {
    const fixer = new SimpleSchemaFixer();
    fixer.run();
}

module.exports = SimpleSchemaFixer;
