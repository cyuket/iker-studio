# Iker Video Studio

A TypeScript CLI (`pnpm studio <command>`) that turns a script into a recorded, narrated,
rendered and QA-checked video for Iker (booking, manual-payment tracking and bookkeeping for
Nigerian service businesses: salons, photographers, tutors). Codex
is the interactive director. The CLI does the deterministic work and stays fully usable
without Codex: never add a step that needs a running Codex process.

## Architecture

Dependencies point inward only. ESLint enforces it (`no-restricted-imports` in
`eslint.config.js`), so a wrong import fails `pnpm lint`.

```
domain  <-  application  <-  infrastructure  <-  cli
```

| Path                      | Holds                                                                                                  | May import               |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| `src/domain`              | Schemas and pure rules: script, storyboard, formats, stages, QA, voice, recording, manifest            | nothing outside `domain` |
| `src/application`         | Use cases and ports (`ports.ts`): authoring, narration, recording, render, qa, export, approval        | `domain`                 |
| `src/infrastructure`      | Adapters: FFmpeg, ElevenLabs, Playwright, Remotion, R2, YouTube, config, file system                   | `domain`, `application`  |
| `src/cli`                 | Commander commands and the container that wires adapters                                               | everything               |
| `src/remotion`            | The video design system and compositions                                                               | `domain` types only      |
| `src/scenarios`           | Recording scenarios (`synthetic.ts`, `iker.ts`) , registered in `index.ts`                             | `domain`                 |
| `templates/<id>`          | `template.json` plus a finished `demo/` (script, research, storyboard)                                 |                          |
| `brand/`                  | `brand.json`, `pronunciations.json`, logos. Values come from the Iker brand kit, see `brand/README.md` |                          |
| `fixtures/synthetic-demo` | The labelled "Demo Console" stand-in site. It is not the product                                       |                          |
| `output/<video-id>`       | One directory per video. Text sources are tracked, media is ignored                                    |                          |

Per video: `manifest.json` (state, written only by the CLI), `script.md`, `research.md`,
`storyboard.json` are the sources. Everything else (`audio/`, `recordings/`, `scenes/`,
`subtitles/`, `preview/`, `final/`, `thumbnails/`, `qa/`, `metadata/`, `export/`,
`storyboard.html`) is generated.

## Pipeline

Stage order comes from `src/domain/stages.ts`. Let the CLI decide what is next:
`pnpm studio status --video <id>` and `pnpm studio plan --video <id>` both print a `Next:`
line. `plan` also lists stale assets and the narration cost.

| Stage                                  | Command                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------- |
| idea                                   | `pnpm studio create --topic "<topic>" --id <id>`                          |
| research (manual)                      | edit `output/<id>/research.md`                                            |
| script                                 | `pnpm studio script --video <id>`                                         |
| storyboard                             | `pnpm studio storyboard --video <id>`                                     |
| human gate 1                           | `pnpm studio approve --video <id> --stage script`                         |
| recording                              | `pnpm studio record --video <id>`                                         |
| voice                                  | `pnpm studio narrate --video <id>`                                        |
| motion, composition, subtitles, render | `pnpm studio preview --video <id>` then `pnpm studio render --video <id>` |
| qa                                     | `pnpm studio qa --video <id>`                                             |
| human gate 2 (approval)                | `pnpm studio approve --video <id> --stage final`                          |
| export                                 | `pnpm studio export --video <id>`                                         |
| publish (optional, off by default)     | `pnpm studio publish --video <id> --cut <cut> --confirm <id>`             |

Setup and housekeeping: `pnpm studio init`, `pnpm studio doctor`, `pnpm studio templates list`,
`pnpm studio templates validate`, `pnpm studio scenarios`, `pnpm studio costs --video <id>`,
`pnpm studio cache inspect`. Run `pnpm studio <command> --help` before using a flag you have
not used in this session. Add the global `--json` flag (`pnpm -s studio --json status --video <id>`)
to get a machine-readable result. Failures exit non-zero and print `Error: <message>` plus a
hint on stderr. The error code (`STAGE_BLOCKED`, `APPROVAL_REQUIRED`, `VALIDATION_FAILED`,
`UNSAFE_TARGET`, ...) appears only in the `--json` output.

## Hard rules

1. Never commit secrets or media. `.env`, tokens and everything rendered under `output/**` are
   ignored by Git. Keep it that way. Never print or log a secret value.
2. Never fabricate product UI, results, metrics or test outcomes. If something was not run,
   say so. Report failures with their output.
3. Never record production. `useiker.com` and every subdomain of it are refused by the
   recorder (`UNSAFE_TARGET`), with no opt-in. Do not work around it. Iker has no Sandbox
   mode: record a local copy of the web app (`http://localhost:3000` from `slot-books`, with
   demo data) or a staging host (`https://staging.iker.example` in examples). The recorder does
   no on-page business check, so the environment must hold demo data and nothing else.
4. Never show a business's money in a Platform Admin or Super Admin view. Admins manage
   business accounts but never see their income, expenses, payments or statements, and a
   video must not imply otherwise. Admin scenes show account status and counts only.
5. Narration is generated only after a person approved the script. Any edit to `script.md`
   voids that approval.
6. The two approvals belong to a human. Never run `pnpm studio approve` on your own
   initiative. `--by` defaults to the machine's `git user.name`, so an approval you run is
   recorded in the human's name. Stop, show what there is to review, and give them the command.
   The one exception is a pipeline test with a stand-in voice: use
   `pnpm studio approve --video <id> --stage script --automated --by "Codex"`. That
   records an automated approval, which unlocks only the `system` and `silent` voices. It
   never unlocks ElevenLabs narration, final approval, export or publishing, and QA reports
   it as a failure until a person approves the script. Say so when you report the result.
7. Publishing happens only when the human explicitly asks for it in the conversation.
   `publish`, `publish-auth`, `export --r2` and `storage prune --yes` are never part of an
   automatic run.
   Before every video upload or scheduled post on any platform, apply
   `iker-social-publishing`: the cover must visibly contain the complete video title,
   the caption must lead with a truthful concrete pain (chasing payments in DMs, no-shows,
   a walk-in nobody wrote down) and a reason to watch, never fear or an invented stat, and the
   destination cover preview must pass inspection. No compliant cover means no upload.
8. Label synthetic footage. Scenes from `synthetic-*` scenarios carry an on-screen label and a
   description note automatically. Never remove them, and never describe such footage as the
   product.
9. Verify product facts before scripting. Start from `knowledge/product-facts.md` and check
   the fact's source in `../slot-books` (slot-books wins when they disagree). Each fact goes
   into `research.md` with a source someone else can check. A claim without a fact id does not
   go in the script. No invented prices, plan limits or statistics.
10. No unsupported claims and no generic AI marketing phrases (`BANNED_PHRASES` in
    `src/domain/script.ts`). No em dashes in viewer-facing copy.
11. Stand-ins are not production output. Today there are no ElevenLabs or demo-environment
    credentials on this machine, so the `system` and `silent` voices and the `synthetic-*`
    scenarios are all that can run. Describe anything made with them as a pipeline check.

## Iker product wording

Full list with sources: `knowledge/product-facts.md` ("What things are called") and
`knowledge/audience-and-voice.md`. The essentials:

- Iker **records and tracks** payments. It does not take, collect, process or hold them. The
  client pays the business outside the app and uploads **proof of payment**; the business
  confirms ("Confirm booking", "Reject payment"). Iker does not verify transfers.
- Use the product's labels: booking link, Bookings, Add walk-in, Rate card, Record a payment,
  Paid so far, Balance remaining, Awaiting confirmation, Refund Policy, statement of accounts.
- Money is written `₦45,000` and spoken "forty-five thousand naira". Example amounts, people
  and businesses on screen are clearly fictional.
- "No commission on bookings or deposits" is a fact. "Free" is not a blanket fact, and plan
  prices are never quoted. Say "depending on your plan" for plan-gated features.
- Never promise outcomes: no "zero no-shows", "never chase a payment again" or "guarantee".
- Only shipped features are presented as available. Planned ones are called planned or left out.
- The call to action is "Get started" at `useiker.com` (it opens the contact form; the Iker team
  sets up the business with the owner). "Book a demo" is the secondary one. There is no
  "Start free", "Sign up free" or app download.
- Tagline: "Get booked. Get paid."

## Validating changes

- `pnpm validate`: typecheck, lint, format check and unit tests. Run it before every commit.
- `pnpm test:integration`: real FFmpeg and Chromium against the local fixture. Run it when
  you touch recording or media code.
- `pnpm test:e2e`: the full synthetic pipeline including a Remotion render. Slow.
- `pnpm studio templates validate` after editing a template or its demo, and
  `pnpm studio doctor` after editing `brand/` or `.env`.
- Do not claim a check passed unless you ran it in this session and saw it pass.

## Commits

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), one coherent
change per commit, imperative subject. Never commit `.env` or `output/**` media. Only
`manifest.json`, `script.md`, `research.md` and `storyboard.json` of a video are tracked.
Commit only when asked.

## Agent journal (required by the organisation's agent contract)

- When a task is finished, and before any handoff, add an entry to `.flitstack/CHANGELOG.md`.
  It is append-only with the newest entry first: add yours directly under the intro, never edit
  or remove earlier ones. Use the existing shape: `## <UTC timestamp> · <who>`, then **What**,
  **Why** and **Decisions**.
- Keep `.flitstack/PLAN.md` current: phase states and the open blockers.

## Which skill for what

Skills live in `.agents/skills/<name>/SKILL.md` (mirrored in `.claude/skills/`). Most take a
video id as their argument.

| Need                                                            | Skill                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The owner's standing rules: hook, names, brand, taste, voice    | `iker-house-style` (read before any script, storyboard or publish)                    |
| Take a video through the whole pipeline, or find the next step  | `video-director`                                                                      |
| Establish and source product facts in `research.md`             | `researcher`                                                                          |
| Write or fix `script.md`, satisfy the lint                      | `technical-scriptwriter`                                                              |
| Design scene visuals in `storyboard.json`                       | `storyboard-designer`                                                                 |
| Record product flows, write or verify a scenario                | `product-demo-recorder`                                                               |
| Voice settings, pronunciations, narration and its cost          | `elevenlabs-voice-director`                                                           |
| Change the Remotion design system or a component                | `motion-graphics-designer`                                                            |
| Preview, render, re-render, music, thumbnails, caches           | `video-editor`                                                                        |
| Run QA and read the report with the reviewer                    | `quality-assurance-reviewer`                                                          |
| Required covers, pain-led captions and platform delivery checks | `iker-social-publishing` (every platform, every upload)                               |
| Titles, description, chapters, export package, publishing       | `youtube-content-strategist` (human-invoked only: `/youtube-content-strategist <id>`) |
