# Licensing

This page lists what Iker Video Studio depends on that has licence or billing consequences.
It is a working summary for engineers, not legal advice. When a licence question affects a
decision, read the licence itself and ask the person at Iker responsible for legal matters.

The repository's own code is proprietary. See [LICENSE.md](../LICENSE.md).

## Remotion: action required before production use

The renderer is [Remotion](https://www.remotion.dev) (`remotion`, `@remotion/renderer`,
`@remotion/bundler`, `@remotion/cli`, pinned to `4.0.534`). Remotion is not under a standard
open-source licence.

Remotion's `LICENSE.md` was read on 2026-10-07. It says Remotion is free for:

- individuals
- for-profit organisations with up to 3 employees
- non-profit organisations
- evaluation

Any other use requires a Company Licence. Pricing is at <https://www.remotion.pro/license>.

**Action item.** Iker is a for-profit company. This studio was cloned from another company's
repository, and any licence decision made there does not carry over. Before this tool is used
in production for Iker, Iker must:

1. Check Iker's own headcount against the threshold in Remotion's current `LICENSE.md`. This
   document does not record Iker's headcount; do not assume it is under the threshold.
2. If the threshold is exceeded, buy a Company Licence.
3. Record the decision and who made it.

This repository does not record that a licence has been bought. Do not assume one has.

Re-read Remotion's licence when upgrading Remotion. The terms can change between versions,
and the summary above is of the version read on the date given.

### Setting the licence key

If the organisation holds a Company Licence, put its key in `.env`:

```bash
REMOTION_LICENSE_KEY=<key>
```

`src/cli/container.ts` reads the variable and passes it to
`src/infrastructure/render/remotion-renderer.ts`, which sets Remotion's `licenseKey` option on
every scene render and thumbnail render. When the variable is empty, no key is sent.

Treat the key as a secret. It is not in the list of values the studio redacts from logs
(`SECRET_VARIABLES` in `src/infrastructure/config/env.ts`), so do not paste command output
that might contain it into a ticket without checking. In GitHub Actions, store it as an
environment secret.

`pnpm studio preview --studio` and `pnpm remotion:studio` start Remotion Studio through
`@remotion/cli`. The same licence terms apply to that use.

## Fonts

Rendered frames use two font families, the ones in Iker's brand kit, bundled from
`@fontsource` packages so a render never needs the network (`src/remotion/fonts.ts`):

| Family            | Package                         | Version | Role                     |
| ----------------- | ------------------------------- | ------- | ------------------------ |
| Plus Jakarta Sans | `@fontsource/plus-jakarta-sans` | 5.3.0   | Headings and body text   |
| JetBrains Mono    | `@fontsource/jetbrains-mono`    | 5.3.0   | Labels, figures and code |

What was checked, on 2026-11-15, in the installed packages:

- `node_modules/@fontsource/plus-jakarta-sans/LICENSE` begins "Copyright 2020 The Plus Jakarta
  Sans Project Authors" and states "This Font Software is licensed under the SIL Open Font
  License, Version 1.1."
- `node_modules/@fontsource/jetbrains-mono/LICENSE` begins "Copyright 2020 The JetBrains Mono
  Project Authors" and states the same licence.
- Each package's `package.json` declares `"license": "OFL-1.1"`.

So both are under the SIL Open Font License 1.1. The OFL permits use in rendered video,
including commercial video. The main restrictions concern selling the font files on their own
and reusing reserved font names for modified versions, neither of which this project does.
Read the licence text in the files above if you plan to redistribute or modify the fonts.

To add a font: add its `@fontsource` package, check its `LICENSE` file the same way, import
the weights in `src/remotion/fonts.ts`, add the family to `BUNDLED_FONT_FAMILIES`, and update
this table. Do not load fonts from a URL at render time.

## Music and sound effects

No music and no sound effects are shipped. There is no `assets/music` directory in the
repository, and no template uses a music bed.

The pipeline supports one optional music bed per cut, set in `storyboard.json`:

```json
"music": {
  "file": "calm-bed.mp3",
  "volume": 0.12,
  "licence": "Licensed from <library>, licence id <id>, covers online video, bought 2026-10-01 by <name>"
}
```

Policy:

- Every track must be licensed for the intended use: commercial, online, on every platform
  the video will be published to, and for monetised content if that applies.
- The `licence` field is required by the schema and must not be empty. Write where the licence
  came from, its identifier, what it covers and who obtained it. It is free text. The tool does
  not verify it.
- Put the file under `assets/music/`. `.gitignore` allows `.mp3` files there. Keep the licence
  document or receipt somewhere the team can find it.
- "Royalty-free" does not mean free of conditions. Read the terms. Tracks that require
  attribution need that attribution in the video description, which you must add yourself.
- Do not use music from a streaming service, a video platform's audio library under another
  account, or anything whose source you cannot name.
- The final review checklist in the QA report includes "Music and sound effects, if any, are
  licensed for this use." A person confirms it before approving.

Sound effects are not implemented as a feature. There is no storyboard field for them.

## Iker brand assets

The logos in `brand/logo/`, the design tokens in `brand/tokens/`, the colours and names in
`brand/brand.json`, and the product names used in templates and scripts belong to Iker and are
proprietary. They were taken from the Iker brand kit (v1.1). `brand/README.md` records the
source of each value.

- Do not reuse them outside Iker's own videos.
- Do not publish this repository or its `brand/` directory.
- `brand.json` has a `placeholders` list for stand-in assets. It is empty today.

## Synthetic fixture

`fixtures/synthetic-demo` is original to this repository: a labelled "Demo Console" for a
made-up booking business. It uses system fonts, made-up names and `example.com` addresses, and
contains no third-party assets. Its rules are in
`fixtures/synthetic-demo/README.md`.

## Third-party services

Using these services means accepting their terms. The links are to the providers' own pages.
Read the current versions. Nothing below is a summary of those terms.

| Service             | Used for                          | What to check                                                                                                                                                                            |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ElevenLabs          | Production narration              | That your plan permits commercial use of generated audio and of the chosen voice. Billing is in credits per character. <https://elevenlabs.io/terms-of-use>                              |
| YouTube Data API v3 | Optional upload with `publish`    | The YouTube API Services Terms of Service and Developer Policies, and the quota of the Google Cloud project. <https://developers.google.com/youtube/terms/api-services-terms-of-service> |
| Cloudflare R2       | Optional private storage          | Cloudflare's terms and R2 pricing for storage and operations. <https://www.cloudflare.com/terms/>                                                                                        |
| GitHub Actions      | CI and the manual render workflow | Minutes are billed for private repositories                                                                                                                                              |

Notes specific to this tool:

- The stand-in voices (`system`, `silent`) are for checking the pipeline. The macOS `say`
  voices are part of macOS and are covered by Apple's software licence. Do not publish
  narration made with them without checking those terms. The tool marks such narration as a
  stand-in in every QA report.
- Videos that use synthetic footage carry an on-screen label, and the generated description
  includes a sentence saying the demonstration uses simulated data. Keep both when publishing.

## Other dependencies

All other runtime dependencies are listed in `package.json` with exact versions. Their
licences have not been audited as part of this document. To list them:

```bash
pnpm licenses list --prod
```

Run that before any distribution of this code outside Iker.
