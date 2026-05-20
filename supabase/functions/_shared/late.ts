/**
 * Late.is API client.
 *
 * Why: 5 edge functions (sync-to-late, post-now-to-late, post-text-to-late,
 * sync-text-to-late, late-scheduled-poster) each had their own copy of:
 *   - the Late base URL
 *   - PLATFORM_MAP
 *   - callLateAPI() with subtly different retry behaviour
 *   - extractLatePostId() with subtly different fallbacks
 *
 * This module collapses all of that into one client. Idempotency-Key is
 * accepted so callers can pass a deterministic key (typically the content
 * piece id + action) to make POST retries safe.
 *
 * Default behaviour: GET/DELETE/PUT retry up to 3 attempts, POST does not
 * retry on transport errors to avoid duplicate posts. The frontend's
 * contract is preserved.
 */

import { upstream, rateLimited, badRequest, HttpError } from './errors.ts';
import { withRetry, timeoutSignal } from './retry.ts';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

export const PLATFORM_MAP: Readonly<Record<string, string>> = Object.freeze({
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  linkedin: 'linkedin',
  youtube: 'youtube',
  twitter: 'twitter',
  instagram_stories: 'instagram',
  facebook_stories: 'facebook',
});

export function mapPlatform(platform: string): string {
  return PLATFORM_MAP[platform] ?? platform;
}

export interface LateRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  /** Idempotency-Key header for POSTs. Strongly recommended for create/update calls. */
  idempotencyKey?: string;
  /** Override total request timeout. Default 45 s. */
  timeoutMs?: number;
}

export interface LateResult<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
}

export class LateClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw badRequest('Late API key is missing for this client');
  }

  private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  /**
   * Low-level call. Returns { data } or { error, status }. Network and
   * 5xx errors are retried (except for POST). 4xx are returned immediately
   * so the caller can act on the specific status.
   */
  async call<T = unknown>(req: LateRequest): Promise<LateResult<T>> {
    const url = `${LATE_BASE_URL}${req.endpoint}`;
    const headers = this.buildHeaders(req.idempotencyKey ? { 'Idempotency-Key': req.idempotencyKey } : {});
    const timeoutMs = req.timeoutMs ?? 45_000;
    const isIdempotent = req.method === 'GET' || req.method === 'DELETE' || req.method === 'PUT';
    const attempts = isIdempotent ? 3 : 1;

    try {
      return await withRetry(
        async () => {
          const res = await fetch(url, {
            method: req.method,
            headers,
            body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
            signal: timeoutSignal(timeoutMs),
          });

          if (res.ok) {
            // Some endpoints return 204 No Content
            if (res.status === 204) return { data: undefined } as LateResult<T>;
            const data = (await res.json()) as T;
            return { data };
          }

          const text = await res.text().catch(() => '');
          const message = `Late API ${res.status}: ${text.slice(0, 300)}`;
          if (res.status === 429) throw rateLimited(message);
          // 4xx: don't retry, return immediately so caller decides.
          if (res.status >= 400 && res.status < 500) {
            return { error: message, status: res.status } as LateResult<T>;
          }
          // 5xx: throw to trigger retry (idempotent only).
          throw new Error(message);
        },
        {
          attempts,
          baseMs: 700,
          shouldRetry: (err) => {
            if (err instanceof HttpError) return false;
            return true;
          },
        },
      );
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const message = err instanceof Error ? err.message : 'Late network error';
      return { error: message };
    }
  }

  /** Throwing variant: returns data on success, throws HttpError on failure. */
  async callOrThrow<T = unknown>(req: LateRequest): Promise<T> {
    const result = await this.call<T>(req);
    if (result.error) {
      const status = result.status ?? 502;
      throw upstream(result.error, status);
    }
    return result.data as T;
  }
}

/**
 * Pull the post id out of a Late response, handling the `{post: {_id}}`
 * shape and several fallbacks.
 */
export function extractLatePostId(responseData: unknown): string | null {
  if (!responseData || typeof responseData !== 'object') return null;
  const data = responseData as Record<string, unknown>;
  if (data.post && typeof data.post === 'object') {
    const post = data.post as Record<string, unknown>;
    if (typeof post._id === 'string') return post._id;
    if (typeof post.id === 'string') return post.id;
  }
  if (typeof data._id === 'string') return data._id;
  if (typeof data.id === 'string') return data.id;
  return null;
}
