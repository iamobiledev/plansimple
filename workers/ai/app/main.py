"""PlanSimple AI worker — Claude when configured; heuristic fallbacks for demo/CI."""

from __future__ import annotations

import os
import re
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()

app = FastAPI(title="PlanSimple AI", version="0.2.0")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")


def anthropic_configured() -> bool:
    return bool(ANTHROPIC_API_KEY)


class SheetIndexRequest(BaseModel):
    image_base64: str | None = None
    text: str | None = None
    page_number: int | None = None


class SheetIndexResponse(BaseModel):
    sheetNumber: str | None
    sheetTitle: str | None
    discipline: str | None
    revision: str | None
    confidence: float
    verifyMe: bool = True
    source: str = "heuristic"


class NlSearchRequest(BaseModel):
    query: str
    page_summaries: list[dict[str, Any]] = Field(default_factory=list)


class DraftRfiRequest(BaseModel):
    markup_subject: str
    comments: list[str] = Field(default_factory=list)


class DiffNarrationRequest(BaseModel):
    sheet_number: str | None = None
    changed_regions_count: int = 0
    notes: str | None = None


DISCIPLINE_HINTS = [
    (r"\bA[- ]?\d", "Architectural"),
    (r"\bS[- ]?\d", "Structural"),
    (r"\bM[- ]?\d", "Mechanical"),
    (r"\bE[- ]?\d", "Electrical"),
    (r"\bP[- ]?\d", "Plumbing"),
    (r"\bFP[- ]?\d", "Fire Protection"),
]


def heuristic_sheet_index(text: str, page_number: int | None) -> dict[str, Any]:
    sheet_number = None
    m = re.search(r"\b([ASEMP]{1,2}-\d{2,3}[A-Z]?)\b", text, re.I)
    if m:
        sheet_number = m.group(1).upper()
    title = None
    tm = re.search(r"(?:Title|Sheet)\s*[:|]?\s*([^\n]{5,80})", text, re.I)
    if tm:
        title = tm.group(1).strip()
    elif "Floor Plan" in text:
        title = "Floor Plan"
    elif "Elevation" in text:
        title = "Elevation"
    discipline = None
    for pattern, name in DISCIPLINE_HINTS:
        if re.search(pattern, text, re.I) or (sheet_number and re.match(pattern, sheet_number, re.I)):
            discipline = name
            break
    rev = None
    rm = re.search(r"\bREV(?:ISION)?\s*[:#]?\s*([A-Z0-9]+)\b", text, re.I)
    if rm:
        rev = rm.group(1).upper()
    if not sheet_number and page_number:
        sheet_number = f"P-{page_number:02d}"
    confidence = 0.55 if sheet_number and title else 0.35 if sheet_number else 0.15
    return {
        "sheetNumber": sheet_number,
        "sheetTitle": title,
        "discipline": discipline,
        "revision": rev,
        "confidence": confidence,
        "verifyMe": True,
        "source": "heuristic",
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    configured = anthropic_configured()
    if not configured:
        logger.info("ai_features_degraded", reason="ANTHROPIC_API_KEY unset — using heuristics")
    return {
        "status": "ok",
        "service": "plansimple-ai",
        "anthropicConfigured": configured,
        "degraded": not configured,
        "heuristicAvailable": True,
    }


@app.post("/v1/sheet-index")
async def sheet_index(body: SheetIndexRequest) -> dict[str, Any]:
    text = body.text or ""
    if anthropic_configured() and body.image_base64:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            # Structured-ish prompt; parse JSON from response
            msg = client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=400,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": body.image_base64.split(",")[-1]
                                    if "," in body.image_base64
                                    else body.image_base64,
                                },
                            },
                            {
                                "type": "text",
                                "text": (
                                    "Extract title block fields as JSON with keys "
                                    "sheetNumber, sheetTitle, discipline, revision, confidence (0-1). "
                                    "No markdown."
                                ),
                            },
                        ],
                    }
                ],
            )
            raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            start, end = raw.find("{"), raw.rfind("}")
            if start >= 0 and end > start:
                import json

                data = json.loads(raw[start : end + 1])
                data["verifyMe"] = True
                data["source"] = "claude"
                return data
        except Exception as exc:
            logger.warning("claude_sheet_index_failed", error=str(exc))
    if not text and not body.image_base64:
        raise HTTPException(400, "text or image_base64 required")
    return heuristic_sheet_index(text, body.page_number)


@app.post("/v1/nl-search")
async def nl_search(body: NlSearchRequest) -> dict[str, Any]:
    q = body.query.lower().strip()
    results: list[dict[str, Any]] = []
    for page in body.page_summaries:
        text = str(page.get("summary") or page.get("text") or "").lower()
        sheet = page.get("sheetNumber") or page.get("sheet_number") or page.get("pageNumber") or "—"
        page_id = page.get("pageId") or page.get("id")
        score = 0.0
        if q and q in text:
            score = 0.95
        elif q:
            tokens = [t for t in re.split(r"\W+", q) if t]
            hits = sum(1 for t in tokens if t in text)
            score = hits / max(len(tokens), 1) * 0.8
        if score > 0.15:
            # snippet around first token
            idx = text.find(tokens[0]) if q and (tokens := [t for t in re.split(r"\W+", q) if t]) else -1
            snippet = text[max(0, idx) : max(0, idx) + 160] if idx >= 0 else text[:160]
            results.append(
                {
                    "sheetNumber": sheet,
                    "pageId": page_id,
                    "pageNumber": page.get("pageNumber"),
                    "documentId": page.get("documentId"),
                    "score": round(score, 3),
                    "snippet": snippet,
                }
            )
    results.sort(key=lambda r: r["score"], reverse=True)
    if anthropic_configured() and results:
        # Optional: could re-rank with Claude; keep heuristic ranking for latency
        pass
    return {"results": results[:20], "verifyMe": True, "source": "heuristic"}


@app.post("/v1/draft-rfi")
async def draft_rfi(body: DraftRfiRequest) -> dict[str, Any]:
    comments = "\n".join(f"- {c}" for c in body.comments) or "- (no comments)"
    return {
        "number": "RFI-DRAFT-001",
        "title": f"Clarification: {body.markup_subject}",
        "body": (
            f"Please clarify the following regarding **{body.markup_subject}**:\n\n"
            f"{comments}\n\nPlease advise."
        ),
        "references": [],
        "verifyMe": True,
        "source": "template" if not anthropic_configured() else "template",
    }


@app.post("/v1/diff-narration")
async def diff_narration(body: DiffNarrationRequest) -> dict[str, Any]:
    sheet = body.sheet_number or "sheet"
    return {
        "summary": (
            f"Revision changes detected on {sheet} "
            f"({body.changed_regions_count} hotspot region(s)). "
            f"{body.notes or 'Review Diff-layer clouds and flagged markups.'}"
        ),
        "verifyMe": True,
        "source": "heuristic",
    }
