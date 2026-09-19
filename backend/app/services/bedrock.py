"""Amazon Bedrock adapter (Claude Haiku) for explanation only.

The model is never allowed to produce a number that is not already in the
JSON context we supply. That constraint lives in SYSTEM_PROMPT.

When Bedrock is unavailable the request is served by `_templated_answer`,
which renders the *same* JSON through a deterministic template. This is a
designed second path, not an error handler: the figures it reports are
identical to the ones the model would have been quoting, because both read
the same computed payload. The response always states which path produced
it, so the distinction is never hidden from the reader.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a risk explanation assistant. You MUST NOT invent, estimate, or "
    "calculate any numbers. You MUST only explain the structured data "
    "provided. Every number you mention must come from the supplied JSON. If "
    "asked for a number not in the data, say: I cannot confirm that from the "
    "available evidence."
)

# Coarse, user-safe reasons. Raw AWS error text is logged but never returned
# to the client, so account or billing detail cannot leak through the API.
REASON_DISABLED = "Model explanation is switched off for this deployment."
REASON_NO_ACCESS = "Model access is not currently available to this account."
REASON_UNREACHABLE = "The model endpoint could not be reached."


def format_inr(amount: Any) -> str:
    """Indian digit grouping: 1,23,45,678."""
    try:
        value = float(amount)
    except (TypeError, ValueError):
        return str(amount)

    negative = value < 0
    whole = f"{abs(value):.0f}"
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts: list[str] = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        grouped = ",".join(parts) + "," + tail
    else:
        grouped = whole
    return ("-" if negative else "") + "INR " + grouped


def format_inr_short(amount: Any) -> str:
    """Crore above 1e7, lakh above 1e5, otherwise the grouped figure."""
    try:
        value = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    if abs(value) >= 1e7:
        return f"INR {value / 1e7:.2f} Cr"
    if abs(value) >= 1e5:
        return f"INR {value / 1e5:.2f} L"
    return format_inr(value)


class BedrockService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        self.mode = "fallback"
        self._init_error: str | None = None
        self._reason: str | None = None
        self._last_invocation: str | None = None

        if self.settings.bedrock_enabled:
            self._connect()
        else:
            self._init_error = "BEDROCK_ENABLED=false"
            self._reason = REASON_DISABLED

    def _connect(self) -> None:
        try:
            import boto3

            self._client = boto3.client(
                "bedrock-runtime", region_name=self.settings.aws_region
            )
            self.mode = "bedrock"
            logger.info("Bedrock client ready (%s)", self.settings.bedrock_model_id)
        except Exception as exc:
            self._client = None
            self.mode = "fallback"
            self._init_error = f"{type(exc).__name__}: {exc}"
            self._reason = REASON_UNREACHABLE
            logger.warning("Bedrock unavailable, using templated fallback (%s)", exc)

    @property
    def status(self) -> dict[str, Any]:
        """Reported by /api/health/deps.

        `mode` only says whether a client was constructed, which does not by
        itself prove an invocation would succeed. `last_invocation` carries
        the outcome of the most recent real call, which does.
        """
        return {
            "mode": self.mode,
            "model_id": self.settings.bedrock_model_id,
            "error": self._init_error,
            "last_invocation": self._last_invocation,
            "reason": self._reason,
        }

    @staticmethod
    def _classify(exc: Exception) -> str:
        name = type(exc).__name__
        text = str(exc)
        if "AccessDenied" in name or "AccessDenied" in text:
            return REASON_NO_ACCESS
        if "Validation" in name or "ResourceNotFound" in name:
            return REASON_NO_ACCESS
        return REASON_UNREACHABLE

    def explain(self, question: str, context: dict) -> dict[str, Any]:
        """Explain `context`. Reports which path produced the answer."""
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": self.settings.bedrock_max_tokens,
            "temperature": 0.0,
            "system": SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "Structured data (the only permitted source of numbers):\n"
                        f"{json.dumps(context, indent=2, default=str)}\n\n"
                        f"Question: {question}"
                    ),
                }
            ],
        }

        if self.mode == "bedrock" and self._client is not None:
            try:
                resp = self._client.invoke_model(
                    modelId=self.settings.bedrock_model_id,
                    body=json.dumps(payload),
                    contentType="application/json",
                    accept="application/json",
                )
                body = json.loads(resp["body"].read())
                blocks = body.get("content", [])
                text = "".join(
                    b.get("text", "") for b in blocks if b.get("type") == "text"
                ).strip()
                if text:
                    self._last_invocation = "ok"
                    self._reason = None
                    return {"answer": text, "mode": "bedrock", "reason": None}
                logger.warning("Bedrock returned no text block, using fallback")
                self._last_invocation = "empty_response"
                self._reason = REASON_UNREACHABLE
            except Exception as exc:
                logger.error("Bedrock invoke failed: %s", exc)
                self._last_invocation = f"failed: {type(exc).__name__}"
                self._reason = self._classify(exc)

        return {
            "answer": _templated_answer(question, context),
            "mode": "fallback",
            "reason": self._reason or REASON_UNREACHABLE,
        }


def _templated_answer(question: str, context: dict) -> str:
    """Deterministic explanation rendered from `context` alone.

    No language model is involved and no arithmetic happens here: every
    figure is read straight out of the payload the engine produced.
    """
    totals = context.get("totals") or {}
    selected = context.get("selected_controls") or []
    rejected = context.get("rejected_controls") or []
    top = context.get("top_findings") or []
    budget = context.get("budget_inr")

    lines: list[str] = [
        "Deterministic explanation. Every figure below is read directly from "
        "the computed assessment. No language model produced any of them.",
        "",
    ]

    exposure = totals.get("total_modeled_annual_exposure_inr")
    if exposure is not None:
        lines.append(
            f"Across {totals.get('findings_count', 'the')} open findings on "
            f"{totals.get('assets_at_risk', 'the')} assets, total modeled "
            f"annual exposure is {format_inr_short(exposure)} "
            f"({format_inr(exposure)})."
        )
        lines.append("")

    if selected:
        lines.append(
            f"Budget supplied: {format_inr(budget)}. The optimizer solves a "
            "0/1 knapsack, maximising modeled exposure removed subject to "
            "total cost staying within that budget. It selected the "
            "following, highest reduction first:"
        )
        lines.append("")
        for index, control in enumerate(selected, start=1):
            roi = control.get("roi_inr_reduced_per_inr_spent")
            tail = (
                f", a return of {roi:,.1f} rupees removed per rupee spent."
                if isinstance(roi, (int, float))
                else "."
            )
            lines.append(
                f"{index}. {control.get('name')} costs "
                f"{format_inr(control.get('cost_inr', 0))} and removes "
                f"{format_inr_short(control.get('eal_reduction_inr', 0))} "
                f"of modeled exposure{tail}"
            )
        lines.append("")

        committed = totals.get("total_cost_inr")
        removed = totals.get("total_eal_reduction_inr")
        remaining = totals.get("budget_remaining_inr")
        after = totals.get("eal_after_inr")
        if committed is not None and removed is not None:
            if isinstance(remaining, (int, float)) and remaining > 0:
                unspent = (
                    f" {format_inr(remaining)} stays unspent because no "
                    "remaining control fits inside it."
                    if rejected
                    else f" {format_inr(remaining)} stays unspent: every "
                    "candidate control is already funded at this budget."
                )
            else:
                unspent = ""
            lines.append(
                f"That commits {format_inr(committed)} and removes "
                f"{format_inr_short(removed)} of exposure, leaving "
                f"{format_inr_short(after)} residual.{unspent}"
            )
            lines.append("")

    if rejected:
        lines.append(
            "Not funded. Each of these lost out because the same rupees "
            "removed more exposure elsewhere, or because it no longer fit "
            "the remaining budget:"
        )
        for control in rejected:
            lines.append(
                f"- {control.get('name')}: "
                f"{format_inr(control.get('cost_inr', 0))} to remove "
                f"{format_inr_short(control.get('eal_reduction_inr', 0))}."
            )
        lines.append("")

    if top and not selected:
        lines.append("Highest-exposure findings in this assessment:")
        for finding in top:
            lines.append(
                f"- {finding.get('title')} on {finding.get('asset_name')}: "
                f"likelihood {finding.get('likelihood')}, expected annual "
                f"loss {format_inr_short(finding.get('eal_inr', 0))}."
            )
        lines.append("")
        lines.append(
            "Run the optimizer with a budget to see which of these get funded."
        )
        lines.append("")

    lines.append(
        "Modeled estimates based on supplied inputs. "
        "Not a guarantee of actual losses."
    )
    return "\n".join(lines).strip()


@lru_cache(maxsize=1)
def get_bedrock_service() -> BedrockService:
    return BedrockService()
