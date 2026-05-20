/**
 * Environment variable helpers.
 *
 * Why: every edge function had `Deno.env.get('X')!` non-null assertions
 * scattered through the request handler. If a secret was missing, the
 * function would throw a TypeError mid-request, surfacing as a confusing
 * 500. With requireEnv() at module scope, misconfigured functions fail
 * on cold start and the error is logged once, not on every invocation.
 *
 * Supabase platform-injected vars (SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) are always present, so we read them eagerly.
 */

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, defaultValue?: string): string | undefined {
  return Deno.env.get(name) ?? defaultValue;
}

export function hasEnv(name: string): boolean {
  return Boolean(Deno.env.get(name));
}

/** Lazily-evaluated requirement: only throws on first call. */
export function lazyEnv(name: string) {
  let cached: string | null = null;
  return () => {
    if (cached === null) cached = requireEnv(name);
    return cached;
  };
}

/** Supabase platform vars — always present in the edge runtime. */
export const SUPABASE_URL = () => requireEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = () => requireEnv('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = () => requireEnv('SUPABASE_SERVICE_ROLE_KEY');
