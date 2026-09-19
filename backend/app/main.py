"""RiskForge FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api import advisor, assessments, health, reports
from app.config import DISCLAIMER, get_settings
from app.store import store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("riskforge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("RiskForge %s starting in %s", __version__, settings.app_env)
    store.load_dataset()
    store.run_assessment()
    logger.info(
        "Initial assessment %s: %d findings, total modeled EAL INR %.2f",
        store.assessment.assessment_id,
        store.assessment.findings_count,
        store.assessment.total_eal_inr,
    )
    yield
    logger.info("RiskForge shutting down")


settings = get_settings()

app = FastAPI(
    title="RiskForge API",
    version=__version__,
    description=(
        "Deterministic cyber risk quantification. Every rupee figure traces to "
        "a documented input and formula. " + DISCLAIMER
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Field-level detail is safe; it describes the request, not the server."""
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    """No stack traces to the client in production."""
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    if settings.is_production:
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"},
        )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": f"{type(exc).__name__}: {exc}"},
    )


app.include_router(health.router)
app.include_router(assessments.router)
app.include_router(advisor.router)
app.include_router(reports.router)


@app.get("/api", tags=["health"])
def root() -> dict:
    return {
        "name": "RiskForge API",
        "version": __version__,
        "docs": "/docs",
        "disclaimer": DISCLAIMER,
    }
