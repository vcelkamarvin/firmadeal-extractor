import { chromium } from 'playwright';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

interface CompetitorData {
  name: string;
  rating: string | null;
  review_volume: string | null;
  category: string | null;
  distance: string | null;
  url: string | null;
}

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
  city: string | null;
  region: string | null;
  country: string | null;
  competitor_count: number | null;
  competitors: CompetitorData[];
  search_interest: string | null;
  spot_category: string | null;
}

async function tryText(page: any, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const text = (await el.innerText())?.trim();
      if (text) return text;
    } catch {}
  }
  return null;
}

async function tryAttr(page: any, selectors: string[], attr: string): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const val = (await el.getAttribute(attr))?.trim();
      if (val) return val;
    } catch {}
  }
  return null;
}

async function acceptGoogleConsent(page: any, originalUrl: string) {
  if (!page.url().includes('consent.google.com')) return false;

  const continueMatch = page.url().match(/[?&]continue=([^&]+)/);
  const continueUrl = continueMatch ? decodeURIComponent(continueMatch[1]) : originalUrl;

  const acceptButton = page.locator('button', {
    hasText: /accept all|agree|i agree/i,
  });

  if (await acceptButton.count()) {
    await acceptButton.first().click();
    try {
      await page.waitForURL((url: string) => !url.includes('consent.google.com'), { timeout: 15000 });
    } catch {
      await page.goto(continueUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForLoadState('domcontentloaded');
    return true;
  }
  return false;
}

async function extractInstitutionalData(url: string): Promise<ExtractionPayload> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  await context.addCookies([
    {
      name: 'CONSENT',
      value: 'YES+1',
      domain: '.google.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    for (let i = 0; i < 3 && page.url().includes('consent.google.com'); i++) {
      await acceptGoogleConsent(page, url);
    }

    // Wait for the business listing panel to load
    try {
      await page.waitForSelector('h1', { timeout: 15000 });
    } catch {}
    await page.waitForTimeout(2500);

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
      city: null,
      region: null,
      country: null,
      competitor_count: null,
      competitors: [],
      search_interest: null,
      spot_category: null,
    };

    // Name
    payload.name = (await page.textContent('h1'))?.trim() || null;

    // Category — Google Maps button with jsaction targeting the category pane
    payload.category = await tryText(page, [
      'button[jsaction*="pane.rating.category"]',
      '[data-section-id="typicalVisitor"] button',
    ]);

    // Rating — the star widget has aria-label="X.X stars"
    const ratingRaw = await tryAttr(
      page,
      ['[aria-label*="stars"]', '[aria-label*=" star"]'],
      'aria-label'
    );
    if (ratingRaw) {
      const m = ratingRaw.match(/([\d.,]+)/);
      payload.rating = m ? m[1].replace(',', '.') : null;
    }

    // Review volume — button aria-label contains "reviews"
    const reviewRaw = await tryAttr(page, ['button[aria-label*="reviews"]'], 'aria-label');
    if (reviewRaw) {
      const m = reviewRaw.match(/([\d,]+)/);
      payload.review_volume = m ? m[1].replace(',', '') : reviewRaw;
    } else {
      // fallback: inner text of the reviews button
      const reviewText = await tryText(page, ['button[aria-label*="reviews"]']);
      payload.review_volume = reviewText;
    }

    // Address — Google Maps uses data-item-id="address"
    payload.address = await tryText(page, [
      'button[data-item-id="address"]',
      '[data-tooltip="Copy address"]',
      'button[aria-label*="ddress"]',
    ]);

    // Phone — data-item-id starts with "phone:tel:"
    payload.phone = await tryText(page, [
      '[data-item-id^="phone:tel:"]',
      'button[data-item-id^="phone"]',
      'button[aria-label*="hone"]',
    ]);

    // Coordinates from the URL (@lat,lng pattern)
    const coords = page.url().match(/@([0-9.-]+),([0-9.-]+)/);
    if (coords) {
      payload.latitude = parseFloat(coords[1]);
      payload.longitude = parseFloat(coords[2]);
    }

    // Derive city / region / country from address string
    if (payload.address) {
      const parts = payload.address
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 0) payload.country = parts[parts.length - 1];
      if (parts.length > 1) payload.city = parts[parts.length - 2];
      if (parts.length > 2) payload.region = parts[parts.length - 3];
    }

    // Search interest label
    if (payload.category) {
      payload.search_interest = payload.city
        ? `${payload.category} in ${payload.city}`
        : payload.category;
      payload.spot_category = payload.category;
    }

    // Nearby competitors — collect /maps/place/ links from the page
    try {
      const rawCompetitors = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place/"]')
        );
        const seen = new Set<string>();
        const results: Array<{ name: string; url: string }> = [];

        anchors.forEach((a) => {
          const name = a.textContent?.trim() || '';
          const href = a.href || '';
          if (!name || name.length < 3 || !href || seen.has(href)) return;
          if (/directions|website|photos/i.test(name)) return;
          seen.add(href);
          results.push({ name, url: href });
        });

        return results.slice(0, 8);
      });

      payload.competitors = rawCompetitors.map((c) => ({
        ...c,
        category: null,
        rating: null,
        review_volume: null,
        distance: null,
      }));
      payload.competitor_count = payload.competitors.length;
    } catch {
      payload.competitor_count = 0;
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
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const data = await extractInstitutionalData(url);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed', details: String(error) }, { status: 500 });
  }
}
