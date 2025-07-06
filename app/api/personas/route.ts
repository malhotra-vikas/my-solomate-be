import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { Persona, PersonaPersonality, PersonaVoiceSettings } from "@/types"

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

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    // Ensure user is authenticated
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: personas, error } = await supabase.from("personas").select("*")

    if (error) {
      console.error("Error fetching personas:", error)
      return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 })
    }

    return NextResponse.json(personas as Persona[], { status: 200 })
  } catch (error: any) {
    console.error("GET personas error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      name,
      description,
      avatar_url,
      personality, // This is the new detailed personality object
      voice_settings, // This is the new detailed voice settings object
      system_prompt, // This maps to initial_prompt
    } = await req.json()

    if (!name || !description || !personality || !voice_settings || !system_prompt) {
      return NextResponse.json({ error: "Missing required fields for persona creation" }, { status: 400 })
    }

    // Extract fields for backward compatibility and direct use
    const personality_traits = personality.traits || []
    const voice_id = voice_settings.elevenlabs_voice_id
    const tone_description = personality.speaking_style?.tone || ""
    const initial_prompt = system_prompt

    const { data, error } = await supabase
      .from("personas")
      .insert({
        name,
        description,
        personality_traits,
        voice_id,
        tone_description,
        avatar_url,
        initial_prompt,
        personality_config: personality as PersonaPersonality, // Store the full JSONB
        voice_config: voice_settings as PersonaVoiceSettings, // Store the full JSONB
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating persona:", error)
      return NextResponse.json({ error: "Failed to create persona" }, { status: 500 })
    }

    return NextResponse.json(data as Persona, { status: 201 })
  } catch (error: any) {
    console.error("POST persona error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
