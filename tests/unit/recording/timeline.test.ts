import { describe, expect, it } from "vitest";
import { RecordingTimelineSchema, StepSchema, type Step } from "../../../src/domain/recording";
import { countLeadingSetupSteps } from "../../../src/infrastructure/recording/off-camera";
import {
  createTimelineRecorder,
  stepLabel,
  toRegion,
} from "../../../src/infrastructure/recording/timeline";

const VIEWPORT = { width: 1440, height: 900 };
const SCENARIO = { id: "demo", target: "synthetic" as const, viewport: VIEWPORT };
const step = (input: unknown): Step => StepSchema.parse(input);

function fakeClock(startMs = 5_000) {
  let now = startMs;
  return { nowMs: () => now, advance: (ms: number) => (now += ms) };
}

describe("toRegion", () => {
  it("converts pixel bounds to viewport fractions", () => {
    expect(toRegion({ x: 144, y: 90, width: 720, height: 450 }, VIEWPORT)).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.5,
    });
  });

  it("clips a box that runs past the viewport edge", () => {
    expect(toRegion({ x: 1080, y: -90, width: 720, height: 180 }, VIEWPORT)).toEqual({
      x: 0.75,
      y: 0,
      width: 0.25,
      height: 0.1,
    });
  });

  it("returns null for a box that is entirely off screen", () => {
    expect(toRegion({ x: 0, y: 1200, width: 100, height: 50 }, VIEWPORT)).toBeNull();
    expect(toRegion({ x: -300, y: 10, width: 100, height: 50 }, VIEWPORT)).toBeNull();
  });
});

describe("stepLabel", () => {
  it("prefers a highlight's label, then the step note", () => {
    const target = { text: "Match" };
    expect(stepLabel(step({ action: "highlight", target, label: "Look here", note: "n" }))).toBe(
      "Look here",
    );
    expect(stepLabel(step({ action: "highlight", target, note: "Fallback" }))).toBe("Fallback");
    expect(stepLabel(step({ action: "dwell", ms: 500 }))).toBeNull();
  });

  it("never exposes what a type step typed", () => {
    const typing = step({
      action: "type",
      target: { label: "Password" },
      text: "typed-secret-value",
    });
    expect(stepLabel(typing)).toBeNull();
    expect(stepLabel({ ...typing, note: "Enter the value" })).toBe("Enter the value");
  });
});

describe("createTimelineRecorder", () => {
  it("times steps relative to the start of the capture", () => {
    const clock = fakeClock();
    const timeline = createTimelineRecorder(SCENARIO, clock.nowMs);

    timeline.startCapture();
    clock.advance(250);
    const finishClick = timeline.begin(
      3,
      step({ action: "click", target: { role: "button", name: "Go" } }),
    );
    clock.advance(1_200);
    finishClick({ x: 0, y: 0, width: 144, height: 90 });
    const finishDwell = timeline.begin(4, step({ action: "dwell", ms: 500, note: "Read" }));
    clock.advance(500);
    finishDwell(null);
    clock.advance(300);
    timeline.stopCapture();
    clock.advance(9_000);

    expect(timeline.build()).toEqual({
      schemaVersion: 1,
      scenarioId: "demo",
      target: "synthetic",
      viewport: VIEWPORT,
      durationSeconds: 2.25,
      events: [
        {
          index: 3,
          action: "click",
          startSeconds: 0.25,
          endSeconds: 1.45,
          region: { x: 0, y: 0, width: 0.1, height: 0.1 },
          label: null,
        },
        {
          index: 4,
          action: "dwell",
          startSeconds: 1.45,
          endSeconds: 1.95,
          region: null,
          label: "Read",
        },
      ],
    });
  });

  it("reports steps that ran before the capture at zero", () => {
    const clock = fakeClock();
    const timeline = createTimelineRecorder(SCENARIO, clock.nowMs);

    const finish = timeline.begin(0, step({ action: "navigate", path: "/overview" }));
    clock.advance(4_000);
    finish(null);
    timeline.startCapture();
    clock.advance(1_000);
    timeline.stopCapture();

    const built = timeline.build();
    expect(built.events[0]).toMatchObject({ startSeconds: 0, endSeconds: 0 });
    expect(built.durationSeconds).toBe(1);
  });

  it("produces a timeline the domain schema accepts", () => {
    const clock = fakeClock();
    const timeline = createTimelineRecorder(SCENARIO, clock.nowMs);
    timeline.startCapture();
    timeline.begin(0, step({ action: "screenshot", name: "shot" }))(null);
    timeline.stopCapture();
    expect(RecordingTimelineSchema.safeParse(timeline.build()).success).toBe(true);
  });

  it("does not carry typed text into the timeline", () => {
    const timeline = createTimelineRecorder(SCENARIO, fakeClock().nowMs);
    timeline.startCapture();
    timeline.begin(
      0,
      step({ action: "type", target: { label: "Network" }, text: "typed-secret-value" }),
    )(null);
    expect(JSON.stringify(timeline.build())).not.toContain("typed-secret-value");
  });
});

describe("countLeadingSetupSteps", () => {
  const steps = (...actions: unknown[]): Step[] => actions.map(step);
  const target = { role: "heading", name: "Overview" };

  it("counts the opening sign-in, navigation, waits and masks", () => {
    expect(
      countLeadingSetupSteps(
        steps(
          { action: "authenticate" },
          { action: "mask", targets: [{ text: "Email" }] },
          { action: "navigate", path: "/overview" },
          { action: "waitFor", target },
          { action: "dwell", ms: 500 },
          { action: "navigate", path: "/sessions" },
        ),
      ),
    ).toBe(4);
  });

  it("is zero when the scenario opens on something the viewer should see", () => {
    expect(
      countLeadingSetupSteps(steps({ action: "highlight", target }, { action: "authenticate" })),
    ).toBe(0);
  });

  it("covers the whole scenario when it has no visible step", () => {
    expect(
      countLeadingSetupSteps(
        steps({ action: "navigate", path: "/a" }, { action: "waitFor", target }),
      ),
    ).toBe(2);
  });
});
