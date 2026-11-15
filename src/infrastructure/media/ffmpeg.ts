import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AudioTools,
  ConcatRequest,
  FinishClipRequest,
  Interval,
  LoudnessMeasurement,
  MediaInfo,
  MediaTools,
} from "../../application/ports";
import { StudioError } from "../../domain/errors";
import type { ClipMeasurement } from "../../domain/voice-audio";
import { run } from "./process";

const QUIET = ["-hide_banner", "-nostdin", "-y"];

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
}
interface ProbeOutput {
  format?: { duration?: string; format_name?: string };
  streams?: ProbeStream[];
}

function parseRate(rate: string | undefined): number {
  const [numerator, denominator] = (rate ?? "0/1").split("/").map(Number);
  return denominator ? (numerator ?? 0) / denominator : 0;
}

/** Parses the JSON block that the loudnorm filter prints at the end of stderr. */
function parseLoudnormJson(stderr: string): Record<string, string> {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new StudioError("EXTERNAL_SERVICE", "FFmpeg did not report loudness measurements.");
  }
  return JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
}

function parseIntervals(stderr: string, start: RegExp, end: RegExp, total: number): Interval[] {
  const starts = [...stderr.matchAll(start)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(end)].map((m) => Number(m[1]));
  // A region still open when the file ends has a start but no end.
  return starts.map((startSeconds, i) => ({ startSeconds, endSeconds: ends[i] ?? total }));
}

const MUSIC_FADE_IN_SECONDS = 1.5;
const MUSIC_FADE_OUT_SECONDS = 3;

/**
 * Filter graph for narration over a looped music bed. The bed fades in and out with the
 * programme and is pushed down whenever there is speech (the narration is the compressor's
 * side chain), so it fills pauses without ever competing with a word.
 */
function musicBed(volume: number, durationSeconds: number): string {
  const fadeOutAt = Math.max(0, durationSeconds - MUSIC_FADE_OUT_SECONDS).toFixed(3);
  return [
    `[1:a]volume=${volume},afade=t=in:st=0:d=${MUSIC_FADE_IN_SECONDS},afade=t=out:st=${fadeOutAt}:d=${MUSIC_FADE_OUT_SECONDS}[bedraw]`,
    "[0:a]asplit=2[voice][key]",
    "[bedraw][key]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=600[bed]",
    "[voice][bed]amix=inputs=2:duration=first:normalize=0",
  ].join(";");
}

export function createFfmpegTools(binaries = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" }): MediaTools {
  const ffmpeg = (args: readonly string[]) => run(binaries.ffmpeg, [...QUIET, ...args]);

  const probe = async (file: string): Promise<MediaInfo> => {
    const { stdout } = await run(binaries.ffprobe, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      file,
    ]);
    const data = JSON.parse(stdout) as ProbeOutput;
    const video = data.streams?.find((s) => s.codec_type === "video");
    const audio = data.streams?.find((s) => s.codec_type === "audio");
    return {
      durationSeconds: Number(data.format?.duration ?? 0),
      sizeBytes: (await stat(file)).size,
      formatName: data.format?.format_name ?? "unknown",
      video: video
        ? {
            codec: video.codec_name ?? "unknown",
            width: video.width ?? 0,
            height: video.height ?? 0,
            // The stream's declared rate. FFmpeg 9 reports an average a hair under the true
            // rate for segments joined by stream copy (29.9988 for a 30 fps cut).
            fps: parseRate(video.r_frame_rate ?? video.avg_frame_rate),
            pixelFormat: video.pix_fmt ?? "unknown",
          }
        : null,
      audio: audio
        ? {
            codec: audio.codec_name ?? "unknown",
            sampleRate: Number(audio.sample_rate ?? 0),
            channels: audio.channels ?? 0,
          }
        : null,
    };
  };

  const measureLoudness = async (file: string): Promise<LoudnessMeasurement> => {
    const { stderr } = await ffmpeg([
      "-i",
      file,
      "-vn",
      "-af",
      "loudnorm=print_format=json",
      "-f",
      "null",
      "-",
    ]);
    const m = parseLoudnormJson(stderr);
    return {
      integratedLufs: Number(m.input_i),
      truePeakDbtp: Number(m.input_tp),
      loudnessRange: Number(m.input_lra),
    };
  };

  const concat = async (request: ConcatRequest): Promise<void> => {
    await mkdir(path.dirname(request.output), { recursive: true });
    const list = `${request.output}.segments.txt`;
    const escaped = request.segments.map((s) => `file '${s.replaceAll("'", "'\\''")}'`);
    await writeFile(list, `${escaped.join("\n")}\n`);
    try {
      const source = ["-f", "concat", "-safe", "0", "-i", list];
      const music = request.music ? ["-stream_loop", "-1", "-i", request.music.file] : [];
      const mix = request.music
        ? musicBed(request.music.volume, request.durationSeconds)
        : "[0:a]anull";
      const { integratedLufs: I, truePeakDbtp: TP, loudnessRange: LRA } = request.loudness;
      const target = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;

      // Pass 1 measures the programme; pass 2 applies one fixed gain from those numbers.
      // Single-pass loudnorm adjusts gain continuously, which pumps under speech.
      const measured = await ffmpeg([
        ...source,
        ...music,
        "-filter_complex",
        `${mix},${target}:print_format=json[a]`,
        "-map",
        "[a]",
        "-f",
        "null",
        "-",
      ]);
      const m = parseLoudnormJson(measured.stderr);
      const silent = !Number.isFinite(Number(m.input_i));
      const normalise = silent
        ? "anull"
        : `${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
          `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;

      await ffmpeg([
        ...source,
        ...music,
        "-filter_complex",
        `${mix},${normalise},aresample=48000:async=1[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        `${request.audioBitrateKbps}k`,
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        request.output,
      ]);
    } finally {
      await rm(list, { force: true });
    }
  };

  const contactSheet = async (
    frames: readonly string[],
    output: string,
    columns: number,
  ): Promise<void> => {
    if (frames.length === 0)
      throw new StudioError("VALIDATION_FAILED", "No frames for contact sheet.");
    const first = await probe(frames[0] ?? "");
    const width = first.video?.width ?? 0;
    const height = first.video?.height ?? 0;
    const layout = frames
      .map((_, i) => `${(i % columns) * width}_${Math.floor(i / columns) * height}`)
      .join("|");
    const inputs = frames.flatMap((frame) => ["-i", frame]);
    const scaled = frames.map((_, i) => `[${i}:v]scale=${width}:${height}[s${i}]`).join(";");
    const labels = frames.map((_, i) => `[s${i}]`).join("");
    const stack =
      frames.length === 1
        ? `${scaled};[s0]copy[out]`
        : `${scaled};${labels}xstack=inputs=${frames.length}:layout=${layout}:fill=black[out]`;
    await ffmpeg([
      ...inputs,
      "-filter_complex",
      stack,
      "-map",
      "[out]",
      "-frames:v",
      "1",
      "-update",
      "1",
      output,
    ]);
  };

  return {
    probe,
    measureLoudness,
    concat,
    contactSheet,
    async transcodeRecording(input, output, fps) {
      await mkdir(path.dirname(output), { recursive: true });
      // Constant frame rate and a keyframe every second so the renderer can seek exactly.
      await ffmpeg([
        "-i",
        input,
        "-an",
        "-vf",
        `fps=${fps},format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "14",
        "-g",
        String(fps),
        "-movflags",
        "+faststart",
        output,
      ]);
    },
    async convertAudio(input, output) {
      await mkdir(path.dirname(output), { recursive: true });
      await ffmpeg(["-i", input, "-vn", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
    },
    async generateSilence(output, seconds) {
      await mkdir(path.dirname(output), { recursive: true });
      await ffmpeg([
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=mono",
        "-t",
        seconds.toFixed(3),
        "-c:a",
        "pcm_s16le",
        output,
      ]);
    },
    async detectBlackFrames(file) {
      const info = await probe(file);
      // pix_th 0.02 treats only near-true-black pixels as black. The brand background is
      // deliberately very dark, and a looser threshold would report every scene boundary.
      const { stderr } = await ffmpeg([
        "-i",
        file,
        "-an",
        "-vf",
        "blackdetect=d=0.5:pic_th=0.98:pix_th=0.02",
        "-f",
        "null",
        "-",
      ]);
      return parseIntervals(
        stderr,
        /black_start:([\d.]+)/g,
        /black_end:([\d.]+)/g,
        info.durationSeconds,
      );
    },
    async detectSilence(file, minSeconds) {
      const info = await probe(file);
      if (!info.audio) return [{ startSeconds: 0, endSeconds: info.durationSeconds }];
      const { stderr } = await ffmpeg([
        "-i",
        file,
        "-vn",
        "-af",
        `silencedetect=noise=-50dB:d=${minSeconds}`,
        "-f",
        "null",
        "-",
      ]);
      return parseIntervals(
        stderr,
        /silence_start: ([\d.-]+)/g,
        /silence_end: ([\d.]+)/g,
        info.durationSeconds,
      );
    },
    async extractFrame({ file, atSeconds, output, width, outline }) {
      await mkdir(path.dirname(output), { recursive: true });
      const box = outline
        ? `drawbox=x=${outline.x}:y=${outline.y}:w=${outline.width}:h=${outline.height}:color=white@0.55:t=3,`
        : "";
      await ffmpeg([
        "-ss",
        atSeconds.toFixed(3),
        "-i",
        file,
        "-frames:v",
        "1",
        "-vf",
        `${box}scale=${width}:-2`,
        "-update",
        "1",
        output,
      ]);
    },
  };
}

/** Level below which narration counts as silent, and the shortest stretch reported. */
const CLIP_SILENCE = { noiseDb: -42, minSeconds: 0.12 };
const EDGE_WINDOW_SECONDS = 0.01;
/** Reported for digital silence, where FFmpeg prints "-inf". */
const SILENCE_FLOOR_DB = -120;

/** The overall peak level from an astats report, or null when the filter printed none. */
export function parsePeakLevel(stderr: string): number | null {
  const matches = [...stderr.matchAll(/Peak level dB: (-?inf|-?[\d.]+)/g)];
  const last = matches.at(-1)?.[1];
  if (last === undefined) return null;
  const value = Number(last);
  return Number.isFinite(value) ? value : SILENCE_FLOOR_DB;
}

function finite(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Filter chain for finishing one clip. Exported so the exact processing can be tested. */
export function finishingFilters(request: FinishClipRequest): string {
  const filters: string[] = [];
  // 2:1 above -18 dB with slow-ish timing: evens out a loud phrase without audible pumping.
  if (request.compression) {
    filters.push("acompressor=threshold=-18dB:ratio=2:attack=20:release=250:makeup=1");
  }
  if (request.gainDb !== 0) filters.push(`volume=${request.gainDb.toFixed(2)}dB`);
  if (request.fadeInSeconds > 0) filters.push(`afade=t=in:st=0:d=${request.fadeInSeconds}`);
  if (request.fadeOutSeconds > 0) {
    const start = Math.max(0, request.durationSeconds - request.fadeOutSeconds).toFixed(4);
    filters.push(`afade=t=out:st=${start}:d=${request.fadeOutSeconds}`);
  }
  return filters.length ? filters.join(",") : "anull";
}

function audioCodec(output: string): string[] {
  return path.extname(output).toLowerCase() === ".wav"
    ? ["-c:a", "pcm_s16le"]
    : ["-c:a", "libmp3lame", "-b:a", "192k"];
}

/** Measurement and finishing of single narration clips. */
export function createAudioTools(binaries = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" }): AudioTools {
  const ffmpeg = (args: readonly string[]) => run(binaries.ffmpeg, [...QUIET, ...args]);
  const analyse = async (file: string, filter: string): Promise<string> =>
    (await ffmpeg(["-i", file, "-vn", "-af", filter, "-f", "null", "-"])).stderr;

  const duration = async (file: string): Promise<number> => {
    const { stdout } = await run(binaries.ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]);
    return Number(stdout.trim()) || 0;
  };

  return {
    async measureClip(file): Promise<ClipMeasurement> {
      const durationSeconds = await duration(file);
      const loudness = parseLoudnormJson(await analyse(file, "loudnorm=print_format=json"));
      const scan = await analyse(
        file,
        `silencedetect=noise=${CLIP_SILENCE.noiseDb}dB:d=${CLIP_SILENCE.minSeconds},astats`,
      );
      const tailStart = Math.max(0, durationSeconds - EDGE_WINDOW_SECONDS).toFixed(4);
      const head = await analyse(file, `atrim=end=${EDGE_WINDOW_SECONDS},astats`);
      const tail = await analyse(file, `atrim=start=${tailStart},astats`);
      return {
        durationSeconds,
        integratedLufs: finite(loudness.input_i),
        truePeakDbtp: finite(loudness.input_tp),
        loudnessRange: finite(loudness.input_lra),
        samplePeakDb: parsePeakLevel(scan),
        startEdgeDb: parsePeakLevel(head),
        endEdgeDb: parsePeakLevel(tail),
        silences: parseIntervals(
          scan,
          /silence_start: ([\d.-]+)/g,
          /silence_end: ([\d.]+)/g,
          durationSeconds,
        ),
      };
    },
    async finishClip(request) {
      await mkdir(path.dirname(request.output), { recursive: true });
      await ffmpeg([
        "-i",
        request.input,
        "-vn",
        "-af",
        finishingFilters(request),
        ...audioCodec(request.output),
        request.output,
      ]);
    },
    async cutAudio(input, output, startSeconds, endSeconds) {
      await mkdir(path.dirname(output), { recursive: true });
      // Re-encoded rather than stream-copied so the cut lands on the requested sample.
      await ffmpeg([
        "-i",
        input,
        "-vn",
        "-af",
        `atrim=start=${startSeconds.toFixed(3)}:end=${endSeconds.toFixed(3)},asetpts=PTS-STARTPTS`,
        ...audioCodec(output),
        output,
      ]);
    },
  };
}

export async function toolVersion(binary: string): Promise<string | null> {
  try {
    const { stdout } = await run(binary, ["-version"]);
    return /version (\S+)/.exec(stdout)?.[1] ?? "unknown";
  } catch {
    return null;
  }
}
