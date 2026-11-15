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

/** What the business sells: the rate card of services, and packages built from it. */

const ADD_ITEM_DIALOG = { role: "dialog", name: "Add rate card item", exact: true } as const;

export const ikerRateCard: Scenario = defineScenario({
  id: "iker-rate-card",
  title: "The rate card: prices, durations and deposits",
  feature: "Rate card",
  target: "iker",
  status: "unverified",
  evidence: evidence(
    'app/(dashboard)/services/page.tsx (heading "Rate card", "Packages")',
    'app/(dashboard)/services/new-service-dialog.tsx ("+ Add item", dialog "Add rate card item")',
    'app/(dashboard)/services/service-form-fields.tsx ("Name", "Duration", "Price (₦)", "Deposit required (%)")',
  ),
  prerequisites: [...DASHBOARD_PREREQUISITES, DEMO_DATA_PREREQUISITE, READ_ONLY_PREREQUISITE],
  preflight: [
    {
      path: "/services",
      expect: [heading("Rate card"), button("+ Add item"), link("Packages")],
    },
  ],
  steps: [
    ...openPage("/services", "Rate card"),
    {
      action: "highlight",
      target: { text: "Box braids", nth: 0 },
      label: "Each item has a price and a deposit",
      holdMs: 2400,
    },
    { action: "screenshot", name: "rate-card" },
    { action: "click", target: button("+ Add item") },
    { action: "waitFor", target: ADD_ITEM_DIALOG },
    { action: "dwell", ms: 800 },
    {
      action: "highlight",
      target: { label: "Price (₦)", within: ADD_ITEM_DIALOG },
      label: "The full price",
      holdMs: 1800,
    },
    {
      action: "highlight",
      target: { label: "Deposit required (%)", within: ADD_ITEM_DIALOG },
      label: "The share paid upfront",
      holdMs: 2200,
    },
    { action: "screenshot", name: "add-rate-card-item" },
    { action: "press", key: "Escape" },
    { action: "waitFor", target: ADD_ITEM_DIALOG, state: "hidden" },
    {
      action: "highlight",
      target: link("Packages"),
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
    ...openPage("/packages", "Packages"),
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
