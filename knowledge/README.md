# Iker knowledge base

What the studio is allowed to say about Iker, and where each statement comes from.

Everything here is **distilled from `../slot-books`**: the Iker product repository, which sits next
to this studio in the same parent folder (`iker/slot-books` beside `iker/Iker-studio`). slot-books is
the source of truth. This folder is a reading aid for researchers and script writers. When the two
disagree, slot-books wins and this folder is the thing to fix.

slot-books is read-only from the studio's side. Never edit it to make a video easier to write.

## What is here

| File                    | What it is for                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product-facts.md`      | Numbered facts (`pf-001`, `pf-002`, ...), each with its slot-books source and whether it is shipped. Also the product's own wording, and what not to claim. |
| `audience-and-voice.md` | Who the videos are for, the problems they have, the brand voice, words to use and avoid, and the real call to action on useiker.com.                        |
| `source/`               | Copies of the most useful slot-books documents and the live marketing copy, taken on 2026-11-15. Each file says where it came from.                         |

## How researchers cite it

A video's `research.md` keeps its facts in YAML front matter (see `docs/VIDEO-AUTHORING.md`). Every
fact needs a `source`. For Iker facts, cite the knowledge fact **and** the slot-books location it
rests on, so a reviewer can check either:

```yaml
facts:
  - id: no-commission
    statement: "Iker takes no commission on bookings or deposits."
    source: "knowledge/product-facts.md pf-061; slot-books apps/web/lib/marketing/content/site.ts (SITE.facts)"
```

The fact `id` in `research.md` is the video's own (lowercase words and hyphens). The `pf-` number is
how a reviewer finds the statement here. Claims in `script.md` cite the research fact id, never the
`pf-` number directly.

Rules:

1. **Quote the product's own names.** Use the wording in "What things are called" in
   `product-facts.md`. If a label is not listed there, check the slot-books source before using it.
2. **Shipped only.** A fact marked _planned_ or _not shipped_ must not be presented as available.
   Say "planned" or leave it out.
3. **No invented numbers.** No prices, plan limits, percentages, speeds or customer counts unless a
   fact here states them, and even then prefer "depends on your plan". Plan prices live in the
   database behind the live pricing page, so a price in a document may already be out of date.
4. **Money is written in Naira**, as `₦45,000`. Example amounts on screen must be clearly examples.
5. **If you cannot source it, leave it out.** A shorter, true script beats a fuller, guessed one.

## Keeping it current

slot-books moves faster than this folder. Before scripting a feature, check the fact's source in
slot-books for changes since 2026-11-15 (the copy date of `source/`). When something has changed,
update the fact here, keep its number, and note the new date in its source line. Retired facts keep
their number with a note saying so, so old `research.md` files still resolve.

Known disagreements inside slot-books, resolved here:

- `docs/Iker_PRD.md` §15 (snapshot of 29 August 2026) says Google Calendar sync, quarterly and yearly
  reporting, statements and the customer list had not shipped. `docs/EXECUTION_PLAN.md` (later) marks
  M2.1, M2.2 and M2.3 complete, and the routes exist in `apps/web/app/(dashboard)`. These facts are
  treated as shipped.
- `docs/FRONTEND_CURRENT_STATE.md` predates several routes (customers, sales, packages, staff,
  locations, calendar settings, statements, referrals) and some sidebar labels. Where it disagrees
  with the code, the code in `apps/web` is cited instead.
- `docs/Iker_PRD.md` §15.3 describes an older "Modernist" red design. `docs/DESIGN_SYSTEM.md` and the
  brand kit (terracotta `#E05A38`) replace it.
