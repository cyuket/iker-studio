import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";

/**
 * Scenarios for the bundled "Demo Console" fixture (fixtures/synthetic-demo), a simulated
 * booking business. They prove the pipeline end to end without the real product, and every
 * frame they produce carries the fixture's "SYNTHETIC DEMO" banner.
 */

const EVIDENCE =
  "fixtures/synthetic-demo (static fixture in this repository, labels taken from the Iker web app's walk-in form and record-payment dialog); run green by tests/integration/recording.test.ts";

const DASHBOARD_PATH = "/dashboard";
const BOOKINGS_PATH = "/bookings";
const NEW_BOOKING_PATH = "/bookings/new";
const DETAIL_PATH = "/bookings/demo-booking-2041";

const BOOKINGS_HEADING = { role: "heading", name: "Bookings", exact: true } as const;
const ADD_WALK_IN = { role: "link", name: "+ Add walk-in", exact: true } as const;
const SAMPLE_CLIENT_ROW = { role: "row", name: "Sample Client A" } as const;
const PAYMENTS = { role: "region", name: "Payments", exact: true } as const;
const RECORD_DIALOG = { role: "dialog", name: "Record a payment", exact: true } as const;

/** Sign-in happens off camera; these steps put the bookings list in front of the viewer. */
const OPEN_BOOKINGS = [
  { action: "authenticate" },
  { action: "navigate", path: BOOKINGS_PATH },
  { action: "waitFor", target: BOOKINGS_HEADING },
  { action: "dwell", ms: 1000 },
] as const;

export const syntheticSmoke: Scenario = defineScenario({
  id: "synthetic-smoke",
  title: "Demo Console: sign in and land on the dashboard",
  feature: "Recording pipeline smoke test",
  target: "synthetic",
  status: "verified",
  evidence: EVIDENCE,
  preflight: [
    { path: DASHBOARD_PATH, expect: [{ role: "heading", name: "Dashboard", exact: true }] },
  ],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: DASHBOARD_PATH },
    { action: "waitFor", target: { role: "heading", name: "Dashboard", exact: true } },
    { action: "dwell", ms: 600 },
    { action: "highlight", target: { role: "link", name: "View bookings" }, holdMs: 800 },
    { action: "screenshot", name: "dashboard" },
  ],
});

export const syntheticNewBooking: Scenario = defineScenario({
  id: "synthetic-new-booking",
  title: "Demo Console: add a walk-in booking",
  feature: "Bookings",
  target: "synthetic",
  status: "verified",
  evidence: EVIDENCE,
  preflight: [
    { path: BOOKINGS_PATH, expect: [ADD_WALK_IN] },
    {
      path: NEW_BOOKING_PATH,
      expect: [
        { label: "Rate card item 1", exact: true },
        { label: "Date & time", exact: true },
        { role: "button", name: "Save booking", exact: true },
      ],
    },
  ],
  steps: [
    ...OPEN_BOOKINGS,
    {
      action: "highlight",
      target: ADD_WALK_IN,
      label: "For a customer in front of you",
      holdMs: 1800,
    },
    { action: "click", target: ADD_WALK_IN },
    { action: "waitForState", condition: { urlIncludes: NEW_BOOKING_PATH } },
    { action: "waitFor", target: { role: "heading", name: "New walk-in booking", exact: true } },
    { action: "dwell", ms: 800 },
    {
      action: "select",
      target: { label: "Rate card item 1", exact: true },
      option: "Box braids · ₦45,000",
      note: "Pick what they are booking",
    },
    {
      action: "select",
      target: { label: "Date & time", exact: true },
      option: "Sat 21 Jun 2025, 10:00",
      note: "Pick a free time",
    },
    {
      action: "highlight",
      target: { role: "group", name: "Appointment", exact: true },
      label: "What and when",
      holdMs: 1800,
    },
    {
      action: "type",
      target: { label: "Phone number", exact: true },
      text: "0800 000 0007",
      note: "Their phone number",
    },
    {
      action: "type",
      target: { label: "Full name", exact: true },
      text: "Sample Client G",
      note: "Their name",
    },
    {
      action: "type",
      target: { label: "Email", exact: true },
      text: "sample.client.g@example.com",
      note: "Their email",
    },
    { action: "screenshot", name: "walk-in-form" },
    { action: "scroll", target: { role: "group", name: "Payment", exact: true } },
    {
      action: "click",
      target: { role: "button", name: "Nothing yet", exact: true },
      note: "Nothing paid yet",
    },
    {
      action: "highlight",
      target: { role: "group", name: "Payment", exact: true },
      label: "Payment can be added later",
      holdMs: 2200,
    },
    { action: "click", target: { role: "button", name: "Save booking", exact: true } },
    {
      action: "verify",
      target: { role: "status", name: "Save status" },
      containsText: "Booking saved",
    },
    {
      action: "highlight",
      target: { role: "status", name: "Save status" },
      label: "Booked, unpaid",
      holdMs: 1800,
    },
    { action: "screenshot", name: "booking-saved" },
    { action: "dwell", ms: 1000 },
  ],
});

export const syntheticRecordPayment: Scenario = defineScenario({
  id: "synthetic-record-payment",
  title: "Demo Console: record a deposit paid by transfer",
  feature: "Payments",
  target: "synthetic",
  status: "verified",
  evidence: EVIDENCE,
  preflight: [
    { path: BOOKINGS_PATH, expect: [SAMPLE_CLIENT_ROW] },
    {
      path: DETAIL_PATH,
      expect: [PAYMENTS, { role: "button", name: "Record a payment", exact: true }],
    },
  ],
  steps: [
    ...OPEN_BOOKINGS,
    {
      action: "highlight",
      target: SAMPLE_CLIENT_ROW,
      label: "₦45,000 still to pay",
      holdMs: 2000,
    },
    { action: "click", target: { role: "link", name: "Sample Client A", exact: true } },
    { action: "waitForState", condition: { urlIncludes: DETAIL_PATH } },
    { action: "waitFor", target: { role: "heading", name: "Sample Client A", exact: true } },
    { action: "dwell", ms: 900 },
    {
      action: "highlight",
      target: PAYMENTS,
      label: "Nothing paid yet",
      holdMs: 2200,
    },
    { action: "screenshot", name: "booking-balance" },
    { action: "click", target: { role: "button", name: "Record a payment", exact: true } },
    { action: "waitFor", target: RECORD_DIALOG },
    {
      action: "type",
      target: { label: "Amount received (₦)", exact: true },
      text: "13500",
      note: "The 30% deposit",
    },
    {
      action: "highlight",
      target: { text: "Balance after this payment", within: RECORD_DIALOG },
      label: "₦31,500 left to pay",
      holdMs: 2000,
    },
    {
      action: "click",
      target: { role: "button", name: "Upload proof of payment", exact: true },
      note: "Attach the transfer receipt",
    },
    {
      action: "highlight",
      target: { text: "sample-transfer-receipt.png", within: RECORD_DIALOG },
      label: "Proof of payment attached",
      holdMs: 1600,
    },
    { action: "screenshot", name: "payment-dialog" },
    { action: "click", target: { role: "button", name: "Save payment", exact: true } },
    {
      action: "verify",
      target: { role: "status", name: "Payment update" },
      containsText: "Payment recorded",
    },
    {
      action: "highlight",
      target: PAYMENTS,
      label: "Deposit in, balance updated",
      holdMs: 2400,
    },
    { action: "screenshot", name: "payment-recorded" },
    { action: "dwell", ms: 1000 },
  ],
});

export const SYNTHETIC_SCENARIOS: readonly Scenario[] = [
  syntheticSmoke,
  syntheticNewBooking,
  syntheticRecordPayment,
];
