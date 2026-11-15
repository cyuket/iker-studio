import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { enterProgress, revealTransform } from "./motion";
import { MOTION } from "./tokens";
import { useSceneEnvironment } from "./SceneContext";

/** Frames a `none` entrance takes: long enough not to pop, short enough to read as a cut. */
const QUICK_FRAMES = 6;

/**
 * Eased 0-1 progress of an element that starts entering at scene frame `at`. With the
 * `none` entrance every element shares one short fade and ignores its stagger slot.
 */
export function useEnterProgress(at?: number, frames?: number): number {
  const frame = useCurrentFrame();
  const { timing, enter } = useSceneEnvironment();
  // A held entrance continues from the previous scene's last frame: nothing arrives.
  if (enter === "hold") return 1;
  if (enter === "none") {
    return enterProgress(frame, timing.leadFrames, Math.min(QUICK_FRAMES, timing.enterFrames));
  }
  return enterProgress(frame, at ?? timing.leadFrames, frames ?? timing.enterFrames);
}

/** Style for the standard entrance: fade, plus a short rise unless motion is reduced. */
export function useReveal(at?: number, distance: number = MOTION.riseDistance): CSSProperties {
  const { enter, reducedMotion, layout } = useSceneEnvironment();
  const progress = useEnterProgress(at);
  const { opacity, translateY } = revealTransform(
    progress,
    enter,
    reducedMotion,
    layout.u(distance),
  );
  return translateY === 0 ? { opacity } : { opacity, transform: `translateY(${translateY}px)` };
}

/** Start frames for `count` list items paced across the scene. */
export { staggerSchedule } from "./motion";
