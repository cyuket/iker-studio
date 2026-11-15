import type { BrowserContext, Locator, Page } from "playwright";
import { StudioError } from "../../domain/errors";
import { overlayPageScript, type OverlayConfig } from "./overlay-script";
import { PACING } from "./pacing";
import type { Box } from "./timeline";

export const MASK_ATTRIBUTE = "data-studio-mask";
export const MASK_SWEEP_FUNCTION = "__studioMaskSweep";

/** Default ring and label colour: the Iker primary from brand/brand.json. */
export const DEFAULT_ACCENT_COLOUR = "#e05a38";

export interface Point {
  x: number;
  y: number;
}

/**
 * Some TypeScript runners wrap named functions in a `__name` helper that exists only in
 * Node. The overlay is serialised into the page, so the page needs a stand-in for it.
 */
const NAME_HELPER_SHIM = "globalThis.__name ??= (value) => value;";

/** Injects the cursor and highlight layer into every document the context loads. */
export async function installOverlay(context: BrowserContext, accentColour: string): Promise<void> {
  const config: OverlayConfig = {
    cursorStorageKey: "__studio_cursor",
    maskAttribute: MASK_ATTRIBUTE,
    maskSweepFunction: MASK_SWEEP_FUNCTION,
    accentColour,
    cursorMinMs: PACING.cursorMinMs,
    cursorMaxMs: PACING.cursorMaxMs,
    cursorMsPerPixel: PACING.cursorMsPerPixel,
    pressMs: PACING.pressMs,
    highlightFadeMs: PACING.highlightFadeMs,
  };
  await context.addInitScript(NAME_HELPER_SHIM);
  await context.addInitScript(overlayPageScript, config);
}

function assertInjected(injected: boolean): void {
  if (injected) return;
  throw new StudioError("RECORDING_FAILED", "The cursor overlay is missing from the page.", {
    hint: "The page may block injected scripts (for example with a strict Content-Security-Policy).",
  });
}

export const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/**
 * Where the cursor rests while an element is highlighted: just under its lower right
 * corner, outside the ring, so the pointer indicates the element without covering it.
 */
export const restingPointOf = (box: Box): Point => ({
  x: box.x + box.width - Math.min(28, box.width / 4),
  y: box.y + box.height + 12,
});

export async function moveCursor(page: Page, point: Point): Promise<void> {
  const injected = await page.evaluate(async ({ x, y }) => {
    if (!window.__studioOverlay) return false;
    await window.__studioOverlay.moveCursor(x, y);
    return true;
  }, point);
  assertInjected(injected);
}

export async function pressCursor(page: Page): Promise<void> {
  const injected = await page.evaluate(async () => {
    if (!window.__studioOverlay) return false;
    await window.__studioOverlay.press();
    return true;
  });
  assertInjected(injected);
}

export async function setCursorVisible(page: Page, visible: boolean): Promise<void> {
  const injected = await page.evaluate((show) => {
    if (!window.__studioOverlay) return false;
    window.__studioOverlay.setCursorVisible(show);
    // Resolve after the next paint so a screenshot taken straight away sees the change.
    return new Promise<boolean>((resolve) => requestAnimationFrame(() => resolve(true)));
  }, visible);
  assertInjected(injected);
}

export async function highlightElement(
  locator: Locator,
  label: string | null,
  holdMs: number,
): Promise<void> {
  const injected = await locator.evaluate(
    async (element, options) => {
      if (!window.__studioOverlay) return false;
      await window.__studioOverlay.highlight(element, options.label, options.holdMs);
      return true;
    },
    { label, holdMs },
  );
  assertInjected(injected);
}
