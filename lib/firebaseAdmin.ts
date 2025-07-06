import * as admin from "firebase-admin"

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } catch (error) {
    console.error("Firebase Admin initialization error", error)
  }
}

export const auth = admin.auth()
export const messaging = admin.messaging()
