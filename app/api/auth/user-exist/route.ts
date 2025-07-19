import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types";
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    try {
      const { email } = await req.json();
      const supabase = createClient();

      const { data: userProfile, error } = await supabase.from("users").select("*").eq("email", email).single()

    if (error || !userProfile) {
        console.error("User profile not found in Supabase:", error)
        return NextResponse.json({ error: "User profile not found" }, { status: 404 })
      }

      
      return NextResponse.json(
        {
          message: "User exist",
          user: userProfile as UserProfile,
        },
        { status: 200 },
      )
    } catch (error: any) {
    console.error("Login error:", error.message)
    return NextResponse.json({ error: "User profile not found" }, { status: 401 })
    }
}