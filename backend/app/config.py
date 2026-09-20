"""Application configuration. All values come from environment or .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- AWS ---------------------------------------------------------------
    aws_region: str = "ap-south-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None

    # --- DynamoDB ----------------------------------------------------------
    dynamodb_table_assets: str = "riskforge-assets"
    dynamodb_table_findings: str = "riskforge-findings"
    dynamodb_table_assessments: str = "riskforge-assessments"
    dynamodb_table_recommendations: str = "riskforge-recommendations"

    # --- S3 ----------------------------------------------------------------
    s3_bucket_reports: str = "riskforge-reports-prod"
    s3_report_url_expiry: int = 3600

    # --- Bedrock -----------------------------------------------------------
    bedrock_model_id: str = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_max_tokens: int = 500
    bedrock_enabled: bool = True

    # --- App ---------------------------------------------------------------
    app_env: str = "development"
    app_port: int = 8000
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


DISCLAIMER = (
    "Modeled estimates based on supplied inputs. "
    "Not a guarantee of actual losses."
)
DATASET_LABEL = "Synthetic Demo Dataset"
MODEL_VERSION = "riskforge-eal-v1"
