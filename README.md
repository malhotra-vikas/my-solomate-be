# mySOLO Mate Backend

A comprehensive AI persona chat backend built with Next.js, Firebase Auth, Supabase, and OpenAI. This system enables users to interact with AI personas through text and voice conversations, with advanced features like vector-based memory, personality training, and subscription management.



## 🏗️ Architecture Overview

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Next.js API   │    │   Supabase      │
│   (Mobile/Web)  │◄──►│   Routes        │◄──►│   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Firebase      │
                       │   Auth          │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   External APIs │
                       │   • OpenAI      │
                       │   • ElevenLabs  │
                       └─────────────────┘
\`\`\`

## 🚀 Features

### Core Features
- **AI Persona Chat**: Text and voice conversations with customizable AI personas
- **Vector Memory**: Semantic search for conversation history and persona training
- **User Authentication**: Firebase Auth integration with Supabase user profiles
- **Subscription Management**: Tiered access with talk-time limits
- **Voice Synthesis**: ElevenLabs integration for realistic voice responses
- **Real-time Notifications**: Firebase Cloud Messaging support

### Advanced Features
- **Dialog Bank**: Train personas with example conversations
- **Long-term Memory**: Convert short-term conversations to searchable memories
- **Personality Configuration**: Detailed JSON-based persona customization
- **Vector Similarity Search**: Find relevant context using embeddings
- **Admin Panel Ready**: Extensible for persona management interfaces

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Supabase recommended)
- Firebase project with Authentication enabled
- OpenAI API key
- ElevenLabs API key (for voice features)

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

\`\`\`bash
git clone [<repository-url>](https://github.com/malhotra-vikas/my-solomate-be)
cd mysolo-mate-backend
npm install
\`\`\`

### 2. Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs Configuration (Optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
\`\`\`

### 3. Database Setup

#### Option A: Using Supabase (Recommended)

1. Create a new Supabase project
2. Enable the vector extension:
   \`\`\`sql
   CREATE EXTENSION IF NOT EXISTS vector;
   \`\`\`
3. Run the database migration:
   \`\`\`bash
   psql -h your-supabase-host -U postgres -d postgres -f scripts/init-db-v3.sql
   \`\`\`

#### Option B: Local PostgreSQL

1. Install pgvector extension:
   \`\`\`bash
   # macOS with Homebrew
   brew install pgvector
   
   # Ubuntu/Debian
   sudo apt install postgresql-server-dev-all
   git clone https://github.com/pgvector/pgvector.git
   cd pgvector && make && sudo make install
   \`\`\`

2. Run the setup script:
   \`\`\`bash
   ./scripts/install-vector-extension.sh
   \`\`\`

3. Initialize the database:
   \`\`\`bash
   psql -d your_database -f scripts/init-db-v3.sql
   \`\`\`

### 4. Seed Sample Data

\`\`\`bash
# Add sample personas
psql -d your_database -f scripts/seed-personas-v2.sql

# Add vector functions
psql -d your_database -f scripts/vector-functions.sql
\`\`\`

### 5. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with Email/Password
3. Generate a service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Copy the JSON content to your `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

## 🏃‍♂️ Running the Application

### Development Mode

\`\`\`bash
npm run dev
\`\`\`

The API will be available at `http://localhost:3000`

### Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

## 🧪 Testing

### Automated API Tests

Run the comprehensive test suite:

\`\`\`bash
chmod +x test/api-tests.sh
./test/api-tests.sh
\`\`\`

The test script will:
1. Create a new user account
2. Generate Firebase authentication tokens
3. Test all major API endpoints
4. Verify database operations
5. Test persona interactions

### Manual Testing

#### Health Check
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

#### User Signup
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
\`\`\`

#### Debug Login (for troubleshooting)
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/debug-login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_FIREBASE_TOKEN"}'
\`\`\`

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`
Create a new user account.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "User signed up successfully",
  "user": {
    "id": "firebase-uid",
    "email": "user@example.com",
    "name": "User Name",
    "current_tier": "free",
    "talk_time_minutes": 15
  }
}
\`\`\`

#### POST `/api/auth/login`
Authenticate user with Firebase ID token.

**Request:**
\`\`\`json
{
  "idToken": "firebase-id-token"
}
\`\`\`

#### GET `/api/auth/profile`
Get current user profile (requires authentication).

**Headers:**
\`\`\`
Authorization: Bearer <firebase-id-token>
\`\`\`

### Persona Endpoints

#### GET `/api/personas`
List all available personas.

#### POST `/api/personas`
Create a new persona (admin only).

#### GET `/api/personas/[id]`
Get specific persona details.

#### POST `/api/personas/[id]/add-friend`
Add persona to user's friends list.

#### POST `/api/personas/[id]/dialog-bank`
Add training example to persona's dialog bank.

### Chat Endpoints

#### POST `/api/chat/text`
Send text message to persona.

**Request:**
\`\`\`json
{
  "personaId": "persona-uuid",
  "message": "Hello, how are you?"
}
\`\`\`

#### POST `/api/chat/voice`
Send voice message to persona (returns audio response).

#### GET `/api/chat/history/[personaId]`
Get conversation history with specific persona.

## 🗄️ Database Schema

### Core Tables

- **users**: User profiles and subscription info
- **personas**: AI persona configurations
- **conversations**: Chat message history
- **memories**: Long-term memory summaries
- **dialog_bank**: Training examples for personas
- **user_personas**: User-persona relationships
- **subscriptions**: Payment and tier management

### Vector Extensions

The system uses PostgreSQL's vector extension for:
- Semantic search in conversation history
- Finding similar dialog examples
- Memory retrieval based on context
- Persona response training

## 🔧 Configuration

### Persona Configuration

Personas are configured using detailed JSON structures:

\`\`\`json
{
  "personality_config": {
    "traits": ["warm", "empathetic", "creative"],
    "speaking_style": {
      "tone": "gentle and engaging",
      "pace": "moderate",
      "formality": "casual",
      "humor": "light"
    },
    "background": {
      "role": "companion",
      "expertise": ["emotional support", "creativity"],
      "interests": ["art", "music", "nature"]
    },
    "conversation_rules": [
      "Keep responses warm and supportive",
      "Ask thoughtful questions",
      "Use creative metaphors when appropriate"
    ]
  },
  "voice_config": {
    "elevenlabs_voice_id": "voice-id",
    "stability": 0.75,
    "similarity_boost": 0.85,
    "style": 0.6,
    "use_speaker_boost": true
  }
}
\`\`\`

### Environment Configuration

Key environment variables and their purposes:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key for client connections
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK credentials (JSON)
- `OPENAI_API_KEY`: For text generation and embeddings
- `ELEVENLABS_API_KEY`: For voice synthesis (optional)

## 🚨 Troubleshooting

### Common Issues

#### 1. "Vector extension not found"
\`\`\`bash
# Check if pgvector is installed
psql -d your_db -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# If not found, install it
CREATE EXTENSION IF NOT EXISTS vector;
\`\`\`

#### 2. "Firebase token verification failed"
- Ensure your Firebase service account key is correctly formatted JSON
- Check that the Firebase project ID matches your configuration
- Verify the token hasn't expired (tokens expire after 1 hour)

#### 3. "Supabase connection failed"
- Verify your Supabase URL and anon key
- Check if your IP is whitelisted in Supabase settings
- Ensure the database is running and accessible

#### 4. "OpenAI API errors"
- Verify your API key is valid and has sufficient credits
- Check rate limits if getting 429 errors
- Ensure you're using the correct model names

### Debug Tools

#### Health Check Endpoint
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

This endpoint tests all major service connections and reports their status.

#### Debug Login Endpoint
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/debug-login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"your-token"}'
\`\`\`

Provides detailed debugging information for authentication issues.

#### Firebase Token Generator
\`\`\`bash
node scripts/get-firebase-id-token.mjs [user-id]
\`\`\`

Generates a fresh Firebase ID token for testing.

### Logging

The application uses structured logging. Check your console output for:
- 🔍 Debug information
- ✅ Successful operations
- ⚠️ Warnings
- ❌ Errors
- 💥 Critical failures

## 🔒 Security Considerations

- All API routes requiring authentication verify Firebase ID tokens
- User data is isolated using Row Level Security policies
- Sensitive environment variables should never be committed
- API keys should be rotated regularly
- Database connections use SSL in production

## 📈 Performance Optimization

- Vector indexes are created for similarity search operations
- Database queries are optimized with appropriate indexes
- Conversation history is paginated to prevent large data transfers
- Embeddings are cached to reduce OpenAI API calls

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

\`\`\`bash
npm run build
npm start
\`\`\`

Ensure your production environment has:
- All required environment variables
- Database connectivity
- Proper SSL certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the test suite
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the test output for specific error messages
3. Check server logs for detailed error information
4. Open an issue with detailed reproduction steps

---

## Generate Token for PostMan
Step 1: Open the Auth URL in Browser
https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=537794423956-kd6r0tulp27oa4u1auru0q7gss24bvo2.apps.googleusercontent.com&redirect_uri=http://localhost:3000&scope=openid%20email%20profile&access_type=offline&prompt=consent 

Login with Google
Copy the code from the redirect URL:
http://localhost:3000/?code=4%2F0AVMBsJg1B0eDUhbNpCOAMnw6bkUzOg7Ro1N1DNiK9vR4NddnXOoMNGt9HnfOFficmgX6IA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+openid&authuser=0&prompt=consent

Step 2: Decode the Code
Use this site: https://urldecode.org
Paste: 4%2F0AVMBsJgf1B0eDUh...
Get decoded: 4/0AVMBsJgf1B0eDUh...

Step 3: Exchange Code for Tokens using Postman or curl
curl version (works same in Postman)

**Happy coding! 🎉**
