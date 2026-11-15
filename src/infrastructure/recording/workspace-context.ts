import type { Page } from "playwright";
import type { DemoContextExpectation } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { TIMEOUTS } from "./pacing";

/**
 * The dashboard's workspace and environment switcher states both in its accessible name:
 * "Workspace and environment. Workspace: Acme Corp. Environment: Sandbox. Activate to change."
 * (components/dashboard/workspace-context-switcher.tsx in the dashboard repository).
 */
const SWITCHER_SELECTOR = 'button[aria-label^="Workspace and environment."]';
const SWITCHER_FIELDS = /Workspace:\s*(.+?)\.\s*Environment:\s*(.+?)\.\s*Activate to change/;

export interface WorkspaceContext {
  workspace: string;
  environment: string;
}

/** Parses the switcher's accessible name. Returns null when it is not in the expected form. */
export function parseWorkspaceContext(accessibleName: string): WorkspaceContext | null {
  const match = SWITCHER_FIELDS.exec(accessibleName);
  if (!match?.[1] || !match[2]) return null;
  return { workspace: match[1].trim(), environment: match[2].trim() };
}

export async function readWorkspaceContext(page: Page): Promise<WorkspaceContext> {
  // Found by its label attribute, not by role: an open dialog hides the rest of the page
  // from the accessibility tree, and the check must still work then.
  const switcher = page.locator(SWITCHER_SELECTOR).first();
  try {
    await switcher.waitFor({ state: "attached", timeout: TIMEOUTS.elementMs });
  } catch (cause) {
    throw new StudioError(
      "UNSAFE_TARGET",
      "Could not find the workspace and environment switcher, so the environment cannot be confirmed.",
      {
        hint: "Recording stops unless the page shows which workspace and environment it is in. Check that the session is signed in and the dashboard has finished loading.",
        cause,
      },
    );
  }
  const context = parseWorkspaceContext((await switcher.getAttribute("aria-label")) ?? "");
  if (!context) {
    throw new StudioError(
      "UNSAFE_TARGET",
      "The workspace and environment switcher is not in the expected form, so the environment cannot be confirmed.",
      { hint: "The dashboard may have changed. Update workspace-context.ts before recording." },
    );
  }
  return context;
}

/** Pure comparison, so the rule itself is unit-tested without a browser. */
export function contextProblem(
  actual: WorkspaceContext,
  expected: DemoContextExpectation,
): string | null {
  if (actual.environment.toLowerCase() !== expected.environment) {
    return `The dashboard is in the ${actual.environment} environment. Recording is allowed in Sandbox only.`;
  }
  if (expected.workspace !== null && actual.workspace !== expected.workspace) {
    return `The dashboard is in the workspace "${actual.workspace}", not "${expected.workspace}".`;
  }
  return null;
}

/**
 * Stops the take unless the dashboard is in the Sandbox environment and the expected
 * workspace. Called before the capture starts and again when it ends, so a take that
 * drifted somewhere else is discarded rather than kept.
 */
export async function assertRecordingContext(
  page: Page,
  expected: DemoContextExpectation,
): Promise<WorkspaceContext> {
  const actual = await readWorkspaceContext(page);
  const problem = contextProblem(actual, expected);
  if (problem !== null) {
    throw new StudioError("UNSAFE_TARGET", problem, {
      hint: "Run `pnpm studio demo-login`, switch to the right workspace and to Sandbox in the window that opens, and try again.",
    });
  }
  return actual;
}
