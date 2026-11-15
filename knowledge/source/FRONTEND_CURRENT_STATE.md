> **Copied from** `../slot-books/docs/FRONTEND_CURRENT_STATE.md` (the Iker product repository, read-only source of truth) on 2026-11-15.
> This is a snapshot for offline reference. If it disagrees with slot-books, slot-books wins. Do not edit this copy; re-copy it instead.

# Iker — Current Frontend State (for design reference)

This document describes **what exists today** in the Iker frontend (`apps/web/app`,
Next.js App Router) — every page, its layout, the data it shows, and the actions available on
it. It is a factual snapshot, not a design brief: it does not suggest how anything should look,
only what is currently there (routes, fields, table columns, button labels, states).

For product rationale and rules, see [CLAUDE.md](../CLAUDE.md) and
[docs/Iker_PRD.md](Iker_PRD.md). For the design token/component intentions, see
[docs/FRONTEND_SPEC.md](FRONTEND_SPEC.md).

Iker has four route groups:

- **Public** (`(public)/[businessSlug]`) — unauthenticated client-facing booking pages.
- **Dashboard** (`(dashboard)`) — authed business owner/staff app.
- **Admin** (`(admin)`) — Platform Admin / Super Admin console.
- **Auth** — `/login`, `/auth/*`, root `/`.

---

## 1. Public — client-facing booking (no auth)

### `/[businessSlug]` — Business storefront / service list

- **Layout**: single column (max-width ~2xl). Header (business name, city) → category filter
  chips → sort link → divided list of service rows.
- **Data per service**: thumbnail image, name, price, category, duration (minutes), a 160-char
  plain-text snippet of the markdown description.
- **Filters/sort**: category badges ("All" + one per distinct category), "Sort by price: low to
  high / high to low" toggle.
- **CTA**: each row links to `/[businessSlug]/book/[serviceId]`.
- **Empty state**: "No services listed yet — check back soon." Business not found or not
  `status = active` → 404.

### `/[businessSlug]/book/[serviceId]` — Booking flow

Two possible renderers depending on whether the service has a **published workflow**:

**A. Default flow** (no workflow) — 5-step client-side wizard: `slot → details → extras (if a
custom form is attached) → policy → payment`.

| Step    | Contents                                                                                                                                                                                                                                                        | CTA / gating                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Slot    | Sticky header (service name, duration, price; deposit/total split if `min_deposit_percent < 100`), included/excluded item lists, prep notes, date `Calendar` (disabled on days with no slots), time-slot button grid grouped by day                             | "Continue" disabled until a slot is picked              |
| Details | Full name, Phone, Email (optional)                                                                                                                                                                                                                              | "Continue" disabled until name + phone (≥7 chars)       |
| Extras  | Renders the business's custom form fields (text / select / file / info-block)                                                                                                                                                                                   | "Continue" gated on field validation                    |
| Policy  | Refund policy text, booking terms, media consent (if published); single acknowledgment checkbox                                                                                                                                                                 | "Continue to payment" gated on checkbox                 |
| Payment | Business's payment/balance info (bank/account key-value pairs, or a fallback if none set); proof-of-payment upload (any image or PDF, no video/audio; required — Submit stays disabled until it is attached, and `submitBooking` refuses a booking without one) | Submit → redirects to `/[businessSlug]/booking/[token]` |

The refund policy / booking terms / media consent text the client agreed to is snapshotted into
hidden form fields at submit time — an immutable audit trail per booking.

**B. Workflow-based flow** (business has published a custom workflow) — a stepper UI with fixed
step keys: `service_overview → datetime → questionnaire (if custom fields exist) →
payment_display → payment_confirmation → success`. Two-column layout: main step card + a summary
sidebar (service/slot/price) that appears once past step 0. Same component also renders as a
live preview inside the dashboard's workflow builder.

### `/[businessSlug]/booking/[token]` — Booking status page

- **Layout**: single card, read-only, no CTAs.
- **Data**: status badge, business, service, date/time; cancellation reason if cancelled;
  "we've received your proof of payment" note if `awaiting_confirmation`; collapsible sections
  for the exact policy/terms/consent text the client accepted (versioned snapshots).

---

## 2. Auth / root

| Route                | Purpose                              | Layout                                                                                                                                                                                                              |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Landing stub                         | "Iker" heading, one-line tagline, single "Log in" button → `/login`                                                                                                                                                 |
| `/login`             | Login                                | Split layout: brand panel (desktop) + centered card form. Shows a "Password set — log in below" banner when redirected from password setup. Footer: "Don't have access yet? Ask your Platform Admin to invite you." |
| `/auth/set-password` | Set password (invite flow)           | Same split layout, heading "Set your password"                                                                                                                                                                      |
| `/auth/confirm`      | Route handler (not a page)           | Verifies Supabase OTP, redirects to `/login` or `/login?error=confirmation-failed`                                                                                                                                  |
| `/design-preview`    | Internal, unlinked component gallery | Buttons, inputs, a sample service card, all status badges, a tabs demo, an avatar — a token/primitive sandbox, not a real screen                                                                                    |

---

## 3. Dashboard — authed business owner/staff

**Shell**: sidebar nav — Overview, Bookings (points at `/calendar`), Services, Availability,
Booking Workflows, Transactions (children: Income, Expenses), Reports, Settings (children:
Policies, Billing). "Overview" shows a pending-count badge. Sidebar has an "Upgrade your plan"
CTA card linking to `/settings/billing`.

### `/dashboard` — Overview

- Header: 3 quick actions — "Add walk-in" (dialog), "Add service" (dialog), "Add expense"
  (dialog).
- 4-tile stat grid: Bookings this month, Income this month, Bookings all-time, Income all-time
  (cancelled bookings excluded).
- Booking-link card: public booking URL + copy-to-clipboard, "Not live yet" badge if business
  isn't active.
- "Awaiting confirmation" card (conditional): service·client, amount, date, "Review Booking" →
  `/bookings/[id]`.
- Full calendar/table booking view (`BookingsView`) for the current month, with Previous/Next
  month navigation.

### `/calendar` — Calendar

- Header ("Calendar" + "Add walk-in") + `BookingsView` for the selected month. There is no
  separate `/bookings` list route — "Bookings" in the nav points here, and `BookingsView`
  toggles between a month-grid calendar and a sortable table.

`BookingsView` (shared): owns filter state (status, service, client search, date range) and a
Calendar/Table tab toggle.

- **Calendar tab**: month grid, up to 3 booking chips/day + "+N more", status-colored dots,
  today-ring highlight, Previous/Next month, clicking a day opens a side-panel listing all that
  day's bookings (each linking to `/bookings/[id]`).
- **Table tab** columns: Date, Client, Service, Status (sortable, click-to-sort asc/desc); rows
  link to `/bookings/[id]`.

### `/bookings/new` — New walk-in booking

- Also reachable as a modal ("Add walk-in") from Dashboard, Calendar, and Income headers.
- Fields: service picker, day-grouped time-slot picker, client phone/name/email (auto-fills
  name/email if phone matches a known client), amount received with a live balance preview,
  overpay warning.
- Submits via a server action.

### `/bookings/[id]` — Booking detail

- **Details card**: client (name·phone·email), when, price, cancellation reason (if any),
  collapsible sections showing the refund policy / booking terms / media consent _this specific
  booking_ agreed to (its own snapshot, never the business's current policy).
- **Form Responses card** (conditional — only if a custom form was attached to the booking).
- **Payments card**:
  - Summary list: Booking price, Paid so far, Balance remaining, Awaiting your confirmation (if
    > 0), Refunded to client (if >0), Refund agreed not yet paid out (if >0), payment status
    > badge.
  - Payments list (ordered, newest first): amount · payment type · method, date, "Confirmed by
    {name} on {date}" if applicable, "View proof" (signed URL) link, status badge (Confirmed /
    Awaiting confirmation / Rejected). Empty state: "No payments recorded yet."
  - **Actions** (conditional on a `pending_review` payment existing): "Confirm booking" / "Reject
    payment".
  - **Refund ledger** (conditional — only if refunds exist): amount, status, "Mark as paid"
    action per row.
  - Bottom actions: "Record a payment" (modal — amount, "pay off balance" quick-fill, overpay
    validation), "Cancel booking" (modal — reason category select: Business/Client
    requested/No-show/Other, required reason text, refund-to-agree amount auto-suggested from
    the booking's snapshotted refund policy with a "use the policy amount" reset and over-refund
    validation, destructive submit).

### `/services` — Services list

- Header + "Add service" (modal).
- "All services" card, divided list. Row: thumbnail (or placeholder icon), name, "Archived"
  badge if applicable, category · duration, price, row actions.
- **Row actions**: "Edit workflow" → `/services/[id]/workflow`; "Edit" (modal — name, category,
  price, duration [value + unit: minutes/hours/days/weeks], markdown description with toolbar,
  min deposit %, included/excluded item lists, prep notes, image URL); "Archive"/"Unarchive"
  toggle.
- Empty state: "No services yet." There is no standalone `/services/[id]` detail page — editing
  happens through the row's Edit modal; the only `[id]` sub-route is `/workflow`.

### `/services/[id]/workflow` — Booking workflow builder

- If no workflow exists yet: a modal offering "Start from a template" (pre-filled sample copy) or
  "Start blank".
- Once a workflow exists — 3-column builder:
  1. Left nav: the 6 fixed step keys (`service_overview, datetime, questionnaire,
payment_display, payment_confirmation, success`), each with an edited/not-edited indicator,
     plus "Workflow settings".
  2. Center: the editor for the selected step (generic editor, questionnaire summary,
     payment-display editor, success-step editor, or settings editor for accent color + cover
     image).
  3. Right: a phone-frame live preview rendering the real public booking flow component.
- Header: service name, Draft/Published badge, "Copy booking link", "Preview as client" (opens
  public URL), Publish/Unpublish.

### `/availability` — Availability settings

- Three stacked cards: "Weekly hours" (per-weekday hours form), "Buffer & minimum notice",
  "Blocked dates" (add/remove specific blocked dates).

### `/forms` — Booking forms list

- Header + "New form" (modal). "Your forms" card, divided list.
- Row: form name (links to detail), "All services" badge if business-wide, field count, "applies
  to every service" or "N services" attached, Edit link.
- Empty state: "No forms yet."

### `/forms/[id]` — Form detail/editor

- Four stacked cards:
  1. **Form settings**: name, business-wide toggle.
  2. **Fields**: add/edit/reorder/delete rows — field types: text input, select, file upload,
     info block; each has label, required flag, options (for select), info text (for info
     block).
  3. **Where this form shows**: multi-select of services (disabled if business-wide).
  4. **Export responses**: optional From/To date range, "Download Responses" button (GET route
     that returns a file, not a page). "Add a field first" message if the form has no fields.

### `/workflows` — Workflows overview

- Header + "Your services" card listing every service with a status badge (Published / Draft /
  No workflow yet) and a "Set up workflow" / "Edit workflow" button → `/services/[id]/workflow`.
- Empty state (no services at all): "No services yet" + "Go to services" CTA.

### `/accounting/expenses` — Expenses

- Header + "Add expense" (modal). "Recorded expenses" card — table (desktop) / card list
  (mobile), newest first, capped at 200 rows.
- **Columns**: Date, Details (description + "Removed" badge if voided), Category, Receipt (View
  link / "No receipt yet" badge / — if voided), Amount (strikethrough if voided), Actions
  (edit/void).
- Header note: count of expenses missing a receipt. Empty state: "No expenses yet."

### `/accounting/income` — Income

- Header + "Add walk-in" (modal). "Payments" card — table (desktop) / cards (mobile).
- **Columns**: Date, Client, Service, Method, Status (Confirmed / Not counted yet / Refund
  badges), Amount (shown in a danger/red style if negative, i.e. a refund line).
- Cap note: "Showing your {N} most recent payments." Empty state: "No income yet."

### `/accounting/transactions` — Transactions ("Statement of accounts")

- Table/cards combining payments + refunds + expenses into one ledger, newest first, capped.
- **Columns**: Date, Type (Income / Refund / Expense badges), Details, Amount (negative shown in
  a danger color). Cap note: "Showing your N most recent transactions."

### `/accounting/reports` — Reports

- Header + month picker + 3-stat-card row: Income, Expenses, Profit-or-Loss — each with a large
  money value and a delta line (up/down + % vs previous month, or "Same as {month}").
- "Not counted yet" pending-income callout (conditional).
- "Where the money went" expense-by-category breakdown. **Columns**: Category, Amount, Share
  (%), plus a Total row. Empty state: "No expenses recorded for {month}" + "Go to expenses" link.

### `/settings/policies` — Policies (tabbed)

- Tabs (URL-synced via `?tab=`): **Refund Policy** / **Booking Terms** / **Media Consent**.
- Each tab: scope selector (business-wide + per-service overrides), current version
  display/editor, retired-version history list.
- Refund policy editor: structured refund rules + display text. Booking Terms / Media Consent
  editor: supports template suggestions based on business category.
- Copy shown to the user: "Publishing always adds a new version — bookings already taken keep
  the exact terms their client agreed to."

### `/settings/refund-policy`

- Pure redirect to `/settings/policies?tab=refund` (legacy URL kept alive).

### `/settings/billing` — Billing

- **Current plan card**: plan name, status badge (with tone: positive/neutral/warning/muted),
  optional "Payment in progress" badge, price/renewal/discount details, Cancel/Resume
  subscription control.
- **Plans card**: grid of plan cards (monthly/yearly), pick/switch plan.
- **Payments card**: invoice history — amount, date, gateway reference, status badge (Paid /
  "Didn't go through" / Refunded).
- Explicit copy: "Iker never takes a cut of your bookings or the deposits your clients pay
  you." This is the only dashboard screen showing Iker's own revenue from the business,
  structurally separate from `/accounting`.

---

## 4. Admin — Platform Admin / Super Admin console

**Shell**: sidebar titled "Iker Admin". Nav: Onboarding, Businesses (all admins); Admins,
Plans, Analytics (Super Admin only).

### `/onboarding` — Onboarding queue

- Header + "New business" (modal). Two cards: "Awaiting setup" (`pending_verification` status),
  "Suspended".
- Row: business name (link), slug/category/city, status badge, Suspend/Reactivate actions.
- Empty states: "Nothing waiting" / "No suspended businesses".

### `/businesses` — Business directory

- Header + "New business" (modal). "Directory" card with a search form (text input + status
  filter: All/Awaiting setup/Active/Suspended, "Apply") + divided list.
- Row: name (link → detail), `/slug · category · city`, status badge.
- Empty state: "No matches" or "No businesses yet" depending on whether a filter is active.

### `/businesses/[id]` — Business detail

- Back link + header (name/slug + status badge + suspend/reactivate actions).
- **Account details card**: category, city, location, contact phone/email, created/activated/
  suspended dates.
- **Activity card** (stat grid): Services, Bookings, Confirmed, Cancelled, Upcoming, Team, Active
  team, Latest booking — sourced from an aggregate RPC. **No money figures.**
- **Subscription discount card**: apply a promo code to the business's own Iker
  subscription.
- **Team card**: staff roster — name, email, Owner/Staff badge, "Deactivated" badge if
  applicable, resend-invite action; an "invite owner" form if the business has no owner yet.
- Deliberate absence, enforced at the DB layer as well as in the UI: no income, expense,
  payment, or statement data anywhere on this page.

### `/admins` — Admin roster (Super Admin only)

- Header + "New admin" (modal). "Roster" card (list) + "Recent changes" card (audit log).
- Roster row: name, role badge (Super Admin / Platform Admin), "No access" badge if deactivated,
  "you" tag for self, email, "added X ago" / "access removed X ago", account actions (role
  change / deactivate / reactivate — blocked from removing the last active super admin).
- Recent changes: "{actor} {action} {target}" entries with relative timestamps — actions:
  "added an admin", "removed access for", "restored access for", "changed the role of".

### `/plans` — Subscription plans (Super Admin only)

- Header + plan editor (create mode) + responsive grid of plan cards.
- Card: plan name, Available/Hidden badge, code, subscriber count (active/trialing breakdown),
  Monthly price, Yearly price, Staff limit, Booking pages limit, plus an inline edit form.
- Copy: "Changing a price only affects new subscriptions — businesses already on a plan keep the
  price they signed up at." The one money surface in the admin console (Iker's own pricing,
  never tenant income).

### `/analytics` — Platform analytics (Super Admin only)

- Header + 4-stat-tile row + "Activity, last 6 months" table + 2-column grid ("Payment activity
  this month", "Plan mix").
- **Stat tiles**: Businesses (+active/awaiting/suspended breakdown), Onboarded this month,
  Bookings this month (+confirmed/cancelled), Paying subscriptions (+trialing).
- **Monthly activity table columns**: Month (with an inline bar-width indicator), Bookings,
  Confirmed, Businesses active, New businesses.
- **Payment activity**: counts of _businesses per activity band_ — never amounts; can show a
  suppression notice ("Too few businesses transacted…") when a bucket has under 5 businesses, to
  prevent re-identification.
- **Plan mix**: subscriber counts per plan.
- This page cannot query `payment`/`expense`/`booking` tables directly — only pre-aggregated,
  DB-enforced views/RPCs with no per-business money column.

---

## 5. Shared components

**Layout shells**

- `AppSidebar` — shared shell for both Dashboard and Admin: fixed desktop sidebar (nav links,
  optional badge counts, optional CTA card slot, user label, log out) + mobile hamburger header.
- `MobileNav` — mobile slide-down nav mirroring the sidebar.
- `AuthSplitLayout` — used by `/login` and `/auth/set-password`: brand panel (desktop) + centered
  card + footer slot.

**Status / badges**

- `Badge` — base primitive, variants: default, secondary, destructive, outline, ghost, link,
  pending, confirmed, paid, cancelled, overdue, refunded, success, danger.
- `BookingStatusBadge` — the single source of truth for all 7 booking statuses: pending,
  awaiting_confirmation, confirmed, completed, cancelled_refunded,
  cancelled_partially_refunded, cancelled_no_refund. Used on dashboard, admin, and the public
  status page.
- `BusinessStatusBadge` — pending_verification / active / suspended.

**Data display**

- `MoneyDisplay` / `formatKobo()` — integer-kobo → Naira formatting. Business-authed contexts
  only; never used on admin surfaces.
- `BookingsView` — composite calendar/table booking browser (Dashboard Overview + Calendar
  pages); owns filter state and the Calendar/Table toggle.
- `MonthCalendar` — month grid with booking chips, opens a day side-panel.
- `DayBookingsSheet` — side-panel listing all bookings for a clicked day.
- `BookingsTable` — sortable Date/Client/Service/Status table + mobile card fallback.
- `StatTile` — reusable KPI card (icon chip, label, value, optional trend badge). Defined but
  **not currently used** by any page — Overview/Reports use inline stat markup instead.
- `BarStatCard`, `GaugeStatCard`, `LineStatCard` — chart-style stat card primitives, **not
  referenced anywhere in `app/`** currently (unused/available components).
- `BookingLinkCard` — public URL + copy button + "Not live yet" badge (Dashboard Overview).
- `EmptyState` — generic dashed-border empty-state block (icon, title, description, optional
  action), used throughout dashboard and admin list pages.

**Forms / dialogs**

- `CustomFormFields` — renders a business's custom form fields by type; shared between the
  public "extras" step and the workflow questionnaire step.
- `MarkdownContent` / `MarkdownToolbar` — markdown render + edit toolbar, used in service
  descriptions and policy editors.
- `BookingActions` — Confirm booking / Reject payment button pair.
- Admin-specific: `DiscountCodeForm`, `InviteOwnerForm`, `ResendInviteButton`,
  `NewBusinessDialog`, `NewAdminDialog`, `AdminAccountActions`, `BusinessStatusActions`,
  `PlanEditor`.

**Policies**

- `PolicyPageTabs` — URL-synced tab switcher for Refund/Terms/Consent.
- `PolicyTabShell` — scope selector + current/retired version list, reused by all three policy
  types.

**Workflow builder & runtime**

- `WorkflowBookingFlow` — the shared stepper, rendered both as the real public booking flow and
  as a live preview inside the workflow builder.
- Step components: `ServiceOverviewStep`, `DatetimeStep`, `QuestionnaireStep`,
  `PaymentDisplayStep`, `PaymentConfirmationStep`, `SuccessStep`.
- `WorkflowStepper`, `WorkflowSummaryCard` — progress indicator and sticky booking summary
  sidebar.

**UI primitives** (`components/ui/`): `avatar`, `badge`, `button`, `calendar`, `card`,
`checkbox`, `dialog`, `input`, `label`, `popover`, `select`, `separator`, `skeleton`, `table`,
`tabs`, `textarea`, `toast` — a shadcn/ui-style primitive set underlying every page above.

---

## 6. `/design-preview`

An unlinked, static component gallery (`app/design-preview/page.tsx`): all button variants
(including disabled), text + textarea inputs, a sample service card, every `BookingStatusBadge`
status plus generic `Badge` variants, a tabs demo, and an avatar with fallback initials. It's a
token/primitive sandbox against [docs/FRONTEND_SPEC.md](FRONTEND_SPEC.md), not a real screen.
