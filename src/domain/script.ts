import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { StudioError } from "./errors";
import { FormatIdSchema } from "./formats";
import {
  CutIdSchema,
  SCENE_TYPES,
  SceneIdSchema,
  SceneTypeSchema,
  type SceneType,
} from "./scene-types";

export const CONTENT_TYPES = [
  "PRODUCT_DEMO",
  "PRODUCT_TUTORIAL",
  "FEATURE_ANNOUNCEMENT",
  "BUSINESS_EDUCATION",
  "BOOKKEEPING_EDUCATION",
  "YOUTUBE_SHORT",
  "RELEASE_UPDATE",
] as const;
export const ContentTypeSchema = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof ContentTypeSchema>;

const ScriptFrontMatterSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  contentType: ContentTypeSchema,
  audience: z.string().min(1),
  audienceProblem: z.string().min(1),
  hook: z.string().min(1),
  coreExplanation: z.string().min(1),
  demonstration: z.string().min(1),
  businessOutcome: z.string().min(1),
  callToAction: z.object({ label: z.string().min(1), url: z.string().min(1) }),
  titleCandidates: z.array(z.string().min(1)).default([]),
  keywords: z.array(z.string().min(1)).default([]),
  /** Statements of fact made in narration, each tied to a fact id in research.md. */
  claims: z.array(z.object({ text: z.string().min(1), fact: z.string().min(1) })).default([]),
  /** Thumbnail copy. Kept short so it reads at the size YouTube shows it in a list. */
  thumbnail: z.object({ headline: z.string().min(1).max(40) }).optional(),
  /** Hand-written social captions. Anything left out is derived from the fields above. */
  social: z
    .object({
      linkedin: z.string().min(1),
      x: z.string().min(1).max(280),
      shorts: z.string().min(1),
    })
    .partial()
    .default({}),
});
export type ScriptFrontMatter = z.infer<typeof ScriptFrontMatterSchema>;

export interface ScriptScene {
  id: string;
  type: SceneType;
  title: string | null;
  /** Spoken text. Empty for scenes that play without narration. */
  narration: string;
  /** Lines the writer addressed to the storyboard designer (`> ...` in script.md). */
  direction: string[];
}

export interface ScriptCut {
  id: string;
  format: z.infer<typeof FormatIdSchema>;
  targetSeconds: { min: number; max: number };
  scenes: ScriptScene[];
}

export interface Script extends ScriptFrontMatter {
  cuts: ScriptCut[];
}

const CUT_HEADING = /^# +cut: +(\S+) +\(([a-z-]+), *(\d+)\s*-\s*(\d+)s\)\s*$/;
const SCENE_HEADING = /^## +(\S+) +\(([A-Z_]+)\)(?: +[—–-] +(.+))?\s*$/;

/**
 * Parses script.md: YAML front matter, then `# cut: <id> (<format>, <min>-<max>s)` sections
 * holding `## <scene-id> (<TYPE>) — optional title` scenes. Paragraph text is narration;
 * lines starting with `>` are direction and are never spoken.
 */
export function parseScript(markdown: string): Script {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) {
    throw new StudioError("VALIDATION_FAILED", "script.md must start with YAML front matter", {
      hint: "Begin the file with a '---' block. `pnpm studio create` writes a valid skeleton.",
    });
  }
  const frontMatter = ScriptFrontMatterSchema.safeParse(parseYaml(match[1] ?? ""));
  if (!frontMatter.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `script.md front matter is invalid: ${z.prettifyError(frontMatter.error)}`,
    );
  }
  return { ...frontMatter.data, cuts: parseCuts(match[2] ?? "") };
}

function parseCuts(body: string): ScriptCut[] {
  const cuts: ScriptCut[] = [];
  let scene: ScriptScene | null = null;
  const seenScenes = new Set<string>();

  const lines = body.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const where = `script.md body line ${index + 1}`;
    if (line.startsWith("# ")) {
      const cut = CUT_HEADING.exec(line);
      if (!cut) {
        throw new StudioError("VALIDATION_FAILED", `${where}: unrecognised cut heading "${line}"`, {
          hint: "Use: # cut: full (youtube-landscape, 120-180s)",
        });
      }
      const [, id, format, min, max] = cut;
      if (cuts.some((c) => c.id === id)) {
        throw new StudioError("VALIDATION_FAILED", `${where}: duplicate cut id "${id}"`);
      }
      cuts.push({
        id: CutIdSchema.parse(id),
        format: parseFormat(format ?? "", where),
        targetSeconds: { min: Number(min), max: Number(max) },
        scenes: [],
      });
      scene = null;
      continue;
    }
    if (line.startsWith("## ")) {
      const heading = SCENE_HEADING.exec(line);
      const cut = cuts.at(-1);
      if (!heading || !cut) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `${where}: unrecognised scene heading "${line}"`,
          { hint: "Use: ## hook (PROBLEM) — optional title, inside a '# cut:' section." },
        );
      }
      const [, id, type, title] = heading;
      const sceneId = SceneIdSchema.safeParse(id);
      const sceneType = SceneTypeSchema.safeParse(type);
      if (!sceneId.success || !sceneType.success) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `${where}: scene needs a lowercase-hyphen id and one of ${SCENE_TYPES.join(", ")}`,
        );
      }
      if (seenScenes.has(sceneId.data)) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `${where}: scene id "${sceneId.data}" is used more than once`,
          { hint: "Scene ids are unique across every cut in a script." },
        );
      }
      seenScenes.add(sceneId.data);
      scene = {
        id: sceneId.data,
        type: sceneType.data,
        title: title?.trim() ?? null,
        narration: "",
        direction: [],
      };
      cut.scenes.push(scene);
      continue;
    }
    if (!scene) continue;
    if (line.startsWith(">")) {
      const note = line.replace(/^>\s?/, "").trim();
      if (note) scene.direction.push(note);
    } else if (line.trim()) {
      scene.narration = scene.narration ? `${scene.narration} ${line.trim()}` : line.trim();
    }
  }
  return cuts;
}

function parseFormat(value: string, where: string): ScriptCut["format"] {
  const parsed = FormatIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new StudioError("VALIDATION_FAILED", `${where}: unknown format "${value}"`, {
      hint: `Formats: ${FormatIdSchema.options.join(", ")}`,
    });
  }
  return parsed.data;
}

/** Measured pace of calm educational narration; used only until real audio exists. */
export const WORDS_PER_MINUTE = 150;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateNarrationSeconds(text: string): number {
  return (countWords(text) / WORDS_PER_MINUTE) * 60;
}

export type LintSeverity = "error" | "warning";
export interface LintIssue {
  severity: LintSeverity;
  rule: string;
  message: string;
  sceneId?: string;
}

/** Phrases that mark copy as generic marketing; matched case-insensitively. */
export const BANNED_PHRASES: readonly string[] = [
  "revolutionise your business",
  "revolutionize your business",
  "unlock the power of",
  "seamlessly streamline",
  "game-changing",
  "game changing",
  "in today's fast-paced digital world",
  "in today's fast-paced world",
  "cutting-edge",
  "next-generation",
  "best-in-class",
  "world-class",
  "supercharge",
  "take it to the next level",
  "look no further",
];

/**
 * Wording that asserts an outcome the product cannot promise. These are warnings unless the
 * sentence is backed by an entry in the script's `claims` list, because only a human can
 * judge whether the evidence really supports the sentence.
 */
const UNSUPPORTED_CLAIM_PATTERNS: readonly { rule: string; pattern: RegExp }[] = [
  {
    rule: "absolute-claim",
    pattern:
      /\b(?:guarantee[sd]?|eliminate[sd]?|never fails?|impossible to|fully compliant|ensures? compliance|zero no-shows|no more no-shows|never chase)\b|\b100\s?%/i,
  },
  { rule: "quantified-claim", pattern: /\b\d+(?:\.\d+)?\s?(?:%|percent|x faster|times faster)/i },
];

const PLACEHOLDER = /\b(TODO|TBD|lorem ipsum)\b|\[\[|\{\{/i;

export interface ScriptEstimate {
  cutId: string;
  seconds: number;
  words: number;
}

/** Seconds added around each scene's narration so cuts between scenes can breathe. */
export const DEFAULT_SCENE_PADDING_SECONDS = 0.9;
/** Shown duration of a scene that has no narration. */
export const SILENT_SCENE_SECONDS = 3;

export function estimateCut(cut: ScriptCut): ScriptEstimate {
  let seconds = 0;
  let words = 0;
  for (const scene of cut.scenes) {
    words += countWords(scene.narration);
    seconds += scene.narration
      ? estimateNarrationSeconds(scene.narration) + DEFAULT_SCENE_PADDING_SECONDS
      : SILENT_SCENE_SECONDS;
  }
  return { cutId: cut.id, seconds, words };
}

export function lintScript(script: Script, knownFactIds: ReadonlySet<string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (severity: LintSeverity, rule: string, message: string, sceneId?: string): void => {
    issues.push(
      sceneId === undefined ? { severity, rule, message } : { severity, rule, message, sceneId },
    );
  };

  if (script.cuts.length === 0) push("error", "no-cuts", "The script defines no cuts.");
  if (script.titleCandidates.length !== 3) {
    push("error", "title-candidates", "Provide exactly three titleCandidates for review.");
  }

  const prose: [string, string][] = [
    ["title", script.title],
    ["hook", script.hook],
    ["audienceProblem", script.audienceProblem],
    ["coreExplanation", script.coreExplanation],
    ["demonstration", script.demonstration],
    ["businessOutcome", script.businessOutcome],
    ...script.titleCandidates.map((t, i): [string, string] => [`titleCandidates[${i}]`, t]),
  ];
  for (const [field, text] of prose) {
    for (const issue of lintText(text))
      push(issue.severity, issue.rule, `${field}: ${issue.message}`);
  }

  for (const claim of script.claims) {
    if (!knownFactIds.has(claim.fact)) {
      push(
        "error",
        "claim-without-fact",
        `Claim "${claim.text}" cites unknown fact "${claim.fact}".`,
      );
    }
  }
  const supported = script.claims.map((c) => c.text.toLowerCase());

  for (const cut of script.cuts) {
    if (cut.scenes.length === 0) push("error", "empty-cut", `Cut "${cut.id}" has no scenes.`);
    if (!cut.scenes.some((s) => s.type === "CTA")) {
      push("error", "missing-cta", `Cut "${cut.id}" has no CTA scene.`);
    }
    const estimate = estimateCut(cut);
    if (estimate.seconds > cut.targetSeconds.max || estimate.seconds < cut.targetSeconds.min) {
      push(
        "warning",
        "duration-target",
        `Cut "${cut.id}" is estimated at ${estimate.seconds.toFixed(0)}s; the target is ` +
          `${cut.targetSeconds.min}-${cut.targetSeconds.max}s.`,
      );
    }
    for (const scene of cut.scenes) {
      for (const issue of lintText(scene.narration)) {
        if (!isBacked(issue, scene.narration, supported)) {
          push(issue.severity, issue.rule, issue.message, scene.id);
        }
      }
    }
  }
  return issues;
}

type TextIssue = Omit<LintIssue, "sceneId"> & { phrase?: string };

/**
 * A claim warning is answered only by a listed claim that is spoken in this scene and
 * contains the flagged wording, so backing one sentence never excuses another.
 */
function isBacked(issue: TextIssue, narration: string, claims: readonly string[]): boolean {
  const phrase = issue.phrase?.toLowerCase();
  if (phrase === undefined) return false;
  const spoken = narration.toLowerCase();
  return claims.some((claim) => spoken.includes(claim) && claim.includes(phrase));
}

function lintText(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({ severity: "error", rule: "banned-phrase", message: `Remove "${phrase}".` });
    }
  }
  if (PLACEHOLDER.test(text)) {
    issues.push({
      severity: "error",
      rule: "placeholder",
      message: "Unfinished placeholder text.",
    });
  }
  for (const { rule, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
    const found = pattern.exec(text);
    if (found) {
      issues.push({
        severity: "warning",
        rule,
        phrase: found[0],
        message: `"${found[0]}" needs evidence: add the sentence to claims with a research fact id, or reword it.`,
      });
    }
  }
  return issues;
}

const ResearchFrontMatterSchema = z.object({
  facts: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        statement: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
});
export type ResearchFact = z.infer<typeof ResearchFrontMatterSchema>["facts"][number];

/** research.md keeps verified facts in front matter; the body is free-form notes. */
export function parseResearch(markdown: string): ResearchFact[] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return [];
  const parsed = ResearchFrontMatterSchema.safeParse(parseYaml(match[1] ?? "") ?? {});
  if (!parsed.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `research.md front matter is invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data.facts;
}
