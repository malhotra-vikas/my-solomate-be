-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- Firebase UID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    photo_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    current_tier TEXT DEFAULT 'free' NOT NULL,
    talk_time_minutes INT DEFAULT 0 NOT NULL,
    talk_time_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personas Table
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    personality_traits TEXT[] DEFAULT '{}',
    voice_id TEXT, -- ElevenLabs voice ID
    tone_description TEXT,
    avatar_url TEXT,
    initial_prompt TEXT, -- System prompt for GPT
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Personas (Friendship) Table
CREATE TABLE IF NOT EXISTS user_personas (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, persona_id)
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL, -- Text transcript
    audio_url TEXT, -- URL to stored audio if voice chat
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_short_term_memory BOOLEAN DEFAULT TRUE,
    is_long_term_memory_converted BOOLEAN DEFAULT FALSE
);

-- Memories Table (Long-Term Memory)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    summary TEXT NOT NULL, -- Concise summary of a conversation segment
    embedding VECTOR(1536), -- OpenAI embedding for semantic search (ada-002 is 1536 dimensions)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL, -- 'premium', 'silver', 'add_on'
    stripe_subscription_id TEXT, -- For recurring subscriptions
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE, -- Nullable for add-ons (minutes_remaining tracks usage)
    minutes_purchased INT, -- For add-ons
    minutes_remaining INT, -- For add-ons
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_persona ON conversations (user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_persona ON memories (user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
