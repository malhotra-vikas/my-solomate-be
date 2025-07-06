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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params

  try {
    const { data: persona, error } = await supabase.from("personas").select("*").eq("id", id).single()

    if (error || !persona) {
      console.error("Error fetching persona:", error)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 })
    }

    return NextResponse.json(persona as Persona, { status: 200 })
  } catch (error: any) {
    console.error("GET persona by ID error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
