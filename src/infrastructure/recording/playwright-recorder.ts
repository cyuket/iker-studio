import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { Logger, Recorder, RecordRequest, RecordResult } from "../../application/ports";
import { errorMessage, StudioError } from "../../domain/errors";
import { describeTarget, type Scenario, type Step } from "../../domain/recording";
import { openBrowserSession } from "./browser-session";
import { startCapture, type Capture } from "./capture";
import { writeFailureDiagnostics, type FailureContext } from "./diagnostics";
import { createMaskRegistry } from "./masks";
import { countLeadingSetupSteps } from "./off-camera";
import { DEFAULT_ACCENT_COLOUR, setCursorVisible } from "./overlay";
import { PACING, TIMEOUTS } from "./pacing";
import { runPreflight } from "./preflight";
import { isOnSignInScreen, signIn, type DemoCredentials } from "./sign-in";
import { runStep, type StepContext } from "./step-handlers";
import { assertSafeRecordingTarget } from "./target-guard";
import { createTimelineRecorder, type TimelineRecorder } from "./timeline";
import { resolveScenarioUrl } from "./urls";
import { assertRecordingContext } from "./workspace-context";

export interface PlaywrightRecorderOptions {
  logger: Logger;
  /** Removes the process's known secrets from any text before it is logged or written. */
  redact: (text: string) => string;
  /** Colour of highlight rings and labels. Defaults to the Iker primary. */
  accentColour?: string;
  /** Millisecond clock, replaceable in tests. */
  nowMs?: () => number;
}

interface RunPaths {
  video: string;
  screenshotsDir: string;
  debugDir: string;
}

const REDACTED = "[redacted]";
const DASHBOARD_HOME = "/dashboard";

function requireCredentials(
  scenario: Scenario,
  request: Pick<RecordRequest, "credentials" | "session">,
): DemoCredentials | null {
  if (!scenario.steps.some((step) => step.action === "authenticate")) return null;
  // A session a person signed in to replaces signing in: there is nothing to type.
  if (request.session) return null;
  const { credentials } = request;
  if (credentials) return credentials;
  throw new StudioError(
    "RECORDING_FAILED",
    `Scenario "${scenario.id}" signs in, but no demo account was provided.`,
    { hint: "Set the demo account's username and password in the environment and try again." },
  );
}

/**
 * The recorder holds the demo account itself, so it removes those exact values from
 * everything it emits rather than relying on the caller's redactor knowing them.
 */
function redactingCredentials(
  redact: (text: string) => string,
  credentials: DemoCredentials | null,
): (text: string) => string {
  if (!credentials) return redact;
  const secrets = [credentials.password, credentials.username].filter((value) => value !== "");
  return (text) => redact(secrets.reduce((out, secret) => out.split(secret).join(REDACTED), text));
}

function describeStepTarget(step: Step): string | null {
  if ("target" in step) return describeTarget(step.target);
  if ("targets" in step) return step.targets.map(describeTarget).join(", ");
  return null;
}

function toRecordingError(
  error: unknown,
  failure: FailureContext,
  debugDir: string,
  redact: (text: string) => string,
): StudioError {
  const debugHint = `A screenshot and summary of the failure are in ${debugDir}`;
  if (error instanceof StudioError) {
    const hint = error.hint === undefined ? debugHint : `${error.hint} ${debugHint}`;
    return new StudioError(error.code, redact(error.message), { hint });
  }
  const where =
    failure.stepIndex === null
      ? failure.action
      : `step ${failure.stepIndex + 1} (${[failure.action, failure.targetDescription].filter(Boolean).join(" ")})`;
  // Playwright appends a multi-line call log; the first line says what went wrong.
  const reason = redact(errorMessage(error).split("\n")[0] ?? "");
  return new StudioError("RECORDING_FAILED", `Recording failed at ${where}: ${reason}`, {
    hint: debugHint,
  });
}

/** Opens the dashboard with a saved session and confirms the session is still valid. */
async function resumeSession(page: Page, origin: string): Promise<void> {
  // The dashboard's home, not the site root: the root of the live host is the public site,
  // which has no workspace switcher to check.
  await page.goto(resolveScenarioUrl(origin, DASHBOARD_HOME), { timeout: TIMEOUTS.navigationMs });
  await page.waitForLoadState("domcontentloaded");
  if (!isOnSignInScreen(new URL(page.url()).pathname)) return;
  throw new StudioError("RECORDING_FAILED", "The saved demo session is no longer signed in.", {
    hint: "Run `pnpm studio demo-login` and sign in again.",
  });
}

interface Access {
  credentials: DemoCredentials | null;
  session: RecordRequest["session"];
  expect: RecordRequest["expect"];
}

/** Signs in and checks the scenario's pages, leaving the browser where sign-in left it. */
async function prepare(
  page: Page,
  origin: string,
  scenario: Scenario,
  access: Access,
  failure: FailureContext,
): Promise<void> {
  if (access.session) {
    failure.action = "resume session";
    await resumeSession(page, origin);
  } else if (access.credentials) {
    failure.action = "sign-in";
    await signIn(page, origin, access.credentials);
  }
  if (access.expect) {
    failure.action = "environment check";
    await assertRecordingContext(page, access.expect);
  }
  if (scenario.preflight.length === 0) return;
  const home = page.url();
  failure.action = "preflight";
  await runPreflight(page, origin, scenario.preflight);
  await page.goto(home, { timeout: TIMEOUTS.navigationMs });
}

async function beginCapture(
  page: Page,
  scenario: Scenario,
  file: string,
  timeline: TimelineRecorder,
): Promise<Capture> {
  const capture = await startCapture(page, file, scenario.viewport);
  // Showing the cursor repaints the page, which guarantees the encoder a first frame even
  // on a page that is otherwise perfectly still.
  await setCursorVisible(page, true);
  await capture.firstFrame;
  timeline.startCapture();
  return capture;
}

async function runSteps(
  scenario: Scenario,
  context: StepContext,
  video: string,
  timeline: TimelineRecorder,
  failure: FailureContext,
  logger: Logger,
): Promise<void> {
  const captureFromStep = countLeadingSetupSteps(scenario.steps);
  let capture: Capture | null = null;
  try {
    for (const [index, step] of scenario.steps.entries()) {
      if (index === captureFromStep)
        capture = await beginCapture(context.page, scenario, video, timeline);
      failure.stepIndex = index;
      failure.action = step.action;
      failure.targetDescription = describeStepTarget(step);
      logger.debug("Recording step", { step: index + 1, action: step.action });
      const finish = timeline.begin(index, step);
      finish(await runStep(step, context));
    }
    // A scenario made only of setup steps still yields a video, of its final page.
    capture ??= await beginCapture(context.page, scenario, video, timeline);
    await context.page.waitForTimeout(PACING.captureTailMs);
    timeline.stopCapture();
  } finally {
    await capture?.stop();
  }
}

/**
 * Records a scenario in Chromium with Playwright: signs in and checks the pages off camera,
 * then films the steps with a drawn cursor and returns the raw capture, the stills and a
 * timeline of what happened when.
 */
export function createPlaywrightRecorder(options: PlaywrightRecorderOptions): Recorder {
  const nowMs = options.nowMs ?? (() => performance.now());

  async function record(request: RecordRequest): Promise<RecordResult> {
    const { scenario } = request;
    const logger = options.logger.child({ scenario: scenario.id });
    // Checked here as well as by the caller: this is the last point before a browser opens.
    const origin = assertSafeRecordingTarget(scenario.target, request.baseUrl);
    const credentials = requireCredentials(scenario, request);
    const redact = redactingCredentials(options.redact, credentials);
    const paths: RunPaths = {
      video: path.join(request.outputDir, "capture.webm"),
      screenshotsDir: path.join(request.outputDir, "screenshots"),
      debugDir: path.join(request.outputDir, "debug"),
    };
    await mkdir(paths.screenshotsDir, { recursive: true });

    const timeline = createTimelineRecorder(scenario, nowMs);
    const failure: FailureContext = { stepIndex: null, action: "start", targetDescription: null };
    const session = await openBrowserSession({
      viewport: scenario.viewport,
      headless: request.headless,
      accentColour: options.accentColour ?? DEFAULT_ACCENT_COLOUR,
      storageStateFile: request.session?.storageStateFile ?? null,
    });
    try {
      const { page } = session;
      const context: StepContext = {
        page,
        origin,
        screenshotsDir: paths.screenshotsDir,
        screenshots: {},
        masks: await createMaskRegistry(page, logger),
      };
      const access: Access = { credentials, session: request.session, expect: request.expect };
      await prepare(page, origin, scenario, access, failure);
      await runSteps(scenario, context, paths.video, timeline, failure, logger);
      if (request.expect) {
        // A take that ended somewhere it should not be is thrown away, not kept.
        failure.action = "environment check after the take";
        await assertRecordingContext(page, request.expect);
      }
      const result = {
        videoFile: paths.video,
        screenshots: context.screenshots,
        timeline: timeline.build(),
      };
      logger.info("Recording finished", { seconds: result.timeline.durationSeconds });
      return result;
    } catch (error) {
      await writeFailureDiagnostics({
        page: session.page,
        debugDir: paths.debugDir,
        scenarioId: scenario.id,
        context: failure,
        error,
        redact,
        logger,
      });
      // A partial capture must never be mistaken for a finished one.
      await rm(paths.video, { force: true });
      const failed = toRecordingError(error, failure, paths.debugDir, redact);
      logger.error("Recording failed", { reason: failed.message });
      throw failed;
    } finally {
      await session.close();
    }
  }

  return { record };
}
