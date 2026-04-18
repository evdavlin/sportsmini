import { createClient } from '@supabase/supabase-js'

/** Server-side client; prefers service role when available (admin / cron). */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabaseService = createClient(url, key)
