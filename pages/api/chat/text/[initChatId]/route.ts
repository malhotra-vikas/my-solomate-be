export const dynamic = "force-dynamic"

import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { createClient } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: { initChatId: string } }) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
    }
  
    const { initChatId } = await params
    const supabase = createClient()
  
    try {
      // ✅ Update conversation rows for this user + chat
      const { error } = await supabase
        .from("conversations")
        .update({ is_read_status: true })
        .eq("id", initChatId)
        .eq("user_id", userId) // ensure only their messages are marked as read
  
      if (error) {
        console.error("❌ Failed to update conversation read status:", error.message)
        return NextResponse.json(
          { error: "Failed to update conversation status" },
          { status: 500 }
        )
      }
  
      return NextResponse.json(
        { success: true, chatId: initChatId, userId },
        { status: 200 }
      )
    } catch (err) {
      console.error("❌ Unexpected error:", err)
      return NextResponse.json(
        { error: "Unexpected error occurred" },
        { status: 500 }
      )
    }
}  