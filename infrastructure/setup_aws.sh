#!/usr/bin/env bash
# RiskForge AWS provisioning. Idempotent where the API allows it.
#
# Bash (EC2 / WSL / Git Bash). Phase 6 of the build plan contains the
# equivalent PowerShell one-liners for Windows 11.
#
#   chmod +x infrastructure/setup_aws.sh
#   ./infrastructure/setup_aws.sh

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
BUCKET="${S3_BUCKET_REPORTS:-riskforge-reports-prod}"
ROLE_NAME="riskforge-ec2-role"
PROFILE_NAME="riskforge-ec2-profile"

# Cross-region inference profile and the foundation model it fronts.
# The '*' in the model ARN is the REGION field only: the model itself stays
# pinned, so this does not widen access to any other Bedrock model.
BEDROCK_PROFILE_ID="${BEDROCK_PROFILE_ID:-ap.anthropic.claude-haiku-4-5-20251001-v1:0}"
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-anthropic.claude-haiku-4-5-20251001-v1:0}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account ${ACCOUNT_ID}, region ${REGION}"

# --- DynamoDB ---------------------------------------------------------------
create_table() {
  local name="$1"; shift
  if aws dynamodb describe-table --table-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "  table $name already exists"
  else
    aws dynamodb create-table --table-name "$name" --region "$REGION" \
      --billing-mode PAY_PER_REQUEST "$@" >/dev/null
    echo "  created $name"
  fi
}

echo "DynamoDB tables:"
create_table riskforge-assets \
  --attribute-definitions AttributeName=asset_id,AttributeType=S \
  --key-schema AttributeName=asset_id,KeyType=HASH

create_table riskforge-findings \
  --attribute-definitions AttributeName=finding_id,AttributeType=S \
                          AttributeName=asset_id,AttributeType=S \
  --key-schema AttributeName=finding_id,KeyType=HASH \
  --global-secondary-indexes \
    'IndexName=asset_id-index,KeySchema=[{AttributeName=asset_id,KeyType=HASH}],Projection={ProjectionType=ALL}'

create_table riskforge-assessments \
  --attribute-definitions AttributeName=assessment_id,AttributeType=S \
  --key-schema AttributeName=assessment_id,KeyType=HASH

create_table riskforge-recommendations \
  --attribute-definitions AttributeName=rec_id,AttributeType=S \
                          AttributeName=assessment_id,AttributeType=S \
  --key-schema AttributeName=rec_id,KeyType=HASH \
  --global-secondary-indexes \
    'IndexName=assessment_id-index,KeySchema=[{AttributeName=assessment_id,KeyType=HASH}],Projection={ProjectionType=ALL}'

for t in riskforge-assets riskforge-findings riskforge-assessments riskforge-recommendations; do
  aws dynamodb wait table-exists --table-name "$t" --region "$REGION"
done
echo "  all tables ACTIVE"

# --- S3 ---------------------------------------------------------------------
echo "S3 bucket:"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "  bucket $BUCKET already exists"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  echo "  created $BUCKET"
fi

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
echo "  public access blocked, SSE-S3 enabled"

# --- IAM --------------------------------------------------------------------
echo "IAM role:"
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "  role $ROLE_NAME already exists"
else
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" >/dev/null
  echo "  created $ROLE_NAME"
fi

POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBRiskForgeTables",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:Query","dynamodb:Scan","dynamodb:DescribeTable","dynamodb:BatchWriteItem"],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/riskforge-*",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/riskforge-*/index/*"
      ]
    },
    {
      "Sid": "S3Reports",
      "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Sid": "S3HeadBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::${BUCKET}"
    },
    {
      "Sid": "BedrockInferenceProfile",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:${REGION}:${ACCOUNT_ID}:inference-profile/${BEDROCK_PROFILE_ID}"
    },
    {
      "Sid": "BedrockUnderlyingModelAnyProfileRegion",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:*::foundation-model/${BEDROCK_MODEL_ID}"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/riskforge/*"
    }
  ]
}
JSON
)

aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name riskforge-inline-policy \
  --policy-document "$POLICY"
echo "  inline policy attached"

if aws iam get-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null 2>&1; then
  echo "  instance profile already exists"
else
  aws iam create-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null
  aws iam add-role-to-instance-profile \
    --instance-profile-name "$PROFILE_NAME" --role-name "$ROLE_NAME"
  echo "  created instance profile $PROFILE_NAME"
fi

echo
echo "Done. Next: create the security group and key pair, then run-instances"
echo "with --iam-instance-profile Name=${PROFILE_NAME}."
