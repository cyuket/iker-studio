# Plan

Current objective: rebrand the studio for Iker (booking, manual-payment tracking and
bookkeeping for Nigerian service businesses) and make its first real Iker video. The engine
was cloned from `todenhq/toden-video-studio`; its earlier plan and every video made for that
product are out of scope here and live only in that repository's history.

| Phase                             | Scope                                                                                                    | State                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Engine (inherited)             | CLI, manifest, Remotion design system, FFmpeg, recorder, narration, QA, export, publishing gates         | Inherited, unit tests only on this copy                                                       |
| 2. Rebrand                        | Package name, brand data and tokens, env names, target guard, templates, synthetic fixture, docs, skills | In progress (2026-11-15)                                                                      |
| 3. Knowledge base                 | `knowledge/` product facts with slot-books sources, audience and voice                                   | First draft written 2026-11-15, not reviewed by Iker                                          |
| 4. Demo environment and scenarios | Local slot-books web app with demo data (or a staging host), `iker-*` scenarios verified by a green take | Local demo seeded 2026-11-15 (`fixtures/iker-demo`, Amaka Studio); scenarios still unverified |
| 5. First Iker video               | Research, script, storyboard, approval, recording, narration, render, QA, final approval, export         | Not started                                                                                   |

Nothing has been run for Iker beyond the unit tests. No Iker video, recording or narration
exists, and `output/` is empty.

## Open blockers

- **No ElevenLabs credentials** for Iker. Only the `system` and `silent` stand-in voices can
  run, so any render is a pipeline check, not production output. No voice has been chosen.
- **Demo environment is local only.** `fixtures/iker-demo/seed.sh` seeds "Amaka Studio" into the
  local slot-books Supabase and `.env` points at `http://localhost:3000`. The slot-books dev
  server must be running. Scenarios still reference `/test-salon` and "Box braids" and need
  updating to `amaka-studio`. The proof of payment opens in a new tab on the storage origin,
  which the recorder cannot show.
- **Every `iker-*` scenario is unverified.** They were written from source and docs. Each needs
  a green take against the demo environment before it is marked verified.
- **Remotion licence.** Remotion's free licence covers only small organisations. Check Iker's
  headcount against Remotion's current terms before production use (see `docs/LICENSING.md`).
- **Pronunciations.** `brand/pronunciations.json` still lists the previous product's terms. It
  needs Iker entries (at least "Iker" and how Naira amounts are read), each previewed and
  approved by a person.
- **Owner review.** The house style, social-publishing rules and knowledge base have not been
  reviewed by anyone at Iker.
- **Publishing accounts.** No R2 bucket, YouTube channel authorisation or social accounts are
  configured for Iker.
