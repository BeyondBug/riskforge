"""AI advisor endpoint. Explanation only, never a source of numbers."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ai.advisor import answer_question
from app.store import store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


class AdvisorRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    include_optimization: bool = True


@router.post("")
def ask(request: AdvisorRequest) -> dict:
    assessment = store.ensure_assessment()
    optimization = store.optimization if request.include_optimization else None

    try:
        return answer_question(request.question, assessment, optimization)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("advisor failed")
        raise HTTPException(status_code=500, detail="Advisor unavailable") from exc


@router.get("/context")
def context() -> dict:
    """Exactly what the model is allowed to see. Useful for judging and audit."""
    from app.ai.advisor import build_context

    return build_context(store.ensure_assessment(), store.optimization)
