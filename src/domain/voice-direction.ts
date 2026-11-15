import { z } from "zod";
import { hashOf } from "./hash";
import { INLINE_PAUSE_KINDS, type InlinePauseKind } from "./voice-presets";

/**
 * Voice direction: how each scene is to be spoken. The creative analysis is written by a
 * director (a person, or Claude drafting for a person) into `voice-direction.json`. The
 * engine only validates it and turns it into text for the speech model, deterministically.
 */

export const DELIVERIES = [
  "neutral",
  "curious",
  "thoughtful",
  "confident",
  "revealing",
  "calm",
] as const;
export const DeliverySchema = z.enum(DELIVERIES);
export type Delivery = z.infer<typeof DeliverySchema>;

export const PAUSE_KINDS = [...INLINE_PAUSE_KINDS, "TRANSITION", "VISUAL_WAIT"] as const;
export const PauseKindSchema = z.enum(PAUSE_KINDS);
export type PauseKind = z.infer<typeof PauseKindSchema>;

/** Kinds that become silence around a scene at composition, never inside a phrase. */
export const COMPOSITION_PAUSE_KINDS: readonly PauseKind[] = ["TRANSITION", "VISUAL_WAIT"];

export function isInlinePause(kind: PauseKind): kind is InlinePauseKind {
  return (INLINE_PAUSE_KINDS as readonly string[]).includes(kind);
}

export const DEFAULT_PAUSE_SECONDS: Record<PauseKind, number> = {
  NATURAL: 0.25,
  SHORT: 0.4,
  MEDIUM: 0.7,
  REVEAL: 1.1,
  TRANSITION: 0.8,
  VISUAL_WAIT: 1.6,
};

const PauseSecondsSchema = z
  .object({
    NATURAL: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.NATURAL),
    SHORT: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.SHORT),
    MEDIUM: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.MEDIUM),
    REVEAL: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.REVEAL),
    TRANSITION: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.TRANSITION),
    VISUAL_WAIT: z.number().min(0).max(5).default(DEFAULT_PAUSE_SECONDS.VISUAL_WAIT),
  })
  .prefault({});

export const PausePointSchema = z.object({
  kind: PauseKindSchema,
  /** Inline pauses: the words the pause follows, exactly as they appear in `spoken`. */
  after: z.string().min(1).optional(),
  /** Composition pauses: the edge of the scene where the silence goes. */
  at: z.enum(["start", "end"]).optional(),
  why: z.string().default(""),
});
export type PausePoint = z.infer<typeof PausePointSchema>;

export const SceneDirectionSchema = z.object({
  /** The words to be spoken. `script.md` stays the source of record and is never edited. */
  spoken: z.string().min(1),
  intent: z.string().default(""),
  delivery: DeliverySchema.default("neutral"),
  /** Words from `spoken` that carry the point of the scene. */
  emphasis: z.array(z.string().min(1)).default([]),
  pauses: z.array(PausePointSchema).default([]),
});
export type SceneDirection = z.infer<typeof SceneDirectionSchema>;

export const VoiceDirectionSchema = z.object({
  schemaVersion: z.literal(1),
  videoId: z.string().min(1),
  /** Who wrote the direction. Informational; the approval records who accepted it. */
  author: z.string().default(""),
  pauseSeconds: PauseSecondsSchema,
  /** Keyed by scene id. A scene without an entry is spoken as written in the script. */
  scenes: z.record(z.string(), SceneDirectionSchema),
});
export type VoiceDirection = z.infer<typeof VoiceDirectionSchema>;

/**
 * Identity of what a reviewer approves: every spoken word and every direction. The author
 * line is left out so that correcting a name does not void an approval.
 */
export function voiceDirectionHash(direction: VoiceDirection): string {
  return hashOf({ pauseSeconds: direction.pauseSeconds, scenes: direction.scenes });
}

/** Collapses whitespace so offsets computed on the text are stable. */
export function normaliseSpoken(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface DirectionIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
  sceneId?: string;
}

/** Offsets where `phrase` ends in `text`, counting only matches that end a word group. */
export function phraseEnds(text: string, phrase: string): number[] {
  const needle = normaliseSpoken(phrase);
  const ends: number[] = [];
  if (!needle) return ends;
  for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + 1)) {
    const end = index + needle.length;
    const before = index === 0 ? " " : (text[index - 1] ?? " ");
    const after = end === text.length ? " " : (text[end] ?? " ");
    // A pause sits between words, so the phrase must start a word and end before a space.
    if (!LETTER.test(before) && /\s/.test(after)) ends.push(end);
  }
  return ends;
}

const LETTER = /[\p{L}\p{N}]/u;

/** Start offsets of a whole word (or run of words) in the text, ignoring case. */
export function wordStarts(text: string, word: string): number[] {
  const needle = normaliseSpoken(word).toLowerCase();
  const haystack = text.toLowerCase();
  const starts: number[] = [];
  if (!needle) return starts;
  for (
    let index = haystack.indexOf(needle);
    index !== -1;
    index = haystack.indexOf(needle, index + 1)
  ) {
    const before = index === 0 ? " " : (text[index - 1] ?? " ");
    const after = text[index + needle.length] ?? " ";
    if (!LETTER.test(before) && !LETTER.test(after)) starts.push(index);
  }
  return starts;
}

const MARKUP = /[[\]<>{}]/;
const MAX_EMPHASIS_PER_SCENE = 3;

function validateScene(sceneId: string, scene: SceneDirection): DirectionIssue[] {
  const issues: DirectionIssue[] = [];
  const push = (severity: DirectionIssue["severity"], rule: string, message: string): void => {
    issues.push({ severity, rule, message, sceneId });
  };
  const spoken = normaliseSpoken(scene.spoken);
  if (MARKUP.test(spoken)) {
    push(
      "error",
      "markup-in-spoken",
      "Spoken text contains bracket or angle markup. Write plain words; delivery and pauses go in their own fields.",
    );
  }
  for (const word of scene.emphasis) {
    if (wordStarts(spoken, word).length === 0) {
      push("error", "emphasis-not-found", `Emphasis "${word}" does not appear in the spoken text.`);
    }
  }
  if (scene.emphasis.length > MAX_EMPHASIS_PER_SCENE) {
    push(
      "warning",
      "too-much-emphasis",
      `${scene.emphasis.length} emphasised words. When everything is stressed, nothing is.`,
    );
  }
  for (const pause of scene.pauses) {
    if (isInlinePause(pause.kind)) {
      if (pause.after === undefined) {
        push("error", "pause-needs-after", `${pause.kind} needs "after": the words it follows.`);
        continue;
      }
      const ends = phraseEnds(spoken, pause.after);
      if (ends.length === 0) {
        push("error", "pause-not-found", `Pause point "${pause.after}" is not in the spoken text.`);
      } else if (ends.length > 1) {
        push(
          "error",
          "pause-ambiguous",
          `Pause point "${pause.after}" appears ${ends.length} times. Use a longer phrase.`,
        );
      } else if (ends[0] === spoken.length) {
        push(
          "error",
          "pause-at-end",
          `"${pause.after}" ends the scene. Use { "at": "end", "kind": "TRANSITION" } for silence after a scene.`,
        );
      }
    } else if (pause.at === undefined || pause.after !== undefined) {
      push(
        "error",
        "pause-needs-edge",
        `${pause.kind} is silence around the scene. Give "at": "start" or "end", not "after".`,
      );
    }
  }
  return issues;
}

/**
 * Checks a direction file against the script's scenes. Errors block approval and
 * narration; warnings are shown to the reviewer.
 */
export function validateDirection(
  direction: VoiceDirection,
  scriptSceneIds: readonly string[],
): DirectionIssue[] {
  const issues: DirectionIssue[] = [];
  const known = new Set(scriptSceneIds);
  for (const [sceneId, scene] of Object.entries(direction.scenes)) {
    if (!known.has(sceneId)) {
      issues.push({
        severity: "error",
        rule: "unknown-scene",
        message: `"${sceneId}" is not a scene in script.md.`,
        sceneId,
      });
      continue;
    }
    issues.push(...validateScene(sceneId, scene));
  }
  for (const sceneId of scriptSceneIds) {
    if (!direction.scenes[sceneId]) {
      issues.push({
        severity: "warning",
        rule: "undirected-scene",
        message: "No direction: the scene is spoken exactly as written in the script.",
        sceneId,
      });
    }
  }
  return issues;
}

// --- Scaffolding ---------------------------------------------------------------------

export function splitSentences(text: string): string[] {
  return normaliseSpoken(text)
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .filter(Boolean);
}

/** Contractions that are safe whatever follows, because the verb is an auxiliary here. */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\b(It|it|That|that|There|there|What|what|Here|here) is (?=[\p{L}])/gu, "$1's "],
  [/\b(do|does|did|is|are|was|were|would|could|should|has|have) not\b/g, "$1n't"],
  [/\b(Do|Does|Did|Is|Are|Was|Were|Would|Could|Should|Has|Have) not\b/g, "$1n't"],
  [/\bwill not\b/g, "won't"],
  [/\bWill not\b/g, "Won't"],
  [/\bcannot\b/g, "can't"],
  [/\bCannot\b/g, "Can't"],
  [/\b(You|you|We|we|They|they) are (?=[\p{L}])/gu, "$1're "],
];

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Whole numbers below one thousand as words; anything else is left for a person. */
export function numberToWords(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 999) return null;
  if (value < 20) return ONES[value] ?? null;
  if (value < 100) {
    const ones = value % 10;
    return `${TENS[Math.floor(value / 10)] ?? ""}${ones ? `-${ONES[ones] ?? ""}` : ""}`;
  }
  const rest = value % 100;
  const hundreds = `${ONES[Math.floor(value / 100)] ?? ""} hundred`;
  return rest ? `${hundreds} and ${numberToWords(rest) ?? ""}` : hundreds;
}

/**
 * A first pass at wording for the ear: contractions, small numbers as words, symbols as
 * words. It never adds or removes a statement. A director is expected to rewrite it; the
 * point is that they start from something that already reads aloud.
 */
export function draftSpoken(narration: string): string {
  let text = normaliseSpoken(narration);
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  text = text
    .replace(/\be\.g\.,?/g, "for example,")
    .replace(/\bi\.e\.,?/g, "that is,")
    .replace(/\s&\s/g, " and ")
    .replace(/(\d+)\s?%/g, "$1 percent")
    .replace(/(?<![\d.,/-])\b(\d{1,3})\b(?![\d.,/-]*\d)/g, (match, digits: string) => {
      return numberToWords(Number(digits)) ?? match;
    });
  return text;
}

/** The shortest run of words ending a sentence that appears only once in the text. */
export function uniqueTail(text: string, sentence: string): string | null {
  const words = sentence.split(" ");
  for (let count = Math.min(2, words.length); count <= words.length; count++) {
    const tail = words.slice(-count).join(" ");
    if (phraseEnds(text, tail).length === 1) return tail;
  }
  return null;
}

const DELIVERY_BY_SCENE_TYPE: Record<string, Delivery> = {
  PROBLEM: "thoughtful",
  DEMO: "confident",
  OUTCOME: "confident",
  CTA: "calm",
};
const MAX_SCAFFOLD_PAUSES = 3;
const PAUSE_PRIORITY: Record<string, number> = { REVEAL: 3, MEDIUM: 2, SHORT: 1, NATURAL: 0 };

function scaffoldPauses(spoken: string): PausePoint[] {
  const sentences = splitSentences(spoken);
  const candidates: PausePoint[] = [];
  sentences.forEach((sentence, index) => {
    const next = sentences[index + 1];
    if (next === undefined) return;
    const after = uniqueTail(spoken, sentence);
    if (after === null) return;
    if (/, not\b/.test(sentence)) {
      candidates.push({ kind: "REVEAL", after, why: "A contrast: let it land." });
    } else if (sentence.endsWith("?")) {
      candidates.push({
        kind: "MEDIUM",
        after,
        why: "A question: give the viewer time to answer.",
      });
    } else if (/^(But|So|Then|Now)\b/.test(next)) {
      candidates.push({
        kind: "SHORT",
        after,
        why: `The next sentence turns ("${next.split(" ")[0] ?? ""}").`,
      });
    } else if (sentence.split(" ").length <= 4 && index > 0) {
      candidates.push({ kind: "SHORT", after, why: "A short sentence used as a beat." });
    }
  });
  // Keep the strongest few, then restore reading order.
  const kept = [...candidates]
    .sort((a, b) => (PAUSE_PRIORITY[b.kind] ?? 0) - (PAUSE_PRIORITY[a.kind] ?? 0))
    .slice(0, MAX_SCAFFOLD_PAUSES);
  return candidates.filter((candidate) => kept.includes(candidate));
}

export interface ScaffoldScene {
  id: string;
  type: string;
  narration: string;
}

/**
 * Drafts direction for one cut's scenes from the script alone. The heuristics are simple
 * on purpose and each pause says why it is there, so a director can disagree quickly.
 */
export function scaffoldSceneDirection(
  scene: ScaffoldScene,
  next: ScaffoldScene | undefined,
): SceneDirection {
  const spoken = draftSpoken(scene.narration);
  const delivery: Delivery =
    DELIVERY_BY_SCENE_TYPE[scene.type] ?? (spoken.includes("?") ? "curious" : "neutral");
  const pauses = scaffoldPauses(spoken);
  if (scene.type === "DEMO") {
    pauses.push({
      kind: "VISUAL_WAIT",
      at: "start",
      why: "Product on screen: let the viewer find their place before the voice starts.",
    });
  }
  if (next !== undefined && next.type !== scene.type) {
    pauses.push({ kind: "TRANSITION", at: "end", why: `The film moves on to ${next.type}.` });
  }
  return {
    spoken,
    intent: "",
    delivery,
    emphasis: [],
    pauses,
  };
}

export function scaffoldDirection(
  videoId: string,
  cuts: readonly (readonly ScaffoldScene[])[],
  author: string,
): VoiceDirection {
  const scenes: Record<string, SceneDirection> = {};
  for (const cut of cuts) {
    cut.forEach((scene, index) => {
      if (scene.narration.trim()) scenes[scene.id] = scaffoldSceneDirection(scene, cut[index + 1]);
    });
  }
  return { schemaVersion: 1, videoId, author, pauseSeconds: { ...DEFAULT_PAUSE_SECONDS }, scenes };
}
