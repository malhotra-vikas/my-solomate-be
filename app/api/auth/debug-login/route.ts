import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/firebaseAdmin"

export async function POST(req: NextRequest) {
  try {
    console.log("Debug login - Headers:", Object.fromEntries(req.headers.entries()))

    const body = await req.text()
    console.log("Debug login - Raw body:", body)

    let parsedBody
    try {
      parsedBody = JSON.parse(body)
      console.log("Debug login - Parsed body:", parsedBody)
    } catch (parseError) {
      console.error("Debug login - JSON parse error:", parseError)
      return NextResponse.json(
        {
          error: "Invalid JSON",
          rawBody: body,
          parseError: parseError.message,
        },
        { status: 400 },
      )
    }

    const { idToken } = parsedBody

    if (!idToken) {
      return NextResponse.json(
        {
          error: "No idToken provided",
          receivedKeys: Object.keys(parsedBody),
        },
        { status: 400 },
      )
    }

    console.log("Debug login - Token preview:", idToken.substring(0, 50) + "...")

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken)
    console.log("Debug login - Decoded token:", {
      uid: decodedToken.uid,
      email: decodedToken.email,
      exp: decodedToken.exp,
      iat: decodedToken.iat,
    })

    return NextResponse.json(
      {
        message: "Token is valid",
        uid: decodedToken.uid,
        email: decodedToken.email,
        tokenExpiry: new Date(decodedToken.exp * 1000).toISOString(),
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Debug login error:", error)
    return NextResponse.json(
      {
        error: "Token verification failed",
        details: error.message,
        code: error.code,
      },
      { status: 401 },
    )
  }
}
