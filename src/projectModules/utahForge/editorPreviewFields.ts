// Utah FORGE preview-panel field maps for the editor.
//
// EditorChrome passes UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS to the
// PageController so that, when a Utah FORGE layer is being previewed, the
// editor's preview override panel shows the right style fields for that
// layer (MT scalar window, seismic browser controls, scene section, etc.).
//
// The individual field arrays below are private building blocks for the
// override map at the bottom of the file. Field names match keys on
// EditableStyle.

import type { PreviewLayerOverrideFields } from "../../pages/PageController";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "./layerIds";

const MT_SCALAR_WINDOW_FIELDS = [
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarEdgeHighlight",
  "scalarEdgeLowerValue",
  "scalarEdgeUpperValue",
  "scalarEdgeLineWidth",
  "scalarEdgeAverage",
  "scalarEdgeFillOffset",
  "scalarEdgeLineStyle",
  "scalarNoiseThreshold",
  "scalarDistanceLightStrength",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
] as const;

const MT_VOLUME_PREVIEW_FIELDS = [
  ...MT_SCALAR_WINDOW_FIELDS,
  "scalarVolumeProductId",
  "scalarVolumeRenderMode",
  "scalarVolumeOpacity",
  "scalarVolumeDensity",
  "scalarVolumeSampleSteps",
  "scalarVolumeTransferMode",
  "scalarVolumeThresholdMin",
  "scalarVolumeThresholdMax",
  "scalarVolumeMaskVisible",
  "scalarLegendVisible",
  "opacity",
] as const;

const MT_FULL_DENSITY_PREVIEW_FIELDS = [
  "scalarInclusionMode",
  "scalarDistanceLightStrength",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
] as const;

const MT_THRESHOLD_PREVIEW_FIELDS = [
  "mtIsosurfaceProductId",
  "mtThresholdSurfaceVisibility",
  "mtThresholdSurfaceWireframe",
  "opacity",
] as const;

const MT_STATION_PREVIEW_FIELDS = [
  "mtStationQcSelectedStationId",
  "mtStationQcPanelOpen",
  "pointMarkerRadiusM",
  "pointMarkerLiftM",
  "pointMarkerLabelLiftM",
] as const;

const SEISMIC_BROWSER_PREVIEW_FIELDS = [
  "seismicProductId",
  "seismicProductVisibility",
  "seismicRenderMode",
  "seismicSliceAxis",
  "seismicSliceFraction",
  "seismicAmplitudeMin",
  "seismicAmplitudeMax",
  "seismicAmplitudeGamma",
  "seismicColormap",
  "seismicRemoveBackground",
  "seismicBackgroundCutoff",
  "seismicVolumeSampleSteps",
  "seismicTimeScale",
  "seismicNavigationVisible",
  "seismicNavigationRoleVisibility",
  "seismicLegendVisible",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
  "opacity",
] as const;

const SCENE_SECTION_PREVIEW_FIELDS = [
  "sceneSectionEnabled",
  "sceneSectionMode",
  "sceneSectionTargetScope",
  "sceneSectionActiveAxis",
  "sceneSectionPlanes",
  "sceneSectionTargetLayerIds",
  "sceneSectionTargetProductIds",
  "sceneSectionHelperVisible",
  "sceneSectionLegendVisible",
] as const;

const WORKING_AREA_FOCUS_PREVIEW_FIELDS = [
  "workingAreaFocusEnabled",
  "workingAreaFocusMode",
  "workingAreaFocusBoundsLayerId",
  "workingAreaFocusTargetLayerIds",
  "workingAreaFocusOutsideOpacityByLayerId",
  "workingAreaFocusHelperVisible",
] as const;

export const UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS: PreviewLayerOverrideFields = {
  [UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID]:
    MT_FULL_DENSITY_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID]: MT_SCALAR_WINDOW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID]: MT_SCALAR_WINDOW_FIELDS,
  [UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID]: MT_VOLUME_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID]: MT_THRESHOLD_PREVIEW_FIELDS,
  [UTAH_FORGE_MT_STATIONS_LAYER_ID]: MT_STATION_PREVIEW_FIELDS,
  [UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID]: SEISMIC_BROWSER_PREVIEW_FIELDS,
  [UTAH_FORGE_SCENE_SECTION_LAYER_ID]: SCENE_SECTION_PREVIEW_FIELDS,
  [UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID]: WORKING_AREA_FOCUS_PREVIEW_FIELDS,
};
