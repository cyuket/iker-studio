import { z } from "zod";

/**
 * How a step finds its element. Roles, labels and test ids survive restyling; CSS classes
 * and DOM position do not, so there is deliberately no raw CSS selector option.
 */
/**
 * Narrows a target that would otherwise match more than one element: `within` limits the
 * search to a named region such as a dialog or a table row, and `nth` picks one match by
 * position (0 is the first). Prefer `within`; use `nth` only for repeated rows.
 */
const Scope = {
  within: z
    .object({ role: z.string().min(1), name: z.string().min(1), exact: z.boolean().default(false) })
    .optional(),
  nth: z.number().int().min(0).optional(),
};

export const TargetSchema = z.union([
  z.object({
    role: z.string().min(1),
    name: z.string().min(1),
    exact: z.boolean().default(false),
    ...Scope,
  }),
  z.object({ label: z.string().min(1), exact: z.boolean().default(false), ...Scope }),
  z.object({ testId: z.string().min(1), ...Scope }),
  z.object({ text: z.string().min(1), exact: z.boolean().default(false), ...Scope }),
  z.object({ placeholder: z.string().min(1), ...Scope }),
]);
export type Target = z.infer<typeof TargetSchema>;

export function describeTarget(target: Target): string {
  const where = target.within ? ` in ${target.within.role} "${target.within.name}"` : "";
  const which = target.nth === undefined ? "" : ` (match ${target.nth + 1})`;
  return `${describeElement(target)}${where}${which}`;
}

function describeElement(target: Target): string {
  if ("role" in target) return `${target.role} "${target.name}"`;
  if ("label" in target) return `field labelled "${target.label}"`;
  if ("testId" in target) return `test id "${target.testId}"`;
  if ("text" in target) return `text "${target.text}"`;
  return `placeholder "${target.placeholder}"`;
}

const StepBase = { note: z.string().optional() };

/** A point inside an element's box, as fractions of its width and height. */
const RelativePoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

export const StepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), path: z.string().min(1), ...StepBase }),
  /** Signs in with the demo account from the environment. Credentials never enter a scenario. */
  z.object({ action: z.literal("authenticate"), ...StepBase }),
  z.object({ action: z.literal("click"), target: TargetSchema, ...StepBase }),
  z.object({
    action: z.literal("type"),
    target: TargetSchema,
    text: z.string(),
    /** Replace what the field already holds instead of adding to it. */
    replace: z.boolean().default(false),
    ...StepBase,
  }),
  /**
   * Closes something that may or may not be there, such as a first-visit guide. Clicks the
   * target if it appears within the wait, and carries on without complaint if it does not.
   */
  z.object({
    action: z.literal("dismiss"),
    target: TargetSchema,
    waitMs: z.number().int().min(0).max(15_000).default(4000),
    ...StepBase,
  }),
  z.object({
    action: z.literal("select"),
    target: TargetSchema,
    option: z.string().min(1),
    ...StepBase,
  }),
  z.object({ action: z.literal("scroll"), target: TargetSchema, ...StepBase }),
  z.object({
    action: z.literal("waitFor"),
    target: TargetSchema,
    state: z.enum(["visible", "hidden"]).default("visible"),
    ...StepBase,
  }),
  /** Waits for an application condition rather than a fixed delay. */
  z.object({
    action: z.literal("waitForState"),
    condition: z.union([
      z.object({ urlIncludes: z.string().min(1) }),
      z.object({ textVisible: z.string().min(1) }),
      z.object({ networkIdle: z.literal(true) }),
    ]),
    ...StepBase,
  }),
  z.object({
    action: z.literal("highlight"),
    target: TargetSchema,
    label: z.string().optional(),
    holdMs: z.number().int().min(200).max(10_000).default(1500),
    ...StepBase,
  }),
  z.object({
    action: z.literal("screenshot"),
    name: z.string().regex(/^[a-z0-9-]+$/),
    ...StepBase,
  }),
  /** Blurs matching elements for the rest of the recording. */
  z.object({ action: z.literal("mask"), targets: z.array(TargetSchema).min(1), ...StepBase }),
  z.object({
    action: z.literal("verify"),
    target: TargetSchema,
    containsText: z.string().optional(),
    ...StepBase,
  }),
  /**
   * Drags from one element to another, for interfaces that can only be operated with a
   * pointer, such as connecting nodes on a canvas. Both ends are found by role or label like
   * any other target; `fromPoint` and `toPoint` place the grab and the drop inside each
   * element's box as fractions of its width and height (the centre when omitted).
   */
  z.object({
    action: z.literal("drag"),
    from: TargetSchema,
    to: TargetSchema,
    fromPoint: RelativePoint.optional(),
    toPoint: RelativePoint.optional(),
    /**
     * Grab or drop on the nearest enclosing element with this role instead of the target
     * itself, e.g. a canvas node (`group`) found by the label printed inside it.
     */
    fromClosest: z.string().min(1).optional(),
    toClosest: z.string().min(1).optional(),
    ...StepBase,
  }),
  /** Presses one key, for controls that answer only to the keyboard, such as deleting a selection. */
  z.object({
    action: z.literal("press"),
    key: z.enum(["Delete", "Backspace", "Escape", "Enter", "Tab"]),
    ...StepBase,
  }),
  /**
   * Holds the frame so a viewer can read it. This is pacing for the audience, not a way to
   * wait for the application: use waitFor or waitForState for that.
   */
  z.object({ action: z.literal("dwell"), ms: z.number().int().min(100).max(10_000), ...StepBase }),
]);
export type Step = z.infer<typeof StepSchema>;

export const ScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  feature: z.string().min(1),
  /** `synthetic` runs against the bundled labelled fixture; `iker` against the demo environment. */
  target: z.enum(["synthetic", "iker"]),
  /**
   * `verified`: the flow has been run end to end against its target.
   * `unverified`: written from source code and documentation, not yet run. Recording an
   * unverified scenario is allowed, but its capture must be reviewed before use.
   */
  status: z.enum(["verified", "unverified"]),
  /** Where the selectors and flow were taken from. */
  evidence: z.string().min(1),
  /** What must be true of the environment for the flow to work. */
  prerequisites: z.array(z.string()).default([]),
  viewport: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .default({ width: 1440, height: 900 }),
  /** Elements that must exist before recording starts, checked on a non-recorded pass. */
  preflight: z
    .array(z.object({ path: z.string().min(1), expect: z.array(TargetSchema).min(1) }))
    .default([]),
  steps: z.array(StepSchema).min(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioInput = z.input<typeof ScenarioSchema>;

const BoxSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

/** What happened when, written next to each recording so scenes can time overlays to it. */
export const RecordingTimelineSchema = z.object({
  schemaVersion: z.literal(1),
  scenarioId: z.string(),
  target: z.enum(["synthetic", "iker"]),
  viewport: z.object({ width: z.number(), height: z.number() }),
  durationSeconds: z.number(),
  events: z.array(
    z.object({
      index: z.number().int(),
      action: z.string(),
      startSeconds: z.number(),
      endSeconds: z.number(),
      /** Element bounds in viewport fractions, when the step acted on an element. */
      region: BoxSchema.nullable(),
      label: z.string().nullable(),
      /** When the pointer pressed, for steps that press; absent in older recordings. */
      pressSeconds: z.number().optional(),
      /** When the first key went down, for typing steps; absent in older recordings. */
      keysFromSeconds: z.number().optional(),
    }),
  ),
});
export type RecordingTimeline = z.infer<typeof RecordingTimelineSchema>;
