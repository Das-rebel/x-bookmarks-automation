-- Fix the round function issue in get_thread_statistics
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
        ROUND(AVG(tr.thread_length::numeric), 2) as avg_thread_length,
        COUNT(DISTINCT CASE WHEN tm.is_bookmark THEN tr.thread_id END) as bookmarked_threads,
        COUNT(DISTINCT CASE WHEN tr.completion_status = 'complete' THEN tr.thread_id END) as completed_threads,
        ROUND(AVG(ta.thread_coherence::numeric), 3) as avg_thread_coherence,
        array_agg(DISTINCT ta.thread_theme) FILTER (WHERE ta.thread_theme IS NOT NULL) as top_thread_themes
    FROM thread_relationships tr
    LEFT JOIN twitter_memos tm ON tm.thread_id = tr.thread_id
    LEFT JOIN tweet_analysis ta ON tm.id = ta.tweet_id;
END;
$$ LANGUAGE plpgsql;