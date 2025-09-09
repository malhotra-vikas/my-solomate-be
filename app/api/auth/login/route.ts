import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/firebaseAdmin"
import { createClient } from "@/lib/supabase"
import type { UserProfile } from "@/types"

export async function POST(req: NextRequest) {
  try {
    let parsedBody: any
    try {
      parsedBody = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Empty or invalid JSON body" },
        { status: 400 }
      )
    }

    const { idToken } = parsedBody || {}
    if (!idToken) {
      return NextResponse.json(
        {
          error: "No idToken provided",
          receivedKeys: Object.keys(parsedBody || {}),
        },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const decodedToken = await auth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    console.log("🔑 Login UID:", uid)

    const { data: userProfile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .single()

    if (error || !userProfile) {
      console.error("User profile not found in Supabase:", error)
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        message: "User logged in successfully",
        user: userProfile as UserProfile,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Login error:", error.message)
    return NextResponse.json(
      { error: "Invalid token or login failed", details: error.message },
      { status: 401 }
    )
  }
}
