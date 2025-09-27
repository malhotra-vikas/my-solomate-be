import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = "*"; 

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const supabase = createClient();

  try {
        const { status, subscriptionsData } = await req.json()
        console.log("🚀 ~ PUT ~ subscriptionsData:", subscriptionsData)
    if (status) {
      const { error: userError } = await supabase
        .from("users")
        .update({ status, deleted_at: status === "Deleted" ? new Date().toISOString() : null})
        .eq("id", userId);

      if (userError) throw userError;
    }
    if (subscriptionsData) {
      let subscriptions: { id: string; talk_seconds_remaining: number }[] = [];
      try {
        subscriptions = subscriptionsData;
      } catch {
        return NextResponse.json(
          { error: "Invalid subscriptions format" },
          { status: 400 }
        );
      }

      for (const sub of subscriptions) {
        if (!sub.id) continue;

        const updates: { talk_seconds_remaining?: number } = {};
        if (sub.talk_seconds_remaining !== undefined) {
          updates.talk_seconds_remaining = sub.talk_seconds_remaining;
        }

        if (Object.keys(updates).length > 0) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update(updates)
            .eq("id", sub.id);

          if (subError) throw subError;
        }
      }
    }

    return NextResponse.json(
      { message: "User status and talk time updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
    return corsResponse(new Response(null, { status: 204 }));
  }
  
  // Utility to add CORS headers
  function corsResponse(res: Response) {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    return res;
  }

