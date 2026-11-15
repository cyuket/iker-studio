import type { Rect } from "../design/layout";
import type { Point } from "./geometry";

export interface RailLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  events: number;
}

export interface RailLayout {
  axis: "x" | "y";
  from: Point;
  to: Point;
  /** One point on the rail per event, in order. */
  points: Point[];
  /** Where each event's "when" goes: above the rail, or left of it in portrait. */
  times: Rect[];
  /** Where each event's description goes: below the rail, or right of it in portrait. */
  labels: Rect[];
  dot: number;
}

/** Events evenly along a rail: left to right in landscape, top to bottom in portrait. */
export function layoutRail(input: RailLayoutInput): RailLayout {
  const { body, portrait, unit } = input;
  const count = Math.max(1, input.events);
  const dot = 17 * unit;
  if (!portrait) {
    const span = body.width / count;
    const y = body.y + body.height * 0.44;
    const points = Array.from({ length: count }, (_, i) => ({ x: body.x + span * (i + 0.5), y }));
    const pad = 14 * unit;
    return {
      axis: "x",
      from: { x: body.x, y },
      to: { x: body.x + body.width, y },
      points,
      dot,
      times: points.map((point) => ({
        x: point.x - span / 2 + pad,
        y: y - 110 * unit,
        width: span - pad * 2,
        height: 62 * unit,
      })),
      labels: points.map((point) => ({
        x: point.x - span / 2 + pad,
        y: y + 52 * unit,
        width: span - pad * 2,
        height: Math.max(0, body.y + body.height - (y + 52 * unit)),
      })),
    };
  }
  const span = body.height / count;
  const x = body.x + 210 * unit;
  const points = Array.from({ length: count }, (_, i) => ({ x, y: body.y + span * (i + 0.5) }));
  // Rows keep a little air between them, so neighbouring descriptions never touch.
  const inset = 6 * unit;
  return {
    axis: "y",
    from: { x, y: body.y },
    to: { x, y: body.y + body.height },
    points,
    dot,
    times: points.map((point) => ({
      x: body.x,
      y: point.y - span / 2 + inset,
      width: 210 * unit - 40 * unit,
      height: span - inset * 2,
    })),
    labels: points.map((point) => ({
      x: x + 44 * unit,
      y: point.y - span / 2 + inset,
      width: Math.max(0, body.x + body.width - (x + 44 * unit)),
      height: span - inset * 2,
    })),
  };
}
