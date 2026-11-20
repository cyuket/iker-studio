---
facts:
  - id: month-end-problem
    statement: "Service businesses track deposits and balances from memory or chat threads and keep income and expenses in notebooks or spreadsheets. The result includes lost income records and no clear view of monthly profit."
    source: "knowledge/product-facts.md pf-002; slot-books docs/Iker_PRD.md §1 Executive Summary, §2 Problem Statement"
  - id: report-sidebar
    statement: 'Under Accounting, the sidebar has "Report" and "Transactions". Report opens the page titled "Business report".'
    source: 'knowledge/product-facts.md pf-090; slot-books apps/web/app/(dashboard)/layout.tsx; apps/web/app/(dashboard)/accounting/page.tsx (metadata title "Business report")'
  - id: report-money
    statement: 'The Business report shows "Money in" (subline "Confirmed payments + extra income, less refunds"), "Money out" and "Profit" (or "Loss" when more went out than came in) for the period.'
    source: "slot-books apps/web/components/reports/business-report.tsx ReportKpis (read 2026-11-19); knowledge/product-facts.md pf-094 (which calls them Income, Expenses and Profit-or-Loss; slot-books wins)"
  - id: report-breakdown
    statement: 'The Business report has "Where the money came from" (income by service) and "Where the money went" (hint: "Expenses by category. Tap one to see what you spent.").'
    source: "slot-books apps/web/app/(dashboard)/accounting/page.tsx BreakdownPanel titles and hints (read 2026-11-19); knowledge/product-facts.md pf-094"
  - id: pending-not-counted
    statement: 'Nothing counts as income until the business confirms the payment. The Business report says payments waiting for confirmation are "waiting for you to confirm. It isn''t counted as income yet."'
    source: "knowledge/product-facts.md pf-062; slot-books apps/web/lib/marketing/content/features.ts (deposits); apps/web/components/reports/business-report.tsx PendingNotice"
  - id: reports-from-confirmed
    statement: "Reports show income, expenses and profit for a month and are built from the payments the business confirmed."
    source: "knowledge/product-facts.md pf-094; slot-books apps/web/lib/marketing/content/features.ts (reports)"
  - id: transactions-list
    statement: "Transactions combines payments, refunds and expenses into one list, newest first."
    source: "knowledge/product-facts.md pf-093; slot-books docs/FRONTEND_CURRENT_STATE.md §3 /accounting/transactions"
  - id: statement-tab
    statement: 'Transactions has the tabs "All", "Income" and "Expenses". On the All tab the list is titled "Statement of accounts".'
    source: "slot-books apps/web/app/(dashboard)/accounting/transactions/transactions-tabs.tsx (cardTitle, TabsTrigger labels; read 2026-11-19)"
  - id: expenses-plan
    statement: "Expenses are recorded with an amount, date, description and category. Expense entries are plan-gated: viewer copy says depending on your plan."
    source: "knowledge/product-facts.md pf-092, pf-134; slot-books apps/web/lib/marketing/content/features.ts (expenses, plan key expense_entries)"
  - id: records-not-collects
    statement: "Clients pay the business directly by bank transfer and upload proof of payment. The business confirms. Iker never holds the money."
    source: "knowledge/product-facts.md pf-060; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts)"
  - id: cta-wording
    statement: 'The primary call to action on useiker.com is "Get started", which opens the contact form; the Iker team then sets up the business with the owner.'
    source: "knowledge/audience-and-voice.md Call to action; slot-books apps/web/lib/marketing/links.ts; apps/web/components/marketing/home/hero.tsx"
---

# Research: Your monthly money check-in

## What the product actually does

Under Accounting, Report opens the Business report. For the month it shows Money in (confirmed
payments and extra income, less refunds), Money out, and Profit or Loss, then where the money came
from by service and where it went by expense category. Payments still waiting for the owner's
confirmation are flagged and not counted as income. Transactions lists payments, refunds and
expenses newest first; on its All tab the list is titled "Statement of accounts".

## What we must not claim

- Iker records and tracks payments. It does not take, collect, process or hold money.
- Expense entries, report export and statement periods depend on the plan (pf-134). Say
  "depending on your plan" when the video implies every business records expenses.
- Do not say reports are compared with the previous month: pf-094 says so, but the current
  `business-report.tsx` and `accounting/page.tsx` do not show it. Check before using it.
- Quarterly and yearly reports and downloadable PDF statements are plan-gated (pf-095, pf-096). Do
  not present them as on every plan; this demo leaves them out.
- No promised profit, savings or "know your numbers in minutes". No statistics about businesses.
- The example month (₦400,000 in, ₦250,000 out, ₦150,000 left) is made up for teaching and is
  labelled illustrative on screen. It is not a real business and not an Iker result.
- The decision step ("pick your biggest cost and decide one change") is general advice, not a
  product feature.

## Notes

Demo content for the Monthly Money Check-in template. Product footage comes from
`iker-business-report` (screenshot `business-report`) and `iker-transactions`, both unverified
scenarios against the demo environment. Until they are verified, swap in a synthetic scenario for
a pipeline check and label it as synthetic.
