-- Thread-Enhanced Schema Modifications
-- Extends existing bookmark functionality with comprehensive thread support

-- Add thread-specific columns to twitter_memos table
ALTER TABLE public.twitter_memos 
ADD COLUMN IF NOT EXISTS is_thread BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS thread_position INTEGER,
ADD COLUMN IF NOT EXISTS parent_tweet_id TEXT,
ADD COLUMN IF NOT EXISTS thread_root_id TEXT,
ADD COLUMN IF NOT EXISTS thread_total_tweets INTEGER,
ADD COLUMN IF NOT EXISTS thread_fetched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS thread_completion_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS thread_detection_confidence DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS thread_context_importance DOUBLE PRECISION DEFAULT 0.5;

-- Add thread-specific columns to tweet_analysis table
ALTER TABLE public.tweet_analysis
ADD COLUMN IF NOT EXISTS thread_theme TEXT,
ADD COLUMN IF NOT EXISTS thread_coherence DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS thread_completeness DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS context_importance DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS thread_summary TEXT,
ADD COLUMN IF NOT EXISTS key_thread_insights JSONB,
ADD COLUMN IF NOT EXISTS recommended_reading_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thread_analysis_metadata JSONB;

-- Create thread_relationships table for managing thread data
CREATE TABLE IF NOT EXISTS thread_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL UNIQUE,
    root_tweet_id TEXT NOT NULL,
    tweet_ids TEXT[] NOT NULL,
    thread_length INTEGER NOT NULL,
    thread_theme TEXT,
    thread_summary TEXT,
    completion_status TEXT DEFAULT 'partial',
    detection_method TEXT DEFAULT 'content_analysis',
    fetched_via TEXT DEFAULT 'scraper',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fetch_attempts INTEGER DEFAULT 1,
    last_fetch_error TEXT
);

-- Create indexes for efficient thread queries
CREATE INDEX IF NOT EXISTS idx_twitter_memos_thread_id ON public.twitter_memos(thread_id);
CREATE INDEX IF NOT EXISTS idx_twitter_memos_is_thread ON public.twitter_memos(is_thread);
CREATE INDEX IF NOT EXISTS idx_twitter_memos_thread_root ON public.twitter_memos(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_twitter_memos_parent_tweet ON public.twitter_memos(parent_tweet_id);
CREATE INDEX IF NOT EXISTS idx_thread_relationships_thread_id ON thread_relationships(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_relationships_root_tweet ON thread_relationships(root_tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_thread_coherence ON public.tweet_analysis(thread_coherence);

-- Create enhanced bookmark_analysis view with thread context
CREATE OR REPLACE VIEW bookmark_analysis_with_threads AS
SELECT 
    ba.*,
    tm.thread_id,
    tm.thread_position,
    tm.thread_total_tweets,
    tm.thread_root_id,
    tm.parent_tweet_id,
    tm.thread_completion_status,
    tm.thread_detection_confidence,
    tm.thread_context_importance,
    ta.thread_theme,
    ta.thread_coherence,
    ta.thread_completeness,
    ta.context_importance,
    ta.thread_summary,
    ta.key_thread_insights,
    ta.recommended_reading_order,
    tr.thread_length,
    tr.completion_status as thread_fetch_status,
    tr.detection_method,
    (
        SELECT json_agg(
            json_build_object(
                'id', tm2.id,
                'text', tm2.text,
                'author', tm2.author,
                'position', tm2.thread_position,
                'url', tm2.url,
                'created_at', tm2.created_at
            ) ORDER BY tm2.thread_position
        ) 
        FROM twitter_memos tm2 
        WHERE tm2.thread_id = tm.thread_id 
        AND tm2.thread_id IS NOT NULL
    ) as thread_context
FROM bookmark_analysis ba
LEFT JOIN twitter_memos tm ON ba.id = tm.id  
LEFT JOIN tweet_analysis ta ON ba.id = ta.tweet_id
LEFT JOIN thread_relationships tr ON tm.thread_id = tr.thread_id;

-- Create function to get complete thread context for a bookmark
CREATE OR REPLACE FUNCTION get_thread_context(bookmark_id TEXT)
RETURNS TABLE (
    thread_id TEXT,
    root_tweet_id TEXT,
    bookmark_position INTEGER,
    total_tweets INTEGER,
    thread_theme TEXT,
    thread_summary TEXT,
    completion_status TEXT,
    context_tweets JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.thread_id,
        tm.thread_root_id,
        tm.thread_position,
        tm.thread_total_tweets,
        tr.thread_theme,
        tr.thread_summary,
        tr.completion_status,
        (
            SELECT json_agg(
                json_build_object(
                    'id', tm2.id,
                    'text', tm2.text,
                    'author', tm2.author,
                    'position', tm2.thread_position,
                    'url', tm2.url,
                    'created_at', tm2.created_at,
                    'is_bookmarked', tm2.is_bookmark
                ) ORDER BY tm2.thread_position
            )::jsonb
            FROM twitter_memos tm2 
            WHERE tm2.thread_id = tm.thread_id
        ) as context_tweets
    FROM twitter_memos tm
    LEFT JOIN thread_relationships tr ON tm.thread_id = tr.thread_id
    WHERE tm.id = bookmark_id
    AND tm.thread_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to get thread-aware high-value bookmarks
CREATE OR REPLACE FUNCTION get_high_value_bookmarks_with_threads(min_quality DOUBLE PRECISION DEFAULT 0.7)
RETURNS TABLE (
    id TEXT,
    text TEXT,
    author TEXT,
    quality_score DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION,
    learning_value DOUBLE PRECISION,
    composite_score DOUBLE PRECISION,
    categories JSONB,
    key_insights JSONB,
    reference_worthy BOOLEAN,
    is_thread BOOLEAN,
    thread_id TEXT,
    thread_position INTEGER,
    thread_theme TEXT,
    thread_coherence DOUBLE PRECISION,
    has_thread_context BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.text,
        tm.author,
        ta.quality_score,
        ta.relevance_score,
        ta.learning_value,
        ta.composite_score,
        ta.categories,
        ta.key_insights,
        ta.reference_worthy,
        tm.is_thread,
        tm.thread_id,
        tm.thread_position,
        ta.thread_theme,
        ta.thread_coherence,
        CASE WHEN tm.thread_id IS NOT NULL THEN TRUE ELSE FALSE END as has_thread_context
    FROM public.twitter_memos tm
    LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
    WHERE tm.is_bookmark = TRUE 
    AND ta.quality_score >= min_quality
    ORDER BY 
        CASE WHEN tm.is_thread THEN ta.thread_coherence * ta.quality_score 
             ELSE ta.quality_score END DESC,
        ta.learning_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get related threads for a bookmark
CREATE OR REPLACE FUNCTION get_related_threads(bookmark_id TEXT)
RETURNS TABLE (
    related_thread_id TEXT,
    related_root_id TEXT,
    relationship_type TEXT,
    similarity_score DOUBLE PRECISION,
    theme_match TEXT,
    shared_entities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH bookmark_thread AS (
        SELECT tm.thread_id, ta.thread_theme, ta.entities, ta.categories
        FROM twitter_memos tm
        LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id
        WHERE tm.id = bookmark_id
    )
    SELECT 
        tr.thread_id as related_thread_id,
        tr.root_tweet_id as related_root_id,
        'thematic_similarity' as relationship_type,
        CASE 
            WHEN bt.thread_theme = tr.thread_theme THEN 0.9
            WHEN bt.categories && ta.categories THEN 0.7
            ELSE 0.3
        END as similarity_score,
        tr.thread_theme as theme_match,
        COALESCE(
            (SELECT array_agg(DISTINCT entity) 
             FROM jsonb_array_elements_text(bt.entities) entity
             WHERE entity = ANY(SELECT jsonb_array_elements_text(ta.entities))
            ), 
            ARRAY[]::TEXT[]
        ) as shared_entities
    FROM thread_relationships tr
    LEFT JOIN tweet_analysis ta ON tr.root_tweet_id = ta.tweet_id
    CROSS JOIN bookmark_thread bt
    WHERE tr.thread_id != bt.thread_id
    AND tr.thread_id IS NOT NULL
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create function to get thread statistics
CREATE OR REPLACE FUNCTION get_thread_statistics()
RETURNS TABLE (
    total_threads BIGINT,
    total_thread_tweets BIGINT,
    avg_thread_length DOUBLE PRECISION,
    bookmarked_threads BIGINT,
    completed_threads BIGINT,
    avg_thread_coherence DOUBLE PRECISION,
    top_thread_themes TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT tr.thread_id) as total_threads,
        COUNT(tm.id) as total_thread_tweets,
        AVG(tr.thread_length) as avg_thread_length,
        COUNT(DISTINCT CASE WHEN tm.is_bookmark THEN tr.thread_id END) as bookmarked_threads,
        COUNT(DISTINCT CASE WHEN tr.completion_status = 'complete' THEN tr.thread_id END) as completed_threads,
        AVG(ta.thread_coherence) as avg_thread_coherence,
        array_agg(DISTINCT ta.thread_theme) FILTER (WHERE ta.thread_theme IS NOT NULL) as top_thread_themes
    FROM thread_relationships tr
    LEFT JOIN twitter_memos tm ON tm.thread_id = tr.thread_id
    LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for thread analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS thread_analytics AS
SELECT 
    DATE(tr.created_at) as date,
    COUNT(DISTINCT tr.thread_id) as threads_discovered,
    AVG(tr.thread_length) as avg_length,
    COUNT(DISTINCT CASE WHEN tm.is_bookmark THEN tr.thread_id END) as bookmarked_threads,
    AVG(ta.thread_coherence) FILTER (WHERE ta.thread_coherence IS NOT NULL) as avg_coherence,
    mode() WITHIN GROUP (ORDER BY tr.thread_theme) as most_common_theme,
    COUNT(CASE WHEN tr.completion_status = 'complete' THEN 1 END) as completed_threads,
    COUNT(CASE WHEN tr.completion_status = 'partial' THEN 1 END) as partial_threads
FROM thread_relationships tr
LEFT JOIN twitter_memos tm ON tm.thread_id = tr.thread_id
LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id
GROUP BY DATE(tr.created_at)
ORDER BY date DESC;

-- Create index for thread analytics
CREATE INDEX IF NOT EXISTS idx_thread_analytics_date ON thread_analytics(date);

-- Create function to refresh thread analytics
CREATE OR REPLACE FUNCTION refresh_thread_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW thread_analytics;
END;
$$ LANGUAGE plpgsql;

-- Add constraints for data integrity
ALTER TABLE thread_relationships 
ADD CONSTRAINT chk_thread_length_positive CHECK (thread_length > 0),
ADD CONSTRAINT chk_completion_status CHECK (completion_status IN ('unknown', 'partial', 'complete', 'failed'));

ALTER TABLE public.twitter_memos
ADD CONSTRAINT chk_thread_position_positive CHECK (thread_position IS NULL OR thread_position > 0),
ADD CONSTRAINT chk_thread_completion_status CHECK (thread_completion_status IN ('unknown', 'partial', 'complete', 'failed')),
ADD CONSTRAINT chk_thread_detection_confidence CHECK (thread_detection_confidence >= 0 AND thread_detection_confidence <= 1);

-- Sample queries for reference:

-- Get all bookmarks with their thread context
-- SELECT * FROM bookmark_analysis_with_threads WHERE thread_id IS NOT NULL;

-- Get complete thread for a specific bookmark
-- SELECT * FROM get_thread_context('your_bookmark_id');

-- Get high-value bookmarks considering thread coherence
-- SELECT * FROM get_high_value_bookmarks_with_threads(0.8);

-- Get thread statistics
-- SELECT * FROM get_thread_statistics();

-- Find related threads for a bookmark
-- SELECT * FROM get_related_threads('your_bookmark_id');

-- Get thread analytics over time
-- SELECT * FROM thread_analytics ORDER BY date DESC LIMIT 30;