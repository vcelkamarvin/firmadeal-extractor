"""
Bundesagentur für Arbeit — job market data.
Uses the public Jobsuche API (OAuth2 client credentials).
Docs: https://jobsuche.api.bund.dev
"""

import re
import requests

# Current public API endpoints (v5)
TOKEN_URL = "https://rest.arbeitsagentur.de/oauth/gettoken_cc"
JOBS_URL  = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs"

# Published public client credentials (from BA developer portal)
CLIENT_ID     = "jobboerse-jobsuche"
CLIENT_SECRET = "dd57a8dc-1dc3-11ea-a7e0-005056a30718"

INDUSTRY_JOB_TERMS = {
    "hotel":        "Hotelier Hotelfachmann Rezeptionist",
    "restaurant":   "Restaurantfachmann Koch Servicekraft",
    "cafe":         "Barista Café Servicekraft",
    "café":         "Barista Café Servicekraft",
    "autowerkstatt":"KFZ-Mechatroniker Kfz-Meister",
    "bäckerei":     "Bäcker Konditor Bäckermeister",
    "apotheke":     "Apotheker PTA PKA",
    "zahnarzt":     "Zahnarzt ZFA Dentist",
    "friseur":      "Friseur Friseurmeister",
}


def _get_token() -> str | None:
    try:
        r = requests.post(
            TOKEN_URL,
            data={
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "grant_type": "client_credentials",
            },
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("access_token")
    except Exception:
        pass
    return None


def collect(city: str, industry_type: str, zip_code: str) -> dict:
    query = INDUSTRY_JOB_TERMS.get(industry_type.lower(), industry_type)
    result: dict = {
        "city": city,
        "industry": industry_type,
        "query": query,
    }

    token = _get_token()
    headers = {"User-Agent": "Firmadeal/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        r = requests.get(
            JOBS_URL,
            params={
                "wo": f"{zip_code} {city}",
                "umkreis": 25,
                "was": query,
                "angebotsart": 1,
                "page": 1,
                "size": 25,
            },
            headers=headers,
            timeout=15,
        )

        if r.status_code != 200:
            result["error"] = f"BA API {r.status_code}"
            result.update(_fallback_estimates(industry_type))
            return result

        data = r.json()
        total = data.get("maxErgebnisse", 0)
        jobs  = data.get("stellenangebote") or []

        management_count = sum(
            1 for j in jobs
            if any(kw in (j.get("titel") or "").lower()
                   for kw in ["meister", "leiter", "manager", "chef", "direktor", "inhaber"])
        )

        result.update({
            "total_job_listings": total,
            "sample_size": len(jobs),
            "management_positions": management_count,
            "staff_positions": len(jobs) - management_count,
            "management_ratio_pct": round(management_count / len(jobs) * 100) if jobs else None,
            "market_activity_signal": (
                "high" if total > 50 else "medium" if total > 15 else "low"
            ),
        })

    except Exception as e:
        result["error"] = str(e)
        result.update(_fallback_estimates(industry_type))

    return result


def _fallback_estimates(industry_type: str) -> dict:
    """Return national benchmark data when the API is unavailable."""
    BENCHMARKS = {
        "hotel":        {"total_job_listings": None, "market_activity_signal": "medium"},
        "restaurant":   {"total_job_listings": None, "market_activity_signal": "high"},
        "autowerkstatt":{"total_job_listings": None, "market_activity_signal": "medium"},
        "bäckerei":     {"total_job_listings": None, "market_activity_signal": "low"},
    }
    base = BENCHMARKS.get(industry_type.lower(), {})
    return {
        **base,
        "note": "Live BA data unavailable — national shortages known in Gastronomie and KFZ sectors",
    }
