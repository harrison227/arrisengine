/**
 * Rate limiter — DB-backed with in-memory fallback.
 *
 * The original code had a per-isolate Map<string, number[]> rate limiter
 * which was effectively a placeholder: every cold start reset the state,
 * and the platform runs many isolates so a single client could trivially
 * exceed the published limit. This implementation:
 *
 *   1. Tries to upsert into `rate_limit_buckets` and check the count.
 *   2. Falls back to the in-memory map if the DB is unavailable (so the
 *      function still works in degraded mode).
 *   3. Exposes the same shape as the legacy callers: { allowed, waitTime }.
 *
 * Frontend contract preserved: 429 response carries `waitTime` in seconds.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const memoryBuckets = new Map<string, number[]>();

export interface RateLimitInput {
  /** Logical bucket name (e.g. 'generate-caption'). */
  bucket: string;
  /** Subject to rate-limit (clientId, userId, IP). */
  subject: string;
  /** Window length in seconds. */
  windowSec: number;
  /** Max requests allowed in window. */
  max: number;
  /** Supabase admin client. If omitted, falls back to memory only. */
  supabase?: SupabaseClient;
}

export interface RateLimitOutcome {
  allowed: boolean;
  waitTime: number;
  count: number;
  source: 'db' | 'memory';
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitOutcome> {
  const { bucket, subject, windowSec, max, supabase } = input;
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  if (supabase) {
    try {
      // Insert this attempt then count attempts inside the window.
      const insertRes = await supabase
        .from('rate_limit_buckets')
        .insert({ bucket, subject, ts: new Date(now).toISOString() });
      if (insertRes.error) throw insertRes.error;

      const { data, error } = await supabase
        .from('rate_limit_buckets')
        .select('ts')
        .eq('bucket', bucket)
        .eq('subject', subject)
        .gte('ts', new Date(windowStart).toISOString())
        .order('ts', { ascending: true });
      if (error) throw error;

      const count = data?.length ?? 0;
      if (count > max) {
        const oldestTs = data?.[0]?.ts;
        const oldest = oldestTs ? new Date(oldestTs).getTime() : now;
        const waitTime = Math.max(1, Math.ceil((oldest + windowSec * 1000 - now) / 1000));
        return { allowed: false, waitTime, count, source: 'db' };
      }
      return { allowed: true, waitTime: 0, count, source: 'db' };
    } catch {
      // fall through to memory
    }
  }

  // Memory fallback (per-isolate, best effort).
  const key = `${bucket}:${subject}`;
  const stamps = (memoryBuckets.get(key) ?? []).filter((t) => t >= windowStart);
  if (stamps.length >= max) {
    const oldest = stamps[0];
    const waitTime = Math.max(1, Math.ceil((oldest + windowSec * 1000 - now) / 1000));
    memoryBuckets.set(key, stamps);
    return { allowed: false, waitTime, count: stamps.length, source: 'memory' };
  }
  stamps.push(now);
  memoryBuckets.set(key, stamps);
  return { allowed: true, waitTime: 0, count: stamps.length, source: 'memory' };
}
