import type { FormatSpec } from "../domain/formats";
import type { Manifest } from "../domain/manifest";
import {
  MANUAL_REVIEW_CHECKLIST,
  type QaCheck,
  type QaMedia,
  type QaStatus,
  type QaSummary,
} from "../domain/qa";
import type { Script } from "../domain/script";
import type { Scene } from "../domain/storyboard";
import { formatChapterTime, type CutTimeline } from "../domain/timeline";
import { html, page, raw } from "./html";

export interface QaReportData {
  manifest: Manifest;
  script: Script;
  cutId: string;
  quality: string;
  format: FormatSpec;
  media: QaMedia;
  sizeBytes: number;
  sha256: string;
  loudness: { integratedLufs: number; truePeakDbtp: number; loudnessRange: number } | null;
  timeline: CutTimeline;
  scenes: readonly Scene[];
  checks: readonly QaCheck[];
  summary: QaSummary;
  generatedAt: string;
  /** Paths relative to the report file. */
  videoHref: string;
  contactSheetHref: string;
  frames: readonly { sceneId: string; href: string }[];
  thumbnails: readonly { variant: string; href: string }[];
  voice: { provider: string; voiceId: string; modelId: string };
}

const LABEL: Record<QaStatus, string> = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  manual: "Check by eye",
};

function megabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function checkRow(check: QaCheck): string {
  return html`<tr>
    <td><span class="pill ${check.status}">${LABEL[check.status]}</span></td>
    <td>
      <strong>${check.title}</strong>${
        check.details.length
          ? raw(
              html`<ul>
                ${raw(check.details.map((d) => html`<li>${d}</li>`).join(""))}
              </ul>`,
            )
          : ""
      }
    </td>
  </tr>`;
}

export function renderQaReport(data: QaReportData): string {
  const { manifest, media, timeline, summary } = data;
  const verdict = summary.passed
    ? summary.warnings > 0
      ? `Automated checks passed with ${summary.warnings} warning(s).`
      : "Automated checks passed."
    : `${summary.failures} automated check(s) failed.`;
  const attention = data.checks.filter((c) => c.status === "fail" || c.status === "warn");

  const bar = timeline.scenes.map(
    (t) =>
      html`<div
        style="flex:${t.durationFrames}"
        title="${t.sceneId} · ${(t.durationFrames / timeline.fps).toFixed(1)}s"
      >
        ${t.sceneId}
      </div>`,
  );
  const sceneRows = timeline.scenes.map((timing, index) => {
    const scene = data.scenes.find((s) => s.id === timing.sceneId);
    return html`<tr>
      <td>${index + 1}</td>
      <td>${formatChapterTime(timing.startFrame / timeline.fps)}</td>
      <td>
        <code>${timing.sceneId}</code><br /><span class="muted"
          >${scene?.type ?? ""} · ${scene?.visual.kind ?? ""}</span
        >
      </td>
      <td>${(timing.durationFrames / timeline.fps).toFixed(1)}s</td>
      <td>${scene?.narration || raw('<span class="muted">No narration</span>')}</td>
    </tr>`;
  });

  const body = html` <h1>${manifest.title}</h1>
    <p class="muted">
      QA report · cut <code>${data.cutId}</code> · ${data.quality} quality · generated
      ${data.generatedAt}
    </p>

    <div class="card${summary.passed && summary.warnings === 0 ? "" : " notice"}">
      <h3>
        <span class="pill ${summary.passed ? (summary.warnings ? "warn" : "pass") : "fail"}"
          >${summary.passed ? "Automated checks passed" : "Automated checks failed"}</span
        >
      </h3>
      <p>
        ${verdict} ${summary.manual} item(s) can only be judged by a person. Passing these checks
        does not mean the video is good: it means nothing measurable is wrong.
      </p>
      ${
        attention.length
          ? raw(
              html`<ul>
                ${raw(attention.map((c) => html`<li><strong>${c.title}:</strong> ${c.details.join(" ")}</li>`).join(""))}
              </ul>`,
            )
          : ""
      }
    </div>

    <h2>Video</h2>
    <video controls preload="metadata" src="${data.videoHref}"></video>

    <h2>Metadata</h2>
    <div class="grid">
      <div class="card">
        <h3>Picture</h3>
        <p>
          ${media.video?.width ?? 0}×${media.video?.height ?? 0} · ${media.video?.fps ?? 0} fps<br />${media.video?.codec ?? "none"}
          · ${media.video?.pixelFormat ?? ""}
        </p>
      </div>
      <div class="card">
        <h3>Length and size</h3>
        <p>
          ${media.durationSeconds.toFixed(2)}s (${formatChapterTime(media.durationSeconds)})<br />${megabytes(data.sizeBytes)}
          · ${data.format.label}
        </p>
      </div>
      <div class="card">
        <h3>Audio</h3>
        <p>
          ${media.audio ? `${media.audio.codec} · ${media.audio.sampleRate} Hz · ${media.audio.channels} ch` : "No audio stream"}<br />${data.loudness && Number.isFinite(data.loudness.integratedLufs) ? `${data.loudness.integratedLufs.toFixed(1)} LUFS · peak ${data.loudness.truePeakDbtp.toFixed(1)} dBTP · range ${data.loudness.loudnessRange.toFixed(1)} LU` : "Loudness not measurable (silent track)"}
        </p>
      </div>
      <div class="card">
        <h3>Voice</h3>
        <p>
          ${data.voice.provider}<br /><span class="muted"
            >${data.voice.voiceId} · ${data.voice.modelId}</span
          >
        </p>
      </div>
    </div>
    <p class="muted">SHA-256 <code>${data.sha256}</code></p>

    <h2>Quality results</h2>
    <div class="card scroll">
      <table>
        <tbody>
          ${raw(data.checks.map(checkRow).join(""))}
        </tbody>
      </table>
    </div>

    <h2>Timeline</h2>
    <div class="bar">${raw(bar.join(""))}</div>

    <h2>Storyboard and script</h2>
    <div class="card scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Start</th>
            <th>Scene</th>
            <th>Length</th>
            <th>Narration</th>
          </tr>
        </thead>
        <tbody>
          ${raw(sceneRows.join(""))}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>Script summary</h3>
      <p><strong>Audience:</strong> ${data.script.audience}</p>
      <p><strong>Problem:</strong> ${data.script.audienceProblem}</p>
      <p><strong>Hook:</strong> ${data.script.hook}</p>
      <p><strong>Outcome:</strong> ${data.script.businessOutcome}</p>
      <p>
        <strong>Call to action:</strong> ${data.script.callToAction.label}
        (${data.script.callToAction.url})
      </p>
      <p class="muted">
        Script v${manifest.script.version} ·
        ${manifest.approvals.script ? `approved by ${manifest.approvals.script.approvedBy} on ${manifest.approvals.script.approvedAt}` : "not approved"}
      </p>
    </div>

    <h2>Contact sheet</h2>
    <p class="muted">
      One frame from the middle of each scene. The outlined rectangle is the safe area for
      ${data.format.label}.
    </p>
    <img src="${data.contactSheetHref}" alt="Contact sheet with one frame per scene" />

    <h2>Scene frames</h2>
    <div class="grid">
      ${raw(
        data.frames
          .map(
            (f) =>
              html`<figure style="margin:0">
                <img src="${f.href}" alt="Frame from scene ${f.sceneId}" loading="lazy" />
                <figcaption class="muted"><code>${f.sceneId}</code></figcaption>
              </figure>`,
          )
          .join(""),
      )}
    </div>

    ${
      data.thumbnails.length
        ? raw(
            html`<h2>Thumbnails</h2>
              <div class="grid">
                ${raw(
                  data.thumbnails
                    .map(
                      (t) =>
                        html`<figure style="margin:0">
                          <img
                            src="${t.href}"
                            alt="Thumbnail candidate ${t.variant}"
                            loading="lazy"
                          />
                          <figcaption class="muted">${t.variant}</figcaption>
                        </figure>`,
                    )
                    .join(""),
                )}
              </div>`,
          )
        : ""
    }

    <h2>Approval checklist</h2>
    <div class="card">
      <p class="muted">
        For the reviewer. Ticks are not saved: approval is recorded by the command below.
      </p>
      ${raw(MANUAL_REVIEW_CHECKLIST.map((item) => html`<label class="check"><input type="checkbox" /> <span>${item}</span></label>`).join(""))}
      <p style="margin-top:14px">
        <code
          >pnpm studio approve --video ${manifest.id} --stage final --cut
          ${data.cutId}${summary.warnings ? " --acknowledge-warnings" : ""}</code
        >
      </p>
    </div>`;
  return page(`QA: ${manifest.title} (${data.cutId})`, body);
}
