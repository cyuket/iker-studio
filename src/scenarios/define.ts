import { ScenarioSchema, type Scenario, type ScenarioInput } from "../domain/recording";

/** Validates a scenario where it is declared, so a malformed one fails at import, not mid-recording. */
export function defineScenario(input: ScenarioInput): Scenario {
  return ScenarioSchema.parse(input);
}
