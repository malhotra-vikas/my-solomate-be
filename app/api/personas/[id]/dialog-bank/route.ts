import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import { generateEmbedding } from "@/lib/embeddings"
import type { PersonaDialogExample } from "@/types"

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

  const { id: personaId } = params
  const { searchParams } = new URL(req.url)
  const limit = Number.parseInt(searchParams.get("limit") || "10")
  const offset = Number.parseInt(searchParams.get("offset") || "0")

  try {
    const { data, error } = await supabase
      .from("persona_dialog_bank")
      .select("*")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching dialog examples:", error)
      return NextResponse.json({ error: "Failed to fetch dialog examples" }, { status: 500 })
    }

    return NextResponse.json(data as PersonaDialogExample[], { status: 200 })
  } catch (error: any) {
    console.error("GET dialog bank error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add new dialog example
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: personaId } = params

  try {
    const { user_input, expected_response, context, style_tags = [], personality_tags = [] } = await req.json()

    if (!user_input || !expected_response) {
      return NextResponse.json({ error: "user_input and expected_response are required" }, { status: 400 })
    }

    // Generate embedding for the user input
    const embedding = await generateEmbedding(user_input)

    const { data, error } = await supabase
      .from("persona_dialog_bank")
      .insert({
        persona_id: personaId,
        user_input,
        expected_response,
        context,
        style_tags,
        personality_tags,
        embedding,
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding dialog example:", error)
      return NextResponse.json({ error: "Failed to add dialog example" }, { status: 500 })
    }

    return NextResponse.json(data as PersonaDialogExample, { status: 201 })
  } catch (error: any) {
    console.error("POST dialog bank error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove dialog example
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const exampleId = searchParams.get("example_id")

  if (!exampleId) {
    return NextResponse.json({ error: "example_id is required" }, { status: 400 })
  }

  try {
    const { error } = await supabase.from("persona_dialog_bank").delete().eq("id", exampleId)

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
