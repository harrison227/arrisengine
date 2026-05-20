/**
 * Retry helper with exponential backoff.
 *
 * Replaces hand-rolled retry loops in sync-to-late, post-now-to-late,
 * sync-text-to-late, post-text-to-late and late-scheduled-poster (each
 * had its own subtly different version). Default behaviour is the same
 * as the most-conservative caller's: only retry idempotent verbs (GET,
 * HEAD, DELETE, PUT) and never retry on 4xx.
 */

export interface RetryOptions {
  /** Total attempts (initial + retries). Default: 3. */
  attempts?: number;
  /** Base delay in ms; backoff = base * 2^attempt. Default: 500. */
  baseMs?: number;
  /** Cap delay between attempts. Default: 8000. */
  maxBackoffMs?: number;
  /** Predicate: should this thrown error be retried? Default: yes for all. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional logger hook so callers can correlate retry events. */
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseMs = options.baseMs ?? 500;
  const maxBackoffMs = options.maxBackoffMs ?? 8_000;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === attempts - 1;
      if (isLast || !shouldRetry(err, attempt)) break;
      const backoff = Math.min(baseMs * 2 ** attempt, maxBackoffMs);
      // Jitter: ±20% to avoid thundering-herd.
      const jitter = backoff * (0.8 + Math.random() * 0.4);
      options.onRetry?.(err, attempt, jitter);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastError;
}

/** Compose AbortSignal.timeout with an existing signal so callers can cancel and we can timeout. */
export function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  if (!parent) return AbortSignal.timeout(ms);
  // AbortSignal.any merges multiple signals; falls back to manual wiring
  // for older Deno versions if needed.
  if (typeof (AbortSignal as unknown as { any?: unknown }).any === 'function') {
    return (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([
      parent,
      AbortSignal.timeout(ms),
    ]);
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(parent.reason);
  if (parent.aborted) ctrl.abort(parent.reason);
  else parent.addEventListener('abort', onAbort, { once: true });
  setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  return ctrl.signal;
}
