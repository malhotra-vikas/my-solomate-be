#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
FIREBASE_TOKEN="your-firebase-id-token-here"

echo -e "${YELLOW}=== mySOLO Mate BE API Tests ===${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Helper function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X $method \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $FIREBASE_TOKEN" \
            -d "$data" \
            "$BASE_URL$endpoint"
    else
        curl -s -X $method \
            -H "Authorization: Bearer $FIREBASE_TOKEN" \
            "$BASE_URL$endpoint"
    fi
}

# Test 1: User Signup
echo -e "${YELLOW}1. Testing User Signup${NC}"
SIGNUP_RESPONSE=$(make_request POST "/api/auth/signup" '{
    "email": "test@example.com",
    "name": "Test User"
}')
echo "Response: $SIGNUP_RESPONSE"
echo ""

# Test 2: User Login
echo -e "${YELLOW}2. Testing User Login${NC}"
LOGIN_RESPONSE=$(make_request POST "/api/auth/login" '{}')
echo "Response: $LOGIN_RESPONSE"
echo ""

# Test 3: Get User Profile
echo -e "${YELLOW}3. Testing Get User Profile${NC}"
PROFILE_RESPONSE=$(make_request GET "/api/auth/profile")
echo "Response: $PROFILE_RESPONSE"
echo ""

# Test 4: List Personas
echo -e "${YELLOW}4. Testing List Personas${NC}"
PERSONAS_RESPONSE=$(make_request GET "/api/personas")
echo "Response: $PERSONAS_RESPONSE"
echo ""

# Test 5: Create New Persona
echo -e "${YELLOW}5. Testing Create New Persona${NC}"
CREATE_PERSONA_RESPONSE=$(make_request POST "/api/personas" '{
    "name": "TestBot",
    "description": "A test AI persona",
    "avatar_url": "/test-avatar.png",
    "personality": {
        "traits": ["helpful", "friendly", "knowledgeable"],
        "speaking_style": {
            "tone": "professional yet approachable",
            "pace": "measured and clear",
            "formality": "semi-formal",
            "humor": "light and appropriate"
        },
        "background": {
            "role": "AI assistant",
            "expertise": ["general knowledge", "problem solving"],
            "interests": ["learning", "helping others"]
        },
        "conversation_rules": [
            "Be helpful and informative",
            "Ask clarifying questions when needed",
            "Maintain a positive tone"
        ]
    },
    "voice_settings": {
        "elevenlabs_voice_id": "test-voice-id",
        "stability": 0.8,
        "similarity_boost": 0.8,
        "style": 0.5,
        "use_speaker_boost": true
    },
    "system_prompt": "You are TestBot, a helpful AI assistant focused on providing clear and accurate information."
}')
echo "Response: $CREATE_PERSONA_RESPONSE"

# Extract persona ID for further tests
PERSONA_ID=$(echo $CREATE_PERSONA_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created Persona ID: $PERSONA_ID"
echo ""

# Test 6: Get Specific Persona
if [ -n "$PERSONA_ID" ]; then
    echo -e "${YELLOW}6. Testing Get Specific Persona${NC}"
    GET_PERSONA_RESPONSE=$(make_request GET "/api/personas/$PERSONA_ID")
    echo "Response: $GET_PERSONA_RESPONSE"
    echo ""
fi

# Test 7: Add Dialog Bank Example
if [ -n "$PERSONA_ID" ]; then
    echo -e "${YELLOW}7. Testing Add Dialog Bank Example${NC}"
    ADD_DIALOG_RESPONSE=$(make_request POST "/api/personas/$PERSONA_ID/dialog-bank" '{
        "user_input": "Hello, how are you?",
        "expected_response": "Hello! I'\''m doing great, thank you for asking. How can I help you today?",
        "context": "Greeting interaction",
        "style_tags": ["friendly", "welcoming"],
        "personality_tags": ["helpful", "positive"]
    }')
    echo "Response: $ADD_DIALOG_RESPONSE"
    echo ""
fi

# Test 8: Get Dialog Bank Examples
if [ -n "$PERSONA_ID" ]; then
    echo -e "${YELLOW}8. Testing Get Dialog Bank Examples${NC}"
    GET_DIALOG_RESPONSE=$(make_request GET "/api/personas/$PERSONA_ID/dialog-bank")
    echo "Response: $GET_DIALOG_RESPONSE"
    echo ""
fi

# Test 9: Text Chat with Persona
if [ -n "$PERSONA_ID" ]; then
    echo -e "${YELLOW}9. Testing Text Chat${NC}"
    CHAT_RESPONSE=$(make_request POST "/api/chat/text" '{
        "personaId": "'$PERSONA_ID'",
        "message": "Hello, how are you?"
    }')
    echo "Response: $CHAT_RESPONSE"
    echo ""
fi

# Test 10: Get Chat History
if [ -n "$PERSONA_ID" ]; then
    echo -e "${YELLOW}10. Testing Get Chat History${NC}"
    HISTORY_RESPONSE=$(make_request GET "/api/chat/history/$PERSONA_ID")
    echo "Response: $HISTORY_RESPONSE"
    echo ""
fi

echo -e "${GREEN}=== API Tests Complete ===${NC}"
echo ""
echo -e "${YELLOW}Note: Make sure to:${NC}"
echo "1. Replace 'your-firebase-id-token-here' with a valid Firebase ID token"
echo "2. Ensure your server is running on localhost:3000"
echo "3. Run the database initialization scripts first"
echo "4. Install the vector extension in your PostgreSQL database"
