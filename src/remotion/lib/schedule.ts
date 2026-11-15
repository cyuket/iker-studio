import { SETTLED_FRAME, isSettled } from "../design/motion";

export interface ScheduleStep {
  /** Name the component looks the step up by. */
  key: string;
  /** Cue that starts the step. A step without one is placed between its neighbours. */
  cue?: string | undefined;
}

export interface ScheduleOptions {
  /** Frame at which each cue of the scene fires. */
  beats: Readonly<Record<string, number>>;
  /** Cues that are complete before the scene starts. */
  settled: readonly string[];
  /** Earliest frame an uncued step may start on. */
  startFrame: number;
  /** Latest frame an uncued step may start on. */
  endFrame: number;
  /** Gap between uncued steps that trail the last cued one. */
  autoGapFrames: number;
  /** The scene opens on a finished composition: steps nothing ties to a moment are settled. */
  hold: boolean;
}

/**
 * Start frame for every step of an ordered sequence. Cued steps start on their beat;
 * settled ones are complete from the first frame; steps without a cue are spaced evenly
 * between the cued steps around them, so a sequence with a few cues still unfolds in order
 * and one with none paces itself across the scene.
 */
export function resolveSchedule(
  steps: readonly ScheduleStep[],
  options: ScheduleOptions,
): Record<string, number> {
  const { beats, startFrame, autoGapFrames, hold } = options;
  const endFrame = Math.max(startFrame, options.endFrame);
  const settled = new Set(options.settled);
  const anchors: (number | null)[] = steps.map((step) => {
    if (step.cue === undefined) return null;
    if (settled.has(step.cue)) return SETTLED_FRAME;
    return beats[step.cue] ?? null;
  });
  const frames = anchors.slice();
  const anchored = anchors.some((frame) => frame !== null);

  let i = 0;
  while (i < steps.length) {
    if (frames[i] !== null) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < steps.length && anchors[j] === null) j += 1;
    const count = j - i;
    const before = i > 0 ? (frames[i - 1] ?? null) : null;
    const after = j < steps.length ? (anchors[j] ?? null) : null;
    for (let k = 0; k < count; k += 1) {
      let frame: number;
      if (!anchored) {
        // Nothing is tied to the voice: pace the whole sequence across the scene.
        const gap = count > 1 ? (endFrame - startFrame) / (count - 1) : 0;
        frame = hold ? SETTLED_FRAME : startFrame + k * Math.min(gap, autoGapFrames * 3);
      } else if (after !== null && isSettled(after)) {
        frame = SETTLED_FRAME;
      } else if (after !== null) {
        const from = before === null || isSettled(before) ? startFrame : before;
        const leading = before === null;
        // Before the first cue the run starts at once; between two cues it sits inside them.
        const t = leading ? k / count : (k + 1) / (count + 1);
        frame = from + (after - from) * t;
      } else if (before !== null && isSettled(before)) {
        frame = hold ? SETTLED_FRAME : startFrame + k * autoGapFrames;
      } else {
        frame = Math.min(endFrame, (before ?? startFrame) + (k + 1) * autoGapFrames);
      }
      frames[i + k] = isSettled(frame) ? SETTLED_FRAME : Math.round(frame);
    }
    i = j;
  }

  const schedule: Record<string, number> = {};
  steps.forEach((step, index) => {
    schedule[step.key] = frames[index] ?? startFrame;
  });
  return schedule;
}

/**
 * Start frame of something nested in a step: its own cue when it has one, otherwise a fixed
 * delay after its parent. A settled parent settles its uncued children.
 */
export function childStart(
  cue: string | undefined,
  beats: Readonly<Record<string, number>>,
  settled: readonly string[],
  parentStart: number,
  delayFrames: number,
): number {
  if (cue !== undefined) {
    if (settled.includes(cue)) return SETTLED_FRAME;
    const beat = beats[cue];
    if (beat !== undefined) return beat;
  }
  return isSettled(parentStart) ? SETTLED_FRAME : parentStart + delayFrames;
}
