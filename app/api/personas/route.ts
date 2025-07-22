import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import type { CreatePersonaRequest } from "@/types"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

// GET - Unified handler to support multiple persona queries
export async function GET(req: NextRequest, { params }: { params?: { id?: string } }) {
  const currentUserId = await getUserIdFromRequest(req)
  if (!currentUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const personaId = params?.id
  let getAll = false
  if (searchParams.get("all")) {
    getAll = true
  }
  const queryUserId = searchParams.get("user_id");

  console.log("personaId got passed as  , ", personaId)
  console.log("getAll got passed as  , ", getAll)
  console.log("queryUserId got passed as  , ", queryUserId)

  try {
    // ✅ 1. Get a specific persona by ID
    if (personaId) {
      const { data: persona, error } = await supabase
        .from("personas")
        .select("*")
        .eq("id", personaId)
        .eq("is_active", true)
        .single()

      if (error || !persona) {
        console.error("Persona not found:", error)
        return NextResponse.json({ error: "Persona not found" }, { status: 404 })
      }

      return NextResponse.json(persona, { status: 200 })
    }

    // ✅ 2. Get all personas EXCLUDING those already attached to currentUserId (Find Solo Mates)
    if (getAll) {
      const [allPersonaRes, userPersonaRes] = await Promise.all([
        supabase.from("personas").select("*"),
        supabase
          .from("user_personas")
          .select("persona_id")
          .eq("user_id", currentUserId),
      ])

      const { data: allPersonas, error: allError } = allPersonaRes
      const { data: userPersonas, error: userError } = userPersonaRes

      if (allError || userError) {
        console.error("Error fetching all/user personas:", allError || userError)
        return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 })
      }

      const attachedPersonaIds = new Set(userPersonas.map(p => p.persona_id))
      const unlinkedPersonas = allPersonas.filter(p => !attachedPersonaIds.has(p.id))

      return NextResponse.json(unlinkedPersonas, { status: 200 })
    }

    // ✅ 3. Get all attached personas for a given user_id (My Solo Mates)
    if (queryUserId && queryUserId !== "undefined" && queryUserId !== "null" && queryUserId.trim() !== "") {

      const { data: userPersonaRows, error } = await supabase
        .from("user_personas")
        .select("persona:personas(*)")
        .eq("user_id", queryUserId)

      if (error) {
        console.error("Error fetching personas for user_id:", error)
        return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 })
      }
      console.log("userPersonaRows", userPersonaRows)

      // Return all joined personas, including inactive
      const personas = (userPersonaRows ?? []).map(row => row.persona)

      console.log("Personas for User being returned are ", personas)

      return NextResponse.json(personas, { status: 200 })
    }

  } catch (error: any) {
    console.error("GET persona error:", error.message)
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

    const supabase = createClient()

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
