import { expect, test } from "@playwright/test";
import {
  changedByteCount,
  hidePublicContextLayers,
  mtVolumeSceneState,
  openForgeDataEditorContainers,
  openForgeMtResistivityEditorContainers,
  revealSeismicCapabilityProduct,
  sectionIsoSceneState,
  seismicSceneState,
} from "./shared";

test.setTimeout(900_000);

test("Utah FORGE MT scalar sections expose selectable ISO lines and bands", async ({
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
  await hidePublicContextLayers(page);

  await page.getByRole("button", { name: "Sections" }).click();
  await openForgeMtResistivityEditorContainers(page);
  const slicesLayerItem = page
    .locator('[data-dev-note*="layerItemStyle"]')
    .filter({ hasText: "2D MT resistivity slices" })
    .first();
  await expect(slicesLayerItem).toBeVisible();
  const slicesVisibility = slicesLayerItem
    .locator('input[type="checkbox"], button[aria-pressed]')
    .first();
  if ((await slicesVisibility.count()) > 0) {
    const tag = await slicesVisibility.evaluate((el) =>
      el.tagName.toLowerCase(),
    );
    if (tag === "input") {
      await slicesVisibility.setChecked(true);
    } else if ((await slicesVisibility.getAttribute("aria-pressed")) !== "true") {
      await slicesVisibility.click();
    }
  }

  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  userData?: Record<string, unknown>;
                }
              | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const layer = manager?.getLayer?.("utah-forge-mt-resistivity-slices");
    if (layer) layer.visible = true;
    manager?.applyStyle?.("utah-forge-mt-resistivity-slices", {
      opacity: 0.78,
      scalarColorLow: "#2cc9ff",
      scalarColorMid: "#f8dd6d",
      scalarColorHigh: "#ff637a",
      scalarBlendMin: 1.26,
      scalarBlendMax: 3.61,
      scalarDisplayMin: 1.26,
      scalarDisplayMax: 3.61,
      scalarFocusMin: -2,
      scalarFocusMax: 4.5,
      scalarMidpoint: 0.36,
      scalarContrast: 1.15,
      sectionIsoEnabled: false,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 2.6,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.32,
      sectionIsoFillOffset: 0,
    });
  });

  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => state.targets.length),
    )
    .toBeGreaterThan(0);
  const initialIsoState = await sectionIsoSceneState(page);
  expect(initialIsoState.targets.length).toBeGreaterThanOrEqual(2);
  expect(initialIsoState.targets.every((target) => target.visible)).toBe(true);
  expect(initialIsoState.lineOverlayCount).toBe(0);
  expect(initialIsoState.bandOverlayCount).toBe(0);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  const setInputValue = async (locator: Locator, value: string) => {
    await locator.evaluate((input, nextValue) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, nextValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await expect(
    slicesLayerItem.getByTestId("layer-isobands-controls"),
  ).toBeVisible();
  const sliceIsobandsToggle = slicesLayerItem.getByTestId(
    "layer-isobands-enabled",
  );
  await slicesLayerItem.getByTestId("mt-slice-mode").selectOption("stack");
  await sliceIsobandsToggle.setChecked(false);
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then(
        (state) => state.firstSourceOpacity ?? -1,
      ),
    )
    .toBeGreaterThan(0);
  const sourceOpacityBeforeIsobands =
    (await sectionIsoSceneState(page)).firstSourceOpacity ?? 1;
  expect((await sectionIsoSceneState(page)).lineOverlayCount).toBe(0);
  expect((await sectionIsoSceneState(page)).bandOverlayCount).toBe(0);
  await sliceIsobandsToggle.setChecked(true);
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => ({
        levelCount: state.firstBandUniforms?.levelCount ?? null,
        sourceOpacity: state.firstSourceOpacity,
        bandsReady: state.bandOverlayCount > 0,
      })),
    )
    .toEqual({
      levelCount: 32,
      sourceOpacity: 0,
      bandsReady: true,
    });
  const sourceOpacityInput = slicesLayerItem.getByTestId(
    "layer-isobands-source-opacity",
  );
  await expect(sourceOpacityInput).toBeVisible();
  await setInputValue(sourceOpacityInput, "0.35");
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => state.firstSourceOpacity),
    )
    .toBeCloseTo(sourceOpacityBeforeIsobands * 0.35, 2);
  await slicesLayerItem.getByTestId("layer-isobands-enabled").setChecked(false);
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => ({
        lines: state.lineOverlayCount,
        bands: state.bandOverlayCount,
        sourceOpacity: state.firstSourceOpacity,
      })),
    )
    .toEqual({
      lines: 0,
      bands: 0,
      sourceOpacity: sourceOpacityBeforeIsobands,
    });

  await expect(page.getByTestId("section-iso-legend")).toBeVisible();
  await expect(page.getByTestId("section-iso-configure")).toBeVisible();
  await page.getByTestId("section-iso-configure").click();
  await expect(page.getByTestId("section-iso-popout")).toBeVisible();
  await page.getByTestId("section-iso-popout-dataset").selectOption("mt-slices");
  const quickBandsToggle = page.getByTestId("section-iso-bands-quick");
  if ((await quickBandsToggle.getAttribute("aria-pressed")) !== "true") {
    await quickBandsToggle.click();
  }

  const activeIsoState = await sectionIsoSceneState(page);
  expect(activeIsoState.targets.length).toBeGreaterThanOrEqual(2);
  const disabledTarget = activeIsoState.targets[1];
  const disabledTargetToggle = page.getByTestId(
    `section-iso-target-${disabledTarget.sectionId}`,
  );
  await expect(disabledTargetToggle).toBeVisible();
  await disabledTargetToggle.setChecked(false);

  const setRange = async (testId: string, value: string) => {
    const input = page.getByTestId(testId);
    await expect(input).toBeVisible();
    await setInputValue(input, value);
  };
  await setRange("section-iso-level-count", "7");
  await setRange("section-iso-line-width", "5.5");
  await setRange("section-iso-band-opacity", "0.44");
  await setRange("section-iso-fill-offset", "-0.35");
  const lineStyleSelect = page.getByTestId("section-iso-line-style");
  await expect(lineStyleSelect).toBeVisible();
  await lineStyleSelect.selectOption("dashed");

  await expect(page.locator("body")).toContainText("Bands 7");
  await expect(page.locator("body")).toContainText("Line 5.5px");
  await expect(page.locator("body")).toContainText("Band 44%");
  await expect(page.locator("body")).toContainText("Fill -35%");

  await expect
    .poll(async () => {
      const state = await sectionIsoSceneState(page);
      return {
        bandOverlayCount: state.bandOverlayCount,
        disabledTargetHasOverlay: state.overlayTargets.includes(
          disabledTarget.targetKey,
        ),
      };
    })
    .toEqual({
      bandOverlayCount: activeIsoState.targets.length - 1,
      disabledTargetHasOverlay: false,
    });
  const enabledIsoState = await sectionIsoSceneState(page);
  expect(enabledIsoState.lineOverlayCount).toBeGreaterThan(0);
  expect(enabledIsoState.firstLineVertexCount).toBeGreaterThan(0);
  expect(enabledIsoState.firstBandUniforms).toMatchObject({
    levelCount: 7,
    opacity: 0.44,
    fillOffset: -0.35,
  });

  const bandsVisibleToggle = page.getByTestId("section-iso-bands-visible");
  await expect(bandsVisibleToggle).toBeVisible();
  await bandsVisibleToggle.setChecked(false);
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => state.bandOverlayCount),
    )
    .toBe(0);
  expect((await sectionIsoSceneState(page)).lineOverlayCount).toBeGreaterThan(
    0,
  );

  const quickLinesToggle = page.getByTestId("section-iso-lines-quick");
  await expect(quickLinesToggle).toBeVisible();
  if ((await quickLinesToggle.getAttribute("aria-pressed")) === "true") {
    await quickLinesToggle.click();
  }
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => ({
        lines: state.lineOverlayCount,
        bands: state.bandOverlayCount,
      })),
    )
    .toEqual({ lines: 0, bands: 0 });

  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE section ISO supports seismic sections and MT volume cuts", async ({
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
  await hidePublicContextLayers(page);
  await openForgeDataEditorContainers(page);
  const seismicSectionProductId = "gdr-1141-line-301-pdm-enh";
  await page.getByTestId("seismic-capability-line-301-theatre").click();
  await expect
    .poll(
      () => seismicSceneState(page).then((state) => state.visibleSections),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);

  const seismicMtSectionProductId = "gdr-1141-forge3d-ani-psdm-stack-unenh";
  await page.evaluate(async (productId) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  userData?: Record<string, unknown>;
                }
              | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (seismic) seismic.visible = true;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: productId,
      seismicProductVisibility: {
        [productId]: true,
      },
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceFraction: 0.5,
      seismicAmplitudeMin: 0.08,
      seismicAmplitudeMax: 0.92,
      seismicAmplitudeGamma: 1,
      seismicColormap: "blue-white-red",
      seismicRemoveBackground: true,
      seismicBackgroundCutoff: 0.16,
      sectionIsoEnabled: false,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 2.6,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.32,
      sectionIsoFillOffset: 0,
      opacity: 0.68,
    });
  }, seismicMtSectionProductId);
  await expect
    .poll(
      () => seismicSceneState(page).then((state) => state.visibleSections),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-sections").then(
        (state) => state.targets.length,
      ),
    )
    .toBeGreaterThan(0);
  const seismicBaseVisibility = await seismicSceneState(page);
  expect(seismicBaseVisibility.visibleSections).toBeGreaterThan(0);
  expect(
    (await sectionIsoSceneState(page, "seismic-sections")).lineOverlayCount,
  ).toBe(0);

  await page.evaluate(async (productId) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: productId,
      seismicProductVisibility: {
        [productId]: true,
      },
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceFraction: 0.5,
      seismicAmplitudeMin: 0.08,
      seismicAmplitudeMax: 0.92,
      seismicAmplitudeGamma: 1.25,
      seismicColormap: "velocity",
      seismicRemoveBackground: true,
      seismicBackgroundCutoff: 0.16,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 6,
      sectionIsoLineWidth: 4.2,
      sectionIsoLineStyle: "dashed",
      sectionIsoBandOpacity: 0.41,
      sectionIsoFillOffset: 0.2,
      opacity: 0.68,
    });
  }, seismicMtSectionProductId);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-sections").then((state) => ({
        lines: state.lineOverlayCount,
        bands: state.bandOverlayCount,
        opacity: state.firstBandUniforms?.opacity ?? null,
        levelCount: state.firstBandUniforms?.levelCount ?? null,
      })),
    )
    .toMatchObject({
      lines: expect.any(Number),
      bands: expect.any(Number),
      opacity: 0.41,
      levelCount: 6,
    });
  const seismicIsoState = await sectionIsoSceneState(page, "seismic-sections");
  expect(seismicIsoState.lineOverlayCount).toBeGreaterThan(0);
  expect(seismicIsoState.bandOverlayCount).toBeGreaterThan(0);
  expect((await seismicSceneState(page)).visibleSections).toBe(
    seismicBaseVisibility.visibleSections,
  );

  const disabledSeismicTarget = seismicIsoState.overlayTargets[0];
  await page.evaluate((targetKey) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: targetKey.productId,
      seismicProductVisibility: {
        [targetKey.productId]: true,
      },
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceFraction: 0.5,
      seismicAmplitudeMin: 0.08,
      seismicAmplitudeMax: 0.92,
      seismicAmplitudeGamma: 1.25,
      seismicColormap: "velocity",
      seismicRemoveBackground: true,
      seismicBackgroundCutoff: 0.16,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoTargetIds: { [targetKey.targetId]: false },
      sectionIsoLevelCount: 6,
      sectionIsoLineWidth: 4.2,
      sectionIsoLineStyle: "dashed",
      sectionIsoBandOpacity: 0.41,
      sectionIsoFillOffset: 0.2,
      opacity: 0.68,
    });
  }, { targetId: disabledSeismicTarget, productId: seismicMtSectionProductId });
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-sections").then((state) =>
        state.overlayTargets.includes(disabledSeismicTarget),
      ),
    )
    .toBe(false);

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
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  userData?: Record<string, unknown>;
                }
              | undefined;
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
      sectionIsoTargetIds: {},
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
  const volumeIsoState = await sectionIsoSceneState(page, "mt-volume-cuts");
  expect(volumeIsoState.lineOverlayCount).toBeGreaterThan(0);
  expect(volumeIsoState.bandOverlayCount).toBeGreaterThan(0);
  expect(volumeIsoState.firstLineMaterial).toMatchObject({
    depthTest: false,
    depthWrite: false,
    surfaceRenderPolicy: "section-iso-overlay",
  });
  expect(volumeIsoState.firstBandMaterial).toMatchObject({
    depthTest: true,
    depthWrite: false,
    surfaceRenderPolicy: "section-iso-overlay",
  });
  expect(volumeIsoState.firstLineMaterial?.renderOrder ?? 0).toBeGreaterThan(
    volumeIsoState.firstBandMaterial?.renderOrder ?? 0,
  );
  expect(volumeIsoState.firstBandMaterial?.renderOrder ?? 0).toBeGreaterThan(
    13.2,
  );
  expect(
    volumeIsoState.firstLineGeometryMetrics?.sourceSegmentCount ?? 0,
  ).toBeGreaterThan(0);
  expect(
    volumeIsoState.firstLineGeometryMetrics?.polylineCount ?? 0,
  ).toBeGreaterThan(0);
  expect(
    volumeIsoState.firstLineGeometryMetrics?.polylineCount ?? Number.MAX_VALUE,
  ).toBeLessThan(
    volumeIsoState.firstLineGeometryMetrics?.sourceSegmentCount ?? 0,
  );
  expect(
    volumeIsoState.firstLineGeometryMetrics?.tinySegmentCount ?? 0,
  ).toBeLessThan(
    volumeIsoState.firstLineGeometryMetrics?.sourceSegmentCount ?? 1,
  );
  await page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          camera?: {
            position: { set: (x: number, y: number, z: number) => void };
          };
          controls?: {
            target: { set: (x: number, y: number, z: number) => void };
            update: () => void;
          };
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene;
    const threshold = sceneHandle?.manager?.getLayer?.(
      "utah-forge-mt-resistivity-threshold-surfaces",
    );
    if (threshold) threshold.visible = true;
    sceneHandle?.manager?.applyStyle?.(
      "utah-forge-mt-resistivity-threshold-surfaces",
      {
        opacity: 0.86,
        mtIsosurfaceProductId: "mt-isosurface-forge-focused",
        mtThresholdSurfaceVisibility: {
          "conductive-le-10-ohm-m": false,
          "conductive-le-30-ohm-m": true,
          "resistive-ge-1000-ohm-m": true,
        },
        mtThresholdSurfaceWireframe: false,
        mtThresholdSurfaceSide: "double",
      },
    );
    sceneHandle?.camera?.position.set(-92_000, 158_000, 46_000);
    sceneHandle?.controls?.target.set(-4_000, -6_000, -18_000);
    sceneHandle?.controls?.update();
  });
  await expect
    .poll(() =>
      mtVolumeSceneState(page).then((state) => ({
        thresholdLayerVisible: state.thresholdLayerVisible,
        thresholdDepthWrite: state.thresholdMaterial?.depthWrite,
        thresholdDepthTest: state.thresholdMaterial?.depthTest,
      })),
    )
    .toEqual({
      thresholdLayerVisible: true,
      thresholdDepthWrite: false,
      thresholdDepthTest: true,
    });
  await page.waitForTimeout(900);
  const occludedIsoState = await sectionIsoSceneState(page, "mt-volume-cuts");
  const occludedLineMaterial = occludedIsoState.firstLineMaterial;
  if (occludedLineMaterial) {
    expect(occludedLineMaterial.baseOpacity).toBeCloseTo(0.96, 2);
    expect(occludedLineMaterial.transitionOpacity ?? 1).toBeGreaterThan(0.99);
    expect(occludedLineMaterial.thresholdAttenuation ?? 1).toBeGreaterThan(0);
    expect(occludedLineMaterial.thresholdAttenuation ?? 1).toBeLessThanOrEqual(
      1,
    );
    expect(occludedLineMaterial.opacity ?? 0).toBeCloseTo(
      occludedLineMaterial.composedOpacity ?? 0,
      4,
    );
    expect(occludedLineMaterial.composedOpacity ?? 0).toBeCloseTo(
      (occludedLineMaterial.baseOpacity ?? 1) *
        (occludedLineMaterial.transitionOpacity ?? 1) *
        (occludedLineMaterial.thresholdAttenuation ?? 1),
      3,
    );
  }
  const settledBeforeMoveCanvas = await page.locator("canvas").screenshot();
  await page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          camera?: {
            position: { set: (x: number, y: number, z: number) => void };
          };
          controls?: { update: () => void };
        };
      }
    ).__scene;
    sceneHandle?.camera?.position.set(-99_000, 151_000, 50_000);
    sceneHandle?.controls?.update();
  });
  await page.waitForTimeout(150);
  const movingCanvas = await page.locator("canvas").screenshot();
  expect(
    changedByteCount(settledBeforeMoveCanvas, movingCanvas),
  ).toBeGreaterThan(200);
  await page.waitForTimeout(1_600);
  const settledAfterMoveCanvasA = await page.locator("canvas").screenshot();
  const settledIsoStateA = await sectionIsoSceneState(page, "mt-volume-cuts");
  await page.waitForTimeout(700);
  const settledAfterMoveCanvasB = await page.locator("canvas").screenshot();
  const settledIsoStateB = await sectionIsoSceneState(page, "mt-volume-cuts");
  expect(
    changedByteCount(settledAfterMoveCanvasA, settledAfterMoveCanvasB),
  ).toBeLessThan(
    Math.max(5_000, Math.floor(settledAfterMoveCanvasA.length * 0.9)),
  );
  expect(settledIsoStateB.firstLineMaterial?.thresholdOcclusionCount).toBe(
    settledIsoStateA.firstLineMaterial?.thresholdOcclusionCount,
  );
  expect(
    Math.abs(
      (settledIsoStateB.firstLineMaterial?.composedOpacity ?? 0) -
        (settledIsoStateA.firstLineMaterial?.composedOpacity ?? 0),
    ),
  ).toBeLessThan(0.03);
  expect(volumeIsoState.firstBandUniforms).toMatchObject({
    opacity: 0.36,
    fillOffset: -0.15,
  });
  if ((await page.getByTestId("section-iso-legend").count()) > 0) {
    await expect(page.getByTestId("section-iso-legend")).toBeVisible();
    await page.getByTestId("section-iso-configure").click();
    await expect(page.getByTestId("section-iso-popout-dataset")).toBeVisible();
  }

  const disabledVolumeTarget = volumeIsoState.overlayTargets[0];
  await page.evaluate((targetKey) => {
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
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeOpacity: 0.48,
      scalarVolumeDensity: 0.78,
      scalarVolumeSampleSteps: 96,
      scalarVolumeTransferMode: "balanced",
      scalarVolumeThresholdMin: -2,
      scalarVolumeThresholdMax: 4.5,
      scalarVolumeMaskVisible: true,
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoTargetIds: { [targetKey]: false },
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 3.2,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.36,
      sectionIsoFillOffset: -0.15,
      opacity: 0.48,
    });
  }, disabledVolumeTarget);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "mt-volume-cuts").then((state) =>
        state.overlayTargets.includes(disabledVolumeTarget),
      ),
    )
    .toBe(false);

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
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (seismic) seismic.visible = true;
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
        z: { enabled: true, positionM: -4500, invert: false },
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
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoTargetIds: {},
      sectionIsoLevelCount: 5,
      sectionIsoLineWidth: 3.2,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.36,
      sectionIsoFillOffset: -0.15,
      opacity: 0.48,
    });
  });
  await revealSeismicCapabilityProduct(
    page,
    "gdr-1141-forge3d-ani-psdm-stack-unenh",
  );
  await page
    .getByTestId("seismic-capability-volume-gdr-1141-forge3d-ani-psdm-stack-unenh")
    .click();
  await expect
    .poll(
      () => seismicSceneState(page).then((state) => state.visibleVolumes),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
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
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (seismic) seismic.visible = true;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-phase3-seismic-browser"],
      sceneSectionTargetProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: -10000, invert: false },
        z: { enabled: true, positionM: -1000, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      seismicRenderMode: "raymarch",
      seismicSliceAxis: "inline",
      seismicSliceFraction: 0.5,
      seismicAmplitudeMin: 0.08,
      seismicAmplitudeMax: 0.92,
      seismicAmplitudeGamma: 1.15,
      seismicColormap: "blue-white-red",
      seismicRemoveBackground: true,
      seismicBackgroundCutoff: 0.16,
      seismicVolumeSampleSteps: 96,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 32,
      sectionIsoLineWidth: 3.4,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.38,
      sectionIsoFillOffset: 0.1,
      sectionIsoSourceOpacity: 0,
      opacity: 0.68,
    });
  });
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-volume-cuts").then((state) => ({
        targets: state.targets.length,
        linesReady: state.lineOverlayCount > 0,
        bandsReady: state.bandOverlayCount > 0,
        levelCount: state.firstBandUniforms?.levelCount ?? null,
        sourceOpacity: state.firstSourceOpacity,
      })),
    )
    .toEqual({
      targets: 3,
      linesReady: true,
      bandsReady: true,
      levelCount: 32,
      sourceOpacity: 0,
    });
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
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (seismic) seismic.visible = true;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-phase3-seismic-browser"],
      sceneSectionTargetProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: -10000, invert: false },
        z: { enabled: true, positionM: -500, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      seismicRenderMode: "raymarch",
      seismicAmplitudeMin: 0.08,
      seismicAmplitudeMax: 0.92,
      seismicAmplitudeGamma: 1.15,
      seismicColormap: "blue-white-red",
      seismicRemoveBackground: true,
      seismicBackgroundCutoff: 0.16,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoLevelCount: 32,
      sectionIsoLineWidth: 3.4,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.38,
      sectionIsoFillOffset: 0.1,
      sectionIsoSourceOpacity: 0,
      opacity: 0.68,
    });
  });
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-volume-cuts").then((state) =>
        state.overlayPlanePositions.some(
          (position) => Math.abs(position - -500) < 1,
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(async (productId) => {
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
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    if (seismic) seismic.visible = true;
    if (volume) volume.visible = true;
    const ensureProductsLoaded = seismic?.userData
      ?.seismicEnsureProductsLoaded as
      | ((productIds: string[], tier?: "coarse" | "standard" | "source") => Promise<void>)
      | undefined;
    await ensureProductsLoaded?.([productId], "standard");
    if (seismic) seismic.visible = true;
    if (volume) volume.visible = true;
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeThresholdMin: -2,
      scalarVolumeThresholdMax: 4.5,
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoMin: -2,
      sectionIsoMax: 4.5,
      sectionIsoLevelCount: 7,
      sectionIsoLineWidth: 2.8,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.34,
      sectionIsoFillOffset: 0.05,
      opacity: 0.42,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: productId,
      seismicProductVisibility: {
        [productId]: true,
      },
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceFraction: 0.5,
      seismicIsoSource: "mt-resistivity",
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoMin: -2,
      sectionIsoMax: 4.5,
      sectionIsoLevelCount: 7,
      sectionIsoLineWidth: 2.8,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.34,
      sectionIsoFillOffset: 0.05,
      sectionIsoSourceOpacity: 0,
      opacity: 0.68,
    });
  }, seismicSectionProductId);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "resistivity-on-seismic-sections").then(
        (state) =>
          state.targets.some((target) =>
            target.targetKey.includes(seismicMtSectionProductId),
          ),
      ),
    )
    .toBe(true);
  await page.evaluate((productId) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
            updateSeismicResistivityIsoOverlays?: (
              style: Record<string, unknown>,
            ) => void;
          };
        };
      }
    ).__scene?.manager;
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    if (volume) volume.visible = true;
    const style = {
      seismicProductId: productId,
      seismicProductVisibility: {
        [productId]: true,
      },
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceFraction: 0.5,
      seismicIsoSource: "mt-resistivity",
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoMin: -2,
      sectionIsoMax: 4.5,
      sectionIsoLevelCount: 7,
      sectionIsoLineWidth: 2.8,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.34,
      sectionIsoFillOffset: 0.05,
      sectionIsoSourceOpacity: 0,
      opacity: 0.68,
    };
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", style);
    if (seismic) seismic.visible = true;
    manager?.updateSeismicResistivityIsoOverlays?.(style);
  }, seismicMtSectionProductId);
  await expect
    .poll(async () => {
      await page.evaluate(async (productId) => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                getLayer?: (id: string) =>
                  | {
                      visible: boolean;
                      userData?: Record<string, unknown>;
                      traverse?: (
                        fn: (obj: {
                          visible: boolean;
                          userData?: Record<string, unknown>;
                        }) => void,
                      ) => void;
                    }
                  | undefined;
                applyStyle?: (
                  id: string,
                  style: Record<string, unknown>,
                ) => void;
                updateSeismicResistivityIsoOverlays?: (
                  style: Record<string, unknown>,
                ) => void;
              };
            };
          }
        ).__scene?.manager;
        const seismic = manager?.getLayer?.(
          "utah-forge-phase3-seismic-browser",
        );
        const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
        if (volume) volume.visible = true;
        let seismicRoot:
          | {
              visible: boolean;
              userData?: Record<string, unknown>;
              traverse?: (
                fn: (obj: {
                  visible: boolean;
                  userData?: Record<string, unknown>;
                }) => void,
              ) => void;
            }
          | undefined;
        seismic?.traverse?.((obj) => {
          if (!seismicRoot && obj.userData?.seismicBrowser === true) {
            seismicRoot = obj;
          }
        });
        const ensureProductsLoaded = (seismicRoot?.userData ?? seismic?.userData)
          ?.seismicEnsureProductsLoaded as
          | ((productIds: string[], tier?: "coarse" | "standard" | "source") => Promise<void>)
          | undefined;
        await ensureProductsLoaded?.([productId], "standard");
        const style = {
          seismicProductId: productId,
          seismicProductVisibility: {
            [productId]: true,
          },
          seismicRenderMode: "slice",
          seismicSliceAxis: "line",
          seismicSliceFraction: 0.5,
          seismicIsoSource: "mt-resistivity",
          sectionIsoEnabled: true,
          sectionIsoLinesVisible: true,
          sectionIsoBandsVisible: true,
          sectionIsoMin: -2,
          sectionIsoMax: 4.5,
          sectionIsoLevelCount: 7,
          sectionIsoLineWidth: 2.8,
          sectionIsoLineStyle: "solid",
          sectionIsoBandOpacity: 0.34,
          sectionIsoFillOffset: 0.05,
          sectionIsoSourceOpacity: 0,
          opacity: 0.68,
        };
        if (seismic) seismic.visible = true;
        (seismicRoot ?? seismic)?.traverse?.((obj: {
          visible: boolean;
          userData?: Record<string, unknown>;
        }) => {
          if (obj.userData?.seismicSection !== true) return;
          obj.visible = obj.userData.seismicProductId === productId;
        });
        manager?.updateSeismicResistivityIsoOverlays?.(style);
      }, seismicMtSectionProductId);
      return sectionIsoSceneState(page, "resistivity-on-seismic-sections").then(
        (state) => ({
          targetsReady: state.targets.length > 0,
          linesReady: state.lineOverlayCount > 0,
          bandsReady: state.bandOverlayCount > 0,
          isoMin: state.firstBandUniforms?.isoMin ?? null,
          isoMax: state.firstBandUniforms?.isoMax ?? null,
          source: state.overlaySources[0] ?? null,
          sourceLayer: state.overlaySourceLayerIds[0] ?? null,
          targetSource: state.targets[0]?.isoSource ?? null,
          targetSourceLayer: state.targets[0]?.sourceLayerId ?? null,
        }),
      );
    })
    .toEqual({
      targetsReady: true,
      linesReady: true,
      bandsReady: true,
      isoMin: -2,
      isoMax: 4.5,
      source: "mt-resistivity",
      sourceLayer: "utah-forge-mt-resistivity-volume",
      targetSource: "mt-resistivity",
      targetSourceLayer: "utah-forge-mt-resistivity-volume",
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
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-phase3-seismic-browser"],
      sceneSectionTargetProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: -10000, invert: false },
        z: { enabled: true, positionM: -500, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      seismicRenderMode: "raymarch",
      seismicSliceAxis: "inline",
      seismicSliceFraction: 0.5,
      seismicIsoSource: "mt-resistivity",
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoMin: -2,
      sectionIsoMax: 4.5,
      sectionIsoLevelCount: 7,
      sectionIsoLineWidth: 2.8,
      sectionIsoLineStyle: "solid",
      sectionIsoBandOpacity: 0.34,
      sectionIsoFillOffset: 0.05,
      sectionIsoSourceOpacity: 0,
      opacity: 0.68,
    });
  });
  await expect
    .poll(() =>
      sectionIsoSceneState(
        page,
        "resistivity-on-seismic-volume-cuts",
      ).then((state) => ({
        targets: state.targets.length,
        linesReady: state.lineOverlayCount > 0,
        bandsReady: state.bandOverlayCount > 0,
        isoMin: state.firstBandUniforms?.isoMin ?? null,
        isoMax: state.firstBandUniforms?.isoMax ?? null,
        source: state.overlaySources[0] ?? null,
        sourceLayer: state.overlaySourceLayerIds[0] ?? null,
        amplitudeOverlayCount: 0,
      })),
    )
    .toEqual({
      targets: 3,
      linesReady: true,
      bandsReady: true,
      isoMin: -2,
      isoMax: 4.5,
      source: "mt-resistivity",
      sourceLayer: "utah-forge-mt-resistivity-volume",
      amplitudeOverlayCount: 0,
    });
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-volume-cuts").then(
        (state) => state.lineOverlayCount + state.bandOverlayCount,
      ),
    )
    .toBe(0);

  const disabledResistivityTarget = (
    await sectionIsoSceneState(page, "resistivity-on-seismic-volume-cuts")
  ).overlayTargets[0];
  await page.evaluate((targetKey) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      seismicRenderMode: "raymarch",
      seismicIsoSource: "mt-resistivity",
      sectionIsoEnabled: true,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
      sectionIsoMin: -2,
      sectionIsoMax: 4.5,
      sectionIsoTargetIds: { [targetKey]: false },
    });
  }, disabledResistivityTarget);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "resistivity-on-seismic-volume-cuts").then(
        (state) => ({
          removed: !state.overlayTargets.includes(disabledResistivityTarget),
          remaining: state.overlayTargets.length,
        }),
      ),
    )
    .toEqual({
      removed: true,
      remaining: 2,
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
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      sectionIsoEnabled: false,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicRenderMode: "slice",
      sectionIsoEnabled: false,
      seismicIsoSource: "seismic-amplitude",
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
    });
  });
  await expect
    .poll(() =>
      Promise.all([
        sectionIsoSceneState(page, "mt-volume-cuts"),
        sectionIsoSceneState(page, "seismic-sections"),
        sectionIsoSceneState(page, "seismic-volume-cuts"),
        sectionIsoSceneState(page, "resistivity-on-seismic-sections"),
        sectionIsoSceneState(page, "resistivity-on-seismic-volume-cuts"),
      ]).then(
        ([
          volumeState,
          seismicState,
          seismicVolumeState,
          resistivitySectionState,
          resistivityVolumeState,
        ]) => ({
        volumeLines: volumeState.lineOverlayCount,
        volumeBands: volumeState.bandOverlayCount,
        seismicLines: seismicState.lineOverlayCount,
        seismicBands: seismicState.bandOverlayCount,
        seismicVolumeLines: seismicVolumeState.lineOverlayCount,
        seismicVolumeBands: seismicVolumeState.bandOverlayCount,
        resistivitySectionLines: resistivitySectionState.lineOverlayCount,
        resistivitySectionBands: resistivitySectionState.bandOverlayCount,
        resistivityVolumeLines: resistivityVolumeState.lineOverlayCount,
        resistivityVolumeBands: resistivityVolumeState.bandOverlayCount,
      }),
      ),
    )
    .toEqual({
      volumeLines: 0,
      volumeBands: 0,
      seismicLines: 0,
      seismicBands: 0,
      seismicVolumeLines: 0,
      seismicVolumeBands: 0,
      resistivitySectionLines: 0,
      resistivitySectionBands: 0,
      resistivityVolumeLines: 0,
      resistivityVolumeBands: 0,
    });

  expect(consoleErrors).toEqual([]);
});
