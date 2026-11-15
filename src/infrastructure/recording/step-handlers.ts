import path from "node:path";
import type { Locator, Page } from "playwright";
import type { Step } from "../../domain/recording";
import { settleInView, visibleBox } from "./element";
import { resolveTarget } from "./locators";
import type { MaskRegistry } from "./masks";
import {
  centreOf,
  highlightElement,
  moveCursor,
  pressCursor,
  restingPointOf,
  setCursorVisible,
} from "./overlay";
import { PACING, TIMEOUTS } from "./pacing";
import type { Box } from "./timeline";
import { resolveScenarioUrl } from "./urls";

export interface StepContext {
  page: Page;
  origin: string;
  screenshotsDir: string;
  /** Filled in by screenshot steps: step name to absolute file path. */
  screenshots: Record<string, string>;
  masks: MaskRegistry;
}

type StepOf<A extends Step["action"]> = Extract<Step, { action: A }>;

/** Brings the element on screen, glides the cursor to its centre and shows the press. */
async function pointAndPress(page: Page, locator: Locator): Promise<Box> {
  const box = await settleInView(locator);
  await moveCursor(page, centreOf(box));
  await pressCursor(page);
  return box;
}

async function navigate(step: StepOf<"navigate">, context: StepContext): Promise<null> {
  const url = resolveScenarioUrl(context.origin, step.path);
  await context.page.goto(url, { waitUntil: "load", timeout: TIMEOUTS.navigationMs });
  return null;
}

async function click(step: StepOf<"click">, { page }: StepContext): Promise<Box> {
  const locator = resolveTarget(page, step.target);
  const box = await pointAndPress(page, locator);
  await locator.click({ timeout: TIMEOUTS.elementMs });
  return box;
}

async function type(step: StepOf<"type">, { page }: StepContext): Promise<Box> {
  const locator = resolveTarget(page, step.target);
  const box = await pointAndPress(page, locator);
  await locator.click({ timeout: TIMEOUTS.elementMs });
  if (step.replace) await locator.fill("");
  await locator.pressSequentially(step.text, { delay: PACING.keyDelayMs });
  return box;
}

/** Clicks the target if it shows up in time. Its absence is expected, not an error. */
async function dismiss(step: StepOf<"dismiss">, { page }: StepContext): Promise<null> {
  const locator = resolveTarget(page, step.target);
  const appeared = await locator
    .waitFor({ state: "visible", timeout: step.waitMs })
    .then(() => true)
    .catch(() => false);
  if (appeared) await locator.click({ timeout: TIMEOUTS.elementMs });
  return null;
}

/**
 * Native <select> elements are set directly, because their option list is drawn by the
 * operating system and cannot be clicked. Custom listboxes are opened and the option is
 * clicked like any other element.
 */
async function select(step: StepOf<"select">, { page }: StepContext): Promise<Box> {
  const locator = resolveTarget(page, step.target);
  const box = await pointAndPress(page, locator);
  const isNative = await locator.evaluate((element) => element instanceof HTMLSelectElement);
  if (isNative) {
    await locator.selectOption({ label: step.option }, { timeout: TIMEOUTS.elementMs });
    return box;
  }
  await locator.click({ timeout: TIMEOUTS.elementMs });
  const option = page.getByRole("option", { name: step.option, exact: true });
  await pointAndPress(page, option);
  await option.click({ timeout: TIMEOUTS.elementMs });
  return box;
}

async function scroll(step: StepOf<"scroll">, { page }: StepContext): Promise<Box> {
  return settleInView(resolveTarget(page, step.target), true);
}

async function waitFor(step: StepOf<"waitFor">, { page }: StepContext): Promise<Box | null> {
  const locator = resolveTarget(page, step.target);
  await locator.waitFor({ state: step.state, timeout: TIMEOUTS.elementMs });
  return step.state === "visible" ? visibleBox(locator) : null;
}

async function waitForState(step: StepOf<"waitForState">, { page }: StepContext): Promise<null> {
  const { condition } = step;
  if ("urlIncludes" in condition) {
    const fragment = condition.urlIncludes;
    await page.waitForURL((url) => url.href.includes(fragment), { timeout: TIMEOUTS.navigationMs });
  } else if ("textVisible" in condition) {
    const text = page.getByText(condition.textVisible).first();
    await text.waitFor({ state: "visible", timeout: TIMEOUTS.elementMs });
  } else {
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.navigationMs });
  }
  return null;
}

async function highlight(step: StepOf<"highlight">, { page }: StepContext): Promise<Box> {
  const locator = resolveTarget(page, step.target);
  const box = await settleInView(locator);
  await moveCursor(page, restingPointOf(box));
  await highlightElement(locator, step.label ?? null, step.holdMs);
  return box;
}

/** Stills are composited separately from the video, so they are taken without the cursor. */
async function screenshot(step: StepOf<"screenshot">, context: StepContext): Promise<null> {
  const file = path.join(context.screenshotsDir, `${step.name}.png`);
  await setCursorVisible(context.page, false);
  try {
    await context.page.screenshot({ path: file, type: "png", scale: "device" });
  } finally {
    await setCursorVisible(context.page, true);
  }
  context.screenshots[step.name] = file;
  return null;
}

async function mask(step: StepOf<"mask">, context: StepContext): Promise<null> {
  await context.masks.add(step.targets);
  return null;
}

async function verify(step: StepOf<"verify">, { page }: StepContext): Promise<Box | null> {
  const target = resolveTarget(page, step.target);
  const locator =
    step.containsText === undefined ? target : target.filter({ hasText: step.containsText });
  await locator.waitFor({ state: "visible", timeout: TIMEOUTS.elementMs });
  return visibleBox(locator);
}

/** A point inside a box, given as fractions of its size; the centre when omitted. */
function pointIn(box: Box, at: { x: number; y: number } | undefined) {
  if (at === undefined) return centreOf(box);
  return { x: box.x + box.width * at.x, y: box.y + box.height * at.y };
}

/** The element itself, or its nearest ancestor with the given role. */
function closest(locator: Locator, role: string | undefined): Locator {
  if (role === undefined) return locator;
  return locator.locator(`xpath=ancestor-or-self::*[@role="${role}"][1]`);
}

/**
 * Presses at the grab point, glides to the drop point in small moves so the page sees a real
 * drag, and releases. The on-screen cursor follows the same path.
 */
async function drag(step: StepOf<"drag">, { page }: StepContext): Promise<Box> {
  const fromBox = await settleInView(closest(resolveTarget(page, step.from), step.fromClosest));
  const toBox = await settleInView(closest(resolveTarget(page, step.to), step.toClosest));
  const start = pointIn(fromBox, step.fromPoint);
  const end = pointIn(toBox, step.toPoint);
  await moveCursor(page, start);
  await pressCursor(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: PACING.dragSteps });
  await moveCursor(page, end);
  await page.mouse.up();
  return toBox;
}

async function press(step: StepOf<"press">, { page }: StepContext): Promise<null> {
  await page.keyboard.press(step.key);
  return null;
}

/** The one timed wait: it holds the picture for the viewer and waits for nothing. */
async function dwell(step: StepOf<"dwell">, { page }: StepContext): Promise<null> {
  await page.waitForTimeout(step.ms);
  return null;
}

/**
 * Performs one step and returns the bounds of the element it acted on, if any.
 * `authenticate` does nothing here: sign-in has already happened off camera, before any
 * step ran, so that credentials can never appear in the capture.
 */
export async function runStep(step: Step, context: StepContext): Promise<Box | null> {
  switch (step.action) {
    case "navigate":
      return navigate(step, context);
    case "authenticate":
      return null;
    case "click":
      return click(step, context);
    case "type":
      return type(step, context);
    case "dismiss":
      return dismiss(step, context);
    case "select":
      return select(step, context);
    case "scroll":
      return scroll(step, context);
    case "waitFor":
      return waitFor(step, context);
    case "waitForState":
      return waitForState(step, context);
    case "highlight":
      return highlight(step, context);
    case "screenshot":
      return screenshot(step, context);
    case "mask":
      return mask(step, context);
    case "verify":
      return verify(step, context);
    case "drag":
      return drag(step, context);
    case "press":
      return press(step, context);
    case "dwell":
      return dwell(step, context);
  }
}
