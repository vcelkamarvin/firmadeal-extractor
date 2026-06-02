const { chromium } = require('playwright');

async function acceptGoogleConsent(page, originalUrl) {
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
      const start = Date.now();
      while (Date.now() - start < 30000 && page.url().includes('consent.google.com')) {
        await page.waitForTimeout(500);
      }
    } catch (error) {
      if (currentContinueUrl) {
        await page.goto(currentContinueUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }
    return true;
  }

  return false;
}

async function testExtraction(url) {
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

    // UPDATED EXTRACTION LOGIC
    const payload = {};

    // Extract business name
    try {
      const titleElement = await page.$('h1');
      if (titleElement) {
        payload.name = (await titleElement.innerText())?.trim() || null;
      }
    } catch (e) {
      console.log('Name extraction failed:', e.message);
    }

    // Extract category, address, phone, website via detailed page inspection
    try {
      const detailedData = await page.evaluate(() => {
        const result = {
          category: null,
          address: null,
          phone: null,
          website: null,
          rating: null,
          reviews: null,
        };

        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);

        // Find category
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (
            line.match(/^[A-ZČŘŠŘŠŽÍÉÁÉÍÓÚŮËÖÜa-zcčřššžíéáéíóúůëöü\s\-&]+$/) &&
            line.length > 5 &&
            line.length < 60 &&
            !line.match(/^(Počet|Cena|Nový|Staré|Nejlevnější|Nejdražší|Přehled|Recenze|Fotky|Trasa|Uložit|Sdílet)$/)
          ) {
            result.category = line;
            break;
          }
        }

        // Find address
        for (const line of lines) {
          if (line.match(/^[^,]+\d+\/\d+.*\d{3}\s*\d{2}/)) {
            result.address = line;
            break;
          }
        }

        // Find phone
        for (const line of lines) {
          if (line.match(/^[\d\s\-\+]{10,20}$/) && line.match(/\d{3}/)) {
            result.phone = line.trim();
            break;
          }
        }

        // Find website
        for (const line of lines) {
          if (line.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z]{2,}$/) && !line.includes(' ')) {
            result.website = line;
            break;
          }
        }

        // Find rating
        for (const line of lines) {
          if (line.match(/^\d+[,\.]\d+$/)) {
            result.rating = line;
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
      console.log('Detailed extraction failed:', e.message);
    }

    return payload;
  } finally {
    await browser.close();
  }
}

(async () => {
  const url = 'https://www.google.com/maps/place/Auto+Nord+Group+-+%C5%A0koda/@50.7440282,15.1533784,17z/data=!4m15!1m8!3m7!1s0x470ecb69ed6c5b45:0x80fe84eacd69687!2zS0FWw4FSTkEgTkEgQ0VTVMSa!8m2!3d50.7439515!4d15.1532632!10e5!16s%2Fg%2F11k4lqwkrs!3m5!1s0x470935001c055863:0xcf2a03ebcc7eae45!8m2!3d50.7444894!4d15.1579529!16s%2Fg%2F11y_fbg3vr';
  console.log('Testing extraction with URL:', url.slice(0, 80) + '...\n');
  const result = await testExtraction(url);
  console.log('\n=== EXTRACTION RESULT ===');
  console.log(JSON.stringify(result, null, 2));
})();
