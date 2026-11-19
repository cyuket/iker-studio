---
# Verified facts the script may rely on. Each needs a source someone else can check.
facts:
  - id: pf-001
    statement: "Iker is booking, manual-payment tracking and bookkeeping software for Nigerian service businesses such as salons, photographers and tutors."
    source: "knowledge/product-facts.md pf-001; slot-books PRODUCT.md 'Product Purpose' (read 2026-11-15)"
  - id: pf-020
    statement: "Each business has a public booking page at its own link, meant for an Instagram bio or WhatsApp status, where clients pick a service and a time from the business's real availability."
    source: "knowledge/product-facts.md pf-020; slot-books apps/web/lib/marketing/content/features.ts 'booking-page' (read 2026-11-15)"
  - id: pf-011
    statement: "Clients book through the business's public link with no app to download and no account to create."
    source: "knowledge/product-facts.md pf-011; slot-books apps/web/lib/marketing/content/site.ts SITE.facts[1] (read 2026-11-15)"
  - id: pf-041
    statement: "Clients only see slots that are really open. Booked and blocked times never appear as available."
    source: "knowledge/product-facts.md pf-041; slot-books docs/Iker_PRD.md F1.3 (read 2026-11-15)"
  - id: pf-023
    statement: "The booking flow asks for the client's name, phone and optional email, shows the policy to accept, then shows the business's payment details and requires proof of payment before the booking can be submitted."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]/book/[serviceId] (read 2026-11-15)"
  - id: pf-060
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment; the business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts SITE.facts[2] (read 2026-11-15)"
  - id: pf-024
    statement: "After booking, the client gets a status page showing the booking's status, noting the proof of payment was received while it awaits confirmation."
    source: "knowledge/product-facts.md pf-024; slot-books docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]/booking/[token] (read 2026-11-15)"
  - id: email-new-booking-business
    statement: "When a client submits a booking (status awaiting confirmation), Iker emails the business's contact email with the subject 'New booking from <client name>' and a 'Review and confirm this booking' button."
    source: "slot-books supabase/migrations/0035_fix_notification_trigger_permissions.sql (INSERT with status awaiting_confirmation fires booking_created); supabase/functions/booking-notifications/handler.ts; supabase/functions/_shared/email/templates.ts bookingCreatedBusiness (read 2026-11-15)"
  - id: pf-034
    statement: "The dashboard has an 'Awaiting confirmation' card listing bookings whose payment needs checking."
    source: "knowledge/product-facts.md pf-034; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /dashboard (read 2026-11-15)"
  - id: pf-063
    statement: "When a client's payment is waiting, the booking shows the actions 'Confirm booking' and 'Reject payment'."
    source: "knowledge/product-facts.md pf-063; slot-books apps/web/app/(dashboard)/bookings/[id]/booking-detail-sheet.tsx lines 403-405 (read 2026-11-15)"
  - id: pf-062
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts 'deposits' (read 2026-11-15)"
  - id: email-confirmed-client
    statement: "When a booking becomes confirmed and the client gave an email, Iker emails the client with the subject 'Your appointment is confirmed with <business name>', the date and time, and a 'View your booking' button."
    source: "slot-books supabase/migrations/0035_fix_notification_trigger_permissions.sql (UPDATE to confirmed fires booking_confirmed); supabase/functions/booking-notifications/handler.ts (sends only if client.email); supabase/functions/_shared/email/templates.ts bookingConfirmedClient (read 2026-11-15)"
  - id: pf-061
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts NO_COMMISSION_FACT (read 2026-11-15)"
  - id: pf-007
    statement: "The site's 'Get started' button leads to the contact form at useiker.com, and the Iker team sets up the business with the owner."
    source: "knowledge/product-facts.md pf-007; slot-books apps/web/lib/marketing/links.ts START_FREE_HREF = '/contact' (read 2026-11-15)"
---

# Research: Introducing Iker, the booking flow from link to confirmation

First social video of the launch campaign. It follows one booking end to end: the business
shares its booking link, a client books and uploads proof of payment, the business is told,
the business confirms, and the client is told.

## What the product actually does

- Public booking page at the business's own link (pf-020), no app or account for the client
  (pf-011), only open slots shown (pf-041).
- Booking flow: slot, name, phone, optional email, policy, the business's payment details,
  proof of payment required (pf-023). Money goes straight to the business's account (pf-060).
- Client sees a status page saying the proof was received while it awaits confirmation (pf-024).
- Business gets an email "New booking from <client>" (email-new-booking-business) and sees the
  booking in the dashboard's "Awaiting confirmation" card (pf-034).
- Business opens the booking, checks the proof, presses "Confirm booking" or "Reject payment"
  (pf-063). Nothing counts as income until confirmed (pf-062).
- Client gets an email "Your appointment is confirmed with <business>" if they left an email
  (email-confirmed-client).

## What we must not claim

- Iker does not take, collect, process, hold or verify payments. The client pays the business
  directly; the business checks the proof and confirms (pf-060).
- No SMS or WhatsApp notifications or reminders: not shipped (pf-151). Notifications are email.
- The client confirmation email goes only to clients who entered an email (email is optional).
- No "zero no-shows", "never chase a payment again", time saved or any statistic.
- No prices or plan limits. Do not say "free". "No commission" is fine (pf-061).
- No Platform Admin or Super Admin screens.
- No "Start free", "Sign up" or app download. CTA is "Get started" at useiker.com (pf-007).

## Open questions

- Whether the business email arrives in seconds on the live system: the code sends it from a
  database trigger, but delivery timing was not observed. Narration says "Iker emails you",
  not "instantly". (Iker team)
- Real product footage needs a demo environment (localhost:3000 with demo data or staging).
  None is configured on this machine, so this video is designed around illustrations.
