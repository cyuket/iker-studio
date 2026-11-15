> **Copied from** `../slot-books/PRODUCT.md` (the Iker product repository, read-only source of truth) on 2026-11-15.
> This is a snapshot for offline reference. If it disagrees with slot-books, slot-books wins. Do not edit this copy; re-copy it instead.

# Product

## Register

product

## Users

Four roles: Client (mostly unauthenticated, booking via public link), Business owner/staff
(logs in daily to manage bookings, payments, bookkeeping), Platform Admin, and Super Admin
(manage business accounts but are walled off from financial data). Business users are Nigerian
service-business owners (salons, photographers, tutors) who need the app to work reliably on
average connections and who are trusting it with their income records.

## Product Purpose

Booking, manual-payment tracking, and bookkeeping for Nigerian service businesses. Success
looks like a Business owner trusting the app enough to record every payment in it, and Admins
being able to manage accounts without ever seeing financial data (enforced at the DB layer via
RLS, not just UI).

## Brand Personality

Trustworthy, calm, efficient. This is a bookkeeping/financial tool — sober and competent, not
flashy. No unnecessary flourish; confidence comes from clarity and restraint, not decoration.

## Anti-references

Avoid the generic SaaS auth-screen look: no purple/blue gradients, no floating glassmorphism
card, no default shadcn-template-card-on-gray-background feel. Nothing that reads as an
unstyled scaffold either — spacing, hierarchy, and alignment should feel deliberate.

## Design Principles

- Clarity over decoration — this handles people's income records, so the UI should read as
  careful and precise, not playful.
- Fast on average connections — public/auth surfaces render quickly, minimal client JS.
- The role boundary is felt in the UI too — Admin-facing screens should never imply access to
  financial data, even visually.
- Restraint signals competence — one deliberate accent color, not a palette of them.

## Accessibility & Inclusion

No explicit WCAG level specified yet; default to WCAG 2.1 AA (sufficient contrast, visible
focus states, keyboard-navigable forms, labeled inputs) given this is a financial tool used by
small-business owners, not just technical users.
