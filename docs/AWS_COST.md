# AWS cost notes

Region `ap-south-1` (Mumbai). Figures below are **derivations from the pricing
model, not quotes**. AWS pricing changes; verify against the AWS Pricing
Calculator before relying on any number here.

## What the demo actually consumes

| Service | Configuration | Driver |
|---|---|---|
| EC2 | 1 × `t3.micro`, on-demand, Amazon Linux 2023 | hours running |
| EBS | 8 GiB gp3 root volume | GiB-month |
| DynamoDB | 4 tables, PAY_PER_REQUEST | request units |
| S3 | `riskforge-reports-prod`, standard | GB-month + requests |
| Bedrock | Claude Haiku, on-demand | input + output tokens |
| CloudWatch Logs | `/riskforge/*` | GB ingested |
| Data transfer | HTTP responses to judges' browsers | GB out |

## Why this stays near zero for a hackathon

The workload is a five-row dataset exercised by a handful of demo sessions:

- **DynamoDB**: seeding writes 10 items. A demo run reads a few items and
  writes one assessment plus up to five recommendations. On-demand billing is
  per request unit, so a few hundred requests is a rounding error.
- **S3**: each PDF is tens of kilobytes. Ten reports is well under 1 MB stored.
- **Bedrock**: each advisor call sends the bounded context JSON (roughly 1–2 KB)
  and is capped at `BEDROCK_MAX_TOKENS=500` output. A dozen questions across the
  whole event is a few tens of thousands of tokens total.
- **EC2** dominates: it bills per hour whether or not anyone is using it.

The dashboard's dependency-status cards only read service state. They do not run
the optimizer or invoke Bedrock. Bedrock cost begins when a user submits an
advisor question; S3 write cost begins when a user generates a report.

**Cost control that matters most:** stop or terminate the EC2 instance when the
demo window closes. That single action removes the only charge that accrues
continuously.

```powershell
# PowerShell — stop the instance after judging
aws ec2 stop-instances --instance-ids i-XXXXXXXXXXXX --region ap-south-1

# When finished with the project entirely
aws ec2 terminate-instances --instance-ids i-XXXXXXXXXXXX --region ap-south-1
aws s3 rb s3://riskforge-reports-prod --force
aws dynamodb delete-table --table-name riskforge-assets --region ap-south-1
aws dynamodb delete-table --table-name riskforge-findings --region ap-south-1
aws dynamodb delete-table --table-name riskforge-assessments --region ap-south-1
aws dynamodb delete-table --table-name riskforge-recommendations --region ap-south-1
```

## Free Tier

A new AWS account's Free Tier has historically included `t3.micro` hours,
DynamoDB capacity, and S3 storage allowances, and Bedrock has not been part of
it. Both the inclusions and the account-age conditions have changed over time,
so check the current Free Tier page for this account rather than assuming.

## Guardrail worth setting before you start

```powershell
aws budgets create-budget `
  --account-id (aws sts get-caller-identity --query Account --output text) `
  --budget '{"BudgetName":"riskforge-guardrail","BudgetLimit":{"Amount":"10","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' `
  --region us-east-1
```

A budget alarm will not stop spend on its own, but it turns a surprise into a
notification.
