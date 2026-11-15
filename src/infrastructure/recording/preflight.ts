import type { Page } from "playwright";
import { isOnSignInScreen } from "./sign-in";
import { StudioError } from "../../domain/errors";
import { describeTarget, type Scenario, type Target } from "../../domain/recording";
import { resolveTarget } from "./locators";
import { TIMEOUTS } from "./pacing";
import { resolveScenarioUrl } from "./urls";

async function assertPresent(page: Page, path: string, target: Target): Promise<void> {
  try {
    await resolveTarget(page, target).waitFor({ state: "visible", timeout: TIMEOUTS.elementMs });
  } catch (cause) {
    const landedOnSignIn = isOnSignInScreen(new URL(page.url()).pathname);
    throw new StudioError(
      "RECORDING_FAILED",
      `Preflight failed on ${path}: ${describeTarget(target)} is not visible (or matches more than one element).`,
      {
        hint: landedOnSignIn
          ? "The page redirected to sign-in. Add an authenticate step to the scenario, or check the demo account."
          : "Check that the environment has the data and features this scenario lists as prerequisites, and that the element's name still matches the product.",
        cause,
      },
    );
  }
}

/**
 * Visits every page the scenario depends on, off camera, and confirms its key elements
 * exist. Finding a renamed button here costs seconds; finding it mid-recording wastes the
 * whole take.
 */
export async function runPreflight(
  page: Page,
  origin: string,
  checks: Scenario["preflight"],
): Promise<void> {
  for (const check of checks) {
    await page.goto(resolveScenarioUrl(origin, check.path), { timeout: TIMEOUTS.navigationMs });
    for (const target of check.expect) await assertPresent(page, check.path, target);
  }
}
