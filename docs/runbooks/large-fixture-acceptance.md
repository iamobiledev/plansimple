# Large drawing-set acceptance

## Purpose
Phase 1 acceptance calls for a **300-page / ~800MB** drawing set to be viewable after async processing, with smooth pan/zoom. CI uses smaller fixtures (`sample-plans.pdf`, 3-page sets, optional 50-page generated set).

## Generate

```bash
# CI-ish (50 pages)
python3 scripts/generate-large-fixture.py --pages 50

# Manual / nightly (300 pages)
python3 scripts/generate-large-fixture.py --pages 300 --out scripts/fixtures/large-300.pdf

# Upload/storage stress (padding is NOT valid PDF content beyond the real pages —
# prefer real public-domain plan sets for true 800MB vector stress)
python3 scripts/generate-large-fixture.py --pages 300 --pad-mb 100
```

## Manual acceptance steps
1. `pnpm --filter @plansimple/api seed` (or use demo login).
2. Upload the generated PDF to a project.
3. Confirm per-page processing reaches `ready` (async).
4. Pan/zoom page 1 and a mid-set page; confirm tiles stream and text search finds `SEARCHABLE_TOKEN_ROOF_DRAIN`.
5. Record wall-clock time-to-first-page and time-to-all-ready in the nightly notes.

## Notes
- True 800MB E1 vector sets should be sourced from public-domain plan archives when available; synthetic padding only stresses object storage/upload paths.
- Agent VMs may be too small for 300-page tile pyramids at all zoom levels — run on a Docker host with ≥8 CPU / 16GB RAM when possible.
