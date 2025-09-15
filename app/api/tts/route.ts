// app/api/tts/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { createClient } from "@/lib/supabase"
import { z } from "zod"

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

    // Optional latency tuning via env (safe no-ops if vendor ignores them)
    const STREAM_LATENCY = process.env.ELEVEN_STREAM_LATENCY ?? "2"; // type: string
    const OUTPUT_FORMAT = process.env.ELEVEN_OUTPUT_FORMAT || "mp3_22050_32";

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
            .single()
        const tPersona1 = ms();
        console.log("[TTS] persona_fetch", { ms: Math.round(tPersona1 - tPersona0), ok: !personaErr })

        if (personaErr || !persona) {
            return NextResponse.json({ error: "Persona not found" }, { status: 404 })
        }
        console.log("[TTS] persona.voice_id", persona.voice_id)

        const ELEVENLAB_VOICE_MODEL = process.env.ELEVENLAB_VOICE_MODEL ?? "eleven_multilingual_v2"

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

        // 6) Call ElevenLabs with timeout + instrumentation
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000) // 30s hard cap

        const tFetch0 = ms();
        const qs = new URLSearchParams()
//        if (STREAM_LATENCY) qs.set("optimize_streaming_latency", STREAM_LATENCY)
        
        // Only add optimize_streaming_latency if the model supports it
        if (STREAM_LATENCY && ELEVENLAB_VOICE_MODEL === "eleven_turbo_v2") {
            qs.set("optimize_streaming_latency", STREAM_LATENCY);
        }

        if (OUTPUT_FORMAT) qs.set("output_format", OUTPUT_FORMAT)

        const vendorUrl =
            `https://api.elevenlabs.io/v1/text-to-speech/${persona.voice_id}/stream` +
            (qs.toString() ? `?${qs.toString()}` : "")

        const vendorResp = await fetch(vendorUrl, {
            method: "POST",
            headers: {
                Accept: "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": apiKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        }).finally(() => clearTimeout(timeout))
        const tFetch1 = ms();

        const vendor_ms = Math.round(tFetch1 - tFetch0)

        if (!vendorResp.ok || !vendorResp.body) {
            let vendorMsg = ""
            try { vendorMsg = await vendorResp.text() } catch { }
            const status = vendorResp.status || 502
            const mapped = status === 400 || status === 422 ? 422 : 502
            console.error("[TTS] vendor_error", { status, vendor_ms, vendorMsg: vendorMsg.slice(0, 300) })
            return NextResponse.json(
                { error: `TTS failed (${status})`, vendor: vendorMsg.slice(0, 500) },
                { status: mapped }
            )
        }

        // 7) Intercept stream to measure first-byte and total bytes, while still streaming to the client
        const reader = vendorResp.body.getReader()
        let firstByteAt: number | null = null
        let totalBytes = 0
        let chunkCount = 0

        // Read first chunk to capture first-byte latency, then construct a stream that includes it and continues piping
        const tFirstChunk0 = ms()
        const first = await reader.read() // waits for first bytes from vendor
        const tFirstChunk1 = ms()

        if (first.done) {
            // Vendor returned empty body; close early
            console.warn("[TTS] empty_stream", { vendor_ms })
            const res = new NextResponse(new Uint8Array(0), {
                status: 200,
                headers: {
                    "Content-Type": "audio/mpeg",
                    "Cache-Control": "no-store",
                    "x-tts-vendor-ms": String(vendor_ms),
                    "x-tts-first-byte-ms": "0",
                    "x-tts-total-ms": String(Math.round(ms() - tFetch0)),
                    "x-tts-bytes": "0",
                    "x-tts-chunks": "0",
                    "x-tts-model": modelId,
                    "x-tts-latency": STREAM_LATENCY,
                },
            })
            return res
        }

        // We have first chunk
        firstByteAt = tFirstChunk1
        totalBytes += first.value.byteLength
        chunkCount += 1
        const firstChunk = first.value
        const first_byte_ms = Math.round(firstByteAt - tFetch0)

        // Build a new stream that first enqueues the first chunk, then pipes the rest
        const ttsStream = new ReadableStream({
            async start(controller) {
                try {
                    controller.enqueue(firstChunk)
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        totalBytes += value.byteLength
                        chunkCount += 1
                        controller.enqueue(value)
                    }
                } catch (err) {
                    console.error("[TTS] stream_error", err)
                    throw err
                } finally {
                    controller.close()
                    try { reader.releaseLock() } catch { }
                    const total_ms = Math.round(ms() - tFetch0)
                    console.log("[TTS] metrics", {
                        vendor_ms,
                        first_byte_ms: first_byte_ms,
                        total_ms,
                        bytes: totalBytes,
                        chunks: chunkCount,
                        model: modelId,
                        latency_mode: STREAM_LATENCY,
                        format: OUTPUT_FORMAT ?? "default",
                    })
                }
            }
        })

        // 8) Return streaming response with telemetry headers
        const resHeaders = new Headers({
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
            "x-tts-vendor-ms": String(vendor_ms),
            "x-tts-first-byte-ms": String(first_byte_ms),
            // total_ms will be close to real final; it's measured at close, but we surface the best approximation now
            "x-tts-total-ms": String(Math.round(ms() - tFetch0)),
            "x-tts-bytes": String(totalBytes), // will be bytes after first chunk; final bytes in logs
            "x-tts-chunks": String(chunkCount), // same note as above
            "x-tts-model": modelId,
            "x-tts-latency": STREAM_LATENCY,
            ...(OUTPUT_FORMAT ? { "x-tts-format": OUTPUT_FORMAT } : {}),
        })

        return new Response(ttsStream, { status: 200, headers: resHeaders })
    } catch (err: any) {
        if (err?.name === "AbortError") {
            console.error("[TTS] abort_timeout")
            return NextResponse.json({ error: "TTS request timed out" }, { status: 504 })
        }
        console.error("[TTS] error", err)
        return NextResponse.json({ error: "Error generating speech" }, { status: 500 })
    }
}
