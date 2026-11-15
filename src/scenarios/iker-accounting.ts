import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";
import {
  button,
  DASHBOARD_PREREQUISITES,
  DEMO_DATA_PREREQUISITE,
  evidence,
  heading,
  link,
  openPage,
  READ_ONLY_PREREQUISITE,
} from "./iker-shared";

/** The books: the monthly business report, every transaction, and saved reports. */

const RECORD_INCOME_DIALOG = { role: "dialog", name: "Record income", exact: true } as const;
const tab = (name: string) => ({ role: "tab", name, exact: true }) as const;

const ACCOUNTING_DATA =
  "The demo business has income, expenses and bookings in the current month, so the report is not empty.";

export const ikerBusinessReport: Scenario = defineScenario({
  id: "iker-business-report",
  title: "The monthly business report: money in, money out, profit",
  feature: "Business report",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/accounting/page.tsx ("Business report", sections "Money", "Where the money came from", "Where the money went", "Appointments", "Customers", "View past reports →", "Get report")',
    'components/reports/business-report.tsx ("Money in", "Money out", "Profit")',
    'app/(dashboard)/layout.tsx (sidebar "Report" links to /accounting)',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    ACCOUNTING_DATA,
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [
    {
      path: "/accounting",
      expect: [{ text: "Business report", exact: true }, heading("Money")],
    },
  ],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: "/accounting" },
    { action: "waitFor", target: heading("Money") },
    { action: "dwell", ms: 1200 },
    {
      action: "highlight",
      target: { text: "Money in", exact: true, nth: 0 },
      label: "What came in this month",
      holdMs: 2000,
    },
    {
      action: "highlight",
      target: { text: "Money out", exact: true, nth: 0 },
      label: "What went out",
      holdMs: 1800,
    },
    { action: "screenshot", name: "business-report" },
    { action: "scroll", target: heading("Where the money came from") },
    { action: "dwell", ms: 1800 },
    { action: "scroll", target: heading("Appointments") },
    { action: "dwell", ms: 1800 },
    { action: "screenshot", name: "report-appointments" },
  ],
});

export const ikerTransactions: Scenario = defineScenario({
  id: "iker-transactions",
  title: "Every payment, income and expense in one list",
  feature: "Income and expenses",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/accounting/transactions/page.tsx (heading "Transactions", "Import history")',
    'app/(dashboard)/accounting/transactions/transactions-tabs.tsx (tabs "All", "Income", "Expenses")',
    'app/(dashboard)/accounting/income/new-income-dialog.tsx ("+ Record income", dialog "Record income")',
    'app/(dashboard)/accounting/expenses/new-expense-dialog.tsx ("+ Add expense")',
    "app/(dashboard)/accounting/income/page.tsx and expenses/page.tsx redirect to /accounting/transactions?tab=income and ?tab=expenses",
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    ACCOUNTING_DATA,
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [
    {
      path: "/accounting/transactions",
      expect: [heading("Transactions"), tab("Income"), button("+ Record income")],
    },
  ],
  steps: [
    ...openPage("/accounting/transactions", "Transactions"),
    {
      action: "highlight",
      target: tab("All"),
      label: "Payments, refunds, income and expenses",
      holdMs: 2200,
    },
    { action: "screenshot", name: "transactions" },
    { action: "click", target: tab("Income") },
    { action: "dwell", ms: 1500 },
    { action: "click", target: tab("Expenses") },
    { action: "dwell", ms: 1500 },
    {
      action: "highlight",
      target: button("+ Add expense"),
      label: "Log what the business spends",
      holdMs: 1800,
    },
    { action: "click", target: button("+ Record income") },
    { action: "waitFor", target: RECORD_INCOME_DIALOG },
    { action: "dwell", ms: 1000 },
    {
      action: "highlight",
      target: { label: "Amount (₦)", within: RECORD_INCOME_DIALOG },
      label: "Income outside a booking",
      holdMs: 2000,
    },
    { action: "screenshot", name: "record-income" },
    { action: "press", key: "Escape" },
    { action: "waitFor", target: RECORD_INCOME_DIALOG, state: "hidden" },
  ],
});

export const ikerPastReports: Scenario = defineScenario({
  id: "iker-past-reports",
  title: "Saved report PDFs for past periods",
  feature: "Statements and reports",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/accounting/statements/page.tsx (heading "Past reports", "Saved PDFs", columns "Period", "Includes", "Generated", "Closing balance", "Download")',
    'app/(dashboard)/accounting/page.tsx ("View past reports →")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    'At least one report generated for the demo business, so "Saved PDFs" is not the "No reports yet" empty state, on a plan that includes reports.',
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [
    { path: "/accounting", expect: [link("View past reports →")] },
    { path: "/accounting/statements", expect: [heading("Past reports")] },
  ],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: "/accounting" },
    { action: "waitFor", target: link("View past reports →") },
    { action: "dwell", ms: 1000 },
    {
      action: "highlight",
      target: link("View past reports →"),
      label: "Earlier reports are kept",
      holdMs: 1800,
    },
    { action: "click", target: link("View past reports →") },
    { action: "waitForState", condition: { urlIncludes: "/accounting/statements" } },
    { action: "waitFor", target: heading("Past reports") },
    { action: "dwell", ms: 1000 },
    {
      action: "highlight",
      target: { text: "Saved PDFs", exact: true },
      label: "Download any period again",
      holdMs: 2400,
    },
    { action: "screenshot", name: "past-reports" },
  ],
});

export const IKER_ACCOUNTING_SCENARIOS: readonly Scenario[] = [
  ikerBusinessReport,
  ikerTransactions,
  ikerPastReports,
];
