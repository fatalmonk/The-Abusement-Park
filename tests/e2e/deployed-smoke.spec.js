import { expect, test } from '@playwright/test';

const smokeUrl = process.env.SMOKE_BASE_URL;

test.describe('deployed preview smoke', () => {
  test.skip(!smokeUrl, 'SMOKE_BASE_URL is required for deployed smoke tests.');

  test('homepage and Cloudflare Pages Function route are reachable', async ({ request }) => {
    const homepage = await request.get(smokeUrl);
    expect(homepage.status()).toBe(200);
    expect(await homepage.text()).toContain('<title>The Abusement Park');

    // POST is deterministic and proves /api/standings resolves to the Pages Function
    // without calling the live FPL upstream.
    const endpoint = new URL('/api/standings', smokeUrl).toString();
    const api = await request.post(endpoint);
    expect(api.status()).toBe(405);
    expect(api.headers().allow).toBe('GET');
    await expect(api.json()).resolves.toEqual({ error: 'Method not allowed.' });
  });
});
