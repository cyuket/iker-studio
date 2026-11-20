---
facts:
  - id: chat-problem
    statement: "Service businesses negotiate bookings over WhatsApp, Instagram DMs and calls, and track deposits and balances from memory or in chat threads, with no single place that says who has paid what."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement (read 2026-11-15)"
  - id: booking-page
    statement: "Each business has a public booking page at its own link, meant for an Instagram bio or WhatsApp status. Clients pick a service and a time from the business's real availability."
    source: "knowledge/product-facts.md pf-020; slot-books apps/web/lib/marketing/content/features.ts (booking-page); docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]"
  - id: no-account
    statement: "Clients book through the business's public link with no app to download and no account to create."
    source: "knowledge/product-facts.md pf-011; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts[1]); docs/FRONTEND_CURRENT_STATE.md §1"
  - id: services-listed
    statement: "The booking page lists each service with its name, price, category and duration, with a category filter and a sort by price."
    source: "knowledge/product-facts.md pf-021; slot-books docs/FRONTEND_CURRENT_STATE.md §1; docs/Iker_PRD.md F2.1"
  - id: open-slots
    statement: "Clients only see slots that are really open. Booked and blocked times never appear as available."
    source: "knowledge/product-facts.md pf-041; slot-books docs/Iker_PRD.md F1.3; apps/web/lib/marketing/content/features.ts (availability)"
  - id: booking-flow
    statement: "The default booking flow: pick a slot; enter name, phone and optional email; answer the business's own questions if it has a form; read and accept the policy; then see the business's payment details and upload proof of payment. Proof is required before the booking can be submitted."
    source: 'knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1; apps/web/lib/booking/booking-stages.ts (stage titles and "Pay by transfer, then add your receipt.")'
  - id: proof-on-booking
    statement: "In the public booking flow the client uploads proof of payment (image or PDF) before submitting, and it is attached to the booking."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1"
  - id: policy-before-pay
    statement: "Clients see the policy before the payment step and must tick to accept it."
    source: "knowledge/product-facts.md pf-072; slot-books docs/FRONTEND_CURRENT_STATE.md §1 (Policy step); docs/Iker_PRD.md F12.3; apps/web/components/public/policy-acceptance.tsx"
  - id: policy-copy
    statement: "Policies are versioned. Each booking keeps a copy of the policy text its client agreed to, so changing the policy later never changes what a past booking shows."
    source: "knowledge/product-facts.md pf-071; slot-books CLAUDE.md Rule 4; apps/web/lib/marketing/content/features.ts (refunds-policies)"
  - id: refund-policy-plan
    statement: 'Settings > Policies has three tabs: "Refund Policy", "Booking Terms" and "Media Consent". It is plan-gated (plan key refund_policies).'
    source: "knowledge/product-facts.md pf-070; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /settings/policies; apps/web/lib/marketing/content/features.ts (refunds-policies)"
  - id: deposit-per-service
    statement: "A deposit is set per service as a minimum percentage of the price. Deposits are optional; a service can ask for none."
    source: "knowledge/product-facts.md pf-067; slot-books docs/FRONTEND_CURRENT_STATE.md §1 and §3 /services"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: status-page
    statement: "After booking, the client gets a status page showing the booking's status, with a note that the proof of payment was received while it awaits confirmation, and the exact policy text they accepted."
    source: "knowledge/product-facts.md pf-024; slot-books docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]/booking/[token]; apps/web/components/public/booking-status-card.tsx"
  - id: awaiting-card
    statement: 'The dashboard has an "Awaiting confirmation" card listing bookings whose payment needs checking.'
    source: "knowledge/product-facts.md pf-034; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /dashboard"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]; apps/web/app/(dashboard)/bookings/[id]/page.tsx"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the booking page with the owner.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: How your client sees it

## What the product actually does

A client opens the business's booking link, with no app and no account. The page lists the
business's services with name, price and duration. The client adds a service, picks a day and
one of the times that are really open, and enters their name and phone number. Before the
payment step they read the business's policy and tick to accept it; the booking keeps a copy of
that exact text. On the payment step they see the deposit and the business's bank details,
transfer the money to the business's own account outside the app, and upload proof of payment,
which is required before the booking can be submitted. The client then gets a status page.

On the owner's side, the booking appears in the dashboard's "Awaiting confirmation" card. The
owner opens it, views the proof, checks their own bank account, and chooses "Confirm booking"
or "Reject payment". Nothing counts as income until it is confirmed.

## What we must not claim

- Iker records and tracks the payment. It does not take, collect, process or hold the money, and
  it does not check the transfer itself. The owner checks their account and confirms.
- Automatic deposit collection, card payments or payment links are not shipped (pf-068).
- No SMS or WhatsApp reminders or confirmations (pf-151). Do not say the client is texted.
- Refund policies are plan-gated (pf-070): say "depending on your plan". Iker does not pay
  refunds out (pf-074).
- Do not promise fewer no-shows, faster bookings or fewer messages as a measured result.
- No prices or plan names. Amounts on screen come from the local demo seed and are fictional.
- Tunde Adeyemi and Amaka Studio are fictional demo data from fixtures/iker-demo/seed.sh, not
  customers.

## Notes

Demo content for the How Your Client Sees It template. Product footage comes from the real web
app running locally with demo data, through scenarios that are still **unverified**:
`iker-public-booking-page` (the services list), `iker-amaka-client-books-tablet` and
`-phone` (choosing a service and time, then the Pay & confirm step; the take stops before a proof
is uploaded or the booking is submitted) and `iker-amaka-confirm-booking-tablet` and `-phone`
(Awaiting confirmation, View proof, Confirm booking, Reject payment; nothing is pressed). None
of these scenarios records the policy step, so the policy scene is a motion graphic. If no demo
environment is available, swap them for the `synthetic-*` scenarios and label the footage as
synthetic. Check the narration against the recorded screens before a real render.
