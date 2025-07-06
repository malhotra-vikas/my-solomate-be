import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { Persona } from "@/types"
import { auth } from "@/lib/firebaseAdmin"

// Helper to get user ID from Authorization header
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const idToken = authHeader.split(" ")[1]
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken.uid
  } catch (error) {
    console.error("Error verifying ID token:", error)
    return null
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId === null) {
    // Ensure user is authenticated
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: personas, error } = await supabase.from("personas").select("*")

    if (error) {
      console.error("Error fetching personas:", error)
      return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 })
    }

    return NextResponse.json(personas as Persona[], { status: 200 })
  } catch (error: any) {
    console.error("GET personas error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
