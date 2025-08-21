import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { aiSdkOpenai, generateText } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"
import { findSimilarDialogExamples } from "@/lib/embeddings"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

// ✅ GET: Get calls for User
export async function GET(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId)
      return NextResponse.json(
        { error: "Unauthorized request or Token Expired" },
        { status: 401 }
      );

    const supabase = createClient();
    const { data: calls, error } = await supabase
      .from("calls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !calls) {
      return NextResponse.json({ error: "Calls not found" }, { status: 404 });
    }
    const personaIds = calls.map((c) => c.persona_id);

    const { data: personas, error: personasError } = await supabase
      .from("personas")
      .select("*")
      .in("id", personaIds);

    if (personasError || !personas) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    const result = calls.map((c) => ({
      ...c,
      persona: personas.find((p) => p.id === c.persona_id),
    }));

    return NextResponse.json(result, { status: 200 });
}

// ✅ DELETE: Delete calls for User
export async function DELETE(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

    // Delete chat by Chat ID
    const supabase = createClient()

    const { error } = await supabase
        .from("calls")
        .delete()
        .eq("user_id", userId)

    if (error) {
        return NextResponse.json({ error: "Failed to delete Calls" }, { status: 500 })
    }

    return NextResponse.json({ message: "Calls deleted" }, { status: 200 })
}

// ✅ POST: Create a single call (new each time)
export async function POST(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
    }

    try {
        const { personaId, talkTimeSeconds } = await req.json()

        if (!personaId || talkTimeSeconds === null) {
            return NextResponse.json({ error: "Persona ID is required" }, { status: 400 })
        }
        const supabase = createClient()

        // 7. Store conversation messages
        await supabase.from("calls").insert([
            {
                user_id: userId,
                persona_id: personaId,
                talk_time_seconds: talkTimeSeconds
            },
        ])
        console.log("The call is stored in Calls ")

        return NextResponse.json({ message: "Calls Successfully Added" }, { status: 200 })


    } catch (error: any) {
        console.error("Text chat error:", error.message)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
