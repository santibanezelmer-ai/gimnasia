/**
 * Environment configuration and validation.
 * Ensures strictly that only public (anon) client credentials are accessible in the frontend.
 * Never expose service_role or backend secret keys.
 */

export interface AppEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  appName: string
  appEnv: 'development' | 'production' | 'test'
  isConfigured: boolean
}

function resolveEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const appName = import.meta.env.VITE_APP_NAME || 'Operix Gymnastics'
  const appEnv = (import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development') as AppEnv['appEnv']

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id'))

  return {
    supabaseUrl,
    supabaseAnonKey,
    appName,
    appEnv,
    isConfigured,
  }
}

export const env: AppEnv = resolveEnv()

export function assertSupabaseConfigured(): void {
  if (!env.isConfigured) {
    throw new Error(
      'Supabase credentials are missing or unconfigured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    )
  }
}
