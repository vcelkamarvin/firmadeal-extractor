"""
Basic website analysis for each competitor.
Checks: last update year, mobile viewport, online booking, SSL, tech stack.
"""

import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Firmadeal/1.0; market research)",
    "Accept-Language": "de-DE,de;q=0.9",
}


def check_website(url: str) -> dict:
    if not url:
        return {"url": None, "reachable": False}

    result: dict = {"url": url, "reachable": False}

    try:
        r = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        result["reachable"] = r.status_code < 400
        result["ssl"] = url.startswith("https://") or r.url.startswith("https://")
        result["final_url"] = r.url
        result["status_code"] = r.status_code

        soup = BeautifulSoup(r.text, "lxml")
        html = r.text.lower()

        # Mobile responsive
        viewport = soup.find("meta", attrs={"name": "viewport"})
        result["mobile_responsive"] = bool(viewport)

        # Copyright year (proxy for last update)
        year_match = re.search(r"©\s*(20\d{2})", r.text)
        if year_match:
            result["copyright_year"] = int(year_match.group(1))
            result["years_since_update"] = datetime.now().year - int(year_match.group(1))

        # Online booking / reservation system
        booking_signals = ["reservierung", "buchen", "booking", "reservation", "online-buchung",
                          "tisch reservieren", "jetzt buchen", "opentable", "resy", "bookatable"]
        result["has_online_booking"] = any(s in html for s in booking_signals)

        # CMS / tech stack hints
        if "wordpress" in html or "wp-content" in html:
            result["cms"] = "WordPress"
        elif "wix" in html:
            result["cms"] = "Wix"
        elif "jimdo" in html:
            result["cms"] = "Jimdo"
        elif "squarespace" in html:
            result["cms"] = "Squarespace"
        else:
            result["cms"] = "Unknown/Custom"

        # Page language
        html_tag = soup.find("html")
        result["lang"] = html_tag.get("lang", "") if html_tag else ""

        # Social media links
        result["has_facebook"] = "facebook.com" in html
        result["has_instagram"] = "instagram.com" in html

        # Rough traffic estimate via meta signals (very rough)
        result["digital_maturity_score"] = _score(result)

    except requests.exceptions.SSLError:
        result["ssl"] = False
        result["reachable"] = True  # Site is up but SSL is bad
        result["digital_maturity_score"] = 10
    except Exception as e:
        result["error"] = str(e)
        result["digital_maturity_score"] = 0

    return result


def _score(r: dict) -> int:
    """0-100 digital maturity score."""
    score = 0
    if r.get("reachable"): score += 20
    if r.get("ssl"): score += 20
    if r.get("mobile_responsive"): score += 20
    if r.get("has_online_booking"): score += 20
    if r.get("has_facebook") or r.get("has_instagram"): score += 10
    yr = r.get("copyright_year", 0)
    if yr >= datetime.now().year - 1: score += 10
    elif yr >= datetime.now().year - 3: score += 5
    return score


def collect(competitors: list[dict]) -> dict:
    """Run website checks for all competitors that have a website."""
    checked = []
    for c in competitors:
        website = c.get("website")
        if website:
            checked.append({
                "competitor_name": c.get("name"),
                **check_website(website),
            })

    scores = [c.get("digital_maturity_score", 0) for c in checked]
    avg_score = round(sum(scores) / len(scores)) if scores else 0

    return {
        "websites_checked": len(checked),
        "avg_digital_maturity": avg_score,
        "results": checked,
        "has_booking_pct": round(
            sum(1 for c in checked if c.get("has_online_booking")) / len(checked) * 100
        ) if checked else 0,
        "mobile_ready_pct": round(
            sum(1 for c in checked if c.get("mobile_responsive")) / len(checked) * 100
        ) if checked else 0,
    }
