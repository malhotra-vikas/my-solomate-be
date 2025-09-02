import OpenAI from "openai"

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const chatModel = process.env.OPENAI_CHAT_MODEL

export const voiceModel = process.env.OPENAI_VOICE_MODEL
