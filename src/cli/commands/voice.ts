import { Option, type Command } from "commander";
import { audition, selectVoice } from "../../application/voice-audition";
import {
  checkVoiceDirection,
  scaffoldVoiceDirection,
  writeDirectionReport,
} from "../../application/voice-direction";
import { measureNarration } from "../../application/voice-measure";
import { StudioError } from "../../domain/errors";
import { capabilitiesFor, KNOWN_MODELS } from "../../domain/voice-models";
import {
  PRESET_IDS,
  VOICE_PRESETS,
  effectiveSettings,
  presetLevers,
  type PresetId,
} from "../../domain/voice-presets";
import type { Container } from "../container";
import type { Output } from "../output";
import { parseInteger, plural, videoOption } from "../shared";

type Context = () => { container: Container; out: Output };

const DEFAULT_AUDITION_PRESETS: PresetId[] = [
  "natural-educator",
  "cinematic-storyteller",
  "technical-expert",
];

const presetOption = (description: string): Option =>
  new Option("--preset <preset>", description).choices([...PRESET_IDS]);

/** The model a video's narration will use, without calling the provider. */
async function modelOf(container: Container, videoId: string): Promise<string> {
  const manifest = await container.core.manifests.load(videoId);
  return container.narration.synthesizer(manifest.voice.provider).resolveVoice(manifest.voice)
    .modelId;
}

const yesNo = (value: boolean): string => (value ? "yes" : "no");

function printIssues(
  out: Output,
  issues: readonly { severity: string; rule: string; message: string; sceneId?: string }[],
): void {
  for (const issue of issues) {
    out.line(
      `  ${issue.severity.padEnd(7)} ${(issue.sceneId ?? "file").padEnd(16)} ${issue.rule}: ${issue.message}`,
    );
  }
}

export function registerVoiceCommands(program: Command, context: Context): void {
  const voice = program
    .command("voice")
    .description("direct, audition and choose how the narrator performs");

  voice
    .command("models")
    .description("show what each speech model supports, with the source of every claim")
    .option("--model <id>", "show the evidence for one model")
    .action((options: { model?: string }) => {
      const { out } = context();
      if (options.model !== undefined) {
        const model = capabilitiesFor(options.model);
        out.line(`${model.modelId} (${model.family})`);
        for (const [name, claim] of Object.entries(model.claims)) {
          out.line(`\n${name} [${claim.evidence}, checked ${claim.checked}]`);
          out.line(`  ${claim.note}`);
          out.line(`  Source: ${claim.source}`);
        }
        out.result(model);
        return;
      }
      out.table(
        [
          "Model",
          "Settings sent",
          "Tags",
          "SSML break",
          "Context",
          "Stitching",
          "Max chars",
          "Credits/char",
        ],
        KNOWN_MODELS.map((model) => [
          model.modelId,
          Object.entries(model.settings)
            .filter(([, honoured]) => honoured)
            .map(([name]) => name)
            .join(", "),
          yesNo(model.audioTags),
          yesNo(model.ssmlBreak),
          yesNo(model.contextText),
          yesNo(model.requestStitching),
          String(model.maxCharactersPerRequest),
          String(model.creditsPerCharacter),
        ]),
      );
      out.line("\nAny other model is sent plain text with stability and similarity only.");
      out.result(KNOWN_MODELS);
    });

  voice
    .command("presets")
    .description("list the voice presets and what each changes on this video's model")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const capabilities = capabilitiesFor(await modelOf(container, options.video));
      const manifest = await container.core.manifests.load(options.video);
      for (const preset of Object.values(VOICE_PRESETS)) {
        const chosen = manifest.voice.preset === preset.id ? "  (selected)" : "";
        out.line(`${preset.id}${chosen}\n  ${preset.summary}`);
        out.line(
          `  On ${capabilities.modelId}: ${presetLevers(preset, capabilities).join("; ")}\n`,
        );
      }
      out.result(
        Object.values(VOICE_PRESETS).map((preset) => ({
          ...preset,
          effective: effectiveSettings(preset, capabilities),
        })),
      );
    });

  voice
    .command("direct")
    .description("draft voice-direction.json (spoken wording, delivery, pauses) from the script")
    .addOption(videoOption())
    .option("--by <name>", "who is drafting (default: git user.name)")
    .option("--force", "replace an existing direction file and its hand edits")
    .action(async (options: { video: string; by?: string; force?: boolean }) => {
      const { container, out } = context();
      const result = await scaffoldVoiceDirection(container.core, {
        videoId: options.video,
        author: options.by ?? (await container.identity()),
        force: options.force ?? false,
      });
      out.line(`Drafted direction for ${plural(result.scenes, "scene")}: ${result.file}`);
      out.line("This is a heuristic first pass. Rewrite the spoken wording and the pauses, then:");
      out.line(`  pnpm studio voice report --video ${options.video}`);
      out.result(result);
    });

  voice
    .command("report")
    .description("check the voice direction and write the direction report for review")
    .addOption(videoOption())
    .addOption(presetOption("preset to render the direction with (default: the selected one)"))
    .action(async (options: { video: string; preset?: PresetId }) => {
      const { container, out } = context();
      const manifest = await container.core.manifests.load(options.video);
      const report = await writeDirectionReport(container.core, {
        videoId: options.video,
        presetId: options.preset ?? manifest.voice.preset ?? "natural-educator",
        modelId: await modelOf(container, options.video),
      });
      const check = await checkVoiceDirection(container.core, options.video);
      const issues = check?.issues ?? [];
      const errors = issues.filter((issue) => issue.severity === "error").length;
      out.line(
        `${plural(report.scenes.length, "scene")}, preset ${report.presetId} on ${report.modelId}`,
      );
      out.line(`${plural(errors, "error")}, ${plural(issues.length - errors, "warning")}`);
      printIssues(out, issues);
      const approved = manifest.approvals.script?.voiceDirectionHash === report.directionHash;
      out.line(
        approved
          ? "\nThis wording and direction is covered by the current script approval."
          : "\nThis wording and direction is NOT approved. A person reviews the report, then runs `pnpm studio approve --stage script`.",
      );
      out.line(`Read: ${report.files.html}`);
      out.line(`      ${report.files.markdown}`);
      out.result({ ...report, issues, approved });
      if (errors > 0) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `The voice direction has ${plural(errors, "error")}.`,
        );
      }
    });

  voice
    .command("audition")
    .description("generate short samples of one passage across presets, with a measured comparison")
    .addOption(videoOption())
    .option("--scene <id>", "scene to audition (default: the first narrated scene)")
    .addOption(
      new Option("--presets <preset...>", "presets to compare")
        .choices([...PRESET_IDS])
        .default(DEFAULT_AUDITION_PRESETS),
    )
    .option("--voice-id <id...>", "also compare these voices (default: the video's voice)")
    .option(
      "--max-characters <n>",
      "longest passage to speak, cut at a sentence end",
      parseInteger("--max-characters", 50),
      350,
    )
    .option("--dry-run", "show the passage and the cost without generating audio")
    .action(
      async (options: {
        video: string;
        scene?: string;
        presets: PresetId[];
        voiceId?: string[];
        maxCharacters: number;
        dryRun?: boolean;
      }) => {
        const { container, out } = context();
        const result = await audition(container.voice, {
          videoId: options.video,
          presets: options.presets,
          maxCharacters: options.maxCharacters,
          dryRun: options.dryRun ?? false,
          ...(options.scene === undefined ? {} : { sceneId: options.scene }),
          ...(options.voiceId === undefined ? {} : { voiceIds: options.voiceId }),
        });
        out.line(
          `Passage (${result.sceneId}, ${result.passage.length} characters):\n  ${result.passage}\n`,
        );
        out.table(
          ["Preset", "Voice", "Characters sent", "State"],
          result.samples.map((sample) => [
            sample.presetId,
            sample.voiceId,
            String(sample.characters),
            sample.cached ? "cached (free)" : "to generate",
          ]),
        );
        out.line(
          `\n${result.dryRun ? "Would spend" : "Estimated before generating"}: ${result.cost.characters} characters, ${result.cost.credits} credits` +
            (result.cost.usd === null ? "" : `, about $${result.cost.usd.toFixed(2)}`),
        );
        if (result.record && result.report) {
          out.line(
            `Spent: ${result.record.spend.characters} characters, ${result.record.spend.credits} credits, ${result.record.spend.seconds.toFixed(1)}s of audio`,
          );
          out.line(`\nListen: ${result.report.html}`);
          out.line(`Numbers: ${result.report.markdown}`);
          out.line(
            "The numbers describe timing and level. They do not say which sample sounds natural: that needs ears.",
          );
          out.line(`Then: pnpm studio voice select --video ${options.video} --preset <preset>`);
        } else {
          out.line("Nothing was generated.");
        }
        out.result(result);
      },
    );

  voice
    .command("select")
    .description("record the performance you chose after listening to the auditions")
    .addOption(videoOption())
    .addOption(presetOption("the preset you chose").makeOptionMandatory())
    .option("--voice-id <id>", "the voice you chose, when several were auditioned")
    .option("--by <name>", "who listened and chose (default: git user.name)")
    .option("--note <text>", "note stored with the choice", "")
    .action(
      async (options: {
        video: string;
        preset: PresetId;
        voiceId?: string;
        by?: string;
        note: string;
      }) => {
        const { container, out } = context();
        const selection = await selectVoice(container.core, {
          videoId: options.video,
          preset: options.preset,
          selectedBy: options.by ?? (await container.identity()),
          note: options.note,
          ...(options.voiceId === undefined ? {} : { voiceId: options.voiceId }),
        });
        out.line(
          `${selection.preset} selected by ${selection.selectedBy} from audition ${selection.auditionId}.`,
        );
        out.line("Every clip of this video is now due for regeneration in that performance.");
        out.line(`Review the wording: pnpm studio voice report --video ${options.video}`);
        out.line(`Approve it:         pnpm studio approve --video ${options.video} --stage script`);
        out.line(`See the cost:       pnpm studio narrate --video ${options.video} --dry-run`);
        out.result(selection);
      },
    );

  voice
    .command("measure")
    .description("measure every narration clip: loudness, peaks, edges, pauses, pace")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const report = await measureNarration(container.voice, options.video);
      out.table(
        ["Scene", "Seconds", "Words/min", "LUFS", "dBTP", "Lead", "Trail", "Flags"],
        report.rows.map((row) => [
          row.sceneId,
          row.measurement.durationSeconds.toFixed(2),
          row.wordsPerMinute?.toFixed(0) ?? "n/a",
          row.measurement.integratedLufs?.toFixed(1) ?? "n/a",
          row.measurement.truePeakDbtp?.toFixed(1) ?? "n/a",
          row.leadingSilenceSeconds.toFixed(2),
          row.trailingSilenceSeconds.toFixed(2),
          [
            row.clipped ? "clipped" : "",
            row.startMayClick ? "loud start" : "",
            row.endMayClick ? "loud end" : "",
          ]
            .filter(Boolean)
            .join(", ") || "none",
        ]),
      );
      if (report.loudness) {
        out.line(
          `\nLoudness spread: ${report.loudness.spreadLu.toFixed(1)} LU` +
            (report.loudness.outliers.length
              ? ` (outliers: ${report.loudness.outliers.join(", ")})`
              : ""),
        );
      }
      if (report.paceSpread !== null)
        out.line(`Pace spread: ${report.paceSpread.toFixed(0)} words/min`);
      out.line(`Report: ${report.files.markdown}`);
      out.result(report);
    });
}
