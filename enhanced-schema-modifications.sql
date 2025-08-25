-- Enhanced Schema Modifications for Existing Twitter Analysis System
-- This script adds bookmark-specific enhancements to your existing tables

-- Add bookmark-specific columns to twitter_memos table
ALTER TABLE public.twitter_memos 
ADD COLUMN IF NOT EXISTS is_bookmark BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bookmark_extracted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bookmark_html TEXT,
ADD COLUMN IF NOT EXISTS bookmark_hash TEXT,
ADD COLUMN IF NOT EXISTS bookmark_reason TEXT,
ADD COLUMN IF NOT EXISTS bookmark_source TEXT DEFAULT 'twitter_scraper',
ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add bookmark-specific columns to tweet_analysis table
ALTER TABLE public.tweet_analysis
ADD COLUMN IF NOT EXISTS reference_worthy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bookmark_specific_analysis JSONB,
ADD COLUMN IF NOT EXISTS learning_value DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS knowledge_category TEXT,
ADD COLUMN IF NOT EXISTS bookmark_context TEXT,
ADD COLUMN IF NOT EXISTS extraction_confidence DOUBLE PRECISION DEFAULT 0.8;

-- Create index for bookmark queries
CREATE INDEX IF NOT EXISTS idx_twitter_memos_bookmark ON public.twitter_memos(is_bookmark, bookmark_extracted_at);
CREATE INDEX IF NOT EXISTS idx_twitter_memos_bookmark_hash ON public.twitter_memos(bookmark_hash);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_reference_worthy ON public.tweet_analysis(reference_worthy);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_learning_value ON public.tweet_analysis(learning_value);
CREATE INDEX IF NOT EXISTS idx_tweet_analysis_knowledge_category ON public.tweet_analysis(knowledge_category);

-- Create a view for bookmark-specific queries
CREATE OR REPLACE VIEW bookmark_analysis AS
SELECT 
    tm.id,
    tm.text,
    tm.author,
    tm.created_at,
    tm.url,
    tm.bookmark_extracted_at,
    tm.bookmark_reason,
    tm.bookmark_hash,
    tm.engagement_score,
    tm.word_count,
    tm.text_length,
    ta.engagement_potential,
    ta.readability_score,
    ta.topic,
    ta.tags,
    ta.entities,
    ta.concepts,
    ta.sentiment,
    ta.intent,
    ta.relevance_score,
    ta.virality_potential,
    ta.actionable,
    ta.categories,
    ta.quality_score,
    ta.information_type,
    ta.target_audience,
    ta.key_insights,
    ta.discussion_worthy,
    ta.composite_score,
    ta.content_value,
    ta.reference_worthy,
    ta.learning_value,
    ta.knowledge_category,
    ta.bookmark_context
FROM public.twitter_memos tm
LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
WHERE tm.is_bookmark = TRUE
ORDER BY tm.bookmark_extracted_at DESC;

-- Create a function to get bookmarks by knowledge category
CREATE OR REPLACE FUNCTION get_bookmarks_by_knowledge_category(category_name TEXT)
RETURNS TABLE (
    id TEXT,
    text TEXT,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    relevance_score DOUBLE PRECISION,
    quality_score DOUBLE PRECISION,
    learning_value DOUBLE PRECISION,
    key_insights JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.text,
        tm.author,
        tm.created_at,
        ta.relevance_score,
        ta.quality_score,
        ta.learning_value,
        ta.key_insights
    FROM public.twitter_memos tm
    LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
    WHERE tm.is_bookmark = TRUE 
    AND ta.knowledge_category = category_name
    ORDER BY ta.learning_value DESC, ta.relevance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get high-value bookmarks
CREATE OR REPLACE FUNCTION get_high_value_bookmarks(min_quality DOUBLE PRECISION DEFAULT 0.7)
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
    reference_worthy BOOLEAN
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
        ta.reference_worthy
    FROM public.twitter_memos tm
    LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
    WHERE tm.is_bookmark = TRUE 
    AND ta.quality_score >= min_quality
    ORDER BY ta.composite_score DESC, ta.learning_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get related bookmarks
CREATE OR REPLACE FUNCTION get_related_bookmarks(bookmark_id TEXT)
RETURNS TABLE (
    id TEXT,
    text TEXT,
    author TEXT,
    relevance_score DOUBLE PRECISION,
    quality_score DOUBLE PRECISION,
    relationship_score DOUBLE PRECISION,
    topic_cluster TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.text,
        tm.author,
        ta.relevance_score,
        ta.quality_score,
        COALESCE((tr.relationship_scores->>tm.id)::DOUBLE PRECISION, 0) as relationship_score,
        COALESCE(tr.topic_clusters->>tm.id, 'uncategorized') as topic_cluster
    FROM public.twitter_memos tm
    LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
    LEFT JOIN public.tweet_relationships tr ON tr.tweet_id = bookmark_id
    WHERE tm.is_bookmark = TRUE 
    AND tm.id != bookmark_id
    AND tr.related_ids ? tm.id
    ORDER BY relationship_score DESC, ta.relevance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get bookmark insights summary
CREATE OR REPLACE FUNCTION get_bookmark_insights_summary()
RETURNS TABLE (
    total_bookmarks BIGINT,
    avg_quality_score DOUBLE PRECISION,
    avg_relevance_score DOUBLE PRECISION,
    avg_learning_value DOUBLE PRECISION,
    top_categories JSONB,
    top_topics TEXT[],
    reference_worthy_count BIGINT,
    actionable_count BIGINT,
    discussion_worthy_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(tm.id) as total_bookmarks,
        AVG(ta.quality_score) as avg_quality_score,
        AVG(ta.relevance_score) as avg_relevance_score,
        AVG(ta.learning_value) as avg_learning_value,
        jsonb_agg(DISTINCT ta.categories) as top_categories,
        array_agg(DISTINCT ta.topic) as top_topics,
        COUNT(CASE WHEN ta.reference_worthy THEN 1 END) as reference_worthy_count,
        COUNT(CASE WHEN ta.actionable THEN 1 END) as actionable_count,
        COUNT(CASE WHEN ta.discussion_worthy THEN 1 END) as discussion_worthy_count
    FROM public.twitter_memos tm
    LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
    WHERE tm.is_bookmark = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to find duplicate bookmarks
CREATE OR REPLACE FUNCTION find_duplicate_bookmarks()
RETURNS TABLE (
    bookmark_hash TEXT,
    duplicate_count BIGINT,
    tweet_ids TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.bookmark_hash,
        COUNT(*) as duplicate_count,
        array_agg(tm.id) as tweet_ids
    FROM public.twitter_memos tm
    WHERE tm.is_bookmark = TRUE 
    AND tm.bookmark_hash IS NOT NULL
    GROUP BY tm.bookmark_hash
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view for bookmark analytics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS bookmark_analytics AS
SELECT 
    DATE(tm.bookmark_extracted_at) as extraction_date,
    COUNT(*) as bookmarks_count,
    AVG(ta.quality_score) as avg_quality,
    AVG(ta.relevance_score) as avg_relevance,
    AVG(ta.learning_value) as avg_learning_value,
    AVG(ta.composite_score) as avg_composite,
    COUNT(CASE WHEN ta.reference_worthy THEN 1 END) as reference_worthy_count,
    COUNT(CASE WHEN ta.actionable THEN 1 END) as actionable_count,
    jsonb_agg(DISTINCT ta.categories) as categories_distribution,
    array_agg(DISTINCT ta.topic) as topics_covered
FROM public.twitter_memos tm
LEFT JOIN public.tweet_analysis ta ON tm.id = ta.tweet_id
WHERE tm.is_bookmark = TRUE
GROUP BY DATE(tm.bookmark_extracted_at)
ORDER BY extraction_date DESC;

-- Create index for the materialized view
CREATE INDEX IF NOT EXISTS idx_bookmark_analytics_date ON bookmark_analytics(extraction_date);

-- Create a function to refresh bookmark analytics
CREATE OR REPLACE FUNCTION refresh_bookmark_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW bookmark_analytics;
END;
$$ LANGUAGE plpgsql;

-- Sample queries for reference:

-- Get all bookmarks with high learning value
-- SELECT * FROM bookmark_analysis WHERE learning_value > 0.8 ORDER BY learning_value DESC;

-- Get bookmarks by specific category
-- SELECT * FROM get_bookmarks_by_knowledge_category('Technology');

-- Get high-value bookmarks
-- SELECT * FROM get_high_value_bookmarks(0.8);

-- Get related bookmarks for a specific one
-- SELECT * FROM get_related_bookmarks('your_bookmark_id');

-- Get overall bookmark insights
-- SELECT * FROM get_bookmark_insights_summary();

-- Find duplicate bookmarks
-- SELECT * FROM find_duplicate_bookmarks();

-- Get daily bookmark analytics
-- SELECT * FROM bookmark_analytics ORDER BY extraction_date DESC LIMIT 30;

-- Get bookmarks with specific tags
-- SELECT * FROM bookmark_analysis WHERE tags ? 'ai' ORDER BY relevance_score DESC;

-- Get actionable bookmarks
-- SELECT * FROM bookmark_analysis WHERE actionable = TRUE ORDER BY quality_score DESC;

-- Get reference-worthy bookmarks
-- SELECT * FROM bookmark_analysis WHERE reference_worthy = TRUE ORDER BY learning_value DESC;