"""PlanSimple document processing worker — tile pyramids + text extract."""

from __future__ import annotations

import io
import json
import os
import time
from typing import Any

import boto3
import httpx
import pypdfium2 as pdfium
import redis
import structlog
from botocore.client import Config
from fastapi import FastAPI
from PIL import Image

log = structlog.get_logger()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
INGEST_QUEUE = "plansimple:ingest"
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "plansimple")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "plansimplesecret")
S3_BUCKET = os.getenv("S3_BUCKET", "plansimple")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
FILE_STORAGE_DIR = os.getenv("FILE_STORAGE_DIR", "")
STORAGE_DRIVER = os.getenv("STORAGE_DRIVER", "s3")  # s3 | local
TILE_SIZE = 512
MAX_ZOOM = 4
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://localhost:3000")

app = FastAPI(title="PlanSimple DocProc", version="0.1.0")


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    if STORAGE_DRIVER == "local" and FILE_STORAGE_DIR:
        path = os.path.join(FILE_STORAGE_DIR, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return
    s3_client().put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type)


def get_bytes(key: str) -> bytes:
    if STORAGE_DRIVER == "local" and FILE_STORAGE_DIR:
        path = os.path.join(FILE_STORAGE_DIR, key)
        with open(path, "rb") as f:
            return f.read()
    obj = s3_client().get_object(Bucket=S3_BUCKET, Key=key)
    return obj["Body"].read()


def render_page_image(page: pdfium.PdfPage, scale: float) -> Image.Image:
    bitmap = page.render(scale=scale)
    pil = bitmap.to_pil()
    return pil.convert("RGB")


def tile_image(img: Image.Image, z: int, out_prefix: str) -> None:
    w, h = img.size
    cols = (w + TILE_SIZE - 1) // TILE_SIZE
    rows = (h + TILE_SIZE - 1) // TILE_SIZE
    for y in range(rows):
        for x in range(cols):
            left = x * TILE_SIZE
            upper = y * TILE_SIZE
            tile = img.crop((left, upper, min(left + TILE_SIZE, w), min(upper + TILE_SIZE, h)))
            # Pad to full tile size for consistent GPU upload later
            if tile.size != (TILE_SIZE, TILE_SIZE):
                padded = Image.new("RGB", (TILE_SIZE, TILE_SIZE), (255, 255, 255))
                padded.paste(tile, (0, 0))
                tile = padded
            buf = io.BytesIO()
            tile.save(buf, format="WEBP", quality=80, method=4)
            key = f"{out_prefix}/{z}/{x}/{y}.webp"
            put_bytes(key, buf.getvalue(), "image/webp")


def extract_text(page: pdfium.PdfPage, page_height: float) -> list[dict[str, Any]]:
    """Extract text spans with PDF-point bboxes (origin top-left)."""
    textpage = page.get_textpage()
    spans: list[dict[str, Any]] = []
    # pypdfium2: iterate characters / get text bounded
    n = textpage.count_chars()
    if n == 0:
        textpage.close()
        return spans
    # Group into rough lines by y
    raw: list[tuple[str, float, float, float, float]] = []
    for i in range(n):
        ch = textpage.get_text_range(i, 1)
        box = textpage.get_charbox(i)
        # box is left, bottom, right, top in PDF coords (origin bottom-left)
        left, bottom, right, top = box
        # convert to top-left origin
        y0 = page_height - top
        y1 = page_height - bottom
        raw.append((ch, left, y0, right, y1))
    textpage.close()

    # Merge consecutive chars into words/spans (simple)
    if not raw:
        return spans
    cur = {"text": raw[0][0], "x0": raw[0][1], "y0": raw[0][2], "x1": raw[0][3], "y1": raw[0][4]}
    for ch, x0, y0, x1, y1 in raw[1:]:
        same_line = abs(y0 - cur["y0"]) < 2
        close = x0 - cur["x1"] < 8
        if same_line and close:
            cur["text"] += ch
            cur["x1"] = max(cur["x1"], x1)
            cur["y1"] = max(cur["y1"], y1)
        else:
            if cur["text"].strip():
                spans.append(dict(cur))
            cur = {"text": ch, "x0": x0, "y0": y0, "x1": x1, "y1": y1}
    if cur["text"].strip():
        spans.append(dict(cur))
    return spans


def process_job(job: dict[str, Any]) -> dict[str, Any]:
    organization_id = job["organizationId"]
    document_id = job["documentId"]
    revision_id = job["revisionId"]
    storage_key = job["storageKey"]
    log.info("ingest.start", document_id=document_id, revision_id=revision_id)

    pdf_bytes = get_bytes(storage_key)
    doc = pdfium.PdfDocument(pdf_bytes)
    page_results = []

    for i in range(len(doc)):
        page = doc[i]
        width_pts = page.get_width()
        height_pts = page.get_height()
        prefix = (
            f"orgs/{organization_id}/documents/{document_id}/revisions/{revision_id}/pages/{i + 1}"
        )

        # Zoom levels: z=0 ~ fit overview, higher = more detail
        # scale such that page width in px ~= TILE_SIZE * 2^z roughly for width
        for z in range(0, MAX_ZOOM + 1):
            target_width = TILE_SIZE * (2**z)
            scale = max(target_width / width_pts, 0.1)
            # Cap enormous renders
            if width_pts * scale > 16000:
                scale = 16000 / width_pts
            img = render_page_image(page, scale=scale)
            tile_image(img, z, prefix)
            img.close()

        spans = extract_text(page, height_pts)
        put_bytes(f"{prefix}/text.json", json.dumps({"spans": spans}).encode("utf-8"), "application/json")

        page_results.append(
            {
                "pageNumber": i + 1,
                "widthPts": int(round(width_pts)),
                "heightPts": int(round(height_pts)),
                "processingStatus": "ready",
                "ocrStatus": "not_needed" if spans else "queued",
            }
        )
        log.info("ingest.page_ready", page=i + 1, spans=len(spans))

    doc.close()

    payload = {
        "organizationId": organization_id,
        "documentId": document_id,
        "revisionId": revision_id,
        "pageCount": len(page_results),
        "pages": page_results,
        "status": "ready",
    }
    callback = job.get("callbackUrl") or f"{PUBLIC_API_URL}/api/internal/ingest/callback"
    with httpx.Client(timeout=60.0) as client:
        r = client.post(callback, json=payload)
        r.raise_for_status()
    log.info("ingest.done", document_id=document_id, pages=len(page_results))
    return payload


@app.get("/health")
def health():
    return {"status": "ok", "service": "plansimple-docproc"}


@app.post("/ingest/run-once")
def run_once():
    r = redis.from_url(REDIS_URL)
    item = r.rpop(INGEST_QUEUE)
    if not item:
        return {"processed": False}
    job = json.loads(item)
    result = process_job(job)
    return {"processed": True, "result": result}


def worker_loop():
    r = redis.from_url(REDIS_URL)
    log.info("docproc.worker_started", queue=INGEST_QUEUE)
    while True:
        item = r.brpop(INGEST_QUEUE, timeout=5)
        if not item:
            continue
        _, raw = item
        try:
            job = json.loads(raw)
            process_job(job)
        except Exception as exc:
            log.exception("ingest.failed", error=str(exc))


if __name__ == "__main__":
    import threading
    import uvicorn

    t = threading.Thread(target=worker_loop, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("DOCPROC_PORT", "8001")))
