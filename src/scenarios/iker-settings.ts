import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";
import {
  button,
  DASHBOARD_PREREQUISITES,
  evidence,
  heading,
  openPage,
  READ_ONLY_PREREQUISITE,
} from "./iker-shared";

/** Settings: the business profile and payment details, policies, staff and the Iker plan. */

const tab = (name: string) => ({ role: "tab", name, exact: true }) as const;
const INVITE_DIALOG = { role: "dialog", name: "Invite a team member", exact: true } as const;

export const ikerBusinessSettings: Scenario = defineScenario({
  id: "iker-business-settings",
  title: "Business settings: profile and the bank details clients pay into",
  feature: "Business settings",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    "app/(dashboard)/settings/page.tsx (redirects to /settings/business)",
    'app/(dashboard)/settings/business/page.tsx (heading "Business", sections "Profile", "Payment info", "Branding", "Address & phone", "Preferences")',
    'app/(dashboard)/settings/business/business-settings-menu.tsx (tabs in "Business settings sections")',
    'app/(dashboard)/settings/business/bank-details-form.tsx ("Bank", "Account number", "Account name")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    "Bank details on the demo business are placeholders. The account number and account name fields are masked anyway.",
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [{ path: "/settings/business", expect: [heading("Business"), tab("Payment info")] }],
  steps: [
    ...openPage("/settings/business", "Business"),
    { action: "mask", targets: [{ label: "Account number" }, { label: "Account name" }] },
    {
      action: "highlight",
      target: { role: "tablist", name: "Business settings sections" },
      label: "What clients see about you",
      holdMs: 2200,
    },
    { action: "screenshot", name: "business-profile" },
    { action: "click", target: tab("Payment info") },
    { action: "waitFor", target: heading("Payment info") },
    { action: "dwell", ms: 1000 },
    {
      action: "highlight",
      target: heading("Payment info"),
      label: "Where clients send deposits",
      holdMs: 2200,
    },
    { action: "screenshot", name: "payment-info" },
  ],
});

export const ikerPolicies: Scenario = defineScenario({
  id: "iker-policies",
  title: "The policy clients accept before they book",
  feature: "Policies",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/settings/policies/page.tsx (heading "Policy")',
    'components/policies/policy-tab-shell.tsx ("This policy applies to", "Everything I offer", "Version <n>", "Edit policy", "Publish your first policy")',
    'app/(dashboard)/layout.tsx (Settings menu link "Policies" to /settings/policies)',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    "A policy already published for everything the demo business offers, and at least one rate card item, so the scope buttons show.",
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [{ path: "/settings/policies", expect: [heading("Policy"), button("Edit policy")] }],
  steps: [
    ...openPage("/settings/policies", "Policy"),
    {
      action: "highlight",
      target: { role: "group", name: "This policy applies to" },
      label: "One policy, or one per service",
      holdMs: 2400,
    },
    {
      action: "highlight",
      target: { text: "Version", nth: 0 },
      label: "Versioned, so past bookings stay explainable",
      holdMs: 2600,
    },
    { action: "screenshot", name: "policy" },
    {
      action: "highlight",
      target: button("Edit policy"),
      holdMs: 1400,
    },
  ],
});

export const ikerStaff: Scenario = defineScenario({
  id: "iker-staff",
  title: "Invite staff to the business",
  feature: "Staff",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/settings/staff/page.tsx (heading "Staff", "Team", "Who has access to this business.")',
    'app/(dashboard)/settings/staff/invite-staff-dialog.tsx ("+ Invite staff", dialog "Invite a team member", "Full name")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    "Every staff member on the demo business is a sample account with an example.com email address; the Team list shows each email in full.",
    "Saves and sends nothing: the invite dialog is opened and closed with Escape. Sending it would email an invitation.",
  ],
  preflight: [{ path: "/settings/staff", expect: [heading("Staff"), button("+ Invite staff")] }],
  steps: [
    ...openPage("/settings/staff", "Staff"),
    {
      action: "highlight",
      target: { text: "Team", exact: true },
      label: "Who can open this dashboard",
      holdMs: 2200,
    },
    { action: "screenshot", name: "staff" },
    { action: "click", target: button("+ Invite staff") },
    { action: "waitFor", target: INVITE_DIALOG },
    { action: "dwell", ms: 1500 },
    { action: "screenshot", name: "invite-staff" },
    { action: "press", key: "Escape" },
    { action: "waitFor", target: INVITE_DIALOG, state: "hidden" },
  ],
});

export const ikerBilling: Scenario = defineScenario({
  id: "iker-billing",
  title: "Billing: a flat plan price, never a cut of bookings",
  feature: "Billing",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/settings/billing/page.tsx (heading "Billing", "What you pay Iker to run your booking page and books", "Plans", "Payments")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    "Saves and pays nothing: the take never opens checkout or changes the plan.",
  ],
  preflight: [{ path: "/settings/billing", expect: [heading("Billing")] }],
  steps: [
    ...openPage("/settings/billing", "Billing"),
    {
      action: "highlight",
      target: { text: "Iker never takes a cut of your bookings" },
      label: "A flat plan price",
      holdMs: 2600,
    },
    { action: "screenshot", name: "billing" },
    { action: "scroll", target: { text: "Plans", exact: true } },
    { action: "dwell", ms: 2000 },
    { action: "screenshot", name: "plans" },
  ],
});

export const IKER_SETTINGS_SCENARIOS: readonly Scenario[] = [
  ikerBusinessSettings,
  ikerPolicies,
  ikerStaff,
  ikerBilling,
];
