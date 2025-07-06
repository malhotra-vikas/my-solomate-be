// lib/supabase.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseRoleKey)
}
