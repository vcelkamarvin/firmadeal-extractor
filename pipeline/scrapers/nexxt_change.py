"""
nexxt-change.org scraper — active business-for-sale listings.
Public site, no login required for browse pages.
"""

import re
import requests
from bs4 import BeautifulSoup

BASE = "https://www.nexxt-change.org"
SEARCH_URL = f"{BASE}/angebote/suchergebnisse.html"

INDUSTRY_NEXXT = {
    "hotel": "Hotel/Pension/Hostel",
    "restaurant": "Restaurant/Gaststätte",
    "cafe": "Café/Bistro/Imbiss",
    "café": "Café/Bistro/Imbiss",
    "autowerkstatt": "Kfz-Handel/-Reparatur",
    "bäckerei": "Bäckerei/Konditorei",
    "apotheke": "Gesundheit/Medizin",
    "zahnarzt": "Gesundheit/Medizin",
    "friseur": "Dienstleistungen allg.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Firmadeal/1.0; +https://firmadeal.de)",
    "Accept-Language": "de-DE,de;q=0.9",
}


def collect(city: str, industry_type: str, zip_code: str) -> dict:
    branche = INDUSTRY_NEXXT.get(industry_type.lower(), "")
    params = {
        "ort": city,
        "umkreis": "50",
        "branche": branche,
    }

    listings = []
    try:
        r = requests.get(SEARCH_URL, params=params, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")

        # nexxt-change listing cards
        cards = soup.select(".offer-item, .listing-item, article.offer, .search-result-item")
        if not cards:
            # fallback: try generic result rows
            cards = soup.select("li.result, .result-entry")

        for card in cards[:20]:
            title_el = card.select_one("h2, h3, .title, .offer-title")
            price_el = card.select_one(".price, .kaufpreis, [class*='preis']")
            loc_el = card.select_one(".location, .ort, [class*='location']")
            desc_el = card.select_one(".description, .teaser, p")

            title = title_el.get_text(strip=True) if title_el else None
            if not title:
                continue

            price_raw = price_el.get_text(strip=True) if price_el else None
            price_num = None
            if price_raw:
                m = re.search(r"([\d.,]+)", price_raw.replace(".", "").replace(",", "."))
                if m:
                    try:
                        price_num = float(m.group(1))
                    except ValueError:
                        pass

            listings.append({
                "title": title,
                "location": loc_el.get_text(strip=True) if loc_el else None,
                "price_raw": price_raw,
                "price_eur": price_num,
                "description_snippet": desc_el.get_text(strip=True)[:200] if desc_el else None,
            })

    except Exception as e:
        return {"error": str(e), "listings": [], "listing_count": 0}

    prices = [l["price_eur"] for l in listings if l["price_eur"]]
    return {
        "listings": listings,
        "listing_count": len(listings),
        "avg_asking_price_eur": round(sum(prices) / len(prices)) if prices else None,
        "min_price_eur": min(prices) if prices else None,
        "max_price_eur": max(prices) if prices else None,
        "search_url": r.url if listings else SEARCH_URL,
    }
