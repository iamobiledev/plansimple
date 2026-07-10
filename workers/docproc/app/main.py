from fastapi import FastAPI
import structlog

logger = structlog.get_logger()

app = FastAPI(title="PlanSimple DocProc")


@app.get("/health")
async def health() -> dict[str, str]:
    logger.info("health_check", service="plansimple-docproc")
    return {"status": "ok", "service": "plansimple-docproc"}
