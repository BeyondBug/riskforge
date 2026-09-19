"""Control candidates and budget-optimizer request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Control(BaseModel):
    """A candidate remediation with a cost and a proportional EAL reduction."""

    control_id: str = Field(min_length=1, max_length=64)
    finding_id: str = Field(min_length=1, max_length=64)
    asset_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    description: str = ""

    cost_inr: float = Field(gt=0.0)
    eal_reduction_pct: float = Field(ge=0.0, le=1.0)

    current_eal_inr: float = Field(default=0.0, ge=0.0)
    eal_reduction_inr: float = Field(default=0.0, ge=0.0)

    @property
    def roi(self) -> float:
        """Rupees of modeled EAL removed per rupee spent."""
        return self.eal_reduction_inr / self.cost_inr if self.cost_inr else 0.0


class SelectedControl(BaseModel):
    control_id: str
    name: str
    asset_id: str
    finding_id: str
    cost_inr: float
    eal_reduction_inr: float
    eal_reduction_pct: float
    roi: float


class OptimizationRequest(BaseModel):
    budget_inr: float = Field(gt=0.0, le=1_000_000_000.0)
    assessment_id: str | None = None


class OptimizationResult(BaseModel):
    assessment_id: str
    budget_inr: float
    solver: str

    selected: list[SelectedControl] = Field(default_factory=list)
    rejected: list[SelectedControl] = Field(default_factory=list)

    total_cost_inr: float = 0.0
    budget_remaining_inr: float = 0.0
    total_eal_reduction_inr: float = 0.0

    eal_before_inr: float = 0.0
    eal_after_inr: float = 0.0
    reduction_pct_of_portfolio: float = 0.0

    disclaimer: str = (
        "Modeled estimates based on supplied inputs. "
        "Not a guarantee of actual losses."
    )
