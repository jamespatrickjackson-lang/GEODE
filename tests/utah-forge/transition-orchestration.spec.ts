import { expect, test } from "@playwright/test";
import { pageControllerState } from "./shared";

test.setTimeout(180_000);

type ActiveRunProbe = {
  runId?: string;
  mode?: string;
  status?: string;
  sourcePageId?: string | null;
  targetPageId?: string | null;
  reason?: string;
  durationMs?: number;
  easing?: string;
  progressMatchesState?: boolean;
  interruptedRunIds?: string[];
  sceneSourcePageId?: string | null;
  sceneTargetPageId?: string | null;
  runChanged?: boolean;
  productFamilies?: Array<{
    layerId?: string;
    family: string;
    policy: string;
    transitionKind?: string;
    sourceVisible?: boolean;
    targetVisible?: boolean;
  }>;
  consumerDebug?: {
    presenterOverlay?: {
      policy: string;
      active: boolean;
      sourcePageId: string | null;
      targetPageId: string | null;
    };
    sceneOverlays?: {
      policy: string;
      fadeDurationMs: number;
      lastPhase: string | null;
      lastPageId: string | null;
    };
    labels?: {
      policy: string;
      switchThreshold: number;
      activePageId: string | null;
    };
    assays?: {
      policy: string;
      switchThreshold: number;
      activePageId: string | null;
    };
    legends?: {
      stackPolicy: string;
      resistivityPolicy: string;
      defaultPolicy: string;
      sourcePageId: string | null;
      targetPageId: string | null;
    };
    lateReapply?: {
      totalCount: number;
      duringTransitionCount: number;
      events?: Array<{
        action: string;
        duringTransition: boolean;
        transitionSourcePageId: string | null;
        transitionTargetPageId: string | null;
        transitionProgress: number | null;
      }>;
    };
  };
};

test("Page transition debug exposes a shared run across interruption", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: { goto?: (index: number) => void };
      }
    ).__pageController;
    controller?.goto?.(1);
  });

  const firstRun = (await (
    await page.waitForFunction(
      () => {
        const state = (
          window as unknown as {
            __pageController?: {
              getState?: () => unknown;
              goto?: (index: number) => void;
            };
          }
        ).__pageController;
        const debugState = state?.getState?.() as
          | {
              transitionProgress: number;
              transitionRun?: {
                runId: string;
                mode: string;
                status: string;
                sourcePageId: string | null;
                targetPageId: string | null;
                reason: string;
                durationMs: number;
                easing: string;
                easedProgress: number;
                consumerDebug?: ActiveRunProbe["consumerDebug"];
                sceneTransition?: {
                  sourcePageId: string | null;
                  targetPageId: string | null;
                } | null;
              } | null;
            }
          | undefined;
        const run = debugState?.transitionRun;
        const probe: ActiveRunProbe = {
          runId: run?.runId,
          mode: run?.mode,
          status: run?.status,
          sourcePageId: run?.sourcePageId,
          targetPageId: run?.targetPageId,
          reason: run?.reason,
          durationMs: run?.durationMs,
          easing: run?.easing,
          progressMatchesState:
            run !== undefined && run !== null
              ? Math.abs(
                  run.easedProgress -
                    (debugState?.transitionProgress ?? Number.NaN),
                ) < 0.01
              : undefined,
          consumerDebug: run?.consumerDebug,
          sceneSourcePageId: run?.sceneTransition?.sourcePageId,
          sceneTargetPageId: run?.sceneTransition?.targetPageId,
          productFamilies: (
            run?.sceneTransition as
              | {
                  productFamilies?: ActiveRunProbe["productFamilies"];
                }
              | undefined
          )?.productFamilies,
        };
        if (
          probe.mode === "page" &&
          probe.status === "active" &&
          probe.sourcePageId === "12_mt_volume_overview" &&
          probe.targetPageId === "06_mt_low_resistivity_seismic" &&
          probe.reason === "page-click" &&
          probe.durationMs === 3000 &&
          probe.easing === "easeInOutCubic" &&
          probe.progressMatchesState === true &&
          probe.sceneSourcePageId === "12_mt_volume_overview" &&
          probe.sceneTargetPageId === "06_mt_low_resistivity_seismic"
        ) {
          state?.goto?.(2);
          return probe;
        }
        return null;
      },
      undefined,
      { timeout: 15_000 },
    )
  ).jsonValue()) as ActiveRunProbe;

  expect(firstRun).toMatchObject({
    runId: expect.any(String),
    mode: "page",
    status: "active",
    sourcePageId: "12_mt_volume_overview",
    targetPageId: "06_mt_low_resistivity_seismic",
    reason: "page-click",
    durationMs: 3000,
    easing: "easeInOutCubic",
    progressMatchesState: true,
    sceneSourcePageId: "12_mt_volume_overview",
    sceneTargetPageId: "06_mt_low_resistivity_seismic",
    productFamilies: expect.arrayContaining([
      expect.objectContaining({
        layerId: "utah-forge-mt-resistivity-volume",
        family: "scalar-volume",
        policy: expect.any(String),
      }),
      expect.objectContaining({
        layerId: "utah-forge-mt-resistivity-threshold-surfaces",
        family: "mt-isosurfaces",
        policy: expect.any(String),
      }),
      expect.objectContaining({
        layerId: "utah-forge-phase3-seismic-browser",
        family: "seismic-volume",
        policy: expect.any(String),
      }),
    ]),
    consumerDebug: {
      presenterOverlay: {
        policy: "crossfade-slide",
        active: true,
        sourcePageId: "12_mt_volume_overview",
        targetPageId: "06_mt_low_resistivity_seismic",
      },
      sceneOverlays: {
        policy: "fixed-duration-linear-fade",
        fadeDurationMs: 800,
        lastPhase: "transition-start",
        lastPageId: "06_mt_low_resistivity_seismic",
      },
      labels: {
        policy: "hold-source-until-threshold",
        switchThreshold: 0.92,
        sourcePageId: "12_mt_volume_overview",
        targetPageId: "06_mt_low_resistivity_seismic",
      },
      assays: {
        policy: "hold-source-until-threshold",
        switchThreshold: 0.92,
        sourcePageId: "12_mt_volume_overview",
        targetPageId: "06_mt_low_resistivity_seismic",
      },
      legends: {
        stackPolicy: "phased-layout-slide",
        resistivityPolicy: "interpolate-source-target",
        defaultPolicy: "target-from-start",
        sourcePageId: "12_mt_volume_overview",
        targetPageId: "06_mt_low_resistivity_seismic",
      },
      lateReapply: {
        totalCount: expect.any(Number),
        duringTransitionCount: expect.any(Number),
      },
    },
  });

  const interruptedRun = (await (
    await page.waitForFunction(
      (firstRunId) => {
        const state = (
          window as unknown as {
            __pageController?: { getState?: () => unknown };
          }
        ).__pageController?.getState?.() as
          | {
              transitionProgress: number;
              transitionRun?: {
                runId: string;
                mode: string;
                status: string;
                sourcePageId: string | null;
                targetPageId: string | null;
                reason: string;
                easedProgress: number;
                interruptedRunIds: string[];
                consumerDebug?: ActiveRunProbe["consumerDebug"];
                sceneTransition?: {
                  sourcePageId: string | null;
                  targetPageId: string | null;
                } | null;
              } | null;
            }
          | undefined;
        const run = state?.transitionRun;
        const probe: ActiveRunProbe = {
          runId: run?.runId,
          mode: run?.mode,
          status: run?.status,
          sourcePageId: run?.sourcePageId,
          targetPageId: run?.targetPageId,
          reason: run?.reason,
          interruptedRunIds: run?.interruptedRunIds,
          progressMatchesState:
            run !== undefined && run !== null
              ? Math.abs(
                  run.easedProgress -
                    (state?.transitionProgress ?? Number.NaN),
                ) < 0.01
              : undefined,
          consumerDebug: run?.consumerDebug,
          sceneSourcePageId: run?.sceneTransition?.sourcePageId,
          sceneTargetPageId: run?.sceneTransition?.targetPageId,
          productFamilies: (
            run?.sceneTransition as
              | {
                  productFamilies?: ActiveRunProbe["productFamilies"];
                }
              | undefined
          )?.productFamilies,
          runChanged:
            run !== undefined && run !== null
              ? run.runId !== firstRunId
              : undefined,
        };
        return probe.mode === "page" &&
          probe.status === "active" &&
          probe.sourcePageId === "06_mt_low_resistivity_seismic" &&
          probe.targetPageId === "04_mt_high_resistivity_seismic" &&
          probe.reason === "interrupted" &&
          JSON.stringify(probe.interruptedRunIds) ===
            JSON.stringify([firstRunId]) &&
          probe.sceneSourcePageId === "06_mt_low_resistivity_seismic" &&
          probe.sceneTargetPageId === "04_mt_high_resistivity_seismic" &&
          probe.runChanged === true
          ? probe
          : null;
      },
      firstRun.runId,
      { timeout: 15_000 },
    )
  ).jsonValue()) as ActiveRunProbe;

  expect(interruptedRun).toMatchObject({
    runId: expect.any(String),
    mode: "page",
    status: "active",
    sourcePageId: "06_mt_low_resistivity_seismic",
    targetPageId: "04_mt_high_resistivity_seismic",
    reason: "interrupted",
    interruptedRunIds: [firstRun.runId],
    progressMatchesState: true,
    sceneSourcePageId: "06_mt_low_resistivity_seismic",
    sceneTargetPageId: "04_mt_high_resistivity_seismic",
    runChanged: true,
    consumerDebug: {
      presenterOverlay: {
        policy: "crossfade-slide",
        active: true,
        sourcePageId: "06_mt_low_resistivity_seismic",
        targetPageId: "04_mt_high_resistivity_seismic",
      },
      labels: {
        policy: "hold-source-until-threshold",
        switchThreshold: 0.92,
        sourcePageId: "06_mt_low_resistivity_seismic",
        targetPageId: "04_mt_high_resistivity_seismic",
      },
      legends: {
        sourcePageId: "06_mt_low_resistivity_seismic",
        targetPageId: "04_mt_high_resistivity_seismic",
      },
    },
  });

  expect(interruptedRun.runId).not.toBe(firstRun.runId);

  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return {
          currentPageId: state.currentPageId,
          isTransitioning: state.isTransitioning,
          transitionRun: state.transitionRun,
          lastStatus: state.lastTransitionRun?.status,
          lastRunId: state.lastTransitionRun?.runId,
          lastTargetPageId: state.lastTransitionRun?.targetPageId,
        };
      },
      { timeout: 8_000 },
    )
    .toMatchObject({
      currentPageId: "04_mt_high_resistivity_seismic",
      isTransitioning: false,
      transitionRun: null,
      lastStatus: "completed",
      lastRunId: interruptedRun.runId,
      lastTargetPageId: "04_mt_high_resistivity_seismic",
    });

  expect(consoleErrors).toEqual([]);
});

test("Late async reapply during a page transition preserves transition context", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: { goto?: (index: number) => void };
      }
    ).__pageController;
    controller?.goto?.(1);
  });

  const probe = (await (
    await page.waitForFunction(
      () => {
        const scene = (
          window as unknown as {
            __scene?: {
              manager?: {
                reapplyCurrentPageState?: () => void;
              };
            };
            __pageController?: { getState?: () => unknown };
          }
        ).__scene;
        const controller = (window as unknown as {
          __pageController?: { getState?: () => unknown };
        }).__pageController;
        const state = controller?.getState?.() as
          | {
              transitionRun?: {
                mode: string;
                status: string;
                sourcePageId: string | null;
                targetPageId: string | null;
                consumerDebug?: ActiveRunProbe["consumerDebug"];
              } | null;
            }
          | undefined;
        const run = state?.transitionRun;
        if (
          run?.mode !== "page" ||
          run.status !== "active" ||
          run.sourcePageId !== "12_mt_volume_overview" ||
          run.targetPageId !== "06_mt_low_resistivity_seismic"
        ) {
          return null;
        }
        scene?.manager?.reapplyCurrentPageState?.();
        const nextState = controller?.getState?.() as
          | {
              transitionRun?: {
                mode: string;
                status: string;
                sourcePageId: string | null;
                targetPageId: string | null;
                consumerDebug?: ActiveRunProbe["consumerDebug"];
              } | null;
            }
          | undefined;
        const lateReapply =
          nextState?.transitionRun?.consumerDebug?.lateReapply;
        const lastEvent = lateReapply?.events?.[lateReapply.events.length - 1];
        return {
          mode: nextState?.transitionRun?.mode,
          status: nextState?.transitionRun?.status,
          sourcePageId: nextState?.transitionRun?.sourcePageId,
          targetPageId: nextState?.transitionRun?.targetPageId,
          totalCount: lateReapply?.totalCount,
          duringTransitionCount: lateReapply?.duringTransitionCount,
          lastEvent,
        };
      },
      undefined,
      { timeout: 15_000 },
    )
  ).jsonValue()) as {
    mode?: string;
    status?: string;
    sourcePageId?: string | null;
    targetPageId?: string | null;
    totalCount?: number;
    duringTransitionCount?: number;
    lastEvent?: {
      action: string;
      duringTransition: boolean;
      transitionSourcePageId: string | null;
      transitionTargetPageId: string | null;
      transitionProgress: number | null;
    };
  };

  expect(probe).toMatchObject({
    mode: "page",
    status: "active",
    sourcePageId: "12_mt_volume_overview",
    targetPageId: "06_mt_low_resistivity_seismic",
    totalCount: expect.any(Number),
    duringTransitionCount: expect.any(Number),
    lastEvent: {
      action: "transition-aware-current-page-state",
      duringTransition: true,
      transitionSourcePageId: "12_mt_volume_overview",
      transitionTargetPageId: "06_mt_low_resistivity_seismic",
      transitionProgress: expect.any(Number),
    },
  });
  expect(probe.lastEvent?.transitionProgress).toBeGreaterThanOrEqual(0);
  expect(probe.lastEvent?.transitionProgress).toBeLessThanOrEqual(1);
});

test("MT volume opacity deltas are exposed as fade-opacity policy", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => {
    (window as unknown as {
      __pageController?: { goto?: (index: number) => void };
    }).__pageController?.goto?.(22);
  });
  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return {
          currentIndex: state.currentIndex,
          targetIndex: state.targetIndex,
          isTransitioning: state.isTransitioning,
        };
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      currentIndex: 22,
      targetIndex: null,
      isTransitioning: false,
    });

  const product = (await (
    await page.waitForFunction(
      () => {
        const controller = (
          window as unknown as {
            __pageController?: {
              getState?: () => unknown;
              goto?: (index: number) => void;
            };
          }
        ).__pageController;
        controller?.goto?.(24);
        const state = controller?.getState?.() as
          | {
              transitionRun?: {
                status: string;
                targetIndex: number | null;
                sceneTransition?: {
                  productFamilies?: ActiveRunProbe["productFamilies"];
                } | null;
              } | null;
            }
          | undefined;
        const match = state?.transitionRun?.sceneTransition?.productFamilies?.find(
          (entry) =>
            entry.layerId === "utah-forge-mt-resistivity-volume" &&
            entry.sourceVisible === true &&
            entry.targetVisible === true,
        );
        return state?.transitionRun?.status === "active" &&
          state.transitionRun.targetIndex === 24 &&
          match
          ? match
          : null;
      },
      undefined,
      { timeout: 15_000 },
    )
  ).jsonValue()) as NonNullable<ActiveRunProbe["productFamilies"]>[number];

  expect(product).toMatchObject({
    layerId: "utah-forge-mt-resistivity-volume",
    family: "scalar-volume",
    policy: "fade-opacity",
    transitionKind: "none",
    sourceVisible: true,
    targetVisible: true,
  });
});

test("App-side smoothness trace samples inside the transition tick", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);

  const start = (await page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: {
          startSmoothnessTrace?: (
            metadata?: Record<string, unknown>,
            options?: { maxDurationMs?: number; sampleIntervalMs?: number },
          ) => { traceId: string; sampling: string };
        };
      }
    ).__pageController;
    return controller?.startSmoothnessTrace?.(
      { caseName: "playwright-smoothness-trace" },
      { maxDurationMs: 5_000, sampleIntervalMs: 0 },
    );
  })) as { traceId: string; sampling: string } | undefined;

  expect(start).toMatchObject({
    traceId: expect.stringMatching(/^smoothness-/),
    sampling: "app-tick",
  });

  await page.evaluate(() => {
    (
      window as unknown as {
        __pageController?: { goto?: (index: number) => void };
      }
    ).__pageController?.goto?.(1);
  });

  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return {
          currentIndex: state.currentIndex,
          targetIndex: state.targetIndex,
          isTransitioning: state.isTransitioning,
        };
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      currentIndex: 1,
      targetIndex: null,
      isTransitioning: false,
    });

  const trace = (await page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: {
          stopSmoothnessTrace?: (reason?: "settled") => unknown;
        };
      }
    ).__pageController;
    return controller?.stopSmoothnessTrace?.("settled") ?? null;
  })) as {
    sampling?: string;
    seenActiveTransition?: boolean;
    productFamilies?: unknown[];
    samples?: Array<{
      isTransitioning?: boolean;
      runStatus?: string | null;
      runRawProgress?: number | null;
      transitionProgress?: number;
    }>;
  } | null;

  expect(trace).toMatchObject({
    sampling: "app-tick",
    seenActiveTransition: true,
  });
  expect(trace?.productFamilies?.length ?? 0).toBeGreaterThan(0);
  expect(trace?.samples?.length ?? 0).toBeGreaterThan(8);

  const activeSamples =
    trace?.samples?.filter(
      (sample) =>
        sample.isTransitioning === true &&
        sample.runStatus === "active" &&
        typeof sample.runRawProgress === "number",
    ) ?? [];
  expect(activeSamples.length).toBeGreaterThanOrEqual(5);
  expect(activeSamples[0].runRawProgress).toBeGreaterThanOrEqual(0);
  expect(
    activeSamples[activeSamples.length - 1].runRawProgress,
  ).toBeLessThanOrEqual(1);
  expect(
    activeSamples[activeSamples.length - 1].runRawProgress ?? 0,
  ).toBeGreaterThan(activeSamples[0].runRawProgress ?? 0);
});
