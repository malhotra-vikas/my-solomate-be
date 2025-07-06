import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { Persona, PersonaPersonality, PersonaVoiceSettings } from "@/types"
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const { data: persona, error } = await supabase.from("personas").select("*").eq("id", id).single()

    if (error || !persona) {
      console.error("Error fetching persona:", error)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    return NextResponse.json(persona as Persona, { status: 200 })
  } catch (error: any) {
    console.error("GET persona by ID error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const updates = await req.json()
    const updateData: Partial<Persona> = {}

    // Handle top-level fields
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url
    if (updates.system_prompt !== undefined) updateData.initial_prompt = updates.system_prompt

    // Handle detailed personality config
    if (updates.personality !== undefined) {
      updateData.personality_config = updates.personality as PersonaPersonality
      // Also update derived fields for backward compatibility
      if (updates.personality.traits !== undefined) {
        updateData.personality_traits = updates.personality.traits
      }
      if (updates.personality.speaking_style?.tone !== undefined) {
        updateData.tone_description = updates.personality.speaking_style.tone
      }
    }

    // Handle detailed voice settings config
    if (updates.voice_settings !== undefined) {
      updateData.voice_config = updates.voice_settings as PersonaVoiceSettings
      // Also update derived voice_id for backward compatibility
      if (updates.voice_settings.elevenlabs_voice_id !== undefined) {
        updateData.voice_id = updates.voice_settings.elevenlabs_voice_id
      }
    }

    const { data, error } = await supabase.from("personas").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating persona:", error)
      return NextResponse.json({ error: "Failed to update persona" }, { status: 500 })
    }

    return NextResponse.json(data as Persona, { status: 200 })
  } catch (error: any) {
    console.error("PUT persona by ID error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
