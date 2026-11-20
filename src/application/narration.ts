import path from "node:path";
import { z } from "zod";
import {
  estimateWordTimings,
  wordsFromAlignment,
  WordTimingSchema,
  type WordTiming,
} from "../domain/captions";
import { StudioError } from "../domain/errors";
import { hashOf, sha256 } from "../domain/hash";
import type { Manifest, NarrationAsset } from "../domain/manifest";
import { enabledScenes, type Storyboard } from "../domain/storyboard";
import {
  activeRules,
  estimateSynthesisCost,
  MAX_SPEED,
  MIN_SPEED,
  narrationCacheKey,
  termsUsedIn,
  VoiceProviderSchema,
  type CostEstimate,
  type PronunciationEntry,
  type VoiceProvider,
  type NarrationPerformance,
  type VoiceSettings,
} from "../domain/voice";
import { planFinishing, type ClipMeasurement } from "../domain/voice-audio";
import type { VoiceDirection } from "../domain/voice-direction";
import { DEFAULT_PAUSE_SECONDS } from "../domain/voice-direction";
import { capabilitiesFor } from "../domain/voice-models";
import {
  plainAlignment,
  renderPerformance,
  type RenderedPerformance,
} from "../domain/voice-performance";
import { effectiveSettings, presetById, type PresetId } from "../domain/voice-presets";
import { requireCurrentStoryboard } from "./authoring";
import { loadPronunciations, loadScript, type CoreDeps } from "./context";
import { runStage } from "./pipeline";
import type { AudioTools, MediaTools, SpeechSynthesizer } from "./ports";
import {
  checkVoiceDirection,
  loadVoiceDirection,
  requireAcceptedDirection,
} from "./voice-direction";

export interface NarrationDeps extends CoreDeps {
  media: MediaTools;
  /** Builds the synthesizer for a provider; throws if that provider is not configured. */
  synthesizer(provider: VoiceProvider): SpeechSynthesizer;
  /** Price per 1,000 credits for money estimates; null when not configured. */
  usdPerThousandCredits(): number | null;
  /**
   * Per-clip measurement and finishing. Optional so that pipelines without it still
   * narrate: performed clips are then used exactly as generated.
   */
  audio?: AudioTools;
}

/** One distinct narration clip. Scenes with identical text and voice share a clip. */
export interface NarrationItem {
  sceneId: string;
  /** The plain words spoken: what captions show. */
  text: string;
  /** The scene as written in script.md. Equal to `text` unless a spoken wording exists. */
  scriptText: string;
  /** The exact text sent to the provider, delivery markup included. */
  requestText: string;
  cacheKey: string;
  /** Characters sent, which is what the provider bills. */
  characters: number;
  rules: PronunciationEntry[];
  /** Present on performed clips: how markup maps back to the plain words. */
  rendered: RenderedPerformance | null;
  /** Neighbouring narration sent as context where the model accepts it. */
  previousText: string | null;
  nextText: string | null;
  /**
   * `current`: this video already has the clip. `cached`: the shared cache has it, so
   * restoring is free. `missing`: must be synthesised.
   */
  state: "current" | "cached" | "missing";
}

export interface NarrationPlan {
  provider: VoiceProvider;
  voiceId: string;
  modelId: string;
  /** null for plain narration: script text with the manifest's own settings. */
  preset: PresetId | null;
  /** The settings requests will carry: the preset's when one is selected. */
  voice: VoiceSettings;
  /** Hash of the voice direction in force, or null when the video has none. */
  directionHash: string | null;
  /**
   * True when a direction file exists but no performance has been selected yet, so it is
   * not applied and the existing clips stay valid.
   */
  directionWaiting: boolean;
  items: NarrationItem[];
  /** Cost of the items that still have to be synthesised. */
  cost: CostEstimate;
  pendingPronunciations: string[];
}

const CacheEntrySchema = z.object({
  extension: z.string(),
  durationSeconds: z.number().positive(),
  characters: z.number().int().min(0),
  provider: VoiceProviderSchema,
  timing: z.enum(["provider", "estimated"]),
  words: z.array(WordTimingSchema),
  createdAt: z.string(),
  /** Credits the provider reported, and its request id. Absent on older entries. */
  billedCredits: z.number().optional(),
  requestId: z.string().nullable().optional(),
});
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

export function cachePaths(deps: Pick<NarrationDeps, "layout">, key: string) {
  const base = path.join(deps.layout.narrationCacheDir, key);
  return { base, meta: `${base}.json` };
}

export async function readCacheEntry(
  deps: Pick<NarrationDeps, "layout" | "files">,
  key: string,
): Promise<CacheEntry | null> {
  const { base, meta } = cachePaths(deps, key);
  if (!(await deps.files.exists(meta))) return null;
  const parsed = CacheEntrySchema.safeParse(await deps.files.readJson(meta));
  if (!parsed.success || !(await deps.files.exists(`${base}.${parsed.data.extension}`)))
    return null;
  return parsed.data;
}

/** Scenes that need a narration clip: enabled, with text, in any of the given cuts. */
export function narratedScenes(
  storyboard: Storyboard,
  cutIds?: readonly string[],
): { id: string; narration: string }[] {
  const seen = new Map<string, string>();
  for (const cut of storyboard.cuts) {
    if (cutIds && !cutIds.includes(cut.id)) continue;
    for (const scene of enabledScenes(cut)) {
      if (scene.narration.trim()) seen.set(scene.id, scene.narration.trim());
    }
  }
  return [...seen].map(([id, narration]) => ({ id, narration }));
}

/** The scenes on either side of each scene, in the first cut that contains it. */
function neighbours(storyboard: Storyboard): Map<string, { previous?: string; next?: string }> {
  const found = new Map<string, { previous?: string; next?: string }>();
  for (const cut of storyboard.cuts) {
    const scenes = enabledScenes(cut).filter((scene) => scene.narration.trim());
    scenes.forEach((scene, index) => {
      if (found.has(scene.id)) return;
      const previous = scenes[index - 1]?.id;
      const next = scenes[index + 1]?.id;
      found.set(scene.id, {
        ...(previous === undefined ? {} : { previous }),
        ...(next === undefined ? {} : { next }),
      });
    });
  }
  return found;
}

export interface PerformedItemInput {
  sceneId: string;
  scriptText: string;
  voice: VoiceSettings;
  voiceId: string;
  modelId: string;
  preset: PresetId;
  direction: VoiceDirection | null;
  entries: readonly PronunciationEntry[];
  previousText: string | null;
  nextText: string | null;
  /** Speak only this much of the scene: used by auditions. */
  spokenOverride?: string;
}

/** The preset's settings laid over the manifest's, which is what a performed request carries. */
export function performedVoice(voice: VoiceSettings, preset: PresetId): VoiceSettings {
  return { ...voice, ...presetById(preset).settings, preset };
}

/**
 * Builds one performed clip: the spoken wording, its direction rendered for this model,
 * and the cache key that identifies the result. Shared by narration and auditions so a
 * sample a person approved is the same request the full narration will make.
 */
export function performedItem(input: PerformedItemInput): Omit<NarrationItem, "state"> {
  const capabilities = capabilitiesFor(input.modelId);
  const preset = presetById(input.preset);
  const directed = input.direction?.scenes[input.sceneId] ?? null;
  const rendered = renderPerformance({
    spoken: input.spokenOverride ?? directed?.spoken ?? input.scriptText,
    direction: directed,
    preset,
    capabilities,
    pauseSeconds: input.direction?.pauseSeconds ?? DEFAULT_PAUSE_SECONDS,
  });
  const rules = activeRules(rendered.plain, input.entries);
  const settings = effectiveSettings(preset, capabilities);
  const performance: NarrationPerformance = {
    preset: preset.id,
    renderedText: rendered.text,
    effectiveSettings: {
      ...settings,
      speakerBoost: capabilities.settings.speakerBoost ? input.voice.speakerBoost : null,
    },
  };
  return {
    sceneId: input.sceneId,
    text: rendered.plain,
    scriptText: input.scriptText,
    requestText: rendered.text,
    cacheKey: narrationCacheKey({
      text: rendered.plain,
      voice: input.voice,
      resolvedVoiceId: input.voiceId,
      resolvedModelId: input.modelId,
      rules,
      performance,
    }),
    characters: rendered.text.length,
    rules,
    rendered,
    previousText: capabilities.contextText ? input.previousText : null,
    nextText: capabilities.contextText ? input.nextText : null,
  };
}

function plainItem(
  scene: { id: string; narration: string },
  voice: VoiceSettings,
  voiceId: string,
  modelId: string,
  entries: readonly PronunciationEntry[],
): Omit<NarrationItem, "state"> {
  const rules = activeRules(scene.narration, entries);
  return {
    sceneId: scene.id,
    text: scene.narration,
    scriptText: scene.narration,
    requestText: scene.narration,
    cacheKey: narrationCacheKey({
      text: scene.narration,
      voice,
      resolvedVoiceId: voiceId,
      resolvedModelId: modelId,
      rules,
    }),
    characters: scene.narration.length,
    rules,
    rendered: null,
    previousText: null,
    nextText: null,
  };
}

export async function planNarration(
  deps: NarrationDeps,
  manifest: Manifest,
  storyboard: Storyboard,
  voice: VoiceSettings = manifest.voice,
  sceneIds?: readonly string[],
): Promise<NarrationPlan> {
  const synthesizer = deps.synthesizer(voice.provider);
  const { voiceId, modelId } = synthesizer.resolveVoice(voice);
  const entries = await loadPronunciations(deps);
  const paths = deps.layout.video(manifest.id);
  // A direction file takes effect only once a performance is selected. Until then the
  // video keeps its plain narration, so drafting direction never invalidates a clip.
  const loaded = await loadVoiceDirection(deps, manifest.id);
  const preset = voice.preset;
  const direction = preset === null ? null : (loaded?.direction ?? null);
  const requestVoice = preset === null ? voice : performedVoice(voice, preset);
  const scenes = narratedScenes(storyboard);
  const around = neighbours(storyboard);
  const spokenOf = (id: string | undefined): string | null => {
    const scene = scenes.find((candidate) => candidate.id === id);
    if (!scene) return null;
    return direction?.scenes[scene.id]?.spoken ?? scene.narration;
  };

  const items: NarrationItem[] = [];
  const pending = new Set<string>();
  for (const scene of scenes) {
    if (sceneIds && !sceneIds.includes(scene.id)) continue;
    const base =
      preset === null
        ? plainItem(scene, voice, voiceId, modelId, entries)
        : performedItem({
            sceneId: scene.id,
            scriptText: scene.narration,
            voice: requestVoice,
            voiceId,
            modelId,
            preset,
            direction,
            entries,
            previousText: spokenOf(around.get(scene.id)?.previous),
            nextText: spokenOf(around.get(scene.id)?.next),
          });
    for (const entry of termsUsedIn(base.text, entries)) {
      if (entry.status === "pending") pending.add(entry.term);
    }
    const asset = manifest.assets.narration[scene.id];
    const present =
      asset?.cacheKey === base.cacheKey && (await deps.files.exists(paths.absolute(asset.file)));
    const state = present
      ? "current"
      : (await readCacheEntry(deps, base.cacheKey))
        ? "cached"
        : "missing";
    items.push({ ...base, state });
  }

  // Scenes that share text and voice are synthesised once, so cost them once.
  const toBuy = new Map(
    items
      .filter((item) => item.state === "missing")
      .map((item) => [item.cacheKey, item.requestText]),
  );
  return {
    provider: voice.provider,
    voiceId,
    modelId,
    preset,
    voice: requestVoice,
    directionHash: direction === null ? null : (loaded?.hash ?? null),
    directionWaiting: preset === null && loaded !== null,
    items,
    cost: estimateSynthesisCost(
      [...toBuy.values()],
      voice.provider,
      modelId,
      deps.usdPerThousandCredits(),
    ),
    pendingPronunciations: [...pending].sort(),
  };
}

export interface NarrateInput {
  videoId: string;
  sceneIds?: readonly string[];
  /** Report what would be generated and what it would cost, without generating anything. */
  dryRun: boolean;
  /** Regenerate even when a clip is cached. Spends credits again. */
  force: boolean;
  /** Switch this video to another voice provider before narrating. */
  provider?: VoiceProvider;
  /** Switch this video to another voice of the provider before narrating. */
  voiceId?: string;
  /**
   * Set this video's speaking pace (0.7 to 2; above 1.2 the clip is time-stretched after
   * synthesis) before narrating. A selected preset carries its own pace and replaces this one.
   */
  speed?: number;
  /**
   * Plan with this preset instead of the recorded one. Meant for dry runs: it shows what a
   * performance would cost before anyone commits to it. A real run still requires the
   * preset to be the one a person selected.
   */
  preset?: PresetId;
}

export interface NarrateResult {
  plan: NarrationPlan;
  generated: string[];
  restoredFromCache: string[];
  alreadyCurrent: string[];
  dryRun: boolean;
}

export interface Spend {
  characters: number;
  credits: number;
  seconds: number;
}

/**
 * Synthesises one clip into the shared cache. Word timings are stored for the plain spoken
 * words only: any markup the engine added is removed from the provider's alignment first.
 */
export async function synthesizeToCache(
  deps: NarrationDeps,
  synthesizer: SpeechSynthesizer,
  plan: Pick<NarrationPlan, "voiceId" | "modelId" | "provider" | "voice">,
  item: Omit<NarrationItem, "state">,
): Promise<{ entry: CacheEntry; spend: Spend }> {
  const { base, meta } = cachePaths(deps, item.cacheKey);
  const result = await synthesizer.synthesize({
    text: item.requestText,
    voice: plan.voice,
    voiceId: plan.voiceId,
    modelId: plan.modelId,
    rules: item.rules,
    outputBase: base,
    ...(item.previousText === null ? {} : { previousText: item.previousText }),
    ...(item.nextText === null ? {} : { nextText: item.nextText }),
  });
  const { durationSeconds } = await deps.media.probe(result.file);
  const alignment =
    result.alignment && item.rendered
      ? plainAlignment(result.alignment, item.rendered)
      : result.alignment;
  const words: WordTiming[] = alignment
    ? wordsFromAlignment(alignment)
    : estimateWordTimings(item.text, durationSeconds);
  const credits =
    result.billedCredits ??
    estimateSynthesisCost(
      result.billedCharacters > 0 ? [item.requestText] : [],
      plan.provider,
      plan.modelId,
      null,
    ).credits;
  const entry: CacheEntry = {
    extension: path.extname(result.file).slice(1),
    durationSeconds,
    characters: item.characters,
    provider: plan.provider,
    timing: result.alignment ? "provider" : "estimated",
    words,
    createdAt: deps.clock.now().toISOString(),
    ...(result.billedCharacters > 0 ? { billedCredits: credits } : {}),
    ...(result.requestId ? { requestId: result.requestId } : {}),
  };
  await deps.files.writeJson(meta, entry);
  return {
    entry,
    spend: {
      characters: result.billedCharacters,
      credits: result.billedCharacters > 0 ? credits : 0,
      seconds: result.billedCharacters > 0 ? durationSeconds : 0,
    },
  };
}

/** Adds one paid request (or one cache hit) to a video's ledger. */
export function recordUsage(
  usage: Manifest["usage"],
  event: { spend: Spend | null; cacheHit: boolean; regeneration: boolean },
): Manifest["usage"] {
  const paid = event.spend !== null && event.spend.characters > 0;
  return {
    synthesisedCharacters: usage.synthesisedCharacters + (event.spend?.characters ?? 0),
    synthesisRequests: usage.synthesisRequests + (paid ? 1 : 0),
    cacheHits: usage.cacheHits + (event.cacheHit ? 1 : 0),
    generatedSeconds: usage.generatedSeconds + (event.spend?.seconds ?? 0),
    credits: usage.credits + (event.spend?.credits ?? 0),
    regenerations: usage.regenerations + (paid && event.regeneration ? 1 : 0),
  };
}

/**
 * Places a cached clip in the video. Performed clips are measured and, when their level is
 * off the per-clip target, written as a levelled copy; the cached original is never
 * altered, so finishing can be redone at no cost.
 */
async function placeClip(
  deps: NarrationDeps,
  source: string,
  destination: string,
  voice: VoiceSettings,
  performed: boolean,
): Promise<{ measurement: ClipMeasurement; gainDb: number } | null> {
  if (!performed || !deps.audio) {
    await deps.files.copy(source, destination);
    return null;
  }
  const measurement = await deps.audio.measureClip(source);
  const finishing = planFinishing(measurement, voice.finishing);
  if (!finishing.needed) {
    await deps.files.copy(source, destination);
    return { measurement, gainDb: 0 };
  }
  await deps.audio.finishClip({
    input: source,
    output: destination,
    gainDb: finishing.gainDb,
    compression: finishing.compression,
    fadeInSeconds: finishing.fadeInSeconds,
    fadeOutSeconds: finishing.fadeOutSeconds,
    durationSeconds: measurement.durationSeconds,
  });
  return { measurement: await deps.audio.measureClip(destination), gainDb: finishing.gainDb };
}

/**
 * The checks that stand between a script and paid speech. Narration is generated only from
 * wording a person approved, in a performance a person chose after listening.
 */
async function requireApproved(
  deps: NarrationDeps,
  manifest: Manifest,
  plan: NarrationPlan,
  scriptHash: string,
  wouldSpend: boolean,
): Promise<void> {
  const videoId = manifest.id;
  const approveHint = `Review script.md and the voice report, then run \`pnpm studio approve --video ${videoId} --stage script\`.`;
  const approval = manifest.approvals.script;
  if (approval?.subjectHash !== scriptHash) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      "Narration cannot be generated until the script is approved.",
      { hint: approveHint },
    );
  }
  const paid = plan.provider === "elevenlabs";
  if (approval.automated && paid) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      "The script was approved by automation only. Paid narration needs a person's approval.",
      { hint: approveHint },
    );
  }
  // A drafted direction that is not yet in force blocks only a run that would buy speech:
  // re-running narrate on a video whose clips are all current stays a harmless no-op.
  if (paid && ((plan.directionWaiting && wouldSpend) || plan.preset !== null)) {
    const chosen = manifest.voiceSelection;
    if (chosen?.preset !== plan.preset || chosen.voiceId !== plan.voiceId) {
      throw new StudioError(
        "APPROVAL_REQUIRED",
        "No voice performance has been chosen for this video. Full narration waits for a person to listen to the auditions and record a choice.",
        {
          hint: `Run \`pnpm studio voice audition --video ${videoId}\`, listen, then \`pnpm studio voice select --video ${videoId} --preset <preset>\`.`,
        },
      );
    }
  }
  if (plan.directionHash === null) return;
  const check = await checkVoiceDirection(deps, videoId);
  if (check) requireAcceptedDirection(check, videoId);
  if (approval.voiceDirectionHash !== plan.directionHash) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      "The spoken wording or voice direction changed after the script was approved. What is spoken must be what a person approved.",
      { hint: approveHint },
    );
  }
}

/**
 * Generates narration for every scene that needs it and nothing else. A clip is identified
 * by its text, voice and pronunciation rules; identical clips are served from the shared
 * cache, so editing one scene costs one scene.
 */
export async function narrate(deps: NarrationDeps, input: NarrateInput): Promise<NarrateResult> {
  const { manifest: loaded, storyboard } = await requireCurrentStoryboard(deps, input.videoId);
  const { hash: scriptHash } = await loadScript(deps, input.videoId);
  // A voice id belongs to one provider. Switching provider without naming a voice falls
  // back to that provider's default instead of carrying the old provider's id across.
  const switching = input.provider !== undefined && input.provider !== loaded.voice.provider;
  if (input.speed !== undefined && !(input.speed >= MIN_SPEED && input.speed <= MAX_SPEED)) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Speed ${String(input.speed)} is out of range. Use a value from ${String(MIN_SPEED)} to ${String(MAX_SPEED)}.`,
    );
  }
  const voice: VoiceSettings = {
    ...loaded.voice,
    ...(switching ? { voiceId: null, modelId: null } : {}),
    ...(input.provider === undefined ? {} : { provider: input.provider }),
    ...(input.voiceId === undefined ? {} : { voiceId: input.voiceId }),
    ...(input.speed === undefined ? {} : { speed: input.speed }),
    ...(input.preset === undefined ? {} : { preset: input.preset }),
  };
  const plan = await planNarration(deps, loaded, storyboard, voice, input.sceneIds);

  const empty = { generated: [], restoredFromCache: [], alreadyCurrent: [] };
  if (input.dryRun) return { plan, ...empty, dryRun: true };

  const wouldSpend = input.force || plan.items.some((item) => item.state === "missing");
  await requireApproved(deps, loaded, plan, scriptHash, wouldSpend);

  const synthesizer = deps.synthesizer(voice.provider);
  const paths = deps.layout.video(input.videoId);
  // Covers the clips and, for performed narration, the finishing applied to them. Plain
  // narration hashes exactly the fields it always did: adding a setting to the schema must
  // not make an untouched video look changed and send its renders back to pending.
  // Nothing visual is included, so a storyboard or design change never asks for narration.
  const { preset, finishing, ...plainVoice } = voice;
  const inputHash = hashOf({
    voice: preset === null ? plainVoice : { ...plainVoice, preset, finishing },
    keys: plan.items.map((item) => [item.sceneId, item.cacheKey]),
  });
  const outcome = {
    generated: [] as string[],
    restoredFromCache: [] as string[],
    alreadyCurrent: [] as string[],
  };

  await runStage(
    deps,
    input.videoId,
    "voice",
    inputHash,
    // A partial run (selected scenes) must never mark the whole stage complete on its own.
    { force: input.force || input.sceneIds !== undefined },
    async (start, checkpoint) => {
      let manifest: Manifest = { ...start, voice };
      for (const item of plan.items) {
        if (item.state === "current" && !input.force) {
          outcome.alreadyCurrent.push(item.sceneId);
          continue;
        }
        let entry = input.force ? null : await readCacheEntry(deps, item.cacheKey);
        let spend: Spend | null = null;
        const restored = entry !== null;
        if (entry) {
          outcome.restoredFromCache.push(item.sceneId);
        } else {
          deps.logger.info("Synthesising narration", {
            scene: item.sceneId,
            characters: item.characters,
          });
          ({ entry, spend } = await synthesizeToCache(deps, synthesizer, plan, item));
          outcome.generated.push(item.sceneId);
        }

        const file = path.join(paths.audio, `${item.sceneId}.${entry.extension}`);
        const wordsFile = path.join(paths.audio, `${item.sceneId}.words.json`);
        const placed = await placeClip(
          deps,
          `${cachePaths(deps, item.cacheKey).base}.${entry.extension}`,
          file,
          voice,
          item.rendered !== null,
        );
        await deps.files.writeJson(wordsFile, entry.words);
        const asset: NarrationAsset = {
          cacheKey: item.cacheKey,
          // Always the script scene, so a render can tell when the script moved on.
          textHash: sha256(item.scriptText),
          file: paths.relative(file),
          wordsFile: paths.relative(wordsFile),
          durationSeconds: entry.durationSeconds,
          characters: item.characters,
          provider: entry.provider,
          timing: entry.timing,
          createdAt: entry.createdAt,
          ...(plan.preset === null ? {} : { preset: plan.preset, spokenHash: sha256(item.text) }),
          ...(placed === null
            ? {}
            : {
                loudness: {
                  integratedLufs: placed.measurement.integratedLufs,
                  truePeakDbtp: placed.measurement.truePeakDbtp,
                  gainDb: placed.gainDb,
                },
              }),
        };
        const regeneration = manifest.assets.narration[item.sceneId] !== undefined;
        manifest = {
          ...manifest,
          assets: {
            ...manifest.assets,
            narration: { ...manifest.assets.narration, [item.sceneId]: asset },
          },
          usage: recordUsage(manifest.usage, { spend, cacheHit: restored, regeneration }),
        };
        // Saved after every scene: a failure on scene nine keeps the first eight.
        await checkpoint(manifest);
      }

      // Drop clips for scenes that no longer exist or are disabled.
      const wanted = new Set(narratedScenes(storyboard).map((scene) => scene.id));
      const narration = Object.fromEntries(
        Object.entries(manifest.assets.narration).filter(([id]) => wanted.has(id)),
      );
      const everyScene = input.sceneIds
        ? await planNarration(deps, { ...manifest, voice }, storyboard, voice)
        : plan;
      const complete = everyScene.items.every(
        (item) => narration[item.sceneId]?.cacheKey === item.cacheKey,
      );
      return {
        manifest: { ...manifest, assets: { ...manifest.assets, narration } },
        result: null,
        complete,
      };
    },
  );
  return { plan, ...outcome, dryRun: false };
}

export interface PreviewInput {
  videoId: string;
  text: string;
  dryRun: boolean;
  /**
   * Term whose rule should be applied even while pending. Previewing is how a rule gets
   * approved, so the preview has to speak the proposed reading.
   */
  previewTerm?: string;
}

/** Longest sample allowed before script approval. Enough to judge a voice, not a script. */
export const PREVIEW_CHARACTER_LIMIT = 400;

/**
 * Generates a short sample so a person can choose a voice or check a pronunciation before
 * committing credits to the full script. Samples are cached like any other clip.
 */
export async function previewVoice(
  deps: NarrationDeps,
  input: PreviewInput,
): Promise<{
  file: string | null;
  cost: CostEstimate;
  cached: boolean;
  durationSeconds: number | null;
}> {
  const text = input.text.trim();
  if (!text) throw new StudioError("VALIDATION_FAILED", "There is no text to preview.");
  if (text.length > PREVIEW_CHARACTER_LIMIT) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Previews are limited to ${PREVIEW_CHARACTER_LIMIT} characters.`,
      {
        hint: "Preview a sentence or two. Full narration needs an approved script and `pnpm studio narrate`.",
      },
    );
  }
  const manifest = await deps.manifests.load(input.videoId);
  const synthesizer = deps.synthesizer(manifest.voice.provider);
  const { voiceId, modelId } = synthesizer.resolveVoice(manifest.voice);
  const entries = await loadPronunciations(deps);
  const proposed = entries.filter(
    (entry) =>
      entry.term.toLowerCase() === input.previewTerm?.toLowerCase() &&
      entry.status === "pending" &&
      (entry.alias !== null || entry.ipa !== null),
  );
  const rules = [...activeRules(text, entries), ...proposed];
  const cacheKey = narrationCacheKey({
    text,
    voice: manifest.voice,
    resolvedVoiceId: voiceId,
    resolvedModelId: modelId,
    rules,
  });
  const item: NarrationItem = {
    sceneId: "preview",
    text,
    scriptText: text,
    requestText: text,
    cacheKey,
    characters: text.length,
    rules,
    rendered: null,
    previousText: null,
    nextText: null,
    state: "missing",
  };
  const plan: NarrationPlan = {
    provider: manifest.voice.provider,
    voiceId,
    modelId,
    preset: null,
    voice: manifest.voice,
    directionHash: null,
    directionWaiting: false,
    items: [item],
    cost: estimateSynthesisCost(
      [text],
      manifest.voice.provider,
      modelId,
      deps.usdPerThousandCredits(),
    ),
    pendingPronunciations: [],
  };

  let entry = await readCacheEntry(deps, cacheKey);
  const cached = entry !== null;
  if (input.dryRun) {
    return {
      file: null,
      cost: cached
        ? { ...plan.cost, credits: 0, usd: plan.cost.usd === null ? null : 0 }
        : plan.cost,
      cached,
      durationSeconds: entry?.durationSeconds ?? null,
    };
  }
  let spend: Spend | null = null;
  if (!entry) ({ entry, spend } = await synthesizeToCache(deps, synthesizer, plan, item));

  const paths = deps.layout.video(input.videoId);
  const file = path.join(paths.audio, "previews", `${cacheKey.slice(0, 16)}.${entry.extension}`);
  await deps.files.copy(`${cachePaths(deps, cacheKey).base}.${entry.extension}`, file);
  if (spend !== null && spend.characters > 0) {
    const current = await deps.manifests.load(input.videoId);
    await deps.manifests.save({
      ...current,
      usage: recordUsage(current.usage, { spend, cacheHit: false, regeneration: false }),
    });
  }
  return { file, cost: plan.cost, cached, durationSeconds: entry.durationSeconds };
}

export async function readWords(
  deps: CoreDeps,
  videoId: string,
  asset: NarrationAsset,
): Promise<WordTiming[]> {
  const raw = await deps.files.readJson(deps.layout.video(videoId).absolute(asset.wordsFile));
  return z.array(WordTimingSchema).parse(raw);
}
