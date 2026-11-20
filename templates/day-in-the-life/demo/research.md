---
facts:
  - id: chat-problem
    statement: "Service businesses negotiate bookings over WhatsApp, Instagram DMs and calls, and track deposits and balances from memory or in chat threads, with no single place that says who has paid what."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement (read 2026-11-15)"
  - id: client-link-no-app
    statement: "Clients book through the business's public link with no app to download and no account to create."
    source: "knowledge/product-facts.md pf-011; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts[1]); docs/FRONTEND_CURRENT_STATE.md §1"
  - id: awaiting-card
    statement: 'The dashboard has an "Awaiting confirmation" card listing bookings whose payment needs checking, next to monthly and all-time totals for bookings and income.'
    source: "knowledge/product-facts.md pf-034; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /dashboard"
  - id: add-walk-in
    statement: '"Add walk-in" records a booking the client did not make through the link. It takes the service, the time, the client''s phone, name and email and the amount received, with a live preview of the balance.'
    source: "knowledge/product-facts.md pf-032; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/new; apps/web/lib/marketing/content/features.ts (walk-ins)"
  - id: walk-in-shared-calendar
    statement: "Walk-ins and link bookings share one calendar. A walk-in takes the slot like any other booking, and its payments count in the books."
    source: "knowledge/product-facts.md pf-033; slot-books apps/web/lib/marketing/content/features.ts (walk-ins)"
  - id: open-slots-only
    statement: "Clients only see slots that are really open. Booked and blocked times never appear as available."
    source: "knowledge/product-facts.md pf-041; slot-books docs/Iker_PRD.md F1.3; apps/web/lib/marketing/content/features.ts (availability)"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: proof-on-booking
    statement: "In the public booking flow the client uploads proof of payment (image or PDF) before submitting, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: record-payment
    statement: '"Record a payment" on a booking takes the amount received in Naira, with a "Pay off balance" shortcut, and shows the balance left after the payment.'
    source: "knowledge/product-facts.md pf-064; slot-books apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx"
  - id: part-payments
    statement: "Part payments are supported. Each payment is logged with its own date and time, and the booking shows the balance remaining."
    source: "knowledge/product-facts.md pf-065; slot-books docs/Iker_PRD.md F5.2, F5.3"
  - id: reports-from-confirmed
    statement: "Reports show income, expenses and profit for a month and are built from the payments the business confirmed."
    source: "knowledge/product-facts.md pf-094; slot-books apps/web/lib/marketing/content/features.ts (reports)"
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: no-reminders
    statement: "SMS and WhatsApp reminders and confirmations are not shipped."
    source: "knowledge/product-facts.md pf-151; slot-books docs/EXECUTION_PLAN.md Phase 3; docs/Iker_PRD.md §10 Phase 3"
  - id: brand-lines
    statement: 'Brand lines: tagline "Get booked. Get paid." and the featured post "Stop chasing payments in DMs."'
    source: "knowledge/audience-and-voice.md Lines Iker already uses; iker-brand-kit 2/05-social/README.md"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the business and its booking page with the owner.'
    source: "knowledge/product-facts.md pf-007; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: A day in a salon, from first booking to closing balance

## What the product actually does

Clients book from the business's link with no app to download. A client pays the deposit by bank
transfer straight to the business's own account and uploads proof of payment, which is attached to
the booking. The dashboard lists bookings whose payment is awaiting confirmation. The owner checks the
proof and chooses Confirm booking or Reject payment; nothing counts as income until it is confirmed.
A walk-in is added with Add walk-in and takes its slot on the same calendar as link bookings. Later
payments are recorded on the same booking with Record a payment, and the booking shows Paid so far and
Balance remaining. The monthly report is built from confirmed payments.

## What we must not claim

- Iker does not take, collect, process or hold the money, and it does not check transfers itself.
  The owner checks the proof against their own bank and confirms.
- Automatic deposit collection through a payment gateway is not shipped (pf-068). Do not imply it.
- No SMS or WhatsApp reminders (pf-151). Iker does not chase the client for the owner.
- No numbers: no "hours saved", no share of businesses, no prices, no plan limits.
- Do not promise fewer no-shows, no double bookings "ever", or that disputes disappear. The
  supported statement is that a booked time no longer shows as open on the booking link (pf-041).
- No testimonials. Kemi, her salon and her clients (Bisi, Tola) are invented for this demo. They are
  not customers and not the PRD persona; the narration says so, and every character carries
  "(fictional)" on screen.
- The ₦15,000 deposit and ₦40,000 booking price are illustrative amounts for a fictional booking,
  not a price anyone charges.

## Notes

Demo content for the Day in the Life template. Product footage comes from the synthetic fixture:
`synthetic-smoke` (the Dashboard), `synthetic-new-booking` (Add walk-in) and
`synthetic-record-payment` (Record a payment). The proof upload and the confirm decision are shown as
character scenes, not as drawn product screens, because no verified scenario records them yet; the
`iker-amaka-*` scenarios cover them against a demo environment but are unverified. Check the
narration against the fixture's screens before a real render.
