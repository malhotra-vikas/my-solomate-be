import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.warn("🚨 [DEPRECATED] POST /api/personas/[id]/add-friend is deprecated. Use /api/auth/user/attach-persona instead.")

  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const personaId = params.id

  return NextResponse.json({
    error: "This endpoint is deprecated. Use POST /api/auth/user/attach-persona instead."
  }, { status: 410 }) // 410 Gone is more precise than 404 or 400 for deprecated/retired routes
}
/*
try {
  const supabase = createClient()

  // Check if persona exists
  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("id")
    .eq("id", personaId)
    .single()

  if (personaError || !persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 })
  }

  // Simulate delay for "friend request"
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Add to user_personas table
  const { data, error } = await supabase
    .from("user_personas")
    .insert({ user_id: userId, persona_id: personaId })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      // Unique violation, already friended
      return NextResponse.json({ message: "Solo Mate already added as friend" }, { status: 200 })
    }
    console.error("Error adding persona as friend:", error)
    return NextResponse.json({ error: "Failed to add persona as friend" }, { status: 500 })
  }

  return NextResponse.json({ message: "Solo Mate added as friend successfully", data }, { status: 200 })
} catch (error: any) {
  console.error("Add friend error:", error.message)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
}
*/