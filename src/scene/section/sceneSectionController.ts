import * as THREE from "three";
import type {
  EditableStyle,
  SceneProperties,
  SceneSectionAxisAlignment,
  SceneSectionAxisDatum,
} from "../../pages/types";
import {
  getHeightSampler,
  peekHeightSampler,
  type HeightSampler,
} from "../heightSampler";
import { disposeObjectTree } from "../disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { clamp01, clampRange } from "../styles/styleUtils";
import {
  easeProgress,
  type SceneSectionStyleTween,
} from "../transitions/transitionStyles";
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  ResolvedSceneSectionWindow,
  SceneSectionApplyOptions,
  SceneSectionAxis,
  SceneSectionMaskTransition,
  SceneSectionObjectTarget,
  SceneSectionObjectVisibility,
  SceneSectionRuntime,
  SceneSectionStyleMaskTransition,
  SceneSectionWindowHandleKind,
} from "../SceneManager";
import {
  applySceneSectionObjectVisibilityBuiltInMaterial,
  setSceneSectionObjectVisibilityUniforms,
} from "../shaders/sceneSectionObjectVisibilityShader";
import {
  utmConvergenceRadians,
  utmToLatLon,
  utmZoneFromSourceCrs,
} from "../../loaders/utmProjection";
import {
  sectionFaceFrameFromGraphBasis,
  type SeismicSectionGraphBasis,
  type SectionFaceFrameBasis,
} from "../../geophysics/seismicSectionGraphBasis";

type SceneSectionApplyTransitionFrameOptions = SceneSectionApplyOptions & {
  transitionFrame?: boolean;
};

type SceneSectionSourceFaceFrame = SectionFaceFrameBasis & {
  axis: SceneSectionAxis;
};

type SceneSectionVisualSettings = NonNullable<SceneProperties["sectionVisuals"]>;

const SCENE_SECTION_AXIS_NORMALS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const;
const SCENE_SECTION_AXIS_COLORS = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;
const SCENE_SECTION_AXIS_SPECS: Record<
  SceneSectionAxis,
  {
    normal: THREE.Vector3;
    color: string;
    positionIndex: 0 | 1 | 2;
    frameAIndex: 0 | 1 | 2;
    frameBIndex: 0 | 1 | 2;
  }
> = {
  x: {
    normal: SCENE_SECTION_AXIS_NORMALS.x,
    color: SCENE_SECTION_AXIS_COLORS.x,
    positionIndex: 0,
    frameAIndex: 1,
    frameBIndex: 2,
  },
  y: {
    normal: SCENE_SECTION_AXIS_NORMALS.y,
    color: SCENE_SECTION_AXIS_COLORS.y,
    positionIndex: 1,
    frameAIndex: 0,
    frameBIndex: 2,
  },
  z: {
    normal: SCENE_SECTION_AXIS_NORMALS.z,
    color: SCENE_SECTION_AXIS_COLORS.z,
    positionIndex: 2,
    frameAIndex: 0,
    frameBIndex: 1,
  },
};
const SCENE_SECTION_DEFAULT_POSITIONS = {
  x: -6000,
  y: -10300,
  z: -2200,
} as const;
const SCENE_SECTION_RENDER_ORDER = 4560;
const SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER = 9000;
const SCENE_SECTION_CLIP_EPSILON_M = 0.001;
const SCENE_SECTION_MIN_HELPER_SIZE_M = 1200;
const SCENE_SECTION_HELPER_PADDING = 1.14;
const SCENE_SECTION_LABEL_WIDTH_M = 980;
const SCENE_SECTION_LABEL_HEIGHT_M = 260;
const SCENE_SECTION_LABEL_INSET_M = 180;
const SCENE_SECTION_HANDLE_MIN_SPAN_M = 360;
const SCENE_SECTION_HANDLE_MAX_SPAN_M = 1200;
const SCENE_SECTION_WINDOW_HANDLE_RADIUS_M = 260;
const SCENE_SECTION_HANDLE_VISUAL_SCALE = 3;
const SCENE_SECTION_CONE_VISUAL_SCALE = SCENE_SECTION_HANDLE_VISUAL_SCALE * 0.7;
const SCENE_SECTION_OUTLINE_WIDTH_SCALE = 0.018;
const SCENE_SECTION_OUTLINE_MIN_WIDTH_M = 240;
const SCENE_SECTION_OUTLINE_MAX_WIDTH_M = 600;
const SCENE_SECTION_AXIS_INTERVAL_DEFAULT_M = 5000;
const SCENE_SECTION_AXIS_INTERVAL_MIN_M = 100;
const SCENE_SECTION_AXIS_INTERVAL_MAX_M = 50000;
const SCENE_SECTION_AXIS_MAX_TICKS = 80;
const SCENE_SECTION_AXIS_TEXT_SCALE_DEFAULT = 1;
const SCENE_SECTION_AXIS_TEXT_SCALE_MIN = 0.4;
const SCENE_SECTION_AXIS_TEXT_SCALE_MAX = 100;
const SCENE_SECTION_AXIS_TEXT_PADDING_DEFAULT_M = 420;
const SCENE_SECTION_AXIS_TEXT_PADDING_MIN_M = 0;
const SCENE_SECTION_AXIS_TEXT_PADDING_MAX_M = 10000;
const SCENE_SECTION_AXIS_HEADING_SCALE_DEFAULT = 1.2;
const SCENE_SECTION_AXIS_HEADING_SCALE_MIN = 0.4;
const SCENE_SECTION_AXIS_HEADING_SCALE_MAX = 100;
const SCENE_SECTION_AXIS_HEADING_PADDING_DEFAULT_M = 1100;
const SCENE_SECTION_AXIS_HEADING_PADDING_MIN_M = 0;
const SCENE_SECTION_AXIS_HEADING_PADDING_MAX_M = 20000;
const SCENE_SECTION_AXIS_HEADING_COLOR_DEFAULT = "#f8f4e8";
const SCENE_SECTION_GROUND_TRACE_SAMPLES = 96;
const SCENE_SECTION_GROUND_TRACE_WIDTH_DEFAULT_M = 360;
const SCENE_SECTION_GROUND_TRACE_WIDTH_MIN_M = 30;
const SCENE_SECTION_GROUND_TRACE_WIDTH_MAX_M = 2000;
const SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M = 18;
const SCENE_SECTION_MAX_FRAME_COUNT = 8;
const SCENE_SECTION_BUILT_IN_FRAME_IDS = {
  x: "axis:x",
  y: "axis:y",
  z: "axis:z",
} as const;

function transitionDebugMs(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  material.userData.forceTransparent = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

function makeSceneSectionIntersectionDashMaterial(): THREE.LineDashedMaterial {
  const material = new THREE.LineDashedMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.96,
    dashSize: 150,
    gapSize: 90,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  return material;
}

function withSceneSectionHeightSampler(
  callback: (sampleHeight: HeightSampler) => void,
): void {
  const cached = peekHeightSampler();
  if (cached) {
    callback(cached);
    return;
  }
  void getHeightSampler().then(callback);
}

function makeSceneSectionTraceRibbonMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  return material;
}

function appendSceneSectionTraceRibbonSegment(
  positions: number[],
  indices: number[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  planeNormal: THREE.Vector3,
  halfWidthM: number,
): void {
  const direction = end.clone().sub(start);
  if (direction.lengthSq() < 0.000001) return;
  direction.normalize();
  const widthDirection = direction.clone().cross(planeNormal).normalize();
  if (widthDirection.lengthSq() < 0.000001) return;
  widthDirection.multiplyScalar(halfWidthM);
  const base = positions.length / 3;
  for (const point of [
    start.clone().add(widthDirection),
    start.clone().sub(widthDirection),
    end.clone().add(widthDirection),
    end.clone().sub(widthDirection),
  ]) {
    positions.push(point.x, point.y, point.z);
  }
  indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
}

function buildSceneSectionDashedTraceRibbonGeometry(
  points: THREE.Vector3[],
  widthM: number,
  planeNormal: THREE.Vector3,
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;
  const halfWidthM = Math.max(1, widthM * 0.5);
  const dashSizeM = 150;
  const gapSizeM = 90;
  const cycleM = dashSizeM + gapSizeM;
  const positions: number[] = [];
  const indices: number[] = [];
  let distanceM = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segment = end.clone().sub(start);
    const segmentLengthM = segment.length();
    if (segmentLengthM < 0.000001) continue;
    const direction = segment.multiplyScalar(1 / segmentLengthM);
    let localM = 0;
    while (localM < segmentLengthM) {
      const cyclePositionM = distanceM % cycleM;
      const inDash = cyclePositionM < dashSizeM;
      const boundaryM = inDash ? dashSizeM : cycleM;
      const stepM = Math.min(segmentLengthM - localM, boundaryM - cyclePositionM);
      if (inDash && stepM > 0.000001) {
        appendSceneSectionTraceRibbonSegment(
          positions,
          indices,
          start.clone().addScaledVector(direction, localM),
          start.clone().addScaledVector(direction, localM + stepM),
          planeNormal,
          halfWidthM,
        );
      }
      localM += stepM;
      distanceM += stepM;
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sceneSectionAxes(): SceneSectionAxis[] {
  return ["x", "y", "z"];
}

function sceneSectionBuiltInFrameId(axis: SceneSectionAxis): string {
  return SCENE_SECTION_BUILT_IN_FRAME_IDS[axis];
}

function sceneSectionBuiltInAxisForFrameId(id: string): SceneSectionAxis | null {
  const match = /^axis:([xyz])$/.exec(id);
  return match ? (match[1] as SceneSectionAxis) : null;
}

function sceneSectionValidAxis(value: unknown): value is SceneSectionAxis {
  return value === "x" || value === "y" || value === "z";
}

function sceneSectionDefaultFrameLabel(
  id: string,
  axis: SceneSectionAxis,
): string {
  if (id === sceneSectionBuiltInFrameId(axis)) {
    return `${axis.toUpperCase()} Section frame`;
  }
  const custom = /^custom:([a-z])$/i.exec(id);
  if (custom) return `${custom[1].toUpperCase()} Section frame`;
  return `${axis.toUpperCase()} Section frame`;
}

function sortedClampedRange(
  rawMin: number,
  rawMax: number,
  boundsMin: number,
  boundsMax: number,
): [number, number] {
  const minLimit = -250_000;
  const maxLimit = 250_000;
  const fallbackMin = clampRange(
    Math.min(boundsMin, boundsMax),
    minLimit,
    maxLimit - 100,
  );
  const fallbackMax = clampRange(
    Math.max(boundsMin, boundsMax, fallbackMin + 100),
    fallbackMin + 100,
    maxLimit,
  );
  const sourceMin = Number.isFinite(rawMin) ? rawMin : fallbackMin;
  const sourceMax = Number.isFinite(rawMax) ? rawMax : fallbackMax;
  const low = clampRange(Math.min(sourceMin, sourceMax), minLimit, maxLimit - 100);
  const high = clampRange(
    Math.max(sourceMin, sourceMax, low + 100),
    low + 100,
    maxLimit,
  );
  return [low, high];
}

function axisComponentVector(index: 0 | 1 | 2, direction = 1): THREE.Vector3 {
  const normal = new THREE.Vector3();
  normal.setComponent(index, direction);
  return normal;
}

function sceneSectionVectorComponentIndex(
  vector: THREE.Vector3,
): 0 | 1 | 2 {
  const ax = Math.abs(vector.x);
  const ay = Math.abs(vector.y);
  const az = Math.abs(vector.z);
  return ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
}

function sceneSectionHorizontalComponentIndex(
  vector: THREE.Vector3,
): 0 | 1 {
  return Math.abs(vector.x) >= Math.abs(vector.y) ? 0 : 1;
}

function sceneSectionRotateHorizontal(
  vector: THREE.Vector3,
  convergenceRad: number,
): THREE.Vector3 {
  return vector
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), -convergenceRad)
    .normalize();
}

type SceneSectionGeoContext = {
  origin: { easting: number; northing: number; elevation: number };
  sourceCrs?: string;
  utmZone: number | null;
};

function sceneSectionSourceCrs(this: any): string | undefined {
  const metadata = this.layerSpecFor?.(this.topoSurfaceLayerId?.())?.metadata as
    | Record<string, unknown>
    | undefined;
  const transform =
    metadata?.geoTransform && typeof metadata.geoTransform === "object"
      ? (metadata.geoTransform as Record<string, unknown>)
      : null;
  return typeof transform?.sourceCrs === "string"
    ? transform.sourceCrs
    : undefined;
}

function sceneSectionGeoContext(this: any): SceneSectionGeoContext {
  const origin = this.siteSurfaceGuideOrigin(
    this.layers.get(this.topoSurfaceLayerId()),
  );
  const sourceCrs = sceneSectionSourceCrs.call(this);
  return {
    origin,
    sourceCrs,
    utmZone: utmZoneFromSourceCrs(sourceCrs),
  };
}

function sceneSectionWorldToUtm(
  point: THREE.Vector3,
  origin: { easting: number; northing: number; elevation: number },
): { easting: number; northing: number; elevation: number } {
  return {
    easting: origin.easting + point.x,
    northing: origin.northing + point.y,
    elevation: origin.elevation + point.z,
  };
}

function sceneSectionAxisTicks(
  minValue: number,
  maxValue: number,
  intervalM: number,
  originOffsetM = 0,
): number[] {
  const low = Math.min(minValue, maxValue);
  const high = Math.max(minValue, maxValue);
  const interval = clampRange(
    Math.abs(intervalM),
    SCENE_SECTION_AXIS_INTERVAL_MIN_M,
    SCENE_SECTION_AXIS_INTERVAL_MAX_M,
  );
  const start =
    Math.ceil((low + originOffsetM) / interval) * interval - originOffsetM;
  const ticks: number[] = [];
  for (
    let value = start;
    value <= high + interval * 0.001 &&
    ticks.length < SCENE_SECTION_AXIS_MAX_TICKS;
    value += interval
  ) {
    if (value >= low - interval * 0.001) ticks.push(value);
  }
  if (ticks.length > 0) return ticks;
  return low === high ? [low] : [low, high];
}

function sceneSectionAxisValueLabel(
  componentIndex: 0 | 1 | 2,
  valueM: number,
  origin: { easting: number; northing: number },
): string {
  if (componentIndex === 0)
    return `${((origin.easting + valueM) / 1000).toFixed(1)} E km`;
  if (componentIndex === 1)
    return `${((origin.northing + valueM) / 1000).toFixed(1)} N km`;
  return `${(valueM / 1000).toFixed(1)} elev km`;
}

function sceneSectionAxisHeading(componentIndex: 0 | 1 | 2): string {
  if (componentIndex === 0) return "Easting (km)";
  if (componentIndex === 1) return "Northing (km)";
  return "Elevation (km)";
}

function sceneSectionDefaultAxisHeading(
  datum: SceneSectionAxisDatum,
  vector: THREE.Vector3,
): string {
  const component = sceneSectionVectorComponentIndex(vector);
  if (component === 2) return "Elevation (km)";
  if (datum === "local") return "Distance (km)";
  if (datum === "latlon") {
    return sceneSectionHorizontalComponentIndex(vector) === 0
      ? "Longitude (°)"
      : "Latitude (°)";
  }
  return sceneSectionAxisHeading(component);
}

function formatSceneSectionLonLat(value: number, positive: string, negative: string, decimals: number): string {
  return `${Math.abs(value).toFixed(decimals)}° ${value >= 0 ? positive : negative}`;
}

function sceneSectionAxisValueLabelForPoint(
  frame: ResolvedSceneSectionFrame,
  vector: THREE.Vector3,
  alongM: number,
  point: THREE.Vector3,
  origin: { easting: number; northing: number; elevation: number },
): string {
  const component = sceneSectionVectorComponentIndex(vector);
  if (component === 2) return `${(point.z / 1000).toFixed(1)} elev km`;
  if (frame.axisDatum === "local") {
    const datumPoint = new THREE.Vector3(
      frame.axisDatumOriginEastingM - origin.easting,
      frame.axisDatumOriginNorthingM - origin.northing,
      point.z,
    );
    const datumAlong = datumPoint.dot(vector);
    return `${((alongM - datumAlong) / 1000).toFixed(1)} km`;
  }
  if (frame.axisDatum === "latlon" && frame.utmZone !== null) {
    const utm = sceneSectionWorldToUtm(point, origin);
    const latLon = utmToLatLon(utm.easting, utm.northing, frame.utmZone);
    const decimals = clampRange(frame.axisDatumLatLonDecimals, 0, 6);
    return sceneSectionHorizontalComponentIndex(vector) === 0
      ? formatSceneSectionLonLat(latLon.lon, "E", "W", decimals)
      : formatSceneSectionLonLat(latLon.lat, "N", "S", decimals);
  }
  return sceneSectionAxisValueLabel(component, point.getComponent(component), origin);
}

function sceneSectionAxisTickOffset(
  frame: ResolvedSceneSectionFrame,
  vector: THREE.Vector3,
  origin: { easting: number; northing: number; elevation: number },
): number {
  const component = sceneSectionVectorComponentIndex(vector);
  if (frame.axisDatum === "local") {
    const datumPoint = new THREE.Vector3(
      frame.axisDatumOriginEastingM - origin.easting,
      frame.axisDatumOriginNorthingM - origin.northing,
      0,
    );
    return -datumPoint.dot(vector);
  }
  if (frame.axisAlignment !== "utm") return 0;
  if (component === 0) return origin.easting;
  if (component === 1) return origin.northing;
  return 0;
}

function sceneSectionVisualNumber(
  visuals: SceneSectionVisualSettings | null | undefined,
  key: keyof SceneSectionVisualSettings,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = visuals?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? clampRange(value, min, max)
    : fallback;
}

function sceneSectionVisualSettings(this: any): Required<SceneSectionVisualSettings> {
  const visuals =
    (this.currentSceneProperties?.sectionVisuals as
      | SceneSectionVisualSettings
      | undefined) ?? {};
  return {
    outlineWidthScale: sceneSectionVisualNumber(
      visuals,
      "outlineWidthScale",
      SCENE_SECTION_OUTLINE_WIDTH_SCALE,
      0.004,
      0.08,
    ),
    outlineMinWidthM: sceneSectionVisualNumber(
      visuals,
      "outlineMinWidthM",
      SCENE_SECTION_OUTLINE_MIN_WIDTH_M,
      40,
      1200,
    ),
    outlineMaxWidthM: sceneSectionVisualNumber(
      visuals,
      "outlineMaxWidthM",
      SCENE_SECTION_OUTLINE_MAX_WIDTH_M,
      80,
      2400,
    ),
    arrowSpanScale: sceneSectionVisualNumber(
      visuals,
      "arrowSpanScale",
      1.12,
      0.3,
      3,
    ),
    arrowMinLengthM: sceneSectionVisualNumber(
      visuals,
      "arrowMinLengthM",
      520,
      120,
      1600,
    ),
    arrowMaxLengthM: sceneSectionVisualNumber(
      visuals,
      "arrowMaxLengthM",
      1120,
      240,
      3200,
    ),
    arrowRadiusScale: sceneSectionVisualNumber(
      visuals,
      "arrowRadiusScale",
      0.28,
      0.08,
      0.7,
    ),
    arrowGapScale: sceneSectionVisualNumber(
      visuals,
      "arrowGapScale",
      1.28,
      0.6,
      3,
    ),
    axisTickLengthScale: sceneSectionVisualNumber(
      visuals,
      "axisTickLengthScale",
      1.25,
      0.2,
      4,
    ),
    axisTickMinLengthM: sceneSectionVisualNumber(
      visuals,
      "axisTickMinLengthM",
      260,
      40,
      1600,
    ),
    axisTickMaxLengthM: sceneSectionVisualNumber(
      visuals,
      "axisTickMaxLengthM",
      900,
      80,
      3200,
    ),
    groundTraceWidthM: sceneSectionVisualNumber(
      visuals,
      "groundTraceWidthM",
      SCENE_SECTION_GROUND_TRACE_WIDTH_DEFAULT_M,
      SCENE_SECTION_GROUND_TRACE_WIDTH_MIN_M,
      SCENE_SECTION_GROUND_TRACE_WIDTH_MAX_M,
    ),
  };
}

function sceneSectionVisualOutlineWidthM(
  width: number,
  height: number,
  visuals: Required<SceneSectionVisualSettings>,
): number {
  const span = Math.max(1, Math.min(Math.abs(width), Math.abs(height)));
  const maxWidth = Math.max(
    16,
    Math.min(visuals.outlineMaxWidthM, span * 0.18),
  );
  const minWidth = Math.min(visuals.outlineMinWidthM, maxWidth);
  return clampRange(span * visuals.outlineWidthScale, minWidth, maxWidth);
}

function buildSceneSectionOutlineGeometry(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
  widthM: number,
): THREE.BufferGeometry {
  const lowA = Math.min(minA, maxA);
  const highA = Math.max(minA, maxA);
  const lowB = Math.min(minB, maxB);
  const highB = Math.max(minB, maxB);
  const spanA = Math.max(1, highA - lowA);
  const spanB = Math.max(1, highB - lowB);
  const halfStroke = Math.min(widthM * 0.5, spanA * 0.24, spanB * 0.24);
  const outerMinA = lowA - halfStroke;
  const outerMaxA = highA + halfStroke;
  const outerMinB = lowB - halfStroke;
  const outerMaxB = highB + halfStroke;
  const innerMinA = lowA + halfStroke;
  const innerMaxA = highA - halfStroke;
  const innerMinB = lowB + halfStroke;
  const innerMaxB = highB - halfStroke;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        outerMinA,
        outerMinB,
        0,
        outerMaxA,
        outerMinB,
        0,
        outerMaxA,
        outerMaxB,
        0,
        outerMinA,
        outerMaxB,
        0,
        innerMinA,
        innerMinB,
        0,
        innerMaxA,
        innerMinB,
        0,
        innerMaxA,
        innerMaxB,
        0,
        innerMinA,
        innerMaxB,
        0,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0,
    1,
    5,
    0,
    5,
    4,
    1,
    2,
    6,
    1,
    6,
    5,
    2,
    3,
    7,
    2,
    7,
    6,
    3,
    0,
    4,
    3,
    4,
    7,
  ]);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSceneSectionOutlineMaterial(
  color: string,
  opacity: number,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.transparent = true;
  (
    material as THREE.MeshBasicMaterial & {
      forceSinglePass?: boolean;
    }
  ).forceSinglePass = true;
  material.userData.sceneSectionHelper = true;
  material.needsUpdate = true;
  return material;
}

function makeSceneSectionConeMaterial(
  color: string,
  opacity: number,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.38,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.transparent = true;
  material.userData.sceneSectionHelper = true;
  material.needsUpdate = true;
  return material;
}

function frameKindForHandle(
  kind: SceneSectionWindowHandleKind,
): "minA" | "maxA" | "minB" | "maxB" {
  if (kind === "window-min" || kind === "frame-min-a") return "minA";
  if (kind === "window-max" || kind === "frame-max-a") return "maxA";
  if (kind === "frame-max-b") return "maxB";
  return "minB";
}

function frameForAxis(
  frames: ResolvedSceneSectionFrame[],
  axis: SceneSectionAxis,
): ResolvedSceneSectionFrame | null {
  return frames.find((frame) => frame.axis === axis) ?? null;
}

function frameForPlane(
  frames: ResolvedSceneSectionFrame[],
  plane: ResolvedSceneSectionPlane,
): ResolvedSceneSectionFrame | null {
  return (
    frames.find((frame) => frame.frameId === plane.frameId) ??
    frameForAxis(frames, plane.axis)
  );
}

export function sceneSectionProductIds(this: any, style: EditableStyle): Set<string> {
  const seismic = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
  const selected =
    typeof seismic?.userData.seismicSelectedProductId === "string"
      ? seismic.userData.seismicSelectedProductId
      : typeof style.seismicProductId === "string"
        ? style.seismicProductId
        : "";
  if (style.sceneSectionTargetScope === "all-visible") {
    const ids = new Set<string>();
    seismic?.traverse((obj: THREE.Object3D) => {
      const productId = obj.userData?.seismicProductId;
      if (typeof productId === "string") ids.add(productId);
    });
    return ids;
  }
  const configured = Array.isArray(style.sceneSectionTargetProductIds)
    ? style.sceneSectionTargetProductIds.filter(
        (id) => typeof id === "string",
      )
    : [];
  if (style.sceneSectionTargetScope === "active-selection") {
    return new Set(selected ? [selected] : configured);
  }
  return new Set(
    configured.length > 0 ? configured : selected ? [selected] : [],
  );
}

export function sceneSectionLayerIds(this: any, style: EditableStyle): Set<string> {
  if (style.sceneSectionTargetScope === "all-visible") {
    const ids = new Set<string>();
    for (const [id, group] of this.layers) {
      if (group.visible) ids.add(id);
    }
    return ids;
  }
  const configured = Array.isArray(style.sceneSectionTargetLayerIds)
    ? style.sceneSectionTargetLayerIds.filter((id) => typeof id === "string")
    : [];
  if (style.sceneSectionTargetScope === "active-selection") {
    return new Set(configured);
  }
  return new Set(
    configured.length > 0
      ? configured
      : [
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      ],
  );
}

const SCENE_SECTION_OBJECT_AXES: SceneSectionAxis[] = ["x", "y", "z"];

function sceneSectionLayerObjectId(layerId: string): string {
  return `layer:${layerId}`;
}

function sceneSectionLegacyProductObjectId(
  layerId: string,
  productId: string,
): string {
  return `product:${layerId}:${productId}`;
}

function sceneSectionProductObjectId(
  layerId: string,
  productId: string,
  kind: "section" | "volume",
): string {
  return `${sceneSectionLegacyProductObjectId(layerId, productId)}:${kind}`;
}

function sceneSectionProductObjectParts(objectId: string): {
  layerId: string;
  productId: string;
  representationKind?: "section" | "volume";
} | null {
  const match = /^product:([^:]+):([^:]+)(?::(section|volume))?$/.exec(
    objectId,
  );
  if (!match) return null;
  return {
    layerId: match[1],
    productId: match[2],
    representationKind: match[3] as "section" | "volume" | undefined,
  };
}

function sceneSectionObjectIdForObject(
  layerId: string,
  obj: THREE.Object3D,
): string {
  const productId = obj.userData?.seismicProductId;
  if (
    layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID &&
    typeof productId === "string" &&
    productId
  ) {
    if (obj.userData?.seismicRaymarchVolume === true) {
      return sceneSectionProductObjectId(layerId, productId, "volume");
    }
    if (
      obj.userData?.seismicSection === true ||
      obj.userData?.seismicTexturePlane === true
    ) {
      return sceneSectionProductObjectId(layerId, productId, "section");
    }
    return sceneSectionLegacyProductObjectId(layerId, productId);
  }
  return sceneSectionLayerObjectId(layerId);
}

function sceneSectionLegacyObjectIdForObject(
  layerId: string,
  obj: THREE.Object3D,
): string | null {
  if (layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return null;
  const productId = obj.userData?.seismicProductId;
  return typeof productId === "string" && productId
    ? sceneSectionLegacyProductObjectId(layerId, productId)
    : null;
}

function sceneSectionTargetLabel(this: any, layerId: string): string {
  const spec = this.layerSpecs?.get?.(layerId) as
    | { label?: unknown }
    | undefined;
  if (typeof spec?.label === "string" && spec.label.trim()) {
    return spec.label;
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return "3D MT resistivity volume";
  }
  if (layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) {
    return "MT thresholds";
  }
  if (layerId === UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID) {
    return "MT top surface";
  }
  if (layerId === UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID) {
    return "MT top contact surface";
  }
  return layerId;
}

export function listSceneSectionObjectTargets(this: any): SceneSectionObjectTarget[] {
  const targets = new Map<string, SceneSectionObjectTarget>();
  const addLayer = (layerId: string, supported = true) => {
    const layer = this.layers.get(layerId) as THREE.Group | undefined;
    const objectId = sceneSectionLayerObjectId(layerId);
    targets.set(objectId, {
      objectId,
      label: sceneSectionTargetLabel.call(this, layerId),
      layerId,
      supported,
      visible: layer?.visible === true,
      axes: SCENE_SECTION_OBJECT_AXES,
    });
  };
  for (const layerId of [
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
    UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
    UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
    UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
    "utah-forge-reference-stage",
  ]) {
    addLayer(layerId, true);
  }
  addLayer(UTAH_FORGE_MT_STATIONS_LAYER_ID, true);

  const seismicLayer = this.layers.get(
    UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  ) as THREE.Group | undefined;
  const seismicTargetsByProduct = new Map<
    string,
    {
      label: string;
      hasSection: boolean;
      hasVolume: boolean;
    }
  >();
  seismicLayer?.traverse((obj: THREE.Object3D) => {
    const productId = obj.userData?.seismicProductId;
    if (typeof productId !== "string" || !productId) return;
    const existing = seismicTargetsByProduct.get(productId);
    const productLabel = obj.userData?.seismicProductLabel;
    const displayName = obj.userData?.displayName;
    const label =
      existing?.label ??
      (typeof productLabel === "string" && productLabel.trim()
        ? productLabel
        : typeof displayName === "string" && displayName.trim()
          ? displayName
          : productId);
    seismicTargetsByProduct.set(productId, {
      label,
      hasSection:
        existing?.hasSection === true ||
        obj.userData?.seismicSection === true ||
        obj.userData?.seismicTexturePlane === true,
      hasVolume:
        existing?.hasVolume === true ||
        obj.userData?.seismicRaymarchVolume === true,
    });
  });
  for (const [productId, target] of seismicTargetsByProduct) {
    if (target.hasVolume) {
      const objectId = sceneSectionProductObjectId(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        "volume",
      );
      targets.set(objectId, {
        objectId,
        label: `Seismic volume: ${target.label}`,
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        representationKind: "volume",
        supported: true,
        visible: seismicLayer?.visible === true,
        axes: SCENE_SECTION_OBJECT_AXES,
      });
    }
    if (target.hasSection) {
      const objectId = sceneSectionProductObjectId(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        "section",
      );
      targets.set(objectId, {
        objectId,
        label: `Seismic section image: ${target.label}`,
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        representationKind: "section",
        supported: true,
        visible: seismicLayer?.visible === true,
        axes: SCENE_SECTION_OBJECT_AXES,
      });
    }
  }
  return Array.from(targets.values());
}

function sceneSectionLegacyObjectTargeted(
  layerId: string,
  obj: THREE.Object3D,
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): boolean {
  if (obj.userData?.sceneSectionHelper === true) return false;
  if (style.sceneSectionTargetScope === "all-visible") return true;
  if (layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) {
    const productId = obj.userData?.seismicProductId;
    if (typeof productId === "string") return productTargets.has(productId);
    if (obj.userData?.seismicNavigation === true)
      return layerTargets.has(layerId);
    return layerTargets.has(layerId);
  }
  return layerTargets.has(layerId);
}

function sceneSectionAxisOutsideOpacity(
  style: EditableStyle,
  axis: SceneSectionAxis,
  objectId: string,
  legacyTargeted: boolean,
  legacyObjectId?: string | null,
): number {
  const entries = style.sceneSectionObjectVisibilityByAxis?.[axis];
  const entry = entries?.[objectId];
  const legacyEntry =
    legacyObjectId && legacyObjectId !== objectId
      ? entries?.[legacyObjectId]
      : undefined;
  const value = entry?.outsideOpacity;
  const legacyValue = legacyEntry?.outsideOpacity;
  return typeof value === "number" && Number.isFinite(value)
    ? clamp01(value)
    : typeof legacyValue === "number" && Number.isFinite(legacyValue)
      ? clamp01(legacyValue)
    : legacyTargeted
      ? 0
      : 1;
}

type SceneSectionResolvedFrameEntry = {
  id: string;
  label: string;
  builtIn: boolean;
  controlsVisible: boolean;
  legendVisible?: boolean;
  axis: SceneSectionAxis;
  plane: NonNullable<EditableStyle["sceneSectionPlanes"]>[SceneSectionAxis];
  frame: NonNullable<EditableStyle["sceneSectionFrameByAxis"]>[SceneSectionAxis];
};

function sceneSectionResolvedFrameEntries(
  style: EditableStyle,
): SceneSectionResolvedFrameEntry[] {
  const explicitEntries = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicitEntries
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry]),
  );
  const planes = style.sceneSectionPlanes ?? {};
  const frames = style.sceneSectionFrameByAxis ?? {};
  const resolved: SceneSectionResolvedFrameEntry[] = [];
  for (const axis of sceneSectionAxes()) {
    const id = sceneSectionBuiltInFrameId(axis);
    const explicit = explicitById.get(id);
    const frame = {
      ...(frames[axis] ?? {}),
      ...(explicit?.frame ?? {}),
    };
    const controlsVisible =
      typeof frame.controlsVisible === "boolean"
        ? frame.controlsVisible
        : explicit?.legendVisible === false
          ? false
          : typeof style.sceneSectionHelperVisible === "boolean"
            ? style.sceneSectionHelperVisible
            : true;
    resolved.push({
      id,
      label:
        typeof explicit?.label === "string" && explicit.label.trim()
          ? explicit.label
          : sceneSectionDefaultFrameLabel(id, axis),
      builtIn: true,
      controlsVisible,
      legendVisible: explicit?.legendVisible,
      axis,
      plane: {
        ...(explicit?.plane ?? {}),
        ...(planes[axis] ?? {}),
      },
      frame,
    });
  }
  for (const entry of explicitEntries) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.startsWith("axis:") ||
      !sceneSectionValidAxis(entry.axis)
    ) {
      continue;
    }
    resolved.push({
      id: entry.id,
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label
          : sceneSectionDefaultFrameLabel(entry.id, entry.axis),
      builtIn: false,
      controlsVisible:
        typeof entry.frame?.controlsVisible === "boolean"
          ? entry.frame.controlsVisible
          : entry.legendVisible === false
            ? false
            : typeof style.sceneSectionHelperVisible === "boolean"
              ? style.sceneSectionHelperVisible
              : true,
      legendVisible: entry.legendVisible,
      axis: entry.axis,
      plane: { ...(entry.plane ?? {}) },
      frame: { ...(entry.frame ?? {}) },
    });
    if (resolved.length >= SCENE_SECTION_MAX_FRAME_COUNT) break;
  }
  return resolved.slice(0, SCENE_SECTION_MAX_FRAME_COUNT);
}

function sceneSectionFrameListWithPatch(
  style: EditableStyle,
  frameId: string,
  axis: SceneSectionAxis,
  patch: {
    plane?: NonNullable<EditableStyle["sceneSectionPlanes"]>[SceneSectionAxis];
    frame?: NonNullable<EditableStyle["sceneSectionFrameByAxis"]>[SceneSectionAxis];
  },
): NonNullable<EditableStyle["sceneSectionFrames"]> {
  const entries = sceneSectionResolvedFrameEntries(style);
  const existing = entries.find((entry) => entry.id === frameId);
  const next = entries.map((entry) =>
    entry.id === frameId
      ? {
          id: entry.id,
          label: entry.label,
          ...(!entry.builtIn && typeof entry.legendVisible === "boolean"
            ? { legendVisible: entry.legendVisible }
            : {}),
          axis,
          plane: {
            ...(entry.plane ?? {}),
            ...(patch.plane ?? {}),
          },
          frame: {
            ...(entry.frame ?? {}),
            ...(patch.frame ?? {}),
          },
        }
      : {
          id: entry.id,
          label: entry.label,
          ...(!entry.builtIn && typeof entry.legendVisible === "boolean"
            ? { legendVisible: entry.legendVisible }
            : {}),
          axis: entry.axis,
          plane: entry.plane,
          frame: entry.frame,
        },
  );
  if (!existing && next.length < SCENE_SECTION_MAX_FRAME_COUNT) {
    const builtIn = frameId === sceneSectionBuiltInFrameId(axis);
    next.push({
      id: frameId,
      label: sceneSectionDefaultFrameLabel(frameId, axis),
      ...(!builtIn ? { legendVisible: true } : {}),
      axis,
      plane: patch.plane ?? {},
      frame: patch.frame ?? {},
    });
  }
  return next;
}

function sceneSectionFrameOutsideOpacity(
  style: EditableStyle,
  frameId: string,
  axis: SceneSectionAxis,
  objectId: string,
  legacyTargeted: boolean,
  legacyObjectId?: string | null,
): number {
  const entries = style.sceneSectionObjectVisibilityByFrameId?.[frameId];
  const byFrameValue = entries?.[objectId]?.outsideOpacity;
  if (typeof byFrameValue === "number" && Number.isFinite(byFrameValue)) {
    return clamp01(byFrameValue);
  }
  const legacyByFrameValue =
    legacyObjectId && legacyObjectId !== objectId
      ? entries?.[legacyObjectId]?.outsideOpacity
      : undefined;
  if (
    typeof legacyByFrameValue === "number" &&
    Number.isFinite(legacyByFrameValue)
  ) {
    return clamp01(legacyByFrameValue);
  }
  return sceneSectionAxisOutsideOpacity(
    style,
    axis,
    objectId,
    legacyTargeted,
    legacyObjectId,
  );
}

type SceneSectionObjectVisibilityMap =
  Record<string, { outsideOpacity?: number }>;

function sceneSectionVisibilityEntryOutsideOpacity(
  entries: SceneSectionObjectVisibilityMap | undefined,
  objectId: string,
  fallback: number,
): number {
  const value = entries?.[objectId]?.outsideOpacity;
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp01(value);
  }
  const parts = sceneSectionProductObjectParts(objectId);
  const legacyValue =
    parts?.representationKind && parts.layerId && parts.productId
      ? entries?.[
          sceneSectionLegacyProductObjectId(parts.layerId, parts.productId)
        ]?.outsideOpacity
      : undefined;
  return typeof legacyValue === "number" && Number.isFinite(legacyValue)
    ? clamp01(legacyValue)
    : clamp01(fallback);
}

function sceneSectionStyleSelectedProductId(style: EditableStyle): string {
  return typeof style.seismicProductId === "string" &&
    style.seismicProductId.trim()
    ? style.seismicProductId
    : "";
}

function sceneSectionStyleProductTargeted(
  style: EditableStyle,
  productId: string,
): boolean {
  if (style.sceneSectionTargetScope === "all-visible") return true;
  const configured = Array.isArray(style.sceneSectionTargetProductIds)
    ? style.sceneSectionTargetProductIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  const selected = sceneSectionStyleSelectedProductId(style);
  if (style.sceneSectionTargetScope === "active-selection") {
    return selected ? selected === productId : configured.includes(productId);
  }
  return configured.length > 0
    ? configured.includes(productId)
    : selected === productId;
}

function sceneSectionStyleLayerTargeted(
  style: EditableStyle,
  layerId: string,
): boolean {
  if (style.sceneSectionTargetScope === "all-visible") return true;
  const configured = Array.isArray(style.sceneSectionTargetLayerIds)
    ? style.sceneSectionTargetLayerIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  if (style.sceneSectionTargetScope === "active-selection") {
    return configured.includes(layerId);
  }
  return configured.length > 0
    ? configured.includes(layerId)
    : layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID ||
        layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID;
}

function sceneSectionVisibilityDefaultOutsideOpacity(
  style: EditableStyle,
  objectId: string,
): number {
  const productParts = sceneSectionProductObjectParts(objectId);
  if (productParts) {
    return sceneSectionStyleProductTargeted(style, productParts.productId)
      ? 0
      : 1;
  }
  const layerMatch = /^layer:([^:]+)$/.exec(objectId);
  if (layerMatch) {
    return sceneSectionStyleLayerTargeted(style, layerMatch[1]) ? 0 : 1;
  }
  return style.sceneSectionTargetScope === "all-visible" ? 0 : 1;
}

function interpolatedSceneSectionObjectVisibilityMap(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  fromEntries: SceneSectionObjectVisibilityMap | undefined,
  toEntries: SceneSectionObjectVisibilityMap | undefined,
  t: number,
): SceneSectionObjectVisibilityMap | undefined {
  const objectIds = new Set<string>([
    ...Object.keys(fromEntries ?? {}),
    ...Object.keys(toEntries ?? {}),
  ]);
  if (objectIds.size === 0) return undefined;
  const next: SceneSectionObjectVisibilityMap = {};
  for (const objectId of objectIds) {
    const fromOutsideOpacity = sceneSectionVisibilityEntryOutsideOpacity(
      fromEntries,
      objectId,
      sceneSectionVisibilityDefaultOutsideOpacity(fromStyle, objectId),
    );
    const toOutsideOpacity = sceneSectionVisibilityEntryOutsideOpacity(
      toEntries,
      objectId,
      sceneSectionVisibilityDefaultOutsideOpacity(toStyle, objectId),
    );
    next[objectId] = {
      outsideOpacity:
        fromOutsideOpacity + (toOutsideOpacity - fromOutsideOpacity) * t,
    };
  }
  return next;
}

function interpolatedSceneSectionObjectVisibilityByAxis(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  t: number,
): EditableStyle["sceneSectionObjectVisibilityByAxis"] {
  const next: NonNullable<EditableStyle["sceneSectionObjectVisibilityByAxis"]> =
    {};
  for (const axis of sceneSectionAxes()) {
    const entries = interpolatedSceneSectionObjectVisibilityMap(
      fromStyle,
      toStyle,
      fromStyle.sceneSectionObjectVisibilityByAxis?.[axis],
      toStyle.sceneSectionObjectVisibilityByAxis?.[axis],
      t,
    );
    if (entries) next[axis] = entries;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function interpolatedSceneSectionObjectVisibilityByFrameId(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  t: number,
): EditableStyle["sceneSectionObjectVisibilityByFrameId"] {
  const frameIds = new Set<string>([
    ...Object.keys(fromStyle.sceneSectionObjectVisibilityByFrameId ?? {}),
    ...Object.keys(toStyle.sceneSectionObjectVisibilityByFrameId ?? {}),
  ]);
  if (frameIds.size === 0) return undefined;
  const next: NonNullable<EditableStyle["sceneSectionObjectVisibilityByFrameId"]> =
    {};
  for (const frameId of frameIds) {
    const entries = interpolatedSceneSectionObjectVisibilityMap(
      fromStyle,
      toStyle,
      fromStyle.sceneSectionObjectVisibilityByFrameId?.[frameId],
      toStyle.sceneSectionObjectVisibilityByFrameId?.[frameId],
      t,
    );
    if (entries) next[frameId] = entries;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function sceneSectionObjectVisibilityForObject(this: any,
  layerId: string,
  obj: THREE.Object3D,
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): SceneSectionObjectVisibility {
  const objectId = sceneSectionObjectIdForObject(layerId, obj);
  const legacyObjectId = sceneSectionLegacyObjectIdForObject(layerId, obj);
  const legacyTargeted = sceneSectionLegacyObjectTargeted(
    layerId,
    obj,
    style,
    layerTargets,
    productTargets,
  );
  const outsideOpacityByAxis = {
    x: sceneSectionAxisOutsideOpacity(
      style,
      "x",
      objectId,
      legacyTargeted,
      legacyObjectId,
    ),
    y: sceneSectionAxisOutsideOpacity(
      style,
      "y",
      objectId,
      legacyTargeted,
      legacyObjectId,
    ),
    z: sceneSectionAxisOutsideOpacity(
      style,
      "z",
      objectId,
      legacyTargeted,
      legacyObjectId,
    ),
  };
  const outsideOpacityByFrameId: Record<string, number> = {};
  for (const entry of sceneSectionResolvedFrameEntries(style)) {
    const value = sceneSectionFrameOutsideOpacity(
      style,
      entry.id,
      entry.axis,
      objectId,
      legacyTargeted,
      legacyObjectId,
    );
    outsideOpacityByFrameId[entry.id] = value;
    outsideOpacityByAxis[entry.axis] = Math.min(
      outsideOpacityByAxis[entry.axis],
      value,
    );
  }
  const opacityValues = [
    ...Object.values(outsideOpacityByAxis),
    ...Object.values(outsideOpacityByFrameId),
  ];
  const active = opacityValues.some(
    (value) => value < 0.999,
  );
  const hasSoftOpacity = opacityValues.some(
    (value) => value > 0.001 && value < 0.999,
  );
  return {
    objectId,
    outsideOpacityByAxis,
    outsideOpacityByFrameId,
    active,
    hasSoftOpacity,
  };
}

type SceneSectionFrameBasis = {
  normal: THREE.Vector3;
  axisAVector: THREE.Vector3;
  axisBVector: THREE.Vector3;
  center: THREE.Vector3;
  signedDistanceM: number;
  minAM: number;
  maxAM: number;
  minBM: number;
  maxBM: number;
  alignment: SceneSectionAxisAlignment;
  datum: SceneSectionAxisDatum;
  datumOriginEastingM: number;
  datumOriginNorthingM: number;
  datumLatLonDecimals: number;
  utmZone: number | null;
};

function sceneSectionAlignment(value: unknown): SceneSectionAxisAlignment {
  return value === "cardinal" ? "cardinal" : "utm";
}

function sceneSectionDatum(value: unknown): SceneSectionAxisDatum {
  return value === "local" || value === "latlon" ? value : "utm";
}

function sceneSectionBasisVectors(
  axis: SceneSectionAxis,
  alignment: SceneSectionAxisAlignment,
  convergenceRad: number,
): {
  normal: THREE.Vector3;
  axisAVector: THREE.Vector3;
  axisBVector: THREE.Vector3;
} {
  const east =
    alignment === "cardinal"
      ? sceneSectionRotateHorizontal(axisComponentVector(0), convergenceRad)
      : axisComponentVector(0);
  const north =
    alignment === "cardinal"
      ? sceneSectionRotateHorizontal(axisComponentVector(1), convergenceRad)
      : axisComponentVector(1);
  const up = axisComponentVector(2);
  if (axis === "x") {
    return { normal: east.clone(), axisAVector: north.clone(), axisBVector: up };
  }
  if (axis === "y") {
    return { normal: north.clone(), axisAVector: east.clone(), axisBVector: up };
  }
  return { normal: up, axisAVector: east.clone(), axisBVector: north.clone() };
}

function sceneSectionFrameCenterFromRanges(
  axis: SceneSectionAxis,
  positionM: number,
  minAM: number,
  maxAM: number,
  minBM: number,
  maxBM: number,
): THREE.Vector3 {
  const spec = SCENE_SECTION_AXIS_SPECS[axis];
  const center = new THREE.Vector3();
  center.setComponent(spec.positionIndex, positionM);
  center.setComponent(spec.frameAIndex, (minAM + maxAM) * 0.5);
  center.setComponent(spec.frameBIndex, (minBM + maxBM) * 0.5);
  return center;
}

function sceneSectionVec3(value: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
}

function sceneSectionOrthonormalSourceBasis(source: SectionFaceFrameBasis): {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  axisAVector: THREE.Vector3;
  axisBVector: THREE.Vector3;
} {
  const normal = sceneSectionVec3(source.normal);
  if (normal.lengthSq() < 1e-12) normal.copy(SCENE_SECTION_AXIS_NORMALS.y);
  normal.normalize();

  const axisA = sceneSectionVec3(source.axisAVector);
  if (axisA.lengthSq() < 1e-12) axisA.set(1, 0, 0);
  axisA.addScaledVector(normal, -axisA.dot(normal));
  if (axisA.lengthSq() < 1e-12) {
    axisA.crossVectors(
      Math.abs(normal.z) < 0.9
        ? SCENE_SECTION_AXIS_NORMALS.z
        : SCENE_SECTION_AXIS_NORMALS.x,
      normal,
    );
  }
  axisA.normalize();

  const axisB = new THREE.Vector3().crossVectors(normal, axisA).normalize();
  const sourceAxisB = sceneSectionVec3(source.axisBVector);
  if (sourceAxisB.lengthSq() > 1e-12 && axisB.dot(sourceAxisB) < 0) {
    axisA.multiplyScalar(-1);
    axisB.crossVectors(normal, axisA).normalize();
  }

  return {
    center: sceneSectionVec3(source.center),
    normal,
    axisAVector: axisA,
    axisBVector: axisB,
  };
}

function sceneSectionSourceFaceFrame(
  this: any,
  style: EditableStyle,
  entryId: string,
  axis: SceneSectionAxis,
): SceneSectionSourceFaceFrame | null {
  const rawActiveFrameId =
    typeof style.sceneSectionActiveFrameId === "string" &&
    style.sceneSectionActiveFrameId.trim()
      ? style.sceneSectionActiveFrameId
      : sceneSectionBuiltInFrameId(style.sceneSectionActiveAxis ?? axis);
  const activeAxis = sceneSectionValidAxis(style.sceneSectionActiveAxis)
    ? style.sceneSectionActiveAxis
    : axis;
  const activeBuiltInAxis =
    sceneSectionBuiltInAxisForFrameId(rawActiveFrameId);
  const activeFrameId =
    activeBuiltInAxis && activeBuiltInAxis !== activeAxis
      ? sceneSectionBuiltInFrameId(activeAxis)
      : rawActiveFrameId;
  if (entryId !== activeFrameId && axis !== activeAxis) return null;
  const layerTargets = this.sceneSectionLayerIds(style) as Set<string>;
  if (!layerTargets.has(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)) return null;
  const productTargets = this.sceneSectionProductIds(style) as Set<string>;
  const seismicLayer = this.layers.get(
    UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  ) as THREE.Group | undefined;
  if (!seismicLayer) return null;

  let selectedBasis: SeismicSectionGraphBasis | null = null;
  let fallbackBasis: SeismicSectionGraphBasis | null = null;
  seismicLayer.traverse((obj: THREE.Object3D) => {
    const basis = obj.userData?.seismicSectionGraphBasis as
      | SeismicSectionGraphBasis
      | undefined;
    if (!basis || selectedBasis) return;
    const productId =
      typeof obj.userData?.seismicProductId === "string"
        ? obj.userData.seismicProductId
        : "";
    if (obj.userData?.seismicSectionSelectedForFace === true) {
      selectedBasis = basis;
      return;
    }
    if (productTargets.size > 0 && !productTargets.has(productId)) return;
    if (!fallbackBasis && obj.visible) fallbackBasis = basis;
  });
  const basis = selectedBasis ?? fallbackBasis;
  if (!basis) return null;
  return {
    ...sectionFaceFrameFromGraphBasis(basis),
    axis,
  };
}

function sceneSectionResolvedFrameBasis(
  axis: SceneSectionAxis,
  frame: NonNullable<EditableStyle["sceneSectionFrameByAxis"]>[SceneSectionAxis] | undefined,
  positionM: number,
  minAM: number,
  maxAM: number,
  minBM: number,
  maxBM: number,
  geo: SceneSectionGeoContext,
): SceneSectionFrameBasis {
  const alignment = sceneSectionAlignment(frame?.axisAlignment);
  const datum = sceneSectionDatum(frame?.axisDatum);
  const center = sceneSectionFrameCenterFromRanges(
    axis,
    positionM,
    minAM,
    maxAM,
    minBM,
    maxBM,
  );
  const centerUtm = sceneSectionWorldToUtm(center, geo.origin);
  const convergenceRad =
    alignment === "cardinal" && geo.utmZone !== null
      ? utmConvergenceRadians(centerUtm.easting, centerUtm.northing, geo.utmZone)
      : 0;
  const vectors = sceneSectionBasisVectors(axis, alignment, convergenceRad);
  const spanA = Math.abs(maxAM - minAM);
  const spanB = Math.abs(maxBM - minBM);
  const centerA = center.dot(vectors.axisAVector);
  const centerB = center.dot(vectors.axisBVector);
  const datumOriginEastingM =
    finiteNumber(frame?.axisDatumOriginEastingM) ?? centerUtm.easting;
  const datumOriginNorthingM =
    finiteNumber(frame?.axisDatumOriginNorthingM) ?? centerUtm.northing;
  const datumLatLonDecimals = Math.round(
    clampRange(finiteNumber(frame?.axisDatumLatLonDecimals) ?? 3, 0, 6),
  );
  return {
    ...vectors,
    center,
    signedDistanceM: center.dot(vectors.normal),
    minAM: centerA - spanA * 0.5,
    maxAM: centerA + spanA * 0.5,
    minBM: centerB - spanB * 0.5,
    maxBM: centerB + spanB * 0.5,
    alignment,
    datum,
    datumOriginEastingM,
    datumOriginNorthingM,
    datumLatLonDecimals,
    utmZone: geo.utmZone,
  };
}

export function resolveSceneSectionPlanes(this: any, 
  style: EditableStyle,
  bounds?: THREE.Box3,
): ResolvedSceneSectionPlane[] {
  const resolvedBounds =
    bounds ??
    this.sceneSectionBounds(
      style,
      this.sceneSectionLayerIds(style),
      this.sceneSectionProductIds(style),
    );
  const geo = sceneSectionGeoContext.call(this);
  const frames = new Map<string, ResolvedSceneSectionFrame>(
    this
      .resolveSceneSectionFrames(style, resolvedBounds)
      .map((frame: ResolvedSceneSectionFrame) => [frame.frameId, frame]),
  );
  return sceneSectionResolvedFrameEntries(style).map((entry) => {
    const spec = SCENE_SECTION_AXIS_SPECS[entry.axis];
    const position =
      typeof entry.plane?.positionM === "number" &&
      Number.isFinite(entry.plane.positionM)
      ? clampRange(entry.plane.positionM, -250_000, 250_000)
      : SCENE_SECTION_DEFAULT_POSITIONS[entry.axis];
    const frame = frames.get(entry.id);
    const fallbackMinA = resolvedBounds.min.getComponent(spec.frameAIndex);
    const fallbackMaxA = resolvedBounds.max.getComponent(spec.frameAIndex);
    const fallbackMinB = resolvedBounds.min.getComponent(spec.frameBIndex);
    const fallbackMaxB = resolvedBounds.max.getComponent(spec.frameBIndex);
    const basis: SceneSectionFrameBasis | ResolvedSceneSectionFrame =
      frame ??
      (() => {
        const [minAM, maxAM] = sortedClampedRange(
          fallbackMinA,
          fallbackMaxA,
          fallbackMinA,
          fallbackMaxA,
        );
        const [minBM, maxBM] = sortedClampedRange(
          fallbackMinB,
          fallbackMaxB,
          fallbackMinB,
          fallbackMaxB,
        );
        return sceneSectionResolvedFrameBasis(
          entry.axis,
          entry.frame,
          position,
          minAM,
          maxAM,
          minBM,
          maxBM,
          geo,
        );
      })();
    return {
      frameId: entry.id,
      label: entry.label,
      axis: entry.axis,
      enabled: entry.plane?.enabled === true,
      positionM: position,
      signedDistanceM: basis.signedDistanceM,
      point: basis.center.clone(),
      invert: entry.plane?.invert === true,
      normal: basis.normal.clone(),
      axisAVector: basis.axisAVector.clone(),
      axisBVector: basis.axisBVector.clone(),
    };
  });
}

export function sceneSectionActivePlanes(this: any, 
  style: EditableStyle,
): ResolvedSceneSectionPlane[] {
  if (style.sceneSectionEnabled !== true) return [];
  return this.resolveSceneSectionPlanes(style).filter(
    (plane: ResolvedSceneSectionPlane) => plane.enabled,
  );
}

export function sceneSectionObjectTargeted(this: any, 
  layerId: string,
  obj: THREE.Object3D,
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): boolean {
  return sceneSectionLegacyObjectTargeted(
    layerId,
    obj,
    style,
    layerTargets,
    productTargets,
  );
}

export function sceneSectionClippingPlanes(this: any, 
  planes: ResolvedSceneSectionPlane[],
): THREE.Plane[] {
  const clippingPlanes: THREE.Plane[] = [];
  for (const plane of planes) {
    const position = plane.signedDistanceM;
    const normal = plane.invert
      ? plane.normal.clone()
      : plane.normal.clone().multiplyScalar(-1);
    const constant = plane.invert ? -position : position;
    clippingPlanes.push(new THREE.Plane(normal, constant));
  }
  return clippingPlanes;
}

function sceneSectionLabelAnchorPosition(
  obj: THREE.Object3D,
  out: THREE.Vector3,
): void {
  const candidate = obj as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
  };
  if (candidate.geometry) {
    if (!candidate.geometry.boundingBox) candidate.geometry.computeBoundingBox();
    const boundingBox = candidate.geometry.boundingBox;
    if (boundingBox) {
      boundingBox.getCenter(out);
      candidate.localToWorld(out);
      return;
    }
  }
  obj.getWorldPosition(out);
}

function sceneSectionPointClippedByPlanes(
  point: THREE.Vector3,
  planes: THREE.Plane[],
): boolean {
  return planes.some(
    (plane) => plane.distanceToPoint(point) < -SCENE_SECTION_CLIP_EPSILON_M,
  );
}

function updateSceneSectionLabelCullState(
  obj: THREE.Object3D,
  targeted: boolean,
  clippingPlanes: THREE.Plane[],
  frameClippingPlanes: THREE.Plane[],
  anchorPoint: THREE.Vector3,
): void {
  const data = obj.userData as {
    displayName?: unknown;
    sceneSectionLabelHidden?: boolean;
    sceneSectionLabelHiddenBy?: string;
  };
  if (typeof data.displayName !== "string" || data.displayName.length === 0) {
    return;
  }
  const activePlanes = targeted
    ? [...clippingPlanes, ...frameClippingPlanes]
    : [];
  if (activePlanes.length === 0) {
    data.sceneSectionLabelHidden = false;
    delete data.sceneSectionLabelHiddenBy;
    return;
  }
  sceneSectionLabelAnchorPosition(obj, anchorPoint);
  const hidden = sceneSectionPointClippedByPlanes(anchorPoint, activePlanes);
  data.sceneSectionLabelHidden = hidden;
  if (hidden) {
    data.sceneSectionLabelHiddenBy = "scene-section";
  } else {
    delete data.sceneSectionLabelHiddenBy;
  }
}

type SceneSectionSurfaceTraceSegment = {
  start: THREE.Vector3;
  end: THREE.Vector3;
};

function clipSectionSurfaceTraceSegmentToFrame(
  start: THREE.Vector3,
  end: THREE.Vector3,
  frame: ResolvedSceneSectionFrame,
): SceneSectionSurfaceTraceSegment | null {
  const d = end.clone().sub(start);
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 0.000001) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  const startA = start.dot(frame.axisAVector);
  const startB = start.dot(frame.axisBVector);
  const deltaA = d.dot(frame.axisAVector);
  const deltaB = d.dot(frame.axisBVector);
  if (!clip(-deltaA, startA - frame.minAM)) return null;
  if (!clip(deltaA, frame.maxAM - startA)) return null;
  if (!clip(-deltaB, startB - frame.minBM)) return null;
  if (!clip(deltaB, frame.maxBM - startB)) return null;
  if (t1 <= t0) return null;
  const clippedStart = start.clone().addScaledVector(d, t0);
  const clippedEnd = start.clone().addScaledVector(d, t1);
  if (
    clippedStart.distanceToSquared(clippedEnd) <
    SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M *
      SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M
  ) {
    return null;
  }
  return { start: clippedStart, end: clippedEnd };
}

type SceneSectionFrameIntersectionTrace = SceneSectionSurfaceTraceSegment & {
  axes: [SceneSectionAxis, SceneSectionAxis];
  freeAxisIndex: 0 | 1 | 2;
  trimToGround: boolean;
};

function sectionFrameIntersectionTrace(
  firstPlane: ResolvedSceneSectionPlane,
  firstFrame: ResolvedSceneSectionFrame,
  secondPlane: ResolvedSceneSectionPlane,
  secondFrame: ResolvedSceneSectionFrame,
): SceneSectionFrameIntersectionTrace | null {
  const n1 = firstPlane.normal.clone().normalize();
  const n2 = secondPlane.normal.clone().normalize();
  const direction = n1.clone().cross(n2);
  const denom = direction.lengthSq();
  if (denom < 0.000001) return null;
  const point = n2
    .clone()
    .cross(direction)
    .multiplyScalar(firstPlane.signedDistanceM)
    .add(direction.clone().cross(n1).multiplyScalar(secondPlane.signedDistanceM))
    .divideScalar(denom);
  const lineDir = direction.normalize();
  const span = Math.max(
    firstFrame.maxAM - firstFrame.minAM,
    firstFrame.maxBM - firstFrame.minBM,
    secondFrame.maxAM - secondFrame.minAM,
    secondFrame.maxBM - secondFrame.minBM,
    SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M,
  );
  const start = point.clone().addScaledVector(lineDir, -span * 2);
  const end = point.clone().addScaledVector(lineDir, span * 2);
  const clippedToFirst = clipSectionSurfaceTraceSegmentToFrame(
    start,
    end,
    firstFrame,
  );
  if (!clippedToFirst) return null;
  const clippedToBoth = clipSectionSurfaceTraceSegmentToFrame(
    clippedToFirst.start,
    clippedToFirst.end,
    secondFrame,
  );
  if (!clippedToBoth) return null;
  if (
    clippedToBoth.start.distanceToSquared(clippedToBoth.end) <
    SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M *
      SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M
  ) {
    return null;
  }
  return {
    ...clippedToBoth,
    axes: [firstPlane.axis, secondPlane.axis],
    freeAxisIndex: sceneSectionVectorComponentIndex(lineDir),
    trimToGround:
      Math.abs(lineDir.z) > 0.82 &&
      (firstFrame.groundTraceVisible || secondFrame.groundTraceVisible),
  };
}

function sectionFrameIntersectionTraces(
  planes: ResolvedSceneSectionPlane[],
  frames: ResolvedSceneSectionFrame[],
): SceneSectionFrameIntersectionTrace[] {
  const traces: SceneSectionFrameIntersectionTrace[] = [];
  for (let firstIndex = 0; firstIndex < planes.length; firstIndex += 1) {
    const firstPlane = planes[firstIndex];
    const firstFrame = frameForPlane(frames, firstPlane);
    if (!firstFrame) continue;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < planes.length;
      secondIndex += 1
    ) {
      const secondPlane = planes[secondIndex];
      const secondFrame = frameForPlane(frames, secondPlane);
      if (!secondFrame) continue;
      const trace = sectionFrameIntersectionTrace(
        firstPlane,
        firstFrame,
        secondPlane,
        secondFrame,
      );
      if (trace) traces.push(trace);
    }
  }
  return traces;
}

export function sceneSectionAxisAlongIndex(this: any, 
  axis: SceneSectionAxis,
): 0 | 1 | null {
  if (axis === "x" || axis === "y")
    return SCENE_SECTION_AXIS_SPECS[axis].frameAIndex as 0 | 1;
  return null;
}

export function resolveSceneSectionFrames(this: any,
  style: EditableStyle,
  bounds: THREE.Box3,
): ResolvedSceneSectionFrame[] {
  if (
    style.sceneSectionFrameEnabled !== true &&
    style.sceneSectionWindowEnabled !== true &&
    !Array.isArray(style.sceneSectionFrames)
  ) {
    return [];
  }
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
  const frames: ResolvedSceneSectionFrame[] = [];
  const geo = sceneSectionGeoContext.call(this);
  const visuals = sceneSectionVisualSettings.call(this);
  const explicitFrameEnabled = style.sceneSectionFrameEnabled === true;
  const legacyFrameEnabled =
    explicitFrameEnabled || style.sceneSectionWindowEnabled === true;
  for (const entry of sceneSectionResolvedFrameEntries(style)) {
    const axis = entry.axis;
    const spec = SCENE_SECTION_AXIS_SPECS[axis];
    const frame = entry.frame;
    const sourceFaceFrame = sceneSectionSourceFaceFrame.call(
      this,
      style,
      entry.id,
      axis,
    );
    const legacyWindow =
      axis === "x" || axis === "y" ? windowByAxis[axis] : undefined;
    const hasFrameConfig = !!frame && Object.keys(frame).length > 0;
    const frameEnabled =
      typeof frame?.enabled === "boolean"
        ? frame.enabled
        : entry.id.startsWith("custom:")
          ? hasFrameConfig
          : legacyFrameEnabled ||
            hasFrameConfig ||
            Boolean(legacyWindow) ||
            Boolean(sourceFaceFrame);
    if (!frameEnabled) continue;
    const minABound = bounds.min.getComponent(spec.frameAIndex);
    const maxABound = bounds.max.getComponent(spec.frameAIndex);
    const minBBound = bounds.min.getComponent(spec.frameBIndex);
    const maxBBound = bounds.max.getComponent(spec.frameBIndex);
    const rawMinA =
      sourceFaceFrame?.minAM ??
      finiteNumber(frame?.minAM) ??
      finiteNumber(legacyWindow?.minAlongM) ??
      minABound;
    const rawMaxA =
      sourceFaceFrame?.maxAM ??
      finiteNumber(frame?.maxAM) ??
      finiteNumber(legacyWindow?.maxAlongM) ??
      maxABound;
    const rawMinB =
      sourceFaceFrame?.minBM ??
      finiteNumber(frame?.minBM) ??
      finiteNumber(legacyWindow?.bottomElevationM) ??
      minBBound;
    const rawMaxB =
      sourceFaceFrame?.maxBM ?? finiteNumber(frame?.maxBM) ?? maxBBound;
    const [minAM, maxAM] = sourceFaceFrame
      ? [rawMinA, rawMaxA]
      : sortedClampedRange(
          rawMinA,
          rawMaxA,
          minABound,
          maxABound,
        );
    const [minBM, maxBM] = sourceFaceFrame
      ? [rawMinB, rawMaxB]
      : sortedClampedRange(
          rawMinB,
          rawMaxB,
          minBBound,
          maxBBound,
        );
    const position =
      sourceFaceFrame?.signedDistanceM ??
      (typeof entry.plane?.positionM === "number" &&
      Number.isFinite(entry.plane.positionM)
        ? clampRange(entry.plane.positionM, -250_000, 250_000)
        : SCENE_SECTION_DEFAULT_POSITIONS[axis]);
    const sourceBasis = sourceFaceFrame
      ? sceneSectionOrthonormalSourceBasis(sourceFaceFrame)
      : null;
    const basis = sourceFaceFrame && sourceBasis
      ? {
          alignment: sceneSectionAlignment(frame?.axisAlignment),
          datum: sceneSectionDatum(frame?.axisDatum),
          datumLatLonDecimals: 5,
          datumOriginEastingM:
            finiteNumber(frame?.axisDatumOriginEastingM) ?? 0,
          datumOriginNorthingM:
            finiteNumber(frame?.axisDatumOriginNorthingM) ?? 0,
          utmZone: geo.utmZone,
          minAM,
          maxAM,
          minBM,
          maxBM,
          signedDistanceM: sourceBasis.center.dot(sourceBasis.normal),
          center: sourceBasis.center,
          normal: sourceBasis.normal,
          axisAVector: sourceBasis.axisAVector,
          axisBVector: sourceBasis.axisBVector,
        }
      : sceneSectionResolvedFrameBasis(
          axis,
          frame,
          position,
          minAM,
          maxAM,
          minBM,
          maxBM,
          geo,
        );
    const axisIntervalM = clampRange(
      finiteNumber(frame?.axisIntervalM) ??
        finiteNumber(style.sceneSectionAxisIntervalM) ??
        SCENE_SECTION_AXIS_INTERVAL_DEFAULT_M,
      SCENE_SECTION_AXIS_INTERVAL_MIN_M,
      SCENE_SECTION_AXIS_INTERVAL_MAX_M,
    );
    const axisTextScale = clampRange(
      finiteNumber(frame?.axisTextScale) ??
        finiteNumber(style.sceneSectionAxisTextScale) ??
        SCENE_SECTION_AXIS_TEXT_SCALE_DEFAULT,
      SCENE_SECTION_AXIS_TEXT_SCALE_MIN,
      SCENE_SECTION_AXIS_TEXT_SCALE_MAX,
    );
    const axisTextPaddingM = clampRange(
      finiteNumber(frame?.axisTextPaddingM) ??
        SCENE_SECTION_AXIS_TEXT_PADDING_DEFAULT_M,
      SCENE_SECTION_AXIS_TEXT_PADDING_MIN_M,
      SCENE_SECTION_AXIS_TEXT_PADDING_MAX_M,
    );
    const axisHeadingPaddingM = clampRange(
      finiteNumber(frame?.axisHeadingPaddingM) ??
        SCENE_SECTION_AXIS_HEADING_PADDING_DEFAULT_M,
      SCENE_SECTION_AXIS_HEADING_PADDING_MIN_M,
      SCENE_SECTION_AXIS_HEADING_PADDING_MAX_M,
    );
    const axisHeadingScale = clampRange(
      finiteNumber(frame?.axisHeadingScale) ??
        SCENE_SECTION_AXIS_HEADING_SCALE_DEFAULT,
      SCENE_SECTION_AXIS_HEADING_SCALE_MIN,
      SCENE_SECTION_AXIS_HEADING_SCALE_MAX,
    );
    const groundTraceWidthM = clampRange(
      finiteNumber(frame?.groundTraceWidthM) ??
        visuals.groundTraceWidthM,
      SCENE_SECTION_GROUND_TRACE_WIDTH_MIN_M,
      SCENE_SECTION_GROUND_TRACE_WIDTH_MAX_M,
    );
    const axisHeadingColor =
      typeof frame?.axisHeadingColor === "string" &&
      frame.axisHeadingColor.trim()
        ? frame.axisHeadingColor
        : spec.color;
    frames.push({
      frameId: entry.id,
      label: entry.label,
      axis,
      enabled: true,
      controlsVisible: entry.controlsVisible,
      minAM: basis.minAM,
      maxAM: basis.maxAM,
      minBM: basis.minBM,
      maxBM: basis.maxBM,
      axisAIndex: spec.frameAIndex,
      axisBIndex: spec.frameBIndex,
      signedDistanceM: basis.signedDistanceM,
      axisAVector: basis.axisAVector.clone(),
      axisBVector: basis.axisBVector.clone(),
      normal: basis.normal.clone(),
      center: basis.center.clone(),
      axisAlignment: basis.alignment,
      axisDatum: basis.datum,
      axisDatumOriginEastingM: basis.datumOriginEastingM,
      axisDatumOriginNorthingM: basis.datumOriginNorthingM,
      axisDatumLatLonDecimals: basis.datumLatLonDecimals,
      utmZone: basis.utmZone,
      groundTraceVisible:
        typeof frame?.groundTraceVisible === "boolean"
          ? frame.groundTraceVisible
          : style.sceneSectionGroundTraceVisible === true,
      groundTraceWidthM,
      axesVisible:
        typeof frame?.axesVisible === "boolean"
          ? frame.axesVisible
          : style.sceneSectionAxesVisible === true,
      axisIntervalM,
      axisTextScale,
      axisTextPaddingM,
      axisAHeading:
        typeof frame?.axisAHeading === "string" && frame.axisAHeading.trim()
          ? frame.axisAHeading
          : sourceFaceFrame?.axisAHeading
            ? sourceFaceFrame.axisAHeading
          : sceneSectionDefaultAxisHeading(basis.datum, basis.axisAVector),
      axisBHeading:
        typeof frame?.axisBHeading === "string" && frame.axisBHeading.trim()
          ? frame.axisBHeading
          : sourceFaceFrame?.axisBHeading
            ? sourceFaceFrame.axisBHeading
          : sceneSectionDefaultAxisHeading(basis.datum, basis.axisBVector),
      axisHeadingPaddingM,
      axisHeadingColor,
      axisHeadingScale,
    });
  }
  return frames;
}

export function resolveSceneSectionWindow(this: any,
  style: EditableStyle,
  bounds: THREE.Box3,
): ResolvedSceneSectionWindow | null {
  const frames = this.resolveSceneSectionFrames(style, bounds).filter(
    (frame: ResolvedSceneSectionFrame) =>
      frame.axis === "x" || frame.axis === "y",
  );
  if (frames.length === 0) return null;
  const preferredAxis =
    style.sceneSectionWindowActiveAxis === "x" ||
    style.sceneSectionWindowActiveAxis === "y"
      ? style.sceneSectionWindowActiveAxis
      : style.sceneSectionActiveAxis === "x" ||
          style.sceneSectionActiveAxis === "y"
        ? style.sceneSectionActiveAxis
        : null;
  const frame =
    (preferredAxis ? frameForAxis(frames, preferredAxis) : null) ?? frames[0];
  return {
    axis: frame.axis as Exclude<SceneSectionAxis, "z">,
    minAlongM: frame.minAM,
    maxAlongM: frame.maxAM,
    bottomElevationM: frame.minBM,
    alongIndex: frame.axisAIndex as 0 | 1,
  };
}

export function sceneSectionFrameClippingPlanes(this: any,
  frame: ResolvedSceneSectionFrame | null,
): THREE.Plane[] {
  if (!frame) return [];
  return [
    new THREE.Plane(frame.axisAVector.clone(), -frame.minAM),
    new THREE.Plane(frame.axisAVector.clone().multiplyScalar(-1), frame.maxAM),
    new THREE.Plane(frame.axisBVector.clone(), -frame.minBM),
    new THREE.Plane(frame.axisBVector.clone().multiplyScalar(-1), frame.maxBM),
  ];
}

export function sceneSectionFrameForObject(this: any,
  layerId: string,
  obj: THREE.Object3D,
  frames: ResolvedSceneSectionFrame[],
): ResolvedSceneSectionFrame | null {
  if (frames.length === 0) return null;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return null;
  }
  if (layerId !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return null;
  const overlayFrameId =
    typeof obj.userData?.sectionIsoFrameId === "string"
      ? obj.userData.sectionIsoFrameId
      : null;
  if (overlayFrameId) {
    return (
      frames.find(
        (frame: ResolvedSceneSectionFrame) => frame.frameId === overlayFrameId,
      ) ?? null
    );
  }
  const overlayAxis =
    typeof obj.userData?.sectionIsoPlaneAxis === "string"
      ? (obj.userData.sectionIsoPlaneAxis as SceneSectionAxis)
      : null;
  if (
    obj.userData?.scalarSectionIsoOverlay === true &&
    (overlayAxis === "x" || overlayAxis === "y" || overlayAxis === "z")
  ) {
    return frameForAxis(frames, overlayAxis);
  }
  if (
    obj.userData?.resistivitySlicePreview !== true ||
    obj.userData?.resistivitySliceKind !== "vertical-section"
  ) {
    return null;
  }
  const sectionLine = (
    obj.userData.resistivitySlice as
      | { sectionLine?: { orientation?: unknown } }
      | undefined
  )?.sectionLine;
  const axis =
    sectionLine?.orientation === "east-west"
      ? "y"
      : sectionLine?.orientation === "north-south"
        ? "x"
        : null;
  return axis ? frameForAxis(frames, axis) : null;
}

export function setSceneSectionUniforms(this: any, 
  material: THREE.ShaderMaterial,
  planes: ResolvedSceneSectionPlane[],
  visibility: SceneSectionObjectVisibility,
  frames: ResolvedSceneSectionFrame[],
  maskTransition?: SceneSectionMaskTransition | null,
): void {
  const uniforms = material.uniforms;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  if (maskTransition) {
    planes = maskTransition.source.planes;
    visibility = maskTransition.source.visibility;
    frames = maskTransition.source.frames;
  }
  const targeted = visibility.active;
  const activeFrames = targeted
    ? frames.slice(0, SCENE_SECTION_MAX_FRAME_COUNT)
    : [];
  ensure<number>("uSceneSectionTransitionEnabled", 0).value = maskTransition
    ? 1
    : 0;
  ensure<number>("uSceneSectionTransitionProgress", 0).value = clamp01(
    maskTransition?.progress ?? 0,
  );
  ensure<number>("uSceneSectionEnabled", 0).value =
    targeted && (planes.length > 0 || activeFrames.length > 0) ? 1 : 0;
  ensure<number>("uSceneSectionMode", 0).value = 0;
  ensure<number>("uSceneSectionPlaneCount", 0).value = targeted
    ? Math.min(SCENE_SECTION_MAX_FRAME_COUNT, planes.length)
    : 0;
  const normalUniform = ensure<THREE.Vector3[]>("uSceneSectionNormals", [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const positionUniform = ensure<number[]>(
    "uSceneSectionPositions",
    [0, 0, 0, 0, 0, 0, 0, 0],
  );
  const thicknessUniform = ensure<number[]>(
    "uSceneSectionThickness",
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  const invertUniform = ensure<number[]>(
    "uSceneSectionInvert",
    [0, 0, 0, 0, 0, 0, 0, 0],
  );
  const normals = normalUniform.value;
  const positions = positionUniform.value;
  const thickness = thicknessUniform.value;
  const invert = invertUniform.value;
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const plane = planes[i];
    if (!normals[i]) normals[i] = new THREE.Vector3();
    normals[i].copy(plane?.normal ?? new THREE.Vector3());
    positions[i] = plane?.signedDistanceM ?? 0;
    thickness[i] = 1;
    invert[i] = plane?.invert ? 1 : 0;
  }
  const planeOpacityUniform = ensure<number[]>(
    "uSceneSectionPlaneOutsideOpacity",
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const plane = planes[i];
    planeOpacityUniform.value[i] = plane
      ? clamp01(
          visibility.outsideOpacityByFrameId[plane.frameId] ??
            visibility.outsideOpacityByAxis[plane.axis] ??
            1,
        )
      : 1;
  }
  ensure<number>("uSceneSectionFrameCount", 0).value = activeFrames.length;
  const frameAxisAUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionFrameAxisA",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector3()),
  );
  const frameAxisBUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionFrameAxisB",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector3()),
  );
  const frameBoundsUniform = ensure<THREE.Vector4[]>(
    "uSceneSectionFrameBounds",
    [
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
      new THREE.Vector4(),
    ],
  );
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const frame = activeFrames[i];
    if (!frameAxisAUniform.value[i]) {
      frameAxisAUniform.value[i] = new THREE.Vector3();
    }
    if (!frameAxisBUniform.value[i]) {
      frameAxisBUniform.value[i] = new THREE.Vector3();
    }
    frameAxisAUniform.value[i].copy(frame?.axisAVector ?? new THREE.Vector3(1, 0, 0));
    frameAxisBUniform.value[i].copy(frame?.axisBVector ?? new THREE.Vector3(0, 1, 0));
    if (!frameBoundsUniform.value[i]) {
      frameBoundsUniform.value[i] = new THREE.Vector4();
    }
    frameBoundsUniform.value[i].set(
      frame?.minAM ?? -250_000,
      frame?.maxAM ?? 250_000,
      frame?.minBM ?? -250_000,
      frame?.maxBM ?? 250_000,
    );
  }
  const frameOpacityUniform = ensure<number[]>(
    "uSceneSectionFrameOutsideOpacity",
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const frame = activeFrames[i];
    frameOpacityUniform.value[i] = frame
      ? clamp01(
          visibility.outsideOpacityByFrameId[frame.frameId] ??
            visibility.outsideOpacityByAxis[frame.axis] ??
            1,
        )
      : 1;
  }
  const targetVisibility = maskTransition?.target.visibility ?? visibility;
  const targetPlanes = maskTransition?.target.planes ?? [];
  const targetFrames =
    targetVisibility.active && maskTransition
      ? maskTransition.target.frames.slice(0, SCENE_SECTION_MAX_FRAME_COUNT)
      : [];
  ensure<number>("uSceneSectionTargetPlaneCount", 0).value =
    maskTransition && targetVisibility.active
      ? Math.min(SCENE_SECTION_MAX_FRAME_COUNT, targetPlanes.length)
      : 0;
  const targetNormalUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionTargetNormals",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector3()),
  );
  const targetPositionUniform = ensure<number[]>(
    "uSceneSectionTargetPositions",
    [0, 0, 0, 0, 0, 0, 0, 0],
  );
  const targetInvertUniform = ensure<number[]>(
    "uSceneSectionTargetInvert",
    [0, 0, 0, 0, 0, 0, 0, 0],
  );
  const targetPlaneOpacityUniform = ensure<number[]>(
    "uSceneSectionTargetPlaneOutsideOpacity",
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const plane = targetPlanes[i];
    if (!targetNormalUniform.value[i]) {
      targetNormalUniform.value[i] = new THREE.Vector3();
    }
    targetNormalUniform.value[i].copy(plane?.normal ?? new THREE.Vector3());
    targetPositionUniform.value[i] = plane?.signedDistanceM ?? 0;
    targetInvertUniform.value[i] = plane?.invert ? 1 : 0;
    targetPlaneOpacityUniform.value[i] = plane
      ? clamp01(
          targetVisibility.outsideOpacityByFrameId[plane.frameId] ??
            targetVisibility.outsideOpacityByAxis[plane.axis] ??
            1,
        )
      : 1;
  }
  ensure<number>("uSceneSectionTargetFrameCount", 0).value =
    targetFrames.length;
  const targetFrameAxisAUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionTargetFrameAxisA",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector3()),
  );
  const targetFrameAxisBUniform = ensure<THREE.Vector3[]>(
    "uSceneSectionTargetFrameAxisB",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector3()),
  );
  const targetFrameBoundsUniform = ensure<THREE.Vector4[]>(
    "uSceneSectionTargetFrameBounds",
    Array.from({ length: SCENE_SECTION_MAX_FRAME_COUNT }, () => new THREE.Vector4()),
  );
  const targetFrameOpacityUniform = ensure<number[]>(
    "uSceneSectionTargetFrameOutsideOpacity",
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  for (let i = 0; i < SCENE_SECTION_MAX_FRAME_COUNT; i += 1) {
    const frame = targetFrames[i];
    if (!targetFrameAxisAUniform.value[i]) {
      targetFrameAxisAUniform.value[i] = new THREE.Vector3();
    }
    if (!targetFrameAxisBUniform.value[i]) {
      targetFrameAxisBUniform.value[i] = new THREE.Vector3();
    }
    targetFrameAxisAUniform.value[i].copy(
      frame?.axisAVector ?? new THREE.Vector3(1, 0, 0),
    );
    targetFrameAxisBUniform.value[i].copy(
      frame?.axisBVector ?? new THREE.Vector3(0, 1, 0),
    );
    if (!targetFrameBoundsUniform.value[i]) {
      targetFrameBoundsUniform.value[i] = new THREE.Vector4();
    }
    targetFrameBoundsUniform.value[i].set(
      frame?.minAM ?? -250_000,
      frame?.maxAM ?? 250_000,
      frame?.minBM ?? -250_000,
      frame?.maxBM ?? 250_000,
    );
    targetFrameOpacityUniform.value[i] = frame
      ? clamp01(
          targetVisibility.outsideOpacityByFrameId[frame.frameId] ??
            targetVisibility.outsideOpacityByAxis[frame.axis] ??
            1,
        )
      : 1;
  }
  const legacyFrame = activeFrames.find(
    (frame) => frame.axis === "x" || frame.axis === "y",
  );
  ensure<number>("uSceneSectionWindowEnabled", 0).value =
    legacyFrame ? 1 : 0;
  ensure<number>("uSceneSectionWindowAxis", 0).value =
    legacyFrame?.axis === "y" ? 1 : 0;
  ensure<number>("uSceneSectionWindowMinAlong", -250_000).value =
    legacyFrame?.minAM ?? -250_000;
  ensure<number>("uSceneSectionWindowMaxAlong", 250_000).value =
    legacyFrame?.maxAM ?? 250_000;
  ensure<number>("uSceneSectionWindowBottomZ", -250_000).value =
    legacyFrame?.minBM ?? -250_000;
}

export function applySceneSectionMaterial(this: any, 
  material: THREE.Material,
  planes: ResolvedSceneSectionPlane[],
  visibility: SceneSectionObjectVisibility,
  clippingPlanes: THREE.Plane[],
  frames: ResolvedSceneSectionFrame[],
  frameClippingPlanes: THREE.Plane[],
  maskTransition?: SceneSectionMaskTransition | null,
): void {
  if (material.userData?.sceneSectionHelper === true) return;
  const affectedAxes = new Set<SceneSectionAxis>([
    ...planes.map((plane) => plane.axis),
    ...frames.map((frame) => frame.axis),
  ]);
  const affectedFrameIds = [
    ...planes.map((plane) => plane.frameId),
    ...frames.map((frame) => frame.frameId),
  ];
  const sectionAffectsMaterial =
    affectedFrameIds.some(
      (frameId) => (visibility.outsideOpacityByFrameId[frameId] ?? 1) < 0.999,
    ) ||
    Array.from(affectedAxes).some(
      (axis) => (visibility.outsideOpacityByAxis[axis] ?? 1) < 0.999,
    );
  const transitionAffectsMaterial =
    !!maskTransition &&
    (maskTransition.source.visibility.active ||
      maskTransition.target.visibility.active) &&
    (maskTransition.source.planes.length > 0 ||
      maskTransition.source.frames.length > 0 ||
      maskTransition.target.planes.length > 0 ||
      maskTransition.target.frames.length > 0) &&
    (Object.values(maskTransition.source.visibility.outsideOpacityByAxis).some(
      (opacity) => opacity < 0.999,
    ) ||
      Object.values(
        maskTransition.source.visibility.outsideOpacityByFrameId,
      ).some((opacity) => opacity < 0.999) ||
      Object.values(maskTransition.target.visibility.outsideOpacityByAxis).some(
        (opacity) => opacity < 0.999,
      ) ||
      Object.values(
        maskTransition.target.visibility.outsideOpacityByFrameId,
      ).some((opacity) => opacity < 0.999));
  const effectiveSectionAffectsMaterial =
    sectionAffectsMaterial || transitionAffectsMaterial;
  const requiresShaderVisibility =
    effectiveSectionAffectsMaterial &&
    (maskTransition ||
      affectedFrameIds.some(
        (frameId) =>
          (visibility.outsideOpacityByFrameId[frameId] ?? 1) > 0.001,
      ) ||
      Array.from(affectedAxes).some(
        (axis) => (visibility.outsideOpacityByAxis[axis] ?? 1) > 0.001,
      ));
  const seismicShader =
    material instanceof THREE.ShaderMaterial &&
    (material.userData?.seismicRaymarchMaterial === true ||
      material.userData?.seismicSectionMaterial === true ||
      material.userData?.scalarVolumeRaymarchMaterial === true);
  const terrainShader =
    material instanceof THREE.ShaderMaterial &&
    material.userData?.terrainMaterial === true;
  if (terrainShader) {
    if (maskTransition) {
      this.setSceneSectionUniforms(material, planes, visibility, frames, maskTransition);
    } else {
      this.setSceneSectionUniforms(material, planes, visibility, frames);
    }
    material.needsUpdate = true;
    return;
  }
  if (seismicShader) {
    this.setSceneSectionUniforms(material, planes, visibility, frames, maskTransition);
    setSceneSectionObjectVisibilityUniforms(
      material.uniforms,
      effectiveSectionAffectsMaterial,
      planes,
      frames,
      visibility,
      maskTransition,
    );
    material.needsUpdate = true;
    return;
  }
  const active = effectiveSectionAffectsMaterial;
  const publicSurfaceClipPlanes = Array.isArray(
    material.userData?.publicSurfaceClipPlanes,
  )
    ? (material.userData.publicSurfaceClipPlanes as THREE.Plane[])
    : [];
  if (requiresShaderVisibility) {
    applySceneSectionObjectVisibilityBuiltInMaterial(
      material,
      true,
      planes,
      frames,
      visibility,
      maskTransition,
    );
    material.clippingPlanes =
      publicSurfaceClipPlanes.length > 0 ? publicSurfaceClipPlanes : null;
    material.clipIntersection = false;
    material.needsUpdate = true;
    return;
  }
  if (material.userData?.sceneSectionObjectVisibilityPatched === true) {
    applySceneSectionObjectVisibilityBuiltInMaterial(
      material,
      false,
      planes,
      frames,
      visibility,
      maskTransition,
    );
  }
  const combinedPlanes = [
    ...publicSurfaceClipPlanes,
    ...(active ? clippingPlanes : []),
    ...(active ? frameClippingPlanes : []),
  ];
  material.clippingPlanes = combinedPlanes.length > 0 ? combinedPlanes : null;
  material.clipIntersection = false;
  material.needsUpdate = true;
}

export function interpolatedSceneSectionStyle(this: any, 
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  amount: number,
): EditableStyle {
  const t = clamp01(amount);
  const next: EditableStyle = { ...toStyle };
  const axes: SceneSectionAxis[] = ["x", "y", "z"];
  const fromPlanes = fromStyle.sceneSectionPlanes ?? {};
  const toPlanes = toStyle.sceneSectionPlanes ?? {};
  const sceneSectionPlanes: NonNullable<EditableStyle["sceneSectionPlanes"]> =
    { ...toPlanes };

  for (const axis of axes) {
    const fromPlane = fromPlanes[axis];
    const toPlane = toPlanes[axis];
    if (
      typeof fromPlane?.positionM === "number" &&
      Number.isFinite(fromPlane.positionM) &&
      typeof toPlane?.positionM === "number" &&
      Number.isFinite(toPlane.positionM)
    ) {
      sceneSectionPlanes[axis] = {
        ...toPlane,
        positionM:
          fromPlane.positionM + (toPlane.positionM - fromPlane.positionM) * t,
      };
    }
  }
  next.sceneSectionPlanes = sceneSectionPlanes;

  const fromWindowByAxis = fromStyle.sceneSectionWindowByAxis ?? {};
  const toWindowByAxis = toStyle.sceneSectionWindowByAxis ?? {};
  const windowByAxis: NonNullable<EditableStyle["sceneSectionWindowByAxis"]> =
    { ...toWindowByAxis };
  for (const axis of axes) {
    const fromWindow = fromWindowByAxis[axis];
    const toWindow = toWindowByAxis[axis];
    if (!toWindow) continue;
    const nextWindow = { ...toWindow };
    for (const key of [
      "minAlongM",
      "maxAlongM",
      "bottomElevationM",
    ] as const) {
      const from = fromWindow?.[key];
      const to = toWindow[key];
      if (
        typeof from === "number" &&
        Number.isFinite(from) &&
        typeof to === "number" &&
        Number.isFinite(to)
      ) {
        nextWindow[key] = from + (to - from) * t;
      }
    }
    windowByAxis[axis] = nextWindow;
  }
  next.sceneSectionWindowByAxis = windowByAxis;

  const fromFrameByAxis = fromStyle.sceneSectionFrameByAxis ?? {};
  const toFrameByAxis = toStyle.sceneSectionFrameByAxis ?? {};
  const frameByAxis: NonNullable<EditableStyle["sceneSectionFrameByAxis"]> =
    { ...toFrameByAxis };
  for (const axis of axes) {
    const fromFrame = fromFrameByAxis[axis];
    const toFrame = toFrameByAxis[axis];
    if (!toFrame) continue;
    const nextFrame = { ...toFrame };
    for (const key of [
      "minAM",
      "maxAM",
      "minBM",
      "maxBM",
      "axisIntervalM",
      "axisTextScale",
      "axisTextPaddingM",
      "axisHeadingPaddingM",
      "axisHeadingScale",
      "groundTraceWidthM",
    ] as const) {
      const from = fromFrame?.[key];
      const to = toFrame[key];
      if (
        typeof from === "number" &&
        Number.isFinite(from) &&
        typeof to === "number" &&
        Number.isFinite(to)
      ) {
        nextFrame[key] = from + (to - from) * t;
      }
    }
    frameByAxis[axis] = nextFrame;
  }
  next.sceneSectionFrameByAxis = frameByAxis;
  if (Array.isArray(toStyle.sceneSectionFrames)) {
    const fromEntries = new Map(
      sceneSectionResolvedFrameEntries(fromStyle).map((entry) => [
        entry.id,
        entry,
      ]),
    );
    next.sceneSectionFrames = toStyle.sceneSectionFrames.map((entry) => {
      const fromEntry = fromEntries.get(entry.id);
      const nextPlane = { ...(entry.plane ?? {}) };
      const fromPosition = fromEntry?.plane?.positionM;
      const toPosition = entry.plane?.positionM;
      if (
        typeof fromPosition === "number" &&
        Number.isFinite(fromPosition) &&
        typeof toPosition === "number" &&
        Number.isFinite(toPosition)
      ) {
        nextPlane.positionM = fromPosition + (toPosition - fromPosition) * t;
      }
      const nextFrame = { ...(entry.frame ?? {}) };
      for (const key of [
        "minAM",
        "maxAM",
        "minBM",
        "maxBM",
        "axisIntervalM",
        "axisTextScale",
        "axisTextPaddingM",
        "axisHeadingPaddingM",
        "axisHeadingScale",
        "groundTraceWidthM",
      ] as const) {
        const from = fromEntry?.frame?.[key];
        const to = entry.frame?.[key];
        if (
          typeof from === "number" &&
          Number.isFinite(from) &&
          typeof to === "number" &&
          Number.isFinite(to)
        ) {
          nextFrame[key] = from + (to - from) * t;
        }
      }
      return {
        ...entry,
        plane: nextPlane,
        frame: nextFrame,
      };
    });
  }
  next.sceneSectionObjectVisibilityByAxis =
    interpolatedSceneSectionObjectVisibilityByAxis(fromStyle, toStyle, t);
  next.sceneSectionObjectVisibilityByFrameId =
    interpolatedSceneSectionObjectVisibilityByFrameId(fromStyle, toStyle, t);
  return next;
}

export function currentSceneSectionStyle(this: any, nowMs = performance.now()): EditableStyle {
  const tween = this.sceneSectionStyleTween;
  if (!tween) return this.styleForLayer(UTAH_FORGE_SCENE_SECTION_LAYER_ID);
  const t =
    tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
  if (t >= 1 || tween.discreteChanged) return tween.toStyle;
  return this.interpolatedSceneSectionStyle(
    tween.fromStyle,
    tween.toStyle,
    easeProgress(t, tween.easing),
  );
}

function sceneSectionReferenceHelperVisible(
  style: EditableStyle,
  editorMode: boolean,
): boolean {
  const helperVisible =
    typeof style.sceneSectionHelperVisible === "boolean"
      ? style.sceneSectionHelperVisible
      : editorMode;
  return (
    helperVisible ||
    style.sceneSectionGroundTraceVisible === true ||
    style.sceneSectionAxesVisible === true ||
    style.sceneSectionFrameEnabled === true ||
    style.sceneSectionWindowEnabled === true ||
    style.sectionIsoEnabled === true
  );
}

function sceneSectionHelperActiveForStyle(
  style: EditableStyle,
  editorMode: boolean,
): boolean {
  return (
    style.sceneSectionEnabled === true &&
    sceneSectionReferenceHelperVisible(style, editorMode)
  );
}

export function sceneSectionHelperSnapshotAllowedForTween(
  this: any,
  tween: SceneSectionStyleTween,
): boolean {
  const sourceActive = sceneSectionHelperActiveForStyle(
    tween.fromStyle,
    this.editorMode,
  );
  const targetActive = sceneSectionHelperActiveForStyle(
    tween.toStyle,
    this.editorMode,
  );
  return targetActive && sourceActive && tween.discreteChanged === true;
}

export function sceneSectionHelperOpacityForTween(this: any, 
  tween: SceneSectionStyleTween,
  eased: number,
): number {
  const fromActive = sceneSectionHelperActiveForStyle(
    tween.fromStyle,
    this.editorMode,
  );
  const toActive = sceneSectionHelperActiveForStyle(
    tween.toStyle,
    this.editorMode,
  );
  if (fromActive && toActive && tween.discreteChanged) return clamp01(eased);
  if (!fromActive && toActive) return clamp01(eased);
  if (fromActive && !toActive) return 0;
  return 1;
}

export function sceneSectionMaskTransitionForTween(
  this: any,
  tween: SceneSectionStyleTween,
  eased: number,
): SceneSectionStyleMaskTransition {
  return {
    fromStyle: tween.fromStyle,
    toStyle: tween.toStyle,
    progress: clamp01(eased),
  };
}

export function applySceneSectionHelperTransitionOpacity(this: any): void {
  const runtime = this.sceneSectionRuntime;
  if (!runtime?.group.visible) return;
  const opacity = clamp01(this.sceneSectionHelperTransitionOpacity);
  runtime.group.traverse((obj: THREE.Object3D) => {
    const mat = (obj as { material?: THREE.Material | THREE.Material[] })
      .material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const material of mats) {
      if (material.userData?.sceneSectionHelper !== true) continue;
      if (
        obj.userData?.scalarSectionIsoOverlay === true ||
        material.userData?.scalarSectionIsoOverlay === true
      ) {
        this.applySectionIsoHelperTransitionOpacity?.(material, opacity);
        continue;
      }
      const baseOpacity = this.baseOpacityForMaterial(material);
      material.opacity = baseOpacity * opacity;
      material.transparent =
        material.userData?.forceTransparent === true ||
        material.opacity < 0.999;
      if (
        material instanceof THREE.ShaderMaterial &&
        material.uniforms.uOpacity
      ) {
        material.uniforms.uOpacity.value = material.opacity;
      }
      material.needsUpdate = true;
    }
  });
}

const sceneSectionTextWorldPosition = new THREE.Vector3();
const sceneSectionTextToCamera = new THREE.Vector3();

export function updateSceneSectionPlanarTextFacing(
  this: any,
  camera: THREE.Camera,
): void {
  const runtime = this.sceneSectionRuntime;
  if (!runtime?.group.visible) return;
  runtime.group.traverse((obj: THREE.Object3D) => {
    if (obj.userData?.sceneSectionPlanarText !== true) return;
    const baseQuaternion = obj.userData.sceneSectionBaseQuaternion;
    const planeNormal = obj.userData.sceneSectionPlaneNormal;
    if (
      !(baseQuaternion instanceof THREE.Quaternion) ||
      !(planeNormal instanceof THREE.Vector3)
    ) {
      return;
    }
    obj.quaternion.copy(baseQuaternion);
    obj.getWorldPosition(sceneSectionTextWorldPosition);
    sceneSectionTextToCamera
      .copy(camera.position)
      .sub(sceneSectionTextWorldPosition);
    if (sceneSectionTextToCamera.dot(planeNormal) < 0) {
      obj.rotateY(Math.PI);
    }
  });
}

export function sceneSectionBounds(this: any, 
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): THREE.Box3 {
  const box = new THREE.Box3();
  for (const [layerId, group] of this.layers) {
    if (!group.visible) continue;
    group.updateMatrixWorld(true);
    group.traverse((obj: THREE.Object3D) => {
      if (!obj.visible || obj.userData?.sceneSectionHelper === true) return;
      if (
        !this.sceneSectionObjectTargeted(
          layerId,
          obj,
          style,
          layerTargets,
          productTargets,
        )
      ) {
        return;
      }
      const candidate = obj as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        isMesh?: boolean;
        isLine?: boolean;
        isPoints?: boolean;
      };
      if (
        !candidate.geometry &&
        candidate.isMesh !== true &&
        candidate.isLine !== true &&
        candidate.isPoints !== true
      ) {
        return;
      }
      const objectBox = new THREE.Box3().setFromObject(obj);
      if (!objectBox.isEmpty()) box.union(objectBox);
    });
  }
  if (!box.isEmpty()) return box;
  const fallback = new THREE.Box3();
  for (const group of this.layers.values()) {
    if (!group.visible) continue;
    const groupBox = new THREE.Box3().setFromObject(group);
    if (!groupBox.isEmpty()) fallback.union(groupBox);
  }
  if (!fallback.isEmpty()) return fallback;
  return new THREE.Box3(
    new THREE.Vector3(-14_000, -14_000, -8_000),
    new THREE.Vector3(2_000, -6_000, 2_000),
  );
}

export function createSceneSectionLabel(this: any, text: string, color: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 136;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 42px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(6, 9, 12, 0.82)";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      SCENE_SECTION_LABEL_WIDTH_M,
      SCENE_SECTION_LABEL_HEIGHT_M,
    ),
    material,
  );
  mesh.name = text;
  mesh.userData.sceneSectionHelper = true;
  mesh.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
  return mesh;
}

export function createSceneSectionScaleLabel(this: any,
  text: string,
  textScale = SCENE_SECTION_AXIS_TEXT_SCALE_DEFAULT,
  color = SCENE_SECTION_AXIS_HEADING_COLOR_DEFAULT,
): THREE.Mesh {
  const scale = clampRange(
    textScale,
    SCENE_SECTION_AXIS_TEXT_SCALE_MIN,
    SCENE_SECTION_AXIS_TEXT_SCALE_MAX,
  );
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 32px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.94,
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(620 * scale, 180 * scale),
    material,
  );
  mesh.userData.sceneSectionHelper = true;
  mesh.userData.sceneSectionScaleLabel = true;
  mesh.userData.sceneSectionAxisTextScale = scale;
  mesh.userData.sceneSectionLabelColor = color;
  mesh.renderOrder = SCENE_SECTION_RENDER_ORDER + 3;
  return mesh;
}

function makeSceneSectionPlanarTextCameraAware(
  obj: THREE.Object3D,
  baseQuaternion: THREE.Quaternion,
  planeNormal: THREE.Vector3,
): void {
  obj.quaternion.copy(baseQuaternion);
  obj.userData.sceneSectionPlanarText = true;
  obj.userData.sceneSectionBaseQuaternion = baseQuaternion.clone();
  obj.userData.sceneSectionPlaneNormal = planeNormal.clone().normalize();
}

export function ensureSceneSectionRuntime(this: any): SceneSectionRuntime {
  if (this.sceneSectionRuntime) return this.sceneSectionRuntime;
  const group = new THREE.Group();
  group.name = "__scene_section_planes__";
  group.visible = false;
  group.userData.sceneSectionHelper = true;
  this.scene.add(group);
  this.sceneSectionRuntime = {
    group,
    pickables: [],
    planes: new Map(),
  };
  return this.sceneSectionRuntime;
}

export function rebuildSceneSectionHelpers(this: any,
  style: EditableStyle,
  planes: ResolvedSceneSectionPlane[],
  layerTargets: Set<string>,
  productTargets: Set<string>,
): void {
  const runtime = this.ensureSceneSectionRuntime();
  while (runtime.group.children.length > 0) {
    const child = runtime.group.children[0];
    runtime.group.remove(child);
    disposeObjectTree(child);
  }
  runtime.pickables = [];
  runtime.planes.clear();

  const helperVisible =
    typeof style.sceneSectionHelperVisible === "boolean"
      ? style.sceneSectionHelperVisible
      : this.editorMode;
  const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
  const size = bounds.getSize(new THREE.Vector3());
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const activeFrameId =
    typeof style.sceneSectionActiveFrameId === "string" &&
    style.sceneSectionActiveFrameId.trim()
      ? style.sceneSectionActiveFrameId
      : sceneSectionBuiltInFrameId(activeAxis);
  const activePlaneFrameIds = new Set(
    planes.map((plane: ResolvedSceneSectionPlane) => plane.frameId),
  );
  const sectionFrames = this
    .resolveSceneSectionFrames(style, bounds)
    .filter((frame: ResolvedSceneSectionFrame) =>
      activePlaneFrameIds.has(frame.frameId),
    );
  const showGroundTrace = sectionFrames.some(
    (frame: ResolvedSceneSectionFrame) => frame.groundTraceVisible,
  );
  const showAxes = sectionFrames.some(
    (frame: ResolvedSceneSectionFrame) => frame.axesVisible,
  );
  const frameIntersectionTraces = sectionFrameIntersectionTraces(
    planes,
    sectionFrames,
  );
  const showFrameIntersections =
    style.sectionIsoEnabled === true && frameIntersectionTraces.length > 0;
  runtime.group.visible =
    style.sceneSectionEnabled === true &&
    (helperVisible || showGroundTrace || showAxes || showFrameIntersections) &&
    planes.length > 0;
  if (!runtime.group.visible) return;

  const sectionVisuals = sceneSectionVisualSettings.call(this);
  const referenceOutlineWidthM = sceneSectionVisualOutlineWidthM(
    Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      size.y * SCENE_SECTION_HELPER_PADDING,
    ),
    Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      size.z * SCENE_SECTION_HELPER_PADDING,
    ),
    sectionVisuals,
  );

  if (showFrameIntersections) {
    const traceGroup = new THREE.Group();
    traceGroup.name = "Section ISO frame intersections";
    traceGroup.userData.sceneSectionHelper = true;
    traceGroup.userData.sceneSectionIsoIntersectionTrace = true;
    runtime.group.add(traceGroup);
    const addTraceLine = (
      trace: SceneSectionFrameIntersectionTrace,
      start: THREE.Vector3,
      end: THREE.Vector3,
    ) => {
      if (
        start.distanceToSquared(end) <
        SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M *
          SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M
      ) {
        return;
      }
      const material = makeSceneSectionIntersectionDashMaterial();
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        material,
      );
      line.name = `${trace.axes[0].toUpperCase()}/${trace.axes[1].toUpperCase()} dashed section ISO intersection`;
      line.userData.sceneSectionHelper = true;
      line.userData.sceneSectionIsoIntersectionTrace = true;
      line.userData.sceneSectionIntersectionAxes = trace.axes;
      line.userData.sceneSectionFreeAxisIndex = trace.freeAxisIndex;
      line.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
      line.computeLineDistances();
      traceGroup.add(line);
    };
    for (const trace of frameIntersectionTraces) {
      if (trace.trimToGround) {
        withSceneSectionHeightSampler((sampleHeight) => {
          if (!traceGroup.parent) return;
          const origin = this.siteSurfaceGuideOrigin(
            this.layers.get(this.topoSurfaceLayerId()),
          );
          const x = trace.start.x;
          const y = trace.start.y;
          const minZ = Math.min(trace.start.z, trace.end.z);
          const maxZ = Math.max(trace.start.z, trace.end.z);
          const groundZ = this.siteGuideSurfaceZ(
            x,
            y,
            sampleHeight,
            origin,
            26,
          );
          const clippedMaxZ = Math.min(maxZ, groundZ);
          if (clippedMaxZ - minZ < SCENE_SECTION_SURFACE_TRACE_MIN_SEGMENT_M) {
            return;
          }
          addTraceLine(
            trace,
            new THREE.Vector3(x, y, minZ),
            new THREE.Vector3(x, y, clippedMaxZ),
          );
        });
      } else {
        addTraceLine(trace, trace.start, trace.end);
      }
    }
  }

  for (const plane of planes) {
    const spec = SCENE_SECTION_AXIS_SPECS[plane.axis];
    const color = spec.color;
    const frame =
      sectionFrames.find(
        (candidate: ResolvedSceneSectionFrame) =>
          candidate.frameId === plane.frameId,
      ) ?? null;
    const tangentA = frame?.axisAVector.clone() ?? plane.axisAVector.clone();
    const tangentB = frame?.axisBVector.clone() ?? plane.axisBVector.clone();
    const rawWidth = frame
      ? frame.maxAM - frame.minAM
      : size.getComponent(spec.frameAIndex);
    const rawHeight = frame
      ? frame.maxBM - frame.minBM
      : size.getComponent(spec.frameBIndex);
    const paddedWidth = Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      rawWidth * SCENE_SECTION_HELPER_PADDING,
    );
    const paddedHeight = Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      rawHeight * SCENE_SECTION_HELPER_PADDING,
    );
    const halfWidth = paddedWidth * 0.5;
    const halfHeight = paddedHeight * 0.5;
    const planeCenter = frame?.center.clone() ?? plane.point.clone();
    const basisNormal = plane.normal.clone().normalize();
    const planeBasis = new THREE.Matrix4().makeBasis(
      tangentA,
      tangentB,
      basisNormal,
    );
    const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      planeBasis,
    );

    const minLocalA = frame
      ? frame.minAM - planeCenter.dot(tangentA)
      : -halfWidth;
    const maxLocalA = frame
      ? frame.maxAM - planeCenter.dot(tangentA)
      : halfWidth;
    const minLocalB = frame
      ? frame.minBM - planeCenter.dot(tangentB)
      : -halfHeight;
    const maxLocalB = frame
      ? frame.maxBM - planeCenter.dot(tangentB)
      : halfHeight;
    const frameCenterLocal = new THREE.Vector3(
      (minLocalA + maxLocalA) * 0.5,
      (minLocalB + maxLocalB) * 0.5,
      0,
    );

    const frameControlsVisible = frame?.controlsVisible !== false;
    const frameOutlineVisible =
      frame !== null &&
      frameControlsVisible &&
      style.sceneSectionFrameEnabled === true;
    const controlHandlesVisible = helperVisible && frameControlsVisible;
    if (frameOutlineVisible || controlHandlesVisible) {
      const controlGroup = new THREE.Group();
      controlGroup.name = `${plane.label} push/pull controls`;
      controlGroup.position.copy(planeCenter);
      controlGroup.quaternion.copy(planeQuaternion);
      controlGroup.userData.sceneSectionHelper = true;
      controlGroup.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;

      const outlineWidthM = referenceOutlineWidthM;
      const outlineGeometry = buildSceneSectionOutlineGeometry(
        minLocalA,
        maxLocalA,
        minLocalB,
        maxLocalB,
        outlineWidthM,
      );
      const outlineOpacity = frame
        ? plane.frameId === activeFrameId
          ? 1
          : 0.82
        : plane.frameId === activeFrameId
          ? 1
          : 0.76;
      const outlineMaterial = makeSceneSectionOutlineMaterial(
        color,
        outlineOpacity,
      );
      if (frameOutlineVisible) {
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.name = frame
          ? plane.label
          : `${plane.label} outline`;
        outline.castShadow = false;
        outline.receiveShadow = false;
        outline.userData.sceneSectionHelper = true;
        outline.userData.sceneSectionOutline = true;
        outline.userData.sceneSectionFrameOutline = frame !== null;
        outline.userData.sceneSectionAxis = plane.axis;
        outline.userData.sceneSectionFrameId = plane.frameId;
        outline.userData.sceneSectionPlaneCoordinateIndex = spec.positionIndex;
        outline.userData.sceneSectionPlanePositionM = plane.positionM;
        outline.userData.sceneSectionPlaneSignedDistanceM = plane.signedDistanceM;
        outline.userData.sceneSectionFrameColor = color;
        outline.userData.sceneSectionFrameLineWidthM = outlineWidthM;
        outline.userData.sceneSectionFrameBounds = frame
          ? {
              minAM: frame.minAM,
              maxAM: frame.maxAM,
              minBM: frame.minBM,
              maxBM: frame.maxBM,
              axisAIndex: frame.axisAIndex,
              axisBIndex: frame.axisBIndex,
              axisAVector: frame.axisAVector.toArray(),
              axisBVector: frame.axisBVector.toArray(),
            }
          : null;
        outline.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;
        controlGroup.add(outline);
      }

      if (controlHandlesVisible) {
        const handleSpan = clampRange(
          Math.min(paddedWidth, paddedHeight) * 0.16,
          SCENE_SECTION_HANDLE_MIN_SPAN_M,
          SCENE_SECTION_HANDLE_MAX_SPAN_M,
        );
        const coneLength =
          clampRange(
            handleSpan * sectionVisuals.arrowSpanScale,
            sectionVisuals.arrowMinLengthM,
            sectionVisuals.arrowMaxLengthM,
          ) *
          SCENE_SECTION_CONE_VISUAL_SCALE;
        const coneRadius = coneLength * sectionVisuals.arrowRadiusScale;
        const arrowSpan = coneLength * sectionVisuals.arrowGapScale;
        const preservedPickRadius =
          coneRadius *
          (SCENE_SECTION_HANDLE_VISUAL_SCALE / SCENE_SECTION_CONE_VISUAL_SCALE) *
          1.8;
        const pickSize = Math.max(
          SCENE_SECTION_WINDOW_HANDLE_RADIUS_M * SCENE_SECTION_HANDLE_VISUAL_SCALE,
          preservedPickRadius,
        ) * 3;
        const makeDoubleArrowHandle = (
          kind: "push-pull" | SceneSectionWindowHandleKind,
          name: string,
          position: THREE.Vector3,
          localDirection: THREE.Vector3,
          direction?: 1 | -1,
        ): THREE.Group => {
          const group = new THREE.Group();
          group.name = `${name} visual`;
          group.position.copy(position);
          group.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            localDirection.clone().normalize(),
          );
          group.userData.sceneSectionHelper = true;
          group.userData.sceneSectionPlaneHandle = true;
          group.userData.sceneSectionAxis = plane.axis;
          group.userData.sceneSectionFrameId = plane.frameId;
          group.userData.sceneSectionPlaneHandleKind = kind;
          group.userData.sceneSectionHandleVisual = "double-arrow";
          group.userData.sceneSectionHandleScale =
            SCENE_SECTION_HANDLE_VISUAL_SCALE;
          group.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;

          const material = makeSceneSectionConeMaterial(color, outlineOpacity);

          const coneGeometry = new THREE.ConeGeometry(
            coneRadius,
            coneLength,
            18,
            1,
            true,
          );
          coneGeometry.computeVertexNormals();
          const topCone = new THREE.Mesh(coneGeometry, material);
          topCone.position.y = arrowSpan * 0.5;
          topCone.castShadow = false;
          topCone.receiveShadow = false;
          topCone.userData.sceneSectionHelper = true;
          topCone.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;
          const bottomCone = new THREE.Mesh(coneGeometry.clone(), material);
          bottomCone.position.y = -arrowSpan * 0.5;
          bottomCone.rotation.z = Math.PI;
          bottomCone.castShadow = false;
          bottomCone.receiveShadow = false;
          bottomCone.userData.sceneSectionHelper = true;
          bottomCone.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;
          group.add(topCone, bottomCone);

          const pickMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
            fog: false,
          });
          pickMaterial.userData.sceneSectionHelper = true;
          const pickProxy = new THREE.Mesh(
            new THREE.BoxGeometry(pickSize, pickSize, pickSize),
            pickMaterial,
          );
          pickProxy.name = name;
          pickProxy.userData.sceneSectionHelper = true;
          pickProxy.userData.sceneSectionPlaneHandle = true;
          pickProxy.userData.sceneSectionAxis = plane.axis;
          pickProxy.userData.sceneSectionFrameId = plane.frameId;
          pickProxy.userData.sceneSectionPlaneHandleKind = kind;
          pickProxy.userData.sceneSectionHandleVisual = "double-arrow";
          pickProxy.userData.sceneSectionHandleScale =
            SCENE_SECTION_HANDLE_VISUAL_SCALE;
          pickProxy.userData.sceneSectionPickProxy = true;
          pickProxy.userData.sceneSectionPickRadius = pickSize * 0.5;
          if (direction) {
            pickProxy.userData.sceneSectionPlaneHandleDirection = direction;
          }
          pickProxy.renderOrder = SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER;
          group.add(pickProxy);
          runtime.pickables.push(pickProxy);
          return group;
        };

        controlGroup.add(
          makeDoubleArrowHandle(
            "push-pull",
            `${plane.axis.toUpperCase()} Section push/pull handle`,
            new THREE.Vector3(frameCenterLocal.x, frameCenterLocal.y, 0),
            new THREE.Vector3(0, 0, 1),
          ),
        );

        if (frame) {
          const midA = (minLocalA + maxLocalA) * 0.5;
          const midB = (minLocalB + maxLocalB) * 0.5;
          controlGroup.add(
            makeDoubleArrowHandle(
              "frame-min-a",
              `${plane.axis.toUpperCase()} Section frame-min-a handle`,
              new THREE.Vector3(minLocalA, midB, 0),
              new THREE.Vector3(1, 0, 0),
            ),
            makeDoubleArrowHandle(
              "frame-max-a",
              `${plane.axis.toUpperCase()} Section frame-max-a handle`,
              new THREE.Vector3(maxLocalA, midB, 0),
              new THREE.Vector3(1, 0, 0),
            ),
            makeDoubleArrowHandle(
              "frame-min-b",
              `${plane.axis.toUpperCase()} Section frame-min-b handle`,
              new THREE.Vector3(midA, minLocalB, 0),
              new THREE.Vector3(0, 1, 0),
            ),
            makeDoubleArrowHandle(
              "frame-max-b",
              `${plane.axis.toUpperCase()} Section frame-max-b handle`,
              new THREE.Vector3(midA, maxLocalB, 0),
              new THREE.Vector3(0, 1, 0),
            ),
          );
        }
      }

      if (controlGroup.children.length > 0) {
        runtime.group.add(controlGroup);
        runtime.planes.set(plane.frameId, controlGroup);
      }

      if (controlHandlesVisible) {
        const label = this.createSceneSectionLabel(
          plane.label.replace(/\s*frame$/i, ""),
          color,
        );
        label.position
          .copy(planeCenter)
          .addScaledVector(
            tangentA,
            halfWidth -
              SCENE_SECTION_LABEL_INSET_M -
              SCENE_SECTION_LABEL_WIDTH_M * 0.5,
          )
          .addScaledVector(
            tangentB,
            halfHeight -
              SCENE_SECTION_LABEL_INSET_M -
              SCENE_SECTION_LABEL_HEIGHT_M * 0.5,
          );
        label.quaternion.copy(planeQuaternion);
        runtime.group.add(label);
      }
    }

    if (frame && frame.axesVisible) {
      const origin = this.siteSurfaceGuideOrigin(
        this.layers.get(this.topoSurfaceLayerId()),
      );
      const axisATicks = sceneSectionAxisTicks(
        frame.minAM,
        frame.maxAM,
        frame.axisIntervalM,
        sceneSectionAxisTickOffset(frame, tangentA, origin),
      );
      const axisBTicks = sceneSectionAxisTicks(
        frame.minBM,
        frame.maxBM,
        frame.axisIntervalM,
        sceneSectionAxisTickOffset(frame, tangentB, origin),
      );
      const tickLength = clampRange(
        referenceOutlineWidthM * sectionVisuals.axisTickLengthScale,
        sectionVisuals.axisTickMinLengthM,
        sectionVisuals.axisTickMaxLengthM,
      );
      const axisPoints: THREE.Vector3[] = [
        planeCenter
          .clone()
          .addScaledVector(tangentA, minLocalA)
          .addScaledVector(tangentB, minLocalB),
        planeCenter
          .clone()
          .addScaledVector(tangentA, maxLocalA)
          .addScaledVector(tangentB, minLocalB),
        planeCenter
          .clone()
          .addScaledVector(tangentA, minLocalA)
          .addScaledVector(tangentB, minLocalB),
        planeCenter
          .clone()
          .addScaledVector(tangentA, minLocalA)
          .addScaledVector(tangentB, maxLocalB),
      ];
      for (const along of axisATicks) {
        const localA = along - planeCenter.dot(tangentA);
        axisPoints.push(
          planeCenter
            .clone()
            .addScaledVector(tangentA, localA)
            .addScaledVector(tangentB, minLocalB - tickLength * 0.5),
          planeCenter
            .clone()
            .addScaledVector(tangentA, localA)
            .addScaledVector(tangentB, minLocalB + tickLength * 0.5),
        );
      }
      for (const along of axisBTicks) {
        const localB = along - planeCenter.dot(tangentB);
        axisPoints.push(
          planeCenter
            .clone()
            .addScaledVector(tangentA, minLocalA - tickLength * 0.5)
            .addScaledVector(tangentB, localB),
          planeCenter
            .clone()
            .addScaledVector(tangentA, minLocalA + tickLength * 0.5)
            .addScaledVector(tangentB, localB),
        );
      }

      const axisMaterial = new THREE.LineBasicMaterial({
        color: "#f8f4e8",
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      hardenStudioHelperMaterial(axisMaterial);
      axisMaterial.userData.sceneSectionHelper = true;
      const axisLine = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(axisPoints),
        axisMaterial,
      );
      axisLine.name = `${plane.axis.toUpperCase()} section scale axes`;
      axisLine.userData.sceneSectionHelper = true;
      axisLine.userData.sceneSectionScaleAxes = true;
      axisLine.userData.sceneSectionAxisIntervalM = frame.axisIntervalM;
      axisLine.userData.sceneSectionAxisTextScale = frame.axisTextScale;
      axisLine.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;
      runtime.group.add(axisLine);

      const axisBHeadingQuaternion = planeQuaternion.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          Math.PI / 2,
        ),
      );
      const axisALabelOffsetM = frame.axisTextPaddingM;
      const axisBLabelOffsetM = frame.axisTextPaddingM;
      const axisAHeading = this.createSceneSectionScaleLabel(
        frame.axisAHeading,
        frame.axisHeadingScale,
        frame.axisHeadingColor,
      );
      axisAHeading.name = `${plane.axis.toUpperCase()} section ${frame.axisAHeading} heading`;
      axisAHeading.position
        .copy(planeCenter)
        .addScaledVector(tangentA, (minLocalA + maxLocalA) * 0.5)
        .addScaledVector(tangentB, minLocalB - frame.axisHeadingPaddingM);
      makeSceneSectionPlanarTextCameraAware(
        axisAHeading,
        planeQuaternion,
        basisNormal,
      );
      runtime.group.add(axisAHeading);

      const axisBHeading = this.createSceneSectionScaleLabel(
        frame.axisBHeading,
        frame.axisHeadingScale,
        frame.axisHeadingColor,
      );
      axisBHeading.name = `${plane.axis.toUpperCase()} section ${frame.axisBHeading} heading`;
      axisBHeading.position
        .copy(planeCenter)
        .addScaledVector(tangentA, minLocalA - frame.axisHeadingPaddingM)
        .addScaledVector(tangentB, (minLocalB + maxLocalB) * 0.5);
      makeSceneSectionPlanarTextCameraAware(
        axisBHeading,
        axisBHeadingQuaternion,
        basisNormal,
      );
      runtime.group.add(axisBHeading);

      for (const along of axisATicks) {
        const labelPosition = planeCenter
          .clone()
          .addScaledVector(tangentA, along - planeCenter.dot(tangentA))
          .addScaledVector(tangentB, minLocalB - axisALabelOffsetM);
        const labelMesh = this.createSceneSectionScaleLabel(
          sceneSectionAxisValueLabelForPoint(
            frame,
            tangentA,
            along,
            labelPosition,
            origin,
          ),
          frame.axisTextScale,
        );
        labelMesh.position.copy(labelPosition);
        makeSceneSectionPlanarTextCameraAware(
          labelMesh,
          planeQuaternion,
          basisNormal,
        );
        runtime.group.add(labelMesh);
      }
      for (const along of axisBTicks) {
        const labelPosition = planeCenter
          .clone()
          .addScaledVector(tangentA, minLocalA - axisBLabelOffsetM)
          .addScaledVector(tangentB, along - planeCenter.dot(tangentB));
        const labelMesh = this.createSceneSectionScaleLabel(
          sceneSectionAxisValueLabelForPoint(
            frame,
            tangentB,
            along,
            labelPosition,
            origin,
          ),
          frame.axisTextScale,
        );
        labelMesh.position.copy(labelPosition);
        makeSceneSectionPlanarTextCameraAware(
          labelMesh,
          planeQuaternion,
          basisNormal,
        );
        runtime.group.add(labelMesh);
      }
    }

    if (frame && frame.groundTraceVisible && plane.axis !== "z") {
      const traceGroup = new THREE.Group();
      traceGroup.name = `${plane.axis.toUpperCase()} section ground trace`;
      traceGroup.userData.sceneSectionHelper = true;
      runtime.group.add(traceGroup);
      const origin = this.siteSurfaceGuideOrigin(
        this.layers.get(this.topoSurfaceLayerId()),
      );
      withSceneSectionHeightSampler((sampleHeight) => {
        const snapshotTargetActive =
          this.sceneSectionHelperTransitionSnapshot !== null;
        if (!traceGroup.parent && !snapshotTargetActive) return;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < SCENE_SECTION_GROUND_TRACE_SAMPLES; i += 1) {
          const t = i / (SCENE_SECTION_GROUND_TRACE_SAMPLES - 1);
          const along = frame.minAM + (frame.maxAM - frame.minAM) * t;
          const basePoint = planeCenter
            .clone()
            .addScaledVector(tangentA, along - planeCenter.dot(tangentA));
          const x = basePoint.x;
          const y = basePoint.y;
          points.push(
            new THREE.Vector3(
              x,
              y,
              this.siteGuideSurfaceZ(x, y, sampleHeight, origin, 26),
            ),
          );
        }
        const geometry = buildSceneSectionDashedTraceRibbonGeometry(
          points,
          frame.groundTraceWidthM,
          basisNormal,
        );
        if (!geometry) return;
        const mesh = new THREE.Mesh(
          geometry,
          makeSceneSectionTraceRibbonMaterial(),
        );
        mesh.name = `${plane.axis.toUpperCase()} dashed ground intersection`;
        mesh.userData.sceneSectionHelper = true;
        mesh.userData.sceneSectionGroundTrace = true;
        mesh.userData.sceneSectionGroundTraceWidthM = frame.groundTraceWidthM;
        mesh.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
        const addToLiveTrace = !!traceGroup.parent;
        if (addToLiveTrace) {
          traceGroup.add(mesh);
        }
        const addedToSnapshot =
          this.addSceneSectionHelperObjectToTransitionSnapshot?.(mesh) === true;
        if (!addToLiveTrace && !addedToSnapshot) {
          disposeObjectTree(mesh);
        }
      });
    }
  }
}

function resolveSceneSectionMaskContext(this: any, style: EditableStyle) {
  const planes = this.sceneSectionActivePlanes(style);
  const layerTargets = this.sceneSectionLayerIds(style);
  const productTargets = this.sceneSectionProductIds(style);
  const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
  const activePlaneFrameIds = new Set(
    planes.map((plane: ResolvedSceneSectionPlane) => plane.frameId),
  );
  const frames = this
    .resolveSceneSectionFrames(style, bounds)
    .filter((frame: ResolvedSceneSectionFrame) =>
      activePlaneFrameIds.has(frame.frameId),
    );
  return {
    style,
    planes,
    frames,
    layerTargets,
    productTargets,
  };
}

export function applySceneSectionPlanes(
  this: any,
  style: EditableStyle,
  options?: SceneSectionApplyTransitionFrameOptions,
): void {
  const startedAt = performance.now();
  let stageStart = startedAt;
  this.lastSceneSectionStyle = style;
  const planes = this.sceneSectionActivePlanes(style);
  const clippingPlanes = this.sceneSectionClippingPlanes(planes);
  const layerTargets = this.sceneSectionLayerIds(style);
  const productTargets = this.sceneSectionProductIds(style);
  const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
  const boundsMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();
  const activePlaneFrameIds = new Set(
    planes.map((plane: ResolvedSceneSectionPlane) => plane.frameId),
  );
  const sectionFrames = this
    .resolveSceneSectionFrames(style, bounds)
    .filter((frame: ResolvedSceneSectionFrame) =>
      activePlaneFrameIds.has(frame.frameId),
    );
  this.sceneSectionClippingActive =
    planes.length > 0 || sectionFrames.length > 0;
  this.updateRendererLocalClipping();
  const frameResolveMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();

  const labelAnchorPoint = new THREE.Vector3();
  const allFrameClippingPlanes = sectionFrames.flatMap(
    (frame: ResolvedSceneSectionFrame) =>
      this.sceneSectionFrameClippingPlanes(frame),
  );
  const sourceMaskContext = options?.maskTransition
    ? resolveSceneSectionMaskContext.call(this, options.maskTransition.fromStyle)
    : null;
  const targetMaskContext = options?.maskTransition
    ? resolveSceneSectionMaskContext.call(this, options.maskTransition.toStyle)
    : null;
  let traversedObjectCount = 0;
  let materialApplyCount = 0;
  for (const [layerId, group] of this.layers) {
    group.traverse((obj: THREE.Object3D) => {
      traversedObjectCount += 1;
      const visibility = this.sceneSectionObjectVisibilityForObject(
        layerId,
        obj,
        style,
        layerTargets,
        productTargets,
      );
      const frameClippingPlanes = visibility.active
        ? allFrameClippingPlanes
        : [];
      const hardPlanes = planes.filter(
        (plane: ResolvedSceneSectionPlane) =>
          (visibility.outsideOpacityByFrameId[plane.frameId] ??
            visibility.outsideOpacityByAxis[plane.axis] ??
            1) <= 0.001,
      );
      const hardPlaneClippingPlanes = this.sceneSectionClippingPlanes(hardPlanes);
      const hardFrameClippingPlanes = sectionFrames
        .filter(
          (frame: ResolvedSceneSectionFrame) =>
            (visibility.outsideOpacityByFrameId[frame.frameId] ??
              visibility.outsideOpacityByAxis[frame.axis] ??
              1) <= 0.001,
        )
        .flatMap((frame: ResolvedSceneSectionFrame) =>
          this.sceneSectionFrameClippingPlanes(frame),
        );
      const materialMaskTransition =
        sourceMaskContext && targetMaskContext && options?.maskTransition
          ? {
              progress: options.maskTransition.progress,
              source: {
                planes: sourceMaskContext.planes,
                frames: sourceMaskContext.frames,
                visibility: this.sceneSectionObjectVisibilityForObject(
                  layerId,
                  obj,
                  sourceMaskContext.style,
                  sourceMaskContext.layerTargets,
                  sourceMaskContext.productTargets,
                ),
              },
              target: {
                planes: targetMaskContext.planes,
                frames: targetMaskContext.frames,
                visibility: this.sceneSectionObjectVisibilityForObject(
                  layerId,
                  obj,
                  targetMaskContext.style,
                  targetMaskContext.layerTargets,
                  targetMaskContext.productTargets,
                ),
              },
            } satisfies SceneSectionMaskTransition
          : null;
      updateSceneSectionLabelCullState(
        obj,
        visibility.active,
        materialMaskTransition ? [] : hardPlaneClippingPlanes,
        materialMaskTransition ? [] : hardFrameClippingPlanes,
        labelAnchorPoint,
      );
      const material = (
        obj as { material?: THREE.Material | THREE.Material[] }
      ).material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        materialApplyCount += 1;
        this.applySceneSectionMaterial(
          m,
          planes,
          visibility,
          clippingPlanes,
          sectionFrames,
          frameClippingPlanes,
          materialMaskTransition,
        );
      }
    });
  }
  const materialApplyMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();
  if (!options?.transitionFrame) {
    this.rebuildSceneSectionHelpers(
      style,
      planes,
      layerTargets,
      productTargets,
    );
  }
  const helperRebuildMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();
  this.applySceneSectionHelperTransitionOpacity();
  const helperOpacityMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();
  if (!options?.transitionFrame) {
    this.updateMtVolumeCutIsoOverlays(
      this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID),
    );
  }
  const mtCutIsoUpdate = options?.transitionFrame
    ? null
    : this.lastMtVolumeCutIsoUpdateDebug ?? null;
  const mtCutIsoMs = transitionDebugMs(performance.now() - stageStart);
  stageStart = performance.now();
  if (!options?.transitionFrame) {
    this.updateSeismicVolumeCutIsoOverlays(
      this.styleForLayer(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID),
    );
  }
  const seismicCutIsoMs = transitionDebugMs(performance.now() - stageStart);
  let helperObjectCount = 0;
  this.sceneSectionRuntime?.group.traverse(() => {
    helperObjectCount += 1;
  });
  this.lastSceneSectionApplyDebug = {
    totalMs: transitionDebugMs(performance.now() - startedAt),
    boundsMs,
    frameResolveMs,
    materialApplyMs,
    helperRebuildMs,
    helperOpacityMs,
    mtCutIsoMs,
    mtCutIsoUpdate,
    seismicCutIsoMs,
    traversedObjectCount,
    materialApplyCount,
    helperObjectCount,
  };
}

export function reapplySceneSectionPlanes(this: any): void {
  if (this.sceneSectionReapplySuspended) return;
  this.applySceneSectionPlanes(this.currentSceneSectionStyle());
}

export function listSceneSectionPlanePickables(this: any): THREE.Object3D[] {
  const runtime = this.sceneSectionRuntime;
  return runtime?.group.visible ? runtime.pickables : [];
}

export function getSceneSectionPlanePosition(this: any, axis: SceneSectionAxis, frameId?: string): THREE.Vector3 | null {
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const obj =
    this.sceneSectionRuntime?.planes.get(targetFrameId) ??
    this.sceneSectionRuntime?.planes.get(axis);
  return obj ? obj.position.clone() : null;
}

export function getSceneSectionPlaneScalar(this: any, axis: SceneSectionAxis, frameId?: string): number | null {
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const plane = this.resolveSceneSectionPlanes(
    this.lastSceneSectionStyle,
  ).find(
    (candidate: ResolvedSceneSectionPlane) =>
      candidate.frameId === targetFrameId || candidate.axis === axis,
  );
  return plane ? plane.positionM : null;
}

export function getSceneSectionPlaneNormal(this: any, axis: SceneSectionAxis, frameId?: string): THREE.Vector3 | null {
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const plane = this.resolveSceneSectionPlanes(
    this.lastSceneSectionStyle,
  ).find(
    (candidate: ResolvedSceneSectionPlane) =>
      candidate.frameId === targetFrameId || candidate.axis === axis,
  );
  return plane ? plane.normal.clone() : null;
}

export function getSceneSectionWindowValue(this: any, 
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
  frameId?: string,
): number | null {
  const bounds = this.sceneSectionBounds(
    this.lastSceneSectionStyle,
    this.sceneSectionLayerIds(this.lastSceneSectionStyle),
    this.sceneSectionProductIds(this.lastSceneSectionStyle),
  );
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const frame = this
    .resolveSceneSectionFrames(
    {
      ...this.lastSceneSectionStyle,
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: targetFrameId,
      sceneSectionFrameEnabled: true,
    },
    bounds,
    )
    .find(
      (candidate: ResolvedSceneSectionFrame) =>
        candidate.frameId === targetFrameId || candidate.axis === axis,
    );
  if (!frame) return null;
  const frameKind = frameKindForHandle(kind);
  if (frameKind === "minA") return frame.minAM;
  if (frameKind === "maxA") return frame.maxAM;
  if (frameKind === "maxB") return frame.maxBM;
  return frame.minBM;
}

export function getSceneSectionWindowNormal(this: any,
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
  frameId?: string,
): THREE.Vector3 | null {
  const bounds = this.sceneSectionBounds(
    this.lastSceneSectionStyle,
    this.sceneSectionLayerIds(this.lastSceneSectionStyle),
    this.sceneSectionProductIds(this.lastSceneSectionStyle),
  );
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const frame = this
    .resolveSceneSectionFrames(
    {
      ...this.lastSceneSectionStyle,
      sceneSectionActiveAxis: axis,
      sceneSectionActiveFrameId: targetFrameId,
      sceneSectionFrameEnabled: true,
    },
    bounds,
    )
    .find(
      (candidate: ResolvedSceneSectionFrame) =>
        candidate.frameId === targetFrameId || candidate.axis === axis,
    );
  if (!frame) return null;
  const frameKind = frameKindForHandle(kind);
  return frameKind === "minA" || frameKind === "maxA"
    ? frame.axisAVector.clone()
    : frame.axisBVector.clone();
}

export function previewSceneSectionPlane(this: any, axis: SceneSectionAxis, positionM: number, frameId?: string): void {
  const style = this.lastSceneSectionStyle;
  const planes = style.sceneSectionPlanes ?? {};
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const isBuiltIn = targetFrameId === sceneSectionBuiltInFrameId(axis);
  const frameList = sceneSectionFrameListWithPatch(style, targetFrameId, axis, {
    plane: {
      enabled: true,
      positionM,
    },
  });
  this.applySceneSectionPlanes({
    ...style,
    sceneSectionEnabled: true,
    sceneSectionActiveAxis: axis,
    sceneSectionActiveFrameId: targetFrameId,
    sceneSectionFrames: frameList,
    sceneSectionPlanes: isBuiltIn
      ? {
          ...planes,
          [axis]: {
            ...(planes[axis] ?? {}),
            enabled: true,
            positionM,
          },
        }
      : planes,
  });
}

export function previewSceneSectionWindow(this: any, 
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
  valueM: number,
  frameId?: string,
): void {
  const style = this.lastSceneSectionStyle;
  const frameByAxis = style.sceneSectionFrameByAxis ?? {};
  const targetFrameId = frameId ?? sceneSectionBuiltInFrameId(axis);
  const currentEntry = sceneSectionResolvedFrameEntries(style).find(
    (entry) => entry.id === targetFrameId,
  );
  const currentFrame =
    currentEntry?.frame ??
    frameByAxis[axis] ??
    {};
  const legacyByAxis = style.sceneSectionWindowByAxis ?? {};
  const patch =
    frameKindForHandle(kind) === "minA"
      ? { minAM: valueM }
      : frameKindForHandle(kind) === "maxA"
        ? { maxAM: valueM }
        : frameKindForHandle(kind) === "maxB"
          ? { maxBM: valueM }
          : { minBM: valueM };
  const nextFrame = {
    ...currentFrame,
    enabled: true,
    ...patch,
  };
  const frameList = sceneSectionFrameListWithPatch(style, targetFrameId, axis, {
    frame: nextFrame,
  });
  const isBuiltIn = targetFrameId === sceneSectionBuiltInFrameId(axis);
  const legacyPatch =
    isBuiltIn && (axis === "x" || axis === "y")
      ? {
          sceneSectionWindowEnabled: true,
          sceneSectionWindowActiveAxis: axis,
          sceneSectionWindowByAxis: {
            ...legacyByAxis,
            [axis]: {
              ...(legacyByAxis[axis] ?? {}),
              minAlongM: nextFrame.minAM ?? legacyByAxis[axis]?.minAlongM,
              maxAlongM: nextFrame.maxAM ?? legacyByAxis[axis]?.maxAlongM,
              bottomElevationM:
                nextFrame.minBM ?? legacyByAxis[axis]?.bottomElevationM,
            },
          },
        }
      : {};
  this.applySceneSectionPlanes({
    ...style,
    sceneSectionEnabled: true,
    sceneSectionActiveAxis: axis,
    sceneSectionActiveFrameId: targetFrameId,
    sceneSectionFrameEnabled: true,
    sceneSectionFrames: frameList,
    sceneSectionFrameByAxis: isBuiltIn
      ? {
          ...frameByAxis,
          [axis]: {
            ...nextFrame,
          },
        }
      : frameByAxis,
    ...legacyPatch,
  });
}
