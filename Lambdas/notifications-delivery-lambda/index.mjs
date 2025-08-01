import { createClient } from '@supabase/supabase-js'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    FIREBASE_SERVICE_ACCOUNT_JSON
} = process.env

// Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Firebase Admin SDK
if (getApps().length === 0) {
    initializeApp({
        credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON))
    })
}

export async function handler(event, context) {
    for (const record of event.Records) {
        const message = JSON.parse(record.body)
        const { userId, title, body, data, sendAt } = message

        // Scheduling logic (optional)
        const now = new Date()
        if (sendAt && new Date(sendAt) > now) {
            console.log(`Skipping until ${sendAt}`)
            continue
        }

        // Fetch FCM tokens from Supabase
        const { data: tokens, error } = await supabase
            .from('fcm_tokens')
            .select('token')
            .eq('user_id', userId)

        if (error || !tokens?.length) {
            console.warn(`No FCM tokens for user ${userId}`, error)
            continue
        }

        // Send push to all valid tokens
        for (const { token } of tokens) {
            try {
                await getMessaging().send({
                    token,
                    notification: { title, body },
                    data: data || {}
                })
                console.log(`Push sent to ${userId} via ${token}`)
            } catch (err) {
                console.error(`Failed to send to ${token}`, err.message)
                // TODO: remove expired token from Supabase if needed
            }
        }
    }

    return { statusCode: 200 }
}
