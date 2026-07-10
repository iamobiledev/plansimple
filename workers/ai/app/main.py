import os

from fastapi import FastAPI
import structlog

logger = structlog.get_logger()

app = FastAPI(title="PlanSimple AI")


@app.get("/health")
async def health() -> dict[str, str | bool]:
    anthropic_configured = bool(os.getenv("ANTHROPIC_API_KEY"))
    if not anthropic_configured:
        logger.info("ai_features_degraded", reason="ANTHROPIC_API_KEY unset")

    return {
        "status": "ok",
        "service": "plansimple-ai",
        "anthropicConfigured": anthropic_configured,
        "degraded": not anthropic_configured,
    }
