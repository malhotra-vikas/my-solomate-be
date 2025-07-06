-- Drop existing tables if they exist
DROP TABLE IF EXISTS dialog_bank CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_personas CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Firebase UID
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    preferences JSONB DEFAULT '{}',
    current_tier VARCHAR(50) DEFAULT 'free',
    talk_time_minutes INTEGER DEFAULT 15,
    talk_time_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    device_tokens TEXT[], -- Array of FCM device tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personas table with enhanced personality and voice configuration
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality_traits TEXT[], -- For backward compatibility
    voice_id VARCHAR(255), -- For backward compatibility
    tone_description TEXT, -- For backward compatibility
    avatar_url TEXT,
    initial_prompt TEXT NOT NULL,
    personality_config JSONB, -- New detailed personality configuration
    voice_config JSONB, -- New detailed voice configuration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Persona relationships (friends)
CREATE TABLE user_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, persona_id)
);

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    audio_url TEXT, -- For voice messages
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dialog bank for training personas
CREATE TABLE dialog_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    expected_response TEXT NOT NULL,
    context TEXT,
    style_tags TEXT[],
    personality_tags TEXT[],
    embedding vector(1536), -- OpenAI embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_conversations_user_persona ON conversations(user_id, persona_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX idx_user_personas_user_id ON user_personas(user_id);
CREATE INDEX idx_dialog_bank_persona_id ON dialog_bank(persona_id);
CREATE INDEX idx_dialog_bank_embedding ON dialog_bank USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dialog_bank_updated_at BEFORE UPDATE ON dialog_bank FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
