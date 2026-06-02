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
  const url = 'https://www.google.com/maps/place/KAV%C3%81RNA+NA+CEST%C4%9A/@50.7440282,15.1533784,17z';
  console.log('initial url', url);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  } catch (error) {
    console.warn('goto error', error.message);
  }

  console.log('after goto url', page.url());

  if (page.url().includes('consent.google.com')) {
    const acceptButton = page.locator('button', {
      hasText: /accept all|agree|přijmout vše|akzeptieren|zaprijmout|souhlasím|souhlas/i,
    });
    const count = await acceptButton.count();
    console.log('consent buttons', count);
    if (count) {
      await acceptButton.first().click();
      console.log('clicked consent');

      const start = Date.now();
      while (Date.now() - start < 30000) {
        if (!page.url().includes('consent.google.com')) {
          console.log('navigated to', page.url());
          break;
        }
        await page.waitForTimeout(1000);
      }

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
      } catch (error) {
        console.warn('waitForLoadState failed after consent:', error.message);
      }
    } else {
      console.log('no consent button found on consent page');
    }
  }

  const urlAfterConsent = page.url();
  console.log('url after consent/wait', urlAfterConsent);

  const extracted = await page.evaluate(() => {
    // Look for business name in various places
    const nameSelectors = ['h1', '[role="heading"]', 'h2', 'h3', '[data-item-id="title"]'];
    let name = null;
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim?.();
        if (text && text.length > 2) {
          name = { selector: sel, text };
          break;
        }
      }
    }

    // Look for rating
    const ratingEl = document.querySelector('[aria-label*="star"], [data-rating]');
    const rating = ratingEl ? ratingEl.getAttribute('aria-label') : null;

    // Deep inspection of DOM structure
    const divs = Array.from(document.querySelectorAll('div[data-item-id], div[role="button"], button[data-item-id]'));
    const structureItems = divs.slice(0, 15).map(el => ({
      tag: el.tagName,
      dataId: el.getAttribute('data-item-id'),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      text: el.textContent?.trim?.().slice(0, 50),
    }));

    // Check for iframes or shadow DOM
    const iframes = Array.from(document.querySelectorAll('iframe')).map(el => ({
      src: el.src,
      id: el.id,
      class: el.className,
    }));

    return {
      url: window.location.href,
      name,
      rating,
      structureItems,
      iframes,
      hasDataElements: document.querySelectorAll('[data-item-id]').length,
      bodyText: document.body.innerText.slice(0, 500),
    };
  });

  console.log(JSON.stringify(extracted, null, 2));

  // Try waiting for more content to load
  console.log('waiting for more content...');
  await page.waitForTimeout(5000);

  const extracted2 = await page.evaluate(() => {
    const nameSelectors = ['h1', '[role="heading"]', 'h2', 'h3'];
    let name = null;
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim?.();
        if (text && text.length > 2) {
          name = { selector: sel, text };
          break;
        }
      }
    }
    return { name, bodyText: document.body.innerText.slice(0, 300) };
  });

  console.log('after 5s wait:', JSON.stringify(extracted2, null, 2));
  await browser.close();
})();
