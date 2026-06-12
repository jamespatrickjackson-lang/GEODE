import { expect, test } from "@playwright/test";
import {
  hidePublicContextLayers,
  openForgeMtResistivityEditorContainers,
  sceneSectionState,
} from "./shared";

test.setTimeout(600_000);

const UTAH_FORGE_URL =
  process.env.GEOSEE_TEST_BASE_URL ?? "/?project=utah-forge";

async function setRangeInput(
  page: Parameters<typeof sceneSectionState>[0],
  testId: string,
  value: string,
): Promise<void> {
  const input = page.getByTestId(testId);
  await expect(input).toBeVisible();
  await input.evaluate((node, nextValue) => {
    const el = node as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, nextValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("scene section frames stay independent across X Y and Z planes", async ({
  page,
}) => {
  await page.goto(UTAH_FORGE_URL, { waitUntil: "networkidle" });
  await hidePublicContextLayers(page);
  await page.getByRole("button", { name: "Sections" }).click();
  await openForgeMtResistivityEditorContainers(page);

  await page.getByTestId("scene-section-enabled").setChecked(true);
  for (const axis of ["x", "y", "z"] as const) {
    await page.getByTestId(`scene-section-plane-${axis}-enabled`).setChecked(true);
    await page.getByTestId(`scene-section-frame-${axis}-enabled`).setChecked(true);
  }
  await setRangeInput(page, "scene-section-plane-x-position", "-6000");
  await setRangeInput(page, "scene-section-plane-y-position", "-10300");
  await setRangeInput(page, "scene-section-plane-z-position", "-2200");

  await setRangeInput(page, "scene-section-frame-x-min-a", "-20000");
  await setRangeInput(page, "scene-section-frame-x-max-a", "10000");
  await setRangeInput(page, "scene-section-frame-x-min-b", "-8000");
  await setRangeInput(page, "scene-section-frame-x-max-b", "500");
  await setRangeInput(page, "scene-section-frame-y-min-a", "-30000");
  await setRangeInput(page, "scene-section-frame-y-max-a", "5000");
  await setRangeInput(page, "scene-section-frame-y-min-b", "-12000");
  await setRangeInput(page, "scene-section-frame-y-max-b", "-1000");
  await setRangeInput(page, "scene-section-frame-z-min-a", "-15000");
  await setRangeInput(page, "scene-section-frame-z-max-a", "20000");
  await setRangeInput(page, "scene-section-frame-z-min-b", "-22000");
  await setRangeInput(page, "scene-section-frame-z-max-b", "30000");

  await expect
    .poll(() =>
      sceneSectionState(page).then((state) =>
        state.frameOutlines
          .filter((outline) => outline.isFrame)
          .map((outline) => outline.axis)
          .sort(),
      ),
    )
    .toEqual(["x", "y", "z"]);

  const initialState = await sceneSectionState(page);
  const initialBounds = Object.fromEntries(
    initialState.frameOutlines
      .filter((outline) => outline.isFrame)
      .map((outline) => [outline.axis, outline.bounds]),
  );
  expect(initialState.whiteFrameOutlineCount).toBe(0);
  expect(
    Object.fromEntries(
      initialState.frameOutlines
        .filter((outline) => outline.isFrame)
        .map((outline) => [outline.axis, outline.color]),
    ),
  ).toEqual({
    x: "ff6b78",
    y: "35c7e8",
    z: "f6d76b",
  });
  for (const outline of initialState.frameOutlines.filter(
    (candidate) => candidate.isFrame,
  )) {
    expect(outline.dashed).toBe(false);
    const component = outline.axis === "x" ? 0 : outline.axis === "y" ? 1 : 2;
    const expected = outline.axis === "x" ? -6000 : outline.axis === "y" ? -10300 : -2200;
    expect(outline.planeCoordinateIndex).toBe(component);
    expect(outline.planePositionM).toBeCloseTo(expected, 1);
  }
  expect(initialState.helperPickableKinds).toEqual(
    expect.arrayContaining([
      "push-pull",
      "frame-min-a",
      "frame-max-a",
      "frame-min-b",
      "frame-max-b",
    ]),
  );
  expect(initialState.helperPickableGeometryTypes).not.toContain("SphereGeometry");
  expect(initialState.helperPickableVisuals.every((visual) => visual === "double-arrow")).toBe(true);
  expect(initialState.helperPickableScales.every((scale) => scale === 3)).toBe(true);

  await setRangeInput(page, "scene-section-frame-x-max-a", "12000");
  await expect
    .poll(() =>
      sceneSectionState(page).then((state) => {
        const bounds = Object.fromEntries(
          state.frameOutlines
            .filter((outline) => outline.isFrame)
            .map((outline) => [outline.axis, outline.bounds]),
        );
        return {
          x: bounds.x?.maxAM ?? null,
          y: bounds.y,
          z: bounds.z,
        };
      }),
    )
    .toEqual({
      x: 12000,
      y: initialBounds.y,
      z: initialBounds.z,
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
      sceneSectionActiveAxis: "x",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000 },
        y: { enabled: false, positionM: -10300 },
        z: { enabled: false, positionM: -2200 },
      },
      sceneSectionFrameEnabled: false,
      sceneSectionFrameByAxis: {},
      sceneSectionWindowEnabled: true,
      sceneSectionWindowActiveAxis: "y",
      sceneSectionWindowByAxis: {
        y: {
          minAlongM: -30000,
          maxAlongM: 5000,
          bottomElevationM: -12000,
        },
      },
      sceneSectionHelperVisible: true,
    });
  });
  await expect
    .poll(() =>
      sceneSectionState(page).then((state) =>
        state.frameOutlines.map((outline) => ({
          axis: outline.axis,
          isFrame: outline.isFrame,
        })),
      ),
    )
    .toEqual([{ axis: "x", isFrame: false }]);
});

test("section object visibility groups section targets and enables stations", async ({
  page,
}) => {
  await page.goto(UTAH_FORGE_URL, { waitUntil: "networkidle" });
  await hidePublicContextLayers(page);
  await page.getByRole("button", { name: "Sections" }).click();
  await openForgeMtResistivityEditorContainers(page);

  await page.getByTestId("scene-section-enabled").setChecked(true);
  await page.getByTestId("scene-section-plane-z-enabled").setChecked(true);
  await page.getByTestId("scene-section-frame-z-enabled").setChecked(true);

  const expectedGroups = [
    "seismic-3d",
    "seismic-2d",
    "mt",
    "station-locations",
    "reference-context",
  ];
  for (const groupId of expectedGroups) {
    await expect(
      page
        .getByTestId(`scene-section-object-visibility-group-${groupId}`)
        .first(),
    ).toBeVisible();
  }

  const sliderIds = [
    "scene-section-object-opacity-z-product:utah-forge-phase3-seismic-browser:gdr-1141-forge3d-ani-psdm-stack-unenh",
    "scene-section-object-opacity-z-product:utah-forge-phase3-seismic-browser:gdr-1141-line-301-pdm-enh",
    "scene-section-object-opacity-z-layer:utah-forge-mt-resistivity-full-density",
    "scene-section-object-opacity-z-layer:utah-forge-mt-stations",
  ];
  for (const sliderId of sliderIds) {
    await expect(page.getByTestId(sliderId)).toBeEnabled();
  }

  await setRangeInput(
    page,
    "scene-section-object-opacity-z-layer:utah-forge-mt-stations",
    "0.25",
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                styleForLayer?: (id: string) => Record<string, unknown>;
              };
            };
          }
        ).__scene?.manager;
        const style = manager?.styleForLayer?.(
          "utah-forge-scene-section-planes",
        );
        const byFrame = style?.sceneSectionObjectVisibilityByFrameId as
          | Record<string, Record<string, { outsideOpacity?: unknown }>>
          | undefined;
        return byFrame?.["axis:z"]?.["layer:utah-forge-mt-stations"]
          ?.outsideOpacity;
      }),
    )
    .toBe(0.25);
});
