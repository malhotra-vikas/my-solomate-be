import { NextRequest, NextResponse } from "next/server";
import { aiSdkOpenai, generateText } from "@/lib/openai";
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

const STREAM_LATENCY = process.env.ELEVEN_STREAM_LATENCY ?? "2";     // "0" | "1" | "2"
const OUTPUT_FORMAT = process.env.ELEVEN_OUTPUT_FORMAT || "mp3_22050_32";
const ELEVENLAB_VOICE_MODEL = process.env.ELEVENLAB_VOICE_MODEL ?? "eleven_multilingual_v2";
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

const CALL_STOP: string[] = (() => {
    try {
        return JSON.parse(process.env.CALL_STOP || "[]");
    } catch {
        console.warn("Invalid CALL_STOP env format, falling back to defaults");
        return ["\n\n", "User:", "You:", "USER:", "ASSISTANT:"];
    }
})();

export async function POST(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

    try {
        if (!ELEVEN_API_KEY) {
            return NextResponse.json(
                { ok: false, error: "Server misconfigured: ELEVENLABS_API_KEY missing" },
                { status: 500 }
            );
        }

        const { voiceId } = await req.json();
        if (!voiceId) {
            return NextResponse.json(
                { ok: false, error: "voiceId is required" },
                { status: 400 }
            );
        }

        // Kick both warmups in parallel
        const llmWarm = generateText({
            model: aiSdkOpenai("gpt-4o-mini"),
            messages: [
                { role: "system" as const, content: "You are a helpful assistant. Respond very briefly." },
                { role: "user" as const, content: "Hi" },
            ],
            maxTokens: 5,
            temperature: 0,
            stop: CALL_STOP,
        } as any);

        // Prepare ElevenLabs request
        const qs = new URLSearchParams();
        if (STREAM_LATENCY) qs.set("optimize_streaming_latency", STREAM_LATENCY);
        if (OUTPUT_FORMAT) qs.set("output_format", OUTPUT_FORMAT);

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream${qs.toString() ? `?${qs.toString()}` : ""}`;

        const payload = {
            text: "hi",
            model_id: ELEVENLAB_VOICE_MODEL,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0,
                use_speaker_boost: true,
            },
        };

        // Short timeout so prewarm never hangs
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const ttsWarm = fetch(url, {
            method: "POST",
            headers: {
                Accept: "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_API_KEY,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        // Wait for both, but don't fail if one does
        await Promise.allSettled([llmWarm, ttsWarm]);

        return NextResponse.json({ ok: true, warmed: true });
    } catch (err) {
        console.error("[PRE-WARM] failed", err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
