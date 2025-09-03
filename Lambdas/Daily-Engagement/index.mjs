import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ⛳ ENV VARS
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SCHEDULED_QUEUE_URL,
    MESSAGE_TEMPLATE_KEY // e.g. "Emotional Check-In"
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SCHEDULED_QUEUE_URL || !MESSAGE_TEMPLATE_KEY) {
    throw new Error("❌ Missing required environment variables")
}

// 🧠 Load Message Config
console.log("📁 Loading message template JSON...")
const messageMap = JSON.parse(fs.readFileSync(path.resolve('./notificationMessageTemplate.json'), 'utf8'))
const messageTemplate = messageMap[MESSAGE_TEMPLATE_KEY]
if (!messageTemplate) throw new Error(`❌ No message found for MESSAGE_TEMPLATE_KEY="${MESSAGE_TEMPLATE_KEY}"`)
console.log(`📬 Using message key: "${MESSAGE_TEMPLATE_KEY}" → Title: "${messageTemplate.title}"`)

// 🛠 Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const sqs = new SQSClient({ region: 'us-east-2' })

/**
 * Sends message to SQS
 * @param {*} payload
 */
async function queueNotificationToSQS(payload) {
    const command = new SendMessageCommand({
        QueueUrl: SCHEDULED_QUEUE_URL,
        MessageBody: JSON.stringify({
            ...payload,
            sendAt: payload.sendAt || new Date().toISOString()
        })
    })
    const result = await sqs.send(command)
    return result.MessageId
}

/**
 * Get active users who have at least one SoloMate.
 * Returns userId, firstName, soloMateName
 */
async function getEligibleUsers() {
    console.log("🔎 Fetching active users...")

    const { data: activeUsers, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('status', 'active')

    if (userError) throw new Error(`❌ Error fetching users: ${userError.message}`)
    console.log(`👥 Found ${activeUsers?.length || 0} active users`)

    const userIdList = activeUsers.map(u => u.id)

    console.log("🔗 Fetching linked SoloMates via user_personas...")
    const { data: userPersonas, error: linkError } = await supabase
        .from('user_personas')
        .select('user_id, personas(name)')
        .in('user_id', userIdList)

    if (linkError) throw new Error(`❌ Error fetching user_personas: ${linkError.message}`)

    const grouped = userPersonas.reduce((acc, row) => {
        const personaName = row.personas?.name
        if (!personaName) return acc
        if (!acc[row.user_id]) acc[row.user_id] = []
        acc[row.user_id].push(personaName)
        return acc
    }, /** @type {Record<string, string[]>} */({}))

    console.log("📦 Merging users with linked SoloMates...")
    return activeUsers
        .filter(u => grouped[u.id]?.length > 0)
        .map(user => {
            const soloMateList = grouped[user.id]
            const randomSoloMate = soloMateList[Math.floor(Math.random() * soloMateList.length)]
            const firstName = user.name?.split(" ")[0] || "there"
            console.log(`👤 ${user.id} (${firstName}) → ${soloMateList.length} SoloMates → Selected: ${randomSoloMate}`)

            return {
                userId: user.id,
                firstName,
                soloMateName: randomSoloMate
            }
        })
}

/**
 * Lambda Handler
 */
export async function handler() {
    const start = Date.now()
    console.log(`=== Lambda Start: ${MESSAGE_TEMPLATE_KEY} @ ${new Date().toISOString()} ===`)

    let users = []
    try {
        users = await getEligibleUsers()
        console.log(`✅ Final eligible users count: ${users.length}`)
    } catch (err) {
        console.error("❌ Failed to fetch users:", err.message)
        return { statusCode: 500, body: 'Failed user fetch' }
    }

    const results = []
    for (const user of users) {
        const { userId, firstName, soloMateName } = user

        try {
            const body = messageTemplate.bodyTemplate
                .replace("{firstName}", firstName)
                .replace("{soloMateName}", soloMateName || "")

            console.log(`📤 Queuing message to ${userId} → "${messageTemplate.title}" | Body: "${body}"`)

            const messageId = await queueNotificationToSQS({
                userId,
                title: messageTemplate.title,
                body,
                type: messageTemplate.type,
                data: messageTemplate.data
            })

            console.log(`✅ Queued: ${userId} | Message ID: ${messageId}`)
            results.push({ userId, status: 'fulfilled' })
        } catch (err) {
            console.error(`🚫 Queue failed for ${userId}: ${err.message}`)
            results.push({ userId, status: 'rejected', reason: err.message })
        }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.length - successCount
    const duration = ((Date.now() - start) / 1000).toFixed(2)

    console.log("=== Lambda Complete ===")
    console.log(`📊 Attempted: ${results.length}, ✅ Success: ${successCount}, ❌ Failures: ${failCount}`)
    console.log(`⏱ Duration: ${duration}s`)

    return { statusCode: 200, body: `Processed ${results.length} users` }
}
