import type { FormatSpec, Orientation } from "../../domain/formats";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutFormat = Pick<FormatSpec, "width" | "height" | "orientation" | "safeArea"> & {
  captions: Pick<FormatSpec["captions"], "maxLines">;
};

export interface Layout {
  width: number;
  height: number;
  orientation: Orientation;
  isPortrait: boolean;
  /** Multiplier from design pixels (1080 on the short edge) to output pixels. */
  unit: number;
  /** The area that text and key UI must stay inside. */
  safe: Rect;
  /** Scales a design-pixel value to output pixels. */
  u: (designPixels: number) => number;
  /** Picks a value by orientation. */
  pick: <T>(landscape: T, portrait: T) => T;
}

const DESIGN_SHORT_EDGE = 1080;

export function computeLayout(format: LayoutFormat): Layout {
  const unit = Math.min(format.width, format.height) / DESIGN_SHORT_EDGE;
  const isPortrait = format.orientation === "portrait";
  const { top, right, bottom, left } = format.safeArea;
  return {
    width: format.width,
    height: format.height,
    orientation: format.orientation,
    isPortrait,
    unit,
    safe: {
      x: left,
      y: top,
      width: Math.max(0, format.width - left - right),
      height: Math.max(0, format.height - top - bottom),
    },
    u: (designPixels) => designPixels * unit,
    pick: (landscape, portrait) => (isPortrait ? portrait : landscape),
  };
}

export interface OverlayPresence {
  disclosure: boolean;
  captions: boolean;
  progress: boolean;
  lowerThird: boolean;
}

export interface Zones {
  /** Where the scene's own visual is laid out; never overlaps any overlay zone. */
  content: Rect;
  disclosure: Rect | null;
  lowerThird: Rect | null;
  captions: Rect | null;
  progress: Rect | null;
}

export interface ZoneMetrics {
  disclosureHeight: number;
  lowerThirdHeight: number;
  captionLineHeight: number;
  captionPadding: number;
  progressHeight: number;
  gap: number;
}

export function zoneMetrics(layout: Layout): ZoneMetrics {
  return {
    disclosureHeight: layout.u(layout.pick(44, 50)),
    lowerThirdHeight: layout.u(layout.pick(92, 116)),
    captionLineHeight: layout.u(layout.pick(56, 74)),
    captionPadding: layout.u(layout.pick(14, 18)),
    progressHeight: layout.u(4),
    gap: layout.u(layout.pick(24, 28)),
  };
}

/**
 * Splits the safe area into bands. The disclosure label owns the top band and captions,
 * lower third and progress stack up from the bottom, so no two overlays can ever collide
 * and the scene visual gets whatever is left.
 */
export function computeZones(
  layout: Layout,
  presence: OverlayPresence,
  maxCaptionLines: number,
): Zones {
  const metrics = zoneMetrics(layout);
  const { safe } = layout;
  let top = safe.y;
  let bottom = safe.y + safe.height;
  const band = (y: number, height: number): Rect => ({ x: safe.x, y, width: safe.width, height });

  let disclosure: Rect | null = null;
  if (presence.disclosure) {
    disclosure = band(top, metrics.disclosureHeight);
    top += metrics.disclosureHeight + metrics.gap;
  }

  let progress: Rect | null = null;
  if (presence.progress) {
    bottom -= metrics.progressHeight;
    progress = band(bottom, metrics.progressHeight);
    bottom -= metrics.gap;
  }

  let captions: Rect | null = null;
  if (presence.captions) {
    const height =
      Math.max(1, maxCaptionLines) * metrics.captionLineHeight + metrics.captionPadding * 2;
    bottom -= height;
    captions = band(bottom, height);
    bottom -= metrics.gap;
  }

  let lowerThird: Rect | null = null;
  if (presence.lowerThird) {
    bottom -= metrics.lowerThirdHeight;
    lowerThird = band(bottom, metrics.lowerThirdHeight);
    bottom -= metrics.gap;
  }

  return {
    content: band(top, Math.max(0, bottom - top)),
    disclosure,
    lowerThird,
    captions,
    progress,
  };
}

export function rectContains(outer: Rect, inner: Rect, tolerance = 0.5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export interface FitTextOptions {
  text: string;
  maxWidth: number;
  maxLines: number;
  /** Preferred font size in output pixels. */
  size: number;
  minSize: number;
  /** Average glyph advance as a fraction of the font size. */
  charWidth?: number;
}

/** Estimated number of lines `text` wraps to at `size`, from average glyph width. */
export function estimateLines(
  text: string,
  maxWidth: number,
  size: number,
  charWidth = 0.53,
): number {
  const perLine = Math.max(1, Math.floor(maxWidth / (size * charWidth)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = used === 0 ? word.length : used + 1 + word.length;
    if (next > perLine && used > 0) {
      lines += 1;
      used = word.length;
    } else {
      used = next;
    }
  }
  return lines;
}

/**
 * Chooses a font size without measuring the DOM, so layout is identical on every frame
 * and every machine. It estimates wrapped line count from average glyph width and steps
 * the size down until the text fits the allowed number of lines.
 */
export function fitFontSize(options: FitTextOptions): number {
  const charWidth = options.charWidth ?? 0.53;
  const longestWord = Math.max(0, ...options.text.split(/\s+/).map((word) => word.length));
  let size = options.size;
  while (size > options.minSize) {
    const perLine = Math.floor(options.maxWidth / (size * charWidth));
    const lines = estimateLines(options.text, options.maxWidth, size, charWidth);
    if (longestWord <= perLine && lines <= options.maxLines) return size;
    size = Math.max(options.minSize, Math.floor(size * 0.94));
  }
  return options.minSize;
}
