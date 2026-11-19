---
facts:
  - id: chat-problem
    statement: "Service businesses negotiate bookings over WhatsApp, Instagram DMs and calls, and track deposits and balances from memory or in chat threads, with no single place that says who has paid what."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement (read 2026-11-15)"
  - id: booking-link
    statement: "Each business has a public booking page at its own link, meant for an Instagram bio or WhatsApp status. Clients book through it with no app to download and no account to create."
    source: "knowledge/product-facts.md pf-020, pf-011; slot-books apps/web/lib/marketing/content/features.ts (booking-page); apps/web/lib/marketing/content/site.ts (SITE.facts)"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: proof-on-booking
    statement: "In the public booking flow the client sees the business's payment details and uploads proof of payment (image or PDF) before submitting, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: brand-lines
    statement: 'Brand lines: tagline "Get booked. Get paid." and the featured post "Stop chasing payments in DMs."'
    source: "knowledge/audience-and-voice.md Lines Iker already uses; iker-brand-kit 2/05-social/README.md"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the booking page with the owner.'
    source: "knowledge/product-facts.md pf-007; knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: I sent the money

## What the product actually does

A client books from the business's link, pays the deposit by bank transfer straight to the
business's own account, and uploads proof of payment before the booking is submitted. The proof
sits on the booking. The business checks it and taps "Confirm booking" (or "Reject payment").
Nothing counts as income until the business confirms it.

## What we must not claim

- Iker does not collect, process or hold the money, and does not check transfers itself. The owner
  checks the proof and confirms.
- Automatic deposit collection through a payment gateway is not shipped (pf-068). Do not imply it.
- No SMS or WhatsApp reminders (pf-151). Iker does not chase the client for the owner.
- Do not promise that disputes, late payments or no-shows go away.
- No numbers: no "hours saved", no share of businesses, no prices or plan limits.
- Amaka and Tunde are PRD personas (knowledge/audience-and-voice.md). On screen they are fictional
  characters, never real customers, and the sketch carries no testimonial.

## Notes

Demo content for the Quick Sketch template: one moment, one reaction, one Iker answer, one call to
action, each in a sentence or two, so each cut lands between 15 and 30 seconds. Every scene is a
motion graphic (`character-scene`, `story`, `cta`), so the demo needs no recording. A product
screenshot scene is optional: if one replaces the answer scene, use a verified scenario such as
`synthetic-record-payment` with `"mode": "screenshot"` and say on screen that it is made-up data.
