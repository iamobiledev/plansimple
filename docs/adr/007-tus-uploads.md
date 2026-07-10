# ADR-007: tus resumable uploads to object storage

## Status
Accepted (Phase 1)

## Context
PDFs up to 2GB cannot pass through API body limits.

## Decision
Use tus (or equivalent) with signed URLs direct to MinIO/S3. API records document/revision metadata on upload completion and enqueues ingest.

## Consequences
- Client uploads bypass API
- Need careful auth on signed URLs and completion webhooks
