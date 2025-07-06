-- Function to find similar dialog examples using vector similarity
CREATE OR REPLACE FUNCTION find_similar_dialog_examples(
  persona_id UUID,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  user_input TEXT,
  expected_response TEXT,
  context TEXT,
  style_tags TEXT[],
  personality_tags TEXT[],
  similarity float
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
  WHERE db.persona_id = find_similar_dialog_examples.persona_id
    AND 1 - (db.embedding <=> query_embedding) > match_threshold
  ORDER BY db.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
