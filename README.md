# RiskForge

Cyber risk quantification and budget allocation. Answers one question:

> I have a fixed security budget. What should I fix first?

RiskForge converts security findings into modeled rupee exposure, then solves a
budget-constrained selection problem over remediation options. The model is
deterministic — the same inputs always produce the same output — so every
figure on screen can be traced back to an input and a formula.

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

## Stack

FastAPI · Pydantic v2 · PuLP · ReportLab · boto3 · React 18 · TypeScript ·
Vite · Recharts · Tailwind · Nginx · Docker Compose · EC2 · DynamoDB · S3 ·
Bedrock — `ap-south-1`.

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
| GET | `/api/findings` | Findings with computed EAL |
| POST | `/api/assessments` | Re-score the portfolio |
| GET | `/api/assessments/current` | Latest assessment |
| GET | `/api/controls` | Candidate controls with rupee reductions |
| POST | `/api/optimize` | Budget allocation |
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

## Limitations

Loss magnitude is per-asset, so a second finding on the same asset reuses the
full figure rather than a marginal one. Control reductions are treated as
independent. The demo dataset's per-record and reputation factors are
illustrative planning inputs, not figures from a published breach study, and
the CVE severity scores shipped with it are demo values that should be
re-verified against NVD before any real use.

## Licence

MIT. See [LICENSE](LICENSE).
