-- Drop existing tables if they exist to ensure a clean slate
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS user_personas CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS device_tokens CASCADE;

-- Create user_profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    photo_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    current_tier TEXT DEFAULT 'free' NOT NULL,
    talk_time_minutes INTEGER DEFAULT 0 NOT NULL,
    talk_time_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create personas table
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    personality_traits TEXT[] DEFAULT '{}'::TEXT[],
    voice_id TEXT NOT NULL,
    tone_description TEXT,
    avatar_url TEXT,
    initial_prompt TEXT NOT NULL,
    -- New JSONB columns for detailed configuration
    personality_config JSONB DEFAULT '{}'::jsonb,
    voice_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_personas (many-to-many relationship for "friends")
CREATE TABLE user_personas (
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, persona_id)
);

-- Create conversation_messages table
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    audio_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_short_term_memory BOOLEAN DEFAULT TRUE,
    is_long_term_memory_converted BOOLEAN DEFAULT FALSE
);

-- Create memories table (for long-term memory)
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    embedding VECTOR(1536), -- Assuming OpenAI embeddings (1536 dimensions)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL, -- e.g., 'premium', 'silver', 'add_on'
    stripe_subscription_id TEXT UNIQUE, -- For Stripe subscriptions
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    minutes_purchased INTEGER, -- For add-on minutes
    minutes_remaining INTEGER, -- For add-on minutes
    status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device_tokens table for push notifications
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT, -- e.g., 'ios', 'android', 'web'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_conversation_messages_user_persona ON conversation_messages(user_id, persona_id);
CREATE INDEX idx_memories_user_persona ON memories(user_id, persona_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
