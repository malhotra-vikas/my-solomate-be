import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"

// Helper to get user ID from Authorization header
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const idToken = authHeader.split(" ")[1]
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken.uid
  } catch (error) {
    console.error("Error verifying ID token:", error)
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const personaId = params.id

  try {
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
        return NextResponse.json({ message: "Persona already added as friend" }, { status: 200 })
      }
      console.error("Error adding persona as friend:", error)
      return NextResponse.json({ error: "Failed to add persona as friend" }, { status: 500 })
    }

    return NextResponse.json({ message: "Persona added as friend successfully", data }, { status: 200 })
  } catch (error: any) {
    console.error("Add friend error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
