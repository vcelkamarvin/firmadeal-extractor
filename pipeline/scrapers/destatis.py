"""
Destatis GENESIS API scraper.
Collects German federal statistics: population, GDP, business registrations.
Free account at: https://www-genesis.destatis.de
"""

import os
import requests

GENESIS_BASE = "https://www-genesis.destatis.de/genesisWS/rest/2020"
USERNAME = os.getenv("DESTATIS_USERNAME", "GUEST")
PASSWORD = os.getenv("DESTATIS_PASSWORD", "")

# PLZ to Bundesland mapping (abbreviated)
PLZ_TO_BUNDESLAND = {
    "1": "Berlin / Brandenburg",
    "2": "Hamburg / Schleswig-Holstein",
    "3": "Niedersachsen / Bremen",
    "4": "Nordrhein-Westfalen (West)",
    "5": "Nordrhein-Westfalen (Ost)",
    "6": "Hessen",
    "7": "Baden-Württemberg",
    "8": "Bayern",
    "9": "Bayern / Thüringen / Sachsen",
    "0": "Sachsen / Thüringen",
}

# Bundesland codes for GENESIS
BUNDESLAND_CODES = {
    "Bayern": "09",
    "Baden-Württemberg": "08",
    "Nordrhein-Westfalen": "05",
    "Hessen": "06",
    "Hamburg": "02",
    "Berlin": "11",
    "Brandenburg": "12",
    "Sachsen": "14",
    "Thüringen": "16",
    "Niedersachsen": "03",
    "Bayern / Thüringen / Sachsen": "09",
}

# Industry WZ codes (Wirtschaftszweige)
INDUSTRY_WZ = {
    "hotel": "55",
    "restaurant": "56",
    "cafe": "56",
    "café": "56",
    "autowerkstatt": "45",
    "bäckerei": "107",
    "apotheke": "47",
    "zahnarzt": "86",
    "friseur": "96",
}


def _bundesland_from_zip(zip_code: str) -> str:
    first = zip_code[0] if zip_code else "8"
    return PLZ_TO_BUNDESLAND.get(first, "Bayern")


def _genesis_get(table: str, params: dict) -> dict:
    """Call the GENESIS REST API for a table."""
    base_params = {
        "username": USERNAME,
        "password": PASSWORD,
        "language": "de",
        "name": table,
        "format": "json",
    }
    base_params.update(params)
    try:
        r = requests.get(
            f"{GENESIS_BASE}/data/tablefile",
            params=base_params,
            timeout=15,
        )
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def _get_public_data() -> dict:
    """Fetch publicly available data without auth — demographics and business stats."""
    # Use the GENESIS data catalogue endpoint (no auth needed for some tables)
    try:
        r = requests.get(
            f"{GENESIS_BASE}/catalogue/tables",
            params={"username": "GUEST", "password": "", "language": "de", "searchcriterion": "52111", "sortcriterion": "code"},
            timeout=10,
        )
        return r.json()
    except Exception:
        return {}


def collect(city: str, industry_type: str, zip_code: str) -> dict:
    bundesland = _bundesland_from_zip(zip_code)
    bl_code = BUNDESLAND_CODES.get(bundesland, "09")
    wz = INDUSTRY_WZ.get(industry_type.lower(), "56")

    result: dict = {
        "bundesland": bundesland,
        "bundesland_code": bl_code,
        "wz_code": wz,
    }

    # ── Business registrations / deregistrations (Gewerbemeldungen) ──────────
    # Table 52111: Gewerbeanzeigen
    reg_data = _genesis_get("52111-0001", {
        "regionalkey": bl_code + "*",
        "startyear": "2019",
        "endyear": "2023",
    })
    if "Object" in reg_data:
        result["business_registrations"] = reg_data["Object"]
    else:
        # Fallback: known public summary statistics for Germany
        result["business_registrations"] = {
            "note": "Live data requires GENESIS auth. National trend: ~450k registrations/yr, ~390k deregistrations/yr",
            "net_trend": "positive",
            "succession_pressure_note": "~15% of German SME owners aged 60+, ~125k businesses seek successor per year (IfM Bonn)",
        }

    # ── Population age distribution ───────────────────────────────────────────
    pop_data = _genesis_get("12411-0016", {
        "regionalkey": bl_code + "*",
        "startyear": "2022",
        "endyear": "2022",
    })
    if "Object" in pop_data:
        result["population"] = pop_data["Object"]
    else:
        result["population"] = {
            "note": "Requires GENESIS auth for live data",
            "bundesland": bundesland,
            "over_55_pct_estimate": "32%",
            "aging_trend": "increasing",
        }

    # ── GDP per capita by Bundesland (public aggregate) ───────────────────────
    GDP_BY_BUNDESLAND = {
        "Bayern": 49800,
        "Baden-Württemberg": 48900,
        "Hamburg": 72000,
        "Hessen": 52000,
        "Nordrhein-Westfalen": 39000,
        "Berlin": 38000,
        "Brandenburg": 30000,
        "Sachsen": 30500,
        "Thüringen": 29000,
        "Niedersachsen": 36000,
        "Bayern / Thüringen / Sachsen": 40000,
    }
    result["gdp_per_capita_eur"] = GDP_BY_BUNDESLAND.get(bundesland, 38000)

    # ── Unemployment rate by Bundesland (latest public data) ─────────────────
    UNEMPLOYMENT_BY_BUNDESLAND = {
        "Bayern": 2.6,
        "Baden-Württemberg": 3.0,
        "Hamburg": 6.1,
        "Hessen": 4.5,
        "Nordrhein-Westfalen": 6.5,
        "Berlin": 8.0,
        "Brandenburg": 5.8,
        "Sachsen": 5.6,
        "Thüringen": 5.4,
        "Niedersachsen": 5.1,
        "Bayern / Thüringen / Sachsen": 4.5,
    }
    result["unemployment_rate_pct"] = UNEMPLOYMENT_BY_BUNDESLAND.get(bundesland, 5.0)

    return result
