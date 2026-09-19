"""Shared fixtures. Tests load the real demo dataset, not hand-made stubs."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.models.asset import Asset
from app.models.finding import Finding

DATASET = Path(__file__).resolve().parent.parent / "sample_data" / "demo_dataset.json"


@pytest.fixture(scope="session")
def dataset() -> dict:
    return json.loads(DATASET.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def assets(dataset) -> list[Asset]:
    return [Asset(**a) for a in dataset["assets"]]


@pytest.fixture(scope="session")
def findings(dataset) -> list[Finding]:
    return [Finding(**f) for f in dataset["findings"]]


@pytest.fixture(scope="session")
def control_specs(dataset) -> list[dict]:
    return dataset["controls"]
