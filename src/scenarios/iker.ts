import type { Scenario } from "../domain/recording";
import { IKER_ACCOUNTING_SCENARIOS } from "./iker-accounting";
import { IKER_BOOKING_SCENARIOS } from "./iker-bookings";
import { IKER_CUSTOMER_SCENARIOS } from "./iker-customers";
import { IKER_PAYMENT_SCENARIOS } from "./iker-payments";
import { IKER_PUBLIC_SCENARIOS } from "./iker-public";
import { IKER_RATE_CARD_SCENARIOS } from "./iker-rate-card";
import { IKER_SETTINGS_SCENARIOS } from "./iker-settings";

/**
 * Scenarios for the real Iker web app (slot-books apps/web). All are unverified: written
 * from source, not yet run against a local copy or staging. See iker-shared.ts.
 */
export const IKER_SCENARIOS: readonly Scenario[] = [
  ...IKER_BOOKING_SCENARIOS,
  ...IKER_PAYMENT_SCENARIOS,
  ...IKER_RATE_CARD_SCENARIOS,
  ...IKER_ACCOUNTING_SCENARIOS,
  ...IKER_CUSTOMER_SCENARIOS,
  ...IKER_PUBLIC_SCENARIOS,
  ...IKER_SETTINGS_SCENARIOS,
];
