import { type NextRequest } from "next/server"
import { auth } from "@/lib/firebaseAdmin"

// Helper to get user ID from Authorization header
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
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
