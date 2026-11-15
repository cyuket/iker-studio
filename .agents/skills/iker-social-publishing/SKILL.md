---
name: iker-social-publishing
description: >-
  Prepare and verify title-bearing covers and truthful, pain-led captions for Iker videos on
  YouTube, YouTube Shorts, Instagram, TikTok, Facebook, X and LinkedIn, using the Iker brand kit's
  sizes and safe zones. Required before every upload or scheduled video post, and when repairing
  existing covers.
---

# Iker social publishing

Apply this to every destination and cut, including full videos. Read `iker-house-style`
alongside it. These are mandatory agent workflow gates; this skill does not add a CLI
validator or grant permission to publish. Retain the repository's human approval gates and any
publishing authorisation already given in the conversation.

The brand kit's social rules (`iker-brand-kit/05-social/README.md`) apply to every cover:
headline in Plus Jakarta Sans ExtraBold with tight tracking, supporting text in Medium;
obsidian or warm canvas grounds, terracotta for one line or one shape; white on terracotta
only for large headline type; the tile-pair pattern on edges, never behind text; money as
₦45,000; no made-up prices or stats.

## Establish the package

Read the actual cut, script, research, current QA and human approval. Identify its canonical
publishing title, audience, the pain it opens on and the outcome it shows. Use the title
approved for this cut, rather than a full video's unrelated title. If there is no selected
title and the user authorised editorial preparation, choose one using the rules below and
record it. Ask only for decisions the user has retained.

Prepare covers and captions before final review. If a frame-based publisher needs a title
frame inside the video, plan that frame during storyboarding, before rendering. Read
[platform delivery](references/platform-delivery.md) for sizes, safe zones and the selected
route; refresh the official sources and inspect current controls when support has changed.

## Title and cover: required

- Put the **complete canonical video title visibly on the cover**. Line breaks and emphasis
  may change; words must match. A generic question, episode number, feature label, logo or
  caption elsewhere does not satisfy this. Do not silently replace an approved title with a
  different hook. If it is too long to read, propose a better canonical title or change the
  layout, rather than dropping words.
- Make the title specific: a recognisable everyday problem (a deposit you cannot find in your
  chats, a double-booked Saturday, a month with no idea of profit) or the concrete result the
  video shows. Put useful topic words early; keep branding out of the main headline.
- Use one meaningful focal visual from the video: a character, a booking or payment tile, or
  a real approved product screen from the demo business. Use the Iker brand, strong contrast,
  generous spacing, a clear type hierarchy and terracotta on one word or shape at most. No
  uppercase eyebrow labels, decorative clutter, invented product screens, alarm imagery or
  stock "stressed person" clichés.
- Start from the matching safe-zone guide in the brand kit (`05-social/safe-zone-guides/`):
  red is cropped or covered by the app, green is where text goes. Keep the title and focal
  subject in the green area.
- Inspect at full size and at a small phone-grid size, approximately 160 px wide. Every title
  word must remain legible. Preview the destination's actual grid and player crops.
- Supply landscape and portrait layouts as the destination needs. Recompose, rather than
  stretching or blindly cropping a landscape PNG. A blank opening, fade, tiny UI screenshot or
  unrelated mid-speech frame is a failure.

## Caption: a truthful pain, what the video shows, one action

The first visible line names a concrete problem the viewer recognises, understandable without
expanding the caption: chasing who has paid a deposit in WhatsApp and Instagram DMs, answering
"are you free Saturday?" all day, a walk-in's cash payment that never got written down, a
client who did not show up after a slot was held. Then say what the video shows and the useful
result, and close with one action, normally watching. Add "useiker.com" where it fits; avoid a
pile of competing requests to like, comment, share and sign up.

Techniques that fit Iker:

- Second person, concrete objects and active verbs: a screenshot of a transfer, a booking link
  in an Instagram bio, a notebook of expenses.
- The viewer's current workaround, then the simpler way the video shows.
- Specifics from the footage: the service, the ₦ amount, the status the booking moves to.
- Natural search terms and a few directly relevant hashtags after the hook. Write to each
  platform's current text limit and visible preview.

Never: fear-mongering, invented statistics ("businesses lose 30%..."), invented prices,
deadlines, guaranteed outcomes, false urgency, unrelated trends, hashtag stuffing or
engagement bait. Do not claim Iker prevents no-shows, collects payments automatically or sends
reminders: it records deposits and payments, and reminders are not shipped. Keep any
synthetic-footage disclosure. No em dashes or generic AI marketing copy.

Example, only for a video that actually shows a client uploading proof of payment and the
business confirming it:

> Title and cover: Stop Chasing Deposits in Your DMs
>
> Caption: Still scrolling WhatsApp to check who sent the deposit? Watch a client book, upload
> proof of payment, and the booking move to Confirmed in one place. useiker.com

Do not paste the same hook onto unrelated videos. Check title, cover, caption and opening
seconds together: they must make and deliver the same promise. If improving the opening
changes approved media, return through render, QA and human approval.

## No upload until the cover and caption pass

For each cut and destination, save a package under `output/<id>/publishing/<cut>/` with the
selected title, exact platform caption, source MP4 path and SHA-256, cover path or frame offset
in milliseconds, supporting fact and scene references, destination account, publishing
authorisation and visual preflight evidence. Keep this separate from CLI-generated metadata;
never hand-edit a manifest or conceal an approval-invalidating script or media change. The
thumbnail headline field (40 characters) may be shorter than the title: use a separate cover
layout, or revise the title through the approval flow. Never silently accept truncated text.

Before scheduling or publishing, verify:

- The exact current MP4 is approved and QA-checked, with required disclosures intact.
- The selected cover shows the complete title, stays readable after cropping and has actually
  been applied in the publisher's preview. An existing local image is insufficient.
- The destination caption has the pain-led hook, a truthful reason to watch, correct spelling
  and Naira formatting, and fits the account's limits.
- The connected account, destination, cut and timing are correct; check for an existing post
  before retrying. Do not repeat a permission question already answered.

If the tool cannot deliver the cover, use a supported native route within the existing
authorisation, or hold that destination with a precise blocker. Never publish a blank or
default cover and plan to fix it later. Do not append a title card to an approved MP4 outside
the pipeline to bypass final approval.

## Verify the live result

For a batch, publish one authorised pilot per destination, then inspect the actual post and
profile or grid cover before releasing the rest. Check title legibility, crop, caption,
playback, sound and subtitles, and disclosures. Record the post ID, URL, time and a screenshot
in the package. A scheduler's "sent" status confirms delivery, not visual QA. If processing
prevents inspection, mark visual verification pending and hold the batch.

For repairs to existing posts, prefer an in-place cover edit that keeps the post ID. Check
native edit eligibility and limits first. Deleting and reposting needs separate explicit
authorisation.

When analytics are available, read discovery click-through, opening retention, watch time and
useful downstream actions together. Do not promise reach or attribute a change without
evidence.
