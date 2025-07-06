export interface UserProfile {
  id: string
  email: string
  name: string
  photo_url?: string
  preferences: Record<string, any>
  current_tier: "free" | "premium" | "enterprise"
  talk_time_minutes: number
  talk_time_expires_at: string
  device_tokens?: string[]
  created_at: string
  updated_at: string
}

export interface Memory {
  id: string
  user_id: string
  persona_id: string
  summary: string
  embedding: number[]
  created_at: string
}


export interface PersonalityConfig {
  traits: string[]
  speaking_style: {
    tone: string
    pace: string
    formality: string
    humor: string
  }
  background: {
    role: string
    expertise: string[]
    interests: string[]
  }
  conversation_rules: string[]
}

export interface VoiceConfig {
  elevenlabs_voice_id: string
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export interface Persona {
  id: string
  name: string
  description: string
  personality_traits: string[] // For backward compatibility
  voice_id: string // For backward compatibility
  tone_description: string // For backward compatibility
  avatar_url: string
  initial_prompt: string
  personality_config?: PersonalityConfig // New detailed config
  voice_config?: VoiceConfig // New detailed config
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  persona_id: string
  role: "user" | "assistant"
  content: string
  audio_url?: string
  timestamp: string
}

export interface DialogExample {
  id: string
  persona_id: string
  user_input: string
  expected_response: string
  context?: string
  style_tags: string[]
  personality_tags: string[]
  embedding?: number[]
  created_at: string
  updated_at: string
}

export interface CreatePersonaRequest {
  name: string
  description: string
  avatar_url?: string
  personality: PersonalityConfig
  voice_settings: VoiceConfig
  system_prompt: string
}

export interface UpdatePersonaRequest {
  name?: string
  description?: string
  avatar_url?: string
  personality?: PersonalityConfig
  voice_settings?: VoiceConfig
  system_prompt?: string
}

export interface CreateDialogExampleRequest {
  user_input: string
  expected_response: string
  context?: string
  style_tags: string[]
  personality_tags: string[]
}
