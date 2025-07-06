import OpenAI from "openai"
import { createClient } from "./supabase"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
  try {
    // Generate embedding for user input
    const embedding = await generateEmbedding(userInput)

    const supabase = createClient()

    // Find similar examples using the PostgreSQL function
    const { data, error } = await supabase.rpc("find_similar_dialog_examples", {
      persona_id: personaId,
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error("Error finding similar dialog examples:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in findSimilarDialogExamples:", error)
    return []
  }
}

export async function findSimilarMemories(
  userId: string,
  personaId: string,
  query: string,
  limit = 5,
  threshold = 0.7,
): Promise<any[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)

    const supabase = createClient()

    // Find similar memories using the PostgreSQL function
    const { data, error } = await supabase.rpc("find_similar_memories", {
      user_id: userId,
      persona_id: personaId,
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error("Error finding similar memories:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in findSimilarMemories:", error)
    return []
  }
}

export function formatDialogExamples(examples: any[]): string {
  if (!examples || examples.length === 0) {
    return ""
  }

  const formattedExamples = examples
    .map((example, index) => {
      let formatted = `Example ${index + 1}:\n`
      formatted += `User: ${example.user_input}\n`
      formatted += `Assistant: ${example.expected_response}\n`

      if (example.context) {
        formatted += `Context: ${example.context}\n`
      }

      if (example.style_tags && example.style_tags.length > 0) {
        formatted += `Style: ${example.style_tags.join(", ")}\n`
      }

      if (example.personality_tags && example.personality_tags.length > 0) {
        formatted += `Personality: ${example.personality_tags.join(", ")}\n`
      }

      return formatted
    })
    .join("\n")

  return `\nHere are some examples of how you should respond based on your training:\n\n${formattedExamples}\nUse these examples as a guide for your tone, style, and personality. Respond naturally to the current conversation while maintaining consistency with these examples.\n`
}

export async function storeConversationEmbedding(conversationId: string, content: string): Promise<void> {
  try {
    const embedding = await generateEmbedding(content)

    const supabase = createClient()


    // Store embedding for future context retrieval
    // This could be used to make conversations searchable
    await supabase
      .from("conversations")
      .update({
        embedding: embedding,
      })
      .eq("id", conversationId)
  } catch (error) {
    console.error("Error storing conversation embedding:", error)
    // Don't throw error as this is not critical for the conversation flow
  }
}
