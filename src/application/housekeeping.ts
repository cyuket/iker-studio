import path from "node:path";
import { StudioError } from "../domain/errors";
import { PronunciationFileSchema, type PronunciationEntry } from "../domain/voice";
import { loadPronunciations, pronunciationFile, type CoreDeps } from "./context";

export interface CacheSummary {
  name: string;
  directory: string;
  files: number;
  sizeBytes: number;
  /** What deleting this costs: time, or money. */
  consequence: string;
}

export type CacheScope = "narration" | "renders" | "bundle";

function scopes(
  deps: CoreDeps,
  videoIds: readonly string[],
): { scope: CacheScope; name: string; directories: string[]; consequence: string }[] {
  return [
    {
      scope: "narration",
      name: "Narration cache",
      directories: [deps.layout.narrationCacheDir],
      consequence:
        "Deleting it means paying again to synthesise any clip not already copied into a video.",
    },
    {
      scope: "renders",
      name: "Scene renders",
      directories: videoIds.map((id) => deps.layout.video(id).scenes),
      consequence:
        "Deleting it costs render time only; every scene is rendered again on the next render.",
    },
    {
      scope: "bundle",
      name: "Renderer bundle cache",
      directories: [path.join(deps.layout.projectRoot, "node_modules", ".cache")],
      consequence: "Deleting it makes the next render start more slowly.",
    },
  ];
}

export async function inspectCache(deps: CoreDeps): Promise<CacheSummary[]> {
  const summaries: CacheSummary[] = [];
  for (const entry of scopes(deps, await deps.manifests.list())) {
    let files = 0;
    let sizeBytes = 0;
    for (const directory of entry.directories) {
      for (const file of await deps.files.list(directory)) {
        files++;
        sizeBytes += file.sizeBytes;
      }
    }
    summaries.push({
      name: entry.name,
      directory: entry.directories
        .map((dir) => path.relative(deps.layout.projectRoot, dir))
        .join(", "),
      files,
      sizeBytes,
      consequence: entry.consequence,
    });
  }
  return summaries;
}

/** Deletes the selected caches. Manifests are left alone: missing files are simply regenerated. */
export async function cleanCache(
  deps: CoreDeps,
  selected: readonly CacheScope[],
): Promise<string[]> {
  const removed: string[] = [];
  for (const entry of scopes(deps, await deps.manifests.list())) {
    if (!selected.includes(entry.scope)) continue;
    for (const directory of entry.directories) {
      await deps.files.remove(directory);
      removed.push(path.relative(deps.layout.projectRoot, directory));
    }
  }
  return removed;
}

export interface PronunciationUpdate {
  term: string;
  alias?: string | null;
  ipa?: string | null;
  notes?: string;
}

async function savePronunciations(deps: CoreDeps, entries: PronunciationEntry[]): Promise<void> {
  await deps.files.writeJson(
    pronunciationFile(deps.layout),
    PronunciationFileSchema.parse({ schemaVersion: 1, entries }),
  );
}

function findEntry(entries: PronunciationEntry[], term: string): PronunciationEntry {
  const entry = entries.find((candidate) => candidate.term.toLowerCase() === term.toLowerCase());
  if (!entry) {
    throw new StudioError("NOT_FOUND", `"${term}" is not in brand/pronunciations.json.`, {
      hint: `Known terms: ${entries.map((e) => e.term).join(", ")}`,
    });
  }
  return entry;
}

/** Changes how a term is spoken. Any change returns it to pending until someone listens again. */
export async function setPronunciation(
  deps: CoreDeps,
  update: PronunciationUpdate,
): Promise<PronunciationEntry> {
  const entries = await loadPronunciations(deps);
  const existing = entries.find((entry) => entry.term.toLowerCase() === update.term.toLowerCase());
  const next: PronunciationEntry = {
    term: existing?.term ?? update.term,
    status: "pending",
    alias: update.alias === undefined ? (existing?.alias ?? null) : update.alias,
    ipa: update.ipa === undefined ? (existing?.ipa ?? null) : update.ipa,
    notes: update.notes ?? existing?.notes ?? "",
    approvedBy: null,
    approvedAt: null,
  };
  await savePronunciations(
    deps,
    existing ? entries.map((entry) => (entry === existing ? next : entry)) : [...entries, next],
  );
  return next;
}

/** Records that a named person listened to the term and confirmed it is said correctly. */
export async function approvePronunciation(
  deps: CoreDeps,
  term: string,
  approvedBy: string,
): Promise<PronunciationEntry> {
  const entries = await loadPronunciations(deps);
  const entry = findEntry(entries, term);
  const approved: PronunciationEntry = {
    ...entry,
    status: "approved",
    approvedBy,
    approvedAt: deps.clock.now().toISOString(),
  };
  await savePronunciations(
    deps,
    entries.map((candidate) => (candidate === entry ? approved : candidate)),
  );
  return approved;
}

/** A neutral carrier sentence, so a term is heard in running speech rather than in isolation. */
export function pronunciationPreviewText(term: string): string {
  return `This is how we say ${term}. ${term} is the term you just heard.`;
}
