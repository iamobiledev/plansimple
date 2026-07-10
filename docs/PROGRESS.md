# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 2 — Markup engine** (authoring + list/CSV in progress / largely working)  
Phase 0 ✅ · Phase 1 vertical slice ✅ · P2–7 stubs ✅

## Completed
### Phase 2 (this turn)
- Markup draw tools on `TileViewport`: rect, ellipse, line, arrow, polyline, polygon, cloud, cloud+, freehand, highlighter, textbox, callout.
- Toolbar (color/width/subject) + keyboard V/Esc.
- Markup List: filter by type/status/query, resolve selected, **CSV export** (`filterMarkups` / `markupsToCsv` in shared).
- `FEATURE_MARKUP_ENGINE` defaults **true** (override with `FEATURE_MARKUP_ENGINE=0`).
- Round-trip API test: two of each of 10 types create→reload (`RUN_MARKUP_E2E=1`) ✅
- Shared tests: 55 passing.

### Still open for full Phase 2 acceptance
- PDF export / flatten / re-import of annotations (worker).
- Tool Chest (save reusable tools / org shared sets).
- Stamp tool with dynamic fields.
- Layers toggle UI (layer field exists).
- Playwright GUI draw demo video.

## How to demo markups
1. Login `demo@plansimple.dev` / `plansimple123`
2. Open Demo Office Building → pick a ready sheet
3. Use toolbar to draw; Markup List updates; Export CSV

## Next steps
1. Annotation PDF export (pikepdf) for flatten/original+markups.
2. Tool Chest persistence.
3. Phase 3 Yjs realtime for live multiplayer markups.
4. tus + OCR worker.
