// W4-ENV infrastructure-only smoke. Never accepts GeoSee Gate A/B functionality.
// Runs solely under playwright.w4.config.ts after owned checkout baseline capture.
import { test, expect } from '@playwright/test';

test('W4-ENV static preview serves the production entry document', async ({ request }) => {
  const response = await request.get('/');
  console.log('W4_HTTP_GET_ROOT=' + response.status());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] || '').toContain('text/html');
  const html = await response.text();
  expect(html.toLowerCase()).toContain('<!doctype html');
});

test('W4-ENV static preview resolves a copied project manifest as JSON', async ({ request }) => {
  // Read-only static asset check; not a scientific accuracy, loading or rights assertion.
  const response = await request.get('/projects/utah-forge/project.json');
  console.log('W4_HTTP_GET_PROJECT_MANIFEST=' + response.status());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] || '').toContain('application/json');
  const manifest = await response.json();
  expect(Array.isArray(manifest.layers)).toBe(true);
});

test('W4-ENV static preview fails closed on development writer requests', async ({ request }) => {
  // Empty synthetic payload only. The configured server is Vite *preview*, not `npm run dev`.
  const response = await request.post('/api/write-batch', { data: { writes: [] } });
  console.log('W4_HTTP_POST_DEV_WRITE=' + response.status());
  expect(response.status(), 'static API fallback returning 200 is NOT a safe rejection').toBeGreaterThanOrEqual(400);
});
