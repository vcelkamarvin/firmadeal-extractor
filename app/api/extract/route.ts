import { chromium } from 'playwright';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface ExtractionPayload {
  name: string | null;
  category: string | null;
  rating: string | null;
  review_volume: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  resolved_url: string | null;
}

async function extractInstitutionalData(url: string): Promise<ExtractionPayload> {
  const browser = await chromium.launch({
    headless: true,
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    const payload: ExtractionPayload = {
      name: null,
      category: null,
      rating: null,
      review_volume: null,
      address: null,
      phone: null,
      latitude: null,
      longitude: null,
      resolved_url: page.url(),
    };
    
    // Extract business name
    try {
      const titleElement = await page.waitForSelector('h1', { timeout: 5000 });
      payload.name = await titleElement.innerText();
    } catch (e) {
      console.log('Name extraction failed:', e);
    }
    
    // Extract category
    try {
      const categoryElement = await page.$('button[jsaction*="pane.rating.category"]');
      if (categoryElement) {
        payload.category = await categoryElement.innerText();
      }
    } catch (e) {
      console.log('Category extraction failed:', e);
    }
    
    // Extract rating
    try {
      const ratingElement = await page.$("[aria-label*='stars']");
      if (ratingElement) {
        payload.rating = await ratingElement.getAttribute('aria-label');
      }
    } catch (e) {
      console.log('Rating extraction failed:', e);
    }
    
    // Extract review volume
    try {
      const reviewElement = await page.$("button[aria-label*='reviews']");
      if (reviewElement) {
        payload.review_volume = await reviewElement.innerText();
      }
    } catch (e) {
      console.log('Review volume extraction failed:', e);
    }
    
    // Extract address
    try {
      const addressElement = await page.$("button[data-item-id='address']");
      if (addressElement) {
        payload.address = await addressElement.innerText();
      }
    } catch (e) {
      console.log('Address extraction failed:', e);
    }
    
    // Extract phone
    try {
      const phoneElement = await page.$("button[data-item-id^='phone']");
      if (phoneElement) {
        payload.phone = await phoneElement.innerText();
      }
    } catch (e) {
      console.log('Phone extraction failed:', e);
    }
    
    // Parse coordinates from URL
    const coords = page.url().match(/@([0-9.-]+),([0-9.-]+)/);
    if (coords) {
      payload.latitude = parseFloat(coords[1]);
      payload.longitude = parseFloat(coords[2]);
    }
    
    return payload;
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    const data = await extractInstitutionalData(url);
    
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: 'Extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
