import path from "node:path";
import { StudioError } from "../domain/errors";
import { QUALITIES } from "../domain/formats";
import { hashOf } from "../domain/hash";
import { finalKey, type ExportRecord, type Manifest } from "../domain/manifest";
import {
  buildMetadata,
  metadataIssues,
  renderMetadataMarkdown,
  type VideoMetadata,
} from "../domain/metadata";
import { enabledScenes, type Storyboard } from "../domain/storyboard";
import { buildChapters, type CutTimeline } from "../domain/timeline";
import { isFinalApproved } from "./approval";
import { loadScript, loadStoryboard, type CoreDeps } from "./context";
import { runStage } from "./pipeline";
import type { ObjectStore, VideoPublisher } from "./ports";

export interface ExportDeps extends CoreDeps {
  /** Throws when R2 is not configured. */
  objectStore(): ObjectStore;
  /** Throws when YouTube is not configured or publishing is switched off. */
  publisher(): VideoPublisher;
  contentType(file: string): string;
}

const SYNTHETIC_FOOTAGE_NOTE =
  "The product demonstration in this video uses a synthetic demo environment with simulated data. It does not show real customer records.";

/** Builds publishing metadata from the script and the primary cut's real timings. */
export async function generateMetadata(
  deps: CoreDeps,
  videoId: string,
): Promise<{ metadata: VideoMetadata; file: string; issues: string[] }> {
  const manifest = await deps.manifests.load(videoId);
  const { script } = await loadScript(deps, videoId);
  const storyboard = await loadStoryboard(deps, videoId);
  const paths = deps.layout.video(videoId);

  const primary = storyboard.cuts[0];
  let chapters: ReturnType<typeof buildChapters> = [];
  const timelineFile = primary ? path.join(paths.scenes, primary.id, "timeline.json") : null;
  if (primary && timelineFile && (await deps.files.exists(timelineFile))) {
    const timeline = (await deps.files.readJson(timelineFile)) as CutTimeline;
    chapters = buildChapters(timeline, enabledScenes(primary));
  }
  const synthetic = Object.values(manifest.assets.recordings).some(
    (recording) => recording.target === "synthetic",
  );
  const credits = [
    ...new Set(storyboard.cuts.flatMap((cut) => (cut.music?.credit ? [cut.music.credit] : []))),
  ];
  const metadata = buildMetadata({
    script,
    chapters,
    disclosures: synthetic ? [SYNTHETIC_FOOTAGE_NOTE] : [],
    credits,
  });
  const file = path.join(paths.metadata, "metadata.md");
  await deps.files.writeText(file, renderMetadataMarkdown(metadata));
  await deps.files.writeJson(path.join(paths.metadata, "metadata.json"), metadata);
  return { metadata, file, issues: metadataIssues(metadata) };
}

export interface ExportInput {
  videoId: string;
  cutIds?: readonly string[];
  /** Upload the package to the private R2 bucket. */
  toR2: boolean;
  /** Seconds a signed download link stays valid; null creates no link. */
  signedUrlSeconds: number | null;
}

export interface ExportOutcome {
  cutId: string;
  packageDir: string;
  files: string[];
  r2Prefix: string | null;
  signedUrl: string | null;
}

function requireApproved(
  manifest: Manifest,
  storyboard: Storyboard,
  cutIds: readonly string[] | undefined,
): readonly string[] {
  const ids = cutIds ?? storyboard.cuts.map((cut) => cut.id);
  for (const id of ids) {
    if (!storyboard.cuts.some((cut) => cut.id === id))
      throw new StudioError("NOT_FOUND", `There is no cut "${id}".`);
    if (!isFinalApproved(manifest, id)) {
      throw new StudioError(
        "APPROVAL_REQUIRED",
        `Cut "${id}" has not been approved in its current form.`,
        {
          hint: `Review the QA report, then run \`pnpm studio approve --video ${manifest.id} --stage final --cut ${id}\`.`,
        },
      );
    }
  }
  return ids;
}

/**
 * Assembles a self-contained package per approved cut: the video, subtitles, thumbnails,
 * metadata, the QA report data and a checksum list. This package is everything needed to
 * publish by hand, which is the supported route when YouTube credentials are absent.
 */
export async function exportVideo(deps: ExportDeps, input: ExportInput): Promise<ExportOutcome[]> {
  const loaded = await deps.manifests.load(input.videoId);
  const storyboard = await loadStoryboard(deps, input.videoId);
  const cutIds = requireApproved(loaded, storyboard, input.cutIds);
  const { file: metadataFile } = await generateMetadata(deps, input.videoId);
  const paths = deps.layout.video(input.videoId);
  const outcomes: ExportOutcome[] = [];

  const subject = cutIds.map((id) => loaded.assets.finals[finalKey(id, "final")]?.sha256);
  await runStage(
    deps,
    input.videoId,
    "export",
    hashOf({ subject, r2: input.toR2 }),
    { force: true, requires: [] },
    async (start) => {
      const records: ExportRecord[] = [];
      const at = deps.clock.now().toISOString();
      for (const cutId of cutIds) {
        const final = start.assets.finals[finalKey(cutId, QUALITIES.final.id)];
        if (!final) throw new Error(`Approved cut ${cutId} has no final asset`);
        const dir = path.join(paths.exports, cutId);
        await deps.files.remove(dir);

        const sources: [string, string][] = [
          [paths.absolute(final.file), path.basename(final.file)],
          [paths.absolute(final.subtitles.srt), `${input.videoId}-${cutId}.srt`],
          [paths.absolute(final.subtitles.vtt), `${input.videoId}-${cutId}.vtt`],
          [metadataFile, "metadata.md"],
          [path.join(paths.metadata, "metadata.json"), "metadata.json"],
          ...start.assets.thumbnails.map((t): [string, string] => [
            paths.absolute(t.file),
            `thumbnail-${t.variant}.png`,
          ]),
        ];
        const qa = start.qa[finalKey(cutId, QUALITIES.final.id)];
        if (qa)
          sources.push([
            path.join(path.dirname(paths.absolute(qa.report)), "report.json"),
            "qa-report.json",
          ]);

        const checksums: string[] = [];
        const files: string[] = [];
        for (const [source, name] of sources) {
          if (!(await deps.files.exists(source))) continue;
          const target = path.join(dir, name);
          await deps.files.copy(source, target);
          checksums.push(`${await deps.files.sha256(target)}  ${name}`);
          files.push(target);
        }
        const checksumFile = path.join(dir, "SHA256SUMS");
        await deps.files.writeText(checksumFile, `${checksums.join("\n")}\n`);
        files.push(checksumFile);
        records.push({
          cutId,
          kind: "package",
          location: paths.relative(dir),
          sha256: final.sha256,
          exportedAt: at,
        });

        let r2Prefix: string | null = null;
        let signedUrl: string | null = null;
        if (input.toR2) {
          const store = deps.objectStore();
          r2Prefix = `videos/${input.videoId}/${cutId}/`;
          for (const file of files) {
            await store.upload(file, `${r2Prefix}${path.basename(file)}`, deps.contentType(file));
          }
          if (input.signedUrlSeconds !== null) {
            signedUrl = await store.signedUrl(
              `${r2Prefix}${path.basename(final.file)}`,
              input.signedUrlSeconds,
            );
          }
          records.push({
            cutId,
            kind: "r2",
            location: r2Prefix,
            sha256: final.sha256,
            exportedAt: at,
          });
        }
        outcomes.push({ cutId, packageDir: dir, files, r2Prefix, signedUrl });
      }
      const everyCut = storyboard.cuts.every((cut) => cutIds.includes(cut.id));
      return {
        manifest: { ...start, exports: [...start.exports, ...records] },
        result: null,
        complete: everyCut,
      };
    },
  );
  return outcomes;
}

export interface PublishInput {
  /** A title written for this upload; used instead of the script's title candidates. */
  titleText?: string;
  videoId: string;
  cutId: string;
  /** Index into the script's three title candidates. */
  titleIndex: number;
  privacy: "private" | "unlisted" | "public";
  thumbnailVariant: string | null;
  /** The video id typed again by the operator, as a deliberate confirmation. */
  confirm: string;
}

/**
 * Uploads an approved cut to YouTube. Four things must all be true: publishing is switched
 * on in the environment, the cut's current render is approved, the operator confirmed by
 * retyping the video id, and credentials are authorised. Nothing publishes on its own.
 */
export async function publishToYouTube(
  deps: ExportDeps,
  input: PublishInput,
): Promise<{ url: string; youtubeId: string; thumbnailSet: boolean }> {
  const manifest = await deps.manifests.load(input.videoId);
  if (input.confirm !== input.videoId) {
    throw new StudioError("APPROVAL_REQUIRED", "Publishing needs explicit confirmation.", {
      hint: `Repeat the video id: --confirm ${input.videoId}`,
    });
  }
  if (!isFinalApproved(manifest, input.cutId)) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      `Cut "${input.cutId}" has not been approved in its current form.`,
      {
        hint: `Run \`pnpm studio approve --video ${input.videoId} --stage final --cut ${input.cutId}\` after review.`,
      },
    );
  }
  const publisher = deps.publisher();
  const final = manifest.assets.finals[finalKey(input.cutId, QUALITIES.final.id)];
  if (!final) throw new Error("Approved cut has no final asset");
  const { metadata, issues } = await generateMetadata(deps, input.videoId);
  if (issues.length)
    throw new StudioError("VALIDATION_FAILED", `Metadata is not publishable: ${issues.join(" ")}`);
  const title = input.titleText?.trim() || metadata.titles[input.titleIndex];
  if (!title) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `There is no title candidate ${input.titleIndex + 1}.`,
    );
  }
  const paths = deps.layout.video(input.videoId);
  const thumbnail = manifest.assets.thumbnails.find((t) => t.variant === input.thumbnailVariant);

  const published = await publisher.publish({
    file: paths.absolute(final.file),
    title,
    description: metadata.youtubeDescription,
    tags: metadata.keywords,
    privacy: input.privacy,
    thumbnail: thumbnail ? paths.absolute(thumbnail.file) : null,
  });
  const latest = await deps.manifests.load(input.videoId);
  await deps.manifests.save({
    ...latest,
    exports: [
      ...latest.exports,
      {
        cutId: input.cutId,
        kind: "youtube",
        location: published.url,
        sha256: final.sha256,
        exportedAt: deps.clock.now().toISOString(),
      },
    ],
  });
  return { url: published.url, youtubeId: published.videoId, thumbnailSet: published.thumbnailSet };
}

/** Uploads a video's generated assets so another machine (e.g. CI) can render without regenerating them. */
export async function pushAssets(deps: ExportDeps, videoId: string): Promise<number> {
  const paths = deps.layout.video(videoId);
  const store = deps.objectStore();
  let count = 0;
  for (const dir of [paths.audio, paths.recordings]) {
    for (const entry of await deps.files.list(dir)) {
      await store.upload(
        entry.file,
        `assets/${videoId}/${paths.relative(entry.file)}`,
        deps.contentType(entry.file),
      );
      count++;
    }
  }
  return count;
}

export async function pullAssets(deps: ExportDeps, videoId: string): Promise<number> {
  const paths = deps.layout.video(videoId);
  const store = deps.objectStore();
  const prefix = `assets/${videoId}/`;
  const objects = await store.list(prefix);
  for (const object of objects)
    await store.download(object.key, paths.absolute(object.key.slice(prefix.length)));
  return objects.length;
}

/** Deletes exported objects older than the retention period. Returns the keys removed. */
export async function pruneExports(
  deps: ExportDeps,
  retentionDays: number,
  dryRun: boolean,
): Promise<string[]> {
  const store = deps.objectStore();
  const cutoff = deps.clock.now().getTime() - retentionDays * 86_400_000;
  const expired = (await store.list("videos/")).filter(
    (object) => object.lastModified !== null && object.lastModified.getTime() < cutoff,
  );
  if (!dryRun) for (const object of expired) await store.remove(object.key);
  return expired.map((object) => object.key);
}

/** Sets a rendered thumbnail on a cut that was already uploaded to YouTube. */
export async function setYouTubeThumbnail(
  deps: ExportDeps,
  input: { videoId: string; cutId: string; variant: string },
): Promise<{ url: string }> {
  const manifest = await deps.manifests.load(input.videoId);
  const upload = manifest.exports.findLast(
    (record) => record.kind === "youtube" && record.cutId === input.cutId,
  );
  const youtubeId = upload ? new URL(upload.location).searchParams.get("v") : null;
  if (!upload || !youtubeId) {
    throw new StudioError("NOT_FOUND", `Cut "${input.cutId}" has not been uploaded to YouTube.`, {
      hint: `Run \`pnpm studio publish --video ${input.videoId} --cut ${input.cutId} --confirm ${input.videoId}\` first.`,
    });
  }
  const thumbnail = manifest.assets.thumbnails.find((t) => t.variant === input.variant);
  if (!thumbnail) {
    throw new StudioError("NOT_FOUND", `There is no thumbnail variant "${input.variant}".`, {
      hint: `Available: ${manifest.assets.thumbnails.map((t) => t.variant).join(", ") || "none"}`,
    });
  }
  await deps
    .publisher()
    .setThumbnail(youtubeId, deps.layout.video(input.videoId).absolute(thumbnail.file));
  return { url: upload.location };
}
