import { createClient } from "@/lib/supabase";
import AWS from "aws-sdk"

AWS.config.update({
    region: process.env.AWS_REGION || "us-east-2",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
})

const sqs = new AWS.SQS()

const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL!
const SCHEDULED_QUEUE_URL = process.env.SCHEDULED_QUEUE_URL!

type NotificationPayload = {
    userId: string
    title: string
    body: string
    data?: Record<string, string>
    type?: string
    sendAt?: string // ISO string or null = immediate
}

export async function queueNotificationToSQS(notification: NotificationPayload) {
    const now = new Date()
    const sendAtTime = notification.sendAt ? new Date(notification.sendAt) : now
    const isFuture = sendAtTime > now

    const targetQueue = isFuture ? SCHEDULED_QUEUE_URL : NOTIFICATION_QUEUE_URL
    const supabase = createClient()

    const message = {
        ...notification,
        sendAt: sendAtTime.toISOString()
    }

    const params = {
        QueueUrl: targetQueue,
        MessageBody: JSON.stringify(message)
    }

    console.log("=== 📨 Queue Notification ===")
    console.log("Target Queue:", targetQueue.includes("scheduled") ? "Scheduled" : "Immediate")
    console.log("User ID:", notification.userId)
    console.log("Title:", notification.title)
    console.log("Body:", notification.body)
    console.log("Type:", notification.type || "default")
    console.log("Data:", notification.data || {})
    console.log("sendAt:", sendAtTime.toISOString())
    console.log("Full Message Body:", params.MessageBody)

    return new Promise((resolve, reject) => {
        sqs.sendMessage(params, async (err, data) => {
            if (err) {
                console.error("❌ Failed to queue message to SQS:", err)
                reject(err)
            } else {
                console.log("✅ Message successfully queued:", data.MessageId)

                // 🧠 Save to Supabase
                try {
                    const { error } = await supabase.from("notifications").insert({
                        user_id: notification.userId,
                        title: notification.title,
                        body: notification.body,
                        type: notification.type || null,
                        data: notification.data || {},
                        send_at: sendAtTime.toISOString(),
                        status: "unread" // <=== NEW
                    })

                    if (error) {
                        console.error("❌ Failed to save notification in Supabase:", error.message)
                    } else {
                        console.log("📦 Notification saved in Supabase")
                    }
                } catch (err) {
                    console.error("❌ Supabase insert failed:", err)
                }



                resolve({ queued: true, targetQueue, messageId: data.MessageId })

            }
        })
    })
}
