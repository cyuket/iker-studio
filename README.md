# Iker Video Studio

A TypeScript command-line tool that turns a written script into a recorded, narrated,
rendered and checked video for Iker. You run it as `pnpm studio <command>`.

Iker is booking, manual-payment tracking and bookkeeping for Nigerian service businesses:
salons, photographers, tutors and similar. Its tagline is "Get booked. Get paid." The videos
this studio makes are for the owners and staff who run those businesses.

The local folder may be called `Iker-studio`. The package is called `iker-video-studio`.
Provenance: this repository was cloned from `todenhq/toden-video-studio` and rebranded for
Iker; the pipeline, gates and commands are unchanged.

## What it is and what it is not

It is:

- A CLI. Every step is a command, and every command works without an AI assistant running.
- A pipeline with state on disk. Each video is a directory under `output/` holding a
  `manifest.json` that records which stages ran, against which inputs, and what they produced.
- Incremental. Narration, recordings and rendered scenes are identified by content hashes, so
  a change regenerates only what depends on it.
- Gated. Narration needs a person's approval of the script. Export and publishing need a
  person's approval of the exact rendered file.

It is not:

- A web application. There is no dashboard and no server to deploy.
- Backed by a database. State is local JSON files, written atomically.
- A script writer. A person (or Claude Code, directed by a person) writes `script.md`. The
  tool validates it, lints it and builds everything else from it.
- A publisher by default. Uploading to YouTube is off until four separate conditions hold.
  See [Publishing](#optional-publish-to-youtube).

## How it works in 60 seconds

A video moves through 13 stages, defined in `src/domain/stages.ts`. `pnpm studio status
--video <id>` shows where a video is, and `pnpm studio plan --video <id>` shows what is out of
date and which command to run next.

| #   | Stage             | Command that runs it    | What happens                                                                                  |
| --- | ----------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Idea              | `create`                | Creates the video directory, manifest, `script.md` and `research.md`                          |
| 2   | Research          | manual, then `script`   | You record verified facts in `research.md`. The stage is marked done when the script passes   |
| 3   | Script            | `script`                | Parses and lints `script.md`, estimates duration, records the script hash                     |
| 4   | Storyboard        | `storyboard`            | Syncs `storyboard.json` with the script, validates it, writes `storyboard.html`               |
| 5   | Product recording | `record`                | Plays each recording scenario in Chromium and captures video, stills and a timeline           |
| 6   | Voice generation  | `narrate`               | Generates one audio clip per narrated scene. Requires an approved script                      |
| 7   | Motion design     | `preview` or `render`   | Computes exact scene timings, captions and one render hash per scene. Nothing is rendered yet |
| 8   | Video composition | `preview` or `render`   | Renders each scene whose hash changed as a separate segment with Remotion                     |
| 9   | Subtitles         | `preview` or `render`   | Writes an SRT and a VTT file per cut                                                          |
| 10  | Render            | `preview` or `render`   | Joins the segments with FFmpeg and normalises loudness into one MP4 per cut                   |
| 11  | Quality review    | `qa`                    | Runs automated checks on the MP4 and writes an HTML report with a manual checklist            |
| 12  | Approval          | `approve --stage final` | A named person approves the exact file that passed QA                                         |
| 13  | Export            | `export`                | Packages the approved cut with subtitles, thumbnails, metadata and checksums                  |

There are two human gates:

1. **Script approval** (`approve --stage script`), before any narration is generated. The
   approval is bound to the script's hash, so any edit to `script.md` voids it.
2. **Final approval** (`approve --stage final`), before export or publishing. The approval is
   bound to the SHA-256 of the rendered file, so any re-render voids it.

`preview` renders at half resolution into `preview/`. `render` renders at full resolution into
`final/`. Only a full-quality render of every cut completes stage 10, and only QA of final
renders completes stage 11.

## Requirements

| Requirement | Version                                  | Notes                                                                 |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Node.js     | 22.12 or newer. 24 LTS is recommended    | `.nvmrc` pins 24. `.npmrc` sets `engine-strict=true`                  |
| pnpm        | 9 (`packageManager` is `pnpm@9.15.0`)    | `corepack enable` installs the pinned version                         |
| FFmpeg      | Any recent build that includes `libx264` | `ffmpeg` and `ffprobe` must be on `PATH`                              |
| Git         | Any recent version                       | Used for the default approver name and to check `.env` is not tracked |
| Chromium    | Installed by `pnpm studio init`          | Playwright Chromium records; Remotion's Chrome Headless Shell renders |
| macOS       | Optional                                 | Only the `system` stand-in voice needs it (it uses the `say` command) |

Supported platforms are macOS on Apple Silicon for local work and Linux for GitHub Actions
runners. Windows has not been tried.

## Install and first run

```bash
# 1. FFmpeg
brew install ffmpeg                                        # macOS
sudo apt-get update && sudo apt-get install -y ffmpeg      # Debian or Ubuntu

# 2. Node and pnpm
nvm install            # reads .nvmrc; any Node >= 22.12 works
corepack enable

# 3. Dependencies, local configuration and browsers
pnpm install
pnpm studio init       # creates .env from .env.example, output/ and .cache/, installs both browsers
pnpm studio doctor     # checks everything a render depends on
```

`pnpm studio init` runs `pnpm exec playwright install chromium` and then asks Remotion to
download Chrome Headless Shell. On a fresh Linux machine Chromium also needs system libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

`pnpm studio doctor` prints one line per check. `ok` means ready, `FAIL` comes with a `Fix:`
line, and `--` marks an optional integration that is not configured:

```text
ok    Node.js: v24.13.1
ok    FFmpeg H.264 encoder: libx264 available
ok    Recording browser: Playwright Chromium installed
ok    Recording scenarios: <n> defined, <m> not yet verified against their target
--    ElevenLabs: not configured; needed for production narration
--    Iker demo environment: not configured; needed to record the real product

Ready. Integrations marked -- are optional and can be added later.
```

(Output shortened and illustrative; the scenario counts depend on what is defined. Run
`pnpm studio scenarios` for the real list.) Doctor exits non-zero if any check fails.

## Quickstart without credentials

This produces a real preview video using a template's finished demo script, the bundled
synthetic fixture and an offline stand-in voice. It needs no API key and no demo account.

Use `--voice-provider system` on macOS (speech from the built-in `say` command) or
`--voice-provider silent` on Linux (silence of the estimated length).

```bash
pnpm studio create --topic "Record a client's deposit" --id first-video \
  --template product-tutorial --voice-provider system --demo
pnpm studio script --video first-video
pnpm studio storyboard --video first-video
pnpm studio approve --video first-video --stage script --automated --by "Your Name"
pnpm studio record --video first-video
pnpm studio narrate --video first-video
pnpm studio preview --video first-video
pnpm studio qa --video first-video --quality preview
```

| Command      | What it produces                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`     | `output/first-video/` with `manifest.json`, and the template demo's `script.md`, `research.md` and `storyboard.json`                                           |
| `script`     | No new files. Prints words and estimated duration per cut and any lint issues, and records the script hash in the manifest                                     |
| `storyboard` | Rewrites `storyboard.json` in sync with the script and writes `storyboard.html`, a page you can open to review every scene                                     |
| `approve`    | Records in the manifest that the script was passed by automation, not reviewed (`approvals.script.automated: true`). See the note below                        |
| `record`     | `recordings/<scenario>/recording.mp4`, `timeline.json` and `screenshots/*.png` for each scenario the storyboard uses. The fixture is served on `127.0.0.1`     |
| `narrate`    | `audio/<scene>.wav` and `audio/<scene>.words.json` for each narrated scene                                                                                     |
| `preview`    | `scenes/<cut>/preview/<scene>.mkv` segments, `subtitles/<cut>.srt` and `.vtt`, and `preview/first-video-<cut>.mp4` at half resolution (960x540 for a 16:9 cut) |
| `qa`         | `qa/<cut>-preview/report.html`, `report.json`, `contact-sheet.png` and one frame per scene                                                                     |

Open `output/first-video/qa/full-preview/report.html` in a browser to see the result.

**About the `approve` line.** Narration needs an approval of the current script, even for a
stand-in voice. There are two honest ways to give it here:

- If you are only exercising the pipeline and have not reviewed the script, use `--automated`
  as shown. An automated approval unlocks the `system` and `silent` stand-in voices and nothing
  else. ElevenLabs narration, final approval, export and publishing all refuse it, and the QA
  check `script-approval` fails with "The script was approved by automation to exercise the
  pipeline. A person has not reviewed it."
- If you have actually read `output/first-video/script.md` against `research.md` and accept it,
  drop `--automated` and `--by`. The approval is then recorded in your name from
  `git config user.name`.

What to expect from QA on this run. With `--automated`, each cut reports one failure,
`script-approval`, by design, and `qa` exits non-zero. With a person's approval that check
passes. Either way the report warns that the footage is a synthetic demo, that the voice is a
stand-in, that caption timing is estimated, and that any product term whose pronunciation has
not been approved is still pending. With the `silent` voice it also warns that the track is silent. A stand-in voice and
synthetic footage are for checking the pipeline. They are never the finished video.

This exact sequence has not been run for Iker yet. The same steps are exercised by
`tests/e2e/synthetic-pipeline.test.ts` with the `silent` voice.

### No example video yet

`output/` is empty. No Iker video has been created, recorded, narrated or rendered in this
repository so far. The first one will appear under `output/<id>/` with its `script.md`,
`research.md`, `storyboard.json` and `manifest.json` tracked in Git and its media ignored.

## From one idea to a video with Claude Code

The `/iker` skill ([.claude/skills/iker/SKILL.md](.claude/skills/iker/SKILL.md)) takes one full
idea and makes the video in your Claude Code conversation. It runs every `pnpm studio` command
itself: research, script, storyboard, recording, narration, preview, render, QA and the local
export. You do not type any commands. The CLI itself never needs Claude.

Open Claude Code in this repository and type:

```
/iker <your full idea: the pain, who it is for, the angle, the length or platform>
```

To continue a video it started, type `/iker <video-id>`.

It stops and asks you twice, with Approve / Improve / Stop here buttons:

1. **Script.** It opens the storyboard preview and script, shows the narration, each cut's
   length and the ElevenLabs cost. Approve, or write what to change and it revises and asks again.
2. **Final video.** It opens each rendered cut and its QA report and lists the warnings and what
   you should check by eye and ear. Approve, or say what to fix.

When you choose Approve, it records the approval in your name (your `git user.name`) with a note
that you gave it in a Claude Code conversation. Nothing is approved unless you click Approve at
that gate. After the final approval it exports the local package to `output/<id>/export/`.

It narrates with ElevenLabs when `pnpm studio doctor` shows it configured, otherwise with the
`system` stand-in voice. If the local slot-books demo at `http://localhost:3000` is not running,
it asks whether you will start it or whether to use synthetic footage or illustrations. It never
publishes or uploads (ask separately for that) and never commits.

To be walked through one stage at a time instead, with a pause at each human gate, use the
`video-director` skill: `/video-director <id or topic>`.

## Production workflow for a real video

Run `pnpm studio plan --video <id>` at any point. It prints what is stale, what narration will
cost and the next command.

### 1. Create and research

```bash
pnpm studio templates list
pnpm studio create --topic "Stop chasing deposits in your DMs" --id deposits-explainer \
  --template business-explainer --type BUSINESS_EDUCATION \
  --audience "Owners of salons, studios and tutoring businesses in Nigeria"
```

Without `--demo` you get a skeleton `script.md` whose prompts are `TODO:` lines. They fail the
lint on purpose until you replace them. The voice provider defaults to `elevenlabs`.

Write verified facts into the front matter of `output/<id>/research.md`. Each fact needs an id,
a statement and a source someone else can check. Start from `knowledge/`:
`knowledge/product-facts.md` holds product facts with sourced ids, `knowledge/audience-and-voice.md`
describes who the videos are for and how they should sound, and `knowledge/source/` keeps copies
of the product documents they were taken from. Anything not there must be checked in the Iker
web app repository (`slot-books`: `PRODUCT.md`, `CLAUDE.md`, `docs/Iker_PRD.md`) before it goes
into a script. See [docs/VIDEO-AUTHORING.md](docs/VIDEO-AUTHORING.md).

### 2. Script

Write `output/<id>/script.md`, then:

```bash
pnpm studio script --video <id>
```

Errors (banned phrases, placeholders, a claim citing an unknown fact, a cut without a CTA, not
exactly three title candidates) block the pipeline. Warnings (unsupported absolute or
quantified claims, duration outside the target) do not.

### 3. Storyboard

```bash
pnpm studio storyboard --video <id>
```

The script owns which scenes exist, their order and their narration. The storyboard owns how
each scene looks. Edit visuals in `storyboard.json`, run `storyboard` again to validate, and
review `storyboard.html`. To record the real product instead of the fixture, change a product
scene's `scenarioId` to one of the `iker-*` scenarios listed by `pnpm studio scenarios`.

Scenes can be directed as a film rather than a set of slides: `cues` tie what happens on
screen to the words being spoken, `direction` records what each scene is for, motion-graphic
kinds (`identity-story`, `network`, `pipeline`, `decision`, `timeline`, `story`,
`transformation`) draw the explanation, and a product scene can carry a virtual `camera` and
a `prelude` that hands a graphic over to real footage. See
[docs/MOTION-DESIGN.md](docs/MOTION-DESIGN.md).

A `photo` scene shows a real photograph from `assets/images/` (catalogued with its source and
licence in `assets/images/README.md`) with a slow zoom or pan and an optional caption:
`"visual": { "kind": "photo", "file": "salon-braiding-client.jpg", "alt": "A stylist braiding a client's hair", "caption": "Mid-braid, the phone keeps buzzing" }`.
Add your own photos there as `own-<description>.jpg`. Photos are not committed to Git.

### 4. Human gate 1: approve the script

```bash
pnpm studio approve --video <id> --stage script
```

A person reads `script.md` against `research.md` and then runs this. Editing the script
afterwards voids the approval.

`approve --stage script --automated` exists for tools and tests that need to exercise the
pipeline. It is not a review and is recorded as such. It unlocks stand-in voices only. Paid
narration, final approval, export and publishing all require the plain form above, run by a
person. There is no automated form of final approval.

### 5. Record

```bash
pnpm studio record --video <id>
pnpm studio record --video <id> --scenario <iker-scenario-id> --retake --headed
```

`iker` scenarios record the real Iker web app. Iker has no Sandbox mode, so there is exactly
one safe thing to record: an environment that holds only demo data. Use either

- a local copy of the web app from the `slot-books` repository, running at
  `http://localhost:3000` with demo data set up for recording (its `supabase/seed.sql` only
  creates a local Super Admin, so the demo business and its records must be added), or
- a dedicated staging host (`https://staging.iker.example` is the example used in these docs).

The production web app, `useiker.com`, and every one of its subdomains are always refused.
There is no opt-in. Add any other host that holds real businesses' records to
`IKER_PRODUCTION_HOSTS` and it is refused too. Plain `http` is accepted only for `localhost`
and `127.0.0.1`.

`iker` scenarios need `IKER_DEMO_BASE_URL` and a way to sign in: either `IKER_DEMO_USERNAME`
and `IKER_DEMO_PASSWORD` with `IKER_DEMO_AUTH=password` (a demo business account without
two-factor authentication), or a saved session with `IKER_DEMO_AUTH=session`.
The recorder does no on-page business or environment check for Iker: safety comes only from
the host guard above, so point `IKER_DEMO_BASE_URL` only at an environment that holds demo
data and nothing else.

#### Signing in yourself and saving the session

For an account that does not sign in with a password (for example a magic link), sign in
yourself, once:

```bash
# in .env
IKER_DEMO_BASE_URL=http://localhost:3000
IKER_DEMO_AUTH=session

pnpm studio demo-login
```

`demo-login` opens a normal Chrome window on `/login` of `IKER_DEMO_BASE_URL` and waits. Sign
in as the demo business. It finishes once the browser reaches a signed-in page (anything other
than `/`, `/login`, `/auth/*` or `/choose-location`). The session is saved to `~/.config/iker-video-studio/demo-session.json`,
readable only by you. The browser profile it used lives in
`~/.config/iker-video-studio/demo-browser-profile`, which you can delete at any time. If the
session expires, run `demo-login` again.

To write a scenario against what a page really shows, read its accessibility tree. The
command prints the page URL, then the tree:

```bash
pnpm studio demo-snapshot --path /bookings
pnpm studio demo-snapshot --path /services --open "tab:<tab name>"
```

`--open` is for tabs and dialogs only. Never name a control that saves.

### 6. Choose the voice and check pronunciations

```bash
pnpm studio preview-voice --video <id>                 # speaks the script's hook
pnpm studio pronunciation list
pnpm studio preview-voice --video <id> --term Iker     # hear one term in a sentence
pnpm studio pronunciation set --term Iker --alias "EE-ker"
pnpm studio pronunciation approve --term Iker
```

The alias above is an example of the syntax, not a confirmed pronunciation of "Iker". A rule takes effect only
after it is approved, and that applies to previews too. See
[docs/VIDEO-AUTHORING.md](docs/VIDEO-AUTHORING.md#pronunciation-workflow). With ElevenLabs,
every preview that is not already cached spends credits. Previews are limited to 400
characters.

To direct the performance rather than accept the model's default reading:

```bash
pnpm studio voice direct --video <id>      # draft voice-direction.json from the script
pnpm studio voice report --video <id>      # check it and write the direction report
pnpm studio voice audition --video <id>    # short samples of one passage across presets
pnpm studio voice select --video <id> --preset <preset>   # a person records their choice
```

Full narration is not generated under a preset until a person has listened and selected one,
and wording that differs from `script.md` is spoken only once the script approval covers it.
See [docs/VOICE.md](docs/VOICE.md).

### 7. Narrate

```bash
pnpm studio narrate --video <id> --dry-run    # what would be generated and what it would cost
pnpm studio narrate --video <id>
```

This fails with `APPROVAL_REQUIRED` until the current script is approved.

### 8. Preview, then render

```bash
pnpm studio scene-review --video <id>         # key frames, a clip per scene, direction problems
pnpm studio preview --video <id>              # half resolution, fast
pnpm studio preview --video <id> --studio     # open the cut in Remotion Studio
pnpm studio render --video <id>               # full resolution, plus three thumbnail candidates
```

`scene-review` writes `output/<id>/review/<cut>/index.html` with every scene's beginning,
each cue and its ending, a contact sheet and a short clip. Look at it before a full render: a
scene that rendered without errors has not been reviewed.

### 9. QA

```bash
pnpm studio qa --video <id>
```

Exits non-zero if any check fails. Open the report, watch the video with sound on, and work
through the manual checklist. Automated checks cannot judge accuracy or design.

### 10. Human gate 2: approve the final render

```bash
pnpm studio approve --video <id> --stage final
pnpm studio approve --video <id> --stage final --cut full --acknowledge-warnings --note "Reviewed with the product lead"
```

Approval is refused unless the cut has a final render, QA ran on that exact file, and QA
passed. If QA reported warnings you must pass `--acknowledge-warnings`.

### 11. Export

```bash
pnpm studio metadata --video <id>             # optional: preview titles, description, chapters
pnpm studio export --video <id>
pnpm studio export --video <id> --r2 --signed-url 3600
```

`export` writes `output/<id>/export/<cut>/` containing the MP4, SRT, VTT, thumbnails,
`metadata.md`, `metadata.json`, `qa-report.json` and `SHA256SUMS`. That folder is everything
needed to publish by hand. `--r2` also uploads it to a private Cloudflare R2 bucket under
`videos/<id>/<cut>/`.

### Optional: publish to YouTube

Publishing is off by default. All four of these must be true:

1. `YOUTUBE_PUBLISHING_ENABLED=true` is set, with `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
2. The cut's current final render is approved.
3. You repeat the video id with `--confirm`.
4. This machine has been authorised once with `pnpm studio publish-auth`.

```bash
pnpm studio publish-auth
pnpm studio publish --video <id> --cut full --confirm <id>
pnpm studio publish --video <id> --cut full --confirm <id> --title 2 --privacy unlisted --thumbnail statement
```

Uploads are `private` unless you pass `--privacy`. The YouTube adapter has never been run
against the live API. See [Current status](#current-status-and-known-limitations).

## Command reference

Add the global `--json` flag before the command name to get the result as JSON on stdout
(`pnpm -s studio --json status --video <id>`). Logs always go to stderr. Exit codes: `0`
success, `1` the command failed, `2` the command was used incorrectly. Run
`pnpm studio <command> --help` for every option.

| Command                                                              | What it does                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**                                                            |                                                                                                                                                                                                                   |
| `init [--skip-browsers]`                                             | Creates `.env`, `output/` and `.cache/`, and installs the recording and rendering browsers                                                                                                                        |
| `doctor`                                                             | Checks that this machine can record, narrate and render                                                                                                                                                           |
| `templates list`                                                     | Shows the available templates and their cuts                                                                                                                                                                      |
| `templates validate`                                                 | Validates every template and its demo script and storyboard                                                                                                                                                       |
| `scenarios`                                                          | Lists the recording scenarios and whether each has been verified                                                                                                                                                  |
| **Authoring**                                                        |                                                                                                                                                                                                                   |
| `create --topic <topic>`                                             | Starts a new video. Options: `--id`, `--title`, `--audience`, `--type`, `--template`, `--voice-provider`, `--demo`                                                                                                |
| `plan --video <id>`                                                  | Shows what is out of date, which stages must run and what narration will cost. `--quality`                                                                                                                        |
| `status [--video <id>]`                                              | Lists all videos, or shows one video's stages, cuts and next command                                                                                                                                              |
| `script --video <id>`                                                | Validates and lints `script.md` and estimates duration                                                                                                                                                            |
| `storyboard --video <id>`                                            | Syncs and validates the storyboard and writes `storyboard.html`. `--disable` and `--enable` toggle scenes                                                                                                         |
| `approve --video <id> --stage <stage>`                               | Records a named person's approval of the `script` or the `final` renders. `--cut`, `--by`, `--note`, `--acknowledge-warnings`. `--automated` (script only) records a non-review that unlocks stand-in voices only |
| `costs --video <id>`                                                 | Shows what the next narration run will spend and what has been spent                                                                                                                                              |
| **Voice**                                                            |                                                                                                                                                                                                                   |
| `pronunciation list`                                                 | Shows every term and whether its pronunciation is approved                                                                                                                                                        |
| `pronunciation set --term <term>`                                    | Sets `--alias` or `--ipa` for a term, or adds a new term. Returns it to pending                                                                                                                                   |
| `pronunciation approve --term <term>`                                | Records that you listened to the term and it is correct                                                                                                                                                           |
| `preview-voice --video <id>`                                         | Generates a short sample. `--text`, `--term`, `--dry-run`                                                                                                                                                         |
| `narrate --video <id>`                                               | Generates narration for scenes that need it. `--scene`, `--dry-run`, `--force`, `--voice-provider`, `--voice-id`                                                                                                  |
| **Production**                                                       |                                                                                                                                                                                                                   |
| `record --video <id>`                                                | Records the scenarios the storyboard needs. `--scenario`, `--retake`, `--headed`, `--reuse-from`, `--keep-captures`                                                                                               |
| `preview --video <id>`                                               | Renders half-resolution cuts, or opens Remotion Studio with `--studio`. `--cut`, `--format`, `--scene`                                                                                                            |
| `render --video <id>`                                                | Renders cuts. `--cut`, `--format`, `--scene`, `--quality`, `--force`, `--skip-thumbnails`                                                                                                                         |
| `thumbnails --video <id>`                                            | Renders the three 1280x720 thumbnail candidates. `--force`                                                                                                                                                        |
| `qa --video <id>`                                                    | Runs automated checks and writes the review report. `--cut`, `--format`, `--quality`                                                                                                                              |
| **Delivery**                                                         |                                                                                                                                                                                                                   |
| `metadata --video <id>`                                              | Generates titles, description, chapters and social captions from the script                                                                                                                                       |
| `export --video <id>`                                                | Packages approved cuts. `--cut`, `--r2`, `--signed-url <seconds>`                                                                                                                                                 |
| `publish --video <id> --cut <id> --confirm <id>`                     | Uploads an approved cut to YouTube. `--title`, `--title-text`, `--privacy`, `--thumbnail`                                                                                                                         |
| `publish-auth`                                                       | Authorises this machine to upload to YouTube (one time, opens a consent page)                                                                                                                                     |
| `storage push --video <id>`                                          | Uploads a video's narration and recordings to R2 so another machine can render it                                                                                                                                 |
| `storage pull --video <id>`                                          | Downloads them                                                                                                                                                                                                    |
| `storage prune [--days <n>] [--yes]`                                 | Lists exported objects older than the retention period. Deletes them only with `--yes`                                                                                                                            |
| **Housekeeping**                                                     |                                                                                                                                                                                                                   |
| `cache inspect`                                                      | Shows what is cached and what deleting each cache would cost                                                                                                                                                      |
| `cache clean [--renders] [--bundle] [--narration] --yes`             | Deletes caches. Scene renders by default. Narration only when asked                                                                                                                                               |
| **Demo environment and voice direction**                             |                                                                                                                                                                                                                   |
| `demo-login`                                                         | Opens a browser for you to sign in to the demo business and saves the session                                                                                                                                     |
| `demo-snapshot --path <path>`                                        | Prints the accessibility tree of one demo page, read-only. `--open`, `--out`, `--screenshot`                                                                                                                      |
| `voice <models\|presets\|direct\|report\|audition\|select\|measure>` | Directs, auditions and chooses how the narrator performs. See [docs/VOICE.md](docs/VOICE.md)                                                                                                                      |
| `scene-review --video <id>`                                          | Key frames, a clip per scene and direction problems, before a full render. `--cut`, `--scene`, `--baseline`                                                                                                       |
| `publish-thumbnail --video <id> --cut <id>`                          | Sets a rendered thumbnail on a cut already on YouTube. `--thumbnail`                                                                                                                                              |

Package scripts: `pnpm validate` (type-check, lint, format check, unit tests), `pnpm test`,
`pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm format`,
`pnpm build`, `pnpm remotion:studio`, `pnpm playwright:install`.

## Environment variables

`.env` is loaded from the project root. Each integration validates only its own variables,
and only when a command first needs it. A validation error names the variable and never prints
its value. "Secret" means the value must never be shared, committed or pasted into a ticket.

| Variable                        | Required when                                                                           | Secret | Notes                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | Never                                                                                   | No     | `development`, `test` or `production`. Validated, but no behaviour depends on it today                                                    |
| `IKER_DEMO_BASE_URL`            | Recording an `iker` scenario                                                            | No     | `http://localhost:3000` or an `https` staging origin such as `https://staging.iker.example`. `useiker.com` and its subdomains are refused |
| `IKER_DEMO_USERNAME`            | Recording an `iker` scenario with `IKER_DEMO_AUTH=password`                             | Yes    | A dedicated demo business account without two-factor authentication                                                                       |
| `IKER_DEMO_PASSWORD`            | Same                                                                                    | Yes    |                                                                                                                                           |
| `IKER_DEMO_AUTH`                | Recording an `iker` scenario                                                            | No     | `password` or `session` (a session saved by `pnpm studio demo-login`)                                                                     |
| `IKER_PRODUCTION_HOSTS`         | Never                                                                                   | No     | Extra hostnames to refuse, comma separated                                                                                                |
| `ELEVENLABS_API_KEY`            | `narrate`, `preview-voice` and `costs` for a video whose voice provider is `elevenlabs` | Yes    | `plan` and `status` still run without it and print a note that narration could not be planned                                             |
| `ELEVENLABS_VOICE_ID`           | Same                                                                                    | No     |                                                                                                                                           |
| `ELEVENLABS_MODEL_ID`           | Never                                                                                   | No     | Defaults to `eleven_multilingual_v2`                                                                                                      |
| `ELEVENLABS_USD_PER_1K_CREDITS` | Never                                                                                   | No     | Your plan's price. Without it, costs are shown in credits only                                                                            |
| `R2_ACCOUNT_ID`                 | `export --r2` and `storage` commands                                                    | No     |                                                                                                                                           |
| `R2_ACCESS_KEY_ID`              | Same                                                                                    | Yes    |                                                                                                                                           |
| `R2_SECRET_ACCESS_KEY`          | Same                                                                                    | Yes    |                                                                                                                                           |
| `R2_BUCKET_NAME`                | Same                                                                                    | No     |                                                                                                                                           |
| `R2_RETENTION_DAYS`             | `storage prune` without `--days`                                                        | No     |                                                                                                                                           |
| `RENDER_CONCURRENCY`            | Never                                                                                   | No     | Browser tabs used while rendering, 1 to 64. Empty lets Remotion choose                                                                    |
| `DEFAULT_FPS`                   | Never                                                                                   | No     | `24`, `25`, `30` or `60`. Default `30`                                                                                                    |
| `DEFAULT_RESOLUTION`            | Never                                                                                   | No     | `720p`, `1080p`, `1440p` or `2160p`. Applies to final renders. Previews are always half size                                              |
| `OUTPUT_DIRECTORY`              | Never                                                                                   | No     | Default `output`, relative to the project root                                                                                            |
| `REMOTION_LICENSE_KEY`          | Your organisation needs a Remotion Company Licence                                      | Yes    | See [docs/LICENSING.md](docs/LICENSING.md)                                                                                                |
| `LOG_LEVEL`                     | Never                                                                                   | No     | `debug`, `info`, `warn` or `error`. Default `info`                                                                                        |
| `LOG_FORMAT`                    | Never                                                                                   | No     | `pretty` or `json`. Default `pretty`                                                                                                      |
| `YOUTUBE_CLIENT_ID`             | `publish` and `publish-auth`                                                            | No     | OAuth client of type "Desktop app"                                                                                                        |
| `YOUTUBE_CLIENT_SECRET`         | Same                                                                                    | Yes    |                                                                                                                                           |
| `YOUTUBE_PUBLISHING_ENABLED`    | `publish`                                                                               | No     | Must be exactly `true`. Credentials alone never enable publishing                                                                         |

The general settings (`NODE_ENV`, `OUTPUT_DIRECTORY`, `RENDER_CONCURRENCY`, `DEFAULT_FPS`,
`DEFAULT_RESOLUTION`, `LOG_LEVEL`, `LOG_FORMAT`) are the exception to lazy validation. They are
read when any command starts, so an invalid value stops every command, including `doctor`.

## Output directory layout

```text
output/<video-id>/
  manifest.json          state of the video; written only by the CLI          tracked
  script.md              the script; written by a person                      tracked
  research.md            verified facts and notes; written by a person        tracked
  storyboard.json        how each scene looks; edited by a person             tracked
  storyboard.html        review page for the storyboard                       ignored
  recordings/<scenario>/ recording.mp4, timeline.json, screenshots/, debug/   ignored
  audio/                 <scene>.wav or .mp3, <scene>.words.json, previews/   ignored
  scenes/<cut>/          timeline.json, <quality>/<scene>.mkv                 ignored
  subtitles/             <cut>.srt, <cut>.vtt                                 ignored
  preview/               <video-id>-<cut>.mp4 at half resolution              ignored
  final/                 <video-id>-<cut>.mp4 at full resolution              ignored
  thumbnails/            <variant>.png, 1280x720                              ignored
  qa/<cut>-<quality>/    report.html, report.json, contact-sheet.png, frames/ ignored
  metadata/              metadata.md, metadata.json                           ignored
  export/<cut>/          the publishable package with SHA256SUMS              ignored
.cache/narration/        shared narration cache, keyed by content hash        ignored
```

`.gitignore` ignores everything under `output/` except the four text sources of each video. It
also ignores `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `oauth-token*.json`,
browser session state, and media file types anywhere in the repository. Rendered media and
narration never belong in Git. To move them between machines use `storage push` and
`storage pull`.

## Formats

From `src/domain/formats.ts`. Sizes are full resolution at the default `DEFAULT_RESOLUTION`.

| Format id           | Label               | Size      | fps | Captions burned in by default | Caption lines       | Maximum duration | Safe area (top, right, bottom, left) |
| ------------------- | ------------------- | --------- | --- | ----------------------------- | ------------------- | ---------------- | ------------------------------------ |
| `youtube-landscape` | YouTube 16:9        | 1920x1080 | 30  | No                            | 2 lines of 42 chars | None             | 64, 96, 64, 96 px                    |
| `youtube-shorts`    | YouTube Shorts 9:16 | 1080x1920 | 30  | Yes                           | 2 lines of 24 chars | 180 s            | 220, 150, 420, 64 px                 |
| `social-landscape`  | LinkedIn / X 16:9   | 1920x1080 | 30  | Yes                           | 2 lines of 42 chars | 140 s            | 64, 96, 64, 96 px                    |
| `social-portrait`   | LinkedIn / X 9:16   | 1080x1920 | 30  | Yes                           | 2 lines of 24 chars | 140 s            | 220, 150, 420, 64 px                 |

Exceeding a format's maximum duration is a QA failure. SRT and VTT files are always written,
whether or not captions are burned in. Audio is normalised to -14 LUFS integrated with a true
peak of -1.5 dBTP. Final renders use H.264 at CRF 18 with 192 kbps AAC. Previews use half
scale, CRF 28 and 128 kbps.

## Templates

A template (`templates/<id>/template.json`) defines the cuts a kind of video produces, the
scenes in each cut, guidance for the writer and a starting visual for each scene. Each template
ships a finished `demo/` (script, research and storyboard) that `create --demo` copies.

| Template                  | Content types                                                  | Cuts                                                                                  |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `product-tutorial`        | `PRODUCT_TUTORIAL`, `PRODUCT_DEMO`, `YOUTUBE_SHORT`            | `full` (youtube-landscape), `short` (youtube-shorts)                                  |
| `feature-announcement`    | `FEATURE_ANNOUNCEMENT`, `RELEASE_UPDATE`, `PRODUCT_DEMO`       | `full` (youtube-landscape), `social` (social-portrait)                                |
| `business-explainer`      | `BUSINESS_EDUCATION`, `BOOKKEEPING_EDUCATION`, `PRODUCT_DEMO`  | `full` (youtube-landscape), `short-60` (youtube-shorts), `teaser-30` (youtube-shorts) |
| `myth-vs-fact`            | `BUSINESS_EDUCATION`, `BOOKKEEPING_EDUCATION`, `YOUTUBE_SHORT` | `full` (youtube-landscape), `short` (youtube-shorts)                                  |
| `faq-answer`              | `PRODUCT_TUTORIAL`, `BUSINESS_EDUCATION`, `YOUTUBE_SHORT`      | `short` (youtube-shorts), `full` (youtube-landscape)                                  |
| `quick-sketch`            | `YOUTUBE_SHORT`, `BUSINESS_EDUCATION`, `PRODUCT_DEMO`          | `short` (youtube-shorts), `social` (social-portrait)                                  |
| `monthly-money-check-in`  | `BOOKKEEPING_EDUCATION`, `BUSINESS_EDUCATION`                  | `full` (youtube-landscape), `short` (youtube-shorts)                                  |
| `day-in-the-life`         | `BUSINESS_EDUCATION`, `PRODUCT_DEMO`                           | `full` (youtube-landscape), `social` (social-portrait)                                |
| `how-your-client-sees-it` | `PRODUCT_DEMO`, `PRODUCT_TUTORIAL`                             | `full` (youtube-landscape), `short` (youtube-shorts)                                  |

Content types accepted by `create --type`: `PRODUCT_DEMO`, `PRODUCT_TUTORIAL`,
`FEATURE_ANNOUNCEMENT`, `BUSINESS_EDUCATION`, `BOOKKEEPING_EDUCATION`, `YOUTUBE_SHORT`,
`RELEASE_UPDATE`.

Most product scenes in the shipped templates point at a `synthetic-*` scenario
(`synthetic-smoke`, `synthetic-new-booking`, `synthetic-record-payment`). These play the
bundled, clearly labelled "Demo Console" fixture for a booking business, served from this
machine. Run
`pnpm studio templates validate` after changing a template.

## Smart re-rendering

Nothing is regenerated unless something it depends on changed. Three kinds of asset are
tracked by content hash:

| Asset                                    | Regenerated when this changes                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Narration clip (per scene)               | The scene's text, the voice provider, voice id, model, any voice setting, or an approved pronunciation rule for a term that appears in that scene's text                                                 |
| Recording (per scenario)                 | The scenario definition, the fixture files (synthetic), or the demo origin or account name (iker)                                                                                                        |
| Rendered scene (per cut, quality, scene) | The storyboard scene, the format, the scene's length in frames, its narration clip, its recording, burned-in captions, the brand, the Remotion version, or any file under `src/remotion` or `src/domain` |
| Final MP4 (per cut, quality)             | Any of its scenes, the music bed, the loudness target or the audio bitrate                                                                                                                               |

Consequences worth knowing:

- Editing the visual of one scene re-renders that scene only. The cut is then rebuilt from the
  existing segments without re-encoding video.
- Editing one scene's narration regenerates one audio clip and re-renders that one scene.
- The progress bar is off by default (`showProgress: false` on a cut) for this reason: its
  position in each scene depends on the length of the whole cut. If you turn it on, changing
  the length of any one scene re-renders every scene in that cut.
- Changing the brand or the Remotion sources re-renders every scene and reuses all narration.
- Narration is cached in `.cache/narration` and shared between videos. Reverting text to a
  previous wording restores the old clip from the cache at no cost.
- Preview and final renders are stored separately and do not invalidate each other.
- `DEFAULT_RESOLUTION` is not part of any hash. After changing it, run
  `pnpm studio render --video <id> --force`.

`pnpm studio plan --video <id>` shows the state before you spend anything: how many narration
clips, recordings and scenes are out of date, what narration will cost in characters and
credits, which stages must run and the next command.

`plan` and `status` look at final-quality renders by default. Pass `--quality preview` to
`plan` to see the state of preview renders. `pnpm studio cache inspect` lists each cache, its
size and what deleting it would cost (time for renders, money for ElevenLabs narration).

## Costs and licences

| Item             | Cost                                                                                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remotion         | Free for individuals, for-profit organisations with up to 3 employees, non-profits and evaluation. Otherwise a Company Licence is required. **Action item: Iker must check its headcount and buy a licence if it applies before production use.** See [docs/LICENSING.md](docs/LICENSING.md)  |
| ElevenLabs       | Paid, billed in credits per character: 1 credit per character on `eleven_multilingual_v2` and `eleven_v3`, 0.5 on the flash and turbo models (table in `src/domain/voice.ts`). The price in USD depends on your plan, so the tool shows credits unless `ELEVENLABS_USD_PER_1K_CREDITS` is set |
| YouTube Data API | Uploads consume API quota on the Google Cloud project that owns the OAuth client                                                                                                                                                                                                              |
| Cloudflare R2    | Billed for storage and operations                                                                                                                                                                                                                                                             |
| GitHub Actions   | Minutes are billed for private repositories                                                                                                                                                                                                                                                   |
| Stand-in voices  | `system` and `silent` cost nothing and are not for publication                                                                                                                                                                                                                                |

`pnpm studio narrate --video <id> --dry-run` and `pnpm studio costs --video <id>` show the
character count and credits before anything is spent. The repository's own code is
proprietary. See [LICENSE.md](LICENSE.md).

## Current status and known limitations

Nothing has been run for Iker yet beyond the unit tests. No Iker video has been created,
recorded, narrated, rendered, approved or exported, and none of the steps in the production
workflow above have been exercised against the Iker brand, templates or scenarios. This section
will be updated as each step is verified.

Blocked today by external access, not by code:

- **No ElevenLabs credentials.** Production narration has never been generated. The ElevenLabs
  client (`src/infrastructure/voice/elevenlabs.ts`) is written against the documented API and
  unit-tested with a mocked HTTP layer (`tests/unit/infrastructure/elevenlabs.test.ts`). It has
  not made a live call.
- **No Iker demo environment.** No local copy of the web app with seeded data or staging host
  has been configured for recording. Every `iker-*` scenario is `unverified`: written from the
  web app's source and documents, never run. Run `pnpm -s studio --json scenarios` to read each
  scenario's status and prerequisites.
- **No R2 or YouTube credentials.** Both adapters are implemented and have never been run
  against the live services. The R2 adapter is unit-tested with a fake client
  (`tests/unit/infrastructure/r2.test.ts`). The YouTube adapter is unit-tested against a
  mocked HTTP layer (`tests/unit/infrastructure/youtube.test.ts`), and the publish gates are
  tested with a fake publisher.

Product facts that limit what can be recorded:

- Iker has no Sandbox mode. Production (`useiker.com`) holds real businesses' bookings and
  money records and is never recorded. Every recording runs against seeded demo data.
- Platform Admin and Super Admin views must never show a business's income, expenses,
  payments or statements, in footage or in graphics. Iker enforces this boundary in the
  product itself; videos must not imply otherwise.
- Business and admin users sign in with email and password or a magic link. Accounts with
  two-factor authentication cannot be automated. The recorder aborts and never attempts to
  pass a second factor.

Limits of the checks:

- **Safe areas are a manual check.** Scenes are laid out inside the safe area by the design
  system, but rendered pixels are not analysed. The QA contact sheet outlines the safe area on
  each frame for a person to inspect.
- **Visual quality is a manual check.** No automated check judges pacing, hierarchy, legibility
  or accuracy.
- **Recorded pixels are not scanned for sensitive data.** QA scans text artefacts only (script,
  storyboard, subtitles, metadata, recording timelines). There is no OCR. Masking in a
  recording is best effort and a person must review the footage.
- **Caption timing is estimated for stand-in voices.** Only ElevenLabs returns character
  timings. For `system` and `silent`, word timing is estimated from clip length and word
  length. QA reports this as a warning.
- **Black-frame detection looks only for near-true-black frames**, because the brand
  background is very dark.

Implemented but unused or unproven:

- The `data` visual kind (bar chart) exists and is not used by any shipped template.
- Background music is supported per cut (`music` in `storyboard.json`), but no music is
  shipped, no `assets/music` directory exists and no template uses it.
- `NODE_ENV` is validated and not otherwise used.
- `approve --stage final`, `export` and `publish` are covered by unit tests that use fake
  ports. They have not been exercised on a real final render.
- The `Dockerfile` and `.dockerignore` are written but have not been build-tested. Docker was
  not running on the development machine.
- The GitHub Actions workflows have not been run from this machine.

Other things to know:

- YouTube publishing works only from a local machine today, because the OAuth refresh token is
  a local file. The render workflow exports to R2 and does not upload to YouTube.
- Narration made with the macOS `system` voice cannot be regenerated on a Linux runner. See
  [Continuous integration and Docker](#continuous-integration-and-docker).
- The product thumbnail variant shows the host its screenshot was captured from, not the brand
  website.
- An `authenticate` step always runs before the capture starts, wherever it appears in a
  scenario's step list.

## Continuous integration and Docker

**[.github/workflows/ci.yml](.github/workflows/ci.yml)** runs on pull requests and on pushes to
`main`. It type-checks, lints, checks formatting, runs the unit tests, builds the CLI,
validates the templates, installs FFmpeg and the recording browser, runs `doctor`, runs the
integration tests, and runs the synthetic end-to-end render (`pnpm test:e2e`). It has read-only
permissions, uses no secrets and calls no paid API.

**[.github/workflows/render.yml](.github/workflows/render.yml)** is triggered by hand. Inputs:

| Input      | Values                           | Meaning                                                         |
| ---------- | -------------------------------- | --------------------------------------------------------------- |
| `video_id` | A directory name under `output/` | The video. Its `manifest.json` must be in the repository        |
| `format`   | `all` or one format id           | Which cuts to render                                            |
| `quality`  | `preview` (default) or `final`   | Render quality                                                  |
| `mode`     | `full` (default) or `scene`      | `scene` re-renders one scene and rebuilds its cut               |
| `scene`    | A scene id                       | Only for `mode: scene`                                          |
| `export`   | `false` (default) or `true`      | After review, approve and export the final render to private R2 |

The `render` job pulls narration and recordings from R2 when R2 is configured, records and
narrates whatever is missing, renders, runs QA, pushes new assets back to R2, and uploads the
video directory (without scene segments) as an artifact kept for 7 days.

The `export` job runs only for a full final render with `export: true`. It is bound to the
GitHub environment `video-release`. **That environment must be configured in the repository
settings with required reviewers.** Without that, the job does not wait for anyone. The
reviewer's approval of the environment is the human release decision. The job then records the
final approval and runs `export --r2`. It fails if QA found failures or unacknowledged
warnings.

Things to know before relying on it:

- Narration made with the macOS `system` voice cannot be regenerated on Linux runners. Such a
  video needs its audio fetched with `storage pull` from R2, or must use ElevenLabs or the
  `silent` voice in CI.
- A video whose script approval is automated only cannot be narrated with ElevenLabs and
  fails QA, in CI as locally.
- The workflow does not upload to YouTube.
- The workflow does not commit anything back. QA results, the approval and the export record
  it writes to `manifest.json` exist only in the run's artifact.
- Neither workflow has been run from the development machine.

**[Dockerfile](Dockerfile)** describes a Linux image with Node 24, FFmpeg, Playwright Chromium
and Chrome Headless Shell, with `pnpm studio` as its entry point. Secrets are passed at run
time and are not baked in. `.dockerignore` keeps `.env`, `output/` and `.cache/` out of the
image. The image has not been built or tested: Docker was not running on the development
machine.

## More documentation

| Document                                           | Read it for                                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)       | Layers, ports and adapters, the manifest, hashes, the render path                                                                                                  |
| [docs/VIDEO-AUTHORING.md](docs/VIDEO-AUTHORING.md) | The exact format of `research.md`, `script.md` and `storyboard.json`                                                                                               |
| [docs/MOTION-DESIGN.md](docs/MOTION-DESIGN.md)     | Motion tokens, cues, continuity, the virtual camera, visual kinds                                                                                                  |
| [docs/VOICE.md](docs/VOICE.md)                     | Voice models, presets, direction, auditions and audio finishing                                                                                                    |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Symptoms, causes and fixes, by error message                                                                                                                       |
| [docs/LICENSING.md](docs/LICENSING.md)             | Remotion, fonts, music, brand assets and third-party terms                                                                                                         |
| [CONTRIBUTING.md](CONTRIBUTING.md)                 | Setup, conventions, tests and how to add things                                                                                                                    |
| [SECURITY.md](SECURITY.md)                         | Threat model, implemented controls and what is not covered                                                                                                         |
| [LICENSE.md](LICENSE.md)                           | Proprietary notice                                                                                                                                                 |
| [CLAUDE.md](CLAUDE.md)                             | Instructions for Claude Code when it works in this repository                                                                                                      |
| `.claude/skills/*/SKILL.md`                        | Skills for Claude Code: one per production role, plus `iker-house-style`, `iker-social-publishing` and the `remotion-*` references. Mirrored in `.agents/skills/`  |
| `knowledge/`                                       | Sourced Iker product facts (`product-facts.md`), audience and voice (`audience-and-voice.md`) and copies of the source documents (`source/`). Research starts here |
| [.flitstack/PLAN.md](.flitstack/PLAN.md)           | Current phase and open blockers                                                                                                                                    |
