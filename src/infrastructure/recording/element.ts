import type { Locator } from "playwright";
import { TIMEOUTS } from "./pacing";
import type { Box } from "./timeline";

interface SettleOptions {
  /** Scroll the element to the middle even when it is already on screen. */
  alwaysCentre: boolean;
  /** Distance from the viewport edge inside which an element counts as cut off. */
  margin: number;
  stableFrames: number;
  maxFrames: number;
}

/**
 * Runs in the page. Scrolls the element into view with the page's own smooth scrolling and
 * resolves with its bounds once they have stopped changing. Waiting on the element rather
 * than on a delay is what keeps recordings stable when a page animates its scroll.
 */
function scrollIntoViewAndSettle(element: Element, options: SettleOptions): Promise<Box> {
  const start = element.getBoundingClientRect();
  const cutOff =
    start.top < options.margin ||
    start.left < 0 ||
    start.bottom > window.innerHeight - options.margin ||
    start.right > window.innerWidth;
  if (options.alwaysCentre || cutOff) {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
  return new Promise((resolve, reject) => {
    let previous = start;
    let stable = 0;
    let frames = 0;
    const check = (): void => {
      const box = element.getBoundingClientRect();
      const moved =
        box.x !== previous.x ||
        box.y !== previous.y ||
        box.width !== previous.width ||
        box.height !== previous.height;
      stable = moved ? 0 : stable + 1;
      previous = box;
      frames += 1;
      if (stable >= options.stableFrames) {
        resolve({ x: box.x, y: box.y, width: box.width, height: box.height });
      } else if (frames >= options.maxFrames) {
        reject(new Error("The element kept moving and never came to rest."));
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

/**
 * Waits for the element to be visible, brings it on screen and returns its resting bounds
 * in viewport pixels.
 */
export async function settleInView(locator: Locator, alwaysCentre = false): Promise<Box> {
  await locator.waitFor({ state: "visible", timeout: TIMEOUTS.elementMs });
  return locator.evaluate(scrollIntoViewAndSettle, {
    alwaysCentre,
    // Keeps targets clear of fixed headers and footers, which sit over the page edges.
    margin: 72,
    // Smooth scrolling starts a frame or two after it is requested; six still frames
    // (about 100 ms) means it has both started and finished.
    stableFrames: 6,
    maxFrames: 600,
  });
}

/** Bounds of an element that is already on screen, without scrolling it. */
export async function visibleBox(locator: Locator): Promise<Box | null> {
  return locator.boundingBox({ timeout: TIMEOUTS.elementMs });
}
