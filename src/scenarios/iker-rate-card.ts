import type { Scenario } from "../domain/recording";
import { defineScenario } from "./define";
import {
  button,
  DASHBOARD_PREREQUISITES,
  DEMO_DATA_PREREQUISITE,
  evidence,
  heading,
  openPage,
  PLAN_CARD,
  READ_ONLY_PREREQUISITE,
} from "./iker-shared";

/** What the business sells: the rate card of services, and packages built from it. */

const EDIT_ITEM_DIALOG = { role: "dialog", name: "Edit rate card item", exact: true } as const;

export const ikerRateCard: Scenario = defineScenario({
  id: "iker-rate-card",
  title: "The rate card: prices, durations and deposits",
  feature: "Rate card",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/services/page.tsx (heading "Rate card"; "Packages" is a Base UI Button rendering a Link, so its role is button)',
    'app/(dashboard)/services/service-row-actions.tsx (row button "Edit", dialog "Edit rate card item"; the phone list keeps its Edit inside a closed action sheet)',
    'app/(dashboard)/services/service-form-fields.tsx (steps Basics, Pricing, Showcase, Details; "Continue"; "Price (₦)" and "Deposit required (%)" on Pricing; hidden steps stay mounted)',
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, READ_ONLY_PREREQUISITE],
  preflight: [
    {
      path: "/services",
      expect: [heading("Rate card"), button("+ Add item"), button("Packages")],
    },
  ],
  steps: [
    ...openPage("/services", "Rate card", [PLAN_CARD]),
    {
      action: "highlight",
      // services/page.tsx renders the hidden phone list (services-mobile.tsx) before the desktop
      // list, so at this desktop viewport the visible name is the second match.
      target: { text: "Soft glam makeup", nth: 1 },
      label: "Each item has a price and a deposit",
      holdMs: 2400,
    },
    { action: "screenshot", name: "rate-card" },
    // Edit, not "+ Add item": the form is a four-step wizard and a new item cannot reach Pricing
    // without a name and package. The first visible row is Soft glam makeup. Nothing is saved.
    { action: "click", target: { role: "button", name: "Edit", exact: true, nth: 0 } },
    { action: "waitFor", target: EDIT_ITEM_DIALOG },
    { action: "dwell", ms: 800 },
    {
      action: "click",
      target: { role: "button", name: "Continue", exact: true, within: EDIT_ITEM_DIALOG },
    },
    { action: "waitFor", target: { label: "Price (₦)", within: EDIT_ITEM_DIALOG } },
    {
      action: "highlight",
      target: { label: "Price (₦)", within: EDIT_ITEM_DIALOG },
      label: "The full price",
      holdMs: 1800,
    },
    {
      action: "highlight",
      target: { label: "Deposit required (%)", within: EDIT_ITEM_DIALOG },
      label: "The share paid upfront",
      holdMs: 2200,
    },
    { action: "screenshot", name: "rate-card-pricing" },
    // Escape does not close this dialog in the demo app; its X button (sr-only "Close",
    // components/ui/dialog.tsx) does, without saving.
    {
      action: "click",
      target: { role: "button", name: "Close", exact: true, within: EDIT_ITEM_DIALOG },
    },
    { action: "waitFor", target: EDIT_ITEM_DIALOG, state: "hidden" },
    {
      action: "highlight",
      target: button("Packages"),
      label: "Bundle items into packages",
      holdMs: 1600,
    },
  ],
});

export const ikerPackages: Scenario = defineScenario({
  id: "iker-packages",
  title: "Packages and their booking flows",
  feature: "Packages",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/packages/page.tsx (heading "Packages", "Your packages", badges "Published", "Draft", "No booking flow yet")',
  ),
  prerequisites: [
    ...DASHBOARD_PREREQUISITES,
    'At least one package in the demo business, so the list is not the "No packages yet" empty state.',
    READ_ONLY_PREREQUISITE,
  ],
  preflight: [{ path: "/packages", expect: [heading("Packages")] }],
  steps: [
    ...openPage("/packages", "Packages", [PLAN_CARD]),
    {
      action: "highlight",
      target: { text: "Your packages", exact: true },
      label: "Each package and its booking flow",
      holdMs: 2600,
    },
    { action: "screenshot", name: "packages" },
    { action: "dwell", ms: 800 },
  ],
});

export const IKER_RATE_CARD_SCENARIOS: readonly Scenario[] = [ikerRateCard, ikerPackages];
