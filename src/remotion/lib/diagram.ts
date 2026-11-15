import type { Orientation } from "../../domain/formats";
import type { Rect } from "../design/layout";

export interface DiagramNodeInput {
  id: string;
  column: number;
}

export interface DiagramLayoutOptions {
  /** Minimum gap between ranks, which is where the arrows and their labels live. */
  rankGap: number;
  /** Gap between nodes that share a rank. */
  siblingGap: number;
  maxNodeWidth: number;
  maxNodeHeight: number;
}

export interface DiagramLayout {
  boxes: Record<string, Rect>;
  /** Rank index per node id, with gaps in the authored columns closed up. */
  ranks: Record<string, number>;
  rankCount: number;
}

/**
 * Places nodes on a grid local to a box of `width` x `height`. Landscape flows left to
 * right with one column per rank; portrait turns the same graph through 90 degrees so
 * ranks become rows and it reads top to bottom instead of shrinking to fit.
 */
export function layoutDiagram(
  nodes: readonly DiagramNodeInput[],
  width: number,
  height: number,
  orientation: Orientation,
  options: DiagramLayoutOptions,
): DiagramLayout {
  const columns = [...new Set(nodes.map((node) => node.column))].sort((a, b) => a - b);
  const groups = columns.map((column) => nodes.filter((node) => node.column === column));
  const rankCount = Math.max(1, groups.length);
  const vertical = orientation === "portrait";

  const mainSize = vertical ? height : width;
  const crossSize = vertical ? width : height;
  const maxMain = vertical ? options.maxNodeHeight : options.maxNodeWidth;
  const maxCross = vertical ? options.maxNodeWidth : options.maxNodeHeight;

  const nodeMain = Math.min(maxMain, (mainSize - (rankCount - 1) * options.rankGap) / rankCount);
  // Spare room goes into the gaps between ranks, up to a limit, then into the margins.
  const spare = mainSize - rankCount * nodeMain;
  const gap = rankCount > 1 ? Math.min(spare / (rankCount - 1), options.rankGap * 2.2) : 0;
  const mainStart = (mainSize - (rankCount * nodeMain + (rankCount - 1) * gap)) / 2;

  const boxes: Record<string, Rect> = {};
  const ranks: Record<string, number> = {};
  groups.forEach((group, rank) => {
    const main = mainStart + rank * (nodeMain + gap);
    // Each rank sizes its own nodes, so a lone node is not squeezed to match a crowded rank.
    const nodeCross = Math.min(
      maxCross,
      (crossSize - (group.length - 1) * options.siblingGap) / group.length,
    );
    const stack = group.length * nodeCross + (group.length - 1) * options.siblingGap;
    const crossStart = (crossSize - stack) / 2;
    group.forEach((node, i) => {
      const cross = crossStart + i * (nodeCross + options.siblingGap);
      ranks[node.id] = rank;
      boxes[node.id] = vertical
        ? { x: cross, y: main, width: nodeCross, height: nodeMain }
        : { x: main, y: cross, width: nodeMain, height: nodeCross };
    });
  });

  return { boxes, ranks, rankCount };
}

export interface EdgePath {
  d: string;
  /** Point halfway along the curve, where the label sits. */
  mid: { x: number; y: number };
  /** Arrow tip and the unit direction it points in. */
  end: { x: number; y: number; dx: number; dy: number };
}

/** A smooth connector leaving and entering nodes along the flow direction. */
export function edgePath(from: Rect, to: Rect, orientation: Orientation, inset = 0): EdgePath {
  const fromCentre = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCentre = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const alongX = orientation === "landscape";
  const mainDelta = alongX ? toCentre.x - fromCentre.x : toCentre.y - fromCentre.y;
  // Nodes in the same rank connect across the flow instead of along it.
  const sameRank = Math.abs(mainDelta) < 1;
  const horizontal = sameRank ? !alongX : alongX;
  const delta = horizontal ? toCentre.x - fromCentre.x : toCentre.y - fromCentre.y;
  const sign = delta >= 0 ? 1 : -1;

  const start = horizontal
    ? { x: fromCentre.x + (sign * from.width) / 2, y: fromCentre.y }
    : { x: fromCentre.x, y: fromCentre.y + (sign * from.height) / 2 };
  const end = horizontal
    ? { x: toCentre.x - sign * (to.width / 2 + inset), y: toCentre.y }
    : { x: toCentre.x, y: toCentre.y - sign * (to.height / 2 + inset) };

  const reach = (horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)) / 2;
  const c1 = horizontal
    ? { x: start.x + sign * reach, y: start.y }
    : { x: start.x, y: start.y + sign * reach };
  const c2 = horizontal
    ? { x: end.x - sign * reach, y: end.y }
    : { x: end.x, y: end.y - sign * reach };

  return {
    d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    mid: {
      x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
      y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
    },
    end: { x: end.x, y: end.y, dx: horizontal ? sign : 0, dy: horizontal ? 0 : sign },
  };
}
