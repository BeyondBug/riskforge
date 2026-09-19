"""AI advisor layer. Builds bounded context for the explanation model."""

from app.ai.advisor import answer_question, build_context

__all__ = ["build_context", "answer_question"]
