import { expect, test } from "@playwright/test";
import type { EnvironmentSetup, PresentationPage } from "../../src/pages/types";
import {
  readJsonFile,
  rendererMemoryState,
  runForgeDataTransitionProbe,
  sampleTransitionTickTotals,
  transitionCleanupState,
  UTAH_FORGE_ENVIRONMENT_PATH,
} from "../utah-forge/shared";

// Review success-factors A3 (GPU resource hygiene across chained transitions)
// and A5 (numeric frame-budget guard). These are PERF / SOAK diagnostics tagged
// @perf and kept in tests/perf so they are excluded from the app-health run
// (`npm run test:utah:browser` only globs tests/utah-forge). Run explicitly with
// `npm run test:perf`. They drive SYNTHETIC transition pages only -- no live
// deck pages or pageOrder.

test.setTimeout(900_000);

const synthPage = (id: string, overrides: Partial<PresentationPage>): PresentationPage =>
  ({ id, ...overrides }) as unknown as PresentationPage;

test("A3 @perf - chained transitions release GPU resources back to baseline", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(e.message));

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  const environment = readJsonFile<EnvironmentSetup>(UTAH_FORGE_ENVIRONMENT_PATH);

  // Scalar layer toggled at authored opacity drives the snapshot-clone /
  // overlay-root crossfade path; the simple layers add opacity tweens.
  const T = "utah-forge-mt-resistivity-threshold-surfaces";
  const M = "utah-forge-mt-stations";
  const L = "utah-forge-site-boundary";
  const pageA = synthPage("a3-a", {
    visibilityOverrides: { [T]: true, [M]: true, [L]: false },
    layerOverrides: { [T]: { opacity: 1, mtThresholdSurfaceWireframe: false } },
  });
  const pageB = synthPage("a3-b", {
    visibilityOverrides: { [T]: false, [M]: false, [L]: true },
    layerOverrides: { [T]: { opacity: 1, mtThresholdSurfaceWireframe: true } },
  });

  // Settle on A, then take the baseline.
  await runForgeDataTransitionProbe(page, environment, pageA, pageA, 50);
  await page.waitForTimeout(300);
  const base = await rendererMemoryState(page);

  const N = 30;
  for (let i = 0; i < N; i += 1) {
    const from = i % 2 === 0 ? pageA : pageB;
    const to = i % 2 === 0 ? pageB : pageA;
    await runForgeDataTransitionProbe(page, environment, from, to, 120);
    await page.waitForTimeout(180); // past end + 5.2 grace
  }
  // Settle back on A so the steady-state page matches the baseline page.
  await runForgeDataTransitionProbe(page, environment, pageA, pageA, 50);
  await page.waitForTimeout(400);

  const after = await rendererMemoryState(page);
  const cleanup = await transitionCleanupState(page);

  // No leaked transition state, and resource counts back near baseline. The
  // tolerance absorbs steady-state allocation noise; a real per-transition leak
  // over 30 cycles would dwarf it.
  expect(cleanup.layerSnapshotRoots, "no leaked snapshot roots").toBe(0);
  expect(cleanup.sectionIsoTransitionRoots, "no leaked ISO roots").toBe(0);
  expect(cleanup.helperTransitionSnapshots, "no leaked helper snapshots").toBe(0);
  expect(cleanup.activeContext, "context cleared").toBe(false);
  expect(
    Math.abs((after.geometries ?? 0) - (base.geometries ?? 0)),
    `geometries base=${base.geometries} after=${after.geometries}`,
  ).toBeLessThanOrEqual(8);
  expect(
    Math.abs((after.textures ?? 0) - (base.textures ?? 0)),
    `textures base=${base.textures} after=${after.textures}`,
  ).toBeLessThanOrEqual(4);
  expect(consoleErrors).toEqual([]);
});

test("A5 @perf - transition tick stays within frame budget", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(e.message));

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  const environment = readJsonFile<EnvironmentSetup>(UTAH_FORGE_ENVIRONMENT_PATH);

  // A dense transition: a scalar layer crossfade plus opacity tweens running
  // together. Sample the per-frame transition tick cost across the run.
  const T = "utah-forge-mt-resistivity-threshold-surfaces";
  const M = "utah-forge-mt-stations";
  const from = synthPage("a5-from", {
    visibilityOverrides: { [T]: true, [M]: true },
    layerOverrides: { [T]: { opacity: 1, mtThresholdSurfaceWireframe: false } },
  });
  const to = synthPage("a5-to", {
    visibilityOverrides: { [T]: true, [M]: false },
    layerOverrides: { [T]: { opacity: 1, mtThresholdSurfaceWireframe: true } },
  });

  await runForgeDataTransitionProbe(page, environment, from, to, 7000);
  const sample = await sampleTransitionTickTotals(page, 6800, 32);
  const totals = sample.totals;

  expect(
    sample.activeSeen,
    `active transition samples seen; lastDebug=${JSON.stringify(sample.lastDebug)}`,
  ).toBeGreaterThan(5);
  expect(
    totals.length,
    `active tick totals collected; debugSeen=${sample.debugSeen}; lastDebug=${JSON.stringify(sample.lastDebug)}`,
  ).toBeGreaterThan(5);
  totals.sort((a, b) => a - b);
  const p95 = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))];
  // Generous budget: one 60fps frame is ~16.7ms; the transition tick alone
  // should be a small fraction of that. This is a catastrophic-regression guard,
  // not a tight perf gate (the review notes p95 budgets are hardware-calibrated;
  // tighten from a per-environment baseline if this becomes a dedicated perf job).
  expect(p95, `tick p95=${p95}ms over ${totals.length} samples`).toBeLessThan(16);
  expect(consoleErrors).toEqual([]);
});
