import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import { generateEmbedding } from "@/lib/embeddings"
import type { CreateDialogExampleRequest } from "@/types"

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

// GET - Retrieve dialog examples for a persona
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const personaId = params.id

    // Verify persona exists
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("id")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    // Get dialog examples
    const { data: examples, error } = await supabase
      .from("dialog_bank")
      .select("*")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching dialog examples:", error)
      return NextResponse.json({ error: "Failed to fetch dialog examples" }, { status: 500 })
    }

    return NextResponse.json(examples, { status: 200 })
  } catch (error: any) {
    console.error("GET dialog bank error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add a new dialog example
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const personaId = params.id
    const body: CreateDialogExampleRequest = await req.json()

    const { user_input, expected_response, context, style_tags, personality_tags } = body

    if (!user_input || !expected_response) {
      return NextResponse.json({ error: "user_input and expected_response are required" }, { status: 400 })
    }

    // Verify persona exists
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("id")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    // Generate embedding for the user input
    const embedding = await generateEmbedding(user_input)

    // Insert dialog example
    const { data: example, error } = await supabase
      .from("dialog_bank")
      .insert({
        persona_id: personaId,
        user_input,
        expected_response,
        context,
        style_tags: style_tags || [],
        personality_tags: personality_tags || [],
        embedding,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating dialog example:", error)
      return NextResponse.json({ error: "Failed to create dialog example" }, { status: 500 })
    }

    return NextResponse.json(example, { status: 201 })
  } catch (error: any) {
    console.error("POST dialog bank error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove a dialog example
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const exampleId = searchParams.get("exampleId")

    if (!exampleId) {
      return NextResponse.json({ error: "exampleId is required" }, { status: 400 })
    }

    const { error } = await supabase.from("dialog_bank").delete().eq("id", exampleId).eq("persona_id", params.id)

    if (error) {
      console.error("Error deleting dialog example:", error)
      return NextResponse.json({ error: "Failed to delete dialog example" }, { status: 500 })
    }

    return NextResponse.json({ message: "Dialog example deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("DELETE dialog bank error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
