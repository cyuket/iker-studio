import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { approveFinal, approveScript } from "../../src/application/approval";
import { checkScript, createVideo, updateStoryboard } from "../../src/application/authoring";
import { exportVideo } from "../../src/application/export";
import { inspectVideo } from "../../src/application/inspect";
import { narrate } from "../../src/application/narration";
import { runQa } from "../../src/application/qa";
import { record } from "../../src/application/recording";
import { render, renderThumbnails } from "../../src/application/render";
import { renderStoryboardPreview } from "../../src/application/storyboard-preview";
import { createContainer, type Container } from "../../src/cli/container";

/**
 * The whole pipeline with real adapters and no paid service: the bundled fixture is
 * recorded with Chromium, narration is silent audio of the right length, scenes are
 * rendered by Remotion and joined by FFmpeg. It renders the short vertical cut of the
 * Product Tutorial demo at preview quality to stay fast.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const VIDEO = "e2e-synthetic";
const CUT = "short";
const SCENARIO = "synthetic-record-payment";

let container: Container;
let videoRoot: string;

beforeAll(async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-"));
  // No credentials are passed, which proves nothing here needs them.
  container = createContainer(ROOT, {
    OUTPUT_DIRECTORY: outputDirectory,
    LOG_LEVEL: "error",
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  });
  videoRoot = container.core.layout.video(VIDEO).root;
});

describe("synthetic end-to-end pipeline", () => {
  it("takes a template demo from script to approved script", async () => {
    await createVideo(container.core, {
      topic: "End-to-end check",
      id: VIDEO,
      contentType: "PRODUCT_TUTORIAL",
      template: "product-tutorial",
      voiceProvider: "silent",
      demo: true,
    });
    const report = await checkScript(container.core, VIDEO);
    expect(report.accepted).toBe(true);
    const { storyboard } = await updateStoryboard(
      container.core,
      VIDEO,
      [],
      renderStoryboardPreview,
    );
    expect(storyboard.cuts.map((cut) => cut.id)).toEqual(["full", CUT]);
    await approveScript(container.core, { videoId: VIDEO, approvedBy: "E2E Reviewer", note: "" });
  });

  it("records the synthetic scenario with a real browser", async () => {
    const outcome = await record(container.recording, {
      videoId: VIDEO,
      scenarioIds: [SCENARIO],
      force: false,
      headless: true,
    });
    expect(outcome.recorded).toEqual([SCENARIO]);
    const manifest = await container.core.manifests.load(VIDEO);
    const recording = manifest.assets.recordings[SCENARIO];
    expect(recording).toMatchObject({
      target: "synthetic",
      verified: true,
      displayHost: "demo-console.example",
    });
    expect(recording?.durationSeconds).toBeGreaterThan(10);
    const info = await container.render.media.probe(path.join(videoRoot, recording?.video ?? ""));
    expect(info.video).toMatchObject({ codec: "h264", width: 1440, height: 900, fps: 30 });
  });

  it("narrates without a paid service and does not regenerate on a second run", async () => {
    const first = await narrate(container.narration, {
      videoId: VIDEO,
      dryRun: false,
      force: false,
    });
    expect(first.plan.provider).toBe("silent");
    expect(first.plan.cost.credits).toBe(0);
    expect([...first.generated, ...first.restoredFromCache].sort()).toEqual(
      first.plan.items.map((item) => item.sceneId).sort(),
    );
    const second = await narrate(container.narration, {
      videoId: VIDEO,
      dryRun: false,
      force: false,
    });
    expect(second.generated).toEqual([]);
    expect(second.restoredFromCache).toEqual([]);
    expect((await container.core.manifests.load(VIDEO)).usage.synthesisedCharacters).toBe(0);
  });

  it("renders a vertical cut with narration, recording, motion and subtitles", async () => {
    const [cut] = await render(container.render, {
      videoId: VIDEO,
      cutIds: [CUT],
      quality: "preview",
      force: false,
    });
    expect(cut?.renderedScenes).toEqual(["short-hook", "short-demo", "short-cta"]);
    expect(cut).toMatchObject({ width: 540, height: 960 });

    const info = await container.render.media.probe(cut?.file ?? "");
    expect(info.formatName).toContain("mp4");
    expect(info.video).toMatchObject({
      codec: "h264",
      width: 540,
      height: 960,
      fps: 30,
      pixelFormat: "yuv420p",
    });
    expect(info.audio).toMatchObject({ codec: "aac", sampleRate: 48000 });
    expect(info.durationSeconds).toBeGreaterThan(8);
    expect(info.durationSeconds).toBeCloseTo(cut?.durationSeconds ?? 0, 1);

    const srt = await readFile(cut?.srt ?? "", "utf8");
    expect(srt).toMatch(/^1\n00:00:0\d,\d{3} --> 00:00:0\d,\d{3}\n/);
    expect(srt.replace(/\s+/g, " ")).toContain("A deposit in your WhatsApp chat");
    expect(await readFile(cut?.vtt ?? "", "utf8")).toMatch(/^WEBVTT/);
  });

  it("reuses every scene when nothing changed", async () => {
    const [cut] = await render(container.render, {
      videoId: VIDEO,
      cutIds: [CUT],
      quality: "preview",
      force: false,
    });
    expect(cut?.renderedScenes).toEqual([]);
    expect(cut?.reusedScenes).toEqual(["short-hook", "short-demo", "short-cta"]);
    expect(cut?.finalReused).toBe(true);
  });

  it("re-narrates and re-renders only the scene whose script text changed", async () => {
    const scriptFile = path.join(videoRoot, "script.md");
    const script = await readFile(scriptFile, "utf8");
    // A sentence unique to this run, so the shared narration cache cannot already hold it.
    const edited = script.replace(
      /(## short-cta[^\n]*\n\n)[^\n]+/,
      `$1Try it yourself at useiker.com, run ${Date.now()}.`,
    );
    expect(edited).not.toBe(script);
    await writeFile(scriptFile, edited);
    await checkScript(container.core, VIDEO);
    await updateStoryboard(container.core, VIDEO, [], renderStoryboardPreview);

    const plan = await inspectVideo(container.inspect, VIDEO, "preview");
    expect(plan.script.approved).toBe(false);
    expect(
      plan.narration.filter((item) => item.state !== "current").map((item) => item.sceneId),
    ).toEqual(["short-cta"]);

    await approveScript(container.core, { videoId: VIDEO, approvedBy: "E2E Reviewer", note: "" });
    const narrated = await narrate(container.narration, {
      videoId: VIDEO,
      dryRun: false,
      force: false,
    });
    expect(narrated.generated).toEqual(["short-cta"]);

    const [cut] = await render(container.render, {
      videoId: VIDEO,
      cutIds: [CUT],
      quality: "preview",
      force: false,
    });
    expect(cut?.renderedScenes).toEqual(["short-cta"]);
    expect(cut?.reusedScenes).toEqual(["short-hook", "short-demo"]);
    expect(cut?.finalReused).toBe(false);
  });

  it("produces a QA report that flags the stand-in voice and synthetic footage", async () => {
    const [outcome] = await runQa(container.qa, {
      videoId: VIDEO,
      cutIds: [CUT],
      quality: "preview",
    });
    const status = (id: string) => outcome?.checks.find((check) => check.id === id)?.status;
    expect(outcome?.summary.failures).toBe(0);
    for (const id of [
      "missing-assets",
      "video-metadata",
      "aspect-ratio",
      "resolution",
      "black-frames",
      "narration-overflow",
      "subtitle-overflow",
      "recordings",
      "cta",
      "script-approval",
      "sensitive-information",
    ]) {
      expect(status(id), id).toBe("pass");
    }
    expect(status("silence")).toBe("warn");
    expect(status("footage-provenance")).toBe("warn");
    expect(status("voice-provenance")).toBe("warn");
    expect(status("safe-areas")).toBe("manual");

    const report = await readFile(outcome?.report ?? "", "utf8");
    expect(report).toContain("Approval checklist");
    expect(report).toContain("contact-sheet.png");
    expect(
      (await container.render.media.probe(outcome?.contactSheet ?? "")).video?.width,
    ).toBeGreaterThan(0);
  });

  it("renders three 1280x720 thumbnails", async () => {
    const thumbnails = await renderThumbnails(container.render, VIDEO, false);
    expect(thumbnails.map((thumbnail) => thumbnail.variant).sort()).toEqual([
      "product",
      "split",
      "statement",
    ]);
    for (const thumbnail of thumbnails) {
      expect((await container.render.media.probe(thumbnail.file)).video).toMatchObject({
        width: 1280,
        height: 720,
      });
    }
  });

  it("will not approve or export a preview render", async () => {
    await expect(
      approveFinal(container.core, {
        videoId: VIDEO,
        cutIds: [CUT],
        approvedBy: "E2E Reviewer",
        note: "",
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: "STAGE_BLOCKED" });
    await expect(
      exportVideo(container.exporting, {
        videoId: VIDEO,
        cutIds: [CUT],
        toR2: false,
        signedUrlSeconds: null,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });
});
