import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";
import { button, DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, evidence } from "./iker-shared";

/**
 * The public booking page a client opens from the business's link, /[businessSlug]. It
 * needs no account; the scenario still signs in first like every real-product scenario, and
 * nothing on the page changes for a signed-in visitor.
 */

/** The active business that supabase/seed.sql creates locally. */
const PUBLIC_PATH = "/test-salon";
const ADD_BOX_BRAIDS = {
  role: "button",
  name: "Add Box braids to your booking",
  exact: true,
} as const;

export const ikerPublicBookingPage: Scenario = defineScenario({
  id: "iker-public-booking-page",
  title: "What a client sees on the business's booking link",
  feature: "Public booking page",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    "app/(public)/[businessSlug]/page.tsx (one route for the whole journey, the stage in the query string)",
    'components/public/storefront-listing.tsx (business name heading, "Services", "Service categories", "Add <service> to your booking", "Continue")',
    'lib/booking/booking-stages.ts (default stage titles "Choose your services", "Pick a date & time", "Your details", "Pay & confirm")',
    "next.config.ts (old /<slug>/book/<id> and /<slug>/booking/<token> links redirect here)",
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    "The path is /test-salon, the slug of the business supabase/seed.sql creates locally. On staging, change PUBLIC_PATH in src/scenarios/iker-public.ts to the demo business's slug.",
    "Submits nothing: the take adds a service and stops before choosing a time. A submitted booking would create a real booking request for the business to confirm.",
  ],
  preflight: [
    { path: PUBLIC_PATH, expect: [{ role: "heading", name: "Services" }, ADD_BOX_BRAIDS] },
  ],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: PUBLIC_PATH },
    { action: "waitFor", target: { role: "heading", name: "Services" } },
    { action: "dwell", ms: 1500 },
    {
      action: "highlight",
      target: { role: "heading", name: "Services" },
      label: "The business's rate card, for clients",
      holdMs: 2400,
    },
    { action: "screenshot", name: "booking-page" },
    { action: "click", target: ADD_BOX_BRAIDS, note: "The client picks a service" },
    { action: "dwell", ms: 1000 },
    {
      action: "highlight",
      target: button("Continue"),
      label: "Then a time, their details, and the deposit",
      holdMs: 2400,
    },
    { action: "screenshot", name: "service-chosen" },
  ],
});

export const IKER_PUBLIC_SCENARIOS: readonly Scenario[] = [ikerPublicBookingPage];
