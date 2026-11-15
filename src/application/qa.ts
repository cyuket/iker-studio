import path from "node:path";
import { StudioError } from "../domain/errors";
import { QUALITIES, outputDimensions, type QualityId } from "../domain/formats";
import { hashOf } from "../domain/hash";
import { finalKey, type Manifest } from "../domain/manifest";
import { evaluateQa, summariseQa, type QaCheck, type QaSummary } from "../domain/qa";
import { findPersonalData, findSecretPatterns } from "../domain/redaction";
import { enabledScenes, type Cut } from "../domain/storyboard";
import { termsUsedIn } from "../domain/voice";
import {
  loadBrand,
  loadPronunciations,
  loadScript,
  loadStoryboard,
  type CoreDeps,
} from "./context";
import { runStage } from "./pipeline";
import type { MediaTools } from "./ports";
import { renderQaReport } from "./qa-report";
import { compileCut } from "./scene-compiler";
import { loadVoiceDirection } from "./voice-direction";

export interface QaDeps extends CoreDeps {
  media: MediaTools;
  /** Secret values held by this process, to detect them leaking into artefacts. */
  secretValues(): string[];
  resolutionScale: number;
  fps: number | null;
}

export interface QaInput {
  videoId: string;
  cutIds?: readonly string[];
  quality: QualityId;
}

export interface QaOutcome {
  cutId: string;
  summary: QaSummary;
  checks: QaCheck[];
  report: string;
  contactSheet: string;
}

/** Text artefacts a viewer or a repository reader could see. */
async function scanText(
  deps: QaDeps,
  videoId: string,
  cut: Cut,
  manifest: Manifest,
): Promise<{ secrets: string[]; personalData: string[] }> {
  const paths = deps.layout.video(videoId);
  const files = [
    paths.script,
    paths.storyboard,
    path.join(paths.subtitles, `${cut.id}.srt`),
    path.join(paths.metadata, "metadata.md"),
    ...Object.values(manifest.assets.recordings).map((recording) =>
      paths.absolute(recording.timeline),
    ),
  ];
  const held = deps.secretValues().filter((value) => value.length >= 6);
  const secrets: string[] = [];
  const personalData: string[] = [];
  for (const file of files) {
    const text = await deps.files.readText(file);
    if (text === null) continue;
    const name = paths.relative(file);
    for (const finding of findSecretPatterns(text))
      secrets.push(`${finding.name} pattern in ${name}`);
    if (held.some((value) => text.includes(value)))
      secrets.push(`a configured secret value appears in ${name}`);
    for (const finding of findPersonalData(text))
      personalData.push(`${finding.name} ${finding.excerpt} in ${name}`);
  }
  return { secrets: [...new Set(secrets)], personalData: [...new Set(personalData)] };
}

async function findMissing(
  deps: QaDeps,
  videoId: string,
  cut: Cut,
  manifest: Manifest,
): Promise<string[]> {
  const paths = deps.layout.video(videoId);
  const wanted: string[] = [];
  for (const scene of enabledScenes(cut)) {
    const narration = manifest.assets.narration[scene.id];
    if (scene.narration.trim()) wanted.push(narration?.file ?? `audio for scene ${scene.id}`);
    if (scene.visual.kind === "product") {
      const recording = manifest.assets.recordings[scene.visual.scenarioId];
      wanted.push(recording?.video ?? `recording ${scene.visual.scenarioId}`);
      if (recording) wanted.push(...Object.values(recording.screenshots));
    }
    wanted.push(...scene.assets);
  }
  const missing: string[] = [];
  for (const relative of new Set(wanted)) {
    if (!(await deps.files.exists(paths.absolute(relative)))) missing.push(relative);
  }
  return missing;
}

async function checkCut(
  deps: QaDeps,
  manifest: Manifest,
  cut: Cut,
  quality: QualityId,
): Promise<QaOutcome & { subjectHash: string }> {
  const videoId = manifest.id;
  const paths = deps.layout.video(videoId);
  const final = manifest.assets.finals[finalKey(cut.id, quality)];
  const file = final ? paths.absolute(final.file) : null;
  if (!final || !file || !(await deps.files.exists(file))) {
    throw new StudioError("STAGE_BLOCKED", `Cut "${cut.id}" has no ${quality} render to check.`, {
      hint: `Run \`pnpm studio ${quality === "final" ? "render" : "preview"} --video ${videoId} --cut ${cut.id}\`.`,
    });
  }

  const brand = await loadBrand(deps);
  const { script, hash: scriptHash } = await loadScript(deps, videoId);
  const storyboard = await loadStoryboard(deps, videoId);
  const compiled = await compileCut(
    deps,
    // The renderer hash only feeds scene hashes, which QA does not use.
    {
      manifest,
      brand,
      rendererHash: "",
      fps: deps.fps,
      reducedMotion: manifest.render.reducedMotion,
      resolutionScale: deps.resolutionScale,
    },
    cut,
  );
  const scale =
    quality === "final" ? QUALITIES.final.scale * deps.resolutionScale : QUALITIES.preview.scale;
  const expected = outputDimensions(compiled.format, { ...QUALITIES[quality], scale });

  const media = await deps.media.probe(file);
  const scenes = enabledScenes(cut);
  const scenarioIds = [
    ...new Set(scenes.flatMap((s) => (s.visual.kind === "product" ? [s.visual.scenarioId] : []))),
  ];
  const recordings = [];
  for (const scenarioId of scenarioIds) {
    const asset = manifest.assets.recordings[scenarioId];
    if (!asset) continue;
    const info = await deps.media.probe(paths.absolute(asset.video)).catch(() => null);
    recordings.push({
      scenarioId,
      target: asset.target,
      readable: info?.video !== null && info !== null,
      durationSeconds: info?.durationSeconds ?? 0,
      verified: asset.verified,
    });
  }
  const narrationAssets = scenes.flatMap((s) =>
    manifest.assets.narration[s.id] ? [manifest.assets.narration[s.id]] : [],
  );
  const pronunciations = await loadPronunciations(deps);
  const pending = new Set<string>();
  for (const scene of scenes) {
    for (const entry of termsUsedIn(scene.narration, pronunciations))
      if (entry.status === "pending") pending.add(entry.term);
  }
  const loudness = media.audio ? await deps.media.measureLoudness(file) : null;
  // A direction is in force only once a performance has been selected.
  const preset = manifest.voice.preset;
  const direction = preset === null ? null : await loadVoiceDirection(deps, videoId);
  const chosen = manifest.voiceSelection;

  const checks = evaluateQa({
    cut,
    format: compiled.format,
    expected,
    media,
    timeline: compiled.timeline,
    cues: compiled.cues,
    missingAssets: await findMissing(deps, videoId, cut, manifest),
    blackIntervals: await deps.media.detectBlackFrames(file),
    silenceIntervals: await deps.media.detectSilence(file, 1),
    loudness,
    recordings,
    scriptApproved: manifest.approvals.script?.subjectHash === scriptHash,
    scriptApprovalAutomated: manifest.approvals.script?.automated ?? false,
    storyboardInSync:
      storyboard.scriptHash === scriptHash && manifest.storyboard.hash === hashOf(storyboard.cuts),
    voiceProvider: manifest.voice.provider,
    estimatedTiming: narrationAssets.some((asset) => asset?.timing === "estimated"),
    pendingPronunciations: [...pending].sort(),
    voicePerformance: {
      preset,
      selected: chosen?.preset === preset && chosen.voiceId === manifest.voice.voiceId,
      spokenWording: direction !== null,
      directionApproved:
        direction !== null && manifest.approvals.script?.voiceDirectionHash === direction.hash,
    },
    brand: {
      hasLogo: brand.logoFiles.wordmark !== null || brand.logoFiles.mark !== null,
      placeholders: brand.brand.placeholders,
    },
    sensitive: await scanText(deps, videoId, cut, manifest),
  });
  const summary = summariseQa(checks);

  // One frame per scene, with the safe area outlined for the manual check.
  const qaDir = path.join(paths.qa, `${cut.id}-${quality}`);
  await deps.files.remove(qaDir);
  const ratio = (media.video?.width ?? compiled.format.width) / compiled.format.width;
  const safe = compiled.format.safeArea;
  const outline = {
    x: Math.round(safe.left * ratio),
    y: Math.round(safe.top * ratio),
    width: Math.round((compiled.format.width - safe.left - safe.right) * ratio),
    height: Math.round((compiled.format.height - safe.top - safe.bottom) * ratio),
  };
  const portrait = compiled.format.orientation === "portrait";
  const frames: { sceneId: string; file: string }[] = [];
  for (const [index, timing] of compiled.timeline.scenes.entries()) {
    const output = path.join(
      qaDir,
      "frames",
      `${String(index + 1).padStart(2, "0")}-${timing.sceneId}.png`,
    );
    // 60% through: entrance animation is over and the scene shows its full content.
    const atSeconds = (timing.startFrame + timing.durationFrames * 0.6) / compiled.timeline.fps;
    await deps.media.extractFrame({
      file,
      atSeconds,
      output,
      width: portrait ? 360 : 640,
      outline,
    });
    frames.push({ sceneId: timing.sceneId, file: output });
  }
  const contactSheet = path.join(qaDir, "contact-sheet.png");
  await deps.media.contactSheet(
    frames.map((frame) => frame.file),
    contactSheet,
    portrait ? 5 : 3,
  );

  const report = path.join(qaDir, "report.html");
  const relativeTo = (target: string): string =>
    path.relative(qaDir, target).split(path.sep).join("/");
  await deps.files.writeText(
    report,
    renderQaReport({
      manifest,
      script,
      cutId: cut.id,
      quality,
      format: compiled.format,
      media,
      sizeBytes: media.sizeBytes,
      sha256: final.sha256,
      loudness,
      timeline: compiled.timeline,
      scenes,
      checks,
      summary,
      generatedAt: deps.clock.now().toISOString(),
      videoHref: relativeTo(file),
      contactSheetHref: relativeTo(contactSheet),
      frames: frames.map((frame) => ({ sceneId: frame.sceneId, href: relativeTo(frame.file) })),
      thumbnails: manifest.assets.thumbnails.map((t) => ({
        variant: t.variant,
        href: relativeTo(paths.absolute(t.file)),
      })),
      voice: {
        provider: manifest.voice.provider,
        voiceId: manifest.voice.voiceId ?? "environment default",
        modelId: manifest.voice.modelId ?? "environment default",
      },
    }),
  );
  await deps.files.writeJson(path.join(qaDir, "report.json"), {
    videoId,
    cutId: cut.id,
    quality,
    summary,
    checks,
  });
  return { cutId: cut.id, summary, checks, report, contactSheet, subjectHash: final.sha256 };
}

/** Runs automated checks on rendered cuts and writes a review report for each. */
export async function runQa(deps: QaDeps, input: QaInput): Promise<QaOutcome[]> {
  const loaded = await deps.manifests.load(input.videoId);
  const storyboard = await loadStoryboard(deps, input.videoId);
  const cuts = input.cutIds
    ? input.cutIds.map((id) => {
        const cut = storyboard.cuts.find((c) => c.id === id);
        if (!cut) throw new StudioError("NOT_FOUND", `There is no cut "${id}".`);
        return cut;
      })
    : storyboard.cuts;
  const paths = deps.layout.video(input.videoId);
  const outcomes: QaOutcome[] = [];
  for (const cut of cuts) {
    if (!loaded.assets.finals[finalKey(cut.id, input.quality)]) {
      throw new StudioError(
        "STAGE_BLOCKED",
        `Cut "${cut.id}" has no ${input.quality} render to check.`,
        {
          hint: `Run \`pnpm studio ${input.quality === "final" ? "render" : "preview"} --video ${input.videoId} --cut ${cut.id}\`.`,
        },
      );
    }
  }

  const subject = cuts.map(
    (cut) => loaded.assets.finals[finalKey(cut.id, input.quality)]?.sha256 ?? null,
  );
  await runStage(
    deps,
    input.videoId,
    "qa",
    hashOf({ subject, quality: input.quality }),
    { force: true, requires: [] },
    async (start, checkpoint) => {
      let manifest = start;
      for (const cut of cuts) {
        const { subjectHash, ...outcome } = await checkCut(deps, manifest, cut, input.quality);
        outcomes.push(outcome);
        manifest = {
          ...manifest,
          qa: {
            ...manifest.qa,
            [finalKey(cut.id, input.quality)]: {
              subjectHash,
              passed: outcome.summary.passed,
              failures: outcome.summary.failures,
              warnings: outcome.summary.warnings,
              report: paths.relative(outcome.report),
              checkedAt: deps.clock.now().toISOString(),
            },
          },
        };
        await checkpoint(manifest);
      }
      const everyCutChecked = storyboard.cuts.every((cut) => {
        const key = finalKey(cut.id, "final");
        return (
          manifest.qa[key]?.subjectHash === manifest.assets.finals[key]?.sha256 &&
          manifest.qa[key]?.passed === true
        );
      });
      return { manifest, result: null, complete: everyCutChecked };
    },
  );
  return outcomes;
}
