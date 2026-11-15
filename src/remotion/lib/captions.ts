import type { CaptionCue } from "../../domain/captions";

/** The cue on screen at `seconds`, or null between cues. Cue ends are exclusive. */
export function activeCue(cues: readonly CaptionCue[], seconds: number): CaptionCue | null {
  return cues.find((cue) => seconds >= cue.startSeconds && seconds < cue.endSeconds) ?? null;
}

/**
 * Index of the word being spoken at `seconds`: the last word that has started. Returns -1
 * before the first word, and stays on a word through the pause that follows it so the
 * emphasis never flickers off mid-cue.
 */
export function activeWordIndex(cue: CaptionCue, seconds: number): number {
  let active = -1;
  cue.words.forEach((word, i) => {
    if (seconds >= word.startSeconds) active = i;
  });
  return active;
}

export interface CaptionToken {
  text: string;
  /** Index into `cue.words`, or -1 when the line text has no matching timed word. */
  wordIndex: number;
}

/** Maps each wrapped line back onto the cue's timed words, in reading order. */
export function cueLineTokens(cue: CaptionCue): CaptionToken[][] {
  let next = 0;
  return cue.lines.map((line) =>
    line
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => {
        const wordIndex = next < cue.words.length ? next : -1;
        next += 1;
        return { text, wordIndex };
      }),
  );
}
