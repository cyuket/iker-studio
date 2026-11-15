import type { Page } from "playwright";
import { StudioError } from "../../domain/errors";
import type { Scenario } from "../../domain/recording";
import { CAPTURE, TIMEOUTS } from "./pacing";

export interface Capture {
  /** Resolves when the first frame has been encoded: the video's time zero. */
  firstFrame: Promise<void>;
  /** Finalises the video file. */
  stop(): Promise<void>;
}

/**
 * Starts recording the page to a WebM file at exactly the viewport size.
 *
 * `page.screencast` is used instead of the context's `recordVideo` because it can be
 * started after sign-in and preflight on the same page (recordVideo films a page from its
 * creation, which would put the sign-in on camera), it writes to a path we choose, and it
 * records at a chosen frame rate rather than recordVideo's fixed 25 fps.
 */
export async function startCapture(
  page: Page,
  file: string,
  viewport: Scenario["viewport"],
): Promise<Capture> {
  let announceFirstFrame: () => void = () => undefined;
  const firstFrameSeen = new Promise<void>((resolve) => {
    announceFirstFrame = resolve;
  });
  await page.screencast.start({
    path: file,
    size: { width: viewport.width, height: viewport.height },
    quality: CAPTURE.frameQuality,
    fps: CAPTURE.fps,
    onFrame: () => announceFirstFrame(),
  });

  let timer: NodeJS.Timeout | undefined;
  const noFrames = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new StudioError("RECORDING_FAILED", "The browser produced no video frames."));
    }, TIMEOUTS.firstFrameMs);
  });
  // Until someone awaits it, a rejection here must not count as unhandled.
  const firstFrame = Promise.race([firstFrameSeen, noFrames]).finally(() => clearTimeout(timer));
  firstFrame.catch(() => undefined);

  return { firstFrame, stop: () => page.screencast.stop() };
}
