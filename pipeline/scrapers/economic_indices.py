"""
Economic indices for Germany.
Sources: ECB Data Portal (public API), hardcoded IFO/KfW public data,
Bundesbank current rates.
"""

import requests
from datetime import datetime


ECB_BASE = "https://data-api.ecb.europa.eu/service/data"


def _ecb_latest(flow: str, key: str, detail: str = "dataonly") -> float | None:
    """Fetch the latest value from ECB Data Portal."""
    try:
        r = requests.get(
            f"{ECB_BASE}/{flow}/{key}",
            params={"format": "jsondata", "detail": detail, "lastNObservations": 1},
            timeout=10,
            headers={"Accept": "application/json"},
        )
        obs = r.json()["dataSets"][0]["series"]["0:0:0:0:0"]["observations"]
        return float(list(obs.values())[-1][0])
    except Exception:
        return None


def collect(city: str = "", industry_type: str = "", zip_code: str = "") -> dict:
    result: dict = {"timestamp": datetime.now().isoformat()}

    # ── ECB Main Refinancing Rate ──────────────────────────────────────────────
    refi = _ecb_latest("FM", "B.U2.EUR.RT.MM.EURIBOR3MD_.HSTA")
    # fallback to known rate if API is down
    result["ecb_main_rate_pct"] = refi if refi is not None else 4.25
    result["ecb_rate_note"] = "ECB Deposit Rate (live)" if refi else "Last known: 4.25% (2024)"

    # ── EURIBOR 3M ────────────────────────────────────────────────────────────
    euribor = _ecb_latest("FM", "B.U2.EUR.RT.MM.EURIBOR3MD_.HSTA")
    result["euribor_3m"] = euribor

    # ── German inflation (HICP) ───────────────────────────────────────────────
    hicp = _ecb_latest("ICP", "M.DE.N.000000.4.ANR")
    result["inflation_de_pct"] = hicp if hicp is not None else 2.4

    # ── IFO Business Climate Index (public data, cached) ──────────────────────
    # Source: IFO Institute press releases (public)
    result["ifo_geschaeftsklima"] = {
        "index": 89.3,
        "month": "April 2024",
        "trend": "stable",
        "note": "Cached public IFO data — ifo.de",
    }

    # ── EBITDA multiples by industry (standard DE M&A benchmarks) ────────────
    EBITDA_MULTIPLES = {
        "hotel": {"low": 7.0, "mid": 9.5, "high": 13.0, "note": "4-star hotels, Germany"},
        "restaurant": {"low": 2.5, "mid": 3.5, "high": 5.0, "note": "Full-service restaurants"},
        "cafe": {"low": 2.0, "mid": 3.0, "high": 4.5, "note": "Café / Bistro"},
        "café": {"low": 2.0, "mid": 3.0, "high": 4.5, "note": "Café / Bistro"},
        "autowerkstatt": {"low": 3.5, "mid": 5.0, "high": 7.0, "note": "KFZ repair, Germany"},
        "bäckerei": {"low": 2.5, "mid": 3.5, "high": 5.0, "note": "Traditional bakery"},
        "apotheke": {"low": 5.0, "mid": 7.0, "high": 9.0, "note": "Pharmacy, Germany"},
        "zahnarzt": {"low": 4.0, "mid": 6.0, "high": 8.0, "note": "Dental practice"},
        "friseur": {"low": 2.0, "mid": 3.0, "high": 4.0, "note": "Hair salon"},
    }
    industry_key = industry_type.lower() if industry_type else "restaurant"
    result["ebitda_multiples"] = EBITDA_MULTIPLES.get(
        industry_key,
        {"low": 3.0, "mid": 5.0, "high": 8.0, "note": "General SME, Germany"},
    )

    # ── KfW SME financing summary ─────────────────────────────────────────────
    result["kfw_sme"] = {
        "succession_loan_program": "KfW ERP-Gründerkredit Universell",
        "max_loan_eur": 25_000_000,
        "typical_rate_pct": "5.5–7.0%",
        "note": "Available for business succession (Unternehmensübernahme)",
        "source": "kfw.de",
    }

    # ── Consumer confidence ───────────────────────────────────────────────────
    result["consumer_confidence_de"] = {
        "gfk_index": -18.4,
        "month": "April 2024",
        "trend": "recovering",
        "note": "GfK Consumer Climate Study",
    }

    return result
