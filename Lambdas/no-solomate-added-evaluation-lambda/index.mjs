import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { createClient } from '@supabase/supabase-js'

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SCHEDULED_QUEUE_URL
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SCHEDULED_QUEUE_URL) {
    throw new Error("❌ Missing required environment variables")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const sqs = new SQSClient({ region: 'us-east-2' })

/**
 * @typedef {Object} NotificationPayload
 * @property {string} userId
 * @property {string} title
 * @property {string} body
 * @property {string=} type
 * @property {Object<string, string>=} data
 * @property {string=} sendAt
 */

/**
 * Send a notification message to SQS
 * @param {NotificationPayload} payload
 */
async function queueNotificationToSQS(payload) {
    try {
        const command = new SendMessageCommand({
            QueueUrl: SCHEDULED_QUEUE_URL,
            MessageBody: JSON.stringify({
                ...payload,
                sendAt: payload.sendAt || new Date().toISOString()
            })
        })
        const result = await sqs.send(command)
        return result.MessageId
    } catch (err) {
        throw new Error(`Failed to queue message for user ${payload.userId}: ${err.message}`)
    }
}

/**
 * Get users created in the window who haven't added a SoloMate
 */
async function getUsersWithoutSoloMate(after, before) {
    const { data: users, error } = await supabase
        .from("users")
        .select("id, name, created_at")
        .gte("created_at", after.toISOString())
        .lt("created_at", before.toISOString())

    if (error) throw new Error(`Error fetching users: ${error.message}`)
    if (!users || users.length === 0) return []

    const userIds = users.map(u => u.id)

    const { data: linked, error: e2 } = await supabase
        .from("user_personas")
        .select("user_id")
        .in("user_id", userIds)

    if (e2) throw new Error(`Error fetching user_personas: ${e2.message}`)

    const linkedIds = new Set(linked.map(l => l.user_id))
    return users.filter(u => !linkedIds.has(u.id))
}

/**
 * AWS Lambda Handler
 */
export async function handler() {
    const start = Date.now()
    console.log("=== Lambda Start: Evaluate No-SoloMate Users ===")

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneDayAgoPlus1h = new Date(oneDayAgo.getTime() + 60 * 60 * 1000)

    let users = []
    try {
        users = await getUsersWithoutSoloMate(oneDayAgo, oneDayAgoPlus1h)
        console.log(`🔍 Found ${users.length} users needing reminder`)
    } catch (err) {
        console.error("❌ User fetch failed:", err.message)
        return { statusCode: 500, body: 'Failed to fetch user list' }
    }

    const results = []
    for (const user of users) {
        const userId = user.id
        const firstName = user.name?.split(" ")[0] || "there"

        try {
            const messageId = await queueNotificationToSQS({
                userId,
                title: "Don't forget to add your SoloMate!",
                body: `Hey ${firstName}, pick your first SoloMate and start chatting.`,
                type: "ADD_SOLOMATE_REMINDER",
                data: { screen: "PersonaProfile" }
            })
            console.log(`✅ Queued for ${userId} | MessageId: ${messageId}`)
            results.push({ userId, status: 'fulfilled' })
        } catch (err) {
            console.error(`🚫 Failed for user ${userId}: ${err.message}`)
            results.push({ userId, status: 'rejected', reason: err.message })
        }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.length - successCount
    const duration = ((Date.now() - start) / 1000).toFixed(2)

    console.log(`📦 Notifications attempted: ${results.length}`)
    console.log(`✅ Success: ${successCount}, ❌ Failures: ${failCount}`)
    console.log(`⏱ Duration: ${duration}s`)
    console.log("=== Lambda Complete ===")

    return { statusCode: 200, body: `Processed ${results.length} users` }
}
