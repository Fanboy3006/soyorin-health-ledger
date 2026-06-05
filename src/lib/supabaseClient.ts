import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Please check your .env file.',
  )
}

/**
 * Public anon client — used for all Supabase operations.
 * RLS policies control data access per user.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
