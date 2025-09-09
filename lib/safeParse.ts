import { NextRequest } from "next/server"

export async function safeParseJson(req: NextRequest): Promise<any | null> {
    try {
        const raw = await req.text()
        if (!raw || raw.trim() === "" || raw.trim() === "undefined") {
            return null
        }
        return JSON.parse(raw)
    } catch {
        return null
    }
}
