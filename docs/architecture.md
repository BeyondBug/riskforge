# RiskForge architecture

## What it answers

"I have a fixed security budget. Which fixes remove the most expected loss?"

RiskForge turns findings into rupee figures, then solves a budget-constrained
selection problem over remediation options. Nothing is learned or sampled: the
same inputs always produce the same output, which is what lets a CFO argue with
the number instead of accepting it.

## Request path

```
Browser
  │  HTTP :80
  ▼
Nginx (container)                 rate limit 10 r/s per IP
  ├── /            → static React bundle
  └── /api/*       → proxy
                      │
                      ▼
                  FastAPI / Uvicorn (container, :8000)
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
    DynamoDB          S3         Bedrock
  4 tables      reports bucket  Claude Haiku
  (assets,      (private,       (explanation
   findings,     pre-signed      only)
   assessments,  URLs)
   recommendations)
```

Both containers run on one EC2 `t3.micro` in `ap-south-1`. Credentials come
from the instance role `riskforge-ec2-role`; no keys exist in the image or the
repository.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| `app/risk/normalizer.py` | backend | Raw attributes → 0.0–1.0 scores |
| `app/risk/engine.py` | backend | Likelihood, loss magnitude, EAL |
| `app/optimizer/budget.py` | backend | 0/1 knapsack over controls |
| `app/ai/advisor.py` | backend | Builds the bounded JSON the model may cite |
| `app/reports/generator.py` | backend | ReportLab executive PDF |
| `app/services/*` | backend | DynamoDB, S3, Bedrock adapters + fallbacks |
| `frontend/src` | browser | Rendering only, no risk arithmetic |

## The risk model

**Likelihood** is a weighted sum of six normalized drivers. Weights sum to 1.0,
so likelihood is bounded to [0, 1] by construction and a maximal finding scores
exactly 1.0.

| Driver | Weight | Normalization |
|---|---|---|
| CVSS base / analyst severity | 0.25 | `score / 10` |
| Exploit maturity | 0.20 | none 0.10, PoC 0.50, functional 0.75, weaponized 1.00 |
| Patch age | 0.15 | `min(days_open / 90, 1.0)` |
| Network exposure | 0.15 | isolated 0.10, internal 0.30, partner 0.60, internet 1.00 |
| Control gap | 0.15 | `1 − control_effectiveness` |
| Threat intelligence | 0.10 | none 0.10, chatter 0.40, PoC public 0.60, exploited 1.00 |

**Loss magnitude** is the sum of six components, each derived from the asset's
recorded drivers rather than typed in as a total:

```
downtime          = revenue_per_hour × downtime_hours
incident_response = ir_day_rate × ir_days
recovery          = rebuild_cost + data_restoration_cost
data_breach       = records_exposed × cost_per_record
regulatory        = min(records_exposed × rate_per_record, cap)
reputation        = business_value × reputation_factor
```

**EAL** = likelihood × loss magnitude.

`records_exposed` is the number of records expected to be exposed in the
modeled incident, not the size of the customer base.

## The optimizer

```
maximize   Σ eal_reduction_i · x_i
subject to Σ cost_i · x_i ≤ budget,   x_i ∈ {0,1}
```

Solved with PuLP/CBC. An exact brute-force enumeration runs as a fallback if
CBC is unavailable, and a test asserts both paths return the same optimal
value — otherwise the fallback would be a silent downgrade.

## The AI boundary

The advisor receives a whitelist of already-computed fields. It never sees the
loss drivers or the formulas, so it has nothing to recompute from. The system
prompt forbids inventing, estimating, or calculating any number, and requires
the model to say it cannot confirm a figure that is absent from the payload.

`GET /api/advisor/context` returns the exact payload, so any claim in an answer
can be checked against its source. When Bedrock is unreachable the fallback is
a template rendered from the same JSON, never a guess.

## Failure behaviour

| Dependency | If unavailable |
|---|---|
| DynamoDB | In-memory store; `/api/health/deps` reports `mode: memory` |
| S3 | PDF written to local disk, served via `/api/reports/download/…` |
| Bedrock | Templated explanation from the same JSON, labelled in the UI |
| CBC solver | Exact brute-force enumeration (capped at 20 candidates) |

The demo therefore survives an AWS outage without ever presenting a fabricated
number as a real one.

## Security posture

- No credentials in the image or the repository; `.env` is gitignored.
- S3 bucket blocks all public access; downloads use short-lived pre-signed URLs.
- IAM policy is scoped to `riskforge-*` tables, one bucket, and the single
  Bedrock model ARN.
- Both containers run as non-root users.
- Nginx rate-limits to 10 r/s per IP and strips the version banner.
- Pydantic validates every request body; production returns generic 500s with
  no stack traces.

## Known limitations

- Loss magnitude is per-asset, so a second finding on the same asset would
  reuse the full loss figure rather than a marginal one.
- Control reductions are treated as independent; overlapping controls on one
  finding would be double-counted.
- The demo dataset is synthetic. The per-record and reputation factors are
  illustrative planning inputs, not figures from a published breach study.
