"""
Google Trends data via pytrends.
Collects search interest, regional breakdown, and seasonality.
No API key required.
"""

import time
from pytrends.request import TrendReq


INDUSTRY_KEYWORDS = {
    "hotel": ["Hotel kaufen", "Pension kaufen", "Hotel Nachfolge", "Gastgewerbe verkaufen"],
    "restaurant": ["Restaurant kaufen", "Gaststätte kaufen", "Restaurant Nachfolge", "Lokal kaufen"],
    "cafe": ["Café kaufen", "Kaffeehaus kaufen", "Café Nachfolge"],
    "café": ["Café kaufen", "Kaffeehaus kaufen", "Café Nachfolge"],
    "autowerkstatt": ["Autowerkstatt kaufen", "KFZ Betrieb kaufen", "Werkstatt Nachfolge"],
    "bäckerei": ["Bäckerei kaufen", "Bäckerei Nachfolge", "Konditorei kaufen"],
    "apotheke": ["Apotheke kaufen", "Apotheke Nachfolge"],
    "zahnarzt": ["Zahnarztpraxis kaufen", "Praxis Nachfolge"],
    "friseur": ["Friseursalon kaufen", "Salon Nachfolge"],
}

DEFAULT_KEYWORDS = ["{industry} kaufen", "{industry} Nachfolge", "Unternehmen kaufen Deutschland"]


def _build_kw(industry_type: str, city: str) -> list[str]:
    base = INDUSTRY_KEYWORDS.get(industry_type.lower())
    if not base:
        base = [k.format(industry=industry_type.capitalize()) for k in DEFAULT_KEYWORDS]
    return (base + [f"{industry_type.capitalize()} {city}"])[:5]


def collect(city: str, industry_type: str, zip_code: str) -> dict:
    try:
        pytrends = TrendReq(hl="de-DE", tz=60, timeout=(10, 30))
        keywords = _build_kw(industry_type, city)

        pytrends.build_payload(keywords, timeframe="today 5-y", geo="DE")

        # Interest over time (monthly)
        iot_df = pytrends.interest_over_time()
        iot = {}
        if not iot_df.empty:
            for kw in keywords:
                if kw in iot_df.columns:
                    iot[kw] = {str(ts)[:7]: int(v) for ts, v in iot_df[kw].items()}

        # Last 12 months for seasonality
        pytrends.build_payload(keywords[:1], timeframe="today 12-m", geo="DE")
        season_df = pytrends.interest_over_time()
        seasonality = {}
        if not season_df.empty and keywords[0] in season_df.columns:
            month_map: dict[str, list[int]] = {}
            for ts, v in season_df[keywords[0]].items():
                m = ts.strftime("%B")
                month_map.setdefault(m, []).append(int(v))
            seasonality = {m: round(sum(vs) / len(vs)) for m, vs in month_map.items()}

        time.sleep(1)

        # Regional interest by Bundesland
        pytrends.build_payload(keywords[:1], timeframe="today 5-y", geo="DE")
        regional: dict = {}
        try:
            reg_df = pytrends.interest_by_region(resolution="REGION", inc_low_vol=True)
            if not reg_df.empty and keywords[0] in reg_df.columns:
                regional = {
                    idx: int(v)
                    for idx, v in reg_df[keywords[0]].items()
                    if v > 0
                }
        except Exception:
            pass

        # Related rising queries
        time.sleep(1)
        rising: list[dict] = []
        try:
            related = pytrends.related_queries()
            for kw_data in related.values():
                df = kw_data.get("rising")
                if df is not None and not df.empty:
                    rising = df.head(10).to_dict("records")
                    break
        except Exception:
            pass

        return {
            "keywords": keywords,
            "interest_over_time": iot,
            "seasonality_last_12m": seasonality,
            "regional_interest_de": regional,
            "rising_queries": rising,
        }

    except Exception as e:
        return {"error": str(e), "keywords": [], "interest_over_time": {}}
