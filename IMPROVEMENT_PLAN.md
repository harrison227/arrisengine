# ArrisEngine — Improvement Plan

A phased roadmap for the work past the initial cleanup pass. Each pass
is sized to be applied + verified independently. **Pass 1 and Pass 2
are already done** (see `CHANGES.md`); Pass 3 is in progress in this
session; Passes 4–6 are queued for future work.

---

## Pass 1 ✅ — Backend refactor (done)

35 edge functions onto a shared library, 5,100 LOC removed, hardening
migration with `webhook_events` + `rate_limit_buckets`, two real bug
fixes, structured logging, fail-closed webhook signature verification.

## Pass 2 ✅ — Frontend bundle + lint + JWT scaffold (done)

Main bundle 646 KB → 91 KB, `vendor-pdf` chunk lazy-loaded, lint went
0 errors, JWT helper module landed in `_shared/auth.ts` with one
demonstrator function (`generate-caption`).

---

## Pass 3 — Security rollout + operational safety (in progress)

**Goal:** finish what Pass 2 started — apply the JWT auth gate
everywhere it should apply, and make the new database tables
self-maintaining instead of growing unbounded.

- **JWT migration to AI-generation functions.** 14 functions in tier 1
  get `await requireClientAccess(req, clientId)` added: ai-text-posts,
  generate-hashtags, generate-quick-prompts, generate-single-idea,
  generate-content-strategy, generate-image-batch-plan,
  generate-batch-image, generate-social-image, suggest-ad-angles,
  transcribe-video, scrape-client-website, build-knowledge-base,
  ai-content-session, generate-onboarding-pdf, generate-contract.
- **CI workflow.** `.github/workflows/ci.yml` runs `bun install`,
  `bun run lint`, `bun run build` on every push + PR. Catches future
  regressions automatically.
- **TTL cleanup migration.** New migration installs pgcron jobs (or at
  minimum, documented `DELETE WHERE …` queries) for webhook_events
  (90-day retention) and rate_limit_buckets (2-hour retention).
- **Smoke tests for shared lib.** Deno-native `Deno.test()` cases for
  the spine: validation helpers, retry/timeout, CORS, error shape,
  late-client URL building.
- **Move large system prompts to `.txt` files.** ai-content-session
  (~250 lines of inline prompt), ai-text-posts (~100), generate-batch-image
  (~80), generate-social-image (~80). Bundled separately, easier to
  diff, doesn't bloat the function source.
- **Type the highest-traffic `any`s.** Team.tsx, PublicContractSign,
  PublicPlanApproval, SavedPlans, the `.tsx` files where the lint
  warnings cluster.

## Pass 4 — Late sync security + observability

**Goal:** apply the same auth gate to the agency-internal Late sync
endpoints, and start emitting logs to a real aggregator.

- JWT migration to **tier 2** (Late sync from agency UI): sync-to-late,
  post-now-to-late, sync-text-to-late, post-text-to-late,
  cancel-contract-subscription, create-contract-checkout,
  fetch-late-analytics. (`migrate-images-to-r2` already requires user.)
- **Sentry integration.** Frontend uses Sentry React SDK; edge functions
  emit structured errors via `logger.error`. Wire up an Anthropic-style
  one-line install via the existing logger module.
- **Log aggregator.** Pipe edge function logs (already structured JSON)
  to Axiom / Logflare / BetterStack. Adds free-text search across all
  function invocations correlated by `requestId`.
- **Alarms on critical paths.** Stripe webhook failure rate > 1%,
  Late webhook signature mismatches, rate limit `db` source failures
  (means `rate_limit_buckets` is unreachable).

## Pass 5 — Performance & cost

**Goal:** measure and optimize what's actually slow.

- **EXPLAIN ANALYZE the slow queries.** Hot paths: `content_pieces`
  with `content_plans!inner` joins, `text_posts` ranged by
  `scheduled_date`, the analytics aggregation queries. Add indexes
  where the planner shows seq scans.
- **Cache `client` + `knowledge_*` reads.** These are read on nearly
  every AI generation function. Add a 5-minute in-memory cache keyed
  by client_id; invalidate on writes.
- **Prefetch route chunks.** Add `<link rel="modulepreload">` hints
  for likely next nav paths (Dashboard → Clients, Clients → ClientDetail).
- **Server-side PDF generation.** Move the contract / analytics PDF
  rendering server-side via a Deno-runnable PDF lib or a small Puppeteer
  service. Eliminates the 616 KB `vendor-pdf` chunk entirely. Big change,
  high payoff.
- **Image generation cost dashboard.** Track tokens / image-gen calls
  per client per day. Most expensive client should be visible. Add
  RLS-respecting view + a Settings panel.

## Pass 6 — Feature & UX polish

**Goal:** the things users notice but engineers usually skip.

- **Loading skeletons audit.** Some pages have skeletons, some have
  spinners, some flash. Standardize on skeletons that match real layout.
- **Empty states.** Most lists show "No items" centered text. Replace
  with actionable empty states ("No clients yet — Create your first
  client").
- **Error boundary coverage.** ErrorBoundary is wired to `/content`
  only. Wrap every route the same way and use a unified error display
  with a retry button + the requestId for support.
- **Mobile responsiveness review.** Sidebar, dialogs, content calendar,
  contract signing flow — manually QA on a phone-width viewport.
- **Keyboard shortcuts.** Cmd+K command palette already exists (cmdk
  is a dependency); wire it to the actual search/nav targets.
- **Onboarding tour.** First-time users land on Dashboard with empty
  data. A 3-step tour pointing to "Create client" → "Build knowledge
  base" → "Generate content" would reduce time-to-value.

---

## Things explicitly out of scope (for now)

- **Multi-tenancy beyond a single agency org.** The schema assumes one
  agency owns the data; a true multi-org model is a much bigger
  refactor.
- **Realtime collaboration.** Two users editing the same content piece
  is currently a last-write-wins race. Adding presence/realtime is a
  feature, not a fix.
- **Email/notification stack.** No transactional email is sent from
  edge functions today. Adding it requires a provider (Resend, Postmark)
  + opt-in/out preferences + templates.
- **Native mobile.** Not on the roadmap; the web app should be
  mobile-responsive first.

## How to use this doc

When picking what to work on:
1. Pass 3 items are the immediate next batch — most are small, high
   leverage, and verified by `bun run build` + `bun run lint` + a few
   smoke tests.
2. Pass 4 needs a third-party (Sentry, log aggregator) account; pick
   that first, then implement.
3. Pass 5 needs production telemetry to do well — defer until after
   Pass 4 lands so you have data to measure against.
4. Pass 6 is incremental and can be done in slack time between feature
   work.

Each pass should land as a single commit (or PR if reviewed) with its
own section appended to `CHANGES.md`.
