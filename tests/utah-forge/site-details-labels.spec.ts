import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";
import { chooseLabelAnchors } from "../../src/ui/SceneLabels";

const TOPO_ALIGNMENT_EPSILON_M = 0.001;

type TopoAlignmentRuntimeSample = {
  renderedTopoSurfaceKey: string | null;
  terrainVisible: boolean | null;
  terrainScaleZ: number | null;
  terrainPositionZ: number | null;
  station: {
    z: number;
    baseZ: number;
    liftM: number;
    topoZ: number | null;
  } | null;
  collar: {
    z: number;
    topoZ: number | null;
  } | null;
};

async function openPageByTitle(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Pages" }).click();
  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(3_500);
}

async function sampleTopoAlignmentRuntime(
  page: Page,
): Promise<TopoAlignmentRuntimeSample> {
  return page.evaluate(() => {
    type SceneHandle = {
      scene?: {
        traverse?: (visitor: (object: {
          name?: string;
          position?: { x: number; y: number; z: number };
          userData?: Record<string, unknown>;
        }) => void) => void;
      };
      manager?: {
        getLayer?: (id: string) => {
          visible?: boolean;
          scale?: { z?: number };
          position?: { z?: number };
        } | null;
        renderedTopoSurfaceKey?: () => string;
        renderedTopoSurfaceZ?: (x: number, y: number) => number | null;
        styleForLayer?: (id: string) => Record<string, unknown>;
      };
    };

    const handle = (window as unknown as { __scene?: SceneHandle }).__scene;
    const manager = handle?.manager;
    const terrain = manager?.getLayer?.("terrain") ?? null;
    const findObject = (
      predicate: (object: {
        name?: string;
        position?: { x: number; y: number; z: number };
        userData?: Record<string, unknown>;
      }) => boolean,
    ) => {
      let found:
        | {
            name?: string;
            position?: { x: number; y: number; z: number };
            userData?: Record<string, unknown>;
          }
        | null = null;
      handle?.scene?.traverse?.((object) => {
        if (!found && predicate(object)) found = object;
      });
      return found;
    };
    const station = findObject(
      (object) => object.userData?.pointMarker === true,
    );
    const collar = findObject(
      (object) => object.userData?.demoBoreholeCollar === true,
    );
    const stationStyle =
      manager?.styleForLayer?.("utah-forge-mt-stations") ?? {};
    const stationLift =
      typeof stationStyle.pointMarkerLiftM === "number"
        ? stationStyle.pointMarkerLiftM
        : 0;
    const topoFor = (object: typeof station) =>
      object?.position && manager?.renderedTopoSurfaceZ
        ? manager.renderedTopoSurfaceZ(object.position.x, object.position.y)
        : null;

    return {
      renderedTopoSurfaceKey: manager?.renderedTopoSurfaceKey?.() ?? null,
      terrainVisible:
        typeof terrain?.visible === "boolean" ? terrain.visible : null,
      terrainScaleZ:
        typeof terrain?.scale?.z === "number" ? terrain.scale.z : null,
      terrainPositionZ:
        typeof terrain?.position?.z === "number" ? terrain.position.z : null,
      station:
        station?.position && typeof station.userData?.baseZ === "number"
          ? {
              z: station.position.z,
              baseZ: station.userData.baseZ,
              liftM: stationLift,
              topoZ: topoFor(station),
            }
          : null,
      collar: collar?.position
        ? {
            z: collar.position.z,
            topoZ: topoFor(collar),
          }
        : null,
    };
  });
}

async function setRuntimeTopoAlignment(
  page: Page,
  aligned: boolean,
): Promise<void> {
  await page.evaluate((nextAligned) => {
    const handle = (
      window as unknown as {
        __scene?: {
          manager?: {
            appliedLayerStyles?: Map<string, Record<string, unknown>>;
            styleForLayer?: (id: string) => Record<string, unknown>;
            applyDemoBoreholeStyle?: (
              id: string,
              style: Record<string, unknown>,
            ) => void;
            applyPointMarkerStyle?: (
              id: string,
              style: Record<string, unknown>,
            ) => void;
          };
        };
      }
    ).__scene;
    const manager = handle?.manager;
    if (!manager) throw new Error("Scene manager unavailable");

    const siteId = "utah-forge-phase3-demo-boreholes";
    const stationId = "utah-forge-mt-stations";
    const siteStyle = {
      ...(manager.styleForLayer?.(siteId) ?? {}),
      siteDetailsAlignToTopo: nextAligned,
    };
    const stationStyle = {
      ...(manager.styleForLayer?.(stationId) ?? {}),
      pointMarkerAlignToTopo: nextAligned,
    };
    manager.appliedLayerStyles?.set(siteId, siteStyle);
    manager.appliedLayerStyles?.set(stationId, stationStyle);
    manager.applyDemoBoreholeStyle?.(siteId, siteStyle);
    manager.applyPointMarkerStyle?.(stationId, stationStyle);
  }, aligned);
}

async function hideRuntimeTopo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            currentVisibleLayerIds?: Set<string>;
            setVisible?: (visible: Set<string>) => void;
          };
        };
      }
    ).__scene?.manager;
    const current = new Set(manager?.currentVisibleLayerIds ?? []);
    current.delete("terrain");
    manager?.setVisible?.(current);
  });
}

function namedObject(
  displayName: string,
  userData: Record<string, unknown> = {},
): THREE.Object3D {
  const obj = new THREE.Object3D();
  obj.userData = { displayName, ...userData };
  return obj;
}

test("structured scene labels ignore unmanaged display names when anchors exist", () => {
  const structured = new THREE.Group();
  structured.add(namedObject("Raw well root", { sceneLabelEligible: false }));
  structured.add(namedObject("Raw collar mesh"));
  structured.add(namedObject("16A injection", { labelAnchor: true }));
  structured.add(
    namedObject("FORGE orientation block", { sceneLabelEligible: true }),
  );

  expect([...chooseLabelAnchors(structured).keys()].sort()).toEqual([
    "16A injection",
    "FORGE orientation block",
  ]);

  const legacy = new THREE.Group();
  legacy.add(namedObject("Legacy display label"));

  expect([...chooseLabelAnchors(legacy).keys()]).toEqual([
    "Legacy display label",
  ]);
});

test("Site Details exposes every authorable scene label in one inventory", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const forgeData = page.getByRole("button", { name: "Forge" }).first();
  await expect(forgeData).toBeVisible({ timeout: 30_000 });
  if ((await forgeData.getAttribute("aria-expanded")) !== "true") {
    await forgeData.click();
  }

  const siteDetails = page.getByRole("button", { name: "Site Details" }).first();
  await expect(siteDetails).toBeVisible({ timeout: 30_000 });
  if ((await siteDetails.getAttribute("aria-expanded")) !== "true") {
    await siteDetails.click();
  }

  await expect(page.getByText("Site Labels").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("site-details-always-on-top")).toBeVisible();
  await expect(page.getByTestId("site-details-align-to-topo")).toBeVisible();

  const expectedRows = [
    "site-details-label-16a-78-32-collar",
    "site-details-label-16a-78-32-toe",
    "site-details-label-16b-78-32-collar",
    "site-details-label-16b-78-32-toe",
    "site-details-label-orientation-block",
    "site-details-label-source-locations",
    "site-details-label-source-58-32-well",
    "site-details-label-source-78b-32-well",
    "site-details-label-source-bor1",
    "site-details-label-source-bor2",
    "site-details-label-source-bor3",
  ];
  for (const testId of expectedRows) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
});

test("GDR 1255 station controls expose independent topo alignment", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const forgeData = page.getByRole("button", { name: "Forge" }).first();
  await expect(forgeData).toBeVisible({ timeout: 30_000 });
  if ((await forgeData.getAttribute("aria-expanded")) !== "true") {
    await forgeData.click();
  }

  const mtResistivity = page
    .getByRole("button", { name: "MT resistivity" })
    .first();
  await expect(mtResistivity).toBeVisible({ timeout: 30_000 });
  if ((await mtResistivity.getAttribute("aria-expanded")) !== "true") {
    await mtResistivity.click();
  }

  const stations = page.getByText("GDR 1255 Station Locations").first();
  await expect(stations).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Show layer" }).first().click();
  await page.getByText("Appearance").first().click();

  await expect(page.getByTestId("point-marker-align-to-topo")).toBeVisible({
    timeout: 30_000,
  });
});

test("Site Details and GDR 1255 stations follow topo alignment runtime modes", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);
  await openPageByTitle(page, "MT Station Network");

  const aligned = await sampleTopoAlignmentRuntime(page);
  expect(aligned.renderedTopoSurfaceKey).toBe("topo:3.250000:-3125.000");
  expect(aligned.terrainVisible).toBe(true);
  expect(aligned.terrainScaleZ).toBe(3.25);
  expect(aligned.terrainPositionZ).toBe(-3125);
  expect(aligned.collar?.topoZ).not.toBeNull();
  expect(aligned.station?.topoZ).not.toBeNull();
  expect(
    Math.abs((aligned.collar?.z ?? 0) - (aligned.collar?.topoZ ?? 0)),
  ).toBeLessThan(TOPO_ALIGNMENT_EPSILON_M);
  expect(
    Math.abs(
      (aligned.station?.z ?? 0) -
        ((aligned.station?.topoZ ?? 0) + (aligned.station?.liftM ?? 0)),
    ),
  ).toBeLessThan(TOPO_ALIGNMENT_EPSILON_M);

  await setRuntimeTopoAlignment(page, false);
  const unaligned = await sampleTopoAlignmentRuntime(page);
  expect(unaligned.collar?.topoZ).not.toBeNull();
  expect(unaligned.station?.topoZ).not.toBeNull();
  expect(
    Math.abs(
      (unaligned.station?.z ?? 0) -
        ((unaligned.station?.baseZ ?? 0) + (unaligned.station?.liftM ?? 0)),
    ),
  ).toBeLessThan(TOPO_ALIGNMENT_EPSILON_M);
  expect(
    Math.abs((unaligned.collar?.z ?? 0) - (unaligned.collar?.topoZ ?? 0)),
  ).toBeGreaterThan(100);

  await setRuntimeTopoAlignment(page, true);
  await hideRuntimeTopo(page);
  const topoHidden = await sampleTopoAlignmentRuntime(page);
  expect(topoHidden.renderedTopoSurfaceKey).toBe("topo:hidden");
  expect(topoHidden.collar?.topoZ).toBeNull();
  expect(topoHidden.station?.topoZ).toBeNull();
  expect(
    Math.abs(
      (topoHidden.station?.z ?? 0) -
        ((topoHidden.station?.baseZ ?? 0) + (topoHidden.station?.liftM ?? 0)),
    ),
  ).toBeLessThan(TOPO_ALIGNMENT_EPSILON_M);
  expect(topoHidden.collar?.z).toBeCloseTo(unaligned.collar?.z ?? 0, 3);
});
