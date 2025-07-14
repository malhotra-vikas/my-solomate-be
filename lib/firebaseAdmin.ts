// lib/firebaseAdmin.ts
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  } catch (error) {
    console.error("Firebase Admin initialization error", error)
  }
}

export const auth = admin.auth()
export const messaging = admin.messaging() // ✅ Add this line

export async function verifyFirebaseToken(token: string) {
  try {
    const decoded = await auth.verifyIdToken(token)
    return decoded
  } catch (err) {
    console.error("Token verification failed:", err)
    return null
  }
}
