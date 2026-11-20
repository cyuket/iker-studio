---
# Verified facts the script may rely on. Each id is the pf-NNN id in knowledge/product-facts.md,
# re-checked against ../slot-books on 2026-11-20.
facts:
  - id: pf-002
    statement: "Service businesses negotiate appointments over WhatsApp, Instagram DMs and phone calls, and keep their records in chats, memory and notebooks."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement"
  - id: pf-007
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the business, its services and its booking page with the owner.'
    source: "knowledge/product-facts.md pf-007; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx; home FAQ \"How do I get started?\""
  - id: pf-020
    statement: "Each business has a public booking page at its own link, meant for an Instagram bio or WhatsApp status. Clients pick a service and a time from the business's real availability."
    source: "knowledge/product-facts.md pf-020; slot-books apps/web/lib/marketing/content/features.ts (booking-page); app/(public)/[businessSlug]/page.tsx"
  - id: pf-021
    statement: "The public booking page lists each service with its name, price, category and duration."
    source: "knowledge/product-facts.md pf-021; slot-books docs/FRONTEND_CURRENT_STATE.md §1; components/public/storefront-listing.tsx"
  - id: pf-040
    statement: 'The Availability page has three parts: "Weekly hours", "Buffer & minimum notice" and "Blocked dates".'
    source: "knowledge/product-facts.md pf-040; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /availability; studio scenario iker-availability"
  - id: pf-041
    statement: "Clients only see slots that are really open. Booked and blocked times never appear as available."
    source: "knowledge/product-facts.md pf-041; slot-books apps/web/lib/marketing/content/features.ts (availability)"
  - id: pf-050
    statement: "A service has a name, category, price, duration, description, a minimum deposit percentage, included and excluded items, preparation notes and an image."
    source: "knowledge/product-facts.md pf-050; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /services"
  - id: pf-051
    statement: 'The dashboard sidebar calls the list of services "Rate card".'
    source: "knowledge/product-facts.md pf-051; slot-books apps/web/app/(dashboard)/layout.tsx"
  - id: pf-052
    statement: "Services are grouped into packages. The booking flow is set up once per package and every service in it uses that flow."
    source: "knowledge/product-facts.md pf-052; slot-books apps/web/lib/marketing/content/features.ts (packages); route app/(dashboard)/packages/[id]/workflow"
  - id: pf-060
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); home FAQ \"How do clients pay their deposit?\""
  - id: pf-061
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (NO_COMMISSION_FACT)"
  - id: pf-063
    statement: 'When a client payment is waiting on a booking, the actions are "Confirm booking" and "Reject payment".'
    source: "knowledge/product-facts.md pf-063; slot-books apps/web/app/(dashboard)/bookings/[id]/page.tsx"
  - id: pf-067
    statement: "A deposit is set per service as a minimum whole-number percentage of the price (1 to 100). Deposits are optional."
    source: "knowledge/product-facts.md pf-067; slot-books supabase/migrations/0021_rich_service_details.sql (min_deposit_percent smallint, 1-100)"
  - id: pf-072
    statement: "Clients see the business's policy in the booking flow before paying and must tick to accept it. It renders on the Pay & confirm step."
    source: "knowledge/product-facts.md pf-072; slot-books components/public/booking/stages/pay-stage.tsx (PolicyAcceptance), components/public/policy-acceptance.tsx"
---

# Research: Last price, dear: stop haggling in DMs

## What the product actually does

The owner sets each service once on the Rate card (price, duration, deposit as a percentage of
the price) and groups services into packages, each with its own booking steps. Availability
holds weekly hours, buffers and blocked dates. The public booking link shows every service with
its price and only times that are really open. On the Pay & confirm step the client reads the
business's policy, ticks to accept it, pays the deposit by transfer to the business's own account
and uploads proof of payment. The owner looks at the proof and taps "Confirm booking" or "Reject
payment". Iker records this; it does not take, collect, process, hold or verify the money. No
commission on bookings or deposits.

## What we must not claim

- That Iker stops haggling, ends price questions or wins bookings. It puts the price where clients
  can see it.
- That Iker takes, collects, processes, holds or verifies payments (pf-060, pf-068, pf-150).
- "Free", "ever", or any plan price (pf-131).
- SMS or WhatsApp reminders or notifications (pf-151).
- That the chat in scenes 1 to 3 or the phone in the outcome scene is Iker. They are labelled
  illustrations.

## Needs research

- **₦15,000 deposit on ₦45,000.** The deposit is a whole-number percentage (pf-067). 15,000 is
  33.3% of 45,000, so the booking page cannot show exactly ₦15,000: 33% gives ₦14,850, 34% gives
  ₦15,300. The ₦15,000 figure is used only in the illustrated outcome scene, never in narration.
  Decide: change the illustrative deposit (for example ₦13,500 at 30%) or accept that product
  footage will show a different number.
- **Bridal makeup ₦45,000 in the demo data.** The local demo seed (`fixtures/iker-demo/seed.sql`)
  has one rate card item, "Soft glam makeup" at ₦50,000 with a 30% deposit. The product scenes
  will show those values until the seed gets a "Bridal makeup" item at ₦45,000.
- **Refund Policy is plan-gated** (pf-070, plan key `refund_policies`). The narration says "your
  policy" (pf-072). A business whose plan has no policies shows none. Decide whether the full
  cut should add "depending on your plan".
- **"Deposit paid ₦15,000, Chioma O."** in the outcome scene: no fact says Iker shows a
  notification like this. It stays an illustrated phone prop with an "Illustration" label and is
  not narrated.

## Open questions

- Labels on mock chats: the render pipeline adds a disclosure label only to synthetic
  recordings. The storyboard uses an "Illustration" lower third on every mock scene instead.
- The landscape cut adds one demo scene (`setup`: Rate card, packages, Availability) that is
  not in the brief's 8 scenes, so the requested footage has somewhere to appear.
