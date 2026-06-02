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

  // Use the actual user URL
  const url = 'https://www.google.com/maps/place/Auto+Nord+Group+-+%C5%A0koda/@50.7440282,15.1533784,17z/data=!4m15!1m8!3m7!1s0x470ecb69ed6c5b45:0x80fe84eacd69687!2zS0FWw4FSTkEgTkEgQ0VTVMSa!8m2!3d50.7439515!4d15.1532632!10e5!16s%2Fg%2F11k4lqwkrs!3m5!1s0x470935001c055863:0xcf2a03ebcc7eae45!8m2!3d50.7444894!4d15.1579529!16s%2Fg%2F11y_fbg3vr';
  console.log('Testing URL:', url.slice(0, 100) + '...');

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  } catch (error) {
    console.warn('networkidle timeout, continuing...');
  }

  console.log('Page URL:', page.url().slice(0, 100) + '...');

  if (page.url().includes('consent.google.com')) {
    console.log('On consent page, clicking accept...');
    const acceptButton = page.locator('button', {
      hasText: /accept all|agree|přijmout vše|akzeptieren|zaprijmout|souhlasím|souhlas/i,
    });
    const count = await acceptButton.count();
    if (count) {
      await acceptButton.first().click();
      const start = Date.now();
      while (Date.now() - start < 30000 && page.url().includes('consent.google.com')) {
        await page.waitForTimeout(500);
      }
      console.log('Consent handled, navigated to:', page.url().slice(0, 100) + '...');
    }
  }

  // Wait for the page to fully load
  console.log('Waiting for page to load...');
  await page.waitForTimeout(8000);

  // Inspect what's actually on the page
  const pageInfo = await page.evaluate(() => {
    const allText = document.body.innerText;
    const hasBusinessName = allText.includes('Auto Nord') || allText.includes('Škoda');
    const hasAddress = allText.includes('50.74');
    
    const allElements = document.querySelectorAll('*');
    let businessNameEl = null;
    let addressEl = null;

    for (const el of allElements) {
      const text = el.textContent || '';
      if (!businessNameEl && (text.includes('Auto Nord') || text.includes('Škoda'))) {
        businessNameEl = { tag: el.tagName, text: text.slice(0, 100), class: el.className };
      }
      if (!addressEl && (text.includes('50.74') || text.match(/\d+\.7\d+,\s*15\.\d+/))) {
        addressEl = { tag: el.tagName, text: text.slice(0, 100), class: el.className };
      }
    }

    return {
      pageHasBusinessName: hasBusinessName,
      pageHasCoords: hasAddress,
      businessElement: businessNameEl,
      addressElement: addressEl,
      firstBodyChars: allText.slice(0, 300),
      dataItemCount: document.querySelectorAll('[data-item-id]').length,
    };
  });

  console.log('\n=== PAGE INFO ===');
  console.log(JSON.stringify(pageInfo, null, 2));

  // Try to dump the raw HTML to see the structure
  const htmlSnapshot = await page.content();
  console.log('\n=== HTML SNIPPET ===');
  console.log(htmlSnapshot.slice(0, 2000) + '\n...[truncated]\n');

  await browser.close();
})();
