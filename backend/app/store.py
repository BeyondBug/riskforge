"""Assessment state shared across routers.

Loads the demo dataset once, scores it, and keeps the latest assessment and
optimization in memory. DynamoDB is written through where it is available;
the in-memory copy is what the request path reads so a cold AWS dependency
cannot break the demo.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import get_settings
from app.models.asset import Asset
from app.models.finding import Finding
from app.models.recommendation import Control, OptimizationResult
from app.models.risk import PortfolioAssessment
from app.risk.engine import assess_portfolio
from app.services.dynamodb import get_dynamodb_service

logger = logging.getLogger(__name__)

DATASET_PATH = Path(__file__).resolve().parent.parent / "sample_data" / "demo_dataset.json"


class AssessmentStore:
    def __init__(self) -> None:
        self.assets: list[Asset] = []
        self.findings: list[Finding] = []
        self.control_specs: list[dict] = []
        self.dataset_label = "Synthetic Demo Dataset"
        self.assessment: PortfolioAssessment | None = None
        self.optimization: OptimizationResult | None = None

    # -- load --------------------------------------------------------------
    def load_dataset(self, path: Path = DATASET_PATH) -> None:
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.dataset_label = raw.get("dataset_label", "Synthetic Demo Dataset")
        self.assets = [Asset(**a) for a in raw["assets"]]
        self.findings = [Finding(**f) for f in raw["findings"]]
        self.control_specs = raw["controls"]
        logger.info(
            "Loaded %d assets, %d findings, %d controls from %s",
            len(self.assets), len(self.findings), len(self.control_specs), path.name,
        )

    def run_assessment(self) -> PortfolioAssessment:
        self.assessment = assess_portfolio(self.assets, self.findings)
        self.assessment.dataset_label = self.dataset_label
        self._persist_assessment(self.assessment)
        return self.assessment

    def ensure_assessment(self) -> PortfolioAssessment:
        if self.assessment is None:
            return self.run_assessment()
        return self.assessment

    # -- derived -----------------------------------------------------------
    def controls_with_eal(self) -> list[Control]:
        """Attach each control's rupee reduction, derived from its finding's EAL."""
        assessment = self.ensure_assessment()
        eal_by_finding = {r.finding_id: r.eal_inr for r in assessment.results}

        controls: list[Control] = []
        for spec in self.control_specs:
            current = eal_by_finding.get(spec["finding_id"])
            if current is None:
                logger.warning(
                    "control %s references unknown finding %s, skipping",
                    spec["control_id"], spec["finding_id"],
                )
                continue
            control = Control(**spec)
            control.current_eal_inr = current
            control.eal_reduction_inr = current * control.eal_reduction_pct
            controls.append(control)
        return controls

    # -- persistence -------------------------------------------------------
    def _persist_assessment(self, assessment: PortfolioAssessment) -> None:
        settings = get_settings()
        db = get_dynamodb_service()
        try:
            db.put_item(
                settings.dynamodb_table_assessments,
                json.loads(assessment.model_dump_json()),
                "assessment_id",
            )
        except Exception as exc:
            logger.error("failed to persist assessment: %s", exc)

    def persist_recommendations(self, result: OptimizationResult) -> None:
        settings = get_settings()
        db = get_dynamodb_service()
        for s in result.selected:
            item = json.loads(s.model_dump_json())
            item["rec_id"] = f"{result.assessment_id}#{s.control_id}"
            item["assessment_id"] = result.assessment_id
            item["decision"] = "selected"
            try:
                db.put_item(settings.dynamodb_table_recommendations, item, "rec_id")
            except Exception as exc:
                logger.error("failed to persist recommendation %s: %s", s.control_id, exc)


store = AssessmentStore()
