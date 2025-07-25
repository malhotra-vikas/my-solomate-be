// lib/firebaseAdmin.ts
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  console.log("🚀 ~ process.env.FIREBASE_SERVICE_ACCOUNT_KEY:", process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  try {
    admin.initializeApp({
      // credential: admin.credential.applicationDefault(),
      credential: admin.credential.cert(serviceAccount),
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
