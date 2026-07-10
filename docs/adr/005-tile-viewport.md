# ADR-005: Server-side tile pyramids for the viewer

## Status
Accepted (Phase 1)

## Context
Full-page pdf.js/canvas rendering will not survive 500MB+ drawing sets at interactive zoom.

## Decision
Python docproc worker (pypdfium2) renders 512px WebP tile pyramids to object storage. The browser streams visible tiles via WebGL2/Canvas. PDFium WASM is secondary (text ops / fallback), not the main viewport.

## Consequences
- Async ingest UX with per-page progress
- Storage cost for tiles
- Smooth pan/zoom independent of PDF complexity
