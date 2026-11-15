# Contributing

This is a private Iker repository. Contributions come from the team and from Claude Code
working under a team member's direction. Read [README.md](README.md) first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup

```bash
brew install ffmpeg        # macOS. Debian or Ubuntu: sudo apt-get install -y ffmpeg
nvm install                # reads .nvmrc (Node 24). Node 22.12 or newer is required
corepack enable            # provides the pinned pnpm 9
pnpm install
pnpm studio init           # .env, working directories, both browsers
pnpm studio doctor
```

`.npmrc` sets `engine-strict=true` and `save-exact=true`. Dependencies are pinned to exact
versions. When you add or upgrade one, keep it exact and commit `pnpm-lock.yaml`.

Three pins have reasons. Do not move them casually:

- `typescript` stays on 6.0 until `typescript-eslint` supports TypeScript 7.
- `zod` matches the exact version `@remotion/studio` depends on. Upgrade it with Remotion.
- All `remotion` and `@remotion/*` packages must be the same version.

Re-read Remotion's licence when upgrading it. See [docs/LICENSING.md](docs/LICENSING.md).

## Branches, commits and merging

- `main` is protected. Do not push to it directly.
- Work on a short-lived branch named for the kind of change: `feat/<topic>`, `fix/<topic>`,
  `chore/<topic>` or `docs/<topic>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
  `feat: add a social-landscape cut to the tutorial template`,
  `fix(recording): refuse scenario paths that leave the origin`,
  `docs: describe the pronunciation workflow`.
- Pull requests are squash-merged, so the pull request title becomes the commit on `main`.
  Write it as a Conventional Commit.
- Keep a pull request to one concern. A change that touches `src/remotion` or `src/domain`
  invalidates every rendered scene of every video, so say so in the description.
- Say in the description what you ran and what you did not. "Not run against a live demo
  environment" is useful information.

Agent work is recorded in `.flitstack/CHANGELOG.md` (append-only) and the current plan in
`.flitstack/PLAN.md`.

## Validation commands

Run these before opening a pull request:

```bash
pnpm validate                    # typecheck, lint, format check and unit tests
pnpm test:integration            # real FFmpeg and Chromium against local fixtures
pnpm studio templates validate   # every template and its demo
```

And when you changed rendering, recording or the pipeline:

```bash
pnpm test:e2e                    # the synthetic pipeline end to end, including a Remotion render
```

Individual commands:

| Command                 | What it runs                                        |
| ----------------------- | --------------------------------------------------- |
| `pnpm typecheck`        | `tsc --noEmit` over `src`, `tests` and config files |
| `pnpm lint`             | ESLint with `--max-warnings 0`                      |
| `pnpm format:check`     | Prettier check                                      |
| `pnpm format`           | Prettier write                                      |
| `pnpm test`             | The `unit` Vitest project                           |
| `pnpm test:integration` | The `integration` project                           |
| `pnpm test:e2e`         | The `e2e` project                                   |
| `pnpm test:all`         | All three                                           |
| `pnpm build`            | Bundles the CLI to `dist/` with tsup                |

Continuous integration (`.github/workflows/ci.yml`) runs type-check, lint, the format check,
unit tests, a build, template validation, `doctor`, the integration tests and the synthetic
end-to-end render. It uses no secrets. `.github/workflows/render.yml` is the manually
triggered render workflow. Both are described in the README. Actions in both files are pinned
to commit SHAs. Keep them pinned when you update one.

The `Dockerfile` mirrors the CI environment. It has not been build-tested. If you change the
system dependencies in CI, change it too.

## Testing policy

`vitest.config.ts` defines three projects:

| Project       | Location               | What belongs there                                                                                            | Needs                 |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------- |
| `unit`        | `tests/unit/**`        | Domain rules, use cases with fake ports, adapters with a mocked HTTP layer or fake client. Fast, no processes | Nothing               |
| `integration` | `tests/integration/**` | Real FFmpeg, real Chromium, the real file system and the CLI as a process, against local fixtures only        | FFmpeg, Chromium      |
| `e2e`         | `tests/e2e/**`         | The whole synthetic pipeline: record, narrate with the `silent` voice, render with Remotion, QA               | FFmpeg, both browsers |

Rules:

- **Paid APIs are always mocked.** No test may call ElevenLabs, YouTube, Google OAuth or R2.
  The ElevenLabs adapter takes `fetch` and `sleep` as options, the YouTube adapter takes
  `fetch`, and the R2 adapter takes a `client`. Tests inject those.
- **Never spend ElevenLabs credits in CI.** CI uses the `silent` voice. Do not add ElevenLabs
  credentials to CI secrets for the test workflow.
- **No test touches a real Iker environment.** Recording tests use
  `fixtures/synthetic-demo` on loopback.
- **Use the fakes.** `tests/helpers/fakes.ts` has an in-memory file system, an in-memory
  manifest repository, a stepping clock, fake media tools and a counting synthesizer.
  `tests/helpers/video.ts` builds an approved video for use-case tests.
- **Test behaviour that protects money, safety or trust first.** Narration caching and cost,
  approval binding, the target guard, redaction, stage resumption and hash stability all have
  tests. A change to any of them needs a test.
- **Do not weaken a test to make it pass.** If a test encodes a rule that has really changed,
  change the test in the same pull request and say why.
- **Do not report results you did not get.** If you could not run a suite, say so.

When you add a scenario, the registry tests in `tests/unit/recording/scenarios.test.ts`
validate it automatically. An `iker` scenario may be marked `verified` only when its
`evidence` says when it "ran green on YYYY-MM-DD". Mark it verified in the same pull request
that records that green take, never before.

## Layering rules

```text
domain  <-  application  <-  infrastructure  <-  cli
```

- `src/domain` imports nothing outside `domain`. It holds schemas and pure functions. No file
  access, no network, no process spawning.
- `src/application` imports `domain` only. It reaches the outside world through the interfaces
  in `src/application/ports.ts`.
- `src/infrastructure` implements those ports. It may import `domain` and `application`.
- `src/cli` wires everything in `src/cli/container.ts` and may import anything.
- `src/remotion` imports `domain` only. It runs in a browser and receives everything through
  props defined in `src/domain/render-props.ts`.
- `src/scenarios` imports `domain` only.

ESLint enforces the first five with `no-restricted-imports` (`eslint.config.js`). A wrong
import fails `pnpm lint`.

Other conventions the lint and compiler enforce:

- `no-console` is an error. Command output goes through `Output` (`src/cli/output.ts`) to
  stdout. Logs go through the `Logger` port to stderr.
- `consistent-type-imports`, `strictTypeChecked`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` are on.
- Prettier formats everything, at 100 columns with trailing commas.

Conventions that are not enforced by tools:

- **Errors.** Throw `StudioError` (`src/domain/errors.ts`) with a code, a message that says
  what went wrong in plain language, and a `hint` that says what to do next, ideally the exact
  command. Neither field may contain a secret value.
- **Paths.** Derive every path from `Workspace` and `VideoPaths` in
  `src/application/layout.ts`. Do not hardcode a directory name anywhere else. Store paths in
  the manifest relative to the video directory.
- **Processes.** Start programs with `run` in `src/infrastructure/media/process.ts`, which
  takes an argument array and never uses a shell. This repository is developed at a path that
  contains a space, and text from scripts and scenarios must never be interpreted as shell
  syntax.
- **Writes.** Use the `FileSystem` port. Its writes are atomic.
- **Stages.** Change manifest stage state only through `runStage` in
  `src/application/pipeline.ts`. Call `checkpoint` after each finished unit of work.
- **Hashes.** If you add an input that changes what an asset looks or sounds like, add it to
  that asset's hash. If you add something that does not, keep it out. See "The content-hash
  model" in the architecture document.
- **Spelling.** Identifiers and messages use British English (`colour`, `normalise`,
  `licence`), matching the existing code.
- **No step may need a running Claude process.** The CLI must stay fully usable on its own.

## How to add things

Step-by-step instructions are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#extension-points):

- a recording scenario (also [docs/VIDEO-AUTHORING.md](docs/VIDEO-AUTHORING.md#adding-a-recording-scenario))
- a visual kind
- a format
- a template
- a voice provider

Adding a command: register it in the right file under `src/cli/commands/`, keep the action
thin (parse options, call one use case, print the result through `Output`, call `out.result`
for `--json`), and put the logic in `src/application`. Then update the command reference in
`README.md`. Every command documented there must be copy-paste valid.

Adding an environment variable: add it to the right schema in
`src/infrastructure/config/env.ts`, to `SECRET_VARIABLES` if it is a secret, to
`.env.example` with a comment, and to the table in `README.md`.

Changing the manifest schema: `MANIFEST_SCHEMA_VERSION` is 1 and there is no migration code. A
new optional field with a default is safe. Anything else needs a version bump and a migration,
because tracked manifests of existing videos must keep loading.

## Documentation

Documentation is part of the change.

- State only what is true of the code. If something is not implemented or not verified, say
  so in those words.
- Do not put test counts, render timings or claims about CI results into the documents. They
  go stale.
- Write plainly. No marketing tone.
- Run `pnpm exec prettier --check README.md CONTRIBUTING.md SECURITY.md LICENSE.md docs`.

`CLAUDE.md` and `.claude/skills/` are the instructions Claude Code follows in this repository.
If you change a workflow, a command or a rule, update them too.

## What must never be committed

- `.env` or any file holding a credential, token or key. `pnpm studio doctor` checks that
  `.env` is not tracked.
- The YouTube refresh token. It is stored outside the repository on purpose.
- Rendered or generated media: anything under `output/**` other than each video's
  `manifest.json`, `script.md`, `research.md` and `storyboard.json`.
- Recordings, screenshots or debug captures of a real Iker environment, anywhere.
- Browser session state (`.auth/`, `storage-state*.json`), Playwright reports and traces.
- `.cache/`, `dist/`, `node_modules/`, `coverage/`.
- Real personal data in a script, storyboard, fixture, scenario or test. Use
  `example.com` addresses and obviously synthetic names.
- Music or fonts without a recorded licence.

`.gitignore` covers these paths, but it cannot stop `git add -f` or a secret pasted into a
tracked file. Check `git diff --staged` before every commit. If a secret is committed, follow
[SECURITY.md](SECURITY.md#if-a-secret-is-committed).

## Approvals are for people

`pnpm studio approve` records a named person's decision. Do not run it to get a pipeline
moving, and do not let an agent run it on its own initiative. The default approver name is the
machine's `git config user.name`, so an approval run by a tool is recorded in a person's name
unless it is marked otherwise.

When a tool or test genuinely needs to get past the script gate to exercise the pipeline, it
uses `pnpm studio approve --video <id> --stage script --automated --by "<tool name>"`. That is
recorded as an automated approval, unlocks the `system` and `silent` voices only, and makes
QA's `script-approval` check fail until a person approves. There is no automated form of final
approval. Do not add one.
