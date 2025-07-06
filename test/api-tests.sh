#!/bin/bash

# This script contains curl commands to test all API endpoints for the mySOLO Mate BE project.
#
# IMPORTANT:
# 1. Replace 'http://localhost:3002' with your deployed Vercel URL when testing in production.
# 2. Replace 'YOUR_FIREBASE_ID_TOKEN' with a valid Firebase ID token obtained after signup/login.
# 3. Replace 'YOUR_USER_ID' with the actual user ID (UID) from Firebase.
# 4. Replace 'YOUR_PERSONA_ID' with an actual persona ID (you can get this from the /api/personas GET request).
# 5. Replace 'YOUR_INTERNAL_API_KEY' with the internal API key you've set in your Vercel environment variables.
# 6. For voice chat, ensure you have a dummy 'audio.mp3' file in the same directory as this script.

# --- Configuration Variables (Update these before running) ---
BASE_URL="http://localhost:3000" # Or your Vercel deployment URL
FIREBASE_ID_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ3YWU0OWM0YzlkM2ViODVhNTI1NDA3MmMzMGQyZThlNzY2MWVmZTEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW5vdGhlciBOZXcgVXNlciIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9teXNvbG9tYXRlIiwiYXVkIjoibXlzb2xvbWF0ZSIsImF1dGhfdGltZSI6MTc1MTc3NjQ0OCwidXNlcl9pZCI6IkU0Mkd6TEs0bThhN2tvSmJ3WU1KdXFGOWFnSjMiLCJzdWIiOiJFNDJHekxLNG04YTdrb0pid1lNSnVxRjlhZ0ozIiwiaWF0IjoxNzUxNzc2NDQ4LCJleHAiOjE3NTE3ODAwNDgsImVtYWlsIjoiYW5vdG90aGVyX25ld191c2VyQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImFub3RoZXJfbmV3X3VzZXJAZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.EX_KHD9Q_mhiiyCen50CzSpFsXL0FyOSGliHznWiz8uJXu1RbDUTKLtXD0rf6CSaAYWwfxW-HkDBFjCGmc2mQgHg0HUIP5OkzvVpe-DuAThlrjuAoPyNUS4reYmXCPFbBrGoCJRHWf3n3TAmZmx1wkamWdsxobUgBd4tKx05x8BWMD741IU5gGa-9gzeGfadSuw_trB_95W7Y4-Q61zT4WNP-Kewm5m3yvPVO4wOAIgZvXHu_u39_xiRSh5HWZzwMT875cpTKT34WhfmPn8SKfeSl0sqVDi0JSTSWraiJFI2xf6n9Vr5NMtcr8HcCOC5yrA2lKqeb0LcsWVMjPz20Q"
USER_ID="E42GzLK4m8a7koJbwYMJuqF9agJ3"
PERSONA_ID="957864de-fb13-425d-8a02-be23258a8640" # Replace with an actual persona ID from /api/personas GET or the ID from the POST request below
INTERNAL_API_KEY="YOUR_INTERNAL_API_KEY" # For /api/notifications/send-checkin

echo "--- Testing mySOLO Mate BE API Endpoints ---"
echo "Base URL: $BASE_URL"
echo ""

# --- 1. Authentication Endpoints ---

echo "--- 1.1. Sign Up a New User (POST /api/auth/signup) ---"
curl -X POST "${BASE_URL}/api/auth/signup" \
-H "Content-Type: application/json" \
-d '{
"email": "testuser@example.com",
"password": "password123",
"name": "Test User"
}'
echo -e "\n"

echo "--- 1.2. Log In User (POST /api/auth/login) ---"
# NOTE: You need a valid Firebase ID token here.
# In a real app, this token is obtained after a client-side Firebase sign-in.
curl -X POST "${BASE_URL}/api/auth/login" \
-H "Content-Type: application/json" \
-d '{
"idToken": "'"${FIREBASE_ID_TOKEN}"'"
}'
echo -e "\n"

echo "--- 1.3. Get User Profile (GET /api/auth/profile) ---"
curl -X GET "${BASE_URL}/api/auth/profile" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}"
echo -e "\n"

echo "--- 1.4. Update User Profile (PUT /api/auth/profile) ---"
curl -X PUT "${BASE_URL}/api/auth/profile" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"name": "Updated Test User",
"preferences": {
  "theme": "dark",
  "notifications": true
}
}'
echo -e "\n"

# --- 2. Persona Endpoints ---

echo "--- 2.1. Get All Personas (GET /api/personas) ---"
curl -X GET "${BASE_URL}/api/personas" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}"
echo -e "\n"

echo "--- 2.2. Get Persona by ID (GET /api/personas/[id]) ---"
curl -X GET "${BASE_URL}/api/personas/${PERSONA_ID}" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}"
echo -e "\n"

echo "--- 2.3. Add Persona as Friend (POST /api/personas/[id]/add-friend) ---"
curl -X POST "${BASE_URL}/api/personas/${PERSONA_ID}/add-friend" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-H "Content-Type: application/json" \
-d '{}'
echo -e "\n"

echo "--- 2.4. Create New Persona (POST /api/personas) ---"
# Note: After running this, you can copy the 'id' from the response and
# paste it into the PERSONA_ID variable above to test the PUT request.
curl -X POST "${BASE_URL}/api/personas" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
  "name": "Test Persona",
  "description": "A persona created for testing purposes.",
  "avatar_url": "/placeholder.svg?height=100&width=100",
  "personality": {
    "traits": ["friendly", "helpful"],
    "speaking_style": {
      "tone": "calm",
      "pace": "moderate",
      "formality": "casual",
      "humor": "none"
    },
    "background": {
      "role": "test assistant",
      "expertise": ["testing", "debugging"],
      "interests": ["automation", "quality assurance"]
    },
    "conversation_rules": ["Be concise", "Answer directly"]
  },
  "voice_settings": {
    "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
    "stability": 0.7,
    "similarity_boost": 0.8,
    "style": 0.0,
    "use_speaker_boost": true
  },
  "system_prompt": "You are a test persona designed to assist with API testing."
}'
echo -e "\n"

echo "--- 2.5. Update Persona (PUT /api/personas/[id]) ---"
# IMPORTANT: Replace YOUR_PERSONA_ID with the ID of a persona you want to update.
# You can use the ID from the 'Create New Persona' response above.
curl -X PUT "${BASE_URL}/api/personas/${PERSONA_ID}" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
  "name": "Updated Test Persona",
  "description": "This persona has been updated.",
  "personality": {
    "traits": ["friendly", "helpful", "updated"],
    "speaking_style": {
      "tone": "enthusiastic",
      "pace": "fast",
      "formality": "casual",
      "humor": "witty"
    },
    "background": {
      "role": "updated test assistant",
      "expertise": ["testing", "debugging", "refactoring"],
      "interests": ["automation", "quality assurance", "performance"]
    },
    "conversation_rules": ["Be concise", "Answer directly", "Provide more details when asked"]
  },
  "voice_settings": {
    "elevenlabs_voice_id": "pNInz6obpgDQGXGNiebr",
    "stability": 0.8,
    "similarity_boost": 0.9,
    "style": 0.1,
    "use_speaker_boost": false
  },
  "system_prompt": "You are an updated test persona designed to assist with API testing and provide more detailed responses."
}'
echo -e "\n"

# --- 3. Chat Endpoints ---

echo "--- 3.1. Send Text Message (POST /api/chat/text) ---"
curl -X POST "${BASE_URL}/api/chat/text" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"personaId": "'"${PERSONA_ID}"'",
"message": "Hello, how are you today?"
}'
echo -e "\n"

echo "--- 3.2. Send Voice Message (POST /api/chat/voice) ---"
# Ensure you have an 'audio.mp3' file in the same directory as this script.
# You can create a dummy one with: echo "dummy audio content" > audio.mp3
curl -X POST "${BASE_URL}/api/chat/voice" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-F "audio=@./audio.mp3;type=audio/mpeg" \
-F "personaId=${PERSONA_ID}"
echo -e "\n"

echo "--- 3.3. Get Conversation History (GET /api/chat/history/[personaId]) ---"
curl -X GET "${BASE_URL}/api/chat/history/${PERSONA_ID}" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}"
echo -e "\n"

echo "--- 3.4. Convert Short-Term to Long-Term Memory (POST /api/chat/memory/short-to-long) ---"
curl -X POST "${BASE_URL}/api/chat/memory/short-to-long" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"personaId": "'"${PERSONA_ID}"'",
"conversationSegment": "User discussed their day and feelings about work.",
"summary": "User expressed stress about work and sought advice."
}'
echo -e "\n"

# --- 4. Subscription Endpoints ---

echo "--- 4.1. Purchase Subscription/Add-on (POST /api/subscriptions/purchase) ---"
echo "--- Example for purchasing a 'premium' tier ---"
curl -X POST "${BASE_URL}/api/subscriptions/purchase" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"tier": "premium",
"priceId": "price_12345"
}'
echo -e "\n"

echo "--- Example for purchasing an 'add_on' of 30 minutes ---"
curl -X POST "${BASE_URL}/api/subscriptions/purchase" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"tier": "add_on",
"minutes": 30,
"priceId": "price_67890"
}'
echo -e "\n"

# --- 5. Notification Endpoints ---

echo "--- 5.1. Register Device Token (POST /api/notifications/register-device) ---"
curl -X POST "${BASE_URL}/api/notifications/register-device" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
-d '{
"deviceToken": "YOUR_FCM_DEVICE_TOKEN"
}'
echo -e "\n"

echo "--- 5.2. Send Check-in Notification (POST /api/notifications/send-checkin) ---"
# This endpoint is designed to be called by an internal service (e.g., a cron job),
# not directly by the client. It requires an X-Internal-API-Key header.
curl -X POST "${BASE_URL}/api/notifications/send-checkin" \
-H "Content-Type: application/json" \
-H "X-Internal-API-Key: ${INTERNAL_API_KEY}" \
-d '{
"userId": "'"${USER_ID}"'",
"personaId": "'"${PERSONA_ID}"'",
"messageContent": "Just checking in! How are you doing today?"
}'
echo -e "\n"

echo "--- All curl commands executed. ---"
