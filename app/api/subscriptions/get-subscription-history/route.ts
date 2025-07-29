import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .neq('tier', 'free')
      .order("subscription_start_date", { ascending: false });

    if (error || !data) {
      return NextResponse.json(
        { error: "Subscription History was not found" },
        { status: 401 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error while getting subscription history:", error?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
