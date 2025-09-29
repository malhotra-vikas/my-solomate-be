import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/firebaseAdmin"
import { createClient } from "@/lib/supabase"
import type { UserProfile } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    const supabase = createClient()


    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    console.log("🔑 Login UID:", uid)

    // Fetch user profile from Supabase
    const { data: userProfile, error } = await supabase.from("users").select("*").eq("id", uid).maybeSingle()

    if (error) {
      console.error("Supabase error fetching user profile:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!userProfile) {
      console.error("User profile not found in Supabase:", error)
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    return NextResponse.json(
      {
        message: "User logged in successfully",
        user: userProfile as UserProfile,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Login error:", error.message)
    return NextResponse.json({ error: "Invalid token or login failed" }, { status: 401 })
  }
}
