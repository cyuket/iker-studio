> **Copied from** `../iker-brand-kit 2/README.md` (Iker brand kit v1.1) on 2026-11-15. Snapshot for reference only.

# Iker brand kit v1.1

Everything here comes from one source, so colours and shapes match across every file. All logo text is converted to outlines, so the SVGs and PDFs look right on machines without the font installed.

New in v1.1: the full Instagram, TikTok and Facebook kit in `05-social/`.

## What's in each folder

| Folder              | Use it for                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-logo/svg`       | Websites, dashboard, Figma. Default choice for anything on screen.                                                                                                                 |
| `01-logo/png`       | Docs, slides, WhatsApp, anywhere SVG isn't accepted. 600, 1200 and 2400px wide.                                                                                                    |
| `01-logo/pdf-print` | Printers and sign makers. Vector, scales to any size.                                                                                                                              |
| `02-app-icons`      | iOS App Store, Google Play, Android adaptive + themed icon, PWA.                                                                                                                   |
| `03-favicons`       | Drop the whole folder into your site root and paste `head-snippet.html` into `<head>`.                                                                                             |
| `04-splash`         | Mobile launch screens, light and dark, including the Android 12 splash icon.                                                                                                       |
| `05-social`         | Instagram, TikTok and Facebook profile pictures and featured images, safe-zone guides, plus OG image, X and LinkedIn headers and email signature logos. See `05-social/README.md`. |
| `06-receipts-print` | 1-bit logos for 58mm (384 dots) and 80mm (576 dots) ESC/POS thermal printers, and an A4 invoice header.                                                                            |
| `07-design-tokens`  | `tokens.json`, plain CSS variables, Tailwind v3 preset, Tailwind v4 theme, Sass, TypeScript.                                                                                       |
| `08-flutter`        | Drop-in Flutter package: theme, tokens, logo widgets, fonts, icon and splash configs.                                                                                              |

## Logo file names

`iker-{layout}-{background}.{ext}`

- layout: `horizontal-tagline`, `horizontal`, `vertical-tagline`, `vertical`, `wordmark`, `emblem`
- background: `on-dark` (white text), `on-light` (obsidian text), `mono-black`, `mono-white`

Pick by the background you are placing it on. On terracotta or photos, use `mono-white`.

## Core colours

| Name                | HEX     | RGB           | CMYK           | Pantone           |
| ------------------- | ------- | ------------- | -------------- | ----------------- |
| Primary Terracotta  | #E05A38 | 224, 90, 56   | 0, 75, 80, 10  | 7592 C            |
| Deep Palm Slate     | #2C3E35 | 44, 62, 53    | 70, 45, 60, 45 | 5535 C            |
| Warm Canvas         | #F9F6F0 | 249, 246, 240 | 2, 2, 4, 0     | n/a (paper stock) |
| Cast Iron Obsidian  | #121518 | 18, 21, 24    | 75, 68, 67, 85 | n/a               |
| Thermal Paper White | #FFFFFF | 255, 255, 255 | 0, 0, 0, 0     | n/a               |

## Web quick start

```html
<link
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="iker-tokens.css" />
<button style="background:var(--iker-primary);color:var(--iker-on-primary)">Book a slot</button>
```

Dark mode follows the system, or set `data-theme="dark"` / `data-theme="light"` on `<html>`.

The full brand guide (usage rules, clear space, minimum sizes, type scales, contrast, social media) is in the Iker Design System page.
