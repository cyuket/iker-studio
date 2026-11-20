---
name: iker
description: >-
  Turns one full video idea for Iker into a rendered, QA-checked and exported video on this
  machine, running every `pnpm studio` command itself. The human never types a command: at each
  gate (script, then final video) it shows what there is to review and asks in the conversation
  to approve, improve or stop, then records the human's answer. Use when the user types
  `/iker <idea>`, hands over an idea and says "make this into a video", or asks to continue a
  video started this way.
argument-hint: "<full video idea | existing video id>"
---

# Iker: idea to video

Target: `$ARGUMENTS`. If it is an existing id from `pnpm studio status`, continue that video from
the step `pnpm studio plan --video <id>` names. Otherwise it is a new idea. If it is empty, ask
the human for the idea with `AskUserQuestion` (options: paste an idea, continue an existing
video).

You run every command. The human only reads, watches, and answers your questions. Never tell the
human to run a command; if something must be done, do it or ask them to decide.

`CLAUDE.md` is binding. Read it first, then `iker-house-style`.

## How you ask

Every decision goes through `AskUserQuestion`, never a plain-text question. Each question must
stand on its own: name the video, say what you are asking about and what each option does. Use
these three options at both gates:

- **Approve**: you record the approval in the human's name, as given in this conversation.
- **Improve**: the human writes what to change (in "Other" or the notes). Apply it, rerun the
  affected steps and ask again. Repeat until they approve or stop.
- **Stop here**: leave everything as it is, journal it and report.

Before each gate, open what they need to review on their Mac with `open <path>` (it is a local
viewer, not an upload) and give the full paths in your message.

Only an answer the human gives at the gate counts. Approval earlier in the conversation, a
general "do everything", or silence is not approval. Never approve without asking.

## Never

- Approve without the human choosing **Approve** at that gate in this conversation.
- Run `publish`, `publish-auth`, `export --r2` or `storage prune --yes`. Publishing happens only
  if the human explicitly asks in the conversation, and then follows `iker-social-publishing`.
- Narrate with ElevenLabs before the script is approved, or with `--force`.
- Record `useiker.com` or any subdomain, or touch the recorder's target guard.
- Invent product facts, UI, prices, plan limits, statistics or results.
- Commit.

## Skills you follow

Read each skill's `SKILL.md` under `.claude/skills/<name>/` at the step that needs it.

| Step            | Skill                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Before writing  | `iker-house-style` (always, first)                                             |
| Research        | `researcher`                                                                   |
| Script          | `technical-scriptwriter`, plus `iker-social-publishing` for the title and hook |
| Storyboard      | `storyboard-designer`                                                          |
| Record          | `product-demo-recorder`                                                        |
| Narrate         | `elevenlabs-voice-director`                                                    |
| Preview, render | `video-editor`                                                                 |
| QA              | `quality-assurance-reviewer`                                                   |
| Overall order   | `video-director`                                                               |

Run `pnpm studio plan --video <id>` between steps and follow its `Next:` line. When a command
fails, rerun it with `--json` (`pnpm -s studio --json <command> ...`) to get the error code, fix
the cause, and rerun. After three failed attempts at one stage, explain the problem in plain
words, show the error output, and ask the human how to proceed (options: let me try another
way, skip this scene, stop here).

Keep the human posted with one short line as each stage starts and ends.

## Workflow

### 1. Set up

From the idea, settle the **title** (truthful, concrete pain, per `iker-social-publishing`), the
**audience** (default: owners of small salons and beauty businesses), the **template** (from
`pnpm studio templates list`: how-to `product-tutorial`, misconception `myth-vs-fact`, one
question `faq-answer`, client's view `how-your-client-sees-it`, a day's story `day-in-the-life`,
money review `monthly-money-check-in`, new feature `feature-announcement`, short and punchy
`quick-sketch`, concept explainer `business-explainer`) and a kebab-case **id**. Never reuse an
existing `output/<id>/`; add `-2`, `-3`.

Run `pnpm studio doctor`. Voice: `elevenlabs` when it prints `ok    ElevenLabs: configured`.
The video then speaks with the voice in `.env` (`ELEVENLABS_VOICE_ID`), which is the Iker voice
for every video: never pass `--voice-id` and never switch voices unless the human asks for one.
Only if ElevenLabs is not configured, fall back to `system` (or `silent` without macOS `say`) and
tell the human the narration will be a stand-in.

Only if the idea leaves the template or audience genuinely open, ask once with `AskUserQuestion`,
recommended option first. Otherwise decide and say what you chose. Then:

```
pnpm studio create --topic "<topic>" --title "<title>" --id <id> --audience "<audience>" --template <template> --voice-provider <voice>
```

### 2. Research

Follow `researcher`. Every fact goes into `output/<id>/research.md` with a fact id and a
checkable source, checked against `../slot-books`. If the idea needs something Iker does not
ship, leave it out and tell the human at gate 1.

### 3. Script

Follow `technical-scriptwriter`. Write `output/<id>/script.md`, then run
`pnpm studio script --video <id>` until it has no errors and as few warnings as stay truthful.

### 4. Storyboard

Follow `storyboard-designer`, then `pnpm studio storyboard --video <id>`. Before choosing
`iker-*` scenarios, check the local demo answers:
`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000`. If it does not,
ask the human (options: I will start slot-books now and you check again, use synthetic footage
for those scenes, use illustrations instead). Never start or seed slot-books yourself. Admin
scenes show account status and counts only.

Use photos where they help, not only illustrations (house style section 4): a `photo` scene
from `assets/images/README.md` for the real people, places and objects the story is about,
usually in the hook and setup. Prefer the owner's `own-*` photos when one fits. When nothing in
the library fits, download one: follow "Adding a photo" in `assets/images/README.md` (Pexels or
Unsplash only, look at it before using it, add its catalogue row). Never present a stock model as
an Iker customer.

Add music and sound effects from the shared library (house style section 6), in the same
storyboard edit:

- **Music**: set `music` on every cut, picked by mood from `assets/music/README.md` (chill or
  lo-fi for tutorials, upbeat for shorts), volume about 0.08, with its `licence` (and `credit`
  for a Kevin MacLeod track).
- **Sounds on every action**: recorded product footage plays a click on every click, typing for
  every typed field and a sweep on every scroll by itself; keep `actionSounds` on. For motion
  graphics and photo scenes, add `sounds` on the cue of every action the viewer sees: a message
  arriving, a tap or button, text typing in, a status landing, a reveal, the hook. Pick files
  from `assets/sfx/README.md`, volume 0.3 to 0.6, up to 8 per scene. Use only files that exist
  in `assets/sfx/`.

### 5. Gate 1: script approval

Run `pnpm studio narrate --video <id> --dry-run` for the cost. Open
`output/<id>/storyboard.html` and `output/<id>/script.md`. In your message, show the title, each
cut's duration, the spoken narration of the main cut (in full if short, otherwise scene by
scene), any lint warnings, anything you left out of the idea and why, the narration cost, the voice
(ElevenLabs, `.env` voice), the photos used and what each shows, and the music track and
sounds you chose per scene.
Then ask: "Approve the script for <id>?" with Approve / Improve / Stop here.

On **Approve**:

```
pnpm studio approve --video <id> --stage script --by "<git config user.name>" --note "Approved by <name> in a Claude Code conversation (/iker), after reviewing script.md and storyboard.html."
```

On **Improve**: edit, rerun steps 3 and 4, and ask again. Any edit to `script.md` after approval
voids it, so after an approval only edit storyboard visuals unless you ask again.

### 6. Record and narrate

Follow `product-demo-recorder`: `pnpm studio record --video <id>`. On `UNSAFE_TARGET`, stop and
tell the human. For each unverified scenario, pull frames
(`ffmpeg -ss <t> -i <file> -frames:v 1 <scratchpad>/<name>.png`) and look at them; an error page,
login screen or real-looking business data is a failed take.

Follow `elevenlabs-voice-director`: `pnpm studio narrate --video <id>`. Do not approve
pronunciations yourself; list pending ones for gate 2.

### 7. Preview, render, QA

Follow `video-editor` and `quality-assurance-reviewer`:

```
pnpm studio preview --video <id>
pnpm studio render --video <id>
pnpm studio qa --video <id>
```

Look at frames from the preview before the final render and fix what you can see is wrong. Fix
QA failures within the attempt limit.

### 8. Gate 2: final approval

Open each final cut (the path `render` prints) and `output/<id>/qa/<cut>-final/report.html`. In
your message, per cut: path, duration, QA result, each warning in one line, and what a person must
judge by eye and ear (from the report's checklist). Also name the music track and the sounds used, and
list stand-ins (system/silent voice, synthetic footage), unverified scenarios and pending pronunciations. Ask: "Approve the final
video for <id>?" with Approve / Improve / Stop here. If QA has warnings, say so in the Approve
option's description.

On **Approve**:

```
pnpm studio approve --video <id> --stage final --by "<git config user.name>" --note "Approved by <name> in a Claude Code conversation (/iker), after watching the cut and reading the QA report." [--acknowledge-warnings]
```

Add `--acknowledge-warnings` only if the warnings were in the question they approved. The CLI
refuses final approval while any cut fails QA; fix the failures first. If the voice is the
`system` or `silent` stand-in, say in the question that approving releases stand-in narration, and
recommend Improve (rerun narration once ElevenLabs is available) over Approve.

On **Improve**: apply the change. A script change voids gate 1, so go back to step 5. A visual
change reruns step 7 and asks again.

### 9. Export, journal, report

After final approval, run `pnpm studio export --video <id>` (local package only) and open
`output/<id>/export/`. Add an entry to `.flitstack/CHANGELOG.md` directly under the intro
(`## <UTC timestamp> · Claude Code (/iker)`, then **What**, **Why**, **Decisions**), including who
approved each gate in the conversation. Update `.flitstack/PLAN.md` only if a blocker changed.

Close with: the export path, each cut's file and duration, the narration spent, and anything
synthetic, unverified or pending. If the human wants it published, that is a separate request
that follows `iker-social-publishing`.
