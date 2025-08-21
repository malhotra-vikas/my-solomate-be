import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { Conversation } from "@/types"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function GET(req: NextRequest, { params }: { params: { personaId: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
  }

  const { personaId } = await params
  const supabase = createClient()

  try {

    let query = supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "text") // Fetch only Texts in the conversation History
      .order("timestamp", { ascending: false })

    if (personaId) {
      query = query.eq("persona_id", personaId)
    }
    const { data: conversations, error } = await query

    if (error) {
      console.error("Error fetching conversation history:", error)
      return NextResponse.json({ error: "Failed to fetch conversation history" }, { status: 500 })
    }

    return NextResponse.json(conversations as Conversation[], { status: 200 })
  } catch (error: any) {
    console.error("GET chat history error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
