# 🧠 No-SoloMate Added Evaluation Lambda

This AWS Lambda identifies users who **created accounts yesterday** but **did not select a SoloMate persona**, and sends them a personalized push notification using AWS SQS and Firebase Cloud Messaging (FCM).

---

## 📦 Overview

- **Purpose:** Encourage new users to add their first SoloMate.
- **Trigger:** Scheduled daily (e.g., via CloudWatch Events / EventBridge at 3 AM EST).
- **Technology:**
  - Supabase for user data
  - AWS SQS for notification queuing
  - Firebase Admin SDK for push delivery (handled by a separate processor Lambda)

---

## 🛠 Environment Variables

| Key                        | Description                               |
|---------------------------|-------------------------------------------|
| `SUPABASE_URL`            | Supabase project URL                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (secure!)           |
| `NOTIFICATION_QUEUE_URL`  | AWS SQS URL for notification delivery     |

---

## 🧪 Example Notification Payload

Sent to `NOTIFICATION_QUEUE_URL`:

```json
{
  "userId": "1234-5678",
  "title": "Don't forget to add your SoloMate!",
  "body": "Hey Sam, pick your first SoloMate and start chatting.",
  "type": "ADD_SOLOMATE_REMINDER",
  "data": {
    "screen": "PersonaProfile"
  },
  "sendAt": "2025-08-02T15:00:00Z"
}

## Running Schedule
Scheduler based. Runs daily at 10 AM PST


