import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { aiSdkOpenai, generateText, openai } from "@/lib/openai"
import { elevenlabs } from "@/lib/elevenlabs"
import { auth } from "@/lib/firebaseAdmin"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { getAudioDurationInSeconds } from "get-audio-duration"
import { Readable } from "stream"

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
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

    // 1. Fetch user profile
    const { data: userProfile, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError || !userProfile) {
      console.error("User profile not found:", userError)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // 2. Check subscription
    const { data: userSubscription, error: userSubscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single()
    if (userSubscriptionError || !userSubscription) {
      console.error("User subscription not found:", userSubscriptionError)
      return NextResponse.json({ error: "Active User subscription not found" }, { status: 404 })
    }

    const remainingTalkTime = userSubscription.talk_seconds_remaining
    console.log("remainingTalkTime is ", remainingTalkTime)

    if (remainingTalkTime <= 0) {
      return NextResponse.json(
        { error: "You have run out of free talk time. Please subscribe or purchase more talk time." },
        { status: 403 },
      )
    }

    // 3. Transcribe user audio (Whisper)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    })
    const userMessageText = transcription.text

    // Get user audio duration
    const userAudioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const userAudioDuration = await getAudioDurationInSeconds(userAudioBuffer)
    console.log("User audio duration (sec):", userAudioDuration)

    // 4. Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      console.error("Persona not found:", personaError)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    // 5. Retrieve recent memory (last 5 days messages)
    const { data: recentConversations, error: convError } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .gte("timestamp", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()) // Last 5 days
      .order("timestamp", { ascending: true })
      //.limit(20) // Limit to recent 20 messages for context

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

    // 6. Generate AI text using OpenAI
    const { text: aiResponseText } = await generateText({
      model: aiSdkOpenai("gpt-4o"),
      messages: messagesForAI,
    })

    // 7. Generate AI voice using ElevenLabs
    const elevenStream = await elevenlabs.generate({
      voice_id: persona.voice_id,
      text: aiResponseText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.5, // Adjust for emotion management
        use_speaker_boost: true,
      },
    })

    const assistantAudioBuffer = await streamToBuffer(elevenStream)
    const assistantAudioDuration = await getAudioDurationInSeconds(assistantAudioBuffer)
    console.log("Assistant audio duration (sec):", assistantAudioDuration)

    // 8. Store audio in Supabase Storage
    const audioFileName = `${userId}/${personaId}/${Date.now()}.mp3`
    const { data: storageData, error: storageError } = await supabase.storage
      .from("conversationaudio")
      .upload(audioFileName, assistantAudioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      })
    if (storageError) {
      console.error("Error uploading audio to Supabase Storage:", storageError)
      return NextResponse.json({ error: "Failed to store audio response" }, { status: 500 })
    }

    const audioUrl = supabase.storage.from("conversationaudio").getPublicUrl(storageData.path).data.publicUrl

    // 9. Store messages
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

    // 10. Deduct talk time based on both durations
    const totalTalkTimeUsed = Math.ceil(userAudioDuration + assistantAudioDuration)
    const newTalkTime = Math.max(0, remainingTalkTime - totalTalkTimeUsed)

    console.log("Updating Remaining Talk time as (sec):", newTalkTime)

    await supabase.from("subscriptions").update({ talk_seconds_remaining: newTalkTime }).eq("user_id", userId)

    return NextResponse.json(
      {
        userMessage: userMessageText,
        aiResponse: aiResponseText,
        audioUrl,
        durations: {
          user: userAudioDuration,
          assistant: assistantAudioDuration,
        },
        remainingTalkTime: newTalkTime,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Voice chat error:", error.message, error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
