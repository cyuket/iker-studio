import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SpeechSynthesizer, SynthesisRequest } from "../../../src/application/ports";
import { VoiceSettingsSchema } from "../../../src/domain/voice";
import { withTimeStretch, type TempoStretch } from "../../../src/infrastructure/voice/tempo";

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), "tempo-"));
  const sent: SynthesisRequest[] = [];
  const inner: SpeechSynthesizer = {
    provider: "elevenlabs",
    resolveVoice: () => ({ voiceId: "v", modelId: "eleven_multilingual_v2" }),
    async synthesize(request) {
      sent.push(request);
      const file = `${request.outputBase}.mp3`;
      await writeFile(file, "original");
      return {
        file,
        alignment: { characters: ["a", "b"], startSeconds: [0, 0.6], endSeconds: [0.6, 1.2] },
        billedCharacters: 2,
      };
    },
    usage: () => Promise.resolve(null),
  };
  const stretches: number[] = [];
  const stretch: TempoStretch = async (_input, output, factor) => {
    stretches.push(factor);
    await writeFile(output, `stretched x${factor.toFixed(3)}`);
  };
  const request = (speed: number, modelId = "eleven_multilingual_v2"): SynthesisRequest => ({
    text: "ab",
    voice: VoiceSettingsSchema.parse({ provider: "elevenlabs", speed, finishing: {} }),
    voiceId: "v",
    modelId,
    rules: [],
    outputBase: path.join(dir, "clip"),
  });
  return { synthesizer: withTimeStretch(inner, stretch), sent, stretches, request };
}

describe("withTimeStretch", () => {
  it("leaves a pace the API accepts entirely to the API", async () => {
    const { synthesizer, sent, stretches, request } = await setup();
    const result = await synthesizer.synthesize(request(1.15));
    expect(sent[0]?.voice.speed).toBe(1.15);
    expect(stretches).toEqual([]);
    expect(await readFile(result.file, "utf8")).toBe("original");
  });

  it("asks the API for its maximum and stretches the clip and its timings for the rest", async () => {
    const { synthesizer, sent, stretches, request } = await setup();
    const result = await synthesizer.synthesize(request(2));
    expect(sent[0]?.voice.speed).toBe(1.2);
    expect(stretches[0]).toBeCloseTo(2 / 1.2, 10);
    expect(await readFile(result.file, "utf8")).toBe("stretched x1.667");
    expect(result.alignment?.endSeconds.at(-1)).toBeCloseTo(1.2 / (2 / 1.2), 10);
    expect(result.billedCharacters).toBe(2);
  });
});
