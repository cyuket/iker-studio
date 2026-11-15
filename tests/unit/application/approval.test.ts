import { beforeEach, describe, expect, it } from "vitest";
import { approveFinal, approveScript, isFinalApproved } from "../../../src/application/approval";
import { checkScript } from "../../../src/application/authoring";
import { exportVideo, publishToYouTube, type ExportDeps } from "../../../src/application/export";
import type { PublishRequest, VideoPublisher } from "../../../src/application/ports";
import { StudioError } from "../../../src/domain/errors";
import type { Manifest } from "../../../src/domain/manifest";
import { createTestCore, type TestCore } from "../../helpers/fakes";
import { createApprovedVideo, scriptMarkdown } from "../../helpers/video";

const SHA = "e".repeat(64);
const OTHER_SHA = "f".repeat(64);
const STAMP = "2026-01-01T00:00:00.000Z";

let core: TestCore;
let videoId: string;
let published: PublishRequest[];
let publishingEnabled: boolean;
let deps: ExportDeps;

async function patch(change: (manifest: Manifest) => Manifest): Promise<void> {
  await core.manifests.save(change(await core.manifests.load(videoId)));
}

/** Gives the video a final render, optionally with a QA result for it. */
async function withFinal(
  qa: { passed: boolean; warnings: number; failures: number; subjectHash?: string } | null,
  sha256 = SHA,
): Promise<void> {
  const paths = core.layout.video(videoId);
  core.files.seed(paths.absolute("final/demo-video-full.mp4"), "video-bytes");
  core.files.seed(
    paths.absolute("subtitles/full.srt"),
    "1\n00:00:00,000 --> 00:00:01,000\nHello\n",
  );
  core.files.seed(paths.absolute("subtitles/full.vtt"), "WEBVTT\n");
  await patch((manifest) => ({
    ...manifest,
    assets: {
      ...manifest.assets,
      finals: {
        "full/final": {
          hash: SHA,
          file: "final/demo-video-full.mp4",
          sha256,
          width: 1920,
          height: 1080,
          durationSeconds: 30,
          subtitles: { srt: "subtitles/full.srt", vtt: "subtitles/full.vtt" },
          timeline: "scenes/full/timeline.json",
          renderedAt: STAMP,
        },
      },
    },
    qa: qa
      ? {
          "full/final": {
            subjectHash: qa.subjectHash ?? sha256,
            passed: qa.passed,
            failures: qa.failures,
            warnings: qa.warnings,
            report: "qa/full-final/report.html",
            checkedAt: STAMP,
          },
        }
      : {},
  }));
}

const approve = (acknowledgeWarnings = false) =>
  approveFinal(core, {
    videoId,
    cutIds: ["full"],
    approvedBy: "Head of Compliance",
    note: "",
    acknowledgeWarnings,
  });

const publish = (overrides: Partial<Parameters<typeof publishToYouTube>[1]> = {}) =>
  publishToYouTube(deps, {
    videoId,
    cutId: "full",
    titleIndex: 0,
    privacy: "private",
    thumbnailVariant: null,
    confirm: videoId,
    ...overrides,
  });

beforeEach(async () => {
  core = createTestCore();
  videoId = await createApprovedVideo(core);
  published = [];
  publishingEnabled = true;
  const publisher: VideoPublisher = {
    publish(request) {
      published.push(request);
      return Promise.resolve({
        videoId: "yt123",
        url: "https://www.youtube.com/watch?v=yt123",
        thumbnailSet: false,
      });
    },
    setThumbnail() {
      return Promise.resolve();
    },
  };
  deps = {
    ...core,
    contentType: () => "application/octet-stream",
    objectStore: () => {
      throw new StudioError("CONFIG_INVALID", "Cloudflare R2 is not configured");
    },
    publisher: () => {
      if (!publishingEnabled)
        throw new StudioError("PUBLISHING_DISABLED", "Publishing is switched off.");
      return publisher;
    },
  };
});

describe("script approval", () => {
  it("is bound to the script as approved: an edit voids it", async () => {
    const before = await core.manifests.load(videoId);
    expect(before.approvals.script?.approvedBy).toBe("Test Reviewer");
    core.files.seed(
      core.layout.video(videoId).script,
      scriptMarkdown({ hook: "Edited after approval." }),
    );
    const report = await checkScript(core, videoId);
    expect(report.approved).toBe(false);
  });

  it("cannot be given to a script that has not passed its checks", async () => {
    core.files.seed(
      core.layout.video(videoId).script,
      scriptMarkdown({ hook: "Changed and not re-checked." }),
    );
    await expect(
      approveScript(core, { videoId, approvedBy: "Anyone", note: "" }),
    ).rejects.toMatchObject({ code: "STAGE_BLOCKED" });
  });
});

describe("final approval", () => {
  it("is impossible while the script has only an automated approval", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approveScript(core, { videoId, approvedBy: "automation", note: "", automated: true });
    await expect(approve(true)).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
      message: expect.stringContaining("not been approved by a person") as string,
    });
    expect(isFinalApproved(await core.manifests.load(videoId), "full")).toBe(false);
  });

  it("needs a final render", async () => {
    await expect(approve()).rejects.toMatchObject({ code: "STAGE_BLOCKED" });
  });

  it("needs QA to have run on the current render", async () => {
    await withFinal(null);
    await expect(approve()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await withFinal({ passed: true, warnings: 0, failures: 0, subjectHash: OTHER_SHA });
    await expect(approve()).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
      message: expect.stringContaining("since it was rendered") as string,
    });
  });

  it("is refused while QA has failures, whatever is acknowledged", async () => {
    await withFinal({ passed: false, warnings: 0, failures: 2 });
    await expect(approve(true)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("needs warnings to be acknowledged explicitly", async () => {
    await withFinal({ passed: true, warnings: 3, failures: 0 });
    await expect(approve(false)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    const manifest = await approve(true);
    expect(manifest.approvals.final.full).toMatchObject({
      subjectHash: SHA,
      approvedBy: "Head of Compliance",
    });
    expect(isFinalApproved(manifest, "full")).toBe(true);
  });

  it("stops applying as soon as the cut is rendered again", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    await withFinal({ passed: true, warnings: 0, failures: 0 }, OTHER_SHA);
    expect(isFinalApproved(await core.manifests.load(videoId), "full")).toBe(false);
  });
});

describe("export and publishing", () => {
  it("refuses to export a cut that is not approved", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await expect(
      exportVideo(deps, { videoId, toR2: false, signedUrlSeconds: null }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("builds a local package with checksums once approved, without needing any credentials", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    const [outcome] = await exportVideo(deps, { videoId, toR2: false, signedUrlSeconds: null });
    const names = (outcome?.files ?? []).map((file) => file.split("/").at(-1));
    expect(names).toEqual(
      expect.arrayContaining([
        "demo-video-full.mp4",
        "demo-video-full.srt",
        "metadata.md",
        "SHA256SUMS",
      ]),
    );
    const sums = (await core.files.readText(`${outcome?.packageDir ?? ""}/SHA256SUMS`)) ?? "";
    expect(sums).toMatch(/^[a-f0-9]{64} {2}demo-video-full\.mp4$/m);
    expect((await core.manifests.load(videoId)).exports.at(-1)).toMatchObject({
      kind: "package",
      cutId: "full",
    });
  });

  it("never publishes without approval", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await expect(publish()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(published).toEqual([]);
  });

  it("never publishes without the operator retyping the video id", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    await expect(publish({ confirm: "yes" })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(published).toEqual([]);
  });

  it("never publishes while publishing is switched off, even when approved and confirmed", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    publishingEnabled = false;
    await expect(publish()).rejects.toMatchObject({ code: "PUBLISHING_DISABLED" });
    expect(published).toEqual([]);
  });

  it("never publishes a cut re-rendered after it was approved", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    await withFinal({ passed: true, warnings: 0, failures: 0 }, OTHER_SHA);
    await expect(publish()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(published).toEqual([]);
  });

  it("publishes privately by default with metadata taken from the script, and records the link", async () => {
    await withFinal({ passed: true, warnings: 0, failures: 0 });
    await approve();
    const result = await publish();
    expect(result.url).toBe("https://www.youtube.com/watch?v=yt123");
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      title: "Finding duplicate customers",
      privacy: "private",
      tags: ["identity verification", "fraud"],
    });
    expect(published[0]?.description).toContain("A user signs up twice with different details.");
    expect((await core.manifests.load(videoId)).exports.at(-1)).toMatchObject({
      kind: "youtube",
      location: result.url,
    });
  });
});
