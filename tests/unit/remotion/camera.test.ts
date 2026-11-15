import { describe, expect, it } from "vitest";
import type { RecordingTimeline } from "../../../src/domain/recording";
import type { Region } from "../../../src/domain/storyboard";
import { MOTION } from "../../../src/remotion/design/tokens";
import {
  cameraAt,
  cameraPath,
  focusAt,
  focusSpans,
  frameRegion,
  manualCameraPath,
  viewOf,
  zoomCeiling,
  zoomStateOf,
} from "../../../src/remotion/lib/camera";
import { mapRegion } from "../../../src/remotion/lib/recording";

type Event = RecordingTimeline["events"][number];
const event = (
  action: string,
  startSeconds: number,
  endSeconds: number,
  region: Region | null = null,
): Omit<Event, "index"> => ({ action, startSeconds, endSeconds, region, label: null });
const timeline = (events: Omit<Event, "index">[], durationSeconds = 30): RecordingTimeline => ({
  schemaVersion: 1,
  scenarioId: "t",
  target: "synthetic",
  viewport: { width: 1440, height: 900 },
  durationSeconds,
  events: events.map((entry, index) => ({ ...entry, index })),
});
const VIEWPORT = { aspect: 1.6 };
const OPTIONS = { maxZoom: 2 };
const small = (x: number, y: number): Region => ({ x, y, width: 0.12, height: 0.05 });
const contains = (outer: Region, inner: Region): boolean =>
  inner.x >= outer.x - 1e-9 &&
  inner.y >= outer.y - 1e-9 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-9 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-9;

describe("frameRegion", () => {
  it("never exceeds the maximum zoom and never crops the region", () => {
    for (const region of [
      small(0, 0),
      small(0.88, 0.95),
      small(0.4, 0.5),
      { x: 0.2, y: 0.1, width: 0.5, height: 0.3 },
    ]) {
      const framing = frameRegion(region, 2);
      expect(framing.zoom).toBeGreaterThanOrEqual(1);
      expect(framing.zoom).toBeLessThanOrEqual(2);
      const view = viewOf(framing.zoom, framing.centre);
      expect(contains({ x: 0, y: 0, width: 1, height: 1 }, view)).toBe(true);
      expect(contains(view, region)).toBe(true);
    }
  });

  it("does not zoom on something that already fills the frame", () => {
    expect(frameRegion({ x: 0.1, y: 0.4, width: 0.8, height: 0.1 }, 3).zoom).toBe(1);
  });

  it("maps a region through the framing to where it appears on screen", () => {
    const region = small(0.4, 0.5);
    const framing = frameRegion(region, 2);
    const mapped = mapRegion(region, zoomStateOf(framing.zoom, framing.centre));
    expect(mapped.width).toBeCloseTo(region.width * framing.zoom, 6);
    expect(mapped.x).toBeGreaterThanOrEqual(0);
    expect(mapped.x + mapped.width).toBeLessThanOrEqual(1);
  });
});

describe("zoomCeiling", () => {
  it("is the storyboard's limit unless that would stretch recorded pixels too far", () => {
    expect(zoomCeiling({ maxZoom: 3 }, { aspect: 1.6 })).toBe(3);
    expect(
      zoomCeiling({ maxZoom: 3 }, { aspect: 1.6, displayWidth: 1440, sourceWidth: 1440 }),
    ).toBe(MOTION.scale.upscaleLimit);
    expect(
      zoomCeiling({ maxZoom: 3 }, { aspect: 1.6, displayWidth: 4000, sourceWidth: 1440 }),
    ).toBe(1);
  });
});

describe("cameraPath", () => {
  it("opens on the full frame and stays there when nothing is acted on", () => {
    const path = cameraPath(
      timeline([event("navigate", 0, 0), event("dwell", 0, 4)]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(1);
    expect(path[0]).toMatchObject({ atSeconds: 0, zoom: 1, focus: null });
  });

  it("arrives at a highlighted element shortly before it is highlighted", () => {
    const path = cameraPath(
      timeline([event("highlight", 5, 8, small(0.6, 0.6))]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(2);
    expect(path[1]?.atSeconds).toBeCloseTo(5 - MOTION.camera.leadSeconds, 5);
    expect(path[1]?.zoom).toBe(2);
    expect(path[1]?.moveSeconds).toBe(MOTION.duration.camera);
  });

  it("ignores actions that are not something to look at", () => {
    const path = cameraPath(
      timeline([event("waitFor", 2, 3, small(0.2, 0.2)), event("scroll", 4, 5, small(0.5, 0.5))]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(1);
  });

  it("holds one framing over actions that sit close together", () => {
    const path = cameraPath(
      timeline([
        event("highlight", 5, 8, small(0.4, 0.5)),
        event("highlight", 8, 11, small(0.42, 0.6)),
        event("highlight", 11, 14, small(0.4, 0.44)),
      ]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(2);
    const view = viewOf(path[1]?.zoom ?? 1, path[1]?.centre ?? { x: 0.5, y: 0.5 });
    for (const region of [small(0.4, 0.5), small(0.42, 0.6), small(0.4, 0.44)]) {
      expect(contains(view, region)).toBe(true);
    }
  });

  it("pulls back to the full frame on navigation", () => {
    const path = cameraPath(
      timeline([event("highlight", 3, 5, small(0.2, 0.2)), event("navigate", 9, 9.5)]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path.at(-1)).toMatchObject({ zoom: 1, focus: null });
    expect(path.at(-1)?.atSeconds).toBeGreaterThan(5);
  });

  it("pulls back between subjects that are far apart when there is time", () => {
    const path = cameraPath(
      timeline([
        event("highlight", 3, 5, small(0.05, 0.1)),
        event("highlight", 14, 16, small(0.85, 0.9)),
      ]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path.map((keyframe) => keyframe.zoom)).toEqual([1, 2, 1, 2]);
  });

  it("eases out mid-move instead when there is no time to pull back", () => {
    const path = cameraPath(
      timeline([
        event("highlight", 3, 5, small(0.05, 0.1)),
        event("highlight", 6.2, 8, small(0.85, 0.9)),
      ]),
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(3);
    expect(path[2]?.dipZoom).not.toBeNull();
    const middle = cameraAt(path, (path[2]?.atSeconds ?? 0) - (path[2]?.moveSeconds ?? 0) / 2);
    expect(middle.zoom).toBeLessThan(2);
  });

  it("never makes a move shorter than the minimum, and never moves two ways at once", () => {
    const busy = timeline([
      event("click", 0, 0.7, small(0.1, 0.1)),
      event("click", 1, 1.3, small(0.8, 0.2)),
      event("click", 1.5, 1.8, small(0.2, 0.8)),
      event("highlight", 2, 4, small(0.7, 0.7)),
      event("click", 4.1, 4.4, small(0.1, 0.5)),
      event("highlight", 9, 12, small(0.5, 0.1)),
    ]);
    const path = cameraPath(busy, OPTIONS, VIEWPORT);
    path.slice(1).forEach((keyframe, i) => {
      const previous = path[i];
      expect(keyframe.moveSeconds).toBeGreaterThanOrEqual(MOTION.duration.cameraMin - 1e-9);
      expect(keyframe.moveSeconds).toBeLessThanOrEqual(MOTION.duration.camera + 1e-9);
      expect(keyframe.atSeconds - keyframe.moveSeconds).toBeGreaterThanOrEqual(
        (previous?.atSeconds ?? 0) - 1e-9,
      );
      expect(keyframe.zoom).toBeLessThanOrEqual(OPTIONS.maxZoom);
    });
  });

  it("merges near-identical framings instead of jittering between them", () => {
    const path = cameraPath(
      timeline([
        event("highlight", 3, 5, small(0.4, 0.5)),
        event("navigate", 5, 5),
        event("highlight", 5.1, 8, small(0.41, 0.51)),
      ]),
      { maxZoom: 2 },
      VIEWPORT,
    );
    expect(path.filter((keyframe) => keyframe.zoom > 1).length).toBeLessThanOrEqual(2);
  });

  it("keeps every framed region whole while the camera is at rest on it", () => {
    const regions = [small(0.02, 0.9), small(0.86, 0.02), small(0.45, 0.45)];
    const path = cameraPath(
      timeline(regions.map((region, i) => event("highlight", 4 + i * 8, 8 + i * 8, region))),
      OPTIONS,
      VIEWPORT,
    );
    regions.forEach((region, i) => {
      const sample = cameraAt(path, 6 + i * 8);
      expect(contains(sample.view, region)).toBe(true);
    });
  });
});

describe("cameraAt", () => {
  const path = cameraPath(timeline([event("highlight", 5, 8, small(0.6, 0.6))]), OPTIONS, VIEWPORT);

  it("is on the opening framing before the first move and at rest after it", () => {
    expect(cameraAt(path, 0).zoom).toBe(1);
    expect(cameraAt(path, 3).zoom).toBe(1);
    expect(cameraAt(path, 5).zoom).toBeCloseTo(2, 6);
    expect(cameraAt(path, 29).zoom).toBeCloseTo(2, 6);
  });

  it("moves monotonically and stays inside the recording on the way", () => {
    let previous = 1;
    for (let t = 3; t <= 5; t += 0.05) {
      const sample = cameraAt(path, t);
      expect(sample.zoom).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(contains({ x: 0, y: 0, width: 1, height: 1 }, sample.view)).toBe(true);
      previous = sample.zoom;
    }
  });

  it("can cut instead of travelling", () => {
    const step = (t: number): number => (t < 1 ? 0 : 1);
    const arrival = path[1]?.atSeconds ?? 0;
    expect(cameraAt(path, arrival - 0.1, step).zoom).toBe(1);
    expect(cameraAt(path, arrival, step).zoom).toBeCloseTo(2, 6);
  });
});

describe("manualCameraPath", () => {
  it("arrives at each stop at its time and returns to the full frame on a null region", () => {
    const path = manualCameraPath(
      [
        { atSeconds: 4, region: small(0.3, 0.3) },
        { atSeconds: 9, region: null },
      ],
      OPTIONS,
      VIEWPORT,
    );
    expect(path.map((keyframe) => [keyframe.atSeconds, keyframe.zoom])).toEqual([
      [0, 1],
      [4, 2],
      [9, 1],
    ]);
  });

  it("honours a lower zoom but never a higher one than the region allows", () => {
    const [, gentle] = manualCameraPath(
      [{ atSeconds: 4, region: small(0.3, 0.3), zoom: 1.4 }],
      OPTIONS,
      VIEWPORT,
    );
    expect(gentle?.zoom).toBeCloseTo(1.4, 6);
    const [, greedy] = manualCameraPath(
      [{ atSeconds: 4, region: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, zoom: 4 }],
      { maxZoom: 4 },
      VIEWPORT,
    );
    expect(
      viewOf(greedy?.zoom ?? 1, greedy?.centre ?? { x: 0, y: 0 }).width,
    ).toBeGreaterThanOrEqual(0.5);
  });

  it("replaces a stop that comes too soon after the last one", () => {
    const path = manualCameraPath(
      [
        { atSeconds: 4, region: small(0.3, 0.3) },
        { atSeconds: 4.2, region: small(0.7, 0.7) },
      ],
      OPTIONS,
      VIEWPORT,
    );
    expect(path).toHaveLength(2);
    expect(path[1]?.focus).toEqual(small(0.7, 0.7));
  });
});

describe("focus", () => {
  const spans = focusSpans(
    timeline([
      event("click", 1, 1.3, small(0.1, 0.1)),
      event("highlight", 4, 7, small(0.4, 0.5)),
      event("highlight", 7, 10, small(0.4, 0.7)),
      event("highlight", 20, 22, { x: 0, y: 0, width: 0.9, height: 0.9 }),
    ]),
  );

  it("isolates what the recording dwells on, not passing clicks or whole screens", () => {
    expect(spans.map((span) => span.fromSeconds)).toEqual([4, 7]);
  });

  it("fades in, glides between consecutive subjects, and fades out", () => {
    expect(focusAt(spans, 3)).toBeNull();
    expect(focusAt(spans, 4.1)?.strength).toBeGreaterThan(0);
    expect(focusAt(spans, 4.1)?.strength).toBeLessThan(1);
    expect(focusAt(spans, 6)?.strength).toBe(1);
    const gliding = focusAt(spans, 7.2);
    expect(gliding?.strength).toBe(1);
    expect(gliding?.region.y).toBeGreaterThan(0.5);
    expect(gliding?.region.y).toBeLessThan(0.7);
    expect(focusAt(spans, 9)?.region.y).toBeCloseTo(0.7, 6);
    expect(focusAt(spans, 12)).toBeNull();
  });
});
