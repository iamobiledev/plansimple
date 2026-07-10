# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 5 — Revisions / compare / overlay** vertical slice complete.  
Phases 0–5 slices on branch.

## Phase 5 completed
- Upload new revision (`POST .../documents/:id/revisions/upload`) — immutable version bump.
- Slip-sheeting: markups copied to matching page numbers with `style.carriedForward`.
- Diff worker (`plansimple:diff`): block pixel compare of z0 tiles → Diff-layer cloud hotspots; flags carried markups intersecting changes (`needsReview`).
- Overlay compare UI (red/blue + opacity) when ≥2 revisions.
- Proven on sample-plans rev B (moved wall): **22 carried, 12 hotspots, 1 flagged** ✅

## Prior
P0 foundation · P1 tiles · P2 markups/export/toolchest · P3 Yjs · P4 calibrate/measure.

## Still open
- Phase 6 AI (sheet index, NL search, etc.)
- Phase 7 hardening / Stripe / load test
- Playwright multiplayer offline reconnect
- True PDF Annots (vs drawn content export)

## Demo
Upload a revised PDF on a document → wait for ready → Overlay compare; Markup List shows Diff layer + flagged items.

## Next
Phase 6 AI features behind flags.
