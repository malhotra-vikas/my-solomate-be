export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { getActiveTalkTimeForUser } from "@/lib/metering"

const PAID_TIERS = ["silver", "premium", "gold", "platinum"]

export async function GET(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
    }

    const { totalTalkSeconds, breakdown } = await getActiveTalkTimeForUser(userId)


    return NextResponse.json(
        {
            userId,
            totalTalkTimeSeconds: totalTalkSeconds,
            activeSubscriptions: breakdown,
        },
        { status: 200 },
    )
}
