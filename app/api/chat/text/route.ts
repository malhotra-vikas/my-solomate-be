import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { aiSdkOpenai, generateText } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"
import { findSimilarDialogExamples } from "@/lib/embeddings"

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

    // 1. Fetch user profile
    const { data: userProfile, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError || !userProfile) {
      console.error("User profile not found:", userError)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

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

    // 3. Retrieve recent conversations for context
    const { data: recentConversations, error: convError } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .gte("timestamp", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
      .order("timestamp", { ascending: true })
      .limit(20)

    if (convError) {
      console.error("Error fetching recent conversations:", convError)
    }

    // 4. Find similar dialog examples for style/personality training
    const similarExamples = await findSimilarDialogExamples(personaId, message, 3, 0.7)

    // 5. Build enhanced prompt with training examples
    let enhancedPrompt = persona.initial_prompt

    if (similarExamples.length > 0) {
      enhancedPrompt += "\n\nHere are some examples of how you should respond based on your training:\n"
      similarExamples.forEach((example, index) => {
        enhancedPrompt += `\nExample ${index + 1}:\n`
        enhancedPrompt += `User: ${example.user_input}\n`
        enhancedPrompt += `You: ${example.expected_response}\n`
        if (example.context) {
          enhancedPrompt += `Context: ${example.context}\n`
        }
      })
      enhancedPrompt += "\nNow respond to the current user message in a similar style and personality:\n"
    }

    const messagesForAI = [
      { role: "system" as const, content: enhancedPrompt },
      ...(recentConversations || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ]

    // 6. Generate AI response
    const { text: aiResponse } = await generateText({
      model: aiSdkOpenai("gpt-4o"),
      messages: messagesForAI,
    })

    // 7. Store conversation messages
    await supabase.from("conversations").insert([
      {
        user_id: userId,
        persona_id: personaId,
        role: "user",
        content: message,
      },
      {
        user_id: userId,
        persona_id: personaId,
        role: "assistant",
        content: aiResponse,
      },
    ])

    return NextResponse.json(
      {
        response: aiResponse,
        training_examples_used: similarExamples.length,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Text chat error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
