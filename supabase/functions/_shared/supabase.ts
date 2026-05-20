/**
 * Single Supabase client factory.
 *
 * Why: 35 functions each created their own `createClient(SUPABASE_URL, ...)`
 * with subtly different options. This module exposes two factories:
 *
 *   getSupabaseAdmin()  – service-role, used for webhook handlers,
 *                         scheduled tasks, public-share-link readers
 *                         (which then enforce share_id manually).
 *
 *   getSupabaseUser(req) – bearer-token-scoped, RLS applies. Use this
 *                          for any function that operates on data the
 *                          calling user owns (preferred new pattern).
 *
 * Versions are pinned to 2.57.2 for reproducibility.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } from './env.ts';

let _admin: SupabaseClient | null = null;

/** Service-role client. Cached at module scope — safe across invocations. */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-arris-edge': 'admin' } },
  });
  return _admin;
}

/**
 * RLS-scoped client. Pulls the Bearer token off the inbound request and
 * forwards it; row-level security applies as the calling user.
 *
 * Returns null if no Authorization header is present (so callers can decide
 * whether to require auth or fall back to an admin client for legacy paths).
 */
export function getSupabaseUser(req: Request): SupabaseClient | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    global: { headers: { Authorization: auth, 'x-arris-edge': 'user' } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve the auth.users id from the bearer token. Returns null if no
 * token or invalid. Callers can use this to enforce auth without needing
 * a separate Supabase user-client round-trip.
 */
export async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
