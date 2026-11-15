# Brand

Everything the video design system knows about Iker's identity lives here, so a rebrand is a
data change rather than a code change.

| File                  | Purpose                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `brand.json`          | Names, colours, fonts and logo paths. Validated on load (`src/domain/brand.ts`).     |
| `pronunciations.json` | How product terms are spoken, and who approved each one.                             |
| `logo/`               | Iker emblem, wordmark and horizontal logo files (`iker-*.svg`, `iker-icon-512.png`). |
| `tokens/`             | `iker-tokens.css` and `iker-tokens.json`, copied unchanged from the brand kit.       |

## Where the values come from

Colours, fonts and logos come from the Iker brand kit (v1.1), not invented:

- Core colours: Primary Terracotta `#E05A38`, Cast Iron Obsidian `#121518`, Deep Palm Slate
  `#2C3E35`, Warm Canvas `#F9F6F0`. Terracotta is the one accent: one primary highlight per
  view, never a palette of them.
- The video canvas is dark: `background` is obsidian and `primary` is terracotta. `surface`,
  `surfaceRaised`, `border`, `text` and `textMuted` are the kit's neutral scale
  (`--iker-neutral-900`, `-800`, `-700`, `-50`, `-400`), `accent` is `--iker-terracotta-300`
  and `warning` is `--iker-chart-3`. `positive` (`#4caf80`) and `danger` (`#e8697d`) are
  lighter versions of the kit's semantic success and danger colours, chosen by the studio so
  they read on the dark canvas; they are not kit values.
- Fonts: Plus Jakarta Sans for display and body, JetBrains Mono for code and figures. The font
  files are bundled from `@fontsource` so renders never depend on the network.
- Logos: the kit's `01-logo/svg` files. On terracotta or photos, use a mono-white logo.
- Tagline: "Get booked. Get paid." Website: `useiker.com`.

Social formats, sizes and safe zones from the kit's `05-social` folder are summarised in the
`iker-social-publishing` skill.

`placeholders` in `brand.json` lists any asset that is a stand-in for a real brand file.
It is empty today. If you add a stand-in, list it there: the QA report surfaces the list.

## Changing the brand

Edit `brand.json`, then run `pnpm studio doctor` to validate it. A brand change alters every
scene's render hash, so the next `render` re-renders scenes but reuses narration audio.
