"""DynamoDB adapter with an in-memory fallback.

If boto3 cannot reach DynamoDB (no credentials, no network, tables absent),
the service logs the reason once and keeps serving from a process-local dict.
The demo therefore still runs end to end, and `backend` in the health payload
reports which mode is active so nobody mistakes local state for persisted state.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from functools import lru_cache
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def _to_dynamo(value: Any) -> Any:
    """DynamoDB rejects float; convert via str to avoid binary-float drift."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _to_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_dynamo(v) for v in value]
    return value


def _from_dynamo(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _from_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_from_dynamo(v) for v in value]
    return value


class DynamoDBService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._memory: dict[str, dict[str, dict]] = {}
        self._resource = None
        self.mode = "memory"
        self._init_error: str | None = None
        self._connect()

    # -- setup -------------------------------------------------------------
    def _connect(self) -> None:
        try:
            import boto3
            from botocore.config import Config

            self._resource = boto3.resource(
                "dynamodb",
                region_name=self.settings.aws_region,
                config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1}),
            )
            # Cheap liveness probe against one real table.
            self._resource.Table(self.settings.dynamodb_table_assets).load()
            self.mode = "dynamodb"
            logger.info("DynamoDB connected in %s", self.settings.aws_region)
        except Exception as exc:
            self._resource = None
            self.mode = "memory"
            self._init_error = f"{type(exc).__name__}: {exc}"
            logger.warning("DynamoDB unavailable, using in-memory store (%s)", exc)

    @property
    def status(self) -> dict[str, Any]:
        return {"mode": self.mode, "error": self._init_error}

    def _table(self, name: str):
        return self._resource.Table(name)

    # -- CRUD --------------------------------------------------------------
    def put_item(self, table: str, item: dict, pk_name: str) -> dict:
        if self.mode == "dynamodb":
            try:
                self._table(table).put_item(Item=_to_dynamo(item))
                return item
            except Exception as exc:
                logger.error("put_item failed on %s: %s", table, exc)
                self.mode = "memory"
                self._init_error = f"{type(exc).__name__}: {exc}"

        self._memory.setdefault(table, {})[str(item[pk_name])] = item
        return item

    def get_item(self, table: str, pk_name: str, pk_value: str) -> dict | None:
        if self.mode == "dynamodb":
            try:
                resp = self._table(table).get_item(Key={pk_name: pk_value})
                item = resp.get("Item")
                return _from_dynamo(item) if item else None
            except Exception as exc:
                logger.error("get_item failed on %s: %s", table, exc)

        return self._memory.get(table, {}).get(str(pk_value))

    def query_by_index(
        self, table: str, index_name: str, key_name: str, key_value: str
    ) -> list[dict]:
        if self.mode == "dynamodb":
            try:
                from boto3.dynamodb.conditions import Key

                resp = self._table(table).query(
                    IndexName=index_name,
                    KeyConditionExpression=Key(key_name).eq(key_value),
                )
                return [_from_dynamo(i) for i in resp.get("Items", [])]
            except Exception as exc:
                logger.error("query failed on %s/%s: %s", table, index_name, exc)

        return [
            item
            for item in self._memory.get(table, {}).values()
            if str(item.get(key_name)) == str(key_value)
        ]

    def scan(self, table: str, limit: int = 100) -> list[dict]:
        """Scan is used only for the 5-row demo dataset, never for real volume."""
        if self.mode == "dynamodb":
            try:
                resp = self._table(table).scan(Limit=limit)
                return [_from_dynamo(i) for i in resp.get("Items", [])]
            except Exception as exc:
                logger.error("scan failed on %s: %s", table, exc)

        return list(self._memory.get(table, {}).values())[:limit]


@lru_cache(maxsize=1)
def get_dynamodb_service() -> DynamoDBService:
    return DynamoDBService()
