/**
 * What each speech model can do, in one place. Every model-specific decision in the engine
 * (which settings are sent, how a pause is written, whether context is sent, how timings are
 * cleaned) reads this table, so supporting a new model is one entry here and nothing else.
 *
 * Each capability carries its evidence. `documented` means the vendor's documentation says
 * so at the given URL on the given date. `observed` means a real request on this account
 * showed it. `assumed` means neither, and the engine then takes the cautious branch.
 */

export type Evidence = "documented" | "observed" | "assumed";

export interface Claim {
  evidence: Evidence;
  /** Documentation URL, or a description of the request that was made. */
  source: string;
  /** Date the claim was checked, ISO 8601. */
  checked: string;
  note: string;
}

export type ModelFamily = "v4" | "v3" | "multilingual-v2" | "flash" | "unknown";

/** The request settings a model can be given. A setting the model ignores is never sent. */
export interface HonouredSettings {
  stability: boolean;
  similarityBoost: boolean;
  style: boolean;
  speed: boolean;
  speakerBoost: boolean;
}

export interface ModelCapabilities {
  modelId: string;
  family: ModelFamily;
  settings: HonouredSettings;
  /** Bracketed delivery tags such as `[curious]` are read as direction, not spoken. */
  audioTags: boolean;
  /** `<break time="0.7s" />` is supported. */
  ssmlBreak: boolean;
  /** Longest single SSML break, in seconds. 0 when breaks are unsupported. */
  maxBreakSeconds: number;
  /** Breaks per request before the vendor warns of instability. */
  maxBreaksPerRequest: number;
  /** Capitalising a word increases its emphasis. */
  emphasisByCapitals: boolean;
  /** `previous_text` and `next_text` are accepted as context. */
  contextText: boolean;
  /** `previous_request_ids` and `next_request_ids` are accepted. */
  requestStitching: boolean;
  maxCharactersPerRequest: number;
  creditsPerCharacter: number;
  /**
   * Whether markup characters come back in the character alignment. When they do, they
   * must be removed before words are built or a tag would become a caption word.
   */
  markupInAlignment: boolean;
  /** Markup characters count towards the bill. */
  markupBilled: boolean;
  claims: Record<string, Claim>;
}

const CHECKED = "2026-10-08";
const BEST_PRACTICES =
  "https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices";
const V4_PAGE = "https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4";
const MODELS_PAGE = "https://elevenlabs.io/docs/overview/models";
const STITCHING =
  "https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching";
const API_REFERENCE =
  "https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps";
const PROBE =
  "One 40-character request to /v1/text-to-speech/{voice}/with-timestamps with model eleven_v4, a leading [curious] tag, previous_text and next_text, on this account";

const documented = (source: string, note: string): Claim => ({
  evidence: "documented",
  source,
  checked: CHECKED,
  note,
});
const observed = (note: string): Claim => ({
  evidence: "observed",
  source: PROBE,
  checked: CHECKED,
  note,
});
const assumed = (note: string): Claim => ({
  evidence: "assumed",
  source: "none",
  checked: CHECKED,
  note,
});

const ALL_SETTINGS: HonouredSettings = {
  stability: true,
  similarityBoost: true,
  style: true,
  speed: true,
  speakerBoost: true,
};
const TWO_SETTINGS: HonouredSettings = {
  stability: true,
  similarityBoost: true,
  style: false,
  speed: false,
  speakerBoost: false,
};

const V4: ModelCapabilities = {
  modelId: "eleven_v4",
  family: "v4",
  settings: TWO_SETTINGS,
  audioTags: true,
  ssmlBreak: false,
  maxBreakSeconds: 0,
  maxBreaksPerRequest: 0,
  emphasisByCapitals: true,
  contextText: true,
  requestStitching: true,
  maxCharactersPerRequest: 10_000,
  creditsPerCharacter: 1,
  markupInAlignment: true,
  markupBilled: true,
  claims: {
    settings: documented(
      V4_PAGE,
      '"Both variants use two voice settings: Stability and Similarity." and "Style and Speed sliders are not available in Eleven v4, and SSML is not supported." The API still accepts style, speed and use_speaker_boost without an error (observed), so the engine simply stops sending them.',
    ),
    audioTags: documented(
      BEST_PRACTICES,
      'Section "Prompting Eleven v4": audio tags direct delivery. Listed: [laughs], [whispers], [sighs], [exhales], [sarcastic], [curious], [excited], [crying], [snorts], [mischievously]; the enhancement prompt adds [thoughtful], [short pause], [long pause]; examples use free descriptions such as [Quiet, measured narration] and [Brief pause]. "They\'re not perfect yet": tags are requests, not guarantees.',
    ),
    ssmlBreak: documented(
      BEST_PRACTICES,
      '"Eleven v4 and Eleven v3 do not support SSML break tags. Use audio tags, punctuation (ellipses), and text structure to control pauses and pacing."',
    ),
    emphasisByCapitals: documented(
      BEST_PRACTICES,
      '"Ellipses (...) add pauses and weight. Capitalization increases emphasis. Standard punctuation provides natural speech rhythm."',
    ),
    contextText: observed(
      "previous_text and next_text were accepted (HTTP 200). The API reference documents both fields without naming models. Whether they audibly improve continuity on v4 needs ears.",
    ),
    requestStitching: documented(
      STITCHING,
      'The guide\'s own code samples use model_id "eleven_v4", and it states "Request stitching is not available for the eleven_v3 model." Request ids expire after two hours, so the engine does not rely on them; it sends neighbouring text instead.',
    ),
    maxCharactersPerRequest: documented(MODELS_PAGE, "Character limits table: eleven_v4 10,000."),
    creditsPerCharacter: observed(
      "The response header character-cost was 40 for a 40-character request, so 1 credit per character. The documentation publishes no per-character rate for v4.",
    ),
    markupInAlignment: observed(
      "alignment.characters contained every character of \"[curious] \" with start and end times squeezed into the first 60 ms. The API reference describes alignment only as timing 'for each character in the original text'.",
    ),
    markupBilled: observed(
      "The 10 characters of the tag were included in character-cost (40 of 40), so tags are billed.",
    ),
    pronunciation: documented(
      BEST_PRACTICES,
      "v4 reads IPA wrapped in forward slashes; SSML phoneme tags work only on eleven_flash_v2. Alias rules in pronunciation dictionaries apply to every model.",
    ),
  },
};

const V3: ModelCapabilities = {
  modelId: "eleven_v3",
  family: "v3",
  settings: TWO_SETTINGS,
  audioTags: true,
  ssmlBreak: false,
  maxBreakSeconds: 0,
  maxBreaksPerRequest: 0,
  emphasisByCapitals: true,
  contextText: false,
  requestStitching: false,
  maxCharactersPerRequest: 5_000,
  creditsPerCharacter: 1,
  markupInAlignment: true,
  markupBilled: true,
  claims: {
    settings: assumed(
      "The current documentation does not list v3's settings. Only stability and similarity are sent, which every model accepts.",
    ),
    audioTags: documented(
      BEST_PRACTICES,
      '"The prompting techniques in Prompting Eleven v4 also apply to Eleven v3, including voice selection, audio tags, punctuation, and multi-speaker dialogue."',
    ),
    ssmlBreak: documented(
      BEST_PRACTICES,
      '"Eleven v4 and Eleven v3 do not support SSML break tags."',
    ),
    emphasisByCapitals: documented(BEST_PRACTICES, "Same punctuation guidance as v4."),
    contextText: assumed(
      "Not documented for v3, and stitching is documented as unavailable, so no context is sent.",
    ),
    requestStitching: documented(
      STITCHING,
      '"Request stitching is not available for the eleven_v3 model."',
    ),
    maxCharactersPerRequest: documented(MODELS_PAGE, "Character limits table: eleven_v3 5,000."),
    creditsPerCharacter: assumed("Costed at 1 credit per character, the highest standard rate."),
    markupInAlignment: assumed("Treated like v4: markup is stripped from timings if present."),
    markupBilled: assumed("Treated like v4."),
  },
};

function v2(
  modelId: string,
  family: ModelFamily,
  limit: number,
  credits: number,
): ModelCapabilities {
  return {
    modelId,
    family,
    settings: ALL_SETTINGS,
    audioTags: false,
    ssmlBreak: true,
    maxBreakSeconds: 3,
    maxBreaksPerRequest: 4,
    emphasisByCapitals: false,
    contextText: true,
    requestStitching: true,
    maxCharactersPerRequest: limit,
    creditsPerCharacter: credits,
    markupInAlignment: true,
    markupBilled: true,
    claims: {
      settings: documented(
        API_REFERENCE,
        "voice_settings documents stability, similarity_boost, style, use_speaker_boost and speed. Speed runs from 0.7 to 1.2 (best practices page).",
      ),
      audioTags: documented(
        BEST_PRACTICES,
        "Audio tags are described only for v4 and v3. A bracketed tag sent to this model would be read aloud, so none is ever sent.",
      ),
      ssmlBreak: documented(
        BEST_PRACTICES,
        '"Use <break time="x.xs" /> for natural pauses up to 3 seconds." and "Using too many break tags in a single generation can cause instability." The limit of four per request is this project\'s own caution, not a vendor number.',
      ),
      emphasisByCapitals: assumed(
        "Capitalisation as emphasis is documented for v4 only, so it is not used here.",
      ),
      contextText: documented(
        API_REFERENCE,
        'previous_text and next_text: "Can be used to improve the speech\'s continuity when concatenating together multiple generations".',
      ),
      requestStitching: documented(STITCHING, "Available on every plan; unavailable only on v3."),
      maxCharactersPerRequest: documented(MODELS_PAGE, `Character limits table: ${limit}.`),
      creditsPerCharacter:
        credits === 1
          ? assumed("1 credit per character, the standard rate.")
          : documented(MODELS_PAGE, '"50% lower price per character for API generations".'),
      markupInAlignment: assumed(
        "Not verified on this model. Markup is stripped from timings whenever it is present.",
      ),
      markupBilled: assumed("Assumed billed, so estimates are never too low."),
    },
  };
}

/**
 * A model nobody has checked. It gets plain text only: no tags, no SSML, no context, two
 * settings. The worst outcome is a flatter read, never markup spoken aloud.
 */
function unknownModel(modelId: string): ModelCapabilities {
  const note = "Unknown model: the engine sends plain text and the two universal settings.";
  return {
    modelId,
    family: "unknown",
    settings: TWO_SETTINGS,
    audioTags: false,
    ssmlBreak: false,
    maxBreakSeconds: 0,
    maxBreaksPerRequest: 0,
    emphasisByCapitals: false,
    contextText: false,
    requestStitching: false,
    maxCharactersPerRequest: 5_000,
    creditsPerCharacter: 1,
    markupInAlignment: true,
    markupBilled: true,
    claims: { all: assumed(note) },
  };
}

export const KNOWN_MODELS: readonly ModelCapabilities[] = [
  V4,
  V3,
  v2("eleven_multilingual_v2", "multilingual-v2", 10_000, 1),
  v2("eleven_flash_v2_5", "flash", 40_000, 0.5),
  v2("eleven_flash_v2", "flash", 30_000, 0.5),
  // Documented as functionally equivalent to the flash models of the same number.
  v2("eleven_turbo_v2_5", "flash", 40_000, 0.5),
  v2("eleven_turbo_v2", "flash", 30_000, 0.5),
];

export function capabilitiesFor(modelId: string): ModelCapabilities {
  return KNOWN_MODELS.find((model) => model.modelId === modelId) ?? unknownModel(modelId);
}

export function isKnownModel(modelId: string): boolean {
  return KNOWN_MODELS.some((model) => model.modelId === modelId);
}
