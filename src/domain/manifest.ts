import { z } from "zod";
import { StudioError } from "./errors";
import { FormatIdSchema, QualityIdSchema } from "./formats";
import { ContentTypeSchema } from "./script";
import { STAGE_IDS, StageIdSchema, downstreamOf, type StageId } from "./stages";
import { VoiceProviderSchema, VoiceSettingsSchema } from "./voice";
import { PresetIdSchema } from "./voice-presets";

export const MANIFEST_SCHEMA_VERSION = 1;

export const VideoIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "video ids are lowercase words separated by hyphens")
  .max(80);

const Timestamp = z.iso.datetime();
const Hash = z.string().regex(/^[a-f0-9]{64}$/);

export const StageStateSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]),
  /** Hash of the inputs the last successful run consumed; a different hash means stale. */
  inputHash: Hash.nullable().default(null),
  attempts: z.number().int().min(0).default(0),
  startedAt: Timestamp.nullable().default(null),
  completedAt: Timestamp.nullable().default(null),
  error: z.object({ code: z.string(), message: z.string() }).nullable().default(null),
});
export type StageState = z.infer<typeof StageStateSchema>;

const NarrationAssetSchema = z.object({
  cacheKey: Hash,
  /**
   * Hash of the text that was spoken. A render refuses a clip whose text no longer matches
   * the script. Absent on clips made before this was recorded; those are not checked.
   */
  textHash: Hash.optional(),
  file: z.string(),
  wordsFile: z.string(),
  durationSeconds: z.number().positive(),
  characters: z.number().int().min(0),
  provider: VoiceProviderSchema,
  /** `provider` timings come from the speech API; `estimated` ones are derived from duration. */
  timing: z.enum(["provider", "estimated"]),
  createdAt: Timestamp,
  /**
   * Set on performed clips only. `spokenHash` is the hash of the words actually spoken,
   * which differ from the script's when a voice-optimised wording exists; `textHash` above
   * always refers to the script scene the clip belongs to.
   */
  preset: PresetIdSchema.optional(),
  spokenHash: Hash.optional(),
  /** Loudness of the clip as stored, and the fixed gain finishing applied to reach it. */
  loudness: z
    .object({
      integratedLufs: z.number().nullable(),
      truePeakDbtp: z.number().nullable(),
      gainDb: z.number(),
    })
    .optional(),
});
export type NarrationAsset = z.infer<typeof NarrationAssetSchema>;

const RecordingAssetSchema = z.object({
  hash: Hash,
  /** `synthetic` recordings show the labelled demo fixture, never the real product. */
  target: z.enum(["synthetic", "iker"]),
  /** Host shown in the browser frame. */
  displayHost: z.string(),
  /** Whether the scenario had been verified end to end when this was recorded. */
  verified: z.boolean(),
  video: z.string(),
  timeline: z.string(),
  screenshots: z.record(z.string(), z.string()),
  durationSeconds: z.number().positive(),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  recordedAt: Timestamp,
});
export type RecordingAsset = z.infer<typeof RecordingAssetSchema>;

const SceneRenderAssetSchema = z.object({
  hash: Hash,
  file: z.string(),
  durationFrames: z.number().int().positive(),
  renderedAt: Timestamp,
});
export type SceneRenderAsset = z.infer<typeof SceneRenderAssetSchema>;

const FinalAssetSchema = z.object({
  hash: Hash,
  file: z.string(),
  sha256: Hash,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  subtitles: z.object({ srt: z.string(), vtt: z.string() }),
  timeline: z.string(),
  renderedAt: Timestamp,
});
export type FinalAsset = z.infer<typeof FinalAssetSchema>;

const ApprovalSchema = z.object({
  /** What was approved: a script hash, or the SHA-256 of a rendered file. */
  subjectHash: Hash,
  approvedBy: z.string().min(1),
  approvedAt: Timestamp,
  note: z.string().default(""),
  /**
   * True when a tool or agent recorded this to exercise the pipeline, not a person who
   * reviewed the work. An automated approval unlocks only free stand-in narration: it never
   * unlocks paid synthesis, final approval, export or publishing.
   */
  automated: z.boolean().default(false),
  /**
   * Script approvals only: hash of the voice direction (spoken wording, delivery, emphasis
   * and pauses) as it was when approved. null when the video had no direction file. An edit
   * to the direction changes its hash and so voids the approval, exactly as a script edit
   * does. Absent on approvals recorded before voice direction existed.
   */
  voiceDirectionHash: Hash.nullable().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

/** A person's recorded choice of how the narrator performs, made after listening. */
const VoiceSelectionSchema = z.object({
  preset: PresetIdSchema,
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  selectedBy: z.string().min(1),
  selectedAt: Timestamp,
  note: z.string().default(""),
  /** The audition the choice was made from, so the samples heard can be found again. */
  auditionId: z.string().min(1),
});
export type VoiceSelection = z.infer<typeof VoiceSelectionSchema>;

const QaRecordSchema = z.object({
  /** SHA-256 of the file that was checked, so a re-render invalidates the result. */
  subjectHash: Hash,
  passed: z.boolean(),
  failures: z.number().int().min(0),
  warnings: z.number().int().min(0),
  report: z.string(),
  checkedAt: Timestamp,
});

const ExportRecordSchema = z.object({
  cutId: z.string(),
  kind: z.enum(["package", "r2", "youtube"]),
  location: z.string(),
  sha256: Hash.nullable().default(null),
  exportedAt: Timestamp,
});
export type ExportRecord = z.infer<typeof ExportRecordSchema>;

const HistoryEventSchema = z.object({
  at: Timestamp,
  stage: StageIdSchema,
  event: z.string(),
  detail: z.string().default(""),
});
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;

export const ManifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  id: VideoIdSchema,
  title: z.string().min(1),
  topic: z.string().min(1),
  audience: z.string(),
  contentType: ContentTypeSchema,
  template: z.string().min(1),
  /** Format of the primary cut; every cut records its own format in the storyboard. */
  format: FormatIdSchema,
  durationTarget: z.object({
    minSeconds: z.number().positive(),
    maxSeconds: z.number().positive(),
  }),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  script: z.object({ version: z.number().int().min(0), hash: Hash.nullable() }),
  storyboard: z.object({ version: z.number().int().min(0), hash: Hash.nullable() }),
  voice: VoiceSettingsSchema,
  /** null until a person runs `pnpm studio voice select`. Absent in older manifests. */
  voiceSelection: VoiceSelectionSchema.nullable().default(null),
  render: z.object({
    quality: QualityIdSchema.default("final"),
    reducedMotion: z.boolean().default(false),
  }),
  stages: z.record(StageIdSchema, StageStateSchema),
  assets: z.object({
    /** Keyed by scene id. */
    narration: z.record(z.string(), NarrationAssetSchema),
    /** Keyed by scenario id. */
    recordings: z.record(z.string(), RecordingAssetSchema),
    /** Keyed by `<cut>/<quality>/<scene>`. */
    sceneRenders: z.record(z.string(), SceneRenderAssetSchema),
    /** Keyed by `<cut>/<quality>`. */
    finals: z.record(z.string(), FinalAssetSchema),
    thumbnails: z.array(z.object({ variant: z.string(), file: z.string(), hash: Hash })),
  }),
  /** Keyed by `<cut>/<quality>`. */
  qa: z.record(z.string(), QaRecordSchema),
  approvals: z.object({
    script: ApprovalSchema.nullable(),
    /** Keyed by cut id; only final-quality renders can be approved. */
    final: z.record(z.string(), ApprovalSchema),
  }),
  usage: z.object({
    /** Characters actually sent to a paid speech API for this video. */
    synthesisedCharacters: z.number().int().min(0),
    synthesisRequests: z.number().int().min(0),
    cacheHits: z.number().int().min(0),
    /** Seconds of audio paid for, auditions and previews included. */
    generatedSeconds: z.number().min(0).default(0),
    /** Credits as reported by the provider per request, or estimated when it reports none. */
    credits: z.number().min(0).default(0),
    /** Paid requests for a scene that already had a clip: the cost of changing one's mind. */
    regenerations: z.number().int().min(0).default(0),
  }),
  exports: z.array(ExportRecordSchema),
  history: z.array(HistoryEventSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

const HISTORY_LIMIT = 200;

export function emptyStages(): Manifest["stages"] {
  const pending = StageStateSchema.parse({ status: "pending" });
  return Object.fromEntries(STAGE_IDS.map((id) => [id, { ...pending }])) as Manifest["stages"];
}

export interface NewManifestInput {
  id: string;
  title: string;
  topic: string;
  audience: string;
  contentType: Manifest["contentType"];
  template: string;
  format: Manifest["format"];
  durationTarget: Manifest["durationTarget"];
  voice: Manifest["voice"];
  now: string;
}

export function createManifest(input: NewManifestInput): Manifest {
  const { now, ...rest } = input;
  return ManifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    ...rest,
    createdAt: now,
    updatedAt: now,
    script: { version: 0, hash: null },
    storyboard: { version: 0, hash: null },
    render: {},
    stages: emptyStages(),
    assets: { narration: {}, recordings: {}, sceneRenders: {}, finals: {}, thumbnails: [] },
    qa: {},
    approvals: { script: null, final: {} },
    usage: { synthesisedCharacters: 0, synthesisRequests: 0, cacheHits: 0 },
    exports: [],
    history: [],
  });
}

export function parseManifest(raw: unknown, source: string): Manifest {
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `${source} is not a valid manifest: ${z.prettifyError(parsed.error)}`,
      { hint: "Restore the file from Git or re-create the video with `pnpm studio create`." },
    );
  }
  return parsed.data;
}

export function withHistory(manifest: Manifest, event: HistoryEvent): Manifest {
  return { ...manifest, history: [...manifest.history, event].slice(-HISTORY_LIMIT) };
}

export function stageState(manifest: Manifest, stage: StageId): StageState {
  return manifest.stages[stage];
}

/** A stage is current when it completed against exactly these inputs. */
export function isStageCurrent(manifest: Manifest, stage: StageId, inputHash: string): boolean {
  const state = manifest.stages[stage];
  return state.status === "completed" && state.inputHash === inputHash;
}

/** Marks every stage downstream of `stage` as pending, keeping their cached assets. */
export function invalidateDownstream(manifest: Manifest, stage: StageId): Manifest {
  const stages = { ...manifest.stages };
  for (const id of downstreamOf(stage)) {
    if (stages[id].status !== "pending") stages[id] = { ...stages[id], status: "pending" };
  }
  return { ...manifest, stages };
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function sceneRenderKey(cutId: string, quality: string, sceneId: string): string {
  return `${cutId}/${quality}/${sceneId}`;
}

export function finalKey(cutId: string, quality: string): string {
  return `${cutId}/${quality}`;
}
