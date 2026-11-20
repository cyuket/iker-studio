---
# Verified facts the script may rely on. Ids reuse knowledge/product-facts.md. Every source was
# read in slot-books on 2026-11-20 by Claude Code (iker agent) unless stated otherwise.
facts:
  - id: pf-001
    statement: "Iker is booking, manual-payment tracking and bookkeeping software for Nigerian service businesses such as salons, photographers and tutors."
    source: "knowledge/product-facts.md pf-001; slot-books apps/web/lib/marketing/content/site.ts SITE.facts[0] (read 2026-11-20)"
  - id: pf-023
    statement: "In the default booking flow the client sees the business's payment details and uploads proof of payment; proof is required before the booking can be submitted."
    source: "knowledge/product-facts.md pf-023; slot-books docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]/book/[serviceId], Payment row: 'required, Submit stays disabled until it is attached, and submitBooking refuses a booking without one' (read 2026-11-20)"
  - id: pf-031
    statement: "A booking's status is one of: pending, awaiting confirmation, confirmed, completed, cancelled with refund, cancelled with partial refund, cancelled with no refund."
    source: "knowledge/product-facts.md pf-031; slot-books docs/FRONTEND_CURRENT_STATE.md §5 BookingStatusBadge (read 2026-11-20)"
  - id: pf-041
    statement: "Clients only see slots that are really open; a booking that is awaiting confirmation holds its time, so nobody else can book that slot while the business checks the proof."
    source: "knowledge/product-facts.md pf-041 (booked times never appear as available); slot-books supabase/migrations/20261007114951_complete_bookings_when_paid.sql (exclusion constraint covers status in pending, awaiting_confirmation, confirmed, completed) and apps/web/lib/booking/load-service-booking-data.tsx occupancy query (.in('status', ['pending','awaiting_confirmation','confirmed','completed'])) (read 2026-11-20); confirmed by the owner in the video brief of 2026-11-20"
  - id: pf-060
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment; the business checks it and confirms; Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts SITE.facts[2]; apps/web/lib/marketing/content/features.ts line 147 FAQ 'Does Iker collect the money? No. Clients transfer directly to your bank account. Iker records it and never holds your funds.' (read 2026-11-20)"
  - id: pf-062
    statement: "Nothing counts as income until the business confirms the payment."
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts deposits tour step 'You confirm every payment. Nothing counts as income until you do.' (read 2026-11-20)"
  - id: pf-063
    statement: "On a booking, the Payments card shows Booking price, Paid so far, Balance remaining and any amount Awaiting your confirmation, lists each payment with its proof (View proof), and while a client's payment is waiting the actions are Confirm booking and Reject payment."
    source: "knowledge/product-facts.md pf-063; slot-books apps/web/app/(dashboard)/bookings/[id]/page.tsx lines 176-197 ('Paid so far', 'Balance remaining', 'Awaiting your confirmation') and booking-detail-sheet.tsx lines 403-405 ('Confirm booking', 'Reject payment') (read 2026-11-20); also seen in the existing take output/create-a-short-social-media-campaign-to-introduce-the-produc/recordings/iker-amaka-confirm-booking-phone/screenshots/confirm-phone.png"
  - id: pf-067
    statement: "A deposit is set per service as a minimum percentage of the price, and deposits are optional."
    source: "knowledge/product-facts.md pf-067; slot-books docs/FRONTEND_CURRENT_STATE.md §1 and §3 /services (read 2026-11-20)"
  - id: pf-007
    statement: "The site's Get started button leads to the contact form at useiker.com/contact, and the Iker team sets up the business and its booking page with the owner."
    source: "knowledge/product-facts.md pf-007; slot-books apps/web/lib/marketing/links.ts START_FREE_HREF = '/contact'; apps/web/components/marketing/home/hero.tsx 'Get started' (read 2026-11-20)"
  - id: pf-061
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts NO_COMMISSION_FACT (read 2026-11-20)"
---

# Research: confirming a deposit from proof of payment ("I'll send it now now")

Video `now-now-confirm-deposit`, template `product-tutorial`, content type `PRODUCT_TUTORIAL`.
Viewer: the owner, or the staff member who checks the transfer. Fictional cast: Amaka, a makeup
artist in Abuja (Bridal makeup ₦45,000, deposit ₦15,000), clients Chioma O., Bisi A., Kemi T.
Amaka is the PRD persona, not a customer; the amounts are illustrative, not prices.

## What the product actually does

- The client pays the business directly, by bank transfer to the business's own account, outside
  the app, and uploads proof of payment (pf-060). In the default booking flow the booking cannot
  be submitted without that proof (pf-023).
- The booking then shows "Awaiting confirmation" (pf-031). On the booking, the Payments card shows
  Booking price, Paid so far, Balance remaining and "Awaiting your confirmation", the payment
  with a "View proof" link, and the two actions "Confirm booking" and "Reject payment" (pf-063).
- While a booking is awaiting confirmation it holds its slot: the database exclusion constraint
  and the public availability query both treat `awaiting_confirmation` bookings as occupying the
  time (pf-041, source detail above). Confirmed by the owner in the brief.
- Nothing counts as income until the business confirms (pf-062). In the existing take of
  `iker-amaka-confirm-booking-phone`, a ₦15,000 deposit awaiting confirmation shows "Paid so far
  ₦0" and "Awaiting your confirmation ₦15,000", which matches pf-062.
- After Confirm booking, the confirmed deposit counts in Paid so far and the Balance remaining is
  the price minus what is paid (pf-063). For the story's numbers: ₦45,000 price, ₦15,000 deposit,
  so Paid so far ₦15,000 and Balance remaining ₦30,000 (arithmetic on illustrative amounts).
- Deposits are a per-service minimum percentage and are optional (pf-067). ₦15,000 on ₦45,000 is
  33%; it is an illustrative example, not a recommended setting.
- Call to action: "Get started" at useiker.com opens the contact form; the Iker team sets the
  business up (pf-007). "No commission on bookings or deposits" (pf-061).

## What we must not claim

- Iker does not take, collect, process, hold or verify payments. It records and tracks them. Do
  not say money "lands", "arrives" or is "collected" in Iker. The owner checks the transfer in
  their own bank app; Iker does not check it (pf-060).
- Iker sends no reminders. The Day 2 and Day 3 reminders in the story are Amaka's own WhatsApp
  messages. SMS and WhatsApp reminders are not shipped (pf-151).
- No outcome promises: a deposit does not stop "now now", no-shows or late payment. What the
  product gives is proof of payment to look at before the booking is confirmed.
- No "free", no "ever", no plan price (pf-131). "No commission on bookings or deposits" only.
- No automatic deposit collection through a gateway (pf-068, not shipped).
- Do not describe what the client sees or is told after "Reject payment" (open, below).
- Do not present Amaka, Chioma O., Bisi A. or Kemi T. as real people, or the amounts as Iker
  prices or data. No statistics about how often clients delay.
- Admin views never show business money (pf-012). This video has no admin scene.
- The "Day 1 to Day 4" week is a story, not a measurement.

## Needs research

- **What the client sees after "Reject payment".** Not described in the script. The business-side
  copy on the booking says "Rejecting means this payment didn't go through. The booking stays as
  is and they'll need to try again." (seen in the existing confirm-phone screenshot). Whether the
  client is notified, by what channel, what their status page shows, and whether the slot stays
  held after a rejection were not checked. Who can answer: the slot-books owner, or a read of
  `apps/web/lib/bookings/actions.ts` and the reject RPC plus the public status page
  `/[businessSlug]/booking/[token]`.
- **Does the slot stay held after "Reject payment"?** Unknown; kept out of the script.
- **knowledge/product-facts.md has no dedicated fact for "awaiting confirmation holds the slot".**
  This video cites pf-041 with the code sources above. Suggest adding an explicit pf entry to
  `knowledge/` (not edited by this run).

## Open questions

- Resolved 2026-11-20 (human decision: add a seed booking, write a new scenario). The local demo
  seed now has Chioma Okafor's Bridal makeup booking at ₦45,000 for this booking, ₦15,000
  deposit proof pending review, Saturday 10:30 WAT, awaiting confirmation (booking ...0046,
  payment ...0057; reset with `fixtures/iker-demo/seed.sh reset-chioma`). The rate card item
  stays ₦120,000; the booking page and its line item show the booking's own price
  (slot-books insert_default_booking_item in
  supabase/migrations/20261105091500_booking_item_default_excludes_fee.sql). Scenes 5 and 7 use
  the new phone scenarios `iker-amaka-chioma-proof-phone` and `iker-amaka-chioma-confirmed-phone`
  (both unverified until recorded).
- The proof-of-payment image opens in a new tab the recorder cannot show. No storyboard visual
  kind can composite a mock image over footage today, so scene 5 spotlights the "View proof"
  link and carries a "mock" label instead of showing a mock receipt.
