import { Option, type Command } from "commander";
import { approveFinal, approveScript } from "../../application/approval";
import { checkScript, createVideo, updateStoryboard } from "../../application/authoring";
import { loadPronunciations, loadResearch } from "../../application/context";
import { approvePronunciation, setPronunciation } from "../../application/housekeeping";
import { inspectVideo, reportCosts } from "../../application/inspect";
import { renderStoryboardPreview } from "../../application/storyboard-preview";
import { StudioError } from "../../domain/errors";
import { FORMATS } from "../../domain/formats";
import { CONTENT_TYPES, type ContentType } from "../../domain/script";
import { VOICE_PROVIDERS, type VoiceProvider } from "../../domain/voice";
import type { Container } from "../container";
import { seconds, type Output } from "../output";
import { cutOption, plural, qualityOption, videoOption } from "../shared";

type Context = () => { container: Container; out: Output };

function approvalLabel(script: { approved: boolean; approvalAutomated: boolean }): string {
  if (!script.approved) return "not approved";
  return script.approvalAutomated
    ? "approved by automation only (not reviewed by a person)"
    : "approved";
}

export function registerAuthoringCommands(program: Command, context: Context): void {
  program
    .command("create")
    .description("start a new video: manifest, script skeleton and research notes")
    .requiredOption("--topic <topic>", "what the video is about")
    .option("--title <title>", "working title (default: the topic)")
    .option("--id <id>", "video id (default: derived from the title)")
    .option("--audience <audience>", "who the video is for")
    .addOption(
      new Option("--type <type>", "content type")
        .choices([...CONTENT_TYPES])
        .default("PRODUCT_TUTORIAL"),
    )
    .option(
      "--template <id>",
      "template to start from (see `pnpm studio templates list`)",
      "product-tutorial",
    )
    .addOption(
      new Option("--voice-provider <provider>", "voice for narration")
        .choices([...VOICE_PROVIDERS])
        .default("elevenlabs"),
    )
    .option("--demo", "start from the template's finished demo instead of a blank skeleton")
    .action(
      async (options: {
        topic: string;
        title?: string;
        id?: string;
        audience?: string;
        type: ContentType;
        template: string;
        voiceProvider: VoiceProvider;
        demo?: boolean;
      }) => {
        const { container, out } = context();
        const manifest = await createVideo(container.core, {
          topic: options.topic,
          contentType: options.type,
          template: options.template,
          voiceProvider: options.voiceProvider,
          demo: options.demo ?? false,
          ...(options.title === undefined ? {} : { title: options.title }),
          ...(options.id === undefined ? {} : { id: options.id }),
          ...(options.audience === undefined ? {} : { audience: options.audience }),
        });
        const paths = container.core.layout.video(manifest.id);
        out.line(`Created video "${manifest.id}".`);
        out.line(`  Research notes: ${paths.research}`);
        out.line(`  Script:         ${paths.script}`);
        out.line(`\nNext: record verified facts in research.md, write the script, then run`);
        out.line(`  pnpm studio script --video ${manifest.id}`);
        out.result({
          id: manifest.id,
          script: paths.script,
          research: paths.research,
          manifest: paths.manifest,
        });
      },
    );

  program
    .command("plan")
    .description("show what is out of date, which stages must run and what narration will cost")
    .addOption(videoOption())
    .addOption(qualityOption("final"))
    .action(async (options: { video: string; quality: "preview" | "final" }) => {
      const { container, out } = context();
      const inspection = await inspectVideo(container.inspect, options.video, options.quality);
      const facts = await loadResearch(container.core, options.video);
      out.line(`${inspection.title}  (${inspection.videoId})\n`);
      out.line(`Research:    ${plural(facts.length, "verified fact")} in research.md`);
      out.line(
        `Script:      v${inspection.script.version}, ${inspection.script.changedSinceCheck ? "changed since last check" : "checked"}, ${approvalLabel(inspection.script)}`,
      );
      out.line(
        `Storyboard:  ${inspection.storyboard.present ? (inspection.storyboard.inSync ? `v${inspection.storyboard.version}, in sync` : "out of date with the script") : "not created"}`,
      );

      const stale = (items: readonly { state: string }[]): number =>
        items.filter((item) => item.state !== "current").length;
      if (inspection.storyboard.inSync) {
        out.line(`\nInvalidated assets`);
        out.line(
          `  Narration:  ${stale(inspection.narration)} of ${inspection.narration.length} clips to generate` +
            (inspection.narration.some((n) => n.state === "cached")
              ? ` (${inspection.narration.filter((n) => n.state === "cached").length} free from cache)`
              : ""),
        );
        out.line(
          `  Recordings: ${stale(inspection.recordings)} of ${inspection.recordings.length} to record`,
        );
        out.line(
          `  Scenes:     ${stale(inspection.scenes)} of ${inspection.scenes.length} to render`,
        );
        const invalid = inspection.scenes.filter((scene) => scene.state !== "current");
        if (invalid.length && invalid.length <= 20)
          out.line(
            `              ${invalid.map((scene) => `${scene.cutId}/${scene.sceneId}`).join(", ")}`,
          );
      }
      if (inspection.cost) {
        const { characters, credits, usd } = inspection.cost;
        out.line(
          inspection.voice.provider === "elevenlabs"
            ? `\nEstimated narration cost: ${characters} characters, ${credits} ElevenLabs credits` +
                (usd === null ? "" : `, about $${usd.toFixed(2)}`)
            : `\nNarration cost: none. "${inspection.voice.provider}" is an offline stand-in voice (${characters} characters to generate).`,
        );
        out.line(
          `  Voice: ${inspection.voice.provider} (${inspection.voice.voiceId ?? "default"}, ${inspection.voice.modelId ?? "default"})`,
        );
      }
      out.line(
        `\nStages to run: ${inspection.requiredStages.join(" → ") || "none, everything is up to date"}`,
      );
      if (inspection.nextCommand) out.line(`Next: ${inspection.nextCommand}`);
      for (const note of inspection.notes) out.line(`Note: ${note}`);
      out.result({ ...inspection, facts: facts.length });
    });

  program
    .command("script")
    .description("validate and lint script.md, and estimate its duration")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const report = await checkScript(container.core, options.video);
      for (const estimate of report.estimates) {
        out.line(
          `Cut ${estimate.cutId}: ${estimate.words} words, about ${seconds(estimate.seconds)}`,
        );
      }
      out.line(`Research: ${plural(report.facts, "verified fact")}`);
      for (const issue of report.issues) {
        out.line(
          `${issue.severity === "error" ? "ERROR  " : "warning"}  ${issue.sceneId ? `[${issue.sceneId}] ` : ""}${issue.message}`,
        );
      }
      out.result(report);
      if (!report.accepted) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `The script has ${plural(report.issues.filter((i) => i.severity === "error").length, "error")}.`,
          {
            hint: "Fix the errors in script.md and run this command again.",
          },
        );
      }
      out.line(`\nScript v${report.version} accepted${report.approved ? " and approved" : ""}.`);
      if (!report.approved)
        out.line(
          `Next: pnpm studio storyboard --video ${options.video}, then have the script approved.`,
        );
    });

  program
    .command("storyboard")
    .description("sync the storyboard with the script and write a preview page")
    .addOption(videoOption())
    .option("--disable <scene...>", "exclude these scenes from renders")
    .option("--enable <scene...>", "include these scenes again")
    .action(async (options: { video: string; disable?: string[]; enable?: string[] }) => {
      const { container, out } = context();
      const edits = [
        ...(options.disable ?? []).map((sceneId) => ({ sceneId, enabled: false })),
        ...(options.enable ?? []).map((sceneId) => ({ sceneId, enabled: true })),
      ];
      const result = await updateStoryboard(
        container.core,
        options.video,
        edits,
        renderStoryboardPreview,
      );
      for (const cut of result.storyboard.cuts) {
        const active = cut.scenes.filter((scene) => scene.enabled);
        const estimate = active.reduce((sum, scene) => sum + scene.estimatedDurationSeconds, 0);
        out.line(
          `Cut ${cut.id} (${FORMATS[cut.format].label}): ${plural(active.length, "scene")}, about ${seconds(estimate)}`,
        );
      }
      out.line(`\nStoryboard v${result.storyboard.version} saved.`);
      out.line(`Preview: ${result.previewFile}`);
      out.line("Edit visuals in storyboard.json, then run this command again to validate them.");
      out.result({
        version: result.storyboard.version,
        hash: result.hash,
        preview: result.previewFile,
      });
    });

  program
    .command("approve")
    .description("record a named person's approval of the script or of final renders")
    .addOption(videoOption())
    .addOption(
      new Option("--stage <stage>", "what is being approved")
        .choices(["script", "final"])
        .makeOptionMandatory(),
    )
    .addOption(cutOption())
    .option("--by <name>", "approver (default: git user.name)")
    .option("--note <text>", "note stored with the approval", "")
    .option("--acknowledge-warnings", "confirm the QA warnings were read and accepted")
    .option(
      "--automated",
      "script only: record an approval made by a tool to test the pipeline, not a review; unlocks stand-in voices only",
    )
    .action(
      async (options: {
        video: string;
        stage: "script" | "final";
        cut?: string[];
        by?: string;
        note: string;
        acknowledgeWarnings?: boolean;
        automated?: boolean;
      }) => {
        const { container, out } = context();
        if (options.automated && options.stage !== "script") {
          throw new StudioError(
            "VALIDATION_FAILED",
            "Only a script can be approved by automation.",
            {
              hint: "Releasing a video always needs a person: run this without --automated after reviewing the QA report.",
            },
          );
        }
        const approvedBy = options.automated
          ? (options.by ?? "automation")
          : (options.by ?? (await container.identity()));
        if (options.stage === "script") {
          const approval = await approveScript(container.core, {
            videoId: options.video,
            approvedBy,
            note: options.note,
            automated: options.automated ?? false,
          });
          if (approval.automated) {
            out.line(
              `Script marked as approved by automation (${approval.approvedBy}). This is not a review.`,
            );
            out.line(
              "It unlocks stand-in voices only. Paid narration, export and publishing still need a person.",
            );
          } else {
            out.line(
              `Script approved by ${approval.approvedBy}. Any edit to script.md voids this approval.`,
            );
          }
          out.line(`Next: pnpm studio narrate --video ${options.video}`);
          out.result(approval);
          return;
        }
        const inspection = await inspectVideo(container.inspect, options.video, "final");
        const cutIds = options.cut ?? inspection.cuts.map((cut) => cut.cutId);
        const manifest = await approveFinal(container.core, {
          videoId: options.video,
          approvedBy,
          note: options.note,
          cutIds,
          acknowledgeWarnings: options.acknowledgeWarnings ?? false,
        });
        out.line(`Approved for release by ${approvedBy}: ${cutIds.join(", ")}.`);
        out.line(`Next: pnpm studio export --video ${options.video}`);
        out.result({ approvals: manifest.approvals.final });
      },
    );

  program
    .command("status")
    .description("show where a video is in the pipeline")
    .option("--video <id>", "video id (omit to list all videos)")
    .action(async (options: { video?: string }) => {
      const { container, out } = context();
      if (!options.video) {
        const ids = await container.core.manifests.list();
        const rows = [];
        for (const id of ids) {
          const manifest = await container.core.manifests.load(id);
          const done = Object.values(manifest.stages).filter(
            (stage) => stage.status === "completed",
          ).length;
          rows.push([
            id,
            manifest.title,
            `${done}/${Object.keys(manifest.stages).length}`,
            manifest.updatedAt.slice(0, 10),
          ]);
        }
        out.table(["Video", "Title", "Stages", "Updated"], rows);
        if (ids.length === 0)
          out.line('No videos yet. Start one with `pnpm studio create --topic "..."`.');
        out.result(ids);
        return;
      }
      const inspection = await inspectVideo(container.inspect, options.video, "final");
      out.line(`${inspection.title}  (${inspection.videoId})\n`);
      out.table(
        ["Stage", "Status", "Runs", "Detail"],
        inspection.stages.map((stage) => [
          stage.title,
          stage.status,
          String(stage.attempts),
          stage.error ?? "",
        ]),
      );
      if (inspection.cuts.length) {
        out.line("");
        out.table(
          ["Cut", "Final render", "QA", "Approved"],
          inspection.cuts.map((cut) => [cut.cutId, cut.final, cut.qa, cut.approved ? "yes" : "no"]),
        );
      }
      out.line(`\nScript: v${inspection.script.version}, ${approvalLabel(inspection.script)}`);
      if (inspection.nextCommand) out.line(`Next: ${inspection.nextCommand}`);
      for (const note of inspection.notes) out.line(`Note: ${note}`);
      out.result(inspection);
    });

  program
    .command("costs")
    .description("show narration cost: what the next run will spend and what has been spent")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const report = await reportCosts(container.inspect, options.video);
      const { plan, ledger, account } = report;
      const toBuy = plan.items.filter((item) => item.state === "missing");
      out.line(`Voice: ${plan.provider} (${plan.voiceId}, ${plan.modelId})`);
      out.line(`\nNext narration run`);
      out.line(
        `  To synthesise: ${plural(toBuy.length, "clip")}, ${plan.cost.characters} characters, ${plan.cost.credits} credits` +
          (plan.cost.usd === null ? "" : `, about $${plan.cost.usd.toFixed(2)}`),
      );
      out.line(
        `  Free from cache: ${plan.items.filter((item) => item.state === "cached").length}    Already current: ${plan.items.filter((item) => item.state === "current").length}`,
      );
      out.line(`\nThis video so far`);
      out.line(
        `  ${ledger.synthesisedCharacters} characters billed across ${plural(ledger.synthesisRequests, "request")}; ${plural(ledger.cacheHits, "cache hit")}`,
      );
      if (account)
        out.line(
          `\nAccount (${account.tier}): ${account.charactersUsed} of ${account.characterLimit} characters used this period`,
        );
      out.line(`\n${report.voiceConfigurationNote}`);
      out.result(report);
    });

  const pronunciation = program
    .command("pronunciation")
    .description("review how product terms are spoken");
  pronunciation
    .command("list")
    .description("show every term and whether its pronunciation is approved")
    .action(async () => {
      const { container, out } = context();
      const entries = await loadPronunciations(container.core);
      out.table(
        ["Term", "Status", "Alias", "IPA", "Approved by"],
        entries.map((e) => [e.term, e.status, e.alias ?? "", e.ipa ?? "", e.approvedBy ?? ""]),
      );
      out.line("\nPreview a term: pnpm studio preview-voice --video <id> --term <term>");
      out.result(entries);
    });
  pronunciation
    .command("set")
    .description("set a respelling or IPA for a term (returns it to pending)")
    .requiredOption("--term <term>", "the term as written in scripts")
    .option("--alias <text>", "respelling the voice reads instead")
    .option("--ipa <phonemes>", "IPA phoneme string, for models that support phoneme rules")
    .option("--clear", "remove the alias and IPA so the default reading is used")
    .option("--notes <text>", "why this reading was chosen")
    .action(
      async (options: {
        term: string;
        alias?: string;
        ipa?: string;
        clear?: boolean;
        notes?: string;
      }) => {
        const { container, out } = context();
        const entry = await setPronunciation(container.core, {
          term: options.term,
          ...(options.clear ? { alias: null, ipa: null } : {}),
          ...(options.alias === undefined ? {} : { alias: options.alias }),
          ...(options.ipa === undefined ? {} : { ipa: options.ipa }),
          ...(options.notes === undefined ? {} : { notes: options.notes }),
        });
        out.line(`"${entry.term}" updated and set to pending. Preview it, then approve it.`);
        out.result(entry);
      },
    );
  pronunciation
    .command("approve")
    .description("record that you listened to a term and it is said correctly")
    .requiredOption("--term <term>", "the term to approve")
    .option("--by <name>", "approver (default: git user.name)")
    .action(async (options: { term: string; by?: string }) => {
      const { container, out } = context();
      const entry = await approvePronunciation(
        container.core,
        options.term,
        options.by ?? (await container.identity()),
      );
      out.line(`"${entry.term}" approved by ${entry.approvedBy ?? ""}.`);
      out.result(entry);
    });
}
