-- Fix tweet_analysis Table Schema
-- This script ensures the tweet_analysis table has all required columns and proper structure

-- First, check if tweet_analysis table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tweet_analysis') THEN
        CREATE TABLE public.tweet_analysis (
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
        
        RAISE NOTICE 'Created tweet_analysis table';
    ELSE
        RAISE NOTICE 'tweet_analysis table already exists';
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE public.tweet_analysis 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS positive_indicators TEXT[],
ADD COLUMN IF NOT EXISTS negative_indicators TEXT[],
ADD COLUMN IF NOT EXISTS tech_indicators TEXT[],
ADD COLUMN IF NOT EXISTS business_indicators TEXT[],
ADD COLUMN IF NOT EXISTS engagement_prediction DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set id as primary key if it's not already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tweet_analysis_pkey' 
        AND table_name = 'tweet_analysis'
    ) THEN
        ALTER TABLE public.tweet_analysis ADD PRIMARY KEY (id);
        RAISE NOTICE 'Added primary key to tweet_analysis table';
    ELSE
        RAISE NOTICE 'Primary key already exists on tweet_analysis table';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_tweet_id ON public.tweet_analysis(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_sentiment ON public.tweet_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_topic ON public.tweet_analysis(topic);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_quality_score ON public.tweet_analysis(quality_score);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_relevance_score ON public.tweet_analysis(relevance_score);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_composite_score ON public.tweet_analysis(composite_score);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_created_at ON public.tweet_analysis(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_tweet_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_tweet_analysis_updated_at ON public.tweet_analysis;
CREATE TRIGGER trigger_update_tweet_analysis_updated_at
    BEFORE UPDATE ON public.tweet_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_tweet_analysis_updated_at();

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweet_analysis' 
AND table_schema = 'public'
ORDER BY ordinal_position;
