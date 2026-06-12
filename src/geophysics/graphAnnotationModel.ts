import type {
  EditableStyle,
  GraphAnnotationComparisonRole,
  GraphAnnotationFamily,
  GraphAnnotationProfile,
} from "../pages/types";

export type GraphAnnotationObjectKind =
  | "2d-section-line"
  | "3d-section-plane"
  | "3d-volume"
  | "scene-section-cut"
  | "survey-geometry"
  | "comparison"
  | "item-graph"
  | "figure-annotation";

export interface GraphAnnotationTarget {
  family: GraphAnnotationFamily;
  layerId: string;
  productId?: string;
  objectKind: GraphAnnotationObjectKind | string;
  objectId: string;
  comparisonRole?: GraphAnnotationComparisonRole;
  axis?: "x" | "y" | "z" | "inline" | "crossline" | "sample" | "line";
  frameId?: string;
  targetLayerId?: string;
  targetKey: string;
}

export type GraphAnnotationTargetInput = Omit<
  GraphAnnotationTarget,
  "targetKey"
>;

function cleanKeyPart(value: string | undefined, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return encodeURIComponent(normalized || fallback);
}

export function graphAnnotationTargetKey(
  target: GraphAnnotationTargetInput,
): string {
  return [
    "graph",
    cleanKeyPart(target.family, "item"),
    "layer",
    cleanKeyPart(target.layerId, "none"),
    "product",
    cleanKeyPart(target.productId, "none"),
    "object",
    cleanKeyPart(target.objectKind, "item-graph"),
    cleanKeyPart(target.objectId, "default"),
    "role",
    cleanKeyPart(target.comparisonRole, "primary"),
  ].join(":");
}

function withTargetKey(target: GraphAnnotationTargetInput): GraphAnnotationTarget {
  return {
    ...target,
    targetKey: graphAnnotationTargetKey(target),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function horizonPointsValue(value: unknown): Array<[number, number]> | undefined {
  if (!Array.isArray(value)) return undefined;
  const points = value.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      Number.isFinite(point[0]) &&
      typeof point[1] === "number" &&
      Number.isFinite(point[1]),
  );
  return points.length > 0 ? points : undefined;
}

function legacySeismicProfile(style: EditableStyle): GraphAnnotationProfile {
  return {
    frameVisible: boolValue(style.seismicFigureAnnotationsVisible),
    title: textValue(style.seismicFigureTitle),
    caption: textValue(style.seismicFigureCaption),
    scaleLabel: textValue(style.seismicFigureScaleLabel),
    textColor: textValue(style.seismicFigureTextColor),
    axisColor: textValue(style.seismicFigureAxisColor),
    captionBoxColor: textValue(style.seismicFigureCaptionBoxColor),
    captionBoxOpacity: finiteNumber(style.seismicFigureCaptionBoxOpacity),
    horizonColor: textValue(style.seismicFigureHorizonColor),
    wellColor: textValue(style.seismicFigureWellColor),
    wellVisible: boolValue(style.seismicFigureWellVisible),
    wellLabel: textValue(style.seismicFigureWellLabel),
    wellPosition: finiteNumber(style.seismicFigureWellPosition),
    horizonVisible: boolValue(style.seismicFigureHorizonVisible),
    horizonPoints: horizonPointsValue(style.seismicFigureHorizonPoints),
    outsideOffsetM: finiteNumber(style.seismicFigureOutsideOffsetM),
    labelSizeM: finiteNumber(style.seismicFigureLabelSizeM),
  };
}

export function resolveGraphAnnotationProfile(
  style: EditableStyle,
  targetKey: string | null | undefined,
): GraphAnnotationProfile {
  return {
    ...legacySeismicProfile(style),
    ...(style.graphAnnotationDefaults ?? {}),
    ...((targetKey ? style.graphAnnotationProfiles?.[targetKey] : undefined) ?? {}),
  };
}

export function seismicSectionGraphAnnotationTarget(input: {
  layerId: string;
  productId: string;
  objectKind: "2d-section-line" | "3d-section-plane";
  objectId: string;
  comparisonRole?: GraphAnnotationComparisonRole;
  axis?: GraphAnnotationTarget["axis"];
}): GraphAnnotationTarget {
  return withTargetKey({
    family: "seismic",
    layerId: input.layerId,
    productId: input.productId,
    objectKind: input.objectKind,
    objectId: input.objectId,
    comparisonRole: input.comparisonRole ?? "primary",
    axis: input.axis,
  });
}

export function seismicVolumeGraphAnnotationTarget(input: {
  layerId: string;
  productId: string;
  volumeId?: string;
  comparisonRole?: GraphAnnotationComparisonRole;
}): GraphAnnotationTarget {
  return withTargetKey({
    family: "seismic",
    layerId: input.layerId,
    productId: input.productId,
    objectKind: "3d-volume",
    objectId: input.volumeId ?? "volume",
    comparisonRole: input.comparisonRole ?? "primary",
  });
}

export function sceneSectionGraphAnnotationTarget(input: {
  targetLayerId: string;
  frameId: string;
  axis?: "x" | "y" | "z";
  targetProductId?: string;
}): GraphAnnotationTarget {
  return withTargetKey({
    family: "scene-section",
    layerId: "scene-section",
    productId: input.targetProductId,
    objectKind: "scene-section-cut",
    objectId: `${input.targetLayerId}:${input.frameId}`,
    comparisonRole: "primary",
    axis: input.axis,
    frameId: input.frameId,
    targetLayerId: input.targetLayerId,
  });
}

export function itemGraphAnnotationTarget(input: {
  layerId: string;
  itemId: string;
  objectKind?: string;
  productId?: string;
  family?: GraphAnnotationFamily;
  comparisonRole?: GraphAnnotationComparisonRole;
}): GraphAnnotationTarget {
  return withTargetKey({
    family: input.family ?? "item",
    layerId: input.layerId,
    productId: input.productId,
    objectKind: input.objectKind ?? "item-graph",
    objectId: input.itemId,
    comparisonRole: input.comparisonRole ?? "single",
  });
}
