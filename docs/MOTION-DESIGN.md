# Motion design

How the studio's motion graphics work, and how to direct them from `storyboard.json`. The
code lives in `src/remotion`; the storyboard fields are defined in `src/domain/storyboard.ts`.

## The principle

Every movement explains something: a relationship, a process, a decision, a transformation, a
consequence or a comparison. If a movement explains nothing it is removed. That rules out
particles, spinning icons, floating cards, glowing borders, slide transitions, constant
background motion, gratuitous zooms and fake 3D. Stillness is allowed and wanted. A viewer
with the sound off should still follow the story.

The one sanctioned exception is the animated background, which a cut opts into with
`"background": "animated"` in `storyboard.json` (the owner asked for it on 2026-11-15 for
social ads). Glows orbit slowly, the grid drifts and brand booking dots rise in the margins
outside the safe area, never behind text or footage. It is keyed to the frame of the cut
(`backdrop.startFrame` in the scene props plus the scene's frame), so it flows across hard
joins; reduced motion and the default `static` keep the still canvas. Like the progress bar,
it ties scenes to their position, so changing one scene's length re-renders those after it.
Its speeds are `MOTION.backdrop` and its geometry is `src/remotion/lib/backdrop.ts`.

The canvas is obsidian with terracotta as the one accent, set in Plus Jakarta Sans (with
JetBrains Mono for code only), all from `brand/brand.json`. Iker's personality is trustworthy,
calm and efficient, so restraint is the default: one accent, few moving things, long holds.

Three more rules follow from the product and from the owner:

- **No small labels.** No uppercase or monospace eyebrow, kicker, overline, tag or numbered
  "01 / 02" marker anywhere. Hierarchy comes from type size, weight, spacing and motion.
- **Illustration is never fake product.** Conceptual graphics are dark, flat and built from
  glyphs, so they cannot be mistaken for the dashboard, which is only ever shown as real
  footage. People are abstract face glyphs generated from a seed, or flat cartoon characters
  (`character-scene`) drawn from the same shapes, never photos. The same seed
  is literally the same drawing, so "the same client" is something the viewer can see.
- **No numbers nobody measured.** The score bar has no numerals. There are no booking,
  revenue or no-show figures to show, so none are drawn. An amount on screen is an obvious
  example written as the product writes it (₦45,000), never a statistic.

## The motion vocabulary

All timing, easing, springs, distances and scale ranges are tokens in `MOTION`
(`src/remotion/design/tokens.ts`). Components read them through `useMotion()`
(`design/useBeat.ts`) or the helpers in `design/motion.ts` (`tween`, `springProgress`,
`durationFrames`). A number that is not in this table does not belong in a component.

| Token                  | Value                               | Used for                                                             |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `duration.quick`       | 0.2 s                               | A state flipping in place: a colour, a mark                          |
| `duration.enter`       | 0.6 s                               | Something arriving on screen                                         |
| `duration.exit`        | 0.33 s                              | The scene's content leaving                                          |
| `duration.emphasis`    | 0.4 s                               | Picking something out: a differing field, a chosen path              |
| `duration.move`        | 0.8 s                               | An object travelling between two resting places                      |
| `duration.draw`        | 0.7 s                               | A connector drawing itself                                           |
| `duration.signal`      | 0.9 s                               | A pulse travelling along a connector                                 |
| `duration.focus`       | 0.45 s                              | Everything but the subject stepping back                             |
| `duration.release`     | 0.3 s                               | The rest coming forward again                                        |
| `duration.camera`      | 1.2 s                               | One camera move over footage                                         |
| `duration.cameraMin`   | 0.6 s                               | No camera move is shorter than this                                  |
| `duration.handoff`     | 0.9 s                               | The transition: a motion graphic handing over to footage             |
| `easing.enter`         | `cubic-bezier(0.16, 1, 0.3, 1)`     | Everything that arrives (decelerating)                               |
| `easing.move`          | `cubic-bezier(0.65, 0, 0.35, 1)`    | Moves between two resting states (symmetric)                         |
| `easing.exit`          | `cubic-bezier(0.4, 0, 1, 1)`        | Everything that leaves (accelerating)                                |
| `easing.camera`        | `cubic-bezier(0.45, 0, 0.15, 1)`    | Camera moves: slow start, long settle                                |
| `spring.settle`        | mass 1, damping 26, stiffness 170   | Cards and panels coming to rest. Critically damped, no overshoot     |
| `spring.snap`          | mass 0.6, damping 19, stiffness 240 | A status mark being stamped. Overshoot under 6 percent               |
| `spring.glide`         | mass 1, damping 40, stiffness 90    | Large things changing size. Overdamped                               |
| `stagger.item`         | 0.12 s                              | Items of one list, and things that share a cue                       |
| `stagger.field`        | 0.09 s                              | Fields of one card                                                   |
| `stagger.auto`         | 0.5 s                               | Steps with no cue, placed after the last cued step                   |
| `distance.rise`        | 20 design px                        | Travel of an entrance                                                |
| `distance.nudge`       | 10 design px                        | Travel of a small entrance                                           |
| `scale.enterFrom`      | 0.94                                | Size something starts at when it scales in                           |
| `scale.emphasis`       | 1.08                                | Size of something picked out                                         |
| `scale.cameraMin`      | 1.2                                 | A camera move that would zoom less than this is not made             |
| `scale.detailMin`      | 1.04                                | Portrait detail panel follows the camera from this zoom up           |
| `scale.cameraMax`      | 2                                   | Default ceiling for camera zoom                                      |
| `scale.upscaleLimit`   | 2                                   | Footage is never enlarged beyond 2 output pixels per recorded pixel  |
| `focus.dim`            | 0.56                                | Opacity of the scrim over footage outside the focus region           |
| `focus.recede`         | 0.3                                 | Opacity illustration elements fall back to when not the subject      |
| `camera.leadSeconds`   | 0.35 s                              | The camera arrives this long before the action                       |
| `camera.holdSeconds`   | 0.8 s                               | A framing is held at least this long                                 |
| `camera.padding`       | 0.32                                | Space kept around the focus region, as a fraction of it              |
| `camera.groupMinZoom`  | 1.35                                | Consecutive actions share a framing while it can still zoom this far |
| `camera.farDistance`   | 0.42                                | Centres further apart than this make the camera pull back            |
| `camera.mergeDistance` | 0.05                                | Framings closer than this are the same framing                       |
| `character.breath*`    | 4.2 s, 3 design px                  | One breath of a cartoon character, and how far the shoulders rise    |
| `character.blink*`     | 0.14 s, every 3.2 s or more         | A blink; each character keeps a slow clock of their own              |
| `character.rest`       | 0.6 s                               | No idle movement this close to either end of a scene                 |
| `character.wave*`      | 3 swings of 0.42 s, 13 degrees      | A waving forearm, after which the hand stays up and still            |
| `motionBlur`           | off                                 | See below                                                            |

Motion blur is off by policy. The only native option, `@remotion/motion-blur`, renders each
frame several times and smears text in footage, and nothing here moves fast enough to need
it. The package is not installed.

Reduced motion (`manifest.render.reducedMotion`) keeps every opacity change and drops travel
and scaling. The camera cuts between framings instead of moving.

## Beats: animation driven by the narration

A scene declares **cues**. A cue names a moment by the words spoken at it:

```json
"cues": [
  { "id": "books", "phrase": "books a Saturday slot" },
  { "id": "proof", "phrase": "uploads proof of payment", "at": "end" },
  { "id": "second", "phrase": "books", "occurrence": 2, "offsetSeconds": -0.2 }
]
```

| Field           | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `id`            | Lowercase words joined by hyphens. Visuals refer to it                        |
| `phrase`        | Consecutive words of this scene's narration. Case and punctuation are ignored |
| `at`            | `start` (default) fires as the phrase begins, `end` as it finishes            |
| `offsetSeconds` | Shifts the moment, from -10 to 10. Negative leads the voice                   |
| `occurrence`    | Which occurrence of the phrase to use. Default 1                              |

`resolveBeats` (`src/domain/cues.ts`) turns cues into seconds from the start of the scene,
using the scene's stored word timings and its lead-in. The compiler does this for every scene
(`src/application/scene-compiler.ts`), includes the result in the scene's hash, and passes it
to the renderer as `beats` in `SceneRenderProps`. So when narration is regenerated the
animation follows the new timings, and only scenes whose beats moved are rendered again.

Validation happens twice, and neither guesses:

1. `pnpm studio storyboard` runs `cueProblems` on every scene. A phrase that is not in the
   narration, a duplicate id, or a visual that uses a cue the scene does not define fails with
   `VALIDATION_FAILED` naming the scene and the cue. `cueProblems(scene, spokenText)` takes the
   text to check against, so a voice direction that rewords the narration can be validated
   against what will actually be said.
2. At compile time, if a cue's phrase is not among the words that were spoken, `compileCut`
   fails with `VALIDATION_FAILED` naming the scene, the cue and the sentence on file.

A scene without narration has nothing to match, so its cues are spaced evenly across it.

In a component, `useBeat(id)` gives the frame of a cue, `useAfterBeat(id)` whether it has
fired, and `useBeatProgress(id, duration, easing)` an eased 0 to 1. Graphics use
`useMotion()`, whose `schedule()` gives every step of a sequence a start frame: a cued step
starts on its beat, and steps without a cue are spaced evenly between the cued steps around
them (`src/remotion/lib/schedule.ts`). So a visual with no cues at all still unfolds in order
across the scene, and adding cues pins it to the voice step by step.

Things that share a cue arrive one after another, `stagger.item` apart, in the order they are
listed.

The `direction` block is for people. It is never rendered:

```json
"direction": {
  "objective": "The viewer sees that the deposit is recorded but a balance is still owed.",
  "representation": "One booking moving along a track of statuses.",
  "layout": "Track left to right, the booking above it.",
  "motion": "Each status is reached on its word. The balance turns amber.",
  "camera": "None.",
  "transition": "Hold the last frame for the next scene.",
  "finalFrame": "Booked and deposit stamped green, balance owed in amber."
}
```

## Continuity across hard cuts

Scenes are rendered separately and joined with hard cuts. By default each scene opens and
closes on the bare background. Three fields let a composition carry across a cut instead:

- `animation.exit: "hold"` keeps the finished composition on screen to the last frame.
- `animation.enter: "hold"` opens on the finished composition: nothing arrives.
- `settled: [...]` on a motion graphic lists the cue ids that are already complete on frame 0.

Scene N ends holding. Scene N+1 uses the same visual data, lists scene N's cues as `settled`,
and adds its own cues for what happens next:

```json
{
  "id": "hook",
  "cues": [
    { "id": "booked", "phrase": "Tunde books a haircut" },
    { "id": "deposit", "phrase": "pays a deposit" },
    { "id": "owed", "phrase": "the rest on the day" }
  ],
  "animation": { "exit": "hold" },
  "visual": {
    "kind": "timeline",
    "events": [
      { "label": "Tunde books a haircut", "time": "Monday", "cue": "booked" },
      { "label": "Deposit paid", "time": "Monday", "tone": "positive", "cue": "deposit" },
      { "label": "Balance due", "time": "Saturday", "flagged": true, "cue": "owed" }
    ]
  }
},
{
  "id": "gap",
  "cues": [{ "id": "flag", "phrase": "where is that written down" }],
  "animation": { "enter": "hold" },
  "visual": {
    "kind": "timeline",
    "settled": ["booked", "deposit", "owed"],
    "events": [
      { "label": "Tunde books a haircut", "time": "Monday", "cue": "booked" },
      { "label": "Deposit paid", "time": "Monday", "tone": "positive", "cue": "deposit" },
      { "label": "Balance due", "time": "Saturday", "flagged": true, "cue": "owed" }
    ],
    "flag": { "cue": "flag", "label": "Still owed" }
  }
}
```

The last frame of `hook` and the first frame of `gap` are the same picture. Rules that keep
that true:

- Everything in scene N must have finished before its last frame. Leave about a second after
  the last cue (`animation.tailSeconds`, or `minDurationSeconds`).
- Scene N+1 must lay out identically: same events, cards, fields, heading and gaps, and the
  same overlays. A scene with burned-in captions and one without have different content zones.
- A cue used by the visual must be defined in that scene's `cues` or listed in `settled`.
- Additions that are not yet visible, such as `flag` above, do not change the picture.

This is tested, not assumed. `tests/unit/remotion/continuity.test.ts` renders both frames of
the visual layer to markup in both formats and requires them to be identical, and a pixel
comparison of real renders is described under "Checking work".

Continuity inside one scene is the **handoff**, below.

## Directed product footage

Recordings are captured once, full frame. Camera moves are applied in composition, never in
the browser, so a recording can be reframed without recording it again.

### The virtual camera

```json
"camera": { "mode": "follow", "maxZoom": 2, "isolate": true }
```

| Field       | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `mode`      | `follow` (default), `manual` or `static`                                         |
| `maxZoom`   | 1 to 4, default 2. Also capped by `scale.upscaleLimit` so footage stays sharp    |
| `isolate`   | Dim everything outside the element in focus                                      |
| `keyframes` | Manual mode: `{ cue or atSeconds, region or null, zoom? }`. `null` is full frame |

**`follow`** derives the path from the recording's timeline (`cameraPath` in
`src/remotion/lib/camera.ts`):

- It looks at `click`, `type`, `select`, `highlight` and `verify` events that have a region.
  Waits, scrolls and masks are ignored.
- It arrives `camera.leadSeconds` before the action, holds, and stays while later actions fit
  the same framing (`camera.groupMinZoom`).
- It returns to the full frame on `navigate`. Between two subjects further apart than
  `camera.farDistance` it pulls back to the full frame and goes in again if there is time; if
  there is not, the move eases out half way instead of sliding sideways.
- It never exceeds `maxZoom`, never crops the focus region, never makes a move shorter than
  `duration.cameraMin`, and treats near-identical framings as one.
- An action that already fills the frame gets no move at all.

`follow` needs a played recording. On a `screenshot` scene it behaves as `static`; use
`manual` there.

**`manual`** takes its stops from the storyboard. The camera arrives at each stop at the
stop's cue or second, in scene time. `cameraAt(keyframes, seconds)` samples either kind of
path with the camera easing; zoom is interpolated geometrically so a move looks as fast at
its end as at its start.

**Isolation** follows what the recording dwells on (`focusSpans`, `focusAt`): an action held
for at least `camera.holdSeconds` whose region is not most of the screen. Between two
subjects that follow each other the clear area glides from one to the next. A passing click
is not isolated, because dimming the screen for a third of a second only flickers.

### Callouts

`annotations` on a product visual accept `cue` and `untilCue` as well as `fromSeconds` and
`toSeconds`. When the visual has a `camera` block, a callout is drawn as a ring on the
footage (plus dimming when `spotlight` is true) and its `text` is set as a sentence beside
the frame in landscape, or above the detail panel in portrait. No label is placed on the
footage. Without a `camera` block the original pill callout is kept, so existing videos look
as they did.

### When the footage plays

```json
"footage": {
  "startCue": "open",
  "fromSeconds": 3.2,
  "anchors": [{ "cue": "rule", "recordingSeconds": 23.5 }]
}
```

| Field          | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `startCue`     | Playback starts on this cue. The first frame is held until then                |
| `startSeconds` | The same, as a time. Default 0                                                 |
| `fromSeconds`  | Second of the recording playback begins on. What comes before is never shown   |
| `toSeconds`    | Second of the recording playback stops on and holds. What follows is not shown |
| `anchors`      | Pins `recordingSeconds` to a cue. Playback stretches linearly between anchors  |

Anchors that would make time run backwards are dropped. The scene is extended so footage
that starts late still plays to its end.

### Handoff: a motion graphic that becomes the footage

```json
"prelude": {
  "visual": { "kind": "network", "...": "..." },
  "handoffCue": "carries",
  "anchor": "c3",
  "landsOn": { "x": 0.209, "y": 0.568, "width": 0.555, "height": 0.233 }
}
```

| Field        | Meaning                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `visual`     | Any motion graphic kind                                                        |
| `handoffCue` | When the handoff happens. `handoffSeconds` is used when there is no cue        |
| `anchor`     | Id of the prelude element that becomes the footage. Omitted: the whole graphic |
| `landsOn`    | Region of the recording the graphic lands on. Omitted: the whole frame         |

The scene opens on the graphic. At the handoff the graphic shrinks until all of it fits the
`landsOn` region and travels so that its anchor arrives at the centre of that region, fading
as it lands, while the footage resolves around the same place and the region is ringed for
a moment. Position and scale are continuous; only the picture changes. It is a
matched-position crossfade, not a morph: shapes that pretended to turn into an interface
would be drawing a product that does not exist.

Anchor ids by kind: an account id (`identity-story`), a node id (`network`), a stage index
such as `"2"` (`pipeline`), a signal or outcome id or `"rule"` (`decision`), an event index
(`timeline`), an item index (`transformation`), a character or prop id (`character-scene`).

Unless `footage` says otherwise, playback waits for the handoff. Choose `landsOn` for what is
on screen at that moment, and use `footage.fromSeconds` to start the recording where the
thing is visible. Combine a prelude with `animation.enter: "hold"` and `settled` to continue
from the previous scene's graphic.

### Components

`CinematicProductFrame` is the browser frame with a soft pool of the brand colour behind it
and layered shadows. `SmartScreenRecording` is the recording seen through the camera, with
isolation and callouts. `UIElementFocus` rings a region of the footage and optionally dims
the rest. `ScreenRecordingTransition` is the handoff. `CameraRig` applies a camera state.

## Visual kinds

Every kind takes an optional `settled` list. Every `cue` is optional. Tones are `neutral`,
`primary`, `positive`, `warning`, `danger`; statuses are `verified`, `flagged`, `pending`,
`declined`. The status names are the schema's; for Iker read `verified` as paid, confirmed or
done, `flagged` and `pending` as awaiting confirmation or a balance owed, and `declined` as
rejected or cancelled. Amber means "needs attention", green means done, terracotta is the
brand and the colour of a match link. Face glyphs never use green, amber or red.

Several kinds and enum values were designed for the identity-verification product this studio
was first built for (`identity-story`, field icons such as `document` and `wallet`, tiles such
as `id-card` and `selfie`). They are still valid. Use them only where they describe something
Iker really does; never draw a check, a match or a verdict the product does not make.

### `identity-story`

Accounts appear one at a time as cards. Each fills in, goes through its steps, and the
details that differ are picked out. Then the cards step back, the faces stay, and a line is
drawn between the ones that are the same person. For Iker, a card is a client and the steps
are a booking's progress.

| Field               | Meaning                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `heading`           | Optional                                                                                                                        |
| `accounts` (1 to 4) | `id`, `name`, `face` (seed), `cue` (card appears), `nameCue`, `nameDiffers`                                                     |
| `accounts[].fields` | Up to 4 of `{ icon, value, differs, cue }`. `icon`: `name`, `email`, `phone`, `document`, `date`, `address`, `device`, `wallet` |
| `accounts[].steps`  | Up to 3 of `{ label, status?, cue }`                                                                                            |
| `gaps`              | `{ after: accountId, label, cue }`: time passing between two accounts                                                           |
| `match`             | `{ cue, label, accounts?, isolate, tone }`. Defaults to accounts sharing a seed                                                 |

A field without a cue follows its card. A field shows an empty slot until it is revealed, so
"not yet known" is visible. The match line is a drawing of the story, not a product feature:
do not use it to suggest Iker matches or detects anything.

```json
{
  "kind": "identity-story",
  "accounts": [
    {
      "id": "first",
      "name": "Tunde A.",
      "face": "tunde",
      "cue": "booked",
      "fields": [
        { "icon": "phone", "value": "+234 700 000 0142" },
        { "icon": "email", "value": "tunde@example.com" },
        { "icon": "date", "value": "Sat, 10:00" }
      ],
      "steps": [
        { "label": "Booked", "cue": "booked" },
        { "label": "Proof uploaded", "status": "pending", "cue": "proof" },
        { "label": "Confirmed", "status": "verified", "cue": "confirmed" }
      ]
    }
  ]
}
```

### `network`

Nodes arrive, edges draw themselves from one node to another, an edge can then be picked
out, and a boundary can close around a cluster.

| Field             | Meaning                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `layout`          | `radial` (hub in the middle, default) or `groups` (groups side by side)                         |
| `hub`             | Node id at the centre of a radial layout. Default: the first node                               |
| `nodes` (2 to 14) | `id`, `type`, `label`, `sublabel`, `face`, `group`, `tone`, `status`, `muted`, `outside`, `cue` |
| `nodes[].type`    | `account`, `person`, `face`, `device`, `wallet`, `document`, `business`, `list`, `signal`       |
| `edges`           | `from`, `to`, `tone`, `style` (`solid` or `dashed`), `cue`, `signal`, `mark`                    |
| `edges[].mark`    | `{ cue, tone, label }`: the edge is recoloured and named, the others step back                  |
| `clusters`        | `{ nodes, label, tone, cue, isolate }`: a boundary; with `isolate` the rest recede              |

`outside: true` puts a node beyond the ring, for what is deliberately left out. `signal:
true` sends one pulse along the edge as it draws: a comparison being made.

```json
{
  "kind": "network",
  "layout": "radial",
  "hub": "biz",
  "nodes": [
    { "id": "biz", "type": "business", "label": "Your business", "tone": "primary", "cue": "biz" },
    { "id": "c1", "type": "person", "face": "tunde", "label": "Tunde", "cue": "clients" },
    { "id": "c2", "type": "person", "face": "ada", "label": "Ada", "cue": "clients" },
    { "id": "list", "type": "list", "label": "Customer list", "cue": "list" },
    {
      "id": "admin",
      "type": "business",
      "label": "Platform staff",
      "muted": true,
      "outside": true,
      "cue": "outside"
    }
  ],
  "edges": [
    { "from": "biz", "to": "c1", "cue": "clients" },
    {
      "from": "biz",
      "to": "c2",
      "cue": "clients",
      "mark": { "cue": "owed", "tone": "warning", "label": "Balance due" }
    },
    { "from": "biz", "to": "list", "cue": "list", "signal": true }
  ],
  "clusters": [{ "nodes": ["biz", "c1", "c2", "list"], "label": "Your records", "cue": "only" }]
}
```

### `pipeline`

One object travels a track and reaches each stage on that stage's cue. The stage is decided
as it arrives and the track behind it stays filled.

| Field             | Meaning                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `object`          | `{ type, label?, face? }`. `type`: `document`, `selfie`, `person`, `transaction`, `business`, `wallet`, `data` |
| `stages` (2 to 6) | `{ label, detail?, status (default verified), cue }`. The cue is the arrival                                   |
| `result`          | `{ label, detail?, status, cue }`: what the object emerges as                                                  |
| `focus`           | `{ stage: index, cue }`: one stage is picked out and the rest recede                                           |

```json
{
  "kind": "pipeline",
  "heading": "One booking, from link to confirmed",
  "object": { "type": "transaction", "label": "Deposit" },
  "stages": [
    { "label": "Booked", "detail": "Slot held from the public link", "cue": "booked" },
    { "label": "Transfer sent", "detail": "Outside the app", "cue": "transfer" },
    {
      "label": "Proof uploaded",
      "detail": "Awaiting Confirmation",
      "status": "pending",
      "cue": "proof"
    }
  ],
  "result": {
    "label": "Confirmed",
    "detail": "You checked the payment",
    "status": "verified",
    "cue": "result"
  },
  "focus": { "stage": 2, "cue": "focus" }
}
```

### `decision`

Signals feed a rule, and the rule routes to outcomes. When a route fires, the path from its
signal through the rule to its outcome lights up in the outcome's colour and the outcome is
stamped.

| Field               | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `signals` (1 to 5)  | `{ id, label, detail?, tone, cue }`                                              |
| `rule`              | `{ label, detail?, cue }`: a rule, a policy, or a person                         |
| `outcomes` (2 to 4) | `{ id, label, detail?, status, cue }`                                            |
| `routes`            | `{ from?: signalId, to: outcomeId, cue }`. Without `from`, every signal feeds it |
| `score`             | `{ label, level 0 to 1, threshold?, cue }`: a bar in the rule, with no numerals  |

Without routes the outcomes are simply the options, each carrying its mark. With routes, an
outcome nothing leads to steps back, routes that fire together are one statement, and an
earlier route dims when a later one fires.

```json
{
  "kind": "decision",
  "heading": "You decide what the proof means",
  "signals": [
    {
      "id": "proof",
      "label": "Proof of payment",
      "detail": "Screenshot from the client",
      "cue": "proof"
    }
  ],
  "rule": { "label": "You check your account", "detail": "Did the money arrive?", "cue": "check" },
  "outcomes": [
    { "id": "confirm", "label": "Confirm", "status": "verified", "cue": "check" },
    { "id": "reject", "label": "Reject", "status": "declined", "cue": "check" }
  ],
  "routes": [{ "from": "proof", "to": "confirm", "cue": "arrived" }]
}
```

### `timeline`

Events in order. The rail grows to each event as it is mentioned; then the flagged events
are ringed and the rest step back.

| Field             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `events` (2 to 7) | `{ label, time?, tone, flagged, cue }`                |
| `flag`            | `{ cue, label? }`: when flagged events are picked out |

```json
{
  "kind": "timeline",
  "heading": "One booking, one balance",
  "events": [
    { "label": "Tunde books a haircut", "time": "Monday", "cue": "first" },
    { "label": "Deposit paid", "time": "Monday", "tone": "positive", "cue": "deposit" },
    { "label": "Balance due", "time": "Saturday", "flagged": true, "cue": "owed" }
  ],
  "flag": { "cue": "flag", "label": "Partially Paid" }
}
```

### `story`

A few lines of type, revealed in step with the voice. Hierarchy is size alone.

| Field            | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `mode`           | `disclosure` (default), `problem` or `outcome`                             |
| `lines` (1 to 6) | `{ text, role, status?, cue }`. `role`: `lead`, `support` (default), `key` |
| `recede`         | Lines already read step back. Default true                                 |

In `problem` mode the key line turns amber and everything before it recedes. In `outcome`
mode each supporting line is stamped with a status mark (verified unless it says otherwise).

```json
{
  "kind": "story",
  "mode": "problem",
  "lines": [
    { "text": "A client says she has paid", "role": "lead", "cue": "paid" },
    { "text": "The proof is somewhere in your chats", "cue": "chats" },
    { "text": "Who still owes you this month?", "role": "key", "cue": "owes" }
  ]
}
```

### `transformation`

The same things in two states. Each item becomes its after state on its cue.

| Field             | Meaning                                |
| ----------------- | -------------------------------------- |
| `mode`            | `side-by-side` (default) or `in-place` |
| `before`, `after` | `{ title }` each                       |
| `items` (1 to 5)  | `{ before, after, status?, cue }`      |

```json
{
  "kind": "transformation",
  "heading": "What changes when payments are recorded",
  "before": { "title": "Notebook and chats" },
  "after": { "title": "In Iker" },
  "items": [
    {
      "before": "Deposits found by scrolling chats",
      "after": "Proof of payment on the booking",
      "status": "verified",
      "cue": "proof"
    },
    {
      "before": "Balances remembered",
      "after": "Marked Partially Paid",
      "status": "pending",
      "cue": "balance"
    }
  ]
}
```

### `character-scene`

A story told with people. A small cast stands on a stage, drawn waist-up as flat cartoon
characters in the same family as the face glyph. Each action changes what one of them is
doing, feeling or saying on its cue; props appear beside them; things are handed from one to
another. Nobody moves unless the narration says something happened. Between actions a
character only breathes and blinks, and not at all under reduced motion.

| Field               | Meaning                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `heading`           | Optional. Leave it out unless the scene needs one                                                                                      |
| `cast` (1 to 4)     | `id`, `name` (shown under the figure), `seed`, `skin`, `hair`, `hairColour`, `outfit`, `hidden`, `pose`, `expression`, `cue` (arrives) |
| `cast[].seed`       | What the look is derived from; the `id` when omitted. The same seed is the same person. Anything stated outright wins                  |
| `cast[].skin`       | `deep`, `brown`, `tan`, `light`                                                                                                        |
| `cast[].hair`       | `crop`, `afro`, `puffs`, `bun`, `bob`, `long`, `sweep`, `none`                                                                         |
| `cast[].hairColour` | `ink`, `brown`, `auburn`, `silver`, `violet`                                                                                           |
| `cast[].outfit`     | `violet`, `blue`, `cyan`, `pink`, `lilac`, `slate`, `cream`. Never green, amber or red. See the colour note below                      |
| `cast[].hidden`     | Somebody whose identity is not known: a plain silhouette in a dashed niche, with a question mark for a face                            |
| `props` (up to 4)   | Things that are not people, each with an `id`, a `kind` and a `cue`. See the table below                                               |
| `props[].with`      | A character id. The prop then belongs to that character instead of standing on the stage on its own                                    |
| `stage`             | Order of the cast and of the props that stand on their own. Default: the cast, then the props                                          |
| `actions`           | `{ who, cue, pose?, expression?, say?, think?, untilCue?, status?, leave? }`, in the order they happen                                 |
| `sends` (up to 3)   | `{ object, from, to, label?, cue }`: `object` is `link` (default), `id-card`, `selfie`, `phone` or `laptop`                            |

The colour names are schema keys kept from the original studio; they render in Iker's palette
(`src/remotion/design/tokens.ts`): `violet` is terracotta, `lilac` and hair `violet` are the
light terracotta accent, `cyan` is palm sage, `pink` is plum, `blue` is a muted blue, `slate`
is the muted text colour and `cream` the text colour. Use terracotta for at most one figure.

Poses: `idle`, `wave`, `think`, `point`, `shrug`, `hold-phone`, `hold-id`, `selfie`,
`at-laptop`. The last four put the object in the character's hand, so a phone, an ID card
or a laptop needs no prop. Expressions: `neutral`, `happy`, `curious`, `worried`,
`surprised`. A character changes from one pose or expression to the next by moving, never
by cutting.

One action may change several things at once. `say` is a speech bubble and `think` a
thought bubble, 48 characters at most; a new bubble replaces the character's previous one,
and `untilCue` takes it away. `status` stamps a status mark on the character's niche.
`leave` takes them off the stage. A character on the right of the stage mirrors their pose,
so a gesture is always made towards the others.

| Prop `kind` | Fields                                                              | What it shows                                                                                       |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `app`       | `label?`                                                            | A phone showing a money app as a few plain shapes                                                   |
| `signups`   | `people` (1 to 8 of `{ face, cue }`), `ask: { cue }`, `label?`      | People arriving one by one as face glyphs. `ask` dims them and puts a question mark over each       |
| `checklist` | `title?`, `items` (1 to 5 of `{ label, cue, status?, statusCue? }`) | A list of steps. An item shows an empty slot until its cue, and is ticked on its `statusCue`        |
| `card`      | `name`, `detail?`                                                   | A sign-up as the business sees it: a placeholder avatar, a name, one detail                         |
| `keyword`   | `text`, `short: { text, cue }`                                      | A term set large, a word to a line. `short` picks out its initials and sets the short form below it |
| `tiles`     | `items` (1 to 3 of `{ icon, label?, cue, status?, statusCue? }`)    | Objects as icon tiles: `id-card`, `selfie`, `link`, `phone`, `laptop`                               |

A character or prop without a cue is there from the start. Actions and sends without a cue
are paced between the cued ones around them, like the steps of any other graphic. Items
that share a cue arrive one after another.

The stage is scaled to fill the body (up to 1.8 times its design size in landscape and
twice in portrait) and centred on what is seen: the figures' niches, not the empty margin
of their boxes. Room for a prop that arrives late is kept from the first frame, so nothing
reflows mid-scene.

Rules that keep it honest. A `checklist` is a list on a card and an `app` is a phone with
shapes on it: neither is a screen of the product, and neither should be labelled as one.
A `hidden` character is never shown caught or refused: give them a request (a `tiles` prop
with no status), not a verdict nobody reached. Names are obviously fictional.

```json
{
  "kind": "character-scene",
  "cast": [
    {
      "id": "amaka",
      "name": "Amaka",
      "skin": "deep",
      "hair": "bun",
      "outfit": "violet",
      "expression": "happy"
    },
    { "id": "tunde", "name": "Tunde", "skin": "brown", "hair": "crop", "outfit": "cyan" }
  ],
  "props": [
    {
      "kind": "checklist",
      "id": "steps",
      "with": "tunde",
      "cue": "opens",
      "items": [
        { "label": "Pick a service", "status": "verified", "statusCue": "service" },
        { "label": "Pick a time", "status": "verified", "statusCue": "time" },
        { "label": "Upload proof of payment", "status": "verified", "statusCue": "proof" }
      ]
    }
  ],
  "actions": [
    { "who": "amaka", "cue": "link", "pose": "point" },
    { "who": "tunde", "cue": "opens", "pose": "hold-phone" },
    { "who": "tunde", "cue": "done", "pose": "idle", "expression": "happy", "status": "verified" }
  ],
  "sends": [
    { "object": "link", "from": "amaka", "to": "tunde", "label": "Her booking link", "cue": "link" }
  ]
}
```

To continue across a held cut, repeat the cast, props, actions and sends, list the earlier
cues as `settled`, and add the new actions after the old ones. Actions apply in the order
they are listed, so keep them in the order they happen.

### `product`

The original fields are unchanged. `camera`, `footage`, `prelude` and cue-timed annotations
are described under "Directed product footage".

```json
{
  "kind": "product",
  "scenarioId": "synthetic-new-booking",
  "mode": "video",
  "camera": { "mode": "follow", "maxZoom": 2, "isolate": true },
  "footage": { "startCue": "carries", "fromSeconds": 3.2 },
  "annotations": [
    {
      "text": "The booking waits here until you confirm the payment.",
      "region": { "x": 0.209, "y": 0.747, "width": 0.245, "height": 0.018 },
      "cue": "waits",
      "untilCue": "confirm"
    }
  ]
}
```

#### Device frames

`device` chooses what the footage is shown in: `"browser"` (default, the browser frame with
its address bar), `"iphone"` (a generic dark phone with a camera pill, for 9:16 reels and
shorts) or `"ipad"` (a generic dark landscape tablet with a camera dot, for 16:9 LinkedIn
and Facebook cuts). Record the scenario at a matching viewport: about 390 x 844 for the
phone, 1180 x 820 for the tablet. The device's screen always takes the recording's aspect,
so nothing is cropped; a taller-than-wide recording gives a portrait device, a wider one a
landscape device.

```json
{ "kind": "product", "scenarioId": "synthetic-new-booking", "device": "iphone" }
```

- **9:16.** The heading (and the callout sentence, when the visual has a `camera` and
  annotations) sits centred above the device, and the device takes the rest of the content
  zone's height. There is no magnified detail panel: a phone recording is already shown at
  the size it was made for.
- **16:9.** The device stands beside the text column, as the browser frame does.
- **Camera.** The virtual camera, isolation, callout rings, the pill callouts and the cursor
  all work inside the device's screen in both orientations (with the browser frame, portrait
  keeps the frame on the full view and magnifies in the detail panel instead).
- A missing recording shows `RecordingUnavailable` inside the device's screen.
- The frames are drawn from tokens, flat and still: no maker's logo or artwork. Geometry is
  `layoutDevice` and `fitDevice` in `src/remotion/lib/device-layout.ts`; the drawing is
  `components/DeviceFrame.tsx`.

The original kinds (`title`, `statement`, `steps`, `diagram`, `comparison`, `code`, `data`,
`cta`, `outro`, `chapter`) work as before. They take `animation.enter` and `exit` `hold` and
read their timing from the same tokens, but they do not respond to cues.

## Named components

`src/remotion/library.tsx` exports every named component. Eight graphics and four product
components do the work. The rest are those same components with the vocabulary and defaults
of one domain. The `LIBRARY` constant in that file records which is which, and
`tests/unit/remotion/library.test.ts` checks it. Storyboards use the `kind`, not these names.

| Component                    | What it is                                                         | Storyboard kind  |
| ---------------------------- | ------------------------------------------------------------------ | ---------------- |
| `IdentityCard`               | Full: the card primitive                                           | `identity-story` |
| `IdentityVerificationFlow`   | Preset of `Pipeline`: person, document, selfie, checks             | `pipeline`       |
| `DocumentCapture`            | Preset of `Pipeline`: document captured, read, checked             | `pipeline`       |
| `FaceMatchVisualisation`     | Preset of `IdentityStory`: two bare cards, faces joined            | `identity-story` |
| `FaceDeduplicationNetwork`   | Preset of `Network`: radial, account nodes                         | `network`        |
| `BiometricIdentityGraph`     | Preset of `Network`: groups, face nodes                            | `network`        |
| `DuplicateAccountDetection`  | Preset of `IdentityStory` with matching on                         | `identity-story` |
| `FraudSignalNetwork`         | Preset of `Network`: radial, signal nodes                          | `network`        |
| `RiskScoreVisualisation`     | Preset of `Decision` with its score bar                            | `decision`       |
| `RiskDecisionGraph`          | Full: `Decision` under its domain name                             | `decision`       |
| `SuspiciousActivityTimeline` | Full: `Timeline` under its domain name                             | `timeline`       |
| `DeviceRelationshipGraph`    | Preset of `Network`: groups, device nodes                          | `network`        |
| `FraudPatternDetection`      | Preset of `Network`: groups, account nodes                         | `network`        |
| `RiskSignalAggregation`      | Preset of `Decision`: the same graph, named for its use            | `decision`       |
| `KYCPipeline`                | Preset of `Pipeline`: customer verification stages                 | `pipeline`       |
| `KYBVerificationFlow`        | Preset of `Pipeline`: business, registration, ownership, screening | `pipeline`       |
| `SanctionsScreeningFlow`     | Preset of `Pipeline`: a name normalised, screened, reviewed        | `pipeline`       |
| `WalletScreeningNetwork`     | Preset of `Network`: radial, wallet nodes                          | `network`        |
| `TransactionMonitoringFlow`  | Preset of `Pipeline`: transaction, rules, context, alert           | `pipeline`       |
| `ComplianceDecisionEngine`   | Preset of `Decision`: the same graph, named for its use            | `decision`       |
| `CinematicProductFrame`      | Full                                                               | `product`        |
| `SmartScreenRecording`       | Full                                                               | `product`        |
| `UIElementFocus`             | Full                                                               | `product`        |
| `ProductSpotlight`           | Preset of `UIElementFocus` with isolation on                       | `product`        |
| `ScreenRecordingTransition`  | Full: the handoff                                                  | `product`        |
| `InteractiveWorkflowDiagram` | Preset of `Pipeline` with one stage picked out                     | `pipeline`       |
| `ProductFeatureReveal`       | Preset of the product scene: one manual camera stop, isolation on  | `product`        |
| `ProblemReveal`              | Preset of `Story`, `problem` mode                                  | `story`          |
| `ProgressiveDisclosure`      | Preset of `Story`, `disclosure` mode                               | `story`          |
| `OutcomeReveal`              | Preset of `Story`, `outcome` mode                                  | `story`          |
| `TransformationSequence`     | Preset of `Transformation`, `in-place` mode                        | `transformation` |
| `BeforeAfterComparison`      | Preset of `Transformation`, `side-by-side` mode                    | `transformation` |
| `CauseEffectAnimation`       | Preset of `Decision`: one signal, one route                        | `decision`       |
| `DataFlowSequence`           | Preset of `Pipeline`: a data object                                | `pipeline`       |

Most domain presets are named for the identity-verification product this studio was first
built for. They are code names only, kept so the library test stays meaningful; a storyboard
never names them. For Iker the useful mechanisms are the generic ones: `Pipeline` for a
booking or payment moving through its statuses, `Decision` for a choice the business makes,
`Timeline`, `Story`, `Transformation` and `CharacterScene`.

Several network and decision presets differ only in their default node type or their name.
That is deliberate: they are the same mechanism, and a second implementation would only be a
second place for bugs.

Primitives, in `src/remotion/primitives`: `FaceGlyph`, `IdentityCard`, `StatusMark`,
`Connector` and `ConnectorLayer`, `Node`, `FocusRing` and `DimMask`, `ScoreBar`, `Icon`,
`Character`. Their
geometry comes from pure functions in `src/remotion/lib` (`identity`, `graph`, `pipeline`,
`decision`, `rail`, `story`, `transform`, `camera`, `product-layout`, `anchors`, `geometry`,
`face`, `schedule`, `character`, `character-scene`), all unit tested.

## Portrait

9:16 is its own layout, never a scaled 16:9.

| Kind              | Landscape                                                                                                                                                                      | Portrait                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity-story`  | Cards in a row, each face over its card                                                                                                                                        | Cards stacked, faces in a column on the left                                                                                                                                           |
| `network`         | Ring wider than tall, outside nodes at right                                                                                                                                   | Ring capped in height, outside nodes in a row below                                                                                                                                    |
| `pipeline`        | Track left to right, object above it                                                                                                                                           | Track top to bottom, object on its left                                                                                                                                                |
| `decision`        | Signals, rule, outcomes left to right                                                                                                                                          | Top to bottom; signals join a rail down the left                                                                                                                                       |
| `timeline`        | Rail left to right                                                                                                                                                             | Rail top to bottom, times on its left                                                                                                                                                  |
| `story`           | Lines up to 1500 px wide                                                                                                                                                       | The same block at portrait sizes                                                                                                                                                       |
| `transformation`  | Two wide columns                                                                                                                                                               | Two narrow columns, more rows of text                                                                                                                                                  |
| `character-scene` | The cast in a row; bubbles above heads; a character's props under them when everybody has some, beside them otherwise; a thing handed over crosses the gap between two figures | A column of rows; bubbles and a character's props beside them; two narrow things share a row only when that draws the stage larger; a thing handed over drops from one row to the next |
| `product`         | The camera moves inside the frame                                                                                                                                              | The frame stays on the full view with the camera's view outlined; a detail panel below shows that view enlarged                                                                        |

In portrait the product camera frames more tightly (`scale.detailMin`), because the detail
panel exists to magnify. The overview frame is not dimmed. When the camera is on the full
frame and the visual has no `focus`, the detail panel steps out.

## Checking work

1. `pnpm exec vitest run --project unit tests/unit/remotion tests/unit/domain` covers beats,
   the schedule, the camera path, every layout in both formats (inside the body, nothing
   overlapping), the handoff and continuity.
2. `pnpm remotion:studio` shows every kind on sample data in the "Cut" composition.
3. Render stills with real props at the first frame, each key beat and the last frame, in
   both formats, and look at them:
   `pnpm exec remotion still src/remotion/index.ts Scene out.png --props=props.json --frame=120`.
   Judge focal hierarchy, spacing, legibility at phone size, whether a muted viewer follows
   what happened, and whether anything could be taken for the real product.
4. For a held cut, render the last frame of scene N and frame 0 of scene N+1 and compare
   them. They must be identical:
   `ffmpeg -i last.png -i first.png -filter_complex "blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-" -f null -`
   prints `YMAX=0` when they are.
5. `pnpm studio storyboard --video <id>` validates cues before anything renders.

## Known limits

- Recordings are 1440 px wide. At 2x zoom in a 1300 px frame the footage is enlarged about
  1.8 times and is visibly soft. Recording at device scale factor 2 would fix it.
- The recorder draws its own label pills on `highlight` steps that have a `label`. They are
  baked into the capture, so the camera cannot remove them.
- `follow` cannot see the page scroll. Regions are where elements were when acted on, which
  is what the camera needs, but a framing held across a scroll shows the page moving under it.
- Camera times in `follow` mode are recording seconds. Stretching footage with `anchors`
  stretches camera moves with it.
- Two seeds can produce glyphs that look alike. `confusableFaces(seeds)` in
  `src/remotion/lib/face.ts` lists such pairs; check the still.
- The original kinds do not respond to cues.
