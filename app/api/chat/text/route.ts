import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { aiSdkOpenai, generateText } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"

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

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { personaId, message } = await req.json()

    if (!personaId || !message) {
      return NextResponse.json({ error: "Persona ID and message are required" }, { status: 400 })
    }

    // 1. Fetch user profile and check talk time
    const { data: userProfile, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError || !userProfile) {
      console.error("User profile not found:", userError)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Text chat is free for all users, so no talk time check here.
    // For voice chat, you would check `userProfile.talk_time_minutes`

    // 2. Fetch persona details
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      console.error("Persona not found:", personaError)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    // 3. Retrieve short-term memory (last 5 days messages)
    const { data: recentConversations, error: convError } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .gte("timestamp", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()) // Last 5 days
      .order("timestamp", { ascending: true })
      .limit(20) // Limit to recent 20 messages for context

    if (convError) {
      console.error("Error fetching recent conversations:", convError)
      // Continue without recent conversations if there's an error
    }

    const messagesForAI = [
      { role: "system" as const, content: persona.initial_prompt },
      ...(recentConversations || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ]

    // 4. Generate AI response using OpenAI
    const { text: aiResponse } = await generateText({
      model: aiSdkOpenai("gpt-4o"),
      messages: messagesForAI,
    })

    // 5. Store user message in conversations
    await supabase.from("conversations").insert({
      user_id: userId,
      persona_id: personaId,
      role: "user",
      content: message,
    })

    // 6. Store AI response in conversations
    await supabase.from("conversations").insert({
      user_id: userId,
      persona_id: personaId,
      role: "assistant",
      content: aiResponse,
    })

    return NextResponse.json({ response: aiResponse }, { status: 200 })
  } catch (error: any) {
    console.error("Text chat error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
