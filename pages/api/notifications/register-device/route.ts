export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
  }

  try {
    const { deviceToken } = await req.json()

    if (!deviceToken) {
      return NextResponse.json({ error: "Device token is required" }, { status: 400 })
    }
    const supabase = createClient()

    // Store device token in user preferences or a dedicated table
    // For simplicity, adding to user preferences JSONB
    const { data, error } = await supabase
      .from("users")
      .update({
        preferences: {
          ...(await supabase.from("users").select("preferences").eq("id", userId).single()).data?.preferences,
          deviceToken: deviceToken,
        },
      })
      .eq("id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error registering device token:", error)
      return NextResponse.json({ error: "Failed to register device token" }, { status: 500 })
    }

    return NextResponse.json({ message: "Device token registered successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Register device error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
