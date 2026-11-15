import { StudioError, errorMessage } from "../domain/errors";
import {
  invalidateDownstream,
  isStageCurrent,
  withHistory,
  type Manifest,
} from "../domain/manifest";
import { stageDefinition, type StageId } from "../domain/stages";
import type { CoreDeps } from "./context";

export interface StageRun<T> {
  /** True when the stage was already complete for these inputs and no work was done. */
  skipped: boolean;
  result: T | null;
  manifest: Manifest;
}

export interface StageWork<T> {
  manifest: Manifest;
  result: T;
  /**
   * False when the run did only part of the stage (for example one selected scene) and
   * other work remains. Progress is saved but the stage stays pending. Defaults to true.
   */
  complete?: boolean;
}

export interface StageOptions {
  /** Run even when the stage is already complete for the same inputs. */
  force?: boolean;
  /** Stages this one needs; defaults to the stage definition. Pass [] for partial runs. */
  requires?: readonly StageId[];
}

/**
 * Persists progress made inside a stage. Long stages call it after each finished unit of
 * work, so a crash or a failed API call keeps everything completed up to that point.
 */
export type Checkpoint = (manifest: Manifest) => Promise<void>;

/**
 * Runs one pipeline stage with the bookkeeping every stage shares:
 *
 * - skips when the stage already completed against identical inputs (idempotent);
 * - refuses to start when a prerequisite stage has not completed;
 * - records `running` before work begins, so an interrupted run is visible and retried;
 * - records `failed` with the reason on error, leaving earlier checkpoints intact;
 * - marks downstream stages pending when the inputs changed.
 */
export async function runStage<T>(
  deps: Pick<CoreDeps, "manifests" | "clock" | "logger">,
  videoId: string,
  stage: StageId,
  inputHash: string,
  options: StageOptions,
  work: (manifest: Manifest, checkpoint: Checkpoint) => Promise<StageWork<T>>,
): Promise<StageRun<T>> {
  const definition = stageDefinition(stage);
  let manifest = await deps.manifests.load(videoId);

  if (!options.force && isStageCurrent(manifest, stage, inputHash)) {
    deps.logger.debug("Stage is up to date", { stage });
    return { skipped: true, result: null, manifest };
  }

  for (const required of options.requires ?? definition.requires) {
    if (manifest.stages[required].status !== "completed") {
      const blocker = stageDefinition(required);
      throw new StudioError(
        "STAGE_BLOCKED",
        `${definition.title} needs ${blocker.title} to be complete first.`,
        {
          hint: `Run \`pnpm studio ${blocker.command} --video ${videoId}\`.`,
        },
      );
    }
  }

  const previous = manifest.stages[stage];
  const startedAt = deps.clock.now().toISOString();
  const inputsChanged = previous.inputHash !== null && previous.inputHash !== inputHash;
  if (inputsChanged) manifest = invalidateDownstream(manifest, stage);
  manifest = {
    ...manifest,
    stages: {
      ...manifest.stages,
      [stage]: {
        ...previous,
        status: "running",
        attempts: previous.attempts + 1,
        startedAt,
        error: null,
      },
    },
  };
  await deps.manifests.save(manifest);

  let latest = manifest;
  const checkpoint: Checkpoint = async (next) => {
    latest = next;
    await deps.manifests.save(next);
  };

  try {
    const done = await work(manifest, checkpoint);
    const completedAt = deps.clock.now().toISOString();
    const completed = withHistory(
      {
        ...done.manifest,
        stages: {
          ...done.manifest.stages,
          [stage]:
            done.complete === false
              ? { ...done.manifest.stages[stage], status: "pending", error: null }
              : {
                  ...done.manifest.stages[stage],
                  status: "completed",
                  inputHash,
                  completedAt,
                  error: null,
                },
        },
      },
      {
        at: completedAt,
        stage,
        event: done.complete === false ? "partially completed" : "completed",
        detail: "",
      },
    );
    await deps.manifests.save(completed);
    return { skipped: false, result: done.result, manifest: completed };
  } catch (error) {
    const failedAt = deps.clock.now().toISOString();
    const code = error instanceof StudioError ? error.code : "UNEXPECTED";
    const message = errorMessage(error);
    await deps.manifests.save(
      withHistory(
        {
          ...latest,
          stages: {
            ...latest.stages,
            [stage]: { ...latest.stages[stage], status: "failed", error: { code, message } },
          },
        },
        { at: failedAt, stage, event: "failed", detail: message.slice(0, 300) },
      ),
    );
    throw error;
  }
}
