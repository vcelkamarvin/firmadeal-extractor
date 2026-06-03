"""
Google Places API scraper.
Collects competitor data within a radius of the target location.
Requires GOOGLE_MAPS_API_KEY env variable.
"""

import os
import requests
from typing import Optional

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
BASE = "https://maps.googleapis.com/maps/api"

# Maps friendly industry names to Google Places types
INDUSTRY_TO_PLACE_TYPE = {
    "hotel": "lodging",
    "restaurant": "restaurant",
    "cafe": "cafe",
    "café": "cafe",
    "bäckerei": "bakery",
    "autowerkstatt": "car_repair",
    "zahnarzt": "dentist",
    "apotheke": "pharmacy",
    "friseur": "hair_care",
    "supermarkt": "supermarket",
    "boutique": "clothing_store",
    "kfz": "car_repair",
    "bar": "bar",
    "gasthaus": "restaurant",
    "pension": "lodging",
}

DETAIL_FIELDS = ",".join([
    "name", "formatted_address", "formatted_phone_number", "website",
    "rating", "user_ratings_total", "price_level", "business_status",
    "types", "reviews", "editorial_summary", "current_opening_hours",
    "wheelchair_accessible_entrance",
])


def geocode(zip_code: str, city: str) -> Optional[tuple[float, float]]:
    r = requests.get(f"{BASE}/geocode/json", params={
        "address": f"{zip_code} {city}, Germany",
        "key": API_KEY,
    }, timeout=10)
    results = r.json().get("results", [])
    if results:
        loc = results[0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None


def nearby_search(lat: float, lng: float, radius: int, place_type: str) -> list[dict]:
    results, next_token = [], None
    for _ in range(2):  # max 2 pages = 40 results
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": place_type,
            "key": API_KEY,
            "language": "de",
        }
        if next_token:
            params = {"pagetoken": next_token, "key": API_KEY}
        r = requests.get(f"{BASE}/place/nearbysearch/json", params=params, timeout=10)
        data = r.json()
        results.extend(data.get("results", []))
        next_token = data.get("next_page_token")
        if not next_token:
            break
        import time; time.sleep(2)  # required before using next_page_token
    return results


def place_details(place_id: str) -> dict:
    r = requests.get(f"{BASE}/place/details/json", params={
        "place_id": place_id,
        "fields": DETAIL_FIELDS,
        "key": API_KEY,
        "language": "de",
        "reviews_sort": "newest",
    }, timeout=10)
    return r.json().get("result", {})


def collect(city: str, industry_type: str, zip_code: str, radius: int = 1000) -> dict:
    if not API_KEY:
        return {"error": "GOOGLE_MAPS_API_KEY not set", "competitors": [], "competitor_count": 0}

    place_type = INDUSTRY_TO_PLACE_TYPE.get(industry_type.lower(), "establishment")
    coords = geocode(zip_code, city)
    if not coords:
        return {"error": f"Could not geocode {zip_code} {city}", "competitors": [], "competitor_count": 0}

    lat, lng = coords
    places = nearby_search(lat, lng, radius, place_type)

    competitors = []
    for p in places[:15]:
        details = place_details(p["place_id"])
        reviews = details.get("reviews", [])
        top_reviews = [
            {
                "author": rv.get("author_name"),
                "rating": rv.get("rating"),
                "text": rv.get("text", "")[:300],
                "time": rv.get("relative_time_description"),
            }
            for rv in reviews[:3]
        ]
        competitors.append({
            "place_id": p.get("place_id"),
            "name": details.get("name") or p.get("name"),
            "address": details.get("formatted_address") or p.get("vicinity"),
            "rating": details.get("rating") or p.get("rating"),
            "review_count": details.get("user_ratings_total") or p.get("user_ratings_total"),
            "price_level": details.get("price_level") or p.get("price_level"),
            "business_status": p.get("business_status", "UNKNOWN"),
            "is_open": (p.get("opening_hours") or {}).get("open_now"),
            "phone": details.get("formatted_phone_number"),
            "website": details.get("website"),
            "types": details.get("types", [])[:4],
            "summary": (details.get("editorial_summary") or {}).get("overview"),
            "top_reviews": top_reviews,
        })

    rated = [c for c in competitors if c["rating"]]
    avg_rating = round(sum(c["rating"] for c in rated) / len(rated), 2) if rated else None
    total_reviews = sum(c["review_count"] or 0 for c in competitors)
    avg_reviews = round(total_reviews / len(competitors)) if competitors else None

    price_dist = {}
    for c in competitors:
        pl = c.get("price_level")
        if pl is not None:
            key = "€" * int(pl) if pl else "unknown"
            price_dist[key] = price_dist.get(key, 0) + 1

    operational = sum(1 for c in competitors if c["business_status"] == "OPERATIONAL")

    return {
        "coordinates": {"lat": lat, "lng": lng},
        "search_radius_m": radius,
        "place_type": place_type,
        "competitors": competitors,
        "competitor_count": len(competitors),
        "avg_rating": avg_rating,
        "total_market_reviews": total_reviews,
        "avg_reviews_per_competitor": avg_reviews,
        "price_level_distribution": price_dist,
        "operational_pct": round(operational / len(competitors) * 100) if competitors else None,
    }
