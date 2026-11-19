import { rename } from "node:fs/promises";
import type { SpeechSynthesizer, SynthesisRequest, SynthesisResult } from "../../application/ports";
import { speedUpAlignment } from "../../domain/captions";
import { splitSpeed } from "../../domain/voice";
import { capabilitiesFor } from "../../domain/voice-models";
import { run } from "../media/process";

/** Writes `output` as `input` played `factor` times faster, keeping its pitch. */
export type TempoStretch = (input: string, output: string, factor: number) => Promise<void>;

export function ffmpegTempoStretch(ffmpeg = "ffmpeg"): TempoStretch {
  return async (input, output, factor) => {
    await run(ffmpeg, [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      input,
      "-vn",
      "-af",
      `atempo=${factor.toFixed(6)}`,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      output,
    ]);
  };
}

/** Below this a stretch is rounding noise, not a pace change. */
const NO_STRETCH = 1e-6;

/**
 * Lets a video ask for a faster pace than the speech API accepts. The API is asked for as
 * much of the pace as it allows; the rest is a pitch-preserving time-stretch of the returned
 * clip, and the character timings are compressed by the same factor so captions and beats
 * stay on the words. Billing and everything else pass through unchanged.
 */
export function withTimeStretch(
  inner: SpeechSynthesizer,
  stretch: TempoStretch,
): SpeechSynthesizer {
  return {
    ...inner,
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      const honoursSpeed = capabilitiesFor(request.modelId).settings.speed;
      const split = splitSpeed(request.voice.speed, honoursSpeed);
      if (Math.abs(split.stretch - 1) < NO_STRETCH) return inner.synthesize(request);
      const result = await inner.synthesize({
        ...request,
        voice: { ...request.voice, speed: split.provider },
      });
      const stretched = `${request.outputBase}.stretched.mp3`;
      await stretch(result.file, stretched, split.stretch);
      await rename(stretched, result.file);
      return {
        ...result,
        alignment: result.alignment ? speedUpAlignment(result.alignment, split.stretch) : null,
      };
    },
  };
}
