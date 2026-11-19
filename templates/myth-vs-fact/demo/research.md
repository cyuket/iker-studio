---
facts:
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: proof-on-booking
    statement: "In the public booking flow the client uploads proof of payment (image or PDF) before submitting, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: no-gateway
    statement: "Automatic collection of client deposits through a payment gateway is not shipped. In v1 client deposits are manual only."
    source: "knowledge/product-facts.md pf-068; slot-books CLAUDE.md Rule 7; docs/EXECUTION_PLAN.md Phase 3"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the booking page with the owner.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: Myth: Iker takes my money

## The myth

An owner hears that clients can book and pay a deposit "through Iker" and assumes Iker takes the
deposit and passes it on later, or keeps a cut. This is a misunderstanding of what the product
does, framed as a question in the video. We have no data on how many owners believe it, so the
script does not say "most owners" or attach any number to it.

## What the product actually does

Clients pay the deposit by bank transfer straight to the business's own account and upload proof of
payment with the booking. The business checks the proof and confirms it (or rejects the payment).
Nothing counts as income until it is confirmed. The booking shows what is paid so far and the
balance remaining. Iker takes no commission on bookings or deposits.

## What we must not claim

- Iker does not take, collect, process or hold the money, and does not check transfers itself. The
  owner confirms.
- Automatic deposit collection through a payment gateway is not shipped (pf-068). Do not imply it,
  and do not call the deposit "secure" or "protected".
- Do not say Iker is free. No commission is a fact; plan prices are never quoted.
- No numbers: no share of owners who hold the myth, no time or money saved.
- Do not promise fewer disputes or no-shows.

## Notes

Demo content for the Myth vs Fact template. The product scene uses the synthetic fixture
(`synthetic-record-payment`), which is labelled on screen; the narration says the data is made up.
Check the narration against the fixture's screen before a real render.
