---
name: video-editor
description: >-
  Assembles Iker Video Studio cuts with `pnpm studio preview` and `pnpm studio render`: fast
  previews, final renders, re-rendering single scenes, knowing what each kind of change
  invalidates, optional licensed music, loudness, thumbnails and cache management. Use when it is
  time to see or render a video, after any change to script, voice, storyboard, scenario or
  styling, when a render is blocked or stale, or when disk caches need inspecting or cleaning.
argument-hint: "[video-id]"
---

# Video editor

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

## Responsibilities

- Turn the storyboard, narration and recordings into previews, then final deliverables.
- Do the least work: re-render only what a change invalidated, and say why.
- Keep audio at the loudness target and music optional, licensed and quiet.
- Never hand over a preview as a final, or stand-in material as finished.

## Required inputs

- A validated storyboard, narration for every narrated scene (`pnpm studio narrate`) and a
  recording for every product scene (`pnpm studio record`).
- `pnpm studio doctor` passing (FFmpeg with libx264, browsers installed).

## Expected outputs

| What             | Where                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Scene segments   | `output/<id>/scenes/<cut>/<quality>/<scene>.<ext>`                 |
| Timeline per cut | `output/<id>/scenes/<cut>/timeline.json`                           |
| Subtitles        | `output/<id>/subtitles/<cut>.srt` and `.vtt`                       |
| Preview cut      | `output/<id>/preview/<id>-<cut>.mp4` (half resolution)             |
| Final cut        | `output/<id>/final/<id>-<cut>.mp4`                                 |
| Thumbnails       | `output/<id>/thumbnails/statement.png`, `split.png`, `product.png` |

Manifest: `assets.sceneRenders["<cut>/<quality>/<scene>"]`, `assets.finals["<cut>/<quality>"]`
(with the file's `sha256`), `assets.thumbnails`. The stages `motion`, `composition`,
`subtitles` and `render` become `completed` only after a whole-video run (no `--cut`, no
`--scene`), and `render` only at final quality. A new final file has a new `sha256`, which
voids that cut's QA result and final approval.

## Preview versus final

- **Preview**: `pnpm studio preview --video <id>`. Half resolution, CRF 28, fast. For
  checking content, timing and layout. It can go through QA
  (`pnpm studio qa --video <id> --quality preview`) but can never be approved or exported.
- **Remotion Studio**: `pnpm studio preview --video <id> --studio` opens one cut for
  frame-by-frame review (`--cut <cut-id>` picks it; choose the "Cut" composition; Ctrl+C
  stops it). It blocks the terminal, so start it only when the human wants to scrub.
- **Final**: `pnpm studio render --video <id>`. Full resolution (`DEFAULT_RESOLUTION`), CRF
  18, plus the thumbnails unless `--skip-thumbnails`. Only this output is approved and
  exported. Render finals after the preview has been reviewed.

Scenes are rendered one segment each and joined by FFmpeg with hard cuts, so a scene whose
inputs did not change is reused.

## What invalidates what

`pnpm studio plan --video <id>` is the authority: it lists stale narration, recordings and
scenes (`pnpm studio plan --video <id> --quality preview` for previews).

| Change                                                    | Must be redone                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `script.md` text                                          | script check, storyboard sync, **script approval**, narration of the changed scenes, their scene renders |
| Voice provider, voice, model or a voice setting           | all narration, then every narrated scene                                                                 |
| An approved pronunciation rule                            | narration and scenes that contain the term                                                               |
| Styling: `src/remotion/**`, `brand/brand.json`            | every scene render. Narration and recordings are reused                                                  |
| One scene's `visual` or `animation` in `storyboard.json`  | that scene only (after `pnpm studio storyboard --video <id>`)                                            |
| One scenario, the fixture, or the demo origin and account | that recording, then the scenes that show it                                                             |
| `music`, or nothing but the join                          | the final file only. No scene re-renders                                                                 |

A changed scene duration shifts the progress bar of every scene in that cut, so with
`showProgress: true` a length change re-renders the whole cut.

## Publishing covers

Apply `iker-social-publishing` before finalizing covers for any destination. The complete
selected video title must be readable on each cover. The built-in landscape variants and
40-character headline field do not guarantee compliance for portrait cuts or longer titles.
Prepare platform layouts and any needed in-video title frame before final approval. Do not
patch an approved MP4 or silently shorten its cover title to fit a publisher.

## Workflow

1. `pnpm studio plan --video <id> --quality preview`. If anything upstream is listed (script,
   storyboard, voice, recording), send it to the owning skill first.
2. `pnpm studio preview --video <id>`. Read the output: `Scenes rendered: N   reused: M`.
3. Review. Extract frames with `pnpm studio qa --video <id> --quality preview` and read
   `output/<id>/qa/<cut>-preview/contact-sheet.png`. Give the human the MP4 path to watch.
4. Fix and iterate on single scenes:
   `pnpm studio preview --video <id> --cut <cut-id> --scene <scene-id>`. The cut is rebuilt
   from segments, so every other scene must already have a current render.
5. When the human is content with the preview: `pnpm studio render --video <id>`.
   One cut: `pnpm studio render --video <id> --cut <cut-id>`. One scene of a final:
   `pnpm studio render --video <id> --scene <scene-id>`. Rebuild regardless of hashes:
   `pnpm studio render --video <id> --force` (rarely needed).
6. Thumbnails alone: `pnpm studio thumbnails --video <id>`, or with `--force` to redo them.
   The `product` variant uses a screenshot from the first recording and carries the
   synthetic label when that recording is synthetic.
7. Hand over to `quality-assurance-reviewer`: `pnpm studio qa --video <id>`.

## Music and loudness

- Every cut gets a music bed from `assets/music/` by default (house style section 6). Use
  `"music": null` only when the owner asks for none. Sound effects are per scene (`sounds`), with
  files from `assets/sfx/` (see `assets/sfx/README.md`).
- A track must be licensed for this use. Put the file in `assets/music/` (create the
  directory; MP3 files there are tracked by Git) and set, on the cut in `storyboard.json`:
  `"music": { "file": "<name>.mp3", "volume": 0.12, "licence": "<licence, source and holder>" }`.
  `licence` is required by the schema. If you cannot state the licence, do not add the track.
  Then run `pnpm studio storyboard --video <id>` and render.
- The bed is looped, trimmed to the narration and mixed under it. Keep `volume` near the 0.12
  default so speech stays clear.
- Every assembled cut is normalised to -14 LUFS integrated, -1.5 dBTP true peak, loudness
  range 11 (`LOUDNESS_TARGET`). QA fails above -1.0 dBTP and warns beyond 1.5 LU off target.
  Do not compensate with `audio.narrationVolume`.

## Caches

- `pnpm studio cache inspect` shows the narration cache, scene renders and renderer bundle,
  their size, and what deleting each costs.
- `pnpm studio cache clean --renders --yes` deletes scene segments (costs render time only).
  `pnpm studio cache clean --bundle --yes` deletes the renderer bundle cache.
- `pnpm studio cache clean --narration --yes` deletes paid audio. Only when the human asks.
- Without `--yes` the command refuses and lists what it would delete.

## Validation criteria

- `pnpm studio render --video <id>` exits 0 and prints, per cut, the resolution, duration,
  `Scenes rendered: N   reused: M` and the file path under `final/`.
- `pnpm studio plan --video <id>` prints `Scenes:     0 of N to render` and its stage list
  starts at `qa` or later.
- `pnpm studio status --video <id>` shows `Final render: current` for every cut.
- Duration is inside the cut's target (QA `duration` check) and three thumbnails exist.

## Failure handling

- `STAGE_BLOCKED` "Cut ... cannot be rendered yet. Missing: - narration for scene ... -
  recording ...". Run the commands listed in the message, then render again.
- `STAGE_BLOCKED` "Scene ... of cut ... has no current render." A `--scene` run found other
  stale scenes. Run the same command without `--scene`.
- `STAGE_BLOCKED` "The script changed after the storyboard was built." / "storyboard.json was
  edited since it was last validated." Run `pnpm studio script --video <id>` and
  `pnpm studio storyboard --video <id>`.
- `RENDER_FAILED` "Rendering ... failed: ...". Reproduce with
  `pnpm studio preview --video <id> --studio`; component faults go to
  `motion-graphics-designer`. Finished scenes are checkpointed, so a rerun resumes.
- `RENDER_FAILED` "<file> has no video stream." / "Thumbnail ... is not 1280x720." Rerun with
  `--force`; if it repeats, run `pnpm studio doctor`.
- `NOT_FOUND` "Music file ... is not in assets/music." Add the file or set `music` to `null`.
- `NOT_FOUND` "There is no cut ...". Use a cut id from the hint.
- `VALIDATION_FAILED` "Every scene in cut ... is disabled." Enable one with
  `pnpm studio storyboard --video <id> --enable <scene-id>`.
- `DEPENDENCY_MISSING` "ffmpeg is not installed or not on PATH." Run `pnpm studio doctor`.

## Relevant project commands

```
pnpm studio plan --video <id>
pnpm studio preview --video <id>
pnpm studio preview --video <id> --cut <cut-id> --scene <scene-id>
pnpm studio render --video <id>
pnpm studio render --video <id> --quality preview --skip-thumbnails
pnpm studio thumbnails --video <id>
pnpm studio cache inspect
```
