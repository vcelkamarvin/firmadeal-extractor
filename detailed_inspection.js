const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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

  const url = 'https://www.google.com/maps/place/Auto+Nord+Group+-+%C5%A0koda/@50.7440282,15.1533784,17z/data=!4m15!1m8!3m7!1s0x470ecb69ed6c5b45:0x80fe84eacd69687!2zS0FWw4FSTkEgTkEgQ0VTVMSa!8m2!3d50.7439515!4d15.1532632!10e5!16s%2Fg%2F11k4lqwkrs!3m5!1s0x470935001c055863:0xcf2a03ebcc7eae45!8m2!3d50.7444894!4d15.1579529!16s%2Fg%2F11y_fbg3vr';

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  } catch (e) {
    console.warn('networkidle timeout');
  }

  if (page.url().includes('consent.google.com')) {
    const acceptButton = page.locator('button', {
      hasText: /accept all|agree|přijmout vše|akzeptieren|zaprijmout|souhlasím|souhlas/i,
    });
    if (await acceptButton.count()) {
      await acceptButton.first().click();
      const start = Date.now();
      while (Date.now() - start < 30000 && page.url().includes('consent.google.com')) {
        await page.waitForTimeout(500);
      }
    }
  }

  await page.waitForTimeout(8000);

  // Detailed DOM inspection for all fields
  const extracted = await page.evaluate(() => {
    const results = {
      name: null,
      rating: null,
      reviewCount: null,
      category: null,
      address: null,
      phone: null,
      website: null,
      elements: [],
    };

    // Find the business name by looking for the title
    const headings = document.querySelectorAll('h1, h2, [role="heading"]');
    for (const el of headings) {
      const text = el.textContent?.trim();
      if (text && text.length > 3 && !text.match(/mapy|maps|google|sign|přihlášení/i)) {
        results.name = text;
        results.elements.push({ type: 'name', selector: el.tagName, content: text });
        break;
      }
    }

    // Find rating and review count
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = btn.getAttribute('aria-label') || btn.textContent?.trim() || '';
      if (text.match(/\d+[,\.]\d+\s*\(/)) { // matches "4.2 (5)" pattern
        results.rating = text.match(/(\d+[,\.]\d+)/)?.[1] || null;
        results.reviewCount = text.match(/\((\d+)\)/)?.[1] || null;
        results.elements.push({ type: 'rating', selector: 'button[aria-label*="4"]', content: text });
        break;
      }
    }

    // Find category and other business info
    const allText = document.body.innerText.split('\n').filter(t => t.trim());
    for (let i = 0; i < allText.length; i++) {
      const text = allText[i].trim();
      if (text === 'Prodej automobilů' || text === 'Category' || 
          (i > 4 && text.match(/^[A-ZČŘŘŠŠŽÍína-z]/))) {
        const nameIndex = allText.indexOf(results.name || '');
        if (nameIndex >= 0 && i > nameIndex && i < nameIndex + 5) {
          results.category = text;
          results.elements.push({ type: 'category', content: text });
          break;
        }
      }
    }

    // Find address by looking for common address patterns
    const allDivs = Array.from(document.querySelectorAll('div, span, button'));
    for (const el of allDivs) {
      const text = el.textContent?.trim() || '';
      if (text.match(/\d+\s*,\s*\d{3,5}\s+/i) || text.match(/Street|ulice|Straße/i)) {
        results.address = text;
        results.elements.push({ type: 'address', tag: el.tagName, content: text });
        break;
      }
    }

    // Find phone
    const phoneLink = document.querySelector('a[href^="tel:"]');
    if (phoneLink) {
      results.phone = phoneLink.textContent?.trim() || phoneLink.href.replace('tel:', '');
      results.elements.push({ type: 'phone', selector: 'a[href^="tel:"]', content: results.phone });
    }

    // Find website
    const websiteLink = document.querySelector('a[href^="http"]');
    if (websiteLink) {
      results.website = websiteLink.href;
      results.elements.push({ type: 'website', selector: 'a[href^="http"]', content: websiteLink.href });
    }

    return results;
  });

  console.log('=== EXTRACTED DATA ===');
  console.log(JSON.stringify(extracted, null, 2));

  await browser.close();
})();
