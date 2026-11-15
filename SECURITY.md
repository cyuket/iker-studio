# Security

This document describes the risks this tool carries, the controls that are implemented in the
code today, and what those controls do not cover. It is written for the people who run the
tool and for a reviewer deciding whether to trust it.

## Threat model in brief

The tool is a local CLI. It has no server, no users and no database. What it handles that can
cause harm:

| Asset                                                                  | How it could go wrong                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Demo account credentials (`IKER_DEMO_USERNAME`, `IKER_DEMO_PASSWORD`)  | Leaked through a log, an error message, a recording, a debug capture or a commit                                |
| API keys (ElevenLabs, R2, YouTube client secret, Remotion licence key) | Leaked the same ways, or spent without anyone deciding to                                                       |
| The YouTube refresh token                                              | Leaked, giving someone the ability to upload to the channel                                                     |
| Recordings of the product                                              | Show a real business's clients or money, or a production environment, and end up in a published video or in Git |
| The published video itself                                             | Published without review, or presenting synthetic footage or unsupported claims as fact                         |
| The demo environment                                                   | Changed or filled with junk by an automated browser session pointed at the wrong place                          |

The people who can cause these are the tool's own operators, by mistake, and an AI agent
operating the CLI on their behalf. The design assumes an operator who means well and is in a
hurry. It does not defend against a malicious person with access to the machine or the
repository: that person can read `.env` directly.

## Controls that are implemented

### Secrets never reach logs or error messages

- `createRedactor` in `src/domain/redaction.ts` removes two things from text: the exact values
  of the secrets this process holds, and anything matching a known secret shape (ElevenLabs
  keys, bearer tokens, JWTs, AWS access keys, GitHub tokens, Google OAuth client secrets,
  private key headers).
- Every log line passes through it before it is written
  (`src/infrastructure/logging/logger.ts`). Every error message, hint and stack trace passes
  through it before it is printed (`report` in `src/cli/main.ts`).
- The values it holds come from `SECRET_VARIABLES` in `src/infrastructure/config/env.ts`:
  `ELEVENLABS_API_KEY`, `IKER_DEMO_PASSWORD`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `YOUTUBE_CLIENT_SECRET` and `REMOTION_LICENSE_KEY`.
- The recorder additionally removes the demo username and password from everything it emits
  (`redactingCredentials` in `src/infrastructure/recording/playwright-recorder.ts`).
- `findSecretPatterns` returns the position of a match and never the matched value.

Limits: values shorter than 6 characters are not redacted. `IKER_DEMO_USERNAME` is not in `SECRET_VARIABLES`, because an account name is not a
credential on its own. It is still removed from everything the recorder writes.

### Configuration is validated lazily and reports names, never values

`src/infrastructure/config/env.ts` validates each integration's variables only when that
integration is first used. A failure raises `CONFIG_INVALID` with the variable name and the
reason, for example `ELEVENLABS_API_KEY: ELEVENLABS_API_KEY is not set`. The value is never
included. A machine therefore holds only the credentials for the integrations it actually
uses, and CI runs with none.

### The recorder refuses production and unencrypted targets

`src/infrastructure/recording/target-guard.ts`, checked before a browser opens, in two places
(`src/infrastructure/demo/targets.ts` and again in the recorder):

- Refuses `useiker.com`, every subdomain of it (including `www`), and any host listed in
  `IKER_PRODUCTION_HOSTS`. There is no opt-in: Iker has no Sandbox mode, so a production host
  always holds real businesses' bookings and money records.
- Refuses plain `http` except to loopback (`localhost`, `127.0.0.1`, `[::1]`).
- Refuses a base URL with embedded credentials.
- Requires synthetic scenarios to run on loopback.

`src/infrastructure/recording/urls.ts` refuses any scenario path that resolves outside the
checked origin, so a scenario cannot steer the browser elsewhere. Every refusal raises
`UNSAFE_TARGET`. There is no override flag.

The intended targets are a local copy of the web app from the `slot-books` repository
(`http://localhost:3000`) with demo data, or a dedicated staging host
(`https://staging.iker.example` in examples). The recorder does no on-page check of which
business is signed in, so the host guard is the only automatic control: the environment must
hold demo data and nothing else.

### Authentication is demo-only and off camera

- Scenarios cannot contain credentials. The `authenticate` step has no fields
  (`src/domain/recording.ts`). The account comes from the environment.
- Sign-in runs before the capture starts (`src/infrastructure/recording/sign-in.ts`,
  `capture.ts`), so the email and password are never in a recorded frame.
- If the account asks for a second factor, the recording aborts. The recorder never attempts
  to pass or bypass two-factor authentication. Use a dedicated demo account with 2FA off, never
  a personal or customer-facing account.
- Each run uses a new browser context (`src/infrastructure/recording/browser-session.ts`). With
  `IKER_DEMO_AUTH=password` nothing is loaded from or saved to disk, so no session cookie
  outlives the run. With `IKER_DEMO_AUTH=session` the context starts from the session file
  saved by `demo-login` (see below), and the run saves nothing new.

### Masking

A scenario's `mask` step blurs matching elements for the rest of the recording, and the mask
is re-applied after navigations and when the page adds content
(`src/infrastructure/recording/masks.ts`). Leading `mask` steps run before the capture starts.

### Failure diagnostics carry no credentials

On a failed recording the tool writes one screenshot and one text summary to
`recordings/<scenario>/debug/` (`src/infrastructure/recording/diagnostics.ts`):

- The screenshot masks every password input and every field labelled "password".
- The summary records the URL without its query string or fragment, and the error text after
  redaction.
- No Playwright trace, HAR file or console log is written, because those contain request
  bodies, cookies and tokens.
- The partial capture is deleted.

The recording timeline never contains typed text (`stepLabel` in
`src/infrastructure/recording/timeline.ts`).

### Local servers are loopback-only

`src/infrastructure/http/static-server.ts` serves the synthetic fixture and, during renders,
the video directory and `brand/`:

- It binds to `127.0.0.1` on a random port. Nothing on the network can reach it.
- It serves only `GET` and `HEAD`, only from the mounted directories.
- `resolveFile` normalises the path and refuses anything that resolves outside the mount, which
  blocks path traversal.
- `urlFor` in `src/infrastructure/http/asset-server.ts` refuses to produce a URL for a file
  outside the mounts.

The YouTube authorisation callback server also binds to `127.0.0.1` and checks a random
`state` value.

### R2 objects are private and verified

`src/infrastructure/storage/r2-object-store.ts`:

- Sets no public ACL and does not touch bucket-level access. Sharing is by time-limited signed
  URL only (`export --r2 --signed-url <seconds>`, minimum 60 seconds).
- Stores the file's SHA-256 as object metadata, reads the object back after upload, and fails
  if size or checksum differ.
- Verifies the checksum after download.
- `storage prune` only lists what it would delete unless `--yes` is given.

Whether the bucket itself is private is a Cloudflare setting this tool does not check.

### Publishing is off by default, behind four gates

`publishToYouTube` in `src/application/export.ts` and the container in
`src/cli/container.ts` require all of:

1. `YOUTUBE_PUBLISHING_ENABLED` is exactly `true`. Credentials alone do not enable it.
2. The cut's current final render is approved. The approval is bound to the file's SHA-256.
3. The operator repeats the video id with `--confirm`.
4. The machine has been authorised with `pnpm studio publish-auth`.

Uploads are `private` unless `--privacy` says otherwise.

The OAuth scope requested is `https://www.googleapis.com/auth/youtube.upload` only: the tool
can add videos and cannot read or manage the channel. The refresh token is stored outside the
repository at `~/.config/iker-video-studio/youtube-token.json` with mode `0600`, in a
directory created with mode `0700` (`src/infrastructure/publish/youtube.ts`). Access tokens
are not stored.

### Approvals are bound to content, and automation cannot release

- A script approval is bound to the script's hash. A final approval is bound to the SHA-256 of
  the rendered file (`src/application/approval.ts`). An edit or a re-render voids it.
- Final approval requires that QA ran on that exact file and passed, and that warnings were
  explicitly acknowledged.
- An approval recorded with `--automated` is stored as such. It unlocks the free stand-in
  voices only. Paid narration, final approval, export and publishing refuse it, and QA fails
  on it. `--automated` is rejected for final approval.

Limit: nothing authenticates the approver. `--by` accepts any name, and the default is the
machine's `git config user.name`. The approval is an audit record, not an access control.

### Synthetic footage cannot pass as the product

The fixture carries a fixed "SYNTHETIC DEMO" banner in its own HTML. The renderer stamps a
disclosure label on every frame of a scene whose recording came from the fixture
(`SYNTHETIC_DISCLOSURE` in `src/application/scene-compiler.ts`), the generated description
includes a sentence saying so (`src/application/export.ts`), and QA reports it under
`footage-provenance`.

### Processes are started without a shell

`src/infrastructure/media/process.ts` starts FFmpeg, ffprobe and `say` with an argument array.
Text from scripts, scenarios and file names is never interpreted as shell syntax.

### `.gitignore` coverage

`.gitignore` ignores `.env` and `.env.*` (except `.env.example`), `*.pem`, `*.key`,
`oauth-token*.json`, `.auth/`, `storage-state*.json`, Playwright reports and results,
`.cache/`, everything under `output/` except each video's `manifest.json`, `script.md`,
`research.md` and `storyboard.json`, and media file types anywhere. `pnpm studio doctor` fails
if `.env` is tracked. `.dockerignore` keeps `.env` and `output/` out of the Docker image.

### QA scans text artefacts for secrets and personal data

`scanText` in `src/application/qa.ts` reads `script.md`, `storyboard.json`, the cut's SRT,
`metadata.md` and every recording timeline, and fails the `sensitive-information` check on:

- any known secret shape
- the exact value of any secret this process holds
- an email address outside the reserved documentation domains (`example.com`, `.test`,
  `.example`, `.invalid`)
- a 13 to 19 digit number that passes the Luhn check

Findings are reported by pattern name and a masked excerpt, never the full value.

### CI holds no secrets for tests

`.github/workflows/ci.yml` has read-only permissions, uses no secrets and calls no paid API.
`.github/workflows/render.yml` reads its credentials from GitHub secrets, checks its inputs
against a strict character set before using them, and gates export behind the `video-release`
environment. Actions in both are pinned to commit SHAs. Neither workflow has been run from the development machine.

## What is not covered

Be clear about these. None of them is handled by the tool.

- **Recorded pixels are not scanned.** There is no OCR or image analysis of recordings,
  screenshots or rendered frames. If a recording shows a real name, document, face or account
  number, or a business's income on screen, nothing detects it. The QA report says so on every run.
- **Masking is best effort.** A mask applies to the elements a scenario names. Content the
  scenario author did not anticipate, content that appears between sweeps, and content drawn
  on a canvas are not masked.
- **Human review is required.** A person must watch every recording and the final video before
  approving. The manual checklist in the QA report includes "Product footage shows only demo
  or synthetic data: no real customer information."
- **The target guard is a deny list plus transport rules.** It knows one production domain,
  `useiker.com` and its subdomains. A production host under a name it has not been told about
  is not refused. Add such hosts to `IKER_PRODUCTION_HOSTS`.
- **Admin views are not checked for financial data.** Platform Admin and Super Admin screens
  must never show a business's money, and Iker enforces that in its database. The recorder
  does not check it; the reviewer does.
- **The environment's own data is not checked.** If a local copy or staging environment holds
  copies of real businesses' clients, bookings or payments, the tool will record them.
- **`.env` is a plain file.** It is not encrypted. Anyone with access to the machine can read
  it. The same is true of the YouTube token file, which is protected only by file permissions.
- **Approver identity is not verified**, as noted above.
- **The GitHub environment gate depends on repository settings.** If `video-release` has no
  required reviewers, the export job does not wait for a person.
- **Dependencies have not been audited** for vulnerabilities or licences as part of this
  document.
- **The live integrations are unproven.** The ElevenLabs, R2 and YouTube adapters and all
  `iker-*` scenarios have never run against the real services for Iker. Their security-relevant
  behaviour (redaction on real error bodies, sign-in against Iker's real form, 2FA detection) has
  been exercised only against mocks and the synthetic fixture.
- **No test covers the YouTube adapter itself.**

## Reporting a vulnerability

This is an internal, private repository.

- Contact the repository owners directly, through a private channel.
- Do not open a public issue, and do not describe the problem in a public place.
- Do not include secret values, real customer data or screenshots of real customer data in the
  report. Say where the problem is and how to reproduce it with synthetic data.
- If the problem involves a credential that may already be exposed, say so first, so it can be
  rotated before anything else happens.

## If a secret is committed

Assume it is compromised from the moment it was pushed, even to a private repository.

1. **Rotate first.** Revoke the credential at its provider and issue a new one: the ElevenLabs
   API key, the R2 API token, the Google OAuth client secret, the demo account password, the
   Remotion licence key. For the YouTube refresh token, remove the app's access at
   myaccount.google.com/permissions and run `pnpm studio publish-auth` again.
2. **Update** `.env` locally and the GitHub secrets used by `render.yml`.
3. **Then purge.** Remove the file or value from the working tree (`git rm --cached .env` if
   it was `.env`), and rewrite history to remove it from every commit, for example with
   `git filter-repo`. Force-push, and have everyone re-clone. Purging without rotating
   achieves nothing, because copies already exist.
4. **Check** what the credential could reach and whether it was used: ElevenLabs usage, R2
   access logs, the YouTube channel, the demo environment.
5. **Tell the repository owners** what was exposed, for how long, and what was done.

The same order applies to a recording of real customer data that reaches Git: treat it as a
data incident, tell the owners immediately, and purge it.

## Signing in yourself: `demo-login`

For accounts that do not sign in with a password, `pnpm studio demo-login` opens a visible
browser on `/login` of `IKER_DEMO_BASE_URL` for a person to sign in. Nothing is typed or
bypassed on their behalf. It finishes once the browser reaches a signed-in page (anything
other than `/`, `/login`, `/auth/*` or `/choose-location`). The saved session keeps only
cookies that apply to the demo host (`onlyDashboardState` in
`src/infrastructure/recording/demo-login.ts`); identity-provider cookies are never written to
the session file. The session file (`~/.config/iker-video-studio/demo-session.json`, mode
`0600`) and the browser profile (`~/.config/iker-video-studio/demo-browser-profile`) live in a
directory created with owner-only permissions. The profile directory does hold any identity
provider's sign-in, as any browser profile does: delete it when it is not needed.

Scenarios that change data (for example adding a walk-in booking or recording a payment) say
so in their `prerequisites`. Each take changes the demo data, so reset it when the next take
needs the starting state.
