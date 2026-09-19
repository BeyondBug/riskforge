"""Security finding model and its categorical enumerations."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ExploitMaturity(str, Enum):
    """Mirrors CVSS v3.1 Exploit Code Maturity (E:U / E:P / E:F / E:H)."""

    NONE = "none"
    POC = "poc"
    FUNCTIONAL = "functional"
    WEAPONIZED = "weaponized"


class Exposure(str, Enum):
    """Network reachability of the vulnerable component."""

    ISOLATED = "isolated"
    INTERNAL = "internal"
    PARTNER = "partner"
    INTERNET = "internet"


class ThreatIntel(str, Enum):
    """Observed adversary interest in the weakness."""

    NONE = "none"
    CHATTER = "chatter"
    POC_PUBLIC = "poc_public"
    EXPLOITED_IN_WILD = "exploited_in_wild"


class FindingStatus(str, Enum):
    OPEN = "open"
    MITIGATED = "mitigated"
    ACCEPTED = "accepted"


class Finding(BaseModel):
    """One weakness on one asset."""

    finding_id: str = Field(min_length=1, max_length=64)
    asset_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)

    cve_id: str | None = Field(default=None, max_length=32)

    severity_score: float = Field(ge=0.0, le=10.0)
    score_source: str = Field(
        default="synthetic_demo",
        description=(
            "Provenance of severity_score. 'synthetic_demo' means the value is "
            "part of the demo dataset and has not been re-verified against NVD."
        ),
    )

    exploit_maturity: ExploitMaturity
    days_open: int = Field(ge=0)
    exposure: Exposure
    control_effectiveness: float = Field(ge=0.0, le=1.0)
    threat_intel: ThreatIntel

    status: FindingStatus = FindingStatus.OPEN
    dataset_label: str = "Synthetic Demo Dataset"
