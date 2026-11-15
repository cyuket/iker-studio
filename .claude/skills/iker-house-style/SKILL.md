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
- The brand kit's tile pair (appointment tile, ledger tile, booking dot) is texture for edges,
  never behind text.
- Before showing the owner anything, run `pnpm studio scene-review --video <id>`, open the
  frames and fix what is wrong. Rendering without errors is not a review.

## 5. Voice

- ElevenLabs, model from `.env`. Audition before generating: `pnpm studio voice audition`,
  then the owner listens and picks. Full narration waits for his choice and his script
  approval. No Iker voice has been chosen yet.
- Calm, warm and clear, like a competent friend explaining their own system. Not an announcer.
  Check how "Iker" and "naira" are spoken with `pnpm studio preview-voice` and record the
  result with `pnpm studio pronunciation`.
- Auditions are an HTML page. The owner cannot listen inside the editor: open it with
  `open <path>` and say so.
- Check the drafted spoken wording by hand. The drafting step can produce wrong contractions.

## 6. Music

- Optional. A royalty-free bed, about 12 dB under the voice, only with a licence you can state
  in `storyboard.json`. No track is in `assets/music/` today.
- If the track is Content ID registered, warn the owner that a claim may appear after upload.

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

## 9. How to report to the owner

- Lead with what is ready and where the file is. Open the file when there is something to
  watch or hear.
- Say plainly what is still weak, and what has not been run or verified.
- Keep questions to decisions only he can make, and give a recommendation with each.
