import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null = mode démo (aucune base configurée). */
export const supabase: SupabaseClient | null =
  url && key && !url.includes('xxxxxxxx') ? createClient(url, key, { auth: { persistSession: true } }) : null

export const isDemo = supabase === null
