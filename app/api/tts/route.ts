// app/api/tts/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { createClient } from "@/lib/supabase"
import { z } from "zod"

const BodySchema = z.object({
    personaId: z.string().uuid("personaId must be a valid UUID"),
    text: z.string().min(1, "text is required").max(10_000, "text too long"),
})

export async function POST(req: NextRequest) {
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
        console.log("User is  ", userId)
        console.log("Persona is  ", personaId)

        // 4) Fetch persona AND enforce ownership + active
        const { data: persona, error: personaErr } = await supabase
            .from("personas")
            .select("*")
            .eq("id", personaId)
            .eq("is_active", true)
            .single()

        if (personaErr || !persona) {
            return NextResponse.json({ error: "Persona not found" }, { status: 404 })
        }

        // 5) Defensive defaults for voice_config
        const vc = persona.voice_config ?? {}
        const payload = {
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: {
                stability: vc.stability ?? 0.5,
                similarity_boost: vc.similarity_boost ?? 0.75,
                style: vc.style ?? 0,
                use_speaker_boost: vc.use_speaker_boost ?? true,
            },
        }

        // 6) Call ElevenLabs with timeout + abort
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000) // 30s hard cap

        const resp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${persona.voice_id}/stream`,
            {
                method: "POST",
                headers: {
                    Accept: "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": apiKey,
                },
                body: JSON.stringify(payload)
                // Edge runtime streams by default; no need for duplex here
            }
        ).finally(() => clearTimeout(timeout))

        if (!resp.ok) {
            // Try to surface the vendor error message for easier debugging
            let vendorMsg = ""
            try {
                vendorMsg = await resp.text()
            } catch { }
            const status = resp.status
            // 422 for text issues (e.g., empty/prohibited), otherwise 502 upstream failure
            const mapped = status === 400 || status === 422 ? 422 : 502
            return NextResponse.json(
                { error: `TTS failed (${status})`, vendor: vendorMsg.slice(0, 500) },
                { status: mapped }
            )
        }

        // 7) Stream audio back to client
        // Passing the readable directly preserves streaming.
        return new Response(resp.body, {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-store",
            },
        })
    } catch (err: any) {
        // AbortError => canceled/timeout
        if (err?.name === "AbortError") {
            return NextResponse.json({ error: "TTS request timed out" }, { status: 504 })
        }
        console.error("TTS API error:", err)
        return NextResponse.json({ error: "Error generating speech" }, { status: 500 })
    }
}
