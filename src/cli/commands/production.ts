import { spawn } from "node:child_process";
import { Option, type Command } from "commander";
import {
  exportVideo,
  generateMetadata,
  publishToYouTube,
  setYouTubeThumbnail,
  pruneExports,
  pullAssets,
  pushAssets,
} from "../../application/export";
import {
  cleanCache,
  inspectCache,
  pronunciationPreviewText,
  type CacheScope,
} from "../../application/housekeeping";
import { narrate, previewVoice } from "../../application/narration";
import { runQa } from "../../application/qa";
import { record, reuseRecordings } from "../../application/recording";
import {
  prepareStudioSession,
  render,
  renderThumbnails,
  type CutOutcome,
} from "../../application/render";
import { loadScript } from "../../application/context";
import { StudioError } from "../../domain/errors";
import type { FormatId, QualityId } from "../../domain/formats";
import { VOICE_PROVIDERS, type VoiceProvider } from "../../domain/voice";
import { PRESET_IDS, type PresetId } from "../../domain/voice-presets";
import { authoriseYouTube } from "../../infrastructure/publish/youtube";
import type { Container } from "../container";
import { megabytes, seconds, type Output } from "../output";
import {
  cutOption,
  formatOption,
  parseInteger,
  plural,
  qualityOption,
  selectCutIds,
  videoOption,
} from "../shared";

type Context = () => { container: Container; out: Output };

function printCuts(out: Output, cuts: readonly CutOutcome[]): void {
  for (const cut of cuts) {
    out.line(`Cut ${cut.cutId}: ${cut.width}x${cut.height}, ${seconds(cut.durationSeconds)}`);
    out.line(
      `  Scenes rendered: ${cut.renderedScenes.length}   reused: ${cut.reusedScenes.length}${cut.finalReused ? "   (file unchanged)" : ""}`,
    );
    out.line(`  ${cut.file}`);
  }
}

export function registerProductionCommands(program: Command, context: Context): void {
  program
    .command("preview-voice")
    .description("generate a short voice sample to choose a voice or check a pronunciation")
    .addOption(videoOption())
    .option("--text <text>", "text to speak (default: the script's hook)")
    .option("--term <term>", "preview one pronunciation term in a carrier sentence")
    .option("--dry-run", "show the cost without generating audio")
    .action(async (options: { video: string; text?: string; term?: string; dryRun?: boolean }) => {
      const { container, out } = context();
      const text =
        options.term !== undefined
          ? pronunciationPreviewText(options.term)
          : (options.text ?? (await loadScript(container.core, options.video)).script.hook);
      const preview = await previewVoice(container.narration, {
        videoId: options.video,
        text,
        dryRun: options.dryRun ?? false,
        ...(options.term === undefined ? {} : { previewTerm: options.term }),
      });
      out.line(
        `${text.length} characters, ${preview.cached ? "served from cache (no charge)" : `${preview.cost.credits} credits`}`,
      );
      if (preview.file) out.line(`Listen: ${preview.file}`);
      if (options.term !== undefined && preview.file) {
        out.line(`If it is right: pnpm studio pronunciation approve --term "${options.term}"`);
        out.line(
          `If not:        pnpm studio pronunciation set --term "${options.term}" --alias "..."`,
        );
      }
      out.result(preview);
    });

  program
    .command("record")
    .description("record the product flows the storyboard needs")
    .addOption(videoOption())
    .option("--scenario <id...>", "record only these scenarios")
    .option("--retake", "record again even if an up-to-date capture exists")
    .option("--headed", "show the browser while recording")
    .option("--reuse-from <id>", "copy the captures another video already has instead of recording")
    .option(
      "--keep-captures",
      "accept the captures on file as current (for one-off takes whose scenario text changed)",
    )
    .action(
      async (options: {
        video: string;
        scenario?: string[];
        retake?: boolean;
        headed?: boolean;
        reuseFrom?: string;
        keepCaptures?: boolean;
      }) => {
        const { container, out } = context();
        if (options.reuseFrom !== undefined) {
          const reused = await reuseRecordings(container.recording, {
            videoId: options.video,
            fromVideoId: options.reuseFrom,
          });
          out.line(`Reused from ${options.reuseFrom}: ${reused.reused.join(", ") || "none"}`);
          if (reused.missing.length > 0)
            out.line(`Not found there, still to record: ${reused.missing.join(", ")}`);
          out.result(reused);
          return;
        }
        const outcome = await record(container.recording, {
          videoId: options.video,
          force: options.retake ?? false,
          headless: !options.headed,
          ...(options.keepCaptures === true ? { keepCaptures: true } : {}),
          ...(options.scenario === undefined ? {} : { scenarioIds: options.scenario }),
        });
        out.line(`Recorded: ${outcome.recorded.join(", ") || "none"}`);
        out.line(`Up to date: ${outcome.alreadyCurrent.join(", ") || "none"}`);
        for (const id of outcome.unverified) {
          out.line(
            `Review needed: "${id}" is an unverified scenario. Watch the capture before using it.`,
          );
        }
        out.result(outcome);
      },
    );

  program
    .command("narrate")
    .description("generate narration for scenes whose text or voice changed")
    .addOption(videoOption())
    .option("--scene <id...>", "narrate only these scenes")
    .option("--dry-run", "show what would be generated and what it would cost")
    .option("--force", "regenerate even when cached (spends credits again)")
    .addOption(
      new Option("--voice-provider <provider>", "switch this video to another voice").choices([
        ...VOICE_PROVIDERS,
      ]),
    )
    .option("--voice-id <id>", "switch this video to another voice of the provider")
    .addOption(
      new Option(
        "--preset <preset>",
        "with --dry-run: cost the narration in this performance before choosing it",
      ).choices([...PRESET_IDS]),
    )
    .action(
      async (options: {
        video: string;
        scene?: string[];
        dryRun?: boolean;
        force?: boolean;
        voiceProvider?: VoiceProvider;
        voiceId?: string;
        preset?: PresetId;
      }) => {
        const { container, out } = context();
        const result = await narrate(container.narration, {
          videoId: options.video,
          dryRun: options.dryRun ?? false,
          force: options.force ?? false,
          ...(options.scene === undefined ? {} : { sceneIds: options.scene }),
          ...(options.voiceProvider === undefined ? {} : { provider: options.voiceProvider }),
          ...(options.voiceId === undefined ? {} : { voiceId: options.voiceId }),
          ...(options.preset === undefined ? {} : { preset: options.preset }),
        });
        const { plan } = result;
        out.line(`Voice: ${plan.provider} (${plan.voiceId}, ${plan.modelId})`);
        out.line(
          plan.preset === null
            ? "Performance: plain (script wording, no preset)"
            : `Performance: ${plan.preset}${plan.directionHash === null ? ", script wording" : ", spoken wording and direction from voice-direction.json"}`,
        );
        if (plan.directionWaiting) {
          out.line(
            "voice-direction.json exists but is not in use: no performance has been selected. Add --preset <preset> to cost it; `pnpm studio voice select` puts it in force.",
          );
        }
        if (result.dryRun) {
          out.table(
            ["Scene", "State", "Characters"],
            plan.items.map((item) => [item.sceneId, item.state, String(item.characters)]),
          );
          out.line(
            `\nWould synthesise ${plan.cost.characters} characters: ${plan.cost.credits} credits` +
              (plan.cost.usd === null ? "" : `, about $${plan.cost.usd.toFixed(2)}`),
          );
          out.line("Nothing was generated.");
        } else {
          out.line(
            `Synthesised: ${result.generated.length}   from cache: ${result.restoredFromCache.length}   unchanged: ${result.alreadyCurrent.length}`,
          );
          if (plan.provider !== "elevenlabs")
            out.line(
              `Note: "${plan.provider}" is a stand-in voice for pipeline checks, not the production narration.`,
            );
        }
        for (const term of plan.pendingPronunciations)
          out.line(`Pronunciation of "${term}" has not been approved.`);
        out.result(result);
      },
    );

  program
    .command("preview")
    .description("render a fast half-resolution preview, or open Remotion Studio")
    .addOption(videoOption())
    .addOption(cutOption())
    .addOption(formatOption())
    .option("--scene <id...>", "render only these scenes")
    .option("--studio", "open the cut in Remotion Studio for frame-by-frame review")
    .action(
      async (options: {
        video: string;
        cut?: string[];
        format?: FormatId[];
        scene?: string[];
        studio?: boolean;
      }) => {
        const { container, out } = context();
        const cutIds = await selectCutIds(container.core, options.video, options);
        if (options.studio) {
          const session = await prepareStudioSession(container.render, options.video, cutIds?.[0]);
          out.line(
            `Opening Remotion Studio for cut "${session.cutId}". Choose the "Cut" composition. Ctrl+C to stop.`,
          );
          try {
            await new Promise<void>((resolve, reject) => {
              const child = spawn(
                "pnpm",
                [
                  "exec",
                  "remotion",
                  "studio",
                  "src/remotion/index.ts",
                  `--props=${session.propsFile}`,
                ],
                { cwd: container.projectRoot, stdio: "inherit" },
              );
              child.on("error", reject);
              child.on("close", () => resolve());
            });
          } finally {
            await session.assets.close();
          }
          return;
        }
        const cuts = await render(container.render, {
          videoId: options.video,
          quality: "preview",
          force: false,
          ...(cutIds === undefined ? {} : { cutIds }),
          ...(options.scene === undefined ? {} : { sceneIds: options.scene }),
        });
        printCuts(out, cuts);
        out.result(cuts);
      },
    );

  program
    .command("render")
    .description("render cuts, re-rendering only the scenes that changed")
    .addOption(videoOption())
    .addOption(cutOption())
    .addOption(formatOption())
    .option("--scene <id...>", "render only these scenes, then rebuild the cut")
    .addOption(qualityOption("final"))
    .option("--force", "re-render scenes even when unchanged")
    .option("--skip-thumbnails", "do not render thumbnail candidates")
    .action(
      async (options: {
        video: string;
        cut?: string[];
        format?: FormatId[];
        scene?: string[];
        quality: QualityId;
        force?: boolean;
        skipThumbnails?: boolean;
      }) => {
        const { container, out } = context();
        const cutIds = await selectCutIds(container.core, options.video, options);
        const cuts = await render(container.render, {
          videoId: options.video,
          quality: options.quality,
          force: options.force ?? false,
          ...(cutIds === undefined ? {} : { cutIds }),
          ...(options.scene === undefined ? {} : { sceneIds: options.scene }),
        });
        printCuts(out, cuts);
        const thumbnails = options.skipThumbnails
          ? []
          : await renderThumbnails(container.render, options.video, false);
        if (thumbnails.length) out.line(`Thumbnails: ${thumbnails.map((t) => t.file).join(", ")}`);
        out.line(
          `\nNext: pnpm studio qa --video ${options.video}${options.quality === "preview" ? " --quality preview" : ""}`,
        );
        out.result({ cuts, thumbnails });
      },
    );

  program
    .command("thumbnails")
    .description("render the three 1280x720 thumbnail candidates")
    .addOption(videoOption())
    .option("--force", "render again even when unchanged")
    .action(async (options: { video: string; force?: boolean }) => {
      const { container, out } = context();
      const thumbnails = await renderThumbnails(
        container.render,
        options.video,
        options.force ?? false,
      );
      for (const thumbnail of thumbnails)
        out.line(
          `${thumbnail.variant}: ${thumbnail.file}${thumbnail.reused ? " (unchanged)" : ""}`,
        );
      out.result(thumbnails);
    });

  program
    .command("qa")
    .description("run automated checks on rendered cuts and write a review report")
    .addOption(videoOption())
    .addOption(cutOption())
    .addOption(formatOption())
    .addOption(qualityOption("final"))
    .action(
      async (options: {
        video: string;
        cut?: string[];
        format?: FormatId[];
        quality: QualityId;
      }) => {
        const { container, out } = context();
        const cutIds = await selectCutIds(container.core, options.video, options);
        const outcomes = await runQa(container.qa, {
          videoId: options.video,
          quality: options.quality,
          ...(cutIds === undefined ? {} : { cutIds }),
        });
        for (const outcome of outcomes) {
          const { summary } = outcome;
          out.line(
            `Cut ${outcome.cutId}: ${summary.passed ? "passed" : "FAILED"}: ${plural(summary.failures, "failure")}, ${plural(summary.warnings, "warning")}, ${summary.manual} to check by eye`,
          );
          for (const check of outcome.checks.filter(
            (c) => c.status === "fail" || c.status === "warn",
          )) {
            out.line(`  ${check.status === "fail" ? "FAIL" : "warn"}  ${check.title}`);
            for (const detail of check.details) out.line(`        ${detail}`);
          }
          out.line(`  Report: ${outcome.report}`);
        }
        out.result(outcomes);
        if (outcomes.some((outcome) => !outcome.summary.passed)) {
          throw new StudioError("VALIDATION_FAILED", "QA found failures.", {
            hint: "Open the report, fix the causes and render again.",
          });
        }
        out.line(
          "\nAutomated checks cannot judge design or accuracy. Watch the video and use the checklist in the report.",
        );
      },
    );

  program
    .command("metadata")
    .description("generate titles, description, chapters and social captions from the script")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const { metadata, file, issues } = await generateMetadata(container.core, options.video);
      out.line(`Written: ${file}`);
      for (const issue of issues) out.line(`Problem: ${issue}`);
      out.result({ metadata, file, issues });
      if (issues.length)
        throw new StudioError("VALIDATION_FAILED", "The metadata exceeds a platform limit.");
    });

  program
    .command("export")
    .description("package approved cuts for publishing; optionally upload to private R2 storage")
    .addOption(videoOption())
    .addOption(cutOption())
    .option("--r2", "upload the package to the private Cloudflare R2 bucket")
    .option(
      "--signed-url <seconds>",
      "also create a time-limited download link (needs --r2)",
      parseInteger("--signed-url", 60),
    )
    .action(
      async (options: { video: string; cut?: string[]; r2?: boolean; signedUrl?: number }) => {
        const { container, out } = context();
        if (options.signedUrl !== undefined && !options.r2) {
          throw new StudioError("VALIDATION_FAILED", "--signed-url needs --r2.");
        }
        const outcomes = await exportVideo(container.exporting, {
          videoId: options.video,
          toR2: options.r2 ?? false,
          signedUrlSeconds: options.signedUrl ?? null,
          ...(options.cut === undefined ? {} : { cutIds: options.cut }),
        });
        for (const outcome of outcomes) {
          out.line(
            `Cut ${outcome.cutId}: ${plural(outcome.files.length, "file")} in ${outcome.packageDir}`,
          );
          if (outcome.r2Prefix) out.line(`  Uploaded to R2 under ${outcome.r2Prefix} (private)`);
          if (outcome.signedUrl)
            out.line(`  Signed link (expires in ${options.signedUrl ?? 0}s): ${outcome.signedUrl}`);
        }
        out.line(
          "\nTo publish by hand, upload the MP4, SRT and a thumbnail from the package and paste from metadata.md.",
        );
        out.result(outcomes);
      },
    );

  program
    .command("publish")
    .description("upload an approved cut to YouTube (off unless YOUTUBE_PUBLISHING_ENABLED=true)")
    .addOption(videoOption())
    .requiredOption("--cut <id>", "the cut to publish")
    .requiredOption("--confirm <id>", "repeat the video id to confirm you intend to publish")
    .option(
      "--title <n>",
      "which of the three title candidates to use",
      parseInteger("--title", 1),
      1,
    )
    .addOption(
      new Option("--privacy <privacy>", "YouTube visibility")
        .choices(["private", "unlisted", "public"])
        .default("private"),
    )
    .option("--thumbnail <variant>", "thumbnail variant to upload")
    .option("--title-text <text>", "use this title instead of one of the script's candidates")
    .action(
      async (options: {
        video: string;
        cut: string;
        confirm: string;
        title: number;
        titleText?: string;
        privacy: "private" | "unlisted" | "public";
        thumbnail?: string;
      }) => {
        const { container, out } = context();
        const published = await publishToYouTube(container.exporting, {
          videoId: options.video,
          cutId: options.cut,
          titleIndex: options.title - 1,
          ...(options.titleText === undefined ? {} : { titleText: options.titleText }),
          privacy: options.privacy,
          thumbnailVariant: options.thumbnail ?? null,
          confirm: options.confirm,
        });
        out.line(`Uploaded as ${options.privacy}: ${published.url}`);
        if (options.thumbnail && !published.thumbnailSet)
          out.line(
            "YouTube did not accept the thumbnail (custom thumbnails need a verified channel). Set it by hand.",
          );
        out.result(published);
      },
    );

  program
    .command("publish-thumbnail")
    .description("set a rendered thumbnail on a cut that is already on YouTube")
    .addOption(videoOption())
    .requiredOption("--cut <id>", "the uploaded cut")
    .requiredOption("--thumbnail <variant>", "thumbnail variant to upload")
    .action(async (options: { video: string; cut: string; thumbnail: string }) => {
      const { container, out } = context();
      const result = await setYouTubeThumbnail(container.exporting, {
        videoId: options.video,
        cutId: options.cut,
        variant: options.thumbnail,
      });
      out.line(`Thumbnail "${options.thumbnail}" set on ${result.url}`);
      out.result(result);
    });

  program
    .command("publish-auth")
    .description("authorise this machine to upload to YouTube (one-time, opens a consent page)")
    .action(async () => {
      const { container, out } = context();
      await authoriseYouTube(container.youTubeOptions(), (url) =>
        out.line(`Open this URL in a browser and approve access:\n\n${url}\n`),
      );
      out.line(
        "Authorised. The refresh token is stored outside the repository with owner-only permissions.",
      );
      out.result({ authorised: true });
    });

  const storage = program
    .command("storage")
    .description("sync generated assets with private R2 storage");
  storage
    .command("push")
    .description("upload a video's narration and recordings so another machine can render it")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const count = await pushAssets(container.exporting, options.video);
      out.line(`Uploaded ${plural(count, "file")}.`);
      out.result({ uploaded: count });
    });
  storage
    .command("pull")
    .description("download a video's narration and recordings")
    .addOption(videoOption())
    .action(async (options: { video: string }) => {
      const { container, out } = context();
      const count = await pullAssets(container.exporting, options.video);
      out.line(`Downloaded ${plural(count, "file")}.`);
      out.result({ downloaded: count });
    });
  storage
    .command("prune")
    .description("delete exported objects older than the retention period")
    .option(
      "--days <days>",
      "retention in days (default: R2_RETENTION_DAYS)",
      parseInteger("--days", 1),
    )
    .option("--yes", "actually delete; without it this only lists what would go")
    .action(async (options: { days?: number; yes?: boolean }) => {
      const { container, out } = context();
      const days = options.days ?? container.config.r2().retentionDays;
      if (days === null)
        throw new StudioError("VALIDATION_FAILED", "No retention period given.", {
          hint: "Pass --days or set R2_RETENTION_DAYS.",
        });
      const keys = await pruneExports(container.exporting, days, !options.yes);
      out.line(
        `${options.yes ? "Deleted" : "Would delete"} ${plural(keys.length, "object")} older than ${days} days.`,
      );
      for (const key of keys) out.line(`  ${key}`);
      out.result({ deleted: options.yes ?? false, keys });
    });

  const cache = program
    .command("cache")
    .description("inspect or clear cached narration and renders");
  cache
    .command("inspect")
    .description("show what is cached and what deleting each cache would cost")
    .action(async () => {
      const { container, out } = context();
      const summaries = await inspectCache(container.core);
      out.table(
        ["Cache", "Files", "Size", "Location"],
        summaries.map((s) => [s.name, String(s.files), megabytes(s.sizeBytes), s.directory]),
      );
      out.line("");
      for (const summary of summaries) out.line(`${summary.name}: ${summary.consequence}`);
      out.line("\nPer-video staleness and regeneration cost: pnpm studio plan --video <id>");
      out.result(summaries);
    });
  cache
    .command("clean")
    .description("delete caches (renders by default; narration only when asked)")
    .option("--renders", "delete rendered scene segments")
    .option("--bundle", "delete the renderer bundle cache")
    .option("--narration", "delete cached narration audio (regenerating costs credits)")
    .option("--yes", "confirm deletion")
    .action(
      async (options: {
        renders?: boolean;
        bundle?: boolean;
        narration?: boolean;
        yes?: boolean;
      }) => {
        const { container, out } = context();
        const picked: CacheScope[] = [];
        if (options.renders) picked.push("renders");
        if (options.bundle) picked.push("bundle");
        if (options.narration) picked.push("narration");
        const scopes: CacheScope[] = picked.length ? picked : ["renders"];
        if (!options.yes) {
          throw new StudioError("VALIDATION_FAILED", `This would delete: ${scopes.join(", ")}.`, {
            hint: "Add --yes to confirm. See `pnpm studio cache inspect` for what each costs to rebuild.",
          });
        }
        const removed = await cleanCache(container.core, scopes);
        out.line(`Deleted: ${removed.join(", ") || "nothing"}`);
        out.result({ removed });
      },
    );
}
