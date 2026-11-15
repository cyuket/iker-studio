import path from "node:path";
import type { CoreDeps } from "./context";
import { loadTemplate, templateDir } from "./templates";
import { errorMessage } from "../domain/errors";
import { lintScript, parseResearch, parseScript } from "../domain/script";
import { StoryboardSchema } from "../domain/storyboard";

/**
 * Checks that a template and its demo are internally consistent: the demo script passes
 * the lint with no errors, and the demo storyboard has a visual for every scene the
 * script defines. Returns human-readable problems; empty means valid.
 */
export async function validateTemplateDemo(deps: CoreDeps, id: string): Promise<string[]> {
  const problems: string[] = [];
  try {
    const template = await loadTemplate(deps, id);
    const demo = path.join(templateDir(deps, id), "demo");
    const scriptText = await deps.files.readText(path.join(demo, "script.md"));
    const researchText = await deps.files.readText(path.join(demo, "research.md"));
    if (scriptText === null) return [`demo/script.md is missing`];
    if (researchText === null) return [`demo/research.md is missing`];

    const script = parseScript(scriptText);
    const facts = new Set(parseResearch(researchText).map((fact) => fact.id));
    for (const issue of lintScript(script, facts)) {
      if (issue.severity === "error")
        problems.push(`demo script: ${issue.sceneId ? `${issue.sceneId}: ` : ""}${issue.message}`);
    }

    const storyboard = StoryboardSchema.safeParse(
      await deps.files.readJson(path.join(demo, "storyboard.json")),
    );
    if (!storyboard.success)
      return [...problems, "demo/storyboard.json does not match the storyboard schema"];

    for (const cut of template.cuts) {
      const scriptCut = script.cuts.find((c) => c.id === cut.id);
      const boardCut = storyboard.data.cuts.find((c) => c.id === cut.id);
      if (!scriptCut) problems.push(`demo script has no cut "${cut.id}"`);
      if (!boardCut) problems.push(`demo storyboard has no cut "${cut.id}"`);
      for (const scene of cut.scenes) {
        if (scriptCut && !scriptCut.scenes.some((s) => s.id === scene.id))
          problems.push(`demo script is missing scene "${scene.id}"`);
        if (boardCut && !boardCut.scenes.some((s) => s.id === scene.id))
          problems.push(`demo storyboard is missing scene "${scene.id}"`);
      }
    }
  } catch (error) {
    problems.push(errorMessage(error));
  }
  return problems;
}
