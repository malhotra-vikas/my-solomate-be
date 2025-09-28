export const runtime = "nodejs";

// app/api/tts/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { createClient } from "@/lib/supabase"
import { z } from "zod"
import WebSocket from "ws"

const BodySchema = z.object({
    personaId: z.string().uuid("personaId must be a valid UUID"),
    text: z.string().min(1, "text is required").max(10_000, "text too long"),
})

const ms = () => (globalThis.performance?.now?.() ?? Date.now());

export async function POST(req: NextRequest) {
    const t0 = ms();

    // 1) Auth
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
        return NextResponse.json(
            { error: "Unauthorized request or token expired" },
            { status: 401 }
        )
    }

    // 2) Parse & validate
    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch (e) {
        const message =
            e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : "Invalid JSON"
        return NextResponse.json({ error: message }, { status: 400 })
    }
    const { personaId, text } = body

    // 3) Config presence
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
        return NextResponse.json(
            { error: "Server misconfigured: ElevenLabs API key missing" },
            { status: 500 }
        )
    }

    try {
        const supabase = createClient()
        console.log("[TTS] user", userId)
        console.log("[TTS] personaId", personaId)

        // 4) Fetch persona (and validate active)
        const tPersona0 = ms();
        const { data: persona, error: personaErr } = await supabase
            .from("personas")
            .select("*")
            .eq("id", personaId)
            .eq("is_active", true)
            .maybeSingle()
        const tPersona1 = ms();
        console.log("[TTS] persona_fetch", { ms: Math.round(tPersona1 - tPersona0), ok: !personaErr })

        if (personaErr || !persona) {
            return NextResponse.json({ error: "Persona not found" }, { status: 404 })
        }
        console.log("[TTS] persona.voice_id", persona.voice_id)

        const ELEVENLAB_VOICE_MODEL = process.env.ELEVENLAB_VOICE_MODEL ?? "eleven_multilingual_v3"

        // 5) Prepare payload
        const vc = persona.voice_config ?? {}
        const modelId = ELEVENLAB_VOICE_MODEL
        const payload = {
            text,
            model_id: modelId,
            voice_settings: {
                stability: vc.stability ?? 0.5,
                similarity_boost: vc.similarity_boost ?? 0.75,
                style: vc.style ?? 0,
                use_speaker_boost: vc.use_speaker_boost ?? true,
            },
        }

        // --- WebSocket Streaming Implementation ---
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${persona.voice_id}/stream-input`
        const ws = new WebSocket(wsUrl, {
            headers: {
                "xi-api-key": apiKey,
                "accept": "audio/mpeg"
            },
            perMessageDeflate: false,  // prevent mask error
        })

        let firstByteAt: number | null = null
        let totalBytes = 0
        let chunks = 0
        let closed = false

        const stream = new ReadableStream({
            start(controller) {
                ws.on("open", () => {
                    ws.send(JSON.stringify(payload))
                    ws.send(JSON.stringify({ text: "" })) // close input
                })

                ws.on("message", (msg) => {
                    const data = JSON.parse(msg.toString())
                    if (data.audio) {
                        if (!firstByteAt) firstByteAt = ms()
                        const audioBuffer = Buffer.from(data.audio, "base64")
                        totalBytes += audioBuffer.byteLength
                        chunks++
                        controller.enqueue(audioBuffer)
                    }
                    if (data.isFinal && !closed) {
                        closed = true
                        controller.close()
                        ws.close()
                    }
                })

                ws.on("error", (err) => {
                    console.error("[TTS] ws_error", err)
                    controller.error(err)
                })
            }
        })

        const headers = new Headers({
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
            "x-tts-first-byte-ms": String(firstByteAt ? Math.round(firstByteAt - t0) : 0),
            "x-tts-chunks": String(chunks),
            "x-tts-bytes": String(totalBytes),
            "x-tts-model": ELEVENLAB_VOICE_MODEL,
        })

        return new Response(stream, { status: 200, headers })

    } catch (err: any) {
        console.error("[TTS] error", err)
        return NextResponse.json({ error: "Error generating speech" }, { status: 500 })
    }
}
