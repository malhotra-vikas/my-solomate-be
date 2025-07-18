import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { aiSdkOpenai, generateText, openai } from "@/lib/openai"
import { elevenlabs } from "@/lib/elevenlabs"
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
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File
    const personaId = formData.get("personaId") as string

    if (!audioFile || !personaId) {
      return NextResponse.json({ error: "Audio file and persona ID are required" }, { status: 400 })
    }
    const supabase = createClient()

    // 1. Fetch user profile and check talk time
    const { data: userProfile, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError || !userProfile) {
      console.error("User profile not found:", userError)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    if (userProfile.current_tier === "free" && userProfile.talk_time_minutes <= 0) {
      return NextResponse.json(
        { error: "You have run out of free talk time. Please subscribe or purchase more minutes." },
        { status: 403 },
      )
    }

    // 2. Speech-to-Text (Whisper)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    })
    const userMessageText = transcription.text

    // 3. Fetch persona details
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      console.error("Persona not found:", personaError)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    // 4. Retrieve short-term memory (last 5 days messages)
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
      { role: "user" as const, content: userMessageText },
    ]

    // 5. Generate AI response using OpenAI
    const { text: aiResponseText } = await generateText({
      model: aiSdkOpenai("gpt-4o"),
      messages: messagesForAI,
    })

    // 6. Text-to-Speech (ElevenLabs)
    const audioStream = await elevenlabs.generate({
      voice_id: persona.voice_id,
      text: aiResponseText,
      model_id: "eleven_multilingual_v2", // Or another suitable model
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.5, // Adjust for emotion management
        use_speaker_boost: true,
      },
    })

    // Convert audio stream to a buffer
    const audioBuffer = Buffer.from(await audioStream.arrayBuffer())

    // 7. Store audio in Supabase Storage
    const audioFileName = `${userId}/${personaId}/${Date.now()}.mp3`
    const { data: storageData, error: storageError } = await supabase.storage
      .from("conversationaudio") // Create a bucket named 'conversationaudio' in Supabase
      .upload(audioFileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      })

    if (storageError) {
      console.error("Error uploading audio to Supabase Storage:", storageError)
      // Decide how to handle: return text only, or error
      return NextResponse.json({ error: "Failed to store audio response" }, { status: 500 })
    }

    const audioUrl = supabase.storage.from("conversationaudio").getPublicUrl(storageData.path).data.publicUrl

    // 8. Store user message and AI response in conversations
    await supabase.from("conversations").insert({
      user_id: userId,
      persona_id: personaId,
      role: "user",
      content: userMessageText,
    })

    await supabase.from("conversations").insert({
      user_id: userId,
      persona_id: personaId,
      role: "assistant",
      content: aiResponseText,
      audio_url: audioUrl,
    })

    // 9. Deduct talk time (example: 1 minute per voice interaction)
    const newTalkTime = Math.max(0, userProfile.talk_time_minutes - 1)
    await supabase.from("users").update({ talk_time_minutes: newTalkTime }).eq("id", userId)

    return NextResponse.json(
      {
        userMessage: userMessageText,
        aiResponse: aiResponseText,
        audioUrl: audioUrl,
        remainingTalkTime: newTalkTime,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Voice chat error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
