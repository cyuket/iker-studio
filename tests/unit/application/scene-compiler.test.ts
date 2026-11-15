import { beforeEach, describe, expect, it } from "vitest";
import { requireCurrentStoryboard } from "../../../src/application/authoring";
import type { LoadedBrand } from "../../../src/application/context";
import { narrate } from "../../../src/application/narration";
import type { AssetServer } from "../../../src/application/ports";
import {
  buildSceneProps,
  compileCut,
  SYNTHETIC_DISCLOSURE,
  type CompileContext,
} from "../../../src/application/scene-compiler";
import { BrandSchema } from "../../../src/domain/brand";
import type { Manifest } from "../../../src/domain/manifest";
import type { Cut } from "../../../src/domain/storyboard";
import brandJson from "../../../brand/brand.json";
import { countingSynthesizer, createTestCore, fakeMedia, type TestCore } from "../../helpers/fakes";
import { createApprovedVideo } from "../../helpers/video";

const brand: LoadedBrand = {
  brand: BrandSchema.parse(brandJson),
  hash: "brand-1",
  logoFiles: { mark: null, wordmark: "/project/brand/logo/wordmark.png" },
};
const assets: AssetServer = {
  urlFor: (file) => `http://127.0.0.1:9999${file}`,
  close: () => Promise.resolve(),
};
const HASH = "c".repeat(64);

let core: TestCore;
let videoId: string;
let manifest: Manifest;
let cut: Cut;

function withRecording(target: "synthetic" | "iker", durationSeconds = 6): Manifest {
  const paths = core.layout.video(videoId);
  core.files.seed(
    paths.absolute("recordings/synthetic-smoke/timeline.json"),
    JSON.stringify({
      schemaVersion: 1,
      scenarioId: "synthetic-smoke",
      target,
      viewport: { width: 1440, height: 900 },
      durationSeconds,
      events: [],
    }),
  );
  return {
    ...manifest,
    assets: {
      ...manifest.assets,
      recordings: {
        "synthetic-smoke": {
          hash: HASH,
          target,
          displayHost: "demo-console.example",
          verified: true,
          video: "recordings/synthetic-smoke/recording.mp4",
          timeline: "recordings/synthetic-smoke/timeline.json",
          screenshots: { overview: "recordings/synthetic-smoke/screenshots/overview.png" },
          durationSeconds,
          viewport: { width: 1440, height: 900 },
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
  };
}

const context = (overrides: Partial<CompileContext> = {}): CompileContext => ({
  manifest,
  brand,
  rendererHash: "renderer-1",
  fps: null,
  reducedMotion: false,
  resolutionScale: 1,
  ...overrides,
});

beforeEach(async () => {
  core = createTestCore();
  videoId = await createApprovedVideo(core);
  const voice = countingSynthesizer(core.files);
  await narrate(
    {
      ...core,
      media: fakeMedia(4),
      synthesizer: () => voice.synthesizer,
      usdPerThousandCredits: () => null,
    },
    { videoId, dryRun: false, force: false },
  );
  const current = await requireCurrentStoryboard(core, videoId);
  manifest = current.manifest;
  const first = current.storyboard.cuts[0];
  if (!first) throw new Error("no cut");
  cut = first;
  manifest = withRecording("synthetic");
});

describe("compileCut", () => {
  it("names exactly what is missing and the command that produces it", async () => {
    const bare = { ...manifest, assets: { ...manifest.assets, narration: {}, recordings: {} } };
    const attempt = compileCut(core, context({ manifest: bare }), cut);
    await expect(attempt).rejects.toMatchObject({ code: "STAGE_BLOCKED" });
    await expect(attempt).rejects.toThrow(/narration for scene "hook".*pnpm studio narrate/s);
    await expect(attempt).rejects.toThrow(/recording "synthetic-smoke".*pnpm studio record/s);
  });

  it("refuses to render a clip whose words no longer match the script", async () => {
    const hook = cut.scenes[0];
    if (!hook) throw new Error("no scene");
    const reworded: Cut = {
      ...cut,
      scenes: [{ ...hook, narration: "Entirely different words." }, ...cut.scenes.slice(1)],
    };
    await expect(compileCut(core, context(), reworded)).rejects.toThrow(
      /up-to-date narration for scene "hook".*pnpm studio narrate/s,
    );
  });

  it("times scenes from measured narration and lets a recording extend its scene", async () => {
    const compiled = await compileCut(core, context(), cut);
    const [hook, demo] = compiled.timeline.scenes;
    expect(hook?.durationFrames).toBe(Math.ceil((0.4 + 4 + 0.5) * 30));
    expect(demo?.durationFrames).toBe(Math.ceil((0.4 + 6 + 0.5) * 30));
    expect(demo?.startFrame).toBe(hook?.durationFrames);
  });

  it("offsets cut-level captions by each scene's start and lead-in", async () => {
    const compiled = await compileCut(core, context(), cut);
    const demoStart = (compiled.timeline.scenes[1]?.startFrame ?? 0) / 30;
    const demoCue = compiled.cues.find((cue) =>
      cue.lines.join(" ").startsWith("Here is the setting"),
    );
    expect(demoCue?.startSeconds).toBeCloseTo(demoStart + 0.4, 5);
    expect(compiled.cues.map((cue) => cue.index)).toEqual(compiled.cues.map((_, i) => i + 1));
  });

  it("labels synthetic footage and only synthetic footage", async () => {
    const synthetic = await compileCut(core, context(), cut);
    expect(synthetic.scenes.map((scene) => scene.disclosure)).toEqual([
      null,
      SYNTHETIC_DISCLOSURE,
      null,
    ]);
    manifest = withRecording("iker");
    const real = await compileCut(core, context(), cut);
    expect(real.scenes.every((scene) => scene.disclosure === null)).toBe(true);
  });

  it("skips disabled scenes and fails when nothing is left", async () => {
    const trimmed: Cut = {
      ...cut,
      scenes: cut.scenes.map((scene) =>
        scene.id === "demo" ? { ...scene, enabled: false } : scene,
      ),
    };
    expect(
      (await compileCut(core, context(), trimmed)).scenes.map((scene) => scene.scene.id),
    ).toEqual(["hook", "cta"]);
    const none: Cut = { ...cut, scenes: cut.scenes.map((scene) => ({ ...scene, enabled: false })) };
    await expect(compileCut(core, context(), none)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});

describe("scene hashes", () => {
  const hashes = async (ctx: CompileContext, target: Cut = cut) =>
    Object.fromEntries(
      (await compileCut(core, ctx, target)).scenes.map((scene) => [scene.scene.id, scene.hash]),
    );

  it("are stable for identical inputs", async () => {
    expect(await hashes(context())).toEqual(await hashes(context()));
  });

  it("change for one scene only when that scene's visual changes", async () => {
    const before = await hashes(context());
    const edited: Cut = {
      ...cut,
      scenes: cut.scenes.map((scene) =>
        scene.id === "hook"
          ? {
              ...scene,
              visual: { kind: "statement", headline: "New headline", points: [], tone: "neutral" },
            }
          : scene,
      ),
    };
    const after = await hashes(context(), edited);
    expect(after.hook).not.toBe(before.hook);
    expect(after.demo).toBe(before.demo);
    expect(after.cta).toBe(before.cta);
  });

  it("change for every scene when styling changes, without touching narration", async () => {
    const before = await hashes(context());
    const restyled = await hashes(context({ brand: { ...brand, hash: "brand-2" } }));
    for (const id of Object.keys(before)) expect(restyled[id]).not.toBe(before[id]);
    expect(manifest.assets.narration.hook?.cacheKey).toBeDefined();
  });

  it("change when the renderer sources change", async () => {
    const before = await hashes(context());
    const after = await hashes(context({ rendererHash: "renderer-2" }));
    expect(after.hook).not.toBe(before.hook);
  });

  it("change only for the scene that uses a re-recorded scenario", async () => {
    const before = await hashes(context());
    const recording = manifest.assets.recordings["synthetic-smoke"];
    if (!recording) throw new Error("no recording");
    manifest = {
      ...manifest,
      assets: {
        ...manifest.assets,
        recordings: { "synthetic-smoke": { ...recording, hash: "d".repeat(64) } },
      },
    };
    const after = await hashes(context());
    expect(after.demo).not.toBe(before.demo);
    expect(after.hook).toBe(before.hook);
  });

  it("do not depend on where files are served from", async () => {
    const compiled = await compileCut(core, context(), cut);
    const scene = compiled.scenes[1];
    if (!scene) throw new Error("no scene");
    const props = await buildSceneProps(core, context(), compiled, scene, assets);
    const moved = await buildSceneProps(core, context(), compiled, scene, {
      ...assets,
      urlFor: (file) => `http://127.0.0.1:1${file}`,
    });
    expect(props.recording?.videoSrc).not.toBe(moved.recording?.videoSrc);
    expect((await compileCut(core, context(), cut)).scenes[1]?.hash).toBe(scene.hash);
  });
});

describe("beats", () => {
  const withCues = (cues: { id: string; phrase: string }[]): Cut => ({
    ...cut,
    scenes: cut.scenes.map((scene) =>
      scene.id === "hook"
        ? {
            ...scene,
            cues: cues.map((cue) => ({
              at: "start" as const,
              offsetSeconds: 0,
              occurrence: 1,
              ...cue,
            })),
          }
        : scene,
    ),
  });

  it("resolves a scene's cues from its word timings, measured from the scene's first frame", async () => {
    const compiled = await compileCut(
      core,
      context(),
      withCues([{ id: "twice", phrase: "signs up twice" }]),
    );
    const hook = compiled.scenes[0];
    if (!hook) throw new Error("no scene");
    expect(Object.keys(hook.beats)).toEqual(["twice"]);
    expect(hook.beats.twice).toBeGreaterThan(0.4);
    expect(hook.beats.twice).toBeLessThan(hook.timing.durationFrames / 30);
    expect((await buildSceneProps(core, context(), compiled, hook, assets)).beats).toEqual(
      hook.beats,
    );
    expect(compiled.scenes[1]?.beats).toEqual({});
  });

  it("leaves the identity of scenes without cues untouched and changes it when a cue moves", async () => {
    const hashes = async (target: Cut) =>
      Object.fromEntries(
        (await compileCut(core, context(), target)).scenes.map((s) => [s.scene.id, s.hash]),
      );
    const plain = await hashes(cut);
    const cued = await hashes(withCues([{ id: "twice", phrase: "signs up twice" }]));
    const moved = await hashes(withCues([{ id: "twice", phrase: "twice" }]));
    expect(cued.demo).toBe(plain.demo);
    expect(cued.cta).toBe(plain.cta);
    expect(cued.hook).not.toBe(plain.hook);
    expect(moved.hook).not.toBe(cued.hook);
  });

  it("refuses to render a cue whose phrase was never spoken, naming scene, cue and the words", async () => {
    const attempt = compileCut(
      core,
      context(),
      withCues([{ id: "lost", phrase: "biometric deduplication" }]),
    );
    await expect(attempt).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(attempt).rejects.toThrow(
      /Scene "hook".*cue "lost".*biometric deduplication.*signs up twice/s,
    );
  });

  it("extends a product scene so footage that starts late still plays to its end", async () => {
    const delayed: Cut = {
      ...cut,
      scenes: cut.scenes.map((scene) =>
        scene.visual.kind === "product"
          ? {
              ...scene,
              visual: {
                ...scene.visual,
                footage: { startSeconds: 5, fromSeconds: 0, anchors: [] },
              },
            }
          : scene,
      ),
    };
    const base = await compileCut(core, context(), cut);
    const late = await compileCut(core, context(), delayed);
    expect(late.timeline.scenes[1]?.durationFrames).toBe(
      (base.timeline.scenes[1]?.durationFrames ?? 0) + 5 * 30,
    );
  });
});

describe("buildSceneProps", () => {
  it("resolves narration, recording and logo files to URLs", async () => {
    const compiled = await compileCut(core, context(), cut);
    const scene = compiled.scenes[1];
    if (!scene) throw new Error("no scene");
    const props = await buildSceneProps(core, context(), compiled, scene, assets);
    const root = core.layout.video(videoId).root;
    expect(props.narration).toEqual({
      src: `http://127.0.0.1:9999${root}/audio/demo.mp3`,
      offsetFrames: 12,
      volume: 1,
    });
    expect(props.recording?.videoSrc).toBe(
      `http://127.0.0.1:9999${root}/recordings/synthetic-smoke/recording.mp4`,
    );
    expect(props.recording?.displayUrl).toBe("demo-console.example");
    expect(props.brand.logoSrc).toEqual({
      mark: null,
      wordmark: "http://127.0.0.1:9999/project/brand/logo/wordmark.png",
    });
    expect(props.disclosure).toBe(SYNTHETIC_DISCLOSURE);
    expect(props.durationFrames).toBe(scene.timing.durationFrames);
  });

  it("burns captions in only when the format or cut asks for it", async () => {
    const landscape = await compileCut(core, context(), cut);
    const first = landscape.scenes[0];
    if (!first) throw new Error("no scene");
    expect((await buildSceneProps(core, context(), landscape, first, assets)).captions).toBeNull();
    const burned = await compileCut(core, context(), { ...cut, burnCaptions: true });
    const burnedFirst = burned.scenes[0];
    if (!burnedFirst) throw new Error("no scene");
    expect(
      (await buildSceneProps(core, context(), burned, burnedFirst, assets)).captions?.length,
    ).toBeGreaterThan(0);
  });

  it("fails clearly when a scene asks for a screenshot the recording lacks", async () => {
    const wanting: Cut = {
      ...cut,
      scenes: cut.scenes.map((scene) =>
        scene.visual.kind === "product"
          ? {
              ...scene,
              visual: { ...scene.visual, mode: "screenshot", screenshot: "missing-shot" },
            }
          : scene,
      ),
    };
    const compiled = await compileCut(core, context(), wanting);
    const scene = compiled.scenes[1];
    if (!scene) throw new Error("no scene");
    await expect(buildSceneProps(core, context(), compiled, scene, assets)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: expect.stringContaining("missing-shot") as string,
      hint: "Available: overview",
    });
  });
});
