import { Option } from "commander";
import { StudioError } from "../domain/errors";
import { loadStoryboard, type CoreDeps } from "../application/context";
import { FORMAT_IDS, QUALITY_IDS, type FormatId } from "../domain/formats";

export const videoOption = (): Option =>
  new Option("--video <id>", "video id, as shown by `pnpm studio status`").makeOptionMandatory();

export const cutOption = (): Option =>
  new Option("--cut <id...>", "limit to these cuts (default: every cut in the storyboard)");

export const formatOption = (): Option =>
  new Option("--format <format...>", "limit to cuts in these formats").choices([...FORMAT_IDS]);

export interface CutSelection {
  cut?: string[];
  format?: FormatId[];
}

/**
 * Resolves --cut and --format to cut ids. Returns undefined when neither is given, which
 * commands treat as "the whole video".
 */
export async function selectCutIds(
  deps: CoreDeps,
  videoId: string,
  selection: CutSelection,
): Promise<string[] | undefined> {
  if (selection.format === undefined) return selection.cut;
  const storyboard = await loadStoryboard(deps, videoId);
  const formats = selection.format;
  const matching = storyboard.cuts
    .filter((cut) => formats.includes(cut.format))
    .filter((cut) => selection.cut === undefined || selection.cut.includes(cut.id))
    .map((cut) => cut.id);
  if (matching.length === 0) {
    throw new StudioError("NOT_FOUND", `No cut matches the format ${formats.join(", ")}.`, {
      hint: `Cuts: ${storyboard.cuts.map((cut) => `${cut.id} (${cut.format})`).join(", ")}`,
    });
  }
  return matching;
}

export const qualityOption = (fallback: (typeof QUALITY_IDS)[number]): Option =>
  new Option("--quality <quality>", "render quality").choices([...QUALITY_IDS]).default(fallback);

export function parseInteger(name: string, minimum: number) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum) {
      throw new StudioError(
        "VALIDATION_FAILED",
        `${name} must be a whole number of at least ${minimum}.`,
      );
    }
    return parsed;
  };
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
