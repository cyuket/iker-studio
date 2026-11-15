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
} from "./iker-shared";

/** The customer list Iker builds from bookings, and the promotional emails sent to it. */

const CUSTOMER_DATA =
  "Every customer in the demo business is a seeded sample (names like 'Sample Client A', example.com email addresses, placeholder phone numbers). The Contact column shows them in full.";
const CAMPAIGN_PLAN =
  'The demo business\'s plan includes promotional email; without it /customers/campaigns/new redirects back and "Promotional campaigns" opens an upgrade prompt instead.';

export const ikerCustomers: Scenario = defineScenario({
  id: "iker-customers",
  title: "The customer list, built from bookings",
  feature: "Customers",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/customers/page.tsx (heading "Customers", "Your customers", columns "Name", "Contact", "Visits", "Last visit", "Marketing emails", "Promotional campaigns")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    CUSTOMER_DATA,
    "Saves nothing: the marketing email opt-out switches are shown, never toggled.",
  ],
  preflight: [
    {
      path: "/customers",
      expect: [heading("Customers"), { role: "row", name: "Sample Client A" }],
    },
  ],
  steps: [
    ...openPage("/customers", "Customers"),
    {
      action: "highlight",
      target: { role: "row", name: "Sample Client A" },
      label: "Added automatically from bookings",
      holdMs: 2400,
    },
    {
      action: "highlight",
      target: { role: "columnheader", name: "Visits", exact: true },
      label: "How often they come back",
      holdMs: 1800,
    },
    { action: "screenshot", name: "customers" },
    {
      action: "highlight",
      target: link("Promotional campaigns"),
      label: "Email them an offer",
      holdMs: 1800,
    },
  ],
});

export const ikerCampaigns: Scenario = defineScenario({
  id: "iker-campaigns",
  title: "Write a promotional email campaign",
  feature: "Promotional campaigns",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/customers/campaigns/page.tsx (heading "Promotional campaigns", "New campaign", "Campaign history")',
    'app/(dashboard)/customers/campaigns/new/page.tsx (heading "New campaign")',
    'app/(dashboard)/customers/campaigns/new/campaign-composer.tsx ("Subject", "Audience", "Template", "Booking button", "Message", "Send now", "Schedule", "Save draft")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    DEMO_DATA_PREREQUISITE,
    CAMPAIGN_PLAN,
    'Sends and saves nothing: the take types a subject and shows the send buttons, but never presses "Send now", "Schedule" or "Save draft". Sending would email every customer in the audience.',
  ],
  preflight: [
    { path: "/customers/campaigns", expect: [heading("Promotional campaigns")] },
    { path: "/customers/campaigns/new", expect: [heading("New campaign")] },
  ],
  steps: [
    ...openPage("/customers/campaigns", "Promotional campaigns"),
    {
      action: "highlight",
      target: { text: "Campaign history", exact: true },
      label: "Every campaign sent or scheduled",
      holdMs: 2000,
    },
    { action: "click", target: link("New campaign") },
    { action: "waitForState", condition: { urlIncludes: "/customers/campaigns/new" } },
    { action: "waitFor", target: heading("New campaign") },
    { action: "dwell", ms: 1000 },
    {
      action: "type",
      target: { label: "Subject", exact: true },
      text: "20% off braids this weekend",
      note: "Write the subject",
    },
    {
      action: "highlight",
      target: { text: "Audience", exact: true },
      label: "Everyone, or only some customers",
      holdMs: 2200,
    },
    { action: "screenshot", name: "new-campaign" },
    {
      action: "highlight",
      target: button("Send now"),
      label: "Send now or schedule it",
      holdMs: 1800,
    },
  ],
});

export const IKER_CUSTOMER_SCENARIOS: readonly Scenario[] = [ikerCustomers, ikerCampaigns];
