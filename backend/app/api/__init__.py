"""FastAPI routers."""

from app.api import advisor, assessments, health, reports

__all__ = ["health", "assessments", "advisor", "reports"]
