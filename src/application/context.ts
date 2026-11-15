import path from "node:path";
import { z } from "zod";
import { BrandSchema, type Brand } from "../domain/brand";
import { StudioError } from "../domain/errors";
import { hashOf } from "../domain/hash";
import { parseResearch, parseScript, type ResearchFact, type Script } from "../domain/script";
import { StoryboardSchema, type Storyboard } from "../domain/storyboard";
import { PronunciationFileSchema, type PronunciationEntry } from "../domain/voice";
import type { Workspace } from "./layout";
import type { Clock, FileSystem, Logger, ManifestRepository } from "./ports";

/** Dependencies every use case needs. */
export interface CoreDeps {
  layout: Workspace;
  files: FileSystem;
  manifests: ManifestRepository;
  clock: Clock;
  logger: Logger;
}

export interface LoadedScript {
  script: Script;
  /** Hash of the parsed script, so reformatting the file does not invalidate anything. */
  hash: string;
}

export async function loadScript(deps: CoreDeps, videoId: string): Promise<LoadedScript> {
  const file = deps.layout.video(videoId).script;
  const markdown = await deps.files.readText(file);
  if (markdown === null) {
    throw new StudioError("NOT_FOUND", `${file} does not exist.`, {
      hint: "`pnpm studio create` writes a script skeleton for a new video.",
    });
  }
  const script = parseScript(markdown);
  return { script, hash: hashOf(script) };
}

export async function loadResearch(deps: CoreDeps, videoId: string): Promise<ResearchFact[]> {
  const markdown = await deps.files.readText(deps.layout.video(videoId).research);
  return markdown === null ? [] : parseResearch(markdown);
}

export async function loadStoryboard(deps: CoreDeps, videoId: string): Promise<Storyboard> {
  const file = deps.layout.video(videoId).storyboard;
  if (!(await deps.files.exists(file))) {
    throw new StudioError("NOT_FOUND", "This video has no storyboard yet.", {
      hint: `Run \`pnpm studio storyboard --video ${videoId}\`.`,
    });
  }
  const parsed = StoryboardSchema.safeParse(await deps.files.readJson(file));
  if (!parsed.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `storyboard.json is invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

export interface LoadedBrand {
  brand: Brand;
  /** Covers brand.json and the bytes of the logo files it points to. */
  hash: string;
  logoFiles: { mark: string | null; wordmark: string | null };
}

export async function loadBrand(deps: Pick<CoreDeps, "layout" | "files">): Promise<LoadedBrand> {
  const file = path.join(deps.layout.brandDir, "brand.json");
  const parsed = BrandSchema.safeParse(await deps.files.readJson(file));
  if (!parsed.success) {
    throw new StudioError(
      "CONFIG_INVALID",
      `brand/brand.json is invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  const brand = parsed.data;
  const resolve = async (relative: string | null): Promise<string | null> => {
    if (relative === null) return null;
    const absolute = path.join(deps.layout.brandDir, relative);
    if (!(await deps.files.exists(absolute))) {
      throw new StudioError("CONFIG_INVALID", `brand.json points to a missing logo: ${relative}`);
    }
    return absolute;
  };
  const logoFiles = {
    mark: await resolve(brand.logo.mark),
    wordmark: await resolve(brand.logo.wordmark),
  };
  const logoHashes = await Promise.all(
    [logoFiles.mark, logoFiles.wordmark].map((logo) =>
      logo ? deps.files.sha256(logo) : Promise.resolve(null),
    ),
  );
  return { brand, hash: hashOf({ brand, logoHashes }), logoFiles };
}

export function pronunciationFile(layout: Workspace): string {
  return path.join(layout.brandDir, "pronunciations.json");
}

export async function loadPronunciations(
  deps: Pick<CoreDeps, "layout" | "files">,
): Promise<PronunciationEntry[]> {
  const file = pronunciationFile(deps.layout);
  if (!(await deps.files.exists(file))) return [];
  const parsed = PronunciationFileSchema.safeParse(await deps.files.readJson(file));
  if (!parsed.success) {
    throw new StudioError(
      "CONFIG_INVALID",
      `brand/pronunciations.json is invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data.entries;
}
