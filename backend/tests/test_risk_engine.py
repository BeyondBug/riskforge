"""Risk engine: weights, likelihood, loss magnitude, EAL."""

from __future__ import annotations

import pytest

from app.models.asset import Asset, LossDrivers
from app.models.finding import Finding
from app.risk.engine import (
    WEIGHTS,
    assess_portfolio,
    compute_eal,
    compute_likelihood,
    compute_loss_magnitude,
)


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_maximum_likelihood_is_one():
    """Every driver at its ceiling must give exactly 1.0, not 0.99 or 1.01."""
    worst = Finding(
        finding_id="F-MAX",
        asset_id="A",
        title="worst case",
        severity_score=10.0,
        exploit_maturity="weaponized",
        days_open=365,
        exposure="internet",
        control_effectiveness=0.0,
        threat_intel="exploited_in_wild",
    )
    assert compute_likelihood(worst).likelihood == pytest.approx(1.0)


def test_perfect_control_lowers_likelihood_by_its_weight():
    base = dict(
        finding_id="F-1",
        asset_id="A",
        title="t",
        severity_score=10.0,
        exploit_maturity="weaponized",
        days_open=365,
        exposure="internet",
        threat_intel="exploited_in_wild",
    )
    ungoverned = compute_likelihood(Finding(**base, control_effectiveness=0.0))
    governed = compute_likelihood(Finding(**base, control_effectiveness=1.0))
    assert ungoverned.likelihood - governed.likelihood == pytest.approx(
        WEIGHTS["control_gap"]
    )


def test_likelihood_matches_hand_calculation(findings):
    """FND-001: 0.25(1.0)+0.20(1.0)+0.15(0.5)+0.15(1.0)+0.15(1.0)+0.10(1.0)."""
    fnd = next(f for f in findings if f.finding_id == "FND-001")
    expected = 0.25 + 0.20 + 0.15 * (45 / 90) + 0.15 + 0.15 + 0.10
    assert compute_likelihood(fnd).likelihood == pytest.approx(expected)
    assert expected == pytest.approx(0.925)


def test_weighted_terms_reconstruct_the_likelihood(findings):
    for f in findings:
        breakdown = compute_likelihood(f)
        assert sum(breakdown.weighted_terms.values()) == pytest.approx(
            breakdown.likelihood, abs=1e-6
        )


def test_loss_magnitude_is_the_sum_of_six_components(assets):
    for asset in assets:
        loss = compute_loss_magnitude(asset)
        parts = (
            loss.downtime_inr
            + loss.incident_response_inr
            + loss.recovery_inr
            + loss.data_breach_inr
            + loss.regulatory_inr
            + loss.reputation_inr
        )
        assert loss.loss_magnitude_inr == pytest.approx(parts)


def test_loss_components_trace_to_their_drivers():
    asset = Asset(
        asset_id="A",
        name="Test",
        category="Test",
        criticality=5,
        business_value_inr=1_000_000,
        loss_drivers=LossDrivers(
            revenue_per_hour_inr=1000,
            downtime_hours=4,
            ir_day_rate_inr=2000,
            ir_days=3,
            rebuild_cost_inr=5000,
            data_restoration_cost_inr=2500,
            records_exposed=100,
            cost_per_record_inr=50,
            regulatory_rate_per_record_inr=10,
            regulatory_cap_inr=100_000,
            reputation_factor=0.01,
        ),
    )
    loss = compute_loss_magnitude(asset)
    assert loss.downtime_inr == 4000
    assert loss.incident_response_inr == 6000
    assert loss.recovery_inr == 7500
    assert loss.data_breach_inr == 5000
    assert loss.regulatory_inr == 1000
    assert loss.reputation_inr == 10_000
    assert loss.loss_magnitude_inr == 33_500


def test_regulatory_cap_binds():
    asset = Asset(
        asset_id="A",
        name="Test",
        category="Test",
        criticality=5,
        business_value_inr=0,
        loss_drivers=LossDrivers(
            records_exposed=1_000_000,
            regulatory_rate_per_record_inr=100,
            regulatory_cap_inr=5_000_000,
        ),
    )
    assert compute_loss_magnitude(asset).regulatory_inr == 5_000_000


def test_eal_is_likelihood_times_loss(assets, findings):
    asset = next(a for a in assets if a.asset_id == "AST-001")
    finding = next(f for f in findings if f.finding_id == "FND-001")
    result = compute_eal(asset, finding)
    assert result.eal_inr == pytest.approx(
        result.likelihood.likelihood * result.loss.loss_magnitude_inr
    )


def test_eal_rejects_mismatched_asset(assets, findings):
    asset = next(a for a in assets if a.asset_id == "AST-005")
    finding = next(f for f in findings if f.finding_id == "FND-001")
    with pytest.raises(ValueError):
        compute_eal(asset, finding)


def test_portfolio_totals_and_ordering(assets, findings):
    assessment = assess_portfolio(assets, findings)
    assert assessment.findings_count == len(findings)
    assert assessment.assets_at_risk == len(assets)
    assert assessment.total_eal_inr == pytest.approx(
        sum(r.eal_inr for r in assessment.results)
    )
    eals = [r.eal_inr for r in assessment.results]
    assert eals == sorted(eals, reverse=True)


def test_portfolio_skips_orphan_findings(assets, findings):
    orphan = Finding(
        finding_id="FND-ORPHAN",
        asset_id="AST-DOES-NOT-EXIST",
        title="orphan",
        severity_score=9.9,
        exploit_maturity="weaponized",
        days_open=10,
        exposure="internet",
        control_effectiveness=0.0,
        threat_intel="exploited_in_wild",
    )
    assessment = assess_portfolio(assets, findings + [orphan])
    assert "FND-ORPHAN" not in {r.finding_id for r in assessment.results}


def test_engine_is_deterministic(assets, findings):
    a = assess_portfolio(assets, findings)
    b = assess_portfolio(assets, findings)
    assert a.total_eal_inr == b.total_eal_inr
    assert [r.finding_id for r in a.results] == [r.finding_id for r in b.results]
