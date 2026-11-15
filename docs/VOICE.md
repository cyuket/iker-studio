# Voice

How narration is directed, auditioned, approved, generated and measured. The aim is a
narrator who sounds like a person who understands the subject, not a voice reading a script.

Read this with `docs/ARCHITECTURE.md` (layers, manifest, cache) and the
`elevenlabs-voice-director` skill (the step-by-step workflow).

One rule runs through all of it: **no software in this project can hear**. The engine
measures timing and level. Whether a delivery sounds natural is decided by a person
listening, and every report says so next to its numbers.

## Contents

1. [Why the engine works this way](#1-why-the-engine-works-this-way)
2. [Model capabilities](#2-model-capabilities)
3. [Presets](#3-presets)
4. [Voice direction file](#4-voice-direction-file)
5. [Pause categories and how they are rendered](#5-pause-categories-and-how-they-are-rendered)
6. [Spoken wording and its lint](#6-spoken-wording-and-its-lint)
7. [Approval](#7-approval)
8. [Auditions](#8-auditions)
9. [Consistency between clips](#9-consistency-between-clips)
10. [Audio finishing and measurement](#10-audio-finishing-and-measurement)
11. [Credits and caching](#11-credits-and-caching)
12. [Commands](#12-commands)
13. [What is measured and what needs ears](#13-what-is-measured-and-what-needs-ears)
14. [Code map](#14-code-map)

## 1. Why the engine works this way

No Iker narration has been generated yet: this repository has no ElevenLabs credentials
configured for Iker, so nothing in this document has been heard on an Iker script. The
engine's design comes from an audit of the plain engine, made on 2026-10-08 on a video for
the product this studio was first built for. What it found, in general terms:

- One request per scene with the text exactly as written, the same flat settings for every
  scene and no neighbouring text as context, so each clip was a cold start.
- Pace drifted from scene to scene inside one film, and pauses were short and uniform:
  nothing separated the turn of a scene from an ordinary full stop.
- Clips started on sound, and a few had a first 10 ms loud enough to click against silence.
- Clip loudness varied by a few LU, which a single programme-wide normaliser cannot fix.
- Style and speed were sent to a model that does not have them (see section 2).
- Provider word timings put word edges inside pauses, so pauses must be measured on the
  waveform, not from the timings.

Likely causes of an artificial read, none confirmable without listening: wording written
for the eye (full forms, colons, long stacked sentences), no context between clips, one
stability for every kind of scene, no pause hierarchy, and fixed joins around every scene.
Sections 3 to 10 are the response to each.

When the first Iker video is narrated, run `pnpm studio voice measure --video <id>` and
record what it shows here.

## 2. Model capabilities

The capability table is `src/domain/voice-models.ts`. It is the only place model-specific
behaviour is decided: which settings are sent, how a pause is written, whether context is
sent, how timings are cleaned. Print it with `pnpm studio voice models`, and the evidence
for one model with `pnpm studio voice models --model eleven_v4`.

Every entry carries its evidence: **documented** (the vendor's documentation, with URL and
date), **observed** (a real request on this account) or **assumed** (neither, so the engine
takes the cautious branch). All claims were checked on 2026-10-08. "Observed" entries were
observed on the ElevenLabs account the studio was first built with; recheck them on Iker's
account once it is configured.

### eleven_v4

| Capability                   | Value                          | Evidence   | Source                                                                                                                                                                                             |
| ---------------------------- | ------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings honoured            | stability, similarity only     | documented | [Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4): "Both variants use two voice settings: Stability and Similarity."                                          |
| Style, speed                 | not available                  | documented | Same page: "Style and Speed sliders are not available in Eleven v4, and SSML is not supported."                                                                                                    |
| Audio tags                   | supported                      | documented | [Best practices, Prompting Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices). "They're not perfect yet": a tag is a request, not a guarantee.             |
| SSML `<break>`               | not supported                  | documented | Same page: "Eleven v4 and Eleven v3 do not support SSML break tags. Use audio tags, punctuation (ellipses), and text structure to control pauses and pacing."                                      |
| Emphasis                     | capitalisation                 | documented | Same page: "Capitalization increases emphasis."                                                                                                                                                    |
| `previous_text`, `next_text` | accepted                       | observed   | HTTP 200 with both fields. The [API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps) documents them without naming models.                              |
| Request stitching            | supported                      | documented | [Stitching guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching): its samples use `eleven_v4`; "Request stitching is not available for the eleven_v3 model" |
| Characters per request       | 10,000                         | documented | [Models](https://elevenlabs.io/docs/overview/models), character limits table                                                                                                                       |
| Credits per character        | 1                              | observed   | Response header `character-cost: 40` for a 40-character request. The documentation publishes no rate for v4.                                                                                       |
| Tags in the alignment        | present, with near-zero length | observed   | `alignment.characters` contained all of `[curious] `, squeezed into the first 60 ms.                                                                                                               |
| Tags billed                  | yes                            | observed   | The 10 characters of the tag were part of the 40 billed.                                                                                                                                           |
| Pronunciation                | IPA in slashes, alias rules    | documented | Best practices: v4 reads `/ipa/` inline; SSML phoneme tags work only on `eleven_flash_v2`.                                                                                                         |
| `mp3_44100_192` output       | accepted on this account now   | observed   | The same probe request used it. The default stays `mp3_44100_128` so a plan change cannot break narration.                                                                                         |
| `request-id` response header | present                        | observed   | Stored in the cache entry for support queries. Ids expire after two hours, so the engine does not chain on them.                                                                                   |

Established only by observation, and worth rechecking if behaviour changes: context
acceptance, the credit rate, tags appearing in the alignment, tags being billed. Whether
context audibly improves continuity on v4 is **not** established: that needs ears.

### Other models

| Model                                  | Settings sent         | Tags | SSML break     | Context | Notes                                                                                             |
| -------------------------------------- | --------------------- | ---- | -------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `eleven_v3`                            | stability, similarity | yes  | no             | no      | Stitching documented as unavailable, so no context is sent. Settings are assumed, not documented. |
| `eleven_multilingual_v2`               | all five              | no   | yes, up to 3 s | yes     | A bracketed tag would be read aloud, so none is ever sent.                                        |
| `eleven_flash_v2_5`, `eleven_flash_v2` | all five              | no   | yes, up to 3 s | yes     | Half the credit rate (documented).                                                                |
| `eleven_turbo_v2_5`, `eleven_turbo_v2` | all five              | no   | yes, up to 3 s | yes     | Documented as functionally equivalent to the flash models.                                        |
| anything else                          | stability, similarity | no   | no             | no      | Plain text only. The worst outcome is a flatter read, never markup spoken aloud.                  |

On SSML models the engine uses at most four breaks per request. The documentation warns
that "too many break tags in a single generation can cause instability" without giving a
number, so four is this project's caution, not a vendor limit.

## 3. Presets

A preset is a named way of performing the same voice. `src/domain/voice-presets.ts`.
Similarity is 0.75 in all of them, so the narrator stays one person.

| Preset                  | Stability | Style direction (tag models) | Pause scale | MEDIUM pause | REVEAL pause    | Emphasis per scene | Style / speed (v2 models) |
| ----------------------- | --------- | ---------------------------- | ----------- | ------------ | --------------- | ------------------ | ------------------------- |
| `natural-educator`      | 0.45      | warm, conversational         | 1.0         | paragraph    | `[pause]`       | 1                  | 0.10 / 0.98               |
| `cinematic-storyteller` | 0.35      | quiet, measured narration    | 1.25        | `[pause]`    | `[long pause]`  | 2                  | 0.30 / 0.93               |
| `technical-expert`      | 0.60      | clear, precise, even pace    | 0.85        | paragraph    | paragraph       | 0                  | 0.00 / 1.00               |
| `product-walkthrough`   | 0.50      | friendly, practical          | 0.90        | paragraph    | `[short pause]` | 1                  | 0.05 / 1.02               |

What actually differs depends on the model, and reports only claim what applies:

- On `eleven_v4` the levers are stability, the style direction, and how pauses and emphasis
  are written. Speed and style do not exist there, so no preset claims a slower pace.
- On the v2 models the levers are stability, style, speed and timed breaks.

`pnpm studio voice presets --video <id>` prints the levers for the video's model.

The preset is stored in the manifest (`voice.preset`) and is part of every clip's cache key.
It is set only by `pnpm studio voice select`, which records who chose it and from which
audition (`voiceSelection`).

Style directions are kept to a few words on purpose: every character of a tag is billed, on
every clip.

## 4. Voice direction file

`output/<id>/voice-direction.json`, beside `script.md`. It is hand-authored: by a person, or
by Claude drafting for a person. The engine validates it and renders it; it never writes
creative direction on its own beyond the scaffold.

`script.md` is never edited by any of this. It stays the source of record.

```json
{
  "schemaVersion": 1,
  "videoId": "walk-in-part-payment",
  "author": "Claude Code, drafted for review by the owner. Not approved.",
  "pauseSeconds": {
    "NATURAL": 0.25,
    "SHORT": 0.4,
    "MEDIUM": 0.7,
    "REVEAL": 1.1,
    "TRANSITION": 0.8,
    "VISUAL_WAIT": 1.6
  },
  "scenes": {
    "hook": {
      "spoken": "A walk-in client sits down for braids. She pays part now, in cash, and says she'll send the rest on Friday. You nod. Friday comes. Did she pay? You scroll your chats. You check your notebook. Nothing's written down.",
      "intent": "Let a salon owner recognise an ordinary day, then notice the gap. No alarm: nothing went wrong, it just isn't recorded.",
      "delivery": "calm",
      "emphasis": ["written"],
      "pauses": [
        {
          "kind": "MEDIUM",
          "after": "the rest on Friday.",
          "why": "Time passes here. Friday is a new beat."
        },
        {
          "kind": "SHORT",
          "after": "You check your notebook.",
          "why": "End of the search before the turn."
        },
        {
          "kind": "REVEAL",
          "after": "Nothing's written down.",
          "why": "The point of the scene. Hold before explaining what to do."
        },
        {
          "kind": "TRANSITION",
          "at": "end",
          "why": "Leave the problem hanging before the walkthrough starts."
        }
      ]
    }
  }
}
```

| Field          | Meaning                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pauseSeconds` | Length of each pause category for this video. Defaults shown above.                                                                            |
| `spoken`       | The words to be said. Plain words only: brackets and angle brackets are rejected.                                                              |
| `intent`       | What the scene is for. For the reviewer and the director; not sent to the model.                                                               |
| `delivery`     | One of `neutral`, `curious`, `thoughtful`, `confident`, `revealing`, `calm`.                                                                   |
| `emphasis`     | Words from `spoken` that carry the point. More than three draws a warning.                                                                     |
| `pauses`       | Inline pauses name the words they follow with `after`. Composition pauses name an edge with `at`: `start` or `end`. `why` is for the reviewer. |

A scene with no entry is spoken exactly as written in the script, in the preset's style.

`pnpm studio voice direct --video <id>` drafts the file from the script with transparent
heuristics: safe contractions, small numbers as words, a REVEAL after a contrast (", not"),
a MEDIUM after a question, a SHORT before a sentence that turns ("But", "So"), a
VISUAL_WAIT before demo scenes and a TRANSITION where the scene type changes. Each pause
states its reason so a director can disagree quickly. It refuses to overwrite an existing
file without `--force`.

`pnpm studio voice report --video <id>` validates the file, lints the wording and writes
`review/voice/direction.md` and `direction.html`: each scene with its script text, spoken
text, the exact text that will be sent to the model, and every pause with its target and
how it is rendered.

## 5. Pause categories and how they are rendered

The pause engine is `src/domain/voice-performance.ts`, a set of pure functions of the scene,
the preset and the model's capability entry.

| Category      | Default | Where it lives                            |
| ------------- | ------- | ----------------------------------------- |
| `NATURAL`     | 0.25 s  | In the text. Always left to punctuation.  |
| `SHORT`       | 0.40 s  | In the text.                              |
| `MEDIUM`      | 0.70 s  | In the text.                              |
| `REVEAL`      | 1.10 s  | In the text.                              |
| `TRANSITION`  | 0.80 s  | Silence at composition, around the scene. |
| `VISUAL_WAIT` | 1.60 s  | Silence at composition, around the scene. |

Inline pauses, by model:

- **SSML models** (`ssmlBreak`): `<break time="…s" />`, sized as the target minus the
  natural pause the punctuation already gives, capped at the documented 3 s, at most four
  per request. Anything beyond the limit becomes a paragraph break.
- **Tag models** (`audioTags`, including `eleven_v4`): whatever the preset says for that
  category: nothing, a paragraph break, or `[short pause]`, `[pause]`, `[long pause]`.
  Never SSML. Pause tags are capped per scene by the preset's density (per 100 words,
  rounded up); beyond it a pause falls back to a paragraph break and the report says so.
- **Unknown models**: a paragraph break for MEDIUM and REVEAL, nothing else.

On tag models a pause length cannot be set, only asked for. The configured length is a
target, and the audition report shows what came out next to what was asked.

`TRANSITION` and `VISUAL_WAIT` are never written into the text and never spliced into a
phrase. They become the scene's lead-in and tail silence. The engine reports the values and
writes them to `review/voice/composition-pauses.json`; the storyboard owner applies them to
`animation.leadInSeconds` and `animation.tailSeconds`. The voice engine does not edit
`storyboard.json`.

### Delivery tags

On tag models each clip opens with one tag: the preset's style plus the scene's delivery,
for example `[warm, conversational, calm]`. That is the only delivery tag in a clip. The
vocabulary is fixed in code and contains no laughter, sighs, breaths or other non-verbal
sounds; a test enforces it. A director cannot add tags: markup typed into `spoken` is a
validation error.

### Emphasis

On models that document it (`eleven_v4`, `eleven_v3`) an emphasised word is capitalised, up
to the preset's limit per scene. Words shorter than four letters are left alone, because a
short capitalised word can be read as initials. On other models emphasis is recorded and
not marked up, and the report says so.

### Word timings stay clean

The engine keeps a map from every character it sends to the plain spoken text. When the
provider's alignment comes back, inserted characters are dropped and capitalised words get
their original spelling back (`plainAlignment`). `audio/<scene>.words.json` therefore holds
the plain spoken words with their real times. Captions and visual beats that match phrases
against stored words never see a tag. If a provider ever returns text that does not match
what was sent, markup is still removed by pattern.

## 6. Spoken wording and its lint

The spoken text may sound different from the script. It may not say anything the script
does not. `src/domain/voice-spoken.ts` checks every directed scene:

| Rule                                                                        | Severity              | Why                                                                            |
| --------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| `banned-phrase`, `placeholder`, `absolute-claim`, `quantified-claim`        | as in the script lint | The spoken text is run through `lintScript` itself, so the rules cannot drift. |
| `new-number`                                                                | error                 | A quantity absent from that scene of the script. "three" and "3" are equal.    |
| `new-name`                                                                  | error                 | A name, address or initialism the script does not contain.                     |
| `new-words`                                                                 | warning               | Content words found nowhere in the script, listed for a person to read.        |
| `corporate-phrase`, `dash`, `digits`, `written-for-the-eye`, `uncontracted` | warning               | Wording that reads like a brochure or does not read aloud.                     |
| `long-sentence`, `even-rhythm`, `length-changed`                            | warning               | Breath, rhythm, and a scene whose length moved by more than 25 percent.        |

Errors block approval, auditions and narration. Software can catch a new number or name. It
cannot judge whether a rewording changed the meaning: that is the reviewer's job, and the
report puts script and spoken text side by side for it.

Pronunciations: nothing here approves a pronunciation. "Iker", "Naira" and every product
term stay `pending` in `brand/pronunciations.json` until a person listens. Amounts are a
special case: ₦45,000 should be heard as "forty-five thousand naira". Write amounts in the
script as the product shows them, preview how the voice reads them, and add a pronunciation
rule if it reads them wrongly.

## 7. Approval

What is spoken must be what a person approved.

- `pnpm studio approve --video <id> --stage script` now records two hashes: the script's
  (`subjectHash`, as before) and the voice direction's (`voiceDirectionHash`: every spoken
  word, delivery, emphasis, pause and pause length).
- Editing `voice-direction.json` changes its hash and voids the approval, exactly as editing
  `script.md` does. `narrate` then stops with `APPROVAL_REQUIRED`.
- Direction with errors cannot be approved.
- An `--automated` approval still unlocks only the `system` and `silent` voices.
- A video without a direction file behaves exactly as before.

Three gates stand before paid full narration of a directed video, in this order:

1. The script is approved by a person in its current form.
2. A person recorded a voice choice with `voice select`, and it is the preset being narrated.
3. The approval covers the direction file as it is now.

## 8. Auditions

`pnpm studio voice audition --video <id>` speaks one short passage in several presets (and,
with `--voice-id`, several voices) so a person can choose by ear before the whole script is
bought.

- The passage is the first narrated scene's spoken text, cut at a sentence end to fit
  `--max-characters` (default 350, limit 400). `--scene <id>` picks another scene.
- Default presets: Natural Educator, Cinematic Storyteller, Technical Expert. At most six
  samples per run.
- Each sample is the same request full narration would make for that scene, so it is cached
  under the same key. If the passage is a whole scene, choosing that preset makes the scene
  free later.
- Samples: `audio/auditions/<scene>-<preset>.mp3`. A free "before" sample is cut from the
  narration the video already has: `audio/auditions/<scene>-before.mp3`.
- Reports: `review/voice/audition.html` (audio players, measured table, listening
  checklist), `audition.md`, `audition.json`.
- `--dry-run` shows the passage and the cost and generates nothing.
- Auditions work before approval, like previews. Wording that fails its lint is refused.
- An audition changes only the usage ledger. Narration assets, approvals and the voice
  settings are untouched.

The report measures duration, pace, pauses (count, total, longest), each directed pause
against its target, loudness, true peak, loudness range, edge silence, clipping, and sound
before the first word. It does **not** score naturalness. It says so at the top and gives
the listener a checklist instead.

`pnpm studio voice select --video <id> --preset <preset>` records the choice. It refuses a
preset that is not in the latest audition, so nobody selects a delivery nobody heard. It is
a human action: it records the name from `git user.name` or `--by`. Claude does not run it.

From that moment the video is planned with the chosen preset and its direction file, and
every clip shows as due for regeneration.

## 9. Consistency between clips

- One clip per scene is kept, so a single scene can be regenerated on its own.
- Voice, model and preset are fixed for a whole video: they come from the manifest, never
  from a scene.
- For performed narration the spoken text of the previous and next scene is sent as
  `previous_text` and `next_text` where the capability table allows it. Context is not part
  of the cache key (see section 11).
- Request-id stitching is not used. Ids expire after two hours, which does not fit a
  workflow where one scene is regenerated days later.
- Joins: each clip is measured for leading and trailing silence and for the level of its
  first and last 10 ms. A fade of 8 ms is applied to an edge only when it measured louder
  than -50 dBFS (`finishing.edgeFade: "auto"`).

## 10. Audio finishing and measurement

Unchanged: the final mix still joins scenes and applies two-pass loudness normalisation to
-14 LUFS and -1.5 dBTP, and the optional music bed still ducks under speech and fades.

Added, for performed narration only (plain narration is placed byte for byte as generated):

- **Per-clip levelling.** Each clip is measured. If its integrated loudness is more than
  1 LU from the clip target (-23 LUFS), one fixed gain is applied, limited so the true peak
  stays below -2 dBTP. A fixed gain cannot pump. The cached original is never modified, so
  finishing can be redone free.
- **Compression** exists and is **off by default**: 2:1 above -18 dB, 20 ms attack, 250 ms
  release. Turn it on only if a person hears a reason.
- **Edge fades** only where measured, as above.
- The measured loudness and applied gain are stored on the narration asset (`loudness`).

Settings live in the manifest under `voice.finishing`:
`{ "level": true, "targetLufs": -23, "toleranceLu": 1, "compression": false, "edgeFade": "auto" }`.

`pnpm studio voice measure --video <id>` measures every clip the video has and writes
`review/voice/clips.md` and `clips.json`: duration, pace, pauses, loudness, true peak,
range, edge silence, clipping and loud edges, plus the loudness and pace spread across the
video. It changes nothing.

Levelled clips are re-encoded once to MP3 at 192 kbps. A clip already on target is not
re-encoded at all.

## 11. Credits and caching

- Clips are cached by content in `.cache/narration`. The key of a performed clip covers the
  spoken words, voice, model, preset, the rendered text (which carries the direction), the
  settings actually sent, and the pronunciation rules that touch the text.
- **Plain clips keep their original key**, so narration bought before presets existed is
  still current. A test pins the key of a real clip.
- Nothing visual is in the key. A storyboard, design or renderer change never asks for
  narration again.
- Neighbouring context is deliberately not in the key. It nudges prosody at the edges, and
  including it would make one edited scene re-bill both neighbours. If a join sounds wrong
  after an edit, regenerate the neighbour with `--force`.
- Finishing is not in the key: it is derived from the cached clip at no cost.
- Estimates come before generation: `narrate --dry-run`, `narrate --dry-run --preset <p>`
  (cost a preset before choosing it) and `voice audition --dry-run`. Estimates count the
  characters actually sent, tags included, because tags are billed.
- The ledger in the manifest (`usage`) records `synthesisedCharacters`, `synthesisRequests`,
  `cacheHits`, `generatedSeconds`, `credits` (the provider's own `character-cost` header
  when present, an estimate otherwise) and `regenerations` (paid requests for a scene that
  already had a clip). Auditions and previews are included.
- If the API key cannot read the subscription, remaining credits are not shown: `costs`
  leaves the account figures out instead of failing.

## 12. Commands

```
pnpm studio voice models [--model <id>]
pnpm studio voice presets --video <id>
pnpm studio voice direct --video <id> [--by <name>] [--force]
pnpm studio voice report --video <id> [--preset <preset>]
pnpm studio voice audition --video <id> [--scene <id>] [--presets <p...>] [--voice-id <id...>]
                           [--max-characters <n>] [--dry-run]
pnpm studio voice select --video <id> --preset <preset> [--voice-id <id>] [--by <name>] [--note <text>]
pnpm studio voice measure --video <id>

pnpm studio narrate --video <id> --dry-run [--preset <preset>]
pnpm studio narrate --video <id> [--scene <id...>] [--force]
pnpm studio preview-voice --video <id> [--text <text>] [--term <term>] [--dry-run]
```

The order for a new performance:

1. `voice direct`, then rewrite the wording and pauses by hand.
2. `voice report`, fix every error, read the warnings.
3. `voice audition`, then a person listens to `review/voice/audition.html`.
4. A person runs `voice select`.
5. A person reads `review/voice/direction.html` and runs `approve --stage script`.
6. `narrate --dry-run` for the cost, then `narrate`.
7. `voice measure`, then hand `composition-pauses.json` to the storyboard owner.

## 13. What is measured and what needs ears

| Software measures                                         | Only a listener can say                                    |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Duration, words per minute, articulation rate             | Whether the pace feels right                               |
| Where the audio is silent, and for how long               | Whether a pause feels natural, tense or awkward            |
| Whether a directed pause came out near its target         | Whether that pause was a good idea                         |
| Integrated loudness, true peak, loudness range, clipping  | Whether the voice sounds warm, flat, tired or strained     |
| Level of a clip's first and last 10 ms                    | Whether a join is actually audible                         |
| That there is sound before the first word                 | What that sound is: a breath, a noise or a voiced tag      |
| That a tag was sent, billed and removed from the captions | Whether the tag changed the delivery, and for the better   |
| That the spoken text adds no number or name               | Whether the rewording kept the meaning                     |
| That context was sent with a request                      | Whether continuity between scenes improved                 |
| Nothing                                                   | Whether "Iker", amounts and every product term sound right |

Known limits of the measurements: silence is anything below -42 dB for at least 0.12 s, so
a quiet breath counts as sound and a very soft word ending can count as silence. Word
timings come from the provider and are accurate to roughly a tenth of a second, less so
around pauses.

## 14. Code map

| File                                     | Holds                                                               |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `src/domain/voice-models.ts`             | Capability table with sources                                       |
| `src/domain/voice-presets.ts`            | The four presets, effective settings per model                      |
| `src/domain/voice-direction.ts`          | Direction schema, validation, hash, scaffolding heuristics          |
| `src/domain/voice-performance.ts`        | Pause and delivery rendering, alignment cleaning, pause measurement |
| `src/domain/voice-spoken.ts`             | Lint for the spoken wording                                         |
| `src/domain/voice-audio.ts`              | Measurement arithmetic and the finishing plan                       |
| `src/domain/voice.ts`                    | Voice settings, cache key, cost estimate                            |
| `src/application/voice-direction.ts`     | Load, check, scaffold, direction report                             |
| `src/application/voice-audition.ts`      | Auditions, comparison report, recording a choice                    |
| `src/application/voice-measure.ts`       | Per-clip measurement report                                         |
| `src/application/narration.ts`           | Plan, gates, synthesis, finishing, ledger                           |
| `src/application/approval.ts`            | Approval bound to script and direction                              |
| `src/infrastructure/voice/elevenlabs.ts` | Model-aware requests, context, billed credits                       |
| `src/infrastructure/media/ffmpeg.ts`     | `createAudioTools`: measure, finish, cut                            |
| `src/cli/commands/voice.ts`              | The `voice` commands                                                |
