import type { Scenario, ScenarioInput } from "../domain/recording";
import { defineScenario } from "./define";
import { button, DASHBOARD_PREREQUISITES, evidence, heading, link } from "./iker-shared";

/**
 * The booking story of the launch campaign, recorded against the local demo business that
 * fixtures/iker-demo/seed.sh creates: Amaka Studio (slug amaka-studio), its rate card with
 * "Soft glam makeup" (₦50,000, 30% deposit), and Tunde Adeyemi's booking awaiting
 * confirmation with a sample proof of payment. Every flow exists twice, at a phone viewport
 * for 9:16 cuts (shown in an iPhone frame) and a landscape tablet viewport for 16:9 cuts
 * (shown in an iPad frame).
 */

export const DEVICE_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1180, height: 820 },
} as const;
export type DeviceViewport = keyof typeof DEVICE_VIEWPORTS;

const PUBLIC_PATH = "/amaka-studio";

const AMAKA_PREREQUISITE =
  "The local demo business from fixtures/iker-demo/seed.sh (Amaka Studio, slug amaka-studio): Mon-Sat 09:00-18:00 hours, bank details, the Soft glam makeup rate card item, fictional clients with example.com emails, and Tunde Adeyemi's booking awaiting confirmation. Re-run the seed on the day of recording so booking dates are current.";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Accessible name of the day button the client picks: five days ahead, moved off Sunday (the
 * demo business is closed), which keeps clear of the seeded bookings in the next few days.
 * The booking page names its day buttons like "Friday, 20 November".
 */
export function bookingDayName(today: Date): string {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  return `${WEEKDAYS[day.getDay()] ?? ""}, ${String(day.getDate())} ${MONTHS[day.getMonth()] ?? ""}`;
}

/** Hides nothing the viewer needs; blurs the local address that the dashboard prints. */
const MASK_LOCAL_ADDRESS: ScenarioInput["steps"][number] = {
  action: "mask",
  targets: [{ text: "localhost:3000", exact: false }],
};

function clientBooks(device: DeviceViewport, today: Date): Scenario {
  return defineScenario({
    id: `iker-amaka-client-books-${device}`,
    title: `A client books and reaches the deposit step (${device})`,
    feature: "Public booking page",
    target: "iker",
    status: "unverified",
    viewport: DEVICE_VIEWPORTS[device],
    evidence: evidence(
      'components/public/storefront-listing.tsx ("Add <service> to your booking", "Continue")',
      'lib/booking/booking-stages.ts ("Choose your services", "Pick a date & time", "Your details", "Pay & confirm")',
      'Walked at 390x844 and 1180x820 on 2026-11-15 against the local seed: "Deposit to pay now", bank details and "Upload proof of payment" on the Pay & confirm step.',
    ),
    prerequisites: [
      ...DASHBOARD_PREREQUISITES,
      AMAKA_PREREQUISITE,
      "Signs in first like every real-product scenario; the public page looks the same to a signed-in visitor. Submits nothing: the take stops on the Pay & confirm step, before a proof is uploaded or the booking is submitted.",
    ],
    preflight: [
      {
        path: PUBLIC_PATH,
        expect: [heading("Amaka Studio"), button("Add Soft glam makeup to your booking")],
      },
    ],
    steps: [
      { action: "authenticate" },
      { action: "navigate", path: PUBLIC_PATH },
      { action: "waitFor", target: heading("Amaka Studio") },
      { action: "dwell", ms: 1500 },
      {
        action: "click",
        target: button("Add Soft glam makeup to your booking"),
        note: "He picks a service",
      },
      { action: "dwell", ms: 900 },
      { action: "click", target: button("Continue") },
      { action: "waitFor", target: heading("Choose your services") },
      { action: "dwell", ms: 700 },
      { action: "click", target: button("Continue") },
      { action: "waitFor", target: heading("Pick a date & time") },
      { action: "dwell", ms: 1000 },
      {
        action: "click",
        target: { role: "button", name: bookingDayName(today), exact: false },
        note: "Then a day",
      },
      { action: "dwell", ms: 700 },
      {
        action: "highlight",
        target: { role: "button", name: "11:00 am", exact: true },
        label: "Only open times",
        holdMs: 1600,
      },
      { action: "click", target: { role: "button", name: "11:00 am", exact: true } },
      { action: "dwell", ms: 600 },
      { action: "click", target: button("Continue") },
      { action: "waitFor", target: heading("Your details") },
      { action: "dwell", ms: 700 },
      { action: "type", target: { label: "Full name", exact: false }, text: "Tunde Adeyemi" },
      { action: "type", target: { label: "Phone number", exact: false }, text: "0800 000 0001" },
      { action: "type", target: { label: "Email", exact: false }, text: "tunde@example.com" },
      { action: "dwell", ms: 600 },
      { action: "click", target: button("Continue") },
      { action: "waitFor", target: heading("Pay & confirm") },
      { action: "dwell", ms: 1200 },
      {
        action: "highlight",
        target: { text: "Account number", exact: false },
        label: "Amaka's bank details",
        holdMs: 2000,
      },
      { action: "screenshot", name: `pay-step-${device}` },
      {
        action: "highlight",
        target: button("Upload proof of payment"),
        label: "Proof of payment",
        holdMs: 2200,
      },
      { action: "dwell", ms: 800 },
    ],
  });
}

function ownerConfirms(device: DeviceViewport): Scenario {
  return defineScenario({
    id: `iker-amaka-confirm-booking-${device}`,
    title: `The owner checks a deposit and confirms the booking (${device})`,
    feature: "Booking detail",
    target: "iker",
    status: "unverified",
    viewport: DEVICE_VIEWPORTS[device],
    evidence: evidence(
      'app/(dashboard)/bookings/[id]/page.tsx ("Paid so far", "Balance remaining", "View proof")',
      'app/(dashboard)/bookings/[id]/booking-detail-sheet.tsx ("Confirm booking", "Reject payment")',
      'Walked at 390x844 and 1180x820 on 2026-11-15 against the local seed: dashboard link "Review payment" opens the booking with "View proof", "Confirm booking" and "Reject payment".',
    ),
    prerequisites: [
      ...DASHBOARD_PREREQUISITES,
      AMAKA_PREREQUISITE,
      "Saves nothing: the take points at Confirm booking and Reject payment but presses neither, so Tunde's demo booking stays awaiting confirmation between takes.",
    ],
    preflight: [{ path: "/dashboard", expect: [link("Review payment →")] }],
    steps: [
      { action: "authenticate" },
      { action: "navigate", path: "/dashboard" },
      MASK_LOCAL_ADDRESS,
      { action: "waitFor", target: heading("Overview") },
      { action: "dwell", ms: 1200 },
      {
        action: "highlight",
        target: link("Review payment →"),
        label: "Waiting for her confirmation",
        holdMs: 1800,
      },
      { action: "click", target: link("Review payment →") },
      { action: "waitForState", condition: { urlIncludes: "/bookings/" } },
      { action: "waitFor", target: heading("Tunde Adeyemi") },
      { action: "dwell", ms: 1200 },
      {
        action: "highlight",
        target: link("View proof"),
        label: "His proof of payment",
        holdMs: 2000,
      },
      {
        action: "highlight",
        target: button("Confirm booking"),
        label: "Confirm booking",
        holdMs: 2400,
      },
      {
        action: "highlight",
        target: button("Reject payment"),
        label: "If the money is not there",
        holdMs: 1400,
      },
      { action: "screenshot", name: `confirm-${device}` },
      { action: "dwell", ms: 800 },
    ],
  });
}

export function ikerAmakaScenarios(today: Date = new Date()): Scenario[] {
  return (["phone", "tablet"] as const).flatMap((device) => [
    clientBooks(device, today),
    ownerConfirms(device),
  ]);
}

export const IKER_AMAKA_SCENARIOS: readonly Scenario[] = ikerAmakaScenarios();
