# 🚀 Notification Delivery Lambda

This AWS Lambda reads messages from an SQS queue and delivers push notifications using Firebase Cloud Messaging (FCM). It fetches FCM tokens from Supabase and sends notifications to all registered devices.

---

## 📦 Setup

1. Install dependencies and create deployment ZIP:
   ```bash
   npm run zip

## Test 

This Lambda will be triggered by SQS

This is test event

{
  "Records": [
    {
      "body": "{\"userId\":\"111891350377889370050\",\"title\":\"Hello\",\"body\":\"This is a test\",\"data\":{\"screen\":\"Home\"}}"
    }
  ]
}

