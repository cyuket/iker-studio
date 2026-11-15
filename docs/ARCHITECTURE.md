# Architecture

This document describes the code as it is. File paths are relative to the repository root.

## Layers and the dependency rule

```text
domain  <-  application  <-  infrastructure  <-  cli
   ^
   +------  remotion   (the video design system; imports domain only)
   +------  scenarios  (recording scenario definitions; import domain only)
```

Dependencies point inward only.

| Layer            | Path                 | Holds                                                         | May import              |
| ---------------- | -------------------- | ------------------------------------------------------------- | ----------------------- |
| Domain           | `src/domain`         | Zod schemas and pure rules. No I/O apart from hashing         | Only `domain`           |
| Application      | `src/application`    | Use cases, the stage runner, and the ports the use cases need | `domain`                |
| Infrastructure   | `src/infrastructure` | Adapters that implement the ports                             | `domain`, `application` |
| CLI              | `src/cli`            | Commander commands, `doctor`, and the composition root        | Everything              |
| Remotion project | `src/remotion`       | React components and compositions that draw frames            | `domain`                |
| Scenarios        | `src/scenarios`      | Declarative recording scenarios                               | `domain`                |

ESLint enforces the rule. `eslint.config.js` builds a `no-restricted-imports` rule per layer:

```js
const layerRule = (forbidden) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: forbidden.map((layer) => ({
        group: [`**/${layer}/**`, `**/${layer}`],
        message: `This layer must not depend on ${layer}; dependencies point inward only.`,
      })),
    },
  ],
});
```

It is applied as:

| Files                   | Forbidden imports                                  |
| ----------------------- | -------------------------------------------------- |
| `src/domain/**`         | `application`, `infrastructure`, `cli`, `remotion` |
| `src/application/**`    | `infrastructure`, `cli`, `remotion`                |
| `src/infrastructure/**` | `cli`, `remotion`                                  |
| `src/remotion/**`       | `application`, `infrastructure`, `cli`             |

A wrong import fails `pnpm lint`, which runs with `--max-warnings 0`. `src/scenarios` has no
rule of its own. It imports only from `domain` by convention.

The Remotion project is bundled separately by Remotion at render time and runs in a browser.
The only thing it shares with the Node pipeline is the props contract in
`src/domain/render-props.ts`.

## Directory map

```text
src/
  domain/            schemas and rules
    stages.ts          the 13 stages, their order and prerequisites
    manifest.ts        manifest schema, stage state, invalidation helpers
    script.ts          script.md and research.md parsing, lint rules
    storyboard.ts      storyboard schema and every visual kind
    formats.ts         output formats, qualities, loudness target
    voice.ts           voice settings, pronunciation rules, cache key, cost table
    captions.ts        word timings, cue building, SRT and VTT
    timeline.ts        scene durations, cut timeline, chapters
    recording.ts       scenario, step and recording-timeline schemas
    qa.ts              every QA check and the manual checklist
    redaction.ts       secret patterns, redactor, personal-data heuristics
    render-props.ts    the contract between the pipeline and Remotion
    brand.ts, metadata.ts, hash.ts, errors.ts, scene-types.ts
  application/       use cases
    pipeline.ts        runStage: the bookkeeping every stage shares
    ports.ts           interfaces to the outside world
    layout.ts          every path the studio reads or writes
    context.ts         loaders for script, research, storyboard, brand, pronunciations
    authoring.ts       create, script check, storyboard sync
    approval.ts        script and final approval
    narration.ts       narration planning, cache, synthesis, voice preview
    recording.ts       record use case and recording hash
    scene-compiler.ts  timings, captions and render hash per scene
    render.ts          motion, composition, subtitles, render; thumbnails; Studio session
    qa.ts, qa-report.ts  QA run and the HTML report
    export.ts          metadata, export package, R2, YouTube
    inspect.ts         plan, status and costs (read only)
    housekeeping.ts    caches and pronunciations
    templates.ts, template-validation.ts, storyboard-preview.ts, html.ts
  infrastructure/    adapters
    config/env.ts            environment access with lazy validation
    fs/                      atomic writes, file system, manifest repository
    media/ffmpeg.ts          FFmpeg and ffprobe
    voice/elevenlabs.ts      ElevenLabs over fetch
    voice/offline.ts         system (macOS say) and silent stand-ins
    recording/               Playwright recorder, target guard, sign-in, masks, overlay
    render/remotion-renderer.ts  bundling and rendering with @remotion/renderer
    http/                    loopback static server and asset server
    demo/targets.ts          opens the synthetic or iker target
    storage/r2-object-store.ts   Cloudflare R2 over the S3 API
    publish/youtube.ts       YouTube Data API over fetch
    logging/logger.ts        structured logger on stderr
  cli/
    main.ts            entry point, error reporting, exit codes
    container.ts       the composition root
    doctor.ts          environment checks
    commands/          setup.ts, authoring.ts, production.ts
  remotion/          Root.tsx, scenes/, components/, design/, lib/, thumbnail/
  scenarios/         synthetic.ts, iker.ts, index.ts
templates/<id>/      template.json and demo/
brand/               brand.json, pronunciations.json, logo/
fixtures/synthetic-demo/  the labelled stand-in site
tests/               unit/, integration/, e2e/, helpers/
```

## Ports and adapters

All ports are declared in `src/application/ports.ts`. Use cases depend on these interfaces
only.

| Port                 | Purpose                                                                 | Adapter                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Logger`             | Structured logging                                                      | `createLogger` in `src/infrastructure/logging/logger.ts`                                                                            |
| `Clock`              | Current time                                                            | `systemClock` in `src/cli/container.ts`                                                                                             |
| `FileSystem`         | Text, JSON, hashing, listing, copy, remove. Writes are atomic           | `createNodeFileSystem` in `src/infrastructure/fs/node-file-system.ts`                                                               |
| `ManifestRepository` | Load, save and list manifests                                           | `FileManifestRepository` in `src/infrastructure/fs/manifest-repository.ts`                                                          |
| `MediaTools`         | Probe, transcode, concat, loudness, black and silence detection, frames | `createFfmpegTools` in `src/infrastructure/media/ffmpeg.ts`                                                                         |
| `SpeechSynthesizer`  | Resolve a voice, synthesise a clip, report account usage                | `createElevenLabsSynthesizer` (`voice/elevenlabs.ts`), `createSystemSynthesizer` and `createSilentSynthesizer` (`voice/offline.ts`) |
| `DemoTargets`        | Validate and open the place a scenario runs                             | `createDemoTargets` in `src/infrastructure/demo/targets.ts`                                                                         |
| `ScenarioCatalog`    | All scenarios, and lookup by id                                         | Built in `container.ts` from `src/scenarios/index.ts`                                                                               |
| `Recorder`           | Record one scenario                                                     | `createPlaywrightRecorder` in `src/infrastructure/recording/playwright-recorder.ts`                                                 |
| `VideoRenderer`      | Render a scene or a thumbnail, and report a source hash                 | `createRemotionRenderer` in `src/infrastructure/render/remotion-renderer.ts`                                                        |
| `AssetServer`        | Map a local file to a URL the renderer can fetch                        | `startAssetServer` in `src/infrastructure/http/asset-server.ts`                                                                     |
| `ObjectStore`        | Upload, download, list, remove, signed URL                              | `createR2ObjectStore` in `src/infrastructure/storage/r2-object-store.ts`                                                            |
| `VideoPublisher`     | Publish a video                                                         | `createYouTubePublisher` in `src/infrastructure/publish/youtube.ts`                                                                 |

Each use case declares the subset of dependencies it needs as a `...Deps` interface
(`CoreDeps`, `NarrationDeps`, `RecordingDeps`, `RenderDeps`, `QaDeps`, `ExportDeps`,
`InspectDeps`). Tests build those from fakes in `tests/helpers/fakes.ts`.

## The composition root and lazy configuration

`src/cli/container.ts` is the one place that knows which adapter implements which port.
`createContainer(projectRoot)` loads `.env`, builds the configuration object, the redactor,
the logger and the dependency bundles, and returns them to the commands.

Configuration (`src/infrastructure/config/env.ts`) is split by integration: `general()`,
`elevenLabs()`, `demo()`, `r2()` and `youTube()`. Each validates only its own variables with
Zod, and only when it is called. A failure raises `CONFIG_INVALID` listing variable names and
reasons. Values are never included.

Adapters for optional integrations are created on first use:

- `synthesizer(provider)` builds the ElevenLabs client only when a video's provider is
  `elevenlabs`.
- `objectStore()` and `publisher()` are factories called inside the export use cases.
- `targets.open("iker")` reads the demo variables only when an `iker` scenario is recorded or
  inspected.

So a machine with no credentials can run everything that does not touch those services.

Two things are not lazy. `general()` is called when the container is created, so an invalid
`DEFAULT_FPS` or `LOG_LEVEL` stops every command. `REMOTION_LICENSE_KEY` is read directly from
the environment in `container.ts` and passed to the renderer.

`config.configured()` reports which integrations have their variables set without validating
them. `doctor` uses it to mark an integration as optional instead of failed.

## The manifest

Each video has `output/<id>/manifest.json`. The schema is `ManifestSchema` in
`src/domain/manifest.ts`, with `schemaVersion: 1`. There is no migration code yet. A manifest
with another version fails to parse.

It stores:

| Field                                                                                     | Content                                                                                                         |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`, `title`, `topic`, `audience`, `contentType`, `template`, `format`, `durationTarget` | Identity of the video                                                                                           |
| `script`, `storyboard`                                                                    | Version counter and content hash of each                                                                        |
| `voice`                                                                                   | Provider, voice id, model, settings and seed                                                                    |
| `render`                                                                                  | `quality` and `reducedMotion`                                                                                   |
| `stages`                                                                                  | One state per stage: `status`, `inputHash`, `attempts`, `startedAt`, `completedAt`, `error`                     |
| `assets.narration`                                                                        | Per scene: cache key, file, words file, duration, characters, provider, timing source                           |
| `assets.recordings`                                                                       | Per scenario: hash, target, display host, verified flag, files, duration, viewport                              |
| `assets.sceneRenders`                                                                     | Per `<cut>/<quality>/<scene>`: hash, file, length in frames                                                     |
| `assets.finals`                                                                           | Per `<cut>/<quality>`: hash, file, SHA-256, size, duration, subtitle and timeline paths                         |
| `assets.thumbnails`                                                                       | Variant, file and hash                                                                                          |
| `qa`                                                                                      | Per `<cut>/<quality>`: SHA-256 of the file checked, pass flag, failure and warning counts, report path          |
| `approvals`                                                                               | `script` (bound to the script hash, with an `automated` flag) and `final` per cut (bound to the file's SHA-256) |
| `usage`                                                                                   | Characters sent to a paid speech API, request count, cache hits                                                 |
| `exports`                                                                                 | Each package, R2 upload or YouTube upload, with the file's SHA-256                                              |
| `history`                                                                                 | The last 200 stage events                                                                                       |

File paths in the manifest are relative to the video directory, with forward slashes, so a
video directory can be moved.

### Atomic writes

`writeFileAtomic` (`src/infrastructure/fs/atomic.ts`) writes to a temporary file in the same
directory, calls `fsync`, and renames it over the target. A crash mid-write leaves either the
old file or the new one. `FileManifestRepository.save` also validates the manifest against the
schema before writing, so an invalid manifest cannot be persisted, and stamps `updatedAt`.

There is no locking. Two commands writing the same video's manifest at the same time can
overwrite each other's changes. Run one command per video at a time.

### Stage state machine

```text
                  inputs unchanged and completed: skip
                 +----------------------------------+
                 |                                  |
  pending --run--> running --work ok, complete-----> completed
     ^               |  |                               |
     |               |  +--work ok, partial--> pending  |
     |               +--work throws--> failed           |
     |                                    |             |
     +-----------run again----------------+             |
     +-----an upstream stage ran with new inputs--------+
```

`runStage` in `src/application/pipeline.ts` is the only code that moves a stage between
states. For each run it:

1. Skips if the stage is `completed` with the same `inputHash` and `force` is not set.
2. Throws `STAGE_BLOCKED` if a required stage is not `completed`. The hint names the command
   that completes it.
3. If the stage previously completed with a different input hash, marks every downstream
   stage `pending` (`invalidateDownstream`). Cached assets are kept.
4. Saves the stage as `running` with `attempts + 1` before any work starts, so an interrupted
   run is visible.
5. Runs the work, passing a `checkpoint` function.
6. On success saves `completed` with the new `inputHash`, or `pending` when the work reports
   `complete: false`, and appends a history event (`completed` or `partially completed`).
7. On error saves `failed` with the error code and message, on top of the latest checkpoint,
   then rethrows.

**Input hashes.** Each stage hashes what it consumes: `idea` the topic and title, `research`
the facts, `script` the parsed script, `storyboard` the cuts, `voice` the voice settings plus
every scene's cache key, `motion`, `composition` and `render` the scope plus every scene hash,
`subtitles` the cues, `qa` and `export` the SHA-256 of the files concerned, `approval` the
approvals.

**Partial runs.** A command that does only part of a stage (one scene with `--scene`, one
scenario with `--scenario`, one cut with `--cut`, or preview quality) saves its progress but
leaves the stage `pending`. `narrate` and `record` mark their stage complete only when every
required clip or recording exists. The `render` stage completes only for a whole-video
final-quality run. The `qa` stage completes only when every cut's final render passed.

**Checkpoints and resume.** Long stages call `checkpoint(manifest)` after each finished unit:
each narration clip, each recording, each rendered scene, each assembled cut, each QA'd cut.
If scene nine fails, the first eight are saved. There is no separate resume command. Running
the same command again skips every unit whose hash still matches and whose file still exists.

**Finer-grained checks than stage status.** Several stages always enter (`force: true`) and
decide per asset. Rendering does not rely on the `recording` and `voice` stage flags: the
scene compiler lists exactly which narration clips and recordings are missing and raises
`STAGE_BLOCKED` naming them. Final approval and export check the file's SHA-256 rather than
the `qa` or `approval` stage flag.

## The content-hash model

All hashes are SHA-256 over JSON with sorted keys (`hashOf` in `src/domain/hash.ts`).

### Narration cache key

`narrationCacheKey` in `src/domain/voice.ts` hashes:

- a schema `version` (1)
- the scene's text, trimmed
- the provider
- the resolved voice id and model id (after environment defaults)
- `stability`, `similarityBoost`, `style`, `speed`, `speakerBoost`, `languageCode`, `seed`
- the approved pronunciation rules that match this text (term, alias, IPA), sorted by term

When a voice performance has been selected (see [VOICE.md](VOICE.md)) the key is version 2
and also covers the preset, the text as rendered for the model (spoken wording, pauses and
tags) and the settings the model actually honours, in place of the raw settings.

Only rules for terms that appear in the text are included, so changing one dictionary entry
does not invalidate unrelated scenes. Pending entries never apply. The clip is stored in
`.cache/narration/<key>.<ext>` with a `<key>.json` entry holding duration, word timings and
timing source, then copied into the video's `audio/` directory. The cache is shared by all
videos.

### Recording hash

`recordingHash` in `src/application/recording.ts` hashes:

- `RECORDER_VERSION` (1)
- the whole scenario definition
- the target fingerprint: for `synthetic`, a hash of every file in `fixtures/synthetic-demo`;
  for `iker`, `sha256(origin)`
- the conform frame rate (30)

No account detail enters the hash or is written to disk, so changing the demo account does not
trigger a retake; changing the host does. Use `record --retake` after changing accounts.

### Scene render hash

`compileCut` in `src/application/scene-compiler.ts` hashes, per scene:

- the whole storyboard scene (visual, narration text, animation, captions, audio, lower third)
- the format spec, including any `DEFAULT_FPS` override
- the scene's length in frames
- the narration clip's cache key and start offset in frames, or null
- the caption cues, only when captions are burned in
- the recording hash, or null
- the scene's position in the progress bar, or null when `showProgress` is off
- the synthetic-footage disclosure text, or null
- `reducedMotion`
- the brand hash (`brand.json` plus the bytes of the logo files)
- the renderer hash (the Remotion version plus the SHA-256 of every file under `src/remotion`
  and `src/domain`)

It deliberately excludes file locations and URLs, so moving the project or restarting the
asset server changes nothing.

Two properties follow that are easy to miss:

- The progress position is a fraction of the cut's total length. With the bar on, any change
  to the length of one scene changes that fraction for every scene, so every scene in the cut
  re-renders. This is why `showProgress` defaults to `false`.
- Quality is part of the manifest key (`<cut>/<quality>/<scene>`) and not of the hash. The
  resolution scale from `DEFAULT_RESOLUTION` is part of the hash, so changing it re-renders
  every scene at the new size.

### Final hash

The `render` stage in `src/application/render.ts` hashes, per cut:

- the scene hashes, in order
- the music bed (SHA-256 of the file, and volume), or null
- the loudness target
- the audio bitrate

If it matches the stored final and the MP4 exists, the file is left untouched and its SHA-256,
and therefore its QA result and approval, stay valid.

## The render path

```text
storyboard.json + manifest assets
        |
        v
  scene compiler  ----------------------------  (motion stage; nothing rendered)
  timings, captions, one hash per scene
        |
        |  for each scene whose hash changed
        v
  Remotion "Scene" composition  --------------  (composition stage)
  scenes/<cut>/<quality>/<scene>.mkv   H.264 video + PCM audio
        |
        |  SRT and VTT written per cut  ------  (subtitles stage)
        v
  FFmpeg concat demuxer  ---------------------  (render stage)
  pass 1: measure loudness of the whole programme
  pass 2: copy video, apply one fixed gain, encode AAC
        |
        v
  final/<id>-<cut>.mp4   or   preview/<id>-<cut>.mp4
```

1. **Scene compiler.** `compileCut` reads the measured duration of each narration clip and
   recording from the manifest and computes the length of each scene:
   `leadInSeconds + max(narration, recording) + tailSeconds`, at least `minDurationSeconds`,
   or 3 seconds for a scene with neither. It builds caption cues from word timings and
   produces the scene hash. `scenes/<cut>/timeline.json` is written here.
2. **Per-scene segments.** `renderScene` in `remotion-renderer.ts` selects the `Scene`
   composition and renders it with `codec: "h264-mkv"`, `audioCodec: "pcm-16"`,
   `enforceAudioTrack: true`, `yuv420p` and BT.709. Audio in segments is uncompressed because
   AAC adds padding to every file, which would accumulate as drift and clicks at each join.
   One bundle and one browser are shared by all renders in a command.
3. **Concat and loudness.** `concat` in `ffmpeg.ts` joins segments with the concat demuxer and
   copies the video stream without re-encoding. Loudness is normalised in two passes: the
   first measures the whole programme with `loudnorm`, the second applies a single linear
   gain from those measurements and encodes AAC at 48 kHz stereo with `+faststart`. Single-pass
   `loudnorm` adjusts gain continuously and pumps under speech. A fully silent track skips
   normalisation. An optional music bed is looped, attenuated and mixed before normalisation.
4. **Output.** The MP4 is probed and its SHA-256 recorded in the manifest.

The `Cut` composition (`src/remotion/scenes/CutComposition.tsx`) plays every scene back to
back. It exists for review in Remotion Studio (`preview --studio`) and is not used for
production renders.

### Why scenes begin and end on a bare background

Scenes are rendered separately and joined with hard cuts. A cross-fade or shared transition
would need frames from two scenes at once, which would make each segment depend on its
neighbours and break per-scene caching. Instead, every scene opens on the plain background
with nothing on it, and all content fades back to the plain background by the last frame
(`sceneTiming` and `exitOpacity` in `src/remotion/design/motion.ts`). The cut between two
scenes is therefore a cut between two identical frames, and is invisible.

The progress bar and the synthetic-footage disclosure label sit outside the fading layer
(`SceneComposition.tsx`) so they hold steady across the join.

### The asset server

Remotion loads media over HTTP. `startAssetServer` serves the video directory and `brand/` on
`127.0.0.1` at a random port, with Range support, and `urlFor` turns an absolute path into a
URL under one of those two mounts. A path outside them is refused. This avoids copying large
recordings into the bundle's public folder on every render. Because URLs contain a random
port, they are excluded from scene hashes.

Fonts are not served this way. They are bundled from `@fontsource` packages
(`src/remotion/fonts.ts`), and rendering is blocked until every face has loaded. If a bundled
font fails to load the render is cancelled instead of falling back silently.

### Captions and timing

Captions come from word timings stored next to each narration clip
(`audio/<scene>.words.json`).

- **Provider alignment.** ElevenLabs is called on its `with-timestamps` endpoint, which
  returns start and end times per character. `wordsFromAlignment` groups them into words. The
  clip is recorded with `timing: "provider"`. Pronunciation rules are sent as an ElevenLabs
  pronunciation dictionary instead of rewriting the text, so the timings stay aligned with the
  script as written.
- **Estimated timing.** The `system` and `silent` voices return no timing.
  `estimateWordTimings` shares the clip's measured duration between words in proportion to
  word length, with extra weight after punctuation. The clip is recorded with
  `timing: "estimated"`, and QA reports it as a warning.

`buildCues` groups words into cues that fit the format's line length and line count, break at
sentence ends, and last at most 6 seconds. Cues are offset by the scene's lead-in and start
frame to produce the cut's SRT and VTT. Burn-in is decided per cut: `burnCaptions` in the
storyboard, or the format default when it is null.

## Recording design

The recorder (`src/infrastructure/recording/`) plays a declarative scenario in Chromium with
Playwright.

- **Scenarios are data.** A scenario (`ScenarioSchema` in `src/domain/recording.ts`) is a list
  of steps: `navigate`, `authenticate`, `click`, `type`, `select`, `scroll`, `waitFor`,
  `waitForState`, `highlight`, `screenshot`, `mask`, `verify`, `dwell`. Elements are found by
  role, label, test id, text or placeholder. There is deliberately no CSS selector option.
  Locators are strict: a target that matches two elements fails.
- **Target guard.** `assertSafeRecordingTarget` (`target-guard.ts`) runs before a browser
  opens. An `iker` target must be `https` (plain `http` only for loopback, such as a local
  copy at `http://localhost:3000`), must not embed credentials, and must not be `useiker.com`,
  any subdomain of it, or a host in `IKER_PRODUCTION_HOSTS`. Iker has no Sandbox mode, so
  there is no opt-in for a production host. A `synthetic` target must be loopback. Scenario paths
  are resolved against the checked origin, and a path that leaves it is refused (`urls.ts`).
- **Off-camera sign-in.** If a scenario contains an `authenticate` step, `signIn`
  (`sign-in.ts`) runs before the capture starts, through the web app's sign-in form. If the
  account asks for a second factor the recording aborts. Preflight then visits each page the
  scenario depends on and checks its key elements exist. Leading `navigate`, `waitFor`,
  `waitForState` and `mask` steps also run before the capture (`off-camera.ts`), so the video
  opens on a settled page.
- **Capture.** `page.screencast` (`capture.ts`) is used instead of the browser context's
  `recordVideo`, because it can be started after sign-in on the same page and records at a
  chosen frame rate. The raw WebM is transcoded to constant 30 fps H.264 with a keyframe every
  second so the renderer can seek exactly.
- **In-page cursor.** Browser captures contain no operating-system cursor. An injected script
  (`overlay-script.ts`) draws a cursor, click ripples and highlight rings inside the page, so
  they are part of the recorded pixels. In a storyboard scene with `mode: "screenshot"`, the
  renderer instead animates a drawn cursor over the still from the timeline events
  (`showCursor`).
- **Timeline sidecar.** `timeline.json` is written next to each recording: for each step, its
  action, start and end time, the element's bounds as viewport fractions, and a label. Typed
  text is never written to it.
- **Masks.** A `mask` step blurs matching elements for the rest of the recording. The mask is
  re-applied after navigations and when the page adds content (`masks.ts`).
- **Pacing.** Every duration the recorder controls is fixed (`pacing.ts`), so the same
  scenario gives the same video. Application state is always awaited through an element or
  page condition, never a fixed delay. `dwell` is pacing for the viewer.
- **Failures.** On failure the recorder writes `debug/failure.png` (password fields masked)
  and `debug/failure.txt`, deletes the partial capture, and raises `RECORDING_FAILED`. It
  writes no trace, HAR or console dump, because those capture cookies and tokens.

Recordings of the synthetic fixture are labelled twice: the fixture's own banner is in the
recorded pixels, and the renderer stamps "SYNTHETIC DEMO · SIMULATED DATA, NOT THE LIVE
PRODUCT" on every frame of a scene whose recording has `target: "synthetic"`.

## QA design

`runQa` (`src/application/qa.ts`) gathers measurements and passes them to `evaluateQa`
(`src/domain/qa.ts`), a pure function that returns a list of checks. Each check is `pass`,
`warn`, `fail` or `manual`. QA passes when there are no failures.

Automated checks:

| Check id                | What it measures                                                                                       | Worst result |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| `missing-assets`        | Every narration clip, recording, screenshot and listed asset exists                                    | fail         |
| `video-metadata`        | MP4 container, H.264, `yuv420p`, AAC, expected frame rate, both streams present                        | fail         |
| `aspect-ratio`          | Width over height matches the format                                                                   | fail         |
| `resolution`            | Pixel size matches the render settings                                                                 | fail         |
| `black-frames`          | FFmpeg `blackdetect` finds no near-true-black stretch of 0.5 s or more                                 | fail         |
| `silence`               | No silence longer than 3.5 s outside scenes that are silent by design                                  | fail         |
| `audio-levels`          | True peak at or below -1 dBTP (fail above), integrated loudness within 1.5 LU of -14 LUFS (warn)       | fail         |
| `narration-overflow`    | Narration ends inside its scene                                                                        | fail         |
| `subtitle-overflow`     | No caption line exceeds the format's line length or line count                                         | fail         |
| `scene-transitions`     | No scene has `animation.enter: "none"`                                                                 | warn         |
| `recordings`            | Each recording is readable and at least one second long                                                | fail         |
| `duration`              | File length matches the timeline (fail), is under the format maximum (fail), within the target (warn)  | fail         |
| `branding`              | A logo is configured, a title, CTA or outro scene exists, no placeholder brand asset is in use         | warn         |
| `cta`                   | The cut has a CTA scene                                                                                | fail         |
| `script-approval`       | The current script is approved by a person (not by automation) and the storyboard is in sync           | fail         |
| `sensitive-information` | No secret pattern, configured secret value, non-synthetic email or valid card number in text artefacts | fail         |
| `footage-provenance`    | Footage is not synthetic and comes from a verified scenario                                            | warn         |
| `voice-provenance`      | The voice is ElevenLabs, timing is from the provider, pronunciations are approved                      | warn         |

Manual checks, and why they are manual:

- `safe-areas` always has status `manual`. The design system lays scenes out inside the safe
  area, but nothing analyses rendered pixels. QA extracts one frame per scene at 60% of its
  length, draws the safe-area rectangle on it, and assembles a contact sheet for a person.
- The report ends with `MANUAL_REVIEW_CHECKLIST`: accuracy against research, pronunciation,
  caption sync, absence of real customer data in footage, labelling of synthetic footage,
  safe areas, pacing and hierarchy, honest title and thumbnail, and music licensing. Software
  cannot judge these.
- Recorded pixels are not scanned. The sensitive-information check reads only `script.md`,
  `storyboard.json`, the cut's SRT, `metadata.md` and recording timelines.

`manual` is never counted as a pass. A QA result is stored against the SHA-256 of the file it
checked, so a re-render makes it stale. `runQa` checks that every selected cut has a render at
the requested quality before it enters the stage, so asking for QA too early raises
`STAGE_BLOCKED` without marking the `qa` stage failed.

A silence longer than 3.5 seconds is a failure only where narration was expected. Inside a
product scene that plays a recording longer than its narration it is a warning ("plays Ns of
recording with no narration"), and with the `silent` voice the whole check is a warning.

## Key trade-offs and decisions

**No database.** A video is a directory of files and one JSON manifest. This keeps the tool
usable from a fresh clone, makes state reviewable in a pull request, and lets Git recover a
damaged manifest. The cost is no concurrency control and no queries across videos beyond
listing directories.

**Segments and concat instead of a single render.** Rendering each scene to its own segment
means one changed scene costs one scene of render time, and a failed render keeps earlier
scenes. The costs are the constraints described above: scenes must start and end on the bare
background, there are no cross-scene transitions, segment audio must be uncompressed, and
anything that spans the cut (the progress bar) couples scenes together, which is why the
progress bar is opt-in.

**fetch-based ElevenLabs and YouTube clients instead of SDKs.** Each client uses a handful of
endpoints. Calling them with `fetch` keeps the dependency list short, makes the HTTP layer
injectable (`fetch` is an option on both adapters), and keeps retry and error mapping in our
own code. The cost is that API changes are not absorbed by an SDK update. R2 does use the AWS
SDK, because request signing is not worth reimplementing.

**TypeScript 6.0.** `typescript` is pinned to `6.0.3` because `typescript-eslint` does not
support TypeScript 7 yet (the installed `typescript-eslint` 8.71.1 declares the peer range
`>=4.8.4 <6.1.0`), and the lint configuration uses type-checked rules (`strictTypeChecked`).

**Zod pinned to the version Remotion expects.** `zod` is pinned to `4.5.4`, the exact
version that `@remotion/studio` 4.0.534 depends on. Upgrade them together. All dependencies are
pinned to exact versions (`save-exact=true` in `.npmrc`).

**Approvals bound to hashes.** An approval names what was approved by hash, not by stage. An
edit or re-render cannot inherit an approval.

**Automated approvals are a separate, weaker thing.** A script approval carries an `automated`
flag. `approve --stage script --automated` sets it to `true`, to let tools and tests exercise
the pipeline without pretending a review happened. An automated approval unlocks only the
`system` and `silent` voices. `narrate` refuses it for ElevenLabs
(`src/application/narration.ts`), `approveFinal` refuses any cut whose script approval is
automated (`src/application/approval.ts`), which in turn blocks export and publishing, and the
QA check `script-approval` fails on it (`src/domain/qa.ts`). A final approval is always
recorded with `automated: false`, and the CLI rejects `--automated` for `--stage final`.

**Offline stand-in voices.** `system` and `silent` exist so the whole pipeline can run without
spending credits, including in CI. Everything they produce is labelled as a stand-in in QA.

## Extension points

### Add a recording scenario

1. Add a `defineScenario({...})` to `src/scenarios/synthetic.ts` or `src/scenarios/iker.ts`.
   `defineScenario` validates it at import time.
2. Add it to the exported list so `src/scenarios/index.ts` includes it.
3. Set `status: "unverified"` until it has been run end to end against its target, and record
   where the selectors came from in `evidence`.
4. Reference it from a storyboard scene with `visual.kind: "product"` and its `scenarioId`.

See [VIDEO-AUTHORING.md](VIDEO-AUTHORING.md#adding-a-recording-scenario).

### Add a visual kind

1. Add a Zod object with a new `kind` literal to `src/domain/storyboard.ts` and include it in
   `SceneVisualSchema`.
2. Add a component under `src/remotion/components/` that lays itself out with the layout and
   token hooks in `src/remotion/design/`.
3. Add a `case` to the `switch` in `src/remotion/scenes/SceneRenderer.tsx`. The switch is
   exhaustive, so the type checker reports a missing case.
4. Add a sample to `src/remotion/sample-props.ts` if you want to see it in Remotion Studio.

Changing `src/domain` or `src/remotion` changes the renderer hash, so every existing scene
re-renders once.

### Add a format

Add an id to `FORMAT_IDS` and a spec to `FORMATS` in `src/domain/formats.ts`: size, frame
rate, orientation, safe area, caption layout and maximum duration. The script parser, the
storyboard schema and the CLI pick it up from there. Recordings are always conformed to 30 fps.

### Add a template

Create `templates/<id>/template.json` (schema `TemplateSchema` in
`src/application/templates.ts`) and a `demo/` directory with `script.md`, `research.md` and
`storyboard.json`. The directory name must equal the template's `id`, and it needs exactly
three `thumbnailVariants`. Run `pnpm studio templates validate`.

### Add a voice provider

1. Add the id to `VOICE_PROVIDERS` in `src/domain/voice.ts`, and its rate to
   `CREDITS_PER_CHARACTER` if it is billed that way.
2. Implement `SpeechSynthesizer` under `src/infrastructure/voice/`. Return `alignment: null`
   if the provider has no timings, and timing will be estimated.
3. Add its variables to `src/infrastructure/config/env.ts` and `.env.example`, and its secret
   to `SECRET_VARIABLES`.
4. Wire it in the `synthesizer` factory in `src/cli/container.ts`.

`estimateSynthesisCost` treats every provider other than `elevenlabs` as free, and QA treats
every provider other than `elevenlabs` as a stand-in. Both need changing for a second paid
production voice.
