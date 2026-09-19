"""The RiskForge risk engine.

LIKELIHOOD = 0.25*norm_cvss + 0.20*exploitability + 0.15*patch_age
           + 0.15*exposure + 0.15*(1 - control_effectiveness)
           + 0.10*threat_intel                      (all terms in 0.0-1.0)

LOSS_MAGNITUDE = downtime + incident_response + recovery
               + data_breach + regulatory + reputation        (in INR)

EAL = LIKELIHOOD * LOSS_MAGNITUDE
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.asset import Asset
from app.models.finding import Finding
from app.models.finding import FindingStatus
from app.models.risk import (
    LikelihoodBreakdown,
    LossBreakdown,
    PortfolioAssessment,
    RiskResult,
)
from app.risk import normalizer as nz

#: Likelihood weights. Must sum to exactly 1.0.
WEIGHTS: dict[str, float] = {
    "norm_cvss": 0.25,
    "exploitability": 0.20,
    "patch_age_score": 0.15,
    "exposure_score": 0.15,
    "control_gap": 0.15,
    "threat_intel_score": 0.10,
}

_WEIGHT_SUM = round(sum(WEIGHTS.values()), 10)
if _WEIGHT_SUM != 1.0:  # pragma: no cover - guards a typo, not a runtime path
    raise RuntimeError(f"LIKELIHOOD weights must sum to 1.0, got {_WEIGHT_SUM}")

LOSS_FORMULAS: dict[str, str] = {
    "downtime_inr": "revenue_per_hour_inr * downtime_hours",
    "incident_response_inr": "ir_day_rate_inr * ir_days",
    "recovery_inr": "rebuild_cost_inr + data_restoration_cost_inr",
    "data_breach_inr": "records_exposed * cost_per_record_inr",
    "regulatory_inr": (
        "min(records_exposed * regulatory_rate_per_record_inr, regulatory_cap_inr)"
    ),
    "reputation_inr": "business_value_inr * reputation_factor",
    "loss_magnitude_inr": "sum of the six components above",
}


def compute_likelihood(finding: Finding) -> LikelihoodBreakdown:
    """Weighted sum of six normalized drivers. Deterministic."""
    components = {
        "norm_cvss": nz.norm_cvss(finding.severity_score),
        "exploitability": nz.exploitability_score(finding.exploit_maturity),
        "patch_age_score": nz.patch_age_score(finding.days_open),
        "exposure_score": nz.exposure_score(finding.exposure),
        "control_gap": nz.control_gap(finding.control_effectiveness),
        "threat_intel_score": nz.threat_intel_score(finding.threat_intel),
    }

    weighted = {name: WEIGHTS[name] * value for name, value in components.items()}
    likelihood = nz.clamp01(sum(weighted.values()))

    return LikelihoodBreakdown(
        norm_cvss=components["norm_cvss"],
        exploitability=components["exploitability"],
        patch_age_score=components["patch_age_score"],
        exposure_score=components["exposure_score"],
        control_gap=components["control_gap"],
        threat_intel_score=components["threat_intel_score"],
        weighted_terms={k: round(v, 6) for k, v in weighted.items()},
        likelihood=likelihood,
    )


def compute_loss_magnitude(asset: Asset) -> LossBreakdown:
    """Six additive loss components, each derived from the asset's drivers."""
    d = asset.loss_drivers

    downtime = d.revenue_per_hour_inr * d.downtime_hours
    incident_response = d.ir_day_rate_inr * d.ir_days
    recovery = d.rebuild_cost_inr + d.data_restoration_cost_inr
    data_breach = d.records_exposed * d.cost_per_record_inr

    regulatory_uncapped = d.records_exposed * d.regulatory_rate_per_record_inr
    regulatory = (
        min(regulatory_uncapped, d.regulatory_cap_inr)
        if d.regulatory_cap_inr > 0
        else regulatory_uncapped
    )

    reputation = asset.business_value_inr * d.reputation_factor

    total = (
        downtime + incident_response + recovery + data_breach + regulatory + reputation
    )

    return LossBreakdown(
        downtime_inr=downtime,
        incident_response_inr=incident_response,
        recovery_inr=recovery,
        data_breach_inr=data_breach,
        regulatory_inr=regulatory,
        reputation_inr=reputation,
        loss_magnitude_inr=total,
        formulas=LOSS_FORMULAS,
    )


def compute_eal(asset: Asset, finding: Finding) -> RiskResult:
    """EAL = LIKELIHOOD * LOSS_MAGNITUDE for one finding on one asset."""
    if finding.asset_id != asset.asset_id:
        raise ValueError(
            f"finding {finding.finding_id} belongs to asset {finding.asset_id}, "
            f"not {asset.asset_id}"
        )

    likelihood = compute_likelihood(finding)
    loss = compute_loss_magnitude(asset)

    return RiskResult(
        finding_id=finding.finding_id,
        asset_id=asset.asset_id,
        asset_name=asset.name,
        title=finding.title,
        cve_id=finding.cve_id,
        severity_score=finding.severity_score,
        likelihood=likelihood,
        loss=loss,
        eal_inr=likelihood.likelihood * loss.loss_magnitude_inr,
    )


def assess_portfolio(
    assets: list[Asset],
    findings: list[Finding],
    assessment_id: str | None = None,
) -> PortfolioAssessment:
    """Score every open finding and aggregate by asset.

    Findings whose asset is missing are skipped rather than guessed at.
    """
    index = {a.asset_id: a for a in assets}

    results: list[RiskResult] = []
    for finding in findings:
        # Portfolio exposure represents actionable, unresolved risk. Retained
        # findings remain in the source dataset but do not inflate this total.
        if finding.status is not FindingStatus.OPEN:
            continue
        asset = index.get(finding.asset_id)
        if asset is None:
            continue
        results.append(compute_eal(asset, finding))

    results.sort(key=lambda r: r.eal_inr, reverse=True)

    eal_by_asset: dict[str, float] = {}
    for r in results:
        eal_by_asset[r.asset_name] = eal_by_asset.get(r.asset_name, 0.0) + r.eal_inr

    return PortfolioAssessment(
        assessment_id=assessment_id or f"asmt-{uuid.uuid4().hex[:12]}",
        created_at=datetime.now(timezone.utc).isoformat(),
        results=results,
        total_eal_inr=sum(r.eal_inr for r in results),
        assets_at_risk=len({r.asset_id for r in results}),
        findings_count=len(results),
        eal_by_asset_inr=eal_by_asset,
    )
