import { expect, test } from "@playwright/test";
import {
  hidePublicContextLayers,
  openForgeDataEditorContainers,
  readJsonFile,
  runForgeDataTransitionProbe,
  sceneSectionState,
  selectForgePageRow,
  UTAH_FORGE_ENVIRONMENT_PATH,
  UTAH_FORGE_PAGE06_PATH,
  workingAreaFocusSceneState
} from "./shared";

test.setTimeout(900_000);

test("Utah FORGE working area focus clips outside context with page-local controls", async ({
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
  await hidePublicContextLayers(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await selectForgePageRow(page, "01.");
  await page.getByRole("button", { name: "FORGE Data" }).click();
  await openForgeDataEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });

  await expect(page.getByTestId("working-area-focus-container")).toBeVisible();
  await expect(page.getByTestId("working-area-focus-enabled")).toBeVisible();
  await expect(page.getByTestId("working-area-focus-mode")).toHaveValue(
    "outside-context",
  );
  await expect(
    page.getByTestId(
      "working-area-focus-opacity-utah-forge-mt-resistivity-full-density",
    ),
  ).toBeVisible();

  await page.getByTestId("working-area-focus-enabled").setChecked(true);
  await page
    .getByTestId("working-area-focus-mode")
    .selectOption("outside-context");
  await page
    .getByTestId(
      "working-area-focus-opacity-utah-forge-mt-resistivity-full-density",
    )
    .evaluate((input) => {
      const el = input as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(el, "0.15");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

  await expect
    .poll(() => workingAreaFocusSceneState(page))
    .toMatchObject({
      focus: {
        enabled: true,
        mode: "outside-context",
        boundsLayerId: "utah-forge-phase3-working-area",
        targetLayerIds: expect.arrayContaining([
          "utah-forge-mt-resistivity-full-density",
          "utah-forge-mt-resistivity-volume",
          "utah-forge-phase3-seismic-browser",
        ]),
        outsideOpacityByLayerId: {
          "utah-forge-mt-resistivity-full-density": 0.15,
        },
      },
    });
  let focusState = await workingAreaFocusSceneState(page);
  expect(
    focusState.layers["utah-forge-mt-resistivity-volume"].firstUniformEnabled,
  ).toBe(1);
  expect(
    focusState.layers["utah-forge-mt-resistivity-volume"]
      .firstUniformOutsideOpacity,
  ).toBeCloseTo(0.15, 2);
  expect(
    focusState.layers["utah-forge-phase3-seismic-browser"].firstUniformEnabled,
  ).toBe(1);

  await page.getByTestId("working-area-focus-mode").selectOption("inside-only");
  await expect
    .poll(async () => {
      const state = await workingAreaFocusSceneState(page);
      return state.focus?.outsideOpacityByLayerId[
        "utah-forge-mt-resistivity-full-density"
      ];
    })
    .toBe(0);
  focusState = await workingAreaFocusSceneState(page);
  expect(
    focusState.layers["utah-forge-mt-resistivity-volume"]
      .firstUniformOutsideOpacity,
  ).toBe(0);

  await page.getByTestId("scene-section-enabled").setChecked(true);
  await page.getByTestId("scene-section-plane-z-enabled").setChecked(true);
  await expect.poll(() => sceneSectionState(page)).not.toBeNull();
  await expect
    .poll(async () => {
      const state = await workingAreaFocusSceneState(page);
      return state.layers["utah-forge-mt-resistivity-volume"]
        .firstUniformEnabled;
    })
    .toBe(1);

  const globalSettingsRow = page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
  await expect(globalSettingsRow).toHaveCount(1);
  await globalSettingsRow.click();
  await expect(
    page.getByTestId("working-area-focus-enabled"),
  ).not.toBeChecked();
  await selectForgePageRow(page, "01.");
  await expect(page.getByTestId("working-area-focus-enabled")).toBeChecked();

  const environment = readJsonFile<Record<string, unknown>>(
    UTAH_FORGE_ENVIRONMENT_PATH,
  );
  const basePage = readJsonFile<Record<string, unknown>>(
    UTAH_FORGE_PAGE06_PATH,
  );
  const baseOverrides =
    typeof basePage.layerOverrides === "object" &&
    basePage.layerOverrides !== null
      ? (basePage.layerOverrides as Record<string, unknown>)
      : {};
  const focusedOverride = {
    workingAreaFocusEnabled: true,
    workingAreaFocusMode: "outside-context",
    workingAreaFocusBoundsLayerId: "utah-forge-phase3-working-area",
    workingAreaFocusTargetLayerIds: [
      "utah-forge-mt-resistivity-full-density",
      "utah-forge-mt-resistivity-volume",
      "utah-forge-phase3-seismic-browser",
    ],
    workingAreaFocusOutsideOpacityByLayerId: {
      "utah-forge-mt-resistivity-full-density": 0.15,
      "utah-forge-mt-resistivity-volume": 0.15,
      "utah-forge-phase3-seismic-browser": 0.15,
    },
    workingAreaFocusHelperVisible: true,
  };
  const unfocusedPage = {
    ...basePage,
    id: "working-area-focus-transition-from",
    layerOverrides: {
      ...baseOverrides,
      "utah-forge-working-area-focus": {
        ...focusedOverride,
        workingAreaFocusEnabled: false,
      },
    },
  };
  const focusedPage = {
    ...basePage,
    id: "working-area-focus-transition-to",
    layerOverrides: {
      ...baseOverrides,
      "utah-forge-working-area-focus": focusedOverride,
    },
  };
  await runForgeDataTransitionProbe(
    page,
    environment,
    unfocusedPage,
    focusedPage,
    1200,
  );
  await page.waitForTimeout(250);
  await expect
    .poll(async () => {
      const state = await workingAreaFocusSceneState(page);
      return state.focus?.outsideOpacityByLayerId[
        "utah-forge-mt-resistivity-volume"
      ];
    })
    .toBeCloseTo(0.15, 2);

  expect(consoleErrors).toEqual([]);
});
