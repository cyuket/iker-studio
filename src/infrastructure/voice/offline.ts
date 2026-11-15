import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { MediaTools, SpeechSynthesizer } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { estimateNarrationSeconds } from "../../domain/script";
import { applyAliases } from "../../domain/voice";
import { run } from "../media/process";

/**
 * Offline stand-ins for the production voice. They exist so the whole pipeline can be
 * exercised without spending credits; anything narrated with them is reported as a
 * synthetic voice track and must not be published as the finished narration.
 */

/** macOS speech synthesis via the built-in `say` command. */
export function createSystemSynthesizer(
  media: MediaTools,
  platform = process.platform,
): SpeechSynthesizer {
  return {
    provider: "system",
    resolveVoice(voice) {
      return { voiceId: voice.voiceId ?? "system-default", modelId: voice.modelId ?? "macos-say" };
    },
    async synthesize(request) {
      if (platform !== "darwin") {
        throw new StudioError("DEPENDENCY_MISSING", "The system voice needs macOS.", {
          hint: "Use `--voice-provider silent` on Linux, or configure ElevenLabs.",
        });
      }
      const aiff = `${request.outputBase}.aiff`;
      const file = `${request.outputBase}.wav`;
      await mkdir(path.dirname(aiff), { recursive: true });
      const spoken = applyAliases(request.text, request.rules);
      // 175 words per minute is the `say` default; speed scales it like the real voice setting.
      const rate = String(Math.round(175 * request.voice.speed));
      const voiceArgs = request.voiceId === "system-default" ? [] : ["-v", request.voiceId];
      await run("say", [...voiceArgs, "-r", rate, "-o", aiff, "--", spoken]);
      await media.convertAudio(aiff, file);
      await rm(aiff, { force: true });
      return { file, alignment: null, billedCharacters: 0 };
    },
    usage: () => Promise.resolve(null),
  };
}

/** Silence of the length the narration is expected to take. Used by CI. */
export function createSilentSynthesizer(media: MediaTools): SpeechSynthesizer {
  return {
    provider: "silent",
    resolveVoice(voice) {
      return { voiceId: voice.voiceId ?? "none", modelId: voice.modelId ?? "silence" };
    },
    async synthesize(request) {
      const file = `${request.outputBase}.wav`;
      const seconds = Math.max(0.5, estimateNarrationSeconds(request.text) / request.voice.speed);
      await media.generateSilence(file, seconds);
      return { file, alignment: null, billedCharacters: 0 };
    },
    usage: () => Promise.resolve(null),
  };
}
