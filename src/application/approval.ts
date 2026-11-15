import { StudioError } from "../domain/errors";
import { QUALITIES } from "../domain/formats";
import { hashOf } from "../domain/hash";
import { finalKey, withHistory, type Approval, type Manifest } from "../domain/manifest";
import { loadScript, type CoreDeps } from "./context";
import { runStage } from "./pipeline";
import { checkVoiceDirection, requireAcceptedDirection } from "./voice-direction";

export interface ApprovalInput {
  videoId: string;
  approvedBy: string;
  note: string;
  /** Marks the approval as made by automation to exercise the pipeline, not by a reviewer. */
  automated?: boolean;
}

/**
 * Records that a named person approved the script exactly as it is now. Narration is
 * generated only from an approved script, and any later edit voids the approval because
 * the approval is bound to the script's hash.
 *
 * When the video has a voice direction file, the approval covers it too: the words that
 * will actually be spoken and how they are directed. Its hash is stored beside the script
 * hash, so editing either one voids the approval. Direction with errors cannot be approved.
 */
export async function approveScript(deps: CoreDeps, input: ApprovalInput): Promise<Approval> {
  const manifest = await deps.manifests.load(input.videoId);
  const { hash } = await loadScript(deps, input.videoId);
  if (manifest.stages.script.status !== "completed" || manifest.script.hash !== hash) {
    throw new StudioError(
      "STAGE_BLOCKED",
      "The script must pass its checks before it can be approved.",
      {
        hint: `Run \`pnpm studio script --video ${input.videoId}\` and fix any errors.`,
      },
    );
  }
  const direction = await checkVoiceDirection(deps, input.videoId);
  if (direction) requireAcceptedDirection(direction, input.videoId);
  const at = deps.clock.now().toISOString();
  const approval: Approval = {
    subjectHash: hash,
    voiceDirectionHash: direction?.hash ?? null,
    approvedBy: input.approvedBy,
    approvedAt: at,
    note: input.note,
    automated: input.automated ?? false,
  };
  await deps.manifests.save(
    withHistory(
      { ...manifest, approvals: { ...manifest.approvals, script: approval } },
      {
        at,
        stage: "script",
        event: approval.automated ? "approved by automation" : "approved",
        detail: `by ${input.approvedBy}`,
      },
    ),
  );
  return approval;
}

export interface FinalApprovalInput extends ApprovalInput {
  cutIds: readonly string[];
  /** Confirms the approver read the QA warnings and accepts them. */
  acknowledgeWarnings: boolean;
}

/**
 * Approves final-quality renders for release. Each approval is bound to the SHA-256 of the
 * rendered file, so re-rendering a cut always requires a new review.
 */
export async function approveFinal(deps: CoreDeps, input: FinalApprovalInput): Promise<Manifest> {
  let manifest = await deps.manifests.load(input.videoId);
  if (manifest.approvals.script?.automated !== false) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      "The script has not been approved by a person, so nothing built from it can be released.",
      {
        hint: `Review script.md, then run \`pnpm studio approve --video ${input.videoId} --stage script\`.`,
      },
    );
  }
  const at = deps.clock.now().toISOString();
  const approved: Record<string, Approval> = { ...manifest.approvals.final };

  for (const cutId of input.cutIds) {
    const key = finalKey(cutId, QUALITIES.final.id);
    const final = manifest.assets.finals[key];
    if (!final) {
      throw new StudioError("STAGE_BLOCKED", `Cut "${cutId}" has no final-quality render.`, {
        hint: `Run \`pnpm studio render --video ${input.videoId} --cut ${cutId}\`.`,
      });
    }
    const qa = manifest.qa[key];
    if (qa?.subjectHash !== final.sha256) {
      throw new StudioError(
        "APPROVAL_REQUIRED",
        `Cut "${cutId}" has not been through QA since it was rendered.`,
        {
          hint: `Run \`pnpm studio qa --video ${input.videoId} --cut ${cutId}\` and read the report.`,
        },
      );
    }
    if (!qa.passed) {
      throw new StudioError(
        "APPROVAL_REQUIRED",
        `Cut "${cutId}" has ${qa.failures} failing QA check(s).`,
        {
          hint: `Fix them, then re-run QA. Report: ${qa.report}`,
        },
      );
    }
    if (qa.warnings > 0 && !input.acknowledgeWarnings) {
      throw new StudioError(
        "APPROVAL_REQUIRED",
        `Cut "${cutId}" has ${qa.warnings} QA warning(s).`,
        {
          hint: `Read ${qa.report}, then approve with --acknowledge-warnings if they are acceptable.`,
        },
      );
    }
    approved[cutId] = {
      subjectHash: final.sha256,
      approvedBy: input.approvedBy,
      approvedAt: at,
      note: input.note,
      // Releasing a video is always a person's decision; there is no automated form.
      automated: false,
    };
  }

  // QA is checked per cut above, against the exact file, so the coarse stage flag is not used.
  const run = await runStage(
    deps,
    input.videoId,
    "approval",
    hashOf(approved),
    { force: true, requires: [] },
    (current) => {
      const next = { ...current, approvals: { ...current.approvals, final: approved } };
      const finalCuts = Object.keys(next.assets.finals)
        .filter((key) => key.endsWith(`/${QUALITIES.final.id}`))
        .map((key) => key.slice(0, key.lastIndexOf("/")));
      return Promise.resolve({
        manifest: next,
        result: null,
        complete: finalCuts.every((cutId) => isFinalApproved(next, cutId)),
      });
    },
  );
  manifest = run.manifest;
  return manifest;
}

/** True when the cut's current final render is the one that was approved. */
export function isFinalApproved(manifest: Manifest, cutId: string): boolean {
  const final = manifest.assets.finals[finalKey(cutId, QUALITIES.final.id)];
  return final !== undefined && manifest.approvals.final[cutId]?.subjectHash === final.sha256;
}
