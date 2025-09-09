export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function GET(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
    }

    try {
        const supabase = createClient()

        const { data: notifications, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("send_at", { ascending: false }) // latest first
            .limit(50)

        if (error) {
            console.error("Failed to fetch notifications:", error.message)
            return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
        }

        return NextResponse.json({ notifications }, { status: 200 })
    } catch (err: any) {
        console.error("Error fetching notifications:", err.message)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
