"""Liveness and dependency status."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.config import get_settings
from app.services.bedrock import get_bedrock_service
from app.services.dynamodb import get_dynamodb_service
from app.services.s3 import get_s3_service

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    """Always reports healthy if the process is serving; see /api/health/deps."""
    return {"status": "healthy"}


@router.get("/api/health/deps")
def dependencies() -> dict:
    """Which AWS services are live and which are running on a fallback."""
    settings = get_settings()
    return {
        "status": "healthy",
        "version": __version__,
        "region": settings.aws_region,
        "environment": settings.app_env,
        "dynamodb": get_dynamodb_service().status,
        "s3": get_s3_service().status,
        "bedrock": get_bedrock_service().status,
    }
