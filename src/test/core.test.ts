import { describe, it, expect } from 'vitest'
import { env, assertSupabaseConfigured } from '@/core/config/env'
import { getSupabase } from '@/lib/supabase/client'

describe('Core Environment & Security Invariants', () => {
  it('does not expose secret service_role keys to the browser environment', () => {
    // Check all import.meta.env keys
    const envKeys = Object.keys(import.meta.env)
    const dangerousKeys = envKeys.filter(
      (key) =>
        key.toLowerCase().includes('service_role') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('private_key')
    )

    expect(dangerousKeys).toHaveLength(0)
  })

  it('correctly reports unconfigured state when placeholder values are present', () => {
    expect(typeof env.isConfigured).toBe('boolean')
    if (!env.isConfigured) {
      expect(() => assertSupabaseConfigured()).toThrow(/Supabase credentials are missing/)
    }
  })

  it('creates a valid Supabase client instance with public anon configuration', () => {
    const client = getSupabase()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
