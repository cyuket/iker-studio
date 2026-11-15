# Platform delivery, sizes and sources

Sizes and safe zones come from the Iker brand kit (`iker-brand-kit/05-social/README.md` and
its `safe-zone-guides/`). Platform behaviour notes were researched on 2026-10-22 for an earlier
deployment of this studio; provider capabilities change, so check the official sources and
the connected Iker account's current controls before relying on a route. Ads guidance below
informs editorial choices; its performance findings are not organic-reach guarantees. Title
repetition on the cover, pain-led captions and the small-grid readability check are studio
requirements, not platform requirements.

## Sizes and safe zones

| Destination                     | Size              | Safe zone and notes                                                                                                                                                   |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram feed post             | 1080x1350 (4:5)   | The profile grid shows posts at 3:4, cropping about 34 px off each side of a 4:5 post. Post at 4:5, not square. Guide: `instagram-post-portrait-1080x1350-guide.png`. |
| Instagram Story, Reel and cover | 1080x1920 (9:16)  | Guide: `instagram-story-reel-1080x1920-guide.png`. The Reel cover also shows in the grid at 3:4, so keep the title in the centre.                                     |
| TikTok video cover              | 1080x1920 (9:16)  | The grid crops covers to the centre 3:4, and the caption and buttons cover the bottom and right edge: keep text between y 240 and 1680 and left of x 920.             |
| Facebook link post / preview    | 1200x630 (1.91:1) |                                                                                                                                                                       |
| Facebook square post            | 1080x1080 (1:1)   |                                                                                                                                                                       |
| Facebook Page cover             | 1640x624          | Phones show only the centre (about 1110 px); the profile picture covers the bottom left on desktop. Keep all text in the centre 1000x520 box.                         |
| X header                        | 1500x500          | Profile header, not a video cover.                                                                                                                                    |
| LinkedIn banner                 | 1584x396          | Company Page banner, not a video cover.                                                                                                                               |
| Open Graph link image           | 1200x630          | Used when useiker.com links are shared.                                                                                                                               |
| YouTube thumbnail               | 1280x720 (16:9)   | What `pnpm studio thumbnails` renders. Shorts use 9:16 covers where Studio allows.                                                                                    |

Profile pictures on all platforms crop to a circle; use the same style (terracotta by
default) everywhere.

## Instagram and TikTok through a scheduler

Schedulers such as Buffer document frame selection, not a separate thumbnail upload
([Buffer video publishing](https://support.buffer.com/en-us/articles/sharing-videos-through-buffer-LOe2p2rnAI)).
The default is frame zero. After uploading, move the thumbnail frame to the intended
title-bearing frame, apply, and inspect the preview. On Instagram the cover matters on the
profile grid; it does not replace the autoplay opening.

For an authorised API route, [Buffer's video-post example](https://developers.buffer.com/examples/create-video-post.html)
uses `video.metadata.thumbnailOffset` in milliseconds for Instagram and TikTok. Set an
explicit verified offset and examine the preview. The API requires a publicly reachable media
URL. Do not upload to R2 or expose local media for this without the relevant authorisation.

If no suitable title frame exists, use a native cover route, or prepare a revised cut through
the approval pipeline. Do not select a readable frame that lacks the actual title.

## TikTok native

[TikTok's editing and posting help](https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting)
describes choosing a cover before posting: Select cover, select the frame, Save. Check any
text overlay against the y 240 to 1680, x below 920 zone in the actual preview.

The native editor checked on 2026-10-22 limited caption and cover edits to one per day within
the first seven days after posting. Save the full-title cover and caption together. If a post
is locked, record its pending package and check again in the next window.

[TikTok Creative Codes](https://ads.tiktok.com/business/library/TikTok_CreativeCodes_May2023.pdf)
recommends a hook, body and close, with the proposition in the opening six seconds. Fix a weak
opening in the video, not with the cover.

## Instagram native

Inspect Edit cover and the profile-grid preview in the current composer; web, mobile, Meta
tools and schedulers differ. On 2026-10-22 the web Edit Info dialog for an existing Reel
offered caption editing but no cover control, while the new-post web composer accepted a
separate PNG: upload the approved MP4, choose 9:16 in Crop, then Edit, Cover photo, Select from
computer. Check the exact caption and any required AI label before Share. Never promise a
post-publication cover repair before seeing the available controls.

## Facebook

Upload through the Iker Page, not a personal profile. Check the cover or thumbnail control in
the current composer and preview it at phone width before posting. A link post to useiker.com
uses the 1200x630 Open Graph image; check the preview it generates.

## YouTube and Shorts

[YouTube title and thumbnail advice](https://support.google.com/youtube/answer/12340300?hl=en)
supports accurate, succinct titles with important words early, readable fonts and uncluttered
composition. [YouTube thumbnail help](https://support.google.com/youtube/answer/72431)
documents custom thumbnails for verified accounts in desktop Studio, including Shorts, with
16:9 recommended for videos and 9:16 for Shorts. Check current limits and account eligibility.
Some surfaces show an automatically generated crop.

The studio's built-in thumbnails are 1280x720 landscape; they are not portrait covers.
Inspect every output and attach the right title-bearing version. `youtube-content-strategist`
stays human-invoked; this prerequisite does not authorise an upload.

The API upload route is capped per day by YouTube (`uploadLimitExceeded`). Desktop Studio may
accept uploads when the API does not.

## X

Buffer's video guide says its selected thumbnail is not used on X.
[X Media Studio help](https://help.x.com/en/using-x/media-studio-faqs) documents choosing a
frame or uploading a thumbnail matching the video's aspect ratio in Media Studio. Verify
access first; use a confirmed route or hold the X destination.
[X creative advice](https://business.x.com/en/advertising/creative-best-practices)
recommends a focused message, mobile legibility, early movement and sound-off text.

[X's Edit Post help](https://help.x.com/en/using-x/edit-post) limits edits to eligible
subscriptions and a one-hour window, and excludes posts from third-party services. Prepare
replacement copy for review, but get explicit authorisation before deleting and reposting.

## Verify saved caption text

Wait until the native editor has loaded the existing caption before replacing it. Inspect the
final text, leave the field, save, then reload the actual post and check the full text. A
successful click, a closed dialog or a character counter is not proof.

## LinkedIn Company Page

Use the native Company Page admin for Iker; verify the Page name and ID and check Published
posts before uploading to avoid duplicates. Do not post from a personal profile.

The native editor (checked 2026-10-22) offers, after Add a video:

1. Video title: enter the complete canonical title.
2. Video thumbnail: Add video thumbnail with a matching landscape or portrait PNG, then
   verify the preview.
3. Captions: Upload SRT with the cut's subtitle file, then Apply.
4. Next: check the author is the Iker Page, enter the agreed caption with any synthetic-footage
   or AI-narration disclosure, and verify before Post.

After Post, stay until Upload complete and do not submit again; processing may continue.
Refresh Published posts; the admin UI can briefly show one post twice, so compare post URNs,
not cards or toasts. Verify playback, subtitles and the persisted custom cover on the
permanent post page before releasing a batch.

[LinkedIn Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api)
also supports thumbnails and captions, but needs approved app access and is separate from the
native workflow.
