import { describe, expect, it } from "vitest";
import {
  buildCues,
  estimateWordTimings,
  findOverflowingLines,
  offsetCues,
  speedUpAlignment,
  toSrt,
  toVtt,
  wordsFromAlignment,
} from "../../../src/domain/captions";

const LAYOUT = { maxCharsPerLine: 20, maxLines: 2 };

describe("wordsFromAlignment", () => {
  it("groups characters into words with the first start and last end time", () => {
    const text = "Hi there";
    const words = wordsFromAlignment({
      characters: Array.from(text),
      startSeconds: Array.from(text).map((_, i) => i * 0.1),
      endSeconds: Array.from(text).map((_, i) => i * 0.1 + 0.1),
    });
    expect(words.map((w) => w.text)).toEqual(["Hi", "there"]);
    expect(words[0]).toMatchObject({ startSeconds: 0, endSeconds: 0.2 });
    expect(words[1]?.startSeconds).toBeCloseTo(0.3);
    expect(words[1]?.endSeconds).toBeCloseTo(0.8);
  });
});

describe("estimateWordTimings", () => {
  it("spans exactly the audio length, in order, without overlap", () => {
    const words = estimateWordTimings("One short sentence. Then another, longer one follows.", 6);
    expect(words[0]?.startSeconds).toBe(0);
    expect(words.at(-1)?.endSeconds).toBeCloseTo(6, 5);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]?.startSeconds).toBeGreaterThanOrEqual(words[i - 1]?.endSeconds ?? 0);
    }
  });

  it("leaves a longer gap after a full stop than between ordinary words", () => {
    const words = estimateWordTimings("aa bb. cc dd", 10);
    const gap = (i: number): number =>
      (words[i + 1]?.startSeconds ?? 0) - (words[i]?.endSeconds ?? 0);
    expect(gap(1)).toBeGreaterThan(gap(0));
  });

  it("returns nothing for empty text or zero duration", () => {
    expect(estimateWordTimings("", 5)).toEqual([]);
    expect(estimateWordTimings("words", 0)).toEqual([]);
  });
});

describe("buildCues", () => {
  const words = estimateWordTimings(
    "A user signs up twice. They pass verification again because each check is valid on its own.",
    9,
  );

  it("keeps every line within the format's width and line count", () => {
    const cues = buildCues(words, LAYOUT);
    expect(findOverflowingLines(cues, LAYOUT)).toEqual([]);
    for (const cue of cues) expect(cue.lines.length).toBeLessThanOrEqual(LAYOUT.maxLines);
  });

  it("breaks at sentence ends and keeps every word exactly once", () => {
    const cues = buildCues(words, LAYOUT);
    expect(cues[0]?.lines.join(" ")).toBe("A user signs up twice.");
    expect(cues.flatMap((cue) => cue.words.map((w) => w.text))).toEqual(words.map((w) => w.text));
  });

  it("numbers cues from one and never lets them overlap", () => {
    const cues = buildCues(words, LAYOUT);
    expect(cues.map((cue) => cue.index)).toEqual(cues.map((_, i) => i + 1));
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]?.startSeconds).toBeGreaterThanOrEqual(cues[i - 1]?.endSeconds ?? 0);
    }
  });

  it("reports a single word that cannot fit a line", () => {
    const cues = buildCues(
      [{ text: "Pneumonoultramicroscopicsilicovolcanoconiosis", startSeconds: 0, endSeconds: 1 }],
      LAYOUT,
    );
    expect(findOverflowingLines(cues, LAYOUT)).toHaveLength(1);
  });
});

describe("subtitle files", () => {
  const cues = offsetCues(
    buildCues(estimateWordTimings("Hello there. General greeting.", 4), LAYOUT),
    3661.5,
  );

  it("writes SRT with comma millisecond separators and offset times", () => {
    const srt = toSrt(cues);
    expect(srt.startsWith("1\n01:01:01,500 --> ")).toBe(true);
    expect(srt).toContain("\n\n2\n");
  });

  it("writes WebVTT with a header and dot separators", () => {
    const vtt = toVtt(cues);
    expect(vtt.startsWith("WEBVTT\n\n01:01:01.500 --> ")).toBe(true);
  });

  it("shifts word timings together with the cue", () => {
    expect(cues[0]?.words[0]?.startSeconds).toBeCloseTo(3661.5);
  });
});

describe("speedUpAlignment", () => {
  it("compresses every timing by the playback factor and keeps the characters", () => {
    const sped = speedUpAlignment(
      { characters: ["H", "i"], startSeconds: [0, 0.5], endSeconds: [0.5, 1] },
      2,
    );
    expect(sped).toEqual({
      characters: ["H", "i"],
      startSeconds: [0, 0.25],
      endSeconds: [0.25, 0.5],
    });
  });
});
