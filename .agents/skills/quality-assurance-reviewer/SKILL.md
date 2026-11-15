---
name: quality-assurance-reviewer
description: >-
  Runs `pnpm studio qa` on rendered Iker Video Studio cuts, reads the report, explains every
  check, separates what software measured from what a person must judge by eye and ear, and
  prepares the human for the final approval without ever approving for them. Use after a preview
  or final render, when QA fails or warns, when someone asks "is this video ready", or before
  export.
argument-hint: "[video-id]"
---

# Quality assurance reviewer

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

## Responsibilities

- Run the automated checks and report each result with its evidence.
- Say precisely what was measured and what was not. Never claim that pacing, design, accuracy
  or pronunciation "passed": no tool here measures them.
- Route each failure to the skill that can fix its cause.
- Walk the human through the manual checklist. The approval is theirs alone.

## Required inputs

- A rendered cut: final (`pnpm studio render --video <id>`) for release review, or preview
  (`pnpm studio preview --video <id>`) for an early check.
- `output/<id>/research.md` and `script.md`, to check claims against sources.

## Expected outputs

Per cut, in `output/<id>/qa/<cut>-<quality>/` (rewritten on every run):

- `report.html`: the review page with the video, every check, the per-scene frames, the
  thumbnails and the approval checklist.
- `report.json`: `{ videoId, cutId, quality, summary: { passed, failures, warnings, manual }, checks }`.
- `contact-sheet.png` and `frames/NN-<scene>.png`: one frame per scene taken 60% through
  it, with the safe area outlined.

Manifest: `qa["<cut>/<quality>"]` with `subjectHash` (the SHA-256 of the checked file),
`passed`, `failures`, `warnings`, `report`. `stages.qa` becomes `completed` only when every
cut's current final render passed. A re-render changes the hash, so QA must run again.

## Workflow

1. `pnpm studio qa --video <id>` (final), or `pnpm studio qa --video <id> --quality preview`.
   One cut: add `--cut <cut-id>`. For exact data read `report.json`, or run
   `pnpm -s studio --json qa --video <id>`.
2. Report every check: id, status, and the detail lines. Use the table below.
3. Look at `contact-sheet.png` and the frames with the Read tool. Describe what you see
   (text crossing the outline, an empty scene, an unlabelled synthetic screen). A still shows
   one moment per scene. It does not show motion, timing or sound.
4. Compare `script.md` narration and on-screen text in `storyboard.json` with `research.md`:
   every factual statement needs a fact. Flag invented prices, plan limits, customer numbers
   or statistics; amounts not written as `₦45,000`; any feature the product facts list as not
   shipped (Google Calendar sync, quarterly or yearly reports, PDF statements, email
   campaigns, SMS or WhatsApp reminders, automated deposit collection); any claim that Iker
   prevents no-shows or collects payments; and any Platform Admin or Super Admin screen that
   shows a business's income, expenses or statements.
5. For each `fail`, name the cause and the owner (see Failure handling). After fixes the cut
   is rendered again and QA rerun. Do not reuse an old report.
6. For each `warn`, explain what it means for release. The human decides whether to accept it.
7. Give the human: the MP4 path, `report.html`, your findings, what you could not judge, and
   the manual checklist. Then stop. They approve with
   `pnpm studio approve --video <id> --stage final`, adding `--acknowledge-warnings` only if
   they read and accept the warnings. Never run this for them: `--by` defaults to their Git
   name, so it would record a review they did not do.

## The checks

Status `manual` is never counted as a pass.

| Check id                | Measured automatically                                                                                                                         | Still needs a person                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `missing-assets`        | every referenced narration, recording, screenshot and asset file exists (fail)                                                                 |                                                            |
| `video-metadata`        | H.264, yuv420p, AAC, MP4, expected frame rate, both streams present (fail)                                                                     |                                                            |
| `aspect-ratio`          | matches the format (fail)                                                                                                                      |                                                            |
| `resolution`            | matches the render settings (fail)                                                                                                             |                                                            |
| `black-frames`          | FFmpeg black-frame detection (fail)                                                                                                            | whether a dark scene is intended                           |
| `silence`               | silences over 3.5 s outside silent scenes (fail); recording outlasting narration (warn); whole track silent with the `silent` voice (warn)     | whether the pacing feels right                             |
| `audio-levels`          | true peak above -1.0 dBTP (fail); more than 1.5 LU from -14 LUFS (warn)                                                                        | voice quality, mix balance with music                      |
| `narration-overflow`    | narration fits inside each scene (fail)                                                                                                        |                                                            |
| `subtitle-overflow`     | caption lines within the format's characters per line (fail)                                                                                   | captions match the speech and are readable                 |
| `safe-areas`            | nothing. Always `manual`: pixels are not analysed                                                                                              | text and key UI inside the outline on every frame          |
| `scene-transitions`     | scenes whose `animation.enter` is `none` (warn)                                                                                                | whether motion and transitions look good                   |
| `recordings`            | each recording is readable and at least 1 s (fail)                                                                                             | the footage shows the right thing                          |
| `duration`              | file length equals the timeline, within the platform limit (fail); outside the cut target (warn)                                               |                                                            |
| `branding`              | a logo is configured, a title, CTA or outro scene exists, no placeholder brand assets (warn)                                                   | the brand is used well                                     |
| `cta`                   | the cut has an enabled `CTA` scene (fail)                                                                                                      | the wording is right (`useiker.com`, approved CTA wording) |
| `script-approval`       | script approved in its current form and storyboard in sync (fail)                                                                              |                                                            |
| `sensitive-information` | secret patterns, configured secret values and personal-data patterns in script, storyboard, subtitles, metadata and recording timelines (fail) | **recorded pixels are not scanned**: look at every frame   |
| `footage-provenance`    | footage from a `synthetic` target, or from an `unverified` scenario (warn)                                                                     | the synthetic label is visible and the description says so |
| `voice-provenance`      | provider is not `elevenlabs`, caption timing is estimated, or a used term's pronunciation is `pending` (warn)                                  | pronunciation is actually correct                          |

With today's stand-ins (`system` or `silent` voice, `synthetic-*` scenarios, pending
pronunciations) `footage-provenance` and `voice-provenance` always warn. That is correct:
such a cut is a pipeline check and must be reported as one, not as a finished production video.

## Manual checklist

`MANUAL_REVIEW_CHECKLIST` in `src/domain/qa.ts`, shown at the end of `report.html`. The human
confirms each item. You can prepare evidence for some, and you cannot tick any:

1. I watched the whole video with sound on.
2. Narration is accurate, and every claim is supported by the research notes.
3. Pronunciation of product and brand names is correct.
4. Captions match the speech and are readable.
5. Product footage shows only demo or synthetic data: no real customer information.
6. Synthetic or simulated footage is clearly labelled on screen and in the description.
7. Text and key interface elements sit inside the safe area on every scene.
8. Pacing, motion and visual hierarchy meet the brand standard.
9. The title, thumbnail and description describe what the video actually shows.
10. Music and sound effects, if any, are licensed for this use.

You cannot hear the audio or watch motion. Say so for items 1, 3, 4 and 8.

## Validation criteria

- `pnpm studio qa --video <id>` exits 0 and prints, per cut,
  `Cut <id>: passed: 0 failures, N warnings, M to check by eye` and the report path.
- `pnpm studio status --video <id>` shows `QA: passed` or `passed, N warning(s)` against a
  `current` final render for every cut.
- Your report lists every warning and every manual item, and states what you did not verify.
- Done means "ready for human review", never "approved".

## Failure handling

- Exit 1 with `VALIDATION_FAILED` "QA found failures." The `FAIL` lines above it name the
  checks. Owners: `missing-assets`, `recordings` to `product-demo-recorder` or
  `elevenlabs-voice-director`; `video-metadata`, `resolution`, `aspect-ratio`, `duration`,
  `audio-levels`, `silence` to `video-editor`; `black-frames`, `narration-overflow` to
  `motion-graphics-designer` or `storyboard-designer`; `subtitle-overflow`, `cta`,
  `sensitive-information` in text to `technical-scriptwriter`; `script-approval` to the
  human (gate 1) after `pnpm studio storyboard --video <id>`.
- `STAGE_BLOCKED` "Cut ... has no final render to check." / "no preview render to check."
  Run `pnpm studio render --video <id>` or `pnpm studio preview --video <id>` first.
- `STAGE_BLOCKED` "Cut ... cannot be rendered yet. Missing: ...". Narration or a recording
  was removed after rendering. Regenerate it and render again.
- `NOT_FOUND` "There is no cut ...". Use a cut id from `pnpm studio status --video <id>`.
- At approval, `APPROVAL_REQUIRED` "has not been through QA since it was rendered" / "has N
  failing QA check(s)" / "has N QA warning(s)". These protect the gate. Rerun QA, fix, or let
  the human acknowledge. Never look for a way around them.
- Sensitive data visible in a frame: stop, tell the human, and have the scenario masked and
  retaken. Do not pass the files on.

## Relevant project commands

```
pnpm studio qa --video <id>
pnpm studio qa --video <id> --cut <cut-id> --quality preview
pnpm studio status --video <id>
pnpm studio plan --video <id>
pnpm studio pronunciation list
```
