---
facts:
  - id: proof-on-booking
    statement: "In the public booking flow the client sees the business's payment details and uploads proof of payment (image or PDF). Proof is required before the booking can be submitted, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1 (read 2026-11-15)"
  - id: client-status-page
    statement: "After booking, the client gets a status page showing the booking's status, with a note that the proof of payment was received while it awaits confirmation. Awaiting confirmation is one of the booking statuses."
    source: "knowledge/product-facts.md pf-024, pf-031; slot-books docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]/booking/[token], §5 BookingStatusBadge"
  - id: awaiting-card
    statement: 'The dashboard has an "Awaiting confirmation" card listing bookings whose payment needs checking.'
    source: "knowledge/product-facts.md pf-034; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /dashboard"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: record-payment
    statement: '"Record a payment" on a booking takes the amount received in Naira, with a "Pay off balance" shortcut, and shows the balance left after the payment.'
    source: "knowledge/product-facts.md pf-064; slot-books apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx"
  - id: permanent-payments
    statement: "Confirmed payments are permanent. A correction is recorded as a new adjustment entry."
    source: "knowledge/product-facts.md pf-066; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); CLAUDE.md Rule 3"
  - id: no-auto-collection
    statement: "Automatic collection of client deposits through a payment gateway is not shipped. In v1 client deposits are manual only."
    source: "knowledge/product-facts.md pf-068; slot-books CLAUDE.md Rule 7; docs/EXECUTION_PLAN.md Phase 3"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the booking page with the owner.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: What happens when a client uploads proof of payment?

## What the product actually does

The client pays the deposit by bank transfer to the business's own account and must upload proof
of payment before the booking can be submitted. The proof is attached to the booking, the client
sees a status page saying the proof was received while the booking awaits confirmation, and the
business sees the booking on its dashboard under "Awaiting confirmation". The business checks its
own account and chooses "Confirm booking" or "Reject payment". Nothing counts as income until it is
confirmed. Later payments are recorded on the same booking with "Record a payment", and confirmed
payments are permanent: a correction is a new entry.

## What we must not claim

- Iker does not take, collect, process or hold the money, and does not verify transfers. The owner
  checks and confirms.
- Automatic deposit collection through a payment gateway is not shipped (pf-068).
- No SMS or WhatsApp reminders (pf-151). Do not say the client is notified of the confirmation
  unless a fact supports it (pf-075 is only specified).
- Do not describe what happens to a booking after "Reject payment" beyond the action itself: no
  fact here covers it.
- No numbers: no time saved, no share of businesses, no prices.

## Notes

Demo content for the FAQ Answer template. The FAQ is one owners would plausibly ask; it is not a
quoted customer question. Product footage comes from the synthetic fixture: `synthetic-smoke` (the
Dashboard, which shows an amount awaiting confirmation) and `synthetic-record-payment` (a booking
detail page). The fixture has no "Confirm booking" button, so the decision itself is drawn as a
graphic, not shown as footage. For a real video, record `iker-amaka-confirm-booking-phone` (9:16)
or `iker-amaka-confirm-booking-tablet` (16:9) against a local or staging copy with demo data, once
those scenarios are verified.
