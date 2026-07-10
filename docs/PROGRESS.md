# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 2 — Markup engine** largely complete for acceptance (draw + list/CSV + export + tool chest + stamps).  
Next deep work: Phase 3 Yjs realtime, or Phase 4 measurements.

## Completed
### Phase 2
- Draw tools on tile viewport (incl. cloud, cloud+, stamp with `{{user}}`/`{{date}}` fields).
- Markup List filters + CSV export.
- Tool Chest (save/reuse shared presets) — migration `0001_tool_chest.sql`.
- PDF export modes: `original` | `annotations` | `flattened` via pdf-lib (drawn vectors; not AcroForm/annot dicts — Bluebeam-like visual export).
- Round-trip: two of each of 10 types create→reload ✅
- Export smoke: annotated/flattened PDFs 200 OK (~18KB) ✅
- Tool Chest create ✅
- `markup_engine` flag default **true**

### Phase 0–1 (prior)
Monorepo, auth/orgs/RLS, tile ingest/viewer, seed sets, E2E 3/3.

## Known gaps / decisions
- Export draws markups into page content (visual parity) rather than PDF annotation dictionaries; re-import as editable annots is future work — noted as Bluebeam flatten-like behavior.
- Docker Compose still blocked by overlay whiteout on this VM.
- True OCR worker, tus, Yjs multiplayer still pending.

## Demo
`demo@plansimple.dev` / `plansimple123` — open project, draw, Tool Chest, Export +markups.

## Next steps
1. Phase 3: Yjs markup sync + presence in `apps/realtime`.
2. Phase 4: calibration + measurement tools (reuse shared geometry/scale).
3. Optional: true PDF Annots export; Playwright GUI markup video.
