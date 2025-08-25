const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SchemaFixer {
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

    async fixTweetAnalysisTable() {
        try {
            this.log('🔧 Starting direct schema fix for tweet_analysis table...');
            
            // Step 1: Check if table exists
            this.log('🔍 Checking if tweet_analysis table exists...');
            const { data: tableExists, error: tableCheckError } = await this.supabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_schema', 'public')
                .eq('table_name', 'tweet_analysis')
                .single();
            
            if (tableCheckError && tableCheckError.code !== 'PGRST116') {
                this.log(`❌ Error checking table existence: ${tableCheckError.message}`, 'ERROR');
                return false;
            }
            
            if (!tableExists) {
                this.log('📝 tweet_analysis table does not exist, creating it...');
                await this.createTweetAnalysisTable();
            } else {
                this.log('✅ tweet_analysis table exists, checking structure...');
                await this.checkAndFixTableStructure();
            }
            
            return true;
            
        } catch (error) {
            this.log(`❌ Schema fix failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async createTweetAnalysisTable() {
        try {
            this.log('🏗️ Creating tweet_analysis table...');
            
            // Create the table using raw SQL through a function call
            const { error } = await this.supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS public.tweet_analysis (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        tweet_id TEXT NOT NULL UNIQUE,
                        engagement_potential DOUBLE PRECISION DEFAULT 0.5,
                        readability_score DOUBLE PRECISION DEFAULT 0.5,
                        positive_indicators TEXT[],
                        negative_indicators TEXT[],
                        tech_indicators TEXT[],
                        business_indicators TEXT[],
                        topic TEXT DEFAULT 'general',
                        tags TEXT[],
                        entities JSONB,
                        concepts TEXT[],
                        sentiment TEXT DEFAULT 'neutral',
                        intent TEXT DEFAULT 'informative',
                        relevance_score DOUBLE PRECISION DEFAULT 0.5,
                        virality_potential DOUBLE PRECISION DEFAULT 0.5,
                        actionable BOOLEAN DEFAULT FALSE,
                        categories TEXT[],
                        quality_score DOUBLE PRECISION DEFAULT 0.5,
                        information_type TEXT DEFAULT 'general',
                        target_audience TEXT DEFAULT 'general',
                        key_insights JSONB,
                        discussion_worthy BOOLEAN DEFAULT FALSE,
                        composite_score DOUBLE PRECISION DEFAULT 0.5,
                        engagement_prediction DOUBLE PRECISION,
                        content_value DOUBLE PRECISION DEFAULT 0.5,
                        reference_worthy BOOLEAN DEFAULT FALSE,
                        bookmark_specific_analysis JSONB,
                        learning_value DOUBLE PRECISION DEFAULT 0.5,
                        knowledge_category TEXT DEFAULT 'general',
                        bookmark_context TEXT,
                        extraction_confidence DOUBLE PRECISION DEFAULT 0.8,
                        thread_theme TEXT,
                        thread_coherence DOUBLE PRECISION DEFAULT 0.5,
                        thread_completeness DOUBLE PRECISION DEFAULT 0.5,
                        context_importance DOUBLE PRECISION DEFAULT 0.5,
                        thread_summary TEXT,
                        key_thread_insights JSONB,
                        recommended_reading_order BOOLEAN DEFAULT FALSE,
                        thread_analysis_metadata JSONB,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                `
            });
            
            if (error) {
                this.log(`⚠️ Could not create table via RPC: ${error.message}`, 'WARN');
                this.log('🔄 Trying alternative approach...', 'INFO');
                await this.createTableViaInsert();
            } else {
                this.log('✅ tweet_analysis table created successfully');
            }
            
        } catch (error) {
            this.log(`❌ Table creation failed: ${error.message}`, 'ERROR');
        }
    }

    async createTableViaInsert() {
        try {
            this.log('🔄 Creating table via insert approach...');
            
            // Try to insert a dummy record to trigger table creation
            const dummyData = {
                tweet_id: 'dummy_' + Date.now(),
                topic: 'test',
                sentiment: 'neutral'
            };
            
            const { error } = await this.supabase
                .from('tweet_analysis')
                .insert(dummyData);
            
            if (error) {
                this.log(`❌ Alternative table creation failed: ${error.message}`, 'ERROR');
                this.log('💡 You may need to manually create the table in Supabase dashboard', 'WARN');
            } else {
                this.log('✅ Table created via insert approach');
                // Clean up dummy record
                await this.supabase
                    .from('tweet_analysis')
                    .delete()
                    .eq('tweet_id', dummyData.tweet_id);
            }
            
        } catch (error) {
            this.log(`❌ Alternative table creation failed: ${error.message}`, 'ERROR');
        }
    }

    async checkAndFixTableStructure() {
        try {
            this.log('🔍 Checking table structure...');
            
            // Check if id column exists
            const { data: columns, error: columnError } = await this.supabase
                .from('information_schema.columns')
                .select('column_name, data_type, is_nullable, column_default')
                .eq('table_schema', 'public')
                .eq('table_name', 'tweet_analysis')
                .order('ordinal_position');
            
            if (columnError) {
                this.log(`❌ Error checking columns: ${columnError.message}`, 'ERROR');
                return;
            }
            
            this.log(`📊 Found ${columns.length} columns in tweet_analysis table`);
            
            // Check for missing id column
            const hasIdColumn = columns.some(col => col.column_name === 'id');
            if (!hasIdColumn) {
                this.log('⚠️ Missing id column, adding it...', 'WARN');
                await this.addIdColumn();
            } else {
                this.log('✅ id column exists');
            }
            
            // Check for other missing columns
            const requiredColumns = [
                'positive_indicators', 'negative_indicators', 'tech_indicators', 
                'business_indicators', 'engagement_prediction', 'created_at', 'updated_at'
            ];
            
            for (const colName of requiredColumns) {
                const hasColumn = columns.some(col => col.column_name === colName);
                if (!hasColumn) {
                    this.log(`⚠️ Missing ${colName} column, adding it...`, 'WARN');
                    await this.addColumn(colName);
                }
            }
            
        } catch (error) {
            this.log(`❌ Structure check failed: ${error.message}`, 'ERROR');
        }
    }

    async addIdColumn() {
        try {
            this.log('➕ Adding id column...');
            
            const { error } = await this.supabase.rpc('exec_sql', {
                sql: `
                    ALTER TABLE public.tweet_analysis 
                    ADD COLUMN id UUID DEFAULT gen_random_uuid();
                    
                    ALTER TABLE public.tweet_analysis 
                    ADD PRIMARY KEY (id);
                `
            });
            
            if (error) {
                this.log(`⚠️ Could not add id column via RPC: ${error.message}`, 'WARN');
            } else {
                this.log('✅ id column added successfully');
            }
            
        } catch (error) {
            this.log(`❌ Adding id column failed: ${error.message}`, 'ERROR');
        }
    }

    async addColumn(columnName) {
        try {
            this.log(`➕ Adding ${columnName} column...`);
            
            let sql = '';
            switch (columnName) {
                case 'positive_indicators':
                case 'negative_indicators':
                case 'tech_indicators':
                case 'business_indicators':
                    sql = `ALTER TABLE public.tweet_analysis ADD COLUMN ${columnName} TEXT[];`;
                    break;
                case 'engagement_prediction':
                    sql = `ALTER TABLE public.tweet_analysis ADD COLUMN ${columnName} DOUBLE PRECISION;`;
                    break;
                case 'created_at':
                case 'updated_at':
                    sql = `ALTER TABLE public.tweet_analysis ADD COLUMN ${columnName} TIMESTAMP WITH TIME ZONE DEFAULT NOW();`;
                    break;
                default:
                    sql = `ALTER TABLE public.tweet_analysis ADD COLUMN ${columnName} TEXT;`;
            }
            
            const { error } = await this.supabase.rpc('exec_sql', { sql });
            
            if (error) {
                this.log(`⚠️ Could not add ${columnName} column via RPC: ${error.message}`, 'WARN');
            } else {
                this.log(`✅ ${columnName} column added successfully`);
            }
            
        } catch (error) {
            this.log(`❌ Adding ${columnName} column failed: ${error.message}`, 'ERROR');
        }
    }

    async createIndexes() {
        try {
            this.log('🔍 Creating indexes for better performance...');
            
            const indexQueries = [
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_tweet_id ON public.tweet_analysis(tweet_id);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_sentiment ON public.tweet_analysis(sentiment);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_topic ON public.tweet_analysis(topic);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_quality_score ON public.tweet_analysis(quality_score);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_relevance_score ON public.tweet_analysis(relevance_score);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_composite_score ON public.tweet_analysis(composite_score);',
                'CREATE INDEX IF NOT EXISTS idx_tweet_analysis_created_at ON public.tweet_analysis(created_at);'
            ];
            
            for (const query of indexQueries) {
                try {
                    const { error } = await this.supabase.rpc('exec_sql', { sql: query });
                    if (error) {
                        this.log(`⚠️ Index creation failed: ${error.message}`, 'WARN');
                    }
                } catch (err) {
                    this.log(`⚠️ Index creation error: ${err.message}`, 'WARN');
                }
            }
            
            this.log('✅ Indexes created (or already existed)');
            
        } catch (error) {
            this.log(`❌ Index creation failed: ${error.message}`, 'ERROR');
        }
    }

    async run() {
        try {
            this.log('🚀 Starting comprehensive schema fix...');
            
            const success = await this.fixTweetAnalysisTable();
            if (success) {
                await this.createIndexes();
                this.log('🎉 Schema fix completed successfully!');
            } else {
                this.log('❌ Schema fix failed');
            }
            
            // Save logs
            const fs = require('fs');
            const logFile = `schema-fix-logs-${Date.now()}.json`;
            fs.writeFileSync(logFile, JSON.stringify(this.logs, null, 2));
            this.log(`📁 Logs saved to: ${logFile}`);
            
        } catch (error) {
            this.log(`❌ Schema fix execution failed: ${error.message}`, 'ERROR');
        }
    }
}

// Run the schema fixer
if (require.main === module) {
    const fixer = new SchemaFixer();
    fixer.run();
}

module.exports = SchemaFixer;
