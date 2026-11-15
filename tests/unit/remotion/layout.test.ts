import { describe, expect, it } from "vitest";
import { FORMATS, FORMAT_IDS } from "../../../src/domain/formats";
import {
  computeLayout,
  computeZones,
  estimateLines,
  fitFontSize,
  rectContains,
  rectsOverlap,
  type OverlayPresence,
  type Rect,
} from "../../../src/remotion/design/layout";

const ALL: OverlayPresence = { disclosure: true, captions: true, progress: true, lowerThird: true };
const NONE: OverlayPresence = {
  disclosure: false,
  captions: false,
  progress: false,
  lowerThird: false,
};

describe("computeLayout", () => {
  it("derives the safe rect from the format's insets", () => {
    const layout = computeLayout(FORMATS["youtube-shorts"]);
    expect(layout.safe).toEqual({ x: 64, y: 220, width: 866, height: 1280 });
    expect(layout.isPortrait).toBe(true);
    expect(layout.pick("landscape", "portrait")).toBe("portrait");
  });

  it("uses the short edge as the design unit so both orientations share one scale", () => {
    expect(computeLayout(FORMATS["youtube-landscape"]).unit).toBe(1);
    expect(computeLayout(FORMATS["youtube-shorts"]).unit).toBe(1);
    const half = computeLayout({ ...FORMATS["youtube-landscape"], width: 960, height: 540 });
    expect(half.unit).toBe(0.5);
    expect(half.u(40)).toBe(20);
  });
});

describe("computeZones", () => {
  it.each(FORMAT_IDS)("keeps every zone inside the safe area for %s", (id) => {
    const format = FORMATS[id];
    const layout = computeLayout(format);
    const zones = computeZones(layout, ALL, format.captions.maxLines);
    const rects = [
      zones.content,
      zones.disclosure,
      zones.lowerThird,
      zones.captions,
      zones.progress,
    ];
    for (const rect of rects) {
      expect(rect).not.toBeNull();
      expect(rectContains(layout.safe, rect as Rect)).toBe(true);
    }
  });

  it.each(FORMAT_IDS)("never lets two zones overlap for %s", (id) => {
    const format = FORMATS[id];
    const zones = computeZones(computeLayout(format), ALL, format.captions.maxLines);
    const rects = Object.values(zones).filter((rect): rect is Rect => rect !== null);
    rects.forEach((a, i) => {
      rects.slice(i + 1).forEach((b) => expect(rectsOverlap(a, b)).toBe(false));
    });
  });

  it("puts the disclosure label above the content and captions below it", () => {
    const format = FORMATS["social-portrait"];
    const zones = computeZones(computeLayout(format), ALL, format.captions.maxLines);
    const disclosure = zones.disclosure as Rect;
    const captions = zones.captions as Rect;
    expect(disclosure.y + disclosure.height).toBeLessThan(zones.content.y);
    expect(captions.y).toBeGreaterThan(zones.content.y + zones.content.height);
  });

  it("gives the whole safe area to the content when there are no overlays", () => {
    const layout = computeLayout(FORMATS["youtube-landscape"]);
    const zones = computeZones(layout, NONE, 2);
    expect(zones.content).toEqual(layout.safe);
    expect(zones.disclosure).toBeNull();
    expect(zones.captions).toBeNull();
  });

  it("reserves more room for captions with more lines", () => {
    const layout = computeLayout(FORMATS["youtube-shorts"]);
    const two = computeZones(layout, { ...NONE, captions: true }, 2);
    const three = computeZones(layout, { ...NONE, captions: true }, 3);
    expect(three.content.height).toBeLessThan(two.content.height);
  });
});

describe("text fitting", () => {
  it("counts wrapped lines from average glyph width", () => {
    expect(estimateLines("one two three", 1000, 10)).toBe(1);
    expect(estimateLines("aaaa bbbb cccc", 53, 10, 0.53)).toBe(2);
  });

  it("keeps the preferred size when the text already fits", () => {
    expect(
      fitFontSize({ text: "Short", maxWidth: 1000, maxLines: 1, size: 100, minSize: 40 }),
    ).toBe(100);
  });

  it("steps down until the text fits the allowed lines", () => {
    const text = "A considerably longer headline that cannot fit at full size";
    const size = fitFontSize({ text, maxWidth: 800, maxLines: 2, size: 120, minSize: 40 });
    expect(size).toBeLessThan(120);
    expect(estimateLines(text, 800, size)).toBeLessThanOrEqual(2);
  });

  it("never goes below the minimum size", () => {
    const text = "word ".repeat(200);
    expect(fitFontSize({ text, maxWidth: 300, maxLines: 1, size: 100, minSize: 48 })).toBe(48);
  });

  it("shrinks so that a single long word is not clipped", () => {
    const size = fitFontSize({
      text: "Internationalisation",
      maxWidth: 530,
      maxLines: 3,
      size: 100,
      minSize: 20,
    });
    expect(20 * size * 0.53).toBeLessThanOrEqual(530);
  });
});
