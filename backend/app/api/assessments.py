"""Assessment, findings and budget-optimizer endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.models.recommendation import OptimizationRequest, OptimizationResult
from app.models.risk import PortfolioAssessment
from app.optimizer.budget import optimize_budget
from app.store import store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["assessments"])


@router.get("/assets")
def list_assets() -> dict:
    return {
        "dataset_label": store.dataset_label,
        "count": len(store.assets),
        "assets": [a.model_dump() for a in store.assets],
    }


@router.get("/findings")
def list_findings() -> dict:
    """Findings joined with their computed EAL, sorted highest exposure first."""
    assessment = store.ensure_assessment()
    by_id = {f.finding_id: f for f in store.findings}

    rows = []
    for r in assessment.results:
        finding = by_id.get(r.finding_id)
        rows.append(
            {
                "finding_id": r.finding_id,
                "asset_id": r.asset_id,
                "asset_name": r.asset_name,
                "title": r.title,
                "cve_id": r.cve_id,
                "severity_score": r.severity_score,
                "score_source": finding.score_source if finding else "unknown",
                "exposure": finding.exposure.value if finding else None,
                "days_open": finding.days_open if finding else None,
                "status": finding.status.value if finding else None,
                "likelihood": round(r.likelihood.likelihood, 4),
                "loss_magnitude_inr": round(r.loss.loss_magnitude_inr, 2),
                "eal_inr": round(r.eal_inr, 2),
            }
        )

    return {
        "dataset_label": store.dataset_label,
        "count": len(rows),
        "findings": rows,
        "disclaimer": assessment.disclaimer,
    }


@router.post("/assessments", response_model=PortfolioAssessment)
def create_assessment() -> PortfolioAssessment:
    """Re-score the whole portfolio and persist the result."""
    return store.run_assessment()


@router.get("/assessments/current", response_model=PortfolioAssessment)
def current_assessment() -> PortfolioAssessment:
    return store.ensure_assessment()


@router.get("/assessments/{assessment_id}", response_model=PortfolioAssessment)
def get_assessment(assessment_id: str) -> PortfolioAssessment:
    assessment = store.ensure_assessment()
    if assessment.assessment_id != assessment_id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@router.get("/controls")
def list_controls() -> dict:
    controls = store.controls_with_eal()
    return {
        "dataset_label": store.dataset_label,
        "count": len(controls),
        "controls": [
            {**c.model_dump(), "roi": round(c.roi, 4)} for c in controls
        ],
    }


@router.post("/optimize", response_model=OptimizationResult)
def optimize(request: OptimizationRequest) -> OptimizationResult:
    """Pick the control set that removes the most modeled EAL within budget."""
    assessment = store.ensure_assessment()
    if request.assessment_id and request.assessment_id != assessment.assessment_id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    controls = store.controls_with_eal()

    try:
        result = optimize_budget(
            controls=controls,
            budget_inr=request.budget_inr,
            assessment_id=request.assessment_id or assessment.assessment_id,
            portfolio_eal_inr=assessment.total_eal_inr,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("optimizer failed")
        raise HTTPException(status_code=500, detail="Optimization failed") from exc

    store.optimization = result
    store.persist_recommendations(result)
    return result


@router.get("/optimizations/current", response_model=OptimizationResult)
def current_optimization() -> OptimizationResult:
    """Return the explicitly created plan used by advisor and report flows."""
    if store.optimization is None:
        raise HTTPException(status_code=404, detail="No optimization plan has been created")
    return store.optimization
