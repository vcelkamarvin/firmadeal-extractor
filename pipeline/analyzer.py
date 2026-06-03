"""
Claude API integration — generates M&A analyst insights from collected data.
"""

import os
import json
import anthropic

CLAUDE_MODEL = "claude-sonnet-4-6"


def analyze(data: dict) -> dict:
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return {
            "error": "CLAUDE_API_KEY not set",
            "insights": None,
            "valuation_range": None,
        }

    client = anthropic.Anthropic(api_key=api_key)

    meta = data.get("meta", {})
    maps = data.get("google_maps", {})
    econ = data.get("economic_indices", {})
    destatis_d = data.get("destatis", {})
    nexxt = data.get("nexxt_change", {})
    trends = data.get("google_trends", {})
    ba = data.get("bundesagentur", {})

    # Build a structured summary to send to Claude (avoid sending raw MB of data)
    summary = {
        "target": {
            "city": meta.get("city"),
            "industry": meta.get("industry_type"),
            "zip_code": meta.get("zip_code"),
        },
        "competitive_landscape": {
            "competitor_count": maps.get("competitor_count"),
            "avg_competitor_rating": maps.get("avg_rating"),
            "total_market_reviews": maps.get("total_market_reviews"),
            "avg_reviews_per_competitor": maps.get("avg_reviews_per_competitor"),
            "price_distribution": maps.get("price_level_distribution"),
            "operational_pct": maps.get("operational_pct"),
        },
        "market_demand": {
            "job_listings": ba.get("total_job_listings"),
            "job_market_signal": ba.get("market_activity_signal"),
            "search_trends_available": bool(trends.get("interest_over_time")),
            "rising_queries": trends.get("rising_queries", [])[:5],
        },
        "macro_context": {
            "bundesland": destatis_d.get("bundesland"),
            "gdp_per_capita": destatis_d.get("gdp_per_capita_eur"),
            "unemployment_pct": destatis_d.get("unemployment_rate_pct"),
            "ecb_rate": econ.get("ecb_main_rate_pct"),
            "inflation_de": econ.get("inflation_de_pct"),
            "consumer_confidence": econ.get("consumer_confidence_de", {}).get("gfk_index"),
        },
        "valuation_proxies": {
            "ebitda_multiples": econ.get("ebitda_multiples"),
            "market_listings": nexxt.get("listing_count"),
            "avg_asking_price": nexxt.get("avg_asking_price_eur"),
            "price_range": {
                "min": nexxt.get("min_price_eur"),
                "max": nexxt.get("max_price_eur"),
            },
        },
        "succession_pressure": destatis_d.get("business_registrations", {}).get(
            "succession_pressure_note"
        ),
    }

    prompt = f"""Du bist ein erfahrener M&A-Analyst, spezialisiert auf den deutschen Mittelstand.

Analysiere folgende Marktdaten für eine Zielakquise im Bereich {meta.get('industry_type')} in {meta.get('city')}:

{json.dumps(summary, ensure_ascii=False, indent=2)}

Erstelle einen prägnanten Analysebericht mit folgenden Abschnitten:

**1. MARKTCHANCE** (2-3 Sätze)
Beschreibe das Marktpotenzial basierend auf Wettbewerbsdichte und Nachfragesignalen.

**2. TIMING-ARGUMENT** (2-3 Sätze)
Warum ist jetzt ein günstiger Zeitpunkt für eine Übernahme? Nutze konkrete Zahlen (Zinsen, Markt, Demografik).

**3. RISIKOFAKTOREN** (3-4 Punkte als Liste)
Ehrliche Bewertung der wichtigsten Risiken für den Käufer.

**4. BEWERTUNGSRAHMEN** (3-4 Sätze)
Leite eine plausible Preisspanne (in EUR) ab, basierend auf EBITDA-Multiplikatoren und verfügbaren Marktdaten. Zeige die Rechenlogik.

**5. WETTBEWERBSPOSITIONIERUNG** (2-3 Sätze)
Wie positioniert sich ein potenzieller Erwerber gegenüber dem lokalen Markt?

**6. HANDLUNGSEMPFEHLUNG** (1 Satz)
Klare Empfehlung: Weiterverfolgen / vertiefte Prüfung / Abstand nehmen.

Schreibe professionell und direkt. Verwende ausschließlich Deutsch. Maximal 400 Wörter gesamt."""

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    analysis_text = message.content[0].text

    # Derive valuation range
    multiples = econ.get("ebitda_multiples", {})
    valuation_range = None
    if multiples and maps.get("avg_reviews_per_competitor"):
        # Rough revenue proxy: reviews × avg ticket × visits per review rate
        # This is intentionally a wide range — a starting point only
        avg_rev = maps.get("avg_reviews_per_competitor", 100)
        low_m = multiples.get("low", 3)
        high_m = multiples.get("high", 7)
        # Heuristic EBITDA proxy: reviews * 500 EUR (rough signal)
        ebitda_proxy = avg_rev * 500
        valuation_range = {
            "low_eur": round(ebitda_proxy * low_m / 1000) * 1000,
            "high_eur": round(ebitda_proxy * high_m / 1000) * 1000,
            "method": "EBITDA proxy (review volume × ticket estimate × multiple range)",
            "multiples_used": multiples,
        }

    return {
        "analysis": analysis_text,
        "valuation_range": valuation_range,
        "model": CLAUDE_MODEL,
    }
