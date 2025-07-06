import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { CreatePersonaRequest } from "@/types"

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

    return NextResponse.json(personas, { status: 200 })
  } catch (error: any) {
    console.error("GET personas error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new persona
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: CreatePersonaRequest = await req.json()
    const { name, description, avatar_url, personality, voice_settings, system_prompt } = body

    if (!name || !personality || !voice_settings || !system_prompt) {
      return NextResponse.json(
        { error: "name, personality, voice_settings, and system_prompt are required" },
        { status: 400 },
      )
    }

    // Extract backward-compatible fields
    const personality_traits = personality.traits || []
    const voice_id = voice_settings.elevenlabs_voice_id
    const tone_description = personality.speaking_style?.tone || ""

    const { data: persona, error } = await supabase
      .from("personas")
      .insert({
        name,
        description: description || "",
        personality_traits,
        voice_id,
        tone_description,
        avatar_url: avatar_url || "/placeholder.svg?height=200&width=200",
        initial_prompt: system_prompt,
        personality_config: personality,
        voice_config: voice_settings,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating persona:", error)
      return NextResponse.json({ error: "Failed to create persona" }, { status: 500 })
    }

    return NextResponse.json(persona, { status: 201 })
  } catch (error: any) {
    console.error("POST persona error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
