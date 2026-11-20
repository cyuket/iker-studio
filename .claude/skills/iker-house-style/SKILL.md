---
name: iker-house-style
description: >-
  The standing rules for every Iker video: brand naming, the concrete-pain hook and outcome
  ending, writing for Nigerian service-business owners in plain English, Naira formatting,
  visual taste, voice and music choices, recording constraints, and how approvals and publishing
  are handled. Read it before writing a script, directing a storyboard, choosing a voice or
  publishing, and whenever starting a new video. Record corrections the owner gives here, so they
  are not repeated.
argument-hint: "[video-id]"
---

# Iker house style

The rules every Iker video follows unless the owner says otherwise. They come from the
product's own documents in the `slot-books` repository (`PRODUCT.md`, `docs/Iker_PRD.md`), the
Iker brand kit, and the studio's working rules. No Iker video has been reviewed by the owner
yet, so nothing below is a quoted owner correction. When the owner corrects something, add it
here with the date and his words, and mark any line that is your own reading as
"interpretation".

This skill does not replace the stage skills (`researcher`, `technical-scriptwriter`,
`storyboard-designer`, `elevenlabs-voice-director`, `video-editor`, `video-director`). It is
what they must all respect. `CLAUDE.md` still wins on anything about safety, facts and
approvals.

## 1. Brand

- The product is **Iker**. The address is **useiker.com**. The tagline is **"Get booked. Get
  paid."** The narrator says "Iker".
- Logos are in `brand/logo/` (from the Iker brand kit): `iker-wordmark-on-dark.svg`,
  `iker-horizontal-on-dark.svg` and `iker-emblem-color.svg` suit the dark video canvas. Pick a
  logo by the background it sits on; on terracotta or photos use a white version.
- Colours: Cast Iron Obsidian `#121518` is the video background; Primary Terracotta `#E05A38`
  is the one accent. Deep Palm Slate `#2C3E35` and Warm Canvas `#F9F6F0` are supporting
  grounds. One deliberate accent, not a palette of them. All values come from
  `brand/brand.json` and `brand/tokens/`; never type a hex value into a scene.
- Type: Plus Jakarta Sans for headings and body, JetBrains Mono only where code or a reference
  number is shown.
- Personality: trustworthy, calm, efficient. This is a bookkeeping tool that handles people's
  income records, so it reads as careful and precise, never flashy or playful. Restraint
  signals competence.
- Recorded product screens show the web app's own styling, which differs from the brand kit.
  Leave it; do not repaint recorded UI.
- Call to action: the agreed wording has not been set. Until it is, end on "useiker.com" and
  the tagline. Do not say "free" or quote a plan or price unless `knowledge/product-facts.md`
  has a sourced fact for it and the owner has approved the wording.

## 2. The hook: lead with a concrete pain, end with the outcome

- Open in second person on a real, everyday problem the viewer already has: chasing who has
  paid a deposit through WhatsApp and Instagram DMs, replying "are you free on Saturday?" all
  day, a double-booked slot, a cash payment from a walk-in that never got written down, not
  knowing at month end whether the business made a profit. These come from the personas and
  problem statement in `docs/Iker_PRD.md`; use them because they are true, not because they are
  dramatic.
- Make it concrete: a person, a message thread, a notebook, an amount in Naira. Then ask the
  question the video answers.

  > A client says she sent the ₦15,000 deposit last night. You scroll back through three
  > WhatsApp chats and can't find it.
  >
  > How do you know, today, who has paid and who still owes you?

  (Illustrative amounts only. Never present an example amount as a price Iker or anyone
  charges.)

- The last scene before the call to action answers the hook's question with what the viewer
  now has: one place that shows who booked, who paid and what is still owed. Do not close on a
  feature recap.
- Never fear-monger. No "you are losing money every day", no invented statistics, no claim
  that Iker stops no-shows, fraud or late payment. Iker records payments; it does not collect
  them automatically, and reminders by SMS or WhatsApp are not shipped. The pain is the
  viewer's situation; the outcome is what the product actually does.

## 3. Story and audience

- The viewer is a Nigerian service-business owner or staff member: a salon, a makeup artist, a
  photographer, a tutor, a tailor, a personal trainer. Some work alone (the PRD's main persona
  is a solo makeup artist), and the product is built to work on average connections. Write for
  someone who has never used booking or bookkeeping software.
- Plain English. Short sentences. Earn each term before using it: "proof of payment",
  "walk-in", "statement of account" are Iker's words, so show what each means the first time.
  No jargon such as "reconciliation", "ledger" or "CRM" in narration.
- Money is written and spoken in Naira: `₦45,000` on screen (symbol, no space, comma
  thousands, no kobo unless the amount has kobo), "forty-five thousand naira" when spoken.
  Example amounts must look like the seeded demo data or be clearly illustrative. Never invent
  Iker's prices, plan limits or customer numbers.
- Characters, when used, are Nigerian names that match the setting. The PRD personas are Amaka
  (a makeup artist in Abuja), Tunde (a client), Ifeoma (Platform Admin) and Femi (Super Admin);
  use them or similar names. Keep the cast's appearance varied and respectful.
- Roles must be shown correctly. A Client books from a public link and uploads proof of
  payment. The Business owner or staff confirms bookings, records payments and expenses and
  sees reports. Platform Admin and Super Admin manage business accounts and **never see a
  business's income, expenses or statements**. Never draw or record an admin screen that shows
  a business's money.
- Show only what is shipped. As of the PRD's implementation status (§15, 2026-08-29), Google
  Calendar sync, quarterly and yearly reports, downloadable PDF statements, customer email
  campaigns, automated deposit collection and SMS/WhatsApp reminders are **not** shipped.
  Check `knowledge/product-facts.md` for the current list before every script.

## 4. Visual taste

- No small uppercase labels above headings (eyebrows, kickers, chapter numbers). They make a
  frame look generated, not designed.
- Every animation has to communicate something the narration is saying at that moment. Tie
  visuals to the words with `cues`.
- Graphics and real footage should flow into each other: held cuts, a graphic that hands over
  to the recording, a camera that follows the action.
- Never draw product interface that does not exist. Illustrations must not look like the
  dashboard.
- Use real photos (`photo` scenes, from `assets/images/`) where they are needed, not only
  illustrations: to show the viewer's own world (their chair, their client, their phone, their
  cash) so the pain feels real. Usually one to three photo scenes in a long cut, one in a short,
  most often in the hook and setup. The owner's own photos (`own-*`) come first. Stock models
  are never presented as Iker customers, and no photo stands in for the product.
- The brand kit's tile pair (appointment tile, ledger tile, booking dot) is texture for edges,
  never behind text.
- Before showing the owner anything, run `pnpm studio scene-review --video <id>`, open the
  frames and fix what is wrong. Rendering without errors is not a review.

## 5. Voice

- ElevenLabs, with the voice and model set in `.env` (`ELEVENLABS_VOICE_ID`,
  `ELEVENLABS_MODEL_ID`). That voice is the Iker voice for every video. Create videos with
  `--voice-provider elevenlabs` and never pass `--voice-id` or switch voices unless the owner asks
  for a different voice in the conversation. Auditions compare performances (presets) of that same
  voice, never other voices. Full narration still waits for the owner's script approval.
- Calm, warm and clear, like a competent friend explaining their own system. Not an announcer.
  Check how "Iker" and "naira" are spoken with `pnpm studio preview-voice` and record the
  result with `pnpm studio pronunciation`.
- Auditions are an HTML page. The owner cannot listen inside the editor: open it with
  `open <path>` and say so.
- Check the drafted spoken wording by hand. The drafting step can produce wrong contractions.

## 6. Music

- A chill royalty-free bed, about 12 dB under the voice (volume about 0.08), only with a licence
  you can state in `storyboard.json`. Tracks and their terms are listed in
  `assets/music/README.md`. A CC BY track also needs `music.credit`, which export prints in the
  description and long captions.
- If the track is Content ID registered, warn the owner that a claim may appear after upload.
  Kevin MacLeod's incompetech tracks are pre-registered.
- Every cut of every video gets a music bed from `assets/music/` unless the owner says
  otherwise. Pick by mood from `assets/music/README.md`: chill or lo-fi for tutorials and
  explainers, upbeat for shorts and announcements. Prefer the Mixkit tracks (no credit needed);
  a Kevin MacLeod track needs `music.credit`.
- Sound effects from `assets/sfx/` go on a scene's cues with `sounds`. `assets/sfx/README.md`
  lists every file by use and licence (CC0 interface sounds, Mixkit sounds, generated phone
  vibrations). A pop or bubble for a chat message, a notification for a phone, a chime for a
  confirmation, a thud for a stamp, a whoosh for a reveal or transition, typing for text being
  entered, a hit or riser for a hook. Every visible action has a sound: a click, a tap, typing,
  a message arriving, a status changing. Recorded product footage gets its click, typing and
  scroll sounds automatically; motion graphics and photo scenes get theirs on cues. Volume 0.3
  to 0.6, up to 8 per scene.
- Only files in `assets/music/`, `assets/sfx/` and `assets/images/` are used. Never add a sound,
  track or photo without a licence recorded in that folder's README. Photos may be downloaded
  when none fits (Pexels or Unsplash, following "Adding a photo" in `assets/images/README.md`).

## 7. Recording

- Never record useiker.com or any of its subdomains. The recorder refuses them. Iker has no
  Sandbox mode, so record a local copy of the web app (`http://localhost:3000` from the
  `slot-books` repository with seeded demo data) or a staging host.
- Record only an environment that holds demo data and nothing else: the recorder does no
  on-page business check, so the host is the only guard. Demo clients, phone numbers, emails
  and proof-of-payment images must be demo data, never a real person's.
- Never bypass sign-in or bot checks. For accounts that do not sign in with a password, the owner signs in
  with `pnpm studio demo-login`.
- Reuse existing captures where the flow is the same:
  `pnpm studio record --video <id> --reuse-from <other-video>`.
- Synthetic footage (the bundled Demo Console fixture) is always labelled on screen and in the
  description.
- Videos stay on the local disk. Do not upload to R2 unless the owner asks.

## 8. Approvals and publishing

- Script approval and final approval are the owner's. When he gives one in conversation
  ("approved", "this is good"), record it with a `--note` that quotes him and says who recorded
  it. Editing `script.md` voids the script approval, so show the changed lines and get a new
  one.
- A go-ahead to continue is not approval of something he has not seen: a final approval needs
  finished files.
- Publish only when he asks. Ask for the cuts, the title, the visibility and the thumbnail.
  Set a thumbnail afterwards with `pnpm studio publish-thumbnail`.
- Do not commit unless he asks.

## 8a. Titles

- Full videos: the task or search term near the front, then the concrete outcome, 70
  characters or fewer ("Record a Deposit in Iker and Stop Searching Your Chats").
- Shorts: one concrete, truthful pain or result, about 40 to 55 characters ("Who Paid the
  Deposit? Stop Scrolling WhatsApp"). Direct, not alarming.
- The title must be true of the video: it shows the thing it names; no invented numbers, no
  guaranteed outcome.
- Shorts descriptions: the pain in one or two sentences, what the Short shows, "useiker.com",
  then `#Shorts`.

## 8b. Every-platform covers and captions

Apply `iker-social-publishing` before every upload or scheduled video post on YouTube, Shorts,
TikTok, Instagram, Facebook, X and LinkedIn.

- The complete selected title must be visible and readable on the actual cover. A generic
  question or a logo is insufficient. Respect an already-approved title.
- Captions start with a concrete pain the viewer recognises, say what the video shows, and
  give one action. Never invented metrics, guaranteed outcomes, false urgency or unrelated
  bait.
- Check platform crops and mobile readability against the brand kit's safe-zone guides before
  posting.
- Do not alter approved media to add a title frame without renewed QA and human final
  approval.

## 8c. Owner corrections

- 2026-11-15, on the booking-link social campaign: "the video and narrations is very slow and
  boring I want you to add a trending background and speed up the narraition to an ad speed and
  make the script jovial and engaging". For social ads this overrides the "calm, never
  playful" defaults in sections 1 and 5: write short, punchy, upbeat lines (light
  exclamations such as "Ding!", "Boom.", "Easy." are fine), narrate at speed 1.15
  (`pnpm studio narrate --speed 1.15`; he later asked for paces up to 2.0 to be allowed, and
  anything above 1.2 is a pitch-preserving FFmpeg stretch of the ElevenLabs clip, since the
  API stops at 1.2), and turn on `"background": "animated"` for each cut.
  He chose an animated visual background over a music bed. Facts, Naira formatting, no
  invented claims and no promised outcomes still apply unchanged. Whether this also applies to
  longer tutorials is not settled (interpretation: ask before applying it there).

- 2026-11-15, later the same day, superseding most of the entry above: "i want it include demo
  from the app too and the backgroud is not nice and the narraction now is fast i wan t natural
  talking and explaining voice for the demo reels should show the demo app in an iphone frame
  while in the linkedln/ facebook it can be ipad frame". So: product videos show real app
  footage (local slot-books demo data), in an iPhone frame for 9:16 reels and an iPad frame for
  16:9 LinkedIn/Facebook cuts; the animated background is off (he chose the original still
  canvas); narration is back at normal speed (1.0) and the wording is a calm, warm explainer
  with no "Ding!"/"Boom." style exclamations.

- 2026-11-20: "Now i want to add background musics and click sounds bubble sounds and
  notification sounds find nice chill background music in the internet and download including
  all the sounds". So videos now carry a chill music bed and sound effects on their key moments.
  This reverses the 2026-11-15 choice of no music bed. Music is licence-checked
  (Kevin MacLeod, CC BY 4.0, credited) and sounds are CC0. Interpretation: it applies to every
  video, long and short.

- 2026-11-20, later: "the voice selection should use the eleven laps vocie idea in the .env
  file also i added sounds and sfx all videos should have access to those resources and use
  them when need". So: every video narrates with the ElevenLabs voice in `ELEVENLABS_VOICE_ID`
  (section 5), and every video uses the music in `assets/music/` and the sounds in
  `assets/sfx/` where a moment calls for one (section 6).

- 2026-11-20, later: "Also use pictures where it necessary and not just illustrations". So
  videos mix real photos (`photo` scenes from `assets/images/`) with illustrations where a
  picture of the real world helps (section 4). The owner chose a downloaded Pexels/Unsplash
  starter set plus their own photos, which are preferred when one fits.

- 2026-11-20, later: "the should be room to download images, also when there is a typing scene
  or click button make sure it uses the sounds every actions should have sounds to make the
  video captivating". So: when no catalogued photo fits, download one under the rules in
  `assets/images/README.md`; and every visible action has a sound (section 6), automatically
  for recorded clicks, typing and scrolls.

## 9. How to report to the owner

- Lead with what is ready and where the file is. Open the file when there is something to
  watch or hear.
- Say plainly what is still weak, and what has not been run or verified.
- Keep questions to decisions only he can make, and give a recommendation with each.
