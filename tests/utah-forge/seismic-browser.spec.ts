import { expect, test, type Page } from "@playwright/test";
import {
  hidePublicContextLayers,
  openForgeDataEditorContainers,
  revealSeismicCapabilityProduct,
  sceneSectionState,
  seismicSceneState,
} from "./shared";

test.setTimeout(900_000);

const SEISMIC_MANIFEST_URL =
  "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json";

const FIRST_RAYMARCH_PRODUCT_ID =
  "gdr-1141-forge3d-ani-psdm-stack-unenh";
const SECOND_RAYMARCH_PRODUCT_ID =
  "gdr-1141-forge3d-pstm-stack-enh";

const RAYMARCH_PRODUCT_IDS = [
  FIRST_RAYMARCH_PRODUCT_ID,
  SECOND_RAYMARCH_PRODUCT_ID,
  "gdr-1141-forge3d-poststack-time-migration-fxydecon-stack",
  "gdr-1015-forge3d-velo5d-float-01312018",
] as const;

type SeismicCapture = {
  consoleErrors: string[];
  loadedUrls: string[];
};

function captureSeismicSignals(page: Page): SeismicCapture {
  const capture: SeismicCapture = {
    consoleErrors: [],
    loadedUrls: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      capture.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    capture.consoleErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("utah_forge_phase_3/seismic_analysis")) {
      capture.loadedUrls.push(url);
    }
  });

  return capture;
}

async function openSeismicWorkbench(
  page: Page,
  capture: SeismicCapture,
): Promise<void> {
  await page.goto("/?project=utah-forge", {
    waitUntil: "networkidle",
  });
  await hidePublicContextLayers(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Forge" }).click();
  await openForgeDataEditorContainers(page);
  await ensureSeismicSceneLayerVisible(page);
  await expect
    .poll(() =>
      capture.loadedUrls.some((url) => url.endsWith(SEISMIC_MANIFEST_URL)),
    )
    .toBe(true);
}

async function ensureSeismicSceneLayerVisible(page: Page): Promise<void> {
  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
          };
        };
      }
    ).__scene?.manager;
    const layer = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (layer) layer.visible = true;
  });
  await expect
    .poll(async () => (await seismicSceneState(page)).layerVisible)
    .toBe(true);
}

async function setRangeInput(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  await page.getByTestId(testId).evaluate(
    (input, nextValue) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, nextValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

async function openAllDetails(page: Page): Promise<void> {
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
}

test("Utah FORGE seismic manifest and capability containers render", async ({
  page,
}) => {
  const capture = captureSeismicSignals(page);
  await openSeismicWorkbench(page, capture);

  await expect(page.locator("body")).toContainText("Source and registration");
  await expect(page.locator("body")).toContainText("Seismic analysis");
  await expect(page.locator("body")).toContainText("Product visibility");
  await expect(page.locator("body")).toContainText("3D products");
  await expect(page.locator("body")).toContainText("2D product details");
  await expect(page.locator("body")).toContainText("Render mode");
  await expect(page.locator("body")).toContainText(/(Amp|Vel) min/);
  await expect(page.locator("body")).toContainText("Gain curve");
  await expect(page.locator("body")).toContainText("Zero mute");
  await expect(page.locator("body")).toContainText("Ray steps");
  await expect(page.locator("body")).toContainText("Seismic survey geometry");
  await expect(page.locator("body")).toContainText("Shot/source points");
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
  await expect(page.locator("body")).toContainText("2D sections");
  await expect(page.locator("body")).toContainText("Source-gated products");
  await expect(page.locator("body")).toContainText("Source and registration");
  await expect(page.locator("body")).toContainText(
    "3D anisotropic PSDM depth stack (enhanced)",
  );
  await expect(page.locator("body")).toContainText(
    "Forge3d_ANI_PSDM_Stack_Enh.segy",
  );
  await expect(page.locator("body")).toContainText("Processing comparison");
  await expect(page.locator("body")).toContainText("Seismic rendering");
  await expect(page.locator("body")).toContainText("Isobands");
  await expect(page.locator("body")).toContainText("Integrated geophysics");
  await expect(page.locator("body")).toContainText("Scene section planes");
  await expect(page.getByTestId("scene-section-enabled")).toBeVisible();
  await expect(
    page.getByTestId("seismic-capability-all-2d-sections"),
  ).toBeVisible();
  await expect(
    page.getByTestId("seismic-capability-survey-plus-2d-sections"),
  ).toBeVisible();
  await expect(
    page.getByTestId("seismic-capability-hide-2d-sections"),
  ).toBeVisible();
  await expect(
    page.getByTestId(
      "seismic-source-gate-gdr-1141-forge3d-ani-psdm-stack-enh",
    ),
  ).toBeVisible();
  await revealSeismicCapabilityProduct(page, FIRST_RAYMARCH_PRODUCT_ID);
  await page
    .getByTestId(`seismic-capability-volume-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .click();

  await expect
    .poll(() =>
      capture.loadedUrls.some(
        (url) =>
          url.includes(
            "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/products/",
          ) && /\.u8(?:\?|$)/.test(url),
      ),
    )
    .toBe(true);
  const seismicManifestResponse = await page.request.get(SEISMIC_MANIFEST_URL);
  expect(seismicManifestResponse.ok()).toBe(true);
  const seismicManifest = await seismicManifestResponse.json();
  expect(seismicManifest.products).toHaveLength(34);
  expect(
    seismicManifest.products.filter((product: { raymarchVolume?: unknown }) =>
      Boolean(product.raymarchVolume),
    ).length,
  ).toBe(4);
  const twoDimensionalProductCount = seismicManifest.products.filter(
    (product: { surveyKind?: string }) => product.surveyKind !== "3d",
  ).length;

  await openAllDetails(page);
  await page.getByTestId("seismic-capability-all-2d-sections").click();
  await expect
    .poll(async () => {
      const state = await seismicSceneState(page);
      return {
        visibleProductCount: state.visibleProductIds.length,
        visibleVolumes: state.visibleVolumes,
        capabilityPresetId: state.capabilityPresetId,
      };
    })
    .toMatchObject({
      visibleProductCount: twoDimensionalProductCount,
      visibleVolumes: 0,
      capabilityPresetId: "all-2d-sections",
    });

  await page.getByTestId("seismic-capability-hide-2d-sections").click();
  await expect
    .poll(async () => {
      const state = await seismicSceneState(page);
      return {
        visibleProductIds: state.visibleProductIds,
        visibleSections: state.visibleSections,
        capabilityPresetId: state.capabilityPresetId,
      };
    })
    .toEqual({
      visibleProductIds: [],
      visibleSections: 0,
      capabilityPresetId: "hide-2d-sections",
    });

  await page.getByTestId("seismic-capability-survey-plus-2d-sections").click();
  await expect
    .poll(async () => {
      const state = await seismicSceneState(page);
      return {
        visibleProductCount: state.visibleProductIds.length,
        capabilityPresetId: state.capabilityPresetId,
      };
    })
    .toMatchObject({
      visibleProductCount: twoDimensionalProductCount,
      capabilityPresetId: "all-2d-survey-sections",
    });
  const all2dSceneState = await seismicSceneState(page);
  expect(all2dSceneState.visibleNavigationByRole.sources).toBeGreaterThan(0);
  expect(all2dSceneState.visibleNavigationByRole.receivers).toBeGreaterThan(0);
  expect(all2dSceneState.visibleNavigationByRole.lines).toBeGreaterThan(0);

  await expect(
    page.locator(
      '[data-testid^="seismic-capability-product-"]:not([data-testid^="seismic-capability-product-visible-"])',
    ),
  ).toHaveCount(34);
  const capabilityAncestorSummaries = await page
    .getByTestId(
      `seismic-capability-product-${FIRST_RAYMARCH_PRODUCT_ID}`,
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

  await revealSeismicCapabilityProduct(page, FIRST_RAYMARCH_PRODUCT_ID);
  await expect(
    page.getByTestId(`seismic-capability-volume-${FIRST_RAYMARCH_PRODUCT_ID}`),
  ).toBeVisible();
  await expect(
    page.getByTestId(`seismic-capability-slice-${FIRST_RAYMARCH_PRODUCT_ID}`),
  ).toBeVisible();
  await expect(
    page.getByTestId(`seismic-capability-sync-${FIRST_RAYMARCH_PRODUCT_ID}`),
  ).toBeVisible();
  await revealSeismicCapabilityProduct(page, "gdr-1141-line-301-pdm-enh");
  await expect(
    page.getByTestId("seismic-capability-product-gdr-1141-line-301-pdm-enh"),
  ).toBeVisible();
  await expect(
    page.getByTestId("seismic-capability-slice-gdr-1141-line-301-pdm-enh"),
  ).toBeVisible();
  await expect(
    page.getByTestId("seismic-capability-volume-gdr-1141-line-301-pdm-enh"),
  ).toHaveCount(0);
  expect(capture.consoleErrors).toEqual([]);
});

test("Utah FORGE seismic capability products switch visibility and render modes", async ({
  page,
}) => {
  const capture = captureSeismicSignals(page);
  await openSeismicWorkbench(page, capture);
  await openAllDetails(page);

  await revealSeismicCapabilityProduct(page, FIRST_RAYMARCH_PRODUCT_ID);
  await page
    .getByTestId(`seismic-capability-slice-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: FIRST_RAYMARCH_PRODUCT_ID,
      appliedRenderMode: "slice",
      visibleSections: 1,
      visibleVolumes: 0,
      visibleProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      visibleSectionProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
    });
  const initialSceneState = await seismicSceneState(page);
  expect(initialSceneState.visibleNavigation).toBeGreaterThan(0);

  await page
    .getByTestId(
      `seismic-capability-product-visible-${FIRST_RAYMARCH_PRODUCT_ID}`,
    )
    .click();
  await expect(
    page.getByTestId(
      `seismic-capability-product-visible-${FIRST_RAYMARCH_PRODUCT_ID}`,
    ),
  ).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      visibleSections: 0,
      visibleVolumes: 0,
      visibleProductIds: [],
    });

  for (const productId of RAYMARCH_PRODUCT_IDS) {
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
  expect(capture.consoleErrors).toEqual([]);
});

test("Utah FORGE seismic display cleanup and scene sections update runtime state", async ({
  page,
}) => {
  const capture = captureSeismicSignals(page);
  await openSeismicWorkbench(page, capture);
  await openAllDetails(page);

  await revealSeismicCapabilityProduct(page, SECOND_RAYMARCH_PRODUCT_ID);
  await page
    .getByTestId(`seismic-capability-slice-${SECOND_RAYMARCH_PRODUCT_ID}`)
    .click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: SECOND_RAYMARCH_PRODUCT_ID,
      appliedRenderMode: "slice",
      visibleSections: 1,
      visibleVolumes: 0,
      visibleProductIds: [SECOND_RAYMARCH_PRODUCT_ID],
      visibleSectionProductIds: [SECOND_RAYMARCH_PRODUCT_ID],
    });

  await page
    .getByTestId(`seismic-capability-slice-axis-${SECOND_RAYMARCH_PRODUCT_ID}`)
    .getByTestId(
      `seismic-capability-slice-axis-${SECOND_RAYMARCH_PRODUCT_ID}-crossline`,
    )
    .click();
  await setRangeInput(
    page,
    `seismic-capability-slice-position-${SECOND_RAYMARCH_PRODUCT_ID}`,
    "0.75",
  );
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["crossline"]);
  const beforeAmplitudeState = await seismicSceneState(page);
  expect(beforeAmplitudeState.firstVisibleSectionColor).not.toBeNull();
  expect(beforeAmplitudeState.firstVisibleSectionZ).not.toBeNull();

  await page
    .getByTestId(`seismic-capability-colormap-${SECOND_RAYMARCH_PRODUCT_ID}`)
    .getByTestId(
      `seismic-capability-colormap-${SECOND_RAYMARCH_PRODUCT_ID}-grayscale`,
    )
    .click();
  await setRangeInput(
    page,
    `seismic-capability-amplitude-min-${SECOND_RAYMARCH_PRODUCT_ID}`,
    "0.18",
  );
  await setRangeInput(
    page,
    `seismic-capability-amplitude-max-${SECOND_RAYMARCH_PRODUCT_ID}`,
    "0.82",
  );
  await setRangeInput(
    page,
    `seismic-capability-time-scale-${SECOND_RAYMARCH_PRODUCT_ID}`,
    "4",
  );
  await expect
    .poll(async () => (await seismicSceneState(page)).firstVisibleSectionColor)
    .not.toEqual(beforeAmplitudeState.firstVisibleSectionColor);
  await expect
    .poll(async () => (await seismicSceneState(page)).firstVisibleSectionZ)
    .not.toBe(beforeAmplitudeState.firstVisibleSectionZ);

  await page
    .getByTestId(
      `seismic-capability-remove-background-${SECOND_RAYMARCH_PRODUCT_ID}`,
    )
    .setChecked(true);
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

  await page.getByTestId("seismic-navigation-visible-capability").setChecked(
    false,
  );
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleNavigation)
    .toBe(0);
  await page.getByTestId("seismic-navigation-visible-capability").setChecked(
    true,
  );
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleNavigation)
    .toBeGreaterThan(0);

  await page
    .getByTestId(`seismic-capability-volume-${SECOND_RAYMARCH_PRODUCT_ID}`)
    .click();
  await expect
    .poll(() => capture.loadedUrls.some((url) => /\/volume\.u8(?:\?|$)/.test(url)))
    .toBe(true);
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: SECOND_RAYMARCH_PRODUCT_ID,
      appliedRenderMode: "raymarch",
      visibleSections: 0,
      visibleVolumes: 1,
      visibleVolumeProductIds: [SECOND_RAYMARCH_PRODUCT_ID],
    });
  let sceneState = await seismicSceneState(page);
  expect(sceneState.firstVisibleVolumeUniforms).toMatchObject({
    amplitudeMin: 0.18,
    amplitudeMax: 0.82,
    amplitudeGamma: 1.05,
    colormap: 1,
    opacity: 1,
    removeBackground: 1,
    backgroundCutoff: 0.16,
    sampleSteps: 72,
  });

  await page.getByTestId("scene-section-enabled").setChecked(true);
  await page
    .getByTestId(`scene-section-target-product-${SECOND_RAYMARCH_PRODUCT_ID}`)
    .setChecked(true);
  await page
    .getByTestId("scene-section-plane-x-enabled")
    .setChecked(false, { force: true });
  await page
    .getByTestId("scene-section-plane-y-enabled")
    .setChecked(false, { force: true });
  await page.getByTestId("scene-section-plane-z-enabled").setChecked(true);
  await setRangeInput(page, "scene-section-plane-z-position", "-2400");
  await expect
    .poll(() => sceneSectionState(page))
    .toMatchObject({
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
  expect(sectionState.helperPickables).toBeGreaterThan(0);
  expect(sectionState.helperPickableAxes).toContain("z");
  expect(
    sectionState.helperPickableNames.some((name) =>
      name.toLowerCase().includes("z section"),
    ),
  ).toBe(true);
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
  await expect(sectionLegend).toContainText("Z Section");
  await expect(
    page.getByTestId("scene-section-legend-z-show"),
  ).toHaveAttribute("aria-pressed", "true");

  for (const axis of ["x", "y"] as const) {
    const showButton = page.getByTestId(`scene-section-legend-${axis}-show`);
    if ((await showButton.getAttribute("aria-pressed")) !== "true") {
      await showButton.click();
    }
  }
  await expect
    .poll(() => sceneSectionState(page))
    .toMatchObject({
      firstVisibleVolumeSectionUniforms: {
        enabled: 1,
        mode: 0,
        planeCount: 3,
      },
    });
  sectionState = await sceneSectionState(page);
  expect(sectionState.helperPickables).toBeGreaterThanOrEqual(6);
  expect(sectionState.helperPickableAxes).toEqual(
    expect.arrayContaining(["x", "y", "z"]),
  );
  expect(sectionState.helperPickableKinds).toContain("push-pull");
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
  expect(capture.consoleErrors).toEqual([]);
});

test("Utah FORGE seismic product controls and capability workflows update state", async ({
  page,
}) => {
  const capture = captureSeismicSignals(page);
  await openSeismicWorkbench(page, capture);
  await openAllDetails(page);

  await revealSeismicCapabilityProduct(page, FIRST_RAYMARCH_PRODUCT_ID);
  await page
    .getByTestId(`seismic-capability-sync-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: FIRST_RAYMARCH_PRODUCT_ID,
      appliedRenderMode: "raymarch",
      visibleProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      visibleSections: 1,
      visibleVolumes: 1,
      visibleVolumeProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      capabilityPresetId: `${FIRST_RAYMARCH_PRODUCT_ID}-raymarch-sync`,
      sliceThroughVolume: true,
    });

  await page.getByTestId("seismic-capability-line-301-theatre").click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: "gdr-1141-line-301-pdm-enh",
      appliedRenderMode: "slice",
      visibleSections: 1,
      visibleVolumes: 0,
      visibleProductIds: [
        "gdr-1141-line-301-pdm-enh",
      ],
      visibleSectionAxes: ["line"],
      capabilityPresetId: "line-301-theatre",
    });

  await openAllDetails(page);
  await revealSeismicCapabilityProduct(page, FIRST_RAYMARCH_PRODUCT_ID);
  await page
    .getByTestId(`seismic-capability-slice-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .click();
  await page
    .getByTestId(`seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .getByTestId(
      `seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}-inline`,
    )
    .click();
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["inline"]);

  await page
    .getByTestId(`seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .getByTestId(
      `seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}-crossline`,
    )
    .click();
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["crossline"]);

  await page
    .getByTestId(`seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .getByTestId(
      `seismic-capability-slice-axis-${FIRST_RAYMARCH_PRODUCT_ID}-sample`,
    )
    .click();
  await expect
    .poll(async () => (await seismicSceneState(page)).visibleSectionAxes)
    .toEqual(["sample"]);
  await expect
    .poll(async () => (await seismicSceneState(page)).capabilityPresetId)
    .toBe(`${FIRST_RAYMARCH_PRODUCT_ID}-slice`);

  await page
    .getByTestId(`seismic-capability-sync-${FIRST_RAYMARCH_PRODUCT_ID}`)
    .click();
  await expect
    .poll(() => seismicSceneState(page))
    .toMatchObject({
      selectedProductId: FIRST_RAYMARCH_PRODUCT_ID,
      appliedRenderMode: "raymarch",
      visibleProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      visibleSections: 1,
      visibleVolumes: 1,
      visibleVolumeProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      capabilityPresetId: `${FIRST_RAYMARCH_PRODUCT_ID}-raymarch-sync`,
      sliceThroughVolume: true,
    });
  await page
    .getByTestId(
      `seismic-capability-remove-background-${FIRST_RAYMARCH_PRODUCT_ID}`,
    )
    .setChecked(true);
  await setRangeInput(
    page,
    `seismic-capability-amplitude-gamma-${FIRST_RAYMARCH_PRODUCT_ID}`,
    "0.65",
  );
  await setRangeInput(
    page,
    `seismic-capability-background-cutoff-${FIRST_RAYMARCH_PRODUCT_ID}`,
    "0.28",
  );
  await setRangeInput(
    page,
    `seismic-capability-volume-sample-steps-${FIRST_RAYMARCH_PRODUCT_ID}`,
    "144",
  );
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
    .getByTestId("seismic-comparison-mode-select-side-by-side")
    .click();
  await setRangeInput(page, "seismic-comparison-spacing", "1000");
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
  let sceneState = await seismicSceneState(page);
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
      selectedProductId: FIRST_RAYMARCH_PRODUCT_ID,
      visibleProductIds: [FIRST_RAYMARCH_PRODUCT_ID],
      visibleSections: 1,
      capabilityPresetId: "integrated-geophysics",
    });
  await expect
    .poll(async () => (await seismicSceneState(page)).mtFullDensityOpacity)
    .toBeCloseTo(0.42, 2);

  expect(capture.consoleErrors).toEqual([]);
});
