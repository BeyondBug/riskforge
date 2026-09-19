"""Builds the bounded JSON context handed to Bedrock and returns the answer.

The model receives a whitelist of already-computed fields. It never sees the
raw drivers or the formulas, so it has nothing to recompute from, and the
system prompt forbids it from producing any number outside this payload.
"""

from __future__ import annotations

from app.models.recommendation import OptimizationResult
from app.models.risk import PortfolioAssessment
from app.services.bedrock import get_bedrock_service

MAX_QUESTION_CHARS = 500
TOP_FINDINGS = 5


def build_context(
    assessment: PortfolioAssessment,
    optimization: OptimizationResult | None = None,
) -> dict:
    """Whitelist of computed values the model is allowed to talk about."""
    context: dict = {
        "dataset_label": assessment.dataset_label,
        "totals": {
            "total_modeled_annual_exposure_inr": round(assessment.total_eal_inr, 2),
            "findings_count": assessment.findings_count,
            "assets_at_risk": assessment.assets_at_risk,
        },
        "top_findings": [
            {
                "finding_id": r.finding_id,
                "title": r.title,
                "cve_id": r.cve_id,
                "asset_name": r.asset_name,
                "severity_score": r.severity_score,
                "likelihood": round(r.likelihood.likelihood, 4),
                "loss_magnitude_inr": round(r.loss.loss_magnitude_inr, 2),
                "eal_inr": round(r.eal_inr, 2),
            }
            for r in assessment.results[:TOP_FINDINGS]
        ],
        "disclaimer": assessment.disclaimer,
    }

    if optimization is not None:
        context["budget_inr"] = optimization.budget_inr
        context["solver"] = optimization.solver
        context["selected_controls"] = [
            {
                "control_id": s.control_id,
                "name": s.name,
                "cost_inr": s.cost_inr,
                "eal_reduction_inr": round(s.eal_reduction_inr, 2),
                "eal_reduction_pct": s.eal_reduction_pct,
                "roi_inr_reduced_per_inr_spent": s.roi,
            }
            for s in optimization.selected
        ]
        context["rejected_controls"] = [
            {
                "control_id": s.control_id,
                "name": s.name,
                "cost_inr": s.cost_inr,
                "eal_reduction_inr": round(s.eal_reduction_inr, 2),
                "roi_inr_reduced_per_inr_spent": s.roi,
            }
            for s in optimization.rejected
        ]
        context["totals"].update(
            {
                "total_cost_inr": round(optimization.total_cost_inr, 2),
                "budget_remaining_inr": round(optimization.budget_remaining_inr, 2),
                "total_eal_reduction_inr": round(
                    optimization.total_eal_reduction_inr, 2
                ),
                "eal_after_inr": round(optimization.eal_after_inr, 2),
            }
        )

    return context


def answer_question(
    question: str,
    assessment: PortfolioAssessment,
    optimization: OptimizationResult | None = None,
) -> dict:
    question = (question or "").strip()
    if not question:
        raise ValueError("question must not be empty")
    if len(question) > MAX_QUESTION_CHARS:
        raise ValueError(
            f"question must be {MAX_QUESTION_CHARS} characters or fewer"
        )

    context = build_context(assessment, optimization)
    result = get_bedrock_service().explain(question, context)

    return {
        "question": question,
        "answer": result["answer"],
        "mode": result["mode"],
        "reason": result.get("reason"),
        "context_used": context,
        "notice": "AI explains deterministic outputs only.",
        "disclaimer": assessment.disclaimer,
    }
