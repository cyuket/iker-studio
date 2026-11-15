import { describe, expect, it } from "vitest";
import { wordsFromAlignment, type CharacterAlignment } from "../../../src/domain/captions";
import {
  DEFAULT_PAUSE_SECONDS,
  SceneDirectionSchema,
  type SceneDirection,
} from "../../../src/domain/voice-direction";
import { capabilitiesFor } from "../../../src/domain/voice-models";
import {
  measurePauses,
  plainAlignment,
  renderPerformance,
  type PerformanceInput,
} from "../../../src/domain/voice-performance";
import { VOICE_PRESETS, type PresetId } from "../../../src/domain/voice-presets";

const SPOKEN =
  "They pass again. Because every check is valid. A match is a signal, not a verdict. It could be fraud.";

const direction = (overrides: Partial<SceneDirection> = {}): SceneDirection =>
  SceneDirectionSchema.parse({
    spoken: SPOKEN,
    delivery: "curious",
    emphasis: ["signal"],
    pauses: [
      { kind: "REVEAL", after: "pass again." },
      { kind: "MEDIUM", after: "is valid." },
      { kind: "SHORT", after: "a verdict." },
      { kind: "TRANSITION", at: "end" },
      { kind: "VISUAL_WAIT", at: "start" },
    ],
    ...overrides,
  });

const input = (
  modelId: string,
  preset: PresetId = "natural-educator",
  scene: SceneDirection | null = direction(),
): PerformanceInput => ({
  spoken: SPOKEN,
  direction: scene,
  preset: VOICE_PRESETS[preset],
  capabilities: capabilitiesFor(modelId),
  pauseSeconds: DEFAULT_PAUSE_SECONDS,
});

/** An alignment that echoes the text, one character per 10 ms, like the real endpoint. */
function echo(text: string): CharacterAlignment {
  const characters = Array.from(text);
  return {
    characters,
    startSeconds: characters.map((_, i) => i * 0.01),
    endSeconds: characters.map((_, i) => (i + 1) * 0.01),
  };
}

describe("renderPerformance on eleven_v4", () => {
  const rendered = renderPerformance(input("eleven_v4"));

  it("opens with one style tag that carries the delivery", () => {
    expect(rendered.text.startsWith("[warm, conversational, curious] They pass again.")).toBe(true);
    expect(rendered.leadingTag).toBe("[warm, conversational, curious]");
  });

  it("never sends SSML to a model that does not support it", () => {
    expect(rendered.text).not.toContain("<break");
    expect(rendered.text).not.toContain("<");
  });

  it("writes pauses the way the preset asks: tag for the reveal, paragraph for medium, punctuation for short", () => {
    const byKind = Object.fromEntries(rendered.pauses.map((p) => [p.kind, p.rendering]));
    expect(byKind).toEqual({ REVEAL: "tag", MEDIUM: "paragraph", SHORT: "punctuation" });
    expect(rendered.text).toContain("They pass again. [pause] Because");
    expect(rendered.text).toContain("is valid.\n\n A match");
  });

  it("capitalises an emphasised word and nothing else", () => {
    expect(rendered.text).toContain("is a SIGNAL, not a verdict");
    expect(rendered.emphasised).toEqual(["signal"]);
  });

  it("keeps composition pauses out of the text and reports them as scene silence", () => {
    expect(rendered.composition).toEqual({ leadInSeconds: 1.6, tailSeconds: 0.8 });
    expect(rendered.text).not.toMatch(/TRANSITION|VISUAL_WAIT/);
  });

  it("maps every character back to the plain words", () => {
    expect(rendered.origin).toHaveLength(rendered.text.length);
    const rebuilt = rendered.origin
      .filter((index) => index >= 0)
      .map((index) => rendered.plain[index])
      .join("");
    expect(rebuilt).toBe(rendered.plain);
    expect(rendered.plain).toBe(SPOKEN);
  });

  it("caps pause tags by the preset's density and falls back to text structure", () => {
    const many = direction({
      emphasis: [],
      pauses: [
        { kind: "REVEAL", after: "pass again.", why: "" },
        { kind: "REVEAL", after: "is valid.", why: "" },
        { kind: "REVEAL", after: "a verdict.", why: "" },
      ],
    });
    const capped = renderPerformance(input("eleven_v4", "natural-educator", many));
    expect(capped.pauses.filter((p) => p.rendering === "tag")).toHaveLength(1);
    expect(capped.pauses.filter((p) => p.rendering === "paragraph")).toHaveLength(2);
    expect(capped.notes.join(" ")).toMatch(/tag limit/);
  });

  it("uses no pause tags at all in the technical preset, and no capitals", () => {
    const technical = renderPerformance(input("eleven_v4", "technical-expert"));
    expect(technical.text).not.toMatch(/\[(short |long )?pause\]/);
    expect(technical.text).not.toContain("SIGNAL");
    expect(technical.notes.join(" ")).toMatch(/emphasis mark/);
  });

  it("speaks an undirected scene plainly, with the preset's style tag only", () => {
    const plain = renderPerformance(input("eleven_v4", "natural-educator", null));
    expect(plain.text).toBe(`[warm, conversational] ${SPOKEN}`);
  });
});

describe("renderPerformance on models with SSML breaks", () => {
  const rendered = renderPerformance(input("eleven_multilingual_v2"));

  it("uses timed breaks and never a bracketed tag", () => {
    expect(rendered.text).not.toContain("[");
    expect(rendered.leadingTag).toBeNull();
    // REVEAL 1.1 s minus the 0.25 s the full stop already gives.
    expect(rendered.text).toContain('They pass again. <break time="0.85s" /> Because');
    expect(rendered.text).toContain('is valid. <break time="0.45s" /> A match');
  });

  it("does not capitalise for emphasis, and says so", () => {
    expect(rendered.text).toContain("is a signal, not a verdict");
    expect(rendered.notes.join(" ")).toMatch(/Emphasis is recorded but not marked up/);
    expect(rendered.notes.join(" ")).toMatch(/Delivery "curious" is recorded but not sent/);
  });

  it("never asks for a break longer than the documented three seconds", () => {
    const long = renderPerformance({
      ...input("eleven_multilingual_v2"),
      pauseSeconds: { ...DEFAULT_PAUSE_SECONDS, REVEAL: 5 },
    });
    expect(long.text).toContain('<break time="3s" />');
  });

  it("stops adding breaks at the per-request limit", () => {
    const spoken = "One. Two. Three. Four. Five. Six. Seven.";
    const scene = SceneDirectionSchema.parse({
      spoken,
      pauses: ["One.", "Two.", "Three.", "Four.", "Five.", "Six."].map((after) => ({
        kind: "MEDIUM",
        after,
      })),
    });
    const out = renderPerformance({
      ...input("eleven_flash_v2_5", "natural-educator", scene),
      spoken,
    });
    expect(out.text.match(/<break/g)).toHaveLength(4);
    expect(out.pauses.filter((p) => p.rendering === "paragraph")).toHaveLength(2);
  });
});

describe("renderPerformance on an unknown model", () => {
  const rendered = renderPerformance(input("some-future-model"));

  it("sends no markup of any kind, only paragraph breaks", () => {
    expect(rendered.text).not.toMatch(/[[\]<>]/);
    expect(rendered.text.replace(/\n\n/g, "")).toBe(SPOKEN);
    expect(rendered.pauses.find((p) => p.kind === "SHORT")?.rendering).toBe("punctuation");
  });
});

describe("plainAlignment", () => {
  it("removes tags and restores capitalised words, so stored words are the spoken words", () => {
    const rendered = renderPerformance(input("eleven_v4"));
    const words = wordsFromAlignment(plainAlignment(echo(rendered.text), rendered));
    expect(words.map((word) => word.text).join(" ")).toBe(SPOKEN);
    expect(words.some((word) => /[[\]]/.test(word.text))).toBe(false);
    expect(words.find((word) => word.text.startsWith("signal"))).toBeDefined();
  });

  it("keeps the real time of each word: the first word starts after the tag", () => {
    const rendered = renderPerformance(input("eleven_v4"));
    const [first] = wordsFromAlignment(plainAlignment(echo(rendered.text), rendered));
    const tagLength = "[warm, conversational, curious] ".length;
    expect(first?.text).toBe("They");
    expect(first?.startSeconds).toBeCloseTo(tagLength * 0.01, 5);
  });

  it("removes SSML breaks from timings too", () => {
    const rendered = renderPerformance(input("eleven_multilingual_v2"));
    const words = wordsFromAlignment(plainAlignment(echo(rendered.text), rendered));
    expect(words.map((word) => word.text).join(" ")).toBe(SPOKEN);
  });

  it("still strips markup by pattern when the provider normalised the text", () => {
    const rendered = renderPerformance(input("eleven_v4"));
    const altered = echo(`[warm] ${SPOKEN.replace("They", "they")} [pause] done.`);
    const words = wordsFromAlignment(plainAlignment(altered, rendered));
    expect(words.map((word) => word.text).join(" ")).toBe(
      `${SPOKEN.replace("They", "they")} done.`,
    );
  });

  it("leaves a plain alignment untouched", () => {
    const rendered = renderPerformance(input("some-future-model", "technical-expert", null));
    expect(plainAlignment(echo(rendered.text), rendered).characters.join("")).toBe(SPOKEN);
  });
});

describe("measurePauses", () => {
  it("reads the gap after each directed pause from the word timings", () => {
    const rendered = renderPerformance(input("eleven_v4"));
    const words = SPOKEN.split(" ").map((text, index) => ({
      text,
      startSeconds: index + (index >= 3 ? 0.9 : 0),
      endSeconds: index + 0.5 + (index >= 3 ? 0.9 : 0),
    }));
    const measured = measurePauses(rendered, words);
    const reveal = measured.find((pause) => pause.kind === "REVEAL");
    // "They pass again." is three words, so the pause is the gap before the fourth.
    expect(reveal?.measuredSeconds).toBeCloseTo(1.4, 5);
    expect(reveal?.targetSeconds).toBeCloseTo(1.1, 5);
  });

  it("reports null when the timings do not reach the pause", () => {
    const rendered = renderPerformance(input("eleven_v4"));
    expect(measurePauses(rendered, [])[0]?.measuredSeconds).toBeNull();
  });
});
