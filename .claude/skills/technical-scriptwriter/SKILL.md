---
name: technical-scriptwriter
description: >-
  Writes and fixes output/<id>/script.md for Iker Video Studio in the exact format the CLI
  parses, tied to sourced facts in research.md, and gets it through `pnpm studio script`. Use when
  drafting or editing narration, adding a cut or scene, fixing script lint errors or warnings
  (banned phrase, placeholder, missing CTA, unsupported claim, duration target), or adjusting
  length.
argument-hint: "[video-id]"
---

# Technical scriptwriter

Video: `$ARGUMENTS`. If empty, run `pnpm studio status` and ask which video.

## Responsibilities

- Write narration that teaches one thing accurately, in plain spoken English.
- Keep every product statement inside what `research.md` supports.
- Produce a `script.md` that parses, lints clean of errors, and fits each cut's target length.
- Tell the human that any edit voids the script approval, and never approve it yourself.

## Required inputs

- `output/<id>/research.md` with sourced facts (`researcher` skill). Do not start without it.
- `output/<id>/script.md` skeleton from `pnpm studio create`.
- `knowledge/audience-and-voice.md` and the `iker-house-style` skill for who is listening and
  how Iker speaks.
- Worked examples: `templates/*/demo/script.md`.

## Expected outputs

`output/<id>/script.md`, parsed by `parseScript` in `src/domain/script.ts`:

```markdown
---
schemaVersion: 1
title: "How to record a walk-in payment"
contentType: PRODUCT_TUTORIAL
audience: "Owners of Nigerian service businesses who take walk-in clients"
audienceProblem: "One sentence: the situation that makes the viewer need this."
hook: "The first thing the viewer hears about. Also opens the YouTube description."
coreExplanation: "What the viewer will understand afterwards."
demonstration: "What the product footage shows."
businessOutcome: "What changes for the viewer's team."
callToAction:
  label: "Get started"
  url: "useiker.com"
titleCandidates: ["Exactly", "three", "candidates"]
keywords: ["walk-in booking", "record payments"]
thumbnail:
  headline: "Record walk-in payments"
  kicker: "Tutorial"
claims:
  - text: "record the payment for a walk-in client"
    fact: walk-in-payment
---

# cut: full (youtube-landscape, 60-180s)

## problem (PROBLEM) — Why this matters

> Direction for the storyboard designer. Never spoken.

Narration paragraph. Consecutive lines are joined with a space.
```

- Required front matter: `schemaVersion: 1`, `title`, `contentType`, `audience`,
  `audienceProblem`, `hook`, `coreExplanation`, `demonstration`, `businessOutcome`,
  `callToAction.label`, `callToAction.url`. Optional: `titleCandidates`, `keywords`, `claims`,
  `thumbnail` (`headline` up to 40 characters, `kicker` up to 32), `social` (`linkedin`, `x`
  up to 280 characters, `shorts`).
- `contentType`: `PRODUCT_DEMO`, `PRODUCT_TUTORIAL`, `FEATURE_ANNOUNCEMENT`, `BUSINESS_EDUCATION`,
  `BOOKKEEPING_EDUCATION`, `YOUTUBE_SHORT`, `RELEASE_UPDATE`.
- Cut heading: `# cut: <cut-id> (<format>, <min>-<max>s)`. Formats: `youtube-landscape`,
  `youtube-shorts`, `social-landscape`, `social-portrait`.
- Scene heading: `## <scene-id> (<TYPE>) — optional title`. The separator may be `—`, `–` or
  `-`. Types: `INTRO`, `PROBLEM`, `EXPLANATION`, `DEMO`, `DIAGRAM`, `COMPARISON`, `OUTCOME`,
  `CTA`, `OUTRO`. Ids are lowercase words joined by hyphens and unique across all cuts.
- A scene with only `>` lines has no narration and plays silent for about 3 seconds.

Manifest effects of a passing `pnpm studio script`: `stages.research` and `stages.script`
become `completed`, `script.hash` is updated and `script.version` increments when the text
changed, `title` and `audience` are copied from the front matter. A changed hash voids
`approvals.script` and marks every later stage pending.

## Workflow

1. Read `research.md`, including "What we must not claim". Read the template's scene
   `guidance` in `templates/<template>/template.json`.
2. Structure every cut in this order:
   - **Hook from a genuine problem.** A real situation a service-business owner has, stated
     plainly and concretely: deposits buried in WhatsApp chats, "are you free on Saturday"
     messages all day, a cash payment from a walk-in that never got written down, a no-show.
     No slogan, no rhetorical question about "today's world", no fear-mongering.
   - **Teach first.** Explain the idea so the viewer learns something even if they never buy.
   - **Show the product.** `DEMO` scenes describe exactly what the recording shows, using the
     product's own labels from the facts.
   - **Appropriate CTA.** One `CTA` scene per cut, using the label and URL `research.md`
     verified (Iker's site uses "Get started" at `useiker.com`). Do not invent offers.
3. Write for the ear: short sentences, one idea each, present tense, second person, plain
   English a busy salon owner, photographer or tutor follows first time. Use the product's
   own words (booking link, proof of payment, walk-in booking, expense, statement of account,
   Business, Client). Money is written as `₦45,000`, never "45k" or "NGN", and only amounts a
   source supports or obviously illustrative ones in a fictional example. Iker records
   payments made outside the app: never say it collects or processes them. No em dashes in
   narration or any front matter text.
4. Give the storyboard designer direction in `>` lines: what should be on screen, which
   scenario, what to point at.
5. For each statement of fact in narration, add a `claims` entry. `text` must be an exact
   run of words from that scene's narration (matching ignores case only) and `fact` must be
   an id in `research.md`.
6. Run `pnpm studio script --video <id>`. Fix every `ERROR`. Treat every `warning` as a
   question to answer, not noise.
7. Fit the length. The estimate is 150 words per minute plus 0.9 seconds per narrated scene
   and 3 seconds per silent scene. Template targets: `product-tutorial` full 60-180s, short
   20-60s; `feature-announcement` full 45-90s, social 15-45s; `business-explainer`
   full 120-180s, short-60 45-60s, teaser-30 20-30s. Hard platform limits checked at QA:
   `youtube-shorts` 180s, `social-landscape` and `social-portrait` 140s.
8. Hand over to `storyboard-designer`. Remind the human the script needs their approval
   before narration.

## Lint rules

Errors (block acceptance):

- `title-candidates`: "Provide exactly three titleCandidates for review."
- `claim-without-fact`: a claim cites a fact id that `research.md` does not have.
- `missing-cta`: a cut has no scene of type `CTA`. `empty-cut`, `no-cuts`: self-explanatory.
- `banned-phrase`: any of `BANNED_PHRASES`, case-insensitive, in narration or in `title`,
  `hook`, `audienceProblem`, `coreExplanation`, `demonstration`, `businessOutcome`,
  `titleCandidates`: "revolutionise/revolutionize your business", "unlock the power of",
  "seamlessly streamline", "game-changing", "game changing", "in today's fast-paced digital
  world", "in today's fast-paced world", "cutting-edge", "next-generation", "best-in-class",
  "world-class", "supercharge", "take it to the next level", "look no further". Rewrite the
  sentence to say something specific. Do not swap in a synonym.
- `placeholder`: `TODO`, `TBD`, `lorem ipsum`, `[[` or `{{` anywhere in those texts.

Warnings (do not block, but must be resolved or justified to the human):

- `absolute-claim`: guarantee, eliminate, 100%, never fails, impossible to, fully compliant,
  ensures compliance, zero no-shows, no more no-shows, never chase.
- `quantified-claim`: a number followed by %, percent, "x faster" or "times faster".
- `duration-target`: the estimate is outside the cut's `<min>-<max>s`.
- `no-research`: `research.md` has no facts.

The lint does not check `callToAction`, `thumbnail`, `social`, `>` direction lines, em dashes
or the product wording rules above. Those are yours to get right.

A claim warning in narration disappears once a `claims` entry's `text` occurs in that scene.
The preferred fix is to reword: Iker publishes no measured results (time saved, fewer
no-shows, revenue gained), so a number or an absolute almost always has to go. Never add a `claims` entry whose fact does not actually
support the sentence.

## Validation criteria

- `pnpm studio script --video <id>` exits 0 and ends with `Script v<n> accepted.`
- No `ERROR` lines. Every remaining `warning` has been read out to the human with a reason.
- Each `Cut <id>: <words> words, about <m:ss>` line is inside that cut's target.
- Every product statement maps to a fact id. Read the script against "What we must not claim".

## Failure handling

- `VALIDATION_FAILED` "script.md must start with YAML front matter". The file must begin
  with `---`.
- `VALIDATION_FAILED` "script.md front matter is invalid: ...". A required field is missing
  or the wrong type. The message names the field path.
- `VALIDATION_FAILED` "script.md body line N: unrecognised cut heading" / "unrecognised scene
  heading" / "unknown format" / "duplicate cut id" / "scene id ... is used more than once" /
  "scene needs a lowercase-hyphen id and one of ...". Fix the heading on that body line
  (lines are counted after the front matter). Any other line starting with `# ` is read as a
  cut heading, so do not use `#` headings for notes.
- `VALIDATION_FAILED` "The script has N error(s)." Lint errors are listed above the message.
- `NOT_FOUND` "... script.md does not exist." Create the video first with
  `pnpm studio create --topic "<topic>" --id <id>`.

## Relevant project commands

```
pnpm studio script --video <id>
pnpm studio plan --video <id>
pnpm studio storyboard --video <id>
pnpm studio narrate --video <id> --dry-run
```

The human approves, not you: `pnpm studio approve --video <id> --stage script`.
