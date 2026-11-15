import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CoreDeps } from "../application/context";
import type { ExportDeps } from "../application/export";
import type { InspectDeps } from "../application/inspect";
import { Workspace } from "../application/layout";
import type { NarrationDeps } from "../application/narration";
import type { AuditionDeps } from "../application/voice-audition";
import type { Clock, Logger, SpeechSynthesizer } from "../application/ports";
import type { QaDeps } from "../application/qa";
import type { RecordingDeps } from "../application/recording";
import type { RenderDeps } from "../application/render";
import { StudioError } from "../domain/errors";
import { createRedactor } from "../domain/redaction";
import type { VoiceProvider } from "../domain/voice";
import { createConfig, loadDotEnv, type Config } from "../infrastructure/config/env";
import { createDemoTargets } from "../infrastructure/demo/targets";
import { FileManifestRepository } from "../infrastructure/fs/manifest-repository";
import { createNodeFileSystem } from "../infrastructure/fs/node-file-system";
import { startAssetServer } from "../infrastructure/http/asset-server";
import { contentTypeFor } from "../infrastructure/http/static-server";
import { createLogger } from "../infrastructure/logging/logger";
import { createAudioTools, createFfmpegTools } from "../infrastructure/media/ffmpeg";
import { createYouTubePublisher, type YouTubeOptions } from "../infrastructure/publish/youtube";
import { createPlaywrightRecorder } from "../infrastructure/recording/playwright-recorder";
import {
  createRemotionRenderer,
  SEGMENT_EXTENSION,
} from "../infrastructure/render/remotion-renderer";
import { createR2ObjectStore } from "../infrastructure/storage/r2-object-store";
import { createElevenLabsSynthesizer } from "../infrastructure/voice/elevenlabs";
import { createSilentSynthesizer, createSystemSynthesizer } from "../infrastructure/voice/offline";
import { SCENARIOS, findScenario } from "../scenarios";

/**
 * The composition root: the one place that knows which adapter implements which port.
 * Adapters for optional integrations are built on first use, so their credentials are
 * validated only when a command actually needs them.
 */
export interface Container {
  projectRoot: string;
  config: Config;
  logger: Logger;
  redact: (text: string) => string;
  core: CoreDeps;
  narration: NarrationDeps;
  /** Narration plus per-clip audio measurement: auditions and clip reports. */
  voice: AuditionDeps;
  recording: RecordingDeps;
  render: RenderDeps;
  qa: QaDeps;
  exporting: ExportDeps;
  inspect: InspectDeps;
  youTubeOptions(): YouTubeOptions;
  /** Where the person's signed-in demo session and its browser profile are kept. */
  demoSession: { sessionFile: string; profileDir: string };
  /** Name recorded against approvals: `git config user.name`, else the OS user. */
  identity(): Promise<string>;
}

const systemClock: Clock = { now: () => new Date() };

export function createContainer(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Container {
  loadDotEnv(projectRoot);
  const config = createConfig(env);
  const general = config.general();
  const redact = createRedactor(config.secretValues());
  const logger = createLogger({ level: general.logLevel, format: general.logFormat, redact });

  const layout = new Workspace(projectRoot, general.outputDirectory);
  const files = createNodeFileSystem();
  const clock = systemClock;
  const core: CoreDeps = {
    layout,
    files,
    clock,
    logger,
    manifests: new FileManifestRepository(layout, clock),
  };
  const media = createFfmpegTools();
  const fps = general.defaultFps === 30 ? null : general.defaultFps;

  const synthesizers = new Map<VoiceProvider, SpeechSynthesizer>();
  const synthesizer = (provider: VoiceProvider): SpeechSynthesizer => {
    let instance = synthesizers.get(provider);
    if (!instance) {
      if (provider === "elevenlabs") {
        const eleven = config.elevenLabs();
        instance = createElevenLabsSynthesizer({
          apiKey: eleven.apiKey,
          defaultVoiceId: eleven.voiceId,
          defaultModelId: eleven.modelId,
          ...(eleven.outputFormat === undefined ? {} : { outputFormat: eleven.outputFormat }),
          dictionaryCacheFile: path.join(layout.cacheDir, "elevenlabs-dictionaries.json"),
          logger,
        });
      } else {
        instance =
          provider === "system" ? createSystemSynthesizer(media) : createSilentSynthesizer(media);
      }
      synthesizers.set(provider, instance);
    }
    return instance;
  };

  const audio = createAudioTools();
  const narration: NarrationDeps = {
    ...core,
    media,
    audio,
    synthesizer,
    usdPerThousandCredits: () =>
      config.configured().elevenLabs ? config.elevenLabs().usdPerThousandCredits : null,
  };
  const renderer = createRemotionRenderer({
    projectRoot,
    concurrency: general.renderConcurrency,
    licenseKey: (env.REMOTION_LICENSE_KEY ?? "").trim() || null,
    logger,
  });
  const stateDir = path.join(os.homedir(), ".config", "iker-video-studio");
  const demoSession = {
    sessionFile: path.join(stateDir, "demo-session.json"),
    profileDir: path.join(stateDir, "demo-browser-profile"),
  };
  const targets = createDemoTargets(config, {
    fixtureDir: layout.fixtureDir,
    sessionFile: demoSession.sessionFile,
  });
  const scenarios = { all: () => SCENARIOS, find: findScenario };
  const youTubeOptions = (): YouTubeOptions => {
    const youTube = config.youTube();
    return {
      clientId: youTube.clientId,
      clientSecret: youTube.clientSecret,
      tokenFile: path.join(stateDir, "youtube-token.json"),
    };
  };

  return {
    projectRoot,
    config,
    logger,
    redact,
    core,
    narration,
    voice: { ...narration, audio },
    recording: {
      ...core,
      media,
      recorder: createPlaywrightRecorder({ logger, redact }),
      scenarios,
      targets,
    },
    render: {
      ...core,
      media,
      renderer,
      startAssetServer,
      settings: {
        fps,
        resolutionScale: general.resolutionScale,
        segmentExtension: SEGMENT_EXTENSION,
      },
    },
    qa: {
      ...core,
      media,
      secretValues: () => config.secretValues(),
      resolutionScale: general.resolutionScale,
      fps,
    },
    exporting: {
      ...core,
      contentType: contentTypeFor,
      objectStore: () => {
        const r2 = config.r2();
        return createR2ObjectStore({
          accountId: r2.accountId,
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
          bucket: r2.bucket,
        });
      },
      publisher: () => {
        if (!config.youTube().publishingEnabled) {
          throw new StudioError("PUBLISHING_DISABLED", "Publishing is switched off.", {
            hint: "Set YOUTUBE_PUBLISHING_ENABLED=true to allow uploads, or publish by hand from the export package.",
          });
        }
        return createYouTubePublisher(youTubeOptions());
      },
    },
    inspect: {
      ...narration,
      scenarios,
      targets,
      renderer,
      fps,
      resolutionScale: general.resolutionScale,
    },
    youTubeOptions,
    demoSession,
    async identity() {
      try {
        const { stdout } = await promisify(execFile)("git", ["config", "user.name"], {
          cwd: projectRoot,
        });
        if (stdout.trim()) return stdout.trim();
      } catch {
        // Git may be absent or unconfigured; the OS account name is the fallback.
      }
      return os.userInfo().username;
    },
  };
}
