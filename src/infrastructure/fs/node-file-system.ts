import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { FileEntry, FileSystem } from "../../application/ports";
import { readJson, readTextIfExists, writeFileAtomic, writeJsonAtomic } from "./atomic";

export async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

export async function fileExists(file: string): Promise<boolean> {
  return (await stat(file).catch(() => null))?.isFile() ?? false;
}

/** Every file under a directory, sorted by path so results are stable between runs. */
export async function listFiles(dir: string): Promise<FileEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  const files: FileEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    const info = await stat(file);
    files.push({ file, sizeBytes: info.size, modifiedAt: info.mtime });
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

export function createNodeFileSystem(): FileSystem {
  return {
    readText: readTextIfExists,
    writeText: writeFileAtomic,
    readJson,
    writeJson: writeJsonAtomic,
    exists: fileExists,
    sha256: sha256File,
    list: listFiles,
    async copy(from, to) {
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to, { recursive: true, force: true });
    },
    remove: (target) => rm(target, { recursive: true, force: true }),
    async ensureDir(dir) {
      await mkdir(dir, { recursive: true });
    },
  };
}
