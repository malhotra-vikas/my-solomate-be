import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

  try {
    const supabase = createClient();

    const { data: plans, error } = await supabase
       .from("plans")
       .select("*")
       .order("cost", { ascending: true });

    if (error || !plans) {
      return NextResponse.json(
        { error: "Subscription plans was not found" },
        { status: 401 }
      );
    }

   
    return NextResponse.json({data: plans}, { status: 200 });
  } catch (error) {
    console.error("Error while getting subscription history:", error?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}