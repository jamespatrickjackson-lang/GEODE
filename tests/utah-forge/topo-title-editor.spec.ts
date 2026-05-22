import { expect, test } from "@playwright/test";
import {
  changedByteCount,
  forgeLayerItem,
  openForgeDataEditorContainers,
  setForgeLayerVisible,
  terrainMaterialSceneState,
  tinyPdfBase64,
  titleBlockSceneState,
  topoGraticuleSceneState
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
  await openForgeDataEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeDataEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

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
    .toBe(0);
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

  const legend = page.getByTestId("surface-elevation-legend");
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("Surface Elevation (m)");
  for (const label of ["1500", "2000", "2500", "3000", "3500"]) {
    await expect(legend).toContainText(label);
  }
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
  await expect(page.getByTestId("surface-elevation-legend-ramp")).toHaveCSS(
    "background-image",
    /#fff24d|rgb\(255,\s*242,\s*77\)/,
  );

  await page.getByTestId("topo-material-preset").selectOption("soft-topo");
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.surfaceElevationEnabled,
      ),
    )
    .toBe(0);
  await expect(page.getByTestId("surface-elevation-legend")).toHaveCount(0);
  const restoredCanvas = await page.locator("canvas").screenshot();
  expect(restoredCanvas.length).toBeGreaterThan(1000);

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

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openForgeDataEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeDataEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

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

  const beforeLegendBackground = await page
    .getByTestId("surface-elevation-legend-ramp")
    .evaluate((el) => getComputedStyle(el).backgroundImage);

  await setInputValue(
    page.getByTestId("topo-surface-elevation-position-1"),
    "0.35",
  );
  await setInputValue(
    page.getByTestId("topo-surface-elevation-midpoint-1"),
    "0.25",
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
        position1: state.surfaceElevationPositions[1],
        midpoint1: state.surfaceElevationMidpoints[1],
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

  const afterLegendBackground = await page
    .getByTestId("surface-elevation-legend-ramp")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(afterLegendBackground).not.toBe(beforeLegendBackground);

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
  await openForgeDataEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeDataEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.getByTestId("topo-edge-fade-shape")).toHaveValue(
    "rounded-square",
  );
  await expect(page.getByTestId("topo-edge-fade-distance")).toHaveValue(
    "25000",
  );
  await expect(page.getByTestId("topo-edge-fade-inset")).toHaveValue("0");
  await expect(page.getByTestId("topo-edge-fade-corner-radius")).toHaveValue(
    "55000",
  );
  await expect(page.getByText("Edge fade aware")).toBeVisible();
  await expect(page.getByTestId("topo-graticule-edge-strength")).toHaveValue(
    "1",
  );
  await expect(page.getByTestId("topo-graticule-edge-line-color")).toHaveValue(
    "#ffffff",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-color")).toHaveValue(
    "#ffffff",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-offset")).toHaveValue(
    "90000",
  );
  await expect(page.getByTestId("topo-graticule-edge-label-gap")).toHaveValue(
    "22000",
  );
  await expect
    .poll(() => terrainMaterialSceneState(page))
    .toMatchObject({
      edgeFadeDistanceM: 25000,
      edgeFadeShape: 1,
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 55000,
    });
  await expect
    .poll(() => topoGraticuleSceneState(page))
    .toMatchObject({
      firstLineEdgeEnabled: true,
      firstLineEdgeStrength: 1,
      firstLineEdgeShape: "rounded-square",
      firstLineEdgeDistanceM: 25000,
      firstLineEdgeLineColor: "#ffffff",
      firstLabelColor: "#ffffff",
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
  await openForgeDataEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeDataEditorContainers(page);
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
  expect(enabledGraticule.interiorSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.dashedInteriorSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.leaderSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.dashedLeaderSegmentCount ?? 0).toBeGreaterThan(0);
  expect(enabledGraticule.graticuleInnerTrimInsideDistance).toBe(25000);
  expect(enabledGraticule.graticuleLabelOffsetM).toBe(90000);
  expect(enabledGraticule.graticuleLabelGapM).toBe(22000);
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

  const shapeSelect = page.getByTestId("public-surface-clip-shape").first();
  await expect(shapeSelect).toHaveValue("circle");
  const clippingDetails = page
    .locator("details")
    .filter({ hasText: "Topo map clipping" })
    .first();
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
      topoGraticuleSceneState(page).then(
        (state) => state.firstLineClippingPlanes,
      ),
    )
    .toBe(0);

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
  await openForgeDataEditorContainers(page);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await openForgeDataEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.locator("summary").filter({ hasText: "Title block" })).toBeVisible();
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

  await page.evaluate(async () => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            applyEnvironment?: (env: Record<string, unknown>) => void;
          };
          camera?: {
            position: { x: number; y: number; z: number };
            lookAt: (x: number, y: number, z: number) => void;
            updateMatrixWorld: (force?: boolean) => void;
          };
        };
      }
    ).__scene;
    const env = (await fetch("/projects/utah-forge/environment.json").then((r) =>
      r.json(),
    )) as Record<string, unknown> & {
      scene?: { terrain?: Record<string, unknown> };
    };
    const svgLogo =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#00c2ff"/><circle cx="50" cy="50" r="32" fill="#ffffff"/></svg>',
      );
    sceneHandle?.manager?.applyEnvironment?.({
      ...env,
      scene: {
        ...(env.scene ?? {}),
        terrain: {
          ...(env.scene?.terrain ?? {}),
          topoMapBranding: {
            visible: true,
            logoPath: svgLogo,
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
  await page.evaluate(async (logoPath) => {
    const env = (await fetch("/projects/utah-forge/environment.json").then((r) =>
      r.json(),
    )) as Record<string, unknown> & {
      scene?: { terrain?: Record<string, unknown> };
    };
    (
      window as unknown as {
        __scene?: {
          manager?: {
            applyEnvironment?: (env: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager?.applyEnvironment?.({
      ...env,
      scene: {
        ...(env.scene ?? {}),
        terrain: {
          ...(env.scene?.terrain ?? {}),
          topoMapBranding: {
            visible: true,
            logoPath,
            heading: "PNG logo",
            backgroundEnabled: false,
            outlineEnabled: true,
            logoWidthM: 40000,
            headingSizeM: 240000,
          },
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
