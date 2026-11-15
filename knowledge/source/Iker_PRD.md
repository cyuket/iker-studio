> **Copied from** `../slot-books/docs/Iker_PRD.md` (the Iker product repository, read-only source of truth) on 2026-11-15.
> This is a snapshot for offline reference. If it disagrees with slot-books, slot-books wins. Do not edit this copy; re-copy it instead.

# Iker

### Booking, Payments & Bookkeeping for Service Businesses

_(working title -- name pending trademark/domain check)_

**PRODUCT REQUIREMENTS DOCUMENT**
Prepared for: Cyril Uket
Version 1.0 | August 4, 2026 | Status: Draft for Review

---

## Document Control

| **Version** | **Date**     | **Author**                       | **Summary of Changes**                                                                                                                                                                                                 |
| ----------- | ------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0         | Aug 4, 2026  | Cyril Uket (drafted with Claude) | Initial draft for internal review and scoping.                                                                                                                                                                         |
| 1.1         | Aug 29, 2026 | Cyril Uket (drafted with Claude) | Added [§15 Implementation Status](#15-implementation-status), reflecting what has actually been built against the Phase 1/2 plan in [EXECUTION_PLAN.md](EXECUTION_PLAN.md); no functional-requirement wording changed. |

This PRD is a working draft intended to align product scope, user experience, and technical direction before design and engineering begin. Feature names, the product name, and phase boundaries are open to revision as validation happens.

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Problem Statement](#2-problem-statement)
- [3. Goals & Success Metrics](#3-goals-success-metrics)
- [4. User Roles Overview](#4-user-roles-overview)
- [5. User Personas](#5-user-personas)
- [6. User Journeys and Flows](#6-user-journeys-and-flows)
- [7. Functional Requirements](#7-functional-requirements)
- [8. Non-Functional Requirements](#8-non-functional-requirements)
- [9. Information Architecture -- Core Data Entities](#9-information-architecture----core-data-entities)
- [10. Release Plan / Phasing](#10-release-plan-phasing)
- [11. Pricing & Subscription Plans](#11-pricing-subscription-plans)
- [12. Assumptions, Constraints, and Out of Scope](#12-assumptions-constraints-and-out-of-scope)
- [13. Risks](#13-risks)
- [14. Glossary](#14-glossary)
- [15. Implementation Status](#15-implementation-status)

## 1. Executive Summary

Service-based small businesses -- salons, spas, photographers, tailors, personal trainers, tutors, consultants, home-service providers -- largely run their day-to-day operations across WhatsApp, Instagram DMs, and phone calls, and keep their financial records in notebooks or scattered spreadsheets. This creates missed bookings, double-bookings, lost income records, and no reliable picture of business health.

Iker is a mobile, tablet, and desktop web application that gives these businesses a single place to: publish a bookable calendar, take manual deposits with proof-of-payment, log walk-in income, record expenses with receipts, and generate clean financial statements -- without needing an accountant or a developer.

This document defines the product scope, the four user roles (Client, Business, Platform Admin, Super Admin), the core user journeys, and the functional and non-functional requirements for a first shippable version, followed by a phased roadmap.

## 2. Problem Statement

Small service businesses currently juggle three disconnected, manual processes:

- Booking: appointments are negotiated one-on-one over chat or calls, with no shared view of real availability -- leading to double-bookings and back-and-forth messaging.

- Payments: deposits and balances are tracked from memory or in chat threads, with no single source of truth for who has paid what.

- Accounting: income and expenses are recorded (if at all) in notebooks or ad-hoc spreadsheets, making it hard to know monthly profit, plan for tax, or make informed decisions.

The result is lost revenue (missed or double-booked slots), lost time (manual reconciliation and repetitive replies), and an inability to see business performance clearly enough to grow it.

## 3. Goals & Success Metrics

### 3.1 Product Goals

- Let any service business publish a shareable booking link within 15 minutes of signing up.

- Replace notebook-based income/expense tracking with structured digital records, including receipt capture.

- Give business owners a monthly, quarterly, and yearly financial picture without manual spreadsheet work.

- Support the informal-payment reality of the market (manual proof-of-payment) without blocking the business from operating today.

- Price the product so cost is never the reason a business can't start: a genuinely usable free tier, flat Naira pricing, and no commission or transaction fee on the bookings and deposits businesses collect.

### 3.2 Success Metrics (first 2 quarters post-launch)

| **Metric**                                                 | **Target**                                  |
| ---------------------------------------------------------- | ------------------------------------------- |
| Businesses onboarded (Abuja pilot)                         | **150+ active businesses in first 90 days** |
| Bookings made through shareable links per business / month | **20+ average**                             |
| Percent of bookings with a recorded deposit proof          | **70%+**                                    |
| Businesses with at least 1 expense logged per week         | **60%+**                                    |
| Businesses generating a monthly statement                  | **50%+ of active businesses**               |
| 30-day retention (business logs in / takes an action)      | **45%+**                                    |

## 4. User Roles Overview

Iker has four roles. Permissions are strictly scoped -- critically, platform-level roles can manage business accounts but can never touch a business's financial records.

| **Role**                   | **Who they are**                                                  | **Key permissions**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Client / Customer**      | The end customer booking a service from a business's public link. | • Browse services, prices, categories<br>• Book an available slot<br>• See the business's account/balance info shown to clients<br>• View the business's refund and cancellation policy before paying<br>• Upload proof of deposit payment<br>• Fill out any custom fields the business requires (e.g., home address for on-site services)<br>• View own booking history and status                                                                                                                                                                                            |
| **Business (Owner/Staff)** | The service provider using Iker to run their business day-to-day. | • Set availability and manage calendar<br>• Configure services, prices, categories<br>• Build custom booking forms per service (extra fields or info blocks, e.g., client address or studio location)<br>• Record walk-in bookings and payments<br>• Log income and expenses, upload receipts<br>• Cancel bookings and issue refunds against a configured refund policy<br>• View reports and generate statements<br>• Manage own customer list and send promotions<br>• Sync bookings to Google Calendar<br>• View, upgrade, downgrade, or cancel their own subscription plan |
| **Platform Admin**         | Internal Iker staff who onboard and support businesses.           | • Onboard new businesses (create business accounts)<br>• Verify, activate, or suspend a business account<br>• View business account status and support tickets<br>• View a business's subscription plan and billing status to assist with support<br>• Apply promotional discount codes during onboarding<br>• Cannot view or edit a business's income, expenses, or statements                                                                                                                                                                                                |
| **Super Admin**            | Platform owner/operator with full system oversight.               | • Everything a Platform Admin can do, plus: manage Platform Admin accounts<br>• Configure platform-wide settings<br>• Configure subscription plan tiers, pricing, and discount codes<br>• View platform-level analytics (business counts, growth, uptime, plan mix)<br>• Explicitly cannot add, edit, or view a business's income or expenditure records                                                                                                                                                                                                                       |

_This constraint -- Super Admin manages businesses but never touches business financial data -- is a deliberate trust boundary and should be enforced at the data-access layer, not just the UI. A business's own subscription and billing status (which plan they're on, when it renews) is platform administrative data, not client-facing financial data, so Platform Admins and Super Admins can see and manage it -- but this never extends to what a business earns from its own clients._

## 5. User Personas

### Amaka -- Business Owner (Makeup Artist, Abuja)

_"I lose track of who has paid a deposit and who has not -- it is all buried in my WhatsApp chats."_

Amaka runs a solo makeup business, books 15-20 clients a month across Instagram DMs and WhatsApp, and keeps a paper notebook for expenses on products.

#### Goals

- Stop double-booking herself

- Know instantly who has paid and who owes a balance

- See at month-end whether she actually made a profit

#### Frustrations today

- Manually replying to 'are you free on Saturday' messages all day

- Forgetting to record a cash payment from a walk-in client

- No idea what her real monthly profit is after product costs

### Tunde -- Client / Customer

_"I just want to see when they are free and book it -- I do not want to wait for a WhatsApp reply."_

Tunde wants to book a haircut. He is used to Instagram bios with a phone number and long response times.

#### Goals

- Book a convenient slot without back-and-forth chatting

- Know exactly how much to pay upfront and see it confirmed

- Get a reminder before the appointment

#### Frustrations today

- Waiting hours for a reply to a simple availability question

- Uncertainty over whether his deposit was received

### Ifeoma -- Platform Admin

_"My job is to get businesses set up fast and keep the platform trustworthy -- not to see their money."_

Ifeoma works for the Iker team, onboarding new businesses in Abuja during the pilot and providing first-line support.

#### Goals

- Onboard a verified business in under 10 minutes

- Quickly see which businesses are active vs. inactive

- Escalate issues without needing access to business financials

#### Frustrations today

- No current tooling to onboard and track business accounts in one place

### Femi -- Super Admin

_"I need to see how the platform is growing without being able to touch any single business's books -- that is their data, not mine."_

Femi is a Iker co-founder responsible for platform health, admin management, and growth reporting.

#### Goals

- See platform-wide growth and health metrics

- Manage Platform Admin accounts and permissions

- Trust that the platform enforces role boundaries by design

#### Frustrations today

- No centralized view of business onboarding funnel or platform health today

## 6. User Journeys and Flows

Each journey below shows the flow at a glance, then the step-by-step detail: what the user does, and what the system does in response.

### 6.1 Client Journey -- Booking an Appointment and Paying a Deposit

**Open link → Pick service → Pick time → Fill form → Review policy → Pay deposit → Confirmed**

| **Step** | **What the user does**                                                                                                                                  | **What the system does / shows**                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**    | Taps the business's shared booking link (from Instagram bio, WhatsApp status, etc.)                                                                     | Loads the public booking page: business name, logo, service categories and prices, and available balance/info the business chooses to show.                                                                                                      |
| **2**    | Browses services by category or price and selects one                                                                                                   | Displays live availability pulled from the business's calendar and Google Calendar sync -- no double-booked slots shown.                                                                                                                         |
| **3**    | Picks an open date and time slot                                                                                                                        | Holds the slot temporarily and shows a booking summary: service, price, deposit required, business policies.                                                                                                                                     |
| **4**    | Enters name, phone number, and email, and fills out any custom fields the business has added for this service (e.g., home address for an on-site visit) | Renders the business's custom booking form alongside the default fields; blocks submission until required custom fields are completed.                                                                                                           |
| **5**    | Reviews the business's cancellation and refund policy, shown before payment instructions                                                                | Displays the policy text set by the business (e.g., full refund if cancelled by the business, partial refund if cancelled by the client with less than 24 hours' notice) and creates a Pending booking that snapshots this exact policy version. |
| **6**    | Makes the transfer/payment outside the app, then uploads a screenshot or photo as proof of payment                                                      | Attaches the proof to the booking and sets status to Awaiting Confirmation; notifies the business.                                                                                                                                               |
| **7**    | Waits for confirmation                                                                                                                                  | Business reviews the proof and confirms; client receives confirmation (and later, a reminder) via email/SMS. Booking status becomes Confirmed.                                                                                                   |

### 6.2 Business Journey -- Setting Up Availability (Calendly-style)

**Add services → Set hours → Set buffers → Connect Google Cal → Publish link**

| **Step** | **What the user does**                                                                      | **What the system does / shows**                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | Creates services with name, category, price, and duration                                   | Saves each service to the business's service catalogue, used to populate the public booking page.                                            |
| **2**    | Sets weekly working hours and days off per staff member (or for the whole business if solo) | Builds the base availability grid used to compute open slots.                                                                                |
| **3**    | Optionally sets buffer time between appointments and how far in advance clients can book    | Applies these rules when computing which slots appear as bookable.                                                                           |
| **4**    | Connects their Google account                                                               | Two-way syncs: bookings made in Iker appear on Google Calendar, and events already on Google Calendar block those slots from being bookable. |
| **5**    | Copies and shares the public booking link                                                   | Link is live immediately; the business can preview exactly what clients will see.                                                            |

### 6.3 Business Journey -- Recording a Walk-in Customer

**Add walk-in → Pick service → Record payment → Save → Income logged**

| **Step** | **What the user does**                                                                             | **What the system does / shows**                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | Taps 'Add Walk-in / Manual Booking' from the dashboard                                             | Opens a quick-entry form (no client link needed).                                                                                                     |
| **2**    | Selects the service performed, quantity (1–10), and enters or picks the customer (new or existing) | Each unit reserves one service duration consecutively and multiplies the appointment price; customer is added to the business's customer list if new. |
| **3**    | Records the payment: full payment, or partial deposit with balance due later                       | Creates an Income record tied to this booking, and flags it Partially Paid if a balance remains.                                                      |
| **4**    | Saves the entry                                                                                    | Booking appears on the calendar (marked as walk-in) and the income appears in that day's/month's records.                                             |
| **5**    | (Later) returns to update the record once the customer completes payment                           | Updates the booking to Fully Paid and logs the additional income with its own timestamp, preserving an audit trail of both payments.                  |

### 6.4 Business Journey -- Recording an Expense

**Add expense → Enter details → Attach receipt → Categorize → Saved to ledger**

| **Step** | **What the user does**                                                               | **What the system does / shows**                                                        |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **1**    | Taps 'Add Expense' from the dashboard or the Accounting tab                          | Opens the expense entry form.                                                           |
| **2**    | Enters amount, date incurred, and a short description                                | Validates required fields (amount and date are mandatory).                              |
| **3**    | Optionally photographs or uploads a receipt                                          | Attaches the file to the expense record for future reference or dispute resolution.     |
| **4**    | Selects a category (e.g., Supplies, Rent, Transport, Marketing) or creates a new one | Tags the expense for reporting and category-level breakdowns.                           |
| **5**    | Saves the expense                                                                    | Adds it to the expense ledger; immediately reflected in that period's profit/loss view. |

### 6.5 Business Journey -- Reviewing Monthly/Quarterly/Yearly Performance

**Open Reports → Pick period → View summary → Drill into detail → Export/share**

| **Step** | **What the user does**                                                                  | **What the system does / shows**                                                          |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **1**    | Opens the Reports tab                                                                   | Loads a default view (current month) with total income, total expenses, and net profit.   |
| **2**    | Switches the period to monthly, quarterly, or yearly                                    | Recalculates totals and trend charts for the selected period.                             |
| **3**    | Reviews the summary: income by service/category, expenses by category, net profit trend | Renders clean charts and a plain-language summary (e.g., 'Income up 12% vs. last month'). |
| **4**    | Taps into any line item to see the underlying bookings or expenses                      | Shows the detailed transaction list behind that number.                                   |
| **5**    | Generates a statement of account for the period                                         | Produces a shareable PDF statement (see Section 6.7).                                     |

### 6.6 Platform Admin Journey -- Onboarding a New Business

**Receive request → Create account → Verify details → Activate → Handoff email**

| **Step** | **What the user does**                                                                      | **What the system does / shows**                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**    | Receives a new business signup or onboarding request                                        | Shows the request in the Platform Admin's onboarding queue.                                                                                                        |
| **2**    | Creates the business account with basic details: business name, category, contact, location | Provisions a new Business workspace with a default (empty) calendar and settings.                                                                                  |
| **3**    | Reviews any submitted verification info (e.g., ID, business name)                           | Flags missing or inconsistent info for follow-up before activation.                                                                                                |
| **4**    | Activates the account                                                                       | Business owner receives an activation/welcome email with login instructions. The Platform Admin has no visibility into this business's future income/expense data. |
| **5**    | Sends a handoff/welcome email with a short setup guide                                      | Logs the onboarding as complete in the admin dashboard.                                                                                                            |

### 6.7 Business Journey -- Generating a Monthly Statement of Account

**Open Statements → Select month → Generate → Review → Download/Share**

| **Step** | **What the user does**                          | **What the system does / shows**                                                                                         |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **1**    | Opens the Statements section under Accounting   | Shows a list of past statements and an option to generate a new one.                                                     |
| **2**    | Selects the month (or custom range) to generate | Pulls all confirmed income and expense records for that range.                                                           |
| **3**    | Taps Generate                                   | Compiles a formatted statement: opening balance, total income, total expenses, closing balance, and category breakdowns. |
| **4**    | Reviews the statement on screen                 | Displays a clean, print-ready preview.                                                                                   |
| **5**    | Downloads as PDF or shares directly             | Produces a PDF the business can send to an accountant, a landlord, or use for a loan application.                        |

### 6.8 Business Journey -- Sending a Promotional Email to Customers

**Open Customers → Select audience → Write message → Preview → Send**

| **Step** | **What the user does**                                                                             | **What the system does / shows**                                                                    |
| -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **1**    | Opens the Customers tab (auto-built from booking history)                                          | Lists all customers with contact info, visit count, and last visit date.                            |
| **2**    | Selects all customers or filters a segment (e.g., customers who booked a specific service)         | Builds the recipient list from the filter.                                                          |
| **3**    | Writes or picks a promotional message/template (e.g., a discount code or new service announcement) | Renders a live preview of the email.                                                                |
| **4**    | Previews on desktop/mobile layout                                                                  | Shows exactly what recipients will see.                                                             |
| **5**    | Sends                                                                                              | Queues and sends the email only to this business's own customers -- never shared across businesses. |

### 6.9 Business Journey -- Cancelling a Booking and Issuing a Refund

**Open booking → Cancel → Choose refund → Confirm amount → Client notified**

| **Step** | **What the user does**                                                                                                                                 | **What the system does / shows**                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | Opens a Pending or Confirmed booking from the calendar or booking list                                                                                 | Shows the booking detail, including service, client, and payment/deposit status.                                                                                                                                                      |
| **2**    | Taps 'Cancel Booking' and enters a reason (e.g., business unavailable, client requested, no-show)                                                      | Prompts for the cancellation reason and reopens the question of whether a refund applies.                                                                                                                                             |
| **3**    | Reviews the refund suggested by the business's configured refund policy (full, partial, or none, based on who cancelled and how much notice was given) | Auto-calculates a suggested refund amount from the policy snapshot attached to this booking, but leaves it editable by the business.                                                                                                  |
| **4**    | Confirms the final refund amount and marks it as paid once the transfer back to the client is made, optionally attaching proof of the refund           | Updates the booking to Cancelled -- Refunded, Cancelled -- Partially Refunded, or Cancelled -- No Refund; logs a refund as a linked adjustment against the original income record rather than editing it, preserving the audit trail. |
| **5**    | Reviews the outcome; the slot reopens for other clients automatically                                                                                  | Notifies the client by email/SMS with the cancellation reason and refund status; removes the booking from the busy calendar so the slot becomes bookable again.                                                                       |

### 6.10 Business Journey -- Building a Custom Booking Form

**Open form builder → Add fields → Set rules → Attach to service → Live for clients**

| **Step** | **What the user does**                                                                                                                                                                                                                                                                              | **What the system does / shows**                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | Opens the Booking Form Builder from Settings or from a specific service                                                                                                                                                                                                                             | Shows the default form (name, phone, email) plus an 'Add Field' option.                                                                                                                                  |
| **2**    | Adds custom fields as needed -- e.g., a text field for 'Home Address', a dropdown for 'Preferred Location', a file upload for 'Reference Photo' -- or adds a read-only info block such as 'Studio Address: 12 Example Street, Wuse 2, Abuja' to show clients instructions rather than collect input | Saves each field with a type (short text, long text, dropdown, checkbox, date, file upload, or read-only info block), a label, and whether it is required.                                               |
| **3**    | Reorders fields and marks which are required before a client can submit a booking                                                                                                                                                                                                                   | Stores the field order and validation rules as part of the form definition.                                                                                                                              |
| **4**    | Attaches the form to one service, several services, or the whole business (e.g., only 'Home Visit' services require the address field)                                                                                                                                                              | Associates the form with the selected service(s); services without a custom form continue to use only the default fields.                                                                                |
| **5**    | Publishes the change                                                                                                                                                                                                                                                                                | The custom fields and info blocks immediately appear on the public booking page for the relevant service(s); client responses are saved with each booking and viewable (and exportable) by the business. |

### 6.11 Business Journey -- Subscribing to a Paid Plan

**View plans → Pick plan → Pay via gateway → Plan active → Manage anytime**

| **Step** | **What the user does**                                                                                   | **What the system does / shows**                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | Opens Settings > Plan & Billing, or hits a feature that requires an upgrade (e.g., Google Calendar sync) | Shows the current plan (Starter, Growth, Pro, or Team), a feature comparison, and Naira pricing for monthly or annual billing.                                                                                                                                                         |
| **2**    | Picks a plan and billing cycle (monthly, or annual for a two-month discount)                             | Shows the exact amount due in Naira, with no USD conversion and no hidden fees.                                                                                                                                                                                                        |
| **3**    | Pays via the platform's payment gateway (card, bank transfer, or USSD through Paystack/Flutterwave)      | This is a single, controlled payment from the business to Iker, so it's collected automatically -- unlike the manual client-deposit flow, this checkout is instant and doesn't require proof-of-payment upload.                                                                        |
| **4**    | Sees the plan activate immediately                                                                       | Unlocks the new tier's features right away (e.g., custom forms, refund policy, Google Calendar sync) and schedules the next auto-renewal date.                                                                                                                                         |
| **5**    | Can upgrade, downgrade, or cancel at any time from the same screen                                       | Downgrades and cancellations take effect at the end of the current billing period; if a renewal payment fails, the business gets a 7-day grace period before a soft downgrade to Starter (Free) -- the booking link, calendar, and all historical data stay intact regardless of plan. |

## 7. Functional Requirements

Requirements are grouped by feature area, each mapped back to the original feature list. Every requirement includes acceptance criteria so it can be estimated and QA'd directly.

### 7.1 Calendar and Time-Based Booking (Feature 1)

| **ID**   | **User Story**                                                                                                                    | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1.1** | As a business, I can create one or more services with a name, category, price, and duration.                                      | • Service requires name, price, duration<br>• Category is selectable or creatable<br>• Services can be edited or archived (not hard-deleted if already booked)                                                                                                                                                                                                                                                                                                             |
| **F1.2** | As a business, I can generate a unique, shareable public booking link.                                                            | • Link is unique per business<br>• Link works on mobile, tablet, and desktop browsers<br>• Business can preview the public page before sharing                                                                                                                                                                                                                                                                                                                             |
| **F1.3** | As a client, I can view real-time availability and book an open slot, including multiple people/service units in one appointment. | • Booked or blocked slots never appear as available<br>• Booking a slot immediately removes it from availability for other clients<br>• Client receives an on-screen and emailed confirmation<br>• A client may book 1–10 people/service units back-to-back in one appointment; every unit adds one service duration and multiplies the service price and initial deposit<br>• Only start times with enough consecutive availability are offered for the selected quantity |

### 7.2 Client Booking Experience: Price/Category Browsing, Balance View, Deposit Proof (Feature 2)

| **ID**   | **User Story**                                                                                                                                                              | **Acceptance Criteria**                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F2.1** | As a client, I can browse services by category or by price before booking.                                                                                                  | • Category filter and price sort are both available<br>• Service list loads in under 2 seconds on 3G                                                       |
| **F2.2** | As a client, I can see the business's account/balance information the business has chosen to display.                                                                       | • Business controls exactly which payment details are shown (e.g., bank account, QR code)<br>• No client ever sees another client's information            |
| **F2.3** | As a client, I can upload proof of my initial deposit payment.                                                                                                              | • Accepts image or PDF upload up to 10MB<br>• Booking status changes to Awaiting Confirmation once proof is uploaded<br>• Business is notified immediately |
| **F2.4** | As a product team, we acknowledge payments are manual for v1 and design the data model so automated payment gateways can be added later without breaking existing bookings. | • Payment record structure supports a 'method' field (manual, gateway) from day one<br>• No UI dead-ends that assume manual-only forever                   |

### 7.3 Business Availability Management (Feature 3)

| **ID**   | **User Story**                                                                                    | **Acceptance Criteria**                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F3.1** | As a business, I can set recurring weekly working hours per staff member (or for myself if solo). | • Hours can differ by day of week<br>• Changes apply going forward without altering already-confirmed bookings                                                   |
| **F3.2** | As a business, I can block off specific dates/times (holidays, personal time).                    | • Blocked time is immediately reflected in public availability<br>• Existing bookings in a newly blocked window trigger a warning, not an automatic cancellation |
| **F3.3** | As a business, I can set buffer time between bookings and a minimum notice period.                | • Buffers apply to slot calculation<br>• Minimum notice prevents last-minute bookings inside the configured window                                               |

### 7.4 Google Calendar Sync (Feature 4)

| **ID**   | **User Story**                                                                        | **Acceptance Criteria**                                                                                                               |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **F4.1** | As a business, I can connect my Google account to sync bookings both ways.            | • OAuth connection flow with clear consent screen<br>• Connection status visible in Settings<br>• Business can disconnect at any time |
| **F4.2** | As a business, confirmed Iker bookings appear on my Google Calendar automatically.    | • New/updated/cancelled bookings sync within 1 minute<br>• Sync failures are surfaced to the business, not silently dropped           |
| **F4.3** | As a business, existing Google Calendar events block those times from client booking. | • Busy events on Google Calendar are treated as unavailable in Iker<br>• Sync respects the business's chosen calendar(s) only         |

### 7.5 Walk-in Bookings and Manual/Partial Payment Recording (Feature 5)

| **ID**   | **User Story**                                                                               | **Acceptance Criteria**                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F5.1** | As a business, I can record a walk-in appointment without the client using the booking link. | • Quick-entry form takes under 30 seconds to complete<br>• New customers are automatically added to the customer list<br>• One booking may include 1–10 people/service units; each adds one full service duration consecutively and multiplies the appointment price |
| **F5.2** | As a business, I can record full or partial payment at time of service.                      | • Partial payments show a clear 'balance remaining' amount<br>• Booking status reflects Paid / Partially Paid / Unpaid                                                                                                                                               |
| **F5.3** | As a business, I can update a booking when a customer completes a part-payment.              | • Each payment against a booking is logged with its own date/time (audit trail)<br>• Income totals update immediately once balance is completed                                                                                                                      |

### 7.6 Expense Tracking with Receipts (Feature 6)

| **ID**   | **User Story**                                                                       | **Acceptance Criteria**                                                                                                          |
| -------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **F6.1** | As a business, I can record an expense with amount, date, description, and category. | • Amount and date are required fields<br>• Categories are business-defined and reusable                                          |
| **F6.2** | As a business, I can attach a photo or file of the receipt to an expense.            | • Accepts image/PDF up to 10MB<br>• Receipt is viewable later from the expense record                                            |
| **F6.3** | As a business, expenses without a receipt are still recordable.                      | • Receipt upload is optional, never blocking<br>• Missing-receipt expenses are visually flagged for the business's own awareness |

### 7.7 Financial Reporting -- Monthly, Quarterly, Yearly (Feature 7)

| **ID**   | **User Story**                                                                                | **Acceptance Criteria**                                                                                         |
| -------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **F7.1** | As a business, I can view income, expenses, and net profit for any month, quarter, or year.   | • Totals recalculate correctly across period boundaries<br>• Comparison to the prior equivalent period is shown |
| **F7.2** | As a business, I can see a breakdown by service/category (income) and by category (expenses). | • Breakdown chart and table both available<br>• Drilling into a category shows the underlying transactions      |

### 7.8 Customer Data Collection and Promotional Email (Feature 8)

| **ID**   | **User Story**                                                                             | **Acceptance Criteria**                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F8.1** | As a business, customer details from bookings are automatically saved to my customer list. | • Name, phone, email, and visit history are captured from every booking (link-based or walk-in)<br>• Duplicate detection merges repeat customers by phone/email                                  |
| **F8.2** | As a business, I can send a promotional email to some or all of my customers.              | • Segmentation by service booked, visit count, or last-visit date<br>• Every recipient can opt out; opt-outs are respected on future sends<br>• A business can only ever email its own customers |

### 7.9 Monthly Statement of Account (Feature 9)

| **ID**   | **User Story**                                                                      | **Acceptance Criteria**                                                                                                     |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **F9.1** | As a business, I can generate a formatted statement of account for a chosen period. | • Includes opening balance, income, expenses, closing balance, and category breakdowns<br>• Available as a downloadable PDF |
| **F9.2** | As a business, I can access past statements at any time.                            | • Statement history is retained and re-downloadable<br>• Statements are read-only once generated (immutable snapshot)       |

### 7.10 Admin Onboarding of Businesses (Feature 10)

| **ID**    | **User Story**                                                                                      | **Acceptance Criteria**                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **F10.1** | As a Platform Admin, I can create and activate a new business account.                              | • Required fields: business name, category, contact, location<br>• Business receives a welcome/activation email automatically              |
| **F10.2** | As a Platform Admin, I can suspend or reactivate a business account for support/compliance reasons. | • Suspension hides the business's public booking link immediately<br>• Suspension never exposes or alters the business's financial records |

### 7.11 Super Admin Platform Governance (Feature 11)

| **ID**    | **User Story**                                                                                                                | **Acceptance Criteria**                                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F11.1** | As a Super Admin, I can manage Platform Admin accounts (create, deactivate, adjust permissions).                              | • Only Super Admins can create other Platform Admin or Super Admin accounts<br>• All admin-account changes are logged with who/when                                                                                                   |
| **F11.2** | As a Super Admin, I can view platform-wide, aggregated analytics without seeing any individual business's income or expenses. | • Dashboards show counts/aggregates only (e.g., 'total bookings this month'), never itemized business financials<br>• Attempting to access a business's financial records is blocked at the API/data layer, not just hidden in the UI |

### 7.12 Booking Cancellation and Refunds (Feature 12)

New feature area added at the business's request, covering business-initiated cancellation, a client-visible refund policy, and refund processing.

| **ID**    | **User Story**                                                                                                | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F12.1** | As a business, I can cancel a Pending or Confirmed booking and record a reason.                               | • Cancellation reason is required (free text or a short pick-list: business unavailable, client requested, no-show, other)<br>• Booking status becomes Cancelled and the slot immediately reopens as available<br>• Cancelling never deletes the original booking or payment record                                                                                                                |
| **F12.2** | As a business, I can configure a refund and cancellation policy, either business-wide or per service.         | • Policy supports plain-language rules (e.g., full refund if the business cancels; partial or tiered refund if the client cancels with less than a set notice period; no refund below a minimum notice)<br>• Policy is versioned: each booking snapshots the exact policy text shown to the client at the time they booked, so later edits never retroactively change what a past client agreed to |
| **F12.3** | As a client, I can see the business's refund and cancellation policy before I pay my deposit.                 | • Policy text is displayed on the booking page before payment instructions are shown<br>• Client cannot reach the payment-instructions step without the policy having been rendered on screen                                                                                                                                                                                                      |
| **F12.4** | As a business, when I cancel a booking with a refund due, I can record the refund amount and mark it as paid. | • Refund amount is auto-suggested from the policy but remains editable by the business<br>• Optional proof-of-refund upload, mirroring the deposit proof-of-payment flow<br>• Refund is stored as a linked adjustment against the original income record (never overwrites it), so reports and statements reflect net income after refunds while preserving the original transaction for audit     |
| **F12.5** | As a client, I am notified when my booking is cancelled and when my refund is confirmed.                      | • Email/SMS notification fires on cancellation, including the reason if the business provided one<br>• A second notification fires once the refund is marked paid                                                                                                                                                                                                                                  |

### 7.13 Custom Booking Forms (Feature 13)

New feature area added at the business's request, giving each business full control over what information they collect from clients, or want to display to clients, during booking.

| **ID**    | **User Story**                                                                                                                                                                  | **Acceptance Criteria**                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F13.1** | As a business, I can add custom fields to my booking form beyond the default name, phone, and email.                                                                            | • Supported field types: short text, long text, dropdown/select, checkbox, date, and file upload<br>• Each field has a label and a required/optional flag                                             |
| **F13.2** | As a business, I can add a read-only info block to my booking form to show clients information such as a studio address or preparation instructions, rather than collect input. | • Info blocks render as plain text (basic formatting supported) to the client<br>• Info blocks can be positioned anywhere in the field order and are never treated as client input                    |
| **F13.3** | As a business, I can attach a custom form to specific services or apply it across the whole business.                                                                           | • A service with no custom form attached shows only the default fields<br>• A service with a custom form attached shows the default fields plus the custom fields/info blocks in the configured order |
| **F13.4** | As a client, I fill out any required custom fields as part of booking (e.g., my home address for an on-site service).                                                           | • Required custom fields block booking submission until completed<br>• Responses are saved with the booking record                                                                                    |
| **F13.5** | As a business, I can view and export custom field responses for a booking or across a range of bookings.                                                                        | • Responses are visible in the booking detail view<br>• Bulk export (e.g., CSV) is available for a selected date range                                                                                |

### 7.14 Subscription Plans and Billing (Feature 14)

New feature area added at the business's request: an affordable, Naira-first subscription model with a genuinely usable free tier. See Section 11 for the full plan lineup and pricing philosophy.

| **ID**    | **User Story**                                                                                                                   | **Acceptance Criteria**                                                                                                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F14.1** | As a business, I can see the available plans, what each includes, and the exact Naira price, before I ever have to pay anything. | • Pricing page shows all tiers side by side with a feature checklist<br>• Prices shown only in Naira -- no USD conversion required<br>• No feature is hidden behind a 'contact sales' wall except the custom Team tier                                                                           |
| **F14.2** | As a business, I start on a genuinely usable free plan with no card required, and can try Growth-tier features free for 30 days. | • Signup never requires payment details<br>• 30-day Growth trial starts automatically and is clearly labeled with a countdown<br>• At trial end, the account falls back to Starter (Free) automatically -- never suspended, never data-locked                                                    |
| **F14.3** | As a business, I can subscribe to a paid plan and pay via card, bank transfer, or USSD.                                          | • Checkout uses a licensed Nigerian payment gateway (e.g., Paystack or Flutterwave) for this platform-to-business billing relationship, distinct from the manual client-deposit flow<br>• Plan activates immediately on successful payment<br>• A receipt/invoice is generated for every payment |
| **F14.4** | As a business, I can upgrade, downgrade, or cancel my plan at any time.                                                          | • Upgrades apply immediately; downgrades and cancellations apply at the end of the current billing period<br>• Cancelling never deletes data or disables the booking link -- the account simply reverts to Starter (Free)                                                                        |
| **F14.5** | As a business, if my renewal payment fails, I get a grace period before losing any paid features.                                | • 7-day grace period with in-app and email/SMS notice before downgrade<br>• Downgrade at the end of the grace period is a soft feature-limit only, never account suspension or data loss                                                                                                         |
| **F14.6** | As a Platform Admin, I can apply a promotional discount code to a business's subscription during onboarding.                     | • Discount codes support percentage or fixed-Naira discounts and an optional expiry<br>• Applying a code never requires viewing the business's income or expense records                                                                                                                         |
| **F14.7** | As a Super Admin, I can configure the plan tiers, their features, and pricing.                                                   | • Plan and price changes apply to new subscriptions immediately; existing subscribers keep their current price until their next renewal, with advance notice of any change<br>• All plan/pricing changes are logged with who/when                                                                |

## 8. Non-Functional Requirements

| **Category**           | **Requirement**                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Performance**        | Public booking page loads in under 2 seconds on a typical 3G/4G connection in Nigeria; dashboard actions respond in under 1 second for 95% of requests.                                          |
| **Availability**       | 99.5% uptime target for the booking and payment-proof upload flows, since a down booking page directly costs businesses revenue.                                                                 |
| **Security**           | Role-based access control enforced server-side for all four roles; financial data isolated per business at the database/query layer; encrypted at rest and in transit.                           |
| **Data Privacy**       | Compliant with the Nigeria Data Protection Act (NDPA) 2023: lawful basis for processing client contact data, ability for a client to request deletion, and breach-notification process in place. |
| **Offline Resilience** | Core forms (add expense, add walk-in) queue and sync when connectivity returns, given variable mobile data reliability.                                                                          |
| **Scalability**        | Architecture supports growth from a single-city pilot (Abuja) to multi-city (Lagos, then beyond) without a data-model rewrite.                                                                   |
| **Accessibility**      | Public booking page usable on low-end Android devices and small screens; minimum tap-target sizes and readable contrast.                                                                         |
| **Localization**       | Currency displayed in Naira (NGN) by default with the data model able to support additional currencies later.                                                                                    |
| **Auditability**       | Every financial record (income, expense, payment) is timestamped and immutable once confirmed; corrections create a new adjustment entry rather than silently editing history.                   |
| **Payment Security**   | Platform subscription billing (business paying Iker) runs through a PCI-DSS-compliant Nigerian payment gateway (e.g., Paystack or Flutterwave); Iker never stores raw card details.              |

## 9. Information Architecture -- Core Data Entities

A simplified view of the core entities and how they relate, to align product and engineering before schema design.

| **Entity**               | **Purpose / key relationships**                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Business**             | The tenant. Owns services, staff, availability, bookings, customers, income, expenses, and statements. One Business belongs to one platform account.                                                                                                                                                         |
| **Staff / User**         | A person with a role (Business Owner/Staff, Platform Admin, Super Admin) and scoped permissions.                                                                                                                                                                                                             |
| **Service**              | Belongs to a Business; has name, category, price, duration; can have a Custom Form attached.                                                                                                                                                                                                                 |
| **Availability Rule**    | Belongs to a Business (or Staff member); defines working hours, buffers, blocked dates.                                                                                                                                                                                                                      |
| **Booking**              | Links a Client to a Service at a specific time; has a source (link or walk-in) and a status (Pending, Awaiting Confirmation, Confirmed, Completed, Cancelled -- Refunded, Cancelled -- Partially Refunded, Cancelled -- No Refund). Snapshots the Refund Policy version shown to the client at booking time. |
| **Client / Customer**    | Belongs to a Business (not shared across businesses); has contact info and booking history.                                                                                                                                                                                                                  |
| **Payment**              | Linked to a Booking; supports partial payments, a method field (manual now, gateway later), and proof-of-payment attachment.                                                                                                                                                                                 |
| **Refund**               | Linked to a Booking and its original Payment; has amount, reason, status (Pending/Paid), and optional proof-of-refund attachment. Recorded as an adjustment -- never overwrites the original Payment or Income record, preserving the audit trail.                                                           |
| **Refund Policy**        | Belongs to a Business (or a specific Service); defines refund rules by who cancelled and notice given. Versioned so edits never retroactively change what a past client was shown.                                                                                                                           |
| **Custom Form**          | Belongs to a Business; a named set of Form Fields that can be attached to one or more Services. A Service with no Custom Form uses only the default booking fields.                                                                                                                                          |
| **Form Field**           | Belongs to a Custom Form; has a type (short text, long text, dropdown, checkbox, date, file upload, or read-only info block), a label, required/optional flag, and display order.                                                                                                                            |
| **Form Response**        | Linked to a Booking and a Form Field; stores the client's submitted value for that field.                                                                                                                                                                                                                    |
| **Expense**              | Belongs to a Business; has amount, date, category, description, optional receipt attachment.                                                                                                                                                                                                                 |
| **Statement**            | A generated, immutable snapshot of income/expenses for a period, tied to a Business.                                                                                                                                                                                                                         |
| **Google Calendar Link** | Belongs to a Business; stores OAuth tokens and sync status for two-way calendar sync.                                                                                                                                                                                                                        |
| **Plan**                 | A subscription tier (Starter, Growth, Pro, Team) with a name, price, billing cycle options, and a feature/limit set. Managed platform-wide by Super Admin.                                                                                                                                                   |
| **Subscription**         | Belongs to a Business; links it to a Plan, tracks billing cycle, status (Trialing, Active, Grace Period, Downgraded, Cancelled), and next renewal date.                                                                                                                                                      |
| **Invoice**              | Generated per billing cycle for a Subscription; records amount, Naira currency, payment gateway reference, and status (Paid, Failed, Refunded).                                                                                                                                                              |
| **Discount Code**        | An optional percentage or fixed-Naira discount a Platform Admin or Super Admin can apply to a Business's Subscription, with an optional expiry.                                                                                                                                                              |

## 10. Release Plan / Phasing

### Phase 1 -- MVP (Abuja Pilot)

- Calendar & booking link, availability management, client booking flow with manual deposit proof (Features 1-3).

- Walk-in booking and manual payment recording, including partial payments (Feature 5).

- Expense recording with receipt upload (Feature 6).

- Core reporting: monthly income/expense/profit view (part of Feature 7).

- Business onboarding by Platform Admin, and Super Admin platform governance (Features 10-11).

- Business-initiated booking cancellation with a client-visible refund policy and manual refund recording (Feature 12).

- Custom booking forms -- extra fields and read-only info blocks per service (Feature 13).

- Starter (Free) and Growth subscription plans with platform billing via Paystack/Flutterwave (Feature 14).

### Phase 2 -- Depth & Retention

- Google Calendar two-way sync (Feature 4).

- Quarterly/yearly reporting and downloadable statements of account (Features 7 & 9).

- Customer list and promotional email campaigns (Feature 8).

- Pro subscription tier, annual billing, and promotional discount codes.

- Lagos market rollout.

### Phase 3 -- Automation & Expansion

- Automated payment collection (Paystack/Flutterwave-style gateway integration) alongside manual proof-of-payment.

- SMS/WhatsApp reminders and confirmations.

- Multi-staff scheduling for larger businesses (salons/clinics with several service providers).

- Expansion beyond Abuja/Lagos to additional cities.

- Revisit usage/transaction-based pricing options once automated payments land, without removing the flat-subscription tiers businesses already rely on.

## 11. Pricing & Subscription Plans

This section defines Feature 14 in full: an affordable, Naira-first subscription model designed so cost is never the reason a business can't get started, informed by pricing research across the competitive set covered in the Market Analysis.

### 11.1 Pricing Philosophy

- Naira-first and flat: every price is a flat monthly or annual Naira amount, shown up front. No USD conversion, no surprise fees.

- No commission, ever: Iker never takes a percentage of a business's bookings or deposits. This is a deliberate contrast to Fresha (20% new-client marketplace commission), Booksy (30% commission when Boost is on), and the two closest Nigerian booking competitors, BookAm.ng and Kindlybook, both of which charge a 6% processing fee (capped at ₦3,000) on every booking. Because v1 payment collection between client and business is manual, Iker never touches that money and has no transaction to skim -- so a flat subscription is the honest model, not just a friendlier one.

- A genuinely usable free tier, forever: not a 14-day trial. Starter is capped on staff count and advanced features, not on core booking volume, so a solo operator can run their whole business on it indefinitely.

- Monthly billing always available: several local competitors (e.g., Bumpa) only bill quarterly or longer. Iker always offers monthly billing alongside a discounted annual option, since forcing a multi-month commitment is a real adoption barrier for cash-constrained businesses.

- Never lock a business out of its own data: a failed renewal leads to a grace period, then a soft downgrade to Starter (Free) -- never suspension, never data loss, and the booking link always stays live.

### 11.2 Plan Tiers

| **Plan**    | **Price**                                        | **What's included**                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Starter** | **Free forever**                                 | 1 staff, 1 booking page, unlimited bookings. Booking link and calendar, manual deposit with proof-of-payment, walk-in bookings, expense tracking with receipts, monthly income/expense report, default booking form.                                   |
| **Growth**  | **₦2,500/month or ₦25,000/year (2 months free)** | Everything in Starter, plus: up to 3 staff and 3 booking pages, Google Calendar sync, custom booking forms and info blocks, configurable refund/cancellation policy, quarterly statements, customer CRM and promotional email (up to 500 sends/month). |
| **Pro**     | **₦6,500/month or ₦65,000/year (2 months free)** | Everything in Growth, plus: up to 10 staff and 10 booking pages, yearly statements and the full reporting suite, unlimited promotional email, multiple locations, priority support.                                                                    |
| **Team**    | **Custom pricing -- talk to us**                 | Everything in Pro, plus: 10+ staff, multi-location chains, dedicated onboarding and support -- negotiated the way Calendly, SimplyBook.me, and Booksy handle their largest accounts.                                                                   |

_Founding Businesses offer (Phase 1 Abuja pilot): the first 150 businesses onboarded get Growth free for 6 months, directly supporting the Section 3 target of 150+ active businesses in the first 90 days._

### 11.3 Billing, Trials, and Grace Period

- 30-day Growth trial automatically starts at signup, no card required; falls back to Starter (Free) automatically if the business doesn't subscribe -- nobody is ever asked to pay before they've seen the value.

- Subscription billing (business paying Iker) is collected automatically through a licensed Nigerian payment gateway (Paystack or Flutterwave) -- a single, controlled payment relationship, distinct from the manual client-to-business deposit flow described in Section 7.2.

- Upgrades apply immediately; downgrades and cancellations apply at the end of the current billing period.

- A failed renewal gets a 7-day grace period with in-app and email/SMS notice before a soft downgrade to Starter (Free); the account, booking link, and all historical data are never deleted or hidden.

- Platform Admins can apply promotional discount codes during onboarding; Super Admin configures the plan tiers, features, and pricing platform-wide.

### 11.4 How This Compares

A short summary of the pricing research behind this model (full detail in the Market Analysis):

| **Competitor**             | **Pricing signal**                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Calendly**               | Free tier, then $10-20/seat/month (roughly ₦15,000-30,000+), scaling per staff member.                                                    |
| **Fresha**                 | $14.95-19.95/month base, plus a 20% commission on new marketplace clients, plus card processing fees.                                     |
| **Booksy**                 | $29.99/month plus $20/month per extra staff member, plus a 30% commission when the Boost marketing add-on is active.                      |
| **BookAm.ng / Kindlybook** | Free plan, but with a 6% processing fee per booking (capped at ₦3,000) -- the closest local comparison.                                   |
| **Bumpa**                  | From ₦10,000/month, billed quarterly, bi-annually, or annually only -- no monthly option.                                                 |
| **Prospa**                 | Free for businesses under ₦100,000 monthly turnover; ₦3,000-₦5,000/month above that threshold.                                            |
| **Iker**                   | Free Starter tier forever; Growth from ₦2,500/month with monthly billing always available; no commission on any booking or deposit, ever. |

## 12. Assumptions, Constraints, and Out of Scope

### 12.1 Assumptions

- Businesses are willing to manually confirm proof-of-payment for v1 rather than requiring instant automated payment.

- Target businesses have at least one smartphone and intermittent internet access.

- Abuja is the Phase 1 launch market, with Lagos as Phase 2.

- Businesses are price-sensitive; the free tier must stay genuinely usable indefinitely, not act as a time-limited trial.

### 12.2 Constraints

- No dedicated finance/accounting backend integration (e.g., QuickBooks) in v1 -- statements are generated natively.

- Google Calendar is the only calendar integration in v1 (no Outlook/iCal in Phase 1).

### 12.3 Out of Scope (for now)

- Automated payment gateway collection for client deposits (planned for Phase 3) -- note this is separate from platform subscription billing, which is automated from v1.

- Automated refund payouts -- refunds are recorded in-app and marked paid once the business completes the transfer manually, mirroring deposit collection.

- Client-initiated self-service cancellation or rescheduling -- for v1, clients request changes directly with the business, who then cancels or updates the booking on their behalf.

- Usage- or transaction-based pricing (e.g., a per-booking fee) -- v1 pricing is flat subscription only; revisit in Phase 3 alongside automated client payments.

- Multi-currency support beyond NGN.

- Native iOS/Android apps (v1 targets a responsive web app across mobile, tablet, and desktop).

- In-app chat/messaging between client and business (bookings and confirmations only).

## 13. Risks

| **Risk**                                                                                                                                   | **Mitigation**                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual payment confirmation creates delay/friction and disputes over 'did I really pay?'                                                   | Clear status states (Pending / Awaiting Confirmation / Confirmed), timestamped proof storage, and a visible SLA for business confirmation.                                                                                                               |
| Businesses abandon onboarding if setup feels like more work than WhatsApp.                                                                 | Sub-15-minute guided setup; sensible defaults for hours/services; Platform Admin-assisted onboarding during the pilot.                                                                                                                                   |
| Low data/connectivity reliability disrupts core flows.                                                                                     | Offline queuing for key forms; lightweight public booking page optimized for slow connections.                                                                                                                                                           |
| Data protection exposure given collection of client contact info and payment proof images.                                                 | NDPA-aligned data handling, encryption, minimal retention of proof images, and clear consent on the public booking page.                                                                                                                                 |
| Super Admin/Platform Admin boundary violated by a future feature or bug, breaking business trust.                                          | Enforce the financial-data boundary at the API/database layer with automated tests, not just UI hiding.                                                                                                                                                  |
| Disputes over refund amount if a business changes its refund policy after a client has already booked.                                     | Snapshot the exact refund policy version on the booking at the time it is made, so the client's booking always shows the policy they actually agreed to, regardless of later edits.                                                                      |
| Free tier is generous enough that businesses never convert to a paid plan.                                                                 | Cap Starter on staff count and advanced features (custom forms, refund policy, Google Calendar sync, multi-period statements, CRM/promo email) rather than on core booking volume, so it stays genuinely useful without removing the reasons to upgrade. |
| Even ₦2,500/month is out of reach for the smallest businesses (64.5% of Nigerian micro-enterprises report under ₦50,000 monthly turnover). | Starter remains free indefinitely with no artificial cliff; the Founding Businesses offer removes cost as a barrier during the pilot; soft-downgrade-on-non-payment means a struggling business is never locked out or deleted.                          |

## 14. Glossary

| **Term**                 | **Definition**                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Business**             | A tenant/organization using Iker to manage its own bookings and finances.                                                                                                                        |
| **Client**               | The end customer booking a service from a Business.                                                                                                                                              |
| **Proof of Payment**     | An image or document a client uploads showing evidence of a manual bank transfer/deposit.                                                                                                        |
| **Walk-in Booking**      | An appointment recorded directly by the Business for a customer who did not book via the public link.                                                                                            |
| **Refund Policy**        | A Business's stated rules for how much is refunded when a booking is cancelled, based on who cancelled and how much notice was given; shown to clients before payment and versioned per booking. |
| **Custom Booking Form**  | A set of extra fields or read-only info blocks a Business can attach to a service's booking flow, beyond the default name/phone/email fields.                                                    |
| **Statement of Account** | A generated, period-based summary of a Business's income, expenses, and net position.                                                                                                            |
| **Subscription Plan**    | The tier (Starter, Growth, Pro, Team) a Business is on, determining its staff/booking-page limits and available features.                                                                        |
| **Grace Period**         | The 7 days after a failed subscription renewal during which a Business keeps its current plan's features before a soft downgrade to Starter.                                                     |
| **Platform Admin**       | Internal staff who onboard and support Businesses, without access to their financial data.                                                                                                       |
| **Super Admin**          | Platform owner/operator role with full system oversight, excluding any Business's financial records.                                                                                             |

## 15. Implementation Status

Snapshot as of **August 29, 2026**, tracked against [EXECUTION_PLAN.md](EXECUTION_PLAN.md)'s
milestones. This section is a status report, not a spec — it does not change any functional
requirement above. Update it (or delegate to the `change-journal` skill's PLAN.md/CHANGELOG.md,
which stay current at every commit) rather than letting it drift; treat `.flitstack/CHANGELOG.md`
as the authoritative detail behind every line here.

### 15.1 Shipped (Phase 0 + Phase 1, plus pulled-forward Phase 2 work)

All of Phase 0 (schema/tenancy/RLS skeleton, auth flows, design-system baseline) and Phase 1
(M1.1–M1.12) are live on `main`, ahead of the original phasing in two ways: Google Calendar sync
(F4, originally Phase 2) has **not** shipped, but several Phase-2/3 items _have_ landed early
because the pilot needed them sooner than planned.

| Area                                                                | Status                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service catalogue, availability engine (hours/buffers/blocks)       | **Shipped**                       | F1.1, F3.1–F3.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Public booking page + client booking flow                           | **Shipped**                       | F1.2, F1.3, F2.1–F2.3, F12.3. Rethemed to the Modernist design system (§15.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Business booking management (confirm/reject, calendar, detail view) | **Shipped**                       | M1.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Walk-in bookings + manual/partial payments                          | **Shipped**                       | F5.1–F5.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Expense tracking with receipts                                      | **Shipped**                       | F6.1–F6.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cancellation & versioned refund policy                              | **Shipped**                       | F12.1, F12.2, F12.4, F12.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Custom booking forms (fields + read-only info blocks)               | **Shipped**                       | F13.1–F13.5, including response export.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Core monthly reporting (income/expense/profit)                      | **Shipped**                       | F7.1 monthly slice; quarterly/yearly (F7.1 full, F7.2) not yet built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Platform Admin onboarding console                                   | **Shipped**                       | F10.1, F10.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Super Admin governance + aggregate analytics                        | **Shipped**                       | F11.1, F11.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Subscription plans & billing (Starter/Growth/Pro/Team)              | **Shipped, ahead of plan**        | F14.1–F14.7 including Pro/Team tier gating, not just Starter/Growth as M1.12 originally scoped. Paystack checkout, 30-day Growth trial, 7-day grace period, discount codes, and admin-configurable plan tiers/pricing are all live.                                                                                                                                                                                                                                                                                                                      |
| **Business Plan Override ("comp/promo plans")**                     | **Shipped — not in original PRD** | New capability, added at the business's request after MVP: a Platform Admin can grant a business a free or discounted override on any plan tier, which the business can self-serve activate/deactivate. Enforced with the same RLS/immutable-record discipline as the rest of the financial boundary (`business_plan_override` table, four RPCs, versioned lifecycle, admin audit log). Should be folded into §7.14/§9 as a numbered feature (F14.8) in the next content revision of this PRD — deferred here to keep this section a pure status report. |
| **Booking Workflows** (post-booking step sequencing)                | **Shipped — not in original PRD** | New capability: a business can define a per-service sequence of steps a booking moves through after payment (e.g. generic info steps, a payment-display step, a success step), configured via a dedicated workflow editor. Not described anywhere in the original PRD's feature list; also needs a proper write-up as a numbered feature in the next content revision.                                                                                                                                                                                   |
| **Sales & Discounts** (promo links, per-service % discounts)        | **Shipped — not in original PRD** | New capability: shareable promo links carrying a per-service percentage discount, with the resulting discount auto-posted as an expense so reporting stays accurate. Needs a numbered write-up alongside the two items above.                                                                                                                                                                                                                                                                                                                            |

### 15.2 Not yet shipped (still matches original phasing)

| Area                                                                                                                            | PRD ref                       | Planned phase  |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------- |
| Google Calendar two-way sync                                                                                                    | F4.1–F4.3                     | Phase 2 (M2.1) |
| Quarterly/yearly reporting + downloadable PDF statements of account                                                             | F7.1 (full), F7.2, F9.1, F9.2 | Phase 2 (M2.2) |
| Customer CRM + promotional email campaigns                                                                                      | F8.1, F8.2                    | Phase 2 (M2.3) |
| Annual billing cycle hardening, multi-location surfaced in UI                                                                   | —                             | Phase 2 (M2.4) |
| Lagos multi-city rollout                                                                                                        | —                             | Phase 2 (M2.5) |
| Automated client-deposit collection (gateway path), SMS/WhatsApp reminders, multi-staff scheduling, usage-based pricing options | —                             | Phase 3        |

### 15.3 Design system

The product has been rethemed end-to-end from the original "Calendly-style blue" look to a new
**Modernist** design system (flat surfaces, zero border-radius, thick 2px dividers, single
Archivo typeface, red-orange `#ec3013` primary) sourced from a Claude Design canvas project. See
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full token/primitive reference and rollout status
per area (Auth and the public booking flow are fully rethemed; the dashboard shell/nav is
mid-rollout — see the mobile spec below for the area this PRD update was requested alongside).

### 15.4 Open engineering risk carried from `.flitstack/PLAN.md`

Reference records — the seeded `plan`/`plan_feature` rows have repeatedly gone missing in both
local dev and the linked remote Supabase project, root cause unknown as of this snapshot. Does
not block product scope; flagged here only so it isn't lost between PRD revisions. See
`.flitstack/PLAN.md` for live status.
