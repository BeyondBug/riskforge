"""ReportLab executive report.

Every figure printed here is passed in from the engine or the optimizer.
The generator does no arithmetic of its own beyond formatting.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.recommendation import OptimizationResult
from app.models.risk import PortfolioAssessment

INK = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#475569")
ACCENT = colors.HexColor("#3b82f6")
DANGER = colors.HexColor("#ef4444")
LINE = colors.HexColor("#cbd5e1")

DISCLAIMER = (
    "Modeled estimates based on supplied inputs. "
    "Not a guarantee of actual losses."
)


def format_inr(amount: float) -> str:
    """Indian digit grouping: 1,23,45,678."""
    negative = amount < 0
    whole = f"{abs(amount):.0f}"
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        grouped = ",".join(parts) + "," + tail
    else:
        grouped = whole
    return ("-" if negative else "") + "INR " + grouped


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "rfTitle", parent=base["Title"], textColor=INK, fontSize=22, spaceAfter=4
        ),
        "sub": ParagraphStyle(
            "rfSub", parent=base["Normal"], textColor=SLATE, fontSize=10, spaceAfter=14
        ),
        "h2": ParagraphStyle(
            "rfH2",
            parent=base["Heading2"],
            textColor=INK,
            fontSize=13,
            spaceBefore=14,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "rfBody",
            parent=base["Normal"],
            textColor=INK,
            fontSize=9.5,
            leading=14,
            alignment=TA_LEFT,
        ),
        "small": ParagraphStyle(
            "rfSmall", parent=base["Normal"], textColor=SLATE, fontSize=8, leading=11
        ),
    }


def _table(data: list[list[str]], widths: list[float]) -> Table:
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                 [colors.white, colors.HexColor("#f1f5f9")]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def build_report_pdf(
    assessment: PortfolioAssessment,
    optimization: OptimizationResult | None = None,
) -> bytes:
    """Render the executive report and return the PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="RiskForge Executive Risk Report",
        author="RiskForge",
    )
    st = _styles()
    story: list = []

    generated = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    story.append(Paragraph("Cyber risk exposure and budget allocation", st["title"]))
    story.append(
        Paragraph(
            f"Assessment {assessment.assessment_id} &middot; generated {generated} "
            f"&middot; {assessment.dataset_label}",
            st["sub"],
        )
    )

    # --- Summary ----------------------------------------------------------
    story.append(Paragraph("What this assessment found", st["h2"]))
    summary = [
        ["Measure", "Value"],
        ["Modeled annual exposure", format_inr(assessment.total_eal_inr)],
        ["Open findings scored", str(assessment.findings_count)],
        ["Assets carrying risk", str(assessment.assets_at_risk)],
    ]
    if optimization is not None:
        summary += [
            ["Budget supplied", format_inr(optimization.budget_inr)],
            ["Budget committed", format_inr(optimization.total_cost_inr)],
            ["Modeled exposure removed",
             format_inr(optimization.total_eal_reduction_inr)],
            ["Residual exposure", format_inr(optimization.eal_after_inr)],
        ]
    story.append(_table(summary, [95 * mm, 79 * mm]))

    # --- Findings ---------------------------------------------------------
    story.append(Paragraph("Findings ranked by expected annual loss", st["h2"]))
    rows = [["Asset / finding", "Severity", "Likelihood", "Loss magnitude", "EAL"]]
    for r in assessment.results:
        label = f"{r.asset_name} - {r.cve_id or r.title}"
        rows.append(
            [
                label[:52],
                f"{r.severity_score:.1f}",
                f"{r.likelihood.likelihood:.3f}",
                format_inr(r.loss.loss_magnitude_inr),
                format_inr(r.eal_inr),
            ]
        )
    story.append(_table(rows, [64 * mm, 18 * mm, 22 * mm, 35 * mm, 35 * mm]))

    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "EAL = likelihood x loss magnitude. Likelihood is a weighted sum of "
            "normalised CVSS (0.25), exploit maturity (0.20), patch age (0.15), "
            "network exposure (0.15), control gap (0.15) and threat intelligence "
            "(0.10). Loss magnitude is the sum of downtime, incident response, "
            "recovery, data breach, regulatory and reputation components, each "
            "derived from the asset's documented loss drivers.",
            st["small"],
        )
    )

    # --- Allocation -------------------------------------------------------
    if optimization is not None:
        story.append(PageBreak())
        story.append(Paragraph("Where the budget goes", st["h2"]))
        story.append(
            Paragraph(
                f"Selected by a 0/1 knapsack ({optimization.solver}) maximising "
                f"modeled exposure removed, subject to total cost not exceeding "
                f"{format_inr(optimization.budget_inr)}.",
                st["body"],
            )
        )
        story.append(Spacer(1, 8))

        sel = [["Control", "Cost", "Reduction %", "Exposure removed", "Return"]]
        for s in optimization.selected:
            sel.append(
                [
                    s.name[:46],
                    format_inr(s.cost_inr),
                    f"{s.eal_reduction_pct * 100:.0f}%",
                    format_inr(s.eal_reduction_inr),
                    f"{s.roi:,.1f}x",
                ]
            )
        if len(sel) == 1:
            sel.append(["No control fits the supplied budget", "-", "-", "-", "-"])
        story.append(_table(sel, [58 * mm, 26 * mm, 24 * mm, 38 * mm, 28 * mm]))

        if optimization.rejected:
            story.append(Paragraph("Not funded in this cycle", st["h2"]))
            rej = [["Control", "Cost", "Exposure it would remove", "Return"]]
            for s in optimization.rejected:
                rej.append(
                    [
                        s.name[:46],
                        format_inr(s.cost_inr),
                        format_inr(s.eal_reduction_inr),
                        f"{s.roi:,.1f}x",
                    ]
                )
            story.append(_table(rej, [66 * mm, 30 * mm, 46 * mm, 32 * mm]))

    # --- Footer -----------------------------------------------------------
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            f"<font color='#ef4444'><b>{DISCLAIMER}</b></font> "
            f"Dataset: {assessment.dataset_label}. Figures are reproducible from "
            f"the inputs recorded with this assessment.",
            st["small"],
        )
    )

    doc.build(story)
    return buf.getvalue()
