import path from "node:path";
import { z } from "zod";
import { StudioError } from "../domain/errors";
import type { LintIssue, Script } from "../domain/script";
import {
  isInlinePause,
  scaffoldDirection,
  validateDirection,
  voiceDirectionHash,
  VoiceDirectionSchema,
  type VoiceDirection,
} from "../domain/voice-direction";
import { capabilitiesFor } from "../domain/voice-models";
import { renderPerformance } from "../domain/voice-performance";
import {
  effectiveSettings,
  presetById,
  presetLevers,
  type PresetId,
} from "../domain/voice-presets";
import { lintSpoken } from "../domain/voice-spoken";
import { loadResearch, loadScript, type CoreDeps } from "./context";
import { html, page, raw } from "./html";
import type { Workspace } from "./layout";

/** The one hand-authored voice file of a video. It sits beside script.md. */
export function voiceDirectionFile(layout: Workspace, videoId: string): string {
  return path.join(layout.video(videoId).root, "voice-direction.json");
}

/** Where voice reports and audition comparisons are written. */
export function voiceReviewDir(layout: Workspace, videoId: string): string {
  return path.join(layout.video(videoId).root, "review", "voice");
}

export interface LoadedDirection {
  direction: VoiceDirection;
  /** What an approval is bound to: every spoken word and every direction. */
  hash: string;
}

/** The video's voice direction, or null when it has none and is spoken as scripted. */
export async function loadVoiceDirection(
  deps: Pick<CoreDeps, "layout" | "files">,
  videoId: string,
): Promise<LoadedDirection | null> {
  const file = voiceDirectionFile(deps.layout, videoId);
  if (!(await deps.files.exists(file))) return null;
  const parsed = VoiceDirectionSchema.safeParse(await deps.files.readJson(file));
  if (!parsed.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `voice-direction.json is invalid: ${z.prettifyError(parsed.error)}`,
      {
        hint: `Fix the file, or redraft it with \`pnpm studio voice direct --video ${videoId} --force\`.`,
      },
    );
  }
  return { direction: parsed.data, hash: voiceDirectionHash(parsed.data) };
}

export interface DirectionCheck extends LoadedDirection {
  issues: LintIssue[];
  /** False when an error would let unapproved or broken wording reach the speech model. */
  accepted: boolean;
}

function sceneIds(script: Script): string[] {
  return script.cuts.flatMap((cut) =>
    cut.scenes.filter((scene) => scene.narration.trim()).map((scene) => scene.id),
  );
}

/** Validates the direction's structure and lints its spoken wording against the script. */
export async function checkVoiceDirection(
  deps: CoreDeps,
  videoId: string,
): Promise<DirectionCheck | null> {
  const loaded = await loadVoiceDirection(deps, videoId);
  if (loaded === null) return null;
  const { script } = await loadScript(deps, videoId);
  const facts = await loadResearch(deps, videoId);
  const issues: LintIssue[] = [
    ...validateDirection(loaded.direction, sceneIds(script)),
    ...lintSpoken(script, loaded.direction, new Set(facts.map((fact) => fact.id))),
  ];
  return { ...loaded, issues, accepted: !issues.some((issue) => issue.severity === "error") };
}

/**
 * Refuses to continue while the direction has errors. Used by every path that would speak
 * or approve the wording.
 */
export function requireAcceptedDirection(check: DirectionCheck, videoId: string): void {
  const errors = check.issues.filter((issue) => issue.severity === "error");
  if (errors.length === 0) return;
  throw new StudioError(
    "VALIDATION_FAILED",
    `voice-direction.json has ${errors.length} error(s):\n- ${errors
      .map((issue) => `${issue.sceneId ?? "file"}: ${issue.message}`)
      .join("\n- ")}`,
    { hint: `Fix them, then run \`pnpm studio voice report --video ${videoId}\`.` },
  );
}

export interface ScaffoldInput {
  videoId: string;
  author: string;
  /** Replace an existing direction file. Its hand edits are lost. */
  force: boolean;
}

/** Drafts voice-direction.json from the script. A director then rewrites it. */
export async function scaffoldVoiceDirection(
  deps: CoreDeps,
  input: ScaffoldInput,
): Promise<{ file: string; scenes: number }> {
  const file = voiceDirectionFile(deps.layout, input.videoId);
  if (!input.force && (await deps.files.exists(file))) {
    throw new StudioError("VALIDATION_FAILED", "This video already has a voice-direction.json.", {
      hint: "Edit it by hand. `--force` replaces it with a fresh draft and discards the edits.",
    });
  }
  const { script } = await loadScript(deps, input.videoId);
  const direction = scaffoldDirection(
    input.videoId,
    script.cuts.map((cut) => cut.scenes),
    input.author,
  );
  await deps.files.writeJson(file, direction);
  return { file, scenes: Object.keys(direction.scenes).length };
}

export interface DirectionReportScene {
  sceneId: string;
  cutId: string;
  script: string;
  spoken: string;
  directed: boolean;
  intent: string;
  delivery: string;
  emphasis: string[];
  /** The exact text that would be sent to the model for this preset. */
  sent: string;
  pauses: { kind: string; where: string; targetSeconds: number; how: string; why: string }[];
  composition: { leadInSeconds: number; tailSeconds: number };
  notes: string[];
  issues: LintIssue[];
}

export interface DirectionReport {
  videoId: string;
  presetId: PresetId;
  modelId: string;
  directionHash: string;
  levers: string[];
  settings: ReturnType<typeof effectiveSettings>;
  scenes: DirectionReportScene[];
  fileIssues: LintIssue[];
  files: { markdown: string; html: string; composition: string };
}

const HOW: Record<string, string> = {
  punctuation: "left to punctuation",
  paragraph: "paragraph break",
  tag: "pause tag",
  "ssml-break": "SSML break",
};

function buildScenes(
  script: Script,
  check: DirectionCheck,
  presetId: PresetId,
  modelId: string,
): DirectionReportScene[] {
  const { direction } = check;
  const preset = presetById(presetId);
  const capabilities = capabilitiesFor(modelId);
  return script.cuts.flatMap((cut) =>
    cut.scenes
      .filter((scene) => scene.narration.trim())
      .map((scene): DirectionReportScene => {
        const directed = direction.scenes[scene.id] ?? null;
        const rendered = renderPerformance({
          spoken: directed?.spoken ?? scene.narration,
          direction: directed,
          preset,
          capabilities,
          pauseSeconds: direction.pauseSeconds,
        });
        const edges = (directed?.pauses ?? [])
          .filter((pause) => !isInlinePause(pause.kind))
          .map((pause) => ({
            kind: pause.kind,
            where: pause.at === "start" ? "before the scene" : "after the scene",
            targetSeconds: direction.pauseSeconds[pause.kind],
            how: "silence at composition",
            why: pause.why,
          }));
        const inline = rendered.pauses.map((pause) => ({
          kind: pause.kind,
          where: `after "${pause.after}"`,
          targetSeconds: pause.targetSeconds,
          how: HOW[pause.rendering] ?? pause.rendering,
          why: directed?.pauses.find((p) => p.after === pause.after)?.why ?? "",
        }));
        return {
          sceneId: scene.id,
          cutId: cut.id,
          script: scene.narration,
          spoken: rendered.plain,
          directed: directed !== null,
          intent: directed?.intent ?? "",
          delivery: directed?.delivery ?? "neutral",
          emphasis: directed?.emphasis ?? [],
          sent: rendered.text,
          pauses: [...inline, ...edges],
          composition: rendered.composition,
          notes: rendered.notes,
          issues: check.issues.filter((issue) => issue.sceneId === scene.id),
        };
      }),
  );
}

function markdown(report: DirectionReport): string {
  const lines: string[] = [
    `# Voice direction: ${report.videoId}`,
    "",
    `Preset: **${presetById(report.presetId).label}** on \`${report.modelId}\`. Levers on this model: ${report.levers.join("; ")}.`,
    "",
    `Direction hash: \`${report.directionHash.slice(0, 16)}\`. An approval is bound to this hash: any edit to the spoken wording or the direction needs a new approval.`,
    "",
    "This report shows what will be said and how it is marked up. It cannot show how it sounds.",
    "",
  ];
  for (const issue of report.fileIssues) lines.push(`- ${issue.severity}: ${issue.message}`);
  for (const scene of report.scenes) {
    lines.push(`## ${scene.sceneId} (${scene.cutId})`, "");
    if (!scene.directed) lines.push("_No direction: spoken exactly as written in the script._", "");
    if (scene.intent) lines.push(`Intent: ${scene.intent}`, "");
    lines.push(
      `Delivery: ${scene.delivery}${scene.emphasis.length ? `. Emphasis: ${scene.emphasis.join(", ")}` : ""}`,
      "",
      `Script: ${scene.script}`,
      "",
      `Spoken: ${scene.spoken}`,
      "",
      "Sent to the model:",
      "",
      "```text",
      scene.sent,
      "```",
      "",
    );
    for (const pause of scene.pauses) {
      lines.push(
        `- ${pause.kind} ${pause.where}: target ${pause.targetSeconds.toFixed(2)}s, ${pause.how}${pause.why ? `. ${pause.why}` : ""}`,
      );
    }
    for (const note of scene.notes) lines.push(`- Note: ${note}`);
    for (const issue of scene.issues)
      lines.push(`- ${issue.severity} (${issue.rule}): ${issue.message}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function htmlReport(report: DirectionReport): string {
  const scenes = report.scenes.map(
    (scene) => html`
      <section class="card">
        <h2>${scene.sceneId} <span class="muted">${scene.cutId} · ${scene.delivery}</span></h2>
        ${scene.intent ? raw(html`<p><strong>Intent.</strong> ${scene.intent}</p>`) : ""}
        <p class="muted">Script</p>
        <p>${scene.script}</p>
        <p class="muted">Spoken${scene.directed ? "" : " (no direction: as scripted)"}</p>
        <p><strong>${scene.spoken}</strong></p>
        <p class="muted">Sent to the model</p>
        <pre style="white-space:pre-wrap">${scene.sent}</pre>
        <ul>
          ${raw(
            [
              ...scene.pauses.map(
                (p) =>
                  html`<li>
                    ${p.kind} ${p.where}: target ${p.targetSeconds.toFixed(2)}s, ${p.how}. ${p.why}
                  </li>`,
              ),
              ...scene.emphasis.map((word) => html`<li>Emphasis: ${word}</li>`),
              ...scene.notes.map((note) => html`<li>Note: ${note}</li>`),
              ...scene.issues.map(
                (issue) => html`<li><strong>${issue.severity}</strong> ${issue.message}</li>`,
              ),
            ].join(""),
          )}
        </ul>
      </section>
    `,
  );
  return page(
    `Voice direction: ${report.videoId}`,
    html`<h1>Voice direction: ${report.videoId}</h1>
      <p>
        Preset <strong>${presetById(report.presetId).label}</strong> on ${report.modelId}.
        ${report.levers.join("; ")}.
      </p>
      <p class="muted">
        This page shows what will be said and how it is marked up. It cannot show how it sounds.
      </p>
      ${raw(scenes.join(""))}`,
  );
}

/**
 * Writes the human-readable direction report (markdown and HTML) and the composition
 * pauses as data, so whoever owns the storyboard can apply the lead-in and tail silence.
 */
export async function writeDirectionReport(
  deps: CoreDeps,
  input: { videoId: string; presetId: PresetId; modelId: string },
): Promise<DirectionReport> {
  const check = await checkVoiceDirection(deps, input.videoId);
  if (check === null) {
    throw new StudioError("NOT_FOUND", "This video has no voice-direction.json.", {
      hint: `Draft one with \`pnpm studio voice direct --video ${input.videoId}\`.`,
    });
  }
  const { script } = await loadScript(deps, input.videoId);
  const preset = presetById(input.presetId);
  const capabilities = capabilitiesFor(input.modelId);
  const dir = voiceReviewDir(deps.layout, input.videoId);
  const report: DirectionReport = {
    videoId: input.videoId,
    presetId: input.presetId,
    modelId: input.modelId,
    directionHash: check.hash,
    levers: presetLevers(preset, capabilities),
    settings: effectiveSettings(preset, capabilities),
    scenes: buildScenes(script, check, input.presetId, input.modelId),
    fileIssues: check.issues.filter((issue) => issue.sceneId === undefined),
    files: {
      markdown: path.join(dir, "direction.md"),
      html: path.join(dir, "direction.html"),
      composition: path.join(dir, "composition-pauses.json"),
    },
  };
  await deps.files.writeText(report.files.markdown, markdown(report));
  await deps.files.writeText(report.files.html, htmlReport(report));
  await deps.files.writeJson(
    report.files.composition,
    Object.fromEntries(
      report.scenes
        .filter((s) => s.composition.leadInSeconds > 0 || s.composition.tailSeconds > 0)
        .map((s) => [s.sceneId, s.composition]),
    ),
  );
  return report;
}
