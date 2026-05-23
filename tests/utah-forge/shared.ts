import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
} from "../../src/pages/types";
import { effectiveStyle } from "../../src/pages/effective";
import {
  activeRenderPresetIdForPage,
  projectRenderPresets,
  scenePatchForRenderPreset,
} from "../../src/pages/renderPresets";
import {
  scalarInclusionVisibleCount,
  scalarLateralSupportValues,
} from "../../src/scene/scalarFocus";

export const MT_FULL_DENSITY_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/manifest.json";
export const UTAH_FORGE_ENVIRONMENT_PATH = "projects/utah-forge/environment.json";
export const UTAH_FORGE_PAGE04_PATH =
  "projects/utah-forge/pages/04_mt_high_resistivity_seismic.json";
export const UTAH_FORGE_PAGE05_PATH =
  "projects/utah-forge/pages/05_mt_threshold_focus.json";
export const UTAH_FORGE_PAGE06_PATH =
  "projects/utah-forge/pages/06_mt_low_resistivity_seismic.json";
export const UTAH_FORGE_PAGE12_PATH =
  "projects/utah-forge/pages/12_mt_volume_overview.json";

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

export function changedByteCount(before: Buffer, after: Buffer): number {
  let changedBytes = 0;
  const byteLength = Math.min(before.length, after.length);
  for (let index = 0; index < byteLength; index += 1) {
    if (before[index] !== after[index]) changedBytes += 1;
  }
  return changedBytes;
}

type MtFullDensityManifest = {
  attributes?: {
    scalar?: {
      min?: number;
      max?: number;
      displayMin?: number;
      displayMax?: number;
    };
  };
  tiles: Array<{
    pointCount: number;
    file: string;
    scalarFile: string;
  }>;
};

const expectedMtCountCache = new Map<string, number>();

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function styleNumber(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = style[field];
  return typeof value === "number" && Number.isFinite(value)
    ? clampRange(value, min, max)
    : fallback;
}

function float32File(path: string): Float32Array {
  const buffer = readFileSync(resolve(process.cwd(), path));
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function expectedRuntimePresentationForPage(
  environment: EnvironmentSetup,
  page?: PresentationPage | null,
): UtahForgeRuntimePresentationState {
  const activeRenderPresetId = activeRenderPresetIdForPage(environment, page);
  const patch = scenePatchForRenderPreset(
    activeRenderPresetId,
    projectRenderPresets(environment),
  );
  const scene = {
    ...(environment.scene ?? {}),
    ...(patch ?? {}),
    fog: {
      ...(environment.scene?.fog ?? {}),
      ...(patch?.fog ?? {}),
    },
  };
  const background =
    typeof scene.background === "string" ? scene.background : null;
  return {
    activeRenderPresetId,
    rendererExposure:
      typeof scene.exposure === "number" && Number.isFinite(scene.exposure)
        ? scene.exposure
        : null,
    clearColor: background,
    sceneBackground: background,
    fogColor: typeof scene.fog?.color === "string" ? scene.fog.color : null,
    fogDensity:
      typeof scene.fog?.density === "number" &&
      Number.isFinite(scene.fog.density)
        ? scene.fog.density
        : null,
  };
}

export function expectedMtFullDensityIndexedPointCount(
  environment: EnvironmentSetup,
  page: PresentationPage,
): number {
  const cacheKey = `${page.id}:${JSON.stringify(
    page.layerOverrides?.["utah-forge-mt-resistivity-full-density"] ?? {},
  )}`;
  const cached = expectedMtCountCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const manifest = readJsonFile<MtFullDensityManifest>(
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  const style = effectiveStyle(
    environment,
    page,
    "utah-forge-mt-resistivity-full-density",
  );
  const totalPointCount = manifest.tiles.reduce(
    (total, tile) => total + tile.pointCount,
    0,
  );
  if (style.scalarInclusionMode !== "thresholded") {
    expectedMtCountCache.set(cacheKey, totalPointCount);
    return totalPointCount;
  }

  const sourceMin = finiteNumber(manifest.attributes?.scalar?.min, -2);
  const sourceMax = finiteNumber(manifest.attributes?.scalar?.max, 4.5);
  const displayMin = finiteNumber(
    style.scalarDisplayMin,
    finiteNumber(manifest.attributes?.scalar?.displayMin, 0.139879),
  );
  const displayMax = finiteNumber(
    style.scalarDisplayMax,
    finiteNumber(manifest.attributes?.scalar?.displayMax, 3.937122),
  );
  const trimMin = styleNumber(
    style,
    "scalarFocusMin",
    sourceMin,
    -100,
    100,
  );
  const trimMax = styleNumber(
    style,
    "scalarFocusMax",
    sourceMax,
    -100,
    100,
  );
  const rawBlendMin = styleNumber(
    style,
    "scalarBlendMin",
    displayMin,
    -100,
    100,
  );
  const rawBlendMax = styleNumber(
    style,
    "scalarBlendMax",
    displayMax,
    -100,
    100,
  );
  const blendMin = clampRange(
    rawBlendMin,
    trimMin,
    Math.max(trimMin, trimMax - 0.000001),
  );
  const blendMax = clampRange(Math.max(rawBlendMax, blendMin), blendMin, trimMax);
  const noiseThreshold = styleNumber(
    style,
    "scalarNoiseThreshold",
    0,
    0,
    1,
  );
  const filterActive =
    trimMin > sourceMin + 0.000001 ||
    trimMax < sourceMax - 0.000001 ||
    blendMin > trimMin + 0.000001 ||
    blendMax < trimMax - 0.000001 ||
    noiseThreshold > 0.000001;
  if (!filterActive) {
    expectedMtCountCache.set(cacheKey, totalPointCount);
    return totalPointCount;
  }

  const manifestDir = dirname(MT_FULL_DENSITY_MANIFEST_PATH);
  let count = 0;
  for (const tile of manifest.tiles) {
    const scalarValues = float32File(`${manifestDir}/${tile.scalarFile}`);
    const positions =
      noiseThreshold > 0.000001
        ? float32File(`${manifestDir}/${tile.file}`)
        : null;
    const supportValues =
      positions && noiseThreshold > 0.000001
        ? scalarLateralSupportValues({
            count: tile.pointCount,
            getX: (index) => positions[index * 3],
            getY: (index) => positions[index * 3 + 1],
            getZ: (index) => positions[index * 3 + 2],
          })
        : null;
    count += scalarInclusionVisibleCount(scalarValues, {
      trimMin,
      blendMin,
      blendMax,
      trimMax,
      supportValues,
      noiseThreshold,
    });
  }
  expectedMtCountCache.set(cacheKey, count);
  return count;
}

async function openEditorSection(
  page: Page,
  name: string,
  timeout = 30_000,
  contentText?: string,
): Promise<void> {
  const content = contentText ? page.getByText(contentText).first() : null;
  const button = page.getByRole("button", { name }).first();
  try {
    await button.waitFor({ state: "visible", timeout });
  } catch {
    if (content && (await content.count()) > 0) {
      const contentVisible = await content.isVisible().catch(() => false);
      if (contentVisible) return;
    }
    return;
  }
  const expanded = await button
    .getAttribute("aria-expanded", { timeout: Math.min(timeout, 3000) })
    .catch(() => null);
  if (expanded !== "true") {
    await button.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
    await button.click({ timeout }).catch(async () => {
      await button.click({ force: true, timeout }).catch(() => {});
    });
    await expect(button)
      .toHaveAttribute("aria-expanded", "true", {
        timeout: Math.min(timeout, 5000),
      })
      .catch(() => {});
  }
  if (content) {
    await content.waitFor({ state: "visible", timeout }).catch(() => {});
  }
}

async function openAllDetails(page: Page): Promise<void> {
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
}

export async function openForgeDataEditorContainers(page: Page): Promise<void> {
  await openEditorSection(page, "Public Topo Map", 30_000, "Topo Settings");
  await openEditorSection(page, "Topo Settings", 30_000, "Topo Surface");
  await openEditorSection(
    page,
    "Longitude / latitude grid",
    30_000,
    "Line width",
  );
  await openEditorSection(page, "Title block", 30_000, "Logo file");
  await openEditorSection(page, "FORGE Data", 30_000, "Scene section planes");
  await openEditorSection(page, "Working area focus", 3000, "Working area");
  await openEditorSection(page, "Working area", 3000, "Phase 3 required working area");
  await openEditorSection(page, "Scene section planes", 10_000, "section plane");
  await openEditorSection(page, "Seismic analysis", 10_000, "Seismic browser");
  await openEditorSection(page, "MT resistivity", 30_000, "3D MT top surface");
  await openEditorSection(page, "Other", 5_000, "Foundation");
  await openAllDetails(page);
}

export async function openForgeTopoEditorContainers(page: Page): Promise<void> {
  await openEditorSection(page, "Public Topo Map", 30_000, "Topo Settings");
  await openEditorSection(page, "Topo Settings", 30_000, "Topo Surface");
  await openEditorSection(
    page,
    "Longitude / latitude grid",
    30_000,
    "Line width",
  );
  await openEditorSection(page, "Title block", 30_000, "Logo file");
  await openAllDetails(page);
}

export async function setForgeLayerVisible(
  page: Page,
  label: string,
  visible: boolean,
): Promise<void> {
  const publicContextLayerIdsByLabel: Record<string, string> = {
    "Topo Surface": "terrain",
    "Public roads": "transport-roads",
    "Public streams and rivers": "hydrography-streams",
    "Public waterbodies": "hydrography-lakes",
  };
  const publicContextLayerId = publicContextLayerIdsByLabel[label];
  if (publicContextLayerId) {
    await page.evaluate(
      ({ layerId, nextVisible }) => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                getLayer?: (id: string) => { visible: boolean } | undefined;
              };
            };
          }
        ).__scene?.manager;
        const layer = manager?.getLayer?.(layerId);
        if (layer) layer.visible = nextVisible;
      },
      { layerId: publicContextLayerId, nextVisible: visible },
    );
    await expect
      .poll(() =>
        page.evaluate((layerId) => {
          const manager = (
            window as unknown as {
              __scene?: {
                manager?: {
                  getLayer?: (id: string) => { visible: boolean } | undefined;
                };
              };
            }
          ).__scene?.manager;
          return manager?.getLayer?.(layerId)?.visible ?? false;
        }, publicContextLayerId),
      )
      .toBe(visible);
    return;
  }
  const layerItem = forgeLayerItem(page, label);
  await expect(layerItem).toBeVisible();
  const checkboxes = layerItem.locator('input[type="checkbox"]');
  await expect(checkboxes.first()).toBeAttached({ timeout: 15_000 });
  const checkboxCount = await checkboxes.count();
  const targetCheckbox =
    checkboxCount >= 2 ? checkboxes.nth(1) : checkboxes.first();
  if (checkboxCount >= 2) {
    const overrideCheckbox = checkboxes.first();
    if (!(await overrideCheckbox.isChecked())) {
      await overrideCheckbox.setChecked(true);
    }
    await expect(targetCheckbox).toBeEnabled({ timeout: 15_000 });
  }
  if ((await targetCheckbox.isChecked()) !== visible) {
    await targetCheckbox.setChecked(visible, { timeout: 15_000 });
  }
}

export function forgeLayerItem(page: Page, label: string): Locator {
  if (label === "Topo Surface") {
    return page.getByTestId("topo-surface-controls");
  }
  if (label === "Longitude / latitude grid") {
    return page.getByTestId("topo-graticule-controls");
  }
  return page
    .locator('[data-dev-note*="layerItemStyle"]')
    .filter({ hasText: label })
    .first();
}

export async function ensureForgeLayerVisible(
  page: Page,
  label: string,
): Promise<void> {
  await setForgeLayerVisible(page, label, true);
}

export async function selectForgePageRow(page: Page, rowLabel: string): Promise<void> {
  const row = page
    .locator('[data-dev-note*="panelStyles.pageRow"]')
    .filter({ hasText: rowLabel })
    .first();
  await expect(row).toBeVisible();
  await row.evaluate((el) => {
    if (el instanceof HTMLElement) el.click();
  });
}

export async function selectNextForgePage(page: Page): Promise<void> {
  const nextButton = page.getByRole("button", { name: "Next page" });
  await expect(nextButton).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: { next?: () => void };
      }
    ).__pageController;
    if (!controller?.next) {
      throw new Error("PageController debug handle is unavailable");
    }
    controller.next();
  });
}

export async function hidePublicContextLayers(page: Page): Promise<void> {
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

export async function revealSeismicCapabilityProduct(
  page: Page,
  productId: string,
): Promise<void> {
  const productItem = page.getByTestId(
    `seismic-capability-product-${productId}`,
  );
  await productItem
    .getByTestId(`seismic-capability-product-visible-${productId}`)
    .setChecked(true);
  await productItem.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
}

export type SeismicSceneState = {
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

export type SceneSectionState = {
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

export type MtVolumeSceneState = {
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

export type MtFullDensityPointSceneState = {
  layerVisible: boolean;
  pointObjects: number;
  visiblePointObjects: number;
  totalPointCount: number;
  indexedVisiblePointCount: number;
  scalarFocusVisibleCount: number | null;
  firstTileId: string | null;
  firstScalarDisplayMin: number | null;
  firstScalarDisplayMax: number | null;
  firstMaterial: {
    opacity: number | null;
    size: number | null;
    transparent: boolean | null;
    vertexColors: boolean | null;
    depthTest: boolean | null;
    depthWrite: boolean | null;
  } | null;
};

export type UtahForgeRuntimePresentationState = {
  activeRenderPresetId: string | null;
  rendererExposure: number | null;
  clearColor: string | null;
  sceneBackground: string | null;
  fogColor: string | null;
  fogDensity: number | null;
};

export type TransitionSnapshotState = {
  count: number;
  byLayer: Record<string, number>;
  maxOpacityByLayer: Record<string, number>;
};

export type ResistivityLegendHandleState = {
  focusMin: number;
  focusMax: number;
  blendMin: number;
  blendMax: number;
};

export type PageControllerDebugState = {
  currentIndex: number;
  currentPageId: string | null;
  targetIndex: number | null;
  targetPageId?: string | null;
  transitionProgress: number;
  isTransitioning: boolean;
  transitionContext?: {
    sourcePageId: string | null;
    targetPageId: string | null;
    reason: string;
    sourcePose: { position: number[]; target: number[]; fov: number };
    targetPose: { position: number[]; target: number[]; fov: number };
  } | null;
  sceneTransition?: {
    active: boolean;
    sourcePageId: string | null;
    targetPageId: string | null;
    reason: string | null;
    activeDataTransitionCount: number;
    snapshotCount: number;
    scalarTweenCount: number;
    layerTweenCount: number;
  } | null;
};

export type SectionIsoSceneState = {
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

export async function seismicSceneState(page: Page): Promise<SeismicSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  userData: Record<string, unknown>;
                  traverse: (
                    fn: (obj: {
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
                      material?:
                        | {
                            opacity?: unknown;
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            opacity?: unknown;
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                      position?: { x: number; y: number; z: number };
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene;
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
        navigationRoleVisibility: {
          sources: false,
          receivers: false,
          lines: false,
        },
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

export async function sceneSectionState(page: Page): Promise<SceneSectionState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  traverse: (
                    fn: (obj: {
                      visible: boolean;
                      userData?: Record<string, unknown>;
                      material?:
                        | {
                            clippingPlanes?: Array<{
                              normal?: {
                                x?: unknown;
                                y?: unknown;
                                z?: unknown;
                              };
                              constant?: unknown;
                            }> | null;
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            clippingPlanes?: Array<{
                              normal?: {
                                x?: unknown;
                                y?: unknown;
                                z?: unknown;
                              };
                              constant?: unknown;
                            }> | null;
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
            listSceneSectionPlanePickables?: () => Array<{
              name?: string;
              userData?: Record<string, unknown>;
            }>;
          };
        };
      }
    ).__scene;
    const manager = sceneHandle?.manager;
    const seismicLayer = manager?.getLayer?.(
      "utah-forge-phase3-seismic-browser",
    );
    const mtLayer = manager?.getLayer?.(
      "utah-forge-mt-resistivity-full-density",
    );
    const helperPickables = manager?.listSceneSectionPlanePickables?.() ?? [];
    const vectorToArray = (value: unknown): [number, number, number] | null => {
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
      helperPickableNames: helperPickables.map(
        (pickable) => pickable.name ?? "",
      ),
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
        .filter(
          (direction): direction is number => typeof direction === "number",
        ),
      firstVisibleVolumeSectionUniforms,
      mtClippedMaterials,
      mtFirstClippingPlane,
    };
  });
}

export type WorkingAreaFocusSceneState = {
  focus: {
    enabled: boolean;
    mode: string;
    boundsLayerId: string;
    targetLayerIds: string[];
    outsideOpacityByLayerId: Record<string, number>;
    helperVisible: boolean;
    helperRenderable: boolean;
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
  } | null;
  layers: Record<
    string,
    {
      materialCount: number;
      focusedMaterialCount: number;
      unsupportedMaterialCount: number;
      firstOutsideOpacity: number | null;
      firstUniformOutsideOpacity: number | null;
      firstUniformEnabled: number | null;
    }
  >;
};

export async function workingAreaFocusSceneState(
  page: Page,
): Promise<WorkingAreaFocusSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getWorkingAreaFocusDebugState?: () => WorkingAreaFocusSceneState["focus"];
            getLayer?: (id: string) =>
              | {
                  traverse: (
                    fn: (obj: {
                      material?:
                        | {
                            userData?: Record<string, unknown>;
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            userData?: Record<string, unknown>;
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene;
    const manager = sceneHandle?.manager;
    const layerIds = [
      "utah-forge-mt-resistivity-full-density",
      "utah-forge-mt-resistivity-preview",
      "utah-forge-mt-resistivity-volume",
      "utah-forge-phase3-seismic-browser",
    ];
    const layers: WorkingAreaFocusSceneState["layers"] = {};
    for (const layerId of layerIds) {
      let materialCount = 0;
      let focusedMaterialCount = 0;
      let unsupportedMaterialCount = 0;
      let firstOutsideOpacity: number | null = null;
      let firstUniformOutsideOpacity: number | null = null;
      let firstUniformEnabled: number | null = null;
      manager?.getLayer?.(layerId)?.traverse((obj) => {
        const materials = Array.isArray(obj.material)
          ? obj.material
          : obj.material
            ? [obj.material]
            : [];
        for (const material of materials) {
          materialCount += 1;
          if (material.userData?.workingAreaFocusEnabled === true) {
            focusedMaterialCount += 1;
            if (
              firstOutsideOpacity === null &&
              typeof material.userData.workingAreaFocusOutsideOpacity ===
                "number"
            ) {
              firstOutsideOpacity =
                material.userData.workingAreaFocusOutsideOpacity;
            }
          }
          if (material.userData?.workingAreaFocusUnsupported === true) {
            unsupportedMaterialCount += 1;
          }
          const uniforms = material.uniforms ?? {};
          if (
            firstUniformOutsideOpacity === null &&
            typeof uniforms.uWorkingAreaFocusOutsideOpacity?.value === "number"
          ) {
            firstUniformOutsideOpacity =
              uniforms.uWorkingAreaFocusOutsideOpacity.value;
          }
          if (
            firstUniformEnabled === null &&
            typeof uniforms.uWorkingAreaFocusEnabled?.value === "number"
          ) {
            firstUniformEnabled = uniforms.uWorkingAreaFocusEnabled.value;
          }
        }
      });
      layers[layerId] = {
        materialCount,
        focusedMaterialCount,
        unsupportedMaterialCount,
        firstOutsideOpacity,
        firstUniformOutsideOpacity,
        firstUniformEnabled,
      };
    }
    return {
      focus: manager?.getWorkingAreaFocusDebugState?.() ?? null,
      layers,
    };
  });
}

export type TerrainMaterialSceneState = {
  materialCount: number;
  surfaceElevationEnabled: number | null;
  surfaceElevationMinM: number | null;
  surfaceElevationMaxM: number | null;
  surfaceElevationReverse: number | null;
  elevationOffsetM: number | null;
  publicClipEnabled: number | null;
  publicClipShape: number | null;
  edgeFadeDistanceM: number | null;
  edgeFadeShape: number | null;
  edgeFadeInsetM: number | null;
  edgeFadeCornerRadiusM: number | null;
  orthoPhotoEnabled: number | null;
  orthoPhotoOpacity: number | null;
  orthoPhotoHillshadeBlend: number | null;
  orthoPhotoBrightness: number | null;
  orthoPhotoContrast: number | null;
  orthoPhotoSaturation: number | null;
  surfaceElevationColors: string[];
  surfaceElevationPositions: number[];
  surfaceElevationMidpoints: number[];
  surfaceElevationTransitionSoftness: number | null;
  surfaceElevationColorBlend: number | null;
};

export async function terrainMaterialSceneState(
  page: Page,
): Promise<TerrainMaterialSceneState> {
  return page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  traverse: (
                    fn: (obj: {
                      material?:
                        | {
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene?.manager;
    let materialCount = 0;
    let surfaceElevationEnabled: number | null = null;
    let surfaceElevationMinM: number | null = null;
    let surfaceElevationMaxM: number | null = null;
    let surfaceElevationReverse: number | null = null;
    let elevationOffsetM: number | null = null;
    let publicClipEnabled: number | null = null;
    let publicClipShape: number | null = null;
    let edgeFadeDistanceM: number | null = null;
    let edgeFadeShape: number | null = null;
    let edgeFadeInsetM: number | null = null;
    let edgeFadeCornerRadiusM: number | null = null;
    let orthoPhotoEnabled: number | null = null;
    let orthoPhotoOpacity: number | null = null;
    let orthoPhotoHillshadeBlend: number | null = null;
    let orthoPhotoBrightness: number | null = null;
    let orthoPhotoContrast: number | null = null;
    let orthoPhotoSaturation: number | null = null;
    let surfaceElevationColors: string[] = [];
    let surfaceElevationPositions: number[] = [];
    let surfaceElevationMidpoints: number[] = [];
    let surfaceElevationTransitionSoftness: number | null = null;
    let surfaceElevationColorBlend: number | null = null;
    manager?.getLayer?.("terrain")?.traverse((obj) => {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      for (const material of materials) {
        const uniforms = material.uniforms ?? {};
        if (typeof uniforms.uSurfaceElevationEnabled?.value !== "number") {
          continue;
        }
        materialCount += 1;
        surfaceElevationEnabled = uniforms.uSurfaceElevationEnabled.value;
        surfaceElevationMinM =
          typeof uniforms.uSurfaceElevationMin?.value === "number"
            ? uniforms.uSurfaceElevationMin.value
            : null;
        surfaceElevationMaxM =
          typeof uniforms.uSurfaceElevationMax?.value === "number"
            ? uniforms.uSurfaceElevationMax.value
            : null;
        surfaceElevationReverse =
          typeof uniforms.uSurfaceElevationReverse?.value === "number"
            ? uniforms.uSurfaceElevationReverse.value
            : null;
        elevationOffsetM =
          typeof uniforms.uElevationOffsetM?.value === "number"
            ? uniforms.uElevationOffsetM.value
            : null;
        publicClipEnabled =
          typeof uniforms.uPublicClipEnabled?.value === "number"
            ? uniforms.uPublicClipEnabled.value
            : null;
        publicClipShape =
          typeof uniforms.uPublicClipShape?.value === "number"
            ? uniforms.uPublicClipShape.value
            : null;
        edgeFadeDistanceM =
          typeof uniforms.uEdgeFadeDistance?.value === "number"
            ? uniforms.uEdgeFadeDistance.value
            : null;
        edgeFadeShape =
          typeof uniforms.uEdgeFadeShape?.value === "number"
            ? uniforms.uEdgeFadeShape.value
            : null;
        edgeFadeInsetM =
          typeof uniforms.uEdgeFadeInset?.value === "number"
            ? uniforms.uEdgeFadeInset.value
            : null;
        edgeFadeCornerRadiusM =
          typeof uniforms.uEdgeFadeCornerRadius?.value === "number"
            ? uniforms.uEdgeFadeCornerRadius.value
            : null;
        orthoPhotoEnabled =
          typeof uniforms.uOrthoPhotoEnabled?.value === "number"
            ? uniforms.uOrthoPhotoEnabled.value
            : null;
        orthoPhotoOpacity =
          typeof uniforms.uOrthoPhotoOpacity?.value === "number"
            ? uniforms.uOrthoPhotoOpacity.value
            : null;
        orthoPhotoHillshadeBlend =
          typeof uniforms.uOrthoPhotoHillshadeBlend?.value === "number"
            ? uniforms.uOrthoPhotoHillshadeBlend.value
            : null;
        orthoPhotoBrightness =
          typeof uniforms.uOrthoPhotoBrightness?.value === "number"
            ? uniforms.uOrthoPhotoBrightness.value
            : null;
        orthoPhotoContrast =
          typeof uniforms.uOrthoPhotoContrast?.value === "number"
            ? uniforms.uOrthoPhotoContrast.value
            : null;
        orthoPhotoSaturation =
          typeof uniforms.uOrthoPhotoSaturation?.value === "number"
            ? uniforms.uOrthoPhotoSaturation.value
            : null;
        const colorValues = Array.isArray(
          uniforms.uSurfaceElevationColors?.value,
        )
          ? uniforms.uSurfaceElevationColors.value
          : [];
        surfaceElevationColors = colorValues
          .map((color) =>
            typeof color?.getHexString === "function"
              ? `#${color.getHexString()}`
              : null,
          )
          .filter((color): color is string => typeof color === "string");
        const positionValues = Array.isArray(
          uniforms.uSurfaceElevationPositions?.value,
        )
          ? uniforms.uSurfaceElevationPositions.value
          : [];
        surfaceElevationPositions = positionValues.filter(
          (value): value is number => typeof value === "number",
        );
        const midpointValues = Array.isArray(
          uniforms.uSurfaceElevationMidpoints?.value,
        )
          ? uniforms.uSurfaceElevationMidpoints.value
          : [];
        surfaceElevationMidpoints = midpointValues.filter(
          (value): value is number => typeof value === "number",
        );
        surfaceElevationTransitionSoftness =
          typeof uniforms.uSurfaceElevationTransitionSoftness?.value ===
          "number"
            ? uniforms.uSurfaceElevationTransitionSoftness.value
            : null;
        surfaceElevationColorBlend =
          typeof uniforms.uSurfaceElevationColorBlend?.value === "number"
            ? uniforms.uSurfaceElevationColorBlend.value
            : null;
      }
    });
    return {
      materialCount,
      surfaceElevationEnabled,
      surfaceElevationMinM,
      surfaceElevationMaxM,
      surfaceElevationReverse,
      elevationOffsetM,
      publicClipEnabled,
      publicClipShape,
      edgeFadeDistanceM,
      edgeFadeShape,
      edgeFadeInsetM,
      edgeFadeCornerRadiusM,
      orthoPhotoEnabled,
      orthoPhotoOpacity,
      orthoPhotoHillshadeBlend,
      orthoPhotoBrightness,
      orthoPhotoContrast,
      orthoPhotoSaturation,
      surfaceElevationColors,
      surfaceElevationPositions,
      surfaceElevationMidpoints,
      surfaceElevationTransitionSoftness,
      surfaceElevationColorBlend,
    };
  });
}

export type TopoGraticuleSceneState = {
  layerVisible: boolean | null;
  lineObjectCount: number;
  interiorLineObjectCount: number;
  dashedInteriorLineObjectCount: number;
  leaderLineObjectCount: number;
  dashedLeaderLineObjectCount: number;
  labelObjectCount: number;
  visibleLabelCount: number;
  visibleLabelWithoutLeaderCount: number;
  firstLabelScaleX: number | null;
  firstLabelPosition: { x: number; y: number; z: number } | null;
  firstLabelRotationDeg: number | null;
  firstLabelColor: string | null;
  firstLineClippingPlanes: number | null;
  firstLineEdgeEnabled: boolean | null;
  firstLineEdgeStrength: number | null;
  firstLineEdgeShape: string | null;
  firstLineEdgeDistanceM: number | null;
  firstLineEdgeLineColor: string | null;
  generatedBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
  terrainBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
  minLabelInsideDistance: number | null;
  graticuleInnerTrimInsideDistance: number | null;
  graticuleLabelOffsetM: number | null;
  graticuleLabelGapM: number | null;
  interiorSegmentCount: number | null;
  dashedInteriorSegmentCount: number | null;
  leaderSegmentCount: number | null;
  dashedLeaderSegmentCount: number | null;
  maxLabelTangentErrorDeg: number | null;
  northLabelOutsideCount: number;
  westLabelOutsideCount: number;
};

export type TitleBlockSceneState = {
  groupExists: boolean;
  groupRotationDeg: number | null;
  groupPosition: { x: number; y: number; z: number } | null;
  contentWidthM: number | null;
  contentHeightM: number | null;
  logoCount: number;
  logoHasMap: boolean;
  logoWidthM: number | null;
  logoHeightM: number | null;
  headingCount: number;
  subheadingCount: number;
  backgroundCount: number;
  outlineCount: number;
  textDepthTest: boolean | null;
  textToneMapped: boolean | null;
  textFog: boolean | null;
  textColor: string | null;
};

export async function topoGraticuleSceneState(
  page: Page,
): Promise<TopoGraticuleSceneState> {
  return page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  traverse: (
                    fn: (obj: {
                      visible?: boolean;
                      userData?: Record<string, unknown>;
                      scale?: { x: number };
                      position?: { x: number; y: number; z: number };
                      rotation?: { z: number };
                      material?:
                        | {
                            clippingPlanes?: unknown[] | null;
                            color?: { getHexString?: () => string };
                            userData?: Record<string, unknown>;
                          }
                        | Array<{
                            clippingPlanes?: unknown[] | null;
                            color?: { getHexString?: () => string };
                            userData?: Record<string, unknown>;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene?.manager;
    const normalizeAngle = (angle: number) => {
      let next = angle;
      while (next > Math.PI / 2) next -= Math.PI;
      while (next < -Math.PI / 2) next += Math.PI;
      return next;
    };
    const finiteBounds = (value: unknown) => {
      const bounds = value as
        | {
            minX?: unknown;
            minY?: unknown;
            maxX?: unknown;
            maxY?: unknown;
          }
        | undefined;
      return typeof bounds?.minX === "number" &&
        typeof bounds.minY === "number" &&
        typeof bounds.maxX === "number" &&
        typeof bounds.maxY === "number" &&
        Number.isFinite(bounds.minX) &&
        Number.isFinite(bounds.minY) &&
        Number.isFinite(bounds.maxX) &&
        Number.isFinite(bounds.maxY)
        ? {
            minX: bounds.minX,
            minY: bounds.minY,
            maxX: bounds.maxX,
            maxY: bounds.maxY,
          }
        : null;
    };
    const terrain = manager?.getLayer?.("terrain");
    const layer = manager?.getLayer?.("utah-forge-topo-graticule");
    let terrainBounds: TopoGraticuleSceneState["terrainBounds"] = null;
    terrain?.traverse((obj) => {
      if (terrainBounds) return;
      const uniforms = (
        obj.userData?.terrainHandle as
          | {
              material?: {
                uniforms?: Record<string, { value?: unknown }>;
              };
            }
          | undefined
      )?.material?.uniforms;
      const min = uniforms?.uTerrainBoundsMin?.value as
        | { x?: unknown; y?: unknown }
        | undefined;
      const max = uniforms?.uTerrainBoundsMax?.value as
        | { x?: unknown; y?: unknown }
        | undefined;
      if (
        typeof min?.x === "number" &&
        typeof min.y === "number" &&
        typeof max?.x === "number" &&
        typeof max.y === "number"
      ) {
        terrainBounds = {
          minX: min.x,
          minY: min.y,
          maxX: max.x,
          maxY: max.y,
        };
      }
    });
    let lineObjectCount = 0;
    let interiorLineObjectCount = 0;
    let dashedInteriorLineObjectCount = 0;
    let leaderLineObjectCount = 0;
    let dashedLeaderLineObjectCount = 0;
    let labelObjectCount = 0;
    let visibleLabelCount = 0;
    let visibleLabelWithoutLeaderCount = 0;
    let firstLabelScaleX: number | null = null;
    let firstLabelPosition: { x: number; y: number; z: number } | null = null;
    let firstLabelRotationDeg: number | null = null;
    let firstLabelColor: string | null = null;
    let firstLineClippingPlanes: number | null = null;
    let firstLineEdgeEnabled: boolean | null = null;
    let firstLineEdgeStrength: number | null = null;
    let firstLineEdgeShape: string | null = null;
    let firstLineEdgeDistanceM: number | null = null;
    let firstLineEdgeLineColor: string | null = null;
    let generatedBounds: TopoGraticuleSceneState["generatedBounds"] = null;
    let minLabelInsideDistance: number | null = null;
    let graticuleInnerTrimInsideDistance: number | null = null;
    let graticuleLabelOffsetM: number | null = null;
    let graticuleLabelGapM: number | null = null;
    let interiorSegmentCount: number | null = null;
    let dashedInteriorSegmentCount: number | null = null;
    let leaderSegmentCount: number | null = null;
    let dashedLeaderSegmentCount: number | null = null;
    let maxLabelTangentErrorDeg: number | null = null;
    let northLabelOutsideCount = 0;
    let westLabelOutsideCount = 0;
    layer?.traverse((obj) => {
      if (obj.userData?.topoGraticule === true) {
        const trim = obj.userData?.topoGraticuleInnerTrimInsideDistance;
        const offset = obj.userData?.topoGraticuleLabelOffsetM;
        const gap = obj.userData?.topoGraticuleLabelGapM;
        const interiorCount = obj.userData?.topoGraticuleInteriorSegmentCount;
        const dashedInteriorCount =
          obj.userData?.topoGraticuleDashedInteriorSegmentCount;
        const leaderCount = obj.userData?.topoGraticuleLeaderSegmentCount;
        const dashedLeaderCount =
          obj.userData?.topoGraticuleDashedLeaderSegmentCount;
        graticuleInnerTrimInsideDistance =
          typeof trim === "number" ? trim : graticuleInnerTrimInsideDistance;
        graticuleLabelOffsetM =
          typeof offset === "number" ? offset : graticuleLabelOffsetM;
        graticuleLabelGapM =
          typeof gap === "number" ? gap : graticuleLabelGapM;
        interiorSegmentCount =
          typeof interiorCount === "number"
            ? interiorCount
            : interiorSegmentCount;
        dashedInteriorSegmentCount =
          typeof dashedInteriorCount === "number"
            ? dashedInteriorCount
            : dashedInteriorSegmentCount;
        leaderSegmentCount =
          typeof leaderCount === "number" ? leaderCount : leaderSegmentCount;
        dashedLeaderSegmentCount =
          typeof dashedLeaderCount === "number"
            ? dashedLeaderCount
            : dashedLeaderSegmentCount;
      }
      if (obj.userData?.topoGraticuleLines === true) {
        lineObjectCount += 1;
        if (obj.userData?.topoGraticuleLineRole === "interior") {
          interiorLineObjectCount += 1;
        }
        if (obj.userData?.topoGraticuleLineRole === "interior-dashed") {
          dashedInteriorLineObjectCount += 1;
        }
        if (obj.userData?.topoGraticuleLineRole === "leader") {
          leaderLineObjectCount += 1;
        }
        if (obj.userData?.topoGraticuleLineRole === "leader-dashed") {
          dashedLeaderLineObjectCount += 1;
        }
        generatedBounds =
          generatedBounds ??
          finiteBounds(obj.userData?.topoGraticuleGeneratedBounds);
        const material = Array.isArray(obj.material)
          ? obj.material[0]
          : obj.material;
        const edgeSettings = material?.userData
          ?.topoGraticuleEdgeFadeSettings as
          | {
              enabled?: boolean;
              strength?: number;
              edgeFadeShape?: string;
              edgeFadeDistanceM?: number;
              lineColor?: string;
            }
          | undefined;
        if (firstLineEdgeEnabled === null) {
          firstLineEdgeEnabled =
            typeof edgeSettings?.enabled === "boolean"
              ? edgeSettings.enabled
              : null;
          firstLineEdgeStrength =
            typeof edgeSettings?.strength === "number"
              ? edgeSettings.strength
              : null;
          firstLineEdgeShape =
            typeof edgeSettings?.edgeFadeShape === "string"
              ? edgeSettings.edgeFadeShape
              : null;
          firstLineEdgeDistanceM =
            typeof edgeSettings?.edgeFadeDistanceM === "number"
              ? edgeSettings.edgeFadeDistanceM
              : null;
          firstLineEdgeLineColor =
            typeof edgeSettings?.lineColor === "string"
              ? edgeSettings.lineColor
              : null;
        }
        if (firstLineClippingPlanes === null) {
          firstLineClippingPlanes = Array.isArray(material?.clippingPlanes)
            ? material.clippingPlanes.length
            : 0;
        }
      }
      if (obj.userData?.topoGraticuleLabel === true) {
        labelObjectCount += 1;
        if (obj.visible !== false) {
          visibleLabelCount += 1;
          if (obj.userData?.topoGraticuleLabelHasLeader === false) {
            visibleLabelWithoutLeaderCount += 1;
          }
        }
        if (firstLabelScaleX === null && typeof obj.scale?.x === "number") {
          firstLabelScaleX = obj.scale.x;
        }
        if (firstLabelPosition === null && obj.position) {
          firstLabelPosition = {
            x: obj.position.x,
            y: obj.position.y,
            z: obj.position.z,
          };
        }
        if (
          firstLabelRotationDeg === null &&
          typeof obj.rotation?.z === "number"
        ) {
          firstLabelRotationDeg = (obj.rotation.z * 180) / Math.PI;
        }
        const insideDistance =
          obj.userData?.topoGraticuleActiveLabelInsideDistance;
        if (typeof insideDistance === "number") {
          minLabelInsideDistance =
            minLabelInsideDistance === null
              ? insideDistance
              : Math.min(minLabelInsideDistance, insideDistance);
          if (
            insideDistance < 0 &&
            obj.userData?.topoGraticuleLabelPreference === "north"
          ) {
            northLabelOutsideCount += 1;
          }
          if (
            insideDistance < 0 &&
            obj.userData?.topoGraticuleLabelPreference === "west"
          ) {
            westLabelOutsideCount += 1;
          }
        }
        const tangent = obj.userData?.topoGraticuleActiveLabelTangent as
          | { x?: unknown; y?: unknown }
          | undefined;
        if (
          typeof tangent?.x === "number" &&
          typeof tangent.y === "number" &&
          typeof obj.rotation?.z === "number"
        ) {
          const tangentAngle = normalizeAngle(
            Math.atan2(tangent.y, tangent.x),
          );
          const labelAngle = normalizeAngle(obj.rotation.z);
          const errorDeg =
            (Math.abs(normalizeAngle(labelAngle - tangentAngle)) * 180) /
            Math.PI;
          maxLabelTangentErrorDeg =
            maxLabelTangentErrorDeg === null
              ? errorDeg
              : Math.max(maxLabelTangentErrorDeg, errorDeg);
        }
        const material = Array.isArray(obj.material)
          ? obj.material[0]
          : obj.material;
        if (
          firstLabelColor === null &&
          material?.color?.getHexString
        ) {
          firstLabelColor = `#${material.color.getHexString()}`;
        }
      }
    });
    return {
      layerVisible: layer?.visible ?? null,
      lineObjectCount,
      interiorLineObjectCount,
      dashedInteriorLineObjectCount,
      leaderLineObjectCount,
      dashedLeaderLineObjectCount,
      labelObjectCount,
      visibleLabelCount,
      visibleLabelWithoutLeaderCount,
      firstLabelScaleX,
      firstLabelPosition,
      firstLabelRotationDeg,
      firstLabelColor,
      firstLineClippingPlanes,
      firstLineEdgeEnabled,
      firstLineEdgeStrength,
      firstLineEdgeShape,
      firstLineEdgeDistanceM,
      firstLineEdgeLineColor,
      generatedBounds,
      terrainBounds,
      minLabelInsideDistance,
      graticuleInnerTrimInsideDistance,
      graticuleLabelOffsetM,
      graticuleLabelGapM,
      interiorSegmentCount,
      dashedInteriorSegmentCount,
      leaderSegmentCount,
      dashedLeaderSegmentCount,
      maxLabelTangentErrorDeg,
      northLabelOutsideCount,
      westLabelOutsideCount,
    };
  });
}

export async function titleBlockSceneState(
  page: Page,
): Promise<TitleBlockSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          scene?: {
            traverse: (
              fn: (obj: {
                name?: string;
                userData?: Record<string, unknown>;
                position?: { x: number; y: number; z: number };
                rotation?: { z: number };
                visible?: boolean;
                geometry?: {
                  parameters?: { width?: number; height?: number };
                };
                material?:
                  | {
                      map?: unknown;
                      depthTest?: boolean;
                      toneMapped?: boolean;
                      fog?: boolean;
                      color?: { getHexString?: () => string };
                    }
                  | Array<{
                      map?: unknown;
                      depthTest?: boolean;
                      toneMapped?: boolean;
                      fog?: boolean;
                      color?: { getHexString?: () => string };
                    }>;
              }) => void,
            ) => void;
          };
        };
      }
    ).__scene;
    let groupExists = false;
    let groupRotationDeg: number | null = null;
    let groupPosition: TitleBlockSceneState["groupPosition"] = null;
    let contentWidthM: number | null = null;
    let contentHeightM: number | null = null;
    let logoCount = 0;
    let logoHasMap = false;
    let logoWidthM: number | null = null;
    let logoHeightM: number | null = null;
    let headingCount = 0;
    let subheadingCount = 0;
    let backgroundCount = 0;
    let outlineCount = 0;
    let textDepthTest: boolean | null = null;
    let textToneMapped: boolean | null = null;
    let textFog: boolean | null = null;
    let textColor: string | null = null;

    sceneHandle?.scene?.traverse((obj) => {
      if (obj.name === "__topo_map_branding__") {
        groupExists = true;
        groupRotationDeg =
          typeof obj.rotation?.z === "number"
            ? (obj.rotation.z * 180) / Math.PI
            : null;
        groupPosition = obj.position
          ? { x: obj.position.x, y: obj.position.y, z: obj.position.z }
          : null;
      }
      if (obj.userData?.topoMapBrandingContent === true) {
        contentWidthM =
          typeof obj.userData.topoMapBrandingContentWidthM === "number"
            ? obj.userData.topoMapBrandingContentWidthM
            : contentWidthM;
        contentHeightM =
          typeof obj.userData.topoMapBrandingContentHeightM === "number"
            ? obj.userData.topoMapBrandingContentHeightM
            : contentHeightM;
      }
      const role = obj.userData?.topoMapBrandingRole;
      const material = Array.isArray(obj.material)
        ? obj.material[0]
        : obj.material;
      if (role === "logo" && obj.visible !== false) {
        logoCount += 1;
        logoHasMap = logoHasMap || Boolean(material?.map);
        logoWidthM =
          typeof obj.geometry?.parameters?.width === "number"
            ? obj.geometry.parameters.width
            : logoWidthM;
        logoHeightM =
          typeof obj.geometry?.parameters?.height === "number"
            ? obj.geometry.parameters.height
            : logoHeightM;
      }
      if (role === "heading") headingCount += 1;
      if (role === "subheading") subheadingCount += 1;
      if (role === "background") backgroundCount += 1;
      if (role === "outline") outlineCount += 1;
      if ((role === "heading" || role === "subheading") && material) {
        textDepthTest =
          typeof material.depthTest === "boolean"
            ? material.depthTest
            : textDepthTest;
        textToneMapped =
          typeof material.toneMapped === "boolean"
            ? material.toneMapped
            : textToneMapped;
        textFog = typeof material.fog === "boolean" ? material.fog : textFog;
        textColor =
          typeof material.color?.getHexString === "function"
            ? `#${material.color.getHexString()}`
            : textColor;
      }
    });

    return {
      groupExists,
      groupRotationDeg,
      groupPosition,
      contentWidthM,
      contentHeightM,
      logoCount,
      logoHasMap,
      logoWidthM,
      logoHeightM,
      headingCount,
      subheadingCount,
      backgroundCount,
      outlineCount,
      textDepthTest,
      textToneMapped,
      textFog,
      textColor,
    };
  });
}

export function tinyPdfBase64(): string {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 60] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    "<< /Length 44 >>\nstream\nBT /F1 16 Tf 12 28 Td (Title Block) Tj ET\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8").toString("base64");
}

export async function mtVolumeSceneState(page: Page): Promise<MtVolumeSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  userData: Record<string, unknown>;
                  traverse: (
                    fn: (obj: {
                      visible: boolean;
                      userData?: Record<string, unknown>;
                      material?:
                        | {
                            wireframe?: boolean;
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            wireframe?: boolean;
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene;
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
        const material = Array.isArray(obj.material)
          ? obj.material[0]
          : obj.material;
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
      if (obj.userData?.mtThresholdSurfacePreview !== true || !obj.visible)
        return;
      const surfaceId = obj.userData.mtThresholdSurfaceId;
      if (typeof surfaceId === "string")
        visibleThresholdSurfaceIds.push(surfaceId);
      const material = Array.isArray(obj.material)
        ? obj.material[0]
        : obj.material;
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

export async function mtFullDensityPointSceneState(
  page: Page,
): Promise<MtFullDensityPointSceneState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) =>
              | {
                  visible: boolean;
                  traverse: (
                    fn: (obj: {
                      visible: boolean;
                      userData?: Record<string, unknown>;
                      geometry?: {
                        index?: { count: number } | null;
                        userData?: Record<string, unknown>;
                        getAttribute?: (
                          name: string,
                        ) => { count: number } | undefined;
                      };
                      material?:
                        | {
                            opacity?: number;
                            size?: number;
                            transparent?: boolean;
                            vertexColors?: boolean;
                            depthTest?: boolean;
                            depthWrite?: boolean;
                          }
                        | Array<{
                            opacity?: number;
                            size?: number;
                            transparent?: boolean;
                            vertexColors?: boolean;
                            depthTest?: boolean;
                            depthWrite?: boolean;
                          }>;
                    }) => void,
                  ) => void;
                }
              | undefined;
          };
        };
      }
    ).__scene;
    const layer = sceneHandle?.manager?.getLayer?.(
      "utah-forge-mt-resistivity-full-density",
    );
    let pointObjects = 0;
    let visiblePointObjects = 0;
    let totalPointCount = 0;
    let indexedVisiblePointCount = 0;
    let scalarFocusVisibleCount: number | null = null;
    let firstTileId: string | null = null;
    let firstScalarDisplayMin: number | null = null;
    let firstScalarDisplayMax: number | null = null;
    let firstMaterial: MtFullDensityPointSceneState["firstMaterial"] = null;

    layer?.traverse((obj) => {
      if (obj.userData?.tiledPointCloudTile !== true) return;
      pointObjects += 1;
      const positionCount =
        obj.geometry?.getAttribute?.("position")?.count ?? 0;
      totalPointCount +=
        typeof obj.userData.pointCount === "number"
          ? obj.userData.pointCount
          : positionCount;
      if (!obj.visible) return;
      visiblePointObjects += 1;
      indexedVisiblePointCount += obj.geometry?.index?.count ?? positionCount;
      if (scalarFocusVisibleCount === null) {
        scalarFocusVisibleCount =
          typeof obj.geometry?.userData?.scalarFocusVisibleCount === "number"
            ? obj.geometry.userData.scalarFocusVisibleCount
            : null;
      }
      if (firstTileId === null && typeof obj.userData.tileId === "string") {
        firstTileId = obj.userData.tileId;
      }
      if (firstScalarDisplayMin === null || firstScalarDisplayMax === null) {
        const scalar = obj.geometry?.userData?.scalar;
        if (typeof scalar === "object" && scalar !== null) {
          const scalarRecord = scalar as Record<string, unknown>;
          firstScalarDisplayMin =
            typeof scalarRecord.displayMin === "number"
              ? scalarRecord.displayMin
              : null;
          firstScalarDisplayMax =
            typeof scalarRecord.displayMax === "number"
              ? scalarRecord.displayMax
              : null;
        }
      }
      if (!firstMaterial) {
        const material = Array.isArray(obj.material)
          ? obj.material[0]
          : obj.material;
        firstMaterial = material
          ? {
              opacity:
                typeof material.opacity === "number" ? material.opacity : null,
              size: typeof material.size === "number" ? material.size : null,
              transparent:
                typeof material.transparent === "boolean"
                  ? material.transparent
                  : null,
              vertexColors:
                typeof material.vertexColors === "boolean"
                  ? material.vertexColors
                  : null,
              depthTest:
                typeof material.depthTest === "boolean"
                  ? material.depthTest
                  : null,
              depthWrite:
                typeof material.depthWrite === "boolean"
                  ? material.depthWrite
                  : null,
            }
          : null;
      }
    });

    return {
      layerVisible: layer?.visible ?? false,
      pointObjects,
      visiblePointObjects,
      totalPointCount,
      indexedVisiblePointCount,
      scalarFocusVisibleCount,
      firstTileId,
      firstScalarDisplayMin,
      firstScalarDisplayMax,
      firstMaterial,
    };
  });
}

export async function utahForgeRuntimePresentationState(
  page: Page,
): Promise<UtahForgeRuntimePresentationState> {
  return page.evaluate(() => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          scene?: {
            background?: { getHexString?: () => string };
            fog?: {
              color?: { getHexString?: () => string };
              density?: number;
            } | null;
          };
          renderer?: {
            toneMappingExposure?: number;
            getClearColor?: (target: unknown) => unknown;
          };
          manager?: {
            lastAppliedRenderPresetId?: string | null;
          };
        };
      }
    ).__scene;
    const colorHex = (
      value: { getHexString?: () => string } | null | undefined,
    ) =>
      typeof value?.getHexString === "function"
        ? `#${value.getHexString()}`
        : null;
    const clearTarget = {
      hex: null as string | null,
      copy(color: { getHexString?: () => string }) {
        this.hex = colorHex(color);
        return this;
      },
    };
    sceneHandle?.renderer?.getClearColor?.(clearTarget);
    return {
      activeRenderPresetId:
        sceneHandle?.manager?.lastAppliedRenderPresetId ?? null,
      rendererExposure:
        typeof sceneHandle?.renderer?.toneMappingExposure === "number"
          ? sceneHandle.renderer.toneMappingExposure
          : null,
      clearColor: clearTarget.hex,
      sceneBackground: colorHex(sceneHandle?.scene?.background),
      fogColor: colorHex(sceneHandle?.scene?.fog?.color),
      fogDensity:
        typeof sceneHandle?.scene?.fog?.density === "number"
          ? sceneHandle.scene.fog.density
          : null,
    };
  });
}

export async function transitionSnapshotState(
  page: Page,
): Promise<TransitionSnapshotState> {
  return page.evaluate(() => {
    const scene = (
      window as unknown as {
        __scene?: {
          scene?: {
            children?: Array<{
              visible?: boolean;
              userData?: Record<string, unknown>;
              traverse?: (
                fn: (obj: {
                  visible?: boolean;
                  material?:
                    | {
                        opacity?: number;
                        uniforms?: Record<string, { value: unknown }>;
                      }
                    | Array<{
                        opacity?: number;
                        uniforms?: Record<string, { value: unknown }>;
                      }>;
                }) => void,
              ) => void;
            }>;
          };
        };
      }
    ).__scene?.scene;
    const byLayer: Record<string, number> = {};
    const maxOpacityByLayer: Record<string, number> = {};
    for (const child of scene?.children ?? []) {
      const layerId =
        typeof child.userData?.transitionSnapshotForLayer === "string"
          ? child.userData.transitionSnapshotForLayer
          : null;
      if (!layerId) continue;
      byLayer[layerId] = (byLayer[layerId] ?? 0) + 1;
      maxOpacityByLayer[layerId] = Math.max(
        maxOpacityByLayer[layerId] ?? 0,
        child.visible === false ? 0 : 0,
      );
      child.traverse?.((obj) => {
        if (obj.visible === false) return;
        const materials = Array.isArray(obj.material)
          ? obj.material
          : obj.material
            ? [obj.material]
            : [];
        for (const material of materials) {
          const uniformOpacity = material.uniforms?.uOpacity?.value;
          const opacity =
            typeof uniformOpacity === "number"
              ? uniformOpacity
              : typeof material.opacity === "number"
                ? material.opacity
                : 0;
          maxOpacityByLayer[layerId] = Math.max(
            maxOpacityByLayer[layerId] ?? 0,
            opacity,
          );
        }
      });
    }
    return {
      count: Object.values(byLayer).reduce((total, count) => total + count, 0),
      byLayer,
      maxOpacityByLayer,
    };
  });
}

export async function runForgeDataTransitionProbe(
  page: Page,
  environment: EnvironmentSetup,
  fromPage: PresentationPage,
  toPage: PresentationPage,
  durationMs = 3000,
): Promise<void> {
  await page.evaluate(
    ({ environmentSpec, fromPageSpec, toPageSpec, duration }) => {
      const manager = (
        window as unknown as {
          __scene?: {
            manager?: {
              applyEffectiveVisibilityForPage?: (
                environment: unknown,
                page: unknown,
              ) => void;
              applyEffectiveStylesForPage?: (
                environment: unknown,
                page: unknown,
              ) => void;
              applyPageScene?: (page: unknown) => void;
              transitionEffectiveLayersForPage?: (
                environment: unknown,
                fromPage: unknown,
                toPage: unknown,
                durationMs: number,
                easing: string,
                scalarDurationMs: number,
                scalarEasing: string,
              ) => void;
            };
          };
        }
      ).__scene?.manager;
      if (!manager?.transitionEffectiveLayersForPage) {
        throw new Error("SceneManager transition API is unavailable");
      }
      manager.applyEffectiveVisibilityForPage?.(environmentSpec, fromPageSpec);
      manager.applyEffectiveStylesForPage?.(environmentSpec, fromPageSpec);
      manager.applyPageScene?.(fromPageSpec);
      manager.transitionEffectiveLayersForPage(
        environmentSpec,
        fromPageSpec,
        toPageSpec,
        duration,
        "easeInOutCubic",
        duration,
        "easeInOutCubic",
      );
    },
    {
      environmentSpec: environment,
      fromPageSpec: fromPage,
      toPageSpec: toPage,
      duration: durationMs,
    },
  );
}

export async function pageControllerState(
  page: Page,
): Promise<PageControllerDebugState> {
  return page.evaluate(() => {
    const controller = (
      window as unknown as {
        __pageController?: { getState?: () => PageControllerDebugState };
      }
    ).__pageController;
    if (!controller?.getState) {
      throw new Error("PageController debug handle is unavailable");
    }
    return controller.getState();
  });
}

export async function expectPageTransitionProgress(
  page: Page,
  currentIndex: number,
  targetIndex: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await pageControllerState(page);
        return (
          state.currentIndex === currentIndex &&
          state.targetIndex === targetIndex &&
          state.isTransitioning &&
          state.transitionProgress > 0 &&
          state.transitionProgress < 1
        );
      },
      { timeout: 2_000, intervals: [50, 100, 200] },
    )
    .toBe(true);
}

export async function resistivityLegendHandleState(
  page: Page,
): Promise<ResistivityLegendHandleState> {
  const read = async (testId: string) => {
    const value = await page.getByTestId(testId).getAttribute("aria-valuenow");
    return Number.parseFloat(value ?? "NaN");
  };
  return {
    focusMin: await read("resistivity-legend-focusMin"),
    focusMax: await read("resistivity-legend-focusMax"),
    blendMin: await read("resistivity-legend-blendMin"),
    blendMax: await read("resistivity-legend-blendMax"),
  };
}

export function expectProgressedToward(value: number, from: number, to: number): void {
  expect(Number.isFinite(value)).toBe(true);
  if (Math.abs(from - to) < 0.000001) {
    expect(value).toBeCloseTo(to);
    return;
  }
  if (to > from) {
    expect(value).toBeGreaterThan(from);
    expect(value).toBeLessThanOrEqual(to);
  } else {
    expect(value).toBeLessThan(from);
    expect(value).toBeGreaterThanOrEqual(to);
  }
}

export async function sectionIsoSceneState(
  page: Page,
  groupFilter = "mt-slices",
): Promise<SectionIsoSceneState> {
  return page.evaluate((groupFilterArg) => {
    const sceneHandle = (
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
                      userData?: Record<string, unknown>;
                      geometry?: {
                        getAttribute?: (
                          name: string,
                        ) => { count: number } | undefined;
                      };
                      material?:
                        | {
                            opacity?: unknown;
                            uniforms?: Record<string, { value: unknown }>;
                          }
                        | Array<{
                            opacity?: unknown;
                            uniforms?: Record<string, { value: unknown }>;
                          }>;
                      traverse?: (
                        fn: (child: {
                          name?: string;
                          userData?: Record<string, unknown>;
                          geometry?: {
                            getAttribute?: (
                              name: string,
                            ) => { count: number } | undefined;
                          };
                          material?:
                            | {
                                opacity?: unknown;
                                uniforms?: Record<string, { value: unknown }>;
                              }
                            | Array<{
                                opacity?: unknown;
                                uniforms?: Record<string, { value: unknown }>;
                              }>;
                        }) => void,
                      ) => void;
                    }) => void,
                  ) => void;
                }
              | undefined;
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
      }
    ).__scene;
    const manager = sceneHandle?.manager;
    const targets = (
      manager?.listSectionIsoTargets?.() ??
      manager?.listScalarSectionIsoTargets?.() ??
      []
    ).filter((target) =>
      groupFilterArg ? (target.group ?? "mt-slices") === groupFilterArg : true,
    );
    const targetKeys = new Set(targets.map((target) => target.targetKey));
    const layerIds = Array.from(
      new Set(targets.map((target) => target.layerId)),
    );
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
              traverse?: (
                fn: (child: {
                  name?: string;
                  userData?: Record<string, unknown>;
                  geometry?: {
                    getAttribute?: (
                      name: string,
                    ) => { count: number } | undefined;
                  };
                  material?:
                    | {
                        uniforms?: Record<string, { value: unknown }>;
                      }
                    | Array<{
                        uniforms?: Record<string, { value: unknown }>;
                      }>;
                }) => void,
              ) => void;
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
            firstBandUniforms = firstBandUniforms ?? {
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
