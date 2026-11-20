# Change journal

Append-only, newest first. UTC timestamps.

## 2026-11-20T03:30Z · Claude Code

- **What:** Every recorded action now makes a sound, and photos may be downloaded when none fits. New `src/domain/action-sounds.ts` (`ACTION_SOUNDS`, `planActionSounds`, `sceneSecondsFor`, the inverse of the footage time map). The scene compiler adds action sounds to product scenes in video mode: `click.wav` on click/select, `click-soft.wav` on key press/drag/dismiss, a sweep on scroll, and keyboard or phone typing (by viewport width) cut to the typing's length with a 6-frame fade. Scene field `actionSounds` (absent means on, `false` silences). Sounds gained an optional `durationFrames`. The recorder now logs `pressSeconds` and `keysFromSeconds` on timeline events (`markPress`/`markKeys` through `StepContext.marks`); older recordings fall back to estimates (press 0.65 s after the step starts, typing 0.35 s after the press). Added "Adding a photo" to `assets/images/README.md`, plus sound-on-every-action and photo-download rules in `storyboard-designer`, `iker-house-style` and `iker` (mirrored), and an action-sound note in `assets/sfx/README.md`.
- **Why:** The owner asked for room to download images and for every action (typing, button clicks) to have a sound.
- **Decisions:** Sounds are planned in the domain and compiled into the existing `sounds` list, so Remotion only needed duration and fade support. Product scenes with clicks or typing get new scene hashes and re-render once. Motion-graphic and photo scenes get sounds through storyboard cues, as before, now required for every visible action. Tests: domain planner (logged and estimated presses, phone vs desktop typing, scroll/press, screenshot silence, late footage and cut-off, scene end, inverse map round trip), timeline marks, compiler (placement and durations, opt-out, missing file). A real Remotion render of a sample scene had the click at 1.00 s and typing from about 2.1 s to 3.48 s, then silence. Integration: the two "watchable length" recording tests hit the 120 s timeout in two loaded runs; an isolated run passed all 9 (69 s and 48 s), and the original recorder took 78 s and 33 s, so the timeout is load flakiness, not this change. `pnpm validate` passed (typecheck, lint, format, 1196 unit tests). No commit.

## 2026-11-20T02:00Z · Claude Code

- **What:** `now-now-confirm-deposit` narrated with ElevenLabs (the voice and model in `.env`, eleven_multilingual_v2; dry run 1,893 credits, 14 clips synthesised, 2 from cache), footage trimmed to the narration in scenes check-proof, sh-check-proof and sh-result (footage windows plus "proof" and "balance" cue anchors), re-rendered and QA'd. Final cuts: full 3840x2160 2:02, short 2160x3840 0:49. QA: 0 failures, 1 warning per cut (the two Chioma scenarios are unverified).
- **Why:** Owner asked to trim the silent gaps and switch to the ElevenLabs voice set in the env, then render.
- **Decisions:** "Abuja" pronunciation was approved by the owner (`cyuket`), not by Claude. Final approval, export and publishing left to the owner. A Remotion "Target closed" protocol error was printed once during the last render; the render exited 0 and both files and thumbnails were rewritten. No commit.

## 2026-11-20T02:50Z · Claude Code

- **What:** Added `photo` scenes. New visual kind `photo` (`file` in `assets/images/`, `alt`, `heading`, `caption`, `captionCue`, `focus`, `motion`: zoom-in, zoom-out, pan-left, pan-right, still) in `src/domain/storyboard.ts`. `Workspace.imagesDir`, the `images` asset directory, `compileImage` in the scene compiler (missing file is `NOT_FOUND`, the photo's content hash joins the scene hash), `image` in `SceneRenderProps`, a missing-photo check in `pnpm studio storyboard`, a storyboard-preview summary, `src/remotion/components/PhotoScene.tsx` (framed photo in the content zone, slow camera move about the focus point, caption on the scrim token, still under reduced motion) and a sample. Downloaded 20 Pexels/Unsplash photos into `assets/images/` (via a subagent) with `assets/images/README.md` (source page, photographer, licence, size per photo, plus an "Owner's photos" section for `own-*` files). `.gitignore` keeps photos out of Git. Skills (`storyboard-designer`, `iker-house-style`, `iker`) and the README say when to use a photo.
- **Why:** The owner asked for pictures where needed, not just illustrations, and chose a stock starter set plus their own photos.
- **Decisions:** Photos sit in the content zone like every other scene (safe areas, bare background at the scene's edges), not full-bleed. The owner's `own-*` photos are preferred when one fits. Stock models are never presented as Iker customers, and photos never stand in for the product UI. The subagent rejected photos with readable brands, screens or signage. Gaps: no Black photographer with a client, no lash photo without brand text, no hands counting Naira, no Nigerian POS, no handwritten ledger. One POS photo has a tiny unreadable "ingenico" mark. Tests: compiler (none for other scenes, served URL, missing file, hash change) and storyboard (missing photo refused, defaults, preview text). Stills of a sample photo scene rendered in 16:9 and 9:16 and were checked by eye. `pnpm validate` passed typecheck, lint and format; one existing test (`asset-directories.test.ts`) needed the new `images` directory, after which `vitest run` passed 1246 of 1246 and Prettier and ESLint passed again. No commit.

## 2026-11-20T02:30Z · Claude Code

- **What:** Every video now narrates with the ElevenLabs voice in `.env` (`ELEVENLABS_VOICE_ID`) and uses the shared music and sound library. Updated `iker-house-style` (sections 5 and 6 plus the owner correction), `iker`, `storyboard-designer`, `video-editor` and `elevenlabs-voice-director`, mirrored to `.agents/skills/`. Added the 12 older CC0 interface sounds (`click.wav`, `message-pop.wav`, ...) to `assets/sfx/README.md` with their use and length; every file in `assets/sfx/` is now listed.
- **Why:** The owner asked for the `.env` voice to be the voice selection and for all videos to use the added sounds and music where needed.
- **Decisions:** No engine change was needed. When a video's `voiceId` is null, the ElevenLabs adapter already uses `ELEVENLABS_VOICE_ID`, and scene `sounds` and cut `music` already resolve from `assets/sfx` and `assets/music`. The skills now forbid `--voice-id` and voice switching unless the owner asks, and auditions compare presets of that one voice. Music is on by default for every cut (Mixkit preferred, no credit needed), with 1 to 3 sounds per scene on narration cues. The video-editor skill no longer says "no music by default", and the house style no longer calls every sound CC0. The exact source page of each CC0 wav is not recorded. Existing videos created with the `system` voice are unchanged. Prettier passed; `pnpm validate` not run (docs only). No commit.

## 2026-11-20T12:40Z · Claude Code

- **What:** Added 46 more Mixkit sounds to `assets/sfx`: 19 phone gestures (taps, swipes, screenshot/shutter, lock, unlock tone, notifications, ring), 27 attention hits (record scratches, risers, bass and trailer hits, glitches, wrong-answer buzzers, censor beep, drum roll, heartbeat, news intro, reveal, countdown, clock ticks), plus 4 whooshes. Generated three phone vibration/haptic sounds with FFmpeg (`synth-*.wav`) because Mixkit has none. Rewrote `assets/sfx/README.md` grouped by use; all 74 files are listed.
- **Why:** The owner asked for missing phone gestures and short attention-grabbing sounds.
- **Decisions:** Found and fixed an off-by-one in the earlier listing scrape: the six whoosh files from the previous entry had the wrong names (renamed to their real Mixkit titles). Typing files were correct. Every new download was checked against Mixkit's listed length. Left out a cash-register "ka-ching" because Iker records payments and does not take them. Not heard by the owner, not wired into a storyboard, no commit.

## 2026-11-20T12:00Z · Claude Code

- **What:** Downloaded 16 Mixkit music tracks (lo-fi/chill and upbeat motivational) into `assets/music` and 21 Mixkit sound effects (15 keyboard/phone typing, 6 whooshes/pops for caption hits) into `assets/sfx`, all as `mixkit-*.mp3`. Added a Mixkit table to `assets/music/README.md` and created `assets/sfx/README.md` with title, artist, id and licence for each file. Every file checked with ffprobe.
- **Why:** The owner asked for typing sounds, chill but motivating background music, and trending TikTok/Instagram sounds.
- **Decisions:** TikTok/Instagram trending sounds were not downloaded: they are copyrighted recordings licensed only for use inside those apps, and ripping them for an Iker ad would break the licence and rule 7's publishing checks. Add them in-app at upload instead (TikTok Commercial Music Library for business accounts). Mixkit licence terms were taken from Mixkit's own JSON-LD (`Mixkit Stock Music Free License`) and the known licence summary; the licence modal text could not be scraped, so recheck before publishing. Media is gitignored. Not wired into any storyboard and not heard by the owner. The Kevin MacLeod tracks and older `.wav` sounds from the previous entry are missing from the READMEs; not fixed here. No commit.

## 2026-11-20T02:30Z · Claude Code

- **What:** Background music and sound effects. Downloaded three Kevin MacLeod tracks (CC BY 4.0) into `assets/music` and twelve CC0 sounds into `assets/sfx` (clicks, pops, bubbles, notifications, seen tick, stamp thud, whoosh, confirm chime), converted to 48 kHz WAV at about -3 dBFS, with sources and licences in each folder's README. New storyboard field `sounds` on a scene (file, cue or atSeconds, volume), checked by `pnpm studio storyboard`, placed by the scene compiler on cue beats and played in `SceneComposition`; new `music.credit`, printed by export in the YouTube description and LinkedIn/Shorts captions. Applied music and sounds to every cut of `last-price-dear`. House style records the owner's request. Tests added for sound cues, placement, missing files, cache identity and credits; `pnpm validate` passed (1179 tests). A real Remotion render of one scene with two sounds had audio at the expected frames.
- **Why:** The owner asked for chill background music plus click, bubble and notification sounds, downloaded from the internet.
- **Decisions:** Only sources with explicit free licences (kenney.nl refused scripted downloads, so its CC0 pack came via OpenGameArt; a dual-licensed "completion sound" was skipped). `sounds` is optional, not defaulted, so existing scenes keep their render identity. Clicks are not yet synced to clicks inside recorded footage. Audio files stay out of Git. Not yet heard by the owner; MacLeod's tracks are Content ID pre-registered. Another session is editing the demo seed and this journal at the same time. No commit.

## 2026-11-19T23:55Z · Claude Code

- **What:** Unblocked and continued `now-now-confirm-deposit`. Demo seed gained Chioma Okafor's Saturday 10:30 Bridal makeup booking at ₦45,000 with a ₦15,000 deposit proof pending review (booking ...0046, payment ...0057, its own sample receipt), plus `seed.sh reset-chioma` and `seed.sh confirm-chioma` (calls the product's `confirm_pending_payment` as Amaka). New phone scenarios `iker-amaka-chioma-proof-phone` (scene 5) and `iker-amaka-chioma-confirmed-phone` (scene 7, read-only), both unverified; storyboard scenes 5 and 7 point at them. Script v2 (scenario id in scene 5's note only). Recorded both, approved the script at the owner's explicit instruction, narrated with the `system` stand-in, previewed, rendered and ran QA. `pnpm validate` passed.
- **Why:** The owner chose "add a booking to the seed" and "write a new scenario" for the gate 1 blockers, then said "approved, finish the work".
- **Decisions:** Approval recorded as `cyuket` with a note that it was given in the conversation and that v2 differs from the reviewed v1 only in a visual note. Voice kept as `system` because the brief ruled out a real voice: this is a pipeline check. Scene 7's scenario does not press Confirm booking (the scenario test forbids real-product scenarios pressing it); the seed script confirms through the same database function instead. The rate card item stays ₦120,000; only this booking is ₦45,000. Machine clock reads earlier than some entries below. No commit.

## 2026-11-20T02:00Z · Claude Code

- **What:** Replaced the `iker` subagent with the `/iker` skill (`.claude/skills/iker/SKILL.md`, mirrored in `.agents/skills/iker/`). It runs every command from idea to local export and asks the human at the script and final gates (Approve / Improve / Stop here), then records their answer. Removed `.claude/agents/iker.md`. Reverted the agent-delegation wording in CLAUDE.md rules 5 and 6 and replaced it with the in-conversation approval exception. Updated the skill table and README.
- **Why:** The owner does not want to type commands, and wants to be asked to approve or improve. A subagent cannot ask questions mid-run; a skill in the main conversation can.
- **Decisions:** Approvals are recorded under the owner's `git user.name`, with a note that they were given in a Claude Code conversation, and only after they choose Approve at that gate. The skill exports locally after final approval, never publishes, never commits. Rule 11 keeps the doctor-based wording. Prettier check passed. Not yet run on a real idea. No commit.

## 2026-11-20T01:40Z · Claude Code

- **What:** The `iker` agent now approves the script itself and runs through to the final render and QA. It narrates with ElevenLabs when `doctor` reports it configured, otherwise with the `system` stand-in. CLAUDE.md rules 5, 6 and 11, the skill table and the README section were updated to match.
- **Why:** The owner asked for the agent to do everything from script approval to the rendered video. ElevenLabs is now configured on this machine.
- **Decisions:** The owner's standing delegation is written into rule 6. The approval is recorded as `iker agent (delegated by <git user.name>)` with a note that no person reviewed it, never under the owner's own name (the default `--by`). It applies only to scripts the agent wrote, after `script` and `storyboard` pass, and never covers final approval, export or publishing. The agent does not narrate again with `--force`. Rule 11 no longer claims credentials are missing. Prettier check passed. No commit.

## 2026-11-19T23:35Z · Claude Code (iker agent)

- **What:** Created video `now-now-confirm-deposit` (template `product-tutorial`, `PRODUCT_TUTORIAL`, voice `system` stand-in) and took it to human gate 1: `research.md` (10 facts, pf ids, sources read in slot-books), `script.md` (cuts `full` youtube-landscape 105-135 s, about 1:54, and `short` youtube-shorts 40-60 s, about 0:49) and `storyboard.json` (character-scene, timeline, comparison, pipeline, product, decision, product, cta per cut). `pnpm studio script` accepted v1 with no warnings; `pnpm studio storyboard` saved v1. No approval, recording, narration, render, QA, export or publish was run.
- **Why:** Owner brief: Chioma's "I'll send it now now", checking proof of payment, Confirm booking or Reject payment, stopping at gate 1.
- **Decisions:** "Awaiting confirmation holds the slot" cited as pf-041 with the exclusion constraint and occupancy query as sources (no dedicated pf entry exists). Spoken money gained "naira" in the Short's result line. What the client sees after Reject payment is under "Needs research" and out of the script. Open before recording: the demo seed has no ₦45,000 bridal booking (footage would show Tunde, ₦50,000, ₦35,000 balance), no phone scenario shows a confirmed Amaka booking (scene 7 points at `iker-booking-detail`, Test Salon, desktop), and no visual kind can composite a mock proof image. No commit.

## 2026-11-20T01:45Z · Claude Code

- **What:** Fixed `iker-rate-card` against the current slot-books UI. "Packages" is targeted as a button (Base UI Button rendering a Link); the highlighted row is "Soft glam makeup" at `nth: 1` (the hidden phone list renders first); the dialog part opens "Edit" on the first row, steps to Pricing with "Continue" and closes with the X ("Close"), because the add form is now a four-step wizard and Escape does not close it. Screenshot renamed `rate-card-pricing`. `pnpm validate` passed earlier in this task; typecheck and lint passed after the last edits. Recorded (18.1 s) and frames checked; service values unchanged.
- **Why:** The recording failed in preflight (`link "Packages"`) and then on three stale steps.
- **Decisions:** Edit rather than Add so the take stays read-only and shows real seeded values (₦50,000, 30%, "about ₦15,000 of ₦50,000"). Open: the sidebar shows "FREE PLAN" because Team is an inactive plan in slot-books (0017), so the owner cannot read its name; Starter and Growth, the only active plans, allow one service. Needs the owner's decision. Scenario stays `unverified`. No commit.

## 2026-11-20T01:25Z · Claude Code

- **What:** Renamed the `idea-to-video` agent to `iker` (`.claude/agents/iker.md`, `name: iker`) and updated the references in README.md and CLAUDE.md.
- **Why:** The owner asked for the agent to be called iker.
- **Decisions:** Invoked as "Use the iker agent: <idea>" or `@agent-iker <idea>`. Earlier journal entries keep the old name, because the journal is append-only. Prettier check passed. No commit.

## 2026-11-20T01:15Z · Claude Code

- **What:** Added a README section, "From one idea to a video with Claude Code", that explains how to invoke the `idea-to-video` agent, what it produces and refuses to do, and the human commands that turn its pipeline check into a real video. Added the agent to the README's documentation table.
- **Why:** The owner asked for the commands and for them to be in the README.
- **Decisions:** The section sits before "Production workflow for a real video" and points to `/video-director` for the step-by-step route. Prettier check passed. No commit.

## 2026-11-20T01:00Z · Claude Code

- **What:** Fixed "Sign-in did not complete" when recording `iker-amaka-client-books-phone`. The local database had no `amaka.owner@example.com` account (the Amaka Studio seed was not loaded), and re-running `fixtures/iker-demo/seed.sh` failed on "plan limit reached for Services (booking pages): 1 allowed". `seed.sql` now puts the demo business on the `team` plan instead of `growth`. Seed ran; the scenario recorded (28.4 s) and the frames were checked.
- **Why:** slot-books `0048_plan_feature_flags.sql` gives Growth 1 service and Pro 3; the seed adds 3 services, so its Growth assumption was wrong.
- **Decisions:** Team (no service or policy limit) rather than Pro (exactly 3) to leave room for a ₦45,000 Bridal makeup item. Checked first that every local auth user is on a test domain. The scenario stays `unverified` until the owner watches the capture. No commit.

## 2026-11-20T01:00Z · Claude Code

- **What:** Added the `idea-to-video` Claude Code agent (`.claude/agents/idea-to-video.md`) and listed it in the CLAUDE.md skill table. Given one full idea, it picks a template and id, runs create, research, script, storyboard, an automated stand-in script approval, record, stand-in narration, preview, render and QA, then journals and returns a report with the human's next commands.
- **Why:** The owner asked for an agent that turns a full idea into a video locally without step-by-step direction.
- **Decisions:** The owner chose "run through with stand-ins": the agent records only `approve --stage script --automated --by "Claude Code"` (CLAUDE.md rule 6 exception), uses the `system`/`silent` voice, and never runs final approval, export or publishing. If `http://localhost:3000` does not answer, product scenes fall back to `synthetic-*` scenarios or non-recorded visuals; the agent never starts or seeds slot-books. Three fix-and-rerun attempts per stage, then it stops and reports. Never overwrites an existing `output/<id>`. Not yet run on a real idea. Prettier check passed on the changed files. No commit.

## 2026-11-20T00:30Z · Claude Code

- **What:** Took `last-price-dear` to human gate 1 from the owner's full brief. Rewrote `research.md` (14 facts keyed by pf-NNN, plus a "Needs research" list), `script.md` v3 (cuts full 2:06, shorts 0:46, portrait 0:46, teaser 0:22) and `storyboard.json` v4 (character-scene, story, transformation, comparison, product in iPad/iPhone frames, decision, cta). `script` and `storyboard` both pass.
- **Why:** The owner gave the full creative brief; the earlier generic script did not follow it.
- **Decisions:** "free slots"/"when you are free" became "open"; "Nobody has to ask" became "all before the first message"; "The slot is yours" became "The slot is booked"; the full cut's setup scene was split into Rate card, packages and Availability so each recording has a scene. Mock scenes carry an "Illustration" lower third because the pipeline only auto-labels synthetic recordings. Open: ₦15,000 deposit cannot come from a whole-number percentage of ₦45,000; demo seed has no Bridal makeup item; Refund Policy is plan-gated; all `iker-*` scenarios are unverified. Script not approved; nothing recorded, narrated or rendered. No commit.

## 2026-11-20T00:00Z · Claude Code

- **What:** Wrote `output/last-price-dear/research.md` (10 sourced facts) and `script.md` (full, short-60 and teaser-30 cuts) for "Last price, dear: stop haggling in DMs". `pnpm studio script --video last-price-dear` accepted v1 with no errors or warnings (full 2:49, short-60 0:47, teaser-30 0:25).
- **Why:** The script stage failed with 26 placeholder errors because the files were still the template skeleton.
- **Decisions:** Facts re-checked in slot-books (`FRONTEND_CURRENT_STATE.md` §1 price listing and sort, `features.ts` discounts and availability). Sales & discounts is said as "depending on your plan". The ₦45,000 quote is illustrative. No outcome promises about haggling or bookings. Script not approved; that is the owner's step. No commit.

## 2026-11-19T22:58Z · Claude Code

- **What:** `create --type` no longer defaults to `PRODUCT_TUTORIAL`. Without `--type`, the video takes its template's first content type. Added `tests/unit/application/create-video.test.ts`.
- **Why:** `create --template business-explainer` (and other non-tutorial templates) failed with "does not support PRODUCT_TUTORIAL" unless `--type` was passed.
- **Decisions:** An explicit `--type` is still checked against the template and refused if unsupported. `pnpm validate` and `tests/integration/cli.test.ts` passed; the real `create --template business-explainer` produced a `BUSINESS_EDUCATION` video. No commit.

## 2026-11-19T22:56Z · Claude Code

- **What:** Added six templates, each with a finished `demo/` (script, research, storyboard): `quick-sketch`, `myth-vs-fact`, `faq-answer`, `monthly-money-check-in`, `day-in-the-life`, `how-your-client-sees-it`. Updated the template tables in `README.md` and `docs/IDEATION-AGENT-PROMPT.md`, and the integration test that lists and counts templates.
- **Why:** The owner asked for these six template ids to be accepted by `create --template` and `templates validate`.
- **Decisions:** Only existing content types are used; none were added. Demo claims cite pf-NNN facts from `knowledge/product-facts.md`. Product scenes use `synthetic-*` scenarios or the unverified `iker-*` / `iker-amaka-*` scenarios, so recordings stay blocked until those are verified. `templates validate` (9 ok), `pnpm validate` and `tests/integration/cli.test.ts` passed. No commit.

## 2026-11-19T22:19Z · Claude Code

- **What:** Added `docs/IDEATION-AGENT-PROMPT.md`, a reusable briefing to paste into another agent so it can generate video ideas and studio improvements. It covers the product and its wording rules, audience and pains, the pipeline and human gates, formats, the three templates, scene types, visual kinds, scenarios, voice presets, what is not ready yet, improvement areas, and a fixed answer format, with a `{{REQUEST}}` slot for the task.
- **Why:** The owner asked for a generic prompt that explains what the studio can do, the kinds of videos it makes and where it could improve.
- **Decisions:** Written from the current code and knowledge base (templates, `src/domain/storyboard.ts`, `formats.ts`, scenarios, `knowledge/`), not from memory. Blockers are listed so ideas say what stops them today. Ideas must cite `pf-NNN` fact ids or be flagged "needs research". No checks run (docs only). No commit.

## 2026-11-15T14:58Z · Claude Code

- **What:** Reworked the social campaign video `create-a-short-social-media-campaign-to-introduce-the-produc` around real app footage. Script v10 is a calm explainer with five DEMO scenes (full cut about 1:30, short about 0:32, no lint warnings). Storyboard v5 points them at four new scenarios in `src/scenarios/iker-amaka.ts` (`iker-amaka-client-books-{phone,tablet}`, `iker-amaka-confirm-booking-{phone,tablet}`, at 390x844 and 1180x820), shown with `device: "iphone"` in the 9:16 cut and `device: "ipad"` in the 16:9 cut, with footage ranges and cue anchors taken from the recorded timelines. All four were recorded against the local Amaka Studio demo. The animated background was switched off for this video. Product scenes gained the `device` field: `DeviceFrame.tsx`, `lib/device-layout.ts` and their tests, built by a sub-agent. The recorder hides the Next.js dev tools badge (`nextjs-portal`) in captures. ESLint now ignores `fixtures/**/*.mjs`. `pnpm validate` passed (1146 tests) and `pnpm test:integration` passed (52 tests).
- **Why:** The owner asked for demo footage from the app, an iPhone frame on reels and an iPad frame on LinkedIn/Facebook, a nicer background (they chose the original still one) and a natural, explaining voice at normal speed.
- **Decisions:** The scenario safety rules stay as they are: every real-product take signs in first, and none presses "Confirm booking" or "Reject payment". The confirm take highlights both instead, and the narration says "When the money is there, she taps Confirm booking", which describes the step rather than claiming the result is shown. The proof image is not shown, because "View proof" opens a storage URL in a new tab, which the recorder does not follow. The booking page asks for an email for this business, so the take types `tunde@example.com` and the narration says "name, phone number and email". The four scenarios stay `unverified` until the owner has watched the captures. Narration was not generated: script v10 needs the owner's approval first (estimated 1,285 credits at speed 1.0). Nothing was previewed or rendered with the footage, because preview needs narration. No commit.

## 2026-11-15T14:43Z · Claude Code

- **What:** Set up a local Iker demo environment for recording. New `fixtures/iker-demo/` (`seed.sh`, `seed.sql`, `reset-tunde.sql`, `receipt.html`, `render-receipt.mjs`) seeds the local slot-books Supabase with the fictional business "Amaka Studio" (slug `amaka-studio`, makeup, Abuja, Growth plan, bank details, address, Mon-Sat hours, a Refund Policy), three rate card items (Soft glam makeup ₦50,000 with 30% deposit, Bridal makeup ₦120,000 with 30%, Gele tying ₦10,000), five example.com clients and five bookings, including Tunde Adeyemi's "Awaiting confirmation" booking with a ₦15,000 deposit pending review and a sample receipt (marked SAMPLE) uploaded to the `payment-proofs` bucket. `seed.sh reset-tunde` puts that booking back for another take. `.env` now points `IKER_DEMO_*` at `http://localhost:3000` with the demo owner `amaka.owner@example.com`. Walked the client booking flow (up to the Pay step, nothing submitted) and the owner review flow at 390x844 and 1180x820 with Playwright; `pnpm studio doctor` reports the Iker demo environment as configured. Confirm booking was clicked once to test the reset, then reset.
- **Why:** The owner wants to screen-record the real product for the Amaka and Tunde story; no demo environment existed.
- **Decisions:** Local database only: `seed.sh` refuses any database or Supabase API host that is not 127.0.0.1/localhost. Additive and idempotent with fixed ids (prefix `7a3e0000-`); nothing pre-existing was changed or deleted. A re-run re-dates the demo bookings relative to today. The reset switches triggers off for its own transaction (`session_replication_role = replica`) because Iker refuses to un-confirm money by design; it touches only Tunde's booking and payment. The password lives only in the git-ignored `.env`; the service-role key is read at runtime from slot-books `apps/web/.env.local`. The proof of payment opens in a new tab on the Supabase storage origin, which the recorder cannot follow. No scenario was changed or marked verified. No commit.

## 2026-11-15T13:58Z · Claude Code

- **What:** Raised the narration pace limit from 1.2 to 2.0. `VoiceSettingsSchema.speed` and `narrate --speed` now accept 0.7 to 2 (`MIN_SPEED`/`MAX_SPEED` in `src/domain/voice.ts`). The new `splitSpeed` sends ElevenLabs at most 1.2 (`PROVIDER_MAX_SPEED`), and `withTimeStretch` (`src/infrastructure/voice/tempo.ts`, wrapping the ElevenLabs synthesizer in the container) speeds the returned clip up the rest of the way with FFmpeg `atempo` (pitch preserved) and compresses its character timings by the same factor (`speedUpAlignment`). Tests added for the split, the timing scaling and the wrapper. `pnpm validate` passed (1066 tests). A real FFmpeg run turned a 6.0 s clip into 3.6 s at the 2.0 pace. Documented in the voice-director and house-style skills.
- **Why:** The owner asked for a maximum speed of 2.0. The ElevenLabs API only accepts up to 1.2, so a higher value cannot simply be passed through.
- **Decisions:** The stretch lives in infrastructure, so the application layer and the offline voices are unchanged (the `system` voice already scales its own rate). Billing is unaffected because the stretch happens locally after synthesis. No narration was generated at the new pace, and no ElevenLabs request was made. Script v6 is still waiting for the owner's approval. No commit.

## 2026-11-15T13:46Z · Claude Code

- **What:** Made the social campaign video `create-a-short-social-media-campaign-to-introduce-the-produc` faster and livelier at the owner's request. `script.md` v6 rewrites the narration in a jovial ad voice ("Ding!", "Boom.", "Easy.", "Not one naira.") with the same scenes and fact claims (full about 1:27, short about 0:32, no lint errors or warnings). Storyboard v2 has its cue phrases updated and `"background": "animated"` on both cuts. Added `pnpm studio narrate --speed <0.7-1.2>`, which records the pace in the manifest and regenerates clips at it. Added an opt-in animated background: `CutSchema.background` (`static` by default), `SceneRenderProps.backdrop.startFrame`, `MOTION.backdrop` tokens, pure geometry in `src/remotion/lib/backdrop.ts` and the animated branch in `Background.tsx`: orbiting terracotta glows, a drifting grid and booking dots in the margins outside the safe area. Tests added for both, and `pnpm validate` passed (1059 tests). Documented in `docs/MOTION-DESIGN.md`, the motion-graphics skill, and an owner-correction entry in `iker-house-style`.
- **Why:** The owner said the video and narration were "very slow and boring" and asked for a trending background, ad-speed narration and a jovial, engaging script. They chose an animated visual background over a music bed, and speed 1.15 plus a tighter script.
- **Decisions:** The background is keyed to the frame of the cut, not the scene, so it flows across hard joins. It is off by default, so other videos and their scene hashes are unchanged, and it is still under reduced motion. Like the progress bar, it re-renders later scenes when one scene's length changes. The script edit voided the script approval. Narration has not been regenerated: it waits for the owner to approve script v6 and the "Naira" pronunciation (newly spoken in "Not one naira"). Estimated 1,478 ElevenLabs credits. Nothing has been rendered with the new background apart from two sample stills. No commit.

## 2026-11-15T13:17Z · Claude Code

- **What:** Took video `create-a-short-social-media-campaign-to-introduce-the-produc` (first social campaign video: one booking from the public link to the client's confirmation email) through research, script and storyboard. `research.md` has 14 sourced facts, two of them new (`email-new-booking-business`, `email-confirmed-client`) read from slot-books `supabase/functions/booking-notifications/handler.ts`, `_shared/email/templates.ts` and migration `0035`. `script.md` v5 has a 16:9 `full` cut (about 1:29) and a 9:16 `short` cut (about 0:33), with no lint errors or warnings. `storyboard.json` v1 uses character scenes (Amaka, a fictional makeup artist, and her client Tunde), a pipeline for the deposit and story lines, with no product footage.
- **Why:** The owner ran `pnpm studio script` on the untouched skeleton, which failed on 19 `TODO` placeholders and no facts. They asked for a pictorial, illustrated explanation.
- **Decisions:** All illustration, no recording, because no Iker demo environment is configured. Notifications are described as email only (SMS/WhatsApp not shipped), and the client email as conditional on the client having entered one (the script has Tunde enter it). Iker is never said to take or verify payments. Stopped at human gate 1: script not approved, no narration generated. "Iker" and "useiker.com" pronunciations are still unapproved. No commit.

## 2026-11-15T00:00Z · Claude Code

- **What:** Rewrote the studio's documentation, agent instructions and Claude Code skills for Iker. `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE.md`, `brand/README.md` and every file in `docs/` now describe Iker's studio: booking and payment examples in place of identity-verification ones, `IKER_*` environment variables, `useiker.com` and all subdomains refused, recording against a local slot-books copy (`http://localhost:3000`) or a staging host (`staging.iker.example` in examples), templates `product-tutorial`, `feature-announcement` and `business-explainer`. Renamed the skills `toden-house-style` to `iker-house-style` and `toden-social-publishing` to `iker-social-publishing`, rewrote every non-Remotion skill, and made `.agents/skills/` an exact copy of `.claude/skills/` (four `.agents` copies had been older versions). `.env.example` drops the Sandbox opt-in and workspace variables. `PLAN.md` is reset to Iker's phases and blockers.
- **Why:** The studio was cloned from `todenhq/toden-video-studio` to make videos for Iker. Its instructions named another product, its production hosts and a Sandbox mode Iker does not have, so agents following them would have written and recorded the wrong things.
- **Decisions:** Product wording, the call to action ("Get started" at useiker.com) and what not to claim come from `knowledge/` and the slot-books docs; nothing outside them was added. Hard rules gain one: Platform Admin and Super Admin views never show a business's money. Captions lead with a truthful concrete pain (chasing payments in DMs, no-shows, unrecorded walk-ins), never fear or invented statistics. Status claims about earlier videos were removed; the docs say plainly that nothing beyond unit tests has run for Iker. The recorder no longer checks the selected business on the page, so the docs say the host guard is the only automatic control. Remotion component names inherited from the first product (for example `KYCPipeline`) are left as they are in `docs/MOTION-DESIGN.md` because they are real exports. `brand/pronunciations.json` still lists the previous product's terms and needs replacing by its owner. No commit.

## 2026-11-12T22:30Z · Claude Code

- **What:** Moved both projects to the `todenhq` GitHub org as internal repositories. The brochure is now `todenhq/toden-sales-brochure`: one commit with `package.json` (Playwright 1.64.0), `.gitignore`, a `CLAUDE.md` of rules for agents and an `AGENTS.md` pointer. Its build no longer depends on this repo, and personalised `--for` copies are written to an ignored `prospects/` folder. The studio's pending work was committed in seven commits and pushed to `todenhq/toden-video-studio`. `origin` now points there, and the old `myazahq/myaza-video-studio` remote is kept as `myaza`.
- **Why:** The owner asked to push both to the Toden org so teammates can work on them with Claude Code.
- **Decisions:** Internal visibility, matching the org's other private repos. The brochure's built PDFs, covers and previews are committed so the finished files can be taken without building. Prospect-named PDFs never are. Before committing, the studio passed `pnpm validate` (1322 tests) and `pnpm test:integration` (52 tests). Prettier reformatted `CLAUDE.md`, `AGENTS.md` and `PLAN.md`. A secret scan of the pending changes found nothing. Only text sources under `output/` were committed. Media stays ignored.

## 2026-11-12T21:40Z · Claude Code

- **What:** Redesigned the Toden brochure in `../toden-sales-brochure/` and added a short version. `Toden-Product-Brochure.pdf` (16 pages, 2.6 MB) and `Toden-Outreach-Brochure.pdf` (5 pages, 0.75 MB) share `source/brochure.css`. `build.mjs` builds both and takes `--for "Company"` for personalised copies. Also added `Outreach-Messages.md` (cold email, follow-up, LinkedIn message) and a rewritten README with sources and corrections. The old `Toden-Sales-Brochure.pdf` is replaced.
- **Why:** The owner asked for a critical redesign: problem → feature → outcome → two commercial benefits per product, larger real screenshots, the lifecycle as the central argument, corrected claims, a personalised meeting offer, mobile readability, and a five-page cold-outreach cut. Writing skills used: sales-enablement, copy-editing, offers, marketing-psychology, cold-email, customer-research, copywriting, product-marketing.
- **Decisions:** Lifecycle moved to page 3, and every feature page carries a six-stage rail. Benefits are tagged revenue protection, risk reduction, operational efficiency or faster decisions, with no invented numbers. New crops are tighter, show actions (how a verification was decided, owner invites, publish review, a rule tested on past activity, a wallet blocked) and carry brand-styled annotations. Sandbox prices are blurred, not removed. Three claims were corrected: the utility-bill joke (Toden accepts bills), "same recipient" (not in the docs) and "trust score that explains itself" (now the product page's wording). The offer ("Your onboarding, mapped before we meet") builds on toden.co/contact; the team must confirm it delivers the three listed items. Nothing in this repo changed apart from this entry. No commit, no publishing.

## 2026-11-12T18:12Z · Claude Code

- **What:** Built a 16-page Toden sales brochure (cover, problem, 11 feature pages in Feature → Outcome → Benefits form, lifecycle, coverage and pricing, CTA) in a sibling folder, `../toden-sales-brochure/`: `Toden-Sales-Brochure.pdf` (1080×1350 pages, 2.2 MB, embedded Bricolage/Geist, live links), standalone cover PNG/JPG, editable `source/index.html` and `source/build.mjs`. Research from toden.co, toden.co/platform, every product page, toden.co/brand (official kit downloaded) and docs.toden.co; sources table in its README.
- **Why:** Owner asked for a high-conversion sales brochure for prospects, sent over WhatsApp, LinkedIn and email.
- **Decisions:** Real product visuals are crops of Acme Corp Sandbox screenshots already in `output/*/recordings/*/screenshots`, cropped to drop the old Myaza sidebar logo and wording, and captioned as Sandbox test data. Synthetic "Demo Console" shots were not used. Concept pages use captioned illustrations. No uppercase eyebrows (house style). CTA is "Talk to us" (toden.co/contact) plus "Start free", because "Book a demo" doesn't exist. No stats, customers or certifications beyond those on toden.co. Of the eight requested marketing skills only `product-marketing` and `copywriting` are installed. Nothing in this repo changed apart from this entry. No commit, no publishing.

## 2026-11-03T11:35:22Z · Codex

- **What:** Recorded Charles's script/creative approval from "everything looks okay. proceed" for October script v2. Generated all seven Technical Expert narration clips through the studio CLI, with provider word timing; 1,069 credits for narration, 1,311 total including earlier auditions. Produced the complete 65.02-second 1080×1920 H.264/30 fps master with AAC 48 kHz stereo, speech-timed burned captions/SRT/VTT, original ducked music and narration-timed sound cues. Master: `output/october-2026-product-update/final/october-2026-product-update-master.mp4`; review page: `review/index.html`.
- **Why:** Owner approved the revised customer-outcome story and instructed production to proceed with Technical Expert.
- **Decisions:** Kept the approved custom artwork through a campaign-specific deterministic `production.ts` CLI and `VideoRenderer` adapter, reusing the real studio render/manifest/stage/caption/QA application use cases without changing shared application/rendering sources or hand-editing a manifest. The campaign CLI is required for accurate custom-renderer cache inspection/rendering; ordinary studio approval/export gates remain. Fixed transient title and product-crop overlap found in frame inspection, then rendered and rechecked the exact final. All stages through QA complete; no narration text changed or paid audio regenerated during visual finishing. Final QA: 0 failures, 0 warnings, 1 manual safe-area item. Audio -14.1 LUFS / -1.5 dBTP. Used actual provider timing for every scene; metadata transcripts match approved speech. Sampled scene, first, last and actual product-crop frames inspected. File/manifest/QA hashes match `da65a65218a90a3398818b89e826a6254e044b140c07bc318168c498ed725726`. Local review page video and links verified. Final human listening/creative approval and local export remain pending. No upload, scheduling, publishing, commit or push. Existing dirty work preserved.

## 2026-11-03T03:18:44Z · Codex

- **What:** Recorded Charles's explicit Technical Expert audition selection through the CLI, with a note that it does not approve the script. Rebuilt the October campaign as script/storyboard v2, titled "October at Toden: Beyond a passed ID", around three supported customer outcomes: configured review decisions, retaining address evidence while extending an eligible check, and a shared operational report. Added applicant/analyst/colleague illustrations, revised the cover and all social copy, and rendered a new 65-second 1080×1920 H.264 silent review. Current handoff is `output/october-2026-product-update/review/index.html`; earlier sources/media are retained under `review/v1-superseded/`.
- **Why:** Owner selected "Technical Expert audio" and said the first cut did not look outcome-driven for what customers received. V2 makes the person and usable action the visual payoff instead of controls and documentation tiles.
- **Decisions:** Moved developer docs out of the hero story. Corrected the initial research's KYB-reminder/premises attribution: bb267fd and fe352b5 are absent from v2.15.0 ancestry, despite the current docs' October date. They are excluded. Device/country rules were positively verified in v2.4.0, including production deploy job 110569422669 and its successful external HTTPS step. Script v2 passes (141 words, about 63 seconds, 12 facts), storyboard is in sync; Technical Expert direction has zero errors/warnings; strict composition typecheck, media probe, zero black-detection events and sampled visual review pass. Revised thread has six posts, all below 280 characters. No new synthesis spend; full v2 narration estimate is 1,069 credits. Revised script approval, full narration/caption timing, final mix/render/QA and final approval remain open. No customer write, export, publishing, commit or push.

## 2026-11-03T02:27:48Z · Codex

- **What:** Prepared the October 2026 product campaign in `output/october-2026-product-update/`: private ranked release research with the 68-PR / 19-tag inventory and deployment-job evidence; nine sourced facts; validated 141-word script and eight-scene storyboard; campaign-specific editable Remotion designs using the official Bricolage/Geist kit; real cropped Acme Corp Sandbox controls and public docs; full-title cover; a 65-second 1080×1920 H.264 silent design animatic; two hook voice auditions; original sample-free sound stems; six-tweet X thread, Instagram/TikTok captions and proposed sequencing. Review starts at `review/index.html`. Script and storyboard validation, strict composition typecheck, media probe, sampled visual review, zero black-detection events and local review-page/link checks pass. CLI scene-review correctly stops for missing narration; no CLI final-QA pass is claimed.
- **Why:** Owner requested an evidence-based October product launch campaign for prospects and existing customers, executed as far as available tools and the human gates permit.
- **Decisions:** Feature presence review controls, custom lists in rules, operational reports and dedicated developer docs; hold gated wallet/funding claims and Travel Rule test preparation, and exclude September/August launches. Current Sandbox has no active presence check; use labelled explanation graphics and never invent a result. Preserve existing dirty work and shared brand/rendering sources. Full narration, synchronized captions, final mix, final QA and final approval remain pending human script/voice review. Auditions spent 242 credits; the recommended directed Cinematic Storyteller dry-run needs another 1,022 credits with the hook cached. No approval, customer write, report download, deployment, publishing, export, commit or push was performed. Status: needs human review.

## 2026-10-26T23:22:17Z · Claude Code

- **What:** Fixed YouTube publishing and uploaded the `kyb-officer-training-en` full cut: https://www.youtube.com/watch?v=FDFkoeQxhSg (public, @todenhq, full-title thumbnail verified live). In Google Cloud project `constant-wonder-511000-c6` (OAuth app in Testing, owned by charlesarchibong10@gmail.com) added hello@toden.co as a test user, then re-ran `publish-auth` choosing the brand account "Myaza", which is the @todenhq channel. For the X repair, set the short's `short-hook` to `enter: "hold"` so frame 0 shows the full title, re-rendered the short (new SHA-256 `f57ebe5d…`) and ran QA: passed, 1 warning. Receipts in `output/kyb-officer-training-en/publishing/full/receipts.json` and `short/receipts.json`.
- **Why:** Owner: "fix the Google OAuth test user, upload to YouTube, repost X".
- **Decisions:** hello@toden.co has no channel of its own (`youtubeSignupRequired`); @todenhq is the "Myaza" brand account under the gmail account, so the stored token now belongs to it. The app stays in Testing, so the refresh token expires after about 7 days; publishing the app (Branding page first) would end that. The X repost waits: the re-rendered short voids its final approval, which belongs to the owner. The Chrome extension may not operate on x.com, so Media Studio could not be checked, and the old X post must be deleted by the owner. Instagram and TikTok posts are from the previous master and are unchanged.

## 2026-10-26T21:16:21Z · Claude Code

- **What:** Published the `kyb-officer-training-en` vertical cut through the Buffer API: Instagram https://www.instagram.com/reel/De-NxEsjdyr/ , TikTok https://tiktok.com/@todenhq/video/7701087786136292629 , X https://x.com/2109777449433128960/status/2114827867171250206 . Hosted the approved MP4 and cover in a public Vercel Blob store `toden-social-videos` (project `toden-social-media`, team performa-app); an empty store `toden-social-media` also exists and needs the owner to delete it (Vercel refuses agent deletion). Added the owner's reversed logo to `brand/`, re-rendered, QA passed. Recorded the owner's pronunciation approvals (Toden, KYB, KYC, AML, Sanctions) at his statement. Corrected the YouTube channel to @todenhq in house style. Receipts: `output/kyb-officer-training-en/publishing/short/receipts.json`.
- **Why:** Owner: "Approved push the videos to all media", "use vercel blob"; he posts LinkedIn himself.
- **Decisions:** Buffer's API rejects custom thumbnail images; Instagram and TikTok use the 800 ms title frame. Instagram live cover verified with the full title. TikTok cover not yet visible. X poster is the blank frame 0: fails the cover rule; repair needs a re-render with the title at frame 0, final approval and permission to delete and repost. YouTube upload blocked: the stored token was refused (HTTP 400); the owner must complete the consent link on this Mac for @todenhq. `product.png` thumbnail temporarily replaced by the full-title cover for the YouTube upload; original kept as `product-generated.png`.

## 2026-10-26T19:52:32Z · Claude Code

- **What:** `kyb-officer-training-en` produced. Owner skipped the Sandbox rounds: chapters 6 and 7 condensed to illustrated explanations; script v7 approved by the owner (Charles Archibong, 18:47 UTC). ElevenLabs narration (45 clips, voice Xkz0…, eleven_v4, no preset, 11,269 characters). Final renders: full 3840x2160 12:36, short 2160x3840 0:35 (new vertical cut opening on its full title). QA passed both with warnings (logo as text, scenarios unverified, pronunciations pending). Full-title covers in `publishing/covers/`; captions in `publishing/captions-draft.md`; metadata and chapters generated. Buffer channels read via API (X, TikTok, Instagram, all @todenhq).
- **Why:** Owner: "go ahead with the video, push it to youtube"; vertical to Instagram, TikTok and X via the Buffer API; owner posts LinkedIn.
- **Decisions:** My attempt to record the owner's chat approval was refused as self-approval; the owner ran it. The Mac's internal disk is full (126 MB free); renders now use `TMPDIR=output/.render-tmp` on the SSD; nothing outside the project was deleted. Buffer's API needs a public media URL and R2 is empty; hosting is the owner's decision. Final approval, YouTube upload and Buffer posts wait for the owner. Ownership-rule review and the retry defect remain unverified.

## 2026-10-26T17:43:33Z · Claude Code

- **What:** `kyb-officer-training-en` revision, round 2. Added `drag` (with `fromClosest`/`toClosest`) and `press` steps to the recorder (`src/domain/recording.ts`, `step-handlers.ts`, `pacing.ts`) with schema tests; scenarios in `src/scenarios/myaza-acme-kyb-officer.ts`. Recorded on console.toden.co (Acme Corp, Sandbox): the create take, the full build take (Business Lookup, documents, questionnaire, key people, the unresolved-ownership rule on the decisioning canvas, publication review) and the New session dialog (closed unsent). Published `wf_4r9dAIQQTKdK` "Business onboarding (example)" v1 in Sandbox; rehearsal draft `wf_P-X0gI15JxSf` "Rehearsal KYB (example)" left as a draft with the rule. Script v6 (54 scenes, about 16:50), research expanded to 63 facts, storyboard v3 fully designed (character scenes, cue-driven ownership network, footage windows, anchors, manual canvas camera). Rendered representative frames with silent stand-in timing; rebuilt `review/script-review-packet.html` with real captures. Wrote `review/sandbox-steps-for-owner.md` and two fake sample PDFs.
- **Why:** Owner's seven corrections, then "proceed" on the recommended routes (rehearse a simpler editor, fall back to a drag step; owner performs the selfie journeys; applicant pages shown as illustrations).
- **Decisions:** The simple rule editor disappears once a key-people hold exists, so the rule is built on the canvas. The ownership hint is not implemented in the engine; the script says so. Recorded an automated script approval ("Claude Code", note says pipeline check only) and switched this video's voice to `silent` to render frames; restore `--voice-provider elevenlabs` after the owner's real approval. A failed build take had autosaved two settings; a one-off revert take restored them before the clean take. Chapters 6 and 7 wait for the owner's Sandbox applications. Typecheck and unit tests pass for the recording changes; nothing committed, published or narrated with ElevenLabs.

## 2026-10-26T16:42:35Z · Claude Code

- **What:** Revision round on `kyb-officer-training-en`. Pointed the recorder at `console.toden.co` (`trust.myaza.co` now redirects to the marketing site): added the host to `KNOWN_PRODUCTION_HOSTS` in `target-guard.ts` with a test, and set `MYAZA_DEMO_BASE_URL` in `.env`; the existing Sandbox-only opt-in and the on-page Acme Corp + Sandbox checks still apply. The owner signed in through `demo-login`. Added a partial-name option (`~`) to `demo-snapshot --open`. Added `src/scenarios/myaza-acme-kyb-officer.ts` (create take recorded green; builder tour rehearsal). Verified the builder panels on the live console and recorded the differences in `research.md`. Created the Sandbox draft `wf_4r9dAIQQTKdK` "Business onboarding (example)".
- **Why:** Owner feedback: verify against the live Sandbox, set up and prove the ownership rule, show an owner completing verification and Approve / Decline / Send back, fix the recording setup without weakening the guard.
- **Decisions:** Did not use `MYAZA_PRODUCTION_HOSTS` (it is a deny-list that wins over the opt-in). Masked the other workspace in the switcher. Found that the "unresolved ownership is sent for review" hint is not implemented and that the KYB + AML template can only be edited on the canvas by mouse drag. Hosted applicant and key-person flows need a real face for liveness and the recorder cannot confirm Sandbox on `/verify` pages; stopped for the owner's decisions rather than adding a camera fake or a new guard path. Script, storyboard and contact sheet not yet revised. `pnpm validate` parts run: typecheck, lint and 1250 unit tests pass; the format check still flags the pre-existing edits in AGENTS.md and CLAUDE.md, left untouched. Nothing narrated, rendered, approved, committed or published.

## 2026-10-26T16:12:25Z · Claude Code

- **What:** Started `kyb-officer-training-en`, a compliance-officer training video on setting up KYB and verifying the people behind a business. Verified 51 product facts against `todenhq/toden-console@7c5e8e5` (17 Oct, same as staging), `todenhq/toden-core@04ccb23` (21 Oct) and three toden.co articles; wrote `research.md`, a seven-chapter English `script.md` (lint passes, about 13:42) and `storyboard.json` with chapter titles; generated `output/kyb-officer-training-en/review/script-review-packet.html` (storyboard table with task, screen, control, narration and result per scene, plus a 40-frame capture list). Narration dry run: 11,414 credits, nothing generated.
- **Why:** The owner asked for a detailed, multilingual (en, fr, ar, pt, sw, zh) KYB training video on the existing pipeline, stopping at script approval.
- **Decisions:** No screen captured. The saved demo session fails the workspace check, the console moved to `console.toden.co` (the studio and its production guard still name `trust.myaza.co`), and the 9 Oct KYB footage predates the Toden rebrand, so it is not reused. Guard and base URL left unchanged for the owner. Contact sheet shows empty frames, nothing drawn in place of product UI. "View verification result" does not exist; the script uses "KYC completed, view result". Retry after a failed KYC is described, not filmed (probable defect: `key-person-invite.ts:202-205` keeps `personVerificationId`). Template "KYB + AML screening" chosen because Screening only is hidden when screening is off. Six languages planned as separate videos reusing the English recordings; Chinese and Arabic need caption, font and RTL changes not yet made. `eleven_v4` lists all six languages; the API key cannot read the credit balance. Translations wait for English approval. No approval run, nothing recorded, narrated, rendered, committed or published.

## 2026-10-22T21:41:55Z · Codex

- **What:** Published all 12 approved full-length videos to Toden's LinkedIn Company Page (146722398) through native Chrome. Verified 12 distinct permanent activity URLs, each saved caption and full-title landscape cover, expected full-cut duration, advancing playback and uploaded SRT subtitle controls/output. Saved per-video packages, source/cover hashes, all post URLs, native preview screenshots and live cover/playback proof under output/_linkedin-publish/2026-10-22/.
- **Why:** The owner explicitly requested Chrome, the long-form videos used for YouTube, the agreed caption skill, the best cover image and all videos uploaded.
- **Decisions:** Uploaded the exact approved masters, not Shorts or new encodes. Excluded the older unapproved first-verification cut. Used truthful fear-led captions with full-walkthrough payoffs and material Sandbox/feature limits, plus AI-narration disclosure. Face search uses existing approved title candidate 2 because research explicitly warns the original stops-fraud title overclaims; the whole chosen title appears on its cover. All other covers use the complete existing full title. Preserved source media, scripts, manifests and approvals. No X/Instagram/TikTok changes, developer app setup, new permissions, paid promotion or direct LinkedIn CLI implementation. No deletion/reposting and no commit.
- **Validation:** All 12 on-disk MP4 hashes match non-automated human final approvals and matching passing QA; all use ElevenLabs and no manifest recording scenario is synthetic. Twelve 1920x1080 covers rendered with existing native Toden artwork/fonts and inspected full-size, at a small grid size, in each native preflight and as persisted LinkedIn posters. Published one pilot and passed live QA before releasing the batch; checked each remaining post after processing. The admin briefly rendered one KYB activity twice with the same URN; a refreshed list confirms exactly 12 unique activities, not duplicate remote posts. Both mirrored publishing skills pass quick_validate.py, targeted formatting and git diff --check pass. Application tests were not run because no application/media-pipeline source changed. Platform playback renditions vary; no reach or cross-device quality claim made.
- **Reusable workflow:** Extended the publishing skill/reference to LinkedIn and long-form packaging, accurate SRT upload, waiting for the native post dialog and upload/processing states, persisted cover checks, unique-URN receipts, asynchronous Copy link behavior, and player scoping that excludes private messaging overlays. Mirrored .agents and .claude files remain aligned.

## 2026-10-22T21:02:07Z · Codex

- **What:** Owner selected Toden's Company Page and direct studio publishing. Checked the current YouTube-only publisher/CLI, LinkedIn app review, access tiers, Videos and Posts APIs. Established setup order: create a developer app linked to the Toden Page and verified by its super admin; apply for Community Management Development access using the registered legal organization/business domain; implement and test the publisher plus OAuth; obtain Standard access for production with LinkedIn's required app demonstration/review.
- **Why:** Explain how to publish from the studio to the selected Company Page.
- **Decisions:** No LinkedIn CLI command currently exists. Do not present proposed commands as executable. Publishing needs w_organization_social and an eligible Page administrator; read-back verification needs the corresponding read access. Keep credentials locally protected, not in chat. Use Videos API for MP4/full-title cover/subtitles and Posts API for Company Page commentary; preserve existing human approval gates and verify one pilot. App approval and its timeline are controlled by LinkedIn. No app created, permission granted, publisher implemented or post published.
- **Sources:** https://www.linkedin.com/developers/apps ; https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review ; https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access ; https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api ; https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

## 2026-10-22T21:00:29Z · Codex

- **What:** Checked LinkedIn publishing feasibility against the current studio and official LinkedIn/Buffer documentation. The CLI still wires only the YouTube publisher. LinkedIn's Videos API supports video, caption files and custom thumbnails; authenticated member and organization destinations use different permissions. Company Page production API access requires the applicable Community Management access and Page role.
- **Why:** The owner asked whether the YouTube publishing workflow can also publish to LinkedIn.
- **Decisions:** A direct LinkedIn publisher is feasible but not implemented or connected. A logged-in native LinkedIn browser upload is a possible initial route, subject to verifying the destination and cover preview. Buffer supports LinkedIn Pages/profiles, but its current guide says custom thumbnails are unsupported for uploaded LinkedIn videos; do not use that route unless the required title cover can actually be delivered. Buffer Free has three channel slots, currently allocated to the earlier X/Instagram/TikTok batch; ignoring X does not itself disconnect it. Await the owner's choice of Company Page versus personal profile before destination-specific setup. No account connected, permissions changed, code implemented or video published.
- **Sources:** https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api ; https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access ; https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access ; https://support.buffer.com/articles/using-linkedin-with-buffer-K7tRkGD3mH ; https://buffer.com/pricing

## 2026-10-22T20:56:03Z · Codex

- **What:** Recorded the owner's decision to retain all existing Instagram videos and update titles only in place if supported, otherwise leave them. Closed the cover-replacement proposal, updated the repair queue/report and per-cut packages, and discarded only the agent-created unshared new-post preview. Returned to the original Reel and verified its existing URL and saved caption remain visible.
- **Why:** The owner declined replacing videos and losing their original views/engagement. Chrome existing-post editing has no cover/title-image control, and the owner reports the same on their phone.
- **Decisions:** Do not delete or repost Instagram Reels. Keep the 13 updated captions and existing covers. X remains ignored. Five TikTok captions/full-title covers are saved; eight remain pending the native daily edit window. Future uploads still require the mandatory title-cover/caption workflow. No source, approved media, manifest, approval or published post changed during this closeout. No commit.

## 2026-10-22T19:59:41Z · Codex

- **What:** Updated and reloaded all 13 Instagram captions and 13 YouTube Shorts descriptions. Saved and reopened full-title covers plus captions for five TikTok posts (series 06–10), resolving the earlier interrupted transaction-monitoring save. Eight TikTok posts are blocked by the native once-per-day caption/cover limit. Built 13 1080x1920 portrait cover PNGs with existing Remotion artwork/fonts in ignored generated output; inspected full renders and a 160 px grid crop. Verified the first PNG applied in Instagram's native new-post editor, with the approved source, caption and AI label loaded in an unshared draft.
- **Why:** Complete the owner's request for exact-title covers and truthful fear-led captions on existing videos. The owner now confirms no Cover option appears on their phone and explicitly says Ignore X.
- **Decisions:** Leave all X posts unchanged. Existing Instagram covers cannot be edited using the observed web/phone controls. A concrete 13-Reel replacement review is ready; separate explicit deletion/reposting authorization is pending. No post was deleted or replaced. Preserve original IDs/engagement until that decision. Do not bypass TikTok daily limits; check eligibility in the next daily window and save caption plus cover together. No shared rendering source, approved MP4, script, manifest or approval changed; no commit.
- **Validation:** Live persisted captions/descriptions were compared after reload; the five TikTok editors were reopened and their covers/captions inspected. All 13 source MP4 hashes still match approved originals. All 13 cover PNG renders completed successfully; title line joins exactly match canonical titles. First Instagram native cover preview and final draft screenshots saved. Remaining 12 destination previews and all replacement live verification remain pending, not inferred from local assets. Receipts, statuses, covers and review are under output/_buffer-publish/2026-10-22/repairs/.

## 2026-10-22T19:17:17Z · Codex

- **What:** Created `toden-social-publishing` in both `.agents/skills/` and `.claude/skills/`, with an official-source platform-delivery reference. Made it a required prerequisite in AGENTS.md and CLAUDE.md and linked it from house style, video director, video editor and the human-invoked YouTube strategist. Covers must visibly carry the complete selected video title; captions must lead with a concrete, truthful risk and a specific reason to watch. Added mobile/crop inspection, explicit frame selection, per-platform preflight, a live pilot before batch continuation, and post-by-post visual verification. Corrected AGENTS.md's stale `.Codex/skills` location.
- **Why:** The owner found missing TikTok/Instagram covers after the Buffer batch and explicitly required catchy title-bearing covers and fear-driven captions for all future platforms, saved as a reusable skill.
- **Decisions:** Researched official YouTube, TikTok, X and Buffer guidance. Buffer defaults to frame zero, selects frames rather than accepting a separate cover upload, and does not apply its selected thumbnail to X. A destination without a verified compliant cover must be held or use a supported native route. Preserve title accuracy, fact qualifications, existing human approval and publishing authorization; no false urgency or unsupported claims. This is a required agent workflow, not new CLI enforcement. No application code, scripts, manifests, approved media or published captions were changed in this task. No commit made.
- **Validation:** Both new skill directories pass the bundled quick_validate.py. All four new Markdown files pass targeted Prettier checks; git diff --check passes. Reviewed routing and removed the YouTube strategist's conflicting instruction to replace the title with a shorter cover hook. Unit/media tests were not run for this documentation-only change.
- **Existing cover repair:** Earlier TikTok in-place edits do not establish compliance with the newly requested exact-title rule. The transaction-monitoring cover save was interrupted; its persisted state remains unverified. On resumption the old TikTok editor tab no longer exists, so no pending editor could be inspected. Existing Instagram web Edit Info had no cover control. Current-post repair remains open; do not claim every published cover is fixed or delete/repost without explicit authorization.

## 2026-10-22T18:52:59Z · Codex

- **What:** Published all 13 approved portrait cuts to the connected @todenhq accounts on X, TikTok and Instagram: 39 posts total. The final Buffer API read confirms 13 sent per platform, 39 unique post IDs, a platform URL for every post and no publishing errors. Saved per-cut captions, source master hashes, post IDs and URLs in output/_buffer-publish/2026-10-22/report.json and report.md, plus buffer-sent.jpg. Left Buffer's Sent history open.
- **Why:** The owner connected Buffer, saved the local API key and explicitly chose "Publish all immediately" for TikTok, Instagram and X.
- **Decisions:** Used the official API for authentication, channel and duplicate checks, and final status verification. Used Buffer's logged-in website for file uploads because its public API accepts hosted media URLs and has no file-upload endpoint. Uploaded the exact approved masters; did not change source videos, scripts, manifests or approvals, and did not upload to R2. Chose Instagram Reels with Share to Feed and automatic immediate publishing. Enabled AI-generated disclosure on all three destinations for the ElevenLabs-narrated videos. Captions retain Face search review-signal and Travel Rule live-availability qualifications. Excluded first-verification/short because it has no final approval. No application code changed; no commit made.
- **Validation:** Rechecked all 13 source files against human final-approval SHA-256 and matching passing QA records; all use ElevenLabs narration and no synthetic scenario recordings. Initial Buffer account had no posts. Final receipts contain exactly one post per approved cut/platform. ffprobe on the first Buffer-transcoded asset confirms 1080x1920 H.264 and AAC 128 kbps, duration 45.166667 seconds. Buffer Sent history shows 39 posts. This verifies publication acknowledgements and URLs, not audience reach or playback quality across every device. No test suite was run because this was a publishing operation with no application-code changes.

## 2026-10-22T18:32:49Z · Codex

- **What:** Prepared the Buffer access handoff and audited local portrait final files. Found 14 portrait final cuts: 13 have matching human approval, matching QA pass and verified on-disk SHA-256; the first-verification short has no final approval. The .env file is ignored and untracked; BUFFER_API_KEY is not set. No Buffer plugin was returned by plugin discovery.
- **Why:** The owner connected Buffer and requested access instructions to publish all Shorts, then explicitly selected "Publish all immediately" for TikTok, Instagram and X.
- **Decisions:** Publishing authorization is retained for the approved Shorts on those three destinations; do not ask for the same permission again. Await a local API key with accountRead, postsRead and postsWrite. Verify exact connected destinations and duplicates before publishing, preserve existing approval gates, exclude the unapproved cut. No remote upload, account verification or live quality check has happened. Apply the toden-house-style skill when preparing viewer-facing captions.
- **Sources:** https://support.buffer.com/en-us/articles/how-to-create-your-buffer-api-key-ShIgYVwM6j ; https://developers.buffer.com/guides/authentication.html

## 2026-10-22T18:26:55Z · Codex

- **What:** Verified Buffer's current video processing and quality documentation.
- **Why:** The owner asked whether the free publishing route preserves high video quality.
- **Decisions:** Buffer is a 1080p social publishing option, not a route to preserve 4K masters. Its help documents downscaling above 1920px on the longest side and transcoding triggers including video above 25 Mbps, audio above 128 kbps, HEVC and mobile uploads. Recommend a dedicated 1080p H.264/AAC social export and a small published quality comparison before batch use. No output or upload quality was tested; no media or code changed.
- **Sources:** https://support.buffer.com/en-us/articles/troubleshooting-video-uploads-in-buffer-LK0CldlFNB ; https://support.buffer.com/en-us/articles/sharing-videos-through-buffer-LOe2p2rnAI

## 2026-10-22T18:25:44Z · Codex

- **What:** Checked Buffer's current Free plan, supported channels and API availability after the owner requested a free alternative.
- **Why:** Find one service for TikTok, Instagram and X without a paid subscription.
- **Decisions:** Recommend Buffer Free for one account on each of those three networks, with 10 queued posts per channel and reusable slots after publishing. Buffer documents API availability on Free, subject to plan limits; a studio integration remains unimplemented and untested. This supersedes the earlier Metricool recommendation for the owner's zero-subscription preference. Keep YouTube on the existing uploader to preserve the three free channel slots.
- **Sources:** https://buffer.com/pricing ; https://buffer.com/publish ; https://buffer.com/api ; https://support.buffer.com/en-us/articles/what-is-buffers-api-GtIYIQilz5

## 2026-10-22T18:23:50Z · Codex

- **What:** Verified Metricool support for X video posts and Instagram automatic publishing against its current help pages.
- **Why:** The owner asked whether the same TikTok service can cover X and Instagram.
- **Decisions:** Metricool can serve all three. X requires a paid add-on on Starter or higher; Instagram automatic publishing requires a Business or Creator account. A future direct CLI integration still requires API access. No accounts connected, posts created, subscriptions purchased or application code changed.
- **Sources:** https://help.metricool.com/schedule-and-publish-on-x-twitter-klho8 ; https://help.metricool.com/schedule-and-post-on-instagram-6b6q5 ; https://metricool.com/pricing/

## 2026-10-22T18:22:53Z · Codex

- **What:** Checked Metricool's current TikTok publishing, API integration and pricing documentation for the owner's follow-up about a compliant service.
- **Why:** Identify a practical publishing route for studio-generated TikTok videos.
- **Decisions:** Recommend Metricool: it documents automatic TikTok publishing for personal and business accounts, and an API suitable for a future CLI integration. Free scheduling is limited to 20 posts per month; direct API access is listed under Advanced. No subscription, connection or publishing action was taken.
- **Sources:** https://help.metricool.com/schedule-and-post-on-tiktok-bkepi ; https://help.metricool.com/basic-guide-for-api-integration-r97af ; https://metricool.com/pricing/

## 2026-10-22T18:21:16Z · Codex

- **What:** Reviewed multi-platform publishing feasibility against the current CLI and official platform documentation. YouTube is the only implemented publisher; portrait and landscape social formats already exist.
- **Why:** The owner asked whether X, TikTok and Instagram can use the studio and whether uploading through it affects views.
- **Decisions:** Recommend X and Instagram API integrations as possible extensions, subject to account authorization and platform access. TikTok Direct Post guidelines exclude internal team-only upload utilities; use a compliant publishing service or manual upload instead. No documented upload-source reach penalty was identified; this is not proof of identical reach or a channel analytics audit. YouTube CLI visibility defaults to private. No application code, credentials, approvals or platform posts were changed.
- **Sources:** https://docs.x.com/x-api/media/upload-media ; https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf ; https://developers.tiktok.com/doc/content-sharing-guidelines/ ; https://support.google.com/youtube/answer/141805 ; https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content

## 2026-10-10T11:45Z · Claude (Claude Code)

- **What:** Published through YouTube Studio in the owner's Chrome: the Shorts of series 05 to
  10 and the full cuts of series 05 to 08, each public with its title, description and (full
  cuts) the product thumbnail. Retitled all twelve Shorts on the channel as fear statements.
  The full cuts of series 09 and 10 are not uploaded: Studio answered "Daily upload limit
  reached". IDs and the remaining queue are in `PLAN.md`.
- **Why:** The API route hit `uploadLimitExceeded`, and the owner asked for the uploads to go
  through Studio and called the question-style Short titles "terrible".
- **Decisions:** Full cuts are over the browser extension's 10 MB upload limit, so the owner
  dragged them into Studio from `output/_upload-queue/` and the session filled in the details.
  macOS Accessibility was not changed by the session. The Short title rule is recorded in the
  `toden-house-style` skill, section 8a.

## 2026-10-10T05:30Z · Claude (Claude Code)

- **What:** All ten series videos are produced: 4K finals, QA passed, final approvals recorded
  and export packages built. Series 01 to 04 are live on YouTube; 05 to 10 are waiting because
  the channel reached YouTube's daily upload limit (queue and titles in `PLAN.md`). Engine
  changes along the way: a scenario's status and evidence no longer make its capture stale,
  `record` restores the previous capture when a retake fails and refreshes the verified flag,
  `record --keep-captures`, and the code panel's language tag is no longer uppercase.
- **Why:** The owner asked for ten builder videos with detailed dashboard walkthroughs, then
  told the main session to record the approvals for videos 3 to 10 itself and upload them.
- **Decisions:** Scenes Sandbox could not show honestly became character scenes rather than
  being staged. The Travel Rule video states that exchange with other providers is not
  switched on for live transfers. Vendor names and logos on the fraud settings page are kept
  out of frame. No API key, webhook endpoint, verification or transfer was created on camera.
- **Incidents:** one recording was destroyed by a stale-capture retake (fixed in the engine
  and re-recorded); the external drive dropped off the machine for about an hour.

## 2026-10-10T04:16Z · Claude (Claude Code, series-08 subagent)

- **What:** Took `series-08-travel-rule` from the live check to QA: three recording scenarios
  in `src/scenarios/myaza-acme-travel-rule.ts` (the rule library and the outbound draft,
  testing and saving that draft, the unhosted wallet rule with Signed-wallet authorisation),
  script corrections, storyboard, footage pinned to the narration, both cuts reviewed scene
  by scene, rendered at 4K (full 4:08, short 0:53) and QA passed with 0 failures (full: 3
  warnings, short: 2).
- **Why:** The series playbook, phases A and B, after the owner approved the script and the
  main session marked the scenarios verified, drafted the voice direction and generated the
  narration.
- **Decisions:** Acme Corp's Sandbox holds no crypto transfer, so the held transfer, adding
  the missing details and the incoming transfer are character scenes told from the
  documentation, not footage; no transfer was created through the API and no messaging
  connection was touched. One unpublished Travel Rule draft (Draft v1, rule "Outbound VASP
  transfers") was saved in Acme Corp's Sandbox; Publish draft was not clicked, so no policy
  is active, and the library and draft takes cannot be repeated. The narration of both cuts
  says the footage is Sandbox and that exchange with other providers is not switched on for
  live transfers (fact `live-not-enabled`, quoting `crypto-operations.md`); the `limits` scene
  and the short's outcome set "Not live yet" large on screen, and the outcome no longer
  implies live compliance. `demo-library` starts on the Travel Rule tab with a manual camera
  that walks the sidebar as the path is named, so the Workflows list (names, ids, per-check
  costs) and the Ongoing monitoring library in the take are never shown. The other product
  scenes follow at 1.15 so rule and field names stay in frame. The full cut runs 8 seconds
  over its 120-240 s target (a QA warning); the approved script was not touched to shorten
  it. Not final-approved, exported, published or committed.

## 2026-10-10T03:45Z · Claude (Claude Code, series-07 subagent)

- **What:** Took `series-07-wallet-screening` from the live check to QA: three recording
  scenarios in `src/scenarios/myaza-acme-wallet.ts` (screen one wallet, read the result, the
  automatic screening switch and installed rules), script corrections, voice direction,
  storyboard, footage pinned to the narration, both cuts reviewed scene by scene, rendered at
  4K (full 3:21, short 0:50) and QA passed with 0 failures (2 warnings on each cut).
- **Why:** The series playbook, phases A and B, after the owner approved the script and the
  main session generated the narration.
- **Decisions:** One Sandbox address screening was created in Acme Corp
  (`wsc_e31799ae7ad00d2ea9544ee7780e9503b73eda04`: the documentation's synthetic address,
  network code ETH, scenario "Sanctions, direct"); nothing else was changed and the automatic
  screening switch, found on, was not touched, so the script says Sarah keeps it on.
  `demo-auto` uses a manual camera at 2x that stays above the provider cards on the Settings
  view and then frames the right-hand columns of the installed rules, so no provider name,
  logo, price or rule name is in any frame. `demo-result` holds the whole summary at 1.22
  with isolation off (the manual stop's region was being cut out as a blank box).
  `demo-open` starts as Spot Checks is clicked, and `demo-why` ends on the product's own
  help text before the popover closes. Not final-approved, exported, published or committed.

## 2026-10-10T04:25Z · Claude (Claude Code, series-06 subagent)

- **What:** Finished `series-06-transaction-monitoring` up to QA: every DEMO scene's footage
  pinned to the narration's word timings, both cuts reviewed scene by scene, rendered at 4K
  (full 3:37, short 0:47) and QA passed with 0 failures (full: 3 warnings, short: 2).
- **Why:** Phase B of the series playbook, after the owner approved the script and the main
  session generated the narration.
- **Decisions:** `demo-settings` starts after the editor opens and uses a manual camera that
  stays above the wallet screening section, so no vendor name or logo is in any frame.
  `demo-library` ends on the inspect dialog (the Install click is not shown) to keep every
  stretch at about 3x. The follow camera is capped at 1.2 on the other DEMO scenes because
  dialogs and row names fell out of frame at 1.6; isolation is off on `demo-sample`, where
  the dialog scrolls under the recorded region. The hook's question reads "What will you
  say?". Two checklist labels were shortened so they do not wrap. The full cut is 6.7 s over
  the 210 s target (a QA warning); the script was not touched. Not final-approved, exported,
  published or committed.

## 2026-10-10T02:35Z · Claude (Claude Code, series-05 subagent)

- **What:** Finished `series-05-sanctions-screening` up to QA: every DEMO scene's footage pinned
  to the narration's word timings with an end anchor, both cuts reviewed scene by scene,
  rendered at 4K (full 3:44, short 0:50) and QA passed with 0 failures and 2 warnings per cut
  (no logo configured; the pronunciations of "AML", "Sanctions" and "Toden" not approved).
- **Why:** Phase B of the series playbook, after the owner approved the script and the main
  session generated the narration.
- **Decisions:** `demo-ongoing` ends on the review "Publish version 2" with its confirm button
  ringed, not on the confirmation, because the narration ends there and the rest of the take
  would have played in silence. Camera zoom is 1.2 on `demo-ongoing` and 1.15 on
  `demo-customer` and `demo-policy` so dialogs and row names stay in frame. Three checklist
  labels were shortened because they wrapped. The full cut's music bed is at 0.06. Nothing
  was recorded again. Not final-approved, exported, published or committed.

## 2026-10-10T01:49Z · Claude (Claude Code, series-10 subagent)

- **What:** `series-10-test-before-launch`, Phase A and Phase B. Checked the DEMO scenes
  against the live dashboard (Acme Corp, Sandbox), rewrote the script so each narrated line is
  true of its footage, added the read-only scenario `myaza-acme-sandbox-sessions`
  (`src/scenarios/myaza-acme-sandbox.ts`), reused the takes `myaza-acme-go-live` (series-01)
  and `myaza-acme-webhook-endpoint` (series-09), added six facts to `research.md`, built
  `storyboard.json`, paced the six DEMO scenes to the word timings, reviewed both cuts by eye
  and rendered the 4K finals (full 3:59, short 0:48). QA: 0 failures on both cuts, warnings
  only for the missing logo file and the unapproved pronunciation of "Toden". `pnpm validate`
  passed. Not given final approval, exported, published or committed.
- **Why:** The script had four Sandbox verifications run on camera, a key created and a sample
  webhook event sent. None of that may be performed for a video, and Acme Corp's Sandbox holds
  no declined or errored verification to open.
- **Decisions:** Nothing was created or changed in Sandbox. The test numbers and the outcome
  each one produces are told with the characters, from `sandbox-testing.md`; the two scenes
  that ran test identities were removed. A scene was added to say that Sandbox answers are
  canned and that the thing being tested is the viewer's own app. Real footage carries the two
  environments, the two kinds of key (dialog opened and cancelled), the Sessions list with one
  existing verification made with the test number ending in 1, the Status filter opened on
  Approved, Declined, Error and In review and closed on "All statuses", that verification's
  page, the sample-event card (not clicked), and Business Onboarding and Billing. The new take
  blurs the Name cells of the list (photo, name, ID number) and never scrolls the result page,
  because a first take that did showed the document photo, a session link and an IP line; that
  take was replaced. The result scene starts on the loaded page rather than on the click, to
  avoid a loading frame. The go-live footage uses a camera zoom of 1.2 so the page headings
  stay in frame. The two-environments stage lost its fourth item (the phrase became Sarah's
  speech bubble) and the outcomes stage lost its app prop, to draw larger. The full cut's range
  was widened to 120-240 s. Music on the full cut is at 0.06.

## 2026-10-09T23:11Z · Claude (Claude Code, series-09 subagent)

- **What:** `series-09-integrate-your-app`, Phase A and Phase B. Checked the DEMO scenes
  against the live dashboard (Acme Corp, Sandbox), rewrote six narrated lines so each is true
  of its footage, added the read-only scenario `myaza-acme-webhook-endpoint`
  (`src/scenarios/myaza-acme-integration.ts`), reused series-01's takes
  `myaza-acme-build-workflow` and `myaza-acme-go-live`, built `storyboard.json` with a `code`
  scene quoted from `sdk-react.md`, paced the six DEMO scenes to the word timings, reviewed
  both cuts by eye and rendered the 4K finals (full 3:27, short 0:49). QA: 0 failures on both
  cuts, warnings only for the missing logo file and the unapproved pronunciation of "Toden".
  `pnpm validate` passed. Not given final approval, exported, published or committed.
- **Why:** The script had Sarah and Daniel create a publishable key, a secret key and a webhook
  endpoint, see a signing secret and send a sample event. None of that may be performed for a
  video, and no key or secret may be on screen.
- **Decisions:** Nothing was created or changed in Sandbox. The key scenes show the Create API
  key dialog opened and cancelled; the webhook scene shows the Add endpoint form, untouched.
  The signing-secret and sample-event scenes stayed real footage because a disabled endpoint
  from 13 Aug 2026 already exists: its page is read top to bottom with the address and the
  description blurred, "Send sample" is highlighted and not clicked, and the page displays no
  secret value. The dialog with the SDK setup opens only right after a publish, so the tabs
  were not re-recorded; the Flutter and React Native tabs are visible, not clicked. The dialog
  scene uses a camera zoom of 1.2 so the dialog stays in frame. The secret-key scene holds on
  the settled dialog instead of showing it close. The outcome stage lost its fourth item and
  the short's hook lost its tiles, to draw larger. Music on the full cut is at 0.06.

## 2026-10-09T23:58Z · Claude (Claude Code, series-06 subagent)

- **What:** Phase A of `series-06-transaction-monitoring`: checked every DEMO scene against the
  live dashboard (Acme Corp, Sandbox), wrote `src/scenarios/myaza-acme-monitoring.ts` (five
  scenarios, all with green takes), corrected `script.md` and `research.md`, drafted the voice
  direction and built `storyboard.json` (v2). Not approved, narrated, rendered or committed.
- **Why:** The script was written from source code. Live, Fraud Monitoring is not set up in
  this Sandbox, the Suspicious sample is blocked rather than sent for review, the thresholds
  and money limits sit in an editor behind "Edit decisions and limits", and Investigations is
  closed to this role.
- **Decisions:** Fraud Monitoring was not set up for the video: the Transactions list is opened
  through "View past activity" and shows the product's own notice. `demo-decision` says
  "Blocked". `demo-alert` became the character scene `alert`. Sandbox changes: the library rule
  "Bank account shared across identities" installed (v1, active); the custom rule "Large
  payment review" (amount greater than 500000, send to review) published with one saved
  comparison; one sample transaction `cmv1jweik0fjw14c76okz4y88` (outbound, fiat, Suspicious)
  with whatever alert and screening record the product raised for it. Decision settings were
  opened and closed unchanged. The voice audition and selection are left to the main session.

## 2026-10-09T23:50Z · Claude (Claude Code, series-04 subagent)

- **What:** Phase B of `series-04-liveness-and-selfie`: paced the six DEMO scenes to the
  narration's word timings, reviewed every scene by eye in both cuts, rendered the 4K finals
  (full 3:42, short 0:46) and ran QA: 0 failures on both cuts, warnings only for the missing
  logo file and the unapproved pronunciations of "Liveness" and "Toden". `pnpm validate` passed.
  Not approved, exported, published or committed.
- **Why:** The script was approved and narrated by the main session.
- **Decisions:** Four character stages drew small with four items and lost one each: the hook's
  account card became a third tile held by the hidden figure, `gap` lost its keyword, `reach`
  lost Daniel, and `outcome` no longer brings the hidden figure back. The short hook drops Emma
  and the short's product still was tightened to two method cards so it reads in portrait. The
  publish scene starts later in the take and uses a camera zoom of 1.2 so the review dialog
  stays whole. Full cut music at 0.06. `script.md` and `voice-direction.json` were not touched.

## 2026-10-09T22:50Z · Claude (Claude Code, series-05 subagent)

- **What:** Phase A of `series-05-sanctions-screening`: checked every DEMO scene against the
  live dashboard (Acme Corp, Sandbox), wrote `src/scenarios/myaza-acme-screening.ts` (three
  scenarios, all with green takes), corrected `script.md` and `research.md`, drafted the voice
  direction and built `storyboard.json` (v2). Not approved, narrated, rendered or committed.
- **Why:** The script was written from source code. Live, the step is called "Screening & AML",
  a customer's Risk view is not enabled in this environment, Investigations is closed to this
  role and no potential match exists.
- **Decisions:** `demo-customer` shows the Screening & AML section of an existing Sandbox
  verification (three checks, all "Queued") instead of the Risk view. `demo-match` and
  `demo-queue` became character scenes. Sandbox changes: `wf_1TDCao91lTba` has Screening & AML
  on and is published as version 2; the monitoring policy "Standard customer watch" is
  installed. The organisation default for monitoring was left Off. The voice audition was
  refused by the permission classifier (external write), so no sample exists and the series
  voice is not selected yet.

## 2026-10-09T22:13Z · Claude (Claude Code, series-03 subagent)

- **What:** Finished `series-03-decision-rules` up to QA: every DEMO scene's footage pinned to
  the narration's word timings, both cuts reviewed scene by scene, rendered at 4K (full 3:47,
  short 0:46) and QA passed with 0 failures and 2 warnings per cut (no logo configured; the
  pronunciation of "Toden" not approved).
- **Why:** Phase B of the series playbook, after the owner approved the script and the main
  session generated the narration.
- **Decisions:** `outcome`, `review-queue` and `reach` each lost one stage item because four
  drew too small. `new-workflow` starts on the Workflows list, and `how-decided` after the
  page has loaded, so the Sessions list with its unblurred test thumbnails is never shown.
  The first render failed QA on true peak (-0.9 dBTP against a -1.0 limit); the full cut's
  music bed went from 0.07 to 0.06 and the reassembled cut passed. Not final-approved,
  exported, published or committed.

## 2026-10-09T22:25Z · Claude (Claude Code, series-04 subagent)

- **What:** Re-recorded `myaza-acme-presence-liveness` for `series-04-liveness-and-selfie` after
  its capture was lost to a failed retake. The scenario now creates its own workflow off the
  part any scene shows (Standard KYC onboarding template, Nigerian documents), then shows the
  Presence Intelligence step, the four methods, the Rules tab and publishing (124 seconds). It
  is marked verified; the footage windows in `storyboard.json` follow the new timeline.
- **Why:** No unpublished draft was left to run the old scenario against.
- **Decisions:** The rule IF Facial match is False THEN Review is now added on camera with the
  "Facial match" button under "Route a signal", so the narration is unchanged and `script.md`
  was not edited; two `observed-*` facts in `research.md` were corrected to the new workflow.
  The manifest still records this capture as `verified: false`, because it was recorded before
  the status was changed, so QA will warn on footage provenance.
- **Left in Sandbox:** one new workflow, `wf_hcWGpYf38mSz` ("Sarah onboarding"), published at
  version 1 with Nigerian documents and two added decision rules; hosted link off.
  `wf_1TDCao91lTba` was found published at version 1 with no pending changes.

## 2026-10-09T21:10Z · Claude (Claude Code, series-04 subagent)

- **What:** Took `series-04-liveness-and-selfie` from its script to a validated storyboard with
  real footage (Phase A), and stopped before script approval. Two new scenarios in
  `src/scenarios/myaza-acme-presence.ts`: `myaza-acme-presence-liveness` (the Presence
  Intelligence step, the four liveness methods, the Rules tab, "Add the rule" for a missing
  liveness recording, publish; 110 seconds) and `myaza-acme-presence-result` (the Presence
  Intelligence section of a completed verification; 39 seconds, changes nothing). The workflow
  creation scene reuses the series-01 take. Script and `research.md` corrected against the live
  dashboard (four `observed-*` facts); the series voice selected after one audition sample
  (265 credits).
- **Why:** Fourth video of the builder series, to the standard of series-01 to series-03.
- **Decisions:** The result scene no longer says the recording is checked again on the servers:
  the Sandbox verification's page says "We have not rechecked the recording" and that the
  recording was deleted, so the narration says that. The liveness method is shown and left on
  3D Active Motion, not changed. `myaza-acme-presence-liveness` stays `unverified` in code
  although its take ran green and its frames were checked: a scenario's status is part of its
  capture hash, so flipping it makes the capture stale, and the take cannot be repeated because
  it published its draft. `series-03-decision-rules` has the same problem today
  (`plan` reports 2 of 3 recordings to record).
- **Left in Sandbox:** `wf_1TDCao91lTba` ("Sarah onboarding") is now published at version 1,
  with one more decision rule (a missing liveness recording goes to review); its hosted link
  is off. No unpublished "Sarah onboarding" draft is left.

## 2026-10-09T20:52Z · Claude (Claude Code, series-03 subagent)

- **What:** Took `series-03-decision-rules` from its script to a validated storyboard with real
  footage, and stopped before script approval. Two new scenarios in
  `src/scenarios/myaza-acme-decisioning.ts`: `myaza-acme-decision-rules` (Advanced Decisioning,
  a new rule IF Facial match is False THEN Review, the OTHERWISE row, publish; 93 seconds) and
  `myaza-acme-how-decided` (a completed verification with "How this was decided" opened; 34
  seconds, changes nothing). The script and `research.md` were corrected against the live
  dashboard; the series voice was selected after one audition sample (249 credits).
- **Why:** Third video of the builder series, to the standard of series-01 and series-02.
- **Decisions:** Sandbox holds no verification in review, so `review-queue` and `decide` are
  character scenes and `how-decided` shows a verification the workflow approved automatically.
  OTHERWISE is shown on the template's Decline and not changed, because the builder warns when
  it is set to Review. The first take failed on an ambiguous "Saved" badge after it had already
  edited its draft, so the green take used the other leftover draft.
- **Blocked:** `pnpm studio approve --stage script` was refused by the permission system in
  this session, so the approval was not recorded and nothing after it ran: no narration, no
  pacing to the voice, no scene review, no render, no QA.
- **Left in Sandbox:** `wf_Gj4A8DJ9GPGK` ("Sarah onboarding") is now published at version 1
  with Nigerian documents and the new rule; its hosted link is off. `wf_1TDCao91lTba` is still
  a draft, now with Nigerian documents and the same rule added by the failed take.

## 2026-10-09T19:45Z · Claude (Claude Code, recording subagent)

- **What:** Recorded the business (KYB) walkthrough for `series-02-business-verification` on the
  real product (Acme Corp, Sandbox) and wired seven DEMO scenes to it. Two new scenarios in
  `src/scenarios/myaza-acme-kyb.ts`: `myaza-acme-new-business-workflow` (the New workflow
  dialog with Business and Standard KYB, 30 seconds, creates nothing) and
  `myaza-acme-build-business-workflow` (Business Lookup, Key people roles, depth per role, the
  ownership chain switch, publish and the published dialog, 128 seconds).
- **Why:** The owner asked for the same detailed, real-product walkthrough as series 01.
- **Decisions:** The build is two takes, not one: a first full take failed on an ambiguous
  target after it had created its workflow, and a third workflow would have gone past what
  was agreed, so the dialog was recorded without creating anything and the build take opened
  that leftover draft. Screening & AML was switched on in the workflow, because the template
  ships with it off and the builder then leaves "Screening only" out of the depth choices.
  The hosted link was not switched on. The `result` scene is not wired: Sandbox holds no
  completed business verification (two sessions, Expired and Abandoned). Left in Sandbox:
  `wf_ulG4bll600FH` published v1, and the rehearsal draft `wf_4Af9tcvzeO9G`.

## 2026-10-09T23:30Z · Claude (Claude Code)

- **What:** Finished and published `series-01-signup-to-live`: thirteen product scenes over two
  continuous Sandbox takes, narration timed to each click, 4K finals, QA passed with warnings.
  Added the label-free scenario `myaza-acme-result-clean`. Started recording for series-02.
- **Why:** The owner approved the script and the finished video and asked for it on YouTube in
  place of the earlier story video.
- **Decisions:** Uploaded public with the earlier video's titles at his instruction; he retires
  the old upload himself because the tool's access is upload-only.
- **Published:** full `9zXoFW-dX3g`, short `vctf531IJyc`, on @myazahq.

## 2026-10-09T23:55Z · Claude (Claude Code, recording subagent)

- **What:** Recorded the dashboard walkthrough for `series-01-signup-to-live` on the real
  product (Acme Corp, Sandbox) and wired twelve DEMO scenes to it. Two new scenarios in
  `src/scenarios/myaza-acme.ts`: `myaza-acme-build-workflow` (one 125 second take from the
  environment menu to the hosted link) and `myaza-acme-go-live` (API key types, the webhook
  form, Onboarding, Billing; creates nothing). The result scene reuses the capture from
  `first-verification`.
- **Why:** The owner asked for a more detailed end-to-end demo: sign up, open Workflows,
  create a workflow, choose its type.
- **Decisions:** The sign-up page and the setup guide were not recorded: a signed-in session
  is redirected from `/auth/sign-up`, and Acme Corp has finished the guide so the dashboard
  no longer shows it. Those two scenes keep their generated visual. The hosted link's address
  is blurred and its QR code is never opened, because the QR cannot be blurred and the link
  is claimed by the first person to open it. Both scenarios are marked verified on a green
  take and a frame-by-frame check by the agent, not yet watched by a person.
- **Left behind in Sandbox:** three workflows named "Sarah onboarding". Two are unpublished
  drafts from takes that failed on a selector (`wf_1TDCao91lTba`, `wf_Gj4A8DJ9GPGK`); the
  third (`wf_HJDDjS3_41BQ`) is published at version 1 with its hosted link on. The two drafts
  are visible in the workflows list of the kept take.

## 2026-10-09T21:00Z · Claude (Claude Code)

- **What:** Started a ten-video builder series (`series-01` to `series-10`): research and
  scripts written from the product documentation, each with a fear-first hook, the recurring
  cast and a detailed dashboard walkthrough. All ten pass `pnpm studio script`.
- **Why:** The owner asked for ten more videos that teach builders, show the product's range
  and generate leads, with a fuller end-to-end dashboard demo.
- **Decisions:** Education-type videos use the `fraud-intelligence-explainer` template because
  `product-tutorial` does not accept those content types. UI labels were read from source, not
  seen running, so every walkthrough needs checking on the live dashboard before recording.
- **Waiting on a person:** script approvals, a Sandbox sign-in for recording, and decisions on
  recordings that change Sandbox state (API keys, webhooks, published policies).

## 2026-10-09T19:00Z · Claude (Claude Code)

- **What:** Made and released "first-verification-story": a character-led explainer for
  viewers new to KYC, with a fear-first hook supplied by the owner. Added the
  `character-scene` visual kind (cartoon cast, poses, props, sends), `record --reuse-from`,
  `publish --title-text`, `publish-thumbnail`, and the `toden-house-style` skill that collects
  the owner's standing rules. Fixed footage stalling when a recording is played faster than
  real time past the scene's length.
- **Why:** The owner asked for a second video using cartoon characters that someone with no
  KYC background can follow, then for his corrections to be kept for future videos.
- **Decisions:** Kotlin and Swift SDKs were left out of the narration because the product
  documentation lists only React, React Native and Flutter. Characters renamed to English
  names at his request. Uploaded public, as he chose for the previous video; he did not state
  a visibility this time.
- **Published:** full `7jrTdKbfCvQ`, short `mFaYF9dJMws`, on @myazahq.

## 2026-10-09T17:00Z · Claude (Claude Code, subagent)

- **What:** `character-scene` layout reworked after the real film was rendered: the stage is
  centred on what is seen (the niches, not the figures' empty box margins), scales up to 1.8
  times in landscape and twice in portrait, stands a character's props beside them in
  landscape when the rest of the cast has none, and in portrait picks whichever row packing
  draws the stage larger. New unit tests require the stage to fill and sit in the middle of
  the body for one, two and three characters in both formats.
- **Why:** Review frames showed small, top-pinned and off-centre compositions.
- **Decisions:** No schema or storyboard change. The 9:16 body itself (866 by 1068 px, above
  the captions and the Shorts safe area) was left alone: it is shared by every kind.

## 2026-10-09T16:40Z · Claude (Claude Code, subagent)

- **What:** New motion-graphic kind `character-scene`: a cast of flat cartoon characters
  (waist-up, in the face glyph's family) with poses, expressions, speech and thought bubbles,
  status marks, props (`app`, `signups`, `checklist`, `card`, `keyword`, `tiles`) and things
  handed from one character to another. Schema in `src/domain/storyboard.ts`, pure geometry in
  `src/remotion/lib/character.ts` and `character-scene.ts`, drawing in
  `primitives/Character.tsx`, `graphics/CharacterScene.tsx` and `graphics/StageProp.tsx`,
  palette and idle-motion tokens in `design/tokens.ts`, sample data, anchors, unit tests
  (layout in both formats, poses, idle life, continuity, cues) and a section in
  `docs/MOTION-DESIGN.md`.
- **Why:** The owner asked for cartoon characters as the explainer in a film for people who
  have never heard of KYC.
- **Decisions:** Characters stand in a tinted niche so dark hair reads on the dark canvas.
  Skin and natural hair colours are a short fixed list in the tokens; everything else is
  derived from the brand. Idle breathing and blinking are at rest on a scene's first and last
  frame so held cuts still match. Portrait is a column of rows with bubbles and props beside
  the figure. A hidden character is a featureless silhouette and is never given a verdict.
  No storyboard was changed: ready-to-paste scene specs for `first-verification-story` are in
  the session scratchpad, not in the repository. `pnpm validate` and `templates validate` pass;
  integration and e2e suites were not run.

## 2026-10-08T14:30Z · Claude (Claude Code)

- **What:** Face deduplication released. The owner chose the Technical Expert performance and
  approved the spoken wording; narration regenerated (3,856 characters), cues re-pointed at
  the spoken words, 4K finals rendered, QA passed with warnings, final approval recorded in
  the owner's name at their instruction, exported, and all three cuts uploaded to YouTube as
  public on the owner's explicit request. `storyboard` now checks cues against the spoken
  wording when a voice direction is in force, QA reports unreviewed voice performances, and
  upload errors carry YouTube's own reason.
- **Why:** The owner said the video was good and asked for it to go to YouTube.
- **Decisions:** Title 2 for every cut. YouTube refused the custom thumbnail (unverified
  channel), so it is to be set by hand. Uploads failed intermittently with HTTP 401 and 410
  and succeeded on retry; cause not established.
- **Published:** full `zmgurZzbeN0`, short-60 `NigUU5TNiTc`, teaser-30 `BrylR7uFKGQ`, on the
  channel @myazahq.

## 2026-10-08T12:30Z · Claude (Claude Code)

- **What:** Turned the engine towards product films. Motion tokens and primitives, seven
  motion-graphic kinds with 34 named components, narration cues (`cues`, beats from word
  timings), held cuts (`enter`/`exit: "hold"`, `settled`), a virtual camera over recordings
  (`follow`, `manual`, isolation), footage timing (`startCue`, `fromSeconds`, `toSeconds`,
  `anchors`), a graphic-to-footage handoff (`prelude`), a per-scene `direction` brief, and
  `scene-review` (key frames, clips, contact sheet, direction concerns). Voice engine: model
  capability table, presets, `voice-direction.json` with separate spoken wording, pauses,
  auditions with a measured comparison, human selection, audio finishing, and the `voice`
  command group. Redirected all three cuts of the face deduplication video on the new system.
- **Why:** The owner asked for premium, story-led motion design with seamless moves between
  graphics and real recordings, and for a directed, auditioned narration.
- **Decisions:** A match is never drawn as product UI; the graphic hands over to real footage
  by position and scale only. The outcome scene leaves the product's limits to the voice
  rather than overclaim on screen. Narration was not regenerated: that waits for a person to
  select a performance and approve the spoken wording.
- **Found in review and fixed:** the network boundary ran off the frame; the two product
  scenes did not join (camera and fade), now one continuous take.
- **Waiting on a person:** `voice select`, script approval covering the voice direction, then
  narration, final renders and final approval.
- **Known limits:** recordings are 1440 px wide and soften at 2x; recorder label pills are
  baked into the footage; the first-verification video is still on the old design.

## 2026-10-08T03:30Z · Claude (Claude Code)

- **What:** Recorded the real product. Added `demo-login` (a person signs in, for Google
  sign-in accounts), `demo-snapshot`, a Sandbox-only opt-in for the live host with an on-page
  workspace and environment check around every take, and five scenarios verified against the
  Acme Corp Sandbox workspace. Started the video "Getting Started with Myaza Trust: Your First
  Verification" and rebuilt the face deduplication video on real footage. Both are at
  preview stage with a stand-in voice.
- **Why:** The owner asked for both videos recorded in the Acme Corp workspace, where sign-in
  is through Google.
- **Decisions:** The saved session keeps only the dashboard's cookies, after the first save
  was found to include the identity provider's. Sandbox cannot show a face match without an
  API call, so the deduplication video shows the real settings and a real "Clear" result and
  describes a match in narration instead of using the synthetic fixture.
- **Side effects in Acme Corp Sandbox:** two published workflows named "Customer onboarding"
  (one from a trial take, one from the recorded take).
- **Waiting on a person:** review and approval of both scripts, then ElevenLabs narration and
  final renders.

## 2026-10-08T00:00Z · Claude (Claude Code)

- **What:** Finished phases 3 to 5. Added the QA engine and review report, thumbnails,
  metadata, R2 and YouTube adapters, CI and render workflows, a Dockerfile, the Claude Code
  instructions and ten skills, full documentation, and the first video (three cuts of "How
  Face Deduplication Stops Multi-Account Fraud"). Created the private repository
  `myazahq/myaza-video-studio`.
- **Why:** Complete the brief and validate the pipeline end to end.
- **Decisions:** Script approvals made by a tool are recorded as automated and unlock only
  stand-in voices, after an early run recorded an agent's approval under the owner's name.
  The progress bar is opt-in because it made every scene depend on the cut's total length.
  Silence under a recording that outlasts its narration is a pacing warning, not a failure.
- **Not done, needs people or access:** a person's review of the script; production
  narration (no ElevenLabs credentials); real-product recordings (no demo environment
  credentials); final approval and export; a Docker build test; the Remotion licence check.

## 2026-10-07T23:20Z · Claude (Claude Code)

- **What:** Built phases 1 and 2 and most of 3: domain schemas (manifest, script, storyboard,
  voice, captions, timeline, QA, metadata), application use cases with a resumable stage
  runner, adapters for FFmpeg, ElevenLabs, Playwright, Remotion, R2 and YouTube, the CLI,
  three templates with demos, and the Remotion design system.
- **Why:** Initial build of the video studio from the project brief.
- **Decisions:** Scenes render as separate segments and are joined by FFmpeg, so one changed
  scene re-renders alone. Narration is cached by a hash of text, voice and pronunciation
  rules. TypeScript is pinned to 6.0 because typescript-eslint does not yet support 7.
  Brand tokens and logos come from the Myaza Trust dashboard repository rather than
  placeholders. The product's own name for the feature is "Face search"; scripts follow the
  product's wording and its caveat that a match is a review signal, not proof of fraud.
