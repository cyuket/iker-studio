import path from "node:path";
import { z } from "zod";
import { StudioError } from "../domain/errors";
import { FormatIdSchema } from "../domain/formats";
import { CutIdSchema, SceneIdSchema, SceneTypeSchema } from "../domain/scene-types";
import { ContentTypeSchema } from "../domain/script";
import { SceneVisualSchema } from "../domain/storyboard";
import { THUMBNAIL_VARIANTS } from "../domain/render-props";
import type { CoreDeps } from "./context";

/**
 * A template is the reusable shape of a kind of video: which cuts it produces, which
 * scenes each cut has, what the writer should say in each, and what each looks like
 * before a designer touches it.
 */
export const TemplateSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  contentTypes: z.array(ContentTypeSchema).min(1),
  thumbnailVariants: z.array(z.enum(THUMBNAIL_VARIANTS)).length(3),
  cuts: z
    .array(
      z.object({
        id: CutIdSchema,
        format: FormatIdSchema,
        targetSeconds: z.object({ min: z.number().positive(), max: z.number().positive() }),
        scenes: z
          .array(
            z.object({
              id: SceneIdSchema,
              type: SceneTypeSchema,
              title: z.string().min(1),
              /** What the writer should cover in this scene. */
              guidance: z.string().min(1),
              chapterTitle: z.string().optional(),
              visual: SceneVisualSchema,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type Template = z.infer<typeof TemplateSchema>;

type TemplateDeps = Pick<CoreDeps, "layout" | "files">;

export function templateDir(deps: TemplateDeps, id: string): string {
  return path.join(deps.layout.templatesDir, id);
}

export async function loadTemplate(deps: TemplateDeps, id: string): Promise<Template> {
  const file = path.join(templateDir(deps, id), "template.json");
  if (!(await deps.files.exists(file))) {
    const known = await listTemplateIds(deps);
    throw new StudioError("NOT_FOUND", `There is no template "${id}".`, {
      hint: `Templates: ${known.join(", ") || "none found"}`,
    });
  }
  const parsed = TemplateSchema.safeParse(await deps.files.readJson(file));
  if (!parsed.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Template "${id}" is invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  if (parsed.data.id !== id) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Template in ${id}/ declares the id "${parsed.data.id}".`,
    );
  }
  return parsed.data;
}

export async function listTemplateIds(deps: TemplateDeps): Promise<string[]> {
  const files = await deps.files.list(deps.layout.templatesDir);
  return files
    .filter((entry) => path.basename(entry.file) === "template.json")
    .map((entry) => path.basename(path.dirname(entry.file)))
    .sort();
}

/** Renders the script.md skeleton a writer starts from. Unfilled prompts fail the script lint. */
export function scriptSkeleton(
  template: Template,
  input: { title: string; contentType: string; audience: string },
): string {
  const todo = (what: string): string => `TODO: ${what}`;
  const frontMatter = [
    "---",
    "schemaVersion: 1",
    `title: ${JSON.stringify(input.title)}`,
    `contentType: ${input.contentType}`,
    `audience: ${JSON.stringify(input.audience || todo("who is this for"))}`,
    `audienceProblem: ${JSON.stringify(todo("the specific problem this audience has"))}`,
    `hook: ${JSON.stringify(todo("the opening scenario, stated as a real situation"))}`,
    `coreExplanation: ${JSON.stringify(todo("what the viewer will understand afterwards"))}`,
    `demonstration: ${JSON.stringify(todo("what is shown in the product"))}`,
    `businessOutcome: ${JSON.stringify(todo("what changes for the viewer's team; no unsupported claims"))}`,
    "callToAction:",
    `  label: ${JSON.stringify(todo("CTA label"))}`,
    `  url: ${JSON.stringify(todo("CTA url"))}`,
    "titleCandidates:",
    `  - ${JSON.stringify(input.title)}`,
    `  - ${JSON.stringify(todo("second title"))}`,
    `  - ${JSON.stringify(todo("third title"))}`,
    "keywords: []",
    "claims: []",
    "---",
    "",
  ];
  const body = template.cuts.flatMap((cut) => [
    `# cut: ${cut.id} (${cut.format}, ${cut.targetSeconds.min}-${cut.targetSeconds.max}s)`,
    "",
    ...cut.scenes.flatMap((scene) => [
      `## ${scene.id} (${scene.type}) — ${scene.title}`,
      "",
      `> ${scene.guidance}`,
      "",
      todo("narration for this scene"),
      "",
    ]),
  ]);
  return [...frontMatter, ...body].join("\n");
}

export function researchSkeleton(topic: string): string {
  return [
    "---",
    "# Verified facts the script may rely on. Each needs a source someone else can check.",
    "facts: []",
    "#  - id: example-fact",
    '#    statement: "What is true, in one sentence."',
    '#    source: "Repository path, documentation URL or named person, with date."',
    "---",
    "",
    `# Research: ${topic}`,
    "",
    "## What the product actually does",
    "",
    "## What we must not claim",
    "",
    "## Open questions",
    "",
  ].join("\n");
}
