---
facts:
  - id: chat-problem
    statement: "Service businesses negotiate bookings over WhatsApp, Instagram DMs and calls, and track deposits and balances from memory or in chat threads, with no single place that says who has paid what."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement (read 2026-11-15)"
  - id: owner-persona
    statement: 'The PRD persona Amaka, a solo makeup artist, says: "I lose track of who has paid a deposit and who has not. It is all buried in my WhatsApp chats." She is a persona, not a customer.'
    source: "knowledge/audience-and-voice.md Audiences; slot-books docs/Iker_PRD.md §5 Personas"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: proof-on-booking
    statement: "In the public booking flow the client uploads proof of payment (image or PDF) before submitting, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1"
  - id: awaiting-card
    statement: 'The dashboard has an "Awaiting confirmation" card listing bookings whose payment needs checking.'
    source: "knowledge/product-facts.md pf-034; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /dashboard"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: record-payment
    statement: '"Record a payment" on a booking takes the amount received in Naira, with a "Pay off balance" shortcut, and shows the balance left after the payment.'
    source: "knowledge/product-facts.md pf-064; slot-books apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx"
  - id: part-payments
    statement: "Part payments are supported. Each payment is logged with its own date and time, and the booking shows the balance remaining."
    source: "knowledge/product-facts.md pf-065; slot-books docs/Iker_PRD.md F5.2, F5.3"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: permanent-payments
    statement: "Confirmed payments are permanent. A correction is recorded as a new adjustment entry."
    source: "knowledge/product-facts.md pf-066; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); CLAUDE.md Rule 3"
  - id: reports-from-confirmed
    statement: "Reports show income, expenses and profit for a month and are built from the payments the business confirmed."
    source: "knowledge/product-facts.md pf-094; slot-books apps/web/lib/marketing/content/features.ts (reports)"
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: brand-lines
    statement: 'Brand lines: tagline "Get booked. Get paid." and the featured post "Stop chasing payments in DMs."'
    source: "knowledge/audience-and-voice.md Lines Iker already uses; iker-brand-kit 2/05-social/README.md"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the booking page with the owner.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: Stop chasing payments in DMs

## What the product actually does

Clients pay a deposit by bank transfer straight to the business and upload proof of payment. The
proof sits on the booking. The business confirms it (or rejects it), records any later payment on
the same booking, and the booking shows what is paid so far and the balance remaining. Reports are
built from confirmed payments.

## What we must not claim

- Iker does not collect, process or hold the money, and does not check transfers itself. The owner
  confirms.
- Automatic deposit collection through a payment gateway is not shipped (pf-068). Do not imply it.
- No SMS or WhatsApp reminders (pf-151). Iker does not chase the client for the owner.
- No numbers: no "hours saved", no share of businesses, no prices.
- Do not promise fewer no-shows or that disputes disappear.
- Amaka is a PRD persona. Do not present her, or any name on screen, as a real customer.

## Notes

Demo content for the Business Explainer template, kept to one or two sentences per scene so the
template renders quickly. Product footage comes from the synthetic fixture: `synthetic-smoke` (the
Dashboard), `synthetic-new-booking` and `synthetic-record-payment`. Check the narration against the
fixture's screens before a real render.
