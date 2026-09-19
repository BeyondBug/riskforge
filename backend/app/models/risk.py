"""Risk computation output models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LikelihoodBreakdown(BaseModel):
    """Each weighted term of LIKELIHOOD, kept so the UI can show the audit trail."""

    norm_cvss: float = Field(ge=0.0, le=1.0)
    exploitability: float = Field(ge=0.0, le=1.0)
    patch_age_score: float = Field(ge=0.0, le=1.0)
    exposure_score: float = Field(ge=0.0, le=1.0)
    control_gap: float = Field(ge=0.0, le=1.0)
    threat_intel_score: float = Field(ge=0.0, le=1.0)

    weighted_terms: dict[str, float] = Field(default_factory=dict)
    likelihood: float = Field(ge=0.0, le=1.0)


class LossBreakdown(BaseModel):
    """The six additive components of LOSS_MAGNITUDE, in rupees."""

    downtime_inr: float = Field(ge=0.0)
    incident_response_inr: float = Field(ge=0.0)
    recovery_inr: float = Field(ge=0.0)
    data_breach_inr: float = Field(ge=0.0)
    regulatory_inr: float = Field(ge=0.0)
    reputation_inr: float = Field(ge=0.0)
    loss_magnitude_inr: float = Field(ge=0.0)

    formulas: dict[str, str] = Field(default_factory=dict)


class RiskResult(BaseModel):
    """EAL for one finding on one asset."""

    finding_id: str
    asset_id: str
    asset_name: str
    title: str
    cve_id: str | None = None
    severity_score: float

    likelihood: LikelihoodBreakdown
    loss: LossBreakdown
    eal_inr: float = Field(ge=0.0)

    disclaimer: str = (
        "Modeled estimates based on supplied inputs. "
        "Not a guarantee of actual losses."
    )


class PortfolioAssessment(BaseModel):
    """Aggregate view across every finding."""

    assessment_id: str
    created_at: str
    dataset_label: str = "Synthetic Demo Dataset"

    results: list[RiskResult] = Field(default_factory=list)
    total_eal_inr: float = Field(default=0.0, ge=0.0)
    assets_at_risk: int = Field(default=0, ge=0)
    findings_count: int = Field(default=0, ge=0)
    eal_by_asset_inr: dict[str, float] = Field(default_factory=dict)

    disclaimer: str = (
        "Modeled estimates based on supplied inputs. "
        "Not a guarantee of actual losses."
    )
