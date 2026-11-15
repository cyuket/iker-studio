import type { Script } from "./script";
import { formatChapterTime, type Chapter } from "./timeline";

export interface VideoMetadata {
  titles: string[];
  youtubeDescription: string;
  chapters: string;
  keywords: string[];
  linkedinCaption: string;
  xCaption: string;
  shortsCaption: string;
}

export interface MetadataInput {
  script: Script;
  chapters: readonly Chapter[];
  /** Statements that must accompany the video, e.g. that the demo uses simulated data. */
  disclosures: readonly string[];
}

const X_LIMIT = 280;
/** YouTube rejects titles longer than this. */
export const YOUTUBE_TITLE_LIMIT = 100;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : cut.length).trimEnd()}…`;
}

function hashtags(keywords: readonly string[], count: number): string {
  return keywords
    .slice(0, count)
    .map((keyword) => `#${keyword.replace(/[^\p{L}\p{N}]+/gu, "")}`)
    .filter((tag) => tag.length > 1)
    .join(" ");
}

/**
 * Builds publishing metadata from the script, so everything a viewer reads before pressing
 * play describes what the video actually says. Nothing here adds a claim the script lacks.
 */
export function buildMetadata(input: MetadataInput): VideoMetadata {
  const { script, chapters, disclosures } = input;
  const cta = `${script.callToAction.label}: ${script.callToAction.url}`;
  const chapterText = chapters
    .map((c) => `${formatChapterTime(c.startSeconds)} ${c.title}`)
    .join("\n");

  const youtubeDescription = [
    script.hook,
    script.coreExplanation,
    script.businessOutcome,
    cta,
    chapterText ? `Chapters\n${chapterText}` : "",
    disclosures.length ? disclosures.join("\n") : "",
    hashtags(script.keywords, 3),
  ]
    .filter(Boolean)
    .join("\n\n");

  const linkedinCaption =
    script.social.linkedin ??
    [script.audienceProblem, script.coreExplanation, cta, hashtags(script.keywords, 4)]
      .filter(Boolean)
      .join("\n\n");

  const link = script.callToAction.url;
  const xCaption =
    script.social.x ?? `${truncate(script.hook, X_LIMIT - link.length - 2)}\n\n${link}`;

  const shortsCaption =
    script.social.shorts ??
    `${truncate(script.hook, 120)} ${hashtags(script.keywords, 3)} #Shorts`.trim();

  return {
    titles: script.titleCandidates,
    youtubeDescription,
    chapters: chapterText,
    keywords: script.keywords,
    linkedinCaption,
    xCaption,
    shortsCaption,
  };
}

export function metadataIssues(metadata: VideoMetadata): string[] {
  const issues: string[] = [];
  for (const title of metadata.titles) {
    if (title.length > YOUTUBE_TITLE_LIMIT)
      issues.push(`Title exceeds ${YOUTUBE_TITLE_LIMIT} characters: "${title}"`);
  }
  if (metadata.xCaption.length > X_LIMIT)
    issues.push(`X caption is ${metadata.xCaption.length} characters; the limit is ${X_LIMIT}.`);
  if (metadata.youtubeDescription.length > 5000)
    issues.push("YouTube description exceeds 5,000 characters.");
  return issues;
}

export function renderMetadataMarkdown(metadata: VideoMetadata): string {
  const titles = metadata.titles.map((title, i) => `${i + 1}. ${title}`).join("\n");
  return [
    "# Publishing metadata",
    "## Candidate titles",
    titles,
    "## YouTube description",
    metadata.youtubeDescription,
    "## Chapters",
    metadata.chapters ||
      "_Not enough chapters for YouTube (needs three, each at least 10 seconds)._",
    "## Keywords",
    metadata.keywords.join(", "),
    "## LinkedIn caption",
    metadata.linkedinCaption,
    "## X caption",
    metadata.xCaption,
    "## Shorts caption",
    metadata.shortsCaption,
    "",
  ].join("\n\n");
}
