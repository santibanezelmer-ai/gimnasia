import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/core/config/env'
import type { Database } from '@/core/types/database'

let supabaseInstance: SupabaseClient<Database> | null = null

/**
 * Returns the singleton Supabase client for client-side queries.
 * Enforces use of the public anonymous key.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const url = env.supabaseUrl || 'https://placeholder-operix.supabase.co'
  const anonKey = env.supabaseAnonKey || 'placeholder-anon-key'

  supabaseInstance = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })

  return supabaseInstance
}

export const supabase = getSupabase()
