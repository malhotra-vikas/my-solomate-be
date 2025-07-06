import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { ConversationMessage } from "@/types"

// Helper to get user ID from Authorization header
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const idToken = authHeader.split(" ")[1]
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken.uid
  } catch (error) {
    console.error("Error verifying ID token:", error)
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: { personaId: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { personaId } = params
  const supabase = createClient()

  try {
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .order("timestamp", { ascending: true })

    if (error) {
      console.error("Error fetching conversation history:", error)
      return NextResponse.json({ error: "Failed to fetch conversation history" }, { status: 500 })
    }

    return NextResponse.json(conversations as ConversationMessage[], { status: 200 })
  } catch (error: any) {
    console.error("GET chat history error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
