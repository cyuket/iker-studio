import type { Step } from "../../domain/recording";

/** Steps that set the scene without showing the viewer anything worth watching. */
const SETUP_ACTIONS: ReadonlySet<Step["action"]> = new Set([
  "authenticate",
  "navigate",
  "waitFor",
  "waitForState",
  "mask",
  "dismiss",
]);

/**
 * How many steps at the start of a scenario run before the capture begins. Running the
 * opening navigation, waits and masks off camera means the video opens on a settled page
 * with its masks already in place, instead of on a blank tab and a loading spinner.
 */
export function countLeadingSetupSteps(steps: readonly Step[]): number {
  const firstVisible = steps.findIndex((step) => !SETUP_ACTIONS.has(step.action));
  return firstVisible === -1 ? steps.length : firstVisible;
}
