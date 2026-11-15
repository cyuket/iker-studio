import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "../../src/application/layout";
import { StudioError } from "../../src/domain/errors";
import { createManifest } from "../../src/domain/manifest";
import { VoiceSettingsSchema } from "../../src/domain/voice";
import { readJson, writeFileAtomic, writeJsonAtomic } from "../../src/infrastructure/fs/atomic";
import { FileManifestRepository } from "../../src/infrastructure/fs/manifest-repository";
import { createNodeFileSystem } from "../../src/infrastructure/fs/node-file-system";
import { steppingClock } from "../helpers/fakes";

let root: string;
let repository: FileManifestRepository;
let workspace: Workspace;

const manifest = (id = "demo-video") =>
  createManifest({
    id,
    title: "Demo",
    topic: "Demo",
    audience: "",
    contentType: "PRODUCT_TUTORIAL",
    template: "product-tutorial",
    format: "youtube-landscape",
    durationTarget: { minSeconds: 10, maxSeconds: 60 },
    voice: VoiceSettingsSchema.parse({ provider: "silent" }),
    now: "2026-01-01T00:00:00.000Z",
  });

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "studio store "));
  workspace = new Workspace(root, "output");
  repository = new FileManifestRepository(workspace, steppingClock("2026-02-01T00:00:00.000Z"));
});

describe("atomic writes", () => {
  it("creates parent directories and leaves no temporary file behind", async () => {
    const file = path.join(root, "a", "b", "data.json");
    await writeJsonAtomic(file, { ok: true });
    expect(await readJson(file)).toEqual({ ok: true });
    expect(await readdir(path.dirname(file))).toEqual(["data.json"]);
  });

  it("replaces the whole file rather than writing into it", async () => {
    const file = path.join(root, "data.txt");
    await writeFileAtomic(file, "a much longer first version of the content");
    await writeFileAtomic(file, "short");
    expect(await readFile(file, "utf8")).toBe("short");
  });

  it("keeps the previous file intact when a write cannot complete", async () => {
    const file = path.join(root, "data.txt");
    await writeFileAtomic(file, "original");
    // A directory where the temporary file's parent should be makes the write fail early.
    await expect(writeFileAtomic(path.join(file, "nested.txt"), "new")).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe("original");
  });

  it("distinguishes a missing file from an unparseable one", async () => {
    await expect(readJson(path.join(root, "missing.json"))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const broken = path.join(root, "broken.json");
    await writeFile(broken, '{"truncated": ');
    await expect(readJson(broken)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("FileManifestRepository", () => {
  it("round-trips a manifest and stamps the update time", async () => {
    await repository.save(manifest());
    const loaded = await repository.load("demo-video");
    expect(loaded.title).toBe("Demo");
    expect(loaded.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(loaded.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("writes to output/<id>/manifest.json, in a path that contains a space", async () => {
    await repository.save(manifest());
    const file = path.join(root, "output", "demo-video", "manifest.json");
    expect((await stat(file)).isFile()).toBe(true);
    expect(root).toContain(" ");
  });

  it("lists videos and ignores directories without a manifest", async () => {
    await repository.save(manifest("b-video"));
    await repository.save(manifest("a-video"));
    await createNodeFileSystem().ensureDir(path.join(root, "output", "not-a-video"));
    expect(await repository.list()).toEqual(["a-video", "b-video"]);
  });

  it("refuses to persist an invalid manifest, leaving the stored one untouched", async () => {
    await repository.save(manifest());
    const invalid = { ...manifest(), format: "imax" } as unknown as ReturnType<typeof manifest>;
    await expect(repository.save(invalid)).rejects.toBeInstanceOf(StudioError);
    expect((await repository.load("demo-video")).format).toBe("youtube-landscape");
  });

  it("reports a corrupt manifest with the file path instead of crashing", async () => {
    await repository.save(manifest());
    await writeFile(
      workspace.video("demo-video").manifest,
      JSON.stringify({ schemaVersion: 1, id: "demo-video" }),
    );
    await expect(repository.load("demo-video")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("manifest.json") as string,
    });
  });

  it("names the videos that do exist when asked for one that does not", async () => {
    await repository.save(manifest("real-video"));
    await expect(repository.load("typo")).rejects.toMatchObject({
      code: "NOT_FOUND",
      hint: "Known videos: real-video",
    });
  });
});

describe("node file system", () => {
  const files = createNodeFileSystem();

  it("hashes file contents and lists files in a stable order", async () => {
    await files.writeText(path.join(root, "x", "b.txt"), "b");
    await files.writeText(path.join(root, "x", "a.txt"), "a");
    const listed = await files.list(path.join(root, "x"));
    expect(listed.map((entry) => path.basename(entry.file))).toEqual(["a.txt", "b.txt"]);
    expect(await files.sha256(path.join(root, "x", "a.txt"))).toBe(
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    );
  });

  it("returns null for a missing text file and an empty list for a missing directory", async () => {
    expect(await files.readText(path.join(root, "nope.txt"))).toBeNull();
    expect(await files.list(path.join(root, "nope"))).toEqual([]);
  });

  it("copies directories and removes them recursively", async () => {
    await files.writeText(path.join(root, "src", "deep", "f.txt"), "content");
    await files.copy(path.join(root, "src"), path.join(root, "dst"));
    expect(await files.readText(path.join(root, "dst", "deep", "f.txt"))).toBe("content");
    await files.remove(path.join(root, "dst"));
    expect(await files.exists(path.join(root, "dst", "deep", "f.txt"))).toBe(false);
  });
});
