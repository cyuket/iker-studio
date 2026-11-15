---
facts:
  - id: deposit-tracking-name
    statement: 'The marketing site calls the feature "Deposit Tracking": "Deposits tracked from transfer to confirmed."'
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/features.ts (slug deposits) (read 2026-11-15)"
  - id: deposit-not-plan-gated
    statement: "Deposit tracking has no plan feature key on the marketing site, unlike plan-gated features such as Google Calendar sync or custom forms."
    source: "knowledge/product-facts.md pf-134; slot-books apps/web/lib/marketing/content/features.ts (deposits: planFeatureKey null)"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: deposit-per-service
    statement: "A deposit is set per service as a minimum percentage of the price. Deposits are optional."
    source: "knowledge/product-facts.md pf-067; slot-books docs/FRONTEND_CURRENT_STATE.md §1, §3 /services"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", lists every payment with its proof, and offers "Confirm booking" and "Reject payment" when a client payment is waiting.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: record-payment
    statement: '"Record a payment" on a booking takes the amount received in Naira and shows the balance left after the payment.'
    source: "knowledge/product-facts.md pf-064; slot-books apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx"
  - id: confirm-before-income
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits)"
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts"
---

# Research: Deposit tracking in Iker

## What the product actually does

A client pays the deposit by bank transfer straight to the business and uploads proof when booking.
The proof sits on the booking. The business confirms or rejects it, and records any later payment on
the same booking with "Record a payment". The booking shows the price, what is paid so far and the
balance remaining. Nothing counts as income until it is confirmed.

## What we must not claim

- Iker does not collect, process or hold the money. No card payments or automatic collection for
  client deposits (not shipped, pf-068).
- No release date: deposit tracking has been part of Iker since the first version, so this is a
  feature spotlight, not a launch.
- Do not say which plans include it. It carries no plan gate on the marketing site, but plan contents
  can change; say nothing about plans rather than guess.
- No prices, percentages or "fewer no-shows" promises.

## Notes

Demo content for the Feature Announcement template. It describes an existing, shipped feature and
does not claim a release date. Footage: `synthetic-record-payment`.
