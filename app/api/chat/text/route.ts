import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { aiSdkOpenai, generateText } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"
import { findSimilarDialogExamples } from "@/lib/embeddings"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

// ✅ GET: Get single chat message by chatId
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get("chatId")

  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  return NextResponse.json(data, { status: 200 })
}

// ✅ DELETE: Delete single chat message by chatId
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get("chatId")
  const personaId = searchParams.get("personaId")
  const deleteAllForUser = searchParams.get("deleteAllForUser")


  // Delete chat by Chat ID
  if (chatId) {
    const supabase = createClient()

    const { data, error: selectError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single()

    if (selectError || !data) {
      return NextResponse.json({ error: "No matching Chat found for user" }, { status: 404 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", chatId)
      .eq("user_id", userId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 })
    }

    return NextResponse.json({ message: "Chat deleted" }, { status: 200 })
  }

  // Delete all chat for this user by Persona ID
  if (personaId) {
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .limit(1)

    if (fetchError || !data || data.length === 0) {
      return NextResponse.json({ message: "No chats found for this persona" }, { status: 200 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", userId)
      .eq("persona_id", personaId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete chats for persona" }, { status: 500 })
    }

    return NextResponse.json({ message: `Chats with persona ${personaId} deleted` }, { status: 200 })
  }

  // ✅ DELETE: Delete all chats for current user
  if (deleteAllForUser) {
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .limit(1)

    if (fetchError || !data || data.length === 0) {
      return NextResponse.json({ message: "No chats to delete for user" }, { status: 200 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", userId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete all chats" }, { status: 500 })
    }

    return NextResponse.json({ message: "All user chats deleted" }, { status: 200 })

  }

}

// ✅ POST: Create a single chat message and persist it
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
  }

  try {
    const { personaId, message, initiateChat, isCall } = await req.json()
    console.log("In Chat: Recieved User Message ", message)

    if (!personaId && (message || initiateChat)) {
      return NextResponse.json({ error: "Persona ID is required" }, { status: 400 })
    }

    // Send the 1st Seeding Chat message to the User
    if (initiateChat) {
      const supabase = createClient()

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

      // 5. Build enhanced prompt with training examples
      let enhancedPrompt = persona.initial_prompt

      const messagesForAI = [
        { role: "system" as const, content: enhancedPrompt },
      ]

      // 6. Generate AI response
      const { text: aiResponse } = await generateText({
        model: aiSdkOpenai("gpt-4o"),
        messages: messagesForAI,
      })
      console.log("In Chat: Persona Initiated chat with ", aiResponse)

      try {
        // 7. Store conversation messages
        await supabase.from("conversations").insert([
          {
            user_id: userId,
            persona_id: personaId,
            role: "assistant",
            content: aiResponse,
          },
        ])
        console.log("The chat is stored in conversations ")

      } catch (err) {
        console.log("The chat failed to get stored in conversations ", err)

      }
      return NextResponse.json(
        {
          response: aiResponse
        },
        { status: 200 },
      )
    }

    const supabase = createClient()

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
    console.log("In Chat: Persona responsed with ", aiResponse)

    if (!isCall) {
      try {
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
        console.log("The chat is stored in conversations ")
      } catch (err) {
        console.log("The chat failed to get stored in conversations ", err)

      }
    }
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
