import { z } from "zod";
import type { ModelCapabilities } from "./voice-models";

/**
 * A preset is a named way of performing the same voice: settings plus delivery defaults.
 * Presets never change the voice identity (similarity is the same in all of them), so a
 * video can be auditioned in several and still sound like one narrator.
 */
export const PRESET_IDS = [
  "natural-educator",
  "cinematic-storyteller",
  "technical-expert",
  "product-walkthrough",
] as const;
export const PresetIdSchema = z.enum(PRESET_IDS);
export type PresetId = z.infer<typeof PresetIdSchema>;

/** Pauses written into the text. The other two kinds are silence added at composition. */
export const INLINE_PAUSE_KINDS = ["NATURAL", "SHORT", "MEDIUM", "REVEAL"] as const;
export type InlinePauseKind = (typeof INLINE_PAUSE_KINDS)[number];

/**
 * How an inline pause is written for a model that reads delivery tags. `none` leaves the
 * punctuation to do the work, `paragraph` starts a new paragraph, the rest are pause tags.
 */
export type TagPauseStyle = "none" | "paragraph" | "short-pause" | "pause" | "long-pause";

export interface VoicePreset {
  id: PresetId;
  label: string;
  summary: string;
  settings: { stability: number; similarityBoost: number; style: number; speed: number };
  /**
   * Narration style, sent once at the start of a clip on models that read delivery tags.
   * Kept to a few words: every character of a tag is billed, on every clip.
   */
  narrationStyle: string;
  /** Multiplies the configured pause lengths where the model accepts a length. */
  pauseScale: number;
  tagPauses: Record<InlinePauseKind, TagPauseStyle>;
  maxEmphasisPerScene: number;
  /** Ceiling for pause tags inside a clip. The leading style tag is not counted here. */
  maxInlineTagsPer100Words: number;
}

/** One value everywhere: the narrator must stay the same person across presets. */
const SIMILARITY = 0.75;

export const VOICE_PRESETS: Record<PresetId, VoicePreset> = {
  "natural-educator": {
    id: "natural-educator",
    label: "Natural Educator",
    summary:
      "A knowledgeable colleague explaining something they understand well. Warm, unhurried, lets a point land before the next one.",
    settings: { stability: 0.45, similarityBoost: SIMILARITY, style: 0.1, speed: 0.98 },
    narrationStyle: "warm, conversational",
    pauseScale: 1,
    tagPauses: { NATURAL: "none", SHORT: "none", MEDIUM: "paragraph", REVEAL: "pause" },
    maxEmphasisPerScene: 1,
    maxInlineTagsPer100Words: 2,
  },
  "cinematic-storyteller": {
    id: "cinematic-storyteller",
    label: "Cinematic Storyteller",
    summary:
      "A documentary narrator. Slower, more weight on reveals, wider expressive range. Best for scenario and stakes, heavy for step-by-step.",
    settings: { stability: 0.35, similarityBoost: SIMILARITY, style: 0.3, speed: 0.93 },
    narrationStyle: "quiet, measured narration",
    pauseScale: 1.25,
    tagPauses: { NATURAL: "none", SHORT: "none", MEDIUM: "pause", REVEAL: "long-pause" },
    maxEmphasisPerScene: 2,
    maxInlineTagsPer100Words: 4,
  },
  "technical-expert": {
    id: "technical-expert",
    label: "Technical Expert",
    summary:
      "An engineer or analyst who knows the detail. Even, precise and confident, with pauses carried by sentence structure only.",
    settings: { stability: 0.6, similarityBoost: SIMILARITY, style: 0, speed: 1 },
    narrationStyle: "clear, precise, even pace",
    pauseScale: 0.85,
    tagPauses: { NATURAL: "none", SHORT: "none", MEDIUM: "paragraph", REVEAL: "paragraph" },
    maxEmphasisPerScene: 0,
    maxInlineTagsPer100Words: 0,
  },
  "product-walkthrough": {
    id: "product-walkthrough",
    label: "Product Walkthrough",
    summary:
      "Someone guiding you through a screen. Friendly and practical, slightly brisker, leaves room for the viewer to look.",
    settings: { stability: 0.5, similarityBoost: SIMILARITY, style: 0.05, speed: 1.02 },
    narrationStyle: "friendly, practical",
    pauseScale: 0.9,
    tagPauses: { NATURAL: "none", SHORT: "none", MEDIUM: "paragraph", REVEAL: "short-pause" },
    maxEmphasisPerScene: 1,
    maxInlineTagsPer100Words: 2,
  },
};

export function presetById(id: PresetId): VoicePreset {
  return VOICE_PRESETS[id];
}

export interface EffectiveSettings {
  stability: number;
  similarityBoost: number;
  /** null: the model does not honour the setting, so it is neither sent nor claimed. */
  style: number | null;
  speed: number | null;
}

/**
 * The preset's settings as this model will actually use them. Reports show these, so a
 * preset never claims a slower pace on a model that has no speed control.
 */
export function effectiveSettings(preset: VoicePreset, caps: ModelCapabilities): EffectiveSettings {
  return {
    stability: preset.settings.stability,
    similarityBoost: preset.settings.similarityBoost,
    style: caps.settings.style ? preset.settings.style : null,
    speed: caps.settings.speed ? preset.settings.speed : null,
  };
}

/** What separates the presets on this model, in words a reviewer can read. */
export function presetLevers(preset: VoicePreset, caps: ModelCapabilities): string[] {
  const settings = effectiveSettings(preset, caps);
  const levers = [`stability ${settings.stability}`];
  if (settings.style !== null) levers.push(`style ${settings.style}`);
  if (settings.speed !== null) levers.push(`speed ${settings.speed}`);
  if (caps.audioTags) levers.push(`style direction "${preset.narrationStyle}"`);
  if (caps.audioTags || caps.ssmlBreak) levers.push(`pause scale ${preset.pauseScale}`);
  return levers;
}
