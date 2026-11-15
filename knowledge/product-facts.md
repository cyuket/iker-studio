# Iker product facts

Numbered, sourced statements about what Iker is and does, distilled from `../slot-books` on
2026-11-15. Read `README.md` in this folder for how to cite them.

Each fact has:

- an **id** (`pf-NNN`), stable once published;
- a **status**: _shipped_ (in the product today), _plan-gated_ (shipped, but whether a given business
  has it depends on its plan), _on request_ (shipped behind a flag the Iker team switches on),
  _specified_ (in the requirements, not confirmed in the UI: check before claiming) or
  _not shipped_ (planned or out of scope: never present as available);
- a **source** in slot-books. Paths are relative to `slot-books/`. `FCS` is
  `docs/FRONTEND_CURRENT_STATE.md`, `PRD` is `docs/Iker_PRD.md`, `EXEC` is `docs/EXECUTION_PLAN.md`,
  `features.ts` and `site.ts` are in `apps/web/lib/marketing/content/` (the live useiker.com copy).

UI labels are quoted exactly as the product shows them.

## What Iker is, and for whom

**pf-001** · shipped · Iker is booking, manual-payment tracking and bookkeeping software for Nigerian
service businesses such as salons, photographers and tutors.
Source: `PRODUCT.md` "Product Purpose"; `site.ts` `SITE.facts[0]`.

**pf-002** · context · The problem it answers: service businesses negotiate appointments over
WhatsApp, Instagram DMs and phone calls, track deposits and balances from memory or chat threads, and
keep income and expenses in notebooks or spreadsheets. The result is missed or double bookings, lost
income records and no clear view of monthly profit.
Source: `PRD` §1 Executive Summary, §2 Problem Statement.

**pf-003** · shipped · The marketing site has pages for twelve kinds of business: hair salons,
barbers, makeup artists, nail technicians, lash and brow artists, spas and massage therapists,
photographers, tutors, fitness trainers, aesthetics clinics, tattoo artists, and consultants and
coaches.
Source: `apps/web/lib/marketing/content/industries.ts` (`INDUSTRIES`).

**pf-004** · shipped · Iker is a responsive web app that works on mobile, tablet and desktop
browsers. Native iOS and Android apps are out of scope for v1.
Source: `PRD` §1, §12.3 "Out of Scope".

**pf-005** · shipped · Payments and bookkeeping run in Naira (₦) today. Other currencies are out of
scope for now.
Source: `site.ts` `SITE.facts[4]`; `PRD` §12.3.

**pf-006** · internal · Amounts are stored as whole kobo and shown in Naira. Viewer copy uses Naira
only (`₦45,000`).
Source: `CLAUDE.md` Non-Negotiable Rule 6.

**pf-007** · shipped · New accounts are set up with the Iker team: the site's "Get started" button
leads to the contact form, and the team sets up the business, its services and its booking page with
the owner.
Source: `apps/web/lib/marketing/links.ts` (`START_FREE_HREF = "/contact"`);
`apps/web/components/marketing/home/hero.tsx`; `apps/web/components/marketing/home/faq.tsx`
("How do I get started?").

## Roles and the financial-data wall

**pf-010** · shipped · Iker has four roles: Client, Business (owner and staff), Platform Admin and
Super Admin.
Source: `CLAUDE.md` "What Iker Is"; `PRD` §4.

**pf-011** · shipped · Clients book through the business's public link with no app to download and
no account to create.
Source: `site.ts` `SITE.facts[1]`; `FCS` §1.

**pf-012** · shipped · Platform Admins and Super Admins can manage a business account but cannot
read, write or infer that business's income, expenses, payments or statements. This is enforced in
the database (Postgres row-level security), not only hidden in the interface.
Source: `CLAUDE.md` "What Iker Is" and Rule 2; `PRODUCT.md` "Product Purpose"; `docs/SECURITY.md`
§2.3; home FAQ "Can Iker admins see my income?" in `apps/web/components/marketing/home/faq.tsx`.

**pf-013** · shipped · The admin view of a business shows activity counts (services, bookings,
confirmed, cancelled, upcoming, team) and no money figures.
Source: `FCS` §4 `/businesses/[id]`.

**pf-014** · shipped · Super Admin analytics are aggregates only. Payment activity is shown as counts
of businesses per activity band, never amounts, and is suppressed when a band has fewer than five
businesses.
Source: `FCS` §4 `/analytics`; `PRD` F11.2.

**pf-015** · shipped · An owner can invite managers and staff, each with their own login. Only the
owner can invite or remove people or cancel the plan. Today managers and staff can see the
business's bookings, payments and income.
Source: `features.ts` `staff-roles`; `EXEC` M2.4 ("Staff invites/roles is now done").

## Public booking page

**pf-020** · shipped · Each business has a public booking page at its own link, meant for an
Instagram bio or WhatsApp status. Clients pick a service and a time from the business's real
availability.
Source: `features.ts` `booking-page`; `FCS` §1 `/[businessSlug]`.

**pf-021** · shipped · The page lists each service with its name, price, category and duration, with
a category filter and a sort by price.
Source: `FCS` §1; `PRD` F2.1.

**pf-022** · shipped · The booking page is rendered on the server and kept light so it opens quickly
on mobile data. (The requirement is under 2 seconds on 3G; do not quote that as a measured result.)
Source: `CLAUDE.md` Rule 10; `features.ts` `booking-page`.

**pf-023** · shipped · The default booking flow has these steps: pick a slot; enter name, phone and
optional email; answer the business's own questions if it has a form; read and accept the policy;
then see the business's payment details and upload proof of payment. Proof is required before the
booking can be submitted.
Source: `FCS` §1 `/[businessSlug]/book/[serviceId]`.

**pf-024** · shipped · After booking, the client gets a status page showing the booking's status,
with a note that the proof of payment was received while it awaits confirmation, and the exact policy
text they accepted.
Source: `FCS` §1 `/[businessSlug]/booking/[token]`.

**pf-025** · specified · One booking can cover 1 to 10 people or service units back to back; duration,
price and deposit scale with the number. Check the live booking page before showing it.
Source: `PRD` F1.3, F5.1; `EXEC` M1.2.

## Bookings, walk-ins and the dashboard

**pf-030** · shipped · The sidebar item "Bookings" opens the calendar: a month grid and a sortable
table of bookings, filterable by status, service, client and date range.
Source: `apps/web/app/(dashboard)/layout.tsx` (nav label "Bookings" → `/calendar`); `FCS` §3
`/calendar`.

**pf-031** · shipped · A booking's status is one of: pending, awaiting confirmation, confirmed,
completed, cancelled with refund, cancelled with partial refund, cancelled with no refund.
Source: `FCS` §5 `BookingStatusBadge`.

**pf-032** · shipped · "Add walk-in" records a booking the client did not make through the link. It
takes the service, the time, the client's phone, name and email (a known phone number fills in the
rest) and the amount received, with a live preview of the balance.
Source: `FCS` §3 `/bookings/new`; `features.ts` `walk-ins`.

**pf-033** · shipped · Walk-ins and link bookings share one calendar. A walk-in takes the slot like any
other booking, and its payments count in the books.
Source: `features.ts` `walk-ins`.

**pf-034** · shipped · The dashboard has quick actions "Add walk-in", "Add service" and "Add expense",
monthly and all-time totals for bookings and income, a card with the booking link and a copy button,
and an "Awaiting confirmation" card listing bookings whose payment needs checking.
Source: `FCS` §3 `/dashboard`.

## Availability

**pf-040** · shipped · The Availability page has three parts: "Weekly hours", "Buffer & minimum
notice" and "Blocked dates".
Source: `FCS` §3 `/availability`; `PRD` F3.1-F3.3.

**pf-041** · shipped · Clients only see slots that are really open. Booked and blocked times never
appear as available.
Source: `PRD` F1.3; `features.ts` `availability`.

**pf-042** · shipped · Changing hours, buffers or prices only affects future availability. Bookings
already confirmed are never rewritten.
Source: `CLAUDE.md` Rule 9; `features.ts` `availability`.

## Services, packages and booking forms

**pf-050** · shipped · A service has a name, category, price, duration, description, a minimum
deposit percentage, included and excluded items, preparation notes and an image.
Source: `FCS` §3 `/services`.

**pf-051** · shipped · The sidebar calls the service list "Rate card".
Source: `apps/web/app/(dashboard)/layout.tsx` (nav label "Rate card" → `/services`).

**pf-052** · shipped · Services are grouped into packages. The booking flow is set up once per
package and every service in it uses that flow. Each service belongs to one package.
Source: `features.ts` `packages`; route `apps/web/app/(dashboard)/packages/[id]/workflow`.

**pf-053** · shipped · Services are archived, not deleted, so past bookings keep their service.
Source: `PRD` F1.1; `EXEC` M1.1.

**pf-054** · plan-gated · Custom booking forms add the business's own questions to the booking flow:
text, choice, file upload and read-only information blocks, each required or optional. Answers sit on
the booking and can be exported for a date range.
Source: `FCS` §3 `/forms`, `/forms/[id]`; `features.ts` `booking-forms` (plan key `custom_forms`);
`PRD` F13.

## Deposits and manual payment tracking

**pf-060** · shipped · Clients pay deposits by bank transfer straight to the business's own account,
then upload proof of payment. The business checks it and confirms. Iker never holds the money.
Source: `site.ts` `SITE.facts[2]`; home FAQ "How do clients pay their deposit?"; `features.ts`
`deposits`.

**pf-061** · shipped · Iker takes no commission on bookings or deposits.
Source: `site.ts` `NO_COMMISSION_FACT`; `CLAUDE.md` Rule 5; billing page copy in `FCS` §3
`/settings/billing`.

**pf-062** · shipped · Nothing counts as income until the business confirms the payment.
Source: `features.ts` `deposits` (tour step "You confirm every payment").

**pf-063** · shipped · On a booking, the Payments card shows "Booking price", "Paid so far", "Balance
remaining" and any amount "Awaiting your confirmation" or refunded, and lists every payment with its date,
method, status and proof. When a client's payment is waiting, the actions are "Confirm booking" and
"Reject payment".
Source: `FCS` §3 `/bookings/[id]`; `apps/web/app/(dashboard)/bookings/[id]/page.tsx`.

**pf-064** · shipped · "Record a payment" on a booking opens a dialog with "Amount received (₦)", a
"Pay off balance" shortcut, an optional discount with a reason, a proof field and "Save payment". It
shows the balance after the payment and refuses an amount larger than what is owed.
Source: `apps/web/app/(dashboard)/bookings/[id]/record-payment-dialog.tsx`; `FCS` §3 `/bookings/[id]`.

**pf-065** · shipped · Part payments are supported. Each payment is logged with its own date and time,
and the booking shows the balance remaining until it is paid off.
Source: `PRD` F5.2, F5.3; `EXEC` M1.5.

**pf-066** · shipped · Confirmed payments are permanent. A correction is recorded as a new adjustment
entry, so the history shows what happened.
Source: `site.ts` `SITE.facts[5]`; `CLAUDE.md` Rule 3.

**pf-067** · shipped · A deposit is set per service as a minimum percentage of the price. Deposits are
optional; a service can ask for none.
Source: `FCS` §1 (deposit/total split when `min_deposit_percent < 100`) and §3 `/services`;
`industries.ts` FAQ "If I take a deposit, how do clients pay it?".

**pf-068** · not shipped · Automatic collection of client deposits through a payment gateway is planned
for Phase 3. In v1 client deposits are manual only.
Source: `CLAUDE.md` Rule 7; `EXEC` Phase 3; `PRD` §12.3.

## Refund and cancellation policies

**pf-070** · plan-gated · Settings > Policies has three tabs: "Refund Policy", "Booking Terms" and
"Media Consent". Each can apply business-wide or to particular services.
Source: `FCS` §3 `/settings/policies`; `features.ts` `refunds-policies` (plan key `refund_policies`).

**pf-071** · shipped · Policies are versioned. Each booking keeps a copy of the policy text its client
agreed to, so changing the policy later never changes what a past booking shows.
Source: `CLAUDE.md` Rule 4; `FCS` §3 `/settings/policies` (on-screen copy about publishing a new
version); `features.ts` `refunds-policies`.

**pf-072** · shipped · Clients see the policy before the payment step and must tick to accept it.
Source: `FCS` §1 (Policy step); `PRD` F12.3.

**pf-073** · shipped · "Cancel booking" asks for a reason (Business, Client requested, No-show or
Other) and suggests a refund amount from the booking's own copy of the policy, which the business can
change.
Source: `FCS` §3 `/bookings/[id]`.

**pf-074** · shipped · A refund is recorded as a new entry linked to the original payment, never by
editing it, and is marked paid once the business has sent the money itself. Iker does not pay refunds
out automatically.
Source: `PRD` F12.4, §12.3; `features.ts` `refunds-policies`.

**pf-075** · specified · Clients are notified when a booking is cancelled and when the refund is
marked paid. The requirement says email or SMS; SMS is not shipped (pf-151), so say "notified" or
"emailed" only after checking.
Source: `PRD` F12.5; `EXEC` Phase 3.

## Sales and discounts

**pf-080** · plan-gated · "Sales & discounts" creates a promotion with its own link, a percentage off
each chosen service and an optional expiry date. Clients who book through the link get the discount,
and Iker records the discount in the books so profit stays right.
Source: `features.ts` `discounts` (plan key `sales`); `apps/web/app/(dashboard)/layout.tsx` (nav
label "Sales & discounts"); `PRD` §15.1 "Sales & Discounts".

## Accounting: income, expenses, statements and reports

**pf-090** · shipped · Under Accounting, the sidebar has "Report" and "Transactions".
Source: `apps/web/app/(dashboard)/layout.tsx`.

**pf-091** · shipped · The Income list shows each payment's date, client, service, method, status
("Confirmed", "Not counted yet" or a refund) and amount.
Source: `FCS` §3 `/accounting/income`.

**pf-092** · plan-gated · Expenses are recorded with an amount, date, description and category. A
receipt can be attached but is never required; expenses without one are flagged for the owner.
Source: `FCS` §3 `/accounting/expenses`; `PRD` F6.1-F6.3; `features.ts` `expenses` (plan key
`expense_entries` limits entries).

**pf-093** · shipped · Transactions combines payments, refunds and expenses into one list, newest
first.
Source: `FCS` §3 `/accounting/transactions`.

**pf-094** · shipped · The report for a month shows Income, Expenses and Profit-or-Loss, each compared
with the previous month, income not yet confirmed ("Not counted yet"), and where the money went by
expense category.
Source: `FCS` §3 `/accounting/reports`; `features.ts` `reports`.

**pf-095** · plan-gated · Reports cover a month, quarter or year and can be downloaded as PDF, Excel
or CSV. Which periods and exports a business gets depends on its plan.
Source: `features.ts` `reports` (plan key `report_export`); `EXEC` M2.2.

**pf-096** · plan-gated · Iker generates a statement of accounts for a period as a PDF. Once generated
it does not change, and past statements can be downloaded again.
Source: `EXEC` M2.2; `features.ts` `statements` (plan key `statement_periods`); route
`apps/web/app/(dashboard)/accounting/statements`; `PRD` F9.

**pf-097** · shipped · Income and expenses from before Iker can be imported from a CSV template, with
every row checked in a preview before anything is added.
Source: `features.ts` `import-export`; route `apps/web/app/(dashboard)/accounting/import`.

## Customers and campaigns

**pf-100** · shipped · Every client who books is added to the customer list with contact details,
number of visits and last booking date. Repeat clients are matched by phone or email.
Source: `EXEC` M2.3; `features.ts` `customers-email`; route `apps/web/app/(dashboard)/customers`.

**pf-101** · plan-gated · A business can email a promotion to its customers: everyone, people who
booked a service, people with at least a number of visits, or people who have not booked for a
number of days. It can send now or schedule. Clients who opt out are never emailed. Monthly send
allowances depend on the plan.
Source: `EXEC` M2.3 and its 2026-09-04 addendum; `features.ts` `customers-email` (plan key
`promotional_email`); route `apps/web/app/(dashboard)/customers/campaigns`.

## Staff and locations

**pf-110** · plan-gated · Settings > Staff is where the owner invites and removes team members. The
number of staff depends on the plan.
Source: `apps/web/app/(dashboard)/layout.tsx` (Settings > "Staff"); `features.ts` `staff-roles` (plan
key `staff`); `EXEC` M2.4.

**pf-111** · on request · Multiple locations: a business with several branches can add each one,
switch between them, and the owner can see all locations together. It is switched on by the Iker team
on request.
Source: `features.ts` `locations` (`flagOnly: true`); `EXEC` M2.4.

**pf-112** · not shipped · Multi-staff scheduling for larger businesses is planned for Phase 3.
Source: `EXEC` Phase 3; `PRD` §10 Phase 3.

## Google Calendar sync

**pf-120** · plan-gated · Settings > Calendar connects Google Calendar. Confirmed Iker bookings are
added to it, and events already on it block those times on the booking page. For other events Iker
keeps only the start time, end time and event ID. The business can disconnect at any time.
Source: `EXEC` M2.1 (complete 2026-09-03); `features.ts` `calendar-sync` (plan key
`google_calendar_sync`); `apps/web/app/(dashboard)/layout.tsx` (Settings > "Calendar").

**pf-121** · not shipped · Google Calendar is the only calendar integration. Outlook and iCal are not
supported.
Source: `PRD` §12.2.

## Subscription plans and billing

**pf-130** · shipped · Businesses pay Iker a flat subscription. The plans are Starter, Growth, Pro and
Team. Subscription billing runs through Paystack.
Source: `PRD` §11.2, §15.1; `CLAUDE.md` Tech Stack ("Payments (platform billing)").

**pf-131** · shipped · Prices are not to be quoted from documents. The live pricing page reads plans
from the database, so the prices in the PRD may be out of date. Say "a flat monthly plan in Naira".
Source: `apps/web/app/(marketing)/pricing/page.tsx` (`getPublicPlans`); pricing page description "A
flat monthly plan in Naira".

**pf-132** · shipped · New businesses get a 30-day Growth trial with no card. A failed renewal gets a
7-day grace period, then a soft move to Starter. Data is never deleted and the booking link stays
live.
Source: `PRD` §11.3, F14.2, F14.5, §15.1 ("30-day Growth trial, 7-day grace period ... are all live").

**pf-133** · shipped · The Billing page states: "Iker never takes a cut of your bookings or the
deposits your clients pay you." It is the only screen about money the business pays Iker, kept apart
from Accounting.
Source: `FCS` §3 `/settings/billing`.

**pf-134** · shipped · Which features a business has depends on its plan. The plan-gated features are
Google Calendar sync, expense entries, report export, statement periods, promotional email, refund
policies, custom forms, sales, staff and multiple locations. Viewer copy says "depends on your plan".
Source: `features.ts` (`planFeatureKey` on each feature).

## Referrals

**pf-140** · shipped · The sidebar item "Referrals" lets a business refer another business with its
own link ("Refer a business"), see the businesses it referred and their progress, and see its
rewards. Reward rules are set by Iker and can change; do not state a reward amount.
Source: `apps/web/app/(dashboard)/my-referrals/page.tsx`; `docs/DATABASE_SCHEMA.md` "Referral & reward
system"; `docs/SECURITY.md` §2.7.

## Not shipped: never present as available

**pf-150** · not shipped · Automatic collection of client deposits through a gateway (see pf-068).
Source: `EXEC` Phase 3.

**pf-151** · not shipped · SMS and WhatsApp reminders and confirmations.
Source: `EXEC` Phase 3; `PRD` §10 Phase 3.

**pf-152** · not shipped · Client self-service cancelling or rescheduling. Clients ask the business,
who changes the booking.
Source: `PRD` §12.3.

**pf-153** · not shipped · In-app chat between client and business; native mobile apps; currencies
other than Naira; usage-based or per-booking pricing.
Source: `PRD` §12.3; `EXEC` Phase 3.

## What things are called

Use the product's words. Left column is what to say on screen and in narration.

| Say                                                                  | Where it appears                                   | Not                                             |
| -------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| booking link, booking page                                           | Dashboard booking-link card; marketing             | storefront, portal, website builder             |
| Bookings                                                             | Sidebar (opens the calendar)                       | appointments module, scheduler                  |
| Add walk-in                                                          | Dashboard, Bookings, Income                        | manual booking, offline booking                 |
| Rate card                                                            | Sidebar (the services list)                        | catalogue, menu (unless quoting a client)       |
| package                                                              | Packages and booking flows                         | bundle, category                                |
| Availability: Weekly hours, Buffer & minimum notice, Blocked dates   | Availability page                                  | schedule settings                               |
| proof of payment                                                     | Public booking flow; booking detail ("View proof") | receipt (that is for expenses), screenshot      |
| Confirm booking, Reject payment                                      | Booking detail                                     | approve, verify                                 |
| Record a payment, Amount received (₦), Pay off balance, Save payment | Booking detail dialog                              | log payment, mark paid                          |
| Paid so far, Balance remaining                                       | Booking detail Payments card                       | outstanding amount, debt                        |
| Awaiting confirmation                                                | Dashboard card; payment and booking status         | pending review, unverified                      |
| Refund Policy, Booking Terms, Media Consent                          | Settings > Policies                                | T&Cs                                            |
| Sales & discounts                                                    | Sidebar                                            | coupons, vouchers                               |
| Report, Transactions                                                 | Sidebar under Accounting                           | analytics, dashboard                            |
| statement of accounts                                                | Accounting                                         | bank statement, audited accounts                |
| Customers, campaigns                                                 | Sidebar; Customers > Campaigns                     | CRM (fine in a document, plain words on screen) |
| Staff, Locations, Calendar, Policies, Billing                        | Settings                                           | team settings, integrations                     |
| Referrals, Refer a business                                          | Sidebar                                            | affiliate programme                             |

Wording rules that follow from the facts above:

- Iker **records and tracks** payments; it does not **take**, **collect**, **process** or **hold**
  them (pf-060, pf-068). The business confirms; Iker does not verify transfers.
- "No commission" is a fact (pf-061). "Free" is not a blanket fact: say what is free only if a
  current source says so, and never quote plan prices (pf-131).
- Plan-gated features are real but not universal: add "depending on your plan" when the video
  implies every business has them (pf-134).
- Admins cannot see a business's money (pf-012). Do not soften this to "we respect your privacy",
  and do not stretch it to "nobody at Iker can ever see anything".
- Example people, businesses and amounts on screen must be clearly fictional, and amounts must be
  written as `₦45,000`.
