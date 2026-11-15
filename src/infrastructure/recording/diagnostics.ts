import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { Logger } from "../../application/ports";
import { errorMessage } from "../../domain/errors";
import { withoutQuery } from "./urls";

export interface FailureContext {
  /** Zero-based step index, or null when the failure happened before the steps began. */
  stepIndex: number | null;
  /** The step's action, or the phase that failed ("sign-in", "preflight"). */
  action: string;
  targetDescription: string | null;
}

export interface DiagnosticsRequest {
  page: Page;
  debugDir: string;
  scenarioId: string;
  context: FailureContext;
  error: unknown;
  redact: (text: string) => string;
  logger: Logger;
}

/**
 * Covers every field that could be showing a password. The type check alone is not enough:
 * a "show password" toggle turns the field into a text input.
 */
async function saveScreenshot(page: Page, file: string): Promise<void> {
  await page.screenshot({
    path: file,
    mask: [page.locator('input[type="password"]'), page.getByLabel(/password/i)],
    maskColor: "#0f172a",
  });
}

function summarise(request: DiagnosticsRequest): string {
  const { context, redact } = request;
  return [
    `scenario: ${request.scenarioId}`,
    `step: ${context.stepIndex === null ? "(before the first step)" : String(context.stepIndex + 1)}`,
    `action: ${context.action}`,
    `target: ${context.targetDescription ?? "(none)"}`,
    `url: ${redact(withoutQuery(request.page.url()))}`,
    "",
    "error:",
    redact(errorMessage(request.error)),
    "",
  ].join("\n");
}

/**
 * Leaves behind just enough to see why a recording failed: one screenshot and a short text
 * summary. Deliberately no trace, HAR or console dump, because those capture request
 * bodies, cookies and tokens.
 */
export async function writeFailureDiagnostics(request: DiagnosticsRequest): Promise<void> {
  try {
    await mkdir(request.debugDir, { recursive: true });
    await writeFile(path.join(request.debugDir, "failure.txt"), summarise(request), "utf8");
    await saveScreenshot(request.page, path.join(request.debugDir, "failure.png"));
  } catch (error) {
    // Diagnostics are a courtesy; failing to write them must not hide the original error.
    request.logger.warn("Could not save recording diagnostics", {
      reason: request.redact(errorMessage(error)).split("\n")[0],
    });
  }
}
