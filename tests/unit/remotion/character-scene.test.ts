import { describe, expect, it } from "vitest";
import { FORMATS } from "../../../src/domain/formats";
import {
  CHARACTER_EXPRESSIONS,
  CHARACTER_POSES,
  MotionGraphicVisualSchema,
  type CharacterSceneVisualData,
} from "../../../src/domain/storyboard";
import {
  computeLayout,
  computeZones,
  rectContains,
  rectsOverlap,
  type Rect,
} from "../../../src/remotion/design/layout";
import {
  between,
  blendExpression,
  blendPose,
  blinkAt,
  breathAt,
  characterLook,
  expressionFrame,
  FIGURE,
  heldItem,
  NICHE,
  poseFrame,
  swingArm,
  trackAt,
  waveAt,
} from "../../../src/remotion/lib/character";
import {
  isInitialism,
  keywordLines,
  layoutCharacterScene,
  propSize,
  signupColumns,
} from "../../../src/remotion/lib/character-scene";
import { insetRect, pointAt } from "../../../src/remotion/lib/geometry";

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
/** Rectangles that only touch do not overlap: half a pixel of rounding is allowed for. */
const disjoint = (rects: Rect[]): boolean =>
  rects.every((a, i) =>
    rects.slice(i + 1).every((b) => !rectsOverlap(insetRect(a, 0.5), insetRect(b, 0.5))),
  );
const visual = (input: Record<string, unknown>): CharacterSceneVisualData => {
  const parsed = MotionGraphicVisualSchema.parse({ kind: "character-scene", ...input });
  if (parsed.kind !== "character-scene") throw new Error("not a character scene");
  return parsed;
};

const TOLA = { id: "tola", name: "Tola", skin: "deep", hair: "afro", outfit: "violet" };
const ADA = { id: "ada", name: "Ada", skin: "brown", hair: "bun", outfit: "pink" };
const STRANGER = { id: "stranger", hidden: true };

/** The stages of the explainer the kind was built for, from one character to a full cast. */
const STAGES: Record<string, CharacterSceneVisualData> = {
  "one character, an app and the people signing up": visual({
    cast: [TOLA],
    props: [
      { kind: "app", id: "app", label: "Her app" },
      {
        kind: "signups",
        id: "people",
        label: "New sign-ups",
        people: ["a", "b", "c", "d", "e", "f"].map((face) => ({ face })),
        ask: {},
      },
    ],
    actions: [{ who: "tola", think: "Who are these people?" }],
  }),
  "two characters, each with a card": visual({
    cast: [ADA, STRANGER],
    props: [
      { kind: "card", id: "one", with: "ada", name: "Ada Obi", detail: "Signed up today" },
      { kind: "card", id: "two", with: "stranger", name: "Bola Ade", detail: "Signed up today" },
    ],
  }),
  "a character and a term": visual({
    cast: [TOLA],
    props: [{ kind: "keyword", id: "term", text: "Know Your Customer", short: { text: "KYC" } }],
  }),
  "a thought and somebody holding things up": visual({
    cast: [TOLA, ADA],
    actions: [
      { who: "tola", think: "Is this ID real?" },
      { who: "tola", think: "Is the person holding it really there?" },
      { who: "ada", pose: "hold-id" },
    ],
  }),
  "a character at a laptop beside a list": visual({
    cast: [TOLA],
    props: [
      {
        kind: "checklist",
        id: "list",
        title: "Her workflow",
        items: [
          { label: "Show an ID" },
          { label: "Take a selfie" },
          { label: "Choose which documents are accepted" },
        ],
      },
    ],
  }),
  "a link sent to somebody with steps to do": visual({
    cast: [TOLA, ADA],
    props: [
      {
        kind: "checklist",
        id: "steps",
        with: "ada",
        items: [
          { label: "Open the link", status: "verified" },
          { label: "Show an ID", status: "verified" },
          { label: "Take a selfie", status: "verified" },
        ],
      },
    ],
    actions: [{ who: "ada", say: "Done" }],
    sends: [{ object: "link", from: "tola", to: "ada", label: "Her link" }],
  }),
  "three characters, one asked for two things": visual({
    cast: [TOLA, ADA, STRANGER],
    props: [
      {
        kind: "tiles",
        id: "asked",
        with: "stranger",
        items: [
          { icon: "id-card", label: "An ID" },
          { icon: "selfie", label: "A face to match" },
        ],
      },
    ],
  }),
  "a full cast with a stage order": visual({
    cast: [TOLA, ADA, STRANGER, { id: "dayo", name: "Dayo" }],
    props: [{ kind: "tiles", id: "things", items: [{ icon: "phone" }, { icon: "laptop" }] }],
    stage: ["things", "dayo", "tola"],
  }),
};

describe.each(BODIES)("character scene layout in $id", ({ body, portrait, unit }) => {
  it.each(Object.entries(STAGES))("keeps %s inside the body, nothing overlapping", (_, stage) => {
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const rects = [
      ...layout.figures.flatMap((figure) => [
        figure.rect,
        ...(figure.name ? [figure.name] : []),
        ...(figure.bubble ? [figure.bubble] : []),
      ]),
      ...layout.props.map((prop) => prop.rect),
      ...layout.sends.flatMap((send) => (send ? [send.tile, send.label] : [])),
    ];
    expect(layout.figures).toHaveLength(stage.cast.length);
    expect(layout.props).toHaveLength(stage.props.length);
    for (const rect of rects) expect(rectContains(body, rect, 1)).toBe(true);
    expect(disjoint(rects)).toBe(true);
    expect(rectContains(body, layout.bounds, 1)).toBe(true);
    expect(layout.k).toBeGreaterThan(unit * 0.6);
  });

  it("draws every figure at the same size and in its proportions", () => {
    const layout = layoutCharacterScene({
      body,
      portrait,
      unit,
      visual: STAGES["three characters, one asked for two things"] as CharacterSceneVisualData,
    });
    for (const figure of layout.figures) {
      expect(figure.rect.width).toBeCloseTo(FIGURE.width * layout.k, 5);
      expect(figure.rect.height).toBeCloseTo(FIGURE.height * layout.k, 5);
    }
  });

  it("stands the cast in a row in landscape and recomposes it in portrait", () => {
    const stage = STAGES["a thought and somebody holding things up"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const [tola, ada] = layout.figures;
    if (!tola?.bubble || !ada) throw new Error("missing slots");
    if (portrait) {
      // One above the other, with the bubble beside the head it comes from.
      expect(ada.rect.y).toBeGreaterThan(tola.rect.y + tola.rect.height);
      expect(ada.rect.x).toBeCloseTo(tola.rect.x, 5);
      expect(tola.bubble.x).toBeGreaterThan(tola.rect.x + tola.rect.width);
      expect(tola.bubbleTail).toBe("left");
    } else {
      expect(ada.rect.y).toBeCloseTo(tola.rect.y, 5);
      expect(ada.rect.x).toBeGreaterThan(tola.rect.x + tola.rect.width);
      expect(tola.bubble.y + tola.bubble.height).toBeLessThanOrEqual(tola.rect.y);
      expect(tola.bubbleTail).toBe("down");
      // The one on the right gestures towards the one on the left.
      expect([tola.mirrored, ada.mirrored]).toEqual([false, true]);
    }
  });

  it("puts what belongs to a character under them in landscape and beside them in portrait", () => {
    const stage = STAGES["two characters, each with a card"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const [ada, stranger] = layout.figures;
    const [one, two] = layout.props;
    if (!ada || !stranger || !one || !two) throw new Error("missing slots");
    expect(one.attached && two.attached).toBe(true);
    expect(one.rect.width).toBeCloseTo(two.rect.width, 5);
    if (portrait) {
      expect(one.rect.x).toBeGreaterThan(ada.rect.x + ada.rect.width);
      expect(two.rect.x).toBeCloseTo(one.rect.x, 5);
      expect(two.rect.y).toBeGreaterThan(one.rect.y + one.rect.height);
    } else {
      // The two cards share a line, so "they look the same" can be seen.
      expect(one.rect.y).toBeGreaterThan(ada.rect.y + ada.rect.height);
      expect(two.rect.y).toBeCloseTo(one.rect.y, 5);
    }
  });

  it("stands a prop beside its owner in landscape when the others have none", () => {
    const stage = STAGES["three characters, one asked for two things"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const stranger = layout.figures[2];
    const asked = layout.props[0];
    if (!stranger || !asked) throw new Error("missing slots");
    expect(asked.rect.x).toBeGreaterThan(stranger.rect.x + stranger.rect.width);
    if (!portrait) {
      // The cast keeps one line, and the prop sits level with the figure it belongs to.
      for (const figure of layout.figures) expect(figure.rect.y).toBeCloseTo(stranger.rect.y, 5);
      expect(asked.rect.y + asked.rect.height / 2).toBeCloseTo(
        stranger.rect.y + stranger.rect.height / 2,
        5,
      );
    }
  });

  it.each([
    ["one character and a term", "a character and a term", 0.36],
    ["one character beside a list", "a character at a laptop beside a list", 0.36],
    ["two characters", "a thought and somebody holding things up", 0.36],
    ["two characters and a link", "a link sent to somebody with steps to do", 0.3],
    ["three characters", "three characters, one asked for two things", 0.3],
  ])("draws %s large and in the middle of the body", (_, name, figureShare) => {
    const stage = STAGES[name] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const figure = layout.figures[0];
    if (!figure) throw new Error("no figure");
    // A figure is a good part of the body's height, and the stage reaches across the body
    // one way or the other instead of sitting small in a corner of it.
    expect(figure.rect.height / body.height).toBeGreaterThanOrEqual(figureShare);
    const { bounds } = layout;
    const across = bounds.width / body.width;
    const down = bounds.height / body.height;
    expect(Math.max(across, down)).toBeGreaterThan(0.9);
    expect(across * down).toBeGreaterThan(0.4);
    // Centred on what is seen: the niches, not the empty margins of the figures' boxes.
    const margin = NICHE.x * layout.k + 1;
    expect(Math.abs(bounds.x - (body.width - bounds.x - bounds.width))).toBeLessThanOrEqual(margin);
    expect(Math.abs(bounds.y - (body.height - bounds.y - bounds.height))).toBeLessThanOrEqual(
      margin,
    );
  });

  it("stacks a figure and a small prop in portrait when that draws them larger", () => {
    const stage = visual({
      cast: [ADA],
      props: [{ kind: "tiles", id: "two", items: [{ icon: "id-card" }, { icon: "selfie" }] }],
    });
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const ada = layout.figures[0];
    const two = layout.props[0];
    if (!ada || !two) throw new Error("missing slots");
    if (portrait) {
      expect(two.rect.y).toBeGreaterThan(ada.rect.y + ada.rect.height);
      expect(ada.rect.height / body.height).toBeGreaterThan(0.5);
    } else {
      expect(two.rect.x).toBeGreaterThan(ada.rect.x + ada.rect.width);
    }
  });

  it("leaves room between two characters for what one hands the other", () => {
    const stage = STAGES["a link sent to somebody with steps to do"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const [tola, ada] = layout.figures;
    const send = layout.sends[0];
    if (!tola || !ada || !send) throw new Error("missing slots");
    const rest = pointAt(send.path, 1);
    expect(rest.x).toBeCloseTo(send.tile.x + send.tile.width / 2, 5);
    expect(rest.y).toBeCloseTo(send.tile.y + send.tile.height / 2, 5);
    if (portrait) {
      expect(send.tile.y).toBeGreaterThan(tola.rect.y + tola.rect.height);
      expect(send.tile.y + send.tile.height).toBeLessThan(ada.rect.y);
    } else {
      expect(send.tile.x).toBeGreaterThan(tola.rect.x + tola.rect.width);
      expect(send.tile.x + send.tile.width).toBeLessThan(ada.rect.x);
    }
  });

  it("follows the stage order, then whoever it leaves out", () => {
    const stage = STAGES["a full cast with a stage order"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({ body, portrait, unit, visual: stage });
    const position = (id: string): number => {
      const slot =
        layout.figures.find((figure) => figure.id === id) ??
        layout.props.find((prop) => prop.id === id);
      if (!slot) throw new Error(`no slot for ${id}`);
      // Reading order: by row in portrait (things in a row share a middle line), then across.
      const row = Math.round(slot.rect.y + slot.rect.height / 2);
      return portrait ? row * 10_000 + slot.rect.x : slot.rect.x;
    };
    const order = ["things", "dayo", "tola", "ada", "stranger"].map(position);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("gives a send without both ends no slot instead of a wrong one", () => {
    const stage = STAGES["a character and a term"] as CharacterSceneVisualData;
    const layout = layoutCharacterScene({
      body,
      portrait,
      unit,
      visual: { ...stage, sends: [{ object: "link", from: "tola", to: "nobody" }] },
    });
    expect(layout.sends).toEqual([null]);
  });
});

describe("prop sizes", () => {
  const prop = (input: Record<string, unknown>) => {
    const stage = visual({ cast: [TOLA], props: [{ id: "p", ...input }] });
    const first = stage.props[0];
    if (!first) throw new Error("no prop");
    return first;
  };

  it("grows a checklist with its items and wraps long ones", () => {
    const short = prop({ kind: "checklist", items: [{ label: "Show an ID" }] });
    const long = prop({
      kind: "checklist",
      items: [{ label: "Choose which documents are accepted from every customer" }],
    });
    const two = prop({ kind: "checklist", items: [{ label: "Show an ID" }, { label: "Selfie" }] });
    expect(propSize(long, false, true).height).toBeGreaterThan(propSize(short, false, true).height);
    expect(propSize(two, false, false).height).toBeGreaterThan(
      propSize(short, false, false).height,
    );
  });

  it("fits what belongs to a character into the room a character has", () => {
    const people = prop({
      kind: "signups",
      people: Array.from({ length: 8 }, (_, i) => ({ face: `p${i}` })),
    });
    for (const portrait of [false, true]) {
      expect(propSize(people, portrait, true).width).toBeLessThanOrEqual(440);
    }
    expect(signupColumns(6, false, false)).toBe(3);
    expect(signupColumns(6, true, false)).toBe(3);
    expect(signupColumns(3, true, false)).toBe(3);
    expect(signupColumns(8, false, true)).toBe(3);
  });

  it("sets a short term a word to a line and knows when the short form is its initials", () => {
    expect(keywordLines("Know Your Customer")).toEqual(["Know", "Your", "Customer"]);
    expect(keywordLines("a much longer phrase that has to wrap").length).toBeLessThan(8);
    expect(isInitialism("Know Your Customer", "KYC")).toBe(true);
    expect(isInitialism("Know Your Customer", "kyc ")).toBe(true);
    expect(isInitialism("Know Your Customer", "KYB")).toBe(false);
    expect(isInitialism("Customer", "C")).toBe(false);
  });
});

describe("character looks", () => {
  it("gives the same person for the same seed, whatever its case or spacing", () => {
    expect(characterLook("tola")).toEqual(characterLook(" Tola "));
  });

  it("gives different people across a set of seeds", () => {
    const seeds = ["tola", "ada", "bisi", "chidi", "emeka", "funmi", "gbenga", "halima"];
    const looks = new Set(seeds.map((seed) => JSON.stringify(characterLook(seed))));
    expect(looks.size).toBeGreaterThan(seeds.length - 2);
  });

  it("lets anything stated outright win over the seed", () => {
    const look = characterLook("tola", { skin: "deep", hair: "afro", outfit: "violet" });
    expect(look).toMatchObject({ skin: "deep", hair: "afro", outfit: "violet", hidden: false });
    expect(characterLook("tola", { hidden: true }).hidden).toBe(true);
  });
});

describe("poses", () => {
  const joints = (pose: (typeof CHARACTER_POSES)[number], mirrored: boolean) => {
    const frame = poseFrame(pose, mirrored);
    return [frame.left.elbow, frame.left.hand, frame.right.elbow, frame.right.hand];
  };

  it.each(CHARACTER_POSES)("keeps %s inside the figure's box, mirrored or not", (pose) => {
    for (const mirrored of [false, true]) {
      for (const joint of joints(pose, mirrored)) {
        expect(joint.x).toBeGreaterThanOrEqual(22);
        expect(joint.x).toBeLessThanOrEqual(FIGURE.width - 22);
        expect(joint.y).toBeGreaterThanOrEqual(22);
        expect(joint.y).toBeLessThanOrEqual(FIGURE.height);
      }
    }
  });

  it("mirrors a pose so the busy arm changes sides", () => {
    const plain = poseFrame("wave", false);
    const mirrored = poseFrame("wave", true);
    expect(mirrored.left.hand.x).toBeCloseTo(FIGURE.width - plain.right.hand.x, 5);
    expect(mirrored.left.hand.y).toBe(plain.right.hand.y);
    expect(mirrored.right.hand.x).toBeCloseTo(FIGURE.width - plain.left.hand.x, 5);
    expect(poseFrame("point", true).gaze.x).toBe(-poseFrame("point", false).gaze.x);
  });

  it("puts something in the hand only for the poses that hold something", () => {
    expect(CHARACTER_POSES.filter((pose) => heldItem(pose) !== null)).toEqual([
      "hold-phone",
      "hold-id",
      "selfie",
      "at-laptop",
    ]);
  });

  it("blends between two poses and is exactly either one at the ends", () => {
    const from = poseFrame("idle", false);
    const to = poseFrame("selfie", false);
    expect(blendPose(from, to, 0)).toEqual(from);
    expect(blendPose(from, to, 1)).toEqual(to);
    const half = blendPose(from, to, 0.5);
    expect(half.right.hand.y).toBeCloseTo((from.right.hand.y + to.right.hand.y) / 2, 5);
    expect(between(0.1, 0.3, 1)).toBe(0.3);
    expect(between(0.1, 0.3, 0)).toBe(0.1);
  });

  it("blends between two expressions the same way", () => {
    const from = expressionFrame("happy");
    const to = expressionFrame("worried");
    expect(blendExpression(from, to, 1)).toEqual(to);
    expect(blendExpression(from, to, 0.5).smile).toBeCloseTo((from.smile + to.smile) / 2, 5);
    const smiles = CHARACTER_EXPRESSIONS.map((expression) => expressionFrame(expression).smile);
    expect(Math.max(...smiles)).toBe(expressionFrame("happy").smile);
    expect(Math.min(...smiles)).toBe(expressionFrame("worried").smile);
  });

  it("swings a forearm about its elbow without changing its length", () => {
    const arm = poseFrame("wave", false).right;
    const swung = swingArm(arm, 13);
    const length = (a: typeof arm): number =>
      Math.hypot(a.hand.x - a.elbow.x, a.hand.y - a.elbow.y);
    expect(swung.elbow).toEqual(arm.elbow);
    expect(length(swung)).toBeCloseTo(length(arm), 5);
    expect(swingArm(arm, 0)).toBe(arm);
  });
});

describe("trackAt", () => {
  const track = [
    { start: 0, value: "idle" },
    { start: 60, value: "wave" },
    { start: 30, value: "point" },
  ];

  it("gives the last change that has started and what it replaced", () => {
    expect(trackAt(track, 10)).toEqual({ from: "idle", to: "idle", start: 0 });
    expect(trackAt(track, 30)).toEqual({ from: "idle", to: "point", start: 30 });
    expect(trackAt(track, 200)).toEqual({ from: "point", to: "wave", start: 60 });
    expect(trackAt([], 10)).toBeNull();
  });

  it("applies changes that start together in the order given", () => {
    const settled = track.map((entry) => ({ ...entry, start: -1_000_000 }));
    expect(trackAt(settled, 0)).toEqual({ from: "wave", to: "point", start: -1_000_000 });
  });

  it("shows what is first even before it has started", () => {
    expect(trackAt([{ start: 40, value: "wave" }], 0)?.to).toBe("wave");
  });
});

describe("idle life", () => {
  const scene = { fps: 30, durationFrames: 300, restSeconds: 0.6 };
  const at = (frame: number) => ({ ...scene, frame });

  it("is at rest on the first and last frame, so a held cut still matches", () => {
    for (const frame of [0, 299]) {
      expect(breathAt(at(frame), 4.2, "tola")).toBe(0);
      expect(blinkAt(at(frame), 3.2, 0.14, "tola")).toBe(0);
    }
  });

  it("breathes and blinks in between, on a clock of the character's own", () => {
    const frames = Array.from({ length: 300 }, (_, frame) => frame);
    const breaths = frames.map((frame) => breathAt(at(frame), 4.2, "tola"));
    expect(Math.max(...breaths)).toBeGreaterThan(0.9);
    expect(Math.min(...breaths)).toBeGreaterThanOrEqual(0);
    const blinks = (seed: string): number[] =>
      frames.filter((frame) => blinkAt(at(frame), 3.2, 0.14, seed) > 0.9);
    expect(blinks("tola").length).toBeGreaterThan(0);
    expect(blinks("tola")).not.toEqual(blinks("ada"));
    expect(breathAt(at(120), 4.2, "tola")).toBe(breathAt(at(120), 4.2, "tola"));
  });

  it("waves a few times and then holds the hand still", () => {
    const swings = Array.from({ length: 60 }, (_, frame) => waveAt(frame, 30, 3, 0.42, 13));
    expect(Math.max(...swings.map(Math.abs))).toBeGreaterThan(6);
    expect(Math.max(...swings.map(Math.abs))).toBeLessThanOrEqual(13);
    expect(waveAt(0, 30, 3, 0.42, 13)).toBe(0);
    expect(waveAt(38, 30, 3, 0.42, 13)).toBe(0);
    expect(waveAt(1_000_000, 30, 3, 0.42, 13)).toBe(0);
  });
});
