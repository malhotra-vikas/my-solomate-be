import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { verifyFirebaseToken } from "@/lib/firebaseAdmin"
import { generateEmbedding } from "@/lib/embeddings"

// GET - Retrieve dialog examples for a persona
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id: personaId } = context.params

    // Verify authentication
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decodedToken = await verifyFirebaseToken(token)
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const supabase = createClient()

    // Get all dialog examples for the persona
    const { data: dialogs, error } = await supabase
      .from("dialog_bank")
      .select("*")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching dialog examples:", error)
      return NextResponse.json({ error: "Failed to fetch dialog examples" }, { status: 500 })
    }

    return NextResponse.json(dialogs || [])
  } catch (error) {
    console.error("Error in GET /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add a new dialog example
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const { id: personaId } = context.params

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decodedToken = await verifyFirebaseToken(token)
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await req.json()

    // Validate required fields
    const { user_input, expected_response, context, style_tags, personality_tags } = body

    if (!user_input || !expected_response) {
      return NextResponse.json({ error: "user_input and expected_response are required" }, { status: 400 })
    }

    // Generate embedding for the user input
    const embedding = await generateEmbedding(user_input)

    const supabase = createClient()

    // Insert the dialog example
    const { data: dialog, error } = await supabase
      .from("dialog_bank")
      .insert({
        persona_id: personaId,
        user_input,
        expected_response,
        context: context || null,
        style_tags: style_tags || [],
        personality_tags: personality_tags || [],
        embedding: JSON.stringify(embedding), // Store as JSON string
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating dialog example:", error)
      return NextResponse.json({ error: "Failed to create dialog example" }, { status: 500 })
    }

    return NextResponse.json(dialog, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update a dialog example
export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const { id: personaId } = context.params

  try {

    // Verify authentication
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decodedToken = await verifyFirebaseToken(token)
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const url = new URL(req.url)
    const dialogId = url.pathname.split("/").pop()

    if (!dialogId) {
      return NextResponse.json({ error: "Dialog ID is required" }, { status: 400 })
    }

    const body = await req.json()
    const { user_input, expected_response, context, style_tags, personality_tags } = body

    const supabase = createClient()

    // Prepare update data
    const updateData: any = {}

    if (user_input !== undefined) {
      updateData.user_input = user_input
      // Regenerate embedding if user_input changed
      updateData.embedding = JSON.stringify(await generateEmbedding(user_input))
    }

    if (expected_response !== undefined) updateData.expected_response = expected_response
    if (context !== undefined) updateData.context = context
    if (style_tags !== undefined) updateData.style_tags = style_tags
    if (personality_tags !== undefined) updateData.personality_tags = personality_tags

    // Update the dialog example
    const { data: dialog, error } = await supabase
      .from("dialog_bank")
      .update(updateData)
      .eq("id", dialogId)
      .eq("persona_id", personaId) // Ensure it belongs to the correct persona
      .select()
      .single()

    if (error) {
      console.error("Error updating dialog example:", error)
      return NextResponse.json({ error: "Failed to update dialog example" }, { status: 500 })
    }

    if (!dialog) {
      return NextResponse.json({ error: "Dialog example not found" }, { status: 404 })
    }

    return NextResponse.json(dialog)
  } catch (error) {
    console.error("Error in PUT /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove a dialog example
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {

  const { id: personaId } = context.params

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decodedToken = await verifyFirebaseToken(token)
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const url = new URL(req.url)
    const dialogId = url.pathname.split("/").pop()

    if (!dialogId) {
      return NextResponse.json({ error: "Dialog ID is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Delete the dialog example
    const { error } = await supabase.from("dialog_bank").delete().eq("id", dialogId).eq("persona_id", personaId) // Ensure it belongs to the correct persona

    if (error) {
      console.error("Error deleting dialog example:", error)
      return NextResponse.json({ error: "Failed to delete dialog example" }, { status: 500 })
    }

    return NextResponse.json({ message: "Dialog example deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
