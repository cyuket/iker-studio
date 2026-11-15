import { useCurrentFrame } from "remotion";
import { durationFrames, isSettled, SETTLED_FRAME, springProgress, tween } from "./motion";
import { useSceneEnvironment } from "./SceneContext";
import { MOTION, type MotionDuration, type MotionEasing, type MotionSpring } from "./tokens";
import { childStart, resolveSchedule, type ScheduleStep } from "../lib/schedule";

/** Frame at which a cue of the current scene fires; null when the scene has no such cue. */
export function useBeat(id: string | undefined): number | null {
  const { beats } = useSceneEnvironment();
  if (id === undefined) return null;
  return beats[id] ?? null;
}

/** True from the frame a cue fires. False for a cue the scene does not have. */
export function useAfterBeat(id: string | undefined): boolean {
  const frame = useCurrentFrame();
  const beat = useBeat(id);
  return beat !== null && frame >= beat;
}

/** Eased 0-1 progress of a change that starts on a cue. 0 for a cue the scene does not have. */
export function useBeatProgress(
  id: string | undefined,
  duration: MotionDuration = "enter",
  easing: MotionEasing = "enter",
): number {
  const frame = useCurrentFrame();
  const { fps } = useSceneEnvironment();
  const beat = useBeat(id);
  return beat === null ? 0 : tween(frame, beat, fps, duration, easing);
}

export interface Motion {
  frame: number;
  fps: number;
  reducedMotion: boolean;
  /** Frame the scene's first content may start on; settled when the scene opens held. */
  start: number;
  /** A token duration in frames. */
  frames: (duration: MotionDuration) => number;
  /** A number of seconds from the token table, in frames. */
  seconds: (seconds: number) => number;
  /** Eased 0-1 progress of a change starting at `startFrame`. */
  tween: (startFrame: number, duration?: MotionDuration, easing?: MotionEasing) => number;
  /** 0-1 progress of a named spring released at `startFrame`. */
  spring: (startFrame: number, name?: MotionSpring) => number;
  /** True once `startFrame` has been reached. */
  after: (startFrame: number) => boolean;
  /** Start frames for an ordered sequence of steps. */
  schedule: (steps: readonly ScheduleStep[], settled: readonly string[]) => Record<string, number>;
  /** Start frame of something nested in a step. */
  child: (
    cue: string | undefined,
    settled: readonly string[],
    parentStart: number,
    delayFrames: number,
  ) => number;
}

/**
 * Everything a motion graphic needs to turn "when" into "how far along": the current
 * frame, the scene's beats and the token table, behind a handful of functions.
 */
export function useMotion(): Motion {
  const frame = useCurrentFrame();
  const {
    fps,
    beats,
    timing,
    enter,
    reducedMotion,
    durationFrames: sceneFrames,
  } = useSceneEnvironment();
  const hold = enter === "hold";
  const start = hold ? SETTLED_FRAME : timing.leadFrames;
  return {
    frame,
    fps,
    reducedMotion,
    start,
    frames: (duration) => durationFrames(duration, fps),
    seconds: (seconds) => Math.round(seconds * fps),
    tween: (startFrame, duration, easing) => tween(frame, startFrame, fps, duration, easing),
    spring: (startFrame, name) => springProgress(frame, startFrame, fps, name),
    after: (startFrame) => isSettled(startFrame) || frame >= startFrame,
    schedule: (steps, settled) =>
      resolveSchedule(steps, {
        beats,
        settled,
        startFrame: timing.leadFrames,
        // Leave time to read the last step before the scene ends.
        endFrame: Math.max(timing.leadFrames, Math.round(sceneFrames * 0.6)),
        autoGapFrames: Math.round(MOTION.stagger.auto * fps),
        hold,
      }),
    child: (cue, settled, parentStart, delayFrames) =>
      childStart(cue, beats, settled, parentStart, delayFrames),
  };
}
