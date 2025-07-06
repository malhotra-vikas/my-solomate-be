-- Function to find similar dialog examples
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
    pdb.id,
    pdb.user_input,
    pdb.expected_response,
    pdb.context,
    pdb.style_tags,
    pdb.personality_tags,
    1 - (pdb.embedding <=> query_embedding) as similarity
  FROM persona_dialog_bank pdb
  WHERE pdb.persona_id = find_similar_dialog_examples.persona_id
    AND 1 - (pdb.embedding <=> query_embedding) > match_threshold
  ORDER BY pdb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
