import { openai } from "./openai"

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error("Failed to generate embedding")
  }
}

export async function findSimilarDialogExamples(
  personaId: string,
  userInput: string,
  limit = 3,
  threshold = 0.7,
): Promise<any[]> {
  const { supabase } = await import("./supabase")

  // Generate embedding for user input
  const inputEmbedding = await generateEmbedding(userInput)

  // Find similar dialog examples using vector similarity
  const { data, error } = await supabase.rpc("find_similar_dialog_examples", {
    persona_id: personaId,
    query_embedding: inputEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error("Error finding similar dialog examples:", error)
    return []
  }

  return data || []
}
