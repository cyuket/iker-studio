import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  Logger,
  SpeechSynthesizer,
  SpeechUsage,
  SynthesisRequest,
  SynthesisResult,
} from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { hashOf } from "../../domain/hash";
import type { PronunciationEntry, VoiceSettings } from "../../domain/voice";
import { capabilitiesFor, type ModelCapabilities } from "../../domain/voice-models";
import { readJson, writeJsonAtomic } from "../fs/atomic";

const API = "https://api.elevenlabs.io";
/** Available on every plan. Higher bitrates need a paid tier and are opt-in. */
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});
const TimestampResponseSchema = z.object({
  audio_base64: z.string().min(1),
  alignment: AlignmentSchema.nullable().optional(),
});
const DictionaryResponseSchema = z.object({ id: z.string(), version_id: z.string() });
const SubscriptionSchema = z.object({
  character_count: z.number(),
  character_limit: z.number(),
  tier: z.string(),
});
const DictionaryCacheSchema = z.record(z.string(), DictionaryResponseSchema);

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}
export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 30_000 };

export interface ElevenLabsOptions {
  apiKey: string;
  defaultVoiceId: string;
  defaultModelId: string;
  /** An `mp3_*` output format the account's plan allows. */
  outputFormat?: string;
  /** File remembering which uploaded pronunciation dictionary matches which rule set. */
  dictionaryCacheFile: string;
  logger: Logger;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retry?: RetryPolicy;
}

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/** Delay before the next attempt: the server's Retry-After if given, else exponential. */
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  policy: RetryPolicy,
): number {
  const seconds = Number(retryAfter);
  if (retryAfter !== null && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, policy.maxDelayMs);
  }
  return Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
}

const ApiErrorSchema = z.union([
  z.object({ detail: z.union([z.string(), z.object({ message: z.string() })]) }),
  z.object({ message: z.string() }).transform((value) => ({ detail: value.message })),
]);

/** The provider's own error text, which never contains the key, shortened to one line. */
async function apiReason(response: Response): Promise<string | null> {
  const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;
  const { detail } = parsed.data;
  return (typeof detail === "string" ? detail : detail.message).replace(/\s+/g, " ").slice(0, 240);
}

function explain(status: number): { message: string; hint: string } {
  if (status === 401) {
    return {
      message: "ElevenLabs rejected the API key.",
      hint: "Check ELEVENLABS_API_KEY and that the key has text-to-speech permission.",
    };
  }
  if (status === 402 || status === 403) {
    return {
      message: "ElevenLabs refused the request: the plan or quota does not allow it.",
      hint: "Run `pnpm studio costs --video <id>` to see remaining characters.",
    };
  }
  if (status === 404) {
    return {
      message: "ElevenLabs could not find the voice or model.",
      hint: "Check ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID.",
    };
  }
  if (status === 422 || status === 400) {
    return {
      message: "ElevenLabs rejected the request as invalid.",
      hint: "A voice setting is probably out of range for this model.",
    };
  }
  if (status === 429) {
    return {
      message: "ElevenLabs rate limit reached and retries were exhausted.",
      hint: "Wait a minute and run the command again; finished scenes are cached.",
    };
  }
  return {
    message: `ElevenLabs returned HTTP ${status}.`,
    hint: "Retry later; finished scenes are cached.",
  };
}

/**
 * The settings object for a model: only what its capability entry says it honours. A
 * setting the model ignores is left out, so a request never implies control it lacks.
 */
export function voiceSettingsFor(
  voice: VoiceSettings,
  capabilities: ModelCapabilities,
): Record<string, number | boolean> {
  const honoured = capabilities.settings;
  return {
    ...(honoured.stability ? { stability: voice.stability } : {}),
    ...(honoured.similarityBoost ? { similarity_boost: voice.similarityBoost } : {}),
    ...(honoured.style ? { style: voice.style } : {}),
    ...(honoured.speed ? { speed: voice.speed } : {}),
    ...(honoured.speakerBoost ? { use_speaker_boost: voice.speakerBoost } : {}),
  };
}

/** Neighbouring text for continuity, only for models documented or observed to accept it. */
export function contextFor(
  request: Pick<SynthesisRequest, "previousText" | "nextText">,
  capabilities: ModelCapabilities,
): { previous_text?: string; next_text?: string } {
  if (!capabilities.contextText) return {};
  return {
    ...(request.previousText ? { previous_text: request.previousText } : {}),
    ...(request.nextText ? { next_text: request.nextText } : {}),
  };
}

export function createElevenLabsSynthesizer(options: ElevenLabsOptions): SpeechSynthesizer {
  const doFetch = options.fetch ?? fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const policy = options.retry ?? DEFAULT_RETRY;
  const log = options.logger.child({ component: "elevenlabs" });

  /** Sends a request, retrying rate limits and transient server errors with backoff. */
  const call = async (
    pathname: string,
    init: { method: string; body?: unknown },
  ): Promise<{ body: unknown; headers: Headers }> => {
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await doFetch(`${API}${pathname}`, {
          method: init.method,
          headers: { "xi-api-key": options.apiKey, "Content-Type": "application/json" },
          ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        });
      } catch (error) {
        if (attempt >= policy.maxAttempts) {
          throw new StudioError("EXTERNAL_SERVICE", "Could not reach ElevenLabs.", {
            hint: "Check the network connection and try again.",
            cause: error,
          });
        }
        await sleep(retryDelayMs(attempt, null, policy));
        continue;
      }
      if (response.ok)
        return { body: (await response.json()) as unknown, headers: response.headers };
      if (RETRYABLE.has(response.status) && attempt < policy.maxAttempts) {
        const delay = retryDelayMs(attempt, response.headers.get("retry-after"), policy);
        log.warn("ElevenLabs request will be retried", {
          status: response.status,
          attempt,
          delayMs: delay,
        });
        await sleep(delay);
        continue;
      }
      const { message, hint } = explain(response.status);
      // The provider's own explanation names the exact cause, which a status code cannot.
      const reason = await apiReason(response);
      throw new StudioError(
        response.status === 401 ? "CONFIG_INVALID" : "EXTERNAL_SERVICE",
        reason === null ? message : `${message} ElevenLabs said: ${reason}`,
        { hint },
      );
    }
  };

  /**
   * Uploads the rules as a pronunciation dictionary, once per distinct rule set. Using a
   * dictionary rather than rewriting the text keeps the returned timings aligned to the
   * script as written, which the captions depend on.
   */
  const dictionaryFor = async (
    rules: readonly PronunciationEntry[],
  ): Promise<z.infer<typeof DictionaryResponseSchema> | null> => {
    if (rules.length === 0) return null;
    const payload = rules.map((rule) =>
      rule.ipa !== null
        ? { type: "phoneme", string_to_replace: rule.term, phoneme: rule.ipa, alphabet: "ipa" }
        : { type: "alias", string_to_replace: rule.term, alias: rule.alias ?? rule.term },
    );
    const key = hashOf(payload);
    const cache = DictionaryCacheSchema.parse(
      await readJson(options.dictionaryCacheFile).catch(() => ({})),
    );
    const cached = cache[key];
    if (cached) return cached;
    const response = await call("/v1/pronunciation-dictionaries/add-from-rules", {
      method: "POST",
      body: { name: `iker-video-studio-${key.slice(0, 12)}`, rules: payload },
    });
    const created = DictionaryResponseSchema.parse(response.body);
    await writeJsonAtomic(options.dictionaryCacheFile, { ...cache, [key]: created });
    return created;
  };

  return {
    provider: "elevenlabs",

    resolveVoice(voice) {
      return {
        voiceId: voice.voiceId ?? options.defaultVoiceId,
        modelId: voice.modelId ?? options.defaultModelId,
      };
    },

    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      const dictionary = await dictionaryFor(request.rules);
      const { voice } = request;
      const capabilities = capabilitiesFor(request.modelId);
      if (request.text.length > capabilities.maxCharactersPerRequest) {
        throw new StudioError(
          "VALIDATION_FAILED",
          `This clip is ${request.text.length} characters; ${request.modelId} accepts ${capabilities.maxCharactersPerRequest} per request.`,
          { hint: "Split the scene in script.md." },
        );
      }
      const { body: raw, headers } = await call(
        `/v1/text-to-speech/${encodeURIComponent(request.voiceId)}/with-timestamps?output_format=${encodeURIComponent(options.outputFormat ?? DEFAULT_OUTPUT_FORMAT)}`,
        {
          method: "POST",
          body: {
            text: request.text,
            model_id: request.modelId,
            seed: voice.seed,
            ...(voice.languageCode === null ? {} : { language_code: voice.languageCode }),
            voice_settings: voiceSettingsFor(voice, capabilities),
            ...contextFor(request, capabilities),
            ...(dictionary
              ? {
                  pronunciation_dictionary_locators: [
                    {
                      pronunciation_dictionary_id: dictionary.id,
                      version_id: dictionary.version_id,
                    },
                  ],
                }
              : {}),
          },
        },
      );
      const parsed = TimestampResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new StudioError(
          "EXTERNAL_SERVICE",
          "ElevenLabs returned an unexpected response shape.",
        );
      }
      const file = `${request.outputBase}.mp3`;
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(parsed.data.audio_base64, "base64"));
      const alignment = parsed.data.alignment;
      const cost = Number(headers.get("character-cost"));
      const billedCredits =
        headers.get("character-cost") !== null && Number.isFinite(cost) ? cost : null;
      return {
        file,
        alignment: alignment
          ? {
              characters: alignment.characters,
              startSeconds: alignment.character_start_times_seconds,
              endSeconds: alignment.character_end_times_seconds,
            }
          : null,
        billedCharacters: request.text.length,
        // The provider states what it charged; markup characters are included in it.
        ...(billedCredits === null ? {} : { billedCredits }),
        requestId: headers.get("request-id"),
      };
    },

    async usage(): Promise<SpeechUsage | null> {
      // A key scoped to text-to-speech cannot read the subscription. That is a normal
      // setup, not an error: the account figures are simply unavailable.
      const response = await call("/v1/user/subscription", { method: "GET" }).catch(
        (error: unknown) => {
          log.debug("ElevenLabs account usage is unavailable", { reason: String(error) });
          return null;
        },
      );
      if (response === null) return null;
      const parsed = SubscriptionSchema.safeParse(response.body);
      if (!parsed.success) return null;
      return {
        charactersUsed: parsed.data.character_count,
        characterLimit: parsed.data.character_limit,
        tier: parsed.data.tier,
      };
    },
  };
}
