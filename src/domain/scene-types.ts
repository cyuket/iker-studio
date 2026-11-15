import { z } from "zod";

export const SCENE_TYPES = [
  "INTRO",
  "PROBLEM",
  "EXPLANATION",
  "DEMO",
  "DIAGRAM",
  "COMPARISON",
  "OUTCOME",
  "CTA",
  "OUTRO",
] as const;
export const SceneTypeSchema = z.enum(SCENE_TYPES);
export type SceneType = z.infer<typeof SceneTypeSchema>;

export const SceneIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "scene ids are lowercase words separated by hyphens");
export const CutIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "cut ids are lowercase words separated by hyphens");
