import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import { UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import { styleNumber } from "./styleUtils";
import { disposeScalarSectionIsoOverlay } from "../isoOverlays/sectionIsoOverlay";

type SeismicLodTierName = "coarse" | "standard" | "source";

type SeismicBrowserRuntimeIndex = {
  root: THREE.Object3D;
  productSummaries: Array<{
    id: string;
    surveyKind?: string;
    productKind?: string;
    domainKind?: string;
    amplitudeStats?: Record<string, unknown>;
    raymarchCapable: boolean;
  }>;
  sectionsByProduct: Map<string, THREE.Object3D[]>;
  volumesByProduct: Map<string, THREE.Object3D[]>;
  navigationObjects: THREE.Object3D[];
  navigationObjectsByRole?: Map<string, THREE.Object3D[]>;
};

type SeismicBrowserStyleHost = {
  layers: Map<string, THREE.Group>;
  seismicBrowserRuntimeIndex(group: THREE.Group): SeismicBrowserRuntimeIndex | null;
  setProductOpacityBaseForMaterial(material: THREE.Material, opacity: number): void;
  updateSeismicVolumeCutIsoOverlays(style: EditableStyle): void;
};

function seismicLodTierFromRecord(
  value: unknown,
  productId: string,
): SeismicLodTierName | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const tier = (value as Record<string, unknown>)[productId];
  return tier === "coarse" || tier === "standard" || tier === "source"
    ? tier
    : null;
}

function seismicResolveTargetLodTier(
  root: THREE.Object3D,
  productId: string,
  previousProductId: string,
): { tier: SeismicLodTierName; reason: string } {
  const pendingTier = seismicLodTierFromRecord(
    root.userData.seismicPendingLodByProduct,
    productId,
  );
  const activeTier = seismicLodTierFromRecord(
    root.userData.seismicActiveLodByProduct,
    productId,
  );
  const nowMs =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const seismicTransitionActive =
    root.userData.seismicTransitionActive === true;
  const seismicCameraMoving =
    root.userData.seismicCameraMoving === true ||
    (typeof root.userData.seismicCameraMovingUntilMs === "number" &&
      root.userData.seismicCameraMovingUntilMs > nowMs);
  let reason = "settled";
  if (seismicTransitionActive) {
    reason = "page-transition";
  } else if (seismicCameraMoving) {
    reason = "camera-moving";
  } else if (previousProductId && previousProductId !== productId) {
    reason = "product-switch";
  } else if (pendingTier === "coarse" || (pendingTier && !activeTier)) {
    reason = "product-pending";
  }
  const tier: SeismicLodTierName = reason === "settled" ? "standard" : "coarse";
  root.userData.seismicTargetLodTier = tier;
  root.userData.seismicTargetLodReason = reason;
  return { tier, reason };
}

export function applySeismicBrowserStyle(this: unknown, id: string, style: EditableStyle): void {
  if (id !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return;
  const host = this as SeismicBrowserStyleHost;
  const group = host.layers.get(id);
  if (!group) return;
  const index = host.seismicBrowserRuntimeIndex(group);
  if (!index) return;

  const productIds = new Set(
    index.productSummaries.map((product) => product.id),
  );
  const firstProductId = index.productSummaries[0]?.id ?? "";
  const defaultProductId =
    typeof index.root.userData.seismicDefaultProductId === "string"
      ? index.root.userData.seismicDefaultProductId
      : typeof group.userData.seismicDefaultProductId === "string"
        ? group.userData.seismicDefaultProductId
        : firstProductId;
  const requestedProductId =
    typeof style.seismicProductId === "string"
      ? style.seismicProductId
      : defaultProductId;
  const productId = productIds.has(requestedProductId)
    ? requestedProductId
    : defaultProductId;
  if (!productId) return;

  const activeSummary = index.productSummaries.find(
    (product) => product.id === productId,
  );
  const productVisibility =
    typeof style.seismicProductVisibility === "object" &&
    style.seismicProductVisibility !== null
      ? (style.seismicProductVisibility as Record<string, boolean>)
      : {};
  const hasExplicitProductVisibility =
    Object.keys(productVisibility).length > 0;
  const productEnabled = (candidateId: string): boolean =>
    hasExplicitProductVisibility
      ? productVisibility[candidateId] === true
      : candidateId === productId;
  const enabledProductIds = new Set(
    index.productSummaries
      .map((product) => product.id)
      .filter((candidateId) => productEnabled(candidateId)),
  );
  const canRaymarch =
    activeSummary?.raymarchCapable === true && productEnabled(productId);
  const requestedMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedMode === "raymarch" && canRaymarch ? "raymarch" : "slice";
  const requestedAxis =
    style.seismicSliceAxis === "crossline" ||
    style.seismicSliceAxis === "sample" ||
    style.seismicSliceAxis === "line"
      ? style.seismicSliceAxis
      : "inline";
  const sliceFraction = styleNumber(style, "seismicSliceFraction", 0.5, 0, 1);
  const opacity = styleNumber(style, "opacity", 0.62, 0, 1);
  const amplitudeMin = styleNumber(style, "seismicAmplitudeMin", 0.08, 0, 1);
  const amplitudeMax = Math.max(
    amplitudeMin + 0.001,
    styleNumber(style, "seismicAmplitudeMax", 0.92, 0, 1),
  );
  const amplitudeGamma = styleNumber(
    style,
    "seismicAmplitudeGamma",
    1,
    0.35,
    2.5,
  );
  const colormap =
    style.seismicColormap === "grayscale" ||
    style.seismicColormap === "velocity"
      ? style.seismicColormap
      : "blue-white-red";
  const removeBackground = style.seismicRemoveBackground === true;
  const backgroundCutoff = styleNumber(
    style,
    "seismicBackgroundCutoff",
    0.16,
    0,
    0.45,
  );
  const volumeSampleSteps = Math.round(
    styleNumber(style, "seismicVolumeSampleSteps", 96, 24, 160),
  );
  const sectionIsoEnabled = style.sectionIsoEnabled === true;
  const sectionIsoSourceOpacity = sectionIsoEnabled
    ? styleNumber(style, "sectionIsoSourceOpacity", 0, 0, 1)
    : 1;
  const sectionSourceOpacity = opacity;
  const volumeSourceOpacity = opacity * sectionIsoSourceOpacity;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side"
      ? "side-by-side"
      : "overlay";
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : "";
  const comparisonSpacingM = styleNumber(
    style,
    "seismicComparisonSpacingM",
    650,
    0,
    3000,
  );
  const timeScale = styleNumber(style, "seismicTimeScale", 2, 0.25, 8);
  const navigationVisible = style.seismicNavigationVisible !== false;
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
  ): boolean => navigationVisible && navigationRoleVisibility[role] !== false;
  const anyNavigationRoleVisible =
    navigationRoleVisible("sources") ||
    navigationRoleVisible("receivers") ||
    navigationRoleVisible("lines");
  const sliceThroughVolume = style.seismicSliceThroughVolume === true;
  const previousProductId =
    typeof index.root.userData.seismicSelectedProductId === "string"
      ? index.root.userData.seismicSelectedProductId
      : "";
  const requestedLoadProductIds = new Set(enabledProductIds);
  requestedLoadProductIds.add(productId);
  if (comparisonProductId && productIds.has(comparisonProductId)) {
    requestedLoadProductIds.add(comparisonProductId);
  }
  const retainedProductIds = new Set(requestedLoadProductIds);
  if (previousProductId && previousProductId !== productId) {
    retainedProductIds.add(previousProductId);
    index.root.userData.seismicPreviousProductId = previousProductId;
  }
  const retainProducts = index.root.userData.seismicRetainProducts;
  if (typeof retainProducts === "function") {
    retainProducts(Array.from(retainedProductIds));
  }
  const ensureProductsLoaded = index.root.userData.seismicEnsureProductsLoaded;
  if (typeof ensureProductsLoaded === "function") {
    const targetTier = seismicResolveTargetLodTier(
      index.root,
      productId,
      previousProductId,
    ).tier;
    ensureProductsLoaded(Array.from(requestedLoadProductIds), targetTier).catch(
      (error: unknown) => {
        console.warn("[seismic] product load failed", error);
      },
    );
  }
  const selectedSections = new Set<THREE.Object3D>();

  if (renderMode === "slice" || sliceThroughVolume) {
    for (const summary of index.productSummaries) {
      if (renderMode === "raymarch" && summary.id !== productId) continue;
      if (!enabledProductIds.has(summary.id)) continue;
      const sections = index.sectionsByProduct.get(summary.id) ?? [];
      if (sections.length === 0) continue;
      const lineSections = sections.filter(
        (section) => section.userData?.seismicSectionAxis === "line",
      );
      if (summary.surveyKind !== "3d") {
        const curtainSections =
          lineSections.length > 0 ? lineSections : sections;
        for (const section of curtainSections) selectedSections.add(section);
        continue;
      }
      const sliceAxis = requestedAxis === "line" ? "inline" : requestedAxis;
      let axisSections = sections.filter(
        (section) => section.userData?.seismicSectionAxis === sliceAxis,
      );
      if (axisSections.length === 0) {
        axisSections = sections.filter(
          (section) => section.userData?.seismicSectionAxis === "inline",
        );
      }
      let closest: THREE.Object3D | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const section of axisSections) {
        const fraction =
          typeof section.userData.seismicSectionFraction === "number"
            ? section.userData.seismicSectionFraction
            : 0.5;
        const distance = Math.abs(fraction - sliceFraction);
        if (distance < closestDistance) {
          closest = section;
          closestDistance = distance;
        }
      }
      if (closest) selectedSections.add(closest);
    }
  }

  group.userData.seismicSelectedProductId = productId;
  group.userData.seismicSelectedProductKind =
    activeSummary?.productKind ?? "";
  group.userData.seismicSelectedProductStats =
    activeSummary?.amplitudeStats ?? null;
  group.userData.seismicAppliedRenderMode = renderMode;
  group.userData.seismicVisibleProductIds = Array.from(enabledProductIds);
  group.userData.seismicTargetLodTier = index.root.userData.seismicTargetLodTier;
  group.userData.seismicTargetLodReason =
    index.root.userData.seismicTargetLodReason;
  group.userData.seismicCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  group.userData.seismicComparisonMode = comparisonMode;
  group.userData.seismicComparisonSpacingM = comparisonSpacingM;
  group.userData.seismicSliceThroughVolume = sliceThroughVolume;
  group.userData.seismicRemoveBackground = removeBackground;
  group.userData.seismicAmplitudeGamma = amplitudeGamma;
  group.userData.seismicBackgroundCutoff = backgroundCutoff;
  group.userData.seismicVolumeSampleSteps = volumeSampleSteps;
  group.userData.seismicNavigationRoleVisibility = {
    sources: navigationRoleVisible("sources"),
    receivers: navigationRoleVisible("receivers"),
    lines: navigationRoleVisible("lines"),
  };
  index.root.userData.seismicSelectedProductId = productId;
  index.root.userData.seismicSelectedProductKind =
    group.userData.seismicSelectedProductKind;
  index.root.userData.seismicSelectedProductStats =
    group.userData.seismicSelectedProductStats;
  index.root.userData.seismicAppliedRenderMode = renderMode;
  index.root.userData.seismicVisibleProductIds =
    Array.from(enabledProductIds);
  index.root.userData.seismicCapabilityPresetId =
    group.userData.seismicCapabilityPresetId;
  index.root.userData.seismicComparisonMode = comparisonMode;
  index.root.userData.seismicComparisonSpacingM = comparisonSpacingM;
  index.root.userData.seismicSliceThroughVolume = sliceThroughVolume;
  index.root.userData.seismicRemoveBackground = removeBackground;
  index.root.userData.seismicAmplitudeGamma = amplitudeGamma;
  index.root.userData.seismicBackgroundCutoff = backgroundCutoff;
  index.root.userData.seismicVolumeSampleSteps = volumeSampleSteps;
  index.root.userData.seismicNavigationRoleVisibility =
    group.userData.seismicNavigationRoleVisibility;

  for (const obj of index.navigationObjects) {
    const role =
      typeof obj.userData?.seismicNavigationRole === "string"
        ? obj.userData.seismicNavigationRole
        : "all";
    obj.visible =
      role === "sources"
        ? navigationRoleVisible("sources")
        : role === "receivers"
          ? navigationRoleVisible("receivers")
          : role === "lines"
            ? navigationRoleVisible("lines")
            : role === "container"
              ? navigationVisible && anyNavigationRoleVisible
              : navigationVisible;
  }

  for (const [candidateProductId, volumes] of index.volumesByProduct) {
    for (const obj of volumes) {
      const visible =
        enabledProductIds.has(candidateProductId) &&
        renderMode === "raymarch" &&
        candidateProductId === productId;
      obj.visible = visible;
      if (
        !(obj instanceof THREE.Mesh) ||
        !(obj.material instanceof THREE.ShaderMaterial)
      ) {
        continue;
      }
      const domain = obj.userData.seismicVolumeSampleDomain as
        | { unit?: string; min?: number; max?: number }
        | undefined;
      const baseBounds = obj.userData.seismicVolumeBaseBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined;
      const baseSize = obj.userData.seismicVolumeBaseSize as
        | [number, number, number]
        | undefined;
      const datum =
        typeof obj.userData.seismicVolumeDatumM === "number"
          ? obj.userData.seismicVolumeDatumM
          : undefined;
      let boundsMin = baseBounds?.min;
      let boundsMax = baseBounds?.max;
      if (
        domain?.unit === "ms" &&
        typeof domain.min === "number" &&
        typeof domain.max === "number" &&
        typeof datum === "number" &&
        boundsMin &&
        boundsMax
      ) {
        boundsMin = [
          boundsMin[0],
          boundsMin[1],
          datum - domain.max * timeScale,
        ];
        boundsMax = [
          boundsMax[0],
          boundsMax[1],
          datum - domain.min * timeScale,
        ];
        if (baseSize && baseSize[2] > 0) {
          const newSizeZ = Math.max(1, boundsMax[2] - boundsMin[2]);
          obj.scale.z = newSizeZ / baseSize[2];
          obj.position.z = (boundsMin[2] + boundsMax[2]) / 2;
          obj.updateMatrixWorld();
        }
      } else if (baseSize && baseBounds?.min && baseBounds.max) {
        obj.scale.z = 1;
        obj.position.z = (baseBounds.min[2] + baseBounds.max[2]) / 2;
        obj.updateMatrixWorld();
      }
      const uniforms = obj.material.uniforms;
      if (uniforms.uOpacity) uniforms.uOpacity.value = volumeSourceOpacity;
      host.setProductOpacityBaseForMaterial(obj.material, volumeSourceOpacity);
      if (uniforms.uAmplitudeMin) uniforms.uAmplitudeMin.value = amplitudeMin;
      if (uniforms.uAmplitudeMax) uniforms.uAmplitudeMax.value = amplitudeMax;
      if (uniforms.uAmplitudeGamma) {
        uniforms.uAmplitudeGamma.value = amplitudeGamma;
      }
      if (uniforms.uColormap) {
        uniforms.uColormap.value =
          colormap === "grayscale" ? 1 : colormap === "velocity" ? 2 : 0;
      }
      if (uniforms.uRemoveBackground) {
        uniforms.uRemoveBackground.value = removeBackground ? 1 : 0;
      }
      if (uniforms.uBackgroundCutoff) {
        uniforms.uBackgroundCutoff.value = backgroundCutoff;
      }
      if (uniforms.uSampleSteps) {
        uniforms.uSampleSteps.value = volumeSampleSteps;
      }
      if (uniforms.uBoundsMin && boundsMin) {
        uniforms.uBoundsMin.value.set(
          boundsMin[0],
          boundsMin[1],
          boundsMin[2],
        );
      }
      if (uniforms.uBoundsMax && boundsMax) {
        uniforms.uBoundsMax.value.set(
          boundsMax[0],
          boundsMax[1],
          boundsMax[2],
        );
      }
      obj.userData.seismicVolumeCurrentBounds =
        boundsMin && boundsMax
          ? {
              min: [boundsMin[0], boundsMin[1], boundsMin[2]],
              max: [boundsMax[0], boundsMax[1], boundsMax[2]],
            }
          : (baseBounds ?? null);
    }
  }

  for (const sections of index.sectionsByProduct.values()) {
    for (const obj of sections) {
      obj.visible =
        (renderMode === "slice" ||
          (renderMode === "raymarch" &&
            sliceThroughVolume &&
            obj.userData?.seismicProductId === productId)) &&
        selectedSections.has(obj);
      if (!(obj instanceof THREE.Mesh)) continue;
      const basePosition =
        Array.isArray(obj.userData.seismicBasePosition) &&
        obj.userData.seismicBasePosition.length === 3
          ? (obj.userData.seismicBasePosition as [number, number, number])
          : ([obj.position.x, obj.position.y, obj.position.z] as [
              number,
              number,
              number,
            ]);
      obj.userData.seismicBasePosition = basePosition;
      const productOffset =
        comparisonMode === "side-by-side" &&
        comparisonProductId &&
        obj.userData?.seismicProductId === comparisonProductId
          ? comparisonSpacingM
          : 0;
      obj.position.set(
        basePosition[0] + productOffset,
        basePosition[1],
        basePosition[2],
      );
      obj.updateMatrixWorld();

      const geometry = obj.geometry;
      const sampleValues = geometry.userData.seismicSampleValues as
        | Float32Array
        | number[]
        | undefined;
      const sampleUnit =
        typeof obj.userData.seismicSampleDomainUnit === "string"
          ? obj.userData.seismicSampleDomainUnit
          : "";
      const datum =
        typeof obj.userData.seismicDatumM === "number"
          ? obj.userData.seismicDatumM
          : undefined;
      const position = geometry.getAttribute("position");
      if (
        sampleUnit === "ms" &&
        typeof datum === "number" &&
        sampleValues &&
        position instanceof THREE.BufferAttribute
      ) {
        for (
          let i = 0;
          i < Math.min(position.count, sampleValues.length);
          i += 1
        ) {
          position.setZ(i, datum - sampleValues[i] * timeScale);
        }
        position.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }

      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      for (const material of materials) {
        if (material instanceof THREE.ShaderMaterial) {
          if (material.uniforms.uOpacity) {
            material.uniforms.uOpacity.value = sectionSourceOpacity;
          }
          if (material.uniforms.uAmplitudeMin) {
            material.uniforms.uAmplitudeMin.value = amplitudeMin;
          }
          if (material.uniforms.uAmplitudeMax) {
            material.uniforms.uAmplitudeMax.value = amplitudeMax;
          }
          if (material.uniforms.uAmplitudeGamma) {
            material.uniforms.uAmplitudeGamma.value = amplitudeGamma;
          }
          if (material.uniforms.uColormap) {
            material.uniforms.uColormap.value =
              colormap === "grayscale" ? 1 : colormap === "velocity" ? 2 : 0;
          }
          if (material.uniforms.uRemoveBackground) {
            material.uniforms.uRemoveBackground.value = removeBackground ? 1 : 0;
          }
          if (material.uniforms.uBackgroundCutoff) {
            material.uniforms.uBackgroundCutoff.value = backgroundCutoff;
          }
          host.setProductOpacityBaseForMaterial(material, sectionSourceOpacity);
        } else if ("opacity" in material) {
          material.opacity = sectionSourceOpacity;
          material.transparent = true;
          host.setProductOpacityBaseForMaterial(material, sectionSourceOpacity);
        }
        material.needsUpdate = true;
      }

      obj.userData.seismicSectionIsoDisabledReason = "texture-plane-v1";
      disposeScalarSectionIsoOverlay(obj);
    }
  }
  host.updateSeismicVolumeCutIsoOverlays(style);
}
