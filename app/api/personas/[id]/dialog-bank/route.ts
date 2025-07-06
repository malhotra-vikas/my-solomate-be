import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { verifyFirebaseToken } from "@/lib/firebaseAdmin"
import { generateEmbedding } from "@/lib/embeddings"

// Auth helper
async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.split(" ")[1]
  return await verifyFirebaseToken(token)
}

// GET - Retrieve dialog examples for a persona
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {

  try {
    const decodedToken = await authenticate(req)
    if (!decodedToken) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const personaId = params.id
    const supabase = createClient()

    const { data: dialogs, error } = await supabase
      .from("dialog_bank")
      .select("*")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching dialog examples:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch dialog examples" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: dialogs || [] })
  } catch (error) {
    console.error("Error in GET /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add a new dialog example
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {

  try {
    const personaId = params.id
    const decodedToken = await authenticate(req)
    if (!decodedToken) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { user_input, expected_response, context: dialog_context, style_tags, personality_tags } = body

    if (!user_input || !expected_response) {
      return NextResponse.json({ success: false, error: "user_input and expected_response are required" }, { status: 400 })
    }

    const embedding = await generateEmbedding(user_input)
    const supabase = createClient()

    const { data: dialog, error } = await supabase
      .from("dialog_bank")
      .insert({
        persona_id: personaId,
        user_input,
        expected_response,
        context: dialog_context || null,
        style_tags: style_tags || [],
        personality_tags: personality_tags || [],
        embedding,
        created_by: decodedToken.uid,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating dialog example:", error)
      return NextResponse.json({ success: false, error: "Failed to create dialog example" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: dialog }, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update a dialog example
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {

  try {
    const decodedToken = await authenticate(req)
    if (!decodedToken) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const personaId = params.id
    const url = req.nextUrl
    const dialogId = url.searchParams.get("dialogId")

    if (!dialogId) {
      return NextResponse.json({ success: false, error: "Dialog ID is required" }, { status: 400 })
    }

    const body = await req.json()
    const { user_input, expected_response, context: dialog_context, style_tags, personality_tags } = body

    const updateData: any = { updated_by: decodedToken.uid }

    if (user_input !== undefined) {
      updateData.user_input = user_input
      updateData.embedding = await generateEmbedding(user_input)
    }

    if (expected_response !== undefined) updateData.expected_response = expected_response
    if (dialog_context !== undefined) updateData.context = dialog_context
    if (style_tags !== undefined) updateData.style_tags = style_tags
    if (personality_tags !== undefined) updateData.personality_tags = personality_tags

    const supabase = createClient()
    const { data: dialog, error } = await supabase
      .from("dialog_bank")
      .update(updateData)
      .eq("id", dialogId)
      .eq("persona_id", personaId)
      .select()
      .single()

    if (error) {
      console.error("Error updating dialog example:", error)
      return NextResponse.json({ success: false, error: "Failed to update dialog example" }, { status: 500 })
    }

    if (!dialog) {
      return NextResponse.json({ success: false, error: "Dialog example not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: dialog })
  } catch (error) {
    console.error("Error in PUT /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove a dialog example
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {

  try {
    const decodedToken = await authenticate(req)
    if (!decodedToken) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const personaId = params.id

    const url = req.nextUrl
    const dialogId = url.searchParams.get("dialogId")

    if (!dialogId) {
      return NextResponse.json({ success: false, error: "Dialog ID is required" }, { status: 400 })
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("dialog_bank")
      .delete()
      .eq("id", dialogId)
      .eq("persona_id", personaId)

    if (error) {
      console.error("Error deleting dialog example:", error)
      return NextResponse.json({ success: false, error: "Failed to delete dialog example" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Dialog example deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/personas/[id]/dialog-bank:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
