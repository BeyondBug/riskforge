"""API contract tests. Run against the in-memory fallback, no AWS required."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "healthy"}


def test_health_deps_reports_each_backend(client):
    body = client.get("/api/health/deps").json()
    for dep in ("dynamodb", "s3", "bedrock"):
        assert dep in body and "mode" in body[dep]


def test_assets_loaded(client):
    body = client.get("/api/assets").json()
    assert body["count"] == 5
    assert body["dataset_label"] == "Synthetic Demo Dataset"


def test_findings_carry_eal_and_disclaimer(client):
    body = client.get("/api/findings").json()
    assert body["count"] == 5
    assert all(f["eal_inr"] > 0 for f in body["findings"])
    assert "Not a guarantee of actual losses" in body["disclaimer"]


def test_assessment_totals_match_rows(client):
    body = client.post("/api/assessments").json()
    assert body["total_eal_inr"] == pytest.approx(
        sum(r["eal_inr"] for r in body["results"])
    )


def test_optimize_respects_budget(client):
    resp = client.post("/api/optimize", json={"budget_inr": 150000})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_cost_inr"] <= 150000
    assert body["eal_after_inr"] < body["eal_before_inr"]


def test_optimize_rejects_bad_budget(client):
    assert client.post("/api/optimize", json={"budget_inr": 0}).status_code == 422
    assert client.post("/api/optimize", json={"budget_inr": -5}).status_code == 422
    assert client.post("/api/optimize", json={}).status_code == 422


def test_advisor_context_contains_only_computed_values(client):
    body = client.get("/api/advisor/context").json()
    assert "totals" in body and "top_findings" in body
    assert "loss_drivers" not in str(body), "raw drivers must not reach the model"


def test_advisor_answers_without_aws(client):
    resp = client.post("/api/advisor", json={"question": "Why these controls?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] in {"bedrock", "fallback"}
    assert body["notice"] == "AI explains deterministic outputs only."


def test_advisor_validates_input(client):
    assert client.post("/api/advisor", json={"question": "hi"}).status_code == 422
    assert client.post(
        "/api/advisor", json={"question": "x" * 501}
    ).status_code == 422


def test_report_generates_a_pdf(client):
    resp = client.post("/api/reports/generate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["size_bytes"] > 1000
    assert body["key"].endswith(".pdf")


def test_report_download_rejects_traversal(client):
    assert client.get("/api/reports/download/..%2Fetc%2Fpasswd").status_code in (400, 404)
    assert client.get("/api/reports/download/notes.txt").status_code == 400


def test_unknown_assessment_is_404(client):
    assert client.get("/api/assessments/does-not-exist").status_code == 404
