import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type * as Remotion from "remotion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORMATS, type FormatId } from "../../../src/domain/formats";
import { SceneSchema, type Scene } from "../../../src/domain/storyboard";
import {
  createEnvironment,
  SceneEnvironmentProvider,
} from "../../../src/remotion/design/SceneContext";
import { SAMPLE_BRAND } from "../../../src/remotion/sample-props";
import { SceneVisualLayer } from "../../../src/remotion/scenes/SceneComposition";

/**
 * Scenes are rendered separately and joined with hard cuts. For a composition to carry
 * across a cut, the last frame of one scene and the first frame of the next must be the same
 * picture. The renderer is deterministic, so identical markup is identical pixels: this
 * test renders both frames of the visual layer to markup and compares them.
 */

const clock = vi.hoisted(() => ({ frame: 0 }));
vi.mock("remotion", async (original) => ({
  ...(await original<typeof Remotion>()),
  useCurrentFrame: () => clock.frame,
}));

const FPS = 30;

function frameOf(
  scene: Scene,
  formatId: FormatId,
  frame: number,
  durationFrames: number,
  beats: Record<string, number>,
): string {
  clock.frame = frame;
  const environment = createEnvironment({
    brand: SAMPLE_BRAND,
    format: FORMATS[formatId],
    fps: FPS,
    durationFrames,
    reducedMotion: false,
    enter: scene.animation.enter,
    exit: scene.animation.exit ?? "fade",
    beats,
    overlays: { disclosure: false, captions: false, progress: false, lowerThird: false },
  });
  return renderToStaticMarkup(
    createElement(SceneEnvironmentProvider, {
      value: environment,
      children: createElement(SceneVisualLayer, { scene, brand: SAMPLE_BRAND, recording: null }),
    }),
  );
}

/** Where two frames first differ, with enough markup around it to see what; null when equal. */
function firstDifference(a: string, b: string): string | null {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return `at ${i}: "${a.slice(Math.max(0, i - 120), i + 80)}" vs "${b.slice(Math.max(0, i - 120), i + 80)}"`;
}

const scene = (input: Record<string, unknown>): Scene =>
  SceneSchema.parse({
    id: "s",
    type: "EXPLANATION",
    narration: "",
    estimatedDurationSeconds: 5,
    ...input,
  });

const ACCOUNTS = [
  {
    id: "first",
    name: "Ada Obi",
    face: "ada",
    cue: "signup",
    fields: [{ icon: "email", value: "ada.obi@example.com" }],
    steps: [
      { label: "Signed up", cue: "signup" },
      { label: "Identity verified", status: "verified", cue: "verified" },
    ],
  },
  {
    id: "second",
    name: "A. Obi-Okafor",
    face: "ada",
    cue: "again",
    nameCue: "name",
    nameDiffers: true,
    fields: [{ icon: "email", value: "a.okafor@example.com", differs: true, cue: "email" }],
    steps: [{ label: "Identity verified", status: "verified", cue: "pass" }],
  },
];
const GAPS = [{ after: "first", label: "Three weeks later", cue: "later" }];
const FIRST_BEATS = { signup: 0.4, verified: 3, later: 5, again: 7, email: 9, name: 11, pass: 13 };
const FIRST_FRAMES = 18 * FPS;

const ending = scene({
  animation: { exit: "hold" },
  visual: { kind: "identity-story", accounts: ACCOUNTS, gaps: GAPS },
});
const continuing = scene({
  animation: { enter: "hold" },
  visual: {
    kind: "identity-story",
    accounts: ACCOUNTS,
    gaps: GAPS,
    match: { cue: "seen" },
    settled: Object.keys(FIRST_BEATS),
  },
});

describe.each(["youtube-landscape", "youtube-shorts"] as const)(
  "continuity across a hard cut in %s",
  (format) => {
    beforeEach(() => {
      clock.frame = 0;
    });

    it("opens the next scene on the frame the previous scene ended on", () => {
      const last = frameOf(ending, format, FIRST_FRAMES - 1, FIRST_FRAMES, FIRST_BEATS);
      const first = frameOf(continuing, format, 0, 300, { seen: 5 });
      expect(last.length).toBeGreaterThan(1000);
      expect(firstDifference(first, last)).toBeNull();
    });

    it("then carries the story on: the continuing scene changes after its own cue", () => {
      const first = frameOf(continuing, format, 0, 300, { seen: 5 });
      expect(frameOf(continuing, format, 5 * FPS - 1, 300, { seen: 5 })).toBe(first);
      expect(frameOf(continuing, format, 7 * FPS, 300, { seen: 5 })).not.toBe(first);
    });

    it("does not match when the earlier cues are not declared settled", () => {
      const unsettled = scene({
        animation: { enter: "hold" },
        visual: { kind: "identity-story", accounts: ACCOUNTS, gaps: GAPS, match: { cue: "seen" } },
      });
      const last = frameOf(ending, format, FIRST_FRAMES - 1, FIRST_FRAMES, FIRST_BEATS);
      expect(frameOf(unsettled, format, 0, 300, { seen: 5 })).not.toBe(last);
    });

    it("holds a network too, including its drawn edges and marks", () => {
      const visual = {
        kind: "network",
        nodes: [
          { id: "new", type: "face", face: "ada", label: "New selfie", cue: "a" },
          { id: "one", type: "account", face: "bisi", status: "verified", cue: "b" },
          { id: "two", type: "account", face: "ada", status: "verified", cue: "b" },
        ],
        edges: [
          { from: "new", to: "one", cue: "c", signal: true, style: "dashed" },
          {
            from: "new",
            to: "two",
            cue: "c",
            signal: true,
            mark: { cue: "d", label: "Close match" },
          },
        ],
        clusters: [{ nodes: ["new", "one", "two"], label: "Your organisation", cue: "d" }],
      };
      const beats = { a: 1, b: 2, c: 3, d: 5 };
      const last = frameOf(scene({ animation: { exit: "hold" }, visual }), format, 299, 300, beats);
      const first = frameOf(
        scene({ animation: { enter: "hold" }, visual: { ...visual, settled: Object.keys(beats) } }),
        format,
        0,
        200,
        {},
      );
      expect(firstDifference(first, last)).toBeNull();
    });

    it("holds a character scene too: poses, faces, bubbles, marks and what was handed over", () => {
      const visual = {
        kind: "character-scene",
        cast: [
          { id: "tola", name: "Tola", pose: "wave", expression: "happy" },
          { id: "ada", name: "Ada", cue: "a" },
        ],
        props: [
          {
            kind: "checklist",
            id: "steps",
            with: "ada",
            cue: "b",
            items: [
              { label: "Show an ID", status: "verified", statusCue: "c" },
              { label: "Take a selfie", status: "verified", statusCue: "d" },
            ],
          },
        ],
        actions: [
          { who: "tola", cue: "a", pose: "point", say: "Here is a link" },
          { who: "ada", cue: "b", pose: "hold-phone", expression: "curious" },
          { who: "tola", cue: "c", pose: "idle", think: "Is it her?", untilCue: "d" },
          { who: "ada", cue: "c", pose: "hold-id" },
          { who: "ada", cue: "d", pose: "selfie", expression: "happy", status: "verified" },
        ],
        sends: [{ object: "link", from: "tola", to: "ada", label: "A link", cue: "a" }],
      };
      const beats = { a: 1, b: 2.5, c: 4, d: 6 };
      const last = frameOf(scene({ animation: { exit: "hold" }, visual }), format, 299, 300, beats);
      const next = scene({
        animation: { enter: "hold" },
        visual: {
          ...visual,
          settled: Object.keys(beats),
          actions: [...visual.actions, { who: "ada", cue: "e", pose: "idle" }],
        },
      });
      const first = frameOf(next, format, 0, 200, { e: 3 });
      expect(last.length).toBeGreaterThan(1000);
      expect(firstDifference(first, last)).toBeNull();
      // Idle life is at rest at both ends of a scene, and moving in between.
      expect(frameOf(next, format, 60, 200, { e: 3 })).not.toBe(first);
    });
  },
);

describe("scene edges without a hold", () => {
  it("still opens a normal scene on nothing: the first frame draws no card", () => {
    const normal = scene({ visual: { kind: "identity-story", accounts: ACCOUNTS, gaps: GAPS } });
    const first = frameOf(normal, "youtube-landscape", 0, FIRST_FRAMES, FIRST_BEATS);
    expect(first).toMatch(/opacity:0[;"]/);
    expect(first).not.toBe(
      frameOf(ending, "youtube-landscape", FIRST_FRAMES - 1, FIRST_FRAMES, FIRST_BEATS),
    );
  });
});
