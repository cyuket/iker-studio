---
facts:
  - id: bookings-nav
    statement: 'The sidebar item "Bookings" opens the calendar of bookings.'
    source: "knowledge/product-facts.md pf-030; slot-books apps/web/app/(dashboard)/layout.tsx (read 2026-11-15)"
  - id: walk-in-form
    statement: '"Add walk-in" records a booking the client did not make through the link: service, time, the client''s phone, name and email (a known phone number fills in the rest), and the amount received with a live balance preview.'
    source: "knowledge/product-facts.md pf-032; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/new"
  - id: one-calendar
    statement: "Walk-ins and link bookings share one calendar, and a walk-in takes the slot like any other booking."
    source: "knowledge/product-facts.md pf-033; slot-books apps/web/lib/marketing/content/features.ts (walk-ins)"
  - id: record-payment
    statement: '"Record a payment" on a booking opens a dialog with "Amount received (₦)", a "Pay off balance" shortcut, a proof field and "Save payment". It shows the balance after the payment and refuses an amount larger than what is owed.'
    source: "knowledge/product-facts.md pf-064; slot-books apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx"
  - id: payments-card
    statement: 'A booking''s Payments card shows "Booking price", "Paid so far" and "Balance remaining", and lists every payment.'
    source: "knowledge/product-facts.md pf-063; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /bookings/[id]"
  - id: part-payments
    statement: "Part payments are supported. Each payment is logged with its own date and time, and the booking shows the balance remaining until it is paid off."
    source: "knowledge/product-facts.md pf-065; slot-books docs/Iker_PRD.md F5.2, F5.3"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts)"
  - id: chat-problem
    statement: "Without a shared record, deposits and balances are tracked from memory or in chat threads."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §2 Problem Statement"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts"
---

# Research: Record a deposit on a booking

## What the product actually does

A business adds a booking from Bookings with "Add walk-in", choosing the service, the time and the
client. On the booking, "Record a payment" takes the amount received in Naira and shows the balance
left. The Payments card then shows the booking price, what is paid so far and the balance remaining.
Each payment is logged separately, so part payments add up on the same booking.

## What we must not claim

- Iker records the payment; it does not collect or hold the money. The client pays the business
  directly.
- No automatic deposit collection, card payments or payment links for clients (not shipped, pf-068).
- No SMS or WhatsApp reminders (not shipped, pf-151).
- No time-to-complete figures. The PRD target of "under 30 seconds" for a walk-in is a requirement,
  not a measurement.

## Notes

Demo content for the Product Tutorial template. The walkthrough is recorded against the synthetic
fixture: `synthetic-new-booking` for adding the booking and `synthetic-record-payment` for recording
the deposit. Check the narration against the fixture's screens before a real render.
