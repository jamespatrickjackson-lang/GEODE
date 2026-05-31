import type { EditableStyle, ProjectLayerSpec } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import type {
  LayerTransitionKind,
  ProductTransitionDecision,
  ProductTransitionFamily,
  ProductTransitionPolicy,
} from "./transitionStyles";

type ProductTransitionStateSource =
  ProductTransitionDecision["stateSource"];

function styleString(
  style: EditableStyle,
  field: keyof EditableStyle,
): string | null {
  const value = style[field];
  return typeof value === "string" ? value : null;
}

function sectionIsoEnabled(style: EditableStyle): boolean {
  return (
    style.sectionIsoEnabled === true &&
    (style.sectionIsoBandsVisible !== false ||
      style.sectionIsoLinesVisible !== false)
  );
}

function seismicFamily(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): ProductTransitionFamily {
  const mode =
    styleString(toStyle, "seismicRenderMode") ??
    styleString(fromStyle, "seismicRenderMode");
  return mode === "raymarch" ? "seismic-volume" : "seismic-sections";
}

function baseFamilyForLayer(
  layerId: string,
  layerSpec: ProjectLayerSpec | undefined,
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): ProductTransitionFamily {
  if (layerId === UTAH_FORGE_MT_STATIONS_LAYER_ID) return "point-markers";
  if (
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID
  ) {
    return "point-cloud";
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return "scalar-volume";
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) {
    return "scalar-slices";
  }
  if (
    layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID ||
    layerId === UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID ||
    layerId === UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID
  ) {
    return "mt-isosurfaces";
  }
  if (layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) {
    return seismicFamily(fromStyle, toStyle);
  }
  if (layerId === UTAH_FORGE_SCENE_SECTION_LAYER_ID) {
    return "scene-section-helpers";
  }
  if (layerSpec?.type === "pointcloud") return "point-cloud";
  if (layerSpec?.type === "point") return "point-markers";
  if (layerSpec?.type === "volume") return "scalar-volume";
  if (layerSpec?.type === "seismic") return seismicFamily(fromStyle, toStyle);
  return "simple-geometry";
}

function policyForLayer(
  transitionKind: LayerTransitionKind,
  sourceVisible: boolean,
  targetVisible: boolean,
  sourceOpacity: number,
  targetOpacity: number,
  includeStateSource: boolean,
): ProductTransitionPolicy {
  if (!sourceVisible && !targetVisible && includeStateSource) {
    return "state-source-only";
  }
  if (transitionKind === "discrete-crossfade") return "crossfade-discrete";
  if (transitionKind === "full-density-scalar") {
    return "interpolate-full-density-scalar";
  }
  if (transitionKind === "continuous") return "interpolate-style";
  if (
    sourceVisible !== targetVisible ||
    Math.abs(targetOpacity - sourceOpacity) > 0.001
  ) {
    return "fade-opacity";
  }
  return "preserve";
}

function decisionReason(
  transitionKind: LayerTransitionKind,
  sourceVisible: boolean,
  targetVisible: boolean,
  sourceOpacity: number,
  targetOpacity: number,
  includeStateSource: boolean,
  loadedAtStart: boolean,
): string {
  if (!sourceVisible && !targetVisible && includeStateSource) {
    return "hidden product state is authored by the source or target page";
  }
  if (!loadedAtStart) {
    return "product state is authored but the layer was not loaded at transition start";
  }
  if (transitionKind === "discrete-crossfade") {
    return "discrete data/style changed, using snapshot crossfade";
  }
  if (transitionKind === "full-density-scalar") {
    return "full-density point cloud scalar style changed";
  }
  if (transitionKind === "continuous") {
    return "continuous scalar style changed";
  }
  if (sourceVisible !== targetVisible) {
    return "layer visibility changed";
  }
  if (Math.abs(targetOpacity - sourceOpacity) > 0.001) {
    return "layer opacity changed";
  }
  return "layer remains in the same transition state";
}

export function productTransitionDecisionsForLayer(input: {
  layerId: string;
  layerSpec: ProjectLayerSpec | undefined;
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  transitionKind: LayerTransitionKind;
  sourceVisible: boolean;
  targetVisible: boolean;
  sourceOpacity: number;
  targetOpacity: number;
  loadedAtStart: boolean;
  stateSource: ProductTransitionStateSource;
  includeStateSource?: boolean;
}): ProductTransitionDecision[] {
  const {
    layerId,
    layerSpec,
    fromStyle,
    toStyle,
    transitionKind,
    sourceVisible,
    targetVisible,
    sourceOpacity,
    targetOpacity,
    loadedAtStart,
    stateSource,
    includeStateSource = false,
  } = input;
  if (
    !sourceVisible &&
    !targetVisible &&
    transitionKind === "none" &&
    !includeStateSource
  ) {
    return [];
  }

  const layerType = layerSpec?.type ?? null;
  const baseFamily = baseFamilyForLayer(layerId, layerSpec, fromStyle, toStyle);
  const decisions: ProductTransitionDecision[] = [
    {
      layerId,
      layerType,
      family: baseFamily,
      policy: policyForLayer(
        transitionKind,
        sourceVisible,
        targetVisible,
        sourceOpacity,
        targetOpacity,
        includeStateSource,
      ),
      transitionKind,
      stateSource,
      loadedAtStart,
      sourceVisible,
      targetVisible,
      sourceOpacity,
      targetOpacity,
      reason: decisionReason(
        transitionKind,
        sourceVisible,
        targetVisible,
        sourceOpacity,
        targetOpacity,
        includeStateSource,
        loadedAtStart,
      ),
    },
  ];

  if (
    (layerId === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID ||
      layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) &&
    (sectionIsoEnabled(fromStyle) || sectionIsoEnabled(toStyle))
  ) {
    decisions.push({
      layerId,
      layerType,
      family: "section-iso-overlays",
      policy: "follow-section-iso-style",
      transitionKind,
      stateSource,
      loadedAtStart,
      sourceVisible,
      targetVisible,
      sourceOpacity,
      targetOpacity,
      reason: "section ISO bands/isolines are authored on this layer",
    });
  }

  return decisions;
}

export function sceneSectionHelperDecision(input: {
  layerId: string;
  sourceVisible: boolean;
  targetVisible: boolean;
  sourceOpacity: number;
  targetOpacity: number;
}): ProductTransitionDecision {
  return {
    layerId: input.layerId,
    layerType: "mesh",
    family: "scene-section-helpers",
    policy: "translate-section-helpers",
    transitionKind: "continuous",
    stateSource: "scene-section-helper",
    loadedAtStart: true,
    sourceVisible: input.sourceVisible,
    targetVisible: input.targetVisible,
    sourceOpacity: input.sourceOpacity,
    targetOpacity: input.targetOpacity,
    reason: "scene section plane/window/frame style changed",
  };
}
