import { describe, expect, it } from "vitest";
import { MotionGraphicVisualSchema } from "../../../src/domain/storyboard";
import { rectContains, rectsOverlap } from "../../../src/remotion/design/layout";
import { motionGraphicAnchor } from "../../../src/remotion/lib/anchors";
import {
  fitBrowserFrame,
  handoffTransform,
  layoutProduct,
  regionOnScreen,
} from "../../../src/remotion/lib/product-layout";

const u = (n: number): number => n;
const base = {
  u,
  heading: "Face search rules, in the workflow" as string | undefined,
  hasCallout: false,
  aspect: 1.6,
  barHeight: 48,
  wantsDetail: false,
  detailHeader: 56,
};
const LANDSCAPE = { width: 1728, height: 952 };
const PORTRAIT = { width: 866, height: 1068 };

describe("layoutProduct", () => {
  it("puts the text column beside the frame in landscape, both inside the zone", () => {
    const geometry = layoutProduct({ ...base, content: LANDSCAPE, portrait: false });
    const zone = { x: 0, y: 0, ...LANDSCAPE };
    expect(geometry.text).not.toBeNull();
    expect(rectContains(zone, geometry.frame, 1)).toBe(true);
    if (geometry.text) {
      expect(rectContains(zone, geometry.text, 1)).toBe(true);
      expect(rectsOverlap(geometry.text, geometry.frame)).toBe(false);
    }
    expect(geometry.viewport.width / geometry.viewport.height).toBeCloseTo(1.6, 4);
    expect(geometry.viewport.y).toBe(geometry.frame.y + 48);
    expect(geometry.detail).toBeNull();
  });

  it("gives the frame the whole width when there is nothing to say beside it", () => {
    const alone = layoutProduct({
      ...base,
      heading: undefined,
      content: LANDSCAPE,
      portrait: false,
    });
    const withText = layoutProduct({ ...base, content: LANDSCAPE, portrait: false });
    expect(alone.text).toBeNull();
    expect(alone.frame.width).toBeGreaterThan(withText.frame.width);
    expect(
      layoutProduct({
        ...base,
        heading: undefined,
        hasCallout: true,
        content: LANDSCAPE,
        portrait: false,
      }).text,
    ).not.toBeNull();
  });

  it("stacks heading, frame and detail in portrait without overlap", () => {
    const geometry = layoutProduct({
      ...base,
      content: PORTRAIT,
      portrait: true,
      wantsDetail: true,
    });
    const zone = { x: 0, y: 0, ...PORTRAIT };
    expect(geometry.detail).not.toBeNull();
    for (const rect of [geometry.text, geometry.frame, geometry.detail]) {
      if (rect) expect(rectContains(zone, rect, 1)).toBe(true);
    }
    if (geometry.text && geometry.detail) {
      expect(geometry.frame.y).toBeGreaterThanOrEqual(geometry.text.y + geometry.text.height);
      expect(geometry.detail.y).toBeGreaterThanOrEqual(geometry.frame.y + geometry.frame.height);
    }
  });

  it("drops the detail when it was not asked for", () => {
    expect(layoutProduct({ ...base, content: PORTRAIT, portrait: true }).detail).toBeNull();
  });

  it("fits a frame to its box and maps regions onto the viewport", () => {
    const size = fitBrowserFrame(1000, 500, 1.6, 48);
    expect(size.height).toBeLessThanOrEqual(500);
    expect(size.width / size.viewportHeight).toBeCloseTo(1.6, 5);
    expect(
      regionOnScreen(
        { x: 0.5, y: 0.5, width: 0.25, height: 0.1 },
        { x: 100, y: 200, width: 800, height: 500 },
      ),
    ).toEqual({
      x: 500,
      y: 450,
      width: 200,
      height: 50,
    });
  });
});

describe("handoffTransform", () => {
  const from = { x: 800, y: 500, width: 200, height: 200 };
  const to = { x: 300, y: 600, width: 600, height: 150 };
  const bounds = { x: 100, y: 100, width: 1500, height: 750 };

  it("starts as the untouched graphic and ends collapsed onto the target", () => {
    const start = handoffTransform(from, to, 0, bounds);
    expect(start).toEqual({ scale: 1, translateX: 0, translateY: 0, outgoing: 1, incoming: 0 });
    const end = handoffTransform(from, to, 1, bounds);
    expect(end.outgoing).toBe(0);
    expect(end.incoming).toBe(1);
    expect(end.translateX).toBe(600 - 900);
    expect(end.translateY).toBe(675 - 600);
    // Everything the graphic drew now fits inside the target.
    expect(bounds.width * end.scale).toBeLessThanOrEqual(to.width + 1e-6);
    expect(bounds.height * end.scale).toBeLessThanOrEqual(to.height + 1e-6);
  });

  it("is continuous: scale and position change steadily while the pictures cross", () => {
    let previous = handoffTransform(from, to, 0, bounds);
    let crossed = false;
    for (let p = 0.05; p <= 1.0001; p += 0.05) {
      const state = handoffTransform(from, to, p, bounds);
      expect(state.scale).toBeLessThanOrEqual(previous.scale);
      expect(state.outgoing).toBeLessThanOrEqual(previous.outgoing);
      expect(state.incoming).toBeGreaterThanOrEqual(previous.incoming);
      if (state.outgoing > 0 && state.incoming > 0) crossed = true;
      previous = state;
    }
    expect(crossed).toBe(true);
  });

  it("never blows the graphic up", () => {
    expect(
      handoffTransform(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 0, y: 0, width: 900, height: 900 },
        1,
      ).scale,
    ).toBeLessThanOrEqual(1.15);
  });
});

describe("motionGraphicAnchor", () => {
  const context = {
    content: LANDSCAPE,
    portrait: false,
    unit: 1,
    metrics: { u, pick: <T>(landscape: T) => landscape, headingSize: 60, headingLineHeight: 1.08 },
  };
  const zone = { x: 0, y: 0, ...LANDSCAPE };
  const network = MotionGraphicVisualSchema.parse({
    kind: "network",
    heading: "Who the face is compared with",
    nodes: [
      { id: "new", type: "face" },
      { id: "a", type: "account" },
      { id: "b", type: "account" },
    ],
  });

  it("finds an element by id, inside the whole drawing, below the heading", () => {
    const whole = motionGraphicAnchor(network, undefined, context);
    const node = motionGraphicAnchor(network, "a", context);
    expect(rectContains(zone, whole, 1)).toBe(true);
    expect(rectContains(whole, node, 1)).toBe(true);
    expect(node.width).toBeLessThan(whole.width);
    expect(whole.y).toBeGreaterThan(60);
  });

  it("falls back to the whole drawing for an id the graphic does not have", () => {
    expect(motionGraphicAnchor(network, "nope", context)).toEqual(
      motionGraphicAnchor(network, undefined, context),
    );
  });

  it("answers for every kind of graphic", () => {
    const visuals = [
      { kind: "identity-story", accounts: [{ id: "one", name: "Ada Obi", face: "ada" }] },
      { kind: "pipeline", object: { type: "person" }, stages: [{ label: "A" }, { label: "B" }] },
      {
        kind: "decision",
        signals: [{ id: "s", label: "Signal" }],
        rule: { label: "Rule" },
        outcomes: [
          { id: "yes", label: "Approve", status: "verified" },
          { id: "no", label: "Decline", status: "declined" },
        ],
      },
      { kind: "timeline", events: [{ label: "A" }, { label: "B" }] },
      { kind: "story", lines: [{ text: "One line" }] },
      {
        kind: "transformation",
        before: { title: "Before" },
        after: { title: "After" },
        items: [{ before: "a", after: "b" }],
      },
      {
        kind: "character-scene",
        cast: [{ id: "tola", name: "Tola" }, { id: "ada" }],
        props: [{ kind: "card", id: "card", name: "Ada Obi", with: "ada" }],
      },
    ].map((visual) => MotionGraphicVisualSchema.parse(visual));
    const anchors = ["one", "1", "rule", "0", undefined, "0", "card"];
    visuals.forEach((visual, i) => {
      const rect = motionGraphicAnchor(visual, anchors[i], context);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rectContains(zone, rect, 1)).toBe(true);
    });
  });
});
