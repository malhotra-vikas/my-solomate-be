// lib/supabase.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
