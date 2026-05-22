import { expect, test } from "@playwright/test";
import {
  changedByteCount,
  ensureForgeLayerVisible,
  expectPageTransitionProgress,
  expectProgressedToward,
  forgeLayerItem,
  MT_FULL_DENSITY_MANIFEST_PATH,
  MT_FULL_DENSITY_PAGE04_INDEXED_POINTS,
  MT_FULL_DENSITY_PAGE05_INDEXED_POINTS,
  MT_FULL_DENSITY_PAGE06_INDEXED_POINTS,
  mtFullDensityPointSceneState,
  mtVolumeSceneState,
  openForgeDataEditorContainers,
  pageControllerState,
  readJsonFile,
  resistivityLegendHandleState,
  runForgeDataTransitionProbe,
  seismicSceneState,
  selectForgePageRow,
  selectNextForgePage,
  setForgeLayerVisible,
  transitionSnapshotState,
  UTAH_FORGE_ENVIRONMENT_PATH,
  UTAH_FORGE_PAGE06_PATH,
  UTAH_FORGE_PAGE12_PATH,
  utahForgeRuntimePresentationState
} from "./shared";

test.setTimeout(900_000);

test("Utah FORGE full-density MT point cloud renders all-valid and thresholded states", async ({
  page,
}) => {
  const mtFullDensityManifest = readJsonFile<{
    tiles: Array<{
      id: string;
      pointCount: number;
      file: string;
      scalarFile: string;
    }>;
  }>(MT_FULL_DENSITY_MANIFEST_PATH);
  const expectedFullDensityPointCount = mtFullDensityManifest.tiles.reduce(
    (total, tile) => total + tile.pointCount,
    0,
  );
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const loadedUrls: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("resistivity_model/full_density")) {
      loadedUrls.push(url);
    }
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  await page.goto("/?project=utah-forge", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE");
  await expect(page.locator("canvas")).toHaveCount(1);

  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          `/projects/utah-forge/${MT_FULL_DENSITY_MANIFEST_PATH.replace(
            "projects/utah-forge/",
            "",
          )}`,
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        loadedUrls.filter((url) =>
          url.includes("/resistivity_model/full_density/tiles/"),
        ).length,
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(mtFullDensityManifest.tiles.length * 2);

  await expect
    .poll(() => utahForgeRuntimePresentationState(page), { timeout: 60_000 })
    .toMatchObject({
      activeRenderPresetId: "utah-forge-reference-cinematic-dark",
      rendererExposure: 1.08,
      clearColor: "#383838",
      sceneBackground: "#383838",
      fogColor: "#383838",
      fogDensity: 0.00008,
    });

  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 60_000 })
    .toMatchObject({
      layerVisible: true,
      pointObjects: mtFullDensityManifest.tiles.length,
      visiblePointObjects: mtFullDensityManifest.tiles.length,
      totalPointCount: expectedFullDensityPointCount,
      indexedVisiblePointCount: expectedFullDensityPointCount,
      firstTileId: mtFullDensityManifest.tiles[0].id,
      firstMaterial: {
        opacity: 0.3,
        size: 1,
        transparent: true,
        vertexColors: true,
        depthTest: true,
        depthWrite: false,
      },
    });

  await selectForgePageRow(page, "01.");
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      layerVisible: true,
      pointObjects: mtFullDensityManifest.tiles.length,
      visiblePointObjects: mtFullDensityManifest.tiles.length,
      totalPointCount: expectedFullDensityPointCount,
      indexedVisiblePointCount: expectedFullDensityPointCount,
      firstTileId: mtFullDensityManifest.tiles[0].id,
      firstMaterial: {
        opacity: 0.48,
        size: 1.25,
        transparent: true,
        vertexColors: true,
        depthTest: true,
        depthWrite: false,
      },
    });

  await selectForgePageRow(page, "02.");
  await expect
    .poll(() => utahForgeRuntimePresentationState(page), { timeout: 60_000 })
    .toMatchObject({
      activeRenderPresetId: "utah-forge-reference-cinematic-dark",
      rendererExposure: 1.08,
      clearColor: "#383838",
      sceneBackground: "#383838",
      fogColor: "#383838",
      fogDensity: 0.00008,
    });
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      layerVisible: true,
      pointObjects: mtFullDensityManifest.tiles.length,
      visiblePointObjects: mtFullDensityManifest.tiles.length,
      totalPointCount: expectedFullDensityPointCount,
      indexedVisiblePointCount: MT_FULL_DENSITY_PAGE06_INDEXED_POINTS,
      firstTileId: mtFullDensityManifest.tiles[0].id,
      firstMaterial: {
        opacity: 0.3,
        size: 1,
        transparent: true,
        vertexColors: true,
        depthTest: true,
        depthWrite: false,
      },
    });

  const unexpectedFailedResponses = failedResponses.filter(
    (failure) => !failure.includes("/api/read-file"),
  );
  const onlyPreviewReadFile404s =
    failedResponses.length > 0 && unexpectedFailedResponses.length === 0;
  const unexpectedConsoleErrors = consoleErrors.filter(
    (error) =>
      !(
        onlyPreviewReadFile404s &&
        error.includes(
          "Failed to load resource: the server responded with a status of 404",
        )
      ),
  );
  expect(unexpectedFailedResponses).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});

test("Utah FORGE data layers follow page camera transitions", async ({
  page,
}, testInfo) => {
  const mtFullDensityManifest = readJsonFile<{
    tiles: Array<{
      id: string;
      pointCount: number;
      file: string;
      scalarFile: string;
    }>;
  }>(MT_FULL_DENSITY_MANIFEST_PATH);
  const forgeEnvironment = readJsonFile<Record<string, unknown>>(
    UTAH_FORGE_ENVIRONMENT_PATH,
  );
  const page06Spec = readJsonFile<Record<string, unknown>>(
    UTAH_FORGE_PAGE06_PATH,
  );
  const page12Spec = readJsonFile<Record<string, unknown>>(
    UTAH_FORGE_PAGE12_PATH,
  );
  const expectedFullDensityPointCount = mtFullDensityManifest.tiles.reduce(
    (total, tile) => total + tile.pointCount,
    0,
  );
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
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("body")).toContainText("Utah FORGE");
  await expect(page.locator("canvas")).toHaveCount(1);
  const legend = page
    .locator('[aria-label="Utah FORGE MT resistivity color legend"]')
    .filter({ hasText: "MT resistivity" })
    .first();
  await expect(legend).toBeVisible();
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      layerVisible: true,
      pointObjects: mtFullDensityManifest.tiles.length,
      totalPointCount: expectedFullDensityPointCount,
    });

  await selectForgePageRow(page, "01.");
  const row01Handles = await resistivityLegendHandleState(page);
  await selectNextForgePage(page);
  await expectPageTransitionProgress(page, 0, 1);
  await page.waitForTimeout(1600);
  const row01ToRow02MidHandles = await resistivityLegendHandleState(page);
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      indexedVisiblePointCount: MT_FULL_DENSITY_PAGE06_INDEXED_POINTS,
      firstMaterial: {
        opacity: 0.3,
        size: 1,
      },
    });
  const row02Handles = await resistivityLegendHandleState(page);
  expectProgressedToward(
    row01ToRow02MidHandles.focusMin,
    row01Handles.focusMin,
    row02Handles.focusMin,
  );
  await page.waitForTimeout(2400);
  await expect
    .poll(() => transitionSnapshotState(page).then((state) => state.count))
    .toBe(0);

  const row02ForRequiredRoute = await resistivityLegendHandleState(page);
  await selectNextForgePage(page);
  await expectPageTransitionProgress(page, 1, 2);
  await page.waitForTimeout(1600);
  const row02ToRow03MidHandles = await resistivityLegendHandleState(page);
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      indexedVisiblePointCount: MT_FULL_DENSITY_PAGE04_INDEXED_POINTS,
    });
  const row03Handles = await resistivityLegendHandleState(page);
  expectProgressedToward(
    row02ToRow03MidHandles.focusMin,
    row02ForRequiredRoute.focusMin,
    row03Handles.focusMin,
  );
  await page.waitForTimeout(2400);

  await selectNextForgePage(page);
  await page.waitForTimeout(100);
  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return (
          state.currentIndex === 2 &&
          state.targetIndex === 3 &&
          state.isTransitioning
        );
      },
      { timeout: 1_500, intervals: [50, 100, 200] },
    )
    .toBe(true);
  await page.waitForTimeout(1500);
  let row03ToRow04MidHandles = await resistivityLegendHandleState(page);
  await expect
    .poll(
      async () => {
        row03ToRow04MidHandles = await resistivityLegendHandleState(page);
        return row03ToRow04MidHandles.focusMin;
      },
      { timeout: 3_000, intervals: [100, 200, 400] },
    )
    .toBeGreaterThan(row03Handles.focusMin);
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      indexedVisiblePointCount: MT_FULL_DENSITY_PAGE05_INDEXED_POINTS,
    });
  const row04Handles = await resistivityLegendHandleState(page);
  expectProgressedToward(
    row03ToRow04MidHandles.focusMin,
    row03Handles.focusMin,
    row04Handles.focusMin,
  );

  await page.waitForTimeout(2200);
  await expect
    .poll(() => transitionSnapshotState(page).then((state) => state.count))
    .toBe(0);

  const beforeInterruptState = await pageControllerState(page);
  const firstInterruptTargetIndex =
    beforeInterruptState.currentIndex === 0 ? 1 : 0;
  const secondInterruptTargetIndex = firstInterruptTargetIndex === 1 ? 2 : 1;
  const pageIdByIndex = [
    "12_mt_volume_overview",
    "06_mt_low_resistivity_seismic",
    "04_mt_high_resistivity_seismic",
  ];
  await page.evaluate(
    ({ firstTargetIndex, secondTargetIndex }) =>
      new Promise<void>((resolve) => {
        const controller = (
          window as unknown as {
            __pageController?: { goto?: (index: number) => void };
          }
        ).__pageController;
        controller?.goto?.(firstTargetIndex);
        window.setTimeout(() => {
          controller?.goto?.(secondTargetIndex);
          resolve();
        }, 50);
      }),
    {
      firstTargetIndex: firstInterruptTargetIndex,
      secondTargetIndex: secondInterruptTargetIndex,
    },
  );
  const firstTargetPageId = pageIdByIndex[firstInterruptTargetIndex];
  const secondTargetPageId = pageIdByIndex[secondInterruptTargetIndex];
  await expect
    .poll(async () => {
      const state = await pageControllerState(page);
      return (
        state.targetIndex === secondInterruptTargetIndex &&
        state.transitionContext?.reason === "interrupted" &&
        state.transitionContext?.sourcePageId === firstTargetPageId &&
        state.transitionContext?.targetPageId === secondTargetPageId
      );
    })
    .toBe(true);
  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return (
          state.currentIndex === secondInterruptTargetIndex &&
          state.currentPageId === secondTargetPageId &&
          state.targetIndex === null &&
          !state.isTransitioning
        );
      },
      { timeout: 6_000 },
    )
    .toBe(true);

  await runForgeDataTransitionProbe(
    page,
    forgeEnvironment,
    page06Spec,
    page12Spec,
  );
  await expect
    .poll(
      () =>
        transitionSnapshotState(page).then(
          (state) => state.byLayer["utah-forge-phase3-seismic-browser"] ?? 0,
        ),
      { timeout: 3_000 },
    )
    .toBeGreaterThan(0);
  const page06ToPage12Snapshots = await transitionSnapshotState(page);
  expect(
    page06ToPage12Snapshots.byLayer["utah-forge-phase3-seismic-browser"] ?? 0,
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("utah-forge-page06-to-page12-crossfade-mid.png"),
    fullPage: false,
  });
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      indexedVisiblePointCount: expectedFullDensityPointCount,
    });
  await expect
    .poll(() => seismicSceneState(page), { timeout: 90_000 })
    .toMatchObject({
      layerVisible: false,
    });
  await expect
    .poll(() => transitionSnapshotState(page).then((state) => state.count))
    .toBe(0);

  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE Stage 2 full-density MT layer loads and exposes controls", async ({
  page,
}) => {
  const mtFullDensityManifest = readJsonFile<{
    tiles: Array<{
      id: string;
      pointCount: number;
      file: string;
      scalarFile: string;
    }>;
  }>(MT_FULL_DENSITY_MANIFEST_PATH);
  const expectedFullDensityPointCount = mtFullDensityManifest.tiles.reduce(
    (total, tile) => total + tile.pointCount,
    0,
  );
  const consoleErrors: string[] = [];
  const loadedUrls: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (
      url.includes("utah_forge_phase_3/electrical_resistivity") ||
      url.includes("/projects/utah-forge/")
    ) {
      loadedUrls.push(url);
    }
  });

  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });

  await expect(page.locator("body")).toContainText("Utah FORGE");
  await expect(page.locator("body")).toContainText("Full-density model");
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.getByRole("button", { name: "FORGE Data" }).click();
  await openForgeDataEditorContainers(page);
  await expect(page.locator("body")).toContainText("Public Topo Map");
  await expect(forgeLayerItem(page, "Public terrain surface")).toBeVisible();
  await expect(forgeLayerItem(page, "Public roads")).toBeVisible();
  await expect(forgeLayerItem(page, "Public streams and rivers")).toBeVisible();
  await expect(forgeLayerItem(page, "Public waterbodies")).toBeVisible();
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith("/public_context/terrain_public_context_1000m.tif"),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      loadedUrls.some((url) => url.endsWith("/public_context/roads.geojson")),
    )
    .toBe(true);
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith("/public_context/hydrography_streams.geojson"),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith("/public_context/hydrography_lakes.geojson"),
      ),
    )
    .toBe(true);
  await expect(page.locator('[aria-label^="Scale "]')).toBeVisible();
  for (const label of [
    "Public terrain surface",
    "Public roads",
    "Public streams and rivers",
    "Public waterbodies",
  ]) {
    await ensureForgeLayerVisible(page, label);
  }
  const publicContextScene = await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  traverse: (
                    fn: (obj: {
                      visible: boolean;
                      name?: string;
                      position?: { x: number; y: number; z: number };
                      geometry?: {
                        computeBoundingBox?: () => void;
                        boundingBox?: {
                          min: { x: number; y: number; z: number };
                          max: { x: number; y: number; z: number };
                        } | null;
                        getAttribute?: (
                          name: string,
                        ) => { count: number } | undefined;
                      };
                      userData?: Record<string, unknown>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene?.manager;
    const terrain = manager?.getLayer?.("terrain");
    const roads = manager?.getLayer?.("transport-roads");
    const streams = manager?.getLayer?.("hydrography-streams");
    const water = manager?.getLayer?.("hydrography-lakes");
    const terrainBounds: number[] = [];
    terrain?.traverse((obj) => {
      if (terrainBounds.length > 0 || obj.name !== "terrain") return;
      obj.geometry?.computeBoundingBox?.();
      const box = obj.geometry?.boundingBox;
      const pos = obj.position ?? { x: 0, y: 0, z: 0 };
      if (box) {
        terrainBounds.push(
          box.min.x + pos.x,
          box.min.y + pos.y,
          box.max.x + pos.x,
          box.max.y + pos.y,
        );
      }
    });
    const countRenderableChildren = (
      layer:
        | {
            traverse: (
              fn: (obj: {
                visible: boolean;
                geometry?: {
                  getAttribute?: (
                    name: string,
                  ) => { count: number } | undefined;
                };
              }) => void,
            ) => void;
          }
        | undefined,
    ) => {
      let count = 0;
      layer?.traverse((obj) => {
        if (obj.visible && obj.geometry) count += 1;
      });
      return count;
    };
    return {
      terrainVisible: terrain?.visible ?? false,
      terrainBounds,
      roadObjects: countRenderableChildren(roads),
      streamObjects: countRenderableChildren(streams),
      waterObjects: countRenderableChildren(water),
    };
  });
  expect(publicContextScene.terrainVisible).toBe(true);
  expect(publicContextScene.terrainBounds[0]).toBeCloseTo(-697853.25, 0);
  expect(publicContextScene.terrainBounds[1]).toBeCloseTo(-569722.5, 0);
  expect(publicContextScene.terrainBounds[2]).toBeCloseTo(697853.25, 0);
  expect(publicContextScene.terrainBounds[3]).toBeCloseTo(569722.5, 0);
  expect(publicContextScene.roadObjects).toBeGreaterThan(0);
  expect(publicContextScene.streamObjects).toBeGreaterThan(0);
  expect(publicContextScene.waterObjects).toBeGreaterThan(0);
  await setForgeLayerVisible(page, "Public terrain surface", false);
  await expect(page.locator('[aria-label^="Scale "]')).toBeVisible();
  for (const label of [
    "Public roads",
    "Public streams and rivers",
    "Public waterbodies",
  ]) {
    await setForgeLayerVisible(page, label, false);
  }
  for (const label of [
    "3D MT top surface",
    "3D MT resistivity volume",
    "3D MT threshold surfaces",
    "2D MT station locations",
  ]) {
    await ensureForgeLayerVisible(page, label);
  }
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
  await expect(page.locator("body")).toContainText(
    "3D MT resistivity full-density model",
  );
  await expect(page.locator("body")).toContainText("3D MT resistivity preview");
  await expect(page.locator("body")).toContainText("Top surface");
  await expect(page.locator("body")).toContainText("Surface lift");
  await expect(page.locator("body")).toContainText("Wireframe");
  await expect(page.locator("body")).toContainText("Roughness");
  await expect(page.locator("body")).toContainText("Metalness");
  await expect(page.locator("body")).toContainText("Feather min");
  await expect(page.locator("body")).toContainText("Feather max");
  await expect(page.locator("body")).toContainText("Trim min");
  await expect(page.locator("body")).toContainText("Trim max");
  await expect(page.locator("body")).toContainText("Distance light");
  await expect(page.locator("body")).toContainText("Point size");
  await expect(page.locator("body")).toContainText("Value legend");
  await expect(page.locator("body")).toContainText("3D MT resistivity volume");
  await expect(page.locator("body")).toContainText("3D volume products");
  await expect(page.locator("body")).toContainText("3D cut window");
  await expect(page.locator("body")).toContainText("3D MT threshold surfaces");
  await expect(page.locator("body")).toContainText(
    "2D MT station response / QC",
  );
  await expect(page.getByTestId("mt-volume-product-select")).toHaveCount(1);
  await expect(page.getByTestId("mt-volume-opacity")).toHaveCount(1);
  await expect(
    page.getByTestId("mt-threshold-conductive-le-30-ohm-m"),
  ).toHaveCount(1);
  await expect(page.getByTestId("mt-station-qc-select")).toHaveCount(1);

  await expect
    .poll(() =>
      mtVolumeSceneState(page).then((state) => state.totalVolumeCount),
    )
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
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeOpacity: 0.51,
      scalarVolumeDensity: 0.88,
      scalarVolumeSampleSteps: 128,
      scalarVolumeTransferMode: "dense",
      scalarVolumeThresholdMin: -1.25,
      scalarVolumeThresholdMax: 3.75,
      scalarVolumeMaskVisible: true,
      scalarColorLow: "#2cc9ff",
      scalarColorMid: "#f8dd6d",
      scalarColorHigh: "#ff637a",
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      scalarMidpoint: 0.5,
      scalarContrast: 1.1,
      scalarLegendVisible: true,
      opacity: 0.51,
    });
    const threshold = manager?.getLayer?.(
      "utah-forge-mt-resistivity-threshold-surfaces",
    );
    if (threshold) threshold.visible = true;
    manager?.applyStyle?.("utah-forge-mt-resistivity-threshold-surfaces", {
      opacity: 0.44,
      mtThresholdSurfaceVisibility: {
        "conductive-le-10-ohm-m": false,
        "conductive-le-30-ohm-m": true,
        "resistive-ge-1000-ohm-m": true,
      },
      mtThresholdSurfaceWireframe: false,
    });
  });
  await expect
    .poll(() => mtVolumeSceneState(page))
    .toMatchObject({
      volumeLayerVisible: true,
      selectedProductId: "mt-resistivity-forge-focused-volume",
      visibleVolumeCount: 1,
      visibleProductIds: ["mt-resistivity-forge-focused-volume"],
      thresholdLayerVisible: true,
      visibleThresholdSurfaceIds: expect.arrayContaining([
        "conductive-le-30-ohm-m",
        "resistive-ge-1000-ohm-m",
      ]),
    });
  let mtVolumeState = await mtVolumeSceneState(page);
  expect(mtVolumeState.firstVisibleUniforms).toMatchObject({
    opacity: 0.51,
    density: 0.88,
    sampleSteps: 128,
    transferMode: 2,
    maskVisible: 1,
    thresholdMin: -1.25,
    thresholdMax: 3.75,
  });

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-full-extent-volume",
      scalarVolumeOpacity: 0.37,
      scalarVolumeDensity: 0.42,
      scalarVolumeSampleSteps: 72,
      scalarVolumeTransferMode: "soft",
      scalarVolumeThresholdMin: -2,
      scalarVolumeThresholdMax: 4.5,
      scalarVolumeMaskVisible: false,
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      opacity: 0.37,
    });
  });
  mtVolumeState = await mtVolumeSceneState(page);
  expect(mtVolumeState.visibleProductIds).toEqual([
    "mt-resistivity-full-extent-volume",
  ]);
  expect(mtVolumeState.firstVisibleUniforms).toMatchObject({
    opacity: 0.37,
    density: 0.42,
    sampleSteps: 72,
    transferMode: 0,
    maskVisible: 0,
  });

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-mt-resistivity-threshold-surfaces", {
      opacity: 0.35,
      mtThresholdSurfaceVisibility: {
        "conductive-le-10-ohm-m": true,
        "conductive-le-30-ohm-m": false,
        "resistive-ge-1000-ohm-m": true,
      },
      mtThresholdSurfaceWireframe: true,
    });
  });
  mtVolumeState = await mtVolumeSceneState(page);
  expect(mtVolumeState.visibleThresholdSurfaceIds).toEqual(
    expect.arrayContaining([
      "conductive-le-10-ohm-m",
      "resistive-ge-1000-ohm-m",
    ]),
  );
  expect(mtVolumeState.visibleThresholdSurfaceIds).not.toContain(
    "conductive-le-30-ohm-m",
  );
  expect(mtVolumeState.thresholdWireframe).toBe(true);

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-mt-resistivity-volume"],
      sceneSectionTargetProductIds: [],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        z: { enabled: true, positionM: -6000, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
  });
  await expect
    .poll(() =>
      mtVolumeSceneState(page).then(
        (state) => state.firstVisibleUniforms?.sceneSectionEnabled,
      ),
    )
    .toBe(1);
  expect((await mtVolumeSceneState(page)).firstVisibleUniforms).toMatchObject({
    sceneSectionPlaneCount: 1,
  });

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("geosee:mt-station-click", {
        detail: { stationId: "FRG19001" },
      }),
    );
  });
  await expect(page.getByTestId("mt-station-qc-select")).toHaveValue(
    "FRG19001",
  );
  await expect
    .poll(() =>
      mtVolumeSceneState(page).then((state) => state.selectedStationId),
    )
    .toBe("FRG19001");

  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          `/projects/utah-forge/${MT_FULL_DENSITY_MANIFEST_PATH.replace(
            "projects/utah-forge/",
            "",
          )}`,
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.includes(
          "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/tiles/",
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() => mtFullDensityPointSceneState(page), { timeout: 60_000 })
    .toMatchObject({
      layerVisible: true,
      pointObjects: mtFullDensityManifest.tiles.length,
      visiblePointObjects: mtFullDensityManifest.tiles.length,
      totalPointCount: expectedFullDensityPointCount,
      indexedVisiblePointCount: expectedFullDensityPointCount,
      firstTileId: mtFullDensityManifest.tiles[0].id,
      firstMaterial: {
        opacity: 0.3,
        size: 1,
        transparent: true,
        vertexColors: true,
      },
    });
  await expect
    .poll(() => utahForgeRuntimePresentationState(page), { timeout: 60_000 })
    .toMatchObject({
      activeRenderPresetId: "utah-forge-reference-cinematic-dark",
      rendererExposure: 1.08,
      clearColor: "#383838",
      sceneBackground: "#383838",
      fogColor: "#383838",
      fogDensity: 0.00008,
    });
  const mtFullDensityScene = await mtFullDensityPointSceneState(page);
  expect(mtFullDensityScene.scalarFocusVisibleCount).toBeGreaterThan(0);
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json",
        ),
      ),
    )
    .toBe(true);
  const topSurfaceMeshResponse = await page.request.get(
    "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json",
  );
  expect(topSurfaceMeshResponse.ok()).toBe(true);
  const topSurfaceMesh = await topSurfaceMeshResponse.json();
  expect(topSurfaceMesh.attributes?.scalarValues.length).toBeGreaterThan(10_000);
  expect(topSurfaceMesh.material?.note).toContain("full-density MT cell-center");
  expect(topSurfaceMesh.material?.note).not.toContain("scalar trim colors");
  expect(topSurfaceMesh.indices.length / 3).toBe(20_608);
  const topSurfaceStatsResponse = await page.request.get(
    "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_contact_surface/stats.json",
  );
  expect(topSurfaceStatsResponse.ok()).toBe(true);
  const topSurfaceStats = await topSurfaceStatsResponse.json();
  expect(topSurfaceStats.source?.fullDensityManifest).toContain(
    "full_density/manifest.json",
  );
  expect(topSurfaceStats.source?.fullDensityPointCount).toBe(1_094_624);
  expect(topSurfaceStats.gridSizeM).toBe(2_500);
  expect(topSurfaceStats.supportGrid.columns).toBe(113);
  expect(topSurfaceStats.supportGrid.rows).toBe(93);
  expect(topSurfaceStats.vertexCount).toBe(10_509);
  expect(topSurfaceStats.triangleCount).toBe(20_608);
  expect(topSurfaceStats.supportGrid.observedSupportNodeCount).toBe(2_164);
  expect(topSurfaceStats.supportGrid.inferredSupportNodeCount).toBe(8_345);
  expect(topSurfaceStats.sceneBounds.min[2]).toBeGreaterThan(1300);

  await setForgeLayerVisible(page, "3D MT resistivity volume", false);
  const legend = page
    .locator('[aria-label="Utah FORGE MT resistivity color legend"]')
    .filter({ hasText: "MT resistivity" })
    .first();
  await expect(legend).toBeVisible();
  await expect(page.getByTestId("resistivity-legend-edge-lower")).toBeVisible();
  await expect(page.getByTestId("resistivity-legend-edge-upper")).toBeVisible();
  const initialFocusMinValue = await page
    .getByTestId("resistivity-legend-focusMin")
    .getAttribute("aria-valuenow");
  const initialFocusMaxValue = await page
    .getByTestId("resistivity-legend-focusMax")
    .getAttribute("aria-valuenow");
  const beforeTrimCanvas = await page.locator("canvas").screenshot();

  const trackBox = await page
    .getByTestId("resistivity-legend-track")
    .boundingBox();
  const focusMinBox = await page
    .getByTestId("resistivity-legend-focusMin")
    .boundingBox();
  const focusMaxBox = await page
    .getByTestId("resistivity-legend-focusMax")
    .boundingBox();
  expect(trackBox).not.toBeNull();
  expect(focusMinBox).not.toBeNull();
  expect(focusMaxBox).not.toBeNull();
  if (trackBox && focusMinBox && focusMaxBox) {
    await page.mouse.move(
      focusMinBox.x + focusMinBox.width / 2,
      focusMinBox.y + focusMinBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(trackBox.x + trackBox.width * 0.54, trackBox.y + 8, {
      steps: 6,
    });
    await page.mouse.up();
    await expect
      .poll(() =>
        page
          .getByTestId("resistivity-legend-focusMin")
          .getAttribute("aria-valuenow"),
      )
      .not.toBe(initialFocusMinValue);

    const focusMaxBeforeKey = await page
      .getByTestId("resistivity-legend-focusMax")
      .getAttribute("aria-valuenow");
    await page.getByTestId("resistivity-legend-focusMax").press("ArrowLeft");
    await expect
      .poll(() =>
        page
          .getByTestId("resistivity-legend-focusMax")
          .getAttribute("aria-valuenow"),
      )
      .not.toBe(focusMaxBeforeKey);

    await page.mouse.move(
      focusMaxBox.x + focusMaxBox.width / 2,
      focusMaxBox.y + focusMaxBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(trackBox.x + trackBox.width * 0.78, trackBox.y + 8, {
      steps: 6,
    });
    await page.mouse.up();
    await expect
      .poll(() =>
        page
          .getByTestId("resistivity-legend-focusMax")
          .getAttribute("aria-valuenow"),
      )
      .not.toBe(initialFocusMaxValue);
    await expect(legend).toContainText("1.38 Ohm-m");
    await expect(legend).toContainText("8,652 Ohm-m");
  }

  const afterGlobalTrimCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(beforeTrimCanvas, afterGlobalTrimCanvas),
  ).toBeGreaterThan(1000);
  const globalLegendAfterDrag = await legend.innerText();
  await page.waitForTimeout(700);
  await expect.poll(() => legend.innerText()).toBe(globalLegendAfterDrag);
  const afterGlobalWaitCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(beforeTrimCanvas, afterGlobalWaitCanvas),
  ).toBeGreaterThan(1000);

  const beforeNoiseCanvas = await page.locator("canvas").screenshot();
  await page
    .getByTestId("resistivity-legend-edge-lower")
    .dispatchEvent("dblclick");
  await expect(
    page.getByTestId("resistivity-legend-edge-popout"),
  ).toBeVisible();
  await page
    .getByTestId("resistivity-legend-edge-highlight")
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "4.2");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .getByTestId("resistivity-legend-noise-threshold")
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "0.35");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .getByTestId("resistivity-legend-edge-average")
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "0.72");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .getByTestId("resistivity-legend-edge-fill-offset")
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "-0.55");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .getByTestId("resistivity-legend-edge-line-style")
    .selectOption("dashed");
  await expect(page.locator("body")).toContainText("Line 4.2px");
  await expect(page.locator("body")).toContainText("Avg 72%");
  await expect(page.locator("body")).toContainText("Fill -55%");
  await expect(page.locator("body")).toContainText("Noise 35%");
  await page.waitForTimeout(300);
  const afterNoiseCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(beforeNoiseCanvas, afterNoiseCanvas)).toBeGreaterThan(
    1000,
  );

  const currentPageRow = page
    .locator('[data-dev-note*="panelStyles.pageRow"]')
    .filter({ hasText: "01." });
  await expect(currentPageRow).toHaveCount(1);
  await currentPageRow.click();
  await page.waitForTimeout(100);

  const pageTrackBox = await page
    .getByTestId("resistivity-legend-track")
    .boundingBox();
  const pageFocusMinBox = await page
    .getByTestId("resistivity-legend-focusMin")
    .boundingBox();
  expect(pageTrackBox).not.toBeNull();
  expect(pageFocusMinBox).not.toBeNull();
  if (pageTrackBox && pageFocusMinBox) {
    const pageFocusMinBefore = await page
      .getByTestId("resistivity-legend-focusMin")
      .getAttribute("aria-valuenow");
    await page.mouse.move(
      pageFocusMinBox.x + pageFocusMinBox.width / 2,
      pageFocusMinBox.y + pageFocusMinBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      pageTrackBox.x + pageTrackBox.width * 0.44,
      pageTrackBox.y + 8,
      {
        steps: 6,
      },
    );
    await page.mouse.up();
    await expect
      .poll(() =>
        page
          .getByTestId("resistivity-legend-focusMin")
          .getAttribute("aria-valuenow"),
      )
      .not.toBe(pageFocusMinBefore);
    const pageLegendAfterDrag = await legend.innerText();
    await page.waitForTimeout(700);
    await expect.poll(() => legend.innerText()).toBe(pageLegendAfterDrag);
  }
  const afterPageTrimCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(afterGlobalWaitCanvas, afterPageTrimCanvas),
  ).toBeGreaterThan(1000);

  const beforeCameraTransitionCanvas = await page
    .locator("canvas")
    .screenshot();
  const secondPageRow = page
    .locator('[data-dev-note*="panelStyles.pageRow"]')
    .filter({ hasText: "02." });
  await expect(secondPageRow).toHaveCount(1);
  await secondPageRow.click();
  await page.waitForTimeout(450);
  const midCameraTransitionCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(beforeCameraTransitionCanvas, midCameraTransitionCanvas),
  ).toBeGreaterThan(1000);
  await page.waitForTimeout(3200);
  await expect(legend).toBeVisible();
  const afterCameraTransitionCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(midCameraTransitionCanvas, afterCameraTransitionCanvas),
  ).toBeGreaterThan(1000);

  expect(consoleErrors).toEqual([]);
});
