import path from "node:path";
import { StudioError } from "../domain/errors";
import { hashOf } from "../domain/hash";
import type { Manifest, RecordingAsset } from "../domain/manifest";
import type { Scenario } from "../domain/recording";
import { requiredScenarioIds } from "../domain/storyboard";
import { requireCurrentStoryboard } from "./authoring";
import type { CoreDeps } from "./context";
import { runStage } from "./pipeline";
import type { DemoTargets, MediaTools, Recorder, ScenarioCatalog } from "./ports";

export interface RecordingDeps extends CoreDeps {
  media: MediaTools;
  recorder: Recorder;
  scenarios: ScenarioCatalog;
  targets: DemoTargets;
}

/** Bump when the recorder's output changes in a way that requires existing captures to be redone. */
const RECORDER_VERSION = 1;
/** Frame rate recordings are conformed to; matches every output format. */
const RECORDING_FPS = 30;

export interface RecordInput {
  videoId: string;
  scenarioIds?: readonly string[];
  /** Record again even when an up-to-date capture exists (a retake). */
  force: boolean;
  headless: boolean;
  /** Treat captures already on file as current instead of recording them again. */
  keepCaptures?: boolean;
}

export interface RecordOutcome {
  recorded: string[];
  alreadyCurrent: string[];
  unverified: string[];
}

/**
 * Identity of a capture: what was done on screen and where. A scenario's `status` and
 * `evidence` describe how far it has been checked, not what it records, so marking a scenario
 * verified after a green take must not make that take stale.
 */
export function recordingHash(scenario: Scenario, fingerprint: string): string {
  const capture: Record<string, unknown> = { ...scenario };
  delete capture.status;
  delete capture.evidence;
  return hashOf({
    version: RECORDER_VERSION + 1,
    scenario: capture,
    fingerprint,
    fps: RECORDING_FPS,
  });
}

/** The hash captures carried before status and evidence were left out of it. */
function legacyRecordingHash(scenario: Scenario, fingerprint: string): string {
  return hashOf({ version: RECORDER_VERSION, scenario, fingerprint, fps: RECORDING_FPS });
}

/** Whether a stored capture is the one this scenario would produce on this target. */
export function isCurrentCapture(
  stored: string | undefined,
  scenario: Scenario,
  fingerprint: string,
): boolean {
  return (
    stored !== undefined &&
    (stored === recordingHash(scenario, fingerprint) ||
      stored === legacyRecordingHash(scenario, fingerprint))
  );
}

function resolveScenarios(deps: RecordingDeps, ids: readonly string[]): Scenario[] {
  return ids.map((id) => {
    const scenario = deps.scenarios.find(id);
    if (!scenario) {
      throw new StudioError("NOT_FOUND", `The storyboard refers to an unknown scenario "${id}".`, {
        hint: `Known scenarios: ${deps.scenarios
          .all()
          .map((s) => s.id)
          .join(", ")}`,
      });
    }
    return scenario;
  });
}

/**
 * Records the product flows the storyboard needs. Each scenario is captured once and
 * reused until the scenario or its target changes, so changing one interaction re-records
 * one scene.
 */
export async function record(deps: RecordingDeps, input: RecordInput): Promise<RecordOutcome> {
  const { storyboard } = await requireCurrentStoryboard(deps, input.videoId);
  const required = requiredScenarioIds(storyboard.cuts);
  const selected = input.scenarioIds ?? required;
  const unknown = selected.filter((id) => !required.includes(id));
  if (unknown.length) {
    throw new StudioError("VALIDATION_FAILED", `No enabled scene uses: ${unknown.join(", ")}.`, {
      hint: `Scenarios in this storyboard: ${required.join(", ") || "none"}`,
    });
  }
  const scenarios = resolveScenarios(deps, selected);
  const paths = deps.layout.video(input.videoId);
  const outcome: RecordOutcome = { recorded: [], alreadyCurrent: [], unverified: [] };

  const partial = input.scenarioIds !== undefined;
  await runStage(
    deps,
    input.videoId,
    "recording",
    hashOf({ required, scenarios: scenarios.map((s) => hashOf(s)) }),
    // Always enter: whether a capture is current depends on files and target state.
    { force: true },
    async (start, checkpoint) => {
      let manifest: Manifest = start;
      for (const target of ["synthetic", "iker"] as const) {
        const group = scenarios.filter((scenario) => scenario.target === target);
        if (group.length === 0) continue;
        const opened = await deps.targets.open(target);
        try {
          for (const scenario of group) {
            const hash = recordingHash(scenario, opened.fingerprint);
            const existing = manifest.assets.recordings[scenario.id];
            const filed =
              existing !== undefined && (await deps.files.exists(paths.absolute(existing.video)));
            // `keep` accepts a capture whose scenario text changed without changing what it
            // records, for takes that cannot be repeated (they published what they built).
            const current =
              filed &&
              (input.keepCaptures === true ||
                isCurrentCapture(existing.hash, scenario, opened.fingerprint));
            const verified = scenario.status === "verified";
            // The capture stands; only what is known about it (its hash form, whether the
            // scenario has since been verified) is brought up to date.
            if (
              current &&
              !input.force &&
              (existing.hash !== hash || existing.verified !== verified)
            ) {
              manifest = {
                ...manifest,
                assets: {
                  ...manifest.assets,
                  recordings: {
                    ...manifest.assets.recordings,
                    [scenario.id]: {
                      ...existing,
                      hash,
                      verified,
                    },
                  },
                },
              };
              await checkpoint(manifest);
            }
            if (current && !input.force) {
              outcome.alreadyCurrent.push(scenario.id);
              continue;
            }
            const dir = path.join(paths.recordings, scenario.id);
            // A take can fail, and some takes cannot be repeated. The capture on file is set
            // aside until the new one is safely in, and put back if it is not.
            const previous = `${dir}.previous`;
            const hadCapture = await deps.files.exists(dir);
            await deps.files.remove(previous);
            if (hadCapture) await deps.files.copy(dir, previous);
            await deps.files.remove(dir);
            deps.logger.info("Recording scenario", { scenario: scenario.id, target });
            const video = path.join(dir, "recording.mp4");
            let result: Awaited<ReturnType<Recorder["record"]>>;
            let info: Awaited<ReturnType<MediaTools["probe"]>>;
            try {
              result = await deps.recorder.record({
                scenario,
                baseUrl: opened.baseUrl,
                credentials: opened.credentials,
                session: opened.session,
                expect: opened.expect,
                outputDir: dir,
                headless: input.headless,
              });
              await deps.media.transcodeRecording(result.videoFile, video, RECORDING_FPS);
              await deps.files.remove(result.videoFile);
              info = await deps.media.probe(video);
              if (!info.video || info.durationSeconds < 1) {
                throw new StudioError(
                  "RECORDING_FAILED",
                  `The capture of "${scenario.id}" is empty or unreadable.`,
                );
              }
            } catch (error) {
              if (hadCapture) {
                // Keep what the failed take left behind for diagnosis, beside the capture.
                await deps.files.remove(`${dir}.failed`);
                await deps.files.copy(dir, `${dir}.failed`).catch(() => undefined);
                await deps.files.remove(dir);
                await deps.files.copy(previous, dir);
                await deps.files.remove(previous);
              }
              throw error;
            }
            await deps.files.remove(previous);
            const timelineFile = path.join(dir, "timeline.json");
            await deps.files.writeJson(timelineFile, result.timeline);
            const asset: RecordingAsset = {
              hash,
              target,
              displayHost: opened.displayHost,
              verified: scenario.status === "verified",
              video: paths.relative(video),
              timeline: paths.relative(timelineFile),
              screenshots: Object.fromEntries(
                Object.entries(result.screenshots).map(([name, file]) => [
                  name,
                  paths.relative(file),
                ]),
              ),
              durationSeconds: info.durationSeconds,
              viewport: scenario.viewport,
              recordedAt: deps.clock.now().toISOString(),
            };
            manifest = {
              ...manifest,
              assets: {
                ...manifest.assets,
                recordings: { ...manifest.assets.recordings, [scenario.id]: asset },
              },
            };
            await checkpoint(manifest);
            outcome.recorded.push(scenario.id);
            if (scenario.status === "unverified") outcome.unverified.push(scenario.id);
          }
        } finally {
          await opened.close();
        }
      }
      const complete = required.every((id) => manifest.assets.recordings[id] !== undefined);
      if (partial) return { manifest, result: null, complete };
      const recordings = Object.fromEntries(
        Object.entries(manifest.assets.recordings).filter(([id]) => required.includes(id)),
      );
      return {
        manifest: { ...manifest, assets: { ...manifest.assets, recordings } },
        result: null,
        complete,
      };
    },
  );
  return outcome;
}

export interface ReuseOutcome {
  reused: string[];
  missing: string[];
}

/**
 * Takes the captures another video already has for the scenarios this storyboard needs.
 * The footage is the same scenario recorded once; nothing is recorded and the product is
 * not opened, so a second video about the same flow leaves no new test data behind.
 */
export async function reuseRecordings(
  deps: RecordingDeps,
  input: { videoId: string; fromVideoId: string },
): Promise<ReuseOutcome> {
  const { storyboard } = await requireCurrentStoryboard(deps, input.videoId);
  const required = requiredScenarioIds(storyboard.cuts);
  const scenarios = resolveScenarios(deps, required);
  const source = await deps.manifests.load(input.fromVideoId);
  const from = deps.layout.video(input.fromVideoId);
  const paths = deps.layout.video(input.videoId);
  const outcome: ReuseOutcome = { reused: [], missing: [] };

  await runStage(
    deps,
    input.videoId,
    "recording",
    hashOf({ required, scenarios: scenarios.map((s) => hashOf(s)) }),
    { force: true },
    async (start, checkpoint) => {
      let manifest: Manifest = start;
      for (const scenario of scenarios) {
        const asset = source.assets.recordings[scenario.id];
        if (!asset || !(await deps.files.exists(from.absolute(asset.video)))) {
          outcome.missing.push(scenario.id);
          continue;
        }
        const dir = path.join(paths.recordings, scenario.id);
        await deps.files.remove(dir);
        // Assets are stored relative to their video, so the same paths hold in the copy.
        for (const file of [asset.video, asset.timeline, ...Object.values(asset.screenshots)]) {
          await deps.files.copy(from.absolute(file), paths.absolute(file));
        }
        manifest = {
          ...manifest,
          assets: {
            ...manifest.assets,
            recordings: { ...manifest.assets.recordings, [scenario.id]: asset },
          },
        };
        await checkpoint(manifest);
        outcome.reused.push(scenario.id);
      }
      return { manifest, result: null, complete: outcome.missing.length === 0 };
    },
  );
  return outcome;
}
