"""Normalization of raw finding attributes onto the 0.0-1.0 interval.

Every mapping here is a documented, deterministic assumption. Nothing is
learned, sampled, or inferred at runtime: the same input always produces the
same score, which is what makes an EAL figure auditable.
"""

from __future__ import annotations

from app.models.finding import ExploitMaturity, Exposure, ThreatIntel

#: Days after which an unpatched finding is treated as maximally overdue.
#: Chosen to match a common 90-day remediation SLA for high-severity issues.
PATCH_SLA_DAYS: int = 90

#: Mapped from CVSS v3.1 Exploit Code Maturity levels (E:U, E:P, E:F, E:H).
EXPLOIT_MATURITY_SCORES: dict[ExploitMaturity, float] = {
    ExploitMaturity.NONE: 0.10,
    ExploitMaturity.POC: 0.50,
    ExploitMaturity.FUNCTIONAL: 0.75,
    ExploitMaturity.WEAPONIZED: 1.00,
}

#: Network reachability. Internet-facing is the reference point at 1.0.
EXPOSURE_SCORES: dict[Exposure, float] = {
    Exposure.ISOLATED: 0.10,
    Exposure.INTERNAL: 0.30,
    Exposure.PARTNER: 0.60,
    Exposure.INTERNET: 1.00,
}

#: Observed adversary interest.
THREAT_INTEL_SCORES: dict[ThreatIntel, float] = {
    ThreatIntel.NONE: 0.10,
    ThreatIntel.CHATTER: 0.40,
    ThreatIntel.POC_PUBLIC: 0.60,
    ThreatIntel.EXPLOITED_IN_WILD: 1.00,
}


def clamp01(value: float) -> float:
    """Clamp any float into [0.0, 1.0]."""
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return float(value)


def norm_cvss(severity_score: float) -> float:
    """CVSS-style 0-10 severity to 0.0-1.0."""
    if severity_score < 0.0 or severity_score > 10.0:
        raise ValueError(f"severity_score must be within 0-10, got {severity_score}")
    return severity_score / 10.0


def exploitability_score(maturity: ExploitMaturity | str) -> float:
    key = ExploitMaturity(maturity)
    return EXPLOIT_MATURITY_SCORES[key]


def patch_age_score(days_open: int, sla_days: int = PATCH_SLA_DAYS) -> float:
    """Linear ramp to 1.0 at the SLA boundary, flat afterwards."""
    if days_open < 0:
        raise ValueError(f"days_open must be >= 0, got {days_open}")
    if sla_days <= 0:
        raise ValueError(f"sla_days must be > 0, got {sla_days}")
    return clamp01(days_open / sla_days)


def exposure_score(exposure: Exposure | str) -> float:
    key = Exposure(exposure)
    return EXPOSURE_SCORES[key]


def control_gap(control_effectiveness: float) -> float:
    """The (1 - control_effectiveness) term of LIKELIHOOD."""
    if control_effectiveness < 0.0 or control_effectiveness > 1.0:
        raise ValueError(
            f"control_effectiveness must be within 0.0-1.0, got {control_effectiveness}"
        )
    return 1.0 - control_effectiveness


def threat_intel_score(intel: ThreatIntel | str) -> float:
    key = ThreatIntel(intel)
    return THREAT_INTEL_SCORES[key]
