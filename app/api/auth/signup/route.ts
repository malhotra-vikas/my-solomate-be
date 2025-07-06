import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/firebaseAdmin"
import { createClient } from "@/lib/supabase"
import type { UserProfile } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    // 1. Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    })

    const supabase = createClient()

    // 2. Store user profile in Supabase
    const { data, error } = await supabase
      .from("users")
      .insert({
        id: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
        current_tier: "free",
        talk_time_minutes: 15, // Free tier daily minutes
        talk_time_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires in 24 hours
      })
      .select()
      .single()

    if (error) {
      // If Supabase insertion fails, delete Firebase user to prevent orphaned accounts
      await auth.deleteUser(userRecord.uid)
      console.error("Supabase user creation error:", error)
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: "User signed up successfully",
        user: data as UserProfile,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Signup error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
