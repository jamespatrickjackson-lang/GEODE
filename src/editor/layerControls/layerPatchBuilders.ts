import type { EditableStyle } from "../../pages/types";
import { styleBoolean, styleNumber, styleString } from "../styleControls";
import { mtSurfaceBoundaryMode } from "../../projectModules/utahForge/mtSurfaceBoundaries";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "./scalarSourceRange";
import {
  SURFACE_GRADIENT_DEFAULT_HIGH,
  SURFACE_GRADIENT_DEFAULT_LOW,
  SURFACE_GRADIENT_DEFAULT_MID,
} from "./surfaceGradientDefaults";

export function surfaceGradientPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    surfaceGradientLowColor: styleString(
      style,
      "surfaceGradientLowColor",
      SURFACE_GRADIENT_DEFAULT_LOW,
    ),
    surfaceGradientMidColor: styleString(
      style,
      "surfaceGradientMidColor",
      SURFACE_GRADIENT_DEFAULT_MID,
    ),
    surfaceGradientHighColor: styleString(
      style,
      "surfaceGradientHighColor",
      SURFACE_GRADIENT_DEFAULT_HIGH,
    ),
    surfaceGradientMidpoint: styleNumber(style, "surfaceGradientMidpoint", 0.5),
    surfaceGradientContrast: styleNumber(style, "surfaceGradientContrast", 1),
  };
}

export function scalarRampPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    ...sectionIsoPatchFromStyle(style),
    scalarColorLow: styleString(style, "scalarColorLow", "#2cc9ff"),
    scalarColorMid: styleString(style, "scalarColorMid", "#f8dd6d"),
    scalarColorHigh: styleString(style, "scalarColorHigh", "#ff637a"),
    scalarBlendMin: styleNumber(
      style,
      "scalarBlendMin",
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
    scalarBlendMax: styleNumber(
      style,
      "scalarBlendMax",
      styleNumber(style, "scalarDisplayMax", 3.937122),
    ),
    scalarDisplayMin: styleNumber(
      style,
      "scalarDisplayMin",
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
    scalarDisplayMax: styleNumber(
      style,
      "scalarDisplayMax",
      styleNumber(style, "scalarDisplayMax", 3.937122),
    ),
    scalarFocusMin: styleNumber(style, "scalarFocusMin", SCALAR_SOURCE_MIN),
    scalarFocusMax: styleNumber(style, "scalarFocusMax", SCALAR_SOURCE_MAX),
    scalarInclusionMode:
      style.scalarInclusionMode === "thresholded" ? "thresholded" : "all-valid",
    scalarMidpoint: styleNumber(style, "scalarMidpoint", 0.5),
    scalarContrast: styleNumber(style, "scalarContrast", 1),
    scalarEdgeLowerValue: styleNumber(
      style,
      "scalarEdgeLowerValue",
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
    scalarEdgeUpperValue: styleNumber(
      style,
      "scalarEdgeUpperValue",
      styleNumber(style, "scalarDisplayMax", 3.937122),
    ),
    scalarEdgeLineWidth: styleNumber(style, "scalarEdgeLineWidth", 0),
    scalarEdgeAverage: styleNumber(style, "scalarEdgeAverage", 0.45),
    scalarEdgeFillOffset: styleNumber(style, "scalarEdgeFillOffset", 0),
    scalarEdgeLineStyle:
      style.scalarEdgeLineStyle === "dashed" ? "dashed" : "solid",
    scalarNoiseThreshold: styleNumber(style, "scalarNoiseThreshold", 0),
    scalarSurfaceMaskEnabled: style.scalarSurfaceMaskEnabled !== false,
    scalarSurfaceMaskDepthM: styleNumber(style, "scalarSurfaceMaskDepthM", 25),
    scalarSurfaceMaskFeatherM: styleNumber(
      style,
      "scalarSurfaceMaskFeatherM",
      175,
    ),
  };
}

export function sectionIsoPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    sectionIsoEnabled: styleBoolean(style, "sectionIsoEnabled", false),
    sectionIsoLinesVisible: styleBoolean(style, "sectionIsoLinesVisible", true),
    sectionIsoBandsVisible: styleBoolean(style, "sectionIsoBandsVisible", true),
    sectionIsoTargetIds:
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? { ...(style.sectionIsoTargetIds as Record<string, boolean>) }
        : {},
    sectionIsoMin: styleNumber(style, "sectionIsoMin", SCALAR_SOURCE_MIN),
    sectionIsoMax: styleNumber(style, "sectionIsoMax", SCALAR_SOURCE_MAX),
    sectionIsoLevelCount: Math.max(
      2,
      Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
    ),
    sectionIsoLineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6),
    sectionIsoLineStyle:
      style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
    sectionIsoBandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32),
    sectionIsoFillOffset: styleNumber(style, "sectionIsoFillOffset", 0),
    sectionIsoSourceOpacity: styleNumber(style, "sectionIsoSourceOpacity", 0),
  };
}

export function mtTopSurfacePatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    meshSurfaceLiftM: styleNumber(style, "meshSurfaceLiftM", 0),
    meshWireframe: styleBoolean(style, "meshWireframe", false),
    meshRoughness: styleNumber(style, "meshRoughness", 0.72),
    meshMetalness: styleNumber(style, "meshMetalness", 0.02),
  };
}

export function mtVolumePatchFromStyle(style: EditableStyle): Partial<EditableStyle> {
  return {
    ...scalarRampPatchFromStyle(style),
    scalarVolumeProductId:
      typeof style.scalarVolumeProductId === "string"
        ? style.scalarVolumeProductId
        : "mt-resistivity-full-extent-volume",
    scalarVolumeRenderMode: "raymarch",
    scalarVolumeOpacity: styleNumber(
      style,
      "scalarVolumeOpacity",
      styleNumber(style, "opacity", 0.48),
    ),
    scalarVolumeDensity: styleNumber(style, "scalarVolumeDensity", 0.72),
    scalarVolumeSampleSteps: styleNumber(style, "scalarVolumeSampleSteps", 112),
    scalarVolumeTransferMode:
      style.scalarVolumeTransferMode === "soft" ||
      style.scalarVolumeTransferMode === "dense"
        ? style.scalarVolumeTransferMode
        : "balanced",
    scalarVolumeThresholdMin: styleNumber(
      style,
      "scalarVolumeThresholdMin",
      SCALAR_SOURCE_MIN,
    ),
    scalarVolumeThresholdMax: styleNumber(
      style,
      "scalarVolumeThresholdMax",
      SCALAR_SOURCE_MAX,
    ),
    scalarVolumeMaskVisible: styleBoolean(
      style,
      "scalarVolumeMaskVisible",
      true,
    ),
    scalarLegendVisible: styleBoolean(style, "scalarLegendVisible", true),
    opacity: styleNumber(style, "opacity", 0.48),
  };
}

export function mtThresholdSurfacePatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    mtIsosurfaceProductId:
      typeof style.mtIsosurfaceProductId === "string"
        ? style.mtIsosurfaceProductId
        : "mt-isosurface-full-extent",
    mtSurfaceBoundaryMode: mtSurfaceBoundaryMode(style),
    mtSurfaceBoundaryOrder: Array.isArray(style.mtSurfaceBoundaryOrder)
      ? [...style.mtSurfaceBoundaryOrder]
      : undefined,
    mtSurfaceBoundariesById:
      typeof style.mtSurfaceBoundariesById === "object" &&
      style.mtSurfaceBoundariesById !== null
        ? { ...style.mtSurfaceBoundariesById }
        : undefined,
    mtSurfaceBoundaryLegendVisible: styleBoolean(
      style,
      "mtSurfaceBoundaryLegendVisible",
      true,
    ),
    mtThresholdSurfaceVisibility:
      typeof style.mtThresholdSurfaceVisibility === "object" &&
      style.mtThresholdSurfaceVisibility !== null
        ? { ...(style.mtThresholdSurfaceVisibility as Record<string, boolean>) }
        : {
            "conductive-le-10-ohm-m": false,
            "conductive-le-30-ohm-m": true,
            "resistive-ge-1000-ohm-m": true,
          },
    mtThresholdSurfaceWireframe: styleBoolean(
      style,
      "mtThresholdSurfaceWireframe",
      false,
    ),
    mtThresholdSurfaceRoughness: styleNumber(
      style,
      "mtThresholdSurfaceRoughness",
      0.64,
    ),
    mtThresholdSurfaceMetalness: styleNumber(
      style,
      "mtThresholdSurfaceMetalness",
      0,
    ),
    mtThresholdSurfaceSide:
      style.mtThresholdSurfaceSide === "front" ? "front" : "double",
    mtThresholdSurfaceSmoothNormals: styleBoolean(
      style,
      "mtThresholdSurfaceSmoothNormals",
      true,
    ),
    mtThresholdSurfaceEmissiveBoost: styleNumber(
      style,
      "mtThresholdSurfaceEmissiveBoost",
      0.08,
    ),
    mtThresholdSurfaceWireframeColor: styleString(
      style,
      "mtThresholdSurfaceWireframeColor",
      "#f8f4e8",
    ),
    mtThresholdSurfaceWireframeOpacity: styleNumber(
      style,
      "mtThresholdSurfaceWireframeOpacity",
      0.42,
    ),
    opacity: styleNumber(style, "opacity", 0.86),
  };
}
