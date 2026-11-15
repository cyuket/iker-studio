import { z } from "zod";
import { hashOf } from "./hash";
import { FinishingSchema } from "./voice-audio";
import { capabilitiesFor } from "./voice-models";
import { PresetIdSchema } from "./voice-presets";

export const VOICE_PROVIDERS = ["elevenlabs", "system", "silent"] as const;
export const VoiceProviderSchema = z.enum(VOICE_PROVIDERS);
export type VoiceProvider = z.infer<typeof VoiceProviderSchema>;

export const VoiceSettingsSchema = z.object({
  /**
   * `elevenlabs` is the production voice. `system` (macOS `say`) and `silent` are offline
   * stand-ins for pipeline validation and are labelled as such in every report.
   */
  provider: VoiceProviderSchema,
  /** Provider voice identifier; null uses the environment default. */
  voiceId: z.string().nullable().default(null),
  modelId: z.string().nullable().default(null),
  stability: z.number().min(0).max(1).default(0.5),
  similarityBoost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0),
  /** ElevenLabs accepts 0.7-1.2. */
  speed: z.number().min(0.7).max(1.2).default(1),
  speakerBoost: z.boolean().default(true),
  /** ISO 639-1 code, for models that accept one. */
  languageCode: z.string().nullable().default(null),
  /** Fixed seed makes repeated synthesis of the same text as repeatable as the API allows. */
  seed: z.number().int().min(0).max(4_294_967_295).default(20_260_101),
  /**
   * How the voice is performed. null is the plain engine: script text, the settings above.
   * It is set by `pnpm studio voice select` once a person has listened to auditions, and
   * from then on the preset's settings replace stability, similarity, style and speed.
   */
  preset: PresetIdSchema.nullable().default(null),
  /** Per-clip finishing applied to performed narration before the final mix. */
  finishing: FinishingSchema,
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export const PronunciationEntrySchema = z.object({
  term: z.string().min(1),
  /**
   * `pending`: nobody has confirmed how this is said, so no rule is applied.
   * `approved`: a person listened to a preview and confirmed the rule.
   */
  status: z.enum(["pending", "approved"]),
  /** Respelling the voice reads instead of the term, e.g. "K Y C". */
  alias: z.string().nullable().default(null),
  /** IPA phoneme string, used only by models that support phoneme tags. */
  ipa: z.string().nullable().default(null),
  notes: z.string().default(""),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
});
export type PronunciationEntry = z.infer<typeof PronunciationEntrySchema>;

export const PronunciationFileSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(PronunciationEntrySchema),
});
export type PronunciationFile = z.infer<typeof PronunciationFileSchema>;

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
}

export function termsUsedIn(
  text: string,
  entries: readonly PronunciationEntry[],
): PronunciationEntry[] {
  return entries.filter((entry) => termPattern(entry.term).test(text));
}

/** Approved rules that change how this text is spoken. Pending entries never apply. */
export function activeRules(
  text: string,
  entries: readonly PronunciationEntry[],
): PronunciationEntry[] {
  return termsUsedIn(text, entries).filter(
    (entry) => entry.status === "approved" && (entry.alias !== null || entry.ipa !== null),
  );
}

/** Replaces approved terms with their aliases, for providers without dictionary support. */
export function applyAliases(text: string, entries: readonly PronunciationEntry[]): string {
  let spoken = text;
  for (const entry of activeRules(text, entries)) {
    if (entry.alias !== null) spoken = spoken.replace(termPattern(entry.term), entry.alias);
  }
  return spoken;
}

/** Everything beyond the plain text that shapes a performed clip. */
export interface NarrationPerformance {
  preset: string;
  /** The text actually sent to the provider, markup included. */
  renderedText: string;
  /** The settings actually sent, after the model's capabilities are applied. */
  effectiveSettings: Record<string, number | boolean | null>;
}

export interface NarrationRequest {
  /** The words spoken: script text, or the voice-optimised wording when there is one. */
  text: string;
  voice: VoiceSettings;
  /** Voice and model after environment defaults are applied. */
  resolvedVoiceId: string;
  resolvedModelId: string;
  rules: readonly PronunciationEntry[];
  /** Absent for plain narration, which keeps the key every existing clip was stored under. */
  performance?: NarrationPerformance;
}

/**
 * Identity of a narration clip. Two requests with the same key produce interchangeable
 * audio, so the second is served from cache. Only rules that touch this text are included,
 * which keeps a dictionary change from invalidating unrelated scenes.
 *
 * A performed clip adds its preset, the rendered text (spoken words plus direction) and the
 * settings really sent. Neighbouring text sent as context is deliberately left out: it
 * nudges prosody at the edges, and including it would make one edited scene re-bill its
 * neighbours. Nothing visual is part of the key, so a storyboard change never costs credits.
 */
export function narrationCacheKey(request: NarrationRequest): string {
  const { provider, stability, similarityBoost, style, speed, speakerBoost, languageCode, seed } =
    request.voice;
  const rules = request.rules
    .map((rule) => ({ term: rule.term, alias: rule.alias, ipa: rule.ipa }))
    .sort((a, b) => a.term.localeCompare(b.term));
  if (request.performance === undefined) {
    return hashOf({
      version: 1,
      text: request.text.trim(),
      provider,
      voiceId: request.resolvedVoiceId,
      modelId: request.resolvedModelId,
      settings: { stability, similarityBoost, style, speed, speakerBoost, languageCode, seed },
      rules,
    });
  }
  return hashOf({
    version: 2,
    text: request.text.trim(),
    provider,
    voiceId: request.resolvedVoiceId,
    modelId: request.resolvedModelId,
    preset: request.performance.preset,
    renderedText: request.performance.renderedText,
    settings: { ...request.performance.effectiveSettings, languageCode, seed },
    rules,
  });
}

/** Hash of everything about the voice that is not the text; shown by `status` and `costs`. */
export function voiceConfigurationHash(
  voice: VoiceSettings,
  voiceId: string,
  modelId: string,
): string {
  return hashOf({ ...voice, voiceId, modelId });
}

export interface CostEstimate {
  characters: number;
  credits: number;
  /** null unless the operator configured their plan's price per 1,000 credits. */
  usd: number | null;
}

export function estimateSynthesisCost(
  texts: readonly string[],
  provider: VoiceProvider,
  modelId: string,
  usdPerThousandCredits: number | null,
): CostEstimate {
  const characters = texts.reduce((total, text) => total + text.length, 0);
  if (provider !== "elevenlabs") return { characters, credits: 0, usd: 0 };
  // The rate comes from the capability table; an unknown model is costed at the full rate
  // so an estimate is never too low.
  const credits = Math.ceil(characters * capabilitiesFor(modelId).creditsPerCharacter);
  return {
    characters,
    credits,
    usd: usdPerThousandCredits === null ? null : (credits / 1000) * usdPerThousandCredits,
  };
}
