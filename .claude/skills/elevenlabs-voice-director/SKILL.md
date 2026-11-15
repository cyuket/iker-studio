---
name: elevenlabs-voice-director
description: >-
  Directs narration for an Iker Video Studio video so it sounds like a person who understands
  the subject: voice-optimised wording and direction in voice-direction.json, presets, short
  auditions with a measured comparison, the human choice and approval gates, the pronunciation
  list/set/approve workflow, dry-run cost checks, caching, per-clip measurement, and generating
  or regenerating clips with `pnpm studio narrate`. Use when narration sounds artificial, when
  choosing or changing a voice or preset, writing spoken wording or pauses, checking how a
  product term is spoken, estimating or reducing ElevenLabs cost, generating or regenerating
  narration, or when narration is blocked or a clip sounds wrong.
argument-hint: "[video-id]"
---

# ElevenLabs voice director

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

Full reference: `docs/VOICE.md` (audit, capability table with sources, presets, file format,
pause categories, what is measured and what needs ears).

## Responsibilities

- Make the narration sound like an experienced person explaining, not a script being read:
  wording for the ear, a delivery per scene, pauses where a thought lands.
- Get every narrated scene a clip in the chosen performance, spending as few credits as
  possible.
- Keep three human gates intact: a person approves the script and the spoken wording, a
  person chooses the performance after listening, a person approves pronunciations.
- State clearly when narration is a stand-in voice and not production output.

**You cannot hear audio.** Never describe how a clip sounds, never rank samples by
naturalness, never mark a pronunciation approved. Measure what can be measured, say what
the numbers do and do not show, give the human the file paths and wait.

## Required inputs

- A validated storyboard (`pnpm studio storyboard --video <id>`).
- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env` (`ELEVENLABS_MODEL_ID` defaults
  to `eleven_multilingual_v2` when empty). No ElevenLabs credentials are configured for Iker
  yet: until they are, narration can only be the `system` or `silent` stand-in, and you must
  say so. A key may be allowed to synthesise without being allowed to read the subscription
  or the model list: never depend on those endpoints, and never print the key.
- The audience: Nigerian service-business owners. Choose a calm, clear English voice that
  sounds trustworthy and unhurried (see `iker-house-style`); the human makes the choice.
- For full narration: the script and the voice direction approved by a person in their
  current form, and a recorded voice choice.

## What the model can do

Run `pnpm studio voice models` before assuming anything; `--model <id>` prints the
evidence for one model. On `eleven_v4`, for example:

- Only **stability** and **similarity** are honoured. There is no speed and no style. Do not
  promise a slower or faster read from a setting.
- Delivery tags in square brackets are supported. SSML `<break>` is **not**: never send it.
- Pauses come from tags, punctuation and paragraph structure. A pause length is a request,
  not a guarantee; the audition report shows what came out.
- Capitalising a word increases its emphasis.
- Neighbouring text is accepted as context.
- Tags are billed and come back in the timings; the engine removes them, so captions and
  stored words are always the plain spoken words.

All of this is encoded in `src/domain/voice-models.ts`. Change behaviour there, with a
source and a date, never with an `if` somewhere else.

## Expected outputs

- `output/<id>/voice-direction.json`: spoken wording and direction, hand-authored.
- `output/<id>/review/voice/direction.md` and `.html`: each line with its direction.
- `output/<id>/review/voice/audition.html`, `.md`, `.json` and
  `output/<id>/audio/auditions/<scene>-<preset>.mp3`, plus `<scene>-before.mp3`.
- `output/<id>/review/voice/composition-pauses.json`: lead-in and tail silence per scene for
  the storyboard owner. You do not edit `storyboard.json`.
- `output/<id>/review/voice/clips.md`: per-clip measurements.
- `output/<id>/audio/<scene-id>.mp3` and `.words.json` per narrated, enabled scene.
- Manifest: `voice.preset`, `voice.finishing`, `voiceSelection`,
  `approvals.script.voiceDirectionHash`, `assets.narration.<scene>` (with `preset`,
  `spokenHash`, `loudness` on performed clips) and `usage` (`synthesisedCharacters`,
  `synthesisRequests`, `cacheHits`, `generatedSeconds`, `credits`, `regenerations`).

## Workflow

1. **Audit what exists.** `pnpm studio voice measure --video <id>` writes pace, pauses,
   loudness and edge levels per clip. Report facts as measured and causes as hypotheses.
2. **Draft the direction.** `pnpm studio voice direct --video <id>` writes a heuristic first
   pass. Then rewrite it by hand in `voice-direction.json`:
   - `spoken`: conversational, contractions, varied sentence length, numbers as words
     (`₦45,000` is spoken "forty-five thousand naira"), no corporate phrasing. Same meaning, every fact kept, **no new claim, number or name**.
     Plain words only: no brackets. `script.md` is never edited.
   - `delivery`: one of `neutral`, `curious`, `thoughtful`, `confident`, `revealing`, `calm`.
   - `emphasis`: at most a word or two per scene, where the point is.
   - `pauses`: `SHORT`, `MEDIUM`, `REVEAL` with `"after": "<words in spoken>"`;
     `TRANSITION` and `VISUAL_WAIT` with `"at": "start"` or `"end"`. Give each a `why`.
     A pause needs a reason in the narrative. Do not decorate.
3. **Check it.** `pnpm studio voice report --video <id>`. Fix every error. Read every
   warning: `new-words` lists words that appear nowhere in the script, and you must be able
   to say why each adds no claim.
4. **Cost first.** `pnpm studio voice audition --video <id> --dry-run` and
   `pnpm studio narrate --video <id> --dry-run --preset <preset>`. Tell the human the
   numbers before spending anything.
5. **Audition.** `pnpm studio voice audition --video <id>` generates the same passage in
   Natural Educator, Cinematic Storyteller and Technical Expert (about 1,000 credits for a
   300-character passage) and a free "before" sample from the existing narration. Give the
   human `review/voice/audition.html`. Summarise the measured table and say plainly that it
   does not rate naturalness.
6. **Stop.** The human listens and runs
   `pnpm studio voice select --video <id> --preset <preset>`. Do not run it for them: it
   records their name as the person who listened.
7. **Pronunciations.** `pnpm studio pronunciation list`. For every `pending` term the
   wording uses:
   - `pnpm studio preview-voice --video <id> --term "Iker"` and have the human listen.
   - If it is wrong: `pnpm studio pronunciation set --term "Iker" --alias "<respelling>"`
     (or `--ipa`, or `--clear`), then preview again. `set` returns the term to `pending`.
   - If it is right, the human runs `pnpm studio pronunciation approve --term "Iker"`.
     Never guess a brand-name pronunciation and never approve one yourself. No
     pronunciation of "Iker" is recorded in the product docs, so ask the team. The same goes
     for Nigerian place names and fictional client names a script uses.
8. **Approval.** The human reads `review/voice/direction.html` and runs
   `pnpm studio approve --video <id> --stage script`. That approval covers the script and
   the direction file together. Any later edit to either voids it.
9. **Generate.** `pnpm studio narrate --video <id> --dry-run`, then
   `pnpm studio narrate --video <id>`. Only `missing` clips are synthesised; progress is
   saved after every scene.
10. **Measure and hand over.** `pnpm studio voice measure --video <id>`. Pass
    `composition-pauses.json` to the storyboard owner, then hand over to `video-editor`.

## Fixing one scene

- Wording or direction: edit `voice-direction.json`, run `voice report`, ask the human to
  approve again, then `pnpm studio narrate --video <id>`. Only the changed scene is bought.
- Same wording, another take: `pnpm studio narrate --video <id> --scene <scene-id> --force`.
  It pays again and, because the seed is fixed, may return the same read. Change the
  direction instead when the delivery is the problem.
- A join that sounds wrong after a neighbour changed: `--force` the neighbour. Context is
  not part of the cache key.

## Rules

- A direction file takes effect only after `voice select`. Until then the video keeps its
  plain narration and existing clips stay valid. Drafting direction never costs credits.
- Voice, model and preset are fixed for a whole video. Never vary them by scene.
- Never add laughter, sighs, breaths or sound effects. The engine's tag vocabulary has none
  and rejects markup typed into `spoken`.
- A storyboard or design change never requires new narration. If the plan shows clips as
  missing after a visual change, something is wrong: stop and investigate.
- Compression is off by default. Turn `voice.finishing.compression` on only when a person
  hears a reason.
- No em dashes in spoken text or reports.

## Validation criteria

- `pnpm studio voice report --video <id>` prints `0 errors` and says the wording is covered
  by the current script approval.
- `pnpm studio narrate --video <id> --dry-run` shows every scene `current`.
- `output/<id>/audio/<scene>.words.json` contains no `[` or `<`.
- `pnpm studio voice measure --video <id>` shows no clipping and a loudness spread within
  the tolerance.
- `pnpm studio pronunciation list` shows `approved`, by a named person, for every term the
  wording uses. Otherwise report the pending ones: QA will warn about them.
- If the provider is not `elevenlabs`, repeat the CLI's stand-in note in your report.

## Failure handling

- `APPROVAL_REQUIRED` "Narration cannot be generated until the script is approved." Stop and
  ask the human.
- `APPROVAL_REQUIRED` "No voice performance has been chosen for this video." Run the
  audition and give the human the report. They run `voice select`.
- `APPROVAL_REQUIRED` "The spoken wording or voice direction changed after the script was
  approved." Run `voice report`, show the human what changed, they approve again.
- `APPROVAL_REQUIRED` "There is no audition sample for ..." The preset was never auditioned.
- `VALIDATION_FAILED` "voice-direction.json has N error(s)". Fix each listed scene.
  `new-number` and `new-name` mean the wording says something the script does not.
- `VALIDATION_FAILED` "Audition passages are limited to 400 characters." Lower
  `--max-characters`.
- `STAGE_BLOCKED` "The script changed after the storyboard was built." Run
  `pnpm studio script --video <id>` and `pnpm studio storyboard --video <id>`.
- `CONFIG_INVALID` "ElevenLabs rejected the API key." Check `ELEVENLABS_API_KEY`.
- `EXTERNAL_SERVICE` "ElevenLabs refused the request: the plan or quota does not allow it."
  Report it. Remaining credits cannot be read with this key.
- `EXTERNAL_SERVICE` "ElevenLabs rejected the request as invalid." Check the capability
  table for the model before changing any setting.
- `EXTERNAL_SERVICE` rate limit or network. Wait and rerun: finished clips are cached.
- `DEPENDENCY_MISSING` "The system voice needs macOS." Use `--voice-provider silent`.

## Relevant project commands

```
pnpm studio voice models [--model <id>]
pnpm studio voice presets --video <id>
pnpm studio voice direct --video <id>
pnpm studio voice report --video <id> [--preset <preset>]
pnpm studio voice audition --video <id> [--dry-run] [--scene <id>] [--presets <p...>]
pnpm studio voice select --video <id> --preset <preset>        (human only)
pnpm studio voice measure --video <id>
pnpm studio narrate --video <id> --dry-run [--preset <preset>]
pnpm studio narrate --video <id>
pnpm studio narrate --video <id> --scene <scene-id> --force
pnpm studio preview-voice --video <id> --term "<term>"
pnpm studio pronunciation list
pnpm studio costs --video <id>
```

Do not run `pnpm studio cache clean --narration --yes` unless the human asks: regenerating
that cache costs credits.
