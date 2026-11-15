import type { Rect } from "../design/layout";

export interface Point {
  x: number;
  y: number;
}

/**
 * A connector's geometry. Kept as data rather than an SVG string so the same description
 * draws the stroke and places anything that travels along it.
 */
export type PathSpec =
  | { kind: "line"; from: Point; to: Point }
  | { kind: "quad"; from: Point; control: Point; to: Point }
  | { kind: "cubic"; from: Point; c1: Point; c2: Point; to: Point }
  | { kind: "poly"; points: readonly Point[] };

const n = (value: number): string => String(Math.round(value * 100) / 100);

/** SVG path data for a connector. */
export function pathData(path: PathSpec): string {
  switch (path.kind) {
    case "line":
      return `M ${n(path.from.x)} ${n(path.from.y)} L ${n(path.to.x)} ${n(path.to.y)}`;
    case "quad":
      return `M ${n(path.from.x)} ${n(path.from.y)} Q ${n(path.control.x)} ${n(path.control.y)} ${n(path.to.x)} ${n(path.to.y)}`;
    case "cubic":
      return `M ${n(path.from.x)} ${n(path.from.y)} C ${n(path.c1.x)} ${n(path.c1.y)} ${n(path.c2.x)} ${n(path.c2.y)} ${n(path.to.x)} ${n(path.to.y)}`;
    case "poly":
      return path.points
        .map((point, i) => `${i === 0 ? "M" : "L"} ${n(point.x)} ${n(point.y)}`)
        .join(" ");
  }
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** The point a fraction `t` (0-1) of the way along a connector. */
export function pointAt(path: PathSpec, t: number): Point {
  const p = Math.min(1, Math.max(0, t));
  switch (path.kind) {
    case "line":
      return lerp(path.from, path.to, p);
    case "quad": {
      const a = lerp(path.from, path.control, p);
      const b = lerp(path.control, path.to, p);
      return lerp(a, b, p);
    }
    case "cubic": {
      const a = lerp(path.from, path.c1, p);
      const b = lerp(path.c1, path.c2, p);
      const c = lerp(path.c2, path.to, p);
      return lerp(lerp(a, b, p), lerp(b, c, p), p);
    }
    case "poly": {
      const points = path.points;
      const first = points[0];
      if (!first) return { x: 0, y: 0 };
      const lengths = points.slice(1).map((point, i) => {
        const previous = points[i] ?? point;
        return Math.hypot(point.x - previous.x, point.y - previous.y);
      });
      const total = lengths.reduce((sum, length) => sum + length, 0);
      if (total === 0) return first;
      let remaining = p * total;
      for (let i = 0; i < lengths.length; i += 1) {
        const length = lengths[i] ?? 0;
        const from = points[i] ?? first;
        const to = points[i + 1] ?? from;
        if (remaining <= length) return lerp(from, to, length === 0 ? 0 : remaining / length);
        remaining -= length;
      }
      return points.at(-1) ?? first;
    }
  }
}

export function rectCentre(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Smallest rectangle containing every given rectangle. */
export function unionRects(rects: readonly Rect[]): Rect {
  const first = rects[0];
  if (!first) return { x: 0, y: 0, width: 0, height: 0 };
  let x0 = first.x;
  let y0 = first.y;
  let x1 = first.x + first.width;
  let y1 = first.y + first.height;
  for (const rect of rects) {
    x0 = Math.min(x0, rect.x);
    y0 = Math.min(y0, rect.y);
    x1 = Math.max(x1, rect.x + rect.width);
    y1 = Math.max(y1, rect.y + rect.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function insetRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: Math.max(0, rect.width - by * 2),
    height: Math.max(0, rect.height - by * 2),
  };
}

/** Shortens a straight segment so it stops `startGap` and `endGap` short of its ends. */
export function trimLine(from: Point, to: Point, startGap: number, endGap: number): PathSpec {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= startGap + endGap || length === 0) return { kind: "line", from, to };
  return {
    kind: "line",
    from: lerp(from, to, startGap / length),
    to: lerp(from, to, 1 - endGap / length),
  };
}

/** A left-to-right S-curve between two points, leaving and arriving horizontally. */
export function flowCurve(from: Point, to: Point, vertical = false): PathSpec {
  if (vertical) {
    const mid = (from.y + to.y) / 2;
    return { kind: "cubic", from, c1: { x: from.x, y: mid }, c2: { x: to.x, y: mid }, to };
  }
  const mid = (from.x + to.x) / 2;
  return { kind: "cubic", from, c1: { x: mid, y: from.y }, c2: { x: mid, y: to.y }, to };
}
