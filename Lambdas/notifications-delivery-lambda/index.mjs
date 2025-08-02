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
    console.log("=== Lambda Invoked ===")
    console.log("Event:", JSON.stringify(event, null, 2))
    console.log("Context:", JSON.stringify(context, null, 2))

    if (!event || !Array.isArray(event.Records)) {
        console.error("Invalid event format — expected event.Records to be an array.")
        return { statusCode: 400, body: "Invalid event format" }
    }

    for (const record of event.Records) {
        console.log("Processing record:", JSON.stringify(record, null, 2))

        try {
            const message = JSON.parse(record.body)
            const { userId, title, body, data, sendAt } = message

            console.log(`Notification for user: ${userId} | Title: ${title} | Scheduled for: ${sendAt || "now"}`)

            // Scheduling logic
            const now = new Date()
            if (sendAt && new Date(sendAt) > now) {
                console.log(`⏳ Skipping until future time: ${sendAt}`)
                continue
            }

            // Fetch tokens from Supabase
            const { data: tokens, error } = await supabase
                .from('device_tokens')
                .select('token')
                .eq('user_id', userId)

            if (error) {
                console.error(`❌ Supabase error for user ${userId}:`, error.message)
                continue
            }

            if (!tokens || tokens.length === 0) {
                console.warn(`⚠️ No FCM tokens found for user ${userId}`)
                continue
            }

            console.log(`📲 Found ${tokens.length} token(s) for user ${userId}`)

            for (const { token } of tokens) {
                console.log(`➡️ Sending push to token: ${token}`)

                try {
                    await getMessaging().send({
                        token,
                        notification: { title, body },
                        data: data || {}
                    })
                    console.log(`✅ Push sent to ${token}`)
                } catch (err) {
                    console.error(`❌ Failed to send push to token ${token}:`, err.message)
                }
            }

        } catch (err) {
            console.error(`💥 Failed to process record: ${err.message}`)
            continue
        }
    }

    console.log("=== Lambda Execution Complete ===")
    return { statusCode: 200 }
}
