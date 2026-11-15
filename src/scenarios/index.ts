import type { Scenario } from "../domain/recording";
import { IKER_SCENARIOS } from "./iker";
import { SYNTHETIC_SCENARIOS } from "./synthetic";

/** Every scenario the studio can record. */
export const SCENARIOS: readonly Scenario[] = [...SYNTHETIC_SCENARIOS, ...IKER_SCENARIOS];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
