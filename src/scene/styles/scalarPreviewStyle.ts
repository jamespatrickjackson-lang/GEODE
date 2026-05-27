import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import {
  DEFAULT_SCALAR_HIGH_COLOR,
  DEFAULT_SCALAR_LOW_COLOR,
  DEFAULT_SCALAR_MID_COLOR,
  scalarColorAt,
  scalarDefaultRange,
  scalarSourceRange,
} from "./colorScales";
import { clamp01, clampRange, styleColor, styleNumber } from "./styleUtils";
import { scalarVisibilityWeight } from "../scalarFocus";
import {
  scalarFullDensityAllValidMode,
  scalarInclusionFilterActive,
} from "../transitions/transitionStyles";
import {
  scalarLateralSupport,
  updateScalarEdgeLineOverlay,
} from "./scalarEdgeLines";
import {
  applyScalarFocusIndex,
  disposeScalarSectionIsoOverlay,
  isScalarSectionMesh,
  updateScalarSectionIsoOverlay,
} from "../isoOverlays/sectionIsoOverlay";

type ScalarPreviewStyleHost = {
  layers: Map<string, THREE.Group>;
};

export function applyScalarPreviewStyle(this: unknown, id: string, style: EditableStyle): void {
  const host = this as ScalarPreviewStyleHost;
  const group = host.layers.get(id);
  if (!group) return;

  const lowColor = styleColor(
    style,
    "scalarColorLow",
    DEFAULT_SCALAR_LOW_COLOR,
  );
  const midColor = styleColor(
    style,
    "scalarColorMid",
    DEFAULT_SCALAR_MID_COLOR,
  );
  const highColor = styleColor(
    style,
    "scalarColorHigh",
    DEFAULT_SCALAR_HIGH_COLOR,
  );
  const midpoint = styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95);
  const contrast = styleNumber(style, "scalarContrast", 1, 0.35, 3);
  const edgeLineWidth = styleNumber(
    style,
    "scalarEdgeLineWidth",
    styleNumber(style, "scalarEdgeHighlight", 0, 0, 1) * 8,
    0,
    16,
  );
  const edgeAverage = styleNumber(style, "scalarEdgeAverage", 0.45, 0, 1);
  const edgeFillOffset = styleNumber(style, "scalarEdgeFillOffset", 0, -1, 1);
  const edgeLineStyle =
    style.scalarEdgeLineStyle === "dashed" ? "dashed" : "solid";
  const sectionIsoSelectedTargets =
    typeof style.sectionIsoTargetIds === "object" &&
    style.sectionIsoTargetIds !== null
      ? (style.sectionIsoTargetIds as Record<string, boolean>)
      : {};
  const sectionIsoEnabled = style.sectionIsoEnabled === true;
  const sectionIsoLinesVisible = style.sectionIsoLinesVisible !== false;
  const sectionIsoBandsVisible = style.sectionIsoBandsVisible !== false;
  const sectionIsoLevelCount = Math.round(
    styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
  );
  const sectionIsoSourceOpacity = sectionIsoEnabled
    ? styleNumber(style, "sectionIsoSourceOpacity", 0, 0, 1)
    : 1;
  const layerOpacity = styleNumber(style, "opacity", 1, 0, 1);
  const sectionIsoLineWidth = styleNumber(
    style,
    "sectionIsoLineWidth",
    2.6,
    0,
    12,
  );
  const sectionIsoLineStyle =
    style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid";
  const sectionIsoBandOpacity = styleNumber(
    style,
    "sectionIsoBandOpacity",
    0.32,
    0,
    0.85,
  );
  const sectionIsoFillOffset = styleNumber(
    style,
    "sectionIsoFillOffset",
    0,
    -1,
    1,
  );
  const noiseThreshold = styleNumber(style, "scalarNoiseThreshold", 0, 0, 1);
  const scratch = new THREE.Color();

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Points))
      return;
    if (obj.userData?.scalarSectionIsoOverlay === true) return;
    const geometry = obj.geometry;
    const values = geometry.userData.scalarValues as
      | Float32Array
      | number[]
      | undefined;
    if (!values || values.length === 0) return;

    const position = geometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) return;
    let color = geometry.getAttribute("color");
    if (
      !(color instanceof THREE.BufferAttribute) ||
      color.count !== position.count
    ) {
      color = new THREE.BufferAttribute(
        new Float32Array(position.count * 3),
        3,
      );
      geometry.setAttribute("color", color);
    }

    const sourceRange = scalarSourceRange(geometry);
    const colorDefaultRange = scalarDefaultRange(geometry);
    const colorMin = styleNumber(
      style,
      "scalarDisplayMin",
      colorDefaultRange.min,
      -100,
      100,
    );
    const rawColorMax = styleNumber(
      style,
      "scalarDisplayMax",
      colorDefaultRange.max,
      -100,
      100,
    );
    const colorMax = Math.max(rawColorMax, colorMin + 0.000001);
    const rawTrimMin = styleNumber(
      style,
      "scalarFocusMin",
      sourceRange.min,
      -100,
      100,
    );
    const rawTrimMax = styleNumber(
      style,
      "scalarFocusMax",
      sourceRange.max,
      -100,
      100,
    );
    const trimMin = clampRange(
      Math.min(rawTrimMin, rawTrimMax),
      sourceRange.min,
      sourceRange.max,
    );
    const trimMax = clampRange(
      Math.max(rawTrimMin, rawTrimMax),
      trimMin,
      sourceRange.max,
    );
    const rawBlendMin = styleNumber(
      style,
      "scalarBlendMin",
      styleNumber(style, "scalarDisplayMin", trimMin, -100, 100),
      -100,
      100,
    );
    const rawBlendMax = styleNumber(
      style,
      "scalarBlendMax",
      styleNumber(style, "scalarDisplayMax", trimMax, -100, 100),
      -100,
      100,
    );
    const blendMin = clampRange(
      rawBlendMin,
      trimMin,
      Math.max(trimMin, trimMax - 0.000001),
    );
    const blendMax = clampRange(
      Math.max(rawBlendMax, blendMin),
      blendMin,
      trimMax,
    );
    const filterActive =
      trimMin > sourceRange.min + 0.000001 ||
      trimMax < sourceRange.max - 0.000001 ||
      blendMin > trimMin + 0.000001 ||
      blendMax < trimMax - 0.000001 ||
      noiseThreshold > 0.000001;
    // Full-density MT source point visibility must be protected.
    // Focus/blend windows are visual styling by default, not source
    // inclusion filters. Thresholded review pages must opt in explicitly.
    const inclusionFilterActive = scalarInclusionFilterActive(
      id,
      style,
      filterActive,
    );
    const edgeLowerValue = styleNumber(
      style,
      "scalarEdgeLowerValue",
      (trimMin + blendMin) / 2,
      -100,
      100,
    );
    const edgeUpperValue = styleNumber(
      style,
      "scalarEdgeUpperValue",
      (blendMax + trimMax) / 2,
      -100,
      100,
    );
    const visualEmphasisActive =
      filterActive &&
      !inclusionFilterActive &&
      !scalarFullDensityAllValidMode(id, style);
    const supportValues =
      obj instanceof THREE.Points &&
      (((inclusionFilterActive || visualEmphasisActive) &&
        noiseThreshold > 0) ||
        edgeLineWidth > 0)
        ? scalarLateralSupport(geometry)
        : null;

    for (let i = 0; i < position.count; i += 1) {
      const value = values[i];
      scalarColorAt(
        Number.isFinite(value) ? value : colorMin,
        colorMin,
        colorMax,
        midpoint,
        contrast,
        lowColor,
        midColor,
        highColor,
        scratch,
      );
      if (visualEmphasisActive) {
        let visualWeight = scalarVisibilityWeight(
          values,
          i,
          trimMin,
          blendMin,
          blendMax,
          trimMax,
        );
        if (supportValues && noiseThreshold > 0) {
          visualWeight *= clamp01(
            supportValues[i] / Math.max(0.000001, noiseThreshold),
          );
        }
        const emphasisFloor = 0.18;
        scratch.multiplyScalar(
          emphasisFloor + (1 - emphasisFloor) * visualWeight,
        );
      }
      color.setXYZ(i, scratch.r, scratch.g, scratch.b);
    }
    color.needsUpdate = true;
    applyScalarFocusIndex(
      obj,
      values,
      trimMin,
      blendMin,
      blendMax,
      trimMax,
      inclusionFilterActive,
      supportValues,
      inclusionFilterActive ? noiseThreshold : 0,
    );
    if (obj instanceof THREE.Points) {
      updateScalarEdgeLineOverlay(obj, values, {
        trimMin,
        blendMin,
        blendMax,
        trimMax,
        edgeLowerValue,
        edgeUpperValue,
        edgeLineWidth,
        edgeAverage,
        edgeFillOffset,
        edgeLineStyle,
        noiseThreshold,
        colorMin,
        colorMax,
        midpoint,
        contrast,
        lowColor,
        midColor,
        highColor,
        supportValues,
      });
    } else if (isScalarSectionMesh(obj)) {
      const rawIsoMin = styleNumber(
        style,
        "sectionIsoMin",
        colorMin,
        sourceRange.min,
        sourceRange.max,
      );
      const isoMin = clampRange(rawIsoMin, sourceRange.min, sourceRange.max);
      const rawIsoMax = styleNumber(
        style,
        "sectionIsoMax",
        colorMax,
        sourceRange.min,
        sourceRange.max,
      );
      const isoMax = clampRange(
        Math.max(rawIsoMax, isoMin + 0.000001),
        isoMin + 0.000001,
        sourceRange.max,
      );
      updateScalarSectionIsoOverlay(obj, values, {
        layerId: id,
        enabled: sectionIsoEnabled,
        linesVisible: sectionIsoLinesVisible,
        bandsVisible: sectionIsoBandsVisible,
        selectedTargetIds: sectionIsoSelectedTargets,
        isoMin,
        isoMax,
        levelCount: sectionIsoLevelCount,
        lineWidth: sectionIsoLineWidth,
        lineStyle: sectionIsoLineStyle,
        bandOpacity: sectionIsoBandOpacity,
        fillOffset: sectionIsoFillOffset,
        colorMin,
        colorMax,
        midpoint,
        contrast,
        lowColor,
        midColor,
        highColor,
      });
    } else if (obj instanceof THREE.Mesh) {
      disposeScalarSectionIsoOverlay(obj);
    }

    const material = obj.material;
    const materials = Array.isArray(material) ? material : [material];
    for (const m of materials) {
      if (isScalarSectionMesh(obj) && "opacity" in m) {
        (m as THREE.Material & { opacity: number }).opacity =
          layerOpacity * sectionIsoSourceOpacity;
        m.transparent =
          m.userData?.forceTransparent === true ||
          layerOpacity * sectionIsoSourceOpacity < 1;
      }
      if ("vertexColors" in m) {
        (m as THREE.Material & { vertexColors: boolean }).vertexColors = true;
        m.needsUpdate = true;
      }
    }
  });
}
