# ADR-009: PDF points as geometry coordinate space

## Status
Accepted

## Context
Need a stable space for markups/measurements across zoom and tile levels.

## Decision
Store geometry in PDF points (1/72"), origin top-left consistent with page rendering. Calibration maps points → real-world units (ft/m) at takeoff time.

## Consequences
- Matches PDFium page size
- Display converts via camera + calibration
- Legacy PlanSimple “sheet pixels at scale 1” maps cleanly to this model
