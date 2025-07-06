import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { Persona, PersonaPersonality, PersonaVoiceSettings } from "@/types"
import { auth } from "@/lib/firebaseAdmin"

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

// GET - List all personas
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: personas, error } = await supabase
      .from("personas")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

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

// POST - Create new persona
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const personaData = await req.json()

    // Extract required fields
    const { name, description = "", avatar_url = "", personality, voice_settings, system_prompt } = personaData

    if (!name || !personality || !voice_settings || !system_prompt) {
      return NextResponse.json(
        { error: "name, personality, voice_settings, and system_prompt are required" },
        { status: 400 },
      )
    }

    // Prepare data for insertion
    const insertData = {
      name,
      description,
      avatar_url,
      personality_config: personality as PersonaPersonality,
      voice_config: voice_settings as PersonaVoiceSettings,
      initial_prompt: system_prompt,
      // Derived fields for backward compatibility
      personality_traits: personality.traits || [],
      voice_id: voice_settings.elevenlabs_voice_id,
      tone_description: personality.speaking_style?.tone || "",
    }

    const { data, error } = await supabase.from("personas").insert(insertData).select().single()

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
