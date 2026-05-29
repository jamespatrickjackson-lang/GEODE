import { expect, test, type Locator } from "@playwright/test";
import {
  changedByteCount,
  forgeLayerItem,
  openForgeTopoEditorContainers,
  setForgeLayerVisible,
  terrainMaterialSceneState,
  tinyPdfBase64,
  titleBlockSceneState,
  topoGraticuleSceneState,
} from "./shared";

test.setTimeout(900_000);

test("Utah FORGE topo editor exposes surface elevation coloring", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
  await setForgeLayerVisible(page, "Topo Surface", true);

  await expect(page.getByTestId("topo-material-preset")).toContainText(
    "Surface elevation",
  );
  await page.getByTestId("topo-material-preset").selectOption("soft-topo");
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationEnabled,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationColors,
      ),
    )
    .toEqual(["#4d5a4e", "#758067", "#a99a76", "#d0bd8f", "#f1e2ad"]);
  const beforeCanvas = await page.locator("canvas").screenshot();

  await page
    .getByTestId("topo-material-preset")
    .selectOption("surface-elevation");
  await expect(
    page.getByTestId("topo-surface-elevation-enabled"),
  ).toBeChecked();
  await expect(page.getByTestId("topo-surface-elevation-min")).toHaveValue(
    "1500",
  );
  await expect(page.getByTestId("topo-surface-elevation-max")).toHaveValue(
    "3500",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      materialCount: 1,
      surfaceElevationEnabled: 1,
      surfaceElevationMinM: 1500,
      surfaceElevationMaxM: 3500,
      surfaceElevationReverse: 0,
      elevationOffsetM: 0,
      surfaceElevationColors: [
        "#5147b8",
        "#2e8fd8",
        "#4fc3c7",
        "#93d66b",
        "#fff24d",
      ],
      surfaceElevationPositions: [0, 0.25, 0.5, 0.75, 1],
      surfaceElevationMidpoints: [0.5, 0.5, 0.5, 0.5],
      surfaceElevationTransitionSoftness: 1,
      surfaceElevationColorBlend: 1,
    });
  const proceduralPalettes = [
    {
      preset: "soft-topo",
      colors: ["#4d5a4e", "#758067", "#a99a76", "#d0bd8f", "#f1e2ad"],
    },
    {
      preset: "desert-relief",
      colors: ["#5b4130", "#8b6240", "#bf8f54", "#dec37a", "#f4e6aa"],
    },
    {
      preset: "paper-map",
      colors: ["#716b5b", "#928c74", "#b7ad8a", "#d8cfa7", "#efe6c6"],
    },
    {
      preset: "grey-relief",
      colors: ["#3f4243", "#666b6c", "#909494", "#b8b8b2", "#dedbd2"],
    },
    {
      preset: "high-contrast",
      colors: ["#251b2f", "#5d2e54", "#9d5544", "#d89a42", "#fff0a3"],
    },
  ];
  for (const { preset, colors } of proceduralPalettes) {
    await page.getByTestId("topo-material-preset").selectOption(preset);
    await expect
      .poll(() =>
        terrainMaterialSceneState(page).then((state) => ({
          enabled: state.surfaceElevationEnabled,
          colors: state.surfaceElevationColors,
        })),
      )
      .toEqual({ enabled: 1, colors });
  }
  await page
    .getByTestId("topo-material-preset")
    .selectOption("surface-elevation");

  await expect(page.getByTestId("topo-surface-gradient-rail")).toBeVisible();
  const enabledCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(beforeCanvas, enabledCanvas)).toBeGreaterThan(1000);

  await page.getByTestId("topo-surface-elevation-reverse").setChecked(true);
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationReverse,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationReverse,
      ),
    )
    .toBe(1);

  await page.getByTestId("topo-material-preset").selectOption("soft-topo");
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationEnabled,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationColors,
      ),
    )
    .toEqual(["#4d5a4e", "#758067", "#a99a76", "#d0bd8f", "#f1e2ad"]);
  const restoredCanvas = await page.locator("canvas").screenshot();
  expect(restoredCanvas.length).toBeGreaterThan(1000);

  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE topo editor exposes ortho photo terrain material", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.getByTestId("topo-material-preset")).toContainText(
    "Ortho photo",
  );
  await expect(page.getByTestId("topo-material-preset")).toContainText(
    "NAIP 2024 Aerial Image",
  );
  const beforeCanvas = await page.locator("canvas").screenshot();
  await page.getByTestId("topo-material-preset").selectOption("ortho-photo");
  await expect(page.getByTestId("topo-material-preset")).toHaveValue(
    "ortho-photo",
  );
  await expect(page.getByTestId("topo-ortho-photo-texture-budget")).toHaveValue(
    "4096",
  );
  await expect(page.getByTestId("topo-ortho-photo-opacity")).toHaveValue("1");
  await expect(page.getByTestId("topo-ortho-photo-hillshade")).toHaveValue(
    "0.45",
  );

  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      materialCount: 1,
      surfaceElevationEnabled: 0,
      orthoPhotoEnabled: 1,
      orthoPhotoOpacity: 1,
      orthoPhotoHillshadeBlend: 0.45,
      orthoPhotoBrightness: 0,
      orthoPhotoContrast: 1,
      orthoPhotoSaturation: 1,
    });
  const orthoCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(beforeCanvas, orthoCanvas)).toBeGreaterThan(1000);

  await page
    .getByTestId("topo-ortho-photo-texture-budget")
    .selectOption("4096");
  await expect(page.getByTestId("topo-ortho-photo-texture-budget")).toHaveValue(
    "4096",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      materialCount: 1,
      orthoPhotoEnabled: 1,
      orthoPhotoOpacity: 1,
    });

  await page
    .getByTestId("topo-material-preset")
    .selectOption("image:naip-2024-aerial");
  await expect(page.getByTestId("topo-material-preset")).toHaveValue(
    "image:naip-2024-aerial",
  );
  await expect(page.getByTestId("topo-ortho-photo-texture-budget")).toHaveValue(
    "4096",
  );
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.orthoPhotoTextureSrc ?? "",
      ),
    )
    .toContain("naip_2024_beauty_4096.webp");
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.topoImageDetailTextureSrc ?? "",
      ),
    )
    .toContain("naip_2024_forge_detail_4096.webp");
  await page
    .getByTestId("topo-ortho-photo-texture-budget")
    .selectOption("8192");
  await expect(page.getByTestId("topo-ortho-photo-texture-budget")).toHaveValue(
    "8192",
  );
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.orthoPhotoTextureSrc ?? "",
      ),
    )
    .toContain("naip_2024_beauty_8192.webp");
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.topoImageDetailTextureSrc ?? "",
      ),
    )
    .toContain("naip_2024_forge_detail_8192.webp");
  const naipState = await terrainMaterialSceneState(page);
  expect(naipState).toMatchObject({
    materialCount: 1,
    orthoPhotoEnabled: 1,
    orthoPhotoOpacity: 1,
    orthoPhotoHillshadeBlend: 0.12,
    orthoPhotoBrightness: 0.08,
    orthoPhotoContrast: 1.28,
    orthoPhotoSaturation: 1.18,
    orthoPhotoTextureSize: { width: 8192, height: 3161 },
    topoImageDetailEnabled: 1,
    topoImageDetailTextureSize: { width: 8192, height: 8192 },
  });
  expect(naipState.orthoPhotoTextureSrc ?? "").not.toContain(
    "ortho_photo_context",
  );
  expect(naipState.orthoPhotoBoundsMin?.x).toBeCloseTo(-110351.55, 4);
  expect(naipState.orthoPhotoBoundsMin?.y).toBeCloseTo(-52998.5, 4);
  expect(naipState.orthoPhotoBoundsMax?.x).toBeCloseTo(44182.65, 4);
  expect(naipState.orthoPhotoBoundsMax?.y).toBeCloseTo(6625.3, 4);

  await page.getByTestId("topo-surface-elevation-enabled").setChecked(true);
  await expect(page.getByTestId("topo-material-preset")).toHaveValue(
    "image:naip-2024-aerial",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      surfaceElevationEnabled: 1,
      orthoPhotoEnabled: 1,
    });

  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE topo editor exposes surface elevation gradient controls", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
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
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  const dragGradientHandleToPercent = async (
    handle: Locator,
    percent: number,
  ) => {
    const rail = page.getByTestId("topo-surface-gradient-rail");
    await handle.scrollIntoViewIfNeeded();
    const railBox = await rail.boundingBox();
    const handleBox = await handle.boundingBox();
    if (!railBox || !handleBox) throw new Error("Missing gradient geometry");
    const x = railBox.x + railBox.width * percent;
    const y = handleBox.y + handleBox.height / 2;
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
  };

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
  await setForgeLayerVisible(page, "Topo Surface", true);

  await page
    .getByTestId("topo-material-preset")
    .selectOption("surface-elevation");
  await expect(page.getByTestId("topo-surface-gradient-rail")).toBeVisible();
  await expect(
    page.locator('[data-testid^="topo-surface-gradient-stop-"]'),
  ).toHaveCount(5);
  await expect(
    page.locator('[data-testid^="topo-surface-gradient-midpoint-"]'),
  ).toHaveCount(4);
  await expect(page.getByTestId("topo-surface-elevation-softness")).toHaveValue(
    "1",
  );
  await expect(
    page.getByTestId("topo-surface-elevation-color-blend"),
  ).toHaveValue("1");

  await expect(
    page.locator('[data-testid^="topo-surface-elevation-position-"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="topo-surface-elevation-midpoint-"]'),
  ).toHaveCount(0);
  await dragGradientHandleToPercent(
    page.getByTestId("topo-surface-gradient-stop-1"),
    0.35,
  );
  await dragGradientHandleToPercent(
    page.getByTestId("topo-surface-gradient-midpoint-1"),
    0.3875,
  );
  await setInputValue(
    page.getByTestId("topo-surface-elevation-softness"),
    "0.55",
  );
  await setInputValue(
    page.getByTestId("topo-surface-elevation-color-blend"),
    "0.65",
  );

  await expect
    .poll(async () => {
      const state = await terrainMaterialSceneState(page);
      return {
        position1: Number(state.surfaceElevationPositions[1]?.toFixed(2)),
        midpoint1: Number(state.surfaceElevationMidpoints[1]?.toFixed(2)),
        softness: state.surfaceElevationTransitionSoftness,
        blend: state.surfaceElevationColorBlend,
      };
    })
    .toMatchObject({
      position1: 0.35,
      midpoint1: 0.25,
      softness: 0.55,
      blend: 0.65,
    });

  const canvas = await page.locator("canvas").screenshot();
  expect(canvas.length).toBeGreaterThan(1000);
  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE topo editor exposes edge fade shape controls", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
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
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.getByTestId("topo-edge-fade-shape")).toHaveValue(
    "rounded-square",
  );
  await expect(page.getByTestId("topo-edge-fade-distance")).toHaveValue(
    "15000",
  );
  await expect(page.getByTestId("topo-edge-fade-inset")).toHaveValue("0");
  await expect(page.getByTestId("topo-edge-fade-corner-radius")).toHaveValue(
    "95000",
  );
  await expect(page.getByText("Edge fade aware")).toBeVisible();
  await expect(page.getByTestId("topo-graticule-edge-strength")).toHaveValue(
    "1",
  );
  await expect(page.getByTestId("topo-graticule-edge-line-color")).toHaveValue(
    "#d4d4d4",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-color")).toHaveValue(
    "#d6d6d6",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-offset")).toHaveValue(
    "31000",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-gap")).toHaveValue(
    "-32000",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      edgeFadeDistanceM: 15000,
      edgeFadeShape: 1,
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 95000,
    });
  await expect
    .poll(() => topoGraticuleSceneState(page))
    .toMatchObject({
      firstLineEdgeEnabled: true,
      firstLineEdgeStrength: 1,
      firstLineEdgeShape: "rounded-square",
      firstLineEdgeDistanceM: 15000,
      firstLineEdgeLineColor: "#d4d4d4",
      firstLabelColor: "#d6d6d6",
    });

  await page.getByTestId("topo-edge-fade-shape").selectOption("circle");
  await setInputValue(page.getByTestId("topo-edge-fade-inset"), "50000");
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      edgeFadeShape: 2,
      edgeFadeInsetM: 50000,
    });
  await expect
    .poll(() => topoGraticuleSceneState(page))
    .toMatchObject({
      firstLineEdgeShape: "circle",
    });

  await page.getByTestId("topo-edge-fade-shape").selectOption("rounded-square");
  await setInputValue(
    page.getByTestId("topo-edge-fade-corner-radius"),
    "30000",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      edgeFadeShape: 1,
      edgeFadeInsetM: 50000,
      edgeFadeCornerRadiusM: 30000,
    });
  await expect
    .poll(() => topoGraticuleSceneState(page))
    .toMatchObject({
      firstLineEdgeShape: "rounded-square",
    });

  const canvas = await page.locator("canvas").screenshot();
  expect(canvas.length).toBeGreaterThan(1000);
  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE topo editor exposes circular clipping and graticule layer", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  const graticuleItem = forgeLayerItem(page, "Longitude / latitude grid");
  await expect(graticuleItem).toBeVisible();
  await setForgeLayerVisible(page, "Longitude / latitude grid", true);
  await expect
    .poll(() => topoGraticuleSceneState(page))
    .toMatchObject({
      layerVisible: true,
      lineObjectCount: 4,
      interiorLineObjectCount: 1,
      dashedInteriorLineObjectCount: 1,
      leaderLineObjectCount: 1,
      dashedLeaderLineObjectCount: 1,
    });
  const enabledGraticule = await topoGraticuleSceneState(page);
  expect(enabledGraticule.labelObjectCount).toBeGreaterThan(0);
  expect(enabledGraticule.visibleLabelCount).toBeGreaterThan(0);
  expect(enabledGraticule.firstLabelScaleX).toBeGreaterThan(0);
  expect(enabledGraticule.firstLineDepthTest).toBe(true);
  expect(enabledGraticule.firstLineDepthWrite).toBe(false);
  expect(enabledGraticule.interiorSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.dashedInteriorSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.leaderSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.dashedLeaderSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.graticuleInnerTrimInsideDistance).toBe(15000);
  expect(enabledGraticule.graticuleLabelOffsetM).toBe(31000);
  expect(enabledGraticule.graticuleLabelGapM).toBe(-32000);
  expect(enabledGraticule.visibleLabelWithoutLeaderCount).toBe(0);
  expect(enabledGraticule.generatedBounds).not.toBeNull();
  expect(enabledGraticule.terrainBounds).not.toBeNull();
  expect(enabledGraticule.generatedBounds?.minX).toBeLessThan(
    enabledGraticule.terrainBounds?.minX ?? -Infinity,
  );
  expect(enabledGraticule.generatedBounds?.maxX).toBeGreaterThan(
    enabledGraticule.terrainBounds?.maxX ?? Infinity,
  );
  expect(enabledGraticule.generatedBounds?.minY).toBeLessThan(
    enabledGraticule.terrainBounds?.minY ?? -Infinity,
  );
  expect(enabledGraticule.generatedBounds?.maxY).toBeGreaterThan(
    enabledGraticule.terrainBounds?.maxY ?? Infinity,
  );
  expect(enabledGraticule.northLabelOutsideCount).toBeGreaterThan(0);
  expect(enabledGraticule.westLabelOutsideCount).toBeGreaterThan(0);
  expect(enabledGraticule.minLabelInsideDistance).toBeLessThan(-1000);
  expect(enabledGraticule.maxLabelTangentErrorDeg).toBeLessThan(0.1);
  await page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          camera?: {
            position: { set: (x: number, y: number, z: number) => void };
            updateMatrixWorld?: (force?: boolean) => void;
          };
          controls?: {
            target?: { set: (x: number, y: number, z: number) => void };
            update?: () => void;
          };
        };
      }
    ).__scene;
    sceneHandle?.camera?.position.set(0, 0, 120_000);
    sceneHandle?.controls?.target?.set(0, 0, 0);
    sceneHandle?.controls?.update?.();
    sceneHandle?.camera?.updateMatrixWorld?.(true);
  });
  const aboveTerrainGraticule = await topoGraticuleSceneState(page);
  expect(aboveTerrainGraticule.firstLineDepthTest).toBe(true);
  expect(aboveTerrainGraticule.firstLineDepthWrite).toBe(false);
  if (aboveTerrainGraticule.undersideGridVisible !== null) {
    expect(aboveTerrainGraticule.undersideGridVisible).toBe(false);
    expect(aboveTerrainGraticule.undersideGridCameraVisible).toBe(false);
    expect(aboveTerrainGraticule.undersideGridHiddenReason).toBe(
      "camera-side",
    );
  }

  const shapeSelect = page.getByTestId("public-surface-clip-shape").first();
  await expect(shapeSelect).toHaveValue("circle");
  const clippingDetails = shapeSelect.locator("xpath=ancestor::details[1]");
  await clippingDetails
    .locator('input[type="checkbox"]')
    .first()
    .setChecked(true);
  await shapeSelect.selectOption("circle");
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      publicClipEnabled: 1,
      publicClipShape: 1,
    });
  await expect
    .poll(() =>
      topoGraticuleSceneState(page).then((state) => ({
        depthTest: state.firstLineDepthTest,
        depthWrite: state.firstLineDepthWrite,
      })),
    )
    .toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
  await expect
    .poll(() =>
      topoGraticuleSceneState(page).then(
        (state) => state.firstLineClippingPlanes ?? 0,
      ),
    )
    .toBeGreaterThan(0);

  const clippedCanvas = await page.locator("canvas").screenshot();
  expect(clippedCanvas.length).toBeGreaterThan(1000);
  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE topo title block renders flat and exposes controls", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeTopoEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.getByRole("button", { name: "Title block" })).toBeVisible();
  await expect(page.getByTestId("topo-map-branding-heading-size")).toHaveAttribute(
    "max",
    "240000",
  );
  await expect(
    page.getByTestId("topo-map-branding-subheading-size"),
  ).toHaveAttribute("max", "180000");
  await expect(page.getByTestId("topo-map-branding-offset-x")).toHaveAttribute(
    "min",
    "-600000",
  );
  await expect(page.getByTestId("topo-map-branding-layout")).toHaveValue(
    "horizontal",
  );
  await page.getByTestId("topo-map-branding-layout").selectOption("stacked");
  await page.getByTestId("topo-map-branding-font-family").selectOption("sans");
  await page.getByTestId("topo-map-branding-text-align").selectOption("center");
  await expect(page.getByTestId("topo-map-branding-layout")).toHaveValue(
    "stacked",
  );

  await page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            setEnvironmentScenePreviewPatch?: (
              patch: Record<string, unknown>,
            ) => void;
          };
          camera?: {
            position: { x: number; y: number; z: number };
            lookAt: (x: number, y: number, z: number) => void;
            updateMatrixWorld: (force?: boolean) => void;
          };
        };
      }
    ).__scene;
    const svgLogo =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#00c2ff"/><circle cx="50" cy="50" r="32" fill="#ffffff"/></svg>',
      );
    sceneHandle?.manager?.setEnvironmentScenePreviewPatch?.({
      terrain: {
        topoMapBranding: {
          visible: true,
          logoPath: svgLogo,
          logoRenderablePath: svgLogo,
          heading: "Client Title",
          subheading: "FORGE map block",
          anchor: "north-east",
          offsetXM: 420000,
          offsetYM: 160000,
          rotationDeg: 12,
          liftM: 320,
          logoWidthM: 60000,
          logoGapM: 12000,
          headingSizeM: 72000,
          subheadingSizeM: 30000,
          layout: "stacked",
          logoPlacement: "before",
          logoFit: "contain",
          fontFamily: "sans",
          textAlign: "center",
          textColor: "#ff00aa",
          opacity: 0.96,
          backgroundEnabled: false,
          outlineEnabled: false,
        },
      },
    });
    sceneHandle?.camera?.updateMatrixWorld(true);
  });

  await expect
    .poll(() => titleBlockSceneState(page))
    .toMatchObject({
      groupExists: true,
      logoCount: 1,
      logoHasMap: true,
      headingCount: 1,
      subheadingCount: 1,
      backgroundCount: 0,
      outlineCount: 0,
      textDepthTest: false,
      textToneMapped: false,
      textFog: false,
      textColor: "#ff00aa",
    });
  const beforeMove = await titleBlockSceneState(page);
  expect(beforeMove.logoWidthM).toBe(60000);
  expect(beforeMove.logoHeightM ?? 0).toBeGreaterThan(20000);
  expect(beforeMove.contentWidthM ?? 0).toBeGreaterThan(60000);
  expect(Math.abs(beforeMove.groupPosition?.x ?? 0)).toBeGreaterThan(200000);

  await page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          camera?: {
            position: { x: number; y: number; z: number };
            lookAt: (x: number, y: number, z: number) => void;
            updateMatrixWorld: (force?: boolean) => void;
          };
        };
      }
    ).__scene;
    if (!sceneHandle?.camera) return;
    sceneHandle.camera.position.x += 120000;
    sceneHandle.camera.position.y -= 80000;
    sceneHandle.camera.lookAt(0, 0, 0);
    sceneHandle.camera.updateMatrixWorld(true);
  });
  await page.waitForTimeout(250);
  const afterMove = await titleBlockSceneState(page);
  expect(afterMove.groupRotationDeg ?? 0).toBeCloseTo(
    beforeMove.groupRotationDeg ?? 0,
    3,
  );

  const pngLogoPath =
    "projects/utah-forge/branding/generated/pw-title-block-render.png";
  await page.request.post("/api/write-file", {
    data: {
      path: pngLogoPath,
      content:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      encoding: "base64",
    },
  });
  await page.evaluate((logoPath) => {
    (
      window as unknown as {
        __scene?: {
          manager?: {
            setEnvironmentScenePreviewPatch?: (
              patch: Record<string, unknown>,
            ) => void;
          };
        };
      }
    ).__scene?.manager?.setEnvironmentScenePreviewPatch?.({
      terrain: {
        topoMapBranding: {
          visible: true,
          logoPath,
          logoRenderablePath: logoPath,
          heading: "PNG logo",
          backgroundEnabled: false,
          outlineEnabled: true,
          logoWidthM: 40000,
          headingSizeM: 240000,
        },
      },
    });
  }, pngLogoPath);
  await expect
    .poll(() => titleBlockSceneState(page).then((state) => state.logoHasMap))
    .toBe(true);
  const pngState = await titleBlockSceneState(page);
  expect(pngState.outlineCount).toBe(4);
  expect(pngState.backgroundCount).toBe(0);
  expect(pngState.logoWidthM).toBe(40000);
  await page.request.post("/api/delete-file", { data: { path: pngLogoPath } });

  const canvas = await page.locator("canvas").screenshot();
  expect(canvas.length).toBeGreaterThan(1000);
  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE title block converts PDF logo sources when Poppler is available", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "domcontentloaded" });
  const sourcePath = "projects/utah-forge/branding/source/pw-title-block.pdf";
  const outputPath = "projects/utah-forge/branding/generated/pw-title-block.png";
  await page.request.post("/api/write-file", {
    data: {
      path: sourcePath,
      content: tinyPdfBase64(),
      encoding: "base64",
    },
  });
  const response = await page.request.post("/api/convert-branding-asset", {
    data: { sourcePath, outputPath, sourceFormat: "pdf" },
  });
  if (!response.ok()) {
    const errorText = await response.text();
    await page.request.post("/api/delete-file", { data: { path: sourcePath } });
    test.skip(true, `PDF conversion unavailable: ${errorText}`);
  }
  expect(response.ok()).toBe(true);
  const generated = await page.request.get(`/${outputPath}`);
  expect(generated.ok()).toBe(true);
  expect(generated.headers()["content-type"]).toContain("image/png");
  await page.request.post("/api/delete-file", { data: { path: sourcePath } });
  await page.request.post("/api/delete-file", { data: { path: outputPath } });
});

test("Utah FORGE title block converts EPS logo sources when ImageMagick is available", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "domcontentloaded" });
  const sourcePath = "projects/utah-forge/branding/source/pw-title-block.eps";
  const outputPath = "projects/utah-forge/branding/generated/pw-title-block-eps.png";
  const eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 120 60
/Helvetica findfont 18 scalefont setfont
0 0 0 setrgbcolor
12 28 moveto
(Title Block) show
showpage
%%EOF
`;
  await page.request.post("/api/write-file", {
    data: {
      path: sourcePath,
      content: Buffer.from(eps, "utf8").toString("base64"),
      encoding: "base64",
    },
  });
  const response = await page.request.post("/api/convert-branding-asset", {
    data: { sourcePath, outputPath, sourceFormat: "eps" },
  });
  if (!response.ok()) {
    const errorText = await response.text();
    await page.request.post("/api/delete-file", { data: { path: sourcePath } });
    test.skip(true, `EPS conversion unavailable: ${errorText}`);
  }
  expect(response.ok()).toBe(true);
  const generated = await page.request.get(`/${outputPath}`);
  expect(generated.ok()).toBe(true);
  expect(generated.headers()["content-type"]).toContain("image/png");
  await page.request.post("/api/delete-file", { data: { path: sourcePath } });
  await page.request.post("/api/delete-file", { data: { path: outputPath } });
});
