import path from "node:path";
import { toSrt, toVtt } from "../domain/captions";
import { StudioError } from "../domain/errors";
import {
  LOUDNESS_TARGET,
  QUALITIES,
  outputDimensions,
  type QualityId,
  type QualitySpec,
} from "../domain/formats";
import { hashOf } from "../domain/hash";
import { finalKey, sceneRenderKey, type FinalAsset, type Manifest } from "../domain/manifest";
import {
  THUMBNAIL_SIZE,
  type CutRenderProps,
  type ThumbnailRenderProps,
  type ThumbnailVariant,
} from "../domain/render-props";
import type { Cut, Storyboard } from "../domain/storyboard";
import { requireCurrentStoryboard } from "./authoring";
import { loadBrand, loadScript, type CoreDeps } from "./context";
import { runStage } from "./pipeline";
import type { AssetServer, MediaTools, VideoRenderer } from "./ports";
import {
  buildSceneProps,
  compileCut,
  resolveBrand,
  segmentFile,
  SYNTHETIC_DISCLOSURE,
  type CompileContext,
  type CompiledCut,
} from "./scene-compiler";
import { loadTemplate } from "./templates";

export interface RenderSettings {
  /** Frame rate override; null keeps each format's own rate. */
  fps: number | null;
  /** Scale applied to final renders (1 = 1080 lines). Previews ignore it. */
  resolutionScale: number;
  /** Container of intermediate scene segments. */
  segmentExtension: string;
}

export interface RenderDeps extends CoreDeps {
  media: MediaTools;
  renderer: VideoRenderer;
  startAssetServer(directories: Readonly<Record<string, string>>): Promise<AssetServer>;
  settings: RenderSettings;
}

export interface RenderInput {
  videoId: string;
  cutIds?: readonly string[];
  /** Render only these scenes, then rebuild the cut from segments. */
  sceneIds?: readonly string[];
  quality: QualityId;
  /** Re-render scenes even when an identical render exists. */
  force: boolean;
}

export interface CutOutcome {
  cutId: string;
  file: string;
  durationSeconds: number;
  width: number;
  height: number;
  renderedScenes: string[];
  reusedScenes: string[];
  finalReused: boolean;
  srt: string;
  vtt: string;
}

export function selectCuts(storyboard: Storyboard, cutIds: readonly string[] | undefined): Cut[] {
  if (!cutIds) return storyboard.cuts;
  return cutIds.map((id) => {
    const cut = storyboard.cuts.find((c) => c.id === id);
    if (!cut) {
      throw new StudioError("NOT_FOUND", `There is no cut "${id}".`, {
        hint: `Cuts: ${storyboard.cuts.map((c) => c.id).join(", ")}`,
      });
    }
    return cut;
  });
}

function effectiveQuality(quality: QualityId, settings: RenderSettings): QualitySpec {
  const spec = QUALITIES[quality];
  return quality === "final" ? { ...spec, scale: spec.scale * settings.resolutionScale } : spec;
}

export async function compileContext(
  deps: RenderDeps,
  manifest: Manifest,
): Promise<CompileContext> {
  return {
    manifest,
    brand: await loadBrand(deps),
    rendererHash: await deps.renderer.sourceHash(),
    fps: deps.settings.fps,
    reducedMotion: manifest.render.reducedMotion,
    resolutionScale: deps.settings.resolutionScale,
  };
}

export function assetDirectories(
  deps: Pick<RenderDeps, "layout">,
  videoId: string,
): Record<string, string> {
  return {
    video: deps.layout.video(videoId).root,
    brand: deps.layout.brandDir,
    // Sound effects that storyboard scenes play (scene.sounds).
    sfx: deps.layout.sfxDir,
    // Photos that photo scenes show (visual.kind "photo").
    images: deps.layout.imagesDir,
  };
}

/**
 * Renders cuts from the storyboard, doing only the work that changed:
 *
 * 1. motion: compile timings, captions and a hash per scene;
 * 2. composition: render scenes whose hash differs from the stored render;
 * 3. subtitles: write SRT and VTT for each cut;
 * 4. render: join scene segments and normalise loudness into the deliverable.
 */
export async function render(deps: RenderDeps, input: RenderInput): Promise<CutOutcome[]> {
  const { manifest: loaded, storyboard } = await requireCurrentStoryboard(deps, input.videoId);
  const cuts = selectCuts(storyboard, input.cutIds);
  const quality = effectiveQuality(input.quality, deps.settings);
  const paths = deps.layout.video(input.videoId);
  const wholeVideo = input.cutIds === undefined && input.sceneIds === undefined;
  const scope = { quality: input.quality, cuts: cuts.map((cut) => cut.id) };

  // Motion: decide everything about the render without rendering.
  const context = await compileContext(deps, loaded);
  const compiled: CompiledCut[] = [];
  for (const cut of cuts) compiled.push(await compileCut(deps, context, cut));
  const motionHash = hashOf({ scope, scenes: compiled.map((c) => c.scenes.map((s) => s.hash)) });
  await runStage(
    deps,
    input.videoId,
    "motion",
    motionHash,
    { force: true, requires: ["storyboard"] },
    async (current) => {
      for (const cut of compiled) {
        await deps.files.writeJson(path.join(paths.scenes, cut.cut.id, "timeline.json"), {
          ...cut.timeline,
          sceneHashes: Object.fromEntries(cut.scenes.map((s) => [s.scene.id, s.hash])),
        });
      }
      return { manifest: current, result: null, complete: wholeVideo };
    },
  );

  // Composition: render only the scenes whose content changed.
  const outcomes = new Map<string, { rendered: string[]; reused: string[] }>();
  await runStage(
    deps,
    input.videoId,
    "composition",
    motionHash,
    { force: true, requires: wholeVideo ? ["motion"] : [] },
    async (start, checkpoint) => {
      let manifest = start;
      const pending: { cut: CompiledCut; index: number; output: string; key: string }[] = [];
      for (const cut of compiled) {
        const outcome = { rendered: [] as string[], reused: [] as string[] };
        outcomes.set(cut.cut.id, outcome);
        for (const [index, scene] of cut.scenes.entries()) {
          const key = sceneRenderKey(cut.cut.id, input.quality, scene.scene.id);
          const output = segmentFile(
            paths.root,
            cut.cut.id,
            input.quality,
            scene.scene.id,
            deps.settings.segmentExtension,
          );
          const stored = manifest.assets.sceneRenders[key];
          const current = stored?.hash === scene.hash && (await deps.files.exists(output));
          const selected = input.sceneIds === undefined || input.sceneIds.includes(scene.scene.id);
          if (current && !(input.force && selected)) outcome.reused.push(scene.scene.id);
          else if (selected) pending.push({ cut, index, output, key });
        }
      }
      if (pending.length > 0) {
        const assets = await deps.startAssetServer(assetDirectories(deps, input.videoId));
        try {
          await deps.renderer.open();
          for (const job of pending) {
            const scene = job.cut.scenes[job.index];
            if (!scene) continue;
            deps.logger.info("Rendering scene", {
              cut: job.cut.cut.id,
              scene: scene.scene.id,
              frames: scene.timing.durationFrames,
            });
            await deps.renderer.renderScene({
              props: await buildSceneProps(deps, context, job.cut, scene, assets),
              dimensions: outputDimensions(job.cut.format, quality),
              scale: quality.scale,
              crf: quality.crf,
              jpegQuality: quality.jpegQuality,
              output: job.output,
            });
            manifest = {
              ...manifest,
              assets: {
                ...manifest.assets,
                sceneRenders: {
                  ...manifest.assets.sceneRenders,
                  [job.key]: {
                    hash: scene.hash,
                    file: paths.relative(job.output),
                    durationFrames: scene.timing.durationFrames,
                    renderedAt: deps.clock.now().toISOString(),
                  },
                },
              },
            };
            await checkpoint(manifest);
            outcomes.get(job.cut.cut.id)?.rendered.push(scene.scene.id);
          }
        } finally {
          await deps.renderer.close();
          await assets.close();
        }
      }
      return { manifest, result: null, complete: wholeVideo };
    },
  );

  // Subtitles.
  const subtitleFiles = new Map<string, { srt: string; vtt: string }>();
  const subtitleHash = hashOf({ scope, cues: compiled.map((cut) => cut.cues) });
  await runStage(
    deps,
    input.videoId,
    "subtitles",
    subtitleHash,
    { force: true, requires: wholeVideo ? ["motion"] : [] },
    async (current) => {
      for (const cut of compiled) {
        const srt = path.join(paths.subtitles, `${cut.cut.id}.srt`);
        const vtt = path.join(paths.subtitles, `${cut.cut.id}.vtt`);
        await deps.files.writeText(srt, toSrt(cut.cues));
        await deps.files.writeText(vtt, toVtt(cut.cues));
        subtitleFiles.set(cut.cut.id, { srt, vtt });
      }
      return { manifest: current, result: null, complete: wholeVideo };
    },
  );

  // Render: assemble deliverables from segments.
  const results: CutOutcome[] = [];
  await runStage(
    deps,
    input.videoId,
    "render",
    motionHash,
    { force: true, requires: wholeVideo ? ["composition", "subtitles"] : [] },
    async (start, checkpoint) => {
      let manifest = start;
      for (const cut of compiled) {
        const key = finalKey(cut.cut.id, input.quality);
        const segments: string[] = [];
        for (const scene of cut.scenes) {
          const stored =
            manifest.assets.sceneRenders[sceneRenderKey(cut.cut.id, input.quality, scene.scene.id)];
          const file = segmentFile(
            paths.root,
            cut.cut.id,
            input.quality,
            scene.scene.id,
            deps.settings.segmentExtension,
          );
          if (stored?.hash !== scene.hash || !(await deps.files.exists(file))) {
            throw new StudioError(
              "STAGE_BLOCKED",
              `Scene "${scene.scene.id}" of cut "${cut.cut.id}" has no current render.`,
              {
                hint: `Run \`pnpm studio render --video ${input.videoId} --cut ${cut.cut.id}\` without --scene.`,
              },
            );
          }
          segments.push(file);
        }
        const music = cut.cut.music
          ? {
              file: path.join(deps.layout.musicDir, cut.cut.music.file),
              volume: cut.cut.music.volume,
            }
          : null;
        if (music && !(await deps.files.exists(music.file))) {
          throw new StudioError(
            "NOT_FOUND",
            `Music file ${cut.cut.music?.file ?? ""} is not in assets/music.`,
          );
        }
        const hash = hashOf({
          segments: cut.scenes.map((scene) => scene.hash),
          music: music ? { file: await deps.files.sha256(music.file), volume: music.volume } : null,
          loudness: LOUDNESS_TARGET,
          audioBitrateKbps: quality.audioBitrateKbps,
        });
        const directory = input.quality === "final" ? paths.final : paths.previews;
        const output = path.join(directory, `${input.videoId}-${cut.cut.id}.mp4`);
        const stored = manifest.assets.finals[key];
        const subtitles = subtitleFiles.get(cut.cut.id);
        if (!subtitles) throw new Error(`Subtitles were not written for ${cut.cut.id}`);
        const reusable = stored?.hash === hash && (await deps.files.exists(output));

        let final: FinalAsset;
        if (reusable) {
          final = stored;
        } else {
          deps.logger.info("Assembling cut", { cut: cut.cut.id, scenes: segments.length });
          await deps.media.concat({
            segments,
            output,
            audioBitrateKbps: quality.audioBitrateKbps,
            loudness: LOUDNESS_TARGET,
            music,
            durationSeconds: cut.timeline.totalSeconds,
          });
          const info = await deps.media.probe(output);
          if (!info.video) throw new StudioError("RENDER_FAILED", `${output} has no video stream.`);
          final = {
            hash,
            file: paths.relative(output),
            sha256: await deps.files.sha256(output),
            width: info.video.width,
            height: info.video.height,
            durationSeconds: info.durationSeconds,
            subtitles: { srt: paths.relative(subtitles.srt), vtt: paths.relative(subtitles.vtt) },
            timeline: paths.relative(path.join(paths.scenes, cut.cut.id, "timeline.json")),
            renderedAt: deps.clock.now().toISOString(),
          };
          manifest = {
            ...manifest,
            assets: { ...manifest.assets, finals: { ...manifest.assets.finals, [key]: final } },
          };
          await checkpoint(manifest);
        }
        const outcome = outcomes.get(cut.cut.id) ?? { rendered: [], reused: [] };
        results.push({
          cutId: cut.cut.id,
          file: output,
          durationSeconds: final.durationSeconds,
          width: final.width,
          height: final.height,
          renderedScenes: outcome.rendered,
          reusedScenes: outcome.reused,
          finalReused: reusable,
          srt: subtitles.srt,
          vtt: subtitles.vtt,
        });
      }
      return { manifest, result: null, complete: wholeVideo && input.quality === "final" };
    },
  );
  return results;
}

export interface ThumbnailOutcome {
  variant: ThumbnailVariant;
  file: string;
  reused: boolean;
}

/** Renders the three thumbnail candidates at 1280x720. */
export async function renderThumbnails(
  deps: RenderDeps,
  videoId: string,
  force: boolean,
): Promise<ThumbnailOutcome[]> {
  let manifest = await deps.manifests.load(videoId);
  const { script } = await loadScript(deps, videoId);
  const brand = await loadBrand(deps);
  const template = await loadTemplate(deps, manifest.template);
  const rendererHash = await deps.renderer.sourceHash();
  const paths = deps.layout.video(videoId);

  // The product variant shows a captured screen when the video has one.
  const recording = Object.values(manifest.assets.recordings)[0];
  const screenshot = recording ? Object.values(recording.screenshots)[0] : undefined;
  const headline = script.thumbnail?.headline ?? script.title;
  const disclosure = recording?.target === "synthetic" ? SYNTHETIC_DISCLOSURE : null;

  const outcomes: ThumbnailOutcome[] = [];
  const assets = await deps.startAssetServer(assetDirectories(deps, videoId));
  try {
    for (const variant of template.thumbnailVariants) {
      const showsScreen = variant === "product" && screenshot !== undefined;
      const hash = hashOf({
        variant,
        headline,
        rendererHash,
        brand: brand.hash,
        screenshot: showsScreen ? recording?.hash : null,
        disclosure: showsScreen ? disclosure : null,
      });
      const output = path.join(paths.thumbnails, `${variant}.png`);
      const stored = manifest.assets.thumbnails.find((thumbnail) => thumbnail.variant === variant);
      if (!force && stored?.hash === hash && (await deps.files.exists(output))) {
        outcomes.push({ variant, file: output, reused: true });
        continue;
      }
      const props: ThumbnailRenderProps = {
        brand: resolveBrand(brand, assets),
        variant,
        headline,
        screenshotSrc: showsScreen ? assets.urlFor(paths.absolute(screenshot)) : null,
        displayUrl: !showsScreen
          ? null
          : recording?.target === "iker"
            ? brand.brand.website
            : (recording?.displayHost ?? null),
        disclosure: showsScreen ? disclosure : null,
      };
      await deps.renderer.open();
      await deps.renderer.renderThumbnail(props, output);
      const info = await deps.media.probe(output);
      if (
        info.video?.width !== THUMBNAIL_SIZE.width ||
        info.video.height !== THUMBNAIL_SIZE.height
      ) {
        throw new StudioError(
          "RENDER_FAILED",
          `Thumbnail "${variant}" is not ${THUMBNAIL_SIZE.width}x${THUMBNAIL_SIZE.height}.`,
        );
      }
      manifest = {
        ...manifest,
        assets: {
          ...manifest.assets,
          thumbnails: [
            ...manifest.assets.thumbnails.filter((thumbnail) => thumbnail.variant !== variant),
            { variant, file: paths.relative(output), hash },
          ],
        },
      };
      await deps.manifests.save(manifest);
      outcomes.push({ variant, file: output, reused: false });
    }
  } finally {
    await deps.renderer.close();
    await assets.close();
  }
  return outcomes;
}

/**
 * Compiles a cut into props for Remotion Studio. The returned asset server must stay open
 * for as long as Studio is running, because the props point at it.
 */
export async function prepareStudioSession(
  deps: RenderDeps,
  videoId: string,
  cutId: string | undefined,
): Promise<{ propsFile: string; assets: AssetServer; cutId: string }> {
  const { manifest, storyboard } = await requireCurrentStoryboard(deps, videoId);
  const cut = selectCuts(storyboard, cutId ? [cutId] : undefined)[0];
  if (!cut) throw new StudioError("NOT_FOUND", "The storyboard has no cuts.");
  const context = await compileContext(deps, manifest);
  const compiled = await compileCut(deps, context, cut);
  const assets = await deps.startAssetServer(assetDirectories(deps, videoId));
  const props: CutRenderProps = { scenes: [] };
  for (const scene of compiled.scenes) {
    props.scenes.push(await buildSceneProps(deps, context, compiled, scene, assets));
  }
  const propsFile = path.join(deps.layout.video(videoId).previews, `studio-props-${cut.id}.json`);
  await deps.files.writeJson(propsFile, props);
  return { propsFile, assets, cutId: cut.id };
}
