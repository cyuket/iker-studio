import { z } from "zod";

/** Character-level timing as returned by speech synthesis with timestamps. */
export const CharacterAlignmentSchema = z
  .object({
    characters: z.array(z.string()),
    startSeconds: z.array(z.number()),
    endSeconds: z.array(z.number()),
  })
  .refine(
    (a) =>
      a.characters.length === a.startSeconds.length && a.characters.length === a.endSeconds.length,
    "alignment arrays must have equal length",
  );
export type CharacterAlignment = z.infer<typeof CharacterAlignmentSchema>;

export const WordTimingSchema = z.object({
  text: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export interface CaptionCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  lines: string[];
  words: WordTiming[];
}

export interface CaptionLayout {
  maxCharsPerLine: number;
  maxLines: number;
}

export function wordsFromAlignment(alignment: CharacterAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let text = "";
  let start = 0;
  let end = 0;
  const flush = (): void => {
    if (text) words.push({ text, startSeconds: start, endSeconds: end });
    text = "";
  };
  alignment.characters.forEach((character, i) => {
    if (/\s/.test(character)) {
      flush();
      return;
    }
    if (!text) start = alignment.startSeconds[i] ?? end;
    text += character;
    end = alignment.endSeconds[i] ?? end;
  });
  flush();
  return words;
}

/** Relative pause after a word, in units of one spoken character. */
function pauseWeight(word: string): number {
  if (/[.!?]["')\]]?$/.test(word)) return 6;
  if (/[,;:—–]["')\]]?$/.test(word)) return 3;
  return 0;
}

/**
 * Estimates word timing when the voice provider returns none: time is shared in proportion
 * to word length, with extra weight after punctuation where speakers pause. This is an
 * approximation, typically within a few hundred milliseconds, and is recorded as such.
 */
export function estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || durationSeconds <= 0) return [];
  const weights = tokens.map((token) => token.replace(/[^\p{L}\p{N}]/gu, "").length + 1);
  const pauses = tokens.map((token, i) => (i === tokens.length - 1 ? 0 : pauseWeight(token)));
  const total = weights.reduce((a, b) => a + b, 0) + pauses.reduce((a, b) => a + b, 0);
  const unit = durationSeconds / total;

  const words: WordTiming[] = [];
  let cursor = 0;
  tokens.forEach((token, i) => {
    const length = (weights[i] ?? 1) * unit;
    words.push({ text: token, startSeconds: cursor, endSeconds: cursor + length });
    cursor += length + (pauses[i] ?? 0) * unit;
  });
  return words;
}

const MAX_CUE_SECONDS = 6;
const SENTENCE_END = /[.!?]["')\]]?$/;

/** Groups words into subtitle cues that fit the format and break at sentence ends. */
export function buildCues(words: readonly WordTiming[], layout: CaptionLayout): CaptionCue[] {
  const capacity = layout.maxCharsPerLine * layout.maxLines;
  const cues: CaptionCue[] = [];
  let current: WordTiming[] = [];

  const flush = (): void => {
    const first = current[0];
    const last = current.at(-1);
    if (!first || !last) return;
    cues.push({
      index: cues.length + 1,
      startSeconds: first.startSeconds,
      endSeconds: last.endSeconds,
      lines: wrapLines(
        current.map((w) => w.text),
        layout,
      ),
      words: current,
    });
    current = [];
  };

  for (const word of words) {
    const first = current[0];
    if (first) {
      const length = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
      const fits =
        wrapLines([...current.map((w) => w.text), word.text], layout).length <= layout.maxLines;
      const tooLong = word.endSeconds - first.startSeconds > MAX_CUE_SECONDS;
      if (length > capacity || !fits || tooLong) flush();
    }
    current.push(word);
    if (SENTENCE_END.test(word.text)) flush();
  }
  flush();
  return closeGaps(cues);
}

/** Greedy wrap; a single word longer than a line is kept whole and reported by QA. */
export function wrapLines(tokens: readonly string[], layout: CaptionLayout): string[] {
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (line && candidate.length > layout.maxCharsPerLine) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Holds each cue until the next one starts when the gap is too short to read as a pause. */
function closeGaps(cues: CaptionCue[]): CaptionCue[] {
  return cues.map((cue, i) => {
    const next = cues[i + 1];
    if (next && next.startSeconds - cue.endSeconds < 0.4) {
      return { ...cue, endSeconds: next.startSeconds };
    }
    return cue;
  });
}

export function offsetCues(
  cues: readonly CaptionCue[],
  offsetSeconds: number,
  firstIndex = 1,
): CaptionCue[] {
  return cues.map((cue, i) => ({
    ...cue,
    index: firstIndex + i,
    startSeconds: cue.startSeconds + offsetSeconds,
    endSeconds: cue.endSeconds + offsetSeconds,
    words: cue.words.map((w) => ({
      ...w,
      startSeconds: w.startSeconds + offsetSeconds,
      endSeconds: w.endSeconds + offsetSeconds,
    })),
  }));
}

function timestamp(seconds: number, separator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60_000) % 60;
  const h = Math.floor(totalMs / 3_600_000);
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

export function toSrt(cues: readonly CaptionCue[]): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${timestamp(cue.startSeconds, ",")} --> ${timestamp(cue.endSeconds, ",")}\n${cue.lines.join("\n")}\n`,
    )
    .join("\n");
}

export function toVtt(cues: readonly CaptionCue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${timestamp(cue.startSeconds, ".")} --> ${timestamp(cue.endSeconds, ".")}\n${cue.lines.join("\n")}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Lines wider than the format allows; these would overflow the safe area on screen. */
export function findOverflowingLines(cues: readonly CaptionCue[], layout: CaptionLayout): string[] {
  return cues.flatMap((cue) =>
    cue.lines.length > layout.maxLines
      ? [cue.lines.join(" / ")]
      : cue.lines.filter((line) => line.length > layout.maxCharsPerLine),
  );
}
