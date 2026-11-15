import type { Rect } from "../design/layout";
import type { Point } from "./geometry";

export interface PipelineLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  stages: number;
  hasResult: boolean;
}

export interface PipelineLayout {
  axis: "x" | "y";
  /** Edge length of the travelling object. */
  token: number;
  /** Radius of a stage's station on the track. */
  station: number;
  /** Where the object waits before the first stage. */
  start: Point;
  /** One stop per stage, then one for the result when there is one. */
  stops: Point[];
  /** Offset from a point on the track to the object's centre: it rides beside the track. */
  tokenOffset: Point;
  /** Where each stop's text goes. */
  labels: Rect[];
}

/**
 * A track with a stop per stage. Landscape runs left to right with the object riding above
 * the track and the stage names below it; portrait runs top to bottom with the object on
 * the left and the names on the right. Either way nothing the object passes is covered.
 */
export function layoutPipeline(input: PipelineLayoutInput): PipelineLayout {
  const { body, portrait, unit } = input;
  const count = input.stages + (input.hasResult ? 1 : 0);
  const token = (portrait ? 116 : 168) * unit;
  const station = (portrait ? 24 : 30) * unit;
  const lead = token + 36 * unit;
  if (!portrait) {
    const span = (body.width - lead) / count;
    const y = body.y + body.height * 0.5;
    const stops = Array.from({ length: count }, (_, i) => ({
      x: body.x + lead + span * (i + 0.5),
      y,
    }));
    const labelTop = y + station + 26 * unit;
    return {
      axis: "x",
      token,
      station,
      start: { x: body.x + token / 2, y },
      stops,
      tokenOffset: { x: 0, y: -(token / 2 + station + 22 * unit) },
      labels: stops.map((stop) => ({
        x: stop.x - (span - 28 * unit) / 2,
        y: labelTop,
        width: span - 28 * unit,
        height: Math.max(0, body.y + body.height - labelTop),
      })),
    };
  }
  const span = (body.height - lead) / count;
  const x = body.x + token + station + 30 * unit;
  const stops = Array.from({ length: count }, (_, i) => ({
    x,
    y: body.y + lead + span * (i + 0.5),
  }));
  const labelLeft = x + station + 28 * unit;
  return {
    axis: "y",
    token,
    station,
    start: { x, y: body.y + token / 2 },
    stops,
    tokenOffset: { x: -(token / 2 + station + 18 * unit), y: 0 },
    labels: stops.map((stop) => ({
      x: labelLeft,
      y: stop.y - (span - 16 * unit) / 2,
      width: Math.max(0, body.x + body.width - labelLeft),
      height: span - 16 * unit,
    })),
  };
}

/**
 * Where the object is at `frame`, in stops: -1 is the starting place, 0 the first stage,
 * and so on. It arrives at each stop exactly on that stop's frame, leaves the previous one
 * as late as it can, and never leaves before it has arrived.
 */
export function pipelinePosition(
  frame: number,
  arrivals: readonly number[],
  travelFrames: number,
  ease: (t: number) => number = (t) => t,
): number {
  let position = -1;
  for (let i = 0; i < arrivals.length; i += 1) {
    const arrival = arrivals[i];
    if (arrival === undefined) break;
    const previous = i === 0 ? Number.NEGATIVE_INFINITY : (arrivals[i - 1] ?? arrival);
    const travel = Math.max(1, Math.min(travelFrames, arrival - previous));
    const departure = arrival - travel;
    if (frame >= arrival) {
      position = i;
      continue;
    }
    if (frame > departure) {
      const t = (frame - departure) / travel;
      position = i - 1 + ease(Math.min(1, Math.max(0, t)));
    }
    break;
  }
  return position;
}

/** The point on the track for a position in stops, between the start and the last stop. */
export function trackPoint(layout: PipelineLayout, position: number): Point {
  const points = [layout.start, ...layout.stops];
  const index = Math.min(points.length - 1, Math.max(0, position + 1));
  const lower = Math.floor(index);
  const from = points[lower] ?? layout.start;
  const to = points[Math.min(points.length - 1, lower + 1)] ?? from;
  const t = index - lower;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
