> **Copied from** `../slot-books/docs/EXECUTION_PLAN.md` (the Iker product repository, read-only source of truth) on 2026-11-15.
> This is a snapshot for offline reference. If it disagrees with slot-books, slot-books wins. Do not edit this copy; re-copy it instead.

# Iker — Execution Plan

Companion to [Iker_PRD.md](Iker_PRD.md) §10. This translates the phased roadmap into
buildable engineering milestones with sequencing, dependencies, and what "done" means for each.
Stack: Next.js (Vercel) + Supabase, per [ARCHITECTURE.md](ARCHITECTURE.md).

## How to Read This

Each milestone lists: **scope**, **depends on**, **PRD refs**, and **exit criteria** (what must
be true to call it done — not "code merged" but "the acceptance criteria in PRD §7 pass").
Milestones within a phase marked _(parallel)_ have no dependency on each other and can be built
concurrently by different people/agents.

---

## Phase 0 — Foundation (pre-Feature work)

Nothing in Phase 1 can start correctly without this. Budget: get through this fast, but do not
skip it — retrofitting RLS or tenancy after data exists is far more expensive than doing it first.

### M0.1 — Supabase project + repo scaffold

- Create Supabase project (staging + production), Next.js app in `apps/web`, connect Vercel.
- **Exit**: `supabase start` runs locally; CI runs `supabase db push --dry-run` against a
  migration diff; empty Next.js app deploys to a Vercel preview URL.

### M0.2 — Core schema + tenancy + RLS skeleton

- Tables: `business`, `staff_user` (links to `auth.users`), `role`, `client`.
- RLS enabled on every table from creation. Helper functions: `current_business_id()`,
  `is_platform_admin()`, `is_super_admin()`.
- **Depends on**: M0.1. **PRD refs**: §4, §9. **Exit**: a signed-in Business user can only
  `select` their own `business` row; a Platform Admin can `select` business metadata rows but a
  policy test proves `select` on any financial table returns zero rows for that role.
- See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [SECURITY.md](SECURITY.md).

### M0.3 — Auth flows

- Supabase Auth: email/password + magic link for Business/Admin. Session handling via
  `@supabase/ssr` in Next.js middleware.
- **Depends on**: M0.2. **Exit**: admin invite → set password → login → dashboard redirect works for
  a Business Owner; role-based redirect for Platform Admin/Super Admin to `/admin`.

### M0.4 — Design system baseline

- Tailwind config, shadcn/ui install, typography/spacing tokens, base layout shells for public
  booking, dashboard, and admin. _(parallel with M0.2–M0.3)_
- **Exit**: Storybook or a `/design-preview` route renders buttons, inputs, cards, status badges
  (Pending/Confirmed/Cancelled etc.) matching [FRONTEND_SPEC.md](FRONTEND_SPEC.md).

---

## Phase 1 — MVP (Abuja Pilot)

Maps to PRD Phase 1 (§10) and Features 1, 2, 3, 5, 6, 7 (partial), 10, 11, 12, 13, 14.

### M1.1 — Service catalogue _(parallel)_

- F1.1. CRUD for services (name, category, price in kobo, duration), archive not hard-delete.
- **Depends on**: M0.2. **Exit**: F1.1 acceptance criteria pass; archived services stay
  referenced on historical bookings.

### M1.2 — Availability engine _(parallel)_

- F3.1, F3.2, F3.3. Weekly hours per staff/business, blocked dates, buffers, min-notice window.
  Pure-function slot computation, unit-tested independent of the DB. Public booking availability
  supports 1–10 people/service units in one consecutive appointment; duration, price, and deposit
  scale by selected quantity.
- **Depends on**: M0.2. **Exit**: given a set of hours/buffers/blocks/existing bookings, the
  engine returns the correct open-slot set for a date range; property-tested against overlap.

### M1.3 — Public booking page + booking flow

- F1.2, F1.3, F2.1, F2.2, F2.3, F12.3. Server-rendered public page at `/[businessSlug]`, slot
  hold on selection, default booking form, policy display before payment instructions, proof
  upload to Storage, status → `awaiting_confirmation`.
- **Depends on**: M1.1, M1.2, M0.4. **Exit**: full client journey in PRD §6.1 works end to end
  against a seeded business; page loads <2s on throttled 3G in Lighthouse.

### M1.4 — Business booking management

- Confirm/reject a booking from proof, view calendar, booking detail view.
- **Depends on**: M1.3. **Exit**: business can confirm a booking; client sees status change and
  receives a confirmation email.

### M1.5 — Walk-in bookings + manual payments _(parallel with M1.3/M1.4 once M1.1/M1.2 land)_

- F5.1, F5.2, F5.3. Quick-entry form, full/partial payment recording, payment audit trail.
- **Depends on**: M1.1, M1.2. **Exit**: F5 acceptance criteria pass; partial payment shows
  correct balance-remaining and a second payment closes it out with two timestamped payment rows.

### M1.6 — Expense tracking _(parallel)_

- F6.1, F6.2, F6.3. Expense CRUD, receipt upload, business-defined categories.
- **Depends on**: M0.2. **Exit**: F6 acceptance criteria pass.

### M1.7 — Cancellation & refund policy

- F12.1, F12.2, F12.4, F12.5. Refund policy builder (business-wide or per-service), versioned;
  cancellation flow; refund as linked adjustment; notifications.
- **Depends on**: M1.3, M1.4, M1.5 (refunds reference payments from either flow).
- **Exit**: F12 acceptance criteria pass; editing a policy never changes what a past booking's
  snapshot shows; a refund never mutates the original payment row.

### M1.8 — Custom booking forms

- F13.1–F13.5. Form builder, field types incl. read-only info block, attach to service(s),
  client-side rendering + validation, response export.
- **Depends on**: M1.1, M1.3. **Exit**: F13 acceptance criteria pass.

### M1.9 — Core reporting (monthly)

- F7.1 (monthly slice only), income/expense/profit view.
- **Depends on**: M1.5, M1.6. **Exit**: month view totals reconcile against underlying payment
  and expense rows in an automated test (no manual arithmetic check).

### M1.10 — Platform Admin onboarding console

- F10.1, F10.2. Create/activate/suspend business, onboarding queue.
- **Depends on**: M0.2, M0.3. **Exit**: F10 acceptance criteria pass; automated RLS test proves
  Platform Admin cannot read `payment`/`expense`/`statement` for the business they onboarded.

### M1.11 — Super Admin governance

- F11.1, F11.2. Manage Platform Admin accounts, aggregate-only analytics.
- **Depends on**: M1.10. **Exit**: F11 acceptance criteria pass; analytics queries are backed by
  a view that never exposes per-business itemized financials, verified by an RLS test attempting
  direct table access.

### M1.12 — Subscription plans & billing (Starter/Growth)

- F14.1–F14.7 (Starter + Growth only; Pro/Team gating comes later but schema supports all tiers
  from day one). Paystack checkout for platform billing, 30-day Growth trial, grace period,
  discount codes.
- **Depends on**: M0.3, M1.10 (Platform Admin applies discount codes), M1.11 (Super Admin
  configures tiers). **Exit**: F14 acceptance criteria pass; a failed-webhook simulation
  correctly triggers the 7-day grace period, not immediate downgrade.

### Phase 1 exit gate

All M1.x exit criteria pass, plus:

- [ ] RLS boundary test suite (Super/Platform Admin vs. financial tables) green in CI on every PR.
- [ ] NDPA baseline: consent copy on public booking page, data-deletion request path exists
      (manual ops process is acceptable for pilot; document it in SECURITY.md).
- [ ] 150 seeded/pilot businesses can be onboarded without a schema change.

---

## Phase 2 — Depth & Retention

Maps to PRD Phase 2. Sequencing assumes Phase 1 is live in production with real pilot data.

### M2.1 — Google Calendar two-way sync — ✅ complete

- F4.1–F4.3. OAuth connect/disconnect flow (`/settings/calendar`), push sync on booking
  confirm/cancel (Postgres trigger → `notify_edge_function()`) plus a 15-minute pull/reconcile
  `pg_cron` job, both invoking the `google-calendar-sync` Edge Function; busy events land in
  `calendar_block` and merge into the public booking page's existing `blockedDates` array (no
  change to `computeAvailableSlots`'s signature). **Status**: complete as of 2026-09-03. Tokens
  are stored per-row in Supabase Vault (`google_calendar_link.access_token_secret_id` /
  `refresh_token_secret_id`, `uuid` pointers into `vault.secrets`), not the two-fixed-named-secret
  pattern originally used for `project_url`/`service_role_key` in `0022` — each connected calendar
  gets its own secrets, created/rotated/deleted by the `security definer` RPCs in
  `0070_google_calendar_token_rpcs.sql` (`connect_google_calendar_link`,
  `get_google_calendar_credentials`, `update_google_calendar_access_token`,
  `disconnect_google_calendar_link`). Both Edge Functions wrap their handlers in a top-level
  try/catch so every failure path — including a genuine unhandled throw — resolves as a redirect
  (`google-oauth-callback`) or HTTP 200 with the failure recorded on `sync_status`/`last_error`
  (`google-calendar-sync`), never a raw 500; see `docs/API_CONTRACT.md` §6. Live browser
  verification of the Settings UI was not performed (no login credentials in the build sandbox) —
  tracked as a follow-up in `.flitstack/PLAN.md`.
- **Depends on**: M1.2, M1.4. **Exit**: F4 acceptance criteria pass; sync failures surface in
  the business dashboard (never silent), per NFR in PRD §8.

### M2.2 — Quarterly/yearly reporting + statements _(parallel with M2.1)_ — ✅ complete

- F7.1 (full), F7.2, F9.1, F9.2. Period comparison, category breakdown, immutable PDF statement
  generation. **Status**: both halves done as of 2026-09-03. Reporting half (F7.1 quarter/year
  periods, F7.2 income-by-service breakdown + drill-down) ✅ complete. Statement-generation half
  (F9.1, F9.2 — immutable PDF statements, `/accounting/statements`) ✅ complete — generated
  in-process by the `generateStatement` Server Action (`apps/web/lib/statements/actions.ts`) using
  `jsPDF`, not an Edge Function; see ADR-014 in `docs/DECISIONS.md`.
- **Depends on**: M1.9. **Exit**: F7/F9 acceptance criteria pass; a generated statement is
  provably immutable (re-fetch returns identical bytes/hash after later transactions are added).

### M2.3 — Customer CRM + promotional email — ✅ complete

- F8.1, F8.2. Auto-built customer list (`/customers`, dedup by phone/email already established
  on the `client` table), preset segmentation (`all` / `service` / `visit_count_gte` /
  `inactive_days_gte`), an opt-out toggle per client, and promotional-email sending via the
  `promotional-campaign-sender` Edge Function + a transactional-email provider (same `send.ts`/
  `claim_email_send()` pipeline as booking notifications). **Status**: complete as of 2026-09-04.
  Schema (`email_campaign`/`email_campaign_recipient`, `0072`, zero admin grants) gates behind a
  new `promotional_email` plan feature (`0073`: `false` for Starter, `true` for Growth/Pro/Team).
  Segment resolution always excludes `marketing_opt_out = true` clients and snapshots the
  resolved recipient list at schedule/send time rather than re-querying live (`docs/
DATABASE_SCHEMA.md`). Composer HTML is sanitized server-side (`sanitize-html`, strict tag/
  attribute allow-list) before it is ever stored. The sender (`0074` trigger + 5-minute
  `pg_cron` sweep) is idempotent/resumable via `claim_email_send`, rechecking opt-out per
  recipient immediately before sending. Three dashboard routes ship the UI: `/customers` (list +
  opt-out switch), `/customers/campaigns` (history + cancel), `/customers/campaigns/new`
  (segment picker with live recipient-count preview + Tiptap composer + Send now/Schedule).
  **Test results**: RLS/tenant-isolation (4/4), plan-feature gate (1/1), segment resolution
  (4/4), HTML sanitization (8/8), email template (1 new, 14/14 total), sender Edge Function
  (4/4), and campaign actions (3/3, exercising the plan-gate/segment logic below the session
  layer — `campaign-actions.test.ts` cannot drive the Server Actions themselves without a real
  Next.js request context, same limitation as elsewhere in this codebase) — all green;
  `tsc --noEmit`/lint/`next build` clean across every task. A final whole-branch review (2026-09-04)
  found no Critical issues and one fix wave (`09ed74d`) closed 6 of 7 Important findings: an
  unescaped campaign subject reaching the outbound `<h1>`, email-less clients inflating
  `failure_count`, Tiptap-emitted formatting the sanitizer silently discarded, campaigns stuck
  forever in `sending` after a claim-but-crash, and `email_campaign_recipient`'s `business_id`
  not being composite-FK-tied to its parent rows. **Known gaps, recorded honestly, not glossed
  over**: (1) live browser click-through of all three UI routes (customer list + opt-out toggle,
  campaign history + cancel, and the compose flow's 4 segment types / rich-text editor /
  Send now-Schedule / Starter-plan upgrade toast) was never performed — this sandbox has no
  browser tool or login credentials, the same limitation already recorded for M2.1's Settings >
  Calendar UI; (2) the 7th final-review finding — a Starter-plan business bypassing the plan gate
  via a direct API `INSERT` (not `UPDATE`) or a `draft → cancelled → scheduled` status-laundering
  path — was left unfixed by user choice (tracked, not silently dropped; a small, already-scoped
  fix widening migration `0075`'s trigger). Both tracked as follow-ups in `.flitstack/PLAN.md`.
- **Depends on**: M1.3, M1.5. **Exit**: F8 acceptance criteria pass; opt-out is enforced at
  send-time query, not just UI filtering; cross-business email leakage is impossible by RLS (true
  for reading/sending mechanics — the one open item above is a plan-gate revenue bypass, not a
  cross-tenant data leak).
- **Addendum (2026-09-04)**: added a second, independent plan gate — a per-plan monthly send
  quota (`promotional_email_monthly_limit`, `0077`), counted in individual recipient emails and
  reset on the business's own billing-cycle boundary
  (`subscription.current_period_start`/`current_period_end`). Seeded from the values `0048`
  dropped when `plan.features` jsonb (which had a `promo_email_limit` key) was replaced by
  `feature`/`plan_feature`: `starter = 0`, `growth = 500`, `pro = 5000`, `team = unlimited`,
  adjustable per plan from the existing Super Admin plan editor with zero new UI (it's a plain
  `limit`-kind feature, and that editor is already data-driven on `kind`). Enforced by a dedicated
  DB trigger on `email_campaign` (same `draft → scheduled`/`sending` `WHEN` clause as `0075`'s
  boolean gate) plus an app-layer pre-check in `scheduleCampaign`/`sendCampaignNow` for a clean
  toast error before any recipient snapshot is written. `my_plan_usage()` reports live usage for
  it, so the existing billing-page Usage card shows "X of Y sent this period" with no new
  component. **Test results**: 7/7 new (`promotional-email-monthly-limit.test.ts` — seeding,
  DB-trigger block/allow/unlimited/period-rollover, `my_plan_usage()` reporting), plus a
  pre-existing `promotional-email-plan-feature.test.ts` bug this change exposed (a PostgREST
  embedded-resource filter without `!inner` doesn't restrict parent rows, so it silently passed
  only because no second `feature` row existed yet) fixed in the same pass; full `campaigns`/
  `promotional-*` suite (29/29) and `tsc --noEmit` clean.

### M2.4 — Pro tier, annual billing, discount codes hardening

- Extends M1.12: Pro tier gating, annual billing cycle math, multi-location support surfaced.
- **Depends on**: M1.12, M2.2 (Pro unlocks full reporting).
- **Multi-Location Chains, Phase A (tenancy foundation) — in progress, not complete.** The
  "Multi-Location Chains — Phase A: Tenancy Foundation" plan
  (`docs/superpowers/specs/2026-09-04-multi-location-chains-design.md`) shipped the RLS /
  membership-check layer this milestone's "multi-location support surfaced" needs underneath it:
  `business_group` (every business now belongs to a group; an owner can eventually manage every
  location in it), `is_member_of_business()` and `is_business_owner()` as the membership-check
  helpers behind ~89 rewritten RLS policies, and `current_business_id()` fully retired (dropped,
  not deprecated — nothing can call it going forward). This is real, tested, and shipped.
  **The plan's own Task 5 — widening `staff_user`'s primary key to `(id, business_id)` so one
  login could hold a staff row at more than one business — was originally deferred by an explicit
  plan-owner decision** after hitting a real conflict: nine other tables
  (`availability_rule`, `booking`, `calendar_block`, `payment`, `expense`,
  `google_calendar_link`, `extra_income`, `sale`, `email_campaign`) had single-column foreign
  keys to `staff_user(id)` that required it to stay globally unique. **This is now done.** The
  follow-up "Multi-Location Chains — Phase A2: Complete the staff_user Composite PK" plan shipped
  migration `0088`, widening the PK to `(id, business_id)` and re-pointing all nine FKs at the
  composite key. One login can now genuinely hold a `staff_user` row at more than one business,
  proven end-to-end by `apps/web/tests/multi-location-composite-pk.test.ts`. The group-owner RLS
  gap is also closed (`0115`): `is_business_owner()` is now wired into `business`'s SELECT/UPDATE
  policies and `staff_user`'s roster SELECT policy, and a bug the widening surfaced in
  `is_business_owner()` itself (its group-owner branch bypassed `is_active` entirely) is fixed —
  see `docs/DATABASE_SCHEMA.md`'s `business_group` section. **Staff invites/roles is now done**:
  the "Staff Invites & Roles" plan (`.superpowers/sdd/2026-09-13-staff-invites-and-roles/`) added a
  `manager` role, the owner-only `invite_staff_member` RPC, and a `staff_user` DELETE policy so an
  owner can invite and remove staff directly — see `docs/DATABASE_SCHEMA.md`'s `staff_user`
  section. **The location-switcher UI is now done**: the "Location Switcher & Add-Location" plan
  (`.superpowers/sdd/2026-09-13-location-switcher-and-add-location/`) added `my_businesses()` and
  `add_business_location()` (`0118`–`0120`), a dashboard header switcher across every business a
  chain owner can act on, an add-location flow, and Platform Admin chain grouping in the
  businesses directory — see `docs/DATABASE_SCHEMA.md`'s `business_group`/`staff_user` sections
  and Functions list. **Billing consolidation across a chain is now done**: the "Billing
  Consolidation" plan (`.superpowers/sdd/2026-09-15-billing-consolidation/`) moved `subscription`
  and `invoice` from `business_id` to `business_group_id` (migrations `0126`–`0130`) so one
  subscription bills an entire chain instead of one Starter subscription silently spawning per
  new location; `assign_starter_subscription()` is now group-aware (`on conflict
(business_group_id) do nothing`), plan-limit counts for staff/service/refund-policy/sale
  aggregate across every business in the group, and admin plan-override actions
  (`0130`) operate group-wide too — see `docs/DATABASE_SCHEMA.md`'s `subscription`/`invoice`
  sections. Still open, and unrelated to this plan's scope: general Pro tier gating and annual
  billing cycle math (this milestone's other two extensions to M1.12) — see the design spec for
  what multi-location plan gating (`multi_location` feature, already shipped separately in
  `0123`) still needs versus what M2.4 as a whole still needs. Do not mark M2.4 itself complete
  on the strength of these plans alone.

### M2.5 — Lagos rollout

- Multi-city support: location field on business, city-scoped Platform Admin views if needed.
- **Depends on**: M1.10, M1.11. **Exit**: adding a city requires zero schema change (validates
  the Scalability NFR in PRD §8).

---

## Phase 3 — Automation & Expansion

Directional only until Phase 2 ships and pilot data validates assumptions; do not build ahead of
this without revisiting [DECISIONS.md](DECISIONS.md).

- Automated client-deposit collection (Paystack/Flutterwave) alongside manual proof — the
  `payment.method = 'gateway'` path the schema already supports (M0.2 design decision).
- SMS/WhatsApp reminders and confirmations (provider TBD — see open question in DECISIONS.md).
- Multi-staff scheduling for larger businesses.
- Expansion beyond Abuja/Lagos.
- Usage/transaction-based pricing options — additive only, must not remove flat-subscription
  tiers already sold (PRD §12.3, §10 Phase 3).

---

## Cross-Cutting Workstreams (run throughout, not phase-gated)

| Workstream                                                  | Cadence                                 | Owner concern                        |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| RLS/security regression tests                               | Every PR touching schema or a new table | [SECURITY.md](SECURITY.md)           |
| Performance budget (public page <2s on 3G)                  | Every PR touching `(public)` routes     | [FRONTEND_SPEC.md](FRONTEND_SPEC.md) |
| NDPA compliance review                                      | Each phase exit                         | [SECURITY.md](SECURITY.md)           |
| Docs freshness (schema/API docs match migrations)           | Every PR                                | CLAUDE.md workflow rule              |
| Observability (Edge Function error rates, webhook failures) | Ongoing from M1.3 onward                | [BACKEND_SPEC.md](BACKEND_SPEC.md)   |

## Suggested Team Sequencing (single small team)

If building solo or with a very small team, the fastest safe path through Phase 1 is:

`M0.1 → M0.2 → M0.3 → (M0.4 parallel) → M1.1 → M1.2 → M1.3 → M1.4 → (M1.5, M1.6 parallel) → M1.7 → M1.8 → M1.9 → M1.10 → M1.11 → M1.12`

M1.5 and M1.6 have no dependency on each other or on M1.3/M1.4 beyond M1.1/M1.2, so they can be
pulled forward if useful for early demoability (walk-in + expenses is a compelling standalone
demo even before the public booking page is polished).
