import type { CharacterAlignment, WordTiming } from "./captions";
import {
  isInlinePause,
  normaliseSpoken,
  phraseEnds,
  wordStarts,
  type Delivery,
  type PauseKind,
  type SceneDirection,
} from "./voice-direction";
import { silenceBetween, type ClipMeasurement } from "./voice-audio";
import type { ModelCapabilities } from "./voice-models";
import type { InlinePauseKind, TagPauseStyle, VoicePreset } from "./voice-presets";

/**
 * The pause and delivery engine. It turns one scene's spoken words plus its direction into
 * the exact text sent to a speech model, using only markup that model is known to support,
 * and it remembers which characters it added so they can be taken out of the timings again.
 * Everything here is a pure function of its arguments.
 */

/** How each delivery is described to a model that reads delivery tags. */
const DELIVERY_PHRASE: Record<Delivery, string> = {
  neutral: "",
  curious: "curious",
  thoughtful: "thoughtful",
  confident: "confident",
  revealing: "slower, deliberate",
  calm: "calm",
};

const PAUSE_TAG: Record<Exclude<TagPauseStyle, "none" | "paragraph">, string> = {
  "short-pause": "[short pause]",
  pause: "[pause]",
  "long-pause": "[long pause]",
};

export type PauseRendering = "punctuation" | "paragraph" | "tag" | "ssml-break";

export interface RenderedPause {
  kind: InlinePauseKind;
  after: string;
  /** Offset in the plain spoken text where the pause falls. */
  offset: number;
  /** Length the director asked for. Only an SSML break can actually enforce it. */
  targetSeconds: number;
  rendering: PauseRendering;
  markup: string;
}

export interface RenderedPerformance {
  /** The plain spoken words: what captions show and what the reviewer approved. */
  plain: string;
  /** The text sent to the speech model. Equal to `plain` when nothing could be added. */
  text: string;
  /** For each character of `text`: its index in `plain`, or -1 for markup the engine added. */
  origin: number[];
  leadingTag: string | null;
  pauses: RenderedPause[];
  emphasised: string[];
  /** Direction that could not be expressed for this model, and why. Shown in reports. */
  notes: string[];
  /** Extra silence the director asked for around the scene, for the composition to add. */
  composition: { leadInSeconds: number; tailSeconds: number };
}

export interface PerformanceInput {
  spoken: string;
  /** null: a scene with no direction is spoken plainly in the preset's style. */
  direction: SceneDirection | null;
  preset: VoicePreset;
  capabilities: ModelCapabilities;
  pauseSeconds: Record<PauseKind, number>;
}

interface Insertion {
  offset: number;
  text: string;
}

const PRIORITY: Record<InlinePauseKind, number> = { REVEAL: 3, MEDIUM: 2, SHORT: 1, NATURAL: 0 };

function leadingTag(input: PerformanceInput): string | null {
  if (!input.capabilities.audioTags) return null;
  const delivery = DELIVERY_PHRASE[input.direction?.delivery ?? "neutral"];
  return `[${[input.preset.narrationStyle, delivery].filter(Boolean).join(", ")}]`;
}

/** Composition pauses become scene lead-in and tail; they are never written into the text. */
function compositionSilence(
  direction: SceneDirection | null,
  pauseSeconds: Record<PauseKind, number>,
): RenderedPerformance["composition"] {
  let leadInSeconds = 0;
  let tailSeconds = 0;
  for (const pause of direction?.pauses ?? []) {
    if (isInlinePause(pause.kind)) continue;
    if (pause.at === "start") leadInSeconds = Math.max(leadInSeconds, pauseSeconds[pause.kind]);
    if (pause.at === "end") tailSeconds = Math.max(tailSeconds, pauseSeconds[pause.kind]);
  }
  return { leadInSeconds, tailSeconds };
}

function breakMarkup(seconds: number): string {
  // Hundredths, without trailing zeros: 0.45 must not be rounded to 0.4 by float error.
  return ` <break time="${Number(seconds.toFixed(2))}s" />`;
}

interface PauseBudget {
  tags: number;
  breaks: number;
}

/**
 * Chooses how one pause is written. The order of preference is fixed: an SSML break where
 * the model documents it, a pause tag where the model reads tags and the preset wants one,
 * then text structure, and finally nothing but the punctuation already there.
 */
function renderPause(
  kind: InlinePauseKind,
  input: PerformanceInput,
  budget: PauseBudget,
  notes: string[],
): { rendering: PauseRendering; markup: string } {
  const caps = input.capabilities;
  const structure = kind === "MEDIUM" || kind === "REVEAL";
  if (kind === "NATURAL") return { rendering: "punctuation", markup: "" };

  if (caps.ssmlBreak) {
    if (budget.breaks > 0) {
      budget.breaks -= 1;
      const wanted = input.pauseSeconds[kind] * input.preset.pauseScale;
      // The break is added to the pause the punctuation already gives.
      const extra = Math.max(0.1, wanted - input.pauseSeconds.NATURAL);
      return {
        rendering: "ssml-break",
        markup: breakMarkup(Math.min(extra, caps.maxBreakSeconds)),
      };
    }
    notes.push(`A ${kind} pause was written as a paragraph break: break limit reached.`);
    return { rendering: "paragraph", markup: "\n\n" };
  }

  if (caps.audioTags) {
    const style = input.preset.tagPauses[kind];
    if (style === "none") return { rendering: "punctuation", markup: "" };
    if (style === "paragraph") return { rendering: "paragraph", markup: "\n\n" };
    if (budget.tags > 0) {
      budget.tags -= 1;
      return { rendering: "tag", markup: ` ${PAUSE_TAG[style]}` };
    }
    notes.push(`A ${kind} pause was written as a paragraph break: tag limit for this scene.`);
    return { rendering: "paragraph", markup: "\n\n" };
  }

  // No documented pause markup: only text structure is safe.
  return structure
    ? { rendering: "paragraph", markup: "\n\n" }
    : { rendering: "punctuation", markup: "" };
}

function renderPauses(plain: string, input: PerformanceInput, notes: string[]): RenderedPause[] {
  const words = plain.split(" ").length;
  const budget: PauseBudget = {
    // Rounded up, so a short scene with one real reveal can still mark it.
    tags: Math.ceil((words * input.preset.maxInlineTagsPer100Words) / 100),
    breaks: input.capabilities.maxBreaksPerRequest,
  };
  const located = (input.direction?.pauses ?? []).flatMap((pause) => {
    if (!isInlinePause(pause.kind) || pause.after === undefined) return [];
    const [offset] = phraseEnds(plain, pause.after);
    // Validation rejects missing and ambiguous points; an unresolved one is simply skipped.
    return offset === undefined || offset >= plain.length
      ? []
      : [{ kind: pause.kind, after: pause.after, offset }];
  });
  // The strongest pauses get first call on a limited budget; output is in reading order.
  const byStrength = [...located].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]);
  const rendered = new Map<number, RenderedPause>();
  for (const pause of byStrength) {
    if (rendered.has(pause.offset)) continue;
    rendered.set(pause.offset, {
      ...pause,
      targetSeconds: input.pauseSeconds[pause.kind] * input.preset.pauseScale,
      ...renderPause(pause.kind, input, budget, notes),
    });
  }
  return [...rendered.values()].sort((a, b) => a.offset - b.offset);
}

/** Emphasised words as [start, end) ranges, limited by the preset. */
function emphasisRanges(
  plain: string,
  input: PerformanceInput,
  notes: string[],
): { ranges: [number, number][]; words: string[] } {
  const wanted = input.direction?.emphasis ?? [];
  if (wanted.length === 0) return { ranges: [], words: [] };
  if (!input.capabilities.emphasisByCapitals) {
    notes.push(
      "Emphasis is recorded but not marked up: this model documents no way to stress a word.",
    );
    return { ranges: [], words: [] };
  }
  const allowed = wanted.slice(0, input.preset.maxEmphasisPerScene);
  if (allowed.length < wanted.length) {
    notes.push(
      `${wanted.length - allowed.length} emphasis mark(s) left out: the preset allows ${input.preset.maxEmphasisPerScene} per scene.`,
    );
  }
  const ranges: [number, number][] = [];
  const words: string[] = [];
  for (const word of allowed) {
    const [start] = wordStarts(plain, word);
    const text = normaliseSpoken(word);
    // A capitalised short word can be read out as initials, so those are left alone.
    if (start === undefined || text.length < 4 || text.toUpperCase().length !== text.length) {
      notes.push(`"${word}" was not capitalised: too short to mark safely.`);
      continue;
    }
    ranges.push([start, start + text.length]);
    words.push(text);
  }
  return { ranges, words };
}

function assemble(
  plain: string,
  insertions: readonly Insertion[],
  upper: readonly [number, number][],
): { text: string; origin: number[] } {
  const at = new Map<number, string>();
  for (const insertion of insertions) {
    at.set(insertion.offset, (at.get(insertion.offset) ?? "") + insertion.text);
  }
  let text = "";
  const origin: number[] = [];
  const add = (markup: string | undefined): void => {
    if (!markup) return;
    text += markup;
    for (let i = 0; i < markup.length; i++) origin.push(-1);
  };
  for (let index = 0; index < plain.length; index++) {
    add(at.get(index));
    const character = plain[index] ?? "";
    const shout = upper.some(([start, end]) => index >= start && index < end);
    text += shout ? character.toUpperCase() : character;
    origin.push(index);
  }
  add(at.get(plain.length));
  return { text, origin };
}

export function renderPerformance(input: PerformanceInput): RenderedPerformance {
  const plain = normaliseSpoken(input.spoken);
  const notes: string[] = [];
  const tag = leadingTag(input);
  const pauses = renderPauses(plain, input, notes);
  const emphasis = emphasisRanges(plain, input, notes);
  const delivery = input.direction?.delivery ?? "neutral";
  if (tag === null && delivery !== "neutral") {
    notes.push(
      `Delivery "${delivery}" is recorded but not sent: this model reads no delivery tags.`,
    );
  }
  const insertions: Insertion[] = [
    ...(tag === null ? [] : [{ offset: 0, text: `${tag} ` }]),
    ...pauses.filter((pause) => pause.markup).map((p) => ({ offset: p.offset, text: p.markup })),
  ];
  const { text, origin } = assemble(plain, insertions, emphasis.ranges);
  return {
    plain,
    text,
    origin,
    leadingTag: tag,
    pauses,
    emphasised: emphasis.words,
    notes,
    composition: compositionSilence(input.direction, input.pauseSeconds),
  };
}

const MARKUP_IN_TEXT = /\[[^\]\n]*\]|<break\b[^>]*>/g;

/**
 * Character timings for the plain spoken words only. Captions and the visual beats are
 * matched against stored words, so a delivery tag must never become one.
 *
 * When the provider echoes the request text back (it did in every observed response), the
 * engine's own record of what it inserted is used and capitalised words get their original
 * spelling back. Otherwise markup is recognised by pattern, which is less exact but still
 * keeps tags out of the words.
 */
export function plainAlignment(
  alignment: CharacterAlignment,
  rendered: Pick<RenderedPerformance, "text" | "origin" | "plain">,
): CharacterAlignment {
  const echoed = alignment.characters.join("") === rendered.text;
  const keep: boolean[] = [];
  const characters: string[] = [];
  if (echoed && alignment.characters.every((character) => character.length === 1)) {
    alignment.characters.forEach((_, index) => {
      const source = rendered.origin[index] ?? -1;
      keep.push(source >= 0);
      if (source >= 0) characters.push(rendered.plain[source] ?? "");
    });
  } else {
    const joined = alignment.characters.join("");
    const markup = new Array<boolean>(joined.length).fill(false);
    for (const match of joined.matchAll(MARKUP_IN_TEXT)) {
      markup.fill(true, match.index, match.index + match[0].length);
    }
    let cursor = 0;
    for (const character of alignment.characters) {
      const isMarkup = character.length > 0 && markup[cursor] === true;
      keep.push(!isMarkup);
      if (!isMarkup) characters.push(character);
      cursor += character.length;
    }
  }
  const pick = (values: readonly number[]): number[] => values.filter((_, index) => keep[index]);
  return {
    characters,
    startSeconds: pick(alignment.startSeconds),
    endSeconds: pick(alignment.endSeconds),
  };
}

export interface MeasuredPause extends RenderedPause {
  /** Gap between the word before the pause and the word after it; null if unmeasurable. */
  measuredSeconds: number | null;
  /** Silence in the audio at that point; null when no waveform measurement was given. */
  audioSeconds: number | null;
}

/**
 * How long each directed pause actually came out. On models without timed breaks this is
 * the only way to know whether a pause was honoured. Two readings are given because they
 * disagree: the provider's word timings put word edges inside a pause and so understate
 * it, while silence detected in the audio shows what a listener gets.
 */
export function measurePauses(
  rendered: Pick<RenderedPerformance, "plain" | "pauses">,
  words: readonly WordTiming[],
  measurement?: Pick<ClipMeasurement, "silences">,
): MeasuredPause[] {
  return rendered.pauses.map((pause) => {
    const index = rendered.plain.slice(0, pause.offset).split(" ").filter(Boolean).length - 1;
    const before = words[index];
    const after = words[index + 1];
    const measuredSeconds =
      before && after ? Math.max(0, after.startSeconds - before.endSeconds) : null;
    const audioSeconds =
      before && after && measurement ? silenceBetween(measurement, before, after) : null;
    return { ...pause, measuredSeconds, audioSeconds };
  });
}
