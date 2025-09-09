export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { messaging } from "@/lib/firebaseAdmin"

// This route would typically be called by a cron job or internal service, not directly by the client.
// It's exposed here for demonstration purposes.
export async function POST(req: NextRequest) {
  // Implement authentication/authorization for this internal endpoint
  // e.g., check for an internal API key or specific IP range
  const internalApiKey = req.headers.get("X-Internal-API-Key")
  if (internalApiKey !== process.env.INTERNAL_API_KEY) {
    // Define INTERNAL_API_KEY env var
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })
  }

  try {
    const { userId, personaId, messageContent } = await req.json()

    if (!userId || !personaId || !messageContent) {
      return NextResponse.json({ error: "User ID, Persona ID, and message content are required" }, { status: 400 })
    }
    const supabase = createClient()

    // 1. Fetch user's device token
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single()

    if (userError || !user || !user.preferences?.deviceToken) {
      console.warn(`No device token found for user ${userId} or user not found.`)
      return NextResponse.json({ message: "User or device token not found" }, { status: 404 })
    }
    const deviceToken = user.preferences.deviceToken

    // 2. Fetch persona details for tone/style
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("name, tone_description")
      .eq("id", personaId)
      .single()

    if (personaError || !persona) {
      console.warn(`Persona ${personaId} not found.`)
      return NextResponse.json({ message: "Persona not found" }, { status: 404 })
    }

    // 3. Construct FCM message
    const message = {
      notification: {
        title: `Message from ${persona.name}`,
        body: messageContent,
      },
      data: {
        personaId: personaId,
        type: "check-in",
        // You can add more data here for the app to handle
      },
      token: deviceToken,
    }

    // 4. Send message via FCM
    const response = await messaging.send(message)
    console.log("Successfully sent message:", response)

    return NextResponse.json({ message: "Notification sent successfully", response }, { status: 200 })
  } catch (error: any) {
    console.error("Send check-in notification error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
