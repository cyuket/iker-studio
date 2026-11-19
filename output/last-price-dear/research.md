---
# Verified facts the script may rely on. Each needs a source someone else can check.
facts:
  - id: chat-problem
    statement: "Service businesses negotiate appointments over WhatsApp, Instagram DMs and phone calls, and keep their records in chats, memory and notebooks."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement (read 2026-11-20)"
  - id: rate-card
    statement: 'In the business dashboard, the sidebar calls the list of services "Rate card".'
    source: "knowledge/product-facts.md pf-051; slot-books apps/web/app/(dashboard)/layout.tsx (nav label \"Rate card\" -> /services)"
  - id: service-fields
    statement: "A service has a name, category, price, duration, description, a minimum deposit percentage, included and excluded items, preparation notes and an image."
    source: "knowledge/product-facts.md pf-050; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /services"
  - id: booking-page-link
    statement: "Each business has a public booking page at its own link, meant for an Instagram bio or WhatsApp status. Clients pick a service and a time from the business's real availability."
    source: "knowledge/product-facts.md pf-020; slot-books apps/web/lib/marketing/content/features.ts (booking-page); docs/FRONTEND_CURRENT_STATE.md §1 /[businessSlug]"
  - id: price-listing
    statement: 'The public booking page lists each service with its name, price, category and duration, with a category filter and a "Sort by price" option.'
    source: "knowledge/product-facts.md pf-021; slot-books docs/FRONTEND_CURRENT_STATE.md §1 (lines 26-29, read 2026-11-20)"
  - id: real-slots
    statement: "Clients only see slots that are really open. Booked and blocked times never appear as available."
    source: "knowledge/product-facts.md pf-041; slot-books apps/web/lib/marketing/content/features.ts (availability)"
  - id: deposit-percent
    statement: "A deposit is set per service as a minimum percentage of the price, and the booking flow shows the deposit and total split when a deposit applies. Deposits are optional."
    source: "knowledge/product-facts.md pf-067; slot-books docs/FRONTEND_CURRENT_STATE.md §1 (slot step sticky header, deposit/total split when min_deposit_percent < 100)"
  - id: bank-transfer-direct
    statement: "Clients pay deposits by bank transfer straight to the business's own account, then upload proof of payment. The business checks it and confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts); apps/web/components/marketing/home/faq.tsx"
  - id: sales-discounts
    statement: 'Plan-gated: "Sales & discounts" creates a promotion with its own link and a percentage off each chosen service, with an optional expiry. Only people with the link get the offer, and Iker records the discount in the books.'
    source: "knowledge/product-facts.md pf-080; slot-books apps/web/lib/marketing/content/features.ts (slug \"discounts\", plan key sales, read 2026-11-20)"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the business, its services and its booking page with the owner.'
    source: "knowledge/product-facts.md pf-007; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: Last price, dear: stop haggling in DMs

## What the product actually does

The business keeps its prices on the Rate card: each service with its price, duration and what is
included and excluded. The public booking link shows every service with its price (filter by
category, sort by price) and only times that are really open. If the service takes a deposit, it
is a percentage of the price and the client sees the deposit and total while booking, pays by
transfer to the business and uploads proof of payment. Depending on the plan, Sales & discounts
makes a promotion link with a percentage off chosen services, recorded in the books.

## What we must not claim

- That Iker stops haggling, ends price questions or brings more bookings. It puts the price in
  front of the client; what clients do is theirs.
- That Iker collects, processes or holds payments, or checks transfers (pf-060, pf-068).
- That every business has Sales & discounts. It is plan-gated: say "depending on your plan".
- Any Iker plan price, or that Iker is free.
- The ₦45,000 bridal makeup quote is an illustrative example, not a price anyone charges.

## Open questions

- The "Last price, dear?" framing is a common Nigerian DM exchange, used as an illustrative
  hook, not a sourced statistic. The owner should confirm the tone is right for the audience.
- Demo footage needs a seeded business whose Rate card has a deposit service and, for the
  discount scene, a plan with Sales & discounts switched on.
