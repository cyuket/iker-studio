import { describe, expect, it } from "vitest";
import { MOTION } from "../../../src/remotion/design/tokens";
import { backdropFrame, type BackdropInput } from "../../../src/remotion/lib/backdrop";

const FORMATS = {
  landscape: {
    width: 1920,
    height: 1080,
    unit: 1,
    portrait: false,
    margins: { left: 96, right: 96 },
  },
  portrait: {
    width: 1080,
    height: 1920,
    unit: 1,
    portrait: true,
    margins: { left: 64, right: 150 },
  },
} as const;

const input = (format: keyof typeof FORMATS, seconds: number): BackdropInput => ({
  ...FORMATS[format],
  seconds,
  motion: MOTION.backdrop,
});

describe.each(Object.keys(FORMATS) as (keyof typeof FORMATS)[])("backdrop (%s)", (format) => {
  const { width, margins } = FORMATS[format];
  const samples = Array.from({ length: 600 }, (_, i) => i * 0.37);

  it("is a pure function of time", () => {
    expect(backdropFrame(input(format, 12.5))).toEqual(backdropFrame(input(format, 12.5)));
  });

  it("keeps the dots in the margins outside the safe area, clear of text and footage", () => {
    for (const seconds of samples) {
      for (const dot of backdropFrame(input(format, seconds)).dots) {
        const inLeft = dot.x - dot.radius >= 0 && dot.x + dot.radius <= margins.left;
        const inRight = dot.x - dot.radius >= width - margins.right && dot.x + dot.radius <= width;
        expect(inLeft || inRight).toBe(true);
      }
    }
  });

  it("drifts by a few pixels at most between consecutive frames, so a hard join cannot jump", () => {
    const step = 1 / 30;
    for (const seconds of samples) {
      const a = backdropFrame(input(format, seconds));
      const b = backdropFrame(input(format, seconds + step));
      a.glows.forEach((glow, i) => {
        const next = b.glows[i];
        if (!next) throw new Error("glow missing");
        // Glows are soft and about a frame wide: half a percent of the short edge is invisible.
        const shortEdge = Math.min(FORMATS[format].width, FORMATS[format].height);
        expect(Math.hypot(next.x - glow.x, next.y - glow.y)).toBeLessThan(shortEdge * 0.005);
      });
      a.dots.forEach((dot, i) => {
        const next = b.dots[i];
        if (!next) throw new Error("dot missing");
        // A dot wrapping from the top back to the bottom is invisible on both frames.
        if (Math.abs(next.y - dot.y) > 10) expect(Math.max(dot.opacity, next.opacity)).toBe(0);
        else expect(Math.abs(next.opacity - dot.opacity)).toBeLessThan(0.1);
      });
    }
  });

  it("keeps the grid offset inside one cell", () => {
    for (const seconds of samples) {
      const { gridOffset, gridSize } = backdropFrame(input(format, seconds));
      expect(gridOffset).toBeGreaterThanOrEqual(0);
      expect(gridOffset).toBeLessThan(gridSize);
    }
  });
});
