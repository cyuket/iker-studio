import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAUSE_SECONDS,
  draftSpoken,
  numberToWords,
  phraseEnds,
  scaffoldDirection,
  scaffoldSceneDirection,
  splitSentences,
  uniqueTail,
  validateDirection,
  VoiceDirectionSchema,
  voiceDirectionHash,
  wordStarts,
  type VoiceDirection,
} from "../../../src/domain/voice-direction";

const direction = (scenes: Record<string, unknown>): VoiceDirection =>
  VoiceDirectionSchema.parse({ schemaVersion: 1, videoId: "v", scenes });

const rules = (file: VoiceDirection, ids = ["hook"]): string[] =>
  validateDirection(file, ids).map((issue) => `${issue.severity}:${issue.rule}`);

describe("VoiceDirectionSchema", () => {
  it("fills in pause lengths, delivery and empty lists", () => {
    const parsed = direction({ hook: { spoken: "Hello there." } });
    expect(parsed.pauseSeconds).toEqual(DEFAULT_PAUSE_SECONDS);
    expect(parsed.scenes.hook).toMatchObject({ delivery: "neutral", emphasis: [], pauses: [] });
  });

  it("rejects a delivery outside the fixed vocabulary", () => {
    const result = VoiceDirectionSchema.safeParse({
      schemaVersion: 1,
      videoId: "v",
      scenes: { hook: { spoken: "Hello.", delivery: "laughing" } },
    });
    expect(result.success).toBe(false);
  });

  it("lets a video set its own pause lengths", () => {
    const parsed = VoiceDirectionSchema.parse({
      schemaVersion: 1,
      videoId: "v",
      pauseSeconds: { REVEAL: 1.4 },
      scenes: {},
    });
    expect(parsed.pauseSeconds.REVEAL).toBe(1.4);
    expect(parsed.pauseSeconds.SHORT).toBe(DEFAULT_PAUSE_SECONDS.SHORT);
  });
});

describe("voiceDirectionHash", () => {
  const base = direction({ hook: { spoken: "They pass again.", delivery: "calm" } });

  it("changes when a spoken word, a delivery, a pause or a pause length changes", () => {
    const hash = voiceDirectionHash(base);
    const variants: VoiceDirection[] = [
      direction({ hook: { spoken: "They pass once more.", delivery: "calm" } }),
      direction({ hook: { spoken: "They pass again.", delivery: "curious" } }),
      direction({
        hook: {
          spoken: "They pass again. And again.",
          delivery: "calm",
          pauses: [{ kind: "SHORT", after: "pass again." }],
        },
      }),
      { ...base, pauseSeconds: { ...base.pauseSeconds, REVEAL: 2 } },
    ];
    for (const variant of variants) expect(voiceDirectionHash(variant)).not.toBe(hash);
  });

  it("ignores the author line", () => {
    expect(voiceDirectionHash({ ...base, author: "Someone else" })).toBe(voiceDirectionHash(base));
  });
});

describe("phrase matching", () => {
  it("finds where a phrase ends, only on word boundaries", () => {
    expect(phraseEnds("They pass again. Then pass.", "pass again.")).toEqual([16]);
    expect(phraseEnds("Bypass again. Then pass again. End", "pass again.")).toEqual([30]);
    expect(phraseEnds("They pass again", "pass again")).toEqual([15]);
    expect(phraseEnds("They pass again.", "pass")).toEqual([9]);
  });

  it("finds whole words whatever their case or punctuation", () => {
    expect(wordStarts("A match is a Signal, not a verdict.", "signal")).toEqual([13]);
    expect(wordStarts("Signals are not a signal", "signal")).toEqual([18]);
  });
});

describe("validateDirection", () => {
  it("accepts a well-formed scene", () => {
    const file = direction({
      hook: {
        spoken: "They pass again. Because every check is valid.",
        emphasis: ["valid"],
        pauses: [
          { kind: "REVEAL", after: "pass again." },
          { kind: "TRANSITION", at: "end" },
        ],
      },
    });
    expect(validateDirection(file, ["hook"])).toEqual([]);
  });

  it.each([
    [
      "markup typed into the spoken text",
      { spoken: "[laughs] They pass again." },
      "error:markup-in-spoken",
    ],
    [
      "an SSML tag typed into the spoken text",
      { spoken: 'Wait <break time="1s" /> now.' },
      "error:markup-in-spoken",
    ],
    [
      "emphasis on a word that is not spoken",
      { spoken: "They pass.", emphasis: ["fail"] },
      "error:emphasis-not-found",
    ],
    [
      "a pause after words that are not spoken",
      { spoken: "They pass. Again.", pauses: [{ kind: "SHORT", after: "they fail." }] },
      "error:pause-not-found",
    ],
    [
      "a pause point that matches twice",
      { spoken: "They pass. They pass. End.", pauses: [{ kind: "SHORT", after: "They pass." }] },
      "error:pause-ambiguous",
    ],
    [
      "an inline pause at the very end of a scene",
      { spoken: "They pass. Again.", pauses: [{ kind: "REVEAL", after: "Again." }] },
      "error:pause-at-end",
    ],
    [
      "an inline pause without a place",
      { spoken: "They pass. Again.", pauses: [{ kind: "SHORT", at: "end" }] },
      "error:pause-needs-after",
    ],
    [
      "a transition placed inside a phrase",
      { spoken: "They pass. Again.", pauses: [{ kind: "TRANSITION", after: "They pass." }] },
      "error:pause-needs-edge",
    ],
    [
      "a visual wait with no edge",
      { spoken: "They pass. Again.", pauses: [{ kind: "VISUAL_WAIT" }] },
      "error:pause-needs-edge",
    ],
  ])("rejects %s", (_name, scene, expected) => {
    expect(rules(direction({ hook: scene }))).toContain(expected);
  });

  it("warns when more than three words are emphasised", () => {
    const file = direction({
      hook: { spoken: "One two three four five.", emphasis: ["One", "two", "three", "four"] },
    });
    expect(rules(file)).toEqual(["warning:too-much-emphasis"]);
  });

  it("rejects direction for a scene the script does not have", () => {
    expect(rules(direction({ ghost: { spoken: "Boo." } }), ["hook"])).toEqual([
      "error:unknown-scene",
      "warning:undirected-scene",
    ]);
  });
});

describe("draftSpoken", () => {
  it("contracts auxiliaries without touching the meaning", () => {
    expect(
      draftSpoken("That is the gap. It does not ask. There is a match. You cannot tell."),
    ).toBe("That's the gap. It doesn't ask. There's a match. You can't tell.");
  });

  it("leaves a sentence-final 'it is' alone", () => {
    expect(draftSpoken("Valid, as it is.")).toBe("Valid, as it is.");
  });

  it("writes small numbers and symbols as words", () => {
    expect(draftSpoken("3 weeks later, 21 accounts & 5% more, e.g. this.")).toBe(
      "three weeks later, twenty-one accounts and five percent more, for example, this.",
    );
  });

  it("leaves large numbers, decimals and dates for a person", () => {
    expect(draftSpoken("In 2026, 1,200 users and 3.5 checks.")).toBe(
      "In 2026, 1,200 users and 3.5 checks.",
    );
  });

  it("spells whole numbers below a thousand", () => {
    expect(numberToWords(0)).toBe("zero");
    expect(numberToWords(40)).toBe("forty");
    expect(numberToWords(118)).toBe("one hundred and eighteen");
    expect(numberToWords(1000)).toBeNull();
    expect(numberToWords(2.5)).toBeNull();
  });
});

describe("scaffolding", () => {
  it("splits sentences and finds the shortest unique tail", () => {
    const text = "It could be fraud. It could be a mistake. So a person decides.";
    expect(splitSentences(text)).toHaveLength(3);
    expect(uniqueTail(text, "It could be fraud.")).toBe("be fraud.");
  });

  it("puts a reveal after a contrast, a medium pause after a question and a short one before a turn", () => {
    const scene = scaffoldSceneDirection(
      {
        id: "decision",
        type: "EXPLANATION",
        narration:
          "A match is a signal, not a verdict. Is it fraud? It could be a returning customer. So a person decides it.",
      },
      undefined,
    );
    expect(scene.pauses.map((pause) => [pause.kind, pause.after])).toEqual([
      ["REVEAL", "a verdict."],
      ["MEDIUM", "it fraud?"],
      ["SHORT", "returning customer."],
    ]);
    expect(scene.pauses.every((pause) => pause.why.length > 0)).toBe(true);
    expect(scene.delivery).toBe("curious");
  });

  it("adds composition silence, not text pauses, around demos and scene changes", () => {
    const scene = scaffoldSceneDirection(
      { id: "configure", type: "DEMO", narration: "Open a workflow and go to Rules." },
      { id: "decision", type: "EXPLANATION", narration: "Next." },
    );
    expect(scene.delivery).toBe("confident");
    expect(scene.pauses).toMatchObject([
      { kind: "VISUAL_WAIT", at: "start" },
      { kind: "TRANSITION", at: "end" },
    ]);
  });

  it("drafts a file that passes its own validation and skips silent scenes", () => {
    const scenes = [
      {
        id: "hook",
        type: "PROBLEM",
        narration:
          "A user signs up. Three weeks later, they do it again. Different email. They pass.",
      },
      { id: "silent", type: "INTRO", narration: "" },
      { id: "cta", type: "CTA", narration: "Start free at example.com." },
    ];
    const file = scaffoldDirection("v", [scenes], "Tester");
    expect(Object.keys(file.scenes)).toEqual(["hook", "cta"]);
    const errors = validateDirection(file, ["hook", "cta"]).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("is deterministic", () => {
    const scenes = [{ id: "hook", type: "PROBLEM", narration: "Is it real? It is not." }];
    expect(scaffoldDirection("v", [scenes], "a")).toEqual(scaffoldDirection("v", [scenes], "a"));
  });
});
