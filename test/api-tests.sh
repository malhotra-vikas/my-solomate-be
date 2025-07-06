#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
FIREBASE_TOKEN="" # Will be set after signup
USER_ID="" # Will be set after signup
PERSONA_ID="" # Will be set after getting personas

echo -e "${YELLOW}=== mySOLO Mate BE API Tests ===${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Helper function to make requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local use_auth=${4:-true}
    
    if [ "$use_auth" = true ] && [ -n "$FIREBASE_TOKEN" ]; then
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
    else
        if [ -n "$data" ]; then
            curl -s -X $method \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$BASE_URL$endpoint"
        else
            curl -s -X $method \
                "$BASE_URL$endpoint"
        fi
    fi
}

# Extract JSON field helper
extract_json_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4
}

# Test 1: User Signup
echo -e "${BLUE}1. Testing User Signup${NC}"
SIGNUP_RESPONSE=$(make_request POST "/api/auth/signup" '{
    "email": "testuser_'$(date +%s)'@example.com",
    "password": "password123",
    "name": "Test User"
}' false)
echo "Response: $SIGNUP_RESPONSE"

# Extract user ID and check if signup was successful
if echo "$SIGNUP_RESPONSE" | grep -q "User signed up successfully"; then
    USER_ID=$(extract_json_field "$SIGNUP_RESPONSE" "id")
    echo -e "${GREEN}✓ Signup successful. User ID: $USER_ID${NC}"
else
    echo -e "${RED}✗ Signup failed${NC}"
    exit 1
fi
echo ""

# Test 2: Get Firebase Token (simulate login)
echo -e "${BLUE}2. Getting Firebase Token${NC}"
# In a real scenario, you'd get this from Firebase Auth
# For testing, we'll use the script to get a token
if [ -f "scripts/get-firebase-id-token.mjs" ]; then
    echo "Getting Firebase token..."
    TOKEN_RESPONSE=$(node scripts/get-firebase-id-token.mjs)
    if [ $? -eq 0 ]; then
        FIREBASE_TOKEN="$TOKEN_RESPONSE"
        echo -e "${GREEN}✓ Firebase token obtained${NC}"
    else
        echo -e "${YELLOW}⚠ Could not get Firebase token automatically. Using manual token if available.${NC}"
        # You can set a manual token here for testing
        FIREBASE_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ3YWU0OWM0YzlkM2ViODVhNTI1NDA3MmMzMGQyZThlNzY2MWVmZTEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW5vdGhlciBOZXcgVXNlciIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9teXNvbG9tYXRlIiwiYXVkIjoibXlzb2xvbWF0ZSIsImF1dGhfdGltZSI6MTc1MTc3NjQ0OCwidXNlcl9pZCI6IkU0Mkd6TEs0bThhN2tvSmJ3WU1KdXFGOWFnSjMiLCJzdWIiOiJFNDJHekxLNG04YTdrb0pid1lNSnVxRjlhZ0ozIiwiaWF0IjoxNzUxNzc2NDQ4LCJleHAiOjE3NTE3ODAwNDgsImVtYWlsIjoiYW5vdGhlcl9uZXdfdXNlckBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhbm90aGVyX25ld191c2VyQGV4YW1wbGUuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.EX_KHD9Q_mhiiyCen50CzSpFsXL0FyOSGliHznWiz8uJXu1RbDUTKLdXD0rf6CSaAYWwfxW-HkDBFjCGmc2mQgHg0HUIP5OkzvVpe-DuAThlrjuAoPyNUS4reYmXCPFtBrGoCJRHWf3n3TAmZmx1wkamWdsxobUgBd4tKx05x8BWMD741IU5gGa-9gzeGfadSuw_trB_95W7Y4-Q61zT4WNP-Kewm5m3yvPVO4wOAIgZvXHu_u39_xiRSh5HWZzwMT875cpTKT34WhfmPn8SKfeSl0sqVDi0JSTSWraiJFI2xf6n9Vr5NMtcr8HcCOC5yrA2lKqeb0LcsWVMjPz20Q"
    fi
else
    echo -e "${YELLOW}⚠ Firebase token script not found. Using hardcoded token.${NC}"
    FIREBASE_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ3YWU0OWM0YzlkM2ViODVhNTI1NDA3MmMzMGQyZThlNzY2MWVmZTEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQW5vdGhlciBOZXcgVXNlciIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9teXNvbG9tYXRlIiwiYXVkIjoibXlzb2xvbWF0ZSIsImF1dGhfdGltZSI6MTc1MTc3NjQ0OCwidXNlcl9pZCI6IkU0Mkd6TEs0bThhN2tvSmJ3WU1KdXFGOWFnSjMiLCJzdWIiOiJFNDJHekxLNG04YTdrb0pid1lNSnVxRjlhZ0ozIiwiaWF0IjoxNzUxNzc2NDQ4LCJleHAiOjE3NTE3ODAwNDgsImVtYWlsIjoiYW5vdGhlcl9uZXdfdXNlckBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhbm90aGVyX25ld191c2VyQGV4YW1wbGUuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.EX_KHD9Q_mhiiyCen50CzSpFsXL0FyOSGliHznWiz8uJXu1RbDUTKLdXD0rf6CSaAYWwfxW-HkDBFjCGmc2mQgHg0HUIP5OkzvVpe-DuAThlrjuAoPyNUS4reYmXCPFtBrGoCJRHWf3n3TAmZmx1wkamWdsxobUgBd4tKx05x8BWMD741IU5gGa-9gzeGfadSuw_trB_95W7Y4-Q61zT4WNP-Kewm5m3yvPVO4wOAIgZvXHu_u39_xiRSh5HWZzwMT875cpTKT34WhfmPn8SKfeSl0sqVDi0JSTSWraiJFI2xf6n9Vr5NMtcr8HcCOC5yrA2lKqeb0LcsWVMjPz20Q"
fi
echo ""

# Test 3: User Login (verify token works)
echo -e "${BLUE}3. Testing User Login${NC}"
LOGIN_RESPONSE=$(make_request POST "/api/auth/login" '{
    "idToken": "'$FIREBASE_TOKEN'"
}' false)
echo "Response: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q "User logged in successfully"; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${RED}✗ Login failed - token may be expired or invalid${NC}"
fi
echo ""

# Test 4: Get User Profile
echo -e "${BLUE}4. Testing Get User Profile${NC}"
PROFILE_RESPONSE=$(make_request GET "/api/auth/profile")
echo "Response: $PROFILE_RESPONSE"

if echo "$PROFILE_RESPONSE" | grep -q "email"; then
    echo -e "${GREEN}✓ Profile retrieved successfully${NC}"
else
    echo -e "${RED}✗ Failed to get profile${NC}"
fi
echo ""

# Test 5: List Personas
echo -e "${BLUE}5. Testing List Personas${NC}"
PERSONAS_RESPONSE=$(make_request GET "/api/personas")
echo "Response: $PERSONAS_RESPONSE"

# Extract first persona ID for testing
PERSONA_ID=$(echo "$PERSONAS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$PERSONA_ID" ]; then
    echo -e "${GREEN}✓ Personas listed successfully. Using persona ID: $PERSONA_ID${NC}"
else
    echo -e "${YELLOW}⚠ No personas found, will create one${NC}"
fi
echo ""

# Test 6: Create New Persona (if none found)
if [ -z "$PERSONA_ID" ]; then
    echo -e "${BLUE}6. Testing Create New Persona${NC}"
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
    
    PERSONA_ID=$(extract_json_field "$CREATE_PERSONA_RESPONSE" "id")
    if [ -n "$PERSONA_ID" ]; then
        echo -e "${GREEN}✓ Persona created successfully. ID: $PERSONA_ID${NC}"
    else
        echo -e "${RED}✗ Failed to create persona${NC}"
    fi
    echo ""
fi

# Test 7: Add Dialog Bank Example
if [ -n "$PERSONA_ID" ]; then
    echo -e "${BLUE}7. Testing Add Dialog Bank Example${NC}"
    ADD_DIALOG_RESPONSE=$(make_request POST "/api/personas/$PERSONA_ID/dialog-bank" '{
        "user_input": "Hello, how are you?",
        "expected_response": "Hello! I'\''m doing great, thank you for asking. How can I help you today?",
        "context": "Greeting interaction",
        "style_tags": ["friendly", "welcoming"],
        "personality_tags": ["helpful", "positive"]
    }')
    echo "Response: $ADD_DIALOG_RESPONSE"
    
    if echo "$ADD_DIALOG_RESPONSE" | grep -q "user_input"; then
        echo -e "${GREEN}✓ Dialog example added successfully${NC}"
    else
        echo -e "${RED}✗ Failed to add dialog example${NC}"
    fi
    echo ""
fi

# Test 8: Get Dialog Bank Examples
if [ -n "$PERSONA_ID" ]; then
    echo -e "${BLUE}8. Testing Get Dialog Bank Examples${NC}"
    GET_DIALOG_RESPONSE=$(make_request GET "/api/personas/$PERSONA_ID/dialog-bank")
    echo "Response: $GET_DIALOG_RESPONSE"
    
    if echo "$GET_DIALOG_RESPONSE" | grep -q "user_input"; then
        echo -e "${GREEN}✓ Dialog examples retrieved successfully${NC}"
    else
        echo -e "${YELLOW}⚠ No dialog examples found${NC}"
    fi
    echo ""
fi

# Test 9: Text Chat with Persona
if [ -n "$PERSONA_ID" ]; then
    echo -e "${BLUE}9. Testing Text Chat${NC}"
    CHAT_RESPONSE=$(make_request POST "/api/chat/text" '{
        "personaId": "'$PERSONA_ID'",
        "message": "Hello, how are you?"
    }')
    echo "Response: $CHAT_RESPONSE"
    
    if echo "$CHAT_RESPONSE" | grep -q "response"; then
        echo -e "${GREEN}✓ Text chat successful${NC}"
    else
        echo -e "${RED}✗ Text chat failed${NC}"
    fi
    echo ""
fi

# Test 10: Get Chat History
if [ -n "$PERSONA_ID" ]; then
    echo -e "${BLUE}10. Testing Get Chat History${NC}"
    HISTORY_RESPONSE=$(make_request GET "/api/chat/history/$PERSONA_ID")
    echo "Response: $HISTORY_RESPONSE"
    
    if echo "$HISTORY_RESPONSE" | grep -q "content"; then
        echo -e "${GREEN}✓ Chat history retrieved successfully${NC}"
    else
        echo -e "${YELLOW}⚠ No chat history found (this is normal for new conversations)${NC}"
    fi
    echo ""
fi

echo -e "${GREEN}=== API Tests Complete ===${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "User ID: $USER_ID"
echo "Persona ID: $PERSONA_ID"
echo "Firebase Token: ${FIREBASE_TOKEN:0:50}..."
echo ""
echo -e "${YELLOW}Note: If tests are still failing:${NC}"
echo "1. Make sure your database is properly initialized with the new schema"
echo "2. Ensure the vector extension is installed in PostgreSQL"
echo "3. Check that your Firebase configuration is correct"
echo "4. Verify your OpenAI API key is set for embeddings"
