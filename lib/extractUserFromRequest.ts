import { type NextRequest } from "next/server"
import { auth } from "@/lib/firebaseAdmin";
import { OAuth2Client } from "google-auth-library"

const client = new OAuth2Client()

// Helper to get user ID from Authorization header
export async function getUserIdFromRequest(req: NextRequest): Promise<string | undefined> {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return undefined
    }
    const idToken = authHeader.split(" ")[1]
    try {
        const decodedToken = await client.verifyIdToken({idToken})
        return decodedToken.getPayload()?.sub
    } catch (error) {
        console.error("Error verifying ID token:", error)
        return undefined
    }
}
