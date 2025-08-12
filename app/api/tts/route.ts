import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function POST(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

    console.log("User is  ", userId)

    const callRequest = await req.json();

    console.log("Call Reqeust is ", callRequest)

    const personaId = callRequest.personaId
    const text = callRequest.text

    console.log("personaId is ", personaId)
    console.log("Text uis  ", text)

    if (!personaId || !text) {
        return NextResponse.json({ error: "Persona is required" }, { status: 400 })
    }

    try {
        if (!process.env.ELEVENLABS_API_KEY) {
            throw new Error("ElevenLabs API key not configured")
        }
        const supabase = createClient()

        // ✅ 1. Get a specific persona by ID
        const { data: persona, error } = await supabase
            .from("personas")
            .select("*")
            .eq("id", personaId)
            .eq("is_active", true)
            .single()

        if (error || !persona) {
            console.error("Persona not found:", error)
            return NextResponse.json({ error: "Persona not found" }, { status: 404 })
        }
        console.log("persona is ", persona)


        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${persona.voice_id}/stream`,
            {
                method: "POST",
                headers: {
                    Accept: "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_turbo_v2",
                    voice_settings: {
                        stability: persona.voice_config.stability,
                        similarity_boost: persona.voice_config.similarity_boost,
                        style: persona.voice_config.style,
                        use_speaker_boost: persona.voice_config.use_speaker_boost,
                    },
                }),
            },
        )

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`)
        }

        return new Response(response.body, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        })
    } catch (error) {
        console.error("TTS API error:", error)
        return new Response("Error generating speech", { status: 500 })
    }
}
