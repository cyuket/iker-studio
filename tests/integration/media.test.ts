import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { LOUDNESS_TARGET } from "../../src/domain/formats";
import { startAssetServer } from "../../src/infrastructure/http/asset-server";
import { startStaticServer } from "../../src/infrastructure/http/static-server";
import { createFfmpegTools } from "../../src/infrastructure/media/ffmpeg";
import { run } from "../../src/infrastructure/media/process";

const media = createFfmpegTools();
let dir: string;

/** Makes a segment like the renderer does: H.264 with PCM audio in MKV. */
async function segment(
  name: string,
  seconds: number,
  colour: string,
  tone: number | null,
): Promise<string> {
  const file = path.join(dir, `${name}.mkv`);
  const audio =
    tone === null ? "anullsrc=r=48000:cl=stereo" : `sine=frequency=${tone}:sample_rate=48000`;
  await run("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${colour}:s=320x180:r=30`,
    "-f",
    "lavfi",
    "-i",
    audio,
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "pcm_s16le",
    "-ac",
    "2",
    file,
  ]);
  return file;
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "studio media "));
});

describe("FFmpeg tools", () => {
  it("generates silence of the requested length and probes it", async () => {
    const file = path.join(dir, "silence.wav");
    await media.generateSilence(file, 2.5);
    const info = await media.probe(file);
    expect(info.durationSeconds).toBeCloseTo(2.5, 2);
    expect(info.video).toBeNull();
    expect(info.audio).toMatchObject({ codec: "pcm_s16le", sampleRate: 48000, channels: 1 });
  });

  it("joins segments into an MP4 of the summed length with H.264 video and AAC audio", async () => {
    const segments = [
      await segment("one", 2, "0x202840", 440),
      await segment("two", 3, "0x402020", 660),
    ];
    const output = path.join(dir, "joined.mp4");
    await media.concat({
      segments,
      output,
      audioBitrateKbps: 128,
      loudness: LOUDNESS_TARGET,
      music: null,
      durationSeconds: 10,
    });
    const info = await media.probe(output);
    expect(info.durationSeconds).toBeCloseTo(5, 1);
    expect(info.formatName).toContain("mp4");
    expect(info.video).toMatchObject({
      codec: "h264",
      width: 320,
      height: 180,
      fps: 30,
      pixelFormat: "yuv420p",
    });
    expect(info.audio).toMatchObject({ codec: "aac", sampleRate: 48000, channels: 2 });
  });

  it("normalises loudness to the target without clipping", async () => {
    const loud = path.join(dir, "loud.mkv");
    await run("ffmpeg", [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x202840:s=320x180:r=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-af",
      "volume=-20dB",
      "-t",
      "6",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "pcm_s16le",
      loud,
    ]);
    const before = await media.measureLoudness(loud);
    const output = path.join(dir, "normalised.mp4");
    await media.concat({
      segments: [loud],
      output,
      audioBitrateKbps: 128,
      loudness: LOUDNESS_TARGET,
      music: null,
      durationSeconds: 10,
    });
    const after = await media.measureLoudness(output);
    expect(Math.abs(before.integratedLufs - LOUDNESS_TARGET.integratedLufs)).toBeGreaterThan(3);
    expect(after.integratedLufs).toBeCloseTo(LOUDNESS_TARGET.integratedLufs, 0);
    expect(after.truePeakDbtp).toBeLessThanOrEqual(-1);
  });

  it("joins fully silent segments without failing on unmeasurable loudness", async () => {
    const output = path.join(dir, "quiet.mp4");
    await media.concat({
      segments: [await segment("quiet", 2, "0x202840", null)],
      output,
      audioBitrateKbps: 128,
      loudness: LOUDNESS_TARGET,
      music: null,
      durationSeconds: 10,
    });
    expect((await media.probe(output)).audio?.codec).toBe("aac");
    expect(await media.detectSilence(output, 1)).toHaveLength(1);
  });

  it("mixes an optional music bed under the programme", async () => {
    const bed = path.join(dir, "bed.wav");
    await run("ffmpeg", [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:sample_rate=48000",
      "-t",
      "1",
      bed,
    ]);
    const output = path.join(dir, "with-music.mp4");
    await media.concat({
      segments: [await segment("speechless", 3, "0x202840", null)],
      output,
      audioBitrateKbps: 128,
      loudness: LOUDNESS_TARGET,
      music: { file: bed, volume: 0.5 },
      durationSeconds: 10,
    });
    // The bed is one second long and the programme three: it must loop, not end early.
    expect(await media.detectSilence(output, 1)).toEqual([]);
    expect((await media.probe(output)).durationSeconds).toBeCloseTo(3, 1);
  });

  it("finds a silent stretch between two tones", async () => {
    const segments = [
      await segment("t1", 2, "0x202840", 440),
      await segment("gap", 3, "0x202840", null),
      await segment("t2", 2, "0x202840", 440),
    ];
    const output = path.join(dir, "gapped.mp4");
    await media.concat({
      segments,
      output,
      audioBitrateKbps: 128,
      loudness: LOUDNESS_TARGET,
      music: null,
      durationSeconds: 10,
    });
    const [interval] = await media.detectSilence(output, 1);
    expect(interval?.startSeconds).toBeCloseTo(2, 0);
    expect(interval?.endSeconds).toBeCloseTo(5, 0);
  });

  it("detects true black but not the dark brand background", async () => {
    const black = await segment("black", 2, "black", 440);
    const brand = await segment("brand", 2, "0x121518", 440);
    expect(await media.detectBlackFrames(black)).toHaveLength(1);
    expect(await media.detectBlackFrames(brand)).toEqual([]);
  });

  it("extracts frames and tiles them into a contact sheet", async () => {
    const source = await segment("frames", 2, "0x334455", 440);
    const frames = [];
    for (const [i, at] of [0.2, 0.8, 1.4].entries()) {
      const output = path.join(dir, "sheet", `f${i}.png`);
      await media.extractFrame({
        file: source,
        atSeconds: at,
        output,
        width: 160,
        outline: { x: 10, y: 10, width: 300, height: 160 },
      });
      frames.push(output);
    }
    const sheet = path.join(dir, "sheet", "contact.png");
    await media.contactSheet(frames, sheet, 2);
    expect((await media.probe(sheet)).video).toMatchObject({ width: 320, height: 180 });
  });

  it("conforms a capture to constant frame rate H.264 without audio", async () => {
    const capture = path.join(dir, "capture.webm");
    await run("ffmpeg", [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=s=320x180:r=25",
      "-t",
      "2",
      "-c:v",
      "libvpx-vp9",
      capture,
    ]);
    const output = path.join(dir, "recording.mp4");
    await media.transcodeRecording(capture, output, 30);
    const info = await media.probe(output);
    expect(info.video).toMatchObject({ codec: "h264", fps: 30, pixelFormat: "yuv420p" });
    expect(info.audio).toBeNull();
  });

  it("reports a missing program as a dependency problem", async () => {
    await expect(
      createFfmpegTools({ ffmpeg: "ffmpeg-not-installed", ffprobe: "ffprobe-not-installed" }).probe(
        "x.mp4",
      ),
    ).rejects.toMatchObject({ code: "DEPENDENCY_MISSING" });
  });
});

describe("asset resolution over HTTP", () => {
  it("serves files with the right type and supports byte ranges", async () => {
    const file = path.join(dir, "served dir", "clip one.mp4");
    await writeFile(path.join(dir, "0123456789.bin"), "0123456789");
    await run("mkdir", ["-p", path.dirname(file)]);
    await writeFile(file, "0123456789");
    const assets = await startAssetServer({ video: path.dirname(file) });
    try {
      const url = assets.urlFor(file);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/video\/clip%20one\.mp4$/);
      const whole = await fetch(url);
      expect(whole.status).toBe(200);
      expect(whole.headers.get("content-type")).toBe("video/mp4");
      expect(await whole.text()).toBe("0123456789");
      const part = await fetch(url, { headers: { Range: "bytes=2-5" } });
      expect(part.status).toBe(206);
      expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(await part.text()).toBe("2345");
      const tail = await fetch(url, { headers: { Range: "bytes=-3" } });
      expect(await tail.text()).toBe("789");
      expect((await fetch(url, { headers: { Range: "bytes=50-60" } })).status).toBe(416);
    } finally {
      await assets.close();
    }
  });

  it("refuses to give a URL for a file outside the served directories", async () => {
    const assets = await startAssetServer({ video: path.join(dir, "served dir") });
    try {
      expect(() => assets.urlFor("/etc/passwd")).toThrow(/outside the directories being served/);
    } finally {
      await assets.close();
    }
  });

  it("never serves a path that escapes its mount, and rejects other methods", async () => {
    await writeFile(path.join(dir, "secret.txt"), "do not serve");
    const server = await startStaticServer({ mounts: { files: path.join(dir, "served dir") } });
    try {
      for (const attempt of [
        "/files/../secret.txt",
        "/files/%2e%2e/secret.txt",
        "/files/..%2fsecret.txt",
        "/secret.txt",
      ]) {
        const response = await fetch(`${server.origin}${attempt}`);
        expect(response.status, attempt).toBe(404);
      }
      expect(
        (await fetch(`${server.origin}/files/clip%20one.mp4`, { method: "POST" })).status,
      ).toBe(405);
      expect(server.origin.startsWith("http://127.0.0.1:")).toBe(true);
    } finally {
      await server.close();
    }
  });
});
