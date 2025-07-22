import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const loggedInUser = await getUserIdFromRequest(req)
        if (!loggedInUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { persona_id } = await req.json();

        if (!persona_id) {
            return NextResponse.json({ error: "Persona ID is required" }, { status: 400 });
        }

        const supabase = createClient();

        const { error } = await supabase
            .from("user_personas")
            .insert({ user_id: loggedInUser, persona_id });

        if (error) {
            if (error.code === "23505") {
                // unique constraint violation
                return NextResponse.json({ message: "Persona already attached" }, { status: 200 });
            }
            console.error("Attach error:", error);
            return NextResponse.json({ error: "Failed to attach persona" }, { status: 500 });
        }

        return NextResponse.json({ message: "Persona attached successfully" }, { status: 200 });
    } catch (err) {
        console.error("Attach persona error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
