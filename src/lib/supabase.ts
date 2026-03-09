import { createClient } from '@supabase/supabase-js';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(envSupabaseUrl && envSupabaseAnonKey);

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Add them in Vercel Project Settings > Environment Variables.';

// Use placeholders to avoid app-crashing SDK throws when env vars are missing.
export const supabaseUrl = isSupabaseConfigured ? envSupabaseUrl : 'https://placeholder.supabase.co';
export const supabaseAnonKey = isSupabaseConfigured ? envSupabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
