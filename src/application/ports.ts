import type { CharacterAlignment } from "../domain/captions";
import type { RenderDimensions } from "../domain/formats";
import type { Manifest } from "../domain/manifest";
import type { RecordingTimeline, Scenario } from "../domain/recording";
import type {
  CutRenderProps,
  SceneRenderProps,
  ThumbnailRenderProps,
} from "../domain/render-props";
import type { PronunciationEntry, VoiceProvider, VoiceSettings } from "../domain/voice";
import type { ClipMeasurement } from "../domain/voice-audio";

/**
 * Everything the application layer needs from the outside world. Use cases depend on these
 * interfaces only; adapters in src/infrastructure implement them and are wired together in
 * the composition root (src/cli/container.ts).
 */

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface Clock {
  now(): Date;
}

export interface FileEntry {
  file: string;
  sizeBytes: number;
  modifiedAt: Date;
}

/** File access for use cases. Writes are atomic; reads of a missing text file give null. */
export interface FileSystem {
  readText(file: string): Promise<string | null>;
  writeText(file: string, text: string): Promise<void>;
  readJson(file: string): Promise<unknown>;
  writeJson(file: string, value: unknown): Promise<void>;
  exists(file: string): Promise<boolean>;
  sha256(file: string): Promise<string>;
  /** Every file under a directory, in a stable order. Empty when the directory is missing. */
  list(dir: string): Promise<FileEntry[]>;
  copy(from: string, to: string): Promise<void>;
  remove(target: string): Promise<void>;
  ensureDir(dir: string): Promise<void>;
}

export interface ManifestRepository {
  exists(videoId: string): Promise<boolean>;
  load(videoId: string): Promise<Manifest>;
  /** Writes atomically: readers see the old file or the new one, never a partial write. */
  save(manifest: Manifest): Promise<void>;
  list(): Promise<string[]>;
}

export interface MediaInfo {
  durationSeconds: number;
  sizeBytes: number;
  formatName: string;
  video: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    pixelFormat: string;
  } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
}

export interface Interval {
  startSeconds: number;
  endSeconds: number;
}

export interface LoudnessMeasurement {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
}

export interface ConcatRequest {
  /** Scene segments in order; all share codec, size and frame rate. */
  segments: readonly string[];
  output: string;
  audioBitrateKbps: number;
  loudness: { integratedLufs: number; truePeakDbtp: number; loudnessRange: number };
  music: { file: string; volume: number } | null;
  /** Length of the joined programme, so the music can be faded out at its end. */
  durationSeconds: number;
}

export interface FrameRequest {
  file: string;
  atSeconds: number;
  output: string;
  width: number;
  outline?: { x: number; y: number; width: number; height: number };
}

export interface MediaTools {
  probe(file: string): Promise<MediaInfo>;
  /** Re-encodes a browser capture to constant-frame-rate H.264 that seeks reliably. */
  transcodeRecording(input: string, output: string, fps: number): Promise<void>;
  convertAudio(input: string, output: string): Promise<void>;
  generateSilence(output: string, seconds: number): Promise<void>;
  /** Joins segments without re-encoding video, and normalises audio loudness in one pass. */
  concat(request: ConcatRequest): Promise<void>;
  detectBlackFrames(file: string): Promise<Interval[]>;
  detectSilence(file: string, minSeconds: number): Promise<Interval[]>;
  measureLoudness(file: string): Promise<LoudnessMeasurement>;
  /** Saves one frame as an image, optionally outlining a rectangle given in source pixels. */
  extractFrame(request: FrameRequest): Promise<void>;
  contactSheet(frames: readonly string[], output: string, columns: number): Promise<void>;
}

export interface FinishClipRequest {
  input: string;
  output: string;
  /** One fixed gain for the whole clip. Never a dynamic process. */
  gainDb: number;
  compression: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  durationSeconds: number;
}

/** Measuring and finishing single narration clips. Separate from MediaTools, which mixes. */
export interface AudioTools {
  /** Loudness, peaks, edge levels and silent stretches of one clip. Reads only. */
  measureClip(file: string): Promise<ClipMeasurement>;
  /** Writes a levelled copy. The source clip is never modified. */
  finishClip(request: FinishClipRequest): Promise<void>;
  /** Copies a stretch of a clip to a new file, for A/B samples. */
  cutAudio(input: string, output: string, startSeconds: number, endSeconds: number): Promise<void>;
}

export interface SynthesisRequest {
  /**
   * The exact text to send. For plain narration this is the script text; for performed
   * narration it includes delivery markup, and the caller removes that markup from the
   * returned alignment.
   */
  text: string;
  /** Neighbouring narration, sent as context only where the model supports it. */
  previousText?: string;
  nextText?: string;
  voice: VoiceSettings;
  voiceId: string;
  modelId: string;
  rules: readonly PronunciationEntry[];
  /** Absolute path without extension; the synthesizer appends the right one. */
  outputBase: string;
}

export interface SynthesisResult {
  file: string;
  /** null when the provider returns no timing; callers then estimate it from duration. */
  alignment: CharacterAlignment | null;
  /** Characters billed by the provider for this request; 0 for offline providers. */
  billedCharacters: number;
  /** Credits the provider reported for the request; absent when it reports none. */
  billedCredits?: number;
  /** Provider's id for the request, kept for support queries. */
  requestId?: string | null;
}

export interface SpeechUsage {
  charactersUsed: number;
  characterLimit: number;
  tier: string;
}

export interface SpeechSynthesizer {
  readonly provider: VoiceProvider;
  /** Applies provider and environment defaults. Throws when no voice can be resolved. */
  resolveVoice(voice: VoiceSettings): { voiceId: string; modelId: string };
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
  /** Account usage where the provider reports it; null otherwise. */
  usage(): Promise<SpeechUsage | null>;
}

/**
 * A signed-in browser session that a person created by signing in themselves, for accounts
 * that cannot be automated (single sign-on). The recorder reuses it and never signs in.
 */
export interface DemoSession {
  /** Browser storage state saved after the person signed in. Kept outside the repository. */
  storageStateFile: string;
}

/**
 * What the dashboard must show before, during and after a take. A recording that finds
 * itself anywhere else stops, so live customer data can never be filmed by accident.
 */
export interface DemoContextExpectation {
  environment: "sandbox";
  /** Workspace name that must be selected; null accepts any workspace. */
  workspace: string | null;
}

/** Where a scenario runs: the bundled synthetic fixture, or the Iker demo environment. */
export interface DemoTarget {
  baseUrl: string;
  credentials: { username: string; password: string } | null;
  session: DemoSession | null;
  /** null for the synthetic fixture, which has no environments or workspaces. */
  expect: DemoContextExpectation | null;
  /** Host shown in the browser frame. Never includes a path, query or credentials. */
  displayHost: string;
  /** Changes whenever a re-record is needed for reasons outside the scenario definition. */
  fingerprint: string;
  close(): Promise<void>;
}

export interface DemoTargets {
  /** Validates and opens a target. Refuses anything that looks like production. */
  open(target: "synthetic" | "iker"): Promise<DemoTarget>;
}

export interface ScenarioCatalog {
  all(): readonly Scenario[];
  find(id: string): Scenario | undefined;
}

export interface RecordRequest {
  scenario: Scenario;
  /** Origin the scenario's paths are resolved against, e.g. https://staging.example.test */
  baseUrl: string;
  /** Demo account for `authenticate` steps; null when the scenario never signs in. */
  credentials: { username: string; password: string } | null;
  /** A session a person signed in to; used instead of credentials when present. */
  session: DemoSession | null;
  expect: DemoContextExpectation | null;
  /** Absolute directory for the capture, screenshots and any failure diagnostics. */
  outputDir: string;
  headless: boolean;
}

export interface RecordResult {
  /** Raw browser capture; the caller transcodes it. */
  videoFile: string;
  /** Absolute paths keyed by screenshot step name. */
  screenshots: Record<string, string>;
  timeline: RecordingTimeline;
}

export interface Recorder {
  record(request: RecordRequest): Promise<RecordResult>;
}

export interface SceneRenderRequest {
  props: SceneRenderProps;
  dimensions: RenderDimensions;
  scale: number;
  crf: number;
  jpegQuality: number;
  output: string;
}

export interface SceneStillRequest {
  props: SceneRenderProps;
  frame: number;
  /** Output scale relative to the format's full size; review frames are rendered small. */
  scale: number;
  output: string;
}

export interface VideoRenderer {
  /** Prepares the project for rendering. Must be called once before any render. */
  open(): Promise<void>;
  renderScene(request: SceneRenderRequest): Promise<void>;
  renderThumbnail(props: ThumbnailRenderProps, output: string): Promise<void>;
  /** Renders one frame of a scene as an image, for reviewing a scene before it is rendered. */
  renderSceneStill(request: SceneStillRequest): Promise<void>;
  /** Hash of the Remotion sources and renderer version: changes whenever visuals could. */
  sourceHash(): Promise<string>;
  close(): Promise<void>;
}

/** Serves local files to the renderer over HTTP, which is how Remotion loads media. */
export interface AssetServer {
  /** Maps an absolute file path to a URL the renderer can fetch. */
  urlFor(absolutePath: string): string;
  close(): Promise<void>;
}

export interface StoredObject {
  key: string;
  sizeBytes: number;
  sha256: string | null;
  lastModified: Date | null;
}

export interface ObjectStore {
  upload(file: string, key: string, contentType: string): Promise<StoredObject>;
  download(key: string, file: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
  remove(key: string): Promise<void>;
  /** Time-limited link to a private object. */
  signedUrl(key: string, expiresSeconds: number): Promise<string>;
}

export interface PublishRequest {
  file: string;
  title: string;
  description: string;
  tags: readonly string[];
  privacy: "private" | "unlisted" | "public";
  thumbnail: string | null;
}

export interface VideoPublisher {
  publish(
    request: PublishRequest,
  ): Promise<{ videoId: string; url: string; thumbnailSet: boolean }>;
  /** Replaces the thumbnail of a video that is already on the channel. */
  setThumbnail(videoId: string, file: string): Promise<void>;
}

export type { CutRenderProps };
