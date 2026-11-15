import { Easing, interpolate, spring } from "remotion";
import { MOTION, type MotionDuration, type MotionEasing, type MotionSpring } from "./tokens";

export const easeEnter = Easing.bezier(...MOTION.easing.enter);
export const easeMove = Easing.bezier(...MOTION.easing.move);
export const easeExit = Easing.bezier(...MOTION.easing.exit);
export const easeCamera = Easing.bezier(...MOTION.easing.camera);

/** The named curves of the motion vocabulary, ready to pass to `interpolate`. */
export const EASING: Record<MotionEasing, (t: number) => number> = {
  enter: easeEnter,
  move: easeMove,
  exit: easeExit,
  camera: easeCamera,
};

/**
 * Start frame of something that is already complete on the scene's first frame. Far enough
 * in the past that every tween and spring that starts here has long since come to rest.
 */
export const SETTLED_FRAME = -1_000_000;

export function isSettled(startFrame: number): boolean {
  return startFrame <= SETTLED_FRAME / 2;
}

/** A token duration in whole frames; never less than one. */
export function durationFrames(name: MotionDuration, fps: number): number {
  return Math.max(1, Math.round(MOTION.duration[name] * fps));
}

/**
 * Eased 0-1 progress of a change that starts at `startFrame` and takes a token duration.
 * Exactly 0 up to and including the start frame, exactly 1 once it is over.
 */
export function tween(
  frame: number,
  startFrame: number,
  fps: number,
  duration: MotionDuration = "enter",
  easing: MotionEasing = "enter",
): number {
  if (isSettled(startFrame)) return 1;
  const frames = durationFrames(duration, fps);
  return interpolate(frame, [startFrame, startFrame + frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING[easing],
  });
}

/** 0-1 progress of a named spring released at `startFrame`. Clamped so it never passes 1. */
export function springProgress(
  frame: number,
  startFrame: number,
  fps: number,
  name: MotionSpring = "settle",
): number {
  if (isSettled(startFrame)) return 1;
  if (frame <= startFrame) return 0;
  const value = spring({
    frame: frame - startFrame,
    fps,
    config: { ...MOTION.spring[name], overshootClamping: name !== "snap" },
  });
  // A spring only approaches rest. Once it is closer than anyone could see it is at rest,
  // exactly: a scene that holds its last frame must match a scene that opens settled.
  return Math.abs(value - 1) < REST_THRESHOLD ? 1 : value;
}

const REST_THRESHOLD = 0.0005;

/** Linear blend between two numbers. */
export function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export interface SceneTiming {
  /** Frames one element takes to settle. */
  enterFrames: number;
  /** Frames over which all content fades back to the bare background. */
  exitFrames: number;
  /** Frame at which the first element starts to appear. */
  leadFrames: number;
  /** Frame at which the exit starts. */
  exitStart: number;
  lastFrame: number;
}

/**
 * Scenes are rendered separately and joined with hard cuts, so each one opens and closes
 * on the bare background. Very short scenes shrink the envelope rather than overlap it.
 */
export function sceneTiming(durationFrames: number, fps: number): SceneTiming {
  const lastFrame = Math.max(0, durationFrames - 1);
  const budget = Math.max(1, Math.floor(lastFrame / 3));
  const enterFrames = Math.max(1, Math.min(Math.round(MOTION.enterSeconds * fps), budget));
  const exitFrames = Math.max(1, Math.min(Math.round(MOTION.exitSeconds * fps), budget));
  const leadFrames = Math.min(Math.round(MOTION.leadSeconds * fps), budget);
  return { enterFrames, exitFrames, leadFrames, exitStart: lastFrame - exitFrames, lastFrame };
}

/** 0 until `startFrame`, easing to 1 over `enterFrames`. Exactly 0 on the start frame. */
export function enterProgress(frame: number, startFrame: number, enterFrames: number): number {
  return interpolate(frame, [startFrame, startFrame + Math.max(1, enterFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeEnter,
  });
}

/** 1 for the body of the scene, falling to exactly 0 on its last frame. */
export function exitOpacity(
  frame: number,
  timing: SceneTiming,
  exit: "fade" | "hold" = "fade",
): number {
  // A held exit keeps the finished composition up, for the next scene to continue from.
  if (exit === "hold") return 1;
  if (timing.lastFrame <= 0) return 0;
  return interpolate(frame, [timing.exitStart, timing.lastFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t,
  });
}

export interface StaggerOptions {
  count: number;
  durationFrames: number;
  fps: number;
  /** Frame the first item starts on; defaults to just after the scene's lead-in. */
  startFrame?: number;
  /** Longest gap between consecutive items, in seconds. */
  maxStepSeconds?: number;
  /** Fraction of the scene over which the items are spread. */
  spread?: number;
}

/**
 * Start frames for a list revealed one item at a time. Items are paced across the scene
 * so they keep step with narration instead of arriving at once, while the last item
 * always lands with at least a second left to read it.
 */
export function staggerSchedule(options: StaggerOptions): number[] {
  const { count, durationFrames, fps } = options;
  if (count <= 0) return [];
  const timing = sceneTiming(durationFrames, fps);
  const start = options.startFrame ?? timing.leadFrames;
  const minStep = Math.max(1, Math.round(MOTION.staggerSeconds * fps));
  const maxStep = Math.max(minStep, Math.round((options.maxStepSeconds ?? 1.6) * fps));
  const readFrames = Math.round(fps);
  const latestStart = Math.max(start, timing.exitStart - timing.enterFrames - readFrames);
  const window = Math.min(latestStart - start, (durationFrames - start) * (options.spread ?? 0.55));
  const step =
    count > 1 ? Math.min(maxStep, Math.max(minStep, Math.floor(window / (count - 1)))) : 0;
  const fitted = count > 1 ? Math.min(step, Math.floor((latestStart - start) / (count - 1))) : 0;
  return Array.from({ length: count }, (_, i) => start + i * Math.max(count > 1 ? 1 : 0, fitted));
}

/** `hold` is no entrance at all: the element is in place on the scene's first frame. */
export type RevealMode = "rise" | "fade" | "none" | "hold";

export interface RevealTransform {
  opacity: number;
  translateY: number;
}

/** Reduced motion and `fade` keep the opacity curve but drop all movement. */
export function revealTransform(
  progress: number,
  mode: RevealMode,
  reducedMotion: boolean,
  distance: number,
): RevealTransform {
  const moves = mode === "rise" && !reducedMotion;
  return { opacity: progress, translateY: moves ? (1 - progress) * distance : 0 };
}

/** Position within a scene's share of the cut at `frame`; reaches `end` on the last frame. */
export function progressAt(
  frame: number,
  durationFrames: number,
  start: number,
  end: number,
): number {
  const local = durationFrames <= 1 ? 1 : Math.min(1, Math.max(0, frame / (durationFrames - 1)));
  return Math.min(1, Math.max(0, start + (end - start) * local));
}
