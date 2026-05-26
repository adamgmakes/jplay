import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Visible diagnostic instead of a silent blank screen
  console.error(
    '[J! Play] Missing Supabase env vars. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your hosting provider.'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export const supabaseConfigured = Boolean(url && key);
