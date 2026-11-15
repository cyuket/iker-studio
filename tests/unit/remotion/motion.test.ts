import { describe, expect, it } from "vitest";
import {
  enterProgress,
  exitOpacity,
  progressAt,
  revealTransform,
  sceneTiming,
  staggerSchedule,
} from "../../../src/remotion/design/motion";

describe("sceneTiming", () => {
  it("uses the token durations for a normal scene", () => {
    const timing = sceneTiming(150, 30);
    expect(timing).toEqual({
      enterFrames: 18,
      exitFrames: 10,
      leadFrames: 2,
      exitStart: 139,
      lastFrame: 149,
    });
  });

  it("shrinks the envelope for a very short scene instead of overlapping it", () => {
    const timing = sceneTiming(12, 30);
    expect(timing.enterFrames + timing.exitFrames).toBeLessThan(12);
    expect(timing.exitStart).toBeGreaterThan(timing.leadFrames);
  });
});

describe("scene envelope", () => {
  const timing = sceneTiming(150, 30);

  it("shows nothing on the first frame, whatever the element's start", () => {
    expect(enterProgress(0, timing.leadFrames, timing.enterFrames)).toBe(0);
    expect(enterProgress(0, 0, timing.enterFrames)).toBe(0);
  });

  it("is fully settled after the entrance", () => {
    expect(
      enterProgress(timing.leadFrames + timing.enterFrames, timing.leadFrames, timing.enterFrames),
    ).toBe(1);
    expect(enterProgress(400, timing.leadFrames, timing.enterFrames)).toBe(1);
  });

  it("decelerates: more than half the movement happens in the first half", () => {
    expect(enterProgress(9, 0, 18)).toBeGreaterThan(0.5);
  });

  it("holds full opacity through the body and reaches exactly zero on the last frame", () => {
    expect(exitOpacity(0, timing)).toBe(1);
    expect(exitOpacity(timing.exitStart, timing)).toBe(1);
    expect(exitOpacity(timing.lastFrame, timing)).toBe(0);
    expect(exitOpacity(timing.lastFrame - 1, timing)).toBeGreaterThan(0);
  });

  it("treats a one-frame scene as bare background", () => {
    expect(exitOpacity(0, sceneTiming(1, 30))).toBe(0);
  });
});

describe("staggerSchedule", () => {
  it("returns nothing for an empty list", () => {
    expect(staggerSchedule({ count: 0, durationFrames: 150, fps: 30 })).toEqual([]);
  });

  it("starts a single item right after the lead-in", () => {
    expect(staggerSchedule({ count: 1, durationFrames: 150, fps: 30 })).toEqual([2]);
  });

  it("is strictly increasing and evenly spaced", () => {
    const starts = staggerSchedule({ count: 4, durationFrames: 240, fps: 30 });
    const steps = starts.slice(1).map((start, i) => start - (starts[i] ?? 0));
    expect(new Set(steps).size).toBe(1);
    expect(steps[0]).toBeGreaterThan(0);
  });

  it("spreads items further apart in a longer scene, up to the cap", () => {
    const short = staggerSchedule({ count: 4, durationFrames: 120, fps: 30 });
    const long = staggerSchedule({ count: 4, durationFrames: 300, fps: 30 });
    const veryLong = staggerSchedule({
      count: 4,
      durationFrames: 3000,
      fps: 30,
      maxStepSeconds: 1.5,
    });
    expect((long[1] ?? 0) - (long[0] ?? 0)).toBeGreaterThan((short[1] ?? 0) - (short[0] ?? 0));
    expect((veryLong[1] ?? 0) - (veryLong[0] ?? 0)).toBe(45);
  });

  it("lands the last item with at least a second left to read before the exit", () => {
    for (const durationFrames of [90, 150, 240, 600]) {
      const timing = sceneTiming(durationFrames, 30);
      const starts = staggerSchedule({ count: 5, durationFrames, fps: 30 });
      expect((starts.at(-1) ?? 0) + timing.enterFrames + 30).toBeLessThanOrEqual(timing.exitStart);
    }
  });

  it("honours an explicit start frame", () => {
    expect(staggerSchedule({ count: 3, durationFrames: 240, fps: 30, startFrame: 20 })[0]).toBe(20);
  });

  it("is deterministic", () => {
    const options = { count: 5, durationFrames: 213, fps: 30 };
    expect(staggerSchedule(options)).toEqual(staggerSchedule(options));
  });
});

describe("revealTransform", () => {
  it("rises into place by default", () => {
    expect(revealTransform(0, "rise", false, 20)).toEqual({ opacity: 0, translateY: 20 });
    expect(revealTransform(1, "rise", false, 20)).toEqual({ opacity: 1, translateY: 0 });
  });

  it("drops all movement for reduced motion and for the fade entrance", () => {
    expect(revealTransform(0.3, "rise", true, 20)).toEqual({ opacity: 0.3, translateY: 0 });
    expect(revealTransform(0.3, "fade", false, 20)).toEqual({ opacity: 0.3, translateY: 0 });
  });
});

describe("progressAt", () => {
  it("runs from the scene's start fraction to its end fraction", () => {
    expect(progressAt(0, 100, 0.25, 0.5)).toBe(0.25);
    expect(progressAt(99, 100, 0.25, 0.5)).toBe(0.5);
  });

  it("joins consecutive scenes without a jump", () => {
    expect(progressAt(59, 60, 0, 0.4)).toBe(progressAt(0, 90, 0.4, 1));
  });

  it("clamps out-of-range input", () => {
    expect(progressAt(500, 100, 0.9, 1.4)).toBe(1);
    expect(progressAt(-5, 100, 0.2, 0.4)).toBe(0.2);
  });
});
