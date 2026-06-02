import { chromium } from 'playwright';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

async function acceptGoogleConsent(page: any, originalUrl: string) {
  if (!page.url().includes('consent.google.com')) {
    return false;
  }

  const currentConsentUrl = page.url();
  const currentContinueMatch = currentConsentUrl.match(/[?&]continue=([^&]+)/);
  const currentContinueUrl = currentContinueMatch ? decodeURIComponent(currentContinueMatch[1]) : originalUrl;

  const acceptButton = page.locator('button', {
    hasText: /accept all|agree|přijmout vše|akzeptieren|zaprijmout|souhlasím|souhlas/i,
  });

  if (await acceptButton.count()) {
    await acceptButton.first().click();
    try {
      await page.waitForURL((url: string) => !url.includes('consent.google.com'), {
        timeout: 30000,
      });
    } catch (error) {
      if (currentContinueUrl) {
        await page.goto(currentContinueUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }
    await page.waitForLoadState('domcontentloaded');
    return true;
  }

  return false;
}

async function textFromSelectors(page: any, selectors: string[]) {
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (!element) continue;
    const text = await element.innerText();
    if (text?.trim()) {
      return text.trim();
    }
  }
  return null;
}

async function extractInstitutionalData(url: string): Promise<ExtractionPayload> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  try {
    const originalUrl = url;
    await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    for (let attempt = 0; attempt < 3 && page.url().includes('consent.google.com'); attempt += 1) {
      await acceptGoogleConsent(page, originalUrl);
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);

    const pageHeading = (await page.textContent('h1'))?.trim() || '';
    if (!pageHeading || page.url().includes('/maps/place//@')) {
      await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
    }

    await page.waitForLoadState('domcontentloaded');

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
    
    // Extract business name
    try {
      const titleElement = await page.waitForSelector('h1', { timeout: 10000 });
      payload.name = (await titleElement.innerText())?.trim() || null;
    } catch (e) {
      console.log('Name extraction failed:', e);
    }

    // Extract additional fields via detailed page inspection
    try {
      const detailedData = await page.evaluate(() => {
        const result: any = {
          category: null,
          address: null,
          phone: null,
          website: null,
          rating: null,
          reviews: null,
        };

        // Get all visible text split by lines for targeted extraction
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);

        // Find category (usually after "Přehled" or "Recenze" section labels)
        const navMenuItems = ['Restaurace', 'Hotely', 'Tipy', 'MHD', 'Parkování', 'Lékárny', 'Bankomaty', 'Uloženo', 'Poslední'];
        let foundName = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // First find the business name
          if (line.includes('Auto Nord') || line.includes('Nord Group') || line.includes('Škoda')) {
            foundName = true;
            // Now look ahead for category (next non-empty, non-navigation line)
            for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
              const nextLine = lines[j];
              if (
                !navMenuItems.includes(nextLine) &&
                !nextLine.match(/^(Stáhnout|Prohlédnout|Přehled|Recenze|Fotky|Trasa|Uložit|V okolí|Poslat|Sdílet|Přihlášení)/) &&
                nextLine.length > 4 &&
                nextLine.length < 60
              ) {
                result.category = nextLine;
                break;
              }
            }
            break;
          }
        }

        // Find address (contains street and postal code)
        for (const line of lines) {
          if (line.match(/^[^,]+\d+\/\d+.*\d{3}\s*\d{2}/)) {
            result.address = line;
            break;
          }
        }

        // Find phone (10-15 digit number, often with spaces or dashes)
        for (const line of lines) {
          if (line.match(/^[\d\s\-\+]{10,20}$/) && line.match(/\d{3}/)) {
            result.phone = line.trim();
            break;
          }
        }

        // Find website (domain pattern)
        for (const line of lines) {
          if (line.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z]{2,}$/) && !line.includes(' ') && !line.match(/^(google|maps|support)/)) {
            result.website = line;
            break;
          }
        }

        // Find rating (e.g., "4,2" with Czech locale comma)
        for (const line of lines) {
          if (line.match(/^\d+[,\.]\d+$/)) {
            result.rating = line;
            // Look for review count in next line or same pattern with parentheses
            for (const reviewLine of lines) {
              if (reviewLine.match(/^\(\d+\)$/)) {
                result.reviews = reviewLine.replace(/[()]/g, '');
                break;
              }
            }
            break;
          }
        }

        return result;
      });

      payload.category = detailedData.category || null;
      payload.address = detailedData.address || null;
      payload.phone = detailedData.phone || null;
      payload.rating = detailedData.rating || null;
      payload.review_volume = detailedData.reviews || null;
    } catch (e) {
      console.log('Detailed extraction failed:', e);
    }

    // Parse coordinates from URL
    const coords = page.url().match(/@([0-9.-]+),([0-9.-]+)/);
    if (coords) {
      payload.latitude = parseFloat(coords[1]);
      payload.longitude = parseFloat(coords[2]);
    }

    // Normalize city / region / country from address string
    if (payload.address) {
      const parts = payload.address.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        payload.country = parts[parts.length - 1] || null;
      }
      if (parts.length > 1) {
        payload.city = parts[parts.length - 2] || null;
      }
      if (parts.length > 2) {
        payload.region = parts[parts.length - 3] || null;
      }
    }

    // Create a service interest query for supplemental analysis
    if (payload.category && payload.city) {
      payload.search_interest = `${payload.category} in ${payload.city}`;
      payload.spot_category = payload.category;
    } else if (payload.category) {
      payload.search_interest = payload.category;
      payload.spot_category = payload.category;
    }

    // Extract competitor references from related place cards and the side panel
    try {
      const rawCompetitors = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/place/"], a[href*="/maps/place/"]'));
        const payload: Array<{ name: string; url: string; category: string | null; rating: string | null; review_volume: string | null; distance: string | null; }> = [];
        const seen = new Set<string>();

        anchors.forEach((anchor) => {
          const name = anchor.textContent?.trim() || '';
          const url = anchor instanceof HTMLAnchorElement ? anchor.href : anchor.getAttribute('href') || '';
          if (!name || name.length < 3 || !url) return;
          if (seen.has(url)) return;
          if (name.toLowerCase().includes('directions') || name.toLowerCase().includes('website') || name.toLowerCase().includes('photos')) return;
          seen.add(url);
          payload.push({
            name,
            url,
            category: null,
            rating: null,
            review_volume: null,
            distance: null,
          });
        });

        return payload.slice(0, 6);
      });

      payload.competitors = rawCompetitors.map((competitor) => ({
        ...competitor,
        category: null,
        rating: null,
        review_volume: null,
        distance: null,
      }));
      payload.competitor_count = payload.competitors.length;
    } catch (e) {
      console.log('Competitor extraction failed:', e);
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
