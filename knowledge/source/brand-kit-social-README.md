> **Copied from** `../iker-brand-kit 2/05-social/README.md` (Iker brand kit v1.1) on 2026-11-15. Snapshot for reference only.

# Iker social media kit

Ready-to-post profile pictures and featured images for Instagram, TikTok and Facebook. Every featured image comes as PNG (sharpest) and JPG (smaller upload). Text in every design sits inside the platform's safe zone; the overlays in `safe-zone-guides/` show where that is if you make new posts.

## Profile pictures (all platforms crop to a circle)

Upload the 1080px file; each platform scales it down (Instagram shows it at 110 to 320px, TikTok at 200px, Facebook at 196px).

| Style                           | Use                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `*-profile-terracotta-1080.png` | Default. Matches the app icon, so people recognise it on their home screen and in DMs. |
| `*-profile-obsidian-1080.png`   | Dark alternative, for when the feed or cover is mostly terracotta.                     |
| `*-profile-canvas-1080.png`     | Light alternative, for partner pages and light-themed placements.                      |

Use the same style on all three platforms.

## Instagram (`instagram/`)

| File                                      | Size | Use                                             |
| ----------------------------------------- | ---- | ----------------------------------------------- |
| `instagram-post-portrait-dark-1080x1350`  | 4:5  | Featured / pinned post: "Get booked. Get paid." |
| `instagram-post-portrait-light-1080x1350` | 4:5  | Featured post: "Stop chasing payments in DMs."  |
| `instagram-story-reel-cover-1080x1920`    | 9:16 | Story, Reel cover and Highlight cover source    |

Post at 1080x1350, not square: Instagram's profile grid now shows every post at 3:4, which crops 34px off each side of a 4:5 post but cuts far more off a square one.

## TikTok (`tiktok/`)

| File                                      | Size | Use                                 |
| ----------------------------------------- | ---- | ----------------------------------- |
| `tiktok-video-cover-1080x1920`            | 9:16 | Featured / pinned video cover, dark |
| `tiktok-video-cover-terracotta-1080x1920` | 9:16 | Alternative cover, terracotta       |

TikTok has no banner. Your profile picture and pinned-video covers are your header. The profile grid crops covers to the centre 3:4, and the caption and buttons cover the bottom and right edge, so keep text between y 240 and 1680 and left of x 920.

## Facebook (`facebook/`)

| File                             | Size   | Use                            |
| -------------------------------- | ------ | ------------------------------ |
| `facebook-cover-1640x624`        |        | Page cover photo               |
| `facebook-post-link-1200x630`    | 1.91:1 | Featured post and link preview |
| `facebook-post-square-1080x1080` | 1:1    | Feed post                      |
| `facebook-event-cover-1920x1005` |        | Event cover                    |

The cover shows only its centre (about 1110px) on phones, and your profile picture sits over the bottom left on desktop. All text on the cover is in the centre 1000x520 box; the edges are pattern only.

## General (`general/`)

Open Graph link image, X header, LinkedIn banner, a generic avatar and email signature logos.

## Making new posts

- Start from the safe-zone guide for the format: red is cropped or covered by the app, green is where text goes.
- Headline in Plus Jakarta Sans ExtraBold with tight tracking; supporting text in Medium.
- Obsidian or warm canvas grounds, terracotta for one line or one shape. White on terracotta only for large headline type.
- The tile-pair pattern (appointment tile, ledger tile, booking dot) is the brand's texture. Use it on edges, never behind text.
- Money as ₦45,000. No made-up prices or stats.
