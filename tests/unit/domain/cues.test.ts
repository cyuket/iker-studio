import { describe, expect, it } from "vitest";
import type { WordTiming } from "../../../src/domain/captions";
import {
  cueProblems,
  fallbackBeats,
  findPhrase,
  footageAnchors,
  footageEndSeconds,
  footageLength,
  footageTimeAt,
  handoffSeconds,
  normaliseToken,
  resolveBeats,
  tokenise,
  unresolvedCues,
  visualCueRefs,
  visualSettled,
} from "../../../src/domain/cues";
import {
  CueSchema,
  SceneSchema,
  type Cue,
  type ProductSceneVisual,
} from "../../../src/domain/storyboard";

const words = (text: string, step = 0.5): WordTiming[] =>
  text.split(" ").map((word, i) => ({
    text: word,
    startSeconds: i * step,
    endSeconds: i * step + step * 0.8,
  }));
const cue = (input: Partial<Cue> & { id: string; phrase: string }): Cue => CueSchema.parse(input);
const SPOKEN = "A user signs up, passes identity verification, and signs up again.";

describe("tokenising", () => {
  it("ignores case and punctuation", () => {
    expect(normaliseToken("Verification,")).toBe("verification");
    expect(normaliseToken("“Sign-up”")).toBe("signup");
    expect(tokenise("  It's  2 < 3 — really? ")).toEqual(["its", "2", "3", "really"]);
  });

  it("finds a phrase by occurrence", () => {
    const tokens = tokenise(SPOKEN);
    expect(findPhrase(tokens, "Signs UP")).toEqual({ start: 2, end: 3 });
    expect(findPhrase(tokens, "signs up", 2)).toEqual({ start: 8, end: 9 });
    expect(findPhrase(tokens, "signs up", 3)).toBeNull();
    expect(findPhrase(tokens, "signs in")).toBeNull();
    expect(findPhrase(tokens, "...")).toBeNull();
  });
});

describe("resolveBeats", () => {
  const timings = words(SPOKEN);

  it("fires at the start of the phrase, offset by the narration lead-in", () => {
    const beats = resolveBeats(timings, [cue({ id: "signup", phrase: "signs up" })], 0.4);
    expect(beats).toEqual({ signup: 1.4 });
  });

  it("fires at the end of the phrase when asked, and applies the cue's own offset", () => {
    const beats = resolveBeats(
      timings,
      [
        cue({ id: "passed", phrase: "identity verification", at: "end" }),
        cue({ id: "early", phrase: "passes", offsetSeconds: -0.25 }),
      ],
      0,
    );
    expect(beats.passed).toBeCloseTo(6 * 0.5 + 0.4, 5);
    expect(beats.early).toBeCloseTo(4 * 0.5 - 0.25, 5);
  });

  it("uses the first occurrence unless the cue names another", () => {
    const beats = resolveBeats(
      timings,
      [
        cue({ id: "first", phrase: "signs up" }),
        cue({ id: "again", phrase: "signs up", occurrence: 2 }),
      ],
      0,
    );
    expect(beats.first).toBe(1);
    expect(beats.again).toBe(4);
  });

  it("never returns a negative time and never passes the end of the scene", () => {
    const early = resolveBeats(
      timings,
      [cue({ id: "a", phrase: "A user", offsetSeconds: -3 })],
      0.4,
    );
    expect(early.a).toBe(0);
    const late = resolveBeats(timings, [cue({ id: "z", phrase: "again", offsetSeconds: 9 })], 0.4, {
      sceneSeconds: 6,
    });
    expect(late.z).toBe(6);
  });

  it("spaces cues evenly across a scene that has no narration", () => {
    const beats = resolveBeats(
      [],
      [cue({ id: "a", phrase: "one" }), cue({ id: "b", phrase: "two" })],
      0.4,
      {
        sceneSeconds: 6.4,
      },
    );
    expect(beats).toEqual({ a: 2.4, b: 4.4 });
    expect(fallbackBeats([{ id: "x" }], 0, 4)).toEqual({ x: 2 });
  });

  it("gives every cue a time even when its phrase was not spoken", () => {
    const beats = resolveBeats(timings, [cue({ id: "lost", phrase: "biometric" })], 0);
    expect(beats.lost).toBeGreaterThan(0);
    expect(beats.lost).toBeLessThan(timings.at(-1)?.endSeconds ?? 0);
  });

  it("places a reworded phrase by its position in the script when the script is given", () => {
    const spoken = words("Someone signs up twice");
    const beats = resolveBeats(spoken, [cue({ id: "who", phrase: "A user" })], 0, {
      narration: "A user signs up twice",
    });
    expect(beats.who).toBe(0);
  });

  it("returns nothing for a scene without cues", () => {
    expect(resolveBeats(timings, [], 0.4)).toEqual({});
  });
});

describe("unresolvedCues", () => {
  it("lists the cues whose phrase is not among the spoken words", () => {
    const spoken = words("Someone signs up twice");
    const cues = [cue({ id: "who", phrase: "A user" }), cue({ id: "what", phrase: "signs up" })];
    expect(unresolvedCues(spoken, cues).map((entry) => entry.id)).toEqual(["who"]);
  });
});

describe("cueProblems", () => {
  const scene = (input: Record<string, unknown>) =>
    SceneSchema.parse({
      id: "hook",
      type: "PROBLEM",
      narration: SPOKEN,
      estimatedDurationSeconds: 5,
      visual: { kind: "statement", headline: "x" },
      ...input,
    });

  it("accepts cues whose phrases are spoken and whose ids are used", () => {
    expect(
      cueProblems(
        scene({
          cues: [{ id: "signup", phrase: "signs up" }],
          visual: { kind: "story", lines: [{ text: "One", cue: "signup" }] },
        }),
      ),
    ).toEqual([]);
    expect(cueProblems(scene({}))).toEqual([]);
  });

  it("names the scene and the cue whose phrase is not in the narration", () => {
    const problems = cueProblems(scene({ cues: [{ id: "second", phrase: "signs up agian" }] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Scene "hook"');
    expect(problems[0]).toContain('cue "second"');
    expect(problems[0]).toContain("signs up agian");
  });

  it("reports an occurrence that is never reached", () => {
    const problems = cueProblems(
      scene({ cues: [{ id: "third", phrase: "signs up", occurrence: 3 }] }),
    );
    expect(problems[0]).toMatch(/not spoken 3 times/);
  });

  it("reports duplicate ids", () => {
    const problems = cueProblems(
      scene({
        cues: [
          { id: "a", phrase: "A user" },
          { id: "a", phrase: "signs up" },
        ],
      }),
    );
    expect(problems).toEqual(['Scene "hook": cue "a" is defined more than once.']);
  });

  it("reports a cue the visual uses but the scene does not define", () => {
    const problems = cueProblems(
      scene({ visual: { kind: "story", lines: [{ text: "One", cue: "missing" }] } }),
    );
    expect(problems[0]).toContain('"missing"');
  });

  it("accepts a cue that the visual lists as settled", () => {
    expect(
      cueProblems(
        scene({
          visual: { kind: "story", lines: [{ text: "One", cue: "earlier" }], settled: ["earlier"] },
        }),
      ),
    ).toEqual([]);
  });

  it("validates against the spoken text when one is given", () => {
    const target = scene({ cues: [{ id: "who", phrase: "A user" }] });
    expect(cueProblems(target)).toEqual([]);
    expect(cueProblems(target, "Someone signs up twice.")).toHaveLength(1);
    expect(
      cueProblems(scene({ cues: [{ id: "who", phrase: "Someone" }] }), "Someone signs up."),
    ).toEqual([]);
  });

  it("does not check phrases of a scene with no narration", () => {
    expect(cueProblems(scene({ narration: "", cues: [{ id: "a", phrase: "anything" }] }))).toEqual(
      [],
    );
  });
});

describe("cue references", () => {
  const visual = {
    kind: "product",
    prelude: {
      handoffCue: "handoff",
      visual: {
        kind: "network",
        settled: ["old"],
        nodes: [{ id: "a", cue: "node" }],
        edges: [{ mark: { cue: "mark" } }],
      },
    },
    annotations: [{ text: "x", cue: "show", untilCue: "hide" }],
    footage: { startCue: "start" },
  };

  it("finds every cue a visual refers to, at any depth", () => {
    expect(visualCueRefs(visual)).toEqual(["handoff", "hide", "mark", "node", "show", "start"]);
  });

  it("finds settled cues at any depth", () => {
    expect(visualSettled(visual)).toEqual(["old"]);
  });
});

describe("cues of a character scene", () => {
  const characterScene = (visual: Record<string, unknown>, cues: Cue[] = []) =>
    SceneSchema.parse({
      id: "story",
      type: "EXPLANATION",
      narration: "This is Tola. She sends a link, and Ada shows her ID.",
      estimatedDurationSeconds: 5,
      cues,
      visual: { kind: "character-scene", cast: [{ id: "tola" }, { id: "ada" }], ...visual },
    });
  const visual = {
    cast: [{ id: "tola", cue: "tola" }, { id: "ada" }],
    props: [
      {
        kind: "checklist",
        id: "steps",
        with: "ada",
        cue: "list",
        items: [{ label: "Show an ID", status: "verified", cue: "item", statusCue: "tick" }],
      },
      {
        kind: "keyword",
        id: "term",
        text: "Know Your Customer",
        short: { text: "KYC", cue: "kyc" },
      },
      {
        kind: "signups",
        id: "people",
        people: [{ face: "ada", cue: "person" }],
        ask: { cue: "ask" },
      },
    ],
    actions: [{ who: "tola", cue: "act", say: "Here", untilCue: "hush" }],
    sends: [{ from: "tola", to: "ada", cue: "send" }],
    settled: ["earlier"],
  };

  it("collects the cue of every character, prop, item, action and send", () => {
    expect(visualCueRefs(characterScene(visual).visual)).toEqual(
      ["act", "ask", "hush", "item", "kyc", "list", "person", "send", "tick", "tola"].sort(),
    );
    expect(visualSettled(characterScene(visual).visual)).toEqual(["earlier"]);
  });

  it("reports a cue the scene does not define, and accepts defined and settled ones", () => {
    const actions = [
      { who: "tola", cue: "link", pose: "point" },
      { who: "ada", cue: "shows", pose: "hold-id" },
      { who: "ada", cue: "before", expression: "happy" },
    ];
    const cues = [cue({ id: "link", phrase: "sends a link" })];
    expect(cueProblems(characterScene({ actions, settled: ["before"] }, cues))).toEqual([
      'Scene "story": the visual uses cue "shows", which is neither defined in the scene\'s cues nor listed as settled.',
    ]);
    expect(
      cueProblems(
        characterScene({ actions, settled: ["before"] }, [
          ...cues,
          cue({ id: "shows", phrase: "shows her ID" }),
        ]),
      ),
    ).toEqual([]);
  });

  it("refuses a scene that refers to somebody who is not in the cast", () => {
    const messages = (input: Record<string, unknown>): string =>
      SceneSchema.safeParse({
        id: "story",
        type: "EXPLANATION",
        narration: "",
        estimatedDurationSeconds: 5,
        visual: { kind: "character-scene", cast: [{ id: "tola" }, { id: "ada" }], ...input },
      })
        .error?.issues.map((issue) => issue.message)
        .join(" ") ?? "";
    expect(messages({})).toBe("");
    expect(messages({ actions: [{ who: "bola", pose: "wave" }] })).toContain('"bola"');
    expect(messages({ actions: [{ who: "ada", say: "Hi", think: "Hm" }] })).toContain("one bubble");
    expect(messages({ sends: [{ from: "tola", to: "tola" }] })).toContain("same character");
    expect(
      messages({ props: [{ kind: "card", id: "c", name: "Ada Obi", with: "bola" }] }),
    ).toContain("not in the cast");
    expect(messages({ props: [{ kind: "card", id: "ada", name: "Ada Obi" }] })).toContain(
      "more than once",
    );
    expect(messages({ stage: ["ada", "nobody"] })).toContain('"nobody"');
  });
});

describe("footage timing", () => {
  const product = (input: Record<string, unknown>): ProductSceneVisual => {
    const scene = SceneSchema.parse({
      id: "demo",
      type: "DEMO",
      narration: "",
      estimatedDurationSeconds: 5,
      visual: { kind: "product", scenarioId: "s", ...input },
    });
    if (scene.visual.kind !== "product") throw new Error("not a product visual");
    return scene.visual;
  };
  const story = { kind: "story", lines: [{ text: "One" }] };

  it("plays from the first frame by default", () => {
    const anchors = footageAnchors(product({}), {});
    expect(anchors).toEqual([{ sceneSeconds: 0, recordingSeconds: 0 }]);
    expect(footageTimeAt(anchors, 3, 10)).toBe(3);
    expect(footageEndSeconds(anchors, 10)).toBe(10);
  });

  it("waits for the handoff when the scene opens on a prelude", () => {
    const visual = product({ prelude: { visual: story, handoffCue: "go" } });
    expect(handoffSeconds(visual, { go: 4 })).toBe(4);
    const anchors = footageAnchors(visual, { go: 4 });
    expect(footageTimeAt(anchors, 2, 10)).toBe(0);
    expect(footageTimeAt(anchors, 5, 10)).toBe(1);
    expect(footageEndSeconds(anchors, 10)).toBe(14);
    expect(handoffSeconds(product({}), {})).toBeNull();
  });

  it("starts on a cue and from a later second of the recording when asked", () => {
    const anchors = footageAnchors(product({ footage: { startCue: "go", fromSeconds: 3 } }), {
      go: 2,
    });
    expect(anchors).toEqual([{ sceneSeconds: 2, recordingSeconds: 3 }]);
    expect(footageTimeAt(anchors, 1, 10)).toBe(3);
    expect(footageTimeAt(anchors, 4, 10)).toBe(5);
    expect(footageEndSeconds(anchors, 10)).toBe(9);
  });

  it("stops the recording early when the scene only needs its opening", () => {
    const visual = product({ footage: { toSeconds: 4 } });
    const length = footageLength(visual, 10);
    expect(length).toBe(4);
    expect(footageLength(product({ footage: { toSeconds: 40 } }), 10)).toBe(10);
    expect(footageLength(product({}), 10)).toBe(10);
    const anchors = footageAnchors(visual, {});
    expect(footageTimeAt(anchors, 6, length)).toBe(4);
    expect(footageEndSeconds(anchors, length)).toBe(4);
  });

  it("stretches time between anchors and never runs backwards", () => {
    const visual = product({
      footage: {
        anchors: [
          { cue: "a", recordingSeconds: 2 },
          { cue: "back", recordingSeconds: 1 },
          { cue: "b", recordingSeconds: 8 },
        ],
      },
    });
    const anchors = footageAnchors(visual, { a: 4, back: 5, b: 6 });
    expect(anchors.map((anchor) => anchor.recordingSeconds)).toEqual([0, 2, 8]);
    expect(footageTimeAt(anchors, 2, 20)).toBe(1);
    expect(footageTimeAt(anchors, 5, 20)).toBe(5);
    expect(footageTimeAt(anchors, 7, 20)).toBe(9);
    let previous = -1;
    for (let t = 0; t <= 30; t += 0.25) {
      const at = footageTimeAt(anchors, t, 20);
      expect(at).toBeGreaterThanOrEqual(previous);
      expect(at).toBeLessThanOrEqual(20);
      previous = at;
    }
  });
});
