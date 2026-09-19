"""PDF report generation and download."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.reports.generator import build_report_pdf
from app.services.s3 import get_s3_service
from app.store import store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate")
def generate() -> dict:
    """Render the executive PDF, store it, return a download reference."""
    assessment = store.ensure_assessment()

    try:
        pdf = build_report_pdf(assessment, store.optimization)
    except Exception as exc:
        logger.exception("report generation failed")
        raise HTTPException(status_code=500, detail="Report generation failed") from exc

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"reports/{assessment.assessment_id}-{stamp}.pdf"

    reference = get_s3_service().upload_report(key, pdf)
    reference.update(
        {
            "assessment_id": assessment.assessment_id,
            "size_bytes": len(pdf),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "includes_optimization": store.optimization is not None,
            "disclaimer": assessment.disclaimer,
        }
    )
    return reference


@router.get("/download/{filename}")
def download(filename: str):
    """Serve a locally stored report when S3 is not in use."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = get_s3_service().local_path(filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(path, media_type="application/pdf", filename=filename)
