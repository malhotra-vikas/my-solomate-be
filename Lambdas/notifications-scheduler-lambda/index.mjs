import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs'

const sqs = new SQSClient({ region: 'us-east-2' })

const SCHEDULED_QUEUE_URL = process.env.SCHEDULED_QUEUE_URL
const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL

export async function handler() {
    console.log("=== 🕓 Scheduler Lambda Invoked ===")
    console.log(`Scheduled Queue URL: ${SCHEDULED_QUEUE_URL}`)
    console.log(`Notification Queue URL: ${NOTIFICATION_QUEUE_URL}`)

    const receiveCmd = new ReceiveMessageCommand({
        QueueUrl: SCHEDULED_QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 5
    })

    const { Messages } = await sqs.send(receiveCmd)

    if (!Messages || Messages.length === 0) {
        console.log("✅ No messages to process in scheduled-queue.")
        return { statusCode: 200 }
    }

    console.log(`📥 Received ${Messages.length} message(s) from scheduled-queue.`)

    for (const [index, message] of Messages.entries()) {
        console.log(`\n🔄 Processing message #${index + 1}:`, message.MessageId)

        try {
            const body = JSON.parse(message.Body)
            const { userId, title, sendAt } = body
            const now = new Date()

            console.log(`📨 userId: ${userId} | title: ${title}`)
            console.log(`📅 sendAt: ${sendAt} | now: ${now.toISOString()}`)

            if (!sendAt || new Date(sendAt) <= now) {
                console.log(`✅ Message is ready to send. Forwarding to notification-queue...`)
                await sqs.send(new SendMessageCommand({
                    QueueUrl: NOTIFICATION_QUEUE_URL,
                    MessageBody: JSON.stringify(body)
                }))
                console.log(`🚀 Message forwarded to notification-queue.`)
            } else {
                const delaySec = Math.min(Math.floor((new Date(sendAt) - now) / 1000), 900)
                console.log(`⏳ Message is not ready. Requeueing with DelaySeconds = ${delaySec}s`)
                await sqs.send(new SendMessageCommand({
                    QueueUrl: SCHEDULED_QUEUE_URL,
                    MessageBody: JSON.stringify(body),
                    DelaySeconds: delaySec
                }))
                console.log(`🔁 Message requeued to scheduled-queue.`)
            }

            // Always delete the original
            await sqs.send(new DeleteMessageCommand({
                QueueUrl: SCHEDULED_QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle
            }))
            console.log(`🗑️ Deleted original message from scheduled-queue.`)

        } catch (err) {
            console.error(`❌ Failed to process message ${message.MessageId}:`, err.message)
        }
    }

    console.log("\n=== ✅ Scheduler Lambda Execution Complete ===")
    return { statusCode: 200 }
}
