---
name: product-demo-recorder
description: >-
  Records the product flows an Iker Video Studio storyboard needs with `pnpm studio record`, and
  writes, fixes or verifies recording scenarios in src/scenarios. Use when a product scene needs
  footage, a recording fails (preflight, sign-in, a step timing out), a retake is needed,
  something on screen must be masked, or a scenario must be authored or promoted from unverified
  to verified.
argument-hint: "[video-id]"
---

# Product demo recorder

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

## Responsibilities

- Capture each scenario the storyboard's `product` scenes reference, once, reproducibly.
- Author scenarios that survive a restyle and never depend on timing luck.
- Keep production, real businesses' and clients' data and credentials out of every frame and
  file.
- Never film a Platform Admin or Super Admin view that shows a business's income, expenses
  or statements. Those roles are walled off from financial data in Iker; footage must never
  suggest otherwise.
- Say exactly what a capture is: synthetic fixture or real product, verified or not.

## Required inputs

- A validated storyboard (`pnpm studio storyboard --video <id>`) whose `product` scenes name
  scenario ids from `pnpm studio scenarios`.
- `synthetic` target: nothing. The fixture in `fixtures/synthetic-demo` is served locally.
- `iker` target, in `.env`:
  - `IKER_DEMO_BASE_URL`: a non-production copy of the Iker web app. Iker has no Sandbox
    mode, so this is either a local copy of the `slot-books` web app at
    `http://localhost:3000` with demo data, or a staging host (examples use
    `https://staging.iker.example`).
  - `IKER_DEMO_AUTH`: `password` (signs in with `IKER_DEMO_USERNAME` and
    `IKER_DEMO_PASSWORD`, an account without two-factor) or `session` (reuses a session the
    human saves with `pnpm studio demo-login`).
  - Optional `IKER_PRODUCTION_HOSTS`: extra hostnames to refuse, comma separated.
- Demo data that is obviously fictional: a demo business, services, bookings, clients at
  `example.com` addresses, fictional amounts. Slot-books' `supabase/seed.sql` only creates a
  local Super Admin, so the business and its records have to be set up for the demo.
- None of this is configured for Iker yet, so only `synthetic-*` scenarios can be recorded
  today.

## Expected outputs

Per scenario, under `output/<id>/recordings/<scenario-id>/`:

- `recording.mp4` (30 fps), `timeline.json` (each step's start, end and element region),
  `screenshots/<name>.png` for every `screenshot` step.
- On failure: `debug/failure.txt` and `debug/failure.png`. No trace, HAR or console dump is
  kept, on purpose.

Manifest: `assets.recordings.<scenario-id>` with `hash`, `target` (`synthetic` or `iker`),
`displayHost`, `verified`, paths and duration. `stages.recording` becomes `completed` when
every required scenario has a capture. A capture is reused until the scenario definition,
the fixture files, or the demo origin and account change.

## Targets and status

- `synthetic` scenarios (`synthetic-smoke`, `synthetic-new-booking`,
  `synthetic-record-payment`) drive the bundled "Demo Console", a labelled fixture for a
  booking business. It is not the Iker dashboard. Every page carries a "SYNTHETIC DEMO"
  banner, scenes built from it get an on-screen disclosure label, and the description gets
  a note. Never crop, mask or disable those. Footage from them is a stand-in for pipeline
  checks, not a product demonstration.
- `iker` scenarios (`iker-*`) drive the real Iker web app in the demo environment. List them
  with `pnpm studio scenarios`.
- `unverified` means the routes and selectors were read from the slot-books source code and
  never run end to end. Every `iker-*` scenario is unverified today. Recording one is
  allowed, the CLI prints `Review needed`, and QA warns on the footage.
- A scenario becomes `verified` only after it has run green end to end against its real
  target and a person watched the whole capture. Then change `status` to `"verified"` in its
  file and extend `evidence` with the environment and date of that run. Never flip the
  status on the strength of reading code.

## Scenario authoring rules

Scenarios are TypeScript objects passed to `defineScenario` in `src/scenarios/*.ts` and
registered in `src/scenarios/index.ts`. Schema: `src/domain/recording.ts`.

- **Targets are roles, labels and test ids only**: `{ role, name, exact? }`, `{ label, exact? }`,
  `{ testId }`, `{ text, exact? }`, `{ placeholder }`. There is no CSS selector option. If an
  element has no accessible name, that is a product bug to report, not a reason to add one.
- **No sleeps.** Wait for the application with `waitFor` (element `visible` or `hidden`) or
  `waitForState` (`urlIncludes`, `textVisible`, `networkIdle`). `dwell` (100 to 10000 ms) and
  `highlight.holdMs` are pacing for the viewer only. Never use them to wait for a page.
- Steps: `navigate` (path relative to the base URL), `authenticate`, `click`, `type`,
  `select`, `scroll`, `waitFor`, `waitForState`, `highlight`, `screenshot` (name
  `^[a-z0-9-]+$`), `mask`, `verify` (optional `containsText`), `dwell`.
- **Credentials never appear in a scenario.** `authenticate` signs in off camera with the
  account from the environment. The recorder never attempts a second factor.
- **Preflight.** List, per page, the elements the flow depends on in `preflight`. They are
  checked off camera before recording, so a renamed button costs seconds, not a take.
- **Masking.** Add a `mask` step with `targets` before anything sensitive can appear: a real
  phone number, email address, bank account detail on a payment-instructions screen, or an
  uploaded proof-of-payment image that is not demo data. Masked elements stay blurred for
  the rest of the recording, across navigations.
- **Role boundary.** A scenario that signs in as a Platform Admin or Super Admin covers
  account management only (onboarding, status, plans). It never navigates to a business's
  bookkeeping, and if such data ever appears on an admin screen, stop and report it as a
  product bug rather than masking it.
- Fill `evidence` (the slot-books files the selectors came from) and `prerequisites` (what
  the environment must contain). Start every new scenario as `status: "unverified"`.
- Nothing random and nothing clock-dependent: the same scenario must produce the same video.

## Workflow

1. `pnpm studio scenarios` to see ids, targets and status. `pnpm studio plan --video <id>`
   shows how many recordings are stale.
2. Record everything the storyboard needs: `pnpm studio record --video <id>`.
3. One scenario: `pnpm studio record --video <id> --scenario <scenario-id>`.
4. Retake an up-to-date capture: `pnpm studio record --video <id> --scenario <scenario-id> --retake`.
5. Watch the browser while debugging: add `--headed`.
6. Reuse another video's captures instead of recording: `--reuse-from <other-video-id>`.
7. Watch every new `recording.mp4` start to finish. Check: only demo data, nothing that
   needed a mask, the right business selected, the right screen at each step, no dialog
   covering it, and no admin screen showing a business's money.
8. Use `timeline.json` to hand `storyboard-designer` exact regions and times for annotations
   and `focus`.
9. After changing scenario code run `pnpm validate`, and `pnpm test:integration` if you
   touched the recorder or the fixture.

## Validation criteria

- `pnpm studio record --video <id>` exits 0 with every needed id under `Recorded:` or
  `Up to date:`.
- `pnpm studio plan --video <id>` prints `Recordings: 0 of N to record`.
- You watched each capture. Any `Review needed: "<id>" is an unverified scenario` line was
  passed on to the human.
- No production host, real business or client record, or credential is visible in any frame.

## Failure handling

- `UNSAFE_TARGET` "Refusing to record <host>: it is a production host." (`useiker.com`, every
  subdomain of it, and any host in `IKER_PRODUCTION_HOSTS`). Stop. Point `IKER_DEMO_BASE_URL`
  at a local copy or staging. There is no opt-in: Iker has no Sandbox, so production is never
  recorded. Never edit `target-guard.ts` to get past it.
- `UNSAFE_TARGET` "... it is not encrypted." / "must not contain a username or password." /
  "Scenario path ... leaves the recording origin." Use an `https://` origin (plain `http` is
  accepted only for `localhost` and `127.0.0.1`), no credentials in the URL, and relative
  scenario paths.
- `CONFIG_INVALID` "... is not configured: ...". The demo variables are missing in `.env`.
  This is the expected state today for `iker-*` scenarios. Report it as blocked.
- `RECORDING_FAILED` "Preflight failed on <path>: <element> is not visible (or matches more
  than one element)." The hint says whether the page bounced to sign-in or the environment
  lacks the prerequisites. Compare the name with the product, then fix the scenario.
- `RECORDING_FAILED` "The demo account asks for two-factor authentication." / "Sign-in did
  not complete". Use a demo account without two-factor and check its credentials.
- `RECORDING_FAILED` "Recording failed at step N (<action> <target>): ...". Open
  `output/<id>/recordings/<scenario-id>/debug/failure.png` and `failure.txt`, then rerun with
  `--headed`. Fix the wait or the target. Do not add a `dwell` to paper over it.
- `RECORDING_FAILED` "The capture of ... is empty or unreadable." / "The browser produced no
  video frames." Retake. If it repeats, run `pnpm studio doctor`.
- `DEPENDENCY_MISSING` "The Chromium browser used for recording is not installed." Run
  `pnpm playwright:install`.
- `VALIDATION_FAILED` "No enabled scene uses: <id>." The `--scenario` id is not in this
  storyboard. `NOT_FOUND` "The storyboard refers to an unknown scenario". Fix the
  storyboard's `scenarioId` or register the scenario in `src/scenarios/index.ts`.

## Relevant project commands

```
pnpm studio scenarios
pnpm studio record --video <id>
pnpm studio record --video <id> --scenario <scenario-id> --retake --headed
pnpm studio plan --video <id>
pnpm studio doctor
pnpm playwright:install
pnpm test:integration
```

## Recording the real product with a saved session

When `IKER_DEMO_AUTH=session` (for example an account that signs in by magic link), the
human runs `pnpm studio demo-login` and signs in themselves in the window that opens on
`/login`. It finishes once the browser reaches a signed-in page (anything other than `/`,
`/login`, `/auth/*` or `/choose-location`) and saves the session to
`~/.config/iker-video-studio/demo-session.json`. Never
attempt the sign-in for them. Read pages and record promptly after signing in.

- Read a page before writing a scenario: `pnpm studio demo-snapshot --path <path>` prints the
  page URL, then its accessibility tree. Add
  `--open "tab:<name>"` to open a tab or disclosure first, `--out <file>` to save the tree and
  `--screenshot <file>` for a picture. Never open a control that saves.
- Table rows are clickable as a whole: target `{ role: "row", name: "<id or name>" }`.
- Narrow an ambiguous target with `within` (a named dialog or row) or `nth`.
- `dismiss` closes something that may not be there, such as a first-run tip.
- `type` with `replace: true` overwrites what a field already holds.
- The recorder does no on-page business or environment check for Iker. Safety comes only
  from the host guard, so the demo environment must hold demo data and nothing else.
- A scenario that creates records (a booking, a payment, an expense) changes the demo data
  on every take. Say so before recording it, and reset the demo data if the next take needs
  the starting state.
