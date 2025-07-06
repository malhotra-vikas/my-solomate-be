-- Create function to find similar dialog examples using vector similarity
CREATE OR REPLACE FUNCTION find_similar_dialog_examples(
    persona_id UUID,
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    user_input TEXT,
    expected_response TEXT,
    context TEXT,
    style_tags TEXT[],
    personality_tags TEXT[],
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        db.id,
        db.user_input,
        db.expected_response,
        db.context,
        db.style_tags,
        db.personality_tags,
        1 - (db.embedding <=> query_embedding) as similarity
    FROM dialog_bank db
    WHERE 
        db.persona_id = find_similar_dialog_examples.persona_id
        AND 1 - (db.embedding <=> query_embedding) > match_threshold
    ORDER BY db.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to find similar memories using vector similarity
CREATE OR REPLACE FUNCTION find_similar_memories(
    user_id VARCHAR(255),
    persona_id UUID,
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    summary TEXT,
    similarity FLOAT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.summary,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.created_at
    FROM memories m
    WHERE 
        m.user_id = find_similar_memories.user_id
        AND m.persona_id = find_similar_memories.persona_id
        AND 1 - (m.embedding <=> query_embedding) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to get conversation context with vector search
CREATE OR REPLACE FUNCTION get_conversation_context(
    user_id VARCHAR(255),
    persona_id UUID,
    query_embedding vector(1536),
    days_back int DEFAULT 7,
    max_messages int DEFAULT 20
)
RETURNS TABLE (
    role VARCHAR(20),
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    relevance_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- First, try to get contextually relevant messages using vector similarity
    -- This would require storing embeddings for conversations too
    -- For now, return recent messages chronologically
    RETURN QUERY
    SELECT 
        c.role,
        c.content,
        c.timestamp,
        0.5 as relevance_score -- Placeholder relevance score
    FROM conversations c
    WHERE 
        c.user_id = get_conversation_context.user_id
        AND c.persona_id = get_conversation_context.persona_id
        AND c.timestamp >= NOW() - (days_back || ' days')::INTERVAL
    ORDER BY c.timestamp DESC
    LIMIT max_messages;
END;
$$;

-- Create indexes for better vector search performance
CREATE INDEX IF NOT EXISTS idx_dialog_bank_embedding_cosine 
ON dialog_bank USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine 
ON memories USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION find_similar_dialog_examples TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_memories TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_context TO authenticated;

-- Create a helper function to calculate embedding similarity
CREATE OR REPLACE FUNCTION calculate_similarity(
    embedding1 vector(1536),
    embedding2 vector(1536)
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 1 - (embedding1 <=> embedding2);
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_similarity TO authenticated;
