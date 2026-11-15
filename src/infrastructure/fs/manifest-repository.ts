import { readdir } from "node:fs/promises";
import type { Clock, ManifestRepository } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { parseManifest, type Manifest } from "../../domain/manifest";
import { readJson, writeJsonAtomic } from "./atomic";
import type { Workspace } from "../../application/layout";
import { fileExists } from "./node-file-system";

export class FileManifestRepository implements ManifestRepository {
  constructor(
    private readonly workspace: Workspace,
    private readonly clock: Clock,
  ) {}

  exists(videoId: string): Promise<boolean> {
    return fileExists(this.workspace.video(videoId).manifest);
  }

  async load(videoId: string): Promise<Manifest> {
    const file = this.workspace.video(videoId).manifest;
    if (!(await fileExists(file))) {
      const known = await this.list();
      throw new StudioError("NOT_FOUND", `There is no video with the id "${videoId}".`, {
        hint: known.length
          ? `Known videos: ${known.join(", ")}`
          : 'Create one with `pnpm studio create --topic "..."`.',
      });
    }
    return parseManifest(await readJson(file), file);
  }

  async save(manifest: Manifest): Promise<void> {
    const updated = { ...manifest, updatedAt: this.clock.now().toISOString() };
    // Validate on the way out as well, so an invalid manifest can never be persisted.
    parseManifest(updated, "manifest");
    await writeJsonAtomic(this.workspace.video(manifest.id).manifest, updated);
  }

  async list(): Promise<string[]> {
    const entries = await readdir(this.workspace.outputRoot, { withFileTypes: true }).catch(
      () => [],
    );
    const ids: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && (await this.exists(entry.name))) ids.push(entry.name);
    }
    return ids.sort();
  }
}
