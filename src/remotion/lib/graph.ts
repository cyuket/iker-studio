import type { Rect } from "../design/layout";
import { trimLine, unionRects, type PathSpec, type Point } from "./geometry";

export interface GraphNodeInput {
  id: string;
  group?: string | undefined;
  /** Placed beyond the ring of a radial layout. */
  outside?: boolean | undefined;
}

export interface GraphLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  layout: "radial" | "groups";
  /** Centre of a radial layout; the first node when omitted. */
  hub?: string | undefined;
  nodes: readonly GraphNodeInput[];
}

export interface GraphLayout {
  /** Radius of every node's circle. */
  radius: number;
  /** Size of the label block under each node. */
  label: { width: number; height: number };
  /** Centre of each node's circle. */
  positions: Record<string, Point>;
  /** Everything drawn: circles and their labels. Always inside the body. */
  bounds: Rect;
}

export function nodeRadius(count: number): number {
  if (count <= 5) return 84;
  if (count <= 8) return 74;
  if (count <= 11) return 60;
  return 50;
}

/** The box a node occupies: its circle and the label beneath it. */
export function nodeBox(layout: Pick<GraphLayout, "radius" | "label">, centre: Point): Rect {
  const width = Math.max(layout.radius * 2, layout.label.width);
  return {
    x: centre.x - width / 2,
    y: centre.y - layout.radius,
    width,
    height: layout.radius * 2 + layout.label.height,
  };
}

function finish(
  radius: number,
  label: GraphLayout["label"],
  positions: Record<string, Point>,
): GraphLayout {
  const partial = { radius, label };
  return {
    radius,
    label,
    positions,
    bounds: unionRects(Object.values(positions).map((centre) => nodeBox(partial, centre))),
  };
}

function radial(input: GraphLayoutInput): GraphLayout {
  const { body, portrait, unit, nodes } = input;
  const radius = nodeRadius(nodes.length) * unit;
  const label = { width: radius * 2 + 110 * unit, height: radius * 1.15 };
  const hubId = input.hub ?? nodes[0]?.id;
  const outside = nodes.filter((node) => node.outside && node.id !== hubId);
  const ring = nodes.filter((node) => node.id !== hubId && !node.outside);
  // What is left out gets a strip of its own, so the ring never has to make way for it.
  const strip =
    outside.length === 0
      ? 0
      : portrait
        ? radius * 2 + label.height + 40 * unit
        : label.width + 40 * unit;
  const area: Rect = portrait
    ? { x: body.x, y: body.y, width: body.width, height: body.height - strip }
    : { x: body.x, y: body.y, width: body.width - strip, height: body.height };

  const widest = Math.max(0, (area.width - label.width) / 2);
  // A ring much taller than it is wide stops reading as a ring, so portrait caps its height.
  const ry = Math.min(
    Math.max(0, (area.height - radius * 2 - label.height) / 2),
    portrait ? widest * 1.45 : Number.POSITIVE_INFINITY,
  );
  const rx = Math.max(0, Math.min((area.width - label.width) / 2, ry * 1.75));
  const centre = { x: area.x + area.width / 2, y: area.y + (area.height - label.height) / 2 };
  const positions: Record<string, Point> = {};
  if (hubId !== undefined) positions[hubId] = centre;
  ring.forEach((node, i) => {
    // An even count would put a node straight below the hub, under its label; turning the
    // ring by half a step keeps that spot clear.
    const turn = ring.length % 2 === 0 ? 0.5 : 0;
    const angle = -Math.PI / 2 + ((i + turn) * 2 * Math.PI) / ring.length;
    positions[node.id] = {
      x: centre.x + rx * Math.cos(angle),
      y: centre.y + ry * Math.sin(angle),
    };
  });
  outside.forEach((node, i) => {
    const t = (i + 1) / (outside.length + 1);
    positions[node.id] = portrait
      ? { x: body.x + body.width * t, y: body.y + body.height - label.height - radius }
      : {
          x: body.x + body.width - label.width / 2,
          y: body.y + radius + (body.height - radius * 2 - label.height) * t,
        };
  });
  return finish(radius, label, positions);
}

function groups(input: GraphLayoutInput): GraphLayout {
  const { body, portrait, unit, nodes } = input;
  const order: string[] = [];
  const members = new Map<string, GraphNodeInput[]>();
  for (const node of nodes) {
    const key = node.group ?? `·${node.id}`;
    if (!members.has(key)) order.push(key);
    members.set(key, [...(members.get(key) ?? []), node]);
  }
  const baseRadius = nodeRadius(nodes.length);
  // Measured in design pixels first, then scaled down as a whole if it does not fit.
  const cell = { width: baseRadius * 2 + 120, height: baseRadius * 3.15 + 30 };
  const gap = portrait ? 96 : 170;
  const shapes = order.map((key) => {
    const count = members.get(key)?.length ?? 0;
    const across = count <= 3 ? 1 : Math.ceil(Math.sqrt(count));
    const along = Math.ceil(count / across);
    // Rows run across the main axis, so edges between neighbouring groups stay short.
    return portrait ? { cols: along, rows: across, count } : { cols: across, rows: along, count };
  });
  const main = (shape: (typeof shapes)[number]): number =>
    portrait ? shape.rows * cell.height : shape.cols * cell.width;
  const cross = (shape: (typeof shapes)[number]): number =>
    portrait ? shape.cols * cell.width : shape.rows * cell.height;
  const totalMain = shapes.reduce((sum, shape) => sum + main(shape), 0) + gap * (shapes.length - 1);
  const maxCross = Math.max(0, ...shapes.map(cross));
  const availableMain = (portrait ? body.height : body.width) / unit;
  const availableCross = (portrait ? body.width : body.height) / unit;
  const scale = Math.min(1.15, availableMain / totalMain, availableCross / maxCross);
  const k = unit * scale;
  const radius = baseRadius * k;
  const label = { width: (baseRadius * 2 + 110) * k, height: baseRadius * 1.15 * k };

  const positions: Record<string, Point> = {};
  let cursor =
    (portrait ? body.y : body.x) + ((portrait ? body.height : body.width) - totalMain * k) / 2;
  order.forEach((key, g) => {
    const shape = shapes[g];
    const list = members.get(key) ?? [];
    if (!shape) return;
    const crossStart =
      (portrait ? body.x : body.y) + ((portrait ? body.width : body.height) - cross(shape) * k) / 2;
    list.forEach((node, i) => {
      const col = portrait ? i % shape.cols : Math.floor(i / shape.rows);
      const row = portrait ? Math.floor(i / shape.cols) : i % shape.rows;
      const x = (col + 0.5) * cell.width * k;
      const y = row * cell.height * k + 15 * k + radius;
      positions[node.id] = portrait
        ? { x: crossStart + x, y: cursor + y }
        : { x: cursor + x, y: crossStart + y };
    });
    cursor += (main(shape) + gap) * k;
  });
  return finish(radius, label, positions);
}

/**
 * Deterministic positions for a small network. `radial` puts one node in the middle and
 * the rest on a ring around it, so every edge to the hub is clear of every other node.
 * `groups` sets groups of nodes side by side (stacked in portrait), each as a compact grid.
 */
export function layoutGraph(input: GraphLayoutInput): GraphLayout {
  return input.layout === "groups" ? groups(input) : radial(input);
}

/** A straight edge between two nodes that stops short of both circles. */
export function edgePath(
  layout: GraphLayout,
  from: string,
  to: string,
  clearance: number,
): PathSpec | null {
  const a = layout.positions[from];
  const b = layout.positions[to];
  if (!a || !b) return null;
  return trimLine(a, b, layout.radius + clearance, layout.radius + clearance);
}

/** The boundary drawn around a set of nodes, with room for a title when it has one. */
export function clusterRect(
  layout: GraphLayout,
  nodeIds: readonly string[],
  padding: number,
  titleHeight: number,
): Rect | null {
  const boxes = nodeIds.flatMap((id) => {
    const centre = layout.positions[id];
    return centre ? [nodeBox(layout, centre)] : [];
  });
  if (boxes.length === 0) return null;
  const inner = unionRects(boxes);
  return {
    x: inner.x - padding,
    y: inner.y - padding - titleHeight,
    width: inner.width + padding * 2,
    height: inner.height + padding * 2 + titleHeight,
  };
}

/**
 * Delay, in list positions, of each item among the items that share its cue. Things that
 * start on the same word arrive one after another instead of in a block.
 */
export function ranksWithinCue(cues: readonly (string | undefined)[]): number[] {
  const seen = new Map<string, number>();
  return cues.map((cue) => {
    if (cue === undefined) return 0;
    const rank = seen.get(cue) ?? 0;
    seen.set(cue, rank + 1);
    return rank;
  });
}
