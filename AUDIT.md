# ArrisEngine Backend Audit (2026-05-08)

Scope: 35 Supabase edge functions (~11.1k LOC), 56 migrations, ~47 tables.

## 20 Findings

### Critical
1. **No JWT verification on any edge function.** Every function uses `SUPABASE_SERVICE_ROLE_KEY` and trusts `clientId` / `userId` taken from request body. A malicious caller can read or mutate any client's data by guessing UUIDs. Public-endpoint scope is restricted only by `share_id` + `is_active`, not auth.
2. **Webhook signature verification is "optional" in `stripe-contract-webhook` and `late-webhook`.** Both fall through to `JSON.parse(body)` when the secret is unset, which is `if (webhookSecret && signature)` rather than `if (webhookSecret) { require(signature) }`. Effect: in any environment where the secret is missing or stripped, unsigned forged events are accepted.
3. **No webhook idempotency.** Stripe and Late may retry. There is no `webhook_events` table tracking processed event IDs, so duplicate deliveries can double-apply state changes.
4. **Service-role used by public-endpoints with read access to whole tables before the share-id filter.** Any future bug that drops the `.eq('share_id', …)` clause becomes a full data leak. Reads should be funneled through SECURITY DEFINER functions.
5. **Anthropic model `claude-sonnet-4-20250514` is a year out of date.** Current is `claude-sonnet-4-6` / `claude-opus-4-7`.
6. **Stripe API version `2025-08-27.basil` is a year out of date.** Current is `2026-01-01.acacia`.
7. **`@supabase/supabase-js@2` not pinned.** A breaking minor in the SDK silently breaks production. Should pin to `2.57.2`.

### High
8. **In-memory rate-limiter is a stub.** `Map<string, number[]>` per function instance — every cold start resets state and Edge runs on many isolates, so a determined caller bypasses it instantly. Effective limit is "best effort" only.
9. **CORS headers duplicated 35 times** with three subtle variants (most missing `Access-Control-Allow-Methods`, two have `Access-Control-Max-Age`, one adds `stripe-signature` to allow-headers).
10. **`isValidUUID`, `sanitizeString`, `callLateAPI`, `extractLatePostId`, `PLATFORM_MAP` duplicated 5–8 times each.** Any bug fix has to be applied 5–8 times.
11. **No request timeouts on any `fetch()` to upstream APIs (Anthropic, Gemini, OpenAI, Late, Firecrawl, Ideogram).** Hung connections hold an edge function open for the platform max (~150s) and burn quota.
12. **`activity_logs` RLS is `USING (true)` for all authenticated users** — every team member sees every activity record (no client scoping). Fine for tiny teams, leaks signal for large ones.
13. **`plan_share_links` UPDATE policy is `USING (true) WITH CHECK (true)`** — any authenticated user can stamp `feedback_submitted_at` on any share link.
14. **Mixed `serve()` from std@0.168.0 + std@0.190.0 + bare `Deno.serve`.** Three patterns, two version strings, no consistency.

### Medium
15. **No structured input validation.** Each function manually unpacks `req.json()` and runs ad-hoc `if (!x)` checks. No schema, no error-message consistency, no type narrowing.
16. **Missing indexes on hot query paths.** `tasks(user_id, status, due_date)`, `contracts(client_id, status)`, `text_posts(client_id, scheduled_date)`, `content_pieces(content_plan_id, status)`. The migration history added composite indexes for some but not all.
17. **No central error mapper.** Anthropic 429/529, Gemini 402/429, Stripe `card_declined`, Late 4xx — each function reinvents handling, sometimes leaking raw upstream error text into client responses.
18. **529 `console.log` / `console.error` calls.** Heavy and unstructured. Hard to grep, hard to ship to a log aggregator, no request correlation IDs.
19. **Magic strings everywhere.** `https://getlate.dev/api/v1`, `https://api.anthropic.com/v1/messages`, `https://generativelanguage.googleapis.com/v1beta/openai/`, model names, platform maps — all inline.
20. **Env vars accessed via `Deno.env.get('X')!` non-null assertion** in many functions. If the secret isn't set, the function fails inside the request handler instead of refusing to start, leading to confusing 500s.

## RLS spot-checks

| Table | Policy | Concern |
|---|---|---|
| `activity_logs` | `SELECT … USING (true)` | Org-wide visibility, no client scope |
| `plan_share_links` | `UPDATE … USING (true) WITH CHECK (true)` | Anyone can update any link's `feedback_submitted_at` |
| `clients_public_safe` | view (correct) | Already excludes secrets — good pattern, expand to other tables |

## Schema improvements queued

- `webhook_events` table: idempotency for Stripe + Late deliveries.
- `rate_limit_buckets` table: distributed rate-limit state.
- Composite indexes on `tasks (user_id, status, due_date desc)`, `contracts (client_id, status)`, `text_posts (client_id, scheduled_date)`.
- Tighten `plan_share_links` UPDATE to scoped columns only.
