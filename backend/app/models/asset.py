"""Asset model and the loss drivers every rupee figure traces back to."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LossDrivers(BaseModel):
    """Raw inputs for LOSS_MAGNITUDE.

    No rupee figure in RiskForge is entered directly as a total. Each of the
    six loss components is derived from the fields below, so any number shown
    in the UI can be traced to a driver and a formula.
    """

    revenue_per_hour_inr: float = Field(0.0, ge=0.0)
    downtime_hours: float = Field(0.0, ge=0.0)

    ir_day_rate_inr: float = Field(0.0, ge=0.0)
    ir_days: float = Field(0.0, ge=0.0)

    rebuild_cost_inr: float = Field(0.0, ge=0.0)
    data_restoration_cost_inr: float = Field(0.0, ge=0.0)

    records_exposed: int = Field(0, ge=0)
    cost_per_record_inr: float = Field(0.0, ge=0.0)

    regulatory_rate_per_record_inr: float = Field(0.0, ge=0.0)
    regulatory_cap_inr: float = Field(0.0, ge=0.0)

    reputation_factor: float = Field(0.0, ge=0.0, le=1.0)

    records_note: str = (
        "Expected records exposed in the modeled incident scenario, "
        "not the total customer base."
    )
    source_note: str = "Synthetic Demo Dataset - analyst-supplied planning inputs"


class Asset(BaseModel):
    """A business asset carrying quantifiable risk."""

    asset_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    category: str = Field(min_length=1, max_length=64)
    criticality: int = Field(ge=1, le=10)
    business_value_inr: float = Field(ge=0.0)
    owner: str = "unassigned"
    loss_drivers: LossDrivers = Field(default_factory=LossDrivers)
    dataset_label: str = "Synthetic Demo Dataset"
