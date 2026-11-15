import { beforeEach, describe, expect, it } from "vitest";
import { runStage } from "../../../src/application/pipeline";
import { StudioError } from "../../../src/domain/errors";
import { createManifest, type Manifest } from "../../../src/domain/manifest";
import { VoiceSettingsSchema } from "../../../src/domain/voice";
import { createTestCore, type TestCore } from "../../helpers/fakes";

const A = "a".repeat(64);
const B = "b".repeat(64);
const VIDEO = "demo-video";

let core: TestCore;

async function seed(mutate: (manifest: Manifest) => Manifest = (m) => m): Promise<void> {
  await core.manifests.save(
    mutate(
      createManifest({
        id: VIDEO,
        title: "Demo",
        topic: "Demo",
        audience: "",
        contentType: "PRODUCT_TUTORIAL",
        template: "test-template",
        format: "youtube-landscape",
        durationTarget: { minSeconds: 10, maxSeconds: 60 },
        voice: VoiceSettingsSchema.parse({ provider: "silent" }),
        now: "2026-01-01T00:00:00.000Z",
      }),
    ),
  );
}

const complete = (manifest: Manifest, ...stages: (keyof Manifest["stages"])[]): Manifest => ({
  ...manifest,
  stages: {
    ...manifest.stages,
    ...Object.fromEntries(
      stages.map((s) => [s, { ...manifest.stages[s], status: "completed", inputHash: A }]),
    ),
  },
});

beforeEach(() => {
  core = createTestCore();
});

describe("runStage", () => {
  it("runs the work, then records the stage as completed with its input hash", async () => {
    await seed();
    const run = await runStage(core, VIDEO, "idea", A, {}, (manifest) =>
      Promise.resolve({ manifest, result: 42 }),
    );
    expect(run).toMatchObject({ skipped: false, result: 42 });
    expect(run.manifest.stages.idea).toMatchObject({
      status: "completed",
      inputHash: A,
      attempts: 1,
      error: null,
    });
    expect(run.manifest.history.at(-1)).toMatchObject({ stage: "idea", event: "completed" });
  });

  it("skips work when the stage already completed for identical inputs", async () => {
    await seed();
    let calls = 0;
    const work = (manifest: Manifest) => Promise.resolve({ manifest, result: ++calls });
    await runStage(core, VIDEO, "idea", A, {}, work);
    const second = await runStage(core, VIDEO, "idea", A, {}, work);
    expect(second.skipped).toBe(true);
    expect(calls).toBe(1);
  });

  it("runs again when the inputs change, and marks downstream stages pending", async () => {
    await seed((manifest) => complete(manifest, "idea", "research", "script", "storyboard"));
    const run = await runStage(core, VIDEO, "script", B, {}, (manifest) =>
      Promise.resolve({ manifest, result: null }),
    );
    expect(run.skipped).toBe(false);
    expect(run.manifest.stages.script.inputHash).toBe(B);
    expect(run.manifest.stages.storyboard.status).toBe("pending");
    expect(run.manifest.stages.research.status).toBe("completed");
  });

  it("runs again with --force even when nothing changed", async () => {
    await seed();
    let calls = 0;
    const work = (manifest: Manifest) => Promise.resolve({ manifest, result: ++calls });
    await runStage(core, VIDEO, "idea", A, {}, work);
    await runStage(core, VIDEO, "idea", A, { force: true }, work);
    expect(calls).toBe(2);
  });

  it("refuses to start before its prerequisite stage is complete, and says which command to run", async () => {
    await seed();
    const attempt = runStage(core, VIDEO, "storyboard", A, {}, (manifest) =>
      Promise.resolve({ manifest, result: null }),
    );
    await expect(attempt).rejects.toMatchObject({
      code: "STAGE_BLOCKED",
      hint: expect.stringContaining("pnpm studio script") as string,
    });
    expect((await core.manifests.load(VIDEO)).stages.storyboard.status).toBe("pending");
  });

  it("marks the stage running before any work happens, so an interrupted run is visible", async () => {
    await seed();
    let seenWhileWorking = "";
    await runStage(core, VIDEO, "idea", A, {}, async (manifest) => {
      seenWhileWorking = (await core.manifests.load(VIDEO)).stages.idea.status;
      return { manifest, result: null };
    });
    expect(seenWhileWorking).toBe("running");
  });
});

describe("failed-stage recovery", () => {
  it("records the failure and its reason, then rethrows", async () => {
    await seed();
    const failure = new StudioError("EXTERNAL_SERVICE", "ElevenLabs returned HTTP 503.");
    await expect(runStage(core, VIDEO, "idea", A, {}, () => Promise.reject(failure))).rejects.toBe(
      failure,
    );
    const state = (await core.manifests.load(VIDEO)).stages.idea;
    expect(state).toMatchObject({
      status: "failed",
      attempts: 1,
      error: { code: "EXTERNAL_SERVICE", message: "ElevenLabs returned HTTP 503." },
    });
  });

  it("keeps work checkpointed before the failure", async () => {
    await seed();
    await expect(
      runStage(core, VIDEO, "idea", A, {}, async (manifest, checkpoint) => {
        await checkpoint({ ...manifest, usage: { ...manifest.usage, synthesisedCharacters: 120 } });
        throw new Error("crashed on the second scene");
      }),
    ).rejects.toThrow("crashed on the second scene");
    const after = await core.manifests.load(VIDEO);
    expect(after.usage.synthesisedCharacters).toBe(120);
    expect(after.stages.idea.status).toBe("failed");
  });

  it("retries a failed stage and clears the error on success", async () => {
    await seed();
    await expect(
      runStage(core, VIDEO, "idea", A, {}, () => Promise.reject(new Error("first try"))),
    ).rejects.toThrow();
    const retry = await runStage(core, VIDEO, "idea", A, {}, (manifest) =>
      Promise.resolve({ manifest, result: "ok" }),
    );
    expect(retry.result).toBe("ok");
    expect(retry.manifest.stages.idea).toMatchObject({
      status: "completed",
      attempts: 2,
      error: null,
    });
  });

  it("resumes a stage left running by a crash instead of treating it as done", async () => {
    await seed((manifest) => ({
      ...manifest,
      stages: {
        ...manifest.stages,
        idea: { ...manifest.stages.idea, status: "running", inputHash: A, attempts: 1 },
      },
    }));
    let ran = false;
    await runStage(core, VIDEO, "idea", A, {}, (manifest) => {
      ran = true;
      return Promise.resolve({ manifest, result: null });
    });
    expect(ran).toBe(true);
    expect((await core.manifests.load(VIDEO)).stages.idea).toMatchObject({
      status: "completed",
      attempts: 2,
    });
  });

  it("leaves a partial run pending while keeping its progress", async () => {
    await seed();
    const run = await runStage(core, VIDEO, "idea", A, {}, (manifest) =>
      Promise.resolve({
        manifest: { ...manifest, usage: { ...manifest.usage, cacheHits: 3 } },
        result: null,
        complete: false,
      }),
    );
    expect(run.manifest.stages.idea.status).toBe("pending");
    expect(run.manifest.usage.cacheHits).toBe(3);
  });
});
