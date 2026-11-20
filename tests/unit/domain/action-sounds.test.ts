import { describe, expect, it } from "vitest";
import {
  ACTION_SOUNDS,
  planActionSounds,
  sceneSecondsFor,
} from "../../../src/domain/action-sounds";
import { footageAnchors, footageTimeAt } from "../../../src/domain/cues";
import type { RecordingTimeline } from "../../../src/domain/recording";
import { SceneVisualSchema, type ProductSceneVisual } from "../../../src/domain/storyboard";

type Event = RecordingTimeline["events"][number];

const product = (extra: Record<string, unknown> = {}): ProductSceneVisual => {
  const visual = SceneVisualSchema.parse({ kind: "product", scenarioId: "demo", ...extra });
  if (visual.kind !== "product") throw new Error("not a product visual");
  return visual;
};

const event = (
  action: string,
  startSeconds: number,
  endSeconds: number,
  extra: Partial<Event> = {},
): Event => ({
  index: 0,
  action,
  startSeconds,
  endSeconds,
  region: null,
  label: null,
  ...extra,
});

const timeline = (events: Event[], width = 1440, durationSeconds = 10): RecordingTimeline => ({
  schemaVersion: 1,
  scenarioId: "demo",
  target: "synthetic",
  viewport: { width, height: 900 },
  durationSeconds,
  events,
});

describe("planActionSounds", () => {
  it("clicks at the logged press, and estimates the press in older recordings", () => {
    const sounds = planActionSounds(
      product(),
      timeline([event("click", 1, 2, { pressSeconds: 1.6 }), event("click", 4, 5)]),
      {},
      10,
    );
    expect(sounds.map((s) => [s.file, s.atSeconds])).toEqual([
      [ACTION_SOUNDS.click.file, 1.6],
      [ACTION_SOUNDS.click.file, 4.65],
    ]);
  });

  it("types like a phone on a phone viewport and like a keyboard on a desktop one", () => {
    const typing = event("type", 1, 3, { pressSeconds: 1.4, keysFromSeconds: 1.7 });
    const phone = planActionSounds(product(), timeline([typing], 390), {}, 10);
    const desktop = planActionSounds(product(), timeline([typing]), {}, 10);
    expect(phone[1]).toMatchObject({ file: ACTION_SOUNDS.typePhone.file, atSeconds: 1.7 });
    expect(phone[1]?.durationSeconds).toBeCloseTo(1.3);
    expect(desktop[1]?.file).toBe(ACTION_SOUNDS.typeDesktop.file);
  });

  it("sweeps on a scroll and taps on a key press, and stays silent on waits and highlights", () => {
    const sounds = planActionSounds(
      product(),
      timeline([
        event("scroll", 1, 1.5),
        event("press", 2, 2.1, { pressSeconds: 2 }),
        event("waitFor", 3, 3.2),
        event("highlight", 3.2, 5),
      ]),
      {},
      10,
    );
    expect(sounds.map((s) => s.file)).toEqual([
      ACTION_SOUNDS.scroll.file,
      ACTION_SOUNDS.press.file,
    ]);
  });

  it("makes no action sounds in a screenshot scene", () => {
    const sounds = planActionSounds(
      product({ mode: "screenshot", screenshot: "overview" }),
      timeline([event("click", 1, 2, { pressSeconds: 1.5 })]),
      {},
      10,
    );
    expect(sounds).toEqual([]);
  });

  it("follows footage that starts late, and drops what the scene never shows", () => {
    const visual = product({ footage: { startSeconds: 2, fromSeconds: 1, toSeconds: 6 } });
    const sounds = planActionSounds(
      visual,
      timeline([
        event("click", 0, 0.8, { pressSeconds: 0.5 }),
        event("click", 3, 4, { pressSeconds: 3.5 }),
        event("click", 7, 8, { pressSeconds: 7.5 }),
      ]),
      {},
      10,
    );
    expect(sounds.map((s) => s.atSeconds)).toEqual([4.5]);
  });

  it("drops sounds after the scene has ended", () => {
    const sounds = planActionSounds(
      product(),
      timeline([event("click", 8, 9, { pressSeconds: 8.5 })]),
      {},
      5,
    );
    expect(sounds).toEqual([]);
  });
});

describe("sceneSecondsFor", () => {
  it("inverts the footage time map", () => {
    const visual = product({
      footage: { startCue: "go", anchors: [{ cue: "there", recordingSeconds: 6 }] },
    });
    const anchors = footageAnchors(visual, { go: 1, there: 3 });
    for (const sceneSeconds of [1.5, 2, 2.9, 4, 6]) {
      const recording = footageTimeAt(anchors, sceneSeconds, 20);
      expect(sceneSecondsFor(anchors, recording)).toBeCloseTo(sceneSeconds);
    }
    expect(sceneSecondsFor(anchors, -1)).toBeNull();
    expect(sceneSecondsFor(null, 2.5)).toBe(2.5);
  });
});
