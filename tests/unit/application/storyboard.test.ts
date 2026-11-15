import { beforeEach, describe, expect, it } from "vitest";
import {
  checkScript,
  requireCurrentStoryboard,
  syncStoryboard,
  updateStoryboard,
} from "../../../src/application/authoring";
import { renderStoryboardPreview } from "../../../src/application/storyboard-preview";
import { TemplateSchema } from "../../../src/application/templates";
import { hashOf } from "../../../src/domain/hash";
import { parseScript } from "../../../src/domain/script";
import { createTestCore, type TestCore } from "../../helpers/fakes";
import { createApprovedVideo, scriptMarkdown, TEMPLATE } from "../../helpers/video";

const template = TemplateSchema.parse(TEMPLATE);
const scriptOf = (markdown = scriptMarkdown()) => {
  const script = parseScript(markdown);
  return { script, hash: hashOf(script) };
};

describe("syncStoryboard", () => {
  const { script, hash } = scriptOf();
  const first = syncStoryboard("v", script, hash, null, template);

  it("creates a scene for every script scene, with the template's visual", () => {
    const scenes = first.cuts[0]?.scenes ?? [];
    expect(scenes.map((scene) => scene.id)).toEqual(["hook", "demo", "cta"]);
    expect(scenes[1]?.visual).toMatchObject({ kind: "product", scenarioId: "synthetic-smoke" });
    expect(scenes[0]?.narration).toBe("A user signs up twice with different details.");
    expect(first.scriptHash).toBe(hash);
  });

  it("keeps visual work when only narration changes", () => {
    const designed = structuredClone(first);
    const hook = designed.cuts[0]?.scenes[0];
    if (!hook) throw new Error("no hook");
    hook.visual = {
      kind: "statement",
      headline: "Hand-tuned headline",
      points: [],
      tone: "warning",
    };
    const revised = scriptOf(scriptMarkdown({ hook: "A rewritten hook." }));
    const synced = syncStoryboard("v", revised.script, revised.hash, designed, template);
    expect(synced.cuts[0]?.scenes[0]?.visual).toMatchObject({
      headline: "Hand-tuned headline",
      tone: "warning",
    });
    expect(synced.cuts[0]?.scenes[0]?.narration).toBe("A rewritten hook.");
    expect(synced.version).toBe(first.version + 1);
  });

  it("follows the script's scene order", () => {
    const reordered = scriptMarkdown();
    const [head, rest] = reordered.split("## hook (PROBLEM)");
    const [hookBody, afterHook] = (rest ?? "").split("## demo (DEMO)");
    const [demoBody, ctaPart] = (afterHook ?? "").split("## cta (CTA)");
    const swapped = `${head}## demo (DEMO)${demoBody}## hook (PROBLEM)${hookBody}## cta (CTA)${ctaPart}`;
    const revised = scriptOf(swapped);
    const synced = syncStoryboard("v", revised.script, revised.hash, first, template);
    expect(synced.cuts[0]?.scenes.map((scene) => scene.id)).toEqual(["demo", "hook", "cta"]);
  });

  it("drops scenes removed from the script and keeps a disabled flag on the rest", () => {
    const withDisabled = structuredClone(first);
    const cta = withDisabled.cuts[0]?.scenes[2];
    if (!cta) throw new Error("no cta");
    cta.enabled = false;
    const shorter = scriptOf(scriptMarkdown().replace(/## demo \(DEMO\)[\s\S]*?(?=## cta)/, ""));
    const synced = syncStoryboard("v", shorter.script, shorter.hash, withDisabled, template);
    expect(synced.cuts[0]?.scenes.map((scene) => [scene.id, scene.enabled])).toEqual([
      ["hook", true],
      ["cta", false],
    ]);
  });

  it("does not bump the version when nothing changed", () => {
    expect(syncStoryboard("v", script, hash, first, template).version).toBe(first.version);
  });

  it("gives a scene unknown to the template a sensible default visual", () => {
    const extra = scriptOf(
      scriptMarkdown().replace(
        "## cta (CTA)",
        "## why (EXPLANATION) — Why it matters\n\nBecause.\n\n## cta (CTA)",
      ),
    );
    const synced = syncStoryboard("v", extra.script, extra.hash, null, template);
    expect(synced.cuts[0]?.scenes.find((scene) => scene.id === "why")?.visual).toMatchObject({
      kind: "statement",
      headline: "Why it matters",
    });
  });
});

describe("updateStoryboard", () => {
  let core: TestCore;
  let videoId: string;
  beforeEach(async () => {
    core = createTestCore();
    videoId = await createApprovedVideo(core);
  });

  it("writes a preview page that escapes script text", async () => {
    core.files.seed(
      core.layout.video(videoId).script,
      scriptMarkdown({ hook: "Is 2 < 3 & <script>alert(1)</script>?" }),
    );
    await checkScript(core, videoId);
    const result = await updateStoryboard(core, videoId, [], renderStoryboardPreview);
    const page = (await core.files.readText(result.previewFile)) ?? "";
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(page).not.toContain("<script>alert(1)</script>");
  });

  it("disables and re-enables a scene", async () => {
    const off = await updateStoryboard(
      core,
      videoId,
      [{ sceneId: "demo", enabled: false }],
      renderStoryboardPreview,
    );
    expect(off.storyboard.cuts[0]?.scenes.find((scene) => scene.id === "demo")?.enabled).toBe(
      false,
    );
    const on = await updateStoryboard(
      core,
      videoId,
      [{ sceneId: "demo", enabled: true }],
      renderStoryboardPreview,
    );
    expect(on.storyboard.cuts[0]?.scenes.find((scene) => scene.id === "demo")?.enabled).toBe(true);
  });

  it("rejects an edit to a scene that does not exist", async () => {
    await expect(
      updateStoryboard(
        core,
        videoId,
        [{ sceneId: "nope", enabled: false }],
        renderStoryboardPreview,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to sync against a script that has not been re-checked", async () => {
    core.files.seed(
      core.layout.video(videoId).script,
      scriptMarkdown({ hook: "Changed without running the check." }),
    );
    await expect(
      updateStoryboard(core, videoId, [], renderStoryboardPreview),
    ).rejects.toMatchObject({ code: "STAGE_BLOCKED" });
  });

  it("rejects cues that do not match the narration, naming the scene and the cue", async () => {
    const file = core.layout.video(videoId).storyboard;
    const edit = async (cues: unknown, visual?: unknown): Promise<void> => {
      const board = JSON.parse((await core.files.readText(file)) ?? "{}") as {
        cuts: { scenes: Record<string, unknown>[] }[];
      };
      const hook = board.cuts[0]?.scenes[0];
      if (!hook) throw new Error("no hook");
      hook.cues = cues;
      if (visual) hook.visual = visual;
      core.files.seed(file, JSON.stringify(board));
    };

    await edit([{ id: "twice", phrase: "signs up thrice" }]);
    const wrongPhrase = updateStoryboard(core, videoId, [], renderStoryboardPreview);
    await expect(wrongPhrase).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(wrongPhrase).rejects.toThrow(/Scene "hook", cue "twice".*signs up thrice/s);

    await edit([], { kind: "story", lines: [{ text: "One", cue: "undefined-cue" }] });
    await expect(updateStoryboard(core, videoId, [], renderStoryboardPreview)).rejects.toThrow(
      /Scene "hook".*"undefined-cue"/s,
    );

    await edit([{ id: "twice", phrase: "signs up twice" }], {
      kind: "story",
      lines: [{ text: "One", cue: "twice" }],
    });
    const accepted = await updateStoryboard(core, videoId, [], renderStoryboardPreview);
    expect(accepted.storyboard.cuts[0]?.scenes[0]?.cues).toEqual([
      { id: "twice", phrase: "signs up twice", at: "start", offsetSeconds: 0, occurrence: 1 },
    ]);
  });

  it("keeps the hash of a storyboard that uses none of the new fields", async () => {
    const before = await requireCurrentStoryboard(core, videoId);
    const scene = before.storyboard.cuts[0]?.scenes[0];
    expect(scene && "cues" in scene).toBe(false);
    expect(scene?.animation).not.toHaveProperty("exit");
    expect(hashOf(before.storyboard.cuts)).toBe(before.manifest.storyboard.hash);
  });

  it("detects a storyboard that was hand-edited without being validated", async () => {
    const file = core.layout.video(videoId).storyboard;
    const edited = JSON.parse((await core.files.readText(file)) ?? "{}") as {
      cuts: { scenes: { enabled: boolean }[] }[];
    };
    const scene = edited.cuts[0]?.scenes[0];
    if (scene) scene.enabled = false;
    core.files.seed(file, JSON.stringify(edited));
    await expect(requireCurrentStoryboard(core, videoId)).rejects.toMatchObject({
      code: "STAGE_BLOCKED",
    });
  });
});
