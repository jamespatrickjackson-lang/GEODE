import { expect, test } from "@playwright/test";
import {
  hidePublicContextLayers,
  openForgeDataEditorContainers,
  revealSeismicCapabilityProduct,
  sceneSectionState,
  seismicSceneState
} from "./shared";

test.setTimeout(900_000);

test("Utah FORGE Phase 3 seismic browser loads and responds to controls", async ({
  page,
}) => {
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
    if (url.includes("utah_forge_phase_3/seismic_analysis")) {
      loadedUrls.push(url);
    }
  });

  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await hidePublicContextLayers(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "FORGE Data" }).click();
  await openForgeDataEditorContainers(page);
  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json",
        ),
      ),
    )
    .toBe(true);
  await expect(page.locator("body")).toContainText("Seismic browser");
  await expect(page.locator("body")).toContainText("Seismic analysis");
  await expect(page.locator("body")).toContainText("Product");
  await expect(page.locator("body")).toContainText("RenderMode");
  await expect(page.locator("body")).toContainText(/(Amp|Vel) min/);
  await expect(page.locator("body")).toContainText("Gain curve");
  await expect(page.locator("body")).toContainText("Zero mute");
  await expect(page.locator("body")).toContainText("Ray steps");
  await expect(page.locator("body")).toContainText("Navigation");
  await expect(page.locator("body")).toContainText("Audience");
  await expect(page.locator("body")).toContainText(
    "public geothermal demo data",
  );
  await expect(page.locator("body")).toContainText(
    "not a mineral resource estimate",
  );
  await expect(page.locator("body")).toContainText(
    "3D anisotropic PSDM depth stack (unenhanced)",
  );
  await expect(page.locator("body")).toContainText(
    "3D PSTM time stack (enhanced)",
  );
  await expect(page.locator("body")).toContainText(
    "3D post-stack time migration FXY decon stack",
  );
  await expect(page.locator("body")).toContainText(
    "3D velocity model (time domain)",
  );
  await expect(page.locator("body")).toContainText(
    "2D / legacy section theatre",
  );
  await expect(page.locator("body")).toContainText("Processing comparison");
  await expect(page.locator("body")).toContainText("Display cleanup");
  await expect(page.locator("body")).toContainText("Survey geometry");
  await expect(page.locator("body")).toContainText("Integrated geophysics");
  await expect(page.locator("body")).toContainText("Data confidence");
  await expect(page.locator("body")).toContainText("Scene section planes");
  await expect(page.getByTestId("scene-section-enabled")).toBeVisible();
  await expect(page.getByTestId("scene-section-mode")).toHaveValue("cutaway");
  await expect(page.getByTestId("scene-section-target-scope")).toHaveValue(
    "all-visible",
  );
  await expect(page.getByTestId("seismic-audience-mode-select")).toBeVisible();
  await expect(
    page.getByTestId("seismic-audience-preset-select"),
  ).toBeVisible();

  await expect
    .poll(() =>
      loadedUrls.some(
        (url) =>
          url.includes(
            "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/products/",
          ) && url.endsWith(".u8"),
      ),
    )
    .toBe(true);
  const seismicManifestResponse = await page.request.get(
    "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json",
  );
  expect(seismicManifestResponse.ok()).toBe(true);
  const seismicManifest = await seismicManifestResponse.json();
  expect(seismicManifest.products).toHaveLength(34);
  expect(
    seismicManifest.products.filter((product: { raymarchVolume?: unknown }) =>
      Boolean(product.raymarchVolume),
    ).length,
  ).toBe(4);

  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
  await expect(
    page.locator(
      '[data-testid^="seismic-capability-product-"]:not([data-testid^="seismic-capability-product-visible-"])',
    ),
  ).toHaveCount(4);
  const capabilityAncestorSummaries = await page
    .getByTestId(
      "seismic-capability-product-gdr-1141-forge3d-ani-psdm-stack-unenh",
    )
    .evaluate((el) => {
      const summaries: string[] = [];
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        if (node instanceof HTMLDetailsElement) {
          summaries.push(
            node.querySelector(":scope > summary")?.textContent?.trim() ?? "",
          );
        }
        node = node.parentElement;
      }
      return summaries;
    });
  expect(capabilityAncestorSummaries).not.toContain("Seismic browser seismic");
  expect(capabilityAncestorSummaries).not.toContain("Appearance");
  expect(capabilityAncestorSummaries).not.toContain("Seismic browser");
  await expect(page.locator("body")).toContainText("Product visibility");
  await expect(page.getByTestId("seismic-products-show-all")).toBeVisible();
  await expect(page.getByTestId("seismic-products-hide-all")).toBeVisible();
  const defaultProductToggle = page.getByTestId(
    "seismic-product-visible-gdr-1141-forge3d-ani-psdm-stack-unenh",
  );
  await expect(defaultProductToggle).toBeVisible();
  await page.getByTestId("seismic-products-hide-all").click();
  await defaultProductToggle.setChecked(true);
  await page
    .getByTestId("seismic-product-row-gdr-1141-forge3d-ani-psdm-stack-unenh")
    .click();
  await page.getByTestId("seismic-render-mode-select").selectOption("slice");
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      layerVisible: true,
      selectedProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      appliedRenderMode: "slice",
      visibleSections: 1,
      visibleVolumes: 0,
      visibleProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
    });
  const initialSceneState = await seismicSceneState(page);
  expect(initialSceneState.visibleNavigation).toBeGreaterThan(0);
  expect(initialSceneState.visibleSectionProductIds).toEqual([
    "gdr-1141-forge3d-ani-psdm-stack-unenh",
  ]);

  await defaultProductToggle.setChecked(false);
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      visibleSections: 0,
      visibleVolumes: 0,
      visibleProductIds: [],
    });

  await page.getByTestId("seismic-products-show-all").click();
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSections)
    .toBeGreaterThan(10);
  let sceneState = await seismicSceneState(page);
  expect(sceneState.visibleVolumes).toBe(0);
  expect(sceneState.visibleProductIds).toHaveLength(34);

  await page.getByTestId("seismic-products-hide-all").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      visibleSections: 0,
      visibleVolumes: 0,
      visibleProductIds: [],
    });

  await page
    .getByTestId("seismic-product-row-gdr-1141-forge3d-pstm-stack-enh")
    .click();
  await expect(page.getByTestId("seismic-product-select")).toHaveValue(
    "gdr-1141-forge3d-pstm-stack-enh",
  );
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-forge3d-pstm-stack-enh",
      visibleSections: 1,
      visibleVolumes: 0,
      visibleProductIds: ["gdr-1141-forge3d-pstm-stack-enh"],
      visibleSectionProductIds: ["gdr-1141-forge3d-pstm-stack-enh"],
    });

  await page.getByTestId("seismic-slice-axis-select").selectOption("crossline");
  await page.getByTestId("seismic-slice-fraction").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "0.75");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["crossline"]);
  const beforeAmplitudeState = await seismicSceneState(page);
  expect(beforeAmplitudeState.firstVisibleSectionColor).not.toBeNull();
  expect(beforeAmplitudeState.firstVisibleSectionZ).not.toBeNull();

  await page.getByTestId("seismic-colormap-select").selectOption("grayscale");
  await page.getByTestId("seismic-amplitude-min").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "0.18");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByTestId("seismic-amplitude-max").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "0.82");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByTestId("seismic-time-scale").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "4");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect
    .poll(async () => (await seismicSceneState(page)).firstVisibleSectionColor)
    .not.toEqual(beforeAmplitudeState.firstVisibleSectionColor);
  await expect
    .poll(async () => (await seismicSceneState(page)).firstVisibleSectionZ)
    .not.toBe(beforeAmplitudeState.firstVisibleSectionZ);

  await page.getByTestId("seismic-remove-background").setChecked(false);
  await expect(page.getByTestId("seismic-remove-background")).not.toBeChecked();
  await page.getByTestId("seismic-remove-background").setChecked(true);
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      removeBackground: true,
    });
  await expect
    .poll(
      async () => (await seismicSceneState(page)).firstVisibleSectionMinAlpha,
    )
    .toBeLessThan(0.5);

  await page.getByTestId("seismic-navigation-visible").setChecked(false);
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleNavigation)
    .toBe(0);
  await page.getByTestId("seismic-navigation-visible").setChecked(true);
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleNavigation)
    .toBeGreaterThan(0);

  await page.getByTestId("seismic-render-mode-select").selectOption("raymarch");
  await expect
    .poll(() => loadedUrls.some((url) => url.endsWith("/volume.u8")))
    .toBe(true);
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      appliedRenderMode: "raymarch",
      visibleSections: 0,
      visibleVolumes: 1,
      visibleVolumeProductIds: ["gdr-1141-forge3d-pstm-stack-enh"],
    });
  sceneState = await seismicSceneState(page);
  expect(sceneState.firstVisibleVolumeUniforms).toMatchObject({
    amplitudeMin: 0.18,
    amplitudeMax: 0.82,
    amplitudeGamma: 1,
    colormap: 1,
    opacity: 0.42,
    removeBackground: 1,
    backgroundCutoff: 0.16,
    sampleSteps: 96,
  });

  await expect(
    page
      .locator('[aria-label="Utah FORGE seismic volume legend"]')
      .filter({ hasText: "Seismic amplitude" }),
  ).toBeVisible();
  await page.getByTestId("seismic-legend-gamma").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "1.35");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByTestId("seismic-legend-sample-steps").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "128");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect
    .poll(
      async () => (await seismicSceneState(page)).firstVisibleVolumeUniforms,
    )
    .toMatchObject({
      amplitudeGamma: 1.35,
      sampleSteps: 128,
    });

  await page.getByTestId("scene-section-enabled").setChecked(true);
  await page
    .getByTestId("scene-section-target-product-gdr-1141-forge3d-pstm-stack-enh")
    .setChecked(true);
  await page
    .getByTestId("scene-section-plane-x-enabled")
    .setChecked(false, { force: true });
  await page.getByTestId("scene-section-plane-z-enabled").setChecked(true);
  await page.getByTestId("scene-section-plane-z-position").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "-2400");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect
    .poll(() => sceneSectionState(page))
    .toMatchObject({
      helperPickables: 2,
      firstVisibleVolumeSectionUniforms: {
        enabled: 1,
        mode: 0,
        planeCount: 1,
      },
    });
  let sectionState = await sceneSectionState(page);
  expect(sectionState.firstVisibleVolumeSectionUniforms?.positions?.[0]).toBe(
    -2400,
  );
  expect(sectionState.firstVisibleVolumeSectionUniforms?.normals?.[0]).toEqual([
    0, 0, 1,
  ]);
  expect(sectionState.firstVisibleVolumeSectionUniforms?.inverts?.[0]).toBe(0);
  expect(sectionState.mtFirstClippingPlane).toEqual({
    normal: [0, 0, -1],
    constant: -2400,
  });
  expect(sectionState.helperPickableKinds).toEqual(["push-pull", "push-pull"]);
  expect(sectionState.helperPickableAxes).toEqual(["z", "z"]);
  expect([...sectionState.helperPickableDirections].sort()).toEqual([-1, 1]);
  expect(sectionState.helperPickableNames).toEqual(
    expect.arrayContaining(["Z Section pull handle", "Z Section push handle"]),
  );
  expect(
    sectionState.helperPickableNames.some((name) =>
      name.toLowerCase().includes("drag surface"),
    ),
  ).toBe(false);
  await page.getByTestId("scene-section-plane-z-invert").setChecked(true);
  await expect
    .poll(() =>
      sceneSectionState(page).then(
        (state) => state.firstVisibleVolumeSectionUniforms?.inverts?.[0],
      ),
    )
    .toBe(1);
  sectionState = await sceneSectionState(page);
  expect(sectionState.mtFirstClippingPlane).toEqual({
    normal: [0, 0, 1],
    constant: 2400,
  });
  await page.getByTestId("scene-section-plane-z-invert").setChecked(false);
  await expect
    .poll(() =>
      sceneSectionState(page).then(
        (state) => state.firstVisibleVolumeSectionUniforms?.inverts?.[0],
      ),
    )
    .toBe(0);
  await expect(page.locator("body")).toContainText("X Section");
  await expect(page.locator("body")).toContainText("Y Section");
  await expect(page.locator("body")).toContainText("Z Section");
  const sectionLegend = page.locator(
    '[aria-label="Utah FORGE scene section plane legend"]',
  );
  await expect(sectionLegend).toBeVisible();
  await expect(sectionLegend).toContainText("Cutaway clip");
  await expect(
    page.getByTestId("scene-section-legend-z-enabled"),
  ).toBeChecked();

  await page.getByTestId("scene-section-legend-x-enabled").setChecked(true);
  await page.getByTestId("scene-section-legend-y-enabled").setChecked(true);
  await expect
    .poll(() => sceneSectionState(page))
    .toMatchObject({
      helperPickables: 6,
      firstVisibleVolumeSectionUniforms: {
        enabled: 1,
        mode: 0,
        planeCount: 3,
      },
    });
  sectionState = await sceneSectionState(page);
  expect([...sectionState.helperPickableAxes].sort()).toEqual([
    "x",
    "x",
    "y",
    "y",
    "z",
    "z",
  ]);
  expect(
    sectionState.helperPickableKinds.every((kind) => kind === "push-pull"),
  ).toBe(true);
  expect(sectionState.mtClippedMaterials).toBeGreaterThan(0);
  await page
    .getByTestId("scene-section-target-scope")
    .selectOption("all-visible");
  await expect(page.getByTestId("scene-section-target-scope")).toHaveValue(
    "all-visible",
  );
  await page
    .getByTestId("scene-section-target-scope")
    .selectOption("active-selection");
  await expect(page.getByTestId("scene-section-target-scope")).toHaveValue(
    "active-selection",
  );
  await page.getByTestId("scene-section-enabled").setChecked(false);
  await expect
    .poll(() => sceneSectionState(page))
    .toMatchObject({
      helperPickables: 0,
      firstVisibleVolumeSectionUniforms: {
        enabled: 0,
      },
    });

  const beforeCanvasSeismicClick = await seismicSceneState(page);
  const canvasBox = await page.locator("canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox) {
    await page.mouse.click(
      canvasBox.x + canvasBox.width * 0.5,
      canvasBox.y + canvasBox.height * 0.48,
    );
    await page.waitForTimeout(250);
    const afterCanvasSeismicClick = await seismicSceneState(page);
    expect(afterCanvasSeismicClick.selectedProductId).toBe(
      beforeCanvasSeismicClick.selectedProductId,
    );
    expect(afterCanvasSeismicClick.appliedRenderMode).toBe(
      beforeCanvasSeismicClick.appliedRenderMode,
    );
    expect(afterCanvasSeismicClick.visibleProductIds).toEqual(
      beforeCanvasSeismicClick.visibleProductIds,
    );
    expect(afterCanvasSeismicClick.visibleSections).toBe(
      beforeCanvasSeismicClick.visibleSections,
    );
    expect(afterCanvasSeismicClick.visibleVolumes).toBe(
      beforeCanvasSeismicClick.visibleVolumes,
    );
  }

  await page
    .getByTestId("seismic-product-row-gdr-1015-forge2d-301-migr-depth")
    .click();
  await expect(page.getByTestId("seismic-render-mode-select")).toHaveValue(
    "slice",
  );
  await expect(page.getByTestId("seismic-render-mode-select")).toBeDisabled();
  await expect(page.getByTestId("seismic-slice-axis-select")).toHaveValue(
    "line",
  );
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1015-forge2d-301-migr-depth",
      appliedRenderMode: "slice",
      visibleSections: 2,
      visibleVolumes: 0,
      visibleProductIds: [
        "gdr-1141-forge3d-pstm-stack-enh",
        "gdr-1015-forge2d-301-migr-depth",
      ],
      visibleSectionAxes: ["inline", "line"],
    });

  await page
    .getByTestId("seismic-audience-preset-select")
    .selectOption("investor-overview-volume");
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      appliedRenderMode: "raymarch",
      visibleProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      visibleSections: 1,
      visibleVolumes: 1,
      visibleVolumeProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      sliceThroughVolume: true,
    });
  await expect
    .poll(async () => (await seismicSceneState(page)).mtFullDensityOpacity)
    .toBeCloseTo(0.34, 2);

  await page
    .getByTestId("seismic-audience-preset-select")
    .selectOption("line-theatre-301");
  await expect(page.getByTestId("seismic-audience-mode-select")).toHaveValue(
    "technical",
  );
  await expect(
    page.getByTestId("seismic-comparison-product-select"),
  ).toHaveValue("gdr-1141-line-301-psdm-unenh");
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-301-pdm-enh",
      appliedRenderMode: "slice",
      visibleSections: 2,
      visibleVolumes: 0,
      visibleProductIds: [
        "gdr-1141-line-301-pdm-enh",
        "gdr-1141-line-301-psdm-unenh",
      ],
      visibleSectionAxes: ["line"],
    });

  await page
    .getByTestId("seismic-audience-mode-select")
    .selectOption("data-room");
  await expect(page.getByTestId("seismic-data-room-summary")).toContainText(
    "Products: 34",
  );
  await expect(page.getByTestId("seismic-data-room-summary")).toContainText(
    "measured navigation",
  );

  await page.getByTestId("seismic-audience-mode-select").selectOption("export");
  await expect(page.getByTestId("seismic-export-summary")).toContainText(
    "NI 43-101",
  );
  await expect(page.getByTestId("seismic-export-layout-select")).toHaveValue(
    "qp-report-support-layout",
  );

  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  const raymarchProductIds = [
    "gdr-1141-forge3d-ani-psdm-stack-unenh",
    "gdr-1141-forge3d-pstm-stack-enh",
    "gdr-1141-forge3d-poststack-time-migration-fxydecon-stack",
    "gdr-1015-forge3d-velo5d-float-01312018",
  ];
  for (const productId of raymarchProductIds) {
    await revealSeismicCapabilityProduct(page, productId);
    await page.getByTestId(`seismic-capability-volume-${productId}`).click();
    await expect
      .poll(async () => {
        const state = await seismicSceneState(page);
        return {
          selectedProductId: state.selectedProductId,
          appliedRenderMode: state.appliedRenderMode,
          visibleProductIds: state.visibleProductIds,
          visibleSections: state.visibleSections,
          visibleVolumes: state.visibleVolumes,
          visibleVolumeProductIds: state.visibleVolumeProductIds,
        };
      })
      .toMatchObject({
        selectedProductId: productId,
        appliedRenderMode: "raymarch",
        visibleProductIds: [productId],
        visibleSections: 0,
        visibleVolumes: 1,
        visibleVolumeProductIds: [productId],
      });
    if (productId === "gdr-1015-forge3d-velo5d-float-01312018") {
      await expect
        .poll(
          async () =>
            (await seismicSceneState(page)).firstVisibleVolumeUniforms,
        )
        .toMatchObject({ colormap: 2 });
      await expect(
        page
          .locator('[aria-label="Utah FORGE seismic volume legend"]')
          .filter({ hasText: "Seismic velocity" }),
      ).toBeVisible();
      await expect(page.getByTestId("seismic-legend-palette")).toHaveValue(
        "velocity",
      );
      await expect(
        page.locator('[aria-label="Utah FORGE seismic volume legend"]'),
      ).toContainText("m/s");
    }

    await page.getByTestId(`seismic-capability-slice-${productId}`).click();
    await expect
      .poll(async () => {
        const state = await seismicSceneState(page);
        return {
          selectedProductId: state.selectedProductId,
          appliedRenderMode: state.appliedRenderMode,
          visibleProductIds: state.visibleProductIds,
          visibleSections: state.visibleSections,
          visibleVolumes: state.visibleVolumes,
          visibleSectionProductIds: state.visibleSectionProductIds,
        };
      })
      .toMatchObject({
        selectedProductId: productId,
        appliedRenderMode: "slice",
        visibleProductIds: [productId],
        visibleSections: 1,
        visibleVolumes: 0,
        visibleSectionProductIds: [productId],
      });
  }

  const firstRaymarchProductId = "gdr-1141-forge3d-ani-psdm-stack-unenh";
  await revealSeismicCapabilityProduct(page, firstRaymarchProductId);
  await page
    .getByTestId(`seismic-capability-slice-${firstRaymarchProductId}`)
    .click();
  await page
    .getByTestId(`seismic-capability-slice-axis-${firstRaymarchProductId}`)
    .selectOption("inline");
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["inline"]);

  await page
    .getByTestId(`seismic-capability-slice-axis-${firstRaymarchProductId}`)
    .selectOption("crossline");
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["crossline"]);

  await page
    .getByTestId(`seismic-capability-slice-axis-${firstRaymarchProductId}`)
    .selectOption("sample");
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["sample"]);
  await expect
    .poll(async () => (await seismicSceneState(page)).capabilityPresetId)
    .toBe(`${firstRaymarchProductId}-slice`);

  await page
    .getByTestId(`seismic-capability-sync-${firstRaymarchProductId}`)
    .click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      appliedRenderMode: "raymarch",
      visibleProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      visibleSections: 1,
      visibleVolumes: 1,
      visibleVolumeProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      capabilityPresetId: `${firstRaymarchProductId}-raymarch-sync`,
      sliceThroughVolume: true,
    });
  await page
    .getByTestId(
      `seismic-capability-remove-background-${firstRaymarchProductId}`,
    )
    .setChecked(true);
  await page
    .getByTestId(`seismic-capability-amplitude-gamma-${firstRaymarchProductId}`)
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "0.65");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await page
    .getByTestId(
      `seismic-capability-background-cutoff-${firstRaymarchProductId}`,
    )
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "0.28");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .getByTestId(
      `seismic-capability-volume-sample-steps-${firstRaymarchProductId}`,
    )
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "144");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect
    .poll(
      async () => (await seismicSceneState(page)).firstVisibleVolumeUniforms,
    )
    .toMatchObject({
      amplitudeGamma: 0.65,
      backgroundCutoff: 0.28,
      sampleSteps: 144,
      removeBackground: 1,
    });

  await page.getByTestId("seismic-capability-line-301-theatre").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-301-pdm-enh",
      appliedRenderMode: "slice",
      visibleProductIds: ["gdr-1141-line-301-pdm-enh"],
      visibleSections: 1,
      visibleVolumes: 0,
      visibleSectionAxes: ["line"],
      capabilityPresetId: "line-301-theatre",
    });

  await page.getByTestId("seismic-capability-line-302-theatre").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-302-psdm-enh",
      visibleProductIds: ["gdr-1141-line-302-psdm-enh"],
      visibleSections: 1,
      visibleSectionAxes: ["line"],
      capabilityPresetId: "line-302-theatre",
    });

  await page.getByTestId("seismic-capability-legacy-l5-l11-theatre").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-l5-psdm-enh",
      visibleProductIds: expect.arrayContaining([
        "gdr-1141-line-l5-psdm-enh",
        "gdr-1141-line-l11-psdm-enh",
      ]),
      visibleSections: 2,
      visibleSectionAxes: ["line"],
      capabilityPresetId: "legacy-l5-l11-theatre",
    });

  await page.getByTestId("seismic-comparison-pair-302").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-302-psdm-enh",
      visibleProductIds: expect.arrayContaining([
        "gdr-1141-line-302-psdm-enh",
        "gdr-1141-line-302-psdm-unenh",
      ]),
      visibleSections: 2,
      visibleSectionAxes: ["line"],
      comparisonMode: "overlay",
    });

  await page
    .getByTestId("seismic-comparison-mode-select")
    .selectOption("side-by-side");
  await page.getByTestId("seismic-comparison-spacing").evaluate((input) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, "1000");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByTestId("seismic-comparison-pair-302").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-302-psdm-enh",
      comparisonMode: "side-by-side",
      comparisonSpacingM: 1000,
      visibleProductIds: expect.arrayContaining([
        "gdr-1141-line-302-psdm-enh",
        "gdr-1141-line-302-psdm-unenh",
      ]),
      visibleSections: 2,
    });
  sceneState = await seismicSceneState(page);
  expect(
    sceneState.visibleSectionObjectXByProduct[
      "gdr-1141-line-302-psdm-unenh"
    ]?.some((value) => value >= 900),
  ).toBe(true);

  await page.getByTestId("seismic-capability-survey-geometry-preset").click();
  await expect
    .poll(async () => {
      const state = await seismicSceneState(page);
      return (
        state.visibleNavigationByRole.sources > 0 &&
        state.visibleNavigationByRole.receivers > 0 &&
        state.visibleNavigationByRole.lines > 0
      );
    })
    .toBe(true);
  await page.getByTestId("seismic-navigation-role-sources").setChecked(false);
  await expect
    .poll(async () => {
      const state = await seismicSceneState(page);
      return {
        sourceObjects: state.visibleNavigationByRole.sources,
        receiverObjects: state.visibleNavigationByRole.receivers,
        lineObjects: state.visibleNavigationByRole.lines,
        sourceToggle: state.navigationRoleVisibility.sources,
      };
    })
    .toMatchObject({
      sourceObjects: 0,
      sourceToggle: false,
    });
  sceneState = await seismicSceneState(page);
  expect(sceneState.visibleNavigationByRole.receivers).toBeGreaterThan(0);
  expect(sceneState.visibleNavigationByRole.lines).toBeGreaterThan(0);
  await page.getByTestId("seismic-navigation-role-sources").setChecked(true);

  await page.getByTestId("seismic-capability-integrated").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      visibleProductIds: ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
      visibleSections: 1,
      capabilityPresetId: "integrated-geophysics",
    });
  await expect
    .poll(async () => (await seismicSceneState(page)).mtFullDensityOpacity)
    .toBeCloseTo(0.42, 2);

  expect(consoleErrors).toEqual([]);
});
