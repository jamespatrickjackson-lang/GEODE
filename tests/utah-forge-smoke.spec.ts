import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

test.setTimeout(900_000);

const SEISMIC_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json";
const SEISMIC_INVENTORY_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/inventory/seismic_source_inventory.json";
const SEISMIC_NAVIGATION_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/navigation/seismic_navigation.geojson";
const SEISMIC_DEMO_RECIPES_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_demo_recipes.json";
const MT_VOLUME_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/mt_volume_manifest.json";
const MT_THRESHOLD_SURFACES_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json";
const MT_STATION_QC_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/stations/mt_station_response_qc.json";
const PUBLIC_CONTEXT_DIR =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context";
const PUBLIC_CONTEXT_MANIFEST_PATH = `${PUBLIC_CONTEXT_DIR}/manifest.json`;

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

function changedByteCount(before: Buffer, after: Buffer): number {
  let changedBytes = 0;
  const byteLength = Math.min(before.length, after.length);
  for (let index = 0; index < byteLength; index += 1) {
    if (before[index] !== after[index]) changedBytes += 1;
  }
  return changedBytes;
}

async function openForgeDataEditorContainers(page: Page): Promise<void> {
  const openSection = async (
    name: string,
    timeout = 30_000,
    contentText?: string,
  ) => {
    const content = contentText ? page.getByText(contentText).first() : null;
    if (content && (await content.count()) > 0) {
      const contentVisible = await content.isVisible().catch(() => false);
      if (contentVisible) return;
    }
    const button = page.getByRole("button", { name }).first();
    try {
      await button.waitFor({ state: "visible", timeout });
    } catch {
      return;
    }
    const expanded = await button.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await button.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
      await button.click({ timeout }).catch(async () => {
        await button.click({ force: true, timeout }).catch(() => {});
      });
    }
    if (content) {
      await content.waitFor({ state: "visible", timeout }).catch(() => {});
    }
  };

  await openSection("Public Topo Map", 30_000, "Topo layers");
  await openSection("Topo layers", 30_000, "Public terrain surface");
  await openSection("FORGE Data", 30_000, "Scene section planes");
  await openSection("Working area", 10_000, "Phase 3 required working area");
  await openSection("Scene section planes", 10_000, "section plane");
  await openSection("Seismic analysis", 10_000, "Seismic browser");
  await openSection("MT resistivity", 30_000, "3D MT top surface");
  await openSection("Other", 5_000, "Foundation");
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
}

async function setForgeLayerVisible(
  page: Page,
  label: string,
  visible: boolean,
): Promise<void> {
  const layerItem = page
    .locator('[data-dev-note*="layerItemStyle"]')
    .filter({ hasText: label })
    .first();
  await expect(layerItem).toBeVisible();
  const checkbox = layerItem.locator('input[type="checkbox"]').first();
  if ((await checkbox.isChecked()) !== visible) {
    await checkbox.setChecked(visible);
  }
}

function forgeLayerItem(page: Page, label: string): Locator {
  return page
    .locator('[data-dev-note*="layerItemStyle"]')
    .filter({ hasText: label })
    .first();
}

async function ensureForgeLayerVisible(page: Page, label: string): Promise<void> {
  await setForgeLayerVisible(page, label, true);
}

async function hidePublicContextLayers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
        };
      };
    }).__scene?.manager;
    for (const id of [
      "terrain",
      "transport-roads",
      "hydrography-streams",
      "hydrography-lakes",
    ]) {
      const layer = manager?.getLayer?.(id);
      if (layer) layer.visible = false;
    }
  });
}

async function revealSeismicCapabilityProduct(
  page: Page,
  productId: string,
): Promise<void> {
  const productItem = page.getByTestId(`seismic-capability-product-${productId}`);
  await productItem
    .getByTestId(`seismic-capability-product-visible-${productId}`)
    .setChecked(true);
  await productItem.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
}

type SeismicSceneState = {
  layerVisible: boolean;
  selectedProductId: string | null;
  appliedRenderMode: string | null;
  visibleProductIds: string[];
  visibleSections: number;
  visibleVolumes: number;
  visibleNavigation: number;
  visibleNavigationByRole: {
    sources: number;
    receivers: number;
    lines: number;
  };
  visibleSectionProductIds: string[];
  visibleSectionAxes: string[];
  visibleSectionObjectXByProduct: Record<string, number[]>;
  visibleVolumeProductIds: string[];
  capabilityPresetId: string | null;
  comparisonMode: string | null;
  comparisonSpacingM: number | null;
  sliceThroughVolume: boolean;
  removeBackground: boolean;
  navigationRoleVisibility: {
    sources: boolean;
    receivers: boolean;
    lines: boolean;
  };
  mtFullDensityOpacity: number | null;
  firstVisibleSectionZ: number | null;
  firstVisibleSectionColor: number[] | null;
  firstVisibleSectionAlpha: number | null;
  firstVisibleSectionMinAlpha: number | null;
  firstVisibleVolumeUniforms: {
    amplitudeMin: number | null;
    amplitudeMax: number | null;
    amplitudeGamma: number | null;
    colormap: number | null;
    opacity: number | null;
    removeBackground: number | null;
    backgroundCutoff: number | null;
    sampleSteps: number | null;
  } | null;
};

type SceneSectionState = {
  helperPickables: number;
  helperPickableNames: string[];
  helperPickableAxes: string[];
  helperPickableKinds: string[];
  helperPickableDirections: number[];
  firstVisibleVolumeSectionUniforms: {
    enabled: number | null;
    mode: number | null;
    planeCount: number | null;
    normals: number[][] | null;
    positions: number[] | null;
    thickness: number[] | null;
    inverts: number[] | null;
  } | null;
  mtClippedMaterials: number;
  mtFirstClippingPlane: {
    normal: number[];
    constant: number;
  } | null;
};

type MtVolumeSceneState = {
  volumeLayerVisible: boolean;
  selectedProductId: string | null;
  totalVolumeCount: number;
  visibleVolumeCount: number;
  visibleProductIds: string[];
  firstVisibleUniforms: {
    opacity: number | null;
    density: number | null;
    sampleSteps: number | null;
    transferMode: number | null;
    maskVisible: number | null;
    thresholdMin: number | null;
    thresholdMax: number | null;
    sceneSectionEnabled: number | null;
    sceneSectionPlaneCount: number | null;
  } | null;
  thresholdLayerVisible: boolean;
  visibleThresholdSurfaceIds: string[];
  thresholdWireframe: boolean | null;
  selectedStationId: string | null;
};

type SectionIsoSceneState = {
  targets: Array<{
    targetKey: string;
    layerId: string;
    sectionId: string;
    label: string;
    group: string;
    visible: boolean;
  }>;
  overlayTargets: string[];
  overlayPlanePositions: number[];
  lineOverlayCount: number;
  bandOverlayCount: number;
  firstSourceOpacity: number | null;
  firstLineVertexCount: number | null;
  firstBandUniforms: {
    isoMin: number | null;
    isoMax: number | null;
    levelCount: number | null;
    opacity: number | null;
    fillOffset: number | null;
  } | null;
};

async function seismicSceneState(page: Page): Promise<SeismicSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => {
            visible: boolean;
            userData: Record<string, unknown>;
            traverse: (fn: (obj: {
              visible: boolean;
              userData?: Record<string, unknown>;
              geometry?: {
                getAttribute?: (name: string) => {
                  count: number;
                  getZ?: (index: number) => number;
                  getX?: (index: number) => number;
                  getY?: (index: number) => number;
                };
              };
              material?: {
                opacity?: unknown;
                uniforms?: Record<string, { value: unknown }>;
              } | Array<{
                opacity?: unknown;
                uniforms?: Record<string, { value: unknown }>;
              }>;
              position?: { x: number; y: number; z: number };
            }) => void) => void;
          } | undefined;
        };
      };
    }).__scene;
    const layer = sceneHandle?.manager?.getLayer?.(
      "utah-forge-phase3-seismic-browser",
    );
    const mtLayer = sceneHandle?.manager?.getLayer?.(
      "utah-forge-mt-resistivity-full-density",
    );
    if (!layer) {
      return {
        layerVisible: false,
        selectedProductId: null,
        appliedRenderMode: null,
        visibleProductIds: [],
        visibleSections: 0,
        visibleVolumes: 0,
        visibleNavigation: 0,
        visibleNavigationByRole: { sources: 0, receivers: 0, lines: 0 },
        visibleSectionProductIds: [],
        visibleSectionAxes: [],
        visibleSectionObjectXByProduct: {},
        visibleVolumeProductIds: [],
        capabilityPresetId: null,
        comparisonMode: null,
        comparisonSpacingM: null,
        sliceThroughVolume: false,
        removeBackground: false,
        navigationRoleVisibility: { sources: false, receivers: false, lines: false },
        mtFullDensityOpacity: null,
        firstVisibleSectionZ: null,
        firstVisibleSectionColor: null,
        firstVisibleSectionAlpha: null,
        firstVisibleSectionMinAlpha: null,
        firstVisibleVolumeUniforms: null,
      };
    }

    const sectionProductIds = new Set<string>();
    const sectionAxes = new Set<string>();
    const sectionObjectXByProduct: Record<string, number[]> = {};
    const volumeProductIds = new Set<string>();
    let visibleSections = 0;
    let visibleVolumes = 0;
    let visibleNavigation = 0;
    const visibleNavigationByRole = { sources: 0, receivers: 0, lines: 0 };
    let mtFullDensityOpacity: number | null = null;
    let firstVisibleSectionZ: number | null = null;
    let firstVisibleSectionColor: number[] | null = null;
    let firstVisibleSectionAlpha: number | null = null;
    let firstVisibleSectionMinAlpha: number | null = null;
    let firstVisibleVolumeUniforms: SeismicSceneState["firstVisibleVolumeUniforms"] =
      null;

    layer.traverse((obj) => {
      const data = obj.userData ?? {};
      if (data.seismicNavigation === true && obj.visible) {
        visibleNavigation += 1;
        if (
          data.seismicNavigationRole === "sources" ||
          data.seismicNavigationRole === "receivers" ||
          data.seismicNavigationRole === "lines"
        ) {
          visibleNavigationByRole[data.seismicNavigationRole] += 1;
        }
      }
      if (data.seismicSection === true && obj.visible) {
        visibleSections += 1;
        if (typeof data.seismicProductId === "string") {
          sectionProductIds.add(data.seismicProductId);
          sectionObjectXByProduct[data.seismicProductId] = [
            ...(sectionObjectXByProduct[data.seismicProductId] ?? []),
            obj.position?.x ?? 0,
          ];
        }
        if (typeof data.seismicSectionAxis === "string") {
          sectionAxes.add(data.seismicSectionAxis);
        }
        if (firstVisibleSectionZ === null) {
          const position = obj.geometry?.getAttribute?.("position");
          const color = obj.geometry?.getAttribute?.("color");
          const alpha = obj.geometry?.getAttribute?.("seismicAlpha");
          firstVisibleSectionZ =
            position?.getZ?.(Math.max(0, position.count - 1)) ?? null;
          if (color?.getX && color.getY && color.getZ) {
            firstVisibleSectionColor = [
              color.getX(0),
              color.getY(0),
              color.getZ(0),
            ];
          }
          firstVisibleSectionAlpha = alpha?.getX?.(0) ?? null;
          if (alpha?.getX) {
            let minAlpha = Number.POSITIVE_INFINITY;
            for (let i = 0; i < alpha.count; i += 1) {
              minAlpha = Math.min(minAlpha, alpha.getX(i));
            }
            firstVisibleSectionMinAlpha = Number.isFinite(minAlpha)
              ? minAlpha
              : null;
          }
        }
      }
      if (data.seismicRaymarchVolume === true && obj.visible) {
        visibleVolumes += 1;
        if (typeof data.seismicProductId === "string") {
          volumeProductIds.add(data.seismicProductId);
        }
        if (!firstVisibleVolumeUniforms) {
          const material = Array.isArray(obj.material)
            ? obj.material[0]
            : obj.material;
          const uniforms = material?.uniforms ?? {};
          firstVisibleVolumeUniforms = {
            amplitudeMin:
              typeof uniforms.uAmplitudeMin?.value === "number"
                ? uniforms.uAmplitudeMin.value
                : null,
            amplitudeMax:
              typeof uniforms.uAmplitudeMax?.value === "number"
                ? uniforms.uAmplitudeMax.value
                : null,
            amplitudeGamma:
              typeof uniforms.uAmplitudeGamma?.value === "number"
                ? uniforms.uAmplitudeGamma.value
                : null,
            colormap:
              typeof uniforms.uColormap?.value === "number"
                ? uniforms.uColormap.value
                : null,
            opacity:
              typeof uniforms.uOpacity?.value === "number"
                ? uniforms.uOpacity.value
                : null,
            removeBackground:
              typeof uniforms.uRemoveBackground?.value === "number"
                ? uniforms.uRemoveBackground.value
                : null,
            backgroundCutoff:
              typeof uniforms.uBackgroundCutoff?.value === "number"
                ? uniforms.uBackgroundCutoff.value
                : null,
            sampleSteps:
              typeof uniforms.uSampleSteps?.value === "number"
                ? uniforms.uSampleSteps.value
                : null,
          };
        }
      }
    });

    mtLayer?.traverse((obj) => {
      if (mtFullDensityOpacity !== null) return;
      const materials = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      for (const material of materials) {
        if (typeof material.opacity === "number") {
          mtFullDensityOpacity = material.opacity;
          return;
        }
      }
    });

    return {
      layerVisible: layer.visible,
      selectedProductId:
        typeof layer.userData.seismicSelectedProductId === "string"
          ? layer.userData.seismicSelectedProductId
          : null,
      appliedRenderMode:
        typeof layer.userData.seismicAppliedRenderMode === "string"
          ? layer.userData.seismicAppliedRenderMode
          : null,
      visibleProductIds: Array.isArray(layer.userData.seismicVisibleProductIds)
        ? (layer.userData.seismicVisibleProductIds as string[])
        : [],
      visibleSections,
      visibleVolumes,
      visibleNavigation,
      visibleNavigationByRole,
      visibleSectionProductIds: Array.from(sectionProductIds),
      visibleSectionAxes: Array.from(sectionAxes),
      visibleSectionObjectXByProduct: sectionObjectXByProduct,
      visibleVolumeProductIds: Array.from(volumeProductIds),
      capabilityPresetId:
        typeof layer.userData.seismicCapabilityPresetId === "string"
          ? layer.userData.seismicCapabilityPresetId
          : null,
      comparisonMode:
        typeof layer.userData.seismicComparisonMode === "string"
          ? layer.userData.seismicComparisonMode
          : null,
      comparisonSpacingM:
        typeof layer.userData.seismicComparisonSpacingM === "number"
          ? layer.userData.seismicComparisonSpacingM
          : null,
      sliceThroughVolume: layer.userData.seismicSliceThroughVolume === true,
      removeBackground: layer.userData.seismicRemoveBackground === true,
      navigationRoleVisibility:
        typeof layer.userData.seismicNavigationRoleVisibility === "object" &&
        layer.userData.seismicNavigationRoleVisibility !== null
          ? (layer.userData.seismicNavigationRoleVisibility as {
              sources: boolean;
              receivers: boolean;
              lines: boolean;
            })
          : { sources: false, receivers: false, lines: false },
      mtFullDensityOpacity,
      firstVisibleSectionZ,
      firstVisibleSectionColor,
      firstVisibleSectionAlpha,
      firstVisibleSectionMinAlpha,
      firstVisibleVolumeUniforms,
    };
  });
}

async function sceneSectionState(page: Page): Promise<SceneSectionState> {
  return page.evaluate(() => {
    const sceneHandle = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => {
            traverse: (fn: (obj: {
              visible: boolean;
              userData?: Record<string, unknown>;
              material?: {
                clippingPlanes?: Array<{
                  normal?: { x?: unknown; y?: unknown; z?: unknown };
                  constant?: unknown;
                }> | null;
                uniforms?: Record<string, { value: unknown }>;
              } | Array<{
                clippingPlanes?: Array<{
                  normal?: { x?: unknown; y?: unknown; z?: unknown };
                  constant?: unknown;
                }> | null;
                uniforms?: Record<string, { value: unknown }>;
              }>;
            }) => void) => void;
          } | undefined;
          listSceneSectionPlanePickables?: () => Array<{
            name?: string;
            userData?: Record<string, unknown>;
          }>;
        };
      };
    }).__scene;
    const manager = sceneHandle?.manager;
    const seismicLayer = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    const mtLayer = manager?.getLayer?.("utah-forge-mt-resistivity-full-density");
    const helperPickables = manager?.listSceneSectionPlanePickables?.() ?? [];
    const vectorToArray = (
      value: unknown,
    ): [number, number, number] | null => {
      if (typeof value !== "object" || value === null) return null;
      const vector = value as { x?: unknown; y?: unknown; z?: unknown };
      const clean = (n: number) => (Object.is(n, -0) ? 0 : n);
      return typeof vector.x === "number" &&
        typeof vector.y === "number" &&
        typeof vector.z === "number"
        ? [clean(vector.x), clean(vector.y), clean(vector.z)]
        : null;
    };
    let firstVisibleVolumeSectionUniforms: SceneSectionState["firstVisibleVolumeSectionUniforms"] =
      null;
    let mtClippedMaterials = 0;
    let mtFirstClippingPlane: SceneSectionState["mtFirstClippingPlane"] = null;

    seismicLayer?.traverse((obj) => {
      if (
        firstVisibleVolumeSectionUniforms ||
        obj.userData?.seismicRaymarchVolume !== true ||
        !obj.visible
      ) {
        return;
      }
      const material = Array.isArray(obj.material)
        ? obj.material[0]
        : obj.material;
      const uniforms = material?.uniforms ?? {};
      firstVisibleVolumeSectionUniforms = {
        enabled:
          typeof uniforms.uSceneSectionEnabled?.value === "number"
            ? uniforms.uSceneSectionEnabled.value
            : null,
        mode:
          typeof uniforms.uSceneSectionMode?.value === "number"
            ? uniforms.uSceneSectionMode.value
            : null,
        planeCount:
          typeof uniforms.uSceneSectionPlaneCount?.value === "number"
            ? uniforms.uSceneSectionPlaneCount.value
            : null,
        normals: Array.isArray(uniforms.uSceneSectionNormals?.value)
          ? (uniforms.uSceneSectionNormals.value as unknown[])
              .map(vectorToArray)
              .filter((normal): normal is [number, number, number] => !!normal)
          : null,
        positions: Array.isArray(uniforms.uSceneSectionPositions?.value)
          ? (uniforms.uSceneSectionPositions.value as number[])
          : null,
        thickness: Array.isArray(uniforms.uSceneSectionThickness?.value)
          ? (uniforms.uSceneSectionThickness.value as number[])
          : null,
        inverts: Array.isArray(uniforms.uSceneSectionInvert?.value)
          ? (uniforms.uSceneSectionInvert.value as number[])
          : null,
      };
    });

    mtLayer?.traverse((obj) => {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      for (const material of materials) {
        if (
          Array.isArray(material.clippingPlanes) &&
          material.clippingPlanes.length > 0
        ) {
          mtClippedMaterials += 1;
          if (!mtFirstClippingPlane) {
            const plane = material.clippingPlanes[0];
            const normal = vectorToArray(plane.normal);
            if (normal && typeof plane.constant === "number") {
              mtFirstClippingPlane = {
                normal,
                constant: plane.constant,
              };
            }
          }
        }
      }
    });

    return {
      helperPickables: helperPickables.length,
      helperPickableNames: helperPickables.map((pickable) => pickable.name ?? ""),
      helperPickableAxes: helperPickables.map((pickable) =>
        typeof pickable.userData?.sceneSectionAxis === "string"
          ? pickable.userData.sceneSectionAxis
          : "",
      ),
      helperPickableKinds: helperPickables.map((pickable) =>
        typeof pickable.userData?.sceneSectionPlaneHandleKind === "string"
          ? pickable.userData.sceneSectionPlaneHandleKind
          : "",
      ),
      helperPickableDirections: helperPickables
        .map((pickable) => pickable.userData?.sceneSectionPlaneHandleDirection)
        .filter((direction): direction is number => typeof direction === "number"),
      firstVisibleVolumeSectionUniforms,
      mtClippedMaterials,
      mtFirstClippingPlane,
    };
  });
}

async function mtVolumeSceneState(page: Page): Promise<MtVolumeSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => {
            visible: boolean;
            userData: Record<string, unknown>;
            traverse: (fn: (obj: {
              visible: boolean;
              userData?: Record<string, unknown>;
              material?: {
                wireframe?: boolean;
                uniforms?: Record<string, { value: unknown }>;
              } | Array<{
                wireframe?: boolean;
                uniforms?: Record<string, { value: unknown }>;
              }>;
            }) => void) => void;
          } | undefined;
        };
      };
    }).__scene;
    const manager = sceneHandle?.manager;
    const volumeLayer = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    const thresholdLayer = manager?.getLayer?.(
      "utah-forge-mt-resistivity-threshold-surfaces",
    );
    const stationLayer = manager?.getLayer?.("utah-forge-mt-stations");
    let visibleVolumeCount = 0;
    let totalVolumeCount = 0;
    const visibleProductIds: string[] = [];
    let firstVisibleUniforms: MtVolumeSceneState["firstVisibleUniforms"] = null;
    volumeLayer?.traverse((obj) => {
      if (obj.userData?.scalarVolume !== true) return;
      totalVolumeCount += 1;
      if (!obj.visible) return;
      visibleVolumeCount += 1;
      const productId = obj.userData.scalarVolumeProductId;
      if (typeof productId === "string") visibleProductIds.push(productId);
      if (!firstVisibleUniforms) {
        const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const uniforms = material?.uniforms ?? {};
        firstVisibleUniforms = {
          opacity:
            typeof uniforms.uOpacity?.value === "number"
              ? uniforms.uOpacity.value
              : null,
          density:
            typeof uniforms.uDensity?.value === "number"
              ? uniforms.uDensity.value
              : null,
          sampleSteps:
            typeof uniforms.uSampleSteps?.value === "number"
              ? uniforms.uSampleSteps.value
              : null,
          transferMode:
            typeof uniforms.uTransferMode?.value === "number"
              ? uniforms.uTransferMode.value
              : null,
          maskVisible:
            typeof uniforms.uMaskVisible?.value === "number"
              ? uniforms.uMaskVisible.value
              : null,
          thresholdMin:
            typeof uniforms.uThresholdMin?.value === "number"
              ? uniforms.uThresholdMin.value
              : null,
          thresholdMax:
            typeof uniforms.uThresholdMax?.value === "number"
              ? uniforms.uThresholdMax.value
              : null,
          sceneSectionEnabled:
            typeof uniforms.uSceneSectionEnabled?.value === "number"
              ? uniforms.uSceneSectionEnabled.value
              : null,
          sceneSectionPlaneCount:
            typeof uniforms.uSceneSectionPlaneCount?.value === "number"
              ? uniforms.uSceneSectionPlaneCount.value
              : null,
        };
      }
    });
    const visibleThresholdSurfaceIds: string[] = [];
    let thresholdWireframe: boolean | null = null;
    thresholdLayer?.traverse((obj) => {
      if (obj.userData?.mtThresholdSurfacePreview !== true || !obj.visible) return;
      const surfaceId = obj.userData.mtThresholdSurfaceId;
      if (typeof surfaceId === "string") visibleThresholdSurfaceIds.push(surfaceId);
      const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (typeof material?.wireframe === "boolean") {
        thresholdWireframe = material.wireframe;
      }
    });
    return {
      volumeLayerVisible: volumeLayer?.visible ?? false,
      selectedProductId:
        typeof volumeLayer?.userData.scalarVolumeSelectedProductId === "string"
          ? volumeLayer.userData.scalarVolumeSelectedProductId
          : null,
      totalVolumeCount,
      visibleVolumeCount,
      visibleProductIds,
      firstVisibleUniforms,
      thresholdLayerVisible: thresholdLayer?.visible ?? false,
      visibleThresholdSurfaceIds,
      thresholdWireframe,
      selectedStationId:
        typeof stationLayer?.userData.mtStationQcSelectedStationId === "string"
          ? stationLayer.userData.mtStationQcSelectedStationId
          : null,
    };
  });
}

async function sectionIsoSceneState(
  page: Page,
  groupFilter = "mt-slices",
): Promise<SectionIsoSceneState> {
  return page.evaluate((groupFilterArg) => {
    const sceneHandle = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => {
            visible: boolean;
            traverse: (fn: (obj: {
              visible: boolean;
              name?: string;
              userData?: Record<string, unknown>;
              geometry?: {
                getAttribute?: (name: string) => { count: number } | undefined;
              };
              material?: {
                opacity?: unknown;
                uniforms?: Record<string, { value: unknown }>;
              } | Array<{
                opacity?: unknown;
                uniforms?: Record<string, { value: unknown }>;
              }>;
              traverse?: (fn: (child: {
                name?: string;
                userData?: Record<string, unknown>;
                geometry?: {
                  getAttribute?: (name: string) => { count: number } | undefined;
                };
                material?: {
                  opacity?: unknown;
                  uniforms?: Record<string, { value: unknown }>;
                } | Array<{
                  opacity?: unknown;
                  uniforms?: Record<string, { value: unknown }>;
                }>;
              }) => void) => void;
            }) => void) => void;
          } | undefined;
          listScalarSectionIsoTargets?: () => Array<{
            targetKey: string;
            layerId: string;
            sectionId: string;
            label: string;
            group?: string;
            visible: boolean;
          }>;
          listSectionIsoTargets?: () => Array<{
            targetKey: string;
            layerId: string;
            sectionId: string;
            label: string;
            group: string;
            visible: boolean;
          }>;
        };
      };
    }).__scene;
    const manager = sceneHandle?.manager;
    const targets = (
      manager?.listSectionIsoTargets?.() ??
      manager?.listScalarSectionIsoTargets?.() ??
      []
    ).filter((target) =>
      groupFilterArg ? (target.group ?? "mt-slices") === groupFilterArg : true,
    );
    const targetKeys = new Set(targets.map((target) => target.targetKey));
    const layerIds = Array.from(new Set(targets.map((target) => target.layerId)));
    let lineOverlayCount = 0;
    let bandOverlayCount = 0;
    let firstLineVertexCount: number | null = null;
    let firstBandUniforms: SectionIsoSceneState["firstBandUniforms"] = null;
    let firstSourceOpacity: number | null = null;
    const overlayTargets = new Set<string>();
    const overlayPlanePositions: number[] = [];
    const readSourceOpacity = (
      material:
        | {
            opacity?: unknown;
            uniforms?: Record<string, { value: unknown }>;
          }
        | Array<{
            opacity?: unknown;
            uniforms?: Record<string, { value: unknown }>;
          }>
        | undefined,
    ): number | null => {
      const first = Array.isArray(material) ? material[0] : material;
      if (!first) return null;
      if (typeof first.uniforms?.uOpacity?.value === "number") {
        return first.uniforms.uOpacity.value;
      }
      if (typeof first.opacity === "number") return first.opacity;
      return null;
    };
    const matchesSourceGroup = (obj: {
      visible: boolean;
      userData?: Record<string, unknown>;
    }): boolean => {
      const data = obj.userData ?? {};
      if (!obj.visible) return false;
      if (data.scalarSectionIsoOverlay === true) return false;
      if (groupFilterArg === "mt-slices") {
        return data.resistivitySlicePreview === true;
      }
      if (groupFilterArg === "mt-volume-cuts") {
        return data.scalarVolume === true;
      }
      if (groupFilterArg === "seismic-sections") {
        return data.seismicSection === true;
      }
      if (groupFilterArg === "seismic-volume-cuts") {
        return data.seismicRaymarchVolume === true;
      }
      return false;
    };

    for (const layerId of layerIds) {
      const layer = manager?.getLayer?.(layerId);
      layer?.traverse((obj) => {
        if (firstSourceOpacity === null && matchesSourceGroup(obj)) {
          firstSourceOpacity = readSourceOpacity(obj.material);
        }
        const root = obj.userData?.scalarSectionIsoOverlayRoot as
          | {
              userData?: Record<string, unknown>;
              traverse?: (fn: (child: {
                name?: string;
                userData?: Record<string, unknown>;
                geometry?: {
                  getAttribute?: (name: string) => { count: number } | undefined;
                };
                material?: {
                  uniforms?: Record<string, { value: unknown }>;
                } | Array<{
                  uniforms?: Record<string, { value: unknown }>;
                }>;
              }) => void) => void;
            }
          | undefined;
        if (!root?.traverse) return;
        const targetKey = root.userData?.sectionIsoTargetKey;
        if (typeof targetKey !== "string" || !targetKeys.has(targetKey)) return;
        overlayTargets.add(targetKey);
        if (typeof obj.userData?.sectionIsoPlanePositionM === "number") {
          overlayPlanePositions.push(obj.userData.sectionIsoPlanePositionM);
        }
        root.traverse((child) => {
          if (child.userData?.scalarSectionIsoOverlay !== true) return;
          if (child.name === "scalar-section-iso-line-overlay") {
            lineOverlayCount += 1;
            firstLineVertexCount =
              firstLineVertexCount ??
              child.geometry?.getAttribute?.("position")?.count ??
              null;
          }
          if (child.name === "scalar-section-iso-band-overlay") {
            bandOverlayCount += 1;
            const material = Array.isArray(child.material)
              ? child.material[0]
              : child.material;
            const uniforms = material?.uniforms ?? {};
            firstBandUniforms =
              firstBandUniforms ?? {
                isoMin:
                  typeof uniforms.uIsoMin?.value === "number"
                    ? uniforms.uIsoMin.value
                    : null,
                isoMax:
                  typeof uniforms.uIsoMax?.value === "number"
                    ? uniforms.uIsoMax.value
                    : null,
                levelCount:
                  typeof uniforms.uLevelCount?.value === "number"
                    ? uniforms.uLevelCount.value
                    : null,
                opacity:
                  typeof uniforms.uOpacity?.value === "number"
                    ? uniforms.uOpacity.value
                    : null,
                fillOffset:
                  typeof uniforms.uFillOffset?.value === "number"
                    ? uniforms.uFillOffset.value
                    : null,
              };
          }
        });
      });
    }

    return {
      targets,
      overlayTargets: Array.from(overlayTargets),
      overlayPlanePositions,
      lineOverlayCount,
      bandOverlayCount,
      firstSourceOpacity,
      firstLineVertexCount,
      firstBandUniforms,
    };
  }, groupFilter);
}

test("Utah FORGE Phase 3 seismic artifacts are browser-ready", async () => {
  const project = readJsonFile<{
    layers: Array<{
      id: string;
      type: string;
      files?: Record<string, string>;
      previewFiles?: Record<string, string>;
      metadata?: Record<string, unknown>;
    }>;
  }>("projects/utah-forge/project.json");
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );
  const mtVolumeLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-mt-resistivity-volume",
  );
  const mtThresholdLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-mt-resistivity-threshold-surfaces",
  );
  const workingAreaLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-working-area",
  );
  const publicTerrainLayer = project.layers.find((layer) => layer.id === "terrain");
  const publicRoadsLayer = project.layers.find(
    (layer) => layer.id === "transport-roads",
  );
  const publicStreamsLayer = project.layers.find(
    (layer) => layer.id === "hydrography-streams",
  );
  const publicWaterLayer = project.layers.find(
    (layer) => layer.id === "hydrography-lakes",
  );
  const workingArea = workingAreaLayer?.metadata?.phase3WorkingArea as
    | {
        sceneBounds?: { min?: number[]; max?: number[] };
        footprintWidthM?: number;
        footprintHeightM?: number;
        source3dNavigationEnvelope?: {
          min?: number[];
          max?: number[];
          pointCount?: number;
        };
      }
    | undefined;
  expect(seismicLayer?.type).toBe("seismic");
  expect(seismicLayer?.previewFiles?.seismicManifest).toBe(SEISMIC_MANIFEST_PATH);
  expect(seismicLayer?.previewFiles?.seismicDemoRecipes).toBe(
    SEISMIC_DEMO_RECIPES_PATH,
  );
  expect(workingAreaLayer?.type).toBe("line");
  expect(publicTerrainLayer?.type).toBe("geotiff");
  expect(publicTerrainLayer?.files?.raster).toBe(
    `${PUBLIC_CONTEXT_DIR}/terrain_public_context_1000m.tif`,
  );
  expect(publicRoadsLayer?.type).toBe("line");
  expect(publicRoadsLayer?.files?.geojson).toBe(`${PUBLIC_CONTEXT_DIR}/roads.geojson`);
  expect(publicStreamsLayer?.type).toBe("line");
  expect(publicStreamsLayer?.files?.geojson).toBe(
    `${PUBLIC_CONTEXT_DIR}/hydrography_streams.geojson`,
  );
  expect(publicStreamsLayer?.files?.lakesGeojson).toBe(
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
  );
  expect(publicWaterLayer?.type).toBe("polygon");
  expect(publicWaterLayer?.files?.geojson).toBe(
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
  );
  for (const layer of [
    publicTerrainLayer,
    publicRoadsLayer,
    publicStreamsLayer,
    publicWaterLayer,
  ]) {
    const geoTransform = layer?.metadata?.geoTransform as
      | {
          sourceCrs?: string;
          sceneOriginUtm?: { easting_m?: number; northing_m?: number };
          bounds?: { min?: number[]; max?: number[] };
        }
      | undefined;
    expect(geoTransform?.sourceCrs).toBe("EPSG:26912");
    expect(geoTransform?.sceneOriginUtm?.easting_m).toBeCloseTo(341467.35, 2);
    expect(geoTransform?.sceneOriginUtm?.northing_m).toBeCloseTo(4273374.5, 2);
    expect(geoTransform?.bounds?.min?.slice(0, 2)).toEqual([
      -356385.9,
      3703652,
    ]);
    expect(geoTransform?.bounds?.max?.slice(0, 2)).toEqual([
      1039320.6,
      4843097,
    ]);
  }
  expect(workingArea?.footprintWidthM).toBe(4200);
  expect(workingArea?.footprintHeightM).toBe(4200);
  expect(workingArea?.sceneBounds?.min).toEqual([-8041.4, -12617.6, -6200]);
  expect(workingArea?.sceneBounds?.max).toEqual([-3841.4, -8417.6, 2045.3]);
  expect(workingArea?.source3dNavigationEnvelope?.pointCount).toBe(1386);
  expect(mtVolumeLayer?.type).toBe("volume");
  expect(mtVolumeLayer?.previewFiles?.scalarVolumeManifest).toBe(
    MT_VOLUME_MANIFEST_PATH,
  );
  expect(mtThresholdLayer?.type).toBe("mesh");
  expect(mtThresholdLayer?.previewFiles?.meshPreview).toBe(
    MT_THRESHOLD_SURFACES_PATH,
  );
  for (const layer of project.layers) {
    for (const target of Object.values(layer.previewFiles ?? {})) {
      expect(target).not.toContain("client_preprocessed");
      expect(existsSync(resolve(process.cwd(), target))).toBe(true);
    }
  }
  const environment = readJsonFile<{
    layerStyles: Record<string, Record<string, unknown>>;
    defaultVisibleLayers: string[];
  }>("projects/utah-forge/environment.json");
  expect(environment.defaultVisibleLayers).toContain(
    "utah-forge-phase3-working-area",
  );
  expect(environment.defaultVisibleLayers).toEqual(
    expect.arrayContaining([
      "terrain",
      "transport-roads",
      "hydrography-streams",
      "hydrography-lakes",
    ]),
  );
  for (const path of [
    `${PUBLIC_CONTEXT_DIR}/terrain_public_context_1000m.tif`,
    `${PUBLIC_CONTEXT_DIR}/roads.geojson`,
    `${PUBLIC_CONTEXT_DIR}/hydrography_streams.geojson`,
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
    PUBLIC_CONTEXT_MANIFEST_PATH,
  ]) {
    expect(existsSync(resolve(process.cwd(), path))).toBe(true);
  }
  const publicContextManifest = readJsonFile<{
    schema: string;
    targetCrs: string;
    sourceBounds: {
      easting_m: number[];
      northing_m: number[];
    };
    terrain: { width: number; height: number; resolutionM: number };
    vectors: Record<string, { renderFeatureCount: number }>;
  }>(PUBLIC_CONTEXT_MANIFEST_PATH);
  expect(publicContextManifest.schema).toBe(
    "geosee.utah-forge-public-context.v1",
  );
  expect(publicContextManifest.targetCrs).toBe("EPSG:26912");
  expect(publicContextManifest.sourceBounds.easting_m).toEqual([
    -356385.9,
    1039320.6,
  ]);
  expect(publicContextManifest.sourceBounds.northing_m).toEqual([
    3703652,
    4843097,
  ]);
  expect(publicContextManifest.terrain.resolutionM).toBe(1000);
  expect(publicContextManifest.terrain.width).toBeGreaterThan(1000);
  expect(publicContextManifest.terrain.height).toBeGreaterThan(900);
  expect(publicContextManifest.vectors.roads.renderFeatureCount).toBeGreaterThan(0);
  expect(publicContextManifest.vectors.streams.renderFeatureCount).toBeGreaterThan(
    0,
  );
  expect(
    publicContextManifest.vectors.waterbodies.renderFeatureCount,
  ).toBeGreaterThan(0);
  expect(environment.layerStyles["utah-forge-phase3-working-area"]).toMatchObject({
    color: "#ffffff",
    opacity: 0.92,
    lineWidth: 2.4,
    affectedByFog: false,
  });
  expect(environment.layerStyles["utah-forge-scene-section-planes"]).toMatchObject({
    sceneSectionEnabled: false,
    sceneSectionMode: "cutaway",
    sceneSectionTargetScope: "all-visible",
  });
  expect(
    environment.layerStyles["utah-forge-scene-section-planes"]
      .sceneSectionTargetLayerIds,
  ).toEqual(
    expect.arrayContaining([
      "utah-forge-mt-resistivity-volume",
      "utah-forge-mt-resistivity-full-density",
    ]),
  );
  expect(environment.layerStyles["utah-forge-mt-resistivity-volume"]).toMatchObject({
    scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
    scalarVolumeRenderMode: "raymarch",
    scalarVolumeMaskVisible: true,
  });
  const mtVolumeManifest = readJsonFile<{
    schema: string;
    products: Array<{
      id: string;
      dimensions: number[];
      files: Record<string, string>;
      classification: string;
    }>;
    thresholdSurfaces: {
      file: string;
      surfaces: Array<{ id: string; thresholdOhmM: number; meshRange: unknown }>;
    };
  }>(MT_VOLUME_MANIFEST_PATH);
  expect(mtVolumeManifest.schema).toBe("geosee.scalar-volume.v1");
  expect(mtVolumeManifest.products.map((product) => product.id)).toEqual(
    expect.arrayContaining([
      "mt-resistivity-full-extent-volume",
      "mt-resistivity-forge-focused-volume",
    ]),
  );
  for (const product of mtVolumeManifest.products) {
    expect(product.classification).toContain("source-derived");
    const voxelCount = product.dimensions.reduce((acc, value) => acc * value, 1);
    const volumePath = resolve(
      process.cwd(),
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume",
      product.files.volume,
    );
    const maskPath = resolve(
      process.cwd(),
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume",
      product.files.mask,
    );
    expect(existsSync(volumePath)).toBe(true);
    expect(existsSync(maskPath)).toBe(true);
    expect(readFileSync(volumePath).length).toBe(voxelCount);
    expect(readFileSync(maskPath).length).toBe(voxelCount);
    expect(product.files.volume).not.toContain("client_preprocessed");
    expect(product.files.mask).not.toContain("client_preprocessed");
  }
  expect(mtVolumeManifest.thresholdSurfaces.file).toBe(
    "threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
  );
  expect(mtVolumeManifest.thresholdSurfaces.surfaces).toHaveLength(3);
  expect(mtVolumeManifest.thresholdSurfaces.surfaces.map((surface) => surface.id)).toEqual(
    expect.arrayContaining([
      "conductive-le-10-ohm-m",
      "conductive-le-30-ohm-m",
      "resistive-ge-1000-ohm-m",
    ]),
  );
  const thresholdMesh = readJsonFile<{
    processing: { thresholdSurfaces: Array<{ id: string; meshRange: unknown }> };
    vertices: number[];
    indices: number[];
  }>(MT_THRESHOLD_SURFACES_PATH);
  expect(thresholdMesh.processing.thresholdSurfaces).toHaveLength(3);
  expect(thresholdMesh.vertices.length).toBeGreaterThan(0);
  expect(thresholdMesh.indices.length).toBeGreaterThan(0);
  const stationQc = readJsonFile<{
    schema: string;
    stationCount: number;
    ediFileCount: number;
    responseCurveStations: number;
    stations: Array<{ stationId: string; qc: { responseCurveStatus: string } }>;
  }>(MT_STATION_QC_PATH);
  expect(stationQc.schema).toBe("geosee.mt-station-qc.v1");
  expect(stationQc.stationCount).toBe(122);
  expect(stationQc.ediFileCount).toBe(244);
  expect(stationQc.responseCurveStations).toBe(0);
  expect(stationQc.stations[0].qc.responseCurveStatus).toContain(
    "curves unavailable from source EDI",
  );
  const woodjamProject = readJsonFile<{
    layers: Array<{
      id: string;
      files?: Record<string, string>;
      metadata?: Record<string, unknown>;
    }>;
  }>("projects/woodjam/project.json");
  for (const [id, file] of [
    ["terrain", "data/terrain_woodjam.tif"],
    ["transport-roads", "data/roads.geojson"],
    ["hydrography-streams", "data/hydrography_streams.geojson"],
    ["hydrography-lakes", "data/hydrography_lakes.geojson"],
  ] as const) {
    const layer = woodjamProject.layers.find((candidate) => candidate.id === id);
    expect(Object.values(layer?.files ?? {})).toContain(file);
    expect(layer?.metadata?.geoTransform).toBeUndefined();
  }
  const projectProductLabels =
    (seismicLayer?.metadata?.seismicProducts as Array<{
      label?: string;
    }> | undefined) ?? [];
  for (const product of projectProductLabels) {
    expect(product.label ?? "").not.toMatch(/Forge\s*3D|Forge3d/i);
  }

  const manifest = readJsonFile<{
    schema: string;
    products: Array<{
      id: string;
      label: string;
      sourceFile: string;
      sourceSubmission: string;
      surveyKind: string;
      productKind: string;
      amplitudeStats?: { min?: number; max?: number; p02?: number; p98?: number };
      sections: Array<{
        amplitudeFile: string;
        amplitudeStats?: { min?: number; max?: number; p02?: number; p98?: number };
      }>;
      raymarchVolume?: { file: string; dimensions: number[] } | null;
      provenance?: Record<string, unknown>;
    }>;
    navigation: { geojson: string; pointCount: number };
    crs: { primarySourceCrs: string; legacySourceCrs: string };
    displayRecipes?: Array<{
      id: string;
      productIds?: string[];
      disclosureLabels?: string[];
    }>;
    audiencePresets?: Array<{
      id: string;
      audienceMode: string;
      productId: string;
      visibleProductIds?: string[];
      caveats?: string[];
      renderMode?: string;
      sliceThroughVolume?: boolean;
    }>;
    capabilityPresets?: Array<{
      id: string;
      productId: string;
      visibleProductIds?: string[];
      comparisonProductId?: string;
      comparisonMode?: string;
      colormap?: string;
      navigationRoleVisibility?: {
        sources?: boolean;
        receivers?: boolean;
        lines?: boolean;
      };
    }>;
    derivedViews?: Array<{ status?: string; reviewStatus?: string }>;
    interpretationLayers?: Array<{ status?: string; caveat?: string }>;
    exportLayouts?: Array<{ id: string; caveat?: string; includes?: string[] }>;
  }>(SEISMIC_MANIFEST_PATH);
  expect(manifest.schema).toBe("geosee.seismic-browser.v1");
  expect(manifest.products).toHaveLength(34);
  expect(manifest.navigation.geojson).toBe(SEISMIC_NAVIGATION_PATH);
  expect(manifest.navigation.pointCount).toBeGreaterThan(1_000);
  expect(manifest.crs.primarySourceCrs).toContain("EPSG:26912");
  expect(manifest.crs.legacySourceCrs).toContain("EPSG:32043");
  expect(manifest.products.some((product) => product.surveyKind === "3d")).toBe(true);
  expect(manifest.products.some((product) => product.surveyKind === "legacy-2d")).toBe(true);
  expect(manifest.products.some((product) => product.sourceSubmission === "GDR 1015")).toBe(true);
  expect(manifest.products.some((product) => product.sourceSubmission === "GDR 1141")).toBe(true);
  expect(manifest.products.some((product) => product.productKind === "velocity")).toBe(true);
  expect(
    manifest.products.filter((product) => Boolean(product.raymarchVolume)),
  ).toHaveLength(4);
  expect(manifest.displayRecipes?.map((recipe) => recipe.id)).toEqual(
    expect.arrayContaining([
      "investor-story",
      "3d-seismic-showcase",
      "2d-line-theatre",
      "integrated-geophysics",
      "confidence-provenance",
      "regulatory-export-pack",
    ]),
  );
  expect(manifest.audiencePresets?.map((preset) => preset.id)).toEqual(
    expect.arrayContaining([
      "investor-overview-volume",
      "line-theatre-301",
      "integrated-geophysics",
      "data-room-inventory",
      "export-line-301-section",
    ]),
  );
  expect(manifest.capabilityPresets?.map((preset) => preset.id)).toEqual(
    expect.arrayContaining([
      "3d-volume-psdm-depth",
      "3d-volume-pstm-time",
      "3d-volume-fxydecon",
      "3d-velocity-volume",
      "inline-slice",
      "crossline-slice",
      "time-depth-plane",
      "volume-slice-sync",
      "line-301-theatre",
      "line-302-theatre",
      "legacy-l5-l11-theatre",
      "enhanced-vs-unenhanced",
      "survey-geometry",
      "integrated-geophysics",
    ]),
  );
  expect(manifest.capabilityPresets).toHaveLength(14);
  const velocityProduct = manifest.products.find(
    (product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018",
  );
  expect(velocityProduct?.productKind).toBe("velocity");
  expect(velocityProduct?.raymarchVolume?.dimensions).toEqual([19, 19, 64]);
  expect(velocityProduct?.amplitudeStats?.p98).toBeGreaterThan(5_000);
  const velocityPreset = manifest.capabilityPresets?.find(
    (preset) => preset.id === "3d-velocity-volume",
  );
  expect(velocityPreset).toMatchObject({
    productId: "gdr-1015-forge3d-velo5d-float-01312018",
    renderMode: "raymarch",
    colormap: "velocity",
  });
  expect(
    manifest.audiencePresets?.some(
      (preset) =>
        preset.id === "investor-overview-volume" &&
        preset.renderMode === "raymarch" &&
        preset.sliceThroughVolume === true,
    ),
  ).toBe(true);
  expect(
    manifest.audiencePresets?.every((preset) =>
      preset.caveats?.includes("not a mineral resource estimate"),
    ),
  ).toBe(true);
  expect(
    manifest.derivedViews?.every(
      (view) =>
        view.status === "planned-experimental" &&
        view.reviewStatus === "requires-geophysicist-review",
    ),
  ).toBe(true);
  expect(
    manifest.interpretationLayers?.every((layer) => layer.status === "planned"),
  ).toBe(true);
  expect(
    manifest.interpretationLayers?.some((layer) =>
      layer.caveat?.toLowerCase().includes("auto-labeled"),
    ),
  ).toBe(true);
  expect(
    manifest.exportLayouts?.some(
      (layout) =>
        layout.id === "qp-report-support-layout" &&
        layout.includes?.includes("CRS") &&
        layout.caveat?.includes("NI 43-101"),
    ),
  ).toBe(true);
  const productIds = new Set(manifest.products.map((product) => product.id));
  for (const preset of manifest.audiencePresets ?? []) {
    expect(productIds.has(preset.productId)).toBe(true);
    for (const visibleProductId of preset.visibleProductIds ?? []) {
      expect(productIds.has(visibleProductId)).toBe(true);
    }
  }
  for (const preset of manifest.capabilityPresets ?? []) {
    expect(productIds.has(preset.productId)).toBe(true);
    for (const visibleProductId of preset.visibleProductIds ?? []) {
      expect(productIds.has(visibleProductId)).toBe(true);
    }
    if (preset.comparisonProductId) {
      expect(productIds.has(preset.comparisonProductId)).toBe(true);
    }
  }
  for (const product of manifest.products) {
    expect(product.label).not.toMatch(/forge/i);
    expect(product.label).toMatch(/^(2D|3D)\b/);
    expect(product.provenance?.sourceFile).toBe(product.sourceFile);
    expect(product.sections.length).toBeGreaterThan(0);
    expect(product.amplitudeStats?.max).toBeGreaterThan(
      product.amplitudeStats?.min ?? Number.NEGATIVE_INFINITY,
    );
    expect(product.amplitudeStats?.p98).toBeGreaterThan(
      product.amplitudeStats?.p02 ?? Number.NEGATIVE_INFINITY,
    );
    expect(product.sourceFile.toLowerCase()).not.toContain("raw_shot_gathers");
    expect(product.sourceFile.toLowerCase()).not.toContain("uncorrelated");
    expect(product.sourceFile.toLowerCase()).not.toContain("correlated");
    for (const section of product.sections) {
      expect(section.amplitudeStats?.max).toBeGreaterThan(
        section.amplitudeStats?.min ?? Number.NEGATIVE_INFINITY,
      );
      expect(section.amplitudeStats?.p98).toBeGreaterThan(
        section.amplitudeStats?.p02 ?? Number.NEGATIVE_INFINITY,
      );
      expect(
        existsSync(
          resolve(
            process.cwd(),
            "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser",
            section.amplitudeFile,
          ),
        ),
      ).toBe(true);
    }
    if (product.raymarchVolume) {
      expect(product.raymarchVolume.dimensions.every((dim) => dim > 1)).toBe(true);
      expect(
        existsSync(
          resolve(
            process.cwd(),
            "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser",
            product.raymarchVolume.file,
          ),
        ),
      ).toBe(true);
    }
  }

  const navigation = readJsonFile<{
    features: Array<{ geometry?: { type?: string }; properties?: { role?: string } }>;
  }>(SEISMIC_NAVIGATION_PATH);
  expect(navigation.features.length).toBeGreaterThan(1_000);
  expect(
    navigation.features.filter((feature) => feature.properties?.role === "source")
      .length,
  ).toBeGreaterThan(500);
  expect(
    navigation.features.filter((feature) => feature.properties?.role === "receiver")
      .length,
  ).toBeGreaterThan(400);
  expect(
    navigation.features.filter(
      (feature) => feature.geometry?.type === "LineString",
    ).length,
  ).toBeGreaterThan(10);
  const demoRecipes = readJsonFile<{
    schema: string;
    productCount: number;
    raymarchProductCount: number;
    disclosureLabels: string[];
    audiencePresets: unknown[];
    capabilityPresets: unknown[];
    exportLayouts: unknown[];
  }>(SEISMIC_DEMO_RECIPES_PATH);
  expect(demoRecipes.schema).toBe("geosee.seismic-demo-recipes.v1");
  expect(demoRecipes.productCount).toBe(34);
  expect(demoRecipes.raymarchProductCount).toBe(4);
  expect(demoRecipes.disclosureLabels).toEqual(
    expect.arrayContaining([
      "public geothermal demo data",
      "processed seismic product",
      "not a mineral resource estimate",
    ]),
  );
  expect(demoRecipes.audiencePresets.length).toBeGreaterThanOrEqual(8);
  expect(demoRecipes.capabilityPresets).toHaveLength(14);
  expect(demoRecipes.exportLayouts.length).toBeGreaterThanOrEqual(3);
  expect(
    (seismicLayer?.metadata?.seismicAudiencePresets as unknown[] | undefined)
      ?.length,
  ).toBeGreaterThanOrEqual(8);
  expect(
    (seismicLayer?.metadata?.seismicCapabilityPresets as unknown[] | undefined)
      ?.length,
  ).toBe(14);
  const projectVelocityProduct = (
    seismicLayer?.metadata?.seismicProducts as
      | Array<{
          id?: string;
          amplitudeStats?: { p02?: number; p98?: number };
          raymarchVolume?: { dimensions?: number[] };
        }>
      | undefined
  )?.find((product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018");
  expect(projectVelocityProduct?.amplitudeStats?.p98).toBeGreaterThan(5_000);
  expect(projectVelocityProduct?.raymarchVolume?.dimensions).toEqual([19, 19, 64]);
  const inventory = readJsonFile<{
    normalization: { skippedRawGatherFileCount: number };
  }>(SEISMIC_INVENTORY_PATH);
  expect(inventory.normalization.skippedRawGatherFileCount).toBeGreaterThan(0);
});

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
  await expect(page.locator("body")).toContainText("public geothermal demo data");
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
  await expect(page.locator("body")).toContainText("2D / legacy section theatre");
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
  await expect(page.getByTestId("seismic-audience-preset-select")).toBeVisible();

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
  expect(capabilityAncestorSummaries).not.toContain(
    "Seismic browser seismic",
  );
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

  await page.getByTestId("seismic-product-row-gdr-1141-forge3d-pstm-stack-enh").click();
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
    .poll(async () => (await seismicSceneState(page)).firstVisibleSectionMinAlpha)
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
    .poll(async () => (await seismicSceneState(page)).firstVisibleVolumeUniforms)
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
  await expect.poll(() => sceneSectionState(page)).toMatchObject({
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
  await expect(page.getByTestId("scene-section-legend-z-enabled")).toBeChecked();

  await page.getByTestId("scene-section-legend-x-enabled").setChecked(true);
  await page.getByTestId("scene-section-legend-y-enabled").setChecked(true);
  await expect.poll(() => sceneSectionState(page)).toMatchObject({
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
  expect(sectionState.helperPickableKinds.every((kind) => kind === "push-pull")).toBe(
    true,
  );
  expect(sectionState.mtClippedMaterials).toBeGreaterThan(0);
  await page.getByTestId("scene-section-target-scope").selectOption("all-visible");
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

  await page.getByTestId("seismic-product-row-gdr-1015-forge2d-301-migr-depth").click();
  await expect(page.getByTestId("seismic-render-mode-select")).toHaveValue("slice");
  await expect(page.getByTestId("seismic-render-mode-select")).toBeDisabled();
  await expect(page.getByTestId("seismic-slice-axis-select")).toHaveValue("line");
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
  await expect(page.getByTestId("seismic-comparison-product-select")).toHaveValue(
    "gdr-1141-line-301-psdm-unenh",
  );
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

  await page.getByTestId("seismic-audience-mode-select").selectOption("data-room");
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
        .poll(async () => (await seismicSceneState(page)).firstVisibleVolumeUniforms)
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
  await page.getByTestId(`seismic-capability-slice-${firstRaymarchProductId}`).click();
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

  await page.getByTestId(`seismic-capability-sync-${firstRaymarchProductId}`).click();
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
    .getByTestId(`seismic-capability-remove-background-${firstRaymarchProductId}`)
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
    .getByTestId(`seismic-capability-background-cutoff-${firstRaymarchProductId}`)
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
    .poll(async () => (await seismicSceneState(page)).firstVisibleVolumeUniforms)
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

  await page.getByTestId("seismic-comparison-mode-select").selectOption("side-by-side");
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
      return state.visibleNavigationByRole.sources > 0 &&
        state.visibleNavigationByRole.receivers > 0 &&
        state.visibleNavigationByRole.lines > 0;
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

  await page.getByRole("button", { name: "FORGE Data" }).click();
  await openForgeDataEditorContainers(page);
  const slicesLayerItem = page
    .locator('[data-dev-note*="layerItemStyle"]')
    .filter({ hasText: "2D MT resistivity slices" })
    .first();
  await expect(slicesLayerItem).toBeVisible();
  await slicesLayerItem.locator('input[type="checkbox"]').first().setChecked(true);

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
    .poll(() => sectionIsoSceneState(page).then((state) => state.targets.length))
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

  const setInputValue = async (
    locator: Locator,
    value: string,
  ) => {
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

  await expect(slicesLayerItem.getByTestId("layer-isobands-controls")).toBeVisible();
  await slicesLayerItem.getByTestId("layer-isobands-enabled").setChecked(true);
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
  await setInputValue(
    slicesLayerItem.getByTestId("layer-isobands-source-opacity"),
    "0.35",
  );
  await expect
    .poll(() => sectionIsoSceneState(page).then((state) => state.firstSourceOpacity))
    .toBeCloseTo(0.273, 2);
  await slicesLayerItem.getByTestId("layer-isobands-enabled").setChecked(false);
  await expect
    .poll(() =>
      sectionIsoSceneState(page).then((state) => ({
        lines: state.lineOverlayCount,
        bands: state.bandOverlayCount,
        sourceOpacity: state.firstSourceOpacity,
      })),
    )
    .toEqual({ lines: 0, bands: 0, sourceOpacity: 0.78 });

  await expect(page.getByTestId("section-iso-legend")).toBeVisible();
  await page.getByTestId("section-iso-toggle").setChecked(true);
  await page.getByTestId("section-iso-configure").click();
  await expect(page.getByTestId("section-iso-popout")).toBeVisible();

  const disabledTarget = initialIsoState.targets[1];
  await page
    .getByTestId(`section-iso-target-${disabledTarget.sectionId}`)
    .setChecked(false);

  const setRange = async (testId: string, value: string) => {
    await setInputValue(page.getByTestId(testId), value);
  };
  await setRange("section-iso-level-count", "7");
  await setRange("section-iso-line-width", "5.5");
  await setRange("section-iso-band-opacity", "0.44");
  await setRange("section-iso-fill-offset", "-0.35");
  await page.getByTestId("section-iso-line-style").selectOption("dashed");

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
      bandOverlayCount: initialIsoState.targets.length - 1,
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

  await page.getByTestId("section-iso-bands-visible").setChecked(false);
  await expect
    .poll(() => sectionIsoSceneState(page).then((state) => state.bandOverlayCount))
    .toBe(0);
  expect((await sectionIsoSceneState(page)).lineOverlayCount).toBeGreaterThan(0);

  await page.getByTestId("section-iso-toggle").setChecked(false);
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

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
    const seismic = manager?.getLayer?.("utah-forge-phase3-seismic-browser");
    if (seismic) seismic.visible = true;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicRenderMode: "slice",
      seismicSliceAxis: "inline",
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
  });
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
  expect((await sectionIsoSceneState(page, "seismic-sections")).lineOverlayCount).toBe(0);

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicRenderMode: "slice",
      seismicSliceAxis: "inline",
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
  });
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
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicRenderMode: "slice",
      seismicSliceAxis: "inline",
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
      sectionIsoTargetIds: { [targetKey]: false },
      sectionIsoLevelCount: 6,
      sectionIsoLineWidth: 4.2,
      sectionIsoLineStyle: "dashed",
      sectionIsoBandOpacity: 0.41,
      sectionIsoFillOffset: 0.2,
      opacity: 0.68,
    });
  }, disabledSeismicTarget);
  await expect
    .poll(() =>
      sectionIsoSceneState(page, "seismic-sections").then((state) =>
        state.overlayTargets.includes(disabledSeismicTarget),
      ),
    )
    .toBe(false);

  await expect
    .poll(() => mtVolumeSceneState(page).then((state) => state.totalVolumeCount))
    .toBe(2);
  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
  const volumeIsoState = await sectionIsoSceneState(page, "mt-volume-cuts");
  expect(volumeIsoState.lineOverlayCount).toBeGreaterThan(0);
  expect(volumeIsoState.bandOverlayCount).toBeGreaterThan(0);
  expect(volumeIsoState.firstBandUniforms).toMatchObject({
    opacity: 0.36,
    fillOffset: -0.15,
  });
  await expect(page.getByTestId("section-iso-legend")).toBeVisible();
  await expect(page.getByTestId("section-iso-dataset")).toBeVisible();

  const disabledVolumeTarget = volumeIsoState.overlayTargets[0];
  await page.evaluate((targetKey) => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
      sectionIsoSceneState(page, "mt-volume-cuts").then((state) =>
        state.overlayPlanePositions.some((position) =>
          Math.abs(position - -4500) < 1,
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
  expect((await seismicSceneState(page)).firstVisibleVolumeUniforms).toMatchObject({
    opacity: 0,
  });

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
        state.overlayPlanePositions.some((position) =>
          Math.abs(position - -500) < 1,
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
    manager?.applyStyle?.("utah-forge-mt-resistivity-volume", {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      sectionIsoEnabled: false,
      sectionIsoLinesVisible: true,
      sectionIsoBandsVisible: true,
    });
    manager?.applyStyle?.("utah-forge-phase3-seismic-browser", {
      seismicRenderMode: "slice",
      sectionIsoEnabled: false,
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
      ]).then(([volumeState, seismicState, seismicVolumeState]) => ({
        volumeLines: volumeState.lineOverlayCount,
        volumeBands: volumeState.bandOverlayCount,
        seismicLines: seismicState.lineOverlayCount,
        seismicBands: seismicState.bandOverlayCount,
        seismicVolumeLines: seismicVolumeState.lineOverlayCount,
        seismicVolumeBands: seismicVolumeState.bandOverlayCount,
      })),
    )
    .toEqual({
      volumeLines: 0,
      volumeBands: 0,
      seismicLines: 0,
      seismicBands: 0,
      seismicVolumeLines: 0,
      seismicVolumeBands: 0,
    });

  expect(consoleErrors).toEqual([]);
});

test("Utah FORGE Stage 2 full-density MT layer loads and exposes controls", async ({
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
  const publicContextScene = await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => {
            visible: boolean;
            traverse: (fn: (obj: {
              visible: boolean;
              name?: string;
              position?: { x: number; y: number; z: number };
              geometry?: {
                computeBoundingBox?: () => void;
                boundingBox?: {
                  min: { x: number; y: number; z: number };
                  max: { x: number; y: number; z: number };
                } | null;
                getAttribute?: (name: string) => { count: number } | undefined;
              };
              userData?: Record<string, unknown>;
            }) => void) => void;
          } | undefined;
        };
      };
    }).__scene?.manager;
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
            traverse: (fn: (obj: {
              visible: boolean;
              geometry?: { getAttribute?: (name: string) => { count: number } | undefined };
            }) => void) => void;
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
  await expect(page.locator("body")).toContainText(
    "3D MT resistivity volume",
  );
  await expect(page.locator("body")).toContainText("3D volume products");
  await expect(page.locator("body")).toContainText("3D cut window");
  await expect(page.locator("body")).toContainText(
    "3D MT threshold surfaces",
  );
  await expect(page.locator("body")).toContainText("2D MT station response / QC");
  await expect(page.getByTestId("mt-volume-product-select")).toHaveCount(1);
  await expect(page.getByTestId("mt-volume-opacity")).toHaveCount(1);
  await expect(page.getByTestId("mt-threshold-conductive-le-30-ohm-m")).toHaveCount(1);
  await expect(page.getByTestId("mt-station-qc-select")).toHaveCount(1);

  await expect
    .poll(() =>
      mtVolumeSceneState(page).then((state) => state.totalVolumeCount),
    )
    .toBe(2);
  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          getLayer?: (id: string) => { visible: boolean } | undefined;
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
    expect.arrayContaining(["conductive-le-10-ohm-m", "resistive-ge-1000-ohm-m"]),
  );
  expect(mtVolumeState.visibleThresholdSurfaceIds).not.toContain(
    "conductive-le-30-ohm-m",
  );
  expect(mtVolumeState.thresholdWireframe).toBe(true);

  await page.evaluate(() => {
    const manager = (window as unknown as {
      __scene?: {
        manager?: {
          applyStyle?: (id: string, style: Record<string, unknown>) => void;
        };
      };
    }).__scene?.manager;
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
  await expect(page.getByTestId("mt-station-qc-select")).toHaveValue("FRG19001");
  await expect
    .poll(() => mtVolumeSceneState(page).then((state) => state.selectedStationId))
    .toBe("FRG19001");

  await expect
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/manifest.json",
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
    .poll(() =>
      loadedUrls.some((url) =>
        url.endsWith(
          "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/mt_top_surface_mesh_preview.json",
        ),
      ),
    )
    .toBe(true);
  const topSurfaceMeshResponse = await page.request.get(
    "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/mt_top_surface_mesh_preview.json",
  );
  expect(topSurfaceMeshResponse.ok()).toBe(true);
  const topSurfaceMesh = await topSurfaceMeshResponse.json();
  expect(topSurfaceMesh.attributes).toBeUndefined();
  expect(topSurfaceMesh.material?.note).toContain("standalone");
  expect(topSurfaceMesh.material?.note).not.toContain("scalar trim colors");
  expect(topSurfaceMesh.indices.length / 3).toBe(1_844);
  const topSurfaceStatsResponse = await page.request.get(
    "/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/stats.json",
  );
  expect(topSurfaceStatsResponse.ok()).toBe(true);
  const topSurfaceStats = await topSurfaceStatsResponse.json();
  expect(topSurfaceStats.source?.preview).toContain("resistivity_point_preview.json");
  expect(topSurfaceStats.source?.previewPointCount).toBe(90_000);
  expect(topSurfaceStats.gridSizeM).toBe(2_500);
  expect(topSurfaceStats.topQuantile).toBe(0.95);
  expect(topSurfaceStats.vertexCount).toBe(1_135);
  expect(topSurfaceStats.triangleCount).toBe(1_844);
  expect(topSurfaceStats.retainedEdgeInferenceTriangles).toBeUndefined();
  expect(topSurfaceStats.rejectedLongEdgeTriangles).toBeUndefined();
  expect(topSurfaceStats.sceneBounds.min[2]).toBeGreaterThan(800);

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
        page.getByTestId("resistivity-legend-focusMin").getAttribute("aria-valuenow"),
      )
      .not.toBe(initialFocusMinValue);

    const focusMaxBeforeKey = await page
      .getByTestId("resistivity-legend-focusMax")
      .getAttribute("aria-valuenow");
    await page.getByTestId("resistivity-legend-focusMax").press("ArrowLeft");
    await expect
      .poll(() =>
        page.getByTestId("resistivity-legend-focusMax").getAttribute("aria-valuenow"),
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
        page.getByTestId("resistivity-legend-focusMax").getAttribute("aria-valuenow"),
      )
      .not.toBe(initialFocusMaxValue);
    await expect(legend).toContainText("1.38 Ohm-m");
    await expect(legend).toContainText("8,652 Ohm-m");
  }

  const afterGlobalTrimCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(beforeTrimCanvas, afterGlobalTrimCanvas)).toBeGreaterThan(
    1000,
  );
  const globalLegendAfterDrag = await legend.innerText();
  await page.waitForTimeout(700);
  await expect.poll(() => legend.innerText()).toBe(globalLegendAfterDrag);
  const afterGlobalWaitCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(beforeTrimCanvas, afterGlobalWaitCanvas)).toBeGreaterThan(
    1000,
  );

  const beforeNoiseCanvas = await page.locator("canvas").screenshot();
  await page.getByTestId("resistivity-legend-edge-lower").dispatchEvent("dblclick");
  await expect(page.getByTestId("resistivity-legend-edge-popout")).toBeVisible();
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
  await page.getByTestId("resistivity-legend-edge-line-style").selectOption("dashed");
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
        page.getByTestId("resistivity-legend-focusMin").getAttribute("aria-valuenow"),
      )
      .not.toBe(pageFocusMinBefore);
    const pageLegendAfterDrag = await legend.innerText();
    await page.waitForTimeout(700);
    await expect.poll(() => legend.innerText()).toBe(pageLegendAfterDrag);
  }
  const afterPageTrimCanvas = await page.locator("canvas").screenshot();
  expect(changedByteCount(afterGlobalWaitCanvas, afterPageTrimCanvas)).toBeGreaterThan(
    1000,
  );

  const beforeCameraTransitionCanvas = await page.locator("canvas").screenshot();
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
