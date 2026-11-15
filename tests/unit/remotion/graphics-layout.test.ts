import { describe, expect, it } from "vitest";
import { FORMATS } from "../../../src/domain/formats";
import {
  computeLayout,
  computeZones,
  rectContains,
  rectsOverlap,
  type Rect,
} from "../../../src/remotion/design/layout";
import { rotateHue } from "../../../src/remotion/design/colour";
import { layoutDecision } from "../../../src/remotion/lib/decision";
import {
  confusableFaces,
  faceDifference,
  faceSpec,
  hashSeed,
} from "../../../src/remotion/lib/face";
import { pathData, pointAt, trimLine, unionRects } from "../../../src/remotion/lib/geometry";
import { graphicFrame } from "../../../src/remotion/lib/graphic";
import {
  clusterRect,
  edgePath,
  layoutGraph,
  nodeBox,
  ranksWithinCue,
} from "../../../src/remotion/lib/graph";
import {
  identityCardMetrics,
  layoutIdentityStory,
  matchGroups,
  matchLinks,
} from "../../../src/remotion/lib/identity";
import { layoutPipeline, pipelinePosition, trackPoint } from "../../../src/remotion/lib/pipeline";
import { layoutRail } from "../../../src/remotion/lib/rail";
import { layoutStory } from "../../../src/remotion/lib/story";
import { layoutTransformation } from "../../../src/remotion/lib/transform";

/** The body a graphic gets in each format: the content zone, with burned captions in portrait. */
const BODIES = (["youtube-landscape", "youtube-shorts"] as const).map((id) => {
  const format = FORMATS[id];
  const layout = computeLayout(format);
  const portrait = format.orientation === "portrait";
  const zones = computeZones(
    layout,
    { disclosure: false, captions: portrait, progress: false, lowerThird: false },
    format.captions.maxLines,
  );
  const body: Rect = { x: 0, y: 0, width: zones.content.width, height: zones.content.height };
  return { id, portrait, unit: layout.unit, body };
});
const disjoint = (rects: Rect[]): boolean =>
  rects.every((a, i) => rects.slice(i + 1).every((b) => !rectsOverlap(a, b)));

describe("graphicFrame", () => {
  const metrics = {
    u: (n: number) => n,
    pick: <T>(landscape: T) => landscape,
    headingSize: 60,
    headingLineHeight: 1.08,
  };

  it("gives the whole zone to the body when there is no heading, starting at its origin", () => {
    const frame = graphicFrame({ width: 1728, height: 952 }, undefined, metrics);
    expect(frame.heading).toBeNull();
    expect(frame.body).toEqual({ x: 0, y: 0, width: 1728, height: 952 });
  });

  it("puts the body below the heading without overlapping it", () => {
    const frame = graphicFrame(
      { width: 1728, height: 952 },
      "What a match does is up to you",
      metrics,
    );
    expect(frame.body.y).toBeGreaterThan(frame.heading?.height ?? 0);
    expect(frame.body.y + frame.body.height).toBeCloseTo(952, 5);
  });
});

describe("face glyphs", () => {
  it("gives the same glyph for the same seed, whatever its case or spacing", () => {
    expect(faceSpec("ada")).toEqual(faceSpec("ada"));
    expect(faceSpec(" Ada ")).toEqual(faceSpec("ada"));
    expect(hashSeed("ada")).toBe(hashSeed("ada"));
  });

  it("gives visibly different glyphs across a set of seeds", () => {
    const seeds = ["ada", "bisi", "chidi-n", "emeka", "funmi", "gbenga", "halima", "ife"];
    const specs = new Set(seeds.map((seed) => JSON.stringify(faceSpec(seed))));
    expect(specs.size).toBe(seeds.length);
    expect(faceDifference(faceSpec("ada"), faceSpec("ada"))).toBe(0);
    expect(faceDifference(faceSpec("ada"), faceSpec("bisi"))).toBeGreaterThan(0);
  });

  it("reports pairs of seeds a viewer could confuse", () => {
    expect(confusableFaces(["ada", "ada"])).toEqual([]);
    for (const [a, b] of confusableFaces(["ada", "bisi", "chidi-n", "emeka"])) {
      expect(faceSpec(a).scheme).toBe(faceSpec(b).scheme);
    }
  });

  it("derives glyph hues from the brand colour without leaving the hex format", () => {
    expect(rotateHue("#7b6ef7", 0)).toBe("#7b6ef7");
    expect(rotateHue("#7b6ef7", 64)).toMatch(/^#[0-9a-f]{6}$/);
    expect(rotateHue("#7b6ef7", 64)).not.toBe("#7b6ef7");
    expect(rotateHue("#808080", 90)).toBe("#808080");
  });
});

describe("geometry", () => {
  it("places points along every kind of path, from its start to its end", () => {
    const line = { kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 0 } } as const;
    expect(pointAt(line, 0.5)).toEqual({ x: 5, y: 0 });
    const poly = {
      kind: "poly",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 30 },
      ],
    } as const;
    expect(pointAt(poly, 0.25)).toEqual({ x: 10, y: 0 });
    expect(pointAt(poly, 1)).toEqual({ x: 10, y: 30 });
    const cubic = {
      kind: "cubic",
      from: { x: 0, y: 0 },
      c1: { x: 5, y: 0 },
      c2: { x: 5, y: 10 },
      to: { x: 10, y: 10 },
    } as const;
    expect(pointAt(cubic, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(cubic, 1)).toEqual({ x: 10, y: 10 });
    expect(pathData(line)).toBe("M 0 0 L 10 0");
  });

  it("trims a line at both ends and unions rectangles", () => {
    const trimmed = trimLine({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 20);
    expect(trimmed).toEqual({ kind: "line", from: { x: 10, y: 0 }, to: { x: 80, y: 0 } });
    expect(
      unionRects([
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 4, y: 5, width: 2, height: 2 },
      ]),
    ).toEqual({
      x: 0,
      y: 0,
      width: 6,
      height: 7,
    });
  });
});

describe.each(BODIES)("layouts in $id", ({ portrait, unit, body }) => {
  describe("identity story", () => {
    it.each([1, 2, 3, 4])("keeps %i cards and their faces inside the body, apart", (count) => {
      const layout = layoutIdentityStory({
        body,
        portrait,
        unit,
        accounts: Array.from({ length: count }, (_, i) => ({ id: `a${i}`, fields: 3, steps: 3 })),
        hasGaps: true,
        hasMatch: true,
      });
      expect(layout.cards).toHaveLength(count);
      expect(rectContains(body, layout.bounds)).toBe(true);
      expect(disjoint(layout.cards.map((card) => card.rect))).toBe(true);
      expect(layout.gaps).toHaveLength(count - 1);
      for (const gap of layout.gaps) expect(gap.length).toBeGreaterThan(0);
    });

    it("lines faces up so a match can be drawn straight between them", () => {
      const layout = layoutIdentityStory({
        body,
        portrait,
        unit,
        accounts: [
          { id: "a", fields: 3, steps: 3 },
          { id: "b", fields: 2, steps: 0 },
        ],
        hasGaps: false,
        hasMatch: true,
      });
      const [first, second] = layout.cards;
      if (portrait) expect(first?.face.cx).toBeCloseTo(second?.face.cx ?? -1, 5);
      else expect(first?.face.cy).toBeCloseTo(second?.face.cy ?? -1, 5);
      const [link] = matchLinks(layout, ["a", "b"], 10);
      expect(link?.kind).toBe("line");
      if (link?.kind === "line") {
        const length = Math.hypot(link.to.x - link.from.x, link.to.y - link.from.y);
        const centres = Math.hypot(
          (second?.face.cx ?? 0) - (first?.face.cx ?? 0),
          (second?.face.cy ?? 0) - (first?.face.cy ?? 0),
        );
        expect(length).toBeCloseTo(centres - 2 * ((first?.face.r ?? 0) + 10), 4);
      }
    });
  });

  describe("network", () => {
    const nodes = (count: number, outside = 0) =>
      Array.from({ length: count }, (_, i) => ({ id: `n${i}`, outside: i >= count - outside }));

    it.each([3, 6, 9, 12])("keeps a radial network of %i nodes inside the body, apart", (count) => {
      const layout = layoutGraph({
        body,
        portrait,
        unit,
        layout: "radial",
        nodes: nodes(count, 1),
      });
      expect(Object.keys(layout.positions)).toHaveLength(count);
      expect(rectContains(body, layout.bounds, 1)).toBe(true);
      const centres = Object.values(layout.positions);
      centres.forEach((a, i) => {
        for (const b of centres.slice(i + 1)) {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(layout.radius * 2);
        }
      });
    });

    it("puts the hub in the middle of the ring", () => {
      const layout = layoutGraph({
        body,
        portrait,
        unit,
        layout: "radial",
        hub: "n2",
        nodes: nodes(6),
      });
      const hub = layout.positions.n2;
      const others = Object.entries(layout.positions).filter(([id]) => id !== "n2");
      const mean = others.reduce((sum, [, point]) => sum + point.x, 0) / others.length;
      expect(hub?.x).toBeCloseTo(mean, 3);
    });

    it("keeps grouped networks inside the body with groups apart", () => {
      const grouped = [
        { id: "new", group: "new" },
        ...Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, group: "org" })),
        { id: "x", group: "else" },
        { id: "y", group: "else" },
      ];
      const layout = layoutGraph({ body, portrait, unit, layout: "groups", nodes: grouped });
      expect(rectContains(body, layout.bounds, 1)).toBe(true);
      const boxes = grouped.map((node) =>
        nodeBox(layout, layout.positions[node.id] ?? { x: 0, y: 0 }),
      );
      expect(disjoint(boxes)).toBe(true);
      const org = clusterRect(
        layout,
        grouped.filter((n) => n.group === "org").map((n) => n.id),
        0,
        0,
      );
      const other = clusterRect(layout, ["x", "y"], 0, 0);
      expect(org && other ? rectsOverlap(org, other) : true).toBe(false);
    });

    it("is deterministic and trims edges to the node circles", () => {
      const input = { body, portrait, unit, layout: "radial" as const, nodes: nodes(5) };
      const layout = layoutGraph(input);
      expect(layoutGraph(input)).toEqual(layout);
      const edge = edgePath(layout, "n0", "n1", 8);
      expect(edge?.kind).toBe("line");
      if (edge?.kind === "line") {
        const from = layout.positions.n0 ?? { x: 0, y: 0 };
        expect(Math.hypot(edge.from.x - from.x, edge.from.y - from.y)).toBeCloseTo(
          layout.radius + 8,
          4,
        );
      }
      expect(edgePath(layout, "n0", "missing", 8)).toBeNull();
    });
  });

  describe("pipeline", () => {
    it.each([2, 4, 6])("keeps %i stages and a result inside the body, in order", (stages) => {
      const layout = layoutPipeline({ body, portrait, unit, stages, hasResult: true });
      expect(layout.stops).toHaveLength(stages + 1);
      const along = layout.stops.map((stop) => (layout.axis === "x" ? stop.x : stop.y));
      expect([...along].sort((a, b) => a - b)).toEqual(along);
      for (const label of layout.labels) expect(rectContains(body, label, 1)).toBe(true);
      expect(disjoint(layout.labels)).toBe(true);
      for (const stop of [layout.start, ...layout.stops]) {
        const token = {
          x: stop.x + layout.tokenOffset.x - layout.token / 2,
          y: stop.y + layout.tokenOffset.y - layout.token / 2,
          width: layout.token,
          height: layout.token,
        };
        expect(rectContains(body, token, 1)).toBe(true);
        for (const label of layout.labels) expect(rectsOverlap(token, label)).toBe(false);
      }
    });
  });

  describe("decision", () => {
    it.each([
      [1, 2],
      [3, 3],
      [5, 4],
    ])("keeps %i signals and %i outcomes inside the body, apart", (signals, outcomes) => {
      const layout = layoutDecision({
        body,
        portrait,
        unit,
        signals,
        outcomes,
        hasDetails: true,
        hasScore: true,
      });
      const cards = [...layout.signals, layout.rule, ...layout.outcomes];
      for (const card of cards) expect(rectContains(body, card, 1)).toBe(true);
      expect(disjoint(cards)).toBe(true);
      expect(layout.inPaths).toHaveLength(signals);
      expect(layout.outPaths).toHaveLength(outcomes);
    });

    it("routes no connector through a card", () => {
      const layout = layoutDecision({
        body,
        portrait,
        unit,
        signals: 4,
        outcomes: 3,
        hasDetails: false,
        hasScore: false,
      });
      const cards = [...layout.signals, layout.rule, ...layout.outcomes];
      for (const path of [...layout.inPaths, ...layout.outPaths]) {
        for (let t = 0.02; t < 1; t += 0.02) {
          const point = pointAt(path, t);
          const inside = cards.some(
            (card) =>
              point.x > card.x + 1 &&
              point.x < card.x + card.width - 1 &&
              point.y > card.y + 1 &&
              point.y < card.y + card.height - 1,
          );
          expect(inside).toBe(false);
        }
      }
    });
  });

  describe("timeline", () => {
    it.each([2, 4, 7])("keeps %i events inside the body, in order", (events) => {
      const layout = layoutRail({ body, portrait, unit, events });
      expect(layout.points).toHaveLength(events);
      for (const box of [...layout.times, ...layout.labels])
        expect(rectContains(body, box, 1)).toBe(true);
      expect(disjoint(layout.labels)).toBe(true);
      layout.labels.forEach((label, i) => {
        const time = layout.times[i];
        expect(time ? rectsOverlap(label, time) : true).toBe(false);
      });
    });
  });

  describe("story", () => {
    const lines = [
      { text: "Identity verification asks one question", role: "lead" as const, marked: false },
      {
        text: "Is this a real person, with a genuine document?",
        role: "support" as const,
        marked: false,
      },
      { text: "Have we already seen this person?", role: "key" as const, marked: false },
    ];

    it("stacks lines inside the body without overlap", () => {
      const boxes = layoutStory({ body, portrait, unit, lines });
      expect(boxes).toHaveLength(3);
      boxes.forEach((box, i) => {
        expect(box.y).toBeGreaterThanOrEqual(body.y - 1);
        expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height + 1);
        const next = boxes[i + 1];
        if (next) expect(next.y).toBeGreaterThanOrEqual(box.y + box.height);
      });
      expect(boxes[0]?.size).toBeGreaterThan(boxes[1]?.size ?? 0);
    });

    it("shrinks every line together when the block is too tall", () => {
      const long = Array.from({ length: 6 }, (_, i) => ({
        text: "A long line of narration that has to wrap over several rows to fit the frame at all",
        role: i === 0 ? ("lead" as const) : ("support" as const),
        marked: i > 0,
      }));
      const boxes = layoutStory({ body, portrait, unit, lines: long });
      const last = boxes.at(-1);
      expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(body.y + body.height + 1);
      expect(boxes[1]?.indent).toBeGreaterThan(0);
    });
  });

  describe("transformation", () => {
    const items = [
      { before: "Repeat sign-ups pass unnoticed", after: "Repeat sign-ups reach a queue" },
      { before: "Found later, if at all", after: "Found during onboarding" },
      { before: "No trail to follow", after: "Both faces, side by side" },
    ];

    it("sets before and after side by side, joined row by row", () => {
      const layout = layoutTransformation({ body, portrait, unit, mode: "side-by-side", items });
      const cells = layout.rows.flatMap((row) => [row.before, row.after]);
      for (const cell of cells) expect(rectContains(body, cell, 1)).toBe(true);
      expect(disjoint(cells)).toBe(true);
      for (const row of layout.rows) {
        expect(row.link).not.toBeNull();
        expect(row.after.y).toBe(row.before.y);
        expect(row.after.x).toBeGreaterThan(row.before.x + row.before.width);
      }
    });

    it("puts the after state exactly where the before state was, in place", () => {
      const layout = layoutTransformation({ body, portrait, unit, mode: "in-place", items });
      for (const row of layout.rows) {
        expect(row.after).toEqual(row.before);
        expect(row.link).toBeNull();
        expect(rectContains(body, row.before, 1)).toBe(true);
      }
    });
  });
});

describe("identity card metrics", () => {
  it("grows with its fields and steps and scales with k", () => {
    const base = { k: 1, width: 540, faceDiameter: 140, placement: "top" as const };
    const bare = identityCardMetrics({ ...base, fields: 0, hasSteps: false });
    const full = identityCardMetrics({ ...base, fields: 3, hasSteps: true });
    expect(full.height).toBeGreaterThan(bare.height);
    expect(bare.footer).toBeNull();
    const doubled = identityCardMetrics({ ...base, k: 2, width: 1080, fields: 3, hasSteps: true });
    expect(doubled.height).toBeCloseTo(full.height * 2, 5);
    expect(
      identityCardMetrics({ ...base, placement: "side", fields: 1, hasSteps: false }).face.cx,
    ).toBeLessThan(0);
    expect(
      identityCardMetrics({ ...base, placement: "inside", fields: 1, hasSteps: false }).face.cx,
    ).toBeGreaterThan(0);
  });
});

describe("matchGroups", () => {
  const accounts = [
    { id: "a", face: "ada" },
    { id: "b", face: "bisi" },
    { id: "c", face: "Ada" },
  ];

  it("groups accounts that share a face seed", () => {
    expect(matchGroups(accounts)).toEqual([["a", "c"]]);
    expect(matchGroups([{ id: "a", face: "ada" }])).toEqual([]);
  });

  it("uses an explicit list when one is given, ignoring unknown ids", () => {
    expect(matchGroups(accounts, ["a", "b", "zzz"])).toEqual([["a", "b"]]);
    expect(matchGroups(accounts, ["a"])).toEqual([]);
  });
});

describe("pipeline progress", () => {
  const arrivals = [30, 60, 120];

  it("waits at the start, arrives on each beat and rests between them", () => {
    expect(pipelinePosition(0, arrivals, 20)).toBe(-1);
    expect(pipelinePosition(10, arrivals, 20)).toBe(-1);
    expect(pipelinePosition(20, arrivals, 20)).toBeCloseTo(-0.5, 6);
    expect(pipelinePosition(30, arrivals, 20)).toBe(0);
    expect(pipelinePosition(39, arrivals, 20)).toBe(0);
    expect(pipelinePosition(50, arrivals, 20)).toBeCloseTo(0.5, 6);
    expect(pipelinePosition(60, arrivals, 20)).toBe(1);
    expect(pipelinePosition(99, arrivals, 20)).toBe(1);
    expect(pipelinePosition(500, arrivals, 20)).toBe(2);
  });

  it("never leaves a stop before arriving at it and never goes backwards", () => {
    const tight = [30, 36, 40];
    let previous = -1;
    for (let frame = 0; frame < 60; frame += 1) {
      const position = pipelinePosition(frame, tight, 20);
      expect(position).toBeGreaterThanOrEqual(previous);
      previous = position;
    }
    expect(pipelinePosition(33, tight, 20)).toBeCloseTo(0.5, 6);
  });

  it("maps a position to a point on the track", () => {
    const layout = layoutPipeline({
      body: { x: 0, y: 0, width: 1600, height: 800 },
      portrait: false,
      unit: 1,
      stages: 3,
      hasResult: false,
    });
    expect(trackPoint(layout, -1)).toEqual(layout.start);
    expect(trackPoint(layout, 0)).toEqual(layout.stops[0]);
    expect(trackPoint(layout, 99)).toEqual(layout.stops[2]);
    const half = trackPoint(layout, 0.5);
    expect(half.x).toBeCloseTo(((layout.stops[0]?.x ?? 0) + (layout.stops[1]?.x ?? 0)) / 2, 5);
  });
});

describe("ranksWithinCue", () => {
  it("counts items that share a cue, and leaves uncued items alone", () => {
    expect(ranksWithinCue(["a", "a", undefined, "b", "a", undefined])).toEqual([0, 1, 0, 0, 2, 0]);
  });
});
