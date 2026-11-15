import { describe, expect, it } from "vitest";
import { directionConcerns, reviewFrames } from "../../../src/application/scene-review";
import { SceneSchema, type Scene } from "../../../src/domain/storyboard";

function scene(overrides: Record<string, unknown> = {}): Scene {
  return SceneSchema.parse({
    id: "hook",
    type: "PROBLEM",
    narration: "A user signs up twice.",
    estimatedDurationSeconds: 4,
    visual: { kind: "statement", headline: "Twice" },
    ...overrides,
  });
}

describe("reviewFrames", () => {
  it("looks at the beginning, the middle and the ending when a scene has no beats", () => {
    const frames = reviewFrames(300, 30, {});
    expect(frames.map((frame) => frame.label)).toEqual(["beginning", "middle", "ending"]);
    expect(frames[0]?.frame).toBe(36);
    expect(frames[2]?.frame).toBe(299 - 27);
    expect(frames[1]?.frame).toBeGreaterThan(frames[0]?.frame ?? 0);
  });

  it("looks just after each beat, in time order, so the frame shows what the beat did", () => {
    const frames = reviewFrames(300, 30, { connect: 6, appear: 2 });
    expect(frames.map((frame) => frame.label)).toEqual([
      "beginning",
      "beat: appear",
      "beat: connect",
      "ending",
    ]);
    expect(frames[1]?.frame).toBe(Math.round(2.6 * 30));
    expect(frames[2]?.frame).toBe(Math.round(6.6 * 30));
  });

  it("ignores beats that fall inside the entrance or the exit", () => {
    const frames = reviewFrames(300, 30, { early: 0.1, late: 9.8 });
    expect(frames.map((frame) => frame.label)).toEqual(["beginning", "middle", "ending"]);
  });

  it("keeps an even spread when there are many beats", () => {
    const beats = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`b${i}`, 2 + i]));
    const frames = reviewFrames(450, 30, beats);
    expect(frames.length).toBeLessThanOrEqual(6);
    expect(frames.at(-2)?.label).not.toBe("beat: b1");
  });

  it("never asks for a frame outside a very short scene", () => {
    for (const frame of reviewFrames(12, 30, { only: 0.2 })) {
      expect(frame.frame).toBeGreaterThanOrEqual(0);
      expect(frame.frame).toBeLessThanOrEqual(11);
    }
  });
});

describe("directionConcerns", () => {
  it("asks for an objective, a final frame and cues when a narrated scene has none", () => {
    const concerns = directionConcerns(scene(), undefined);
    expect(concerns.join(" ")).toMatch(/objective/);
    expect(concerns.join(" ")).toMatch(/final frame/);
    expect(concerns.join(" ")).toMatch(/tied to the narration/);
  });

  it("asks how a scene connects to the one before it", () => {
    expect(directionConcerns(scene(), scene({ id: "previous" })).join(" ")).toMatch(
      /connect to the one before/,
    );
    expect(directionConcerns(scene(), undefined).join(" ")).not.toMatch(
      /connect to the one before/,
    );
  });

  it("does not ask a silent scene for narration cues", () => {
    expect(directionConcerns(scene({ narration: "" }), undefined).join(" ")).not.toMatch(
      /tied to the narration/,
    );
  });

  it("flags a recording that plays with no camera direction", () => {
    const product = scene({ visual: { kind: "product", scenarioId: "flow" } });
    expect(directionConcerns(product, undefined).join(" ")).toMatch(/static camera/);
  });
});
