import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";
import {
  button,
  DASHBOARD_PREREQUISITES,
  DEMO_DATA_PREREQUISITE,
  evidence,
  heading,
  openPage,
  READ_ONLY_PREREQUISITE,
} from "./iker-shared";

/** Money coming in: a manual payment on a booking, and the discounts that bring clients back. */

const CALENDAR_SCHEDULE_PATH = "/calendar?view=schedule";
const SAMPLE_BOOKING_LINK = { role: "link", name: "Sample Client A", nth: 0 } as const;
const RECORD_DIALOG = { role: "dialog", name: "Record a payment", exact: true } as const;
const NEW_SALE_DIALOG = { role: "dialog", name: "New sale", exact: true } as const;

export const ikerRecordPayment: Scenario = defineScenario({
  id: "iker-record-payment",
  title: "Record a deposit a client paid by transfer",
  feature: "Payments",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/bookings/[id]/page.tsx ("Payments", "Balance remaining", "Record a payment" shown while a balance remains)',
    'app/(dashboard)/bookings/[id]/record-payment-dialog.tsx (dialog "Record a payment", "still outstanding on this booking", "Amount received (₦)", "Pay off balance", "Balance after this payment", "Save payment")',
    'components/shared/payment-proof-field.tsx ("Proof of payment: a photo, screenshot or PDF, up to 10MB", "Upload proof of payment")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    'Saves nothing: "Save payment" needs an uploaded proof of payment, which the recorder cannot attach, and a saved payment would change the demo business\'s books. The take enters the amount, shows the balance and the proof field, then closes the dialog with Escape.',
  ],
  preflight: [{ path: CALENDAR_SCHEDULE_PATH, expect: [SAMPLE_BOOKING_LINK] }],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: CALENDAR_SCHEDULE_PATH },
    { action: "waitFor", target: heading("Calendar") },
    { action: "click", target: SAMPLE_BOOKING_LINK },
    { action: "waitForState", condition: { urlIncludes: "/bookings/" } },
    { action: "waitFor", target: heading("Sample Client A") },
    { action: "dwell", ms: 1200 },
    {
      action: "highlight",
      target: { text: "Balance remaining", exact: true },
      label: "Nothing paid yet",
      holdMs: 2200,
    },
    { action: "click", target: button("Record a payment") },
    { action: "waitFor", target: RECORD_DIALOG },
    { action: "dwell", ms: 800 },
    {
      action: "highlight",
      target: { text: "still outstanding on this booking", within: RECORD_DIALOG },
      label: "A new payment never changes an earlier one",
      holdMs: 2600,
    },
    {
      action: "type",
      target: { label: "Amount received", within: RECORD_DIALOG },
      text: "13500",
      note: "The 30% deposit",
    },
    {
      action: "highlight",
      target: { text: "Balance after this payment", within: RECORD_DIALOG },
      label: "₦31,500 left to pay",
      holdMs: 2200,
    },
    {
      action: "highlight",
      target: { text: "Proof of payment", within: RECORD_DIALOG },
      label: "Proof of the transfer is required",
      holdMs: 2200,
    },
    { action: "screenshot", name: "record-payment" },
    { action: "press", key: "Escape" },
    { action: "waitFor", target: RECORD_DIALOG, state: "hidden" },
    { action: "dwell", ms: 800 },
  ],
});

export const ikerSalesDiscounts: Scenario = defineScenario({
  id: "iker-sales-discounts",
  title: "Create a shareable discount link",
  feature: "Sales & discounts",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/sales/page.tsx (heading "Sales & discounts", "Your sales")',
    'app/(dashboard)/sales/new-sale-dialog.tsx ("New sale", "Title", "Description (optional)", "Rate card item", "Discount percent")',
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, READ_ONLY_PREREQUISITE],
  preflight: [{ path: "/sales", expect: [heading("Sales & discounts"), button("New sale")] }],
  steps: [
    ...openPage("/sales", "Sales & discounts"),
    {
      action: "highlight",
      target: { text: "Your sales", exact: true },
      label: "Every sale, its expiry and redemptions",
      holdMs: 2200,
    },
    { action: "click", target: button("New sale") },
    { action: "waitFor", target: NEW_SALE_DIALOG },
    { action: "dwell", ms: 800 },
    {
      action: "type",
      target: { label: "Title", within: NEW_SALE_DIALOG },
      text: "June discount",
      note: "Name the sale",
    },
    {
      action: "highlight",
      target: { label: "Rate card item", within: NEW_SALE_DIALOG },
      label: "Pick what it applies to",
      holdMs: 2000,
    },
    {
      action: "highlight",
      target: { label: "Discount percent", within: NEW_SALE_DIALOG },
      label: "And how much off",
      holdMs: 2000,
    },
    { action: "screenshot", name: "new-sale" },
    { action: "press", key: "Escape" },
    { action: "waitFor", target: NEW_SALE_DIALOG, state: "hidden" },
    { action: "dwell", ms: 600 },
  ],
});

export const IKER_PAYMENT_SCENARIOS: readonly Scenario[] = [ikerRecordPayment, ikerSalesDiscounts];
