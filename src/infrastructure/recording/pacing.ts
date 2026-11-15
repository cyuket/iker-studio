/**
 * Every duration the recorder controls. They are fixed rather than randomised so the same
 * scenario produces the same video twice, and none of them is used to wait for the
 * application: application state is always awaited through an element or page condition.
 */
export const PACING = {
  /** Cursor travel time grows with distance between these bounds. */
  cursorMinMs: 380,
  cursorMaxMs: 950,
  cursorMsPerPixel: 0.85,
  /** Ripple drawn under the cursor when it presses. */
  pressMs: 260,
  /** Intermediate pointer moves in a drag, so the page sees motion rather than a jump. */
  dragSteps: 24,
  /** Per-key delay for visible typing. */
  keyDelayMs: 55,
  highlightFadeMs: 220,
  /**
   * Held after the last step so the encoder receives the frame showing its result. Without
   * it the capture can end one frame early, on the state before the final action landed.
   */
  captureTailMs: 300,
} as const;

/** How long an element or page condition may take before the step fails. */
export const TIMEOUTS = {
  elementMs: 15_000,
  navigationMs: 30_000,
  signInMs: 30_000,
  firstFrameMs: 10_000,
} as const;

export const CAPTURE = {
  fps: 30,
  /** JPEG quality of the frames Chromium hands to the encoder; 100 keeps text edges clean. */
  frameQuality: 100,
  /**
   * The screencast is always encoded at CSS-pixel size, so this does not change the video.
   * It doubles the resolution of still screenshots, which scenes zoom into.
   */
  deviceScaleFactor: 2,
} as const;
