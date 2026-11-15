---
name: video-director
description: >-
  Directs an Iker Video Studio video end to end through the `pnpm studio` CLI in stage order,
  delegating each stage to the specialist skills and stopping at the two human approval gates. Use
  when the user wants to make a video, continue one, asks "what is next" for a video, or wants an
  honest status of what is real, synthetic or blocked.
argument-hint: "[video-id | topic for a new video]"
---

# Video director

Target: `$ARGUMENTS`. If it is empty, run `pnpm studio status` and ask which video. If it is
a topic rather than an existing id, start a new video (step 1).

## Responsibilities

- Move one video through the pipeline in the order the CLI enforces, one stage at a time.
- Decide the next step from `pnpm studio status` and `pnpm studio plan`, never from memory.
- Hand each stage to the skill that owns it and check its validation criteria before moving on.
- Stop at both human gates and ask. Never approve, export to R2 or publish on the human's behalf.
- Report plainly what is synthetic, stand-in, unverified or blocked.

## Required inputs

- A topic, audience and content type for a new video, or an existing video id.
- A machine that passes `pnpm studio doctor`.
- For production output: ElevenLabs credentials and an Iker demo environment in `.env` (a
  local copy of the web app at `http://localhost:3000` with demo data, or a staging host).
  Neither is configured for Iker yet, so plan for stand-ins and say so up front.

## Expected outputs

- `output/<id>/` with `manifest.json`, `script.md`, `research.md`, `storyboard.json` (tracked)
  and the generated directories `recordings/`, `audio/`, `scenes/`, `subtitles/`, `preview/`,
  `final/`, `thumbnails/`, `qa/`, `metadata/`, `export/`.
- `manifest.json` with every stage in `stages` at `completed`, `approvals.script` and
  `approvals.final.<cut>` set by a named person, and one `exports` record per cut.
- A closing report to the human (see step 9).

## Workflow

1. **Start.** `pnpm studio doctor`, then for a new video pick a template with
   `pnpm studio templates list` and run
   `pnpm studio create --topic "<topic>" --id <id> --audience "<audience>" --type PRODUCT_TUTORIAL --template product-tutorial`.
   Without ElevenLabs credentials add `--voice-provider system` (macOS `say`) or
   `--voice-provider silent`. `--demo` copies the template's finished demo instead of a skeleton.
2. **Research.** Use `researcher`. It starts from `knowledge/` (sourced product facts and
   the audience and voice notes) and the `slot-books` docs. No script work until
   `research.md` has sourced facts.
3. **Script.** Use `technical-scriptwriter`, ending with `pnpm studio script --video <id>`.
   Apply `iker-house-style` for the hook and voice, and `iker-social-publishing` to choose a
   truthful title and captions that lead with a concrete, real pain (chasing payments in DMs,
   no-shows), never fear-mongering or invented stats. Plan a readable cover that shows the
   full title for every intended platform before rendering.
4. **Storyboard.** Use `storyboard-designer`, ending with
   `pnpm studio storyboard --video <id>` and the preview page `output/<id>/storyboard.html`.
5. **Human gate 1: script approval.** Stop. Show the human `script.md`, the storyboard
   preview, the lint warnings and the narration estimate from
   `pnpm studio narrate --video <id> --dry-run`. Give them the command and wait:
   `pnpm studio approve --video <id> --stage script`.
6. **Record and narrate** (order between the two does not matter).
   `product-demo-recorder` runs `pnpm studio record --video <id>`.
   `elevenlabs-voice-director` runs `pnpm studio narrate --video <id>`.
7. **Preview, then render.** Use `video-editor`: `pnpm studio preview --video <id>`, review,
   then `pnpm studio render --video <id>`. Send visual defects in a component to
   `motion-graphics-designer`, defects in one scene's content to `storyboard-designer`.
8. **QA and human gate 2: final approval.** Use `quality-assurance-reviewer`:
   `pnpm studio qa --video <id>`. Stop. The human watches the video, reads
   `output/<id>/qa/<cut>-final/report.html`, works through its checklist, and runs
   `pnpm studio approve --video <id> --stage final` themselves (with `--acknowledge-warnings`
   if they accept the warnings).
9. **Export and report.** After approval run `pnpm studio export --video <id>` (local
   package only; it regenerates `metadata/` too). For titles, thumbnails choice, R2 upload or
   YouTube, tell the human to invoke `/youtube-content-strategist <id>`: that skill is
   human-triggered by design. Then append to `.flitstack/CHANGELOG.md` and update
   `.flitstack/PLAN.md`.
   Before any separately authorised publishing, apply `iker-social-publishing` and its
   cover/caption preflight and live verification gates for each destination.

Between every step run `pnpm studio plan --video <id>` and follow its `Next:` line and
`Stages to run:` list. After any edit to `script.md`, go back to step 3: the approval is void.

The closing report states, per cut: the file, its duration, the QA result, who approved, and
each of these that applies: narration is the `system` or `silent` stand-in; footage is from a
`synthetic-*` scenario; a scenario is `unverified`; pronunciations are still `pending`;
anything skipped or failed. Never call stand-in output finished.

## Validation criteria

- `pnpm studio plan --video <id>` prints `Stages to run: none, everything is up to date`.
- `pnpm studio status --video <id>` shows all 13 stages `completed`, and for every cut
  `Final render: current`, `QA: passed` (or `passed, N warning(s)`), `Approved: yes`.
- `output/<id>/export/<cut>/SHA256SUMS` exists for every cut.
- Both approvals were given by the human in this conversation or run by them.

## Failure handling

Error codes show with `--json` (`pnpm -s studio --json plan --video <id>`); the text below is
what the terminal prints.

- `STAGE_BLOCKED` "<Stage> needs <Stage> to be complete first." Run the command in the hint.
  Do not skip ahead.
- `STAGE_BLOCKED` "The script has changed since it was last checked." or "The script changed
  after the storyboard was built." Run `pnpm studio script --video <id>` then
  `pnpm studio storyboard --video <id>`, then return to gate 1.
- `STAGE_BLOCKED` "storyboard.json was edited since it was last validated." Run
  `pnpm studio storyboard --video <id>`.
- `APPROVAL_REQUIRED` (narrate, approve, export, publish). This is a gate, not an error to
  fix. Stop and ask the human.
- `CONFIG_INVALID` "<integration> is not configured: ...". A credential is missing. Say what
  is blocked. Offer the stand-in (`--voice-provider system`, a `synthetic-*` scenario) only
  as a labelled pipeline check.
- `UNSAFE_TARGET`. The demo URL is production (`useiker.com` or a subdomain) or unencrypted.
  Stop. Never change the guard. Iker has no Sandbox, so production is never recorded.
- `NOT_FOUND` "There is no video with the id ...". Use an id from `pnpm studio status`.
- A stage `failed` in `status` shows its message in the Detail column. Fix the cause and
  rerun the same command: finished scenes, clips and recordings are checkpointed and reused.

## Relevant project commands

```
pnpm studio doctor
pnpm studio templates list
pnpm studio scenarios
pnpm studio status
pnpm studio status --video <id>
pnpm studio plan --video <id>
pnpm studio plan --video <id> --quality preview
pnpm studio costs --video <id>
```
