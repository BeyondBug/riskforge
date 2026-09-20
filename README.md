# RiskForge

**Turn security findings into rupees, then spend a fixed budget where it removes the most risk.**

| | |
|---|---|
| **Live demo** | http://13.233.102.11 |
| **Demo video** | REPLACE_WITH_YOUTUBE_LINK |
| **Track** | Ship It - deployed on AWS, `ap-south-1` |
| **AWS services** | EC2 · DynamoDB · S3 · Bedrock |
| **Tests** | 50 passing |

Security teams justify budget with CVSS scores. Finance does not buy CVSS — it
buys expected loss avoided. RiskForge gives both sides one unit: rupees.

On the bundled dataset it models **₹9.70 Cr** of annual exposure across 5 assets.
Given **₹1,50,000**, it funds 2 of 5 controls for ₹1,40,000 and removes
**₹5.20 Cr** - 53.6% of total exposure. It drops the control with the *highest*
percentage reduction, because the same rupees buy more elsewhere. That is a 0/1
knapsack, not a sorted list.

Every figure above is computed by the engine and reproducible from the inputs
recorded with the assessment. Nothing is typed in.

## Questions a reviewer will ask

| Question | Answer |
|---|---|
| Why no ML model? | There is no labelled breach-loss dataset here, and a model that cannot be validated cannot be defended in a budget meeting. The engine is deterministic by design. |
| Why not just sort findings by CVSS? | At ₹1.5L the optimizer drops **Fix SQLi** - the highest percentage reduction on the list — because two other controls remove more exposure for the same money. A sort cannot do that. |
| Where can the AI invent a number? | Nowhere. It receives already-computed values only, never the raw drivers or formulas. `GET /api/advisor/context` returns exactly what it saw. |
| Are there AWS keys anywhere? | No. The EC2 instance role supplies credentials. Presigned report URLs carry an `ASIA` credential prefix - temporary STS, not a static key. |
| What happens when an AWS service is unavailable? | Every dependency has a labelled fallback, and the Dashboard shows which mode each one is in. The figures are identical either way. |
| Is the data real? | No. It is a labelled **Synthetic Demo Dataset**. The method is real; the inputs are illustrative and documented as such. |

## Built with AI assistance

Claude (Anthropic) was used for scaffolding, code review, and documentation
during the event. All architecture and modelling decisions, and the final code,
are the team's.

---

Answers one question:

> I have a fixed security budget. What should I fix first?

RiskForge converts security findings into modeled rupee exposure, then solves a
budget-constrained selection problem over remediation options. The model is
deterministic - the same inputs always produce the same output - so every
figure on screen can be traced back to an input and a formula.

The current calculation contract is versioned as `riskforge-eal-v1`. Portfolio
totals include unresolved (`open`) findings only; mitigated and accepted source
records are retained but excluded from active exposure.

**Modeled estimates based on supplied inputs. Not a guarantee of actual losses.**
The bundled dataset is a **Synthetic Demo Dataset**, not real organisational data.

## How a number is produced

```
LIKELIHOOD = 0.25·norm_cvss + 0.20·exploit_maturity + 0.15·patch_age
           + 0.15·exposure  + 0.15·(1 − control_effectiveness)
           + 0.10·threat_intel                       (weights sum to 1.0)

LOSS_MAGNITUDE = downtime + incident_response + recovery
               + data_breach + regulatory + reputation

EAL = LIKELIHOOD × LOSS_MAGNITUDE
```

Each loss component is derived from recorded drivers (revenue per hour,
incident-response day rate, records expected to be exposed, and so on) rather
than entered as a total. See [docs/architecture.md](docs/architecture.md).

Budget allocation is a 0/1 knapsack:

```
maximize   Σ eal_reduction_i · x_i
subject to Σ cost_i · x_i ≤ budget,   x_i ∈ {0,1}
```

## The AI boundary

Amazon Bedrock (Claude Haiku) explains the output. It never produces it. The
model receives a whitelist of already-computed values and is instructed that
every number it mentions must come from that payload. `GET /api/advisor/context`
returns the exact payload so any claim can be checked against its source. If
Bedrock is unreachable, the fallback is a template rendered from the same JSON.

## Demo workflow

The UI is arranged as a single decision path:

1. **Dashboard** - review portfolio exposure and the active AWS/fallback modes.
2. **Findings** - search findings and expand one to audit its likelihood drivers,
   loss components, and final EAL equation.
3. **Optimizer** - choose a budget and explicitly create a funding plan. Merely
   opening the dashboard never creates or changes a plan.
4. **Advisor** - ask Bedrock, or the deterministic fallback, to explain the
   computed assessment and active plan.
5. **Report** - confirm whether a plan is included, then generate the executive
   PDF for private S3 or temporary local storage.

## Stack

FastAPI · Pydantic v2 · PuLP · ReportLab · boto3 · React 18 · TypeScript ·
Vite · Recharts · Tailwind · Nginx · Docker Compose · EC2 · DynamoDB · S3 ·
Bedrock - `ap-south-1`.

## Run it locally

### Backend only (Windows 11 PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. No AWS account is needed: DynamoDB, S3, and
Bedrock each fall back to a local path, and `/api/health/deps` reports which
mode each one is in.

### Tests

```powershell
cd backend
python -m pytest tests/ -v
```

### Frontend only

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`.

Use the locked dependency graph and verify a production bundle before pushing:

```powershell
npm ci
npm run typecheck
npm run build
```

### Full stack with Docker

```powershell
copy .env.example .env
docker-compose up --build
curl http://localhost/api/health
```

## Deploy to EC2

```bash
git clone https://github.com/BeyondBug/riskforge.git
cd riskforge
cp .env.example .env
docker-compose -f docker-compose.prod.yml up -d --build
curl http://localhost/api/health
```

Provision the AWS side first with `infrastructure/setup_aws.sh` (DynamoDB
tables, S3 bucket with public access blocked, scoped IAM role and instance
profile). Credentials come from the instance role; nothing is baked into the
image.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/health/deps` | Which AWS services are live vs. on a fallback |
| GET | `/api/assets` | Asset inventory |
| GET | `/api/findings` | Open findings with computed EAL |
| POST | `/api/assessments` | Re-score the portfolio |
| GET | `/api/assessments/current` | Latest assessment |
| GET | `/api/controls` | Candidate controls with rupee reductions |
| POST | `/api/optimize` | Create a budget allocation for the current assessment |
| GET | `/api/optimizations/current` | Explicitly created plan used by advisor and report |
| POST | `/api/advisor` | Ask the explanation model |
| GET | `/api/advisor/context` | Exactly what the model was given |
| POST | `/api/reports/generate` | Build the executive PDF |

## Security

- `.env` gitignored; `.env.example` committed with empty values.
- S3 bucket blocks all public access; downloads use short-lived pre-signed URLs.
- IAM scoped to `riskforge-*` tables, one bucket, one Bedrock model ARN.
- Both containers run as non-root.
- Nginx rate-limits 10 r/s per IP.
- Pydantic validates every request body; production returns generic 500s.
- Public dependency status exposes service modes but not internal error strings.
- AWS connection probes use short timeouts so local fallback is reached quickly.

## Limitations

Loss magnitude is per-asset, so a second finding on the same asset reuses the
full figure rather than a marginal one. Control reductions are treated as
independent. The demo dataset's per-record and reputation factors are
illustrative planning inputs, not figures from a published breach study, and
the CVE severity scores shipped with it are demo values that should be
re-verified against NVD before any real use.

The current demo keeps the latest assessment and explicitly created optimization
in process memory. It is designed for a single judging flow, not concurrent
multi-user or multi-worker production use. DynamoDB receives assessment and
recommendation writes, but the request path continues from the in-memory copy
so an AWS outage cannot break the demo.

## Licence

MIT. See [LICENSE](LICENSE).