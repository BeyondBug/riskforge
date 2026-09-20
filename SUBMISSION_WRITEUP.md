# RiskForge — submission writeup

**Live URL:** http://13.233.102.11
**Repository:** https://github.com/BeyondBug/riskforge
**Track:** Ship It · AWS region ap-south-1

---

## The problem

Security teams justify budget with CVSS scores. Finance does not buy CVSS — it
buys expected loss avoided. There is no shared unit between "this is a 9.8" and
"this costs five lakh to fix," so remediation gets prioritised by severity label
rather than by money at risk, and the budget conversation stalls.

RiskForge gives both sides one unit: rupees.

## What we built

A deterministic risk engine, not a model.

**Likelihood** is a weighted sum of six normalised drivers — CVSS, exploit
maturity, patch age, network exposure, control gap, threat intelligence — with
weights summing to exactly 1.0, so likelihood is bounded to [0,1] by
construction. A test asserts a maximal finding scores exactly 1.0.

**Loss magnitude** is six components, each derived from recorded drivers rather
than entered as a total: downtime is revenue-per-hour × hours, data breach is
records × cost-per-record, regulatory is capped, and so on. EAL is their product.
The API returns the full breakdown with every finding, so any rupee on screen can
be taken apart.

**Budget allocation** is a 0/1 knapsack maximising exposure removed subject to
cost ≤ budget, solved with PuLP/CBC:

- At ₹5,00,000 it funds all five controls for ₹3,35,000 and removes ₹6.30 Cr of
  ₹9.70 Cr modeled exposure (64.9%).
- At ₹1,50,000 it funds two for ₹1,40,000 and still removes ₹5.20 Cr (53.6%) —
  dropping the control with the highest *percentage* reduction, because the same
  rupees buy more elsewhere. A sorted list cannot produce that answer.

Assessments are stamped with a calculation contract version, `riskforge-eal-v1`,
and portfolio totals count unresolved findings only.

## Where AWS fits

| Service | Role |
|---|---|
| **EC2** t3.micro, Amazon Linux 2023 | Nginx + FastAPI in Docker Compose, single public entry point on port 80 |
| **DynamoDB** | Four tables: assets, findings, assessments, recommendations |
| **S3** | PDF reports in a bucket with all public access blocked, delivered by 1-hour presigned URLs |
| **Bedrock** Claude Haiku | Narrates computed output; never produces a number |

**Security posture.** A scoped EC2 instance role — `riskforge-*` tables, one
bucket, one model ARN — with no static credentials anywhere in the image or the
repository. Both containers run as non-root. Nginx rate-limits to 10 req/s per
IP. Pydantic validates every request body; production returns generic 500s with
no stack traces. The health endpoint reports dependency *modes* only, never
internal exception strings.

**The AI boundary is the decision we would defend hardest.** The model receives
a whitelist of already-computed values — not the raw loss drivers, not the
formulas — so it has nothing to recompute from. The system prompt forbids
inventing, estimating, or calculating any number and requires it to say it
cannot confirm a figure absent from the payload. `GET /api/advisor/context`
returns that exact payload, so any claim in an answer is checkable. When Bedrock
is unavailable a deterministic template renders the same JSON, and every answer
is labelled with the path that produced it.

**Cost.** EC2 is the only charge that accrues continuously; DynamoDB, S3 and
Bedrock are per-request and negligible at demo volume. Documented in
`docs/AWS_COST.md` along with the teardown commands.

## What we learned

Four things cost us real time, and all four were assumption failures.

**Amazon Linux 2023 ships Docker without buildx.** `docker compose build` fails
with a version error that points at Compose, not at the missing plugin.

**t3.micro has 1 GiB of RAM and `vite build` OOMs on it.** The symptom is exit
code 137, which reads as a build error rather than a memory error. Two gigabytes
of swap fixes it.

**Our health check could not fail.** It reported Bedrock as live when it was not,
because constructing a boto3 client makes no network call — `mode: bedrock` only
proved an object existed. The real failure surfaced on the first invocation. We
added a `last_invocation` field carrying the outcome of an actual call. A health
check that cannot fail is not a health check.

**We caught a modelling error in our own dataset.** At our first record counts,
the breach component alone exceeded the asset's business value — a ₹30 Cr
database cannot lose ₹41 Cr. We rescaled and documented `records_exposed` as
records expected in the modeled incident, not the customer base.

We also chose *not* to train a model. There is no labelled breach-loss dataset
for five assets, and an unvalidatable model cannot be defended in a budget
meeting. Determinism is the feature, not a limitation we worked around.

## Honest limitations

Loss magnitude is per-asset, so a second finding on the same asset would reuse
the full figure rather than a marginal one. Control reductions are treated as
independent. The bundled dataset is labelled **Synthetic Demo Dataset**: the
per-record and reputation factors are illustrative planning inputs, not figures
from a published breach study, and the CVE severity scores are demo values that
should be re-verified against NVD before any real use.

## AI tools used

Claude (Anthropic) for scaffolding, code review, and documentation. All
architecture and modelling decisions, and the final code, are the team's.