import { createClient } from '@supabase/supabase-js';

// Service-role key: server-side only. Never ship this to the browser.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);
