import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { openai } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"
import type { Memory } from "@/types"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
  }

  try {
    const { personaId, conversationSegment, summary } = await req.json()

    if (!personaId || !conversationSegment || !summary) {
      return NextResponse.json({ error: "Persona ID, conversation segment, and summary are required" }, { status: 400 })
    }

    // 1. Generate embedding for the summary
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002", // Or a newer embedding model if available
      input: summary,
    })
    const embedding = embeddingResponse.data[0].embedding
    const supabase = createClient()

    // 2. Store long-term memory in Supabase
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: userId,
        persona_id: personaId,
        summary: summary,
        embedding: embedding,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error storing long-term memory:", error)
      return NextResponse.json({ error: "Failed to store long-term memory" }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Failed to store long-term memory" }, { status: 500 })
    }

    // Optionally, mark the conversation messages as converted to long-term memory
    // This would require passing message IDs from the client or a more complex logic
    // For simplicity, we'll just store the new memory.

    return NextResponse.json(
      {
        message: "Long-term memory stored successfully",
        memory: data as Memory,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Short-to-long memory conversion error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
