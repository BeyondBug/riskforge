"""Normalizer boundaries and mapping tables."""

from __future__ import annotations

import pytest

from app.models.finding import ExploitMaturity, Exposure, ThreatIntel
from app.risk import normalizer as nz


def test_norm_cvss_endpoints():
    assert nz.norm_cvss(0.0) == 0.0
    assert nz.norm_cvss(10.0) == 1.0
    assert nz.norm_cvss(7.5) == 0.75


@pytest.mark.parametrize("bad", [-0.1, 10.1, 11.0])
def test_norm_cvss_rejects_out_of_range(bad):
    with pytest.raises(ValueError):
        nz.norm_cvss(bad)


def test_patch_age_ramps_then_saturates():
    assert nz.patch_age_score(0) == 0.0
    assert nz.patch_age_score(45) == pytest.approx(0.5)
    assert nz.patch_age_score(90) == 1.0
    assert nz.patch_age_score(200) == 1.0


def test_patch_age_rejects_negative():
    with pytest.raises(ValueError):
        nz.patch_age_score(-1)


def test_control_gap_is_complement():
    assert nz.control_gap(0.0) == 1.0
    assert nz.control_gap(0.4) == pytest.approx(0.6)
    assert nz.control_gap(1.0) == 0.0


@pytest.mark.parametrize("bad", [-0.01, 1.01])
def test_control_gap_rejects_out_of_range(bad):
    with pytest.raises(ValueError):
        nz.control_gap(bad)


def test_categorical_maps_are_monotonic_and_bounded():
    for table, order in (
        (nz.EXPLOIT_MATURITY_SCORES, list(ExploitMaturity)),
        (nz.EXPOSURE_SCORES, list(Exposure)),
        (nz.THREAT_INTEL_SCORES, list(ThreatIntel)),
    ):
        values = [table[k] for k in order]
        assert values == sorted(values), f"{table} is not monotonic"
        assert all(0.0 <= v <= 1.0 for v in values)


def test_accepts_raw_string_values():
    assert nz.exposure_score("internet") == 1.0
    assert nz.exploitability_score("weaponized") == 1.0
    assert nz.threat_intel_score("exploited_in_wild") == 1.0


def test_clamp01():
    assert nz.clamp01(-5) == 0.0
    assert nz.clamp01(5) == 1.0
    assert nz.clamp01(0.3) == 0.3
