import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const loggedInUser = await getUserIdFromRequest(req)
        if (!loggedInUser) {
            return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
        }

        const { persona_id } = await req.json();

        if (!persona_id) {
            return NextResponse.json({ error: "Persona ID is required" }, { status: 400 });
        }

        const supabase = createClient();

        const { error } = await supabase
            .from("user_personas")
            .delete()
            .match({ user_id: loggedInUser, persona_id });

        if (error) {
            console.error("Detach error:", error);
            return NextResponse.json({ error: "Failed to detach persona" }, { status: 500 });
        }

        return NextResponse.json({ message: "Solo Mate removed successfully" }, { status: 200 });
    } catch (err) {
        console.error("Detach persona error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
