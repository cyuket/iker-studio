import { describe, expect, it } from "vitest";
import {
  activeRules,
  applyAliases,
  estimateSynthesisCost,
  MAX_SPEED,
  narrationCacheKey,
  type NarrationRequest,
  type PronunciationEntry,
  PROVIDER_MAX_SPEED,
  splitSpeed,
  termsUsedIn,
  voiceConfigurationHash,
  VoiceSettingsSchema,
} from "../../../src/domain/voice";

const voice = VoiceSettingsSchema.parse({ provider: "elevenlabs" });
const request = (overrides: Partial<NarrationRequest> = {}): NarrationRequest => ({
  text: "Each selfie is compared with verified customers.",
  voice,
  resolvedVoiceId: "voice-a",
  resolvedModelId: "eleven_multilingual_v2",
  rules: [],
  ...overrides,
});
const entry = (overrides: Partial<PronunciationEntry>): PronunciationEntry => ({
  term: "KYC",
  status: "approved",
  alias: "K Y C",
  ipa: null,
  notes: "",
  approvedBy: "Reviewer",
  approvedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("narrationCacheKey", () => {
  it("is identical for identical requests, so the audio is reused", () => {
    expect(narrationCacheKey(request())).toBe(narrationCacheKey(request()));
  });

  it("ignores leading and trailing whitespace in the text", () => {
    expect(narrationCacheKey(request({ text: `  ${request().text}\n` }))).toBe(
      narrationCacheKey(request()),
    );
  });

  it.each([
    ["text", request({ text: "Each selfie is compared with verified users." })],
    ["voice id", request({ resolvedVoiceId: "voice-b" })],
    ["model", request({ resolvedModelId: "eleven_flash_v2_5" })],
    ["stability", request({ voice: { ...voice, stability: 0.6 } })],
    ["similarity", request({ voice: { ...voice, similarityBoost: 0.5 } })],
    ["speed", request({ voice: { ...voice, speed: 1.1 } })],
    ["provider", request({ voice: { ...voice, provider: "system" } })],
    ["a pronunciation rule", request({ rules: [entry({})] })],
  ])("changes when the %s changes", (_name, changed) => {
    expect(narrationCacheKey(changed)).not.toBe(narrationCacheKey(request()));
  });

  it("does not depend on the order of pronunciation rules", () => {
    const a = entry({ term: "KYC" });
    const b = entry({ term: "AML", alias: "A M L" });
    expect(narrationCacheKey(request({ rules: [a, b] }))).toBe(
      narrationCacheKey(request({ rules: [b, a] })),
    );
  });

  it("is unaffected by who approved a rule or when", () => {
    const first = entry({ approvedBy: "A", approvedAt: "2026-01-01T00:00:00.000Z" });
    const second = entry({ approvedBy: "B", approvedAt: "2026-06-01T00:00:00.000Z" });
    expect(narrationCacheKey(request({ rules: [first] }))).toBe(
      narrationCacheKey(request({ rules: [second] })),
    );
  });
});

describe("narrationCacheKey for performed clips", () => {
  const performance = {
    preset: "natural-educator",
    renderedText: "[warm, conversational] Each selfie is compared with verified customers.",
    effectiveSettings: { stability: 0.45, similarityBoost: 0.75, style: null, speed: null },
  };

  it("keeps the exact key that clips paid for before presets existed", () => {
    // The hook of output/face-deduplication as narrated on 2026-10-08. If this key ever
    // changes, every existing clip shows as missing and would be bought again.
    const key = narrationCacheKey({
      text: "A user signs up, passes identity verification, and opens an account. Three weeks later, the same person signs up again. Different email. Different phone number. A slightly different name. They pass verification again, because every check on that second application is, on its own, valid.",
      voice: VoiceSettingsSchema.parse({ provider: "elevenlabs", voiceId: "TyAD2ntJFdDReoa55SLn" }),
      resolvedVoiceId: "TyAD2ntJFdDReoa55SLn",
      resolvedModelId: "eleven_v4",
      rules: [],
    });
    expect(key).toBe("3eb46b7cfe151b9499748475e8090b8856f42adcbaa2f60010de7ccf3fc4d0b2");
  });

  it("does not let finishing or the recorded preset disturb a plain clip's key", () => {
    const changed = { ...voice, finishing: { ...voice.finishing, compression: true } };
    expect(narrationCacheKey(request({ voice: changed }))).toBe(narrationCacheKey(request()));
  });

  it("differs from the plain key for the same words", () => {
    expect(narrationCacheKey(request({ performance }))).not.toBe(narrationCacheKey(request()));
  });

  it.each([
    ["preset", { ...performance, preset: "technical-expert" }],
    ["direction markup", { ...performance, renderedText: `${performance.renderedText} [pause]` }],
    [
      "effective setting",
      { ...performance, effectiveSettings: { ...performance.effectiveSettings, stability: 0.6 } },
    ],
  ])("changes when the %s changes", (_name, changed) => {
    expect(narrationCacheKey(request({ performance: changed }))).not.toBe(
      narrationCacheKey(request({ performance })),
    );
  });

  it("changes when the spoken words change", () => {
    expect(narrationCacheKey(request({ performance, text: "Other words." }))).not.toBe(
      narrationCacheKey(request({ performance })),
    );
  });

  it("ignores manifest settings the preset replaces, so a stale slider cannot re-bill a clip", () => {
    const moved = { ...voice, stability: 0.9, speed: 1.1 };
    expect(narrationCacheKey(request({ performance, voice: moved }))).toBe(
      narrationCacheKey(request({ performance })),
    );
  });
});

describe("voiceConfigurationHash", () => {
  it("changes with the voice or model but not with the text", () => {
    const base = voiceConfigurationHash(voice, "voice-a", "model-a");
    expect(voiceConfigurationHash(voice, "voice-a", "model-a")).toBe(base);
    expect(voiceConfigurationHash(voice, "voice-b", "model-a")).not.toBe(base);
    expect(voiceConfigurationHash(voice, "voice-a", "model-b")).not.toBe(base);
  });
});

describe("pronunciation rules", () => {
  const entries = [
    entry({ term: "KYC" }),
    entry({ term: "Iker", status: "pending", alias: "my-AH-za" }),
    entry({ term: "AML", alias: "A M L" }),
  ];

  it("finds only whole-word uses of a term", () => {
    expect(termsUsedIn("Our KYC flow", entries).map((e) => e.term)).toEqual(["KYC"]);
    expect(termsUsedIn("A skyclad idea", entries)).toEqual([]);
  });

  it("never applies a pending rule", () => {
    expect(activeRules("Iker handles KYC", entries).map((e) => e.term)).toEqual(["KYC"]);
    expect(applyAliases("Iker handles KYC.", entries)).toBe("Iker handles K Y C.");
  });

  it("leaves text without known terms untouched", () => {
    expect(applyAliases("Nothing special here.", entries)).toBe("Nothing special here.");
  });
});

describe("estimateSynthesisCost for eleven_v4", () => {
  it("costs one credit per character, as the provider's header showed", () => {
    expect(estimateSynthesisCost(["abcde"], "elevenlabs", "eleven_v4", null).credits).toBe(5);
  });
});

describe("estimateSynthesisCost", () => {
  it("costs one credit per character on the multilingual model", () => {
    expect(
      estimateSynthesisCost(["abcde", "fghij"], "elevenlabs", "eleven_multilingual_v2", null),
    ).toEqual({
      characters: 10,
      credits: 10,
      usd: null,
    });
  });

  it("costs half on flash models and rounds up", () => {
    expect(estimateSynthesisCost(["abc"], "elevenlabs", "eleven_flash_v2_5", null).credits).toBe(2);
  });

  it("uses the highest rate for an unknown model so estimates are never low", () => {
    expect(estimateSynthesisCost(["abcd"], "elevenlabs", "some_future_model", null).credits).toBe(
      4,
    );
  });

  it("gives a money figure only when a price is configured", () => {
    expect(
      estimateSynthesisCost(
        [Array(1000).fill("a").join("")],
        "elevenlabs",
        "eleven_multilingual_v2",
        0.3,
      ).usd,
    ).toBeCloseTo(0.3);
  });

  it("is free for offline stand-in voices", () => {
    expect(estimateSynthesisCost(["abc"], "system", "macos-say", 0.3)).toEqual({
      characters: 3,
      credits: 0,
      usd: 0,
    });
  });
});

describe("splitSpeed", () => {
  it("lets the API do the whole pace up to its limit", () => {
    expect(splitSpeed(1.15, true)).toEqual({ provider: 1.15, stretch: 1 });
    expect(splitSpeed(PROVIDER_MAX_SPEED, true)).toEqual({
      provider: PROVIDER_MAX_SPEED,
      stretch: 1,
    });
  });

  it("stretches the clip for the rest of a pace above the API's limit", () => {
    const { provider, stretch } = splitSpeed(MAX_SPEED, true);
    expect(provider).toBe(PROVIDER_MAX_SPEED);
    expect(provider * stretch).toBeCloseTo(MAX_SPEED, 10);
  });

  it("stretches the whole pace on a model with no speed control", () => {
    expect(splitSpeed(1.5, false)).toEqual({ provider: 1, stretch: 1.5 });
  });

  it("accepts paces up to 2 in the voice settings and no further", () => {
    expect(VoiceSettingsSchema.shape.speed.safeParse(2).success).toBe(true);
    expect(VoiceSettingsSchema.shape.speed.safeParse(2.01).success).toBe(false);
  });
});
