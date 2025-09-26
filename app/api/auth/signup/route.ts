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

    console.log("Sucessfully added user in Firebase for email ", email)
    console.log("✅ Firebase UID:", userRecord.uid)

    console.log("Creating user in Supabase with UID:", userRecord.uid)

    const supabase = createClient()

    // 2. Store user profile in Supabase
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        id: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
      })
      .select()
      .maybeSingle()

    // Handle errors
    if (userError || !userData) {
      await auth.deleteUser(userRecord.uid);
      console.error("Supabase user creation error:", userError);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    console.log("🔁 Inserted into Supabase:", userData, "Error:", userError)

    // 3. Store user subscription in Supabase
    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userRecord.uid,
      })
      .select()
      .maybeSingle()


    if (subError || !subData) {
      console.error("Supabase subscription creation error:", subError);
      // optional: rollback user insert here if you want strict consistency
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    console.log("🔁 Inserted into Supabase Subscriptions:", subData, "Error:", subError)

    return NextResponse.json(
      {
        message: "User signed up successfully",
        user: userData as UserProfile,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Signup error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
