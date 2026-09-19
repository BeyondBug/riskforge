"""Knapsack optimizer: feasibility, optimality, and solver agreement."""

from __future__ import annotations

import pytest

from app.models.recommendation import Control
from app.optimizer.budget import optimize_budget
from app.risk.engine import assess_portfolio


def _controls(specs, assessment) -> list[Control]:
    eal = {r.finding_id: r.eal_inr for r in assessment.results}
    out = []
    for spec in specs:
        c = Control(**spec)
        c.current_eal_inr = eal[c.finding_id]
        c.eal_reduction_inr = c.current_eal_inr * c.eal_reduction_pct
        out.append(c)
    return out


@pytest.fixture()
def demo_controls(control_specs, assets, findings):
    return _controls(control_specs, assess_portfolio(assets, findings))


def test_never_exceeds_budget(demo_controls):
    for budget in (1, 30_000, 75_000, 150_000, 335_000, 500_000, 10_000_000):
        result = optimize_budget(demo_controls, budget)
        assert result.total_cost_inr <= budget
        assert result.budget_remaining_inr >= 0


def test_selected_and_rejected_partition_the_candidates(demo_controls):
    result = optimize_budget(demo_controls, 150_000)
    ids = {s.control_id for s in result.selected} | {
        s.control_id for s in result.rejected
    }
    assert ids == {c.control_id for c in demo_controls}
    assert len(result.selected) + len(result.rejected) == len(demo_controls)


def test_generous_budget_takes_everything(demo_controls):
    total_cost = sum(c.cost_inr for c in demo_controls)
    result = optimize_budget(demo_controls, total_cost)
    assert len(result.selected) == len(demo_controls)
    assert result.total_cost_inr == pytest.approx(total_cost)


def test_budget_below_cheapest_control_selects_nothing(demo_controls):
    cheapest = min(c.cost_inr for c in demo_controls)
    result = optimize_budget(demo_controls, cheapest - 1)
    assert result.selected == []
    assert result.total_eal_reduction_inr == 0.0


def test_cbc_and_brute_force_agree(demo_controls):
    """The fallback must reach the same optimum, or the fallback is a lie."""
    for budget in (50_000, 100_000, 150_000, 200_000, 335_000):
        cbc = optimize_budget(demo_controls, budget)
        brute = optimize_budget(demo_controls, budget, force_brute_force=True)
        assert cbc.total_eal_reduction_inr == pytest.approx(
            brute.total_eal_reduction_inr
        )


def test_optimum_beats_greedy_by_cost(demo_controls):
    """Optimal value must be >= the cheapest-first greedy value."""
    budget = 150_000
    optimal = optimize_budget(demo_controls, budget).total_eal_reduction_inr

    spent, greedy = 0.0, 0.0
    for c in sorted(demo_controls, key=lambda c: c.cost_inr):
        if spent + c.cost_inr <= budget:
            spent += c.cost_inr
            greedy += c.eal_reduction_inr
    assert optimal >= greedy - 1e-6


def test_totals_are_internally_consistent(demo_controls):
    portfolio = sum(c.current_eal_inr for c in demo_controls)
    result = optimize_budget(demo_controls, 150_000, portfolio_eal_inr=portfolio)
    assert result.total_cost_inr == pytest.approx(
        sum(s.cost_inr for s in result.selected)
    )
    assert result.total_eal_reduction_inr == pytest.approx(
        sum(s.eal_reduction_inr for s in result.selected)
    )
    assert result.eal_after_inr == pytest.approx(
        result.eal_before_inr - result.total_eal_reduction_inr
    )


def test_rejects_non_positive_budget(demo_controls):
    with pytest.raises(ValueError):
        optimize_budget(demo_controls, 0)
    with pytest.raises(ValueError):
        optimize_budget(demo_controls, -1)


def test_empty_candidate_set_is_handled():
    result = optimize_budget([], 100_000)
    assert result.selected == []
    assert result.budget_remaining_inr == 100_000
