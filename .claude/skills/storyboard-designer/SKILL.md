---
name: storyboard-designer
description: >-
  Designs what each scene of an Iker Video Studio video shows by editing
  output/<id>/storyboard.json (visual kinds, annotations, focus regions, chapter titles, enabled
  scenes) and validating it with `pnpm studio storyboard`. Use after the script passes its checks,
  when a scene looks wrong or empty, when a scene must be disabled or reordered, or when a
  landscape scene needs recomposing for a 9:16 cut.
argument-hint: "[video-id]"
---

# Storyboard designer

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

## Responsibilities

- Choose the visual for every scene and fill its fields so the screen supports the narration.
- Keep on-screen text short, accurate, and consistent with `research.md`.
- Make portrait cuts work as portrait, not as shrunken landscape.
- Leave `script.md` as the owner of scene order, existence and narration.

## Required inputs

- A script that passed `pnpm studio script --video <id>` in its current form.
- `output/<id>/script.md` (read the `>` direction lines) and `output/<id>/research.md`.
- For product scenes: the scenario ids from `pnpm studio scenarios`.
- Schema: `src/domain/storyboard.ts`. Worked examples: `templates/*/demo/storyboard.json`.

## Expected outputs

- `output/<id>/storyboard.json`, valid against `StoryboardSchema`.
- `output/<id>/storyboard.html`, the preview page to show the human.
- Manifest: `stages.storyboard` `completed`, `storyboard.hash` and `storyboard.version`
  updated. A changed hash marks recording, voice and render stages pending.

## What you may edit

Per scene: `visual`, `cues`, `direction`, `enabled`, `visualInstructions`, `animation`,
`captions.enabled`, `audio.narrationVolume`, `lowerThird`, `chapterTitle`, `assets`. Per cut: `burnCaptions`,
`showProgress`, `music` (see `video-editor`).

Do not edit `narration`, `id`, `type`, `estimatedDurationSeconds`, `scriptHash`, `version`,
the scene order, or a cut's `format` and `targetSeconds`: the next sync overwrites them from
the script. To reorder, add, remove or reword a scene, change `script.md`, then run
`pnpm studio script --video <id>` and `pnpm studio storyboard --video <id>`. The sync keeps
the `visual` of every scene whose id survives, gives new scenes the template's visual (or a
plain default: `title` for INTRO, `cta` for CTA, `outro` for OUTRO, `statement` otherwise) and
drops scenes the script no longer has. Renaming a scene id therefore discards its visual.

## Visual kinds

`tone` is one of `neutral`, `primary`, `positive`, `warning`, `danger`. A region is
`{ x, y, width, height }` in fractions (0 to 1) of the recorded viewport.

| `kind`       | Fields                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`      | `headline` (required), `subhead`                                                                                                                                                                                                            |
| `statement`  | `headline` (required), `body`, `points` (up to 4 of `{ title, detail? }`), `tone` (default `neutral`)                                                                                                                                       |
| `steps`      | `heading` (required), `steps` (2 to 5 of `{ title, detail? }`)                                                                                                                                                                              |
| `product`    | `scenarioId` (required), `mode` `video` or `screenshot` (default `video`), `screenshot` (name of a screenshot step, for `screenshot` mode), `heading`, `annotations`, `focus` (region), `zoom` (default false), `showCursor` (default true) |
| `diagram`    | `nodes` (2 to 9 of `{ id, label, sublabel?, tone, column }`, `column` 0 to 4, left to right; nodes sharing a column stack), `edges` (`{ from, to, label?, tone }`), `heading`                                                               |
| `comparison` | `left` and `right`, each `{ title, points (1 to 4 strings), tone }`, `heading`                                                                                                                                                              |
| `code`       | `language`, `code` (both required), `heading`, `highlightLines` (1-based line numbers)                                                                                                                                                      |
| `data`       | `heading`, `series` (1 to 6 of `{ label, value, tone }`), `source`, `illustrative` (all required), `unit`                                                                                                                                   |
| `cta`        | `headline`, `action`, `url` (all required)                                                                                                                                                                                                  |
| `outro`      | `tagline`                                                                                                                                                                                                                                   |
| `chapter`    | `title` (required)                                                                                                                                                                                                                          |

Motion graphic kinds, each data-driven and timed by cues. Fields, cue hooks and a JSON
example for every one are in `docs/MOTION-DESIGN.md`:

| `kind`           | Shows                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `identity-story` | People as cards: fields fill in, differing details are picked out, cards sharing a face are joined. Rarely fits an Iker story |
| `network`        | Nodes and edges that draw themselves, a marked edge, a boundary around a cluster                                              |
| `pipeline`       | One object travelling through named stages to a result                                                                        |
| `decision`       | Signals feeding a rule that routes to outcomes, one path lighting up                                                          |
| `timeline`       | Events in order, with the flagged ones picked out                                                                             |
| `story`          | A few lines of type revealed with the voice (`disclosure`, `problem`, `outcome`)                                              |
| `transformation` | The same items before and after (`side-by-side` or `in-place`)                                                                |

`product` also takes `camera` (`follow`, `manual` or `static`, with `maxZoom` and `isolate`),
`footage` (`startCue`, `fromSeconds`, `anchors`) and `prelude` (a motion graphic that hands
over to the footage). See "Directed product footage" in `docs/MOTION-DESIGN.md`.

## Cues, direction and continuity

- `cues`: `[{ id, phrase, at: "start" | "end", offsetSeconds, occurrence }]`. `phrase` is
  consecutive words of that scene's narration; case and punctuation are ignored. Visuals say
  WHEN with `cue: "<id>"`. Every cue a visual uses must be defined in the scene's `cues` or
  listed in the visual's `settled`. Things that share a cue arrive one after another.
- Without cues a motion graphic still unfolds in order across the scene. Add cues where the
  timing has to land on a word.
- `direction`: `{ objective, representation, layout, motion, camera, transition, finalFrame }`,
  plain sentences for whoever reviews the scene. Never rendered. Write it before the visual.
- `animation.exit: "hold"` keeps the finished composition up at the end of a scene.
  `animation.enter: "hold"` opens on it. To continue a composition across a cut: end scene N
  with `exit: "hold"`, give scene N+1 the same visual data with `enter: "hold"` and
  `settled: [every cue id of scene N]`, then add scene N+1's own cues for what happens next.
  Leave about a second after scene N's last cue so everything has finished.
- Fictional people and businesses must be obviously fictional ("Ada Obi", "Demo Salon",
  `example.com` addresses). A face is a `face` seed: the same seed is the same glyph
  everywhere in the film. Money on screen is written as `₦45,000`.
- No small uppercase or monospace labels, no numbered markers. No figure nobody measured.
- Never draw a copy of the product UI. Illustration explains the idea; the product is footage.

Product annotations: `{ text, region, fromSeconds, toSeconds?, cue?, untilCue?, spotlight }`,
timed in seconds from the start of the scene, or by cue. Read `output/<id>/recordings/<scenario>/timeline.json` after
recording: each event has `startSeconds`, `endSeconds` and the element's `region`, so copy
regions and times from there instead of guessing. `showCursor` draws a cursor only on
`screenshot` scenes; a played recording already contains its own.

Scene `animation`: `enter` (`rise`, `fade`, `none`, `hold`), `exit` (`fade`, `hold`), `leadInSeconds` and `tailSeconds`
(silence before and after narration, 0 to 5), `minDurationSeconds`. A scene lasts as long as
its narration or, for `product` in `video` mode, the recording if that is longer.

## Workflow

1. `pnpm studio storyboard --video <id>` to create or sync the file. Open
   `output/<id>/storyboard.html`.
2. For each scene, read its narration and `visualInstructions`, then pick the kind that shows
   what is being said. Prefer a diagram, steps or comparison to a wall of text.
3. Write on-screen text: headline up to about 8 words, points as fragments. No em dashes, no
   banned marketing phrases, no claim the narration does not make. Use the product's own
   labels from `research.md`, and in `cta` the verified label and URL (Iker's site uses
   "Get started" at `useiker.com`). On-screen text is not linted, so check it against
   `research.md` yourself. Follow `iker-house-style`: obsidian ground, terracotta for one
   line or one shape, never a palette of accents.
4. `data` visuals need a real `source`. If the numbers are made up to illustrate a shape, set
   `illustrative: true`. Never chart a result Iker has not measured (time saved, fewer
   no-shows, revenue): none is published. A business's income or expenses in a chart are
   fictional demo figures and must be marked `illustrative: true`.
5. Product scenes: set `scenarioId` to an id in `pnpm studio scenarios`. A `synthetic-*`
   scenario shows the Demo Console fixture (a labelled stand-in for a booking business, not
   the Iker dashboard) and is labelled on screen automatically. `iker-*` scenarios are
   unverified until a green take has been watched. Never storyboard a Platform Admin or Super
   Admin screen that shows a business's income, expenses or statements: those roles never see
   them.
6. Set `chapterTitle` on the scenes that open a chapter. YouTube chapters are emitted only
   when at least three exist, each at least 10 seconds after the previous.
7. Recompose portrait cuts (`youtube-shorts`, `social-portrait`):
   - Give every `product` scene a `focus` region. In 9:16 the browser frame is fitted to the
     safe width and the focus region is repeated below it, magnified. Without `focus` the UI
     is too small to read on a phone.
   - Shorter text: the frame is narrow and captions are burned in at 24 characters per line.
     Prefer fewer points, fewer steps and a diagram with few columns (these are judgement
     calls, not schema limits), then check the result in a preview.
   - The safe area is tighter (220 top, 420 bottom, 150 right of 1080x1920).
8. Enable or disable scenes with the CLI, not by hand:
   `pnpm studio storyboard --video <id> --disable <scene-id>` and
   `pnpm studio storyboard --video <id> --enable <scene-id>`.
9. Run `pnpm studio storyboard --video <id>` after every manual edit. Open the preview and
   show it to the human together with the script at approval time.

## Validation criteria

- `pnpm studio storyboard --video <id>` exits 0, prints one `Cut <id> (<format>): N scenes,
about m:ss` line per cut and `Storyboard v<n> saved.`
- `pnpm studio plan --video <id>` prints `Storyboard:  v<n>, in sync`.
- Every `product` scene names a scenario listed by `pnpm studio scenarios`.
- Every cut still has an enabled `CTA` scene and at least one enabled scene.
- After recording and narration, `pnpm studio preview --video <id>` renders every scene and
  the frames look right (`video-editor`).

## Failure handling

- `STAGE_BLOCKED` "The script has changed since it was last checked." Run
  `pnpm studio script --video <id>` first.
- `VALIDATION_FAILED` "storyboard.json is invalid: ...". The message gives the JSON path and
  the rule (for example `steps` needs at least 2 items, `data` needs `source`). Fix that field.
- `VALIDATION_FAILED` "... is not valid JSON". A trailing comma or missing quote.
- `VALIDATION_FAILED` "The storyboard's cues do not match its narration: ...". Each line names
  the cut, the scene and the cue. Either the `phrase` is not consecutive words of that scene's
  narration (it quotes the narration), an `occurrence` is never reached, an id is defined
  twice, or a visual uses a cue that is neither in the scene's `cues` nor in its `settled`.
- Later, from `preview` or `render`: `VALIDATION_FAILED` "Scene ... has cues that match nothing
  in its narration". The narration was regenerated with different words. The message quotes
  what was said: change the phrases to match and run `pnpm studio storyboard --video <id>`.
- `NOT_FOUND` "There is no scene "<id>" in the storyboard." Wrong id passed to `--disable`
  or `--enable`. Scene ids are listed in `script.md`.
- Later, from `record`: `NOT_FOUND` "The storyboard refers to an unknown scenario". Fix
  `scenarioId`. From `render`: `NOT_FOUND` "Scene ... asks for screenshot ..., which the
  recording does not have". Use one of the names in the hint. `VALIDATION_FAILED` "Every
  scene in cut ... is disabled." Enable at least one.
- `STAGE_BLOCKED` "storyboard.json was edited since it was last validated." from any later
  command. Run `pnpm studio storyboard --video <id>`.

## Relevant project commands

```
pnpm studio storyboard --video <id>
pnpm studio storyboard --video <id> --disable <scene-id>
pnpm studio storyboard --video <id> --enable <scene-id>
pnpm studio scenarios
pnpm studio plan --video <id>
pnpm studio preview --video <id> --scene <scene-id>
```
