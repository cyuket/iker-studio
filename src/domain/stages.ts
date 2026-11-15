import { z } from "zod";

export const STAGE_IDS = [
  "idea",
  "research",
  "script",
  "storyboard",
  "recording",
  "voice",
  "motion",
  "composition",
  "subtitles",
  "render",
  "qa",
  "approval",
  "export",
] as const;
export const StageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof StageIdSchema>;

export interface StageDefinition {
  id: StageId;
  title: string;
  /** CLI command that runs the stage. */
  command: string;
  /** Stages that must be complete and current before this one can run. */
  requires: readonly StageId[];
  /** True when a person, not the pipeline, completes the stage. */
  manual: boolean;
}

export const STAGES: readonly StageDefinition[] = [
  { id: "idea", title: "Idea", command: "create", requires: [], manual: false },
  { id: "research", title: "Research", command: "plan", requires: ["idea"], manual: true },
  { id: "script", title: "Script", command: "script", requires: ["research"], manual: false },
  {
    id: "storyboard",
    title: "Storyboard",
    command: "storyboard",
    requires: ["script"],
    manual: false,
  },
  {
    id: "recording",
    title: "Product recording",
    command: "record",
    requires: ["storyboard"],
    manual: false,
  },
  {
    id: "voice",
    title: "Voice generation",
    command: "narrate",
    requires: ["storyboard"],
    manual: false,
  },
  {
    id: "motion",
    title: "Motion design",
    command: "render",
    requires: ["recording", "voice"],
    manual: false,
  },
  {
    id: "composition",
    title: "Video composition",
    command: "render",
    requires: ["motion"],
    manual: false,
  },
  { id: "subtitles", title: "Subtitles", command: "render", requires: ["motion"], manual: false },
  {
    id: "render",
    title: "Render",
    command: "render",
    requires: ["composition", "subtitles"],
    manual: false,
  },
  { id: "qa", title: "Quality review", command: "qa", requires: ["render"], manual: false },
  { id: "approval", title: "Approval", command: "approve", requires: ["qa"], manual: true },
  { id: "export", title: "Export", command: "export", requires: ["approval"], manual: false },
];

export function stageDefinition(id: StageId): StageDefinition {
  const found = STAGES.find((stage) => stage.id === id);
  if (!found) throw new Error(`Unknown stage ${id}`);
  return found;
}

/** Every stage that depends, directly or transitively, on the given one. */
export function downstreamOf(id: StageId): StageId[] {
  const result = new Set<StageId>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const stage of STAGES) {
      if (result.has(stage.id)) continue;
      if (stage.requires.some((required) => required === id || result.has(required))) {
        result.add(stage.id);
        grew = true;
      }
    }
  }
  return STAGES.map((stage) => stage.id).filter((stageId) => result.has(stageId));
}
