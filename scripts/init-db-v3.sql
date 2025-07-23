-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS dialog_bank CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_personas CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Firebase UID
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    preferences JSONB DEFAULT '{}',
    birth_date DATE,
    interests TEXT[],
    gender VARCHAR(50) CHECK (gender IN ('male', 'female', 'other')),
    current_tier VARCHAR(50) DEFAULT 'free' CHECK (current_tier IN ('free', 'premium', 'silver')),
    talk_time_minutes INTEGER DEFAULT 15,
    talk_time_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    device_tokens TEXT[], -- Array of FCM device tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personas table with enhanced JSON config
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    personality_traits TEXT[] DEFAULT '{}', -- For backward compatibility
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

-- Dialog bank for persona training with vector embeddings
CREATE TABLE dialog_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    expected_response TEXT NOT NULL,
    context TEXT,
    style_tags TEXT[] DEFAULT '{}',
    personality_tags TEXT[] DEFAULT '{}',
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Persona relationships (friends)
CREATE TABLE user_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    is_favorite BOOLEAN DEFAULT false,
    last_interaction TIMESTAMP WITH TIME ZONE,
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
    embedding vector(1536), -- For semantic search of conversations
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_short_term_memory BOOLEAN DEFAULT true,
    is_long_term_memory_converted BOOLEAN DEFAULT false
);

-- Long-term memories with vector embeddings
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    embedding vector(1536), -- For semantic search of memories
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL CHECK (tier IN ('premium', 'silver', 'add_on')),
    stripe_subscription_id VARCHAR(255),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    minutes_purchased INTEGER,
    minutes_remaining INTEGER,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_personas_active ON personas(is_active);
CREATE INDEX idx_conversations_user_persona ON conversations(user_id, persona_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX idx_user_personas_user_id ON user_personas(user_id);
CREATE INDEX idx_user_personas_persona_id ON user_personas(persona_id);
CREATE INDEX idx_dialog_bank_persona_id ON dialog_bank(persona_id);
CREATE INDEX idx_memories_user_persona ON memories(user_id, persona_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Vector indexes for similarity search (using IVFFlat algorithm)
CREATE INDEX idx_dialog_bank_embedding ON dialog_bank USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_conversations_embedding ON conversations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at 
    BEFORE UPDATE ON personas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dialog_bank_updated_at 
    BEFORE UPDATE ON dialog_bank 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with Firebase authentication';
COMMENT ON TABLE personas IS 'AI personas with personality and voice configurations';
COMMENT ON TABLE dialog_bank IS 'Training examples for persona responses with vector embeddings';
COMMENT ON TABLE conversations IS 'Chat history between users and personas';
COMMENT ON TABLE memories IS 'Long-term memories extracted from conversations';
COMMENT ON TABLE subscriptions IS 'User subscription and payment information';

COMMENT ON COLUMN dialog_bank.embedding IS 'Vector embedding of user_input for similarity search';
COMMENT ON COLUMN conversations.embedding IS 'Vector embedding of content for semantic search';
COMMENT ON COLUMN memories.embedding IS 'Vector embedding of summary for memory retrieval';
