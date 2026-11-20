import path from "node:path";
import { buildCues, offsetCues, type CaptionCue, type WordTiming } from "../domain/captions";
import {
  footageAnchors,
  footageEndSeconds,
  footageLength,
  resolveBeats,
  unresolvedCues,
} from "../domain/cues";
import { planActionSounds } from "../domain/action-sounds";
import { StudioError } from "../domain/errors";
import { FORMATS, type FormatSpec } from "../domain/formats";
import { hashOf, sha256 } from "../domain/hash";
import type { Manifest, NarrationAsset, RecordingAsset } from "../domain/manifest";
import { RecordingTimelineSchema } from "../domain/recording";
import type { ResolvedBrand, ResolvedRecording, SceneRenderProps } from "../domain/render-props";
import { enabledScenes, type Cut, type Scene } from "../domain/storyboard";
import {
  buildCutTimeline,
  sceneDurationFrames,
  type CutTimeline,
  type SceneMedia,
  type SceneTiming,
} from "../domain/timeline";
import type { CoreDeps, LoadedBrand } from "./context";
import { readWords } from "./narration";
import type { AssetServer } from "./ports";

/** Label stamped on every frame of footage that does not show the real product. */
export const SYNTHETIC_DISCLOSURE = "SYNTHETIC DEMO · SIMULATED DATA, NOT THE LIVE PRODUCT";

export interface CompiledScene {
  scene: Scene;
  timing: SceneTiming;
  narration: NarrationAsset | null;
  recording: RecordingAsset | null;
  /** Cues timed from the start of the scene. */
  cues: CaptionCue[];
  /** When each storyboard cue fires, in seconds from the start of the scene. */
  beats: Record<string, number>;
  /**
   * Identity of the rendered scene. It covers what the scene shows and says but not where
   * its files live, so moving the project or restarting the asset server changes nothing.
   */
  hash: string;
  burnCaptions: boolean;
  disclosure: string | null;
  progress: { start: number; end: number } | null;
  backdrop: { startFrame: number } | null;
  /** Sound effects resolved to files on disk and frames of the scene. */
  sounds: CompiledSound[];
  /** The photo of a photo scene, resolved to its file; null for every other scene. */
  image: CompiledImage | null;
}

export interface CompiledImage {
  /** Absolute path in assets/images. */
  file: string;
  /** Content hash, so replacing the photo re-renders only the scenes that show it. */
  hash: string;
}

export interface CompiledSound {
  /** Absolute path in assets/sfx. */
  file: string;
  /** Content hash, so replacing a file re-renders only the scenes that play it. */
  hash: string;
  offsetFrames: number;
  volume: number;
  /** How long it may play; absent plays the whole file. */
  durationFrames?: number;
}

export interface CompiledCut {
  cut: Cut;
  format: FormatSpec;
  timeline: CutTimeline;
  scenes: CompiledScene[];
  /** Cues for the whole cut, timed from the start of the video. */
  cues: CaptionCue[];
}

export interface CompileContext {
  manifest: Manifest;
  brand: LoadedBrand;
  /** Changes whenever the Remotion sources or renderer version change. */
  rendererHash: string;
  /** Frame rate override from the environment; null uses each format's own. */
  fps: number | null;
  reducedMotion: boolean;
  /** Scale of final renders relative to 1080 lines; a different size is a different render. */
  resolutionScale: number;
}

function missingAssets(cut: Cut, manifest: Manifest): string[] {
  const missing: string[] = [];
  for (const scene of enabledScenes(cut)) {
    const clip = manifest.assets.narration[scene.id];
    if (scene.narration.trim() && !clip) {
      missing.push(
        `narration for scene "${scene.id}" (pnpm studio narrate --video ${manifest.id})`,
      );
    } else if (clip?.textHash !== undefined && clip.textHash !== sha256(scene.narration.trim())) {
      // The clip says something the script no longer does: never render words that changed.
      missing.push(
        `up-to-date narration for scene "${scene.id}": its text changed (pnpm studio narrate --video ${manifest.id})`,
      );
    }
    if (scene.visual.kind === "product" && !manifest.assets.recordings[scene.visual.scenarioId]) {
      missing.push(
        `recording "${scene.visual.scenarioId}" (pnpm studio record --video ${manifest.id})`,
      );
    }
  }
  return missing;
}

/**
 * Turns a storyboard cut plus its generated assets into exact timings, captions and one
 * render hash per scene. This is the "motion design" stage: it decides everything about
 * what will be rendered without rendering anything.
 */
export async function compileCut(
  deps: CoreDeps,
  context: CompileContext,
  cut: Cut,
): Promise<CompiledCut> {
  const { manifest } = context;
  const missing = missingAssets(cut, manifest);
  if (missing.length) {
    throw new StudioError(
      "STAGE_BLOCKED",
      `Cut "${cut.id}" cannot be rendered yet. Missing:\n- ${missing.join("\n- ")}`,
    );
  }
  const base = FORMATS[cut.format];
  const format: FormatSpec = context.fps === null ? base : { ...base, fps: context.fps };
  const scenes = enabledScenes(cut);
  if (scenes.length === 0) {
    throw new StudioError("VALIDATION_FAILED", `Every scene in cut "${cut.id}" is disabled.`);
  }

  const media = new Map<string, SceneMedia>();
  const sceneWords = new Map<string, WordTiming[]>();
  const sceneBeats = new Map<string, Record<string, number>>();
  for (const scene of scenes) {
    const spoken = scene.narration.trim() ? (manifest.assets.narration[scene.id] ?? null) : null;
    const recording =
      scene.visual.kind === "product"
        ? manifest.assets.recordings[scene.visual.scenarioId]
        : undefined;
    const plays = scene.visual.kind === "product" && scene.visual.mode === "video";
    const base: SceneMedia = {
      narrationSeconds: spoken?.durationSeconds ?? null,
      // A still has no length of its own; only a played recording can extend a scene.
      recordingSeconds:
        scene.visual.kind === "product" && plays && recording
          ? footageLength(scene.visual, recording.durationSeconds)
          : null,
    };
    const cues = scene.cues ?? [];
    const words =
      spoken && (scene.captions.enabled || cues.length > 0)
        ? await readWords(deps, manifest.id, spoken)
        : [];
    sceneWords.set(scene.id, words);
    // Beats are measured from the scene's first frame, so they include the lead-in exactly
    // as the renderer applies it: rounded to a whole frame.
    const offsetSeconds = Math.round(scene.animation.leadInSeconds * format.fps) / format.fps;
    // A cue whose phrase was never spoken has no moment. Stop here and say so, rather than
    // render an animation timed by guesswork. The words on file are what the voice actually
    // said, which a voice direction may have reworded since the cue was written.
    const lost = words.length > 0 ? unresolvedCues(words, cues) : [];
    if (lost.length > 0) {
      const said = words.map((word) => word.text).join(" ");
      throw new StudioError(
        "VALIDATION_FAILED",
        `Scene "${scene.id}" has cues that match nothing in its narration:\n- ${lost
          .map((cue) => `cue "${cue.id}": "${cue.phrase}"`)
          .join("\n- ")}\nThe narration says: "${said}"`,
        {
          hint: `Change each cue's phrase in output/${manifest.id}/storyboard.json to consecutive words from that sentence, then run \`pnpm studio storyboard --video ${manifest.id}\`.`,
        },
      );
    }
    const beats = resolveBeats(words, cues, offsetSeconds, {
      sceneSeconds: sceneDurationFrames(scene, base, format.fps) / format.fps,
    });
    sceneBeats.set(scene.id, beats);
    media.set(scene.id, {
      ...base,
      // Footage that starts late (after a prelude, or on a cue) must still play to its end.
      recordingSeconds:
        scene.visual.kind === "product" && base.recordingSeconds !== null
          ? footageEndSeconds(footageAnchors(scene.visual, beats), base.recordingSeconds)
          : base.recordingSeconds,
    });
  }
  const timeline = buildCutTimeline(cut.id, scenes, media, format.fps);
  const burnCaptions = cut.burnCaptions ?? format.captions.burnInByDefault;

  const compiled: CompiledScene[] = [];
  const cutCues: CaptionCue[] = [];
  for (const [index, scene] of scenes.entries()) {
    const timing = timeline.scenes[index];
    if (!timing) throw new Error(`No timing for scene ${scene.id}`);
    const narration = scene.narration.trim() ? (manifest.assets.narration[scene.id] ?? null) : null;
    const recording =
      scene.visual.kind === "product"
        ? (manifest.assets.recordings[scene.visual.scenarioId] ?? null)
        : null;

    let cues: CaptionCue[] = [];
    const beats = sceneBeats.get(scene.id) ?? {};
    if (narration && scene.captions.enabled) {
      const words = sceneWords.get(scene.id) ?? [];
      cues = offsetCues(
        buildCues(words, format.captions),
        timing.narrationOffsetFrames / format.fps,
      );
      cutCues.push(...offsetCues(cues, timing.startFrame / format.fps, cutCues.length + 1));
    }
    const progress = cut.showProgress
      ? {
          start: timing.startFrame / timeline.totalFrames,
          end: (timing.startFrame + timing.durationFrames) / timeline.totalFrames,
        }
      : null;
    const disclosure = recording?.target === "synthetic" ? SYNTHETIC_DISCLOSURE : null;
    const backdrop = cut.background === "animated" ? { startFrame: timing.startFrame } : null;
    const sounds = [
      ...(await compileSounds(deps, scene, beats, format.fps, timing.durationFrames)),
      ...(await compileActionSounds(
        deps,
        manifest.id,
        scene,
        recording,
        beats,
        format.fps,
        timing.durationFrames,
      )),
    ];
    const image = await compileImage(deps, scene);

    compiled.push({
      scene,
      timing,
      narration,
      recording,
      cues,
      beats,
      burnCaptions,
      disclosure,
      progress,
      backdrop,
      sounds,
      image,
      hash: hashOf({
        scene,
        // An empty set hashes like no set at all, so scenes without cues keep their identity.
        beats: Object.keys(beats).length > 0 ? beats : undefined,
        format,
        durationFrames: timing.durationFrames,
        narration: narration
          ? { key: narration.cacheKey, offset: timing.narrationOffsetFrames }
          : null,
        cues: burnCaptions ? cues : null,
        recording: recording?.hash ?? null,
        progress,
        // Absent for a still canvas, so scenes of existing videos keep their identity.
        backdrop: backdrop ?? undefined,
        // Absent without sounds, for the same reason. Files are named by content, not path.
        sounds:
          sounds.length > 0
            ? sounds.map(({ hash, offsetFrames, volume, durationFrames }) => ({
                hash,
                offsetFrames,
                volume,
                durationFrames,
              }))
            : undefined,
        // Absent for every scene but a photo scene. The photo is named by content, not path.
        image: image ? image.hash : undefined,
        disclosure,
        reducedMotion: context.reducedMotion,
        resolutionScale: context.resolutionScale,
        brand: context.brand.hash,
        renderer: context.rendererHash,
      }),
    });
  }
  return { cut, format, timeline, scenes: compiled, cues: cutCues };
}

/** Resolves the photo a photo scene shows, refusing a file that is not in assets/images. */
async function compileImage(deps: CoreDeps, scene: Scene): Promise<CompiledImage | null> {
  if (scene.visual.kind !== "photo") return null;
  const file = path.join(deps.layout.imagesDir, scene.visual.file);
  if (!(await deps.files.exists(file))) {
    throw new StudioError(
      "NOT_FOUND",
      `Scene "${scene.id}" shows photo "${scene.visual.file}", which is not in assets/images.`,
      { hint: "Use a file listed in assets/images/README.md, or add the photo there first." },
    );
  }
  return { file, hash: await deps.files.sha256(file) };
}

/**
 * Places a scene's sound effects: on their cue's beat, at their fixed second, or on the first
 * frame. A sound never starts after the scene's last frame.
 */
async function compileSounds(
  deps: CoreDeps,
  scene: Scene,
  beats: Record<string, number>,
  fps: number,
  durationFrames: number,
): Promise<CompiledSound[]> {
  const compiled: CompiledSound[] = [];
  for (const sound of scene.sounds ?? []) {
    const file = path.join(deps.layout.sfxDir, sound.file);
    if (!(await deps.files.exists(file))) {
      throw new StudioError(
        "NOT_FOUND",
        `Scene "${scene.id}" plays sound "${sound.file}", which is not in assets/sfx.`,
        { hint: "Use a file listed in assets/sfx/README.md, or add the file there first." },
      );
    }
    const cueSeconds = sound.cue === undefined ? undefined : beats[sound.cue];
    if (sound.cue !== undefined && cueSeconds === undefined) {
      throw new StudioError(
        "VALIDATION_FAILED",
        `Scene "${scene.id}" plays sound "${sound.file}" on cue "${sound.cue}", which the scene does not define.`,
      );
    }
    const seconds = cueSeconds ?? sound.atSeconds ?? 0;
    compiled.push({
      file,
      hash: await deps.files.sha256(file),
      offsetFrames: Math.min(Math.max(0, durationFrames - 1), Math.round(seconds * fps)),
      volume: sound.volume,
    });
  }
  return compiled;
}

/**
 * The sounds of the actions in a product scene's footage: every click, key and scroll is
 * heard where it happens on screen. A scene opts out with `actionSounds: false`.
 */
async function compileActionSounds(
  deps: CoreDeps,
  videoId: string,
  scene: Scene,
  recording: RecordingAsset | null,
  beats: Record<string, number>,
  fps: number,
  durationFrames: number,
): Promise<CompiledSound[]> {
  if (scene.visual.kind !== "product" || !recording || scene.actionSounds === false) return [];
  const timeline = RecordingTimelineSchema.parse(
    await deps.files.readJson(deps.layout.video(videoId).absolute(recording.timeline)),
  );
  const planned = planActionSounds(scene.visual, timeline, beats, durationFrames / fps);
  const hashes = new Map<string, string>();
  const compiled: CompiledSound[] = [];
  for (const sound of planned) {
    const file = path.join(deps.layout.sfxDir, sound.file);
    let hash = hashes.get(file);
    if (hash === undefined) {
      if (!(await deps.files.exists(file))) {
        throw new StudioError(
          "NOT_FOUND",
          `Scene "${scene.id}" needs the action sound "${sound.file}", which is not in assets/sfx.`,
          {
            hint: 'Restore the file (see assets/sfx/README.md), or set "actionSounds": false on the scene.',
          },
        );
      }
      hash = await deps.files.sha256(file);
      hashes.set(file, hash);
    }
    const offsetFrames = Math.min(
      Math.max(0, durationFrames - 1),
      Math.round(sound.atSeconds * fps),
    );
    compiled.push({
      file,
      hash,
      offsetFrames,
      volume: sound.volume,
      ...(sound.durationSeconds === undefined
        ? {}
        : {
            durationFrames: Math.max(
              1,
              Math.min(durationFrames - offsetFrames, Math.round(sound.durationSeconds * fps)),
            ),
          }),
    });
  }
  return compiled;
}

export function resolveBrand(brand: LoadedBrand, assets: AssetServer): ResolvedBrand {
  return {
    ...brand.brand,
    logoSrc: {
      mark: brand.logoFiles.mark ? assets.urlFor(brand.logoFiles.mark) : null,
      wordmark: brand.logoFiles.wordmark ? assets.urlFor(brand.logoFiles.wordmark) : null,
    },
  };
}

async function resolveRecording(
  deps: CoreDeps,
  videoId: string,
  scene: Scene,
  recording: RecordingAsset,
  assets: AssetServer,
  brandWebsite: string,
): Promise<ResolvedRecording> {
  const paths = deps.layout.video(videoId);
  const timeline = RecordingTimelineSchema.parse(
    await deps.files.readJson(paths.absolute(recording.timeline)),
  );
  const visual = scene.visual.kind === "product" ? scene.visual : null;
  const wanted = visual?.screenshot;
  if (wanted !== undefined && !recording.screenshots[wanted]) {
    throw new StudioError(
      "NOT_FOUND",
      `Scene "${scene.id}" asks for screenshot "${wanted}", which the recording does not have.`,
      {
        hint: `Available: ${Object.keys(recording.screenshots).join(", ") || "none"}`,
      },
    );
  }
  // The last screenshot doubles as the frame held after the recording ends.
  const screenshot = wanted
    ? recording.screenshots[wanted]
    : Object.values(recording.screenshots).at(-1);
  return {
    videoSrc: visual?.mode === "video" ? assets.urlFor(paths.absolute(recording.video)) : null,
    screenshotSrc: screenshot ? assets.urlFor(paths.absolute(screenshot)) : null,
    // A scene that stops the footage early holds that frame, as if the recording ended there.
    durationSeconds: visual
      ? footageLength(visual, recording.durationSeconds)
      : recording.durationSeconds,
    timeline,
    // Footage of the real product carries the brand's public address, whichever host it was
    // captured on. The synthetic fixture keeps its own, so it can never pass for the product.
    displayUrl: recording.target === "iker" ? brandWebsite : recording.displayHost,
  };
}

/** Builds the props for one scene, resolving every file it uses to a URL. */
export async function buildSceneProps(
  deps: CoreDeps,
  context: CompileContext,
  compiledCut: CompiledCut,
  compiled: CompiledScene,
  assets: AssetServer,
): Promise<SceneRenderProps> {
  const { manifest } = context;
  const paths = deps.layout.video(manifest.id);
  return {
    brand: resolveBrand(context.brand, assets),
    format: compiledCut.format,
    scene: compiled.scene,
    durationFrames: compiled.timing.durationFrames,
    narration: compiled.narration
      ? {
          src: assets.urlFor(paths.absolute(compiled.narration.file)),
          offsetFrames: compiled.timing.narrationOffsetFrames,
          volume: compiled.scene.audio.narrationVolume,
        }
      : null,
    sounds: compiled.sounds.map((sound) => ({
      src: assets.urlFor(sound.file),
      offsetFrames: sound.offsetFrames,
      volume: sound.volume,
      ...(sound.durationFrames === undefined ? {} : { durationFrames: sound.durationFrames }),
    })),
    beats: compiled.beats,
    captions: compiled.burnCaptions ? compiled.cues : null,
    image: compiled.image ? { src: assets.urlFor(compiled.image.file) } : null,
    recording: compiled.recording
      ? await resolveRecording(
          deps,
          manifest.id,
          compiled.scene,
          compiled.recording,
          assets,
          context.brand.brand.website,
        )
      : null,
    progress: compiled.progress,
    backdrop: compiled.backdrop,
    reducedMotion: context.reducedMotion,
    disclosure: compiled.disclosure,
  };
}

export function segmentFile(
  videoRoot: string,
  cutId: string,
  quality: string,
  sceneId: string,
  extension: string,
): string {
  return path.join(videoRoot, "scenes", cutId, quality, `${sceneId}.${extension}`);
}
