/**
 * Auth gates for edge functions.
 *
 * The legacy pattern across all 35 functions is "trust whatever clientId
 * the request body provides and run as service role." Anyone with the
 * (public) Supabase anon key could call e.g. generate-caption with any
 * client UUID and have the function read that client's knowledge base.
 *
 * These helpers move the gate to the edge:
 *   - requireUser(req): 401 if no valid bearer token.
 *   - requireClientAccess(req, clientId): 401/403 if the caller is not
 *     the owner of that client OR an admin/owner OR explicitly assigned.
 *
 * Both lean on SECURITY DEFINER functions that already exist in the
 * schema (`is_admin_or_owner`, `has_client_access`).
 *
 * Roll out gradually — start with public-facing AI endpoints that read
 * sensitive client data (knowledge base, brand info), then expand.
 */

import { forbidden, unauthorized } from './errors.ts';
import { getSupabaseAdmin, getUserIdFromAuth } from './supabase.ts';

export async function requireUser(req: Request): Promise<string> {
  const userId = await getUserIdFromAuth(req);
  if (!userId) throw unauthorized('Authentication required');
  return userId;
}

/**
 * Verify the calling user has access to the given client (via ownership,
 * client_assignments, or admin/owner role). Returns the user id on success;
 * throws 401 / 403 otherwise.
 *
 * Uses the existing `has_client_access(user_id, client_id)` SECURITY DEFINER
 * function from the schema, so RLS / role logic stays in one place.
 */
export async function requireClientAccess(req: Request, clientId: string): Promise<string> {
  const userId = await requireUser(req);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('has_client_access', { user_id: userId, client_id: clientId });
  if (error) {
    // Don't leak the underlying RPC error; treat as a forbidden response.
    throw forbidden('Access check failed');
  }
  if (!data) throw forbidden('You do not have access to this client');
  return userId;
}

/**
 * Variant for endpoints that may legitimately run without a user (e.g. a
 * scheduled poster). Returns the user id if a valid token is present,
 * null otherwise. The caller decides what to do with the absence of a user.
 */
export async function tryUser(req: Request): Promise<string | null> {
  return getUserIdFromAuth(req);
}
