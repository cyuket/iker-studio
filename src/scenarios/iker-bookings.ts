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

/**
 * The business owner's day: the dashboard overview, the calendar of bookings, a booking's
 * own page, the walk-in form and the hours clients can book.
 */

const CALENDAR_SCHEDULE_PATH = "/calendar?view=schedule";
/** Calendar entries are links named by time, client, service and status. */
const SAMPLE_BOOKING_LINK = { role: "link", name: "Sample Client A", nth: 0 } as const;

export const ikerDashboardOverview: Scenario = defineScenario({
  id: "iker-dashboard-overview",
  title: "The dashboard overview: this month, quick add and today",
  feature: "Dashboard overview",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/dashboard/page.tsx (heading "Overview", "Quick add", "+ Walk-in", "Full business report →")',
    'components/dashboard/overview-stats-band.tsx (section labelled "<month> performance")',
    "app/(dashboard)/layout.tsx (sidebar links)",
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE],
  preflight: [
    {
      path: "/dashboard",
      expect: [heading("Overview"), { text: "Quick add", exact: true }, button("+ Walk-in")],
    },
  ],
  steps: [
    ...openPage("/dashboard", "Overview"),
    {
      action: "highlight",
      target: { role: "region", name: "performance" },
      label: "This month at a glance",
      holdMs: 2600,
    },
    { action: "screenshot", name: "overview" },
    {
      action: "highlight",
      target: { text: "Quick add", exact: true },
      label: "Add a walk-in, income or an expense",
      holdMs: 2200,
    },
    {
      action: "highlight",
      target: link("Full business report →"),
      label: "The full report is one click away",
      holdMs: 1800,
    },
    { action: "dwell", ms: 800 },
  ],
});

export const ikerNewWalkInBooking: Scenario = defineScenario({
  id: "iker-new-walk-in-booking",
  title: "Start a walk-in booking for a customer in front of you",
  feature: "Bookings",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/bookings/new/page.tsx (heading "New walk-in booking")',
    'app/(dashboard)/bookings/new/walk-in-form.tsx (steps Appointment, Customer, Discount, Payment; "Rate card item 1"; "Date & time"; "Pick a date"; "Continue"; "Save booking")',
    'app/(dashboard)/bookings/new/walk-in-stepper.tsx (navigation "Walk-in booking progress")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    'Saves nothing: the take chooses a rate card item and shows the date picker, but never reaches "Save booking". The form needs a date, a free time and the customer\'s phone number before it can be saved, and a saved walk-in would add a real booking and customer.',
  ],
  preflight: [
    {
      path: "/bookings/new",
      expect: [
        heading("New walk-in booking"),
        { label: "Rate card item 1", exact: true },
        button("Pick a date"),
      ],
    },
  ],
  steps: [
    ...openPage("/bookings/new", "New walk-in booking"),
    {
      action: "highlight",
      target: { role: "navigation", name: "Walk-in booking progress" },
      label: "Four short steps",
      holdMs: 2200,
    },
    {
      action: "select",
      target: { label: "Rate card item 1", exact: true },
      option: "Box braids · ₦45,000",
      note: "Choose what they are booking",
    },
    { action: "dwell", ms: 800 },
    {
      action: "highlight",
      target: { text: "Date & time", exact: true },
      label: "Only free times can be picked",
      holdMs: 2200,
    },
    { action: "click", target: button("Pick a date") },
    { action: "dwell", ms: 1200 },
    { action: "screenshot", name: "walk-in-appointment" },
    { action: "press", key: "Escape" },
    { action: "dwell", ms: 800 },
  ],
});

export const ikerCalendar: Scenario = defineScenario({
  id: "iker-calendar",
  title: "The bookings calendar and its views",
  feature: "Calendar",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/calendar/page.tsx (heading "Calendar", "Availability", walk-in dialog)',
    'app/(dashboard)/bookings/new/walk-in-dialog.tsx ("+ Add walk-in")',
    'components/calendar/calendar-toolbar.tsx ("Calendar controls", "Today")',
    'components/calendar/view-select.tsx and lib/calendar/calendar-view.ts ("Calendar view": Schedule, Day, 3 Day, Week, Month)',
    'components/calendar/calendar-side-panel.tsx ("Needs review", "Past appointments to complete")',
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, READ_ONLY_PREREQUISITE],
  preflight: [
    {
      path: "/calendar",
      expect: [heading("Calendar"), { label: "Calendar view" }, button("+ Add walk-in")],
    },
  ],
  steps: [
    ...openPage("/calendar", "Calendar"),
    {
      action: "highlight",
      target: { label: "Calendar controls" },
      label: "Move through the days",
      holdMs: 2000,
    },
    {
      action: "select",
      target: { label: "Calendar view" },
      option: "Week",
      note: "Show the whole week",
    },
    { action: "waitForState", condition: { urlIncludes: "view=week" } },
    { action: "dwell", ms: 1500 },
    { action: "screenshot", name: "calendar-week" },
    {
      action: "highlight",
      target: SAMPLE_BOOKING_LINK,
      label: "Each booking opens its own page",
      holdMs: 2200,
    },
    {
      action: "highlight",
      target: link("Availability"),
      label: "Set when clients can book",
      holdMs: 1800,
    },
    {
      action: "highlight",
      target: button("+ Add walk-in"),
      label: "Add a walk-in from here",
      holdMs: 1800,
    },
    { action: "dwell", ms: 800 },
  ],
});

export const ikerBookingDetail: Scenario = defineScenario({
  id: "iker-booking-detail",
  title: "A booking's page: details, payments and what is still owed",
  feature: "Booking detail",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/bookings/[id]/page.tsx ("Details", "Payments", "Booking price", "Paid so far", "Balance remaining", "Payment status", "Add expense")',
    'app/(dashboard)/bookings/[id]/record-payment-dialog.tsx ("Record a payment")',
    "components/calendar/schedule-view.tsx (schedule entries link to /bookings/<id>)",
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, READ_ONLY_PREREQUISITE],
  preflight: [{ path: CALENDAR_SCHEDULE_PATH, expect: [SAMPLE_BOOKING_LINK] }],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: CALENDAR_SCHEDULE_PATH },
    { action: "waitFor", target: heading("Calendar") },
    { action: "dwell", ms: 1000 },
    { action: "click", target: SAMPLE_BOOKING_LINK },
    { action: "waitForState", condition: { urlIncludes: "/bookings/" } },
    { action: "waitFor", target: heading("Sample Client A") },
    { action: "dwell", ms: 1200 },
    {
      action: "highlight",
      target: { text: "Details", exact: true },
      label: "Who, what and when",
      holdMs: 2000,
    },
    {
      action: "highlight",
      target: { text: "Balance remaining", exact: true },
      label: "What the client still owes",
      holdMs: 2400,
    },
    { action: "screenshot", name: "booking-detail" },
    {
      action: "highlight",
      target: { text: "Payment status", exact: true },
      holdMs: 1600,
    },
    {
      action: "highlight",
      target: button("Record a payment"),
      label: "Record money as it comes in",
      holdMs: 2000,
    },
    { action: "dwell", ms: 800 },
  ],
});

export const ikerAvailability: Scenario = defineScenario({
  id: "iker-availability",
  title: "Set the hours clients can book",
  feature: "Availability",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/availability/page.tsx (heading "Availability", tabs "Weekly hours", "Extended hours", "Buffer & notice", "Blocked dates")',
    'app/(dashboard)/availability/weekly-hours-form.tsx ("Save hours")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    "Weekly hours already set for the demo business.",
    "Saves nothing: the take moves between tabs and never presses a save button.",
  ],
  preflight: [
    {
      path: "/availability",
      expect: [heading("Availability"), { role: "tab", name: "Weekly hours", exact: true }],
    },
  ],
  steps: [
    ...openPage("/availability", "Availability"),
    {
      action: "highlight",
      target: { role: "tab", name: "Weekly hours", exact: true },
      label: "The hours you take bookings",
      holdMs: 2000,
    },
    { action: "screenshot", name: "weekly-hours" },
    { action: "click", target: { role: "tab", name: "Buffer & notice", exact: true } },
    { action: "dwell", ms: 1800 },
    { action: "click", target: { role: "tab", name: "Blocked dates", exact: true } },
    { action: "dwell", ms: 1800 },
    { action: "screenshot", name: "blocked-dates" },
  ],
});

export const IKER_BOOKING_SCENARIOS: readonly Scenario[] = [
  ikerDashboardOverview,
  ikerNewWalkInBooking,
  ikerCalendar,
  ikerBookingDetail,
  ikerAvailability,
];
