import { expect, test, type Page } from "@playwright/test";
import { mtVolumeSceneState, pageControllerState, sectionIsoSceneState } from "./shared";

test.setTimeout(180_000);

const MT_VOLUME_LAYER_ID = "utah-forge-mt-resistivity-volume";

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
    sourceOpacity?: number;
    targetOpacity?: number;
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

type MtVolumeOpacityDeltaPair = {
  sourceIndex: number;
  targetIndex: number;
  sourcePageId: string;
  targetPageId: string;
  sourceLayerOpacity: number;
  sourceOpacity: number;
  targetOpacity: number;
};

async function findMtVolumeOpacityDeltaPair(
  page: Page,
): Promise<MtVolumeOpacityDeltaPair> {
  return page.evaluate(async (layerId) => {
    const [projectResponse, environmentResponse] = await Promise.all([
      fetch("/projects/utah-forge/project.json"),
      fetch("/projects/utah-forge/environment.json"),
    ]);
    if (!projectResponse.ok) {
      throw new Error(`Unable to fetch Utah FORGE project manifest`);
    }
    if (!environmentResponse.ok) {
      throw new Error(`Unable to fetch Utah FORGE environment manifest`);
    }
    const project = (await projectResponse.json()) as {
      pageOrder?: string[];
    };
    const environment = (await environmentResponse.json()) as {
      defaultVisibleLayers?: string[];
      layerStyles?: Record<string, Record<string, unknown>>;
    };
    const pageOrder = Array.isArray(project.pageOrder)
      ? project.pageOrder
      : [];
    const pageSpecs = await Promise.all(
      pageOrder.map(async (pageId) => {
        const response = await fetch(`/projects/utah-forge/pages/${pageId}.json`);
        if (!response.ok) {
          throw new Error(`Unable to fetch Utah FORGE page ${pageId}`);
        }
        return (await response.json()) as {
          id?: string;
          visibilityOverrides?: Record<string, unknown>;
          layerOverrides?: Record<string, Record<string, unknown>>;
        };
      }),
    );
    const defaultVisibleLayers = new Set(environment.defaultVisibleLayers ?? []);
    const environmentStyle = environment.layerStyles?.[layerId] ?? {};
    const opacityForPage = (pageSpec: (typeof pageSpecs)[number]) => {
      const visibilityOverrides = pageSpec.visibilityOverrides ?? {};
      const visible = Object.prototype.hasOwnProperty.call(
        visibilityOverrides,
        layerId,
      )
        ? visibilityOverrides[layerId] === true
        : defaultVisibleLayers.has(layerId);
      if (!visible) return { visible, opacity: 0 };
      const style = {
        ...environmentStyle,
        ...(pageSpec.layerOverrides?.[layerId] ?? {}),
      };
      const layerOpacity =
        typeof style.opacity === "number" && Number.isFinite(style.opacity)
          ? style.opacity
          : 1;
      const scalarVolumeOpacity =
        typeof style.scalarVolumeOpacity === "number" &&
        Number.isFinite(style.scalarVolumeOpacity)
          ? style.scalarVolumeOpacity
          : layerOpacity;
      const sectionIsoSourceOpacity =
        style.sectionIsoEnabled === true &&
        typeof style.sectionIsoSourceOpacity === "number" &&
        Number.isFinite(style.sectionIsoSourceOpacity)
          ? style.sectionIsoSourceOpacity
          : style.sectionIsoEnabled === true
            ? 0
            : 1;
      return {
        visible,
        layerOpacity,
        renderOpacity: scalarVolumeOpacity * sectionIsoSourceOpacity,
      };
    };

    for (let sourceIndex = 0; sourceIndex < pageSpecs.length; sourceIndex += 1) {
      const source = opacityForPage(pageSpecs[sourceIndex]);
      if (!source.visible) continue;
      for (let targetIndex = 0; targetIndex < pageSpecs.length; targetIndex += 1) {
        if (targetIndex === sourceIndex) continue;
        const target = opacityForPage(pageSpecs[targetIndex]);
        if (
          target.visible &&
          target.layerOpacity > 0.001 &&
          Math.abs(target.layerOpacity - source.renderOpacity) > 0.001
        ) {
          return {
            sourceIndex,
            targetIndex,
            sourcePageId: pageSpecs[sourceIndex].id ?? pageOrder[sourceIndex],
            targetPageId: pageSpecs[targetIndex].id ?? pageOrder[targetIndex],
            sourceLayerOpacity: source.layerOpacity,
            sourceOpacity: source.renderOpacity,
            targetOpacity: target.layerOpacity,
          };
        }
      }
    }

    throw new Error(
      `No MT volume source/target visible opacity delta exists in the current Utah FORGE pageOrder`,
    );
  }, MT_VOLUME_LAYER_ID);
}

async function enableMtVolumeSectionIso(page: Page): Promise<void> {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => mtVolumeSceneState(page).then((state) => state.totalVolumeCount))
    .toBe(2);

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    if (volume) volume.visible = true;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-mt-resistivity-volume"],
      sceneSectionTargetProductIds: [],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: 0, invert: false },
        z: { enabled: true, positionM: -6000, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeOpacity: 0.48,
      scalarVolumeDensity: 0.78,
      scalarVolumeSampleSteps: 96,
      scalarVolumeTransferMode: "balanced",
      scalarVolumeThresholdMin: -2,
      scalarVolumeThresholdMax: 4.5,
      scalarVolumeMaskVisible: true,
      scalarColorLow: "#2cc9ff",
      scalarColorMid: "#f8dd6d",
      scalarColorHigh: "#ff637a",
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      scalarMidpoint: 0.5,
      scalarContrast: 1.1,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 3.2,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.36,
      sectionIsoFillOffset: -0.15,
      opacity: 0.48,
    });
  });

  await expect
    .poll(() =>
      sectionIsoSceneState(page, "mt-volume-cuts").then((state) => ({
        targets: state.targets.length,
        linesReady: state.lineOverlayCount > 0,
        bandsReady: state.bandOverlayCount > 0,
      })),
    )
    .toEqual({
      targets: 3,
      linesReady: true,
      bandsReady: true,
    });
}

test("Section ISO overlay opacity is independent from scalar volume layer fades", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => mtVolumeSceneState(page).then((state) => state.totalVolumeCount))
    .toBe(2);

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    if (volume) volume.visible = true;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-mt-resistivity-volume"],
      sceneSectionTargetProductIds: [],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: 0, invert: false },
        z: { enabled: true, positionM: -6000, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeOpacity: 0.48,
      scalarVolumeDensity: 0.78,
      scalarVolumeSampleSteps: 96,
      scalarVolumeTransferMode: "balanced",
      scalarVolumeThresholdMin: -2,
      scalarVolumeThresholdMax: 4.5,
      scalarVolumeMaskVisible: true,
      scalarColorLow: "#2cc9ff",
      scalarColorMid: "#f8dd6d",
      scalarColorHigh: "#ff637a",
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      scalarMidpoint: 0.5,
      scalarContrast: 1.1,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 3.2,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.36,
      sectionIsoFillOffset: -0.15,
      opacity: 0.48,
    });
  });

  await expect
    .poll(() =>
      sectionIsoSceneState(page, "mt-volume-cuts").then((state) => ({
        targets: state.targets.length,
        linesReady: state.lineOverlayCount > 0,
        bandsReady: state.bandOverlayCount > 0,
      })),
    )
    .toEqual({
      targets: 3,
      linesReady: true,
      bandsReady: true,
    });

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyLayerRenderOpacity?: (id: string, opacity: number) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyLayerRenderOpacity?.("utah-forge-mt-resistivity-volume", 0.25);
  });

  const fadedVolumeIsoState = await sectionIsoSceneState(page, "mt-volume-cuts");
  expect(
    fadedVolumeIsoState.firstLineMaterial?.transitionOpacity ?? 1,
  ).toBeGreaterThan(0.99);
  expect(fadedVolumeIsoState.firstLineMaterial?.opacityPolicy).toBe(
    "independent-of-layer-render-opacity",
  );
  expect(
    fadedVolumeIsoState.firstLineMaterial?.layerRenderOpacity ?? 1,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstLineMaterial?.opacity ?? 0).toBeCloseTo(
    fadedVolumeIsoState.firstLineMaterial?.baseOpacity ?? 0,
    2,
  );
  expect(
    fadedVolumeIsoState.firstBandMaterial?.transitionOpacity ?? 1,
  ).toBeGreaterThan(0.99);
  expect(fadedVolumeIsoState.firstBandMaterial?.opacityPolicy).toBe(
    "independent-of-layer-render-opacity",
  );
  expect(
    fadedVolumeIsoState.firstBandMaterial?.layerRenderOpacity ?? 1,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstBandUniforms?.opacity ?? 0).toBeCloseTo(
    fadedVolumeIsoState.firstBandMaterial?.baseOpacity ?? 0,
    2,
  );
});

test("Section ISO overlays follow the page transition envelope without using authored layer opacity as their base", async ({
  page,
}) => {
  await enableMtVolumeSectionIso(page);

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyLayerTransitionRenderOpacity?: (
              id: string,
              opacity: number,
              transitionOpacity: number,
            ) => void;
          };
        };
      }
    ).__scene?.manager;
    if (!manager?.applyLayerTransitionRenderOpacity) {
      throw new Error("applyLayerTransitionRenderOpacity is not available");
    }
    manager.applyLayerTransitionRenderOpacity(
      "utah-forge-mt-resistivity-volume",
      0.25,
      0.25,
    );
  });

  const fadedVolumeIsoState = await sectionIsoSceneState(page, "mt-volume-cuts");
  expect(
    fadedVolumeIsoState.firstLineMaterial?.transitionOpacity ?? 0,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstLineMaterial?.opacityPolicy).toBe(
    "transition-envelope-opacity",
  );
  expect(
    fadedVolumeIsoState.firstLineMaterial?.layerRenderOpacity ?? 1,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstLineMaterial?.opacity ?? 0).toBeCloseTo(
    (fadedVolumeIsoState.firstLineMaterial?.baseOpacity ?? 0) * 0.25,
    2,
  );
  expect(
    fadedVolumeIsoState.firstBandMaterial?.transitionOpacity ?? 0,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstBandMaterial?.opacityPolicy).toBe(
    "transition-envelope-opacity",
  );
  expect(
    fadedVolumeIsoState.firstBandMaterial?.layerRenderOpacity ?? 1,
  ).toBeCloseTo(0.25, 2);
  expect(fadedVolumeIsoState.firstBandUniforms?.opacity ?? 0).toBeCloseTo(
    (fadedVolumeIsoState.firstBandMaterial?.baseOpacity ?? 0) * 0.25,
    2,
  );
});

test("Scene section discrete helper fades reuse target planes after first frame", async ({
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
    }).__pageController?.goto?.(24);
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
      currentIndex: 24,
      targetIndex: null,
      isTransitioning: false,
    });

  await page.evaluate(() => {
    (window as unknown as {
      __pageController?: { goto?: (index: number) => void };
    }).__pageController?.goto?.(25);
  });

  const probe = (await (
    await page.waitForFunction(
      () => {
        const state = (
          window as unknown as {
            __pageController?: { getState?: () => unknown };
          }
        ).__pageController?.getState?.() as
          | {
              transitionRun?: {
                status: string;
                targetIndex: number | null;
                sceneTransition?: {
                  sceneSectionStyleTweenActive?: boolean;
                  layerTweenTick?: {
                    sceneSectionApplyMode?: string;
                    sceneSectionMs?: number;
                    sceneSectionStyleTweenActiveBefore?: boolean;
                  } | null;
                } | null;
              } | null;
            }
          | undefined;
        const run = state?.transitionRun;
        const tick = run?.sceneTransition?.layerTweenTick;
        if (
          run?.status === "active" &&
          run.targetIndex === 25 &&
          run.sceneTransition?.sceneSectionStyleTweenActive === true &&
          tick?.sceneSectionStyleTweenActiveBefore === true &&
          tick.sceneSectionApplyMode === "helper-opacity-only"
        ) {
          return {
            sceneSectionApplyMode: tick.sceneSectionApplyMode,
            sceneSectionMs: tick.sceneSectionMs,
          };
        }
        return null;
      },
      undefined,
      { timeout: 12_000 },
    )
  ).jsonValue()) as {
    sceneSectionApplyMode: string;
    sceneSectionMs: number;
  };

  expect(probe.sceneSectionApplyMode).toBe("helper-opacity-only");
});

test("Scene section helper snapshot receives delayed ground-trace geometry", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE", {
    timeout: 90_000,
  });
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(async () => {
    const sceneSectionLayerId = "utah-forge-scene-section-planes";
    const [environmentResponse, sourcePageResponse] = await Promise.all([
      fetch("/projects/utah-forge/environment.json"),
      fetch("/projects/utah-forge/pages/103_page.json"),
    ]);
    const environment = (await environmentResponse.json()) as {
      layerStyles?: Record<string, Record<string, unknown>>;
    };
    const sourcePage = (await sourcePageResponse.json()) as {
      layerOverrides?: Record<string, Record<string, unknown>>;
    };
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
            beginSceneSectionHelperTransitionSnapshot?: (
              startMs: number,
              durationMs: number,
              easing: string,
            ) => void;
          };
        };
      }
    ).__scene?.manager;
    const environmentStyle =
      environment.layerStyles?.[sceneSectionLayerId] ?? {};
    const sourceStyle = {
      ...environmentStyle,
      ...(sourcePage.layerOverrides?.[sceneSectionLayerId] ?? {}),
    };
    const targetStyle = {
      ...environmentStyle,
      sceneSectionEnabled: false,
    };
    manager?.applyStyle?.(sceneSectionLayerId, sourceStyle);
    manager?.beginSceneSectionHelperTransitionSnapshot?.(
      performance.now(),
      3000,
      "easeInOutCubic",
    );
    manager?.applyStyle?.(sceneSectionLayerId, targetStyle);
  });

  const snapshot = (await (
    await page.waitForFunction(
      () => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                sceneSectionHelperTransitionSnapshot?: {
                  group?: {
                    traverse?: (
                      fn: (obj: { userData?: Record<string, unknown> }) => void,
                    ) => void;
                  };
                } | null;
              };
            };
          }
        ).__scene?.manager;
        const root = manager?.sceneSectionHelperTransitionSnapshot?.group;
        if (!root?.traverse) return null;
        let groundTraceCount = 0;
        root.traverse((obj) => {
          if (obj.userData?.sceneSectionGroundTrace === true) {
            groundTraceCount += 1;
          }
        });
        return groundTraceCount > 0 ? { groundTraceCount } : null;
      },
      undefined,
      { timeout: 5_000 },
    )
  ).jsonValue()) as { groundTraceCount: number };

  expect(snapshot.groundTraceCount).toBeGreaterThan(0);
});

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

  const runPair = (await (
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
        const buildProbe = (
          debugState:
            | {
                transitionProgress: number;
                transitionRun?: {
                  runId: string;
                  mode: string;
                  status: string;
                  sourcePageId: string | null;
                  targetPageId: string | null;
                  reason: string;
                  durationMs?: number;
                  easing?: string;
                  easedProgress: number;
                  interruptedRunIds?: string[];
                  consumerDebug?: ActiveRunProbe["consumerDebug"];
                  sceneTransition?: {
                    sourcePageId: string | null;
                    targetPageId: string | null;
                    productFamilies?: ActiveRunProbe["productFamilies"];
                  } | null;
                } | null;
              }
            | undefined,
        ): ActiveRunProbe => {
          const run = debugState?.transitionRun;
          return {
            runId: run?.runId,
            mode: run?.mode,
            status: run?.status,
            sourcePageId: run?.sourcePageId,
            targetPageId: run?.targetPageId,
            reason: run?.reason,
            durationMs: run?.durationMs,
            easing: run?.easing,
            interruptedRunIds: run?.interruptedRunIds,
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
            productFamilies: run?.sceneTransition?.productFamilies,
          };
        };
        const debugState = controller?.getState?.() as
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
        const probe = buildProbe(debugState);
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
          controller?.goto?.(2);
          const interruptedState = controller?.getState?.() as
            | {
                transitionProgress: number;
                transitionRun?: {
                  runId: string;
                  mode: string;
                  status: string;
                  sourcePageId: string | null;
                  targetPageId: string | null;
                  reason: string;
                  durationMs?: number;
                  easing?: string;
                  easedProgress: number;
                  interruptedRunIds?: string[];
                  consumerDebug?: ActiveRunProbe["consumerDebug"];
                  sceneTransition?: {
                    sourcePageId: string | null;
                    targetPageId: string | null;
                    productFamilies?: ActiveRunProbe["productFamilies"];
                  } | null;
                } | null;
              }
            | undefined;
          const interruptedProbe = buildProbe(interruptedState);
          interruptedProbe.runChanged =
            interruptedProbe.runId !== undefined &&
            interruptedProbe.runId !== probe.runId;
          return {
            firstRun: probe,
            interruptedRun: interruptedProbe,
          };
        }
        return null;
      },
      undefined,
      { timeout: 15_000 },
    )
  ).jsonValue()) as {
    firstRun: ActiveRunProbe;
    interruptedRun: ActiveRunProbe;
  };
  const firstRun = runPair.firstRun;
  const interruptedRun = runPair.interruptedRun;

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
  await expect
    .poll(() => mtVolumeSceneState(page).then((state) => state.totalVolumeCount))
    .toBe(2);
  const pair = await findMtVolumeOpacityDeltaPair(page);

  await page.evaluate((sourceIndex) => {
    (window as unknown as {
      __pageController?: { goto?: (index: number) => void };
    }).__pageController?.goto?.(sourceIndex);
  }, pair.sourceIndex);
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
      currentIndex: pair.sourceIndex,
      targetIndex: null,
      isTransitioning: false,
    });

  await page.evaluate((targetIndex) => {
    (window as unknown as {
      __pageController?: { goto?: (index: number) => void };
    }).__pageController?.goto?.(targetIndex);
  }, pair.targetIndex);

  const product = (await (
    await page.waitForFunction(
      ({ layerId, targetIndex }) => {
        const controller = (
          window as unknown as {
            __pageController?: {
              getState?: () => unknown;
            };
          }
        ).__pageController;
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
          (entry) => entry.layerId === layerId,
        );
        return state?.transitionRun?.status === "active" &&
          state.transitionRun.targetIndex === targetIndex &&
          match
          ? match
          : null;
      },
      { layerId: MT_VOLUME_LAYER_ID, targetIndex: pair.targetIndex },
      { timeout: 15_000 },
    )
  ).jsonValue()) as NonNullable<ActiveRunProbe["productFamilies"]>[number];

  expect(product).toMatchObject({
    layerId: MT_VOLUME_LAYER_ID,
    family: "scalar-volume",
    policy: "fade-opacity",
    transitionKind: "none",
    targetVisible: true,
  });
  expect(product.sourceVisible).toBe(pair.sourceOpacity > 0.001);
  expect(product.sourceOpacity).toBeCloseTo(pair.sourceOpacity);
  expect(product.targetOpacity).toBeCloseTo(pair.targetOpacity);
});

test("Unchanged working-area focus state does not start a transition tween", async ({
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
    (
      window as unknown as {
        __pageController?: { goto?: (index: number) => void };
      }
    ).__pageController?.goto?.(1);
  });

  const probe = (await (
    await page.waitForFunction(
      () => {
        const state = (
          window as unknown as {
            __pageController?: { getState?: () => unknown };
          }
        ).__pageController?.getState?.() as
          | {
              transitionRun?: {
                status?: string;
                targetIndex?: number | null;
                sceneTransition?: {
                  activeDataTransitionCount?: number;
                  layerTweenCount?: number;
                  workingAreaFocusTweenActive?: boolean;
                } | null;
              } | null;
            }
          | undefined;
        const run = state?.transitionRun;
        if (run?.status !== "active" || run.targetIndex !== 1) return null;
        return {
          activeDataTransitionCount:
            run.sceneTransition?.activeDataTransitionCount ?? null,
          layerTweenCount: run.sceneTransition?.layerTweenCount ?? null,
          workingAreaFocusTweenActive:
            run.sceneTransition?.workingAreaFocusTweenActive ?? null,
        };
      },
      undefined,
      { timeout: 15_000 },
    )
  ).jsonValue()) as {
    activeDataTransitionCount: number | null;
    layerTweenCount: number | null;
    workingAreaFocusTweenActive: boolean | null;
  };

  expect(probe).toMatchObject({
    layerTweenCount: 1,
    workingAreaFocusTweenActive: false,
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
    sampling: "app-raf",
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
        sceneDebug?: {
          renderLoop?: {
            totalMs?: number;
            tickersMs?: number;
            managerFrameUpdateMs?: number;
          renderMs?: number;
          tickerCount?: number;
          frameIndex?: number;
            rafDeltaMs?: number | null;
            wallDeltaMs?: number | null;
            idleGapMs?: number | null;
            tickerDurations?: Array<{
              name?: string;
              durationMs?: number;
            }>;
          } | null;
        };
      controllerDebug?: {
        traceSampleMs?: number;
        transitionTick?: {
          totalMs?: number;
          tweenerMs?: number;
          pageTransitionProgressMs?: number;
          transitionDynamicCameraMs?: number;
          dynamicCameraMs?: number;
          lockedCameraFocusMs?: number;
          smoothnessSampleMs?: number;
          progressStateUpdated?: boolean;
        } | null;
      } | null;
      timerDebug?: {
        intervalMs?: number;
        tickIndex?: number;
        deltaMs?: number | null;
        maxDeltaMs?: number;
        ageMs?: number | null;
        ticksSinceLastSample?: number;
      } | null;
      longTaskDebug?: {
        supported?: boolean;
        totalCount?: number;
        totalDurationMs?: number;
        maxDurationMs?: number;
        lastStartMs?: number | null;
        lastDurationMs?: number | null;
        ageMs?: number | null;
        countSinceLastSample?: number;
        durationSinceLastSampleMs?: number;
        maxDurationSinceLastSampleMs?: number;
      } | null;
      animationFrameDebug?: {
        supported?: boolean;
        totalCount?: number;
        totalDurationMs?: number;
        maxDurationMs?: number;
        totalBlockingDurationMs?: number;
        maxBlockingDurationMs?: number;
        countSinceLastSample?: number;
        durationSinceLastSampleMs?: number;
        blockingDurationSinceLastSampleMs?: number;
        maxBlockingDurationSinceLastSampleMs?: number;
        scriptsSinceLastSample?: unknown[];
      } | null;
    }>;
  } | null;

  expect(trace).toMatchObject({
    sampling: "app-raf",
    seenActiveTransition: true,
  });
  expect(trace?.productFamilies?.length ?? 0).toBeGreaterThan(0);
  expect(trace?.samples?.length ?? 0).toBeGreaterThan(8);
  expect(
    trace?.samples?.some(
      (sample) =>
        typeof sample.sceneDebug?.renderLoop?.totalMs === "number" &&
        typeof sample.sceneDebug.renderLoop.renderMs === "number" &&
        typeof sample.sceneDebug.renderLoop.managerFrameUpdateMs === "number" &&
        typeof sample.sceneDebug.renderLoop.tickersMs === "number" &&
        typeof sample.sceneDebug.renderLoop.tickerCount === "number" &&
        typeof sample.sceneDebug.renderLoop.frameIndex === "number" &&
        typeof sample.sceneDebug.renderLoop.rafDeltaMs === "number" &&
        typeof sample.sceneDebug.renderLoop.wallDeltaMs === "number" &&
        typeof sample.sceneDebug.renderLoop.idleGapMs === "number" &&
        Array.isArray(sample.sceneDebug.renderLoop.tickerDurations) &&
        typeof sample.controllerDebug?.traceSampleMs === "number" &&
        typeof sample.controllerDebug.transitionTick?.totalMs === "number" &&
        typeof sample.controllerDebug.transitionTick.tweenerMs === "number" &&
        typeof sample.controllerDebug.transitionTick
          .pageTransitionProgressMs === "number" &&
        typeof sample.controllerDebug.transitionTick
          .transitionDynamicCameraMs === "number" &&
        typeof sample.controllerDebug.transitionTick.dynamicCameraMs ===
          "number" &&
        typeof sample.controllerDebug.transitionTick.lockedCameraFocusMs ===
          "number" &&
        typeof sample.controllerDebug.transitionTick.smoothnessSampleMs ===
          "number" &&
        typeof sample.controllerDebug.transitionTick.progressStateUpdated ===
          "boolean" &&
        typeof sample.timerDebug?.intervalMs === "number" &&
        typeof sample.timerDebug.tickIndex === "number" &&
        typeof sample.timerDebug.maxDeltaMs === "number" &&
        typeof sample.timerDebug.ticksSinceLastSample === "number" &&
        typeof sample.longTaskDebug?.supported === "boolean" &&
        typeof sample.longTaskDebug.totalCount === "number" &&
        typeof sample.longTaskDebug.totalDurationMs === "number" &&
        typeof sample.longTaskDebug.maxDurationMs === "number" &&
        typeof sample.longTaskDebug.countSinceLastSample === "number" &&
        typeof sample.longTaskDebug.durationSinceLastSampleMs === "number" &&
        typeof sample.longTaskDebug.maxDurationSinceLastSampleMs === "number" &&
        typeof sample.animationFrameDebug?.supported === "boolean" &&
        typeof sample.animationFrameDebug.totalCount === "number" &&
        typeof sample.animationFrameDebug.totalDurationMs === "number" &&
        typeof sample.animationFrameDebug.maxDurationMs === "number" &&
        typeof sample.animationFrameDebug.totalBlockingDurationMs === "number" &&
        typeof sample.animationFrameDebug.maxBlockingDurationMs === "number" &&
        typeof sample.animationFrameDebug.countSinceLastSample === "number" &&
        typeof sample.animationFrameDebug.durationSinceLastSampleMs === "number" &&
        typeof sample.animationFrameDebug.blockingDurationSinceLastSampleMs ===
          "number" &&
        typeof sample.animationFrameDebug
          .maxBlockingDurationSinceLastSampleMs === "number" &&
        Array.isArray(sample.animationFrameDebug.scriptsSinceLastSample),
    ),
  ).toBe(true);

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

  const scaleBarTickerDurations = activeSamples.flatMap((sample) =>
    (sample.sceneDebug?.renderLoop?.tickerDurations ?? [])
      .filter((ticker) => ticker.name === "ScaleBar.measure")
      .map((ticker) =>
        typeof ticker.durationMs === "number" ? ticker.durationMs : 0,
      ),
  );
  expect(scaleBarTickerDurations.length).toBeGreaterThan(0);
  expect(Math.max(...scaleBarTickerDurations)).toBeLessThan(2);
});
