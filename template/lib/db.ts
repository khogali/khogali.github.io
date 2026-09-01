import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Which required env var is missing, or null when the config is complete.
 *
 * This exists because the client used to be built at module scope with `!`.
 * A missing var threw during module load, so Vercel returned an opaque 500
 * before any handler ran — which silently masked /api/pb's deliberate 503 and
 * its diagnostic. Handlers now check this first and answer for themselves.
 */
export function missingConfig(): string | null {
  if (!process.env.SUPABASE_URL) return 'SUPABASE_URL is not set';
  if (!process.env.SUPABASE_SERVICE_KEY) return 'SUPABASE_SERVICE_KEY is not set';
  return null;
}

let client: SupabaseClient | null = null;

/**
 * Service-role client, built on first use. Server-side only — never ship this
 * key to the browser.
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return client;
}
