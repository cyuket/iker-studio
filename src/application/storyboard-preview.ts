import { FORMATS } from "../domain/formats";
import type { Manifest } from "../domain/manifest";
import { describeMotionGraphic, type Scene, type Storyboard } from "../domain/storyboard";
import { html, page, raw } from "./html";

function visualSummary(scene: Scene): string {
  const { visual } = scene;
  switch (visual.kind) {
    case "title":
    case "statement":
    case "cta":
      return visual.headline;
    case "steps":
      return `${visual.heading}: ${visual.steps.map((step) => step.title).join(" → ")}`;
    case "product":
      return `Recording "${visual.scenarioId}" (${visual.mode}${visual.screenshot ? `: ${visual.screenshot}` : ""})${visual.prelude ? `, opened by ${describeMotionGraphic(visual.prelude.visual)}` : ""}`;
    case "diagram":
      return visual.nodes.map((node) => node.label).join(" · ");
    case "comparison":
      return `${visual.left.title} vs ${visual.right.title}`;
    case "code":
      return `${visual.language} snippet`;
    case "data":
      return `${visual.heading} (${visual.illustrative ? "illustrative" : visual.source})`;
    case "chapter":
      return `Chapter card: ${visual.title}`;
    case "photo":
      return `Photo "${visual.file}": ${visual.alt}${visual.caption ? `. Caption: ${visual.caption}` : ""}`;
    case "outro":
      return visual.tagline ?? "Brand outro";
    default:
      return describeMotionGraphic(visual);
  }
}

/** A readable, static view of the storyboard for review before anything is rendered. */
export function renderStoryboardPreview(storyboard: Storyboard, manifest: Manifest): string {
  const cuts = storyboard.cuts.map((cut) => {
    const total = cut.scenes
      .filter((s) => s.enabled)
      .reduce((sum, s) => sum + s.estimatedDurationSeconds, 0);
    const rows = cut.scenes.map(
      (scene, index) => html`<tr${raw(scene.enabled ? "" : ' style="opacity:.45"')}>
        <td>${index + 1}</td>
        <td><code>${scene.id}</code><br><span class="muted">${scene.type}${scene.enabled ? "" : " · disabled"}</span></td>
        <td><strong>${scene.visual.kind}</strong><br>${visualSummary(scene)}${scene.visualInstructions ? raw(html`<br /><span class="muted">${scene.visualInstructions}</span>`) : ""}</td>
        <td>${scene.narration || raw('<span class="muted">No narration</span>')}</td>
        <td>${scene.estimatedDurationSeconds.toFixed(1)}s</td>
      </tr>`,
    );
    return html`<h2>
        ${cut.id}
        <span class="muted"
          >· ${FORMATS[cut.format].label} · about ${total.toFixed(0)}s (target
          ${cut.targetSeconds.min}-${cut.targetSeconds.max}s)</span
        >
      </h2>
      <div class="card scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Scene</th>
              <th>Visual</th>
              <th>Narration</th>
              <th>Est.</th>
            </tr>
          </thead>
          <tbody>
            ${raw(rows.join(""))}
          </tbody>
        </table>
      </div>`;
  });
  const body = html`<h1>${manifest.title}</h1>
    <p class="muted">
      Storyboard v${storyboard.version} · script v${manifest.script.version} · durations are
      estimates until narration exists
    </p>
    ${raw(cuts.join(""))}`;
  return page(`Storyboard: ${manifest.title}`, body);
}
