export type UserProfile = {
  id: string
  email: string
  name?: string
  photo_url?: string
  preferences?: Record<string, any>
  current_tier: string
  talk_time_minutes: number
  talk_time_expires_at?: string
}

export type PersonaPersonality = {
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

export type PersonaVoiceSettings = {
  elevenlabs_voice_id: string
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export type Persona = {
  id: string
  name: string
  description: string
  personality_traits: string[] // Existing field, derived from personality_config.personality.traits
  voice_id: string // Existing field, derived from voice_config.elevenlabs_voice_id
  tone_description: string // Existing field, derived from personality_config.personality.speaking_style.tone
  avatar_url: string
  initial_prompt: string // Existing field, derived from system_prompt
  personality_config: PersonaPersonality // New field for detailed personality
  voice_config: PersonaVoiceSettings // New field for detailed voice settings
}

export type ConversationMessage = {
  id: string
  user_id: string
  persona_id: string
  role: "user" | "assistant"
  content: string
  audio_url?: string
  timestamp: string
  is_short_term_memory: boolean
  is_long_term_memory_converted: boolean
}

export type Memory = {
  id: string
  user_id: string
  persona_id: string
  summary: string
  embedding: number[]
  created_at: string
}

export type Subscription = {
  id: string
  user_id: string
  tier: "premium" | "silver" | "add_on"
  stripe_subscription_id?: string
  start_date: string
  end_date?: string
  minutes_purchased?: number
  minutes_remaining?: number
  status: "active" | "cancelled" | "expired"
}
