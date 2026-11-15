# Troubleshooting

Organised by symptom. Error messages are quoted from the source.

## Reading an error

A failed command exits non-zero and prints two lines on stderr:

```text
Error: <what went wrong>
<hint: what to do next>
```

The error code (`STAGE_BLOCKED`, `APPROVAL_REQUIRED` and so on) is printed only with the
global `--json` flag:

```bash
pnpm -s studio --json narrate --video <id>
```

```json
{
  "ok": false,
  "error": { "code": "APPROVAL_REQUIRED", "message": "...", "hint": "..." }
}
```

| Code                  | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `CONFIG_INVALID`      | An environment variable, `brand.json` or `pronunciations.json` is wrong |
| `DEPENDENCY_MISSING`  | A program or browser is not installed                                   |
| `NOT_FOUND`           | A video, cut, scene, scenario, template or file does not exist          |
| `VALIDATION_FAILED`   | A file or option did not pass validation, or QA found failures          |
| `APPROVAL_REQUIRED`   | A person's approval or confirmation is missing or no longer valid       |
| `STAGE_BLOCKED`       | An earlier stage has not run, or its output is out of date              |
| `EXTERNAL_SERVICE`    | FFmpeg, ElevenLabs, R2, Google or YouTube returned an error             |
| `RECORDING_FAILED`    | A recording scenario could not be completed                             |
| `RENDER_FAILED`       | Remotion could not render a scene or thumbnail                          |
| `UNSAFE_TARGET`       | The recording target was refused                                        |
| `PUBLISHING_DISABLED` | `YOUTUBE_PUBLISHING_ENABLED` is not `true`                              |
| `UNEXPECTED`          | Not a `StudioError`. Set `LOG_LEVEL=debug` to print the stack trace     |

Exit code `2` means the command line itself was wrong (unknown option, missing required
option). Commander prints the problem and "(run with --help for usage)".

When you do not know what to run next:

```bash
pnpm studio status --video <id>
pnpm studio plan --video <id>
```

Both print a `Next:` line.

## Setup and `doctor`

### Every command fails with "General settings is not configured"

```text
Error: General settings is not configured: DEFAULT_FPS: Invalid input
```

**Cause.** One of `NODE_ENV`, `OUTPUT_DIRECTORY`, `RENDER_CONCURRENCY`, `DEFAULT_FPS`,
`DEFAULT_RESOLUTION`, `LOG_LEVEL` or `LOG_FORMAT` has a value that is not accepted. These are
read when any command starts, so `doctor` fails too, before it prints any check.

**Fix.** Correct the value in `.env`. Accepted values are listed in `.env.example`.

### `doctor` reports a `FAIL`

| Line                                                                     | Cause                                             | Fix                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Node.js: v20.x is too old`                                              | Node is older than 22.12                          | Install Node 22.12 or newer. `nvm install` reads `.nvmrc` (24)                                |
| `pnpm: not found`                                                        | pnpm is not on `PATH`                             | `corepack enable`                                                                             |
| `ffmpeg: not found on PATH` or `ffprobe: not found on PATH`              | FFmpeg is not installed                           | macOS: `brew install ffmpeg`. Debian or Ubuntu: `sudo apt-get install -y ffmpeg`              |
| `FFmpeg H.264 encoder: this FFmpeg build has no libx264 encoder`         | A build compiled without `libx264`                | Install a full build. Check with `ffmpeg -hide_banner -encoders \| grep libx264`              |
| `git: not found`                                                         | Git is not installed                              | Install Git                                                                                   |
| `Recording browser: Playwright Chromium is not installed`                | The Playwright browser was never downloaded       | `pnpm playwright:install`                                                                     |
| `Brand: brand/brand.json is invalid: ...`                                | `brand.json` does not match `src/domain/brand.ts` | Fix the field named in the message                                                            |
| `Brand: brand.json points to a missing logo: ...`                        | A logo path does not exist under `brand/`         | Restore the file or set the path to `null`                                                    |
| `Templates: ...`                                                         | A `template.json` is invalid                      | `pnpm studio templates validate` names the problem                                            |
| `Synthetic demo fixture: fixtures/synthetic-demo is missing`             | The fixture directory was removed                 | Restore it from Git                                                                           |
| `Secrets not tracked by Git: .env is tracked by Git`                     | `.env` was committed                              | `git rm --cached .env`, then rotate every credential in it. See [SECURITY.md](../SECURITY.md) |
| `ElevenLabs: ElevenLabs is not configured: ...` (or another integration) | Some of its variables are set and one is invalid  | Correct the variable named in the message                                                     |

A line starting with `--` is not a failure. It marks an optional integration with no variables
set.

`doctor` checks the recording browser only. It does not check Remotion's Chrome Headless Shell
or Linux system libraries. See the next two entries.

### Recording fails: "The Chromium browser used for recording is not installed."

**Cause.** Playwright's Chromium is missing (`DEPENDENCY_MISSING`).

**Fix.**

```bash
pnpm playwright:install
```

On Linux, if the browser is installed but fails to launch with missing shared libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

### The first render downloads a browser, or fails to start one

**Cause.** Rendering uses Remotion's Chrome Headless Shell, a separate download from
Playwright's Chromium. The renderer downloads it on first use if it is missing. That needs
network access.

**Fix.** Run `pnpm studio init` once while online. It installs both browsers. On Linux, Chrome
Headless Shell also needs system libraries. Installing Playwright's dependencies with
`pnpm exec playwright install --with-deps chromium` covers the common ones. Remotion documents
the full list at <https://www.remotion.dev/docs/miscellaneous/linux-dependencies>.

### "ffmpeg is not installed or not on PATH."

**Cause.** A command needed FFmpeg and could not start it (`DEPENDENCY_MISSING`).

**Fix.** Install FFmpeg as above, open a new terminal, and run `pnpm studio doctor`.

### "ffmpeg exited with code N:" followed by FFmpeg output

**Cause.** FFmpeg ran and failed (`EXTERNAL_SERVICE`). The last six lines of its output are
shown.

**Fix.** Read those lines. Typical causes are a missing or truncated input file and a full
disk. If a recording or segment is damaged, regenerate it: `pnpm studio record --video <id>
--scenario <scenario> --retake` or `pnpm studio render --video <id> --scene <scene> --force`.

## Stage order

### `STAGE_BLOCKED`: "X needs Y to be complete first."

For example: `Product recording needs Storyboard to be complete first.`

**Cause.** A prerequisite stage has not completed for this video.

**Fix.** Run the command in the hint, for example `pnpm studio storyboard --video <id>`.

### Stale script or storyboard

| Message                                                   | Cause                                                             | Fix                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `The script has changed since it was last checked.`       | `script.md` was edited after the last `script` run                | `pnpm studio script --video <id>`                                                |
| `The script changed after the storyboard was built.`      | The storyboard was synced from an older script                    | `pnpm studio script --video <id>`, then `pnpm studio storyboard --video <id>`    |
| `storyboard.json was edited since it was last validated.` | You edited `storyboard.json` by hand and did not re-run the check | `pnpm studio storyboard --video <id>`                                            |
| `storyboard.json is invalid: ...`                         | A hand edit broke the schema                                      | Fix the field named in the message. See [VIDEO-AUTHORING.md](VIDEO-AUTHORING.md) |
| `This video has no storyboard yet.`                       | `storyboard` has never run                                        | `pnpm studio storyboard --video <id>`                                            |

`record`, `narrate`, `preview`, `render` and `costs` all refuse to work from a stale
storyboard. Editing `script.md` also voids the script approval, so after re-running `script`
and `storyboard` a person must approve again before `narrate`.

`plan` shows "Asset states are not shown because the storyboard is out of date with the
script." until the storyboard is back in sync.

### "Cut "full" cannot be rendered yet. Missing:"

```text
Error: Cut "full" cannot be rendered yet. Missing:
- narration for scene "intro" (pnpm studio narrate --video <id>)
- recording "synthetic-new-booking" (pnpm studio record --video <id>)
```

**Cause.** The cut needs narration clips or recordings that do not exist.

**Fix.** Run the commands listed next to each missing item.

### "Scene "x" of cut "y" has no current render."

**Cause.** You rendered with `--scene`, but another scene in the cut is also out of date, so
the cut cannot be rebuilt from segments.

**Fix.** `pnpm studio render --video <id> --cut <cut>` without `--scene`. Add
`--quality preview` if you were working on a preview.

### "Cut "x" has no final render to check." or "has no preview render to check."

**Cause.** `qa` was run for a quality that has not been rendered. The check happens before the
stage starts, so the `qa` stage is not marked failed.

**Fix.** `pnpm studio render --video <id> --cut <cut>` for final quality, or
`pnpm studio preview --video <id> --cut <cut>` and then `qa --quality preview`.

### A stage shows `running` or `failed` in `status`

**Cause.** `running` after the command has exited means it was interrupted. `failed` shows the
error in the Detail column.

**Fix.** Run the same command again. Work finished before the interruption was checkpointed
and is skipped. There is no lock to clear.

### `plan` says every scene needs rendering after a preview

**Cause.** `plan` and `status` report on final-quality renders unless told otherwise. Scenes
also re-render after any change under `src/remotion` or `src/domain`, a brand change, or a
Remotion upgrade.

**Fix.** `pnpm studio plan --video <id> --quality preview` shows the preview state.

### "No cut matches the format ..."

**Cause.** `--format` on `preview`, `render` or `qa` named a format no cut in this storyboard
uses, or `--cut` and `--format` together selected nothing.

**Fix.** The hint lists each cut with its format.

## Approvals

### `APPROVAL_REQUIRED`: "Narration cannot be generated until the script is approved."

**Cause.** The current `script.md` has no approval, or it was edited after approval.

**Fix.** A person reviews the script, then runs
`pnpm studio approve --video <id> --stage script`. Stand-in voices need an approval too. For
those, a tool or test may record `approve --stage script --automated`, which is not a review.

### "The script was approved by automation only. Paid narration needs a person's approval."

**Cause.** The script's approval was recorded with `--automated`, and the video's voice
provider is `elevenlabs`. An automated approval unlocks only the `system` and `silent` voices.

**Fix.** A person reviews `script.md`, then runs
`pnpm studio approve --video <id> --stage script` without `--automated`.

### "The script has not been approved by a person, so nothing built from it can be released."

**Cause.** `approve --stage final` was run for a video whose script approval is missing or
automated. Export and publishing are blocked for the same reason, because they need a final
approval.

**Fix.** The same: a person approves the script. QA must then be run again, because its
`script-approval` check failed on the automated approval.

### "Only a script can be approved by automation."

**Cause.** `--automated` was passed with `--stage final`.

**Fix.** There is no automated final approval. A person reviews the QA report and runs the
command without `--automated`.

### "The script must pass its checks before it can be approved."

**Fix.** `pnpm studio script --video <id>`, fix any errors, then approve.

### Final approval is refused

| Message                                                  | Fix                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Cut "x" has no final-quality render.`                   | `pnpm studio render --video <id> --cut <cut>`. Previews cannot be approved    |
| `Cut "x" has not been through QA since it was rendered.` | `pnpm studio qa --video <id> --cut <cut>` and read the report                 |
| `Cut "x" has N failing QA check(s).`                     | Fix the causes, render and run QA again                                       |
| `Cut "x" has N QA warning(s).`                           | Read the report. If the warnings are acceptable, add `--acknowledge-warnings` |

### Export or publish says "Cut "x" has not been approved in its current form."

**Cause.** The cut was never approved, or it was re-rendered after approval. An approval is
bound to the SHA-256 of the file.

**Fix.** Run QA, then `pnpm studio approve --video <id> --stage final --cut <cut>`.

## Narration

### `say` only works on macOS: "The system voice needs macOS."

**Cause.** The `system` voice uses the macOS `say` command.

**Fix.** On Linux use the silent stand-in:

```bash
pnpm studio narrate --video <id> --voice-provider silent
```

This switches the video to that provider. Or configure ElevenLabs.

### "ElevenLabs is not configured: ELEVENLABS_API_KEY: ELEVENLABS_API_KEY is not set"

**Cause.** The video's voice provider is `elevenlabs` (the default for `create`) and the
variables are missing.

**Fix.** Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`. To work without
credentials, switch the video to a stand-in with `--voice-provider system` or `silent`.

### ElevenLabs HTTP errors

The messages below come from `src/infrastructure/voice/elevenlabs.ts`. They have not been
observed against the live service, because no ElevenLabs call has been made from this machine.

| Status      | Message                                                                | Cause and fix                                                                                                    |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 401         | `ElevenLabs rejected the API key.`                                     | Wrong or revoked key, or a key without text-to-speech permission. Check `ELEVENLABS_API_KEY`                     |
| 402, 403    | `ElevenLabs refused the request: the plan or quota does not allow it.` | Out of characters, or the plan does not include the voice or model. `pnpm studio costs --video <id>` shows usage |
| 404         | `ElevenLabs could not find the voice or model.`                        | Check `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`                                                            |
| 400, 422    | `ElevenLabs rejected the request as invalid.`                          | A voice setting in the manifest is probably out of range for the model                                           |
| 429         | `ElevenLabs rate limit reached and retries were exhausted.`            | Wait a minute and run the command again                                                                          |
| Other       | `ElevenLabs returned HTTP N.`                                          | Retry later                                                                                                      |
| No response | `Could not reach ElevenLabs.`                                          | Check the network                                                                                                |

Requests that fail with 408, 409, 425, 429, 500, 502, 503 or 504, or with a network error, are
retried up to five attempts with exponential backoff (1 s base, 30 s cap), honouring
`Retry-After`. Every finished clip is saved to the cache and the manifest before the next one
starts, so re-running `narrate` after a failure pays only for the clips that are still
missing.

### Narration cost is higher than expected

**Cause.** Something in the cache key changed for every scene: the voice id, the model, a
voice setting or the seed. Or `--force` was used, which regenerates even cached clips.

**Fix.** Always check first: `pnpm studio narrate --video <id> --dry-run`.

### "Previews are limited to 400 characters."

**Fix.** Preview a sentence or two with `--text`. Full narration needs an approved script and
`narrate`.

## Recording

### `UNSAFE_TARGET`

| Message                                                        | Cause                                                                                                  | Fix                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `Refusing to record <host>: it is a production host.`          | The host is `useiker.com`, any subdomain of it (including `www`), or listed in `IKER_PRODUCTION_HOSTS` | Set `IKER_DEMO_BASE_URL` to a local copy (`http://localhost:3000`) or a staging origin such as `https://staging.iker.example` |
| `Refusing to record http://<host>: it is not encrypted.`       | Plain `http` to a host that is not loopback                                                            | Use an `https://` address. Plain `http` is accepted only for `localhost`, `127.0.0.1` and `[::1]`                             |
| `The demo base URL must not contain a username or password.`   | Credentials are embedded in the URL                                                                    | Remove them and use `IKER_DEMO_USERNAME` and `IKER_DEMO_PASSWORD`                                                             |
| `The demo base URL is not a valid URL.`                        | Not parseable                                                                                          | Use an origin with no path                                                                                                    |
| `Scenario path "..." leaves the recording origin.`             | A scenario step uses an absolute URL                                                                   | Use a path relative to the base URL                                                                                           |
| `Synthetic scenarios run only against the local demo fixture.` | A synthetic scenario was given a non-loopback origin                                                   | This indicates a code change. Synthetic scenarios are served on `127.0.0.1`                                                   |

There is no flag that overrides the guard, and no Sandbox opt-in: Iker has no Sandbox mode, so
a production host always holds real businesses' bookings and payment records. Do not look for
a way around it. Record a local copy of the web app with seeded demo data, or a staging host.

### `RECORDING_FAILED` and the debug folder

```text
Error: Recording failed at step 5 (click button "Publish changes"): <reason>
A screenshot and summary of the failure are in <path>/recordings/<scenario>/debug
```

Every recording failure leaves two files in
`output/<id>/recordings/<scenario>/debug/`:

- `failure.png`: the page at the moment of failure, with password fields masked.
- `failure.txt`: scenario, step number, action, target, the URL without its query string, and
  the error with credentials redacted.

The folder is deleted when that scenario is recorded again. No trace, HAR or console log is
written, by design.

| Message                                                                                   | Cause                                                                                | Fix                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Recording failed at step N (...)`                                                        | An element was not found, was ambiguous, or a condition timed out (15 s per element) | Open `failure.png`. Check the element's accessible name against the scenario. Re-run with `--headed` to watch      |
| `Preflight failed on <path>: <target> is not visible (or matches more than one element).` | The page lacks an element the scenario depends on, before recording began            | Check the scenario's prerequisites (`pnpm -s studio --json scenarios`) and that the name still matches the product |
| Same, with hint "The page redirected to sign-in."                                         | The scenario has no `authenticate` step, or the account cannot reach that page       | Add `{ action: "authenticate" }` or check the account                                                              |
| `Sign-in did not complete: the page stayed on the sign-in screen.`                        | Wrong email or password, or the account is not allowed in                            | Check `IKER_DEMO_USERNAME` and `IKER_DEMO_PASSWORD`                                                                |
| `Scenario "x" signs in, but no demo account was provided.`                                | The scenario authenticates and no credentials were supplied                          | Set the demo variables                                                                                             |
| `There is no saved demo session to record with.`                                          | `IKER_DEMO_AUTH=session` and no session has been saved                               | Run `pnpm studio demo-login` and sign in in the window that opens                                                  |
| `The browser produced no video frames.`                                                   | The screencast gave no frame within 10 s                                             | Retry. Try `--headed`                                                                                              |
| `The cursor overlay is missing from the page.`                                            | The page blocks injected scripts, for example with a strict Content-Security-Policy  | That page cannot be recorded with the drawn cursor as the recorder stands                                          |
| `The capture of "x" is empty or unreadable.`                                              | The transcoded recording has no video or is under one second                         | `pnpm studio record --video <id> --scenario <scenario> --retake`                                                   |

Related messages with other codes: `No enabled scene uses: <scenario>.` means `--scenario`
named a scenario this storyboard does not use. `The storyboard refers to an unknown scenario`
means a `scenarioId` in `storyboard.json` is not registered in `src/scenarios/index.ts`.

Every `iker-*` scenario is unverified: each was written from the web app's source and docs
and none has been run end to end yet. `pnpm studio scenarios` shows the current status. Expect
the first run of each against a local copy or staging to need selector fixes. The sign-in
helper (`src/infrastructure/recording/sign-in.ts`) has not been run against Iker's sign-in
page either.

### The demo account has two-factor authentication

```text
Error: The demo account asks for two-factor authentication.
```

**Cause.** After the password was submitted, the page showed a "Two-factor authentication"
heading.

**Fix.** Use a dedicated demo account with two-factor authentication turned off. The recorder
never attempts to pass a second factor, and there is no option to make it try. Do not turn
2FA off on a personal or real business account to get around this.

### A recording shows the wrong data or an old state

**Cause.** A recording is reused until its scenario, the fixture or the demo origin changes.
Changing the demo account does not trigger a retake. A change in the data shown by the environment is not detected.

**Fix.** `pnpm studio record --video <id> --scenario <scenario> --retake`.

## Rendering

### `RENDER_FAILED`: "Rendering scene "x" failed: ..."

**Cause.** Remotion threw while rendering that scene. Common causes are a media file that
could not be loaded, a font that did not load ("Bundled fonts did not load: ..."), or an error
in a component for that scene's props.

**Fix.** Reproduce it frame by frame in Remotion Studio:

```bash
pnpm studio preview --video <id> --cut <cut> --studio
```

Choose the `Cut` composition and scrub to the scene. The command compiles the real cut,
starts the asset server and passes the props to Studio, so you see the same frames the
renderer would. Stop it with Ctrl+C. It needs the same inputs as a render, so missing
narration or recordings block it in the same way.

To work on components without a video, `pnpm remotion:studio` opens Studio with the sample
props in `src/remotion/sample-props.ts`.

Scenes that rendered before the failure are kept. Run the render again after the fix.

### Render is slow or the machine runs out of memory

**Fix.** Set `RENDER_CONCURRENCY` in `.env` to a lower number of browser tabs. Use `preview`
while iterating: it renders at half size.

### The output resolution did not change after editing `DEFAULT_RESOLUTION`

**Cause.** The resolution scale is not part of the scene hash, so existing final segments are
considered current and reused. QA then fails `resolution`.

**Fix.** `pnpm studio render --video <id> --force`.

### "Music file ... is not in assets/music."

**Cause.** A cut's `music.file` in `storyboard.json` points at a file that does not exist. No
music is shipped and the `assets/music` directory does not exist until you create it.

**Fix.** Add the licensed file under `assets/music/`, or set `music` to `null`. See
[LICENSING.md](LICENSING.md).

## QA failures by check id

`pnpm studio qa` exits with `VALIDATION_FAILED` and "QA found failures." when any check fails.
Details are in `output/<id>/qa/<cut>-<quality>/report.html` and `report.json`.

| Check id                | Typical cause                                                                                                                                                                   | Fix                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `missing-assets`        | A narration clip, recording or screenshot was deleted after rendering, or a path in a scene's `assets` is wrong                                                                 | Regenerate with `narrate` or `record`, or correct the path                                                   |
| `video-metadata`        | The file is not H.264, `yuv420p`, AAC in MP4, or the frame rate differs from the format                                                                                         | Render again. If `DEFAULT_FPS` changed, render with `--force`                                                |
| `aspect-ratio`          | The file's shape does not match the cut's format                                                                                                                                | Render again with `--force`                                                                                  |
| `resolution`            | `DEFAULT_RESOLUTION` changed since the scenes were rendered                                                                                                                     | `pnpm studio render --video <id> --force`                                                                    |
| `black-frames`          | A scene rendered as near-true-black for half a second or more, usually a media file that failed to load                                                                         | Open the scene in Studio and find what did not load                                                          |
| `silence` (fail)        | More than 3.5 s of silence where narration was expected                                                                                                                         | Check the narration clip plays. Shorten `tailSeconds` or `minDurationSeconds` for the scene                  |
| `silence` (warn)        | A played recording outlasts its narration, or the `silent` voice is in use                                                                                                      | Add narration, shorten the scenario, or use `mode: "screenshot"`                                             |
| `audio-levels` (fail)   | True peak above -1 dBTP                                                                                                                                                         | Lower the music volume. Render again                                                                         |
| `audio-levels` (warn)   | Loudness more than 1.5 LU from -14 LUFS, or the track is silent                                                                                                                 | Expected with the `silent` voice. Otherwise render again                                                     |
| `narration-overflow`    | A clip is longer than the room its scene gives it                                                                                                                               | Should not occur, because scene length is derived from clip length. Run `narrate`, then render again         |
| `subtitle-overflow`     | A single word is longer than a caption line (24 characters in portrait formats)                                                                                                 | Reword the narration, or disable captions for that scene (`captions.enabled: false`)                         |
| `scene-transitions`     | A scene has `animation.enter: "none"`                                                                                                                                           | Use `rise` or `fade`, or accept the warning                                                                  |
| `recordings`            | A recording file is unreadable or shorter than one second                                                                                                                       | `pnpm studio record --video <id> --scenario <scenario> --retake`                                             |
| `duration` (fail)       | The file length differs from the timeline by more than 0.25 s, or exceeds the format's maximum                                                                                  | For the maximum: shorten the script or disable scenes. For a mismatch: render again with `--force`           |
| `duration` (warn)       | The cut is outside its `targetSeconds` range                                                                                                                                    | Edit the script, or change the range in the cut heading                                                      |
| `branding`              | No logo, no title, CTA or outro scene, or a placeholder brand asset is listed                                                                                                   | See `brand/README.md`                                                                                        |
| `cta`                   | No enabled scene of type `CTA`                                                                                                                                                  | Re-enable the CTA scene. The script lint requires one per cut                                                |
| `script-approval`       | The script is not approved, the approval was recorded with `--automated` ("approved by automation"), or the storyboard is out of sync                                           | `script`, `storyboard`, then a person runs `approve --stage script` without `--automated`, then run QA again |
| `sensitive-information` | A secret pattern, a configured secret value, a real-looking email address or a valid card number appears in the script, storyboard, subtitles, metadata or a recording timeline | Remove it. If it is a real secret, rotate it. Use `example.com` addresses in demos                           |
| `footage-provenance`    | Footage is from the synthetic fixture or from an unverified scenario                                                                                                            | A warning. Acceptable only when the video is honest about it                                                 |
| `voice-provenance`      | A stand-in voice, estimated caption timing, or unapproved pronunciations                                                                                                        | Narrate with ElevenLabs and approve the terms                                                                |
| `safe-areas`            | Always `manual`                                                                                                                                                                 | Inspect `contact-sheet.png`: the outlined rectangle is the safe area                                         |

After any re-render, QA and final approval must be repeated, because both are bound to the
file's SHA-256.

## Export, storage and publishing

| Message                                               | Cause                                                                           | Fix                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Cloudflare R2 is not configured: ...`                | An `R2_*` variable is missing                                                   | Set the four required variables                                           |
| `--signed-url needs --r2.`                            | A signed link was requested without uploading                                   | Add `--r2`                                                                |
| `Upload of <key> could not be verified.`              | The object's size or checksum in the bucket differs from the local file         | Run the export again                                                      |
| `Checksum mismatch after downloading <key>.`          | The downloaded file differs from the checksum stored with it                    | Download again. Do not use the local copy                                 |
| `No retention period given.`                          | `storage prune` without `--days` and without `R2_RETENTION_DAYS`                | Pass `--days`                                                             |
| `Publishing is switched off.` (`PUBLISHING_DISABLED`) | `YOUTUBE_PUBLISHING_ENABLED` is not exactly `true`                              | Set it deliberately, or publish by hand from the export package           |
| `Publishing needs explicit confirmation.`             | `--confirm` does not equal the video id                                         | Repeat the id: `--confirm <id>`                                           |
| `YouTube has not been authorised on this machine.`    | No stored refresh token                                                         | `pnpm studio publish-auth`                                                |
| `Google refused the token request (HTTP N).`          | The refresh token was revoked or the client secret is wrong                     | `pnpm studio publish-auth` again                                          |
| `Google did not return a refresh token.`              | The app was already authorised for this account                                 | Remove its access at myaccount.google.com/permissions and authorise again |
| `YouTube did not start the upload (HTTP N).`          | The API is not enabled for the project, or quota is exhausted                   | Enable YouTube Data API v3 for the OAuth project and check quota          |
| "YouTube did not accept the thumbnail"                | Custom thumbnails need a verified channel                                       | Set it by hand. The upload itself succeeded                               |
| `The metadata exceeds a platform limit.`              | A title over 100 characters, an X caption over 280, or a description over 5,000 | Shorten the field in `script.md`                                          |

The R2 and YouTube adapters have never been run against the live services. Treat the first
real use as a test.

## Project paths containing spaces

The pipeline is written to work from a path that contains a space, such as
`/Users/you/Iker Studio`.

- Quote the path in your shell: `cd "/Users/you/Iker Studio"`.
- Inside the project, `pnpm studio ...` needs no special handling. The CLI finds the project
  root from its own location, starts programs with argument arrays and no shell, quotes paths
  in FFmpeg's concat list, and percent-encodes asset URLs.
- If you write your own shell commands around the output, quote every path:
  `open "output/<id>/qa/full-preview/report.html"`.
- If a third-party tool fails only on such a path, that is a bug worth reporting. Moving the
  clone to a path without spaces is a valid workaround. Manifests store relative paths, and
  hashes do not include file locations, so nothing is invalidated by the move.

## Corrupt manifest

```text
Error: <path>/manifest.json is not a valid manifest: ...
Restore the file from Git or re-create the video with `pnpm studio create`.
```

or `<path>/manifest.json is not valid JSON`.

**Cause.** Manifests are written atomically and validated before every write, so a torn or
invalid file from the CLI itself is unlikely. The usual causes are a hand edit, an unresolved
merge conflict, or a manifest written by a different schema version.

**Fix.** `manifest.json` is tracked in Git. Restore the last good version:

```bash
git log --oneline -- output/<id>/manifest.json
git restore --source=<commit> -- output/<id>/manifest.json
pnpm studio plan --video <id>
```

A restored manifest may be older than the files on disk. That is safe: every asset is checked
by hash and by file existence before it is reused. `plan` shows what will be regenerated.
Narration that was already generated is restored from `.cache/narration` at no cost, as long
as the cache has not been cleaned. Approvals recorded after the restored version are lost and
must be given again.

If the manifest was never committed, there is nothing to restore. Move the video directory
aside, run `create` again with the same id, copy `script.md`, `research.md` and
`storyboard.json` back, and run the pipeline. Cached narration is reused.

Files named `manifest.json.<hex>.tmp` are leftovers from an interrupted write and can be
deleted.

Do not edit `manifest.json` by hand to move a stage forward. Approvals and QA results are
bound to hashes and will not match.

## Cleaning caches safely

Look first:

```bash
pnpm studio cache inspect
```

| Cache                 | Location                             | Command                                     | Cost of deleting                                                                        |
| --------------------- | ------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Scene renders         | `output/<id>/scenes` for every video | `pnpm studio cache clean --yes`             | Render time only. Every scene is rendered again on the next render                      |
| Renderer bundle cache | `node_modules/.cache`                | `pnpm studio cache clean --bundle --yes`    | The next render starts more slowly                                                      |
| Narration cache       | `.cache/narration`                   | `pnpm studio cache clean --narration --yes` | Money, with ElevenLabs. Any clip not already copied into a video must be paid for again |

Notes:

- Without `--yes` the command deletes nothing and tells you what it would delete.
- With no scope flag, only scene renders are deleted. Narration is deleted only when you pass
  `--narration`.
- Cleaning scene renders affects every video, not one. It also removes each cut's
  `timeline.json`, which is rewritten by the next `preview` or `render`.
- Manifests are left alone. Missing files are detected and regenerated.
- Finished MP4s in `preview/` and `final/`, recordings and each video's `audio/` are not
  touched by any `cache clean` scope.
- Deleting the narration cache does not remove the clips a video already has in `audio/`.
  It removes the ability to restore earlier wordings and preview samples for free.
- Deleting `output/<id>/audio` or `output/<id>/recordings` by hand is safe for the manifest,
  but recordings must then be retaken and narration restored from the cache or paid for again.
