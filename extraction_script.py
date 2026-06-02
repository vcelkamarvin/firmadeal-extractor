import asyncio
import re
import json
from playwright.async_api import async_playwright

async def extract_institutional_data(url):
    """
    Extracts institutional-grade metrics from Google Maps for valuation modeling.
    Uses ARIA labels and URL parsing for maximum DOM stability.
    
    Captures proxy variables for:
    - Microeconomic moat assessment
    - EBITDA multiples cross-reference
    - Regional demographic mapping
    - Sales sequence contact vectors
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url, wait_until="networkidle")
        
        payload = {
            "name": None,
            "category": None,
            "rating": None,
            "review_volume": None,
            "address": None,
            "phone": None,
            "latitude": None,
            "longitude": None,
            "resolved_url": page.url
        }
        
        # Extract business name (most stable selector)
        try:
            title_element = await page.wait_for_selector("h1", timeout=5000)
            payload["name"] = await title_element.inner_text()
        except Exception as e:
            print(f"Name extraction failed: {e}")
            payload["name"] = None

        # Extract business category (operational metric for segmentation)
        try:
            category_element = await page.query_selector("button[jsaction*='pane.rating.category']")
            if category_element:
                payload["category"] = await category_element.inner_text()
        except Exception as e:
            print(f"Category extraction failed: {e}")
            payload["category"] = None
            
        # Extract rating via ARIA label (DOM-resistant)
        try:
            rating_element = await page.query_selector("[aria-label*='stars']")
            if rating_element:
                raw_rating = await rating_element.get_attribute("aria-label")
                payload["rating"] = raw_rating
        except Exception as e:
            print(f"Rating extraction failed: {e}")
            payload["rating"] = None
            
        # Extract review volume via ARIA label (DOM-resistant, proxy for demand signal)
        try:
            review_element = await page.query_selector("button[aria-label*='reviews']")
            if review_element:
                raw_reviews = await review_element.inner_text()
                payload["review_volume"] = raw_reviews
        except Exception as e:
            print(f"Review volume extraction failed: {e}")
            payload["review_volume"] = None

        # Extract address (contact vector for sales sequence)
        try:
            address_element = await page.query_selector("button[data-item-id='address']")
            if address_element:
                payload["address"] = await address_element.inner_text()
        except Exception as e:
            print(f"Address extraction failed: {e}")
            payload["address"] = None

        # Extract phone number (operational contact vector)
        try:
            phone_element = await page.query_selector("button[data-item-id^='phone']")
            if phone_element:
                payload["phone"] = await phone_element.inner_text()
        except Exception as e:
            print(f"Phone extraction failed: {e}")
            payload["phone"] = None
            
        # Parse coordinates from resolved URL (highest stability, for isochrone mapping)
        current_url = page.url
        coords_match = re.search(r"@([0-9.-]+),([0-9.-]+)", current_url)
        if coords_match:
            payload["latitude"] = float(coords_match.group(1))
            payload["longitude"] = float(coords_match.group(2))
        else:
            print("Coordinate extraction failed: regex pattern not found in URL")
            payload["latitude"] = None
            payload["longitude"] = None
            
        await browser.close()
        return payload

async def main():
    # Paste your Google Maps link here
    target = "INSERT_URL_HERE"
    
    print(f"Extracting institutional data from: {target}")
    data = await extract_institutional_data(target)
    
    with open("institutional_target.json", "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    
    print("Data extraction complete. Saved to institutional_target.json")
    print(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
