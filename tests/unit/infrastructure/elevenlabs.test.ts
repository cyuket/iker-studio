import { beforeEach, describe, expect, it } from "vitest";
import type { SynthesisRequest } from "../../../src/application/ports";
import { VoiceSettingsSchema } from "../../../src/domain/voice";
import { capabilitiesFor } from "../../../src/domain/voice-models";
import {
  contextFor,
  createElevenLabsSynthesizer,
  retryDelayMs,
  DEFAULT_RETRY,
  voiceSettingsFor,
} from "../../../src/infrastructure/voice/elevenlabs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { silentLogger } from "../../helpers/fakes";

const API_KEY = "sk_test_key_never_real_0123456789";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let calls: Call[];
let sleeps: number[];
let dir: string;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const AUDIO = {
  audio_base64: Buffer.from("fake-mp3-bytes").toString("base64"),
  alignment: {
    characters: ["H", "i"],
    character_start_times_seconds: [0, 0.1],
    character_end_times_seconds: [0.1, 0.2],
  },
};

function synthesizer(responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchFake = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    });
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected extra request");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as typeof fetch;
  return createElevenLabsSynthesizer({
    apiKey: API_KEY,
    defaultVoiceId: "voice-default",
    defaultModelId: "eleven_multilingual_v2",
    dictionaryCacheFile: path.join(dir, "dictionaries.json"),
    logger: silentLogger,
    fetch: fetchFake,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  });
}

const request = (overrides: Partial<SynthesisRequest> = {}): SynthesisRequest => ({
  text: "Hi",
  voice: VoiceSettingsSchema.parse({ provider: "elevenlabs", stability: 0.4, speed: 1.05 }),
  voiceId: "voice-a",
  modelId: "eleven_multilingual_v2",
  rules: [],
  outputBase: path.join(dir, "clip"),
  ...overrides,
});

beforeEach(async () => {
  calls = [];
  sleeps = [];
  dir = await mkdtemp(path.join(os.tmpdir(), "studio-eleven-"));
});

describe("ElevenLabs synthesizer", () => {
  it("calls the documented timestamps endpoint with the key, voice settings and seed", async () => {
    const result = await synthesizer([json(200, AUDIO)]).synthesize(request());
    const [call] = calls;
    expect(call?.url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-a/with-timestamps?output_format=mp3_44100_128",
    );
    expect(call?.method).toBe("POST");
    expect(call?.headers["xi-api-key"]).toBe(API_KEY);
    expect(call?.body).toMatchObject({
      text: "Hi",
      model_id: "eleven_multilingual_v2",
      seed: 20_260_101,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.75,
        style: 0,
        speed: 1.05,
        use_speaker_boost: true,
      },
    });
    expect(call?.body).not.toHaveProperty("pronunciation_dictionary_locators");
    expect(result.billedCharacters).toBe(2);
  });

  it("writes the decoded audio and returns character timings", async () => {
    const result = await synthesizer([json(200, AUDIO)]).synthesize(request());
    expect(result.file).toBe(path.join(dir, "clip.mp3"));
    expect(await readFile(result.file, "utf8")).toBe("fake-mp3-bytes");
    expect(result.alignment).toEqual({
      characters: ["H", "i"],
      startSeconds: [0, 0.1],
      endSeconds: [0.1, 0.2],
    });
  });

  it("uses environment defaults when the video names no voice", () => {
    const resolved = synthesizer([]).resolveVoice(
      VoiceSettingsSchema.parse({ provider: "elevenlabs" }),
    );
    expect(resolved).toEqual({ voiceId: "voice-default", modelId: "eleven_multilingual_v2" });
  });

  it("uploads pronunciation rules as a dictionary once, then reuses it", async () => {
    const rules = [
      {
        term: "KYC",
        status: "approved" as const,
        alias: "K Y C",
        ipa: null,
        notes: "",
        approvedBy: "R",
        approvedAt: null,
      },
    ];
    const speech = synthesizer([
      json(200, { id: "dict-1", version_id: "v-1" }),
      json(200, AUDIO),
      json(200, AUDIO),
    ]);
    await speech.synthesize(request({ rules }));
    await speech.synthesize(request({ rules, text: "Hi again" }));
    expect(
      calls.map((call) => call.url.replace("https://api.elevenlabs.io", "").split("?")[0]),
    ).toEqual([
      "/v1/pronunciation-dictionaries/add-from-rules",
      "/v1/text-to-speech/voice-a/with-timestamps",
      "/v1/text-to-speech/voice-a/with-timestamps",
    ]);
    expect(calls[0]?.body).toMatchObject({
      rules: [{ type: "alias", string_to_replace: "KYC", alias: "K Y C" }],
    });
    expect(calls[1]?.body).toMatchObject({
      pronunciation_dictionary_locators: [
        { pronunciation_dictionary_id: "dict-1", version_id: "v-1" },
      ],
    });
  });

  it("sends an IPA rule as a phoneme rule", async () => {
    const rules = [
      {
        term: "Iker",
        status: "approved" as const,
        alias: null,
        ipa: "maɪˈɑːzə",
        notes: "",
        approvedBy: "R",
        approvedAt: null,
      },
    ];
    await synthesizer([json(200, { id: "d", version_id: "v" }), json(200, AUDIO)]).synthesize(
      request({ rules }),
    );
    expect(calls[0]?.body).toMatchObject({
      rules: [{ type: "phoneme", string_to_replace: "Iker", phoneme: "maɪˈɑːzə", alphabet: "ipa" }],
    });
  });
});

describe("rate limits and failures", () => {
  it("waits for Retry-After on a 429 and then succeeds", async () => {
    const result = await synthesizer([
      json(429, {}, { "retry-after": "7" }),
      json(200, AUDIO),
    ]).synthesize(request());
    expect(sleeps).toEqual([7000]);
    expect(result.billedCharacters).toBe(2);
  });

  it("backs off exponentially on repeated server errors", async () => {
    await synthesizer([json(503, {}), json(502, {}), json(500, {}), json(200, AUDIO)]).synthesize(
      request(),
    );
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it("retries a network failure", async () => {
    await synthesizer([new TypeError("fetch failed"), json(200, AUDIO)]).synthesize(request());
    expect(calls).toHaveLength(2);
  });

  it("gives up after the configured number of attempts with an actionable error", async () => {
    const attempt = synthesizer(Array.from({ length: 5 }, () => json(429, {}))).synthesize(
      request(),
    );
    await expect(attempt).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE",
      message: expect.stringContaining("rate limit") as string,
    });
    expect(calls).toHaveLength(DEFAULT_RETRY.maxAttempts);
  });

  it.each([
    [401, "CONFIG_INVALID", "API key"],
    [402, "EXTERNAL_SERVICE", "quota"],
    [404, "EXTERNAL_SERVICE", "voice or model"],
    [422, "EXTERNAL_SERVICE", "invalid"],
  ])("does not retry HTTP %i and explains it", async (status, code, phrase) => {
    const attempt = synthesizer([json(status, { detail: "nope" })]).synthesize(request());
    await expect(attempt).rejects.toMatchObject({
      code,
      message: expect.stringContaining(phrase) as string,
    });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("passes on the provider's own explanation of a refusal", async () => {
    const refusal = json(403, {
      detail: {
        status: "output_format_not_allowed",
        message: "Output format 'mp3_44100_192' is only available on the Creator tier and above.",
      },
    });
    await expect(synthesizer([refusal]).synthesize(request())).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE",
      message: expect.stringContaining("only available on the Creator tier") as string,
    });
  });

  it("never puts the API key in an error", async () => {
    const error = await synthesizer([json(401, {})])
      .synthesize(request())
      .catch((e: unknown) => e as Error & { hint?: string });
    expect(`${(error as Error).message} ${(error as { hint?: string }).hint ?? ""}`).not.toContain(
      API_KEY,
    );
  });

  it("rejects a response without audio instead of writing an empty file", async () => {
    await expect(
      synthesizer([json(200, { something: "else" })]).synthesize(request()),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE" });
  });

  it("caps the delay and honours a zero Retry-After", () => {
    expect(retryDelayMs(10, null, DEFAULT_RETRY)).toBe(DEFAULT_RETRY.maxDelayMs);
    expect(retryDelayMs(1, "0", DEFAULT_RETRY)).toBe(0);
    expect(retryDelayMs(1, "9999", DEFAULT_RETRY)).toBe(DEFAULT_RETRY.maxDelayMs);
    expect(retryDelayMs(2, "not-a-number", DEFAULT_RETRY)).toBe(2000);
  });

  it("reports account usage", async () => {
    const usage = await synthesizer([
      json(200, { character_count: 1200, character_limit: 30000, tier: "creator" }),
    ]).usage();
    expect(usage).toEqual({ charactersUsed: 1200, characterLimit: 30000, tier: "creator" });
    expect(calls[0]?.url).toBe("https://api.elevenlabs.io/v1/user/subscription");
  });

  it("returns no usage, without failing, when the key may not read the subscription", async () => {
    const usage = await synthesizer([
      json(401, { detail: { message: "The API key is missing the permission user_read" } }),
    ]).usage();
    expect(usage).toBeNull();
  });
});

describe("model-aware requests", () => {
  it("sends eleven_v4 only the two settings it honours", async () => {
    await synthesizer([json(200, AUDIO)]).synthesize(request({ modelId: "eleven_v4" }));
    const body = calls[0]?.body as { voice_settings: Record<string, unknown> };
    expect(body.voice_settings).toEqual({ stability: 0.4, similarity_boost: 0.75 });
  });

  it("sends an unknown model only the two universal settings and no context", async () => {
    await synthesizer([json(200, AUDIO)]).synthesize(
      request({ modelId: "eleven_v9", previousText: "Before.", nextText: "After." }),
    );
    const body = calls[0]?.body as Record<string, unknown>;
    expect(body.voice_settings).toEqual({ stability: 0.4, similarity_boost: 0.75 });
    expect(body).not.toHaveProperty("previous_text");
    expect(body).not.toHaveProperty("next_text");
  });

  it("sends neighbouring text as context where the model supports it", async () => {
    await synthesizer([json(200, AUDIO)]).synthesize(
      request({ modelId: "eleven_v4", previousText: "Before.", nextText: "After." }),
    );
    expect(calls[0]?.body).toMatchObject({ previous_text: "Before.", next_text: "After." });
  });

  it("does not send context to eleven_v3, which documents no stitching", async () => {
    await synthesizer([json(200, AUDIO)]).synthesize(
      request({ modelId: "eleven_v3", previousText: "Before.", nextText: "After." }),
    );
    expect(calls[0]?.body).not.toHaveProperty("previous_text");
  });

  it("omits context fields when there is no neighbour", async () => {
    await synthesizer([json(200, AUDIO)]).synthesize(request({ modelId: "eleven_v4" }));
    expect(calls[0]?.body).not.toHaveProperty("previous_text");
    expect(calls[0]?.body).not.toHaveProperty("next_text");
  });

  it("sends the text exactly as given, markup included", async () => {
    const text = "[warm, conversational] They pass again. [pause] Because.";
    await synthesizer([json(200, AUDIO)]).synthesize(request({ modelId: "eleven_v4", text }));
    expect((calls[0]?.body as { text: string }).text).toBe(text);
  });

  it("reports the credits and request id the provider states in its headers", async () => {
    const result = await synthesizer([
      json(200, AUDIO, { "character-cost": "40", "request-id": "req-123" }),
    ]).synthesize(request({ modelId: "eleven_v4" }));
    expect(result.billedCredits).toBe(40);
    expect(result.requestId).toBe("req-123");
  });

  it("leaves credits unset when the provider states none", async () => {
    const result = await synthesizer([json(200, AUDIO)]).synthesize(request());
    expect(result.billedCredits).toBeUndefined();
    expect(result.requestId).toBeNull();
  });

  it("refuses a clip longer than the model's documented limit without calling the API", async () => {
    await expect(
      synthesizer([]).synthesize(request({ modelId: "eleven_v3", text: "a".repeat(5001) })),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(calls).toHaveLength(0);
  });

  it("builds settings and context as pure functions of the capability table", () => {
    const voice = VoiceSettingsSchema.parse({ provider: "elevenlabs", style: 0.2, speed: 0.9 });
    expect(voiceSettingsFor(voice, capabilitiesFor("eleven_multilingual_v2"))).toEqual({
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.2,
      speed: 0.9,
      use_speaker_boost: true,
    });
    expect(contextFor({ previousText: "a" }, capabilitiesFor("eleven_flash_v2_5"))).toEqual({
      previous_text: "a",
    });
  });
});
