-- Supabase schema for bookmark processing
-- Run this in your Supabase SQL editor to create the necessary tables

-- Create RPC function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = table_name
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to execute SQL
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS JSON AS $$
BEGIN
    EXECUTE sql;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookmark_id TEXT UNIQUE NOT NULL,
    bookmark_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Bookmark content
    content TEXT NOT NULL,
    html_content TEXT,
    
    -- AI Analysis
    ai_provider TEXT DEFAULT 'fallback',
    reason TEXT,
    tags TEXT[] DEFAULT '{}',
    entities TEXT[] DEFAULT '{}',
    concepts TEXT[] DEFAULT '{}',
    
    -- Sentiment
    sentiment_label TEXT DEFAULT 'neutral',
    sentiment_confidence DECIMAL DEFAULT 0.5,
    
    -- Classification
    content_type TEXT DEFAULT 'general',
    categories TEXT[] DEFAULT '{}',
    
    -- Scores
    relevance_score DECIMAL DEFAULT 0.5,
    quality_score DECIMAL DEFAULT 0.5,
    value_score DECIMAL DEFAULT 0.5,
    composite_score DECIMAL DEFAULT 0.5,
    engagement_potential DECIMAL DEFAULT 0.5,
    readability_score DECIMAL DEFAULT 0.5,
    
    -- Flags
    actionable BOOLEAN DEFAULT FALSE,
    reference_worthy BOOLEAN DEFAULT FALSE,
    
    -- Features
    word_count INTEGER DEFAULT 0,
    hashtag_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    url_count INTEGER DEFAULT 0,
    emoji_count INTEGER DEFAULT 0,
    
    -- Media
    has_images BOOLEAN DEFAULT FALSE,
    has_video BOOLEAN DEFAULT FALSE,
    has_youtube BOOLEAN DEFAULT FALSE,
    is_thread BOOLEAN DEFAULT FALSE,
    media_count INTEGER DEFAULT 0,
    
    -- Insights
    key_insights TEXT[] DEFAULT '{}',
    
    -- Metadata
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',
    urls TEXT[] DEFAULT '{}'
);

-- Create processing_logs table
CREATE TABLE IF NOT EXISTS processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Processing details
    total_bookmarks INTEGER DEFAULT 0,
    successfully_processed INTEGER DEFAULT 0,
    failed_processing INTEGER DEFAULT 0,
    average_quality_score DECIMAL DEFAULT 0,
    average_relevance_score DECIMAL DEFAULT 0,
    
    -- Processing metadata
    processing_duration INTEGER, -- seconds
    errors TEXT[] DEFAULT '{}',
    
    -- Summary
    summary JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_processed_at ON bookmarks(processed_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_bookmark_hash ON bookmarks(bookmark_hash);
CREATE INDEX IF NOT EXISTS idx_bookmarks_content_type ON bookmarks(content_type);
CREATE INDEX IF NOT EXISTS idx_bookmarks_categories ON bookmarks USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON bookmarks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bookmarks_relevance_score ON bookmarks(relevance_score);
CREATE INDEX IF NOT EXISTS idx_bookmarks_quality_score ON bookmarks(quality_score);
CREATE INDEX IF NOT EXISTS idx_bookmarks_reference_worthy ON bookmarks(reference_worthy);

-- Create RLS policies (optional - for security)
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (modify as needed)
CREATE POLICY "Allow all operations on bookmarks" ON bookmarks
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on processing_logs" ON processing_logs
    FOR ALL USING (true);

-- Create a view for easy querying
CREATE OR REPLACE VIEW bookmark_summary AS
SELECT 
    id,
    bookmark_id,
    created_at,
    content,
    ai_provider,
    reason,
    tags,
    categories,
    content_type,
    sentiment_label,
    relevance_score,
    quality_score,
    value_score,
    composite_score,
    actionable,
    reference_worthy,
    key_insights,
    word_count,
    hashtag_count,
    mention_count,
    url_count
FROM bookmarks
ORDER BY created_at DESC;

-- Create a function to get bookmarks by category
CREATE OR REPLACE FUNCTION get_bookmarks_by_category(category_name TEXT)
RETURNS TABLE (
    id UUID,
    bookmark_id TEXT,
    content TEXT,
    relevance_score DECIMAL,
    quality_score DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.bookmark_id,
        b.content,
        b.relevance_score,
        b.quality_score,
        b.created_at
    FROM bookmarks b
    WHERE category_name = ANY(b.categories)
    ORDER BY b.relevance_score DESC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get top insights
CREATE OR REPLACE FUNCTION get_top_insights(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    insight TEXT,
    bookmark_count BIGINT,
    avg_quality_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(key_insights) as insight,
        COUNT(*) as bookmark_count,
        AVG(quality_score) as avg_quality_score
    FROM bookmarks
    WHERE key_insights IS NOT NULL AND array_length(key_insights, 1) > 0
    GROUP BY unnest(key_insights)
    ORDER BY bookmark_count DESC, avg_quality_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Sample queries for reference:

-- Get high-quality bookmarks from last 7 days
-- SELECT * FROM bookmarks 
-- WHERE quality_score > 0.7 
-- AND created_at > NOW() - INTERVAL '7 days'
-- ORDER BY quality_score DESC;

-- Get bookmarks by tag
-- SELECT * FROM bookmarks 
-- WHERE 'ai' = ANY(tags)
-- ORDER BY relevance_score DESC;

-- Get reference-worthy bookmarks
-- SELECT bookmark_id, content, quality_score, relevance_score
-- FROM bookmarks 
-- WHERE reference_worthy = TRUE
-- ORDER BY composite_score DESC;

-- Get processing statistics
-- SELECT 
--     DATE(created_at) as date,
--     COUNT(*) as total_processed,
--     AVG(quality_score) as avg_quality,
--     AVG(relevance_score) as avg_relevance
-- FROM bookmarks
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;