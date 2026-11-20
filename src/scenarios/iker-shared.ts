import type { ScenarioInput, Target } from "../domain/recording";

/**
 * Shared by every scenario for the real Iker business dashboard. All of them are
 * `unverified`: their routes and labels were read from the web app's source code and have
 * not yet been run against a live environment. File paths in each scenario's `evidence`
 * are relative to the slot-books repository. Route groups such as `(dashboard)` do not
 * appear in URLs, so `apps/web/app/(dashboard)/bookings/new/page.tsx` is served at
 * `/bookings/new`.
 */

export const DASHBOARD_PREREQUISITES: readonly string[] = [
  "Record a local copy of the web app (http://localhost:3000, the slot-books dev server) or a staging deployment with seeded demo data. Production, useiker.com and every subdomain of it, is refused before a browser opens.",
  "A business owner demo account that logs in with a password, without two-factor authentication. Its email and password come from IKER_DEMO_USERNAME and IKER_DEMO_PASSWORD and never appear in a scenario. Locally, supabase/seed.sql creates the owner of the active business 'Test Salon' (slug test-salon).",
  "A single-location business, so sign-in does not stop at /choose-location and the location switcher is not set to all locations (several pages hide their add buttons under all locations).",
  "Only seeded demo data on screen: clients named like 'Sample Client A' with example.com email addresses. Review every capture for personal data before using it.",
  "These scenarios sign in as a business owner. Platform Admin and Super Admin screens (/overview, /businesses, /admins, /plans) are never recorded with a business's financial data on screen.",
];

/**
 * supabase/seed.sql creates only the business and its owner. Scenarios that show bookings,
 * the rate card or money need this extra demo data, seeded by hand or by a script.
 */
export const DEMO_DATA_PREREQUISITE =
  "Demo data seeded beyond supabase/seed.sql: rate card items including 'Box braids' (₦45,000, 30% deposit required), weekly hours, and a confirmed booking for 'Sample Client A' in the current week with a balance still to pay.";

/** Steps that would save or send something in a real workspace are left out on purpose. */
export const READ_ONLY_PREREQUISITE =
  "Saves nothing: the take opens forms and dialogs to explain them, then closes them with Escape without submitting.";

/** Sign-in happens off camera; these steps put the settled page in front of the viewer. */
/**
 * The sidebar's plan card ("<plan> plan"). The demo business sits on a plan Iker does not sell,
 * whose name a business cannot read, so the card falls back to "Free plan". Iker is not free,
 * so dashboard footage blurs the card.
 */
export const PLAN_CARD: Target = { text: "Free plan", exact: true };

export function openPage(
  path: string,
  heading: string,
  masks: readonly Target[] = [],
): ScenarioInput["steps"] {
  return [
    { action: "authenticate" },
    ...(masks.length > 0 ? [{ action: "mask" as const, targets: [...masks] }] : []),
    { action: "navigate", path },
    { action: "waitFor", target: { role: "heading", name: heading, exact: true } },
    { action: "dwell", ms: 1200 },
  ];
}

export const heading = (name: string): Target => ({ role: "heading", name, exact: true });
export const button = (name: string): Target => ({ role: "button", name, exact: true });
export const link = (name: string): Target => ({ role: "link", name, exact: true });

const SIGN_IN_EVIDENCE =
  'Sign-in: apps/web/app/login/login-form.tsx (button "Use a password instead", labels "Email" and "Password", button "Log in"); signed-out dashboard routes redirect to /login (apps/web/lib/supabase/middleware.ts).';

export const evidence = (...sources: string[]): string =>
  [...sources.map((source) => `apps/web/${source}`), SIGN_IN_EVIDENCE].join(" ");
