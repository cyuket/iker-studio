import path from "node:path";
import { z } from "zod";
import { WordTimingSchema, type WordTiming } from "../domain/captions";
import { StudioError } from "../domain/errors";
import { hashOf, shortHash } from "../domain/hash";
import { withHistory, type Manifest, type VoiceSelection } from "../domain/manifest";
import { estimateSynthesisCost, type CostEstimate, type VoiceSettings } from "../domain/voice";
import {
  ClipMeasurementSchema,
  clipFindings,
  edgeSilence,
  levelGainDb,
  paceOf,
  sentenceEndSeconds,
  soundBeforeSpeech,
  STRAY_SOUND_SECONDS,
  summariseAcousticPauses,
  summarisePauses,
  type ClipMeasurement,
} from "../domain/voice-audio";
import { normaliseSpoken, splitSentences } from "../domain/voice-direction";
import { capabilitiesFor } from "../domain/voice-models";
import { measurePauses } from "../domain/voice-performance";
import {
  PRESET_IDS,
  PresetIdSchema,
  presetById,
  presetLevers,
  type PresetId,
} from "../domain/voice-presets";
import { loadPronunciations, loadScript } from "./context";
import { html, page, raw } from "./html";
import {
  cachePaths,
  performedItem,
  performedVoice,
  readCacheEntry,
  recordUsage,
  synthesizeToCache,
  type NarrationDeps,
  type NarrationItem,
  type Spend,
} from "./narration";
import type { AudioTools } from "./ports";
import { checkVoiceDirection, requireAcceptedDirection, voiceReviewDir } from "./voice-direction";

export interface AuditionDeps extends NarrationDeps {
  audio: AudioTools;
}

/** Longest passage an audition speaks. Enough to judge a delivery, not to narrate a film. */
export const AUDITION_CHARACTER_LIMIT = 400;
/** Most samples one run may buy, so a typo cannot spend a script's worth of credits. */
export const AUDITION_SAMPLE_LIMIT = 6;

/**
 * What a person listens for. The machine does not score any of this: naturalness is a
 * judgement for ears, and the report says so beside the numbers.
 */
export const LISTENING_CHECKLIST: readonly string[] = [
  "Does it sound like a person who understands the subject, or like someone reading?",
  "Is the pace comfortable to follow while also looking at the screen?",
  "Do the pauses fall where a thought ends, and are any of them awkward or missing?",
  "Is anything stressed that should not be, or flat where the point is?",
  "Are the brand name and every product term said correctly?",
  "Any artefacts: a breath or sound that was not asked for, a swallowed word, a change of voice or accent, a rise in pitch at the end of a statement?",
  "Would you be comfortable hearing two more minutes of this delivery?",
];

const MeasuredSampleSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** null for the "before" sample cut from the existing narration. */
  presetId: PresetIdSchema.nullable(),
  voiceId: z.string(),
  /** Relative to the video directory. */
  file: z.string(),
  cacheKey: z.string().nullable(),
  /** The exact text sent, markup included; null for the "before" sample. */
  sentText: z.string().nullable(),
  levers: z.array(z.string()),
  characters: z.number(),
  credits: z.number(),
  fromCache: z.boolean(),
  measurement: ClipMeasurementSchema,
  words: z.number(),
  wordsPerMinute: z.number().nullable(),
  articulationWordsPerMinute: z.number().nullable(),
  pauseCount: z.number(),
  pauseTotalSeconds: z.number(),
  longestPauseSeconds: z.number(),
  medianPauseSeconds: z.number(),
  leadingSilenceSeconds: z.number(),
  trailingSilenceSeconds: z.number(),
  clipped: z.boolean(),
  edgeMayClick: z.boolean(),
  /** Gain per-clip finishing would apply to this sample in a full narration. */
  levellingGainDb: z.number(),
  /** Non-silent audio before the first word. More than a moment deserves a listen. */
  soundBeforeSpeechSeconds: z.number(),
  /** The same pauses read from word timings, which understate them. Kept for comparison. */
  timingPauseCount: z.number(),
  timingPauseTotalSeconds: z.number(),
  directedPauses: z.array(
    z.object({
      kind: z.string(),
      after: z.string(),
      rendering: z.string(),
      targetSeconds: z.number(),
      measuredSeconds: z.number().nullable(),
      audioSeconds: z.number().nullable(),
    }),
  ),
  wordTimings: z.array(WordTimingSchema),
});
export type MeasuredSample = z.infer<typeof MeasuredSampleSchema>;

export const AuditionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  auditionId: z.string(),
  videoId: z.string(),
  sceneId: z.string(),
  /** The plain words every sample speaks. */
  passage: z.string(),
  scriptPassage: z.string(),
  modelId: z.string(),
  createdAt: z.string(),
  samples: z.array(MeasuredSampleSchema),
  before: MeasuredSampleSchema.nullable(),
  spend: z.object({ characters: z.number(), credits: z.number(), seconds: z.number() }),
});
export type AuditionRecord = z.infer<typeof AuditionRecordSchema>;

export interface AuditionInput {
  videoId: string;
  /** Scene to audition. Default: the first narrated scene of the first cut. */
  sceneId?: string;
  presets: readonly PresetId[];
  /** Voices to compare. Default: the video's own voice. */
  voiceIds?: readonly string[];
  maxCharacters: number;
  dryRun: boolean;
}

export interface AuditionPlanSample {
  item: Omit<NarrationItem, "state">;
  presetId: PresetId;
  voiceId: string;
  cached: boolean;
}

export interface AuditionResult {
  passage: string;
  sceneId: string;
  samples: { presetId: PresetId; voiceId: string; characters: number; cached: boolean }[];
  cost: CostEstimate;
  dryRun: boolean;
  record: AuditionRecord | null;
  report: { html: string; markdown: string; json: string } | null;
}

/** As many whole sentences from the start of a text as fit in the limit. */
export function passageWithin(text: string, limit: number): string {
  const sentences = splitSentences(text);
  let passage = "";
  for (const sentence of sentences) {
    const candidate = passage ? `${passage} ${sentence}` : sentence;
    if (candidate.length > limit) break;
    passage = candidate;
  }
  return passage || normaliseSpoken(text).slice(0, limit);
}

function auditionPaths(deps: AuditionDeps, videoId: string) {
  const paths = deps.layout.video(videoId);
  const review = voiceReviewDir(deps.layout, videoId);
  return {
    paths,
    audioDir: path.join(paths.audio, "auditions"),
    json: path.join(review, "audition.json"),
    html: path.join(review, "audition.html"),
    markdown: path.join(review, "audition.md"),
  };
}

function measured(
  base: Pick<
    MeasuredSample,
    | "id"
    | "label"
    | "presetId"
    | "voiceId"
    | "file"
    | "cacheKey"
    | "sentText"
    | "levers"
    | "characters"
    | "credits"
    | "fromCache"
    | "directedPauses"
  >,
  measurement: ClipMeasurement,
  words: readonly WordTiming[],
  voice: VoiceSettings,
): MeasuredSample {
  const pace = paceOf(words);
  // Pauses are read from the waveform. Word timings are kept beside them for comparison.
  const pauses = summariseAcousticPauses(measurement);
  const timed = summarisePauses(words);
  const speechSeconds = (pace?.speechSeconds ?? 0) - pauses.totalSeconds;
  const edges = edgeSilence(measurement);
  const findings = clipFindings(measurement);
  return {
    ...base,
    measurement,
    words: words.length,
    wordsPerMinute: pace?.wordsPerMinute ?? null,
    articulationWordsPerMinute: speechSeconds > 0 ? (words.length / speechSeconds) * 60 : null,
    pauseCount: pauses.count,
    pauseTotalSeconds: pauses.totalSeconds,
    longestPauseSeconds: pauses.longestSeconds,
    medianPauseSeconds: pauses.medianSeconds,
    leadingSilenceSeconds: edges.leadingSeconds,
    trailingSilenceSeconds: edges.trailingSeconds,
    clipped: findings.clipped,
    edgeMayClick: findings.startMayClick || findings.endMayClick,
    levellingGainDb: levelGainDb(measurement, voice.finishing),
    soundBeforeSpeechSeconds: soundBeforeSpeech(measurement, words),
    timingPauseCount: timed.count,
    timingPauseTotalSeconds: timed.totalSeconds,
    wordTimings: [...words],
  };
}

/**
 * The same passage from the narration the video already has, cut out with FFmpeg. It costs
 * nothing and gives the listener an honest "before" to compare against.
 */
async function beforeSample(
  deps: AuditionDeps,
  manifest: Manifest,
  sceneId: string,
  wholeScene: boolean,
  sentences: number,
): Promise<MeasuredSample | null> {
  const { paths, audioDir } = auditionPaths(deps, manifest.id);
  const asset = manifest.assets.narration[sceneId];
  if (!asset || !(await deps.files.exists(paths.absolute(asset.file)))) return null;
  const all = z
    .array(WordTimingSchema)
    .parse(await deps.files.readJson(paths.absolute(asset.wordsFile)));
  // The old clip speaks the script wording, so the same number of sentences is the closest
  // equivalent passage when the spoken version was shortened to fit.
  const cutAt = wholeScene ? null : sentenceEndSeconds(all, sentences);
  const end =
    cutAt === null ? asset.durationSeconds : Math.min(asset.durationSeconds, cutAt + 0.15);
  const words = all.filter((word) => word.startSeconds < end);
  const file = path.join(audioDir, `${sceneId}-before${path.extname(asset.file)}`);
  await deps.audio.cutAudio(paths.absolute(asset.file), file, 0, end);
  return measured(
    {
      id: "before",
      label: "Before (existing narration)",
      presetId: null,
      voiceId: manifest.voice.voiceId ?? "environment default",
      file: paths.relative(file),
      cacheKey: asset.cacheKey,
      sentText: null,
      levers: ["script wording", "flat default settings", "no direction", "no context"],
      characters: 0,
      credits: 0,
      fromCache: true,
      directedPauses: [],
    },
    await deps.audio.measureClip(file),
    words,
    manifest.voice,
  );
}

interface AuditionSetup {
  manifest: Manifest;
  sceneId: string;
  scriptPassage: string;
  passage: string;
  wholeScene: boolean;
  modelId: string;
  planned: AuditionPlanSample[];
  cost: CostEstimate;
}

async function prepare(deps: AuditionDeps, input: AuditionInput): Promise<AuditionSetup> {
  if (input.maxCharacters > AUDITION_CHARACTER_LIMIT) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `Audition passages are limited to ${AUDITION_CHARACTER_LIMIT} characters.`,
    );
  }
  const manifest = await deps.manifests.load(input.videoId);
  const { script } = await loadScript(deps, input.videoId);
  const check = await checkVoiceDirection(deps, input.videoId);
  // Unapproved wording may be auditioned, but never wording that fails its own checks.
  if (check) requireAcceptedDirection(check, input.videoId);
  const scenes = (script.cuts[0]?.scenes ?? []).filter((scene) => scene.narration.trim());
  const index = input.sceneId ? scenes.findIndex((scene) => scene.id === input.sceneId) : 0;
  const scene = scenes[index];
  if (!scene) {
    throw new StudioError(
      "NOT_FOUND",
      `No narrated scene "${input.sceneId ?? ""}" in the first cut.`,
    );
  }
  const spokenOf = (id: string | undefined, fallback: string | undefined): string | null =>
    id === undefined ? null : (check?.direction.scenes[id]?.spoken ?? fallback ?? null);
  const full = normaliseSpoken(spokenOf(scene.id, scene.narration) ?? scene.narration);
  const passage = passageWithin(full, input.maxCharacters);
  const rest = full.slice(passage.length).trim();
  const next = scenes[index + 1];
  const previous = scenes[index - 1];

  const synthesizer = deps.synthesizer(manifest.voice.provider);
  const base = synthesizer.resolveVoice(manifest.voice);
  const voiceIds = input.voiceIds?.length ? input.voiceIds : [base.voiceId];
  const combinations = voiceIds.flatMap((voiceId) =>
    input.presets.map((presetId) => ({ voiceId, presetId })),
  );
  if (combinations.length === 0 || combinations.length > AUDITION_SAMPLE_LIMIT) {
    throw new StudioError(
      "VALIDATION_FAILED",
      `An audition compares 1 to ${AUDITION_SAMPLE_LIMIT} samples; this asks for ${combinations.length}.`,
    );
  }
  const entries = await loadPronunciations(deps);
  const planned: AuditionPlanSample[] = [];
  for (const { voiceId, presetId } of combinations) {
    const item = performedItem({
      sceneId: scene.id,
      scriptText: scene.narration,
      voice: performedVoice(manifest.voice, presetId),
      voiceId,
      modelId: base.modelId,
      preset: presetId,
      direction: check?.direction ?? null,
      entries,
      previousText: spokenOf(previous?.id, previous?.narration),
      // What follows the passage: the rest of the scene, else the next scene.
      nextText: rest || spokenOf(next?.id, next?.narration),
      spokenOverride: passage,
    });
    const cached = (await readCacheEntry(deps, item.cacheKey)) !== null;
    planned.push({ item, presetId, voiceId, cached });
  }
  return {
    manifest,
    sceneId: scene.id,
    scriptPassage: scene.narration,
    passage,
    wholeScene: passage === full,
    modelId: base.modelId,
    planned,
    cost: estimateSynthesisCost(
      planned.filter((sample) => !sample.cached).map((sample) => sample.item.requestText),
      manifest.voice.provider,
      base.modelId,
      deps.usdPerThousandCredits(),
    ),
  };
}

/**
 * Generates short samples of one passage across presets (and optionally voices), measures
 * them, and writes a comparison a person can listen to. Samples are cached like any clip:
 * running the same audition twice costs nothing the second time.
 */
export async function audition(deps: AuditionDeps, input: AuditionInput): Promise<AuditionResult> {
  const setup = await prepare(deps, input);
  const { manifest, planned, modelId } = setup;
  const summary = {
    passage: setup.passage,
    sceneId: setup.sceneId,
    samples: planned.map((sample) => ({
      presetId: sample.presetId,
      voiceId: sample.voiceId,
      characters: sample.item.characters,
      cached: sample.cached,
    })),
    cost: setup.cost,
  };
  if (input.dryRun) return { ...summary, dryRun: true, record: null, report: null };

  const files = auditionPaths(deps, input.videoId);
  const synthesizer = deps.synthesizer(manifest.voice.provider);
  const capabilities = capabilitiesFor(modelId);
  const manyVoices = new Set(planned.map((sample) => sample.voiceId)).size > 1;
  const total: Spend = { characters: 0, credits: 0, seconds: 0 };
  let usage = manifest.usage;
  const samples: MeasuredSample[] = [];

  for (const sample of planned) {
    const voice = performedVoice(manifest.voice, sample.presetId);
    let entry = await readCacheEntry(deps, sample.item.cacheKey);
    let spend: Spend | null = null;
    const fromCache = entry !== null;
    if (!entry) {
      deps.logger.info("Synthesising audition sample", {
        preset: sample.presetId,
        characters: sample.item.characters,
      });
      ({ entry, spend } = await synthesizeToCache(
        deps,
        synthesizer,
        { provider: manifest.voice.provider, voiceId: sample.voiceId, modelId, voice },
        sample.item,
      ));
      total.characters += spend.characters;
      total.credits += spend.credits;
      total.seconds += spend.seconds;
    }
    usage = recordUsage(usage, { spend, cacheHit: fromCache, regeneration: false });
    const suffix = manyVoices ? `-${sample.voiceId.slice(0, 8)}` : "";
    const id = `${sample.presetId}${suffix}`;
    const file = path.join(files.audioDir, `${setup.sceneId}-${id}.${entry.extension}`);
    await deps.files.copy(
      `${cachePaths(deps, sample.item.cacheKey).base}.${entry.extension}`,
      file,
    );
    const preset = presetById(sample.presetId);
    const measurement = await deps.audio.measureClip(file);
    samples.push(
      measured(
        {
          id,
          label: manyVoices ? `${preset.label} (${sample.voiceId.slice(0, 8)})` : preset.label,
          presetId: sample.presetId,
          voiceId: sample.voiceId,
          file: files.paths.relative(file),
          cacheKey: sample.item.cacheKey,
          sentText: sample.item.requestText,
          levers: presetLevers(preset, capabilities),
          characters: sample.item.characters,
          credits: spend?.credits ?? entry.billedCredits ?? sample.item.characters,
          fromCache,
          directedPauses: sample.item.rendered
            ? measurePauses(sample.item.rendered, entry.words, measurement).map((pause) => ({
                kind: pause.kind,
                after: pause.after,
                rendering: pause.rendering,
                targetSeconds: pause.targetSeconds,
                measuredSeconds: pause.measuredSeconds,
                audioSeconds: pause.audioSeconds,
              }))
            : [],
        },
        measurement,
        entry.words,
        voice,
      ),
    );
  }

  const record: AuditionRecord = {
    schemaVersion: 1,
    auditionId: shortHash(hashOf(planned.map((sample) => sample.item.cacheKey))),
    videoId: input.videoId,
    sceneId: setup.sceneId,
    passage: setup.passage,
    scriptPassage: setup.scriptPassage,
    modelId,
    createdAt: deps.clock.now().toISOString(),
    samples,
    before: await beforeSample(
      deps,
      manifest,
      setup.sceneId,
      setup.wholeScene,
      splitSentences(setup.passage).length,
    ),
    spend: total,
  };
  await deps.files.writeJson(files.json, record);
  await deps.files.writeText(files.html, auditionHtml(record, files.html, files.paths.root));
  await deps.files.writeText(files.markdown, auditionMarkdown(record));
  // Only the ledger changes: an audition never touches narration assets or approvals.
  const current = await deps.manifests.load(input.videoId);
  await deps.manifests.save({ ...current, usage });
  return {
    ...summary,
    dryRun: false,
    record,
    report: { html: files.html, markdown: files.markdown, json: files.json },
  };
}

const fixed = (value: number | null, digits: number, unit = ""): string =>
  value === null ? "n/a" : `${value.toFixed(digits)}${unit}`;

/** The measured columns, shared by the HTML and markdown reports. */
export function comparisonRows(record: AuditionRecord): { headers: string[]; rows: string[][] } {
  const all = [...(record.before ? [record.before] : []), ...record.samples];
  return {
    headers: [
      "Sample",
      "Duration",
      "Words/min",
      "Articulation w/min",
      "Pauses ≥0.25s",
      "Pause total",
      "Longest pause",
      "Loudness",
      "True peak",
      "Range",
      "Lead / trail silence",
    ],
    rows: all.map((sample) => [
      sample.label,
      fixed(sample.measurement.durationSeconds, 2, "s"),
      fixed(sample.wordsPerMinute, 0),
      fixed(sample.articulationWordsPerMinute, 0),
      String(sample.pauseCount),
      fixed(sample.pauseTotalSeconds, 2, "s"),
      fixed(sample.longestPauseSeconds, 2, "s"),
      fixed(sample.measurement.integratedLufs, 1, " LUFS"),
      fixed(sample.measurement.truePeakDbtp, 1, " dBTP"),
      fixed(sample.measurement.loudnessRange, 1, " LU"),
      `${fixed(sample.leadingSilenceSeconds, 2, "s")} / ${fixed(sample.trailingSilenceSeconds, 2, "s")}`,
    ]),
  };
}

const NOT_SCORED =
  "Nothing on this page rates how natural a sample sounds. No software in this project can hear. The table reports timing and level only; which delivery is right is decided by listening.";

function flags(sample: MeasuredSample): string[] {
  return [
    ...(sample.clipped ? ["Clipping measured."] : []),
    ...(sample.edgeMayClick ? ["An edge is not silent: a join here could click."] : []),
    ...(sample.soundBeforeSpeechSeconds >= STRAY_SOUND_SECONDS
      ? [
          `${sample.soundBeforeSpeechSeconds.toFixed(2)}s of sound before the first word. It may be a breath, a noise or a voiced tag: listen to the very start.`,
        ]
      : []),
    ...(sample.levellingGainDb === 0
      ? []
      : [
          `Finishing would apply ${sample.levellingGainDb.toFixed(1)} dB to reach the clip target.`,
        ]),
  ];
}

export function auditionMarkdown(record: AuditionRecord): string {
  const { headers, rows } = comparisonRows(record);
  const lines = [
    `# Voice audition: ${record.videoId} / ${record.sceneId}`,
    "",
    `Audition \`${record.auditionId}\`, model \`${record.modelId}\`, ${record.createdAt}.`,
    "",
    `> ${NOT_SCORED}`,
    "",
    "## Passage",
    "",
    record.passage,
    "",
    "## Measured",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Samples",
    "",
  ];
  for (const sample of [...(record.before ? [record.before] : []), ...record.samples]) {
    lines.push(`### ${sample.label}`, "", `File: \`${sample.file}\``, "");
    lines.push(`Levers: ${sample.levers.join("; ")}.`, "");
    if (sample.sentText !== null) lines.push("```text", sample.sentText, "```", "");
    for (const pause of sample.directedPauses) {
      lines.push(
        `- ${pause.kind} after "${pause.after}" (${pause.rendering}): asked ${pause.targetSeconds.toFixed(2)}s, in the audio ${fixed(pause.audioSeconds, 2, "s")} (word timings say ${fixed(pause.measuredSeconds, 2, "s")})`,
      );
    }
    for (const flag of flags(sample)) lines.push(`- ${flag}`);
    lines.push("");
  }
  lines.push(
    "## Listening checklist",
    "",
    ...LISTENING_CHECKLIST.map((item) => `- [ ] ${item}`),
    "",
  );
  lines.push(
    "## Recording the choice",
    "",
    `\`pnpm studio voice select --video ${record.videoId} --preset <preset>\``,
    "",
  );
  return lines.join("\n");
}

export function auditionHtml(
  record: AuditionRecord,
  reportFile: string,
  videoRoot: string,
): string {
  const { headers, rows } = comparisonRows(record);
  const all = [...(record.before ? [record.before] : []), ...record.samples];
  const source = (sample: MeasuredSample): string =>
    path
      .relative(path.dirname(reportFile), path.join(videoRoot, sample.file))
      .split(path.sep)
      .join("/");
  const cards = all.map(
    (sample) => html`
      <section class="card">
        <h2>${sample.label}</h2>
        <audio controls preload="metadata" src="${source(sample)}" style="width:100%"></audio>
        <p class="muted">${sample.file} · ${sample.levers.join("; ")}</p>
        ${
          sample.sentText === null
            ? ""
            : raw(html`<pre style="white-space:pre-wrap">${sample.sentText}</pre>`)
        }
        <ul>
          ${raw(
            [
              ...sample.directedPauses.map(
                (pause) =>
                  html`<li>
                    ${pause.kind} after "${pause.after}" (${pause.rendering}): asked
                    ${pause.targetSeconds.toFixed(2)}s, in the audio
                    ${fixed(pause.audioSeconds, 2, "s")} (word timings say
                    ${fixed(pause.measuredSeconds, 2, "s")})
                  </li>`,
              ),
              ...flags(sample).map((flag) => html`<li>${flag}</li>`),
            ].join(""),
          )}
        </ul>
      </section>
    `,
  );
  return page(
    `Voice audition: ${record.videoId}`,
    html`<h1>Voice audition: ${record.videoId} / ${record.sceneId}</h1>
      <p><strong>${NOT_SCORED}</strong></p>
      <p class="muted">Audition ${record.auditionId} · ${record.modelId} · ${record.createdAt}</p>
      <section class="card">
        <h2>Passage</h2>
        <p>${record.passage}</p>
      </section>
      ${raw(cards.join(""))}
      <section class="card">
        <h2>Measured</h2>
        <table>
          <thead>
            <tr>
              ${raw(headers.map((header) => html`<th>${header}</th>`).join(""))}
            </tr>
          </thead>
          <tbody>
            ${raw(
              rows
                .map(
                  (row) =>
                    html`<tr>
                      ${raw(row.map((cell) => html`<td>${cell}</td>`).join(""))}
                    </tr>`,
                )
                .join(""),
            )}
          </tbody>
        </table>
        <p class="muted">
          Pace counts words from the first word to the last. Articulation leaves out pauses of 0.25
          s or more. Loudness is integrated (EBU R128) on the raw sample, before any finishing.
        </p>
      </section>
      <section class="card">
        <h2>Listening checklist</h2>
        <ul>
          ${raw(LISTENING_CHECKLIST.map((item) => html`<li>${item}</li>`).join(""))}
        </ul>
        <p>
          Record the choice:
          <code>pnpm studio voice select --video ${record.videoId} --preset &lt;preset&gt;</code>
        </p>
      </section>`,
  );
}

export async function loadAudition(
  deps: Pick<AuditionDeps, "layout" | "files">,
  videoId: string,
): Promise<AuditionRecord | null> {
  const file = path.join(voiceReviewDir(deps.layout, videoId), "audition.json");
  if (!(await deps.files.exists(file))) return null;
  const parsed = AuditionRecordSchema.safeParse(await deps.files.readJson(file));
  return parsed.success ? parsed.data : null;
}

export interface SelectInput {
  videoId: string;
  preset: PresetId;
  voiceId?: string;
  selectedBy: string;
  note: string;
}

/**
 * Records a person's choice of performance after listening. The choice must be one of the
 * samples in the latest audition, so nobody selects a delivery nobody heard. From here on
 * the video's narration is planned with this preset, and the old clips show as stale.
 */
export async function selectVoice(
  deps: Pick<AuditionDeps, "layout" | "files" | "manifests" | "clock">,
  input: SelectInput,
): Promise<VoiceSelection> {
  const record = await loadAudition(deps, input.videoId);
  const heard = record?.samples.find(
    (sample) =>
      sample.presetId === input.preset &&
      (input.voiceId === undefined || sample.voiceId === input.voiceId),
  );
  if (!record || !heard) {
    throw new StudioError(
      "APPROVAL_REQUIRED",
      `There is no audition sample for "${input.preset}" to have listened to.`,
      {
        hint: `Run \`pnpm studio voice audition --video ${input.videoId}\`, listen, then select one of: ${record?.samples.map((s) => s.id).join(", ") ?? PRESET_IDS.join(", ")}.`,
      },
    );
  }
  const manifest = await deps.manifests.load(input.videoId);
  const at = deps.clock.now().toISOString();
  const selection: VoiceSelection = {
    preset: input.preset,
    voiceId: heard.voiceId,
    modelId: record.modelId,
    selectedBy: input.selectedBy,
    selectedAt: at,
    note: input.note,
    auditionId: record.auditionId,
  };
  await deps.manifests.save(
    withHistory(
      {
        ...manifest,
        voice: { ...manifest.voice, preset: input.preset, voiceId: heard.voiceId },
        voiceSelection: selection,
      },
      {
        at,
        stage: "voice",
        event: "performance selected",
        detail: `${input.preset} by ${input.selectedBy}`,
      },
    ),
  );
  return selection;
}
