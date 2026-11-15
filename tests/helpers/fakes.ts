import path from "node:path";
import type { CoreDeps } from "../../src/application/context";
import { Workspace } from "../../src/application/layout";
import type {
  Clock,
  FileEntry,
  FileSystem,
  Logger,
  ManifestRepository,
  MediaInfo,
  MediaTools,
  SpeechSynthesizer,
  SynthesisRequest,
} from "../../src/application/ports";
import { StudioError } from "../../src/domain/errors";
import { sha256 } from "../../src/domain/hash";
import { parseManifest, type Manifest } from "../../src/domain/manifest";
import type { VoiceProvider } from "../../src/domain/voice";

export const PROJECT_ROOT = "/project";

export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

/** A clock that advances one second per reading, so timestamps are ordered and repeatable. */
export function steppingClock(start = "2026-01-01T00:00:00.000Z"): Clock {
  let current = new Date(start).getTime();
  return {
    now() {
      const value = new Date(current);
      current += 1000;
      return value;
    },
  };
}

export class MemoryFileSystem implements FileSystem {
  readonly entries = new Map<string, string>();

  seed(file: string, text: string): void {
    this.entries.set(path.resolve(file), text);
  }
  readText(file: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(path.resolve(file)) ?? null);
  }
  writeText(file: string, text: string): Promise<void> {
    this.entries.set(path.resolve(file), text);
    return Promise.resolve();
  }
  readJson(file: string): Promise<unknown> {
    const text = this.entries.get(path.resolve(file));
    if (text === undefined)
      return Promise.reject(new StudioError("NOT_FOUND", `${file} does not exist`));
    return Promise.resolve(JSON.parse(text) as unknown);
  }
  writeJson(file: string, value: unknown): Promise<void> {
    return this.writeText(file, JSON.stringify(value, null, 2));
  }
  exists(file: string): Promise<boolean> {
    return Promise.resolve(this.entries.has(path.resolve(file)));
  }
  sha256(file: string): Promise<string> {
    return Promise.resolve(sha256(this.entries.get(path.resolve(file)) ?? ""));
  }
  list(dir: string): Promise<FileEntry[]> {
    const prefix = `${path.resolve(dir)}${path.sep}`;
    return Promise.resolve(
      [...this.entries.keys()]
        .filter((file) => file.startsWith(prefix))
        .sort()
        .map((file) => ({
          file,
          sizeBytes: (this.entries.get(file) ?? "").length,
          modifiedAt: new Date(0),
        })),
    );
  }
  copy(from: string, to: string): Promise<void> {
    const source = path.resolve(from);
    const text = this.entries.get(source);
    if (text !== undefined) {
      this.entries.set(path.resolve(to), text);
      return Promise.resolve();
    }
    for (const [file, content] of [...this.entries]) {
      if (file.startsWith(`${source}${path.sep}`))
        this.entries.set(path.join(path.resolve(to), file.slice(source.length)), content);
    }
    return Promise.resolve();
  }
  remove(target: string): Promise<void> {
    const resolved = path.resolve(target);
    for (const file of [...this.entries.keys()]) {
      if (file === resolved || file.startsWith(`${resolved}${path.sep}`)) this.entries.delete(file);
    }
    return Promise.resolve();
  }
  ensureDir(): Promise<void> {
    return Promise.resolve();
  }
}

export class MemoryManifestRepository implements ManifestRepository {
  readonly saved: Manifest[] = [];
  private readonly manifests = new Map<string, Manifest>();
  /** When set, the next save throws: simulates a crash while persisting. */
  failNextSave = false;

  exists(videoId: string): Promise<boolean> {
    return Promise.resolve(this.manifests.has(videoId));
  }
  load(videoId: string): Promise<Manifest> {
    const manifest = this.manifests.get(videoId);
    return manifest
      ? Promise.resolve(structuredClone(manifest))
      : Promise.reject(new StudioError("NOT_FOUND", `no video ${videoId}`));
  }
  save(manifest: Manifest): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return Promise.reject(new Error("disk full"));
    }
    const valid = parseManifest(structuredClone(manifest), "test manifest");
    this.manifests.set(valid.id, valid);
    this.saved.push(valid);
    return Promise.resolve();
  }
  list(): Promise<string[]> {
    return Promise.resolve([...this.manifests.keys()].sort());
  }
}

export interface TestCore extends CoreDeps {
  files: MemoryFileSystem;
  manifests: MemoryManifestRepository;
}

export function createTestCore(): TestCore {
  return {
    layout: new Workspace(PROJECT_ROOT, "output"),
    files: new MemoryFileSystem(),
    manifests: new MemoryManifestRepository(),
    clock: steppingClock(),
    logger: silentLogger,
  };
}

/** Media tools that report fixed durations without touching FFmpeg. */
export function fakeMedia(durationSeconds = 4): MediaTools {
  const info: MediaInfo = {
    durationSeconds,
    sizeBytes: 1000,
    formatName: "mov,mp4,m4a,3gp,3g2,mj2",
    video: { codec: "h264", width: 1920, height: 1080, fps: 30, pixelFormat: "yuv420p" },
    audio: { codec: "aac", sampleRate: 48000, channels: 2 },
  };
  const nothing = (): Promise<void> => Promise.resolve();
  return {
    probe: () => Promise.resolve(info),
    transcodeRecording: nothing,
    convertAudio: nothing,
    generateSilence: nothing,
    concat: nothing,
    detectBlackFrames: () => Promise.resolve([]),
    detectSilence: () => Promise.resolve([]),
    measureLoudness: () =>
      Promise.resolve({ integratedLufs: -14, truePeakDbtp: -1.5, loudnessRange: 5 }),
    extractFrame: nothing,
    contactSheet: nothing,
  };
}

/** A synthesizer that writes a marker file and records every request it was asked to speak. */
export function countingSynthesizer(
  files: MemoryFileSystem,
  provider: VoiceProvider = "elevenlabs",
) {
  const requests: SynthesisRequest[] = [];
  const synthesizer: SpeechSynthesizer = {
    provider,
    resolveVoice: (voice) => ({
      voiceId: voice.voiceId ?? "voice-default",
      modelId: voice.modelId ?? "eleven_multilingual_v2",
    }),
    synthesize(request) {
      requests.push(request);
      const file = `${request.outputBase}.mp3`;
      files.seed(file, `audio:${request.text}`);
      return Promise.resolve({
        file,
        alignment: null,
        billedCharacters: provider === "elevenlabs" ? request.text.length : 0,
      });
    },
    usage: () => Promise.resolve(null),
  };
  return { synthesizer, requests };
}
