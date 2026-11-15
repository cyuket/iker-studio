# Video authoring

The files a video author touches, and the rules each must follow. Everything here is taken
from the parsers and schemas in `src/domain`.

A video lives in `output/<video-id>/`. The author edits three files:

| File              | Owner           | Purpose                                          |
| ----------------- | --------------- | ------------------------------------------------ |
| `research.md`     | Author          | Verified facts the script may rely on, and notes |
| `script.md`       | Author          | What is said, in which scenes, in which cuts     |
| `storyboard.json` | Author and tool | How each scene looks                             |

`manifest.json` is written only by the CLI. Do not edit it.

Two brand-level files are shared by all videos: `brand/pronunciations.json` (edited through
the `pronunciation` commands) and `brand/brand.json`.

## Writing style

These rules come from the project brief. The lint enforces some of them. A reviewer enforces
the rest at script approval.

- **Human, direct, specific.** Write the way a knowledgeable colleague would explain it. Name
  the screen, the setting and the value. Short sentences read better aloud.
- **Start with a genuine problem.** Open on a situation the audience has actually been in,
  stated as a real scenario. Do not open with a slogan or with the product.
- **Teach first.** The viewer should understand something by the end, whether or not they buy
  anything. The product appears as the way to do the thing you taught.
- **No unsupported claims.** Do not promise outcomes ("no more no-shows", "never chase a
  payment again") or quote figures, prices or statistics unless a fact in `research.md`
  supports the exact sentence. Follow the product's own caveats: Iker records payments the
  business receives by transfer or cash; it does not collect clients' money itself.
- **Use the product's own words.** Say "walk-in booking", "proof of payment", "Partially Paid",
  "statement of account", as the product does, and use the labels a user will see on screen.
- **Write money the way the product shows it.** Naira with the sign and thousands separator,
  for example ₦45,000. Never invent a price, a fee or a statistic.
- **Say what is synthetic.** If the footage is the synthetic fixture, do not describe it as
  the live product.

The audience is a Nigerian service-business owner (a salon, a photographer, a tutor), not an
accountant or a developer. Use plain English. See the `iker-house-style` skill.

Narration is read aloud. Write numbers and abbreviations the way they should be heard, and
check terms with `preview-voice`.

## `research.md`

YAML front matter with a `facts` list, then free-form Markdown.

```markdown
---
facts:
  - id: walk-in-partial-payment
    statement: "A walk-in booking can be saved with a partial payment, and it is flagged Partially Paid while a balance remains."
    source: "slot-books: docs/Iker_PRD.md §6.3 and F5.2 (read 2026-11-15)"
---

# Research: Record a walk-in client's part-payment

## What the product actually does

## What we must not claim

## Open questions
```

| Field       | Rule                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `id`        | Lowercase letters, digits and hyphens. Referenced from `claims` in the script                          |
| `statement` | What is true, in one sentence                                                                          |
| `source`    | Where someone else can check it: a repository path, a documentation URL or a named person, with a date |

Start from `knowledge/product-facts.md`, whose facts already carry ids and sources, and from the
product repository (`slot-books`: `PRODUCT.md`, `docs/Iker_PRD.md`). A fact that is not in
either needs a named person to confirm it.

A file with no front matter has zero facts. That is allowed, and `script` warns "research.md
lists no verified facts." The body is never parsed. Use it for notes and, in particular, for a
list of what must not be claimed.

Changing the facts does not void the script approval. Changing the script does.

## `script.md`

YAML front matter, then one or more cuts, each holding scenes.

### Front matter fields

| Field             | Required | Rule                                                                                                                                           |
| ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`   | Yes      | `1`                                                                                                                                            |
| `title`           | Yes      | Working title. Copied to the manifest                                                                                                          |
| `contentType`     | Yes      | `PRODUCT_DEMO`, `PRODUCT_TUTORIAL`, `FEATURE_ANNOUNCEMENT`, `BUSINESS_EDUCATION`, `BOOKKEEPING_EDUCATION`, `YOUTUBE_SHORT` or `RELEASE_UPDATE` |
| `audience`        | Yes      | Who the video is for                                                                                                                           |
| `audienceProblem` | Yes      | The specific problem this audience has                                                                                                         |
| `hook`            | Yes      | The opening scenario. Used in the description, the X caption and as the default voice preview                                                  |
| `coreExplanation` | Yes      | What the viewer will understand afterwards                                                                                                     |
| `demonstration`   | Yes      | What is shown in the product                                                                                                                   |
| `businessOutcome` | Yes      | What changes for the viewer's team                                                                                                             |
| `callToAction`    | Yes      | `label` and `url`                                                                                                                              |
| `titleCandidates` | Yes      | Exactly three. Each at most 100 characters for YouTube                                                                                         |
| `keywords`        | No       | Used as tags and hashtags                                                                                                                      |
| `claims`          | No       | List of `text` and `fact`. Each `fact` must be an id in `research.md`                                                                          |
| `thumbnail`       | No       | `headline` (at most 40 characters) and `kicker` (at most 32). The headline defaults to the title                                               |
| `social`          | No       | Hand-written `linkedin`, `x` (at most 280 characters) and `shorts` captions. Anything left out is derived                                      |

All the prose fields are linted, not only the narration.

### Body grammar

```text
# cut: <cut-id> (<format>, <min>-<max>s)

## <scene-id> (<TYPE>) - <optional title>

> Direction for the storyboard. Never spoken.

Narration. Every other non-blank line in a scene is spoken.
```

**Cut heading.** `# cut: <cut-id> (<format>, <min>-<max>s)`.

- `<cut-id>`: lowercase words separated by hyphens. Unique in the script.
- `<format>`: `youtube-landscape`, `youtube-shorts`, `social-landscape` or `social-portrait`.
- `<min>-<max>s`: the target duration in whole seconds. Outside it, `script` and QA warn.
- Every line that starts with `# ` must be a cut heading. There is no room for a document
  title in the body.

**Scene heading.** `## <scene-id> (<TYPE>)`, optionally followed by a separator and a title.

- `<scene-id>`: lowercase words separated by hyphens. Unique across every cut in the script,
  not only within its cut. Prefix the scenes of a second cut, for example `short-hook`.
- `<TYPE>`: `INTRO`, `PROBLEM`, `EXPLANATION`, `DEMO`, `DIAGRAM`, `COMPARISON`, `OUTCOME`,
  `CTA` or `OUTRO`.
- The separator before the title is a hyphen, an en dash or an em dash, with a space on each
  side. The skeleton written by `create` uses an em dash.
- Every line that starts with `## ` must be a scene heading and must be inside a cut.

**Scene content.**

- A line starting with `>` is direction for whoever designs the scene. It is copied to the
  scene's `visualInstructions` the first time the storyboard is synced, and is never spoken.
- Every other non-blank line is narration. Lines are joined with a single space. This includes
  list items and `###` headings, so do not put Markdown structure inside a scene.
- A scene with no narration is silent and lasts 3 seconds by default. Chapter cards and outros
  are usually silent.

Each cut must contain at least one scene and at least one scene of type `CTA`.

The script's identity is a hash of its parsed content. Reformatting blank lines does not
change it. Changing any word, including a direction line or a front matter field, does, and
that voids the script approval.

### A complete small example

This file passes the script parser and linter with no errors and no warnings when
`research.md` contains the fact `walk-in-partial-payment` shown above (checked 2026-11-15
with `parseScript` and `lintScript`). Its narration follows
the product requirements, not a recording: before using it for a real video, check every
on-screen label against the product.

```markdown
---
schemaVersion: 1
title: "How to record a walk-in client who pays part now"
contentType: PRODUCT_TUTORIAL
audience: "Salon owners who take walk-in clients"
audienceProblem: "A walk-in pays part of the price in cash and the balance is remembered, not written down."
hook: "A walk-in pays ₦20,000 now and promises the rest on Friday. Where does that live?"
coreExplanation: "A walk-in booking records the service and every payment against it."
demonstration: "Adding a walk-in booking and recording a part-payment."
businessOutcome: "Every balance owed is on the booking, not in your memory."
callToAction:
  label: "Get started"
  url: "useiker.com"
titleCandidates:
  - "How to record a walk-in client who pays part now"
  - "Track part-payments from walk-in clients"
  - "Record a walk-in booking and its balance"
keywords: ["walk-in booking", "part-payment"]
claims:
  - text: "it is marked Partially Paid"
    fact: walk-in-partial-payment
---

# cut: full (youtube-landscape, 15-60s)

## intro (INTRO) - Title

This is how to record a walk-in client who pays part now, in Iker.

## setup (DEMO) - Set it up

> Recorded against the synthetic demo fixture.

Add a walk-in booking, choose the service, and record what the client paid. While a balance remains, it is marked Partially Paid.

## cta (CTA) - Next step

To try it yourself, go to useiker.com.

## outro (OUTRO) - Outro

> Brand outro, no narration.
```

The finished demos in `templates/*/demo/script.md` are longer examples, each with more than
one cut.

### Duration estimate

Before audio exists, duration is estimated at 150 words per minute, plus 0.9 seconds per
narrated scene and 3 seconds per silent scene. Once narration is generated, real clip lengths
are used. A product scene that plays a recording lasts at least as long as the recording.

### Lint rules

`pnpm studio script --video <id>` reports issues as `ERROR` or `warning`. Any error means the
script is not accepted, and nothing downstream can be built from it.

| Rule                 | Severity | Triggered by                                                                                                                                                    |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-cuts`            | error    | The script defines no cuts                                                                                                                                      |
| `empty-cut`          | error    | A cut has no scenes                                                                                                                                             |
| `missing-cta`        | error    | A cut has no scene of type `CTA`                                                                                                                                |
| `title-candidates`   | error    | `titleCandidates` does not have exactly three entries                                                                                                           |
| `banned-phrase`      | error    | A banned phrase (below) in any linted field or narration                                                                                                        |
| `placeholder`        | error    | `TODO`, `TBD`, `lorem ipsum`, `[[` or `{{` in any linted field or narration                                                                                     |
| `claim-without-fact` | error    | A `claims` entry cites a fact id that is not in `research.md`                                                                                                   |
| `absolute-claim`     | warning  | "guarantee", "eliminate", "never fails", "impossible to", "fully compliant", "ensures compliance", "zero no-shows", "no more no-shows", "never chase" or "100%" |
| `quantified-claim`   | warning  | A number followed by `%`, "percent", "x faster" or "times faster"                                                                                               |
| `duration-target`    | warning  | A cut's estimated duration is outside its target range                                                                                                          |
| `no-research`        | warning  | `research.md` lists no facts                                                                                                                                    |

Linted fields are `title`, `hook`, `audienceProblem`, `coreExplanation`, `demonstration`,
`businessOutcome`, each of `titleCandidates`, and every scene's narration.

**Backing a claim.** A claim warning on a scene is dropped only by a `claims` entry whose
`text` both appears in that scene's narration and contains the flagged wording (both compared
case-insensitively). Backing one sentence therefore never excuses another sentence in the same
scene. The entry's `fact` must exist in `research.md`. For example, narration "Clients pay
deposits 50% faster with a booking link." raises `quantified-claim` on "50%". It is backed by a
claim with `text: "pay deposits 50% faster"` and a real fact id. It is not backed by a claim
about a different sentence in the scene. (That sentence is an illustration of the rule, not a
fact about the product.)

The tool checks only the wording and that the fact id exists. It cannot tell whether the fact
really supports the sentence. That is the reviewer's job. Claim warnings on front matter fields
cannot be dropped this way: reword them.

**Banned phrases.** Matched case-insensitively:

- revolutionise your business, revolutionize your business
- unlock the power of
- seamlessly streamline
- game-changing, game changing
- in today's fast-paced digital world, in today's fast-paced world
- cutting-edge
- next-generation
- best-in-class
- world-class
- supercharge
- take it to the next level
- look no further

The list is `BANNED_PHRASES` in `src/domain/script.ts`.

## `storyboard.json`

`pnpm studio storyboard --video <id>` creates and maintains this file. You edit the visual
parts, then run the command again to validate.

### What the tool owns and what you own

Each time `storyboard` runs, it rewrites these from `script.md`:

- which cuts exist, and each cut's `id`, `format` and `targetSeconds`
- which scenes exist and their order
- each scene's `id`, `type`, `narration` and `estimatedDurationSeconds`

Everything else is kept, matched by scene id. A scene that is new in the script gets its
visual from the template scene with the same cut id and scene id, or a default: `title` for
`INTRO`, `cta` for `CTA`, `outro` for `OUTRO`, and a plain `statement` for every other type. A
scene removed from the script is dropped along with its visual.

Do not edit `narration` in the storyboard. Edit the script.

After any hand edit, run `storyboard` again. Other commands refuse to use a storyboard that
was edited since it was last validated.

### Top level and cut fields

| Field                                  | Rule                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                        | `1`                                                                                                                                                                                                 |
| `videoId`, `version`, `scriptHash`     | Maintained by the tool                                                                                                                                                                              |
| `cuts[].id`, `format`, `targetSeconds` | From the script                                                                                                                                                                                     |
| `cuts[].burnCaptions`                  | `true`, `false`, or `null` to follow the format default (on for Shorts and social formats, off for YouTube 16:9)                                                                                    |
| `cuts[].showProgress`                  | Default `false`. `true` draws a progress bar across the cut. With it on, changing the length of one scene re-renders every scene in the cut, because the bar's position depends on the total length |
| `cuts[].music`                         | `null`, or `{ "file", "volume", "licence" }`. `file` is relative to `assets/music`, `volume` is 0 to 1 (default 0.12), `licence` is required. See [LICENSING.md](LICENSING.md)                      |
| `cuts[].scenes`                        | At least one                                                                                                                                                                                        |

### Scene fields

| Field                          | Default  | Rule                                                                                        |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------- |
| `id`, `type`                   |          | From the script                                                                             |
| `enabled`                      | `true`   | `false` leaves the scene out of renders. Also set by `storyboard --disable` and `--enable`  |
| `narration`                    |          | From the script                                                                             |
| `estimatedDurationSeconds`     |          | From the script                                                                             |
| `visualInstructions`           | `""`     | Plain-language direction. Seeded from the script's `>` lines                                |
| `visual`                       |          | One of the kinds below                                                                      |
| `cues`                         | none     | Named moments in the narration that motion graphics time to. See MOTION-DESIGN.md           |
| `direction`                    | none     | Camera and pacing direction. See MOTION-DESIGN.md                                           |
| `animation.enter`              | `"rise"` | `rise`, `fade`, `none` or `hold` (open on the finished composition). `none` is a QA warning |
| `animation.exit`               | none     | `fade` or `hold` (keep the last frame on screen for the next scene)                         |
| `animation.leadInSeconds`      | `0.4`    | Silence before narration starts, 0 to 5                                                     |
| `animation.tailSeconds`        | `0.5`    | Silence after narration ends, 0 to 5                                                        |
| `animation.minDurationSeconds` | `0`      | Lower bound for scenes whose visuals need longer than the narration                         |
| `captions.enabled`             | `true`   | `false` leaves this scene out of captions and subtitle files                                |
| `audio.narrationVolume`        | `1`      | 0 to 1                                                                                      |
| `lowerThird`                   | none     | `{ "title", "subtitle"? }`                                                                  |
| `chapterTitle`                 | none     | Marks the start of a YouTube chapter                                                        |
| `assets`                       | `[]`     | Extra files the scene depends on, relative to the video directory. QA checks they exist     |

A scene lasts `leadInSeconds` plus the longer of its narration and its played recording, plus
`tailSeconds`, and never less than `minDurationSeconds`.

**Chapters.** YouTube chapters are built from `chapterTitle` on the scenes of the first cut.
The first chapter is placed at 0:00, a chapter that would start less than 10 seconds after the
previous one is skipped, and if fewer than three remain no chapters are written.

### Visual kinds

`visual.kind` selects the layout. Fields marked optional may be left out.

Tones are `neutral`, `primary`, `positive`, `warning` and `danger`. A region is
`{ "x", "y", "width", "height" }` in fractions (0 to 1) of the recorded viewport.

#### `title`

| Field      | Rule     |
| ---------- | -------- |
| `headline` | Required |
| `subhead`  | Optional |

#### `statement`

| Field      | Rule                                               |
| ---------- | -------------------------------------------------- |
| `headline` | Required                                           |
| `body`     | Optional                                           |
| `points`   | Up to 4 of `{ "title", "detail"? }`. Default empty |
| `tone`     | Default `neutral`                                  |

#### `steps`

| Field     | Rule                               |
| --------- | ---------------------------------- |
| `heading` | Required                           |
| `steps`   | 2 to 5 of `{ "title", "detail"? }` |

#### `product`

Shows a recording made by `pnpm studio record`.

| Field         | Rule                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenarioId`  | Required. A scenario id from `pnpm studio scenarios`                                                                                                             |
| `mode`        | `video` (default) plays the recording. `screenshot` holds one still                                                                                              |
| `screenshot`  | Optional. Name of the screenshot step to show. In `screenshot` mode the default is the scenario's last still                                                     |
| `heading`     | Optional                                                                                                                                                         |
| `annotations` | List of `{ "text", "region", "fromSeconds", "toSeconds"?, "spotlight" }`. Times are seconds from the start of the scene. `spotlight` defaults to `false`         |
| `focus`       | Optional region that must stay legible when the scene is recomposed for 9:16                                                                                     |
| `zoom`        | Default `false`. One eased push-in towards `focus`                                                                                                               |
| `showCursor`  | Default `true`. Applies to `screenshot` mode, where a drawn cursor moves between the recorded step positions. A played recording already contains its own cursor |

Screenshot names come from the scenario's `screenshot` steps. If a scene asks for a name the
recording does not have, rendering fails and lists the names available.

#### `diagram`

| Field     | Rule                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` | Optional                                                                                                                              |
| `nodes`   | 2 to 9 of `{ "id", "label", "sublabel"?, "tone", "column" }`. `column` is 0 to 4, left to right. Nodes in one column stack vertically |
| `edges`   | List of `{ "from", "to", "label"?, "tone" }`, where `from` and `to` are node ids                                                      |

#### `comparison`

| Field           | Rule                                                           |
| --------------- | -------------------------------------------------------------- |
| `heading`       | Optional                                                       |
| `left`, `right` | Each `{ "title", "points", "tone" }` with 1 to 4 string points |

#### `code`

| Field            | Rule                               |
| ---------------- | ---------------------------------- |
| `language`       | Required                           |
| `code`           | Required                           |
| `heading`        | Optional                           |
| `highlightLines` | Line numbers from 1. Default empty |

#### `data`

A bar chart. No shipped template uses it, so it has had less use than the other kinds.

| Field          | Rule                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `heading`      | Required                                                                                   |
| `series`       | 1 to 6 of `{ "label", "value", "tone" }`. `tone` defaults to `primary`                     |
| `unit`         | Default `""`                                                                               |
| `source`       | Required. Where the numbers come from                                                      |
| `illustrative` | Required, `true` or `false`. Set `true` when the numbers are examples and not measurements |

`source` and `illustrative` are required so that a chart cannot present invented numbers as
fact. A chart of real figures still needs a matching fact in `research.md`.

#### `cta`

| Field      | Rule     |
| ---------- | -------- |
| `headline` | Required |
| `action`   | Required |
| `url`      | Required |

#### `outro`

| Field     | Rule     |
| --------- | -------- |
| `tagline` | Optional |

#### `chapter`

| Field   | Rule     |
| ------- | -------- |
| `title` | Required |

#### Motion graphic kinds

`identity-story`, `network`, `pipeline`, `decision`, `timeline`, `story`, `transformation`
and `character-scene` are data-driven motion graphics timed by `cues`. Their fields, cue hooks
and a JSON example for each are in [MOTION-DESIGN.md](MOTION-DESIGN.md).

### Example scene

```json
{
  "id": "setup",
  "type": "DEMO",
  "enabled": true,
  "narration": "Add a walk-in booking, choose the service, and record what the client paid. While a balance remains, it is marked Partially Paid.",
  "estimatedDurationSeconds": 7.6,
  "visualInstructions": "Recorded against the synthetic demo fixture.",
  "visual": {
    "kind": "product",
    "scenarioId": "synthetic-record-payment",
    "mode": "video",
    "heading": "Record a part-payment"
  },
  "chapterTitle": "Set it up"
}
```

Fields with defaults can be left out. The tool writes them in when it validates the file.

Open `output/<id>/storyboard.html` after each `storyboard` run to review the scenes in order.

## Pronunciation workflow

`brand/pronunciations.json` lists terms whose pronunciation matters, for every video. Each
entry is `pending` or `approved`.

- A `pending` entry changes nothing about how the term is spoken. It only makes `narrate`,
  `plan` and QA warn that the term has not been checked.
- An `approved` entry with an alias or IPA is applied to every scene that contains the term.
  An `approved` entry with neither records that the default reading was checked and is right.
- Terms are matched case-insensitively as whole words.

Run `pnpm studio pronunciation list` to see the shipped entries and their status. Check the
brand name "Iker" and the currency word "Naira" first: no pronunciation of either is recorded
in the product repository, so none is assumed. A narrated amount such as ₦45,000 should be
heard as "forty-five thousand naira"; preview it before narrating a full script.

```bash
pnpm studio pronunciation list
pnpm studio preview-voice --video <id> --term Iker
```

`preview-voice --term` speaks the term in a carrier sentence and prints the path of the audio
file. Listen to it. A rule you have just set with `pronunciation set` is applied in this
preview even though it is still pending, so you hear the proposed reading before approving
it. Pending rules are never applied anywhere else.

If it is right:

```bash
pnpm studio pronunciation approve --term Iker
```

If it is wrong, set a respelling or an IPA string:

```bash
pnpm studio pronunciation set --term Iker --alias "<respelling>" --notes "Confirmed by <name>"
```

**A rule is applied only once it is approved, and that includes previews.** `set` returns the
term to `pending`, and a pending rule is ignored by `preview-voice` as well as by `narrate`. So
to hear a new alias you have to approve it first, then listen, and set it again if it is still
wrong:

```bash
pnpm studio pronunciation approve --term Iker
pnpm studio preview-voice --video <id> --term Iker
```

This is how the code behaves today. It means the recorded approval comes before the listening
that is supposed to justify it, so treat the first approval of a new alias as provisional and
do not narrate the full script until you have heard the preview. The message printed by
`pronunciation set` ("Preview it, then approve it.") does not match this behaviour.

Things to know:

- `pronunciation set` on a term that is not in the file adds it.
- `--clear` removes the alias and IPA.
- With ElevenLabs, rules are sent as a pronunciation dictionary: a phoneme rule when IPA is
  set, an alias rule otherwise. IPA is honoured only by models that support phoneme rules. An
  alias does not depend on that.
- With the `system` voice, aliases are applied by replacing the text before it is spoken. IPA
  is ignored. The `silent` voice ignores both.
- Approving or changing a rule changes the cache key of every scene that contains the term, so
  those scenes are narrated again. With ElevenLabs that costs credits.
- The approver is recorded from `git config user.name`, or `--by`.
- Previews with ElevenLabs cost credits unless the same sample is already cached. Use
  `--dry-run` to see the cost first.

## Adding a recording scenario

A scenario is a declarative list of steps that the recorder plays in a browser. Scenarios live
in `src/scenarios/`. Product scenes refer to them by `scenarioId`.

### 1. Decide the target

- `synthetic`: runs against `fixtures/synthetic-demo` served on loopback. Use this for
  pipeline tests and for demonstrations that are honestly labelled as synthetic. If the
  fixture lacks the page you need, add it and follow the rules in
  `fixtures/synthetic-demo/README.md`.
- `iker`: runs against `IKER_DEMO_BASE_URL`, which should be a local copy of the web app
  (`http://localhost:3000` from the `slot-books` repository, with seeded demo data) or a
  staging host such as `https://staging.iker.example`. Iker has no Sandbox mode, so
  `useiker.com` and every subdomain are always refused, as is any host in
  `IKER_PRODUCTION_HOSTS`. Plain `http` is accepted only for `localhost` and `127.0.0.1`.

The id must start with the target name: `synthetic-...` or `iker-...`. A unit test enforces
this.

### 2. Write it

Add to `src/scenarios/synthetic.ts` or `src/scenarios/iker.ts`. Take routes and element names
from the fixture's HTML or, for the real app, from `pnpm studio demo-snapshot`; never guess
them. An illustration of the shape:

```ts
export const syntheticExpense: Scenario = defineScenario({
  id: "synthetic-add-expense",
  title: "Demo Console: record an expense",
  feature: "Expense tracking",
  target: "synthetic",
  status: "unverified",
  evidence: "fixtures/synthetic-demo (static fixture in this repository)",
  preflight: [
    {
      path: "/expenses/new",
      expect: [{ role: "button", name: "Save expense" }],
    },
  ],
  steps: [
    { action: "authenticate" },
    { action: "navigate", path: "/expenses/new" },
    { action: "waitFor", target: { role: "heading", name: "Add expense" } },
    { action: "dwell", ms: 1200 },
    { action: "type", target: { label: "Amount", exact: true }, text: "15000" },
    { action: "select", target: { label: "Category", exact: true }, option: "Supplies" },
    { action: "click", target: { role: "button", name: "Save expense" } },
    {
      action: "verify",
      target: { role: "status", name: "Save status" },
      containsText: "Expense saved",
    },
    { action: "screenshot", name: "saved" },
    { action: "dwell", ms: 1000 },
  ],
});
```

The routes and element names in this example are illustrations, not pages that exist in the
fixture. Add the page to the fixture first (following its README), or copy names from a
shipped scenario such as `synthetic-record-payment`.

Add the scenario to the exported list at the bottom of its file so `src/scenarios/index.ts`
picks it up.

**Scenario fields.**

| Field           | Rule                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `id`            | Lowercase words separated by hyphens, starting with the target name                               |
| `title`         | What the scenario shows                                                                           |
| `feature`       | The product feature. Shown by `pnpm studio scenarios`                                             |
| `target`        | `synthetic` or `iker`                                                                             |
| `status`        | `verified` only after the flow has been run end to end against its target. Otherwise `unverified` |
| `evidence`      | Where the routes and element names came from                                                      |
| `prerequisites` | What must be true of the environment: data, permissions, feature flags                            |
| `viewport`      | Default 1440x900                                                                                  |
| `preflight`     | Pages to visit before recording, each with elements that must be visible                          |
| `steps`         | At least one                                                                                      |

**Targets.** A step finds its element in one of five ways:

| Form                     | Finds                                       |
| ------------------------ | ------------------------------------------- |
| `{ role, name, exact? }` | An element by ARIA role and accessible name |
| `{ label, exact? }`      | A form field by its label                   |
| `{ testId }`             | An element by test id                       |
| `{ text, exact? }`       | An element by visible text                  |
| `{ placeholder }`        | A field by placeholder                      |

There is no CSS selector form, on purpose. A target that matches more than one element fails
instead of acting on a guess. Use `exact: true` or a more specific role to disambiguate.

**Steps.** Every step accepts an optional `note`.

| Action         | Fields                                                                       | What it does                                                                   |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `authenticate` | none                                                                         | Signs in with the demo account from the environment, before the capture starts |
| `navigate`     | `path`                                                                       | Goes to a path relative to the base URL                                        |
| `click`        | `target`                                                                     | Moves the drawn cursor to the element and clicks                               |
| `type`         | `target`, `text`                                                             | Types visibly, key by key                                                      |
| `select`       | `target`, `option`                                                           | Chooses an option in a select                                                  |
| `scroll`       | `target`                                                                     | Scrolls the element into view                                                  |
| `waitFor`      | `target`, `state` (`visible` or `hidden`, default `visible`)                 | Waits for an element                                                           |
| `waitForState` | `condition`: `{ urlIncludes }`, `{ textVisible }` or `{ networkIdle: true }` | Waits for an application condition                                             |
| `highlight`    | `target`, `label`?, `holdMs` (200 to 10000, default 1500)                    | Rings the element, optionally with a label, and holds                          |
| `screenshot`   | `name` (lowercase letters, digits, hyphens)                                  | Saves a still that scenes can show by name                                     |
| `mask`         | `targets`                                                                    | Blurs matching elements for the rest of the recording                          |
| `verify`       | `target`, `containsText`?                                                    | Fails the recording if the element or text is not there                        |
| `dwell`        | `ms` (100 to 10000)                                                          | Holds the frame so a viewer can read it                                        |

Rules that matter:

- **Never put credentials in a scenario.** `authenticate` takes no fields. The account comes
  from the environment, and sign-in always happens before the capture starts, wherever the
  step appears in the list.
- **Paths are site-relative.** They start with a single `/`. A path that leaves the recording
  origin is refused.
- **Wait for the application, do not sleep.** Use `waitFor` or `waitForState` for application
  state. `dwell` is pacing for the viewer only.
- **Opening steps are off camera.** Leading `authenticate`, `navigate`, `waitFor`,
  `waitForState` and `mask` steps run before the capture starts, so the video opens on a
  settled page. Put `mask` steps there so masks are in place from the first frame.
- **Typed text is visible in the video.** It is never written to the timeline file, but it is
  on screen. Type only synthetic values.
- **Mask what must not be shown.** Masking is best effort. A person must still review the
  footage.
- **Give each screenshot a unique name** within the scenario.
- **Keep it deterministic.** A scenario that creates data on every take leaves the demo
  business different each time. Prefer flows that stop before submitting, or reset the seeded
  demo data between takes.
- **Show only the business's own view.** Never record a Platform Admin or Super Admin screen
  that shows a business's income, expenses or statements; those roles must never see them.

### 3. Run and verify it

```bash
pnpm test                 # the scenario registry tests validate every scenario
pnpm studio scenarios     # confirm it is listed
```

Reference it from a product scene in a video's `storyboard.json`, run
`pnpm studio storyboard --video <id>`, then:

```bash
pnpm studio record --video <id> --scenario <scenario-id> --headed
```

`--headed` shows the browser. If it fails, read
`output/<id>/recordings/<scenario-id>/debug/failure.txt` and `failure.png`. See
[TROUBLESHOOTING.md](TROUBLESHOOTING.md#recording).

Watch the whole capture before using it. Check for real personal data, anything that should
have been masked, and that the flow shows what the script says.

Set `status: "verified"` only after an end-to-end run against the real target, and say in
`evidence` when and against what it was run. For an `iker` scenario, the test in
`tests/unit/recording/scenarios.test.ts` requires `evidence` to contain "ran green on
YYYY-MM-DD". No `iker` scenario has been run end to end yet.

Changing a scenario changes its recording hash, so the next `record` retakes it and the scenes
that use it are rendered again.
