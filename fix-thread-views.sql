-- Fix Thread Database Views and Functions
-- Addresses the issues found in testing

-- Fix get_thread_statistics function return type
DROP FUNCTION IF EXISTS get_thread_statistics();

CREATE OR REPLACE FUNCTION get_thread_statistics()
RETURNS TABLE (
    total_threads BIGINT,
    total_thread_tweets BIGINT,
    avg_thread_length NUMERIC,
    bookmarked_threads BIGINT,
    completed_threads BIGINT,
    avg_thread_coherence NUMERIC,
    top_thread_themes TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT tr.thread_id) as total_threads,
        COUNT(tm.id) as total_thread_tweets,
        ROUND(AVG(tr.thread_length), 2) as avg_thread_length,
        COUNT(DISTINCT CASE WHEN tm.is_bookmark THEN tr.thread_id END) as bookmarked_threads,
        COUNT(DISTINCT CASE WHEN tr.completion_status = 'complete' THEN tr.thread_id END) as completed_threads,
        ROUND(AVG(ta.thread_coherence), 3) as avg_thread_coherence,
        array_agg(DISTINCT ta.thread_theme) FILTER (WHERE ta.thread_theme IS NOT NULL) as top_thread_themes
    FROM thread_relationships tr
    LEFT JOIN twitter_memos tm ON tm.thread_id = tr.thread_id
    LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id;
END;
$$ LANGUAGE plpgsql;

-- Update bookmark_analysis_with_threads view to include has_thread_context
DROP VIEW IF EXISTS bookmark_analysis_with_threads;

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
    CASE WHEN tm.thread_id IS NOT NULL THEN TRUE ELSE FALSE END as has_thread_context,
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

-- Create a simplified thread-enabled bookmark view for ChatGPT
CREATE OR REPLACE VIEW chatgpt_bookmarks_with_threads AS
SELECT 
    tm.id,
    tm.text,
    tm.author,
    tm.url,
    tm.created_at,
    tm.bookmark_extracted_at,
    ta.quality_score,
    ta.relevance_score,
    ta.learning_value,
    ta.composite_score,
    ta.categories,
    ta.tags,
    ta.key_insights,
    ta.knowledge_category,
    ta.sentiment,
    ta.reference_worthy,
    ta.actionable,
    tm.is_thread,
    tm.thread_id,
    tm.thread_position,
    tm.thread_total_tweets,
    ta.thread_theme,
    ta.thread_coherence,
    ta.thread_summary,
    ta.key_thread_insights,
    tr.thread_length,
    tr.completion_status as thread_status,
    CASE WHEN tm.thread_id IS NOT NULL THEN TRUE ELSE FALSE END as has_thread_context
FROM twitter_memos tm
LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id
LEFT JOIN thread_relationships tr ON tm.thread_id = tr.thread_id
WHERE tm.is_bookmark = TRUE
ORDER BY tm.bookmark_extracted_at DESC;

-- Create RPC function for ChatGPT to get thread context
CREATE OR REPLACE FUNCTION get_bookmark_with_thread_context(bookmark_id TEXT)
RETURNS TABLE (
    bookmark_info JSONB,
    thread_context JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jsonb_build_object(
            'id', tm.id,
            'text', tm.text,
            'author', tm.author,
            'url', tm.url,
            'quality_score', ta.quality_score,
            'learning_value', ta.learning_value,
            'categories', ta.categories,
            'key_insights', ta.key_insights,
            'is_thread', tm.is_thread,
            'thread_position', tm.thread_position
        ) as bookmark_info,
        CASE 
            WHEN tm.thread_id IS NOT NULL THEN
                jsonb_build_object(
                    'thread_id', tm.thread_id,
                    'thread_theme', ta.thread_theme,
                    'thread_summary', ta.thread_summary,
                    'thread_length', tr.thread_length,
                    'thread_tweets', (
                        SELECT json_agg(
                            json_build_object(
                                'position', tm2.thread_position,
                                'text', tm2.text,
                                'author', tm2.author,
                                'url', tm2.url
                            ) ORDER BY tm2.thread_position
                        )
                        FROM twitter_memos tm2 
                        WHERE tm2.thread_id = tm.thread_id
                    )
                )
            ELSE NULL
        END as thread_context
    FROM twitter_memos tm
    LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id
    LEFT JOIN thread_relationships tr ON tm.thread_id = tr.thread_id
    WHERE tm.id = bookmark_id;
END;
$$ LANGUAGE plpgsql;

-- Create function for ChatGPT to search thread-aware bookmarks
CREATE OR REPLACE FUNCTION search_threaded_bookmarks(
    search_query TEXT DEFAULT NULL,
    min_quality DOUBLE PRECISION DEFAULT 0.0,
    include_threads_only BOOLEAN DEFAULT FALSE,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    text TEXT,
    author TEXT,
    quality_score DOUBLE PRECISION,
    thread_theme TEXT,
    thread_summary TEXT,
    has_thread BOOLEAN,
    thread_length INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.id,
        tm.text,
        tm.author,
        ta.quality_score,
        ta.thread_theme,
        ta.thread_summary,
        tm.is_thread,
        tr.thread_length
    FROM twitter_memos tm
    LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id
    LEFT JOIN thread_relationships tr ON tm.thread_id = tr.thread_id
    WHERE tm.is_bookmark = TRUE
    AND (min_quality = 0 OR ta.quality_score >= min_quality)
    AND (NOT include_threads_only OR tm.is_thread = TRUE)
    AND (search_query IS NULL OR tm.text ILIKE '%' || search_query || '%')
    ORDER BY 
        CASE WHEN tm.is_thread THEN ta.quality_score * 1.2 ELSE ta.quality_score END DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;