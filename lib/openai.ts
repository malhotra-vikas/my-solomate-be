import OpenAI from "openai"
import { generateText, streamText } from "ai"
import { openai as aiSdkOpenai } from "@ai-sdk/openai"

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export { generateText, streamText, aiSdkOpenai }
