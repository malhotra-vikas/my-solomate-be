-- Drop existing tables if they exist
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_personas CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS persona_dialog_bank CASCADE;

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  photo_url TEXT,
  preferences JSONB DEFAULT '{}',
  current_tier TEXT DEFAULT 'free' CHECK (current_tier IN ('free', 'premium', 'silver')),
  talk_time_minutes INTEGER DEFAULT 0,
  talk_time_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personas table with enhanced JSON config
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  personality_traits TEXT[] DEFAULT '{}',
  voice_id TEXT,
  tone_description TEXT,
  avatar_url TEXT,
  initial_prompt TEXT,
  personality_config JSONB,
  voice_config JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dialog bank for persona training
CREATE TABLE persona_dialog_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  expected_response TEXT NOT NULL,
  context TEXT,
  style_tags TEXT[] DEFAULT '{}',
  personality_tags TEXT[] DEFAULT '{}',
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Persona relationships
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT false,
  last_interaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, persona_id)
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_short_term_memory BOOLEAN DEFAULT true,
  is_long_term_memory_converted BOOLEAN DEFAULT false
);

-- Long-term memories
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('premium', 'silver', 'add_on')),
  stripe_subscription_id TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  minutes_purchased INTEGER,
  minutes_remaining INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_user_persona ON conversations(user_id, persona_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX idx_memories_user_persona ON memories(user_id, persona_id);
CREATE INDEX idx_persona_dialog_bank_persona ON persona_dialog_bank(persona_id);
CREATE INDEX idx_persona_dialog_bank_embedding ON persona_dialog_bank USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
