import { describe, expect, it } from "vitest";
import { rectsOverlap, type Rect } from "../../../src/remotion/design/layout";
import { edgePath, layoutDiagram } from "../../../src/remotion/lib/diagram";

const nodes = [
  { id: "a", column: 0 },
  { id: "b", column: 2 },
  { id: "c", column: 2 },
  { id: "d", column: 4 },
];
const options = { rankGap: 100, siblingGap: 20, maxNodeWidth: 300, maxNodeHeight: 150 };
const box = (layout: ReturnType<typeof layoutDiagram>, id: string): Rect => {
  const rect = layout.boxes[id];
  if (!rect) throw new Error(`no box for ${id}`);
  return rect;
};

describe("layoutDiagram", () => {
  it.each(["landscape", "portrait"] as const)(
    "keeps every node inside the box without overlap (%s)",
    (orientation) => {
      const width = orientation === "landscape" ? 1600 : 860;
      const height = orientation === "landscape" ? 700 : 1100;
      const layout = layoutDiagram(nodes, width, height, orientation, options);
      const rects = nodes.map((node) => box(layout, node.id));
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1e-6);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1e-6);
      }
      rects.forEach((a, i) =>
        rects.slice(i + 1).forEach((b) => expect(rectsOverlap(a, b)).toBe(false)),
      );
    },
  );

  it("closes up gaps in the authored column numbers", () => {
    const layout = layoutDiagram(nodes, 1600, 700, "landscape", options);
    expect(layout.rankCount).toBe(3);
    expect(layout.ranks).toEqual({ a: 0, b: 1, c: 1, d: 2 });
  });

  it("flows left to right in landscape and stacks siblings vertically", () => {
    const layout = layoutDiagram(nodes, 1600, 700, "landscape", options);
    expect(box(layout, "a").x).toBeLessThan(box(layout, "b").x);
    expect(box(layout, "b").x).toBe(box(layout, "c").x);
    expect(box(layout, "b").y).toBeLessThan(box(layout, "c").y);
  });

  it("flows top to bottom in portrait and places siblings side by side", () => {
    const layout = layoutDiagram(nodes, 860, 1100, "portrait", options);
    expect(box(layout, "a").y).toBeLessThan(box(layout, "b").y);
    expect(box(layout, "b").y).toBe(box(layout, "c").y);
    expect(box(layout, "b").x).toBeLessThan(box(layout, "c").x);
  });

  it("shrinks nodes rather than overflowing a crowded box", () => {
    const many = Array.from({ length: 5 }, (_, column) => ({ id: `n${column}`, column }));
    const layout = layoutDiagram(many, 900, 400, "landscape", options);
    expect(box(layout, "n0").width).toBeLessThan(options.maxNodeWidth);
    expect(box(layout, "n4").x + box(layout, "n4").width).toBeLessThanOrEqual(900 + 1e-6);
  });
});

describe("edgePath", () => {
  const from = { x: 0, y: 100, width: 100, height: 50 };
  const to = { x: 300, y: 100, width: 100, height: 50 };

  it("leaves the facing side and stops short of the target by the inset", () => {
    const path = edgePath(from, to, "landscape", 10);
    expect(path.d.startsWith("M 100 125")).toBe(true);
    expect(path.end).toEqual({ x: 290, y: 125, dx: 1, dy: 0 });
    expect(path.mid).toEqual({ x: 195, y: 125 });
  });

  it("points backwards for an edge against the flow", () => {
    expect(edgePath(to, from, "landscape").end.dx).toBe(-1);
  });

  it("runs vertically in portrait", () => {
    const below = { x: 0, y: 400, width: 100, height: 50 };
    expect(edgePath(from, below, "portrait").end).toEqual({ x: 50, y: 400, dx: 0, dy: 1 });
  });

  it("connects siblings in the same rank across the flow", () => {
    const sibling = { x: 0, y: 300, width: 100, height: 50 };
    expect(edgePath(from, sibling, "landscape").end.dy).toBe(1);
  });
});
