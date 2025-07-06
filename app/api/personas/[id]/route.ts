import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { UpdatePersonaRequest } from "@/types"

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

// GET - Get a specific persona
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: persona, error } = await supabase
      .from("personas")
      .select("*")
      .eq("id", params.id)
      .eq("is_active", true)
      .single()

    if (error || !persona) {
      console.error("Persona not found:", error)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    return NextResponse.json(persona, { status: 200 })
  } catch (error: any) {
    console.error("GET persona error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update a persona
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: UpdatePersonaRequest = await req.json()
    const { name, description, avatar_url, personality, voice_settings, system_prompt } = body

    // Build update object
    const updates: any = {}

    if (name) updates.name = name
    if (description !== undefined) updates.description = description
    if (avatar_url !== undefined) updates.avatar_url = avatar_url
    if (system_prompt) updates.initial_prompt = system_prompt

    // Handle personality config
    if (personality) {
      updates.personality_config = personality
      updates.personality_traits = personality.traits || []
      updates.tone_description = personality.speaking_style?.tone || ""
    }

    // Handle voice config
    if (voice_settings) {
      updates.voice_config = voice_settings
      updates.voice_id = voice_settings.elevenlabs_voice_id
    }

    const { data: persona, error } = await supabase
      .from("personas")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating persona:", error)
      return NextResponse.json({ error: "Failed to update persona" }, { status: 500 })
    }

    return NextResponse.json(persona, { status: 200 })
  } catch (error: any) {
    console.error("PUT persona error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Soft delete a persona
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: persona, error } = await supabase
      .from("personas")
      .update({ is_active: false })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error deleting persona:", error)
      return NextResponse.json({ error: "Failed to delete persona" }, { status: 500 })
    }

    return NextResponse.json({ message: "Persona deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("DELETE persona error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
