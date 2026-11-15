import { describe, expect, it } from "vitest";
import type { CaptionCue } from "../../../src/domain/captions";
import { activeCue, activeWordIndex, cueLineTokens } from "../../../src/remotion/lib/captions";

const cue = (index: number, start: number, texts: string[], lines: string[]): CaptionCue => ({
  index,
  startSeconds: start,
  endSeconds: start + texts.length * 0.5,
  lines,
  // Each word is spoken for 0.4s and followed by a 0.1s pause.
  words: texts.map((text, i) => ({
    text,
    startSeconds: start + i * 0.5,
    endSeconds: start + i * 0.5 + 0.4,
  })),
});

const first = cue(1, 1, ["Know", "who", "you", "are"], ["Know who", "you are"]);
const second = cue(2, 3.5, ["dealing", "with."], ["dealing with."]);
const cues = [first, second];

describe("activeCue", () => {
  it("returns null before, between and after cues", () => {
    expect(activeCue(cues, 0.5)).toBeNull();
    expect(activeCue(cues, 3.2)).toBeNull();
    expect(activeCue(cues, 9)).toBeNull();
  });

  it("includes the start and excludes the end", () => {
    expect(activeCue(cues, 1)).toBe(first);
    expect(activeCue(cues, 2.999)).toBe(first);
    expect(activeCue(cues, 3)).toBeNull();
    expect(activeCue(cues, 3.5)).toBe(second);
  });
});

describe("activeWordIndex", () => {
  it("is -1 before the first word starts", () => {
    expect(activeWordIndex(first, 0.9)).toBe(-1);
  });

  it("selects the word being spoken", () => {
    expect(activeWordIndex(first, 1)).toBe(0);
    expect(activeWordIndex(first, 1.6)).toBe(1);
    expect(activeWordIndex(first, 2.5)).toBe(3);
  });

  it("stays on a word through the pause after it", () => {
    expect(activeWordIndex(first, 1.45)).toBe(0);
  });

  it("stays on the last word once the cue has been spoken", () => {
    expect(activeWordIndex(first, 10)).toBe(3);
  });
});

describe("cueLineTokens", () => {
  it("maps wrapped lines back onto timed words in reading order", () => {
    expect(cueLineTokens(first)).toEqual([
      [
        { text: "Know", wordIndex: 0 },
        { text: "who", wordIndex: 1 },
      ],
      [
        { text: "you", wordIndex: 2 },
        { text: "are", wordIndex: 3 },
      ],
    ]);
  });

  it("marks text with no timed word instead of mis-highlighting it", () => {
    const untimed: CaptionCue = { ...second, lines: ["dealing with. Extra"] };
    expect(cueLineTokens(untimed)[0]?.at(-1)).toEqual({ text: "Extra", wordIndex: -1 });
  });
});
