---
name: motion-graphics-designer
description: >-
  Changes the Remotion design system of Iker Video Studio (src/remotion: tokens, layout zones,
  motion, scene components, thumbnails) while keeping its rules: brand tokens only, safe areas,
  scenes that open and close on the bare background, deterministic frames, reduced motion and
  portrait recomposition. Use when a visual kind looks wrong in every video, a component needs
  building or restyling, text overflows or leaves the safe area, motion feels off, or a 9:16
  layout breaks.
argument-hint: "[video-id to review against]"
---

# Motion graphics designer

Review video: `$ARGUMENTS` (optional). Without one, work against the sample props in
`src/remotion/sample-props.ts`.

This skill changes code shared by every video. If only one scene of one video is wrong, that
is `storyboard-designer` work, not a component change.

## Responsibilities

- Keep every frame on brand, legible, inside the safe area, and reproducible.
- Build and fix components so a scene is a pure function of its props.
- Make each layout work in 16:9 and 9:16.
- Prove a change with tests, stills and a preview render, and say which of those you ran.

## Required inputs

- The defect or request, with the scene and format it shows in.
- Read `docs/MOTION-DESIGN.md` first: the motion vocabulary, beats, continuity, the virtual
  camera, every visual kind and which named components are presets of which.
- Read before editing: `src/remotion/design/tokens.ts`, `layout.ts`, `motion.ts`,
  `SceneContext.tsx`, `useReveal.ts`, `useBeat.ts`; `src/remotion/scenes/SceneComposition.tsx` and
  `SceneRenderer.tsx`; the component you will touch and `components/Reveal.tsx`,
  `Background.tsx`.
- Contract with the pipeline: `src/domain/render-props.ts` and `src/domain/storyboard.ts`.

## Expected outputs

- Changes under `src/remotion/**` only (plus `src/domain` if a visual's schema changes, and
  `tests/unit/remotion/*.test.ts`).
- No manifest edits. Any source change under `src/remotion` changes the renderer hash, so
  the next `render` or `preview` re-renders every scene of every video and reuses narration
  and recordings. Final approvals of re-rendered cuts are void.

## Design system rules

1. **Layering.** `src/remotion` imports only from `src/domain` and itself. ESLint blocks
   imports from `application`, `infrastructure` and `cli`.
2. **Tokens, not literals.** Colours, fonts, type roles, spacing, radii, shadows and strokes
   come from `useTokens()` (`buildTokens` in `tokens.ts`), which derives them from
   `brand/brand.json`. No hex colour, font name or raw pixel size in a component. Tints go
   through `withAlpha`. Tone colours go through `toneColour`. Only the font weights imported
   in `src/remotion/fonts.ts` exist: add a weight there before using it.
   The Iker canvas is obsidian (`background`) with terracotta (`primary`) as the one accent:
   do not introduce a second accent colour, gradients or glass effects. Money values are
   formatted as `₦45,000`.
3. **Scaled units.** Sizes are design pixels on a 1080 short edge, converted with
   `layout.u(n)`. Orientation choices use `layout.pick(landscape, portrait)`. Never branch on
   a hard-coded width or height.
4. **Safe areas and zones.** `computeZones` splits the format's safe area into bands:
   disclosure label at the top; progress, captions and lower third stacked from the bottom;
   the scene visual gets the remaining `zones.content`. A component lays itself out inside the
   box it is given and never positions against the full frame. Use `fitFontSize` and
   `estimateLines` so long text shrinks or wraps instead of overflowing.
5. **Scene edges.** Scenes are rendered as separate segments and hard-joined by FFmpeg. By
   default frame 0 and the last frame of a scene show only `Background`, which is completely
   static: content enters after `timing.leadFrames` and `SceneComposition` fades the content
   layer out (`exitOpacity`). A scene with `animation.exit: "hold"` keeps its finished
   composition instead, and one with `animation.enter: "hold"` opens on it, so a composition
   can continue across the cut. For that to work a graphic must be a pure function of its
   data, the beats and the frame: every animation must come to rest (springs are snapped to
   exactly 1), nothing may loop, and an element that is not visible must not be rendered at
   all. `tests/unit/remotion/continuity.test.ts` holds new graphics to this. Do not animate
   the background, except through a cut's opt-in `"background": "animated"`, which is keyed
   to the cut's frame (see `docs/MOTION-DESIGN.md`) and must stay in the margins and slow.
6. **One vocabulary.** Every duration, curve, spring, distance and scale range is a token in
   `MOTION` (`tokens.ts`), read through `useMotion()` (`design/useBeat.ts`) or `tween`,
   `springProgress` and `durationFrames` (`design/motion.ts`). No timing number in a
   component. No new easing curves, no bounce, no constant zooming, no motion blur. Every
   movement must explain a relationship, process, decision, transformation, consequence or
   comparison; if it explains nothing, remove it. Original components use `Reveal`,
   `useReveal` and `staggerSchedule`.
7. **Determinism.** A frame depends only on props and `useCurrentFrame()`. No `Math.random`,
   no `Date`, no timers, no network fetch, no CSS transitions or keyframe animations. Derive
   everything from the frame number with `interpolate`. Renders are cached by a hash of their
   props, so hidden state produces stale or mismatched segments.
8. **Reduced motion.** `reducedMotion` (from `manifest.render.reducedMotion`) keeps opacity
   changes and drops movement: see `revealTransform`. Any new movement must check
   `useSceneEnvironment().reducedMotion` and fall back to a fade.
9. **Portrait recomposition.** 9:16 is its own layout, not a scaled 16:9: stack instead of
   placing side by side, use the portrait type sizes from `pick`, and for product scenes show
   the storyboard's `focus` region magnified below the frame (`ProductLayout`). The portrait
   safe area reserves 220 px top, 420 px bottom and 150 px right for platform chrome.
10. **Beats decide when.** A motion graphic never invents its own timing. It builds an
    ordered list of steps, each with an optional cue id from its data, and asks
    `useMotion().schedule(steps, settled)` for start frames: cued steps land on their beat,
    settled ones are complete from frame 0, and the rest are spaced between their neighbours.
    Nested things (a card's fields) use `child()`.
11. **Geometry is pure and tested.** A graphic's layout is a function in `src/remotion/lib`
    that takes the body box, the orientation and the unit and returns rectangles and paths.
    The component only draws them. Add a containment and no-overlap test for both formats in
    `tests/unit/remotion/graphics-layout.test.ts`, and an anchor in `lib/anchors.ts` so the
    graphic can be a product prelude.
12. **No small labels, no fake product.** No uppercase or monospace eyebrow, kicker, tag or
    numbered marker. Illustration is dark, flat and made of glyphs, never a copy of the
    dashboard. People are `FaceGlyph` seeds, never photos. No number nobody measured.
13. **Presets, not copies.** A new named component that is an existing mechanism with other
    data is a preset in `src/remotion/library.tsx`, recorded in `LIBRARY` as
    `{ presetOf }`. Do not write a second implementation.
14. **Honesty layers.** `DisclosureLabel` marks synthetic footage and `DataVisualisation`
    always prints its `source` and flags `illustrative` data. Never make them optional,
    smaller than readable, or removable by a prop. A missing recording renders
    `RecordingUnavailable`, never invented UI.

## Workflow

1. Reproduce. With a video: `pnpm studio preview --video <id> --studio` (add `--cut <cut-id>`
   for a specific cut), choose the "Cut" composition, scrub to the scene. Without one:
   `pnpm remotion:studio`, which opens the "Scene", "Cut" and "Thumbnail" compositions on
   sample props.
2. Make the smallest change that fixes the cause, in the token or helper if the problem is
   systemic, in the component if it is local.
3. For a held cut, render the last frame of scene N and frame 0 of scene N+1 and compare
   them with the `ffmpeg` command in "Checking work" of `docs/MOTION-DESIGN.md`: it must
   print `YMAX=0`.
4. Add or extend a unit test in `tests/unit/remotion/` (layout containment, motion at frame 0
   and the last frame, caption fit). Run `pnpm validate`.
5. Check stills at the first frame, a settled frame and the last frame:
   `pnpm exec remotion still Scene "$TMPDIR/scene-settled.png" --frame=45`
   renders the sample scene. For real props, keep the `--studio` session from step 1 open in
   another terminal (its props file points at that session's asset server) and run
   `pnpm exec remotion still Cut "$TMPDIR/cut-frame.png" --props=output/<id>/preview/studio-props-<cut-id>.json --frame=<n>`.
6. Render what changed: `pnpm studio preview --video <id> --scene <scene-id>`, then the whole
   video with `pnpm studio preview --video <id>`. Every cut, both orientations.
7. Run `pnpm studio qa --video <id> --quality preview` and open
   `output/<id>/qa/<cut>-preview/contact-sheet.png`: each frame has the safe area outlined.
   Look at the images yourself with the Read tool, then show the human. Whether it looks good
   is their call.
8. Thumbnails changed? `pnpm studio thumbnails --video <id> --force` and view the three PNGs
   in `output/<id>/thumbnails/` at small size.

## Validation criteria

- `pnpm validate` passes (typecheck, lint with the layer rule and Remotion plugin, format,
  unit tests).
- `pnpm studio preview --video <id>` exits 0 for every cut and lists the scenes rendered.
- `pnpm studio qa --video <id> --quality preview` reports no `FAIL` for `black-frames`,
  `subtitle-overflow`, `narration-overflow` or `duration`.
- On the contact sheet, all text and key UI sit inside the outlined rectangle in landscape
  and portrait. This is checked by eye: say that you looked, not that it was measured.
- First and last frame of a changed scene show only the background, unless the scene holds
  that edge, in which case the held frame matches its neighbour exactly.

## Failure handling

- `RENDER_FAILED` "Rendering <scene> failed: ...". A component threw or a media file did not
  load. Reproduce with `pnpm studio preview --video <id> --studio`, fix, rerun.
- `STAGE_BLOCKED` "Cut ... cannot be rendered yet. Missing: narration for scene ... /
  recording ...". Assets are missing, not a design fault. Run the commands in the message
  (`pnpm studio narrate --video <id>`, `pnpm studio record --video <id>`), or work on sample
  props.
- QA `FAIL  No unexpected black frames`. A scene renders nothing for a stretch, usually a
  failed media load or content that never enters.
- QA `FAIL  Subtitles fit the format`. Caption line length is a format rule
  (`src/domain/formats.ts`), not something to fix by shrinking the font.
- Lint error "This layer must not depend on <layer>; dependencies point inward only." Move
  the logic to `src/domain` or pass the value in through render props.
- "Component rendered outside a SceneEnvironmentProvider". The component used `useTokens` or
  `useLayout` outside `SceneComposition`. Wrap it in its own provider built with
  `createEnvironment`, as `thumbnail/Thumbnail.tsx` does.

## Relevant project commands

```
pnpm remotion:studio
pnpm studio preview --video <id> --studio
pnpm studio preview --video <id> --scene <scene-id>
pnpm studio qa --video <id> --quality preview
pnpm studio thumbnails --video <id> --force
pnpm validate
```
