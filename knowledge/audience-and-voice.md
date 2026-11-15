# Audiences and voice

Who Iker videos are for, what they are struggling with, and how Iker sounds. Distilled from
`../slot-books` and the Iker brand kit on 2026-11-15. Product claims still need a fact from
`product-facts.md`; this file is about framing and tone.

## Audiences

### Primary: owners of Nigerian service businesses

People who sell their time by appointment: hair salons, barbers, makeup artists, nail technicians,
lash and brow artists, spas and massage therapists, photographers, tutors, fitness trainers,
aesthetics clinics, tattoo artists, consultants and coaches (`product-facts.md` pf-003).

- Many are solo or have a small team. They run the business from a phone, on average mobile
  connections, between clients. (`PRODUCT.md` "Users"; `docs/Iker_PRD.md` §5, §12.1.)
- They are trusting Iker with their income records, so they need to believe the numbers.
  (`PRODUCT.md` "Users".)
- They are price-sensitive. (`docs/Iker_PRD.md` §12.1.)

The PRD persona is **Amaka**, a solo makeup artist in Abuja who books 15 to 20 clients a month across
Instagram DMs and WhatsApp and keeps a paper notebook for product expenses. In her words: "I lose
track of who has paid a deposit and who has not. It is all buried in my WhatsApp chats."
(`docs/Iker_PRD.md` §5. Amaka is a persona, not a customer; never present her as a real person or
her numbers as data.)

### Secondary: their staff

Managers and staff who take bookings, add walk-ins and confirm payments during the day (pf-015).
Tutorials are often for them.

### Context, not the target: clients

The person booking (the PRD persona **Tunde**) wants to see when the business is free, book without
waiting for a reply, and know exactly what to pay upfront and that it was received
(`docs/Iker_PRD.md` §5). Videos are for businesses; show the client's side only to explain what the
business's clients experience.

### Not the audience

Fintech, compliance or fraud teams; developers; accountants as buyers. The marketing site describes
no developer-facing product (`docs/API_CONTRACT.md` covers Iker's own internal endpoints), so do not
write developer or "for engineers" scenes for Iker.

## Pains, in their words

From the marketing site's industry pages (`apps/web/lib/marketing/content/industries.ts`, `pains`)
and the PRD (§2, §5). Use these as hooks; they are the business owner's situation, not statistics.

- Answering "are you free on Saturday?" in WhatsApp and Instagram DMs all day.
- Deposits and balances tracked from memory, screenshots and chat threads: not knowing who has paid
  and who still owes.
- Dates held for clients who never pay; no-shows with no deposit.
- Walk-ins and bookings clashing on paper; double-booking.
- Disputes about what the refund policy said.
- Forgetting to record a cash payment from a walk-in.
- Product, travel and equipment costs not recorded; no clear view of what the month really made.
- Struggling to show income for a loan; income spread across different accounts.
- Tutors chasing parents for lesson fees.

Do not attach numbers to any pain ("most salons lose ...") unless a sourced fact states them.

## Brand voice

Iker is **trustworthy, calm and efficient**. It is a bookkeeping and money tool, so it sounds sober
and competent, not flashy. Confidence comes from clarity and restraint, not decoration.
(`PRODUCT.md` "Brand Personality".)

- **Plain and specific.** Name the screen, the button, the amount. "Tap Confirm booking" beats
  "verify the transaction".
- **Calm, not urgent.** No countdowns, no "don't miss out", no exclamation marks.
- **Honest about limits.** Say what Iker does not do when it matters (it does not collect or hold
  money, it does not send SMS reminders yet).
- **The owner is in charge.** Iker records and keeps things in order; the business confirms, decides
  and gets paid directly.
- **Short sentences, spoken English.** Write for the ear: one idea per sentence.
- **Nigerian context without caricature.** WhatsApp, Instagram, bank transfers and Naira are normal
  details, not jokes or slang.

Visual restraint matches the voice: a dark or warm-canvas ground, terracotta (`#E05A38`) as the one
accent, used for one line or one shape (`brand/brand.json`; brand kit `05-social/README.md` "Making
new posts").

### Lines Iker already uses

Quote these as they are. They are the brand's own words.

| Line                                                                                    | Where                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| "Get booked. Get paid."                                                                 | Brand tagline; brand kit Instagram featured post; `brand/brand.json`           |
| "Stop chasing payments in DMs."                                                         | Brand kit Instagram featured post (`05-social/README.md`)                      |
| "The calm way to run a booked-out business."                                            | useiker.com home page headline (`components/marketing/home/hero.tsx`)          |
| "Clients book and pay deposits from one link. Your schedule and books keep themselves." | useiker.com home page subline                                                  |
| "Bookings, deposits and bookkeeping for service businesses."                            | Site tagline (`lib/marketing/content/site.ts`)                                 |
| "Spend the day on your clients, not on your admin."                                     | useiker.com closing call to action (`components/marketing/home/final-cta.tsx`) |
| "Iker takes no commission on bookings or deposits."                                     | `site.ts` `NO_COMMISSION_FACT`                                                 |
| "Your books stay yours."                                                                | Home page principles (`components/marketing/home/principles.tsx`)              |

## Words to use and to avoid

| Use                                                         | Avoid                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| booking link, booking page                                  | storefront, platform (for the client side), marketplace             |
| deposit, balance, proof of payment                          | escrow, wallet, payment processing, "we collect", "secure payments" |
| confirm, record, track                                      | verify, approve, KYC, compliance, fraud                             |
| your books, income, expenses, profit, statement of accounts | ledger (fine in documents, stiff on screen), audited, tax-ready     |
| no commission                                               | "free" (unless a current source says what is free), "cheap"         |
| depending on your plan                                      | any price or plan limit not on the live pricing page                |
| walk-in                                                     | offline customer                                                    |
| clients (of the business), customers (in the customer list) | users (for clients), leads                                          |
| ₦45,000                                                     | N45,000, NGN 45000, 45k                                             |

Never use: the studio's banned phrases (`src/domain/script.ts`, `BANNED_PHRASES`), "guarantee",
"eliminate no-shows", "zero no-shows", "never chase a payment again", "AI-powered", or em dashes in
anything a viewer reads or hears.

## Call to action

The real call to action on useiker.com (read 2026-11-15):

- **Primary: "Get started"**, which opens the contact form at `useiker.com/contact`. Accounts are
  opened by the Iker team, who set up the business, its services and its booking page with the
  owner. (`apps/web/lib/marketing/links.ts` `START_FREE_HREF = "/contact"`; `hero.tsx`;
  `final-cta.tsx`.)
- **Secondary: "Book a demo"**, which opens a booking calendar for a demo call. (`links.ts`
  `DEMO_HREF`; `final-cta.tsx`; pricing page.)
- Supporting line under the primary button: "The Iker team sets up your booking page with you. No
  commission on deposits." (`hero.tsx`.)

In a storyboard `cta` visual, use `"action": "Get started"` and `"url": "useiker.com"`. Do not say
"Start free", "Sign up free" or "Download the app": the site offers none of these.

For a tutorial aimed at existing customers, a softer next step is fine ("Open Bookings and try it on
your next walk-in"), but the cut still needs a CTA scene.
