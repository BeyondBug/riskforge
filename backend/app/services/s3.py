"""S3 adapter for PDF reports, with a local-disk fallback.

The bucket blocks all public access, so downloads are served only through
short-lived pre-signed URLs. When S3 is unreachable the PDF is written under
/tmp and served back through the API instead, so the demo never dead-ends.
"""

from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

LOCAL_REPORT_DIR = os.path.join(tempfile.gettempdir(), "riskforge-reports")


class S3Service:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        self.mode = "local"
        self._init_error: str | None = None
        os.makedirs(LOCAL_REPORT_DIR, exist_ok=True)
        self._connect()

    def _connect(self) -> None:
        try:
            import boto3
            from botocore.config import Config

            client = boto3.client(
                "s3",
                region_name=self.settings.aws_region,
                config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1}),
            )
            client.head_bucket(Bucket=self.settings.s3_bucket_reports)
            self._client = client
            self.mode = "s3"
            logger.info("S3 bucket %s reachable", self.settings.s3_bucket_reports)
        except Exception as exc:
            self._client = None
            self.mode = "local"
            self._init_error = f"{type(exc).__name__}: {exc}"
            logger.warning("S3 unavailable, writing reports to %s (%s)",
                           LOCAL_REPORT_DIR, exc)

    @property
    def status(self) -> dict[str, Any]:
        return {"mode": self.mode, "error": self._init_error}

    def upload_report(self, key: str, data: bytes) -> dict[str, Any]:
        """Store the PDF and return a download reference."""
        if self.mode == "s3" and self._client is not None:
            try:
                self._client.put_object(
                    Bucket=self.settings.s3_bucket_reports,
                    Key=key,
                    Body=data,
                    ContentType="application/pdf",
                    ServerSideEncryption="AES256",
                )
                url = self._client.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": self.settings.s3_bucket_reports,
                        "Key": key,
                    },
                    ExpiresIn=self.settings.s3_report_url_expiry,
                )
                return {
                    "storage": "s3",
                    "key": key,
                    "download_url": url,
                    "expires_in_seconds": self.settings.s3_report_url_expiry,
                }
            except Exception as exc:
                logger.error("S3 upload failed for %s: %s", key, exc)

        path = os.path.join(LOCAL_REPORT_DIR, key.replace("/", "_"))
        with open(path, "wb") as fh:
            fh.write(data)
        return {
            "storage": "local",
            "key": key,
            "download_url": f"/api/reports/download/{key.replace('/', '_')}",
            "expires_in_seconds": None,
            "local_path": path,
        }

    def local_path(self, filename: str) -> str:
        return os.path.join(LOCAL_REPORT_DIR, filename)


@lru_cache(maxsize=1)
def get_s3_service() -> S3Service:
    return S3Service()
