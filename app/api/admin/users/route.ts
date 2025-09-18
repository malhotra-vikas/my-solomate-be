import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = "*"; 

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*");

    if (usersError || !users) {
      return NextResponse.json({ error: "Users not found" }, { status: 404 });
    }

    // Fetch subscriptions for all users
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("*");

    if (subsError) {
      return NextResponse.json({ error: "Subscriptions not found" }, { status: 404 });
    }

    // Combine users with their subscriptions
    const result = users.map(user => ({
      ...user,
      subscriptions: subscriptions.filter(sub => sub.user_id === user.id)
    }));

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
