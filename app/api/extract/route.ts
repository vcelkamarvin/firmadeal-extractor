import { chromium as playwrightCore } from 'playwright-core';
import chromium from '@sparticuz/chromium';
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

async function handleConsent(page: any, originalUrl: string) {
  if (!page.url().includes('consent.google.com')) return;

  // Accept button text in EN + DE + other common EU languages
  const acceptBtn = page.locator('button', {
    hasText: /alle akzeptieren|accept all|ich stimme zu|agree|zustimmen|accepter tout|accetta tutto/i,
  });

  if (await acceptBtn.count() > 0) {
    await acceptBtn.first().click();
    try {
      await page.waitForURL((url: string) => !url.includes('consent.google.com'), { timeout: 15000 });
    } catch {
      const m = page.url().match(/[?&]continue=([^&]+)/);
      const target = m ? decodeURIComponent(m[1]) : originalUrl;
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForLoadState('domcontentloaded');
  }
}

async function extractInstitutionalData(url: string): Promise<ExtractionPayload> {
  const executablePath = await chromium.executablePath();

  const browser = await playwrightCore.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  const context = await browser.newContext({
    locale: 'de-DE',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  // Pre-set consent cookie so the popup is skipped
  await context.addCookies([
    {
      name: 'CONSENT',
      value: 'YES+cb.20231130-17-p1.de+F+885',
      domain: '.google.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    },
    {
      name: 'SOCS',
      value: 'CAISHAgBEhJnd3NfMjAyMzA4MjgtMF9SQzEaAmRlIAEaBgiA_LCnBg',
      domain: '.google.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Dismiss consent page if it still appears
    for (let i = 0; i < 3 && page.url().includes('consent.google.com'); i++) {
      await handleConsent(page, url);
      await page.waitForTimeout(1000);
    }

    // Wait for the business panel to render
    try {
      await page.waitForSelector('h1', { timeout: 15000 });
    } catch {}
    await page.waitForTimeout(2000);

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

    // ── Name ──────────────────────────────────────────────────────────────────
    payload.name = (await page.textContent('h1'))?.trim() || null;

    // ── Category ──────────────────────────────────────────────────────────────
    payload.category = await tryText(page, [
      'button[jsaction*="pane.rating.category"]',
      '[data-section-id="typicalVisitor"] button',
    ]);

    // ── Rating ────────────────────────────────────────────────────────────────
    // aria-label is "4,5 Sterne" in German or "4.5 stars" in English
    const ratingRaw = await tryAttr(page, ['[aria-label*="Sterne"]', '[aria-label*="stars"]', '[aria-label*="star"]'], 'aria-label');
    if (ratingRaw) {
      const m = ratingRaw.match(/([\d][,.][\d])/);
      payload.rating = m ? m[1].replace(',', '.') : null;
    }

    // ── Review count ──────────────────────────────────────────────────────────
    // aria-label: "1.234 Rezensionen" (DE) or "1,234 reviews" (EN)
    const reviewRaw = await tryAttr(page, [
      'button[aria-label*="Rezensionen"]',
      'button[aria-label*="Bewertungen"]',
      'button[aria-label*="reviews"]',
    ], 'aria-label');
    if (reviewRaw) {
      const m = reviewRaw.match(/([\d.,]+)/);
      payload.review_volume = m ? m[1].replace(/[.,]/g, '') : reviewRaw;
    }

    // ── Address ───────────────────────────────────────────────────────────────
    payload.address = await tryText(page, [
      'button[data-item-id="address"]',
      '[data-tooltip="Adresse kopieren"]',
      '[data-tooltip="Copy address"]',
      'button[aria-label*="Adresse"]',
      'button[aria-label*="Address"]',
    ]);

    // ── Phone ────────────────────────────────────────────────────────────────
    payload.phone = await tryText(page, [
      '[data-item-id^="phone:tel:"]',
      'button[data-item-id^="phone"]',
      'button[aria-label*="Telefon"]',
      'button[aria-label*="Phone"]',
    ]);

    // ── Coordinates from URL ──────────────────────────────────────────────────
    const coords = page.url().match(/@([0-9.-]+),([0-9.-]+)/);
    if (coords) {
      payload.latitude = parseFloat(coords[1]);
      payload.longitude = parseFloat(coords[2]);
    }

    // ── City / Region / Country from address ──────────────────────────────────
    if (payload.address) {
      const parts = payload.address.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) payload.country = parts[parts.length - 1];
      if (parts.length > 1) payload.city = parts[parts.length - 2]?.replace(/^\d{5}\s*/, '') || null;
      if (parts.length > 2) payload.region = parts[parts.length - 3] || null;
    }

    // ── Search interest label ─────────────────────────────────────────────────
    if (payload.category) {
      payload.search_interest = payload.city
        ? `${payload.category} in ${payload.city}`
        : payload.category;
      payload.spot_category = payload.category;
    }

    // ── Nearby competitors ────────────────────────────────────────────────────
    try {
      const rawCompetitors = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place/"]')
        );
        const seen = new Set<string>();
        const out: { name: string; url: string }[] = [];
        anchors.forEach((a) => {
          const name = a.textContent?.trim() || '';
          const href = a.href || '';
          if (!name || name.length < 3 || !href || seen.has(href)) return;
          if (/Route|Directions|Website|Fotos|Photos/i.test(name)) return;
          seen.add(href);
          out.push({ name, url: href });
        });
        return out.slice(0, 8);
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
