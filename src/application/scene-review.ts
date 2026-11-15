import path from "node:path";
import { LOUDNESS_TARGET } from "../domain/formats";
import type { Manifest } from "../domain/manifest";
import { sceneRenderKey } from "../domain/manifest";
import type { Scene } from "../domain/storyboard";
import { requireCurrentStoryboard } from "./authoring";
import { html, page, raw } from "./html";
import { assetDirectories, compileContext, render, selectCuts, type RenderDeps } from "./render";
import { buildSceneProps, compileCut, segmentFile, type CompiledScene } from "./scene-compiler";

/**
 * The gate before a full render: every scene is looked at on its own, at its beginning, at
 * each moment something is meant to happen, and at its end, next to a short clip of it.
 * Software lists what is measurably wrong with the direction; whether a scene is good is
 * left to the reviewer, and rendering without errors is never treated as passing.
 */

export interface SceneReviewInput {
  videoId: string;
  cutId?: string;
  sceneIds?: readonly string[];
  /** Directory of earlier frames named `<NN>-<scene>.png`, shown beside the new ones. */
  baselineDir?: string;
}

export interface ReviewedScene {
  sceneId: string;
  frames: { label: string; file: string }[];
  clip: string | null;
  concerns: string[];
}

export interface SceneReviewOutcome {
  cutId: string;
  report: string;
  contactSheet: string;
  scenes: ReviewedScene[];
}

/** Rendered scale of review stills: enough to judge layout, quick to produce. */
const STILL_SCALE = 0.5;
/** How far into a beat to look, so the frame shows the result of the beat, not its start. */
const AFTER_BEAT_SECONDS = 0.6;
const MAX_BEAT_FRAMES = 4;

type Direction = Partial<
  Record<
    "objective" | "representation" | "layout" | "motion" | "camera" | "transition" | "finalFrame",
    string
  >
>;

/** Fields the motion system adds to a scene; read defensively so older storyboards still review. */
interface DirectedScene {
  direction?: Direction;
  cues?: readonly { id: string }[];
}

const directed = (scene: Scene): DirectedScene => scene as Scene & DirectedScene;

/** The frames worth looking at: after the entrance, after each beat, and before the exit. */
export function reviewFrames(
  durationFrames: number,
  fps: number,
  beats: Readonly<Record<string, number>>,
): { label: string; frame: number }[] {
  const last = Math.max(0, durationFrames - 1);
  const clamp = (frame: number): number => Math.min(last, Math.max(0, Math.round(frame)));
  const begin = clamp(Math.min(fps * 1.2, last * 0.2));
  const end = clamp(last - Math.min(fps * 0.9, last * 0.15));
  const beatFrames = Object.entries(beats)
    .map(([id, seconds]) => ({
      label: `beat: ${id}`,
      frame: clamp((seconds + AFTER_BEAT_SECONDS) * fps),
    }))
    .filter((beat) => beat.frame > begin && beat.frame < end)
    .sort((a, b) => a.frame - b.frame);
  // With many beats, keep an even spread rather than only the first few.
  const step = Math.max(1, Math.ceil(beatFrames.length / MAX_BEAT_FRAMES));
  const picked = beatFrames.filter((_, index) => index % step === 0).slice(0, MAX_BEAT_FRAMES);
  const middle =
    picked.length > 0 ? picked : [{ label: "middle", frame: clamp((begin + end) / 2) }];
  return [{ label: "beginning", frame: begin }, ...middle, { label: "ending", frame: end }];
}

/**
 * Problems with how a scene is directed that can be read from the storyboard itself. These
 * are the obvious ones; their absence says nothing about whether the scene looks good.
 */
export function directionConcerns(scene: Scene, previous: Scene | undefined): string[] {
  const concerns: string[] = [];
  const { direction, cues } = directed(scene);
  if (!direction?.objective) {
    concerns.push(
      "No stated objective: what should the viewer understand by the end of this scene?",
    );
  }
  if (!direction?.finalFrame) concerns.push("No expected final frame is described.");
  if (scene.narration.trim() && (cues?.length ?? 0) === 0) {
    concerns.push(
      "Nothing on screen is tied to the narration: add cues so visuals follow the words.",
    );
  }
  if (scene.visual.kind === "product" && scene.visual.mode === "video") {
    const camera = (scene.visual as { camera?: { mode?: string } }).camera;
    if (!camera || camera.mode === "static") {
      concerns.push(
        "The recording plays with a static camera: the viewer is not shown where to look.",
      );
    }
  }
  if (previous && !direction?.transition) {
    concerns.push("No transition strategy: how does this scene connect to the one before it?");
  }
  return concerns;
}

const REVIEW_CRITERIA: readonly string[] = [
  "Visual hierarchy: is there one clear focal point at every moment?",
  "Narrative clarity: with the sound off, is it clear what just happened?",
  "Composition: alignment, spacing and negative space.",
  "Readability: can every word be read at phone size?",
  "Motion timing: does each thing move when the narration reaches it, and rest otherwise?",
  "Continuity: does the scene pick up from the previous one and hand over to the next?",
  "Product accuracy: does anything shown differ from what the product really does?",
];

function renderReport(
  manifest: Manifest,
  cutId: string,
  scenes: readonly (ReviewedScene & { scene: Scene; baseline: string | null })[],
  dir: string,
): string {
  const href = (file: string): string => path.relative(dir, file).split(path.sep).join("/");
  const blocks = scenes.map(({ scene, frames, clip, concerns, baseline }) => {
    const direction = directed(scene).direction ?? {};
    const directionRows = Object.entries(direction)
      .filter(([, value]) => value)
      .map(
        ([key, value]) =>
          html`<tr>
            <th>${key}</th>
            <td>${value}</td>
          </tr>`,
      );
    return html`<h2>
        <code>${scene.id}</code> <span class="muted">${scene.type} · ${scene.visual.kind}</span>
      </h2>
      <div class="card">
        <p>${scene.narration || raw('<span class="muted">No narration</span>')}</p>
        ${
          directionRows.length
            ? raw(
                html`<div class="scroll">
                  <table>
                    <tbody>
                      ${raw(directionRows.join(""))}
                    </tbody>
                  </table>
                </div>`,
              )
            : ""
        }
        ${
          concerns.length
            ? raw(
                html`<p><span class="pill fail">Fix before rendering</span></p>
                  <ul>
                    ${raw(concerns.map((c) => html`<li>${c}</li>`).join(""))}
                  </ul>`,
              )
            : raw(
                '<p class="muted">No direction problems found by the checks. That is not a verdict on quality.</p>',
              )
        }
      </div>
      <div class="grid">
        ${
          baseline
            ? raw(
                html`<figure style="margin:0">
                  <img
                    src="${href(baseline)}"
                    alt="Earlier version of ${scene.id}"
                    loading="lazy"
                  />
                  <figcaption class="muted">before</figcaption>
                </figure>`,
              )
            : ""
        }
        ${raw(
          frames
            .map(
              (frame) =>
                html`<figure style="margin:0">
                  <img src="${href(frame.file)}" alt="${scene.id}, ${frame.label}" loading="lazy" />
                  <figcaption class="muted">${frame.label}</figcaption>
                </figure>`,
            )
            .join(""),
        )}
      </div>
      ${clip ? raw(html`<video controls preload="none" src="${href(clip)}" style="margin-top:12px;max-width:640px"></video>`) : ""}`;
  });
  const flagged = scenes.filter((scene) => scene.concerns.length > 0).length;
  const body = html`<h1>${manifest.title}</h1>
    <p class="muted">Scene review · cut <code>${cutId}</code> · before a full render</p>
    <div class="card${flagged ? " notice" : ""}">
      <p>
        ${flagged} of ${scenes.length} scenes have direction problems that can be read from the
        storyboard. A scene with none has only passed those checks. Whether it is good is for a
        person to judge, frame by frame, against the list below.
      </p>
      <ul>
        ${raw(REVIEW_CRITERIA.map((item) => html`<li>${item}</li>`).join(""))}
      </ul>
    </div>
    ${raw(blocks.join(""))}`;
  return page(`Scene review: ${manifest.title} (${cutId})`, body);
}

async function baselineFor(
  deps: RenderDeps,
  baselineDir: string | undefined,
  sceneId: string,
): Promise<string | null> {
  if (!baselineDir) return null;
  const match = (await deps.files.list(baselineDir)).find((entry) =>
    new RegExp(`(^|-)${sceneId}\\.png$`).test(path.basename(entry.file)),
  );
  return match?.file ?? null;
}

export async function reviewScenes(
  deps: RenderDeps,
  input: SceneReviewInput,
): Promise<SceneReviewOutcome> {
  // Preview-quality segments give each scene a short clip, and cost nothing when current.
  await render(deps, {
    videoId: input.videoId,
    quality: "preview",
    force: false,
    ...(input.cutId === undefined ? {} : { cutIds: [input.cutId] }),
  });
  const { manifest, storyboard } = await requireCurrentStoryboard(deps, input.videoId);
  const cut = selectCuts(storyboard, input.cutId ? [input.cutId] : undefined)[0];
  if (!cut) throw new Error("The storyboard has no cuts.");
  const context = await compileContext(deps, manifest);
  const compiled = await compileCut(deps, context, cut);
  const paths = deps.layout.video(input.videoId);
  const dir = path.join(paths.root, "review", cut.id);
  await deps.files.remove(dir);

  const wanted = (scene: CompiledScene): boolean =>
    input.sceneIds === undefined || input.sceneIds.includes(scene.scene.id);
  const reviewed: (ReviewedScene & { scene: Scene; baseline: string | null })[] = [];
  const assets = await deps.startAssetServer(assetDirectories(deps, input.videoId));
  try {
    await deps.renderer.open();
    for (const [index, scene] of compiled.scenes.entries()) {
      if (!wanted(scene)) continue;
      const props = await buildSceneProps(deps, context, compiled, scene, assets);
      const beats = (props as { beats?: Record<string, number> }).beats ?? {};
      const prefix = String(index + 1).padStart(2, "0");
      const frames: ReviewedScene["frames"] = [];
      for (const [order, still] of reviewFrames(
        scene.timing.durationFrames,
        compiled.format.fps,
        beats,
      ).entries()) {
        const file = path.join(dir, "frames", `${prefix}-${scene.scene.id}-${order + 1}.png`);
        await deps.files.ensureDir(path.dirname(file));
        await deps.renderer.renderSceneStill({
          props,
          frame: still.frame,
          scale: STILL_SCALE,
          output: file,
        });
        frames.push({ label: still.label, file });
      }
      const segment = segmentFile(
        paths.root,
        cut.id,
        "preview",
        scene.scene.id,
        deps.settings.segmentExtension,
      );
      const hasSegment =
        manifest.assets.sceneRenders[sceneRenderKey(cut.id, "preview", scene.scene.id)]?.hash ===
          scene.hash && (await deps.files.exists(segment));
      let clip: string | null = null;
      if (hasSegment) {
        clip = path.join(dir, "clips", `${prefix}-${scene.scene.id}.mp4`);
        await deps.media.concat({
          segments: [segment],
          output: clip,
          audioBitrateKbps: 128,
          loudness: LOUDNESS_TARGET,
          music: null,
          durationSeconds: scene.timing.durationFrames / compiled.format.fps,
        });
      }
      reviewed.push({
        sceneId: scene.scene.id,
        scene: scene.scene,
        frames,
        clip,
        concerns: directionConcerns(scene.scene, compiled.scenes[index - 1]?.scene),
        baseline: await baselineFor(deps, input.baselineDir, scene.scene.id),
      });
    }
  } finally {
    await deps.renderer.close();
    await assets.close();
  }

  const contactSheet = path.join(dir, "contact-sheet.png");
  const keyFrames = reviewed.flatMap((scene) => scene.frames.map((frame) => frame.file));
  const columns = Math.max(1, ...reviewed.map((scene) => scene.frames.length));
  // One row per scene: pad short rows by repeating the last frame so the grid stays aligned.
  const grid = reviewed.flatMap((scene) => {
    const files = scene.frames.map((frame) => frame.file);
    const last = files.at(-1);
    return last ? [...files, ...Array.from({ length: columns - files.length }, () => last)] : [];
  });
  if (keyFrames.length > 0) await deps.media.contactSheet(grid, contactSheet, columns);
  const report = path.join(dir, "index.html");
  await deps.files.writeText(report, renderReport(manifest, cut.id, reviewed, dir));
  return {
    cutId: cut.id,
    report,
    contactSheet,
    scenes: reviewed.map(({ sceneId, frames, clip, concerns }) => ({
      sceneId,
      frames,
      clip,
      concerns,
    })),
  };
}
