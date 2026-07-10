import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()

app = FastAPI(title="PlanSimple AI", version="0.1.0")


def require_anthropic() -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Set ANTHROPIC_API_KEY. Core PlanSimple features remain available.",
        )


class SheetIndexRequest(BaseModel):
    image_base64: str = Field(min_length=1)


class NlSearchRequest(BaseModel):
    query: str
    page_summaries: list[dict[str, Any]] = Field(default_factory=list)


class DraftRfiRequest(BaseModel):
    markup_subject: str
    comments: list[str] = Field(default_factory=list)


@app.get("/health")
async def health() -> dict[str, Any]:
    configured = bool(os.getenv("ANTHROPIC_API_KEY"))
    if not configured:
        logger.info("ai_features_degraded", reason="ANTHROPIC_API_KEY unset")
    return {
        "status": "ok",
        "service": "plansimple-ai",
        "anthropicConfigured": configured,
        "degraded": not configured,
    }


@app.post("/v1/sheet-index")
async def sheet_index(body: SheetIndexRequest) -> dict[str, Any]:
    require_anthropic()
    # Placeholder until vision pipeline is wired; JSON-schema shaped.
    _ = body.image_base64[:16]
    return {
        "sheetNumber": "A-101",
        "sheetTitle": "Floor Plan — Level 1",
        "discipline": "Architectural",
        "revision": "A",
        "confidence": 0.42,
        "verifyMe": True,
    }


@app.post("/v1/nl-search")
async def nl_search(body: NlSearchRequest) -> dict[str, Any]:
    require_anthropic()
    q = body.query.lower()
    results = []
    for page in body.page_summaries:
        text = str(page.get("summary") or page.get("text") or "").lower()
        sheet = page.get("sheetNumber") or page.get("sheet_number") or "—"
        if q and q in text:
            results.append({"sheetNumber": sheet, "score": 0.9, "snippet": text[:180]})
    if not results and body.page_summaries:
        first = body.page_summaries[0]
        results.append(
            {
                "sheetNumber": first.get("sheetNumber") or "—",
                "score": 0.1,
                "snippet": "No strong match (placeholder ranking)",
            }
        )
    return {"results": results, "verifyMe": True}


@app.post("/v1/draft-rfi")
async def draft_rfi(body: DraftRfiRequest) -> dict[str, Any]:
    require_anthropic()
    comments = "\n".join(f"- {c}" for c in body.comments) or "- (no comments)"
    return {
        "number": "RFI-DRAFT-001",
        "title": f"Clarification: {body.markup_subject}",
        "body": (
            f"Please clarify the following regarding **{body.markup_subject}**:\n\n"
            f"{comments}\n\n"
            "Please advise."
        ),
        "references": [],
        "verifyMe": True,
    }
