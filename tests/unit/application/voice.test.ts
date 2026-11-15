import { beforeEach, describe, expect, it } from "vitest";
import { approveScript } from "../../../src/application/approval";
import { narrate } from "../../../src/application/narration";
import type {
  AudioTools,
  FinishClipRequest,
  SpeechSynthesizer,
  SynthesisRequest,
} from "../../../src/application/ports";
import {
  audition,
  AUDITION_CHARACTER_LIMIT,
  loadAudition,
  passageWithin,
  selectVoice,
  type AuditionDeps,
} from "../../../src/application/voice-audition";
import {
  checkVoiceDirection,
  scaffoldVoiceDirection,
  voiceDirectionFile,
  writeDirectionReport,
} from "../../../src/application/voice-direction";
import { measureNarration } from "../../../src/application/voice-measure";
import { hashOf, sha256 } from "../../../src/domain/hash";
import type { ClipMeasurement } from "../../../src/domain/voice-audio";
import {
  createTestCore,
  fakeMedia,
  type MemoryFileSystem,
  type TestCore,
} from "../../helpers/fakes";
import { createApprovedVideo } from "../../helpers/video";

const HOOK_SCRIPT = "A user signs up twice with different details.";
const HOOK_SPOKEN = "Someone signs up twice. With different details.";

/** A v4-like synthesizer: echoes the request text back as character timings. */
function echoingSynthesizer(files: MemoryFileSystem) {
  const requests: SynthesisRequest[] = [];
  const synthesizer: SpeechSynthesizer = {
    provider: "elevenlabs",
    resolveVoice: (voice) => ({
      voiceId: voice.voiceId ?? "voice-default",
      modelId: voice.modelId ?? "eleven_v4",
    }),
    synthesize(request) {
      requests.push(request);
      const file = `${request.outputBase}.mp3`;
      files.seed(file, `audio:${request.text}`);
      const characters = Array.from(request.text);
      return Promise.resolve({
        file,
        alignment: {
          characters,
          startSeconds: characters.map((_, i) => i * 0.05),
          endSeconds: characters.map((_, i) => (i + 1) * 0.05),
        },
        billedCharacters: request.text.length,
        billedCredits: request.text.length,
        requestId: `req-${requests.length}`,
      });
    },
    usage: () => Promise.resolve(null),
  };
  return { synthesizer, requests };
}

function fakeAudio(files: MemoryFileSystem, integratedLufs = -23) {
  const finished: FinishClipRequest[] = [];
  const cuts: { input: string; output: string; start: number; end: number }[] = [];
  const measurement: ClipMeasurement = {
    durationSeconds: 4,
    integratedLufs,
    truePeakDbtp: -8,
    loudnessRange: 3,
    samplePeakDb: -8.5,
    startEdgeDb: -90,
    endEdgeDb: -90,
    silences: [{ startSeconds: 3.8, endSeconds: 4 }],
  };
  const audio: AudioTools = {
    measureClip: () => Promise.resolve(measurement),
    finishClip(request) {
      finished.push(request);
      files.seed(request.output, "finished-audio");
      return Promise.resolve();
    },
    cutAudio(input, output, start, end) {
      cuts.push({ input, output, start, end });
      files.seed(output, "cut-audio");
      return Promise.resolve();
    },
  };
  return { audio, finished, cuts };
}

let core: TestCore;
let voice: ReturnType<typeof echoingSynthesizer>;
let sound: ReturnType<typeof fakeAudio>;
let deps: AuditionDeps;
let videoId: string;

function setup(integratedLufs = -23): void {
  voice = echoingSynthesizer(core.files);
  sound = fakeAudio(core.files, integratedLufs);
  deps = {
    ...core,
    media: fakeMedia(),
    audio: sound.audio,
    synthesizer: () => voice.synthesizer,
    usdPerThousandCredits: () => null,
  };
}

async function writeDirection(hook: Record<string, unknown> = {}): Promise<void> {
  await core.files.writeJson(voiceDirectionFile(core.layout, videoId), {
    schemaVersion: 1,
    videoId,
    scenes: {
      hook: {
        spoken: HOOK_SPOKEN,
        delivery: "calm",
        pauses: [{ kind: "REVEAL", after: "signs up twice." }],
        ...hook,
      },
    },
  });
}

const approve = () => approveScript(core, { videoId, approvedBy: "Test Reviewer", note: "" });
const run = (overrides: Partial<Parameters<typeof narrate>[1]> = {}) =>
  narrate(deps, { videoId, dryRun: false, force: false, ...overrides });
const auditionAll = (dryRun = false) =>
  audition(deps, {
    videoId,
    presets: ["natural-educator", "technical-expert"],
    maxCharacters: 350,
    dryRun,
  });
const select = (preset: "natural-educator" | "technical-expert" = "natural-educator") =>
  selectVoice(core, { videoId, preset, selectedBy: "Owner", note: "" });

beforeEach(async () => {
  core = createTestCore();
  setup();
  videoId = await createApprovedVideo(core);
});

describe("script approval covers the spoken wording and direction", () => {
  it("records no direction hash for a video without a direction file", async () => {
    expect((await approve()).voiceDirectionHash).toBeNull();
  });

  it("binds the approval to the direction as it is now", async () => {
    await writeDirection();
    const check = await checkVoiceDirection(core, videoId);
    expect((await approve()).voiceDirectionHash).toBe(check?.hash);
  });

  it("refuses to approve wording that adds a number the script does not contain", async () => {
    await writeDirection({
      spoken: "Someone signs up five times. With different details.",
      pauses: [],
    });
    await expect(approve()).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("refuses to approve direction with markup typed into the spoken text", async () => {
    await writeDirection({
      spoken: "[laughs] Someone signs up twice. With different details.",
      pauses: [],
    });
    await expect(approve()).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("narration gates", () => {
  it("keeps plain narration and its cache keys while direction is only drafted", async () => {
    const before = await run({ dryRun: true });
    await writeDirection();
    const after = await run({ dryRun: true });
    expect(after.plan.directionWaiting).toBe(true);
    expect(after.plan.items.map((item) => item.cacheKey)).toEqual(
      before.plan.items.map((item) => item.cacheKey),
    );
  });

  it("refuses full narration until a person has recorded a choice", async () => {
    await writeDirection();
    await approve();
    await expect(run()).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
      message: expect.stringContaining("No voice performance has been chosen") as string,
    });
    expect(voice.requests).toHaveLength(0);
  });

  it("stays a no-op for a narrated video whose direction is only drafted", async () => {
    await run();
    const spent = voice.requests.length;
    const before = await core.manifests.load(videoId);
    await writeDirection();
    const again = await run();
    expect(again.generated).toEqual([]);
    expect(voice.requests).toHaveLength(spent);
    expect(await core.manifests.load(videoId)).toEqual(before);
    // Forcing a regeneration would buy speech, so that still needs a recorded choice.
    await expect(run({ force: true })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(voice.requests).toHaveLength(spent);
  });

  it("hashes plain narration exactly as before presets existed, so renders are not sent back", async () => {
    await run();
    const manifest = await core.manifests.load(videoId);
    const plan = (await run({ dryRun: true })).plan;
    const legacyVoice: Record<string, unknown> = { ...manifest.voice };
    delete legacyVoice.preset;
    delete legacyVoice.finishing;
    // The formula the voice stage used before `preset` and `finishing` were added.
    expect(manifest.stages.voice.inputHash).toBe(
      hashOf({
        voice: legacyVoice,
        keys: plan.items.map((item) => [item.sceneId, item.cacheKey]),
      }),
    );
    // A later stage that completed must survive a no-op narrate, whatever finishing says.
    await core.manifests.save({
      ...manifest,
      voice: { ...manifest.voice, finishing: { ...manifest.voice.finishing, compression: true } },
      stages: { ...manifest.stages, motion: { ...manifest.stages.motion, status: "completed" } },
    });
    await run();
    expect((await core.manifests.load(videoId)).stages.motion.status).toBe("completed");
  });

  it("refuses a preset typed into the manifest without a recorded choice", async () => {
    const manifest = await core.manifests.load(videoId);
    await core.manifests.save({
      ...manifest,
      voice: { ...manifest.voice, preset: "technical-expert" },
    });
    await expect(run()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("refuses when the chosen preset is not the one being narrated", async () => {
    await writeDirection();
    await auditionAll();
    await select("natural-educator");
    await approve();
    await expect(run({ preset: "technical-expert" })).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
    });
  });

  it("refuses when the wording was approved before the direction existed", async () => {
    await writeDirection();
    await auditionAll();
    await select();
    const requestsAfterAudition = voice.requests.length;
    await expect(run()).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
      message: expect.stringContaining("spoken wording or voice direction changed") as string,
    });
    expect(voice.requests).toHaveLength(requestsAfterAudition);
  });

  it("voids the approval when a spoken word changes afterwards", async () => {
    await writeDirection();
    await auditionAll();
    await select();
    await approve();
    await writeDirection({ spoken: "Someone signs up twice. With other details.", pauses: [] });
    await expect(run()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("voids the approval when only a pause changes", async () => {
    await writeDirection();
    await auditionAll();
    await select();
    await approve();
    await writeDirection({ pauses: [] });
    await expect(run()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("lets a dry run cost any preset before anything is chosen or approved", async () => {
    await writeDirection();
    const result = await run({ dryRun: true, preset: "natural-educator" });
    expect(result.plan.preset).toBe("natural-educator");
    expect(result.plan.items.every((item) => item.state === "missing")).toBe(true);
    const hook = result.plan.items.find((item) => item.sceneId === "hook");
    expect(result.plan.cost.characters).toBeGreaterThan(HOOK_SPOKEN.length);
    expect(hook?.characters).toBe(hook?.requestText.length);
    expect(voice.requests).toHaveLength(0);
  });
});

describe("performed narration", () => {
  beforeEach(async () => {
    await writeDirection();
    await auditionAll();
    await select();
    await approve();
    voice.requests.length = 0;
  });

  it("speaks undirected scenes as scripted, in the preset's style and settings", async () => {
    await run();
    // The hook was already bought by the audition, so only the other scenes are requested.
    const [demo] = voice.requests;
    expect(demo?.text).toBe(
      "[warm, conversational] Here is the setting that sends a matching face to review.",
    );
    expect(demo?.text).not.toContain("<break");
    expect(demo?.voice.stability).toBe(0.45);
  });

  it("sends the neighbouring scenes as context, in their spoken wording", async () => {
    await run();
    const [demo, cta] = voice.requests;
    expect(demo?.previousText).toBe(HOOK_SPOKEN);
    expect(demo?.nextText).toBe("Start free at example dot com.");
    expect(cta?.nextText).toBeUndefined();
  });

  it("stores plain spoken words with real times, so captions never show a tag", async () => {
    await run();
    const paths = core.layout.video(videoId);
    const words = (await core.files.readJson(paths.absolute("audio/hook.words.json"))) as {
      text: string;
      startSeconds: number;
    }[];
    expect(words.map((word) => word.text).join(" ")).toBe(HOOK_SPOKEN);
    expect(words[0]?.startSeconds).toBeCloseTo("[warm, conversational, calm] ".length * 0.05, 5);
  });

  it("records the preset and both hashes, keeping the clip tied to its script scene", async () => {
    await run();
    const asset = (await core.manifests.load(videoId)).assets.narration.hook;
    expect(asset?.preset).toBe("natural-educator");
    expect(asset?.textHash).toBe(sha256(HOOK_SCRIPT));
    expect(asset?.spokenHash).toBe(sha256(HOOK_SPOKEN));
    expect(asset?.characters).toBeGreaterThan(HOOK_SPOKEN.length);
  });

  it("serves the auditioned scene from cache only when it is the same request", async () => {
    const result = await run();
    // The audition spoke the whole hook with the same direction and preset, so it is free.
    expect(result.restoredFromCache).toEqual(["hook"]);
    expect(result.generated).toEqual(["demo", "cta"]);
  });

  it("does not spend again when nothing about the voice changed", async () => {
    await run();
    const spent = voice.requests.length;
    const again = await run();
    expect(again.generated).toEqual([]);
    expect(voice.requests).toHaveLength(spent);
  });

  it("keeps a ledger of characters, credits, seconds, cache hits and regenerations", async () => {
    const before = (await core.manifests.load(videoId)).usage;
    await run();
    const first = (await core.manifests.load(videoId)).usage;
    const sent = voice.requests.reduce((total, request) => total + request.text.length, 0);
    expect(first.synthesisedCharacters - before.synthesisedCharacters).toBe(sent);
    expect(first.credits - before.credits).toBe(sent);
    expect(first.synthesisRequests - before.synthesisRequests).toBe(2);
    expect(first.generatedSeconds - before.generatedSeconds).toBe(8);
    expect(first.cacheHits - before.cacheHits).toBe(1);
    expect(first.regenerations).toBe(0);
    await run({ sceneIds: ["demo"], force: true });
    expect((await core.manifests.load(videoId)).usage.regenerations).toBe(1);
  });

  it("uses a clip exactly as generated when its level is already on target", async () => {
    await run();
    expect(sound.finished).toHaveLength(0);
    const asset = (await core.manifests.load(videoId)).assets.narration.demo;
    expect(asset?.loudness).toEqual({ integratedLufs: -23, truePeakDbtp: -8, gainDb: 0 });
  });
});

describe("per-clip finishing", () => {
  it("levels a quiet clip with one fixed gain and leaves the cached original alone", async () => {
    setup(-27);
    await writeDirection();
    await auditionAll();
    await select();
    await approve();
    await run();
    expect(sound.finished.length).toBeGreaterThan(0);
    expect(sound.finished.every((request) => request.gainDb === 4 && !request.compression)).toBe(
      true,
    );
    expect(sound.finished.every((request) => request.input.includes(".cache"))).toBe(true);
    const asset = (await core.manifests.load(videoId)).assets.narration.demo;
    expect(asset?.loudness?.gainDb).toBe(4);
  });

  it("is skipped for plain narration, which stays byte-identical to what was generated", async () => {
    setup(-27);
    await run();
    expect(sound.finished).toHaveLength(0);
    expect((await core.manifests.load(videoId)).assets.narration.hook?.loudness).toBeUndefined();
  });
});

describe("auditions", () => {
  it("shows the passage and cost on a dry run without generating", async () => {
    await writeDirection();
    const result = await auditionAll(true);
    expect(result.dryRun).toBe(true);
    expect(result.passage).toBe(HOOK_SPOKEN);
    expect(result.samples).toHaveLength(2);
    expect(result.cost.credits).toBe(
      result.samples.reduce((n, sample) => n + sample.characters, 0),
    );
    expect(voice.requests).toHaveLength(0);
    expect(await loadAudition(core, videoId)).toBeNull();
  });

  it("speaks the same words in every preset and differs only in direction", async () => {
    await writeDirection();
    const result = await auditionAll();
    expect(voice.requests.map((request) => request.text)).toEqual([
      "[warm, conversational, calm] Someone signs up twice. [pause] With different details.",
      "[clear, precise, even pace, calm] Someone signs up twice.\n\n With different details.",
    ]);
    expect(voice.requests.map((request) => request.voice.stability)).toEqual([0.45, 0.6]);
    expect(
      result.record?.samples.map((sample) => sample.wordTimings.map((w) => w.text).join(" ")),
    ).toEqual([HOOK_SPOKEN, HOOK_SPOKEN]);
  });

  it("is free the second time", async () => {
    await writeDirection();
    await auditionAll();
    const again = await auditionAll();
    expect(voice.requests).toHaveLength(2);
    expect(again.samples.every((sample) => sample.cached)).toBe(true);
    expect(again.record?.spend).toEqual({ characters: 0, credits: 0, seconds: 0 });
  });

  it("writes samples, a comparison with players and the listening checklist", async () => {
    await writeDirection();
    const result = await auditionAll();
    const paths = core.layout.video(videoId);
    expect(
      await core.files.exists(paths.absolute("audio/auditions/hook-natural-educator.mp3")),
    ).toBe(true);
    expect(
      await core.files.exists(paths.absolute("audio/auditions/hook-technical-expert.mp3")),
    ).toBe(true);
    const page = (await core.files.readText(result.report?.html ?? "")) ?? "";
    expect(page).toContain('src="../../audio/auditions/hook-natural-educator.mp3"');
    expect(page).toContain("Nothing on this page rates how natural a sample sounds");
    expect(page).toContain("Listening checklist");
    const text = (await core.files.readText(result.report?.markdown ?? "")) ?? "";
    expect(text).toContain("| Natural Educator |");
    expect(text).toContain("REVEAL after");
    expect(text).not.toContain("—");
  });

  it("measures each directed pause against what was asked", async () => {
    await writeDirection();
    const result = await auditionAll();
    const [pause] = result.record?.samples[0]?.directedPauses ?? [];
    expect(pause).toMatchObject({ kind: "REVEAL", rendering: "tag", targetSeconds: 1.1 });
    // " [pause]" is eight characters and the space after it one more, at 50 ms each.
    expect(pause?.measuredSeconds).toBeCloseTo(0.45, 5);
    // The fake waveform has no silence there, so the audio reading is zero, not missing.
    expect(pause?.audioSeconds).toBe(0);
  });

  it("adds a free before sample cut from the narration the video already has", async () => {
    await run();
    const spent = voice.requests.length;
    await writeDirection();
    const result = await auditionAll();
    expect(result.record?.before?.file).toBe("audio/auditions/hook-before.mp3");
    expect(result.record?.before?.credits).toBe(0);
    expect(sound.cuts).toHaveLength(1);
    expect(voice.requests).toHaveLength(spent + 2);
  });

  it("changes only the ledger: narration assets, voice and approvals stay as they were", async () => {
    await run();
    await writeDirection();
    const before = await core.manifests.load(videoId);
    await auditionAll();
    const after = await core.manifests.load(videoId);
    expect(after.assets).toEqual(before.assets);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.voice).toEqual(before.voice);
    expect(after.voiceSelection).toBeNull();
    expect(after.usage.synthesisRequests).toBe(before.usage.synthesisRequests + 2);
  });

  it("refuses wording that fails its own checks, before spending anything", async () => {
    await writeDirection({ spoken: "Someone signs up nine times.", pauses: [] });
    await expect(auditionAll()).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(voice.requests).toHaveLength(0);
  });

  it("limits the passage length and the number of samples", async () => {
    await expect(
      audition(deps, {
        videoId,
        presets: ["natural-educator"],
        maxCharacters: AUDITION_CHARACTER_LIMIT + 1,
        dryRun: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      audition(deps, {
        videoId,
        presets: [
          "natural-educator",
          "technical-expert",
          "cinematic-storyteller",
          "product-walkthrough",
        ],
        voiceIds: ["a", "b"],
        maxCharacters: 300,
        dryRun: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("cuts a long scene at a sentence end", () => {
    expect(passageWithin("One two. Three four five. Six.", 26)).toBe("One two. Three four five.");
    expect(passageWithin("One two. Three four five. Six.", 100)).toBe(
      "One two. Three four five. Six.",
    );
    expect(passageWithin("Averyveryverylongword", 5)).toBe("Avery");
  });
});

describe("selectVoice", () => {
  it("refuses a choice nobody could have listened to", async () => {
    await expect(select()).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await writeDirection();
    await auditionAll();
    await expect(
      selectVoice(core, {
        videoId,
        preset: "cinematic-storyteller",
        selectedBy: "Owner",
        note: "",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
  });

  it("records who chose what, from which audition, and makes it the video's preset", async () => {
    await writeDirection();
    const result = await auditionAll();
    const selection = await select("technical-expert");
    const manifest = await core.manifests.load(videoId);
    expect(selection).toMatchObject({
      preset: "technical-expert",
      selectedBy: "Owner",
      voiceId: "voice-default",
      modelId: "eleven_v4",
      auditionId: result.record?.auditionId,
    });
    expect(manifest.voice.preset).toBe("technical-expert");
    expect(manifest.voiceSelection).toEqual(selection);
    expect(manifest.history.at(-1)?.event).toBe("performance selected");
  });

  it("does not touch narration assets or approvals", async () => {
    await run();
    await writeDirection();
    await auditionAll();
    const before = await core.manifests.load(videoId);
    await select();
    const after = await core.manifests.load(videoId);
    expect(after.assets.narration).toEqual(before.assets.narration);
    expect(after.approvals).toEqual(before.approvals);
  });
});

describe("direction files and reports", () => {
  it("drafts a direction file once and refuses to overwrite hand edits", async () => {
    const drafted = await scaffoldVoiceDirection(core, { videoId, author: "Tester", force: false });
    expect(drafted.scenes).toBe(3);
    await expect(
      scaffoldVoiceDirection(core, { videoId, author: "Tester", force: false }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      scaffoldVoiceDirection(core, { videoId, author: "Tester", force: true }),
    ).resolves.toBeDefined();
  });

  it("reports an unreadable direction file as a validation failure", async () => {
    await core.files.writeJson(voiceDirectionFile(core.layout, videoId), { schemaVersion: 7 });
    await expect(checkVoiceDirection(core, videoId)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("writes a report showing each line with its direction, and the composition pauses", async () => {
    await writeDirection({
      pauses: [
        { kind: "REVEAL", after: "signs up twice.", why: "The point." },
        { kind: "TRANSITION", at: "end", why: "Next idea." },
      ],
    });
    const report = await writeDirectionReport(core, {
      videoId,
      presetId: "natural-educator",
      modelId: "eleven_v4",
    });
    const text = (await core.files.readText(report.files.markdown)) ?? "";
    expect(text).toContain(`Script: ${HOOK_SCRIPT}`);
    expect(text).toContain(`Spoken: ${HOOK_SPOKEN}`);
    expect(text).toContain('REVEAL after "signs up twice.": target 1.10s, pause tag. The point.');
    expect(text).toContain("TRANSITION after the scene: target 0.80s, silence at composition");
    expect(text).toContain("_No direction: spoken exactly as written in the script._");
    expect(text).not.toContain("—");
    expect(await core.files.readJson(report.files.composition)).toEqual({
      hook: { leadInSeconds: 0, tailSeconds: 0.8 },
    });
    expect((await core.files.readText(report.files.html)) ?? "").toContain("Sent to the model");
  });
});

describe("measureNarration", () => {
  it("reports loudness, pace and edges for every clip without changing any", async () => {
    await run();
    const before = await core.manifests.load(videoId);
    const report = await measureNarration(deps, videoId);
    expect(report.rows.map((row) => row.sceneId)).toEqual(["hook", "demo", "cta"]);
    expect(report.loudness?.spreadLu).toBe(0);
    expect(report.rows[0]?.trailingSilenceSeconds).toBeCloseTo(0.2, 5);
    expect((await core.files.readText(report.files.markdown)) ?? "").toContain("| hook |");
    expect(await core.manifests.load(videoId)).toEqual(before);
  });
});
