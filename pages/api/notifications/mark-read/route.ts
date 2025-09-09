export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function POST(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
    }

    try {
        const { notificationId } = await req.json()

        if (!notificationId) {
            return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
        }

        const supabase = createClient()

        // Check if the notification exists and belongs to the user
        const { data: existing, error: fetchError } = await supabase
            .from("notifications")
            .select("id, status")
            .eq("id", notificationId)
            .eq("user_id", userId)
            .single()

        if (fetchError) {
            console.error("🔍 Notification fetch error:", fetchError)
            return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 })
        }

        if (existing.status === "read") {
            return NextResponse.json({ message: "Notification already marked as read" }, { status: 200 })
        }

        // Mark as read
        const { error: updateError } = await supabase
            .from("notifications")
            .update({ status: "read" })
            .eq("id", notificationId)
            .eq("user_id", userId)

        if (updateError) {
            console.error("❌ Update error:", updateError)
            return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 })
        }

        return NextResponse.json({ message: "Notification marked as read" }, { status: 200 })
    } catch (err: any) {
        console.error("❌ Internal server error:", err.message)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
