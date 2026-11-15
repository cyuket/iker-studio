---
name: youtube-content-strategist
description: >-
  Prepares a Iker Video Studio video for publishing. Generates titles, description, chapters and
  social captions from the script with `pnpm studio metadata`, tunes the front-matter fields that
  feed them, reviews thumbnail variants, builds the export package, and walks the human through
  the YouTube publishing gates. Human-invoked only, because it sits next to export and publishing.
argument-hint: "[video-id]"
disable-model-invocation: true
---

# YouTube content strategist

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

Before preparing or uploading any cut, apply `iker-social-publishing`. Its complete-title
cover, pain-led caption and platform verification requirements are mandatory. This skill
remains human-invoked; the publishing prerequisite does not grant upload authorization.

## Responsibilities

- Make everything a viewer reads before pressing play describe what the video really shows.
- Tune titles, keywords, thumbnail copy and social captions through `script.md`, not by
  editing generated files.
- Assemble the export package for approved cuts.
- Guard the publishing gates. Uploading anywhere happens only on the human's explicit
  instruction in this conversation, for this video.

## Required inputs

- A script that passed `pnpm studio script --video <id>` and a storyboard.
- For real chapter times: a rendered primary cut (the first cut in the storyboard).
- For export: every cut to export has a final render that the human approved after QA.
- For publishing: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` and
  `YOUTUBE_PUBLISHING_ENABLED=true` in `.env`, and a one-time authorisation. None is
  configured on this machine today, so the supported route is manual upload from the package.

## Expected outputs

- `output/<id>/metadata/metadata.md` and `metadata.json`: three candidate titles, YouTube
  description, chapters, keywords, LinkedIn, X and Shorts captions.
- `output/<id>/thumbnails/statement.png`, `split.png`, `product.png` (1280x720).
- `output/<id>/export/<cut>/`: `<id>-<cut>.mp4`, `<id>-<cut>.srt`, `<id>-<cut>.vtt`,
  `metadata.md`, `metadata.json`, `thumbnail-<variant>.png`, `qa-report.json`, `SHA256SUMS`.
- Manifest: `exports` gains a `package` record per cut (and `r2` or `youtube` records when
  those are used); `stages.export` is `completed` once every cut is exported.

## Where the metadata comes from

`buildMetadata` in `src/domain/metadata.ts` adds nothing the script lacks.

| Output              | Built from                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titles              | `titleCandidates` (exactly three, each at most 100 characters)                                                                                                        |
| YouTube description | `hook`, `coreExplanation`, `businessOutcome`, `callToAction` as "label: url", chapters, the synthetic-footage note, hashtags from the first three `keywords`          |
| Chapters            | scenes with a `chapterTitle` in `storyboard.json`, timed from the rendered primary cut. Omitted unless there are at least three, each 10 s or more after the previous |
| LinkedIn caption    | `social.linkedin`, else `audienceProblem`, `coreExplanation`, call to action and four hashtags                                                                        |
| X caption           | `social.x` (at most 280 characters), else the hook and the URL                                                                                                        |
| Shorts caption      | `social.shorts`, else the hook, three hashtags and `#Shorts`                                                                                                          |
| Thumbnail text      | `thumbnail.headline` (at most 40 characters, default the title) and `thumbnail.kicker` (at most 32)                                                                   |
| Subtitles           | `output/<id>/subtitles/<cut>.srt` and `.vtt`, written by `render` from the narration word timings                                                                     |

If any recording in the manifest is synthetic, the description automatically carries: "The
product demonstration in this video uses a synthetic demo environment with simulated data. It
does not show real customer records." Never remove it from an upload.

## Workflow

1. `pnpm studio metadata --video <id>` and read `output/<id>/metadata/metadata.md`.
2. Judge each title against the script. A title may promise only what the video delivers:
   - No clickbait, no superlatives, no outcome the narration does not state.
   - No invented prices, plan limits, customer numbers or statistics. Money as `₦45,000`.
   - Use Iker's own feature words from `knowledge/product-facts.md` (booking link, proof of
     payment, walk-in, expense, statement of account). Never name a feature that is not
     shipped.
   - Lead with a concrete, truthful pain or result (a deposit lost in your DMs, a
     double-booked slot). Do not write titles that say Iker "stops no-shows", "collects your
     payments" or "guarantees" anything.
   - No em dashes. Front-load the task or topic. Keep under about 60 characters where
     possible so it is not truncated in lists.
3. The cover must show the complete selected video title and remain readable at phone-grid
   size. Do not replace it with a different three-to-five-word hook. The generated headline
   field is limited to 40 characters: if the title does not fit, prepare a separate compliant
   cover layout or revise the canonical title through the required approval flow. Keywords:
   terms the audience searches for and the video covers.
4. To change any of it, edit the front matter of `output/<id>/script.md`
   (`titleCandidates`, `keywords`, `thumbnail`, `social`, `hook`, `callToAction`). Tell the
   human first: every script edit, including these fields, voids the script approval. Then
   run `pnpm studio script --video <id>`, `pnpm studio storyboard --video <id>`, have the
   human approve the script again, and rerun `pnpm studio metadata --video <id>`. Narration
   and scene renders are reused when no narration text changed.
5. Chapters: set `chapterTitle` on scenes in `storyboard.json` (`storyboard-designer`).
6. Thumbnails: `pnpm studio thumbnails --video <id>` (add `--force` to redo). Look at the
   three PNGs with the Read tool and describe them. The human picks the variant. The
   `product` variant shows a captured screen and is labelled when the footage is synthetic.
7. Package: confirm `pnpm studio status --video <id>` shows `Approved: yes` for each cut,
   then `pnpm studio export --video <id>` (one cut: `--cut <cut-id>`). This writes local
   files only.
8. Tell the human how to publish by hand: upload the MP4, the SRT and the chosen thumbnail
   from `output/<id>/export/<cut>/` and paste from `metadata.md`. Verify the files with
   `SHA256SUMS`. State again anything synthetic or stand-in in the cut.

## Publishing gates

Run none of the commands in this section unless the human asked for that exact action in
this conversation. Repeat back the video, cut, visibility and destination and wait for a
clear yes.

- **R2 upload**: `pnpm studio export --video <id> --r2` uploads the package to the private
  bucket under `videos/<id>/<cut>/`. `--signed-url <seconds>` (60 or more, needs `--r2`)
  also creates a time-limited download link. A signed link is a bearer credential: give it
  only to the human and never write it to a file.
- **YouTube authorisation**: `pnpm studio publish-auth` opens a consent page. The human
  completes it. The token is stored outside the repository.
- **YouTube upload**:
  `pnpm studio publish --video <id> --cut <cut-id> --confirm <id> --title 1 --privacy private --thumbnail statement`.
  Four things must all hold, and the CLI checks each: `YOUTUBE_PUBLISHING_ENABLED` is exactly
  `true`; the cut's current final render is approved; `--confirm` repeats the video id;
  credentials are authorised. Keep `--privacy private` (the default) unless the human names
  `unlisted` or `public`. Do not set `YOUTUBE_PUBLISHING_ENABLED` yourself.
- Never publish a cut whose narration is a stand-in voice or whose footage is synthetic as
  if it were the finished product video. Say what it is and let the human decide.
- `pnpm studio storage prune --days <days>` only lists expired exports. Adding `--yes`
  deletes them from R2: human instruction only.

## Validation criteria

- `pnpm studio metadata --video <id>` exits 0, prints `Written: .../metadata/metadata.md`
  and no `Problem:` line.
- `metadata.md` has three titles, and a Chapters section with times (or the note that there
  are not enough chapters, which you report).
- `pnpm studio export --video <id>` exits 0 and prints `Cut <cut>: N files in .../export/<cut>`.
- Every title, the description and the thumbnail text can be traced to narration or a fact
  in `research.md`. You say what the human still has to choose: title number and thumbnail.
- After a publish: the CLI printed `Uploaded as <privacy>: <url>`. Report the URL and privacy,
  then inspect the actual cover, crop and caption on the destination. Record visual QA as
  pending if processing prevents inspection; an upload acknowledgement alone is insufficient.

## Failure handling

- `VALIDATION_FAILED` "The metadata exceeds a platform limit." with `Problem:` lines ("Title
  exceeds 100 characters", "X caption is N characters; the limit is 280.", "YouTube
  description exceeds 5,000 characters."). Shorten the source field in `script.md`.
- `NOT_FOUND` "This video has no storyboard yet." Run `pnpm studio storyboard --video <id>`.
- `APPROVAL_REQUIRED` "Cut ... has not been approved in its current form." (export and
  publish). The cut was re-rendered or never approved. Stop: the human reviews the QA report
  and runs `pnpm studio approve --video <id> --stage final --cut <cut-id>`. Never approve.
- `APPROVAL_REQUIRED` "Publishing needs explicit confirmation." `--confirm` must equal the
  video id. Treat it as a prompt to check with the human, not a typo to fix silently.
- `PUBLISHING_DISABLED` "Publishing is switched off." Expected by default. Offer the manual
  route from the export package.
- `CONFIG_INVALID` "YouTube publishing is not configured: ..." / "YouTube has not been
  authorised on this machine." / "Cloudflare R2 is not configured: ...". Report as blocked.
- `EXTERNAL_SERVICE` "Google refused the token request" / "YouTube did not start the upload"
  / "YouTube rejected the video upload" / "Upload of ... could not be verified." Do not
  retry blindly: an upload may have partly happened. Tell the human and check the channel.
- "YouTube did not accept the thumbnail (custom thumbnails need a verified channel)." The
  video is uploaded. The human sets the thumbnail by hand.
- `VALIDATION_FAILED` "--signed-url needs --r2." / "There is no title candidate N."

## Relevant project commands

```
pnpm studio metadata --video <id>
pnpm studio thumbnails --video <id>
pnpm studio status --video <id>
pnpm studio export --video <id>
pnpm studio storage push --video <id>
pnpm studio storage pull --video <id>
```

`storage push` and `storage pull` sync narration and recordings with R2 so another machine
can render. They upload media, so run them only when the human asks.
