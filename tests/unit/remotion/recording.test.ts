import { describe, expect, it } from "vitest";
import type { RecordingTimeline } from "../../../src/domain/recording";
import {
  clipRegion,
  cursorAt,
  detailCrop,
  holdFrame,
  isAnnotationVisible,
  mapRegion,
  NO_ZOOM,
  zoomTowards,
} from "../../../src/remotion/lib/recording";

const focus = { x: 0.6, y: 0.1, width: 0.3, height: 0.2 };

describe("zoomTowards", () => {
  it("is the identity at progress 0 and without a focus region", () => {
    expect(zoomTowards(focus, 0)).toEqual(NO_ZOOM);
    expect(zoomTowards(undefined, 1)).toEqual(NO_ZOOM);
  });

  it("never exposes anything beyond the edge of the recording", () => {
    for (const progress of [0.1, 0.5, 1]) {
      for (const region of [
        focus,
        { x: 0, y: 0, width: 0.2, height: 0.2 },
        { x: 0.85, y: 0.85, width: 0.15, height: 0.15 },
      ]) {
        const zoom = zoomTowards(region, progress);
        const whole = mapRegion({ x: 0, y: 0, width: 1, height: 1 }, zoom);
        expect(whole.x).toBeLessThanOrEqual(1e-9);
        expect(whole.y).toBeLessThanOrEqual(1e-9);
        expect(whole.x + whole.width).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(whole.y + whole.height).toBeGreaterThanOrEqual(1 - 1e-9);
      }
    }
  });

  it("keeps the whole focus region in view at full zoom", () => {
    const mapped = mapRegion(focus, zoomTowards(focus, 1));
    expect(mapped.x).toBeGreaterThanOrEqual(0);
    expect(mapped.y).toBeGreaterThanOrEqual(0);
    expect(mapped.x + mapped.width).toBeLessThanOrEqual(1);
    expect(mapped.y + mapped.height).toBeLessThanOrEqual(1);
  });

  it("caps magnification for a tiny focus region", () => {
    expect(zoomTowards({ x: 0.5, y: 0.5, width: 0.01, height: 0.01 }, 1).scale).toBe(1.8);
  });

  it("does not zoom out for a focus region larger than the frame allows", () => {
    expect(zoomTowards({ x: 0, y: 0, width: 1, height: 1 }, 1).scale).toBe(1);
  });
});

describe("clipRegion", () => {
  it("trims a region to the viewport", () => {
    const clipped = clipRegion({ x: -0.1, y: 0.9, width: 0.3, height: 0.3 });
    expect(clipped?.x).toBe(0);
    expect(clipped?.width).toBeCloseTo(0.2);
    expect(clipped?.height).toBeCloseTo(0.1);
  });

  it("returns null when nothing is visible", () => {
    expect(clipRegion({ x: 1.2, y: 0, width: 0.2, height: 0.2 })).toBeNull();
  });
});

describe("isAnnotationVisible", () => {
  it("shows from fromSeconds until toSeconds", () => {
    const note = { fromSeconds: 1, toSeconds: 3 };
    expect(isAnnotationVisible(note, 0.99)).toBe(false);
    expect(isAnnotationVisible(note, 1)).toBe(true);
    expect(isAnnotationVisible(note, 3)).toBe(false);
  });

  it("stays up for the rest of the scene with no toSeconds", () => {
    expect(isAnnotationVisible({ fromSeconds: 1 }, 500)).toBe(true);
  });
});

describe("detailCrop", () => {
  it("contains the focus region, matches the panel shape and stays in the viewport", () => {
    const viewportAspect = 1.6;
    const panelAspect = 2;
    const crop = detailCrop(focus, panelAspect, viewportAspect);
    expect(crop.x).toBeLessThanOrEqual(focus.x);
    expect(crop.y).toBeLessThanOrEqual(focus.y);
    expect(crop.x + crop.width).toBeGreaterThanOrEqual(focus.x + focus.width);
    expect(crop.y + crop.height).toBeGreaterThanOrEqual(focus.y + focus.height);
    expect((crop.width * viewportAspect) / crop.height).toBeCloseTo(panelAspect);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("magnifies: the crop is smaller than the full viewport", () => {
    expect(detailCrop(focus, 2, 1.6).width).toBeLessThan(1);
  });

  it("falls back to the full width when the focus is as wide as the recording", () => {
    const crop = detailCrop({ x: 0, y: 0.4, width: 1, height: 0.1 }, 2, 1.6);
    expect(crop.width).toBeCloseTo(1);
    expect(crop.x).toBeCloseTo(0);
  });
});

describe("cursorAt", () => {
  const event = (
    index: number,
    action: string,
    start: number,
    region: { x: number; y: number } | null,
  ): RecordingTimeline["events"][number] => ({
    index,
    action,
    startSeconds: start,
    endSeconds: start + 0.2,
    region: region ? { ...region, width: 0.2, height: 0.2 } : null,
    label: null,
  });
  const events = [
    event(0, "navigate", 0, null),
    event(1, "highlight", 1, { x: 0, y: 0 }),
    event(2, "click", 3, { x: 0.6, y: 0.4 }),
  ];

  it("returns null when no event has a position", () => {
    expect(cursorAt([event(0, "navigate", 0, null)], 1)).toBeNull();
  });

  it("rests on the centre of the first positioned event from the start", () => {
    expect(cursorAt(events, 0)).toEqual({ x: 0.1, y: 0.1, click: null });
    expect(cursorAt(events, 2)).toEqual({ x: 0.1, y: 0.1, click: null });
  });

  it("arrives exactly when the next event starts", () => {
    const state = cursorAt(events, 3);
    expect(state?.x).toBeCloseTo(0.7);
    expect(state?.y).toBeCloseTo(0.5);
  });

  it("is part-way there during the glide", () => {
    const state = cursorAt(events, 2.65);
    expect(state?.x).toBeCloseTo(0.4);
    expect(state?.y).toBeCloseTo(0.3);
  });

  it("ripples only on click events, and only briefly", () => {
    expect(cursorAt(events, 1.1)?.click).toBeNull();
    expect(cursorAt(events, 3)?.click).toBe(0);
    expect(cursorAt(events, 3.2)?.click).toBeGreaterThan(0);
    expect(cursorAt(events, 3.6)?.click).toBeNull();
  });

  it("stays on the last target after the final event", () => {
    expect(cursorAt(events, 60)?.x).toBeCloseTo(0.7);
  });
});

describe("holdFrame", () => {
  it("is the recording's final frame", () => {
    expect(holdFrame(3, 30)).toBe(89);
    expect(holdFrame(0, 30)).toBe(0);
  });
});
