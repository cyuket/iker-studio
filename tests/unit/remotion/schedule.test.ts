import { describe, expect, it } from "vitest";
import {
  durationFrames,
  exitOpacity,
  isSettled,
  sceneTiming,
  SETTLED_FRAME,
  springProgress,
  tween,
} from "../../../src/remotion/design/motion";
import { MOTION } from "../../../src/remotion/design/tokens";
import { childStart, resolveSchedule } from "../../../src/remotion/lib/schedule";

const options = {
  beats: { a: 30, c: 90 },
  settled: [] as string[],
  startFrame: 2,
  endFrame: 120,
  autoGapFrames: 15,
  hold: false,
};

describe("resolveSchedule", () => {
  it("starts cued steps on their beat", () => {
    expect(
      resolveSchedule(
        [
          { key: "x", cue: "a" },
          { key: "y", cue: "c" },
        ],
        options,
      ),
    ).toEqual({
      x: 30,
      y: 90,
    });
  });

  it("places uncued steps evenly between the cued steps around them", () => {
    const schedule = resolveSchedule(
      [{ key: "x", cue: "a" }, { key: "m" }, { key: "n" }, { key: "y", cue: "c" }],
      options,
    );
    expect(schedule).toEqual({ x: 30, m: 50, n: 70, y: 90 });
  });

  it("starts a leading run at once and trails a closing run by the auto gap", () => {
    const schedule = resolveSchedule(
      [{ key: "l1" }, { key: "l2" }, { key: "x", cue: "a" }, { key: "t1" }, { key: "t2" }],
      options,
    );
    expect(schedule.l1).toBe(2);
    expect(schedule.l2).toBe(16);
    expect(schedule.t1).toBe(45);
    expect(schedule.t2).toBe(60);
  });

  it("paces a sequence with no cues across the scene, in order", () => {
    const schedule = resolveSchedule([{ key: "a" }, { key: "b" }, { key: "c" }], options);
    expect(schedule.a).toBe(2);
    expect(schedule.b).toBeGreaterThan(schedule.a ?? 0);
    expect(schedule.c).toBeGreaterThan(schedule.b ?? 0);
    expect(schedule.c).toBeLessThanOrEqual(120);
  });

  it("settles settled cues, and the uncued steps before them", () => {
    const schedule = resolveSchedule(
      [{ key: "before" }, { key: "x", cue: "a" }, { key: "between" }, { key: "y", cue: "c" }],
      { ...options, settled: ["a"] },
    );
    expect(isSettled(schedule.before ?? 0)).toBe(true);
    expect(isSettled(schedule.x ?? 0)).toBe(true);
    expect(schedule.between).toBe(46);
    expect(schedule.y).toBe(90);
  });

  it("settles everything nothing ties to a moment when the scene opens held", () => {
    const schedule = resolveSchedule([{ key: "a" }, { key: "b" }], { ...options, hold: true });
    expect(Object.values(schedule).every(isSettled)).toBe(true);
    const mixed = resolveSchedule([{ key: "x", cue: "a" }, { key: "tail" }], {
      ...options,
      settled: ["a"],
      hold: true,
    });
    expect(isSettled(mixed.tail ?? 0)).toBe(true);
  });

  it("treats a cue the scene does not have as uncued", () => {
    const schedule = resolveSchedule(
      [
        { key: "x", cue: "a" },
        { key: "q", cue: "nope" },
      ],
      options,
    );
    expect(schedule.q).toBe(45);
  });
});

describe("childStart", () => {
  it("uses the child's own cue, else follows its parent", () => {
    expect(childStart("a", { a: 40 }, [], 10, 5)).toBe(40);
    expect(childStart(undefined, {}, [], 10, 5)).toBe(15);
    expect(childStart("missing", {}, [], 10, 5)).toBe(15);
  });

  it("is settled when its cue is, or when its parent is", () => {
    expect(childStart("a", { a: 40 }, ["a"], 10, 5)).toBe(SETTLED_FRAME);
    expect(isSettled(childStart(undefined, {}, [], SETTLED_FRAME, 5))).toBe(true);
  });
});

describe("motion vocabulary", () => {
  it("converts token durations to whole frames", () => {
    expect(durationFrames("enter", 30)).toBe(18);
    expect(durationFrames("camera", 30)).toBe(36);
    expect(durationFrames("quick", 1)).toBe(1);
  });

  it("tweens from exactly 0 on the start frame to exactly 1 at the end", () => {
    expect(tween(10, 10, 30, "draw", "move")).toBe(0);
    expect(tween(10 + durationFrames("draw", 30), 10, 30, "draw", "move")).toBe(1);
    expect(tween(500, 10, 30)).toBe(1);
    expect(tween(0, SETTLED_FRAME, 30)).toBe(1);
  });

  it("releases springs at the start frame and brings them to rest at 1", () => {
    expect(springProgress(10, 10, 30, "settle")).toBe(0);
    expect(springProgress(200, 10, 30, "settle")).toBeCloseTo(1, 3);
    expect(springProgress(0, SETTLED_FRAME, 30, "snap")).toBe(1);
    for (let frame = 10; frame < 80; frame += 1) {
      expect(springProgress(frame, 10, 30, "settle")).toBeLessThanOrEqual(1);
      // The stamp may pass 1, but only just: nothing in the vocabulary bounces.
      expect(springProgress(frame, 10, 30, "snap")).toBeLessThan(1.06);
    }
  });

  it("keeps a held exit on screen to the last frame", () => {
    const timing = sceneTiming(150, 30);
    expect(exitOpacity(timing.lastFrame, timing, "hold")).toBe(1);
    expect(exitOpacity(timing.lastFrame, timing, "fade")).toBe(0);
    expect(exitOpacity(0, sceneTiming(1, 30), "hold")).toBe(1);
  });

  it("orders the camera durations and keeps motion blur off", () => {
    expect(MOTION.duration.cameraMin).toBeLessThan(MOTION.duration.camera);
    expect(MOTION.scale.cameraMin).toBeLessThan(MOTION.scale.cameraMax);
    expect(MOTION.motionBlur).toBe("off");
  });
});
