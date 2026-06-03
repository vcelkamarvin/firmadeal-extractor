"""
Google Places API (New) scraper.
Uses the v1 Places API — requires Places API (New) enabled in Google Cloud Console.
Endpoint: https://places.googleapis.com/v1/places:searchNearby
"""

import os
import requests
from typing import Optional

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NEARBY_URL  = "https://places.googleapis.com/v1/places:searchNearby"
DETAIL_URL  = "https://places.googleapis.com/v1/places/{place_id}"

INDUSTRY_TO_PLACE_TYPE = {
    "hotel":        "lodging",
    "restaurant":   "restaurant",
    "cafe":         "cafe",
    "café":         "cafe",
    "bäckerei":     "bakery",
    "autowerkstatt":"car_repair",
    "zahnarzt":     "dentist",
    "apotheke":     "pharmacy",
    "friseur":      "hair_care",
    "supermarkt":   "supermarket",
    "boutique":     "clothing_store",
    "kfz":          "car_repair",
    "bar":          "bar",
    "gasthaus":     "restaurant",
    "pension":      "lodging",
}

NEARBY_FIELDS = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.businessStatus",
    "places.currentOpeningHours",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.editorialSummary",
    "places.types",
    "places.reviews",
])

PRICE_LEVEL_MAP = {
    "PRICE_LEVEL_FREE":           "€",
    "PRICE_LEVEL_INEXPENSIVE":    "€",
    "PRICE_LEVEL_MODERATE":       "€€",
    "PRICE_LEVEL_EXPENSIVE":      "€€€",
    "PRICE_LEVEL_VERY_EXPENSIVE": "€€€€",
}


def geocode(zip_code: str, city: str) -> Optional[tuple[float, float]]:
    r = requests.get(GEOCODE_URL, params={
        "address": f"{zip_code} {city}, Germany",
        "key": API_KEY,
    }, timeout=10)
    results = r.json().get("results", [])
    if results:
        loc = results[0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None


def nearby_search(lat: float, lng: float, radius: int, place_type: str) -> list[dict]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": NEARBY_FIELDS,
    }
    body = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius),
            }
        },
        "includedTypes": [place_type],
        "maxResultCount": 20,
        "languageCode": "de",
        "rankPreference": "POPULARITY",
    }
    r = requests.post(NEARBY_URL, json=body, headers=headers, timeout=15)
    return r.json().get("places", [])


def _parse_place(p: dict) -> dict:
    reviews = p.get("reviews") or []
    top_reviews = [
        {
            "author":  rv.get("authorAttribution", {}).get("displayName"),
            "rating":  rv.get("rating"),
            "text":    (rv.get("text") or {}).get("text", "")[:300],
            "time":    rv.get("relativePublishTimeDescription"),
        }
        for rv in reviews[:3]
    ]
    return {
        "place_id":      p.get("id"),
        "name":          (p.get("displayName") or {}).get("text"),
        "address":       p.get("formattedAddress"),
        "rating":        p.get("rating"),
        "review_count":  p.get("userRatingCount"),
        "price_level":   PRICE_LEVEL_MAP.get(p.get("priceLevel", ""), "—"),
        "business_status": p.get("businessStatus", "UNKNOWN"),
        "is_open":       (p.get("currentOpeningHours") or {}).get("openNow"),
        "phone":         p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber"),
        "website":       p.get("websiteUri"),
        "types":         (p.get("types") or [])[:4],
        "summary":       (p.get("editorialSummary") or {}).get("text"),
        "top_reviews":   top_reviews,
        "lat":           (p.get("location") or {}).get("latitude"),
        "lng":           (p.get("location") or {}).get("longitude"),
    }


def collect(city: str, industry_type: str, zip_code: str, radius: int = 1000) -> dict:
    if not API_KEY:
        return {"error": "GOOGLE_MAPS_API_KEY not set", "competitors": [], "competitor_count": 0}

    place_type = INDUSTRY_TO_PLACE_TYPE.get(industry_type.lower(), "establishment")
    coords = geocode(zip_code, city)
    if not coords:
        return {"error": f"Could not geocode {zip_code} {city}", "competitors": [], "competitor_count": 0}

    lat, lng = coords
    places = nearby_search(lat, lng, radius, place_type)

    competitors = [_parse_place(p) for p in places]

    rated = [c for c in competitors if c["rating"]]
    avg_rating = round(sum(c["rating"] for c in rated) / len(rated), 2) if rated else None
    total_reviews = sum(c["review_count"] or 0 for c in competitors)
    avg_reviews = round(total_reviews / len(competitors)) if competitors else None

    price_dist: dict[str, int] = {}
    for c in competitors:
        pl = c.get("price_level") or "—"
        price_dist[pl] = price_dist.get(pl, 0) + 1

    operational = sum(1 for c in competitors if c["business_status"] == "OPERATIONAL")

    return {
        "coordinates":              {"lat": lat, "lng": lng},
        "search_radius_m":          radius,
        "place_type":               place_type,
        "competitors":              competitors,
        "competitor_count":         len(competitors),
        "avg_rating":               avg_rating,
        "total_market_reviews":     total_reviews,
        "avg_reviews_per_competitor": avg_reviews,
        "price_level_distribution": price_dist,
        "operational_pct":          round(operational / len(competitors) * 100) if competitors else None,
    }
