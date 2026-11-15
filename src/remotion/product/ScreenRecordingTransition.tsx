import type { ReactNode } from "react";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { MOTION } from "../design/tokens";
import { handoffTransform } from "../lib/product-layout";

export interface ScreenRecordingTransitionProps {
  /** Eased 0-1 progress of the handoff. */
  progress: number;
  /** The element of the outgoing graphic that becomes the footage, in the parent's pixels. */
  from: Rect;
  /** Where that element lands on the footage, in the parent's pixels. */
  to: Rect;
  /** Everything the outgoing graphic draws, in the parent's pixels. */
  bounds: Rect;
  /** The outgoing motion graphic. */
  outgoing: ReactNode;
  /** The incoming product footage. */
  children: ReactNode;
  reducedMotion: boolean;
}

/**
 * A motion graphic handing over to real footage. The graphic collapses onto the place in
 * the recording where the thing it illustrated actually is, and the footage resolves around
 * that place: the idea becomes the product without the eye having to look anywhere new. It
 * is a matched-position crossfade with scale continuity, not a morph, because shapes that
 * pretend to turn into an interface would be drawing a product that does not exist.
 */
export function ScreenRecordingTransition({
  progress,
  from,
  to,
  bounds,
  outgoing,
  children,
  reducedMotion,
}: ScreenRecordingTransitionProps): ReactNode {
  const state = handoffTransform(from, to, progress, bounds);
  const landing = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  return (
    <>
      {state.incoming > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: state.incoming,
            transformOrigin: `${landing.x}px ${landing.y}px`,
            scale: reducedMotion ? "1" : String(mix(MOTION.scale.enterFrom, 1, progress)),
          }}
        >
          {children}
        </div>
      ) : null}
      {state.outgoing > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: state.outgoing,
            transformOrigin: `${from.x + from.width / 2}px ${from.y + from.height / 2}px`,
            translate: reducedMotion ? "0px 0px" : `${state.translateX}px ${state.translateY}px`,
            scale: reducedMotion ? "1" : String(state.scale),
          }}
        >
          {outgoing}
        </div>
      ) : null}
    </>
  );
}
