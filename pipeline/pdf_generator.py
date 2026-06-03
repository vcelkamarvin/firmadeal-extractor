"""
PDF report generator — produces a branded Firmadeal market intelligence brief.
Uses ReportLab for PDF creation.
"""

import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ── Brand colours ─────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#0f172a")
BLUE = colors.HexColor("#0ea5e9")
LIGHT = colors.HexColor("#f8fafc")
MUTED = colors.HexColor("#64748b")
GREEN = colors.HexColor("#10b981")
AMBER = colors.HexColor("#f59e0b")
RED_C = colors.HexColor("#ef4444")
BORDER = colors.HexColor("#e2e8f0")

W, H = A4  # 595 × 842 pt


def _styles():
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Normal"],
            fontSize=32, textColor=LIGHT, fontName="Helvetica-Bold",
            leading=40, spaceAfter=8,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"],
            fontSize=13, textColor=MUTED, fontName="Helvetica",
            leading=18,
        ),
        "section_head": ParagraphStyle(
            "section_head", parent=base["Normal"],
            fontSize=11, textColor=BLUE, fontName="Helvetica-Bold",
            spaceBefore=14, spaceAfter=4, leading=16,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9.5, textColor=NAVY, fontName="Helvetica",
            leading=15, spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"],
            fontSize=8, textColor=MUTED, fontName="Helvetica",
            leading=12,
        ),
        "kpi_value": ParagraphStyle(
            "kpi_value", parent=base["Normal"],
            fontSize=20, textColor=NAVY, fontName="Helvetica-Bold",
            leading=24, alignment=TA_CENTER,
        ),
        "kpi_label": ParagraphStyle(
            "kpi_label", parent=base["Normal"],
            fontSize=7.5, textColor=MUTED, fontName="Helvetica",
            leading=10, alignment=TA_CENTER,
        ),
        "table_head": ParagraphStyle(
            "table_head", parent=base["Normal"],
            fontSize=8, textColor=LIGHT, fontName="Helvetica-Bold",
            alignment=TA_CENTER,
        ),
        "table_cell": ParagraphStyle(
            "table_cell", parent=base["Normal"],
            fontSize=8, textColor=NAVY, fontName="Helvetica",
        ),
        "analysis": ParagraphStyle(
            "analysis", parent=base["Normal"],
            fontSize=9, textColor=NAVY, fontName="Helvetica",
            leading=14, spaceAfter=6,
        ),
    }


def _fmt_eur(v) -> str:
    if v is None: return "—"
    try:
        return f"€{int(v):,}".replace(",", ".")
    except Exception:
        return str(v)


def _kpi_row(items: list[tuple[str, str]], col_w: list[float], styles: dict) -> Table:
    """Create a row of KPI boxes."""
    cells = []
    for val, label in items:
        cells.append([
            Paragraph(val, styles["kpi_value"]),
            Paragraph(label, styles["kpi_label"]),
        ])
    t = Table([cells], colWidths=col_w)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (0, 0), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def _competitor_table(competitors: list[dict], styles: dict) -> Table:
    headers = ["Name", "Bewertung", "Rezensionen", "Status", "Preis"]
    rows = [
        [Paragraph(h, styles["table_head"]) for h in headers]
    ]
    for c in competitors[:10]:
        rating = str(c.get("rating") or "—")
        reviews = str(c.get("review_count") or "—")
        status = c.get("business_status", "—")
        price = "€" * int(c.get("price_level") or 0) or "—"
        rows.append([
            Paragraph(c.get("name", "—")[:40], styles["table_cell"]),
            Paragraph(rating, styles["table_cell"]),
            Paragraph(reviews, styles["table_cell"]),
            Paragraph(status, styles["table_cell"]),
            Paragraph(price, styles["table_cell"]),
        ])

    col_widths = [7*cm, 2.5*cm, 2.5*cm, 3.5*cm, 2*cm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
    ]))
    return t


def generate(data: dict, analysis: dict, output_path: str) -> str:
    """Generate the PDF and return the output path."""
    meta = data.get("meta", {})
    maps = data.get("google_maps", {})
    econ = data.get("economic_indices", {})
    nexxt = data.get("nexxt_change", {})
    ba = data.get("bundesagentur", {})
    destatis_d = data.get("destatis", {})
    web = data.get("website_analysis", {})

    city = meta.get("city", "—")
    industry = meta.get("industry_type", "—").capitalize()
    zip_code = meta.get("zip_code", "—")
    today = datetime.now().strftime("%d. %B %Y")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title=f"Firmadeal — {industry} {city}",
    )

    s = _styles()
    story = []
    usable_w = W - 4*cm

    # ── COVER PAGE ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 3*cm))
    cover_table = Table(
        [[Paragraph("FIRMADEAL", ParagraphStyle("logo", fontSize=11, textColor=BLUE, fontName="Helvetica-Bold", letterSpacing=3))]],
        colWidths=[usable_w],
    )
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 20),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
        ("LEFTPADDING", (0, 0), (-1, -1), 24),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 1.5*cm))

    title_tbl = Table([[
        Paragraph(f"Marktbericht<br/>{industry}<br/>{city}", s["cover_title"]),
    ]], colWidths=[usable_w])
    title_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 24),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 24),
        ("LEFTPADDING", (0, 0), (-1, -1), 24),
        ("RIGHTPADDING", (0, 0), (-1, -1), 24),
    ]))
    story.append(title_tbl)
    story.append(Spacer(1, 0.8*cm))

    meta_text = f"PLZ {zip_code} · Umkreis {meta.get('radius_m', 1000)} m · Erstellt {today}"
    story.append(Paragraph(meta_text, s["cover_sub"]))
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width=usable_w, thickness=1, color=BORDER))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        "Dieses Dokument ist vertraulich und ausschließlich für den internen Gebrauch bestimmt. "
        "Erstellt durch Firmadeal Intelligence Pipeline.",
        s["small"],
    ))
    story.append(PageBreak())

    # ── PAGE 2: KPI SUMMARY ───────────────────────────────────────────────────
    story.append(Paragraph("1. Kennzahlen auf einen Blick", s["section_head"]))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
    story.append(Spacer(1, 0.4*cm))

    comp_count = maps.get("competitor_count") or 0
    avg_rating = maps.get("avg_rating")
    total_reviews = maps.get("total_market_reviews") or 0
    job_signal = ba.get("market_activity_signal", "—")

    kpi_data = [
        (str(comp_count), "Wettbewerber im Umkreis"),
        (f"{avg_rating or '—'}", "Ø Bewertung"),
        (f"{total_reviews:,}".replace(",", "."), "Gesamte Markt-Reviews"),
        (job_signal.upper(), "Job-Markt-Signal"),
    ]
    cw = [usable_w / 4] * 4
    story.append(_kpi_row(kpi_data, cw, s))
    story.append(Spacer(1, 0.6*cm))

    # Valuation range KPI
    val = analysis.get("valuation_range")
    if val:
        story.append(Paragraph("Indikativer Bewertungsrahmen", s["section_head"]))
        story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
        story.append(Spacer(1, 0.3*cm))
        multiples = val.get("multiples_used", {})
        val_kpis = [
            (_fmt_eur(val.get("low_eur")), f"Unterer Wert ({multiples.get('low', '—')}x)"),
            (_fmt_eur(val.get("high_eur")), f"Oberer Wert ({multiples.get('high', '—')}x)"),
            (_fmt_eur(nexxt.get("avg_asking_price_eur")), "Ø nexxt-change Angebote"),
        ]
        story.append(_kpi_row(val_kpis, [usable_w / 3] * 3, s))
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph(
            f"Methode: {val.get('method', '—')} · Quellen: Google Maps, nexxt-change.org",
            s["small"],
        ))

    story.append(Spacer(1, 0.6*cm))

    # Macro context row
    story.append(Paragraph("Makroökonomischer Kontext", s["section_head"]))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
    story.append(Spacer(1, 0.3*cm))
    macro_kpis = [
        (f"{econ.get('ecb_main_rate_pct', '—')}%", "EZB-Leitzins"),
        (f"{econ.get('inflation_de_pct', '—')}%", "Inflation DE"),
        (f"{destatis_d.get('unemployment_rate_pct', '—')}%", f"Arbeitslosigkeit {destatis_d.get('bundesland', '')}"),
        (f"€{destatis_d.get('gdp_per_capita_eur', 0):,}".replace(",", "."), "BIP/Kopf Bundesland"),
    ]
    story.append(_kpi_row(macro_kpis, [usable_w / 4] * 4, s))
    story.append(PageBreak())

    # ── PAGE 3: ANALYST INSIGHTS ──────────────────────────────────────────────
    story.append(Paragraph("2. Analyst-Bewertung (KI-generiert)", s["section_head"]))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
    story.append(Spacer(1, 0.4*cm))

    analysis_text = analysis.get("analysis", "Keine Analyse verfügbar.")
    # Split by bold markdown headers and render as paragraphs
    for line in analysis_text.split("\n"):
        line = line.strip()
        if not line:
            story.append(Spacer(1, 0.2*cm))
            continue
        # Convert **text** to bold
        line = line.replace("**", "<b>", 1).replace("**", "</b>", 1)
        story.append(Paragraph(line, s["analysis"]))
    story.append(PageBreak())

    # ── PAGE 4: COMPETITOR TABLE ──────────────────────────────────────────────
    competitors = maps.get("competitors", [])
    if competitors:
        story.append(Paragraph("3. Wettbewerbslandschaft", s["section_head"]))
        story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
        story.append(Spacer(1, 0.4*cm))
        story.append(_competitor_table(competitors, s))
        story.append(Spacer(1, 0.5*cm))

        # Digital maturity
        if web.get("websites_checked", 0) > 0:
            story.append(Paragraph(
                f"Digitale Reife der Wettbewerber: Ø {web.get('avg_digital_maturity', 0)}/100 · "
                f"{web.get('has_booking_pct', 0)}% mit Online-Buchung · "
                f"{web.get('mobile_ready_pct', 0)}% mobiloptimiert",
                s["body"],
            ))

    # nexxt-change listings summary
    listings = nexxt.get("listings", [])
    if listings:
        story.append(Spacer(1, 0.6*cm))
        story.append(Paragraph("4. Aktive Verkaufsangebote — nexxt-change.org", s["section_head"]))
        story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE))
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph(
            f"{nexxt.get('listing_count', 0)} aktive Angebote gefunden · "
            f"Preisspanne: {_fmt_eur(nexxt.get('min_price_eur'))} – {_fmt_eur(nexxt.get('max_price_eur'))} · "
            f"Ø Kaufpreis: {_fmt_eur(nexxt.get('avg_asking_price_eur'))}",
            s["body"],
        ))
        for l in listings[:5]:
            story.append(Paragraph(
                f"• <b>{l.get('title', '—')}</b> — {l.get('location', '—')} — {_fmt_eur(l.get('price_eur'))}",
                s["body"],
            ))

    # ── FOOTER NOTE ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"Firmadeal Market Intelligence · {today} · "
        "Alle Angaben ohne Gewähr. Bewertungsangaben sind Schätzungen auf Basis öffentlich verfügbarer Daten. "
        "Keine Anlageberatung.",
        s["small"],
    ))

    doc.build(story)
    return output_path
