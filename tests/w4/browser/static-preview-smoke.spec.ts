// W4-ENV infrastructure-only smoke. Never accepts GeoSee Gate A/B functionality.
// Runs solely under playwright.w4.config.ts after owned checkout baseline capture.
import { test, expect } from '@playwright/test';

test('W4-ENV static preview serves the production entry document', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] || '').toContain('text/html');
  const html = await response.text();
  expect(html.toLowerCase()).toContain('<!doctype html');
});

test('W4-ENV static preview fails closed on development writer requests', async ({ request }) => {
  // Empty synthetic payload only. The configured server is Vite *preview*, not `npm run dev`.
  const response = await request.post('/api/write-batch', { data: { writes: [] } });
  expect(response.status(), 'static API fallback returning 200 is NOT a safe rejection').toBeGreaterThanOrEqual(400);
});
