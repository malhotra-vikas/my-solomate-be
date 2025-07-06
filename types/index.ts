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

export type Persona = {
  id: string
  name: string
  description: string
  personality_traits: string[]
  voice_id: string
  tone_description: string
  avatar_url: string
  initial_prompt: string
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
