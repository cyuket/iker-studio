import type { WordTiming } from "./captions";
import type { Cue, ProductSceneVisual, Scene } from "./storyboard";

/**
 * Narration-driven beats. A cue names a moment by the words spoken at it; this module turns
 * cues into times from the scene's measured word timings, and checks a storyboard's cues
 * before anything is rendered. Everything here is pure.
 */

/** Lowercases and drops everything that is not a letter or a digit. */
export function normaliseToken(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Words of `text` as they are compared: normalised, with empty tokens dropped. */
export function tokenise(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normaliseToken)
    .filter((token) => token.length > 0);
}

export interface PhraseMatch {
  /** Index of the first matching token. */
  start: number;
  /** Index of the last matching token. */
  end: number;
}

/** The `occurrence`-th place (1 is the first) where the phrase's tokens appear in order. */
export function findPhrase(
  tokens: readonly string[],
  phrase: string,
  occurrence = 1,
): PhraseMatch | null {
  const wanted = tokenise(phrase);
  if (wanted.length === 0) return null;
  let seen = 0;
  for (let i = 0; i + wanted.length <= tokens.length; i += 1) {
    if (wanted.every((token, j) => tokens[i + j] === token)) {
      seen += 1;
      if (seen === occurrence) return { start: i, end: i + wanted.length - 1 };
    }
  }
  return null;
}

export interface BeatOptions {
  /**
   * The scene's narration as written. Used when the spoken words differ from the script
   * (a pronunciation rule rewrote one), to place the cue by its position in the sentence.
   */
  narration?: string;
  /** Length of the scene, for scenes without narration and for clamping. */
  sceneSeconds?: number;
}

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/** Evenly spaced beats for cues that cannot be tied to a spoken word. */
export function fallbackBeats(
  cues: readonly Pick<Cue, "id">[],
  startSeconds: number,
  endSeconds: number,
): Record<string, number> {
  const span = Math.max(0, endSeconds - startSeconds);
  const beats: Record<string, number> = {};
  cues.forEach((cue, index) => {
    beats[cue.id] = round(startSeconds + (span * (index + 1)) / (cues.length + 1));
  });
  return beats;
}

/**
 * Seconds from the start of the scene at which each cue fires. A cue fires when its phrase
 * starts (or finishes) being spoken, shifted by its offset. The first occurrence is used
 * unless the cue names another. A phrase that cannot be found never throws: it is placed by
 * its position in the written narration, or evenly among the other cues, so a render still
 * happens and `cueProblems` is what reports the mistake.
 */
export function resolveBeats(
  words: readonly WordTiming[],
  cues: readonly Cue[],
  narrationOffsetSeconds: number,
  options: BeatOptions = {},
): Record<string, number> {
  if (cues.length === 0) return {};
  const spoken = words
    .map((word) => ({ token: normaliseToken(word.text), word }))
    .filter((entry) => entry.token.length > 0);
  const first = spoken[0]?.word;
  const last = spoken.at(-1)?.word;
  const sceneEnd = options.sceneSeconds;
  if (!first || !last) {
    const end = sceneEnd ?? narrationOffsetSeconds + cues.length + 1;
    return fallbackBeats(cues, Math.min(narrationOffsetSeconds, end), end);
  }

  const spokenTokens = spoken.map((entry) => entry.token);
  const written = options.narration === undefined ? null : tokenise(options.narration);
  const even = fallbackBeats(
    cues,
    narrationOffsetSeconds + first.startSeconds,
    narrationOffsetSeconds + last.endSeconds,
  );
  const clamp = (seconds: number): number =>
    round(Math.max(0, sceneEnd === undefined ? seconds : Math.min(sceneEnd, seconds)));

  const beats: Record<string, number> = {};
  for (const cue of cues) {
    const match = findPhrase(spokenTokens, cue.phrase, cue.occurrence);
    let at: number | null = null;
    if (match) {
      const startWord = spoken[match.start]?.word;
      const endWord = spoken[match.end]?.word;
      if (startWord && endWord) {
        at = cue.at === "end" ? endWord.endSeconds : startWord.startSeconds;
      }
    } else if (written && written.length > 0) {
      const inScript = findPhrase(written, cue.phrase, cue.occurrence);
      if (inScript) {
        // Same sentence, different spelling: place the cue at the same fraction of the clip.
        const index = cue.at === "end" ? inScript.end + 1 : inScript.start;
        const span = last.endSeconds - first.startSeconds;
        at = first.startSeconds + (span * index) / written.length;
      }
    }
    beats[cue.id] =
      at === null
        ? (even[cue.id] ?? clamp(narrationOffsetSeconds))
        : clamp(narrationOffsetSeconds + at + cue.offsetSeconds);
  }
  return beats;
}

/**
 * Every cue id a visual refers to: any `cue`, `...Cue` or `untilCue` string, at any depth.
 * Walking the data rather than listing fields means a new visual kind is covered by default.
 */
export function visualCueRefs(visual: unknown): string[] {
  const refs = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "string" && (key === "cue" || key.endsWith("Cue"))) refs.add(child);
      else if (key !== "settled") walk(child);
    }
  };
  walk(visual);
  return [...refs].sort();
}

/** Cue ids a visual declares as already complete on its first frame, at any depth. */
export function visualSettled(visual: unknown): string[] {
  const settled = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "settled" && Array.isArray(child)) {
        for (const id of child) if (typeof id === "string") settled.add(id);
      } else walk(child);
    }
  };
  walk(visual);
  return [...settled].sort();
}

type CueScene = Pick<Scene, "id" | "narration" | "visual"> & { cues?: Scene["cues"] };

/**
 * Cues whose phrase is not among the words that were actually spoken, in the order given.
 * The compiler refuses to render with any of these: a cue without a moment would leave its
 * animation to be placed by guesswork.
 */
export function unresolvedCues(words: readonly WordTiming[], cues: readonly Cue[]): Cue[] {
  const spoken = tokenise(words.map((word) => word.text).join(" "));
  return cues.filter((cue) => !findPhrase(spoken, cue.phrase, cue.occurrence));
}

/**
 * What is wrong with a scene's cues, in words a storyboard author can act on. Empty when
 * the cues are usable. Phrases are checked against `spokenText`: the words the narration
 * will actually say, which can differ from the script when a voice direction rewrites them.
 * It defaults to the scene's narration.
 */
export function cueProblems(scene: CueScene, spokenText: string = scene.narration): string[] {
  const problems: string[] = [];
  const cues = scene.cues ?? [];
  const where = `Scene "${scene.id}"`;
  const seen = new Set<string>();
  const narration = tokenise(spokenText);

  for (const cue of cues) {
    if (seen.has(cue.id)) {
      problems.push(`${where}: cue "${cue.id}" is defined more than once.`);
      continue;
    }
    seen.add(cue.id);
    if (tokenise(cue.phrase).length === 0) {
      problems.push(`${where}, cue "${cue.id}": the phrase has no words in it.`);
      continue;
    }
    // A scene without narration has nothing to match against; its beats are evenly spaced.
    if (narration.length === 0) continue;
    if (!findPhrase(narration, cue.phrase, 1)) {
      problems.push(
        `${where}, cue "${cue.id}": the phrase "${cue.phrase}" is not in the scene's narration ("${spokenText.trim()}").`,
      );
    } else if (!findPhrase(narration, cue.phrase, cue.occurrence)) {
      problems.push(
        `${where}, cue "${cue.id}": the phrase "${cue.phrase}" is not spoken ${cue.occurrence} times.`,
      );
    }
  }

  const settled = new Set(visualSettled(scene.visual));
  for (const ref of visualCueRefs(scene.visual)) {
    if (!seen.has(ref) && !settled.has(ref)) {
      problems.push(
        `${where}: the visual uses cue "${ref}", which is neither defined in the scene's cues nor listed as settled.`,
      );
    }
  }
  return problems;
}

/** A moment of the scene pinned to a moment of the recording. */
export interface FootageAnchor {
  sceneSeconds: number;
  recordingSeconds: number;
}

/** When a product scene's prelude hands over to the footage; null without a prelude. */
export function handoffSeconds(
  visual: ProductSceneVisual,
  beats: Readonly<Record<string, number>>,
): number | null {
  const prelude = visual.prelude;
  if (!prelude) return null;
  const fromCue = prelude.handoffCue === undefined ? undefined : beats[prelude.handoffCue];
  return fromCue ?? prelude.handoffSeconds ?? 0;
}

/**
 * The scene-to-recording time map of a product scene: where playback starts and which
 * moments are pinned to cues. Always starts with the anchor at which the recording begins,
 * and is strictly increasing in both times, so the footage never runs backwards.
 */
export function footageAnchors(
  visual: ProductSceneVisual,
  beats: Readonly<Record<string, number>>,
): FootageAnchor[] {
  const footage = visual.footage;
  const cueStart = footage?.startCue === undefined ? undefined : beats[footage.startCue];
  // A prelude covers the frame until the handoff, so by default the recording waits for it.
  const begin =
    cueStart ??
    (footage && footage.startSeconds > 0
      ? footage.startSeconds
      : (handoffSeconds(visual, beats) ?? 0));
  const anchors: FootageAnchor[] = [
    { sceneSeconds: Math.max(0, begin), recordingSeconds: footage?.fromSeconds ?? 0 },
  ];
  const pinned = (footage?.anchors ?? [])
    .flatMap((anchor) => {
      const at = beats[anchor.cue];
      return at === undefined
        ? []
        : [{ sceneSeconds: at, recordingSeconds: anchor.recordingSeconds }];
    })
    .sort((a, b) => a.sceneSeconds - b.sceneSeconds);
  for (const anchor of pinned) {
    const previous = anchors.at(-1);
    if (!previous) break;
    if (
      anchor.sceneSeconds > previous.sceneSeconds &&
      anchor.recordingSeconds > previous.recordingSeconds
    ) {
      anchors.push(anchor);
    }
  }
  return anchors;
}

/**
 * The moment of the recording shown at `sceneSeconds`. Before the first anchor the first
 * frame is held; between anchors time is stretched linearly; after the last anchor the
 * recording runs at normal speed and then holds its final frame.
 */
export function footageTimeAt(
  anchors: readonly FootageAnchor[],
  sceneSeconds: number,
  recordingSeconds: number,
): number {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) return Math.min(Math.max(0, sceneSeconds), recordingSeconds);
  const clamp = (value: number): number => Math.min(Math.max(0, value), recordingSeconds);
  if (sceneSeconds <= first.sceneSeconds) return clamp(first.recordingSeconds);
  if (sceneSeconds >= last.sceneSeconds) {
    return clamp(last.recordingSeconds + (sceneSeconds - last.sceneSeconds));
  }
  for (let i = 1; i < anchors.length; i += 1) {
    const from = anchors[i - 1];
    const to = anchors[i];
    if (!from || !to || sceneSeconds > to.sceneSeconds) continue;
    const t = (sceneSeconds - from.sceneSeconds) / (to.sceneSeconds - from.sceneSeconds);
    return clamp(from.recordingSeconds + (to.recordingSeconds - from.recordingSeconds) * t);
  }
  return clamp(last.recordingSeconds);
}

/** How much of the recording a scene may show: all of it, or up to `footage.toSeconds`. */
export function footageLength(visual: ProductSceneVisual, recordingSeconds: number): number {
  const until = visual.footage?.toSeconds;
  return until === undefined ? recordingSeconds : Math.min(recordingSeconds, until);
}

/** The scene second at which the recording has played to its end. */
export function footageEndSeconds(
  anchors: readonly FootageAnchor[],
  recordingSeconds: number,
): number {
  const last = anchors.at(-1);
  if (!last) return recordingSeconds;
  return last.sceneSeconds + Math.max(0, recordingSeconds - last.recordingSeconds);
}
