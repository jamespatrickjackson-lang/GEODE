import { expect, test } from "@playwright/test";
import type { EnvironmentSetup, PresentationPage } from "../../src/pages/types";
import {
  readJsonFile,
  runForgeDataTransitionProbe,
  transitionCleanupState,
  UTAH_FORGE_ENVIRONMENT_PATH,
} from "./shared";

// Review success-factors A2 (interruption / chained-navigation stress) and A9
// (editor mutation during a transition). Both drive SYNTHETIC transition pages
// through the SceneManager transition API -- no live deck pages, page ids, or
// pageOrder. They guard behavior families (interrupt cleanup, mutation
// survival), not any specific deck state, so they belong with app-health.

test.setTimeout(900_000);

const synthPage = (id: string, overrides: Partial<PresentationPage>): PresentationPage =>
  ({ id, ...overrides }) as unknown as PresentationPage;

test("A2 - interrupted-then-completed transitions leave no transition state", async ({
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

  const L = "utah-forge-site-boundary";
  const M = "utah-forge-mt-stations";
  const pageA = synthPage("a2-page-a", {
    visibilityOverrides: { [L]: false, [M]: true },
  });
  const pageB = synthPage("a2-page-b", {
    visibilityOverrides: { [L]: true, [M]: false },
  });
  const pageC = synthPage("a2-page-c", {
    visibilityOverrides: { [L]: false, [M]: true },
  });

  // Interrupt at several points in the transition's lifetime; after each
  // interrupt-and-complete sequence the runtime must be fully cleaned up.
  for (const interruptAfterMs of [40, 200, 360]) {
    await runForgeDataTransitionProbe(page, environment, pageA, pageB, 400);
    await page.waitForTimeout(interruptAfterMs);
    // A chained navigation interrupts the in-flight transition.
    await runForgeDataTransitionProbe(page, environment, pageB, pageC, 400);
    await page.waitForTimeout(750); // past the second transition end + 5.2 grace

    const cleanup = await transitionCleanupState(page);
    const at = `interrupt@${interruptAfterMs}ms`;
    expect(cleanup.layerSnapshotRoots, `${at}: cloned snapshot roots`).toBe(0);
    expect(cleanup.sectionIsoTransitionRoots, `${at}: ISO roots`).toBe(0);
    expect(cleanup.helperTransitionSnapshots, `${at}: helper snapshots`).toBe(0);
    expect(cleanup.activeContext, `${at}: active context cleared`).toBe(false);
    expect(cleanup.layerTweens, `${at}: layer tweens drained`).toBe(0);
  }

  expect(consoleErrors).toEqual([]);
});

test("A9 - an editor mutation during a transition survives and does not contaminate other layers", async ({
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

  const A = "utah-forge-mt-stations"; // mutated mid-transition
  const B = "utah-forge-site-boundary"; // untouched control
  const from = synthPage("a9-from", {
    layerOverrides: { [A]: { opacity: 1 }, [B]: { opacity: 1 } },
  });
  const to = synthPage("a9-to", {
    layerOverrides: { [A]: { opacity: 0.2 }, [B]: { opacity: 0.2 } },
  });

  await runForgeDataTransitionProbe(page, environment, from, to, 600);
  await page.waitForTimeout(150);

  // Editor live-apply of layer A's style while the transition is running.
  await page.evaluate((layerId) => {
    const manager = (
      window as unknown as {
        __scene?: { manager?: { applyStyle?: (id: string, style: unknown) => void } };
      }
    ).__scene?.manager;
    manager?.applyStyle?.(layerId, { opacity: 0.66 });
  }, A);

  await page.waitForTimeout(800); // let the transition land

  const readOpacity = (layerId: string) =>
    page.evaluate((id) => {
      const manager = (
        window as unknown as {
          __scene?: {
            manager?: {
              layers?: Map<
                string,
                {
                  traverse: (
                    fn: (o: {
                      material?:
                        | { opacity?: number }
                        | Array<{ opacity?: number }>;
                    }) => void,
                  ) => void;
                }
              >;
            };
          };
        }
      ).__scene?.manager;
      const group = manager?.layers?.get(id);
      let opacity: number | null = null;
      group?.traverse((o) => {
        if (opacity !== null || !o.material) return;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (typeof mat?.opacity === "number") opacity = mat.opacity;
      });
      return opacity;
    }, layerId);

  // A's mid-transition mutation survives the transition landing.
  expect(await readOpacity(A)).toBeCloseTo(0.66, 1);
  // The untouched control layer reaches its authored target, not A's value.
  expect(await readOpacity(B)).toBeCloseTo(0.2, 1);

  const cleanup = await transitionCleanupState(page);
  expect(cleanup.activeContext).toBe(false);
  expect(cleanup.layerTweens).toBe(0);
  expect(consoleErrors).toEqual([]);
});
