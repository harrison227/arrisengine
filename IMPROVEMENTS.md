# 20 Concrete Improvements (2026-05-08)

Each item is **(I)mplement now** or **(F)uture-state suggestion**. Frontend contract preserved everywhere.

## Shared infrastructure
1. **(I)** `_shared/cors.ts` — single CORS source, full allow-methods, preflight handler.
2. **(I)** `_shared/http.ts` — `jsonResponse`, `errorResponse`, `parseJsonBody`, `withErrorHandling` wrapper.
3. **(I)** `_shared/errors.ts` — `HttpError` typed errors and standard error builders (`badRequest`, `unauthorized`, `notFound`, `rateLimited`, `upstream`).
4. **(I)** `_shared/env.ts` — `requireEnv()` / `optionalEnv()` with safe defaults; module-level reads so misconfig fails on cold start, not mid-request.
5. **(I)** `_shared/validation.ts` — `isUuid`, `sanitizeString`, `ensureUuid`, `ensureString`, `ensureEnum`, `ensureArray`, request-shape helpers.
6. **(I)** `_shared/logger.ts` — structured logger with request-ID correlation; replaces 529 ad-hoc `console.log` calls.
7. **(I)** `_shared/retry.ts` — `withRetry` exponential backoff, idempotency-aware (POST = 1 attempt by default).
8. **(I)** `_shared/supabase.ts` — single `getSupabaseAdmin()` factory; `getSupabaseUser(req)` for JWT-scoped reads.

## Upstream clients
9. **(I)** `_shared/anthropic.ts` — `callAnthropic({system, prompt, model, maxTokens})` with timeout, retry, mapped errors. Default model: `claude-sonnet-4-6`.
10. **(I)** `_shared/gemini.ts` — wraps the OpenAI-compatible Gemini endpoint with timeout, retry, structured output helpers. Default: `gemini-2.5-flash`.
11. **(I)** `_shared/late.ts` — single `LateClient` class replacing 5x duplicated `callLateAPI`. Centralises Late base URL, headers, idempotency, platform map, post-id extraction.
12. **(I)** `_shared/webhook.ts` — `verifyHmac` (Late), `verifyStripeSignature` wrapper, fail-closed when secret missing.

## Database
13. **(I)** New migration `20260508120000_backend_hardening.sql`:
    - `webhook_events` table for idempotency (Stripe + Late) with unique index on `(provider, event_id)`.
    - `rate_limit_buckets` table for cross-isolate rate-limit state.
    - Tighten `plan_share_links` UPDATE policy to require `is_active = true` and only via SECURITY DEFINER fn.
    - Composite indexes on `tasks(user_id, status, due_date DESC)`, `contracts(client_id, status)`, `text_posts(client_id, scheduled_date)`, `content_pieces(content_plan_id, status)`.
    - SECURITY DEFINER `record_share_link_feedback(share_token, ...)` so the public client can call a tightly-scoped function rather than a broad UPDATE.

## Function-level
14. **(I)** Migrate every function from `serve()` to `Deno.serve` and pin `@supabase/supabase-js@2.57.2`. Drop std imports entirely.
15. **(I)** Bump Anthropic model to `claude-sonnet-4-6` everywhere.
16. **(I)** Bump Stripe API version to `2026-01-01.acacia`.
17. **(I)** Wrap all upstream `fetch()` with timeout (45s default) via `AbortSignal.timeout()`.
18. **(I)** Replace inline rate-limiters with shared `checkRateLimit()` (DB-backed with in-memory fallback).
19. **(I)** Replace inline `isValidUUID`, `sanitizeString`, `callLateAPI`, `PLATFORM_MAP`, `extractLatePostId` with shared imports.

## Future-state (documented for next pass)
20. **(F)** **JWT verification + RLS-scoped Supabase clients.** Today every function uses service-role; the right move is `getSupabaseUser(req)` for any function that operates on data the caller owns, with service-role reserved for genuinely admin operations (webhooks, scheduled posters, public share-link readers using SECURITY DEFINER fns). Implementing this requires propagating `Authorization` headers from the frontend (`supabase.functions.invoke` already does this by default — verify per-call). Marked future-state because rolling it out function-by-function is a separate, careful task that touches the frontend.
