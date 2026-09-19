"""0/1 knapsack over remediation controls.

    maximize   sum(eal_reduction_i * x_i)
    subject to sum(cost_i * x_i) <= budget,  x_i in {0, 1}

PuLP (CBC) is the primary solver. An exact brute-force enumeration is used as
a fallback so the demo cannot be broken by a missing CBC binary; it is only
safe for small candidate sets, which is why it is capped.
"""

from __future__ import annotations

import itertools
import logging

from app.models.recommendation import Control, OptimizationResult, SelectedControl

logger = logging.getLogger(__name__)

#: Above this count brute force is refused (2^n enumeration).
BRUTE_FORCE_MAX_ITEMS = 20


def _to_selected(control: Control) -> SelectedControl:
    return SelectedControl(
        control_id=control.control_id,
        name=control.name,
        asset_id=control.asset_id,
        finding_id=control.finding_id,
        cost_inr=control.cost_inr,
        eal_reduction_inr=control.eal_reduction_inr,
        eal_reduction_pct=control.eal_reduction_pct,
        roi=round(control.roi, 4),
    )


def _solve_pulp(controls: list[Control], budget: float) -> list[int] | None:
    """Return indices of selected controls, or None if PuLP is unusable."""
    try:
        import pulp
    except ImportError:  # pragma: no cover - exercised only without PuLP
        logger.warning("PuLP unavailable, falling back to brute force")
        return None

    problem = pulp.LpProblem("riskforge_budget_allocation", pulp.LpMaximize)
    x = [
        pulp.LpVariable(f"x_{i}_{c.control_id}", cat="Binary")
        for i, c in enumerate(controls)
    ]

    problem += pulp.lpSum(
        controls[i].eal_reduction_inr * x[i] for i in range(len(controls))
    )
    problem += (
        pulp.lpSum(controls[i].cost_inr * x[i] for i in range(len(controls))) <= budget
    )

    try:
        status = problem.solve(pulp.PULP_CBC_CMD(msg=False))
    except Exception as exc:  # pragma: no cover - solver binary issues
        logger.warning("CBC solve failed (%s), falling back to brute force", exc)
        return None

    if pulp.LpStatus[status] != "Optimal":
        logger.warning("CBC returned %s, falling back", pulp.LpStatus[status])
        return None

    return [i for i in range(len(controls)) if (x[i].value() or 0) > 0.5]


def _solve_brute_force(controls: list[Control], budget: float) -> list[int]:
    """Exact enumeration. Same optimum as CBC, just slower."""
    if len(controls) > BRUTE_FORCE_MAX_ITEMS:
        raise ValueError(
            f"brute-force fallback refuses {len(controls)} controls "
            f"(limit {BRUTE_FORCE_MAX_ITEMS}); install a working CBC solver"
        )

    best: tuple[int, ...] = ()
    best_value = -1.0
    indices = range(len(controls))

    for size in range(len(controls) + 1):
        for combo in itertools.combinations(indices, size):
            cost = sum(controls[i].cost_inr for i in combo)
            if cost > budget:
                continue
            value = sum(controls[i].eal_reduction_inr for i in combo)
            if value > best_value or (value == best_value and cost < sum(
                controls[i].cost_inr for i in best
            )):
                best_value = value
                best = combo

    return list(best)


def optimize_budget(
    controls: list[Control],
    budget_inr: float,
    assessment_id: str = "unknown",
    portfolio_eal_inr: float | None = None,
    force_brute_force: bool = False,
) -> OptimizationResult:
    """Select the control set that removes the most modeled EAL within budget."""
    if budget_inr <= 0:
        raise ValueError(f"budget_inr must be > 0, got {budget_inr}")

    if not controls:
        return OptimizationResult(
            assessment_id=assessment_id,
            budget_inr=budget_inr,
            solver="none",
            budget_remaining_inr=budget_inr,
            eal_before_inr=portfolio_eal_inr or 0.0,
            eal_after_inr=portfolio_eal_inr or 0.0,
        )

    solver = "pulp-cbc"
    chosen = None if force_brute_force else _solve_pulp(controls, budget_inr)
    if chosen is None:
        solver = "brute-force-exact"
        chosen = _solve_brute_force(controls, budget_inr)

    chosen_set = set(chosen)
    selected = [_to_selected(controls[i]) for i in sorted(chosen_set)]
    rejected = [
        _to_selected(controls[i])
        for i in range(len(controls))
        if i not in chosen_set
    ]

    selected.sort(key=lambda s: s.eal_reduction_inr, reverse=True)
    rejected.sort(key=lambda s: s.eal_reduction_inr, reverse=True)

    total_cost = sum(s.cost_inr for s in selected)
    total_reduction = sum(s.eal_reduction_inr for s in selected)

    eal_before = (
        portfolio_eal_inr
        if portfolio_eal_inr is not None
        else sum(c.current_eal_inr for c in controls)
    )
    eal_after = max(eal_before - total_reduction, 0.0)

    return OptimizationResult(
        assessment_id=assessment_id,
        budget_inr=budget_inr,
        solver=solver,
        selected=selected,
        rejected=rejected,
        total_cost_inr=total_cost,
        budget_remaining_inr=budget_inr - total_cost,
        total_eal_reduction_inr=total_reduction,
        eal_before_inr=eal_before,
        eal_after_inr=eal_after,
        reduction_pct_of_portfolio=(
            (total_reduction / eal_before * 100.0) if eal_before > 0 else 0.0
        ),
    )
