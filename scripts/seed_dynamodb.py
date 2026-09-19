#!/usr/bin/env python
"""Seed the RiskForge DynamoDB tables from the synthetic demo dataset.

Run from the repository root:

    python scripts/seed_dynamodb.py                 # seed assets + findings
    python scripts/seed_dynamodb.py --with-assessment
    python scripts/seed_dynamodb.py --dry-run       # print, write nothing

Credentials come from the usual boto3 chain: the EC2 instance role in
production, or the local AWS CLI profile on a workstation.
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

DATASET = ROOT / "backend" / "sample_data" / "demo_dataset.json"


def to_decimal(value):
    """DynamoDB has no float type; go through str to avoid binary drift."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_decimal(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_decimal(v) for v in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed RiskForge DynamoDB tables")
    parser.add_argument("--region", default=None, help="override AWS region")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--with-assessment",
        action="store_true",
        help="also compute and store one assessment plus its recommendations",
    )
    args = parser.parse_args()

    from app.config import get_settings

    settings = get_settings()
    region = args.region or settings.aws_region

    data = json.loads(DATASET.read_text(encoding="utf-8"))
    assets = data["assets"]
    findings = data["findings"]

    print(f"Dataset      : {data['dataset_label']}")
    print(f"Region       : {region}")
    print(f"Assets       : {len(assets)}")
    print(f"Findings     : {len(findings)}")
    print(f"Controls     : {len(data['controls'])}")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        for a in assets:
            print(f"  asset   {a['asset_id']:8s} {a['name']}")
        for f in findings:
            print(f"  finding {f['finding_id']:8s} {f['title'][:52]}")
        return 0

    try:
        import boto3
    except ImportError:
        print("boto3 is not installed. Run: pip install -r backend/requirements.txt")
        return 1

    dynamodb = boto3.resource("dynamodb", region_name=region)

    written = 0
    for table_name, items, pk in (
        (settings.dynamodb_table_assets, assets, "asset_id"),
        (settings.dynamodb_table_findings, findings, "finding_id"),
    ):
        table = dynamodb.Table(table_name)
        try:
            with table.batch_writer() as batch:
                for item in items:
                    batch.put_item(Item=to_decimal(item))
        except Exception as exc:
            print(f"\nFAILED writing to {table_name}: {type(exc).__name__}: {exc}")
            print("Check that the table exists in this region and the role has PutItem.")
            return 1
        written += len(items)
        print(f"  wrote {len(items):2d} items to {table_name}")

    if args.with_assessment:
        from app.optimizer.budget import optimize_budget
        from app.store import store

        store.load_dataset(DATASET)
        assessment = store.run_assessment()
        controls = store.controls_with_eal()
        result = optimize_budget(
            controls,
            budget_inr=500000,
            assessment_id=assessment.assessment_id,
            portfolio_eal_inr=assessment.total_eal_inr,
        )

        table = dynamodb.Table(settings.dynamodb_table_assessments)
        table.put_item(Item=to_decimal(json.loads(assessment.model_dump_json())))
        print(f"  wrote assessment {assessment.assessment_id}")

        rec_table = dynamodb.Table(settings.dynamodb_table_recommendations)
        with rec_table.batch_writer() as batch:
            for s in result.selected:
                item = json.loads(s.model_dump_json())
                item["rec_id"] = f"{assessment.assessment_id}#{s.control_id}"
                item["assessment_id"] = assessment.assessment_id
                item["decision"] = "selected"
                batch.put_item(Item=to_decimal(item))
        print(f"  wrote {len(result.selected)} recommendations")
        print(
            f"\n  total modeled exposure INR {assessment.total_eal_inr:,.0f}"
            f"  ({assessment.total_eal_inr / 1e7:.2f} Cr)"
        )

    print(f"\nSeed complete: {written} base items written.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
