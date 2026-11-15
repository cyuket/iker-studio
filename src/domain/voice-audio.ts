import { z } from "zod";
import type { WordTiming } from "./captions";

/**
 * Arithmetic on narration measurements. Nothing here judges how a clip sounds: these are
 * the quantities software can state with confidence, and the reports say so.
 */

export const ClipMeasurementSchema = z.object({
  durationSeconds: z.number().min(0),
  integratedLufs: z.number().nullable(),
  truePeakDbtp: z.number().nullable(),
  loudnessRange: z.number().nullable(),
  /** Highest sample level. At or near 0 dBFS the clip is clipped. */
  samplePeakDb: z.number().nullable(),
  /** Loudest sample in the first and last 10 ms. A loud edge can click at a join. */
  startEdgeDb: z.number().nullable(),
  endEdgeDb: z.number().nullable(),
  /** Stretches below the silence threshold, in seconds from the start of the clip. */
  silences: z.array(z.object({ startSeconds: z.number(), endSeconds: z.number() })),
});
export type ClipMeasurement = z.infer<typeof ClipMeasurementSchema>;

/** A pause shorter than this is articulation, not a pause a listener registers. */
export const PAUSE_FLOOR_SECONDS = 0.25;
/** An edge quieter than this cannot click when clips are joined. */
export const SILENT_EDGE_DB = -50;
/** Sample peaks above this are treated as clipped. */
export const CLIPPING_DB = -0.1;

export interface Pace {
  words: number;
  /** First word start to last word end. */
  speechSeconds: number;
  wordsPerMinute: number;
  /** Words per minute with pauses taken out: how fast the words themselves are said. */
  articulationWordsPerMinute: number;
}

export interface WordGap {
  afterWord: string;
  atSeconds: number;
  seconds: number;
}

/** Gaps between consecutive words at least `minSeconds` long. */
export function wordGaps(
  words: readonly WordTiming[],
  minSeconds = PAUSE_FLOOR_SECONDS,
): WordGap[] {
  const gaps: WordGap[] = [];
  words.forEach((word, index) => {
    const next = words[index + 1];
    if (!next) return;
    const seconds = next.startSeconds - word.endSeconds;
    if (seconds >= minSeconds) {
      gaps.push({ afterWord: word.text, atSeconds: word.endSeconds, seconds });
    }
  });
  return gaps;
}

export function paceOf(words: readonly WordTiming[]): Pace | null {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) return null;
  const speechSeconds = last.endSeconds - first.startSeconds;
  if (speechSeconds <= 0) return null;
  const paused = wordGaps(words).reduce((total, gap) => total + gap.seconds, 0);
  const articulating = Math.max(0.001, speechSeconds - paused);
  return {
    words: words.length,
    speechSeconds,
    wordsPerMinute: (words.length / speechSeconds) * 60,
    articulationWordsPerMinute: (words.length / articulating) * 60,
  };
}

export interface PauseSummary {
  count: number;
  totalSeconds: number;
  longestSeconds: number;
  medianSeconds: number;
  /** Share of the speech span spent in pauses, 0 to 1. */
  share: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function summarisePauses(words: readonly WordTiming[]): PauseSummary {
  const gaps = wordGaps(words).map((gap) => gap.seconds);
  const pace = paceOf(words);
  const totalSeconds = gaps.reduce((a, b) => a + b, 0);
  return {
    count: gaps.length,
    totalSeconds,
    longestSeconds: gaps.length ? Math.max(...gaps) : 0,
    medianSeconds: median(gaps),
    share: pace ? totalSeconds / pace.speechSeconds : 0,
  };
}

export interface EdgeSilence {
  leadingSeconds: number;
  trailingSeconds: number;
}

/** Silence at the very start and very end of a clip, from detected silent stretches. */
export function edgeSilence(
  measurement: Pick<ClipMeasurement, "silences" | "durationSeconds">,
): EdgeSilence {
  const tolerance = 0.02;
  const silences = mergeSilences(measurement.silences);
  const first = silences[0];
  const last = silences.at(-1);
  return {
    leadingSeconds: first && first.startSeconds <= tolerance ? first.endSeconds : 0,
    trailingSeconds:
      last && last.endSeconds >= measurement.durationSeconds - tolerance
        ? measurement.durationSeconds - last.startSeconds
        : 0,
  };
}

/** Joins silent stretches that the detector split at a click or a single loud sample. */
export function mergeSilences(
  silences: readonly { startSeconds: number; endSeconds: number }[],
  maxGapSeconds = 0.03,
): { startSeconds: number; endSeconds: number }[] {
  const merged: { startSeconds: number; endSeconds: number }[] = [];
  for (const silence of [...silences].sort((a, b) => a.startSeconds - b.startSeconds)) {
    const last = merged.at(-1);
    if (last && silence.startSeconds - last.endSeconds <= maxGapSeconds) {
      last.endSeconds = Math.max(last.endSeconds, silence.endSeconds);
    } else {
      merged.push({ ...silence });
    }
  }
  return merged;
}

/**
 * The pauses in the audio itself. Character timings from the speech API place word edges
 * inside a pause, so gaps between words understate it; silence in the waveform does not.
 */
export function summariseAcousticPauses(
  measurement: Pick<ClipMeasurement, "silences" | "durationSeconds">,
): Omit<PauseSummary, "share"> & { share: number } {
  const pauses = internalSilences(measurement).map((s) => s.endSeconds - s.startSeconds);
  const edges = edgeSilence(measurement);
  const speech = measurement.durationSeconds - edges.leadingSeconds - edges.trailingSeconds;
  const totalSeconds = pauses.reduce((a, b) => a + b, 0);
  return {
    count: pauses.length,
    totalSeconds,
    longestSeconds: pauses.length ? Math.max(...pauses) : 0,
    medianSeconds: median(pauses),
    share: speech > 0 ? totalSeconds / speech : 0,
  };
}

/** The longest silence between the middle of one word and the middle of the next. */
export function silenceBetween(
  measurement: Pick<ClipMeasurement, "silences">,
  before: WordTiming,
  after: WordTiming,
): number {
  const from = (before.startSeconds + before.endSeconds) / 2;
  const to = (after.startSeconds + after.endSeconds) / 2;
  let longest = 0;
  for (const silence of mergeSilences(measurement.silences)) {
    const overlap = Math.min(silence.endSeconds, to) - Math.max(silence.startSeconds, from);
    if (overlap > 0) longest = Math.max(longest, silence.endSeconds - silence.startSeconds);
  }
  return longest;
}

/** Sound this long before the first word is worth a listen: a breath, a noise, a stray syllable. */
export const STRAY_SOUND_SECONDS = 0.3;

/**
 * Seconds of non-silent audio before the first word begins. Speech models sometimes voice
 * a breath or a sound where a delivery tag stood; software can see that something is
 * there, only a listener can say what.
 */
export function soundBeforeSpeech(
  measurement: Pick<ClipMeasurement, "silences">,
  words: readonly WordTiming[],
): number {
  const first = words[0];
  if (!first) return 0;
  const silent = mergeSilences(measurement.silences).reduce((total, silence) => {
    const overlap =
      Math.min(silence.endSeconds, first.startSeconds) - Math.max(silence.startSeconds, 0);
    return total + Math.max(0, overlap);
  }, 0);
  return Math.max(0, first.startSeconds - silent);
}

/** Silent stretches strictly inside the clip: the pauses a listener hears. */
export function internalSilences(
  measurement: Pick<ClipMeasurement, "silences" | "durationSeconds">,
  minSeconds = PAUSE_FLOOR_SECONDS,
): { startSeconds: number; endSeconds: number }[] {
  const tolerance = 0.02;
  return mergeSilences(measurement.silences).filter(
    (silence) =>
      silence.startSeconds > tolerance &&
      silence.endSeconds < measurement.durationSeconds - tolerance &&
      silence.endSeconds - silence.startSeconds >= minSeconds,
  );
}

export interface ClipFindings {
  clipped: boolean;
  /** An edge is loud enough that a join could click. */
  startMayClick: boolean;
  endMayClick: boolean;
}

export function clipFindings(measurement: ClipMeasurement): ClipFindings {
  return {
    clipped:
      (measurement.samplePeakDb !== null && measurement.samplePeakDb >= CLIPPING_DB) ||
      (measurement.truePeakDbtp !== null && measurement.truePeakDbtp > 0),
    startMayClick: measurement.startEdgeDb !== null && measurement.startEdgeDb > SILENT_EDGE_DB,
    endMayClick: measurement.endEdgeDb !== null && measurement.endEdgeDb > SILENT_EDGE_DB,
  };
}

export const FinishingSchema = z
  .object({
    /** Bring every clip to the same loudness with one fixed gain before the final mix. */
    level: z.boolean().default(true),
    /** Per-clip target. The programme target (-14 LUFS) is applied later, at the mix. */
    targetLufs: z.number().min(-40).max(-10).default(-23),
    /** Clips already this close to the target are left untouched. */
    toleranceLu: z.number().min(0).max(6).default(1),
    /** Gentle 2:1 compression. Off unless a person hears a reason for it. */
    compression: z.boolean().default(false),
    /** `auto` fades an edge only when it measured loud enough to click. */
    edgeFade: z.enum(["auto", "never"]).default("auto"),
  })
  .prefault({});
export type Finishing = z.infer<typeof FinishingSchema>;

/** Headroom kept below full scale after levelling, in dB true peak. */
const LEVEL_CEILING_DBTP = -2;
/** Edge fade length. Long enough to remove a step, too short to soften a consonant. */
export const EDGE_FADE_SECONDS = 0.008;

export interface FinishingPlan {
  gainDb: number;
  compression: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  /** False when the clip needs nothing: it is then used exactly as generated. */
  needed: boolean;
}

/**
 * The single fixed gain that brings a clip to the target, limited so its peak stays below
 * the ceiling. A fixed gain cannot pump, which is why it is used instead of a limiter.
 */
export function levelGainDb(
  measurement: Pick<ClipMeasurement, "integratedLufs" | "truePeakDbtp">,
  finishing: Finishing,
): number {
  if (!finishing.level || measurement.integratedLufs === null) return 0;
  const wanted = finishing.targetLufs - measurement.integratedLufs;
  if (Math.abs(wanted) <= finishing.toleranceLu) return 0;
  const headroom =
    measurement.truePeakDbtp === null ? wanted : LEVEL_CEILING_DBTP - measurement.truePeakDbtp;
  return Math.round(Math.min(wanted, headroom) * 100) / 100;
}

export function planFinishing(measurement: ClipMeasurement, finishing: Finishing): FinishingPlan {
  const findings = clipFindings(measurement);
  const fade = finishing.edgeFade === "auto" ? EDGE_FADE_SECONDS : 0;
  const plan = {
    gainDb: levelGainDb(measurement, finishing),
    compression: finishing.compression,
    fadeInSeconds: findings.startMayClick ? fade : 0,
    fadeOutSeconds: findings.endMayClick ? fade : 0,
  };
  return {
    ...plan,
    needed:
      plan.gainDb !== 0 || plan.compression || plan.fadeInSeconds > 0 || plan.fadeOutSeconds > 0,
  };
}

export interface LoudnessSpread {
  minLufs: number;
  maxLufs: number;
  spreadLu: number;
  /** Clips further than the tolerance from the median. */
  outliers: string[];
}

/** How consistent a set of clips is in loudness, which matters before they are joined. */
export function loudnessSpread(
  clips: readonly { id: string; integratedLufs: number | null }[],
  toleranceLu: number,
): LoudnessSpread | null {
  const measured = clips.flatMap((clip) =>
    clip.integratedLufs === null ? [] : [{ id: clip.id, lufs: clip.integratedLufs }],
  );
  if (measured.length === 0) return null;
  const values = measured.map((clip) => clip.lufs);
  const centre = median(values);
  return {
    minLufs: Math.min(...values),
    maxLufs: Math.max(...values),
    spreadLu: Math.max(...values) - Math.min(...values),
    outliers: measured
      .filter((clip) => Math.abs(clip.lufs - centre) > toleranceLu)
      .map((clip) => clip.id),
  };
}

/** Time at which the nth sentence ends, read from word timings; null if there are fewer. */
export function sentenceEndSeconds(words: readonly WordTiming[], sentences: number): number | null {
  let seen = 0;
  for (const word of words) {
    if (/[.!?]["')\]]?$/.test(word.text)) {
      seen += 1;
      if (seen === sentences) return word.endSeconds;
    }
  }
  return null;
}
