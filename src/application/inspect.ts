import path from "node:path";
import type { QualityId } from "../domain/formats";
import { hashOf } from "../domain/hash";
import { finalKey, sceneRenderKey, type Manifest } from "../domain/manifest";
import { STAGES, type StageId } from "../domain/stages";
import { requiredScenarioIds, type Storyboard } from "../domain/storyboard";
import type { CostEstimate } from "../domain/voice";
import { isFinalApproved } from "./approval";
import { requireCurrentStoryboard } from "./authoring";
import { loadBrand, loadScript, loadStoryboard, type CoreDeps } from "./context";
import { planNarration, type NarrationDeps, type NarrationPlan } from "./narration";
import type { DemoTargets, ScenarioCatalog, SpeechUsage, VideoRenderer } from "./ports";
import { isCurrentCapture } from "./recording";
import { compileCut } from "./scene-compiler";

export interface InspectDeps extends NarrationDeps {
  scenarios: ScenarioCatalog;
  targets: DemoTargets;
  renderer: VideoRenderer;
  fps: number | null;
  resolutionScale: number;
}

export type AssetState = "current" | "stale" | "missing" | "blocked" | "cached";

export interface Inspection {
  videoId: string;
  title: string;
  script: {
    version: number;
    changedSinceCheck: boolean;
    approved: boolean;
    /** True when the approval was recorded by a tool to test the pipeline, not by a reviewer. */
    approvalAutomated: boolean;
  };
  storyboard: { present: boolean; inSync: boolean; version: number };
  stages: { id: StageId; title: string; status: string; attempts: number; error: string | null }[];
  narration: { sceneId: string; state: AssetState; characters: number }[];
  recordings: { scenarioId: string; state: AssetState; target: string; verified: boolean }[];
  scenes: { cutId: string; sceneId: string; state: AssetState }[];
  cuts: { cutId: string; final: AssetState; qa: string; approved: boolean }[];
  cost: CostEstimate | null;
  voice: { provider: string; voiceId: string | null; modelId: string | null };
  /** Stages that have to run to bring everything up to date, in order. */
  requiredStages: StageId[];
  /** The single command to run next. */
  nextCommand: string | null;
  /** Reasons parts of the inspection could not be computed, e.g. a missing credential. */
  notes: string[];
}

async function storyboardOrNull(deps: CoreDeps, videoId: string): Promise<Storyboard | null> {
  return (await deps.files.exists(deps.layout.video(videoId).storyboard))
    ? loadStoryboard(deps, videoId)
    : null;
}

/**
 * Compares what the script and storyboard now call for with what has been generated, and
 * reports exactly what is stale, what it will cost to regenerate, and which stages must
 * run. Read-only: it never generates, records or renders anything.
 */
export async function inspectVideo(
  deps: InspectDeps,
  videoId: string,
  quality: QualityId = "final",
): Promise<Inspection> {
  const manifest = await deps.manifests.load(videoId);
  const paths = deps.layout.video(videoId);
  const notes: string[] = [];
  const required = new Set<StageId>();

  const loadedScript = await loadScript(deps, videoId).catch((error: unknown) => {
    notes.push(
      `Script could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  });
  const scriptChanged =
    loadedScript === null ||
    loadedScript.hash !== manifest.script.hash ||
    manifest.stages.script.status !== "completed";
  const scriptApproved =
    loadedScript !== null && manifest.approvals.script?.subjectHash === loadedScript.hash;
  if (scriptChanged) required.add("script");

  const storyboard = await storyboardOrNull(deps, videoId).catch((error: unknown) => {
    notes.push(
      `Storyboard could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  });
  const inSync =
    storyboard !== null &&
    loadedScript !== null &&
    storyboard.scriptHash === loadedScript.hash &&
    manifest.storyboard.hash === hashOf(storyboard.cuts);
  if (!inSync) required.add("storyboard");

  const inspection: Inspection = {
    videoId,
    title: manifest.title,
    script: {
      version: manifest.script.version,
      changedSinceCheck: scriptChanged,
      approved: scriptApproved,
      approvalAutomated: scriptApproved && (manifest.approvals.script?.automated ?? false),
    },
    storyboard: { present: storyboard !== null, inSync, version: manifest.storyboard.version },
    stages: STAGES.map((stage) => {
      const state = manifest.stages[stage.id];
      return {
        id: stage.id,
        title: stage.title,
        status: state.status,
        attempts: state.attempts,
        error: state.error?.message ?? null,
      };
    }),
    narration: [],
    recordings: [],
    scenes: [],
    cuts: [],
    cost: null,
    voice: {
      provider: manifest.voice.provider,
      voiceId: manifest.voice.voiceId,
      modelId: manifest.voice.modelId,
    },
    requiredStages: [],
    nextCommand: null,
    notes,
  };

  if (storyboard && inSync) {
    await inspectAssets(deps, manifest, storyboard, quality, inspection, required);
  } else if (storyboard) {
    notes.push("Asset states are not shown because the storyboard is out of date with the script.");
  }

  inspection.requiredStages = STAGES.map((stage) => stage.id).filter((id) => required.has(id));
  inspection.nextCommand = nextCommand(inspection, paths.root);
  return inspection;
}

async function inspectAssets(
  deps: InspectDeps,
  manifest: Manifest,
  storyboard: Storyboard,
  quality: QualityId,
  inspection: Inspection,
  required: Set<StageId>,
): Promise<void> {
  const paths = deps.layout.video(manifest.id);
  const { notes } = inspection;

  let plan: NarrationPlan | null = null;
  try {
    plan = await planNarration(deps, manifest, storyboard);
    inspection.narration = plan.items.map((item) => ({
      sceneId: item.sceneId,
      characters: item.characters,
      state:
        item.state === "current"
          ? "current"
          : item.state === "cached"
            ? "cached"
            : manifest.assets.narration[item.sceneId]
              ? "stale"
              : "missing",
    }));
    inspection.cost = plan.cost;
    inspection.voice = { provider: plan.provider, voiceId: plan.voiceId, modelId: plan.modelId };
    for (const term of plan.pendingPronunciations)
      notes.push(`Pronunciation of "${term}" is not approved yet.`);
  } catch (error) {
    notes.push(
      `Narration could not be planned: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (plan === null || plan.items.some((item) => item.state !== "current")) required.add("voice");

  for (const scenarioId of requiredScenarioIds(storyboard.cuts)) {
    const scenario = deps.scenarios.find(scenarioId);
    const asset = manifest.assets.recordings[scenarioId];
    let state: AssetState = asset ? "stale" : "missing";
    if (scenario && asset && (await deps.files.exists(paths.absolute(asset.video)))) {
      // Opening the target only computes its fingerprint; nothing is recorded.
      const target = await deps.targets.open(scenario.target).catch(() => null);
      if (target) {
        if (isCurrentCapture(asset.hash, scenario, target.fingerprint)) state = "current";
        await target.close();
      } else {
        notes.push(
          `Recording "${scenarioId}" could not be compared: its target is not configured.`,
        );
        state = "current";
      }
    }
    if (state !== "current") required.add("recording");
    inspection.recordings.push({
      scenarioId,
      state,
      target: scenario?.target ?? "unknown",
      verified: scenario?.status === "verified",
    });
  }

  const upstreamReady = !required.has("voice") && !required.has("recording");
  if (upstreamReady) {
    const context = {
      manifest,
      brand: await loadBrand(deps),
      rendererHash: await deps.renderer.sourceHash(),
      fps: deps.fps,
      reducedMotion: manifest.render.reducedMotion,
      resolutionScale: deps.resolutionScale,
    };
    for (const cut of storyboard.cuts) {
      const compiled = await compileCut(deps, context, cut);
      for (const scene of compiled.scenes) {
        const stored =
          manifest.assets.sceneRenders[sceneRenderKey(cut.id, quality, scene.scene.id)];
        const exists = stored ? await deps.files.exists(paths.absolute(stored.file)) : false;
        const state: AssetState =
          !stored || !exists ? "missing" : stored.hash === scene.hash ? "current" : "stale";
        if (state !== "current") required.add("composition");
        inspection.scenes.push({ cutId: cut.id, sceneId: scene.scene.id, state });
      }
    }
  } else {
    for (const cut of storyboard.cuts) {
      for (const scene of cut.scenes.filter((s) => s.enabled))
        inspection.scenes.push({ cutId: cut.id, sceneId: scene.id, state: "blocked" });
    }
    required.add("composition");
  }
  if (required.has("composition")) {
    required.add("motion");
    required.add("subtitles");
    required.add("render");
  }

  for (const cut of storyboard.cuts) {
    const key = finalKey(cut.id, quality);
    const final = manifest.assets.finals[key];
    const sceneStates = inspection.scenes.filter((scene) => scene.cutId === cut.id);
    const exists = final ? await deps.files.exists(paths.absolute(final.file)) : false;
    const state: AssetState =
      !final || !exists
        ? "missing"
        : sceneStates.every((scene) => scene.state === "current")
          ? "current"
          : "stale";
    const qa = manifest.qa[key];
    const qaState =
      !final || qa?.subjectHash !== final.sha256
        ? "not run"
        : qa.passed
          ? qa.warnings
            ? `passed, ${qa.warnings} warning(s)`
            : "passed"
          : `${qa.failures} failure(s)`;
    const approved = quality === "final" && isFinalApproved(manifest, cut.id);
    if (state !== "current") required.add("render");
    if (state !== "current" || qaState === "not run" || qaState.includes("failure"))
      required.add("qa");
    if (!approved) required.add("approval");
    if (
      !manifest.exports.some((record) => record.cutId === cut.id && record.sha256 === final?.sha256)
    )
      required.add("export");
    inspection.cuts.push({ cutId: cut.id, final: state, qa: qaState, approved });
  }
}

function nextCommand(inspection: Inspection, videoRoot: string): string | null {
  const id = inspection.videoId;
  const first = inspection.requiredStages[0];
  if (first === undefined) return null;
  if (first === "script")
    return `pnpm studio script --video ${id}   (edit ${path.join(videoRoot, "script.md")} first)`;
  if (first === "storyboard") return `pnpm studio storyboard --video ${id}`;
  if (first === "recording") return `pnpm studio record --video ${id}`;
  if (first === "voice") {
    return inspection.script.approved
      ? `pnpm studio narrate --video ${id}`
      : `pnpm studio approve --video ${id} --stage script   (after reviewing script.md)`;
  }
  if (first === "motion" || first === "composition" || first === "subtitles" || first === "render")
    return `pnpm studio render --video ${id}`;
  if ((first === "qa" || first === "approval") && inspection.script.approvalAutomated) {
    // Everything is rendered; what is missing is a person's review of the script.
    return `pnpm studio approve --video ${id} --stage script   (review script.md first: the current approval is automated), then pnpm studio qa --video ${id}`;
  }
  if (first === "qa") return `pnpm studio qa --video ${id}`;
  if (first === "approval")
    return `pnpm studio approve --video ${id} --stage final   (after reviewing the QA report)`;
  return `pnpm studio export --video ${id}`;
}

export interface CostReport {
  plan: NarrationPlan;
  ledger: Manifest["usage"];
  account: SpeechUsage | null;
  voiceConfigurationNote: string;
}

/** What narration will cost next, what this video has cost so far, and what the account has left. */
export async function reportCosts(deps: InspectDeps, videoId: string): Promise<CostReport> {
  const manifest = await deps.manifests.load(videoId);
  const { storyboard } = await requireCurrentStoryboard(deps, videoId);
  const plan = await planNarration(deps, manifest, storyboard);
  const account = await deps.synthesizer(manifest.voice.provider).usage();
  return {
    plan,
    ledger: manifest.usage,
    account,
    voiceConfigurationNote:
      plan.provider === "elevenlabs"
        ? "ElevenLabs bills credits per character; the money figure appears only when ELEVENLABS_USD_PER_1K_CREDITS is set."
        : `The "${plan.provider}" voice is an offline stand-in and costs nothing. It is not the production voice.`,
  };
}
