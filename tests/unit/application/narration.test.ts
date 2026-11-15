import { beforeEach, describe, expect, it } from "vitest";
import { checkScript, updateStoryboard } from "../../../src/application/authoring";
import { approveScript } from "../../../src/application/approval";
import {
  narrate,
  previewVoice,
  PREVIEW_CHARACTER_LIMIT,
  type NarrationDeps,
} from "../../../src/application/narration";
import { renderStoryboardPreview } from "../../../src/application/storyboard-preview";
import {
  countingSynthesizer,
  createTestCore,
  fakeMedia,
  PROJECT_ROOT,
  type TestCore,
} from "../../helpers/fakes";
import { createApprovedVideo, scriptMarkdown } from "../../helpers/video";

let core: TestCore;
let voice: ReturnType<typeof countingSynthesizer>;
let deps: NarrationDeps;
let videoId: string;

/** Edits the script and takes it back through check, storyboard sync and approval. */
async function reviseScript(
  overrides: Parameters<typeof scriptMarkdown>[0],
  approve = true,
): Promise<void> {
  core.files.seed(core.layout.video(videoId).script, scriptMarkdown(overrides));
  await checkScript(core, videoId);
  await updateStoryboard(core, videoId, [], renderStoryboardPreview);
  if (approve) await approveScript(core, { videoId, approvedBy: "Test Reviewer", note: "" });
}

beforeEach(async () => {
  core = createTestCore();
  voice = countingSynthesizer(core.files);
  deps = {
    ...core,
    media: fakeMedia(),
    synthesizer: () => voice.synthesizer,
    usdPerThousandCredits: () => null,
  };
  videoId = await createApprovedVideo(core);
});

describe("narrate", () => {
  it("synthesises every narrated scene once and records what was billed", async () => {
    const result = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(result.generated).toEqual(["hook", "demo", "cta"]);
    expect(voice.requests).toHaveLength(3);
    const manifest = await core.manifests.load(videoId);
    expect(Object.keys(manifest.assets.narration)).toEqual(["hook", "demo", "cta"]);
    expect(manifest.usage.synthesisRequests).toBe(3);
    expect(manifest.usage.synthesisedCharacters).toBe(
      voice.requests.reduce((n, r) => n + r.text.length, 0),
    );
    expect(manifest.stages.voice.status).toBe("completed");
  });

  it("does not call the speech API again when nothing changed", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    const again = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(voice.requests).toHaveLength(3);
    expect(again.generated).toEqual([]);
  });

  it("regenerates only the scene whose text changed", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    await reviseScript({ demo: "A different sentence for the demo scene." });
    const result = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(result.generated).toEqual(["demo"]);
    expect(result.alreadyCurrent).toEqual(["hook", "cta"]);
    expect(voice.requests).toHaveLength(4);
  });

  it("restores a clip from the shared cache for free when text is changed back", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    await reviseScript({ demo: "A different sentence for the demo scene." });
    await narrate(deps, { videoId, dryRun: false, force: false });
    await reviseScript({});
    const result = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(result.restoredFromCache).toEqual(["demo"]);
    expect(voice.requests).toHaveLength(4);
    expect((await core.manifests.load(videoId)).usage.cacheHits).toBe(1);
  });

  it("shares one clip between two videos that say the same thing", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    const second = await createApprovedVideo(core, "second-video");
    const result = await narrate(deps, { videoId: second, dryRun: false, force: false });
    expect(result.restoredFromCache).toEqual(["hook", "demo", "cta"]);
    expect(voice.requests).toHaveLength(3);
  });

  it("regenerates everything when the voice changes", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    const manifest = await core.manifests.load(videoId);
    await core.manifests.save({
      ...manifest,
      voice: { ...manifest.voice, voiceId: "another-voice" },
    });
    const result = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(result.generated).toEqual(["hook", "demo", "cta"]);
    expect(voice.requests.at(-1)?.voiceId).toBe("another-voice");
  });

  it("drops a voice id that belonged to another provider when the provider changes", async () => {
    const manifest = await core.manifests.load(videoId);
    await core.manifests.save({
      ...manifest,
      voice: { ...manifest.voice, provider: "system", voiceId: "Daniel" },
    });
    const result = await narrate(deps, {
      videoId,
      dryRun: true,
      force: false,
      provider: "elevenlabs",
    });
    expect(result.plan.voiceId).toBe("voice-default");
    const named = await narrate(deps, {
      videoId,
      dryRun: true,
      force: false,
      provider: "elevenlabs",
      voiceId: "chosen",
    });
    expect(named.plan.voiceId).toBe("chosen");
  });

  it("refuses to generate until the script is approved", async () => {
    await reviseScript({ hook: "An unapproved rewrite of the hook." }, false);
    await expect(narrate(deps, { videoId, dryRun: false, force: false })).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
    });
    expect(voice.requests).toHaveLength(0);
  });

  it("treats an approval as void once the script is edited", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    await reviseScript({ cta: "A changed call to action." }, false);
    await expect(narrate(deps, { videoId, dryRun: false, force: false })).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
    });
  });

  it("lets an automated approval unlock a stand-in voice but never paid narration", async () => {
    await approveScript(core, { videoId, approvedBy: "automation", note: "", automated: true });
    await expect(narrate(deps, { videoId, dryRun: false, force: false })).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
      message: expect.stringContaining("automation only") as string,
    });
    expect(voice.requests).toHaveLength(0);

    const standIn = countingSynthesizer(core.files, "silent");
    const offline = { ...deps, synthesizer: () => standIn.synthesizer };
    const result = await narrate(offline, {
      videoId,
      dryRun: false,
      force: false,
      provider: "silent",
    });
    expect(result.generated).toHaveLength(3);
    expect((await core.manifests.load(videoId)).usage.synthesisedCharacters).toBe(0);
  });

  it("does not complete the stage from a partial run while another scene is stale", async () => {
    await narrate(deps, { videoId, dryRun: false, force: false });
    await reviseScript({ hook: "A rewritten hook.", demo: "A rewritten demo line." });
    await narrate(deps, { videoId, sceneIds: ["hook"], dryRun: false, force: false });
    expect((await core.manifests.load(videoId)).stages.voice.status).toBe("pending");
    await narrate(deps, { videoId, sceneIds: ["demo"], dryRun: false, force: false });
    expect((await core.manifests.load(videoId)).stages.voice.status).toBe("completed");
  });

  it("reports cost in a dry run without spending anything, even before approval", async () => {
    await reviseScript({ hook: "An unapproved rewrite of the hook." }, false);
    const result = await narrate(deps, { videoId, dryRun: true, force: false });
    expect(result.dryRun).toBe(true);
    expect(result.plan.cost.characters).toBe(
      result.plan.items.reduce((n, item) => n + item.characters, 0),
    );
    expect(result.plan.cost.credits).toBe(result.plan.cost.characters);
    expect(voice.requests).toHaveLength(0);
  });

  it("keeps finished scenes when a later scene fails, and resumes from there", async () => {
    const flaky = { ...voice.synthesizer };
    let calls = 0;
    flaky.synthesize = (request) => {
      calls++;
      if (calls === 2) return Promise.reject(new Error("HTTP 503"));
      return voice.synthesizer.synthesize(request);
    };
    const flakyDeps = { ...deps, synthesizer: () => flaky };
    await expect(narrate(flakyDeps, { videoId, dryRun: false, force: false })).rejects.toThrow(
      "HTTP 503",
    );
    const failed = await core.manifests.load(videoId);
    expect(Object.keys(failed.assets.narration)).toEqual(["hook"]);
    expect(failed.stages.voice.status).toBe("failed");

    const resumed = await narrate(flakyDeps, { videoId, dryRun: false, force: false });
    expect(resumed.alreadyCurrent).toEqual(["hook"]);
    expect(resumed.generated).toEqual(["demo", "cta"]);
    expect((await core.manifests.load(videoId)).stages.voice.status).toBe("completed");
  });

  it("narrates a single requested scene and leaves the stage incomplete", async () => {
    const result = await narrate(deps, {
      videoId,
      sceneIds: ["demo"],
      dryRun: false,
      force: false,
    });
    expect(result.generated).toEqual(["demo"]);
    expect((await core.manifests.load(videoId)).stages.voice.status).toBe("pending");
  });

  it("applies only approved pronunciation rules, and reports pending terms", async () => {
    core.files.seed(
      `${PROJECT_ROOT}/brand/pronunciations.json`,
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          { term: "example", status: "approved", alias: "eg-zam-pull" },
          { term: "user", status: "pending", alias: "you-zer" },
        ],
      }),
    );
    const result = await narrate(deps, { videoId, dryRun: false, force: false });
    expect(result.plan.pendingPronunciations).toEqual(["user"]);
    const cta = voice.requests.find((request) => request.text.includes("example"));
    expect(cta?.rules.map((rule) => rule.term)).toEqual(["example"]);
    expect(voice.requests.find((request) => request.text.includes("user"))?.rules).toEqual([]);
  });
});

describe("previewVoice", () => {
  it("generates a sample once and serves repeats from cache", async () => {
    const first = await previewVoice(deps, { videoId, text: "A short sample.", dryRun: false });
    const second = await previewVoice(deps, { videoId, text: "A short sample.", dryRun: false });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(voice.requests).toHaveLength(1);
  });

  it("speaks a newly set, still pending rule when previewing that term", async () => {
    core.files.seed(
      `${PROJECT_ROOT}/brand/pronunciations.json`,
      JSON.stringify({
        schemaVersion: 1,
        entries: [{ term: "Iker", status: "pending", alias: "my-AH-za" }],
      }),
    );
    await previewVoice(deps, {
      videoId,
      text: "This is Iker.",
      dryRun: false,
      previewTerm: "Iker",
    });
    expect(voice.requests.at(-1)?.rules.map((rule) => rule.alias)).toEqual(["my-AH-za"]);
    // Without naming the term, a pending rule still never applies.
    await previewVoice(deps, { videoId, text: "Iker again.", dryRun: false });
    expect(voice.requests.at(-1)?.rules).toEqual([]);
  });

  it("refuses text long enough to be a script", async () => {
    const long = "word ".repeat(PREVIEW_CHARACTER_LIMIT);
    await expect(previewVoice(deps, { videoId, text: long, dryRun: false })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("spends nothing in a dry run", async () => {
    const preview = await previewVoice(deps, { videoId, text: "A short sample.", dryRun: true });
    expect(preview.file).toBeNull();
    expect(voice.requests).toHaveLength(0);
  });
});
