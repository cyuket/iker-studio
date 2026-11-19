import path from "node:path";
import { cueProblems } from "../domain/cues";
import { StudioError } from "../domain/errors";
import { hashOf } from "../domain/hash";
import {
  createManifest,
  invalidateDownstream,
  slugify,
  VideoIdSchema,
  type Manifest,
} from "../domain/manifest";
import {
  DEFAULT_SCENE_PADDING_SECONDS,
  SILENT_SCENE_SECONDS,
  estimateCut,
  estimateNarrationSeconds,
  lintScript,
  type ContentType,
  type LintIssue,
  type Script,
  type ScriptEstimate,
  type ScriptScene,
} from "../domain/script";
import {
  SceneSchema,
  StoryboardSchema,
  type Scene,
  type SceneVisual,
  type Storyboard,
} from "../domain/storyboard";
import { VoiceSettingsSchema, type VoiceProvider } from "../domain/voice";
import { loadResearch, loadScript, loadStoryboard, type CoreDeps } from "./context";
import { runStage } from "./pipeline";
import { loadVoiceDirection } from "./voice-direction";
import {
  loadTemplate,
  researchSkeleton,
  scriptSkeleton,
  templateDir,
  type Template,
} from "./templates";

export interface CreateVideoInput {
  topic: string;
  title?: string;
  id?: string;
  audience?: string;
  /** Defaults to the template's first content type. */
  contentType?: ContentType;
  template: string;
  voiceProvider: VoiceProvider;
  /** Start from the template's finished demo script and storyboard instead of a skeleton. */
  demo: boolean;
}

export async function createVideo(deps: CoreDeps, input: CreateVideoInput): Promise<Manifest> {
  const title = input.title ?? input.topic;
  const idResult = VideoIdSchema.safeParse(input.id ?? slugify(title));
  if (!idResult.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      "The video id must be lowercase words separated by hyphens.",
      {
        hint: "Pass --id, e.g. --id face-deduplication.",
      },
    );
  }
  const id = idResult.data;
  if (await deps.manifests.exists(id)) {
    throw new StudioError("VALIDATION_FAILED", `A video with the id "${id}" already exists.`, {
      hint: "Choose another --id, or continue the existing video with `pnpm studio status`.",
    });
  }
  const template = await loadTemplate(deps, input.template);
  const contentType = input.contentType ?? template.contentTypes[0];
  if (contentType === undefined || !template.contentTypes.includes(contentType)) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Template "${template.id}" does not support ${input.contentType ?? "any content type"}.`,
      { hint: `It supports: ${template.contentTypes.join(", ")}` },
    );
  }
  const primary = template.cuts[0];
  if (!primary)
    throw new StudioError("VALIDATION_FAILED", `Template "${template.id}" has no cuts.`);

  const paths = deps.layout.video(id);
  const manifest = createManifest({
    id,
    title,
    topic: input.topic,
    audience: input.audience ?? "",
    contentType,
    template: template.id,
    format: primary.format,
    durationTarget: {
      minSeconds: primary.targetSeconds.min,
      maxSeconds: primary.targetSeconds.max,
    },
    voice: VoiceSettingsSchema.parse({ provider: input.voiceProvider }),
    now: deps.clock.now().toISOString(),
  });
  await deps.manifests.save(manifest);

  if (input.demo) {
    const demo = path.join(templateDir(deps, template.id), "demo");
    await deps.files.copy(path.join(demo, "script.md"), paths.script);
    await deps.files.copy(path.join(demo, "research.md"), paths.research);
    // The demo's finished visuals become the starting storyboard; `storyboard` re-syncs it.
    await deps.files.copy(path.join(demo, "storyboard.json"), paths.storyboard);
  } else {
    await deps.files.writeText(
      paths.script,
      scriptSkeleton(template, {
        title,
        contentType,
        audience: input.audience ?? "",
      }),
    );
    await deps.files.writeText(paths.research, researchSkeleton(input.topic));
  }

  const done = await runStage(
    deps,
    id,
    "idea",
    hashOf({ topic: input.topic, title }),
    {},
    (current) => Promise.resolve({ manifest: current, result: null }),
  );
  return done.manifest;
}

export interface ScriptReport {
  hash: string;
  version: number;
  issues: LintIssue[];
  estimates: ScriptEstimate[];
  facts: number;
  approved: boolean;
  /** False when errors remain; the stage is then left incomplete. */
  accepted: boolean;
}

/**
 * Validates and lints script.md. A script with lint errors is never accepted, so
 * storyboards, narration and renders can only be built from text that passed the checks.
 */
export async function checkScript(deps: CoreDeps, videoId: string): Promise<ScriptReport> {
  const facts = await loadResearch(deps, videoId);
  const { script, hash } = await loadScript(deps, videoId);
  const issues = lintScript(script, new Set(facts.map((fact) => fact.id)));
  if (facts.length === 0) {
    issues.push({
      severity: "warning",
      rule: "no-research",
      message: "research.md lists no verified facts. Add them before making product claims.",
    });
  }
  const estimates = script.cuts.map(estimateCut);
  const accepted = !issues.some((issue) => issue.severity === "error");
  let manifest = await deps.manifests.load(videoId);

  if (accepted) {
    // Research is a manual stage: it counts as done once the script it supports passes.
    await runStage(deps, videoId, "research", hashOf(facts), {}, (current) =>
      Promise.resolve({ manifest: current, result: null }),
    );
    const run = await runStage(deps, videoId, "script", hash, {}, (current) => {
      const changed = current.script.hash !== hash;
      return Promise.resolve({
        manifest: {
          ...current,
          title: script.title,
          audience: script.audience,
          script: { hash, version: changed ? current.script.version + 1 : current.script.version },
        },
        result: null,
      });
    });
    manifest = run.manifest;
  } else if (manifest.script.hash !== hash && manifest.stages.script.status === "completed") {
    // The file changed and no longer passes: everything built from the old text is stale.
    manifest = invalidateDownstream(
      {
        ...manifest,
        stages: { ...manifest.stages, script: { ...manifest.stages.script, status: "pending" } },
      },
      "script",
    );
    await deps.manifests.save(manifest);
  }

  return {
    hash,
    version: manifest.script.version,
    issues,
    estimates,
    facts: facts.length,
    approved: manifest.approvals.script?.subjectHash === hash,
    accepted,
  };
}

/** A plain starting visual for a scene the template does not describe. */
function defaultVisual(scene: ScriptScene, script: Script): SceneVisual {
  const headline = scene.title ?? script.title;
  switch (scene.type) {
    case "INTRO":
      return { kind: "title", headline: script.title };
    case "CTA":
      return {
        kind: "cta",
        headline,
        action: script.callToAction.label,
        url: script.callToAction.url,
      };
    case "OUTRO":
      return { kind: "outro" };
    default:
      return { kind: "statement", headline, points: [], tone: "neutral" };
  }
}

function templateScene(template: Template | null, cutId: string, sceneId: string) {
  return template?.cuts
    .find((cut) => cut.id === cutId)
    ?.scenes.find((scene) => scene.id === sceneId);
}

function estimatedSeconds(narration: string): number {
  return narration
    ? estimateNarrationSeconds(narration) + DEFAULT_SCENE_PADDING_SECONDS
    : SILENT_SCENE_SECONDS;
}

/**
 * Brings the storyboard in line with the script. The script owns which scenes exist, their
 * order and their narration; the storyboard owns how each scene looks. Existing visual
 * work is kept, new scenes get the template's visual, and scenes removed from the script
 * are dropped.
 */
export function syncStoryboard(
  videoId: string,
  script: Script,
  scriptHash: string,
  existing: Storyboard | null,
  template: Template | null,
): Storyboard {
  const previousScenes = new Map<string, Scene>();
  for (const cut of existing?.cuts ?? [])
    for (const scene of cut.scenes) previousScenes.set(scene.id, scene);

  const cuts = script.cuts.map((cut) => {
    const previousCut = existing?.cuts.find((c) => c.id === cut.id);
    const scenes = cut.scenes.map((scriptScene) => {
      const kept = previousScenes.get(scriptScene.id);
      const fromTemplate = templateScene(template, cut.id, scriptScene.id);
      return SceneSchema.parse({
        ...(kept ?? {
          visual: fromTemplate?.visual ?? defaultVisual(scriptScene, script),
          ...(fromTemplate?.chapterTitle ? { chapterTitle: fromTemplate.chapterTitle } : {}),
        }),
        id: scriptScene.id,
        type: scriptScene.type,
        narration: scriptScene.narration,
        estimatedDurationSeconds: Number(estimatedSeconds(scriptScene.narration).toFixed(2)),
        visualInstructions: kept?.visualInstructions || scriptScene.direction.join(" "),
      });
    });
    return {
      ...(previousCut ?? {}),
      id: cut.id,
      format: cut.format,
      targetSeconds: cut.targetSeconds,
      scenes,
    };
  });

  const draft = StoryboardSchema.parse({
    schemaVersion: 1,
    videoId,
    version: existing?.version ?? 1,
    scriptHash,
    cuts,
  });
  const changed = existing === null || hashOf(existing.cuts) !== hashOf(draft.cuts);
  return { ...draft, version: existing && changed ? existing.version + 1 : draft.version };
}

export interface StoryboardEdit {
  sceneId: string;
  enabled: boolean;
}

export interface StoryboardResult {
  storyboard: Storyboard;
  hash: string;
  previewFile: string;
}

export async function updateStoryboard(
  deps: CoreDeps,
  videoId: string,
  edits: readonly StoryboardEdit[],
  renderPreview: (storyboard: Storyboard, manifest: Manifest) => string,
): Promise<StoryboardResult> {
  const manifest = await deps.manifests.load(videoId);
  const { script, hash: scriptHash } = await loadScript(deps, videoId);
  if (manifest.script.hash !== scriptHash || manifest.stages.script.status !== "completed") {
    throw new StudioError("STAGE_BLOCKED", "The script has changed since it was last checked.", {
      hint: `Run \`pnpm studio script --video ${videoId}\` first.`,
    });
  }
  const paths = deps.layout.video(videoId);
  const existing = (await deps.files.exists(paths.storyboard))
    ? await loadStoryboard(deps, videoId)
    : null;
  const template = await loadTemplate(deps, manifest.template).catch(() => null);

  const storyboard = syncStoryboard(videoId, script, scriptHash, existing, template);
  for (const edit of edits) {
    const found = storyboard.cuts
      .flatMap((cut) => cut.scenes)
      .find((scene) => scene.id === edit.sceneId);
    if (!found) {
      throw new StudioError("NOT_FOUND", `There is no scene "${edit.sceneId}" in the storyboard.`);
    }
    found.enabled = edit.enabled;
  }

  // Cues are checked against the narration before anything is saved or rendered: a phrase
  // that is not spoken would silently leave its animation without a moment to happen.
  // Once a performance is selected the voice speaks the direction's wording, which may differ
  // from the script, so that wording is what a cue has to be found in.
  const direction = manifest.voice.preset === null ? null : await loadVoiceDirection(deps, videoId);
  const problems = storyboard.cuts.flatMap((cut) =>
    cut.scenes.flatMap((scene) =>
      cueProblems(
        scene,
        // Audio tags such as [pause] are instructions to the model, not words it says.
        direction?.direction.scenes[scene.id]?.spoken.replace(/\[[^\]]*\]/g, " ") ??
          scene.narration,
      ).map((problem) => `Cut "${cut.id}". ${problem}`),
    ),
  );
  if (problems.length > 0) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `The storyboard's cues do not match its narration:\n- ${problems.join("\n- ")}`,
      {
        hint: "A cue's phrase must be consecutive words of that scene's narration, and every cue a visual uses must be defined in the scene's cues or listed in the visual's settled list.",
      },
    );
  }

  const hash = hashOf(storyboard.cuts);
  await deps.files.writeJson(paths.storyboard, storyboard);
  const run = await runStage(deps, videoId, "storyboard", hash, {}, (current) =>
    Promise.resolve({
      manifest: { ...current, storyboard: { hash, version: storyboard.version } },
      result: null,
    }),
  );
  await deps.files.writeText(paths.storyboardPreview, renderPreview(storyboard, run.manifest));
  return { storyboard, hash, previewFile: paths.storyboardPreview };
}

/** The storyboard is usable only when it was built from the script as it is now. */
export async function requireCurrentStoryboard(
  deps: CoreDeps,
  videoId: string,
): Promise<{ manifest: Manifest; storyboard: Storyboard; script: Script }> {
  const manifest = await deps.manifests.load(videoId);
  const { script, hash } = await loadScript(deps, videoId);
  const storyboard = await loadStoryboard(deps, videoId);
  if (storyboard.scriptHash !== hash || manifest.script.hash !== hash) {
    throw new StudioError("STAGE_BLOCKED", "The script changed after the storyboard was built.", {
      hint: `Run \`pnpm studio script --video ${videoId}\` then \`pnpm studio storyboard --video ${videoId}\`.`,
    });
  }
  if (manifest.storyboard.hash !== hashOf(storyboard.cuts)) {
    throw new StudioError(
      "STAGE_BLOCKED",
      "storyboard.json was edited since it was last validated.",
      {
        hint: `Run \`pnpm studio storyboard --video ${videoId}\` to validate it.`,
      },
    );
  }
  return { manifest, storyboard, script };
}
