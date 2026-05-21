import * as THREE from "three";
import type {
  EditableStyle,
  AreaOutlineDef,
  EnvironmentSetup,
  EasingName,
  Pose,
  PresentationPage,
  SceneProperties,
  Vec3,
} from "../pages/types";
import {
  effectiveSceneOverlays,
  effectiveStyle,
  effectiveVisibility,
} from "../pages/effective";
import {
  activeRenderPresetIdForPage,
  projectRenderPresets,
  scenePatchForRenderPreset,
} from "../pages/renderPresets";
import type { PostHandle } from "./postprocessing";
import type { TerrainMaterialHandle } from "./terrainMaterial";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  disposeSceneOverlay,
  fadeSceneOverlayTo,
  loadSingleSceneOverlay,
  rebuildSceneOverlayGeometry,
  setSceneOverlayTint,
  tickSceneOverlayTweens,
  type SceneOverlayHandle,
} from "../loaders/loadSceneOverlays";
import { debugLog } from "../utils/debugLog";
import type { GeologyHandle } from "../loaders/loadGeology";
import {
  setDistanceAttenuatedLineWidth,
  setTerrainShadowInfluence,
  setTopoGraticuleEdgeFade,
} from "../loaders/topoLineMaterial";
import { getHeightSampler } from "./heightSampler";
import type { SceneOverlayDef } from "../pages/types";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../loaders/assayPalette";
import { SCENE_ORIGIN, utmToScene } from "../constants";
import { disposeObjectTree } from "./disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  UTAH_FORGE_DISCRETE_CROSSFADE_LAYER_IDS,
  UTAH_FORGE_GRATICULE_EDGE_STYLE_FIELDS,
} from "../projectModules/utahForge/crossfadeFields";

// Fade duration matches the markdown overlay panel (OverlayDisplay's
// FADE_MS) so chapter transitions feel coherent across UI surfaces.
const SCENE_OVERLAY_FADE_MS = 800;
const DEFAULT_LAYER_FADE_MS = 800;
const AREA_OUTLINE_RENDER_ORDER = 6.35;
const AREA_OUTLINE_DEFAULT_LIFT_M = 18;
const AREA_OUTLINE_SEGMENTS = 144;
const TOPO_DISTANCE_LINE_LAYER_IDS = [
  "hydrography-streams",
  "transport-roads",
  "power-lines",
] as const;
const PUBLIC_SURFACE_LAYER_IDS = new Set([
  "terrain",
  "utah-forge-topo-graticule",
  "transport-roads",
  "hydrography-streams",
  "hydrography-lakes",
]);
const PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS = 48;
const PUBLIC_SURFACE_CLIP_DEFAULTS = {
  centerX: 0,
  centerY: 0,
  centerZ: 2000,
  sizeX: 279_150,
  sizeY: 227_900,
  sizeZ: 8000,
  rotationZDeg: 0,
} as const;
const PUBLIC_SURFACE_CLIP_RENDER_ORDER = 4550;
const TOPO_MAP_BRANDING_DEFAULT_ANCHOR: TopoMapBrandingAnchor = "south-east";
const TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M = 0;
const TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M = -85_000;
const CASE_STUDY_B_DEMO_SHELL_LAYER_ID = "case-study-b-demo-shell";
const SHAHBAZI_GROUND_SURFACE_LAYER_ID = "shahbazi-tls-surface-preview";
const SHAHBAZI_GROUND_CONTOUR_LAYER_ID = "shahbazi-tls-contours";
const WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY = 0.15;
const WORKING_AREA_FOCUS_DEFAULT_BOUNDS = {
  min: new THREE.Vector3(-8041.4, -12617.6, -6200),
  max: new THREE.Vector3(-3841.4, -8417.6, 2045.3),
} as const;
const WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS = [
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  "utah-forge-mt-resistivity-preview",
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
] as const;
const WORKING_AREA_FOCUS_RENDER_ORDER = 4575;
const TOPO_GRATICULE_MINOR_SCALE = 0.8;
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
const SCENE_SECTION_DEFAULT_POSITIONS = {
  x: -6000,
  y: -10300,
  z: -2200,
} as const;
const SCENE_SECTION_RENDER_ORDER = 4560;
const SCENE_SECTION_MIN_HELPER_SIZE_M = 1200;
const SCENE_SECTION_HELPER_PADDING = 1.14;
const SCENE_SECTION_LABEL_WIDTH_M = 980;
const SCENE_SECTION_LABEL_HEIGHT_M = 260;
const SCENE_SECTION_LABEL_INSET_M = 180;
const SCENE_SECTION_HANDLE_MIN_SPAN_M = 360;
const SCENE_SECTION_HANDLE_MAX_SPAN_M = 1200;
const DEFAULT_SURFACE_GRADIENT_LOW_COLOR = "#2cc9ff";
const DEFAULT_SURFACE_GRADIENT_MID_COLOR = "#69f0b4";
const DEFAULT_SURFACE_GRADIENT_HIGH_COLOR = "#f8dd6d";
const DEFAULT_SCALAR_LOW_COLOR = "#2cc9ff";
const DEFAULT_SCALAR_MID_COLOR = "#f8dd6d";
const DEFAULT_SCALAR_HIGH_COLOR = "#ff637a";
const DEFAULT_SEISMIC_LOW_COLOR = "#2456c9";
const DEFAULT_SEISMIC_MID_COLOR = "#f4f7ff";
const DEFAULT_SEISMIC_HIGH_COLOR = "#d9362f";
const POINT_DISTANCE_LIGHT_NEAR_M = 0;
const POINT_DISTANCE_LIGHT_FAR_M = 180_000;
const SCALAR_LATERAL_SUPPORT_XY_BIN_M = 2500;
const SCALAR_LATERAL_SUPPORT_Z_BIN_M = 1200;
const SCALAR_EDGE_LINE_XY_BIN_M = 2600;
const SCALAR_EDGE_LINE_Z_BIN_M = 1300;
const SCALAR_EDGE_LINE_MIN_CELL_POINTS = 2;
const SECTION_ISO_RENDER_ORDER = 7.15;
const SECTION_ISO_LIFT_M = 18;
const SECTION_ISO_LINE_WIDTH_M_PER_PX = 45;
const SECTION_ISO_MAX_TRIANGLES = 24_000;
const SECTION_ISO_MAX_RIBBON_SEGMENTS = 24_000;
const MT_VOLUME_SECTION_ISO_GRID_SIZE = 96;
const DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M = 80;
const DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M = 420;
const DEFAULT_CONTOUR_FAR_LINE_SCALE = 0.28;
const DEFAULT_CONTOUR_FAR_OPACITY = 0.72;
const DEFAULT_CONTOUR_LIFT_M = 0;
const CASE_STUDY_B_DEMO_LAYER_ALIASES: Record<
  string,
  {
    all?: boolean;
    zoneIds?: readonly string[];
    objectNames?: readonly string[];
    applyColor?: boolean;
  }
> = {
  "quarry-imagery-base": {
    objectNames: ["case-study-b-demo-surface"],
    applyColor: true,
  },
  "quarry-lidar-surface": {
    objectNames: ["case-study-b-demo-grid"],
    applyColor: true,
  },
  "bench-conformance-overlay": {
    zoneIds: ["bench-walkthrough"],
    objectNames: ["case-study-b-demo-bench-lines"],
    applyColor: true,
  },
  "haul-route-equipment-demo": {
    objectNames: ["case-study-b-demo-haul-route"],
    applyColor: true,
  },
  "stockpile-volume-zones": {
    zoneIds: ["stockpile-volume-zone"],
    applyColor: true,
  },
  "quarry-drill-traces": {
    objectNames: ["case-study-b-demo-drill-traces"],
    applyColor: true,
  },
  "quarry-ore-grade-heatmap": {
    zoneIds: ["ore-grade-hotspot"],
    applyColor: true,
  },
  "slope-stability-anomaly": {
    zoneIds: ["slope-stability-anomaly"],
    applyColor: true,
  },
  "erosion-runoff-planning": {
    objectNames: ["case-study-b-demo-runoff-lines"],
    applyColor: true,
  },
  "restoration-preview": {
    zoneIds: ["restoration-preview"],
    applyColor: true,
  },
  "public-viewshed-overlay": {
    zoneIds: ["public-viewpoint"],
    applyColor: true,
  },
};
const STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M = 4200;
const STUDIO_HANDLE_MIN_SCALE = 0.55;
const STUDIO_HANDLE_MAX_SCALE = 7.5;
const ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M = 5200;
const ORBIT_CENTER_HANDLE_MIN_SCALE = 0.65;
const ORBIT_CENTER_HANDLE_MAX_SCALE = 1;
const DEFAULT_SCENE_FOG_DENSITY = 0.00018;
const LAYER_FOG_SHADER_KEY = "layer-fog-density:v1";

// Greyscale render-time overrides. When env.scene.lightMode === true
// these supplant the authored terrain ramp + fog/background colors.
// Values are picked to read with proper hillshade contrast against
// the existing sun direction; tweaks should keep the low/mid/high
// progression so elevation reads even without color.
const LIGHT_MODE_TERRAIN_RAMP_LOW = "#4a4a4a";
const LIGHT_MODE_TERRAIN_RAMP_MID = "#888888";
const LIGHT_MODE_TERRAIN_RAMP_HIGH = "#cccccc";
const LIGHT_MODE_BG = "#a0a0a0";
let rectAreaLightsReady = false;

// SceneManager. Owns lights, fog, post chain config, layer registry.
//
// Sky concept removed (Week 4 iteration #2): the entire frame now
// dissolves into a single neutral "fog/background" color -- no horizon,
// no gradient backdrop, no edges. Renderer clear color and FogExp2 share
// the same color. Sun direction still drives the key light + terrain
// hillshade; it just doesn't paint a sky any more.
//
// Sun direction can stay world/model anchored or follow the camera when
// env.scene.sun.lockToCamera is enabled. The same vector drives the key
// light and terrain hillshade.

const TONE_MAPPING_MAP: Record<
  NonNullable<SceneProperties["toneMapping"]>,
  THREE.ToneMapping
> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping,
};

function sunDirectionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const elev = THREE.MathUtils.degToRad(elevationDeg);
  const cosE = Math.cos(elev);
  return new THREE.Vector3(
    Math.sin(az) * cosE,
    Math.cos(az) * cosE,
    Math.sin(elev),
  );
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return typeof style.fogDensity === "number" &&
    Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

function isContourLikeLayerId(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.includes("contour") || lower.includes("isoline");
}

function mergeSceneProperties(
  base: SceneProperties | undefined,
  patch: Partial<SceneProperties> | null,
): SceneProperties {
  const scene = base ?? {};
  if (!patch) return scene;
  return {
    ...scene,
    ...patch,
    fog: { ...(scene.fog ?? {}), ...(patch.fog ?? {}) },
    bloom: { ...(scene.bloom ?? {}), ...(patch.bloom ?? {}) },
    camera: { ...(scene.camera ?? {}), ...(patch.camera ?? {}) },
    lighting: {
      ...(scene.lighting ?? {}),
      ...(patch.lighting ?? {}),
      hemisphere: {
        ...(scene.lighting?.hemisphere ?? {}),
        ...(patch.lighting?.hemisphere ?? {}),
      },
      directional: {
        ...(scene.lighting?.directional ?? {}),
        ...(patch.lighting?.directional ?? {}),
      },
      fill: {
        ...(scene.lighting?.fill ?? {}),
        ...(patch.lighting?.fill ?? {}),
      },
      rim: {
        ...(scene.lighting?.rim ?? {}),
        ...(patch.lighting?.rim ?? {}),
      },
    },
    ambientOcclusion: {
      ...(scene.ambientOcclusion ?? {}),
      ...(patch.ambientOcclusion ?? {}),
    },
    terrain: {
      ...(scene.terrain ?? {}),
      ...(patch.terrain ?? {}),
    },
    colorGrade: {
      ...(scene.colorGrade ?? {}),
      ...(patch.colorGrade ?? {}),
    },
    vignette: {
      ...(scene.vignette ?? {}),
      ...(patch.vignette ?? {}),
    },
    sun: { ...(scene.sun ?? {}), ...(patch.sun ?? {}) },
    gui: {
      ...(scene.gui ?? {}),
      ...(patch.gui ?? {}),
      labels: {
        ...(scene.gui?.labels ?? {}),
        ...(patch.gui?.labels ?? {}),
      },
    },
  };
}

function hasSurfaceGradientStyle(style: EditableStyle): boolean {
  return (
    typeof style.surfaceGradientLowColor === "string" ||
    typeof style.surfaceGradientMidColor === "string" ||
    typeof style.surfaceGradientHighColor === "string" ||
    typeof style.surfaceGradientMidpoint === "number" ||
    typeof style.surfaceGradientContrast === "number"
  );
}

function styleColor(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): THREE.Color {
  const color = new THREE.Color();
  const value = style[key];
  try {
    color.set(typeof value === "string" ? value : fallback);
  } catch {
    color.set(fallback);
  }
  return color;
}

function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value)
    ? clampRange(value, min, max)
    : fallback;
}

type TerrainEdgeFadeShape = "square" | "rounded-square" | "circle";

interface TerrainEdgeFadeState {
  boundsMin: THREE.Vector2;
  boundsMax: THREE.Vector2;
  shape: TerrainEdgeFadeShape;
  fadeDistanceM: number;
  insetM: number;
  cornerRadiusM: number;
}

interface TopoGraticuleLabelCandidate {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
}

interface TopoGraticuleSourceLine {
  kind: "lat" | "lon";
  value: number;
  preference: "west" | "north";
  candidates: TopoGraticuleLabelCandidate[];
}

interface TopoGraticuleLabelTarget {
  position: THREE.Vector3;
  anchor: THREE.Vector3;
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
  insideDistance: number;
  minor: boolean;
}

type TopoMapBrandingAnchor =
  | "south-west"
  | "south-east"
  | "north-west"
  | "north-east";

interface TopoMapBrandingTextMesh extends THREE.Mesh {
  userData: THREE.Mesh["userData"] & {
    topoMapBrandingTexture?: THREE.Texture;
  };
}

function terrainEdgeShape(
  shape: NonNullable<SceneProperties["terrain"]>["edgeFadeShape"],
): TerrainEdgeFadeShape {
  if (shape === "rounded-square" || shape === "circle") return shape;
  return "square";
}

function terrainEdgeInsideDistance(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
): number {
  const centerX = (edge.boundsMin.x + edge.boundsMax.x) * 0.5;
  const centerY = (edge.boundsMin.y + edge.boundsMax.y) * 0.5;
  const halfX = Math.max(
    1,
    (edge.boundsMax.x - edge.boundsMin.x) * 0.5 - edge.insetM,
  );
  const halfY = Math.max(
    1,
    (edge.boundsMax.y - edge.boundsMin.y) * 0.5 - edge.insetM,
  );
  const localX = point.x - centerX;
  const localY = point.y - centerY;
  if (edge.shape === "circle") {
    return Math.min(halfX, halfY) - Math.hypot(localX, localY);
  }
  if (edge.shape === "rounded-square") {
    const radius = clampRange(
      edge.cornerRadiusM,
      0,
      Math.max(0, Math.min(halfX, halfY) - 1),
    );
    const qx = Math.abs(localX) - (halfX - radius);
    const qy = Math.abs(localY) - (halfY - radius);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const inside = Math.min(Math.max(qx, qy), 0);
    return -(outside + inside - radius);
  }
  return Math.min(halfX - Math.abs(localX), halfY - Math.abs(localY));
}

function terrainEdgePreferenceScore(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
): number {
  const centerX = (edge.boundsMin.x + edge.boundsMax.x) * 0.5;
  const centerY = (edge.boundsMin.y + edge.boundsMax.y) * 0.5;
  return preference === "west" ? centerX - point.x : point.y - centerY;
}

function coerceVector3(value: unknown): THREE.Vector3 | null {
  if (value instanceof THREE.Vector3) return value.clone();
  const vector = value as { x?: unknown; y?: unknown; z?: unknown } | null;
  if (
    vector &&
    typeof vector.x === "number" &&
    typeof vector.y === "number" &&
    typeof vector.z === "number" &&
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  ) {
    return new THREE.Vector3(vector.x, vector.y, vector.z);
  }
  return null;
}

function topoGraticuleLabelCandidate(
  value: unknown,
): TopoGraticuleLabelCandidate | null {
  const position = coerceVector3(value);
  if (position) {
    return {
      position,
      tangent: new THREE.Vector3(1, 0, 0),
    };
  }
  const record = value as
    | { position?: unknown; tangent?: unknown }
    | null
    | undefined;
  const candidatePosition = coerceVector3(record?.position);
  if (!candidatePosition) return null;
  const tangent = coerceVector3(record?.tangent) ?? new THREE.Vector3(1, 0, 0);
  tangent.z = 0;
  if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
  else tangent.normalize();
  return {
    position: candidatePosition,
    tangent,
  };
}

function topoGraticuleSourceLine(value: unknown): TopoGraticuleSourceLine | null {
  const record = value as
    | {
        kind?: unknown;
        value?: unknown;
        preference?: unknown;
        candidates?: unknown;
      }
    | null
    | undefined;
  if (!record) return null;
  const kind = record.kind === "lat" ? "lat" : record.kind === "lon" ? "lon" : null;
  const valueNumber =
    typeof record.value === "number" && Number.isFinite(record.value)
      ? record.value
      : NaN;
  const preference =
    record.preference === "north"
      ? "north"
      : record.preference === "west"
        ? "west"
        : null;
  if (!kind || !preference || !Array.isArray(record.candidates)) return null;
  const candidates = record.candidates
    .map((candidate) => topoGraticuleLabelCandidate(candidate))
    .filter((candidate): candidate is TopoGraticuleLabelCandidate =>
      Boolean(candidate),
    );
  if (candidates.length < 2) return null;
  return { kind, value: valueNumber, preference, candidates };
}

function normalizeFullGroundTextAngle(angle: number): number {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

function topoGraticuleLineKey(
  kind: "lat" | "lon",
  value: number,
  preference: "west" | "north",
): string {
  const valueKey = Number.isFinite(value) ? value.toFixed(6) : "unknown";
  return `${kind}:${valueKey}:${preference}`;
}

function topoGraticuleLabelKey(obj: THREE.Object3D): string | null {
  const kind =
    obj.userData?.topoGraticuleLineKind === "lat"
      ? "lat"
      : obj.userData?.topoGraticuleLineKind === "lon"
        ? "lon"
        : null;
  const value = obj.userData?.topoGraticuleLineValue;
  const preference =
    obj.userData?.topoGraticuleLabelPreference === "north"
      ? "north"
      : obj.userData?.topoGraticuleLabelPreference === "west"
        ? "west"
        : null;
  if (!kind || !preference || typeof value !== "number") return null;
  return topoGraticuleLineKey(kind, value, preference);
}

function topoGraticuleIsHalfDegree(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const doubled = Math.abs(value) * 2;
  const rounded = Math.round(doubled);
  return Math.abs(doubled - rounded) < 0.0001 && rounded % 2 === 1;
}

function terrainEdgeStraightSideEligible(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
): boolean {
  if (edge.shape !== "rounded-square") return true;
  const centerX = (edge.boundsMin.x + edge.boundsMax.x) * 0.5;
  const centerY = (edge.boundsMin.y + edge.boundsMax.y) * 0.5;
  const halfX = Math.max(
    1,
    (edge.boundsMax.x - edge.boundsMin.x) * 0.5 - edge.insetM,
  );
  const halfY = Math.max(
    1,
    (edge.boundsMax.y - edge.boundsMin.y) * 0.5 - edge.insetM,
  );
  const radius = clampRange(
    edge.cornerRadiusM,
    0,
    Math.max(0, Math.min(halfX, halfY) - 1),
  );
  if (radius <= 0) return true;
  const localX = point.x - centerX;
  const localY = point.y - centerY;
  const tolerance = Math.max(2000, Math.min(edge.fadeDistanceM * 0.25, radius * 0.2));
  if (preference === "north") {
    return localY >= 0 && Math.abs(localX) <= halfX - radius + tolerance;
  }
  return localX <= 0 && Math.abs(localY) <= halfY - radius + tolerance;
}

function topoGraticuleReadableTangent(
  direction: THREE.Vector3,
  preference: "west" | "north",
): THREE.Vector3 {
  const readable = direction.clone();
  readable.z = 0;
  if (readable.lengthSq() <= 0.000001) {
    readable.set(preference === "north" ? 0 : 1, preference === "north" ? 1 : 0, 0);
  } else {
    readable.normalize();
  }
  if (preference === "north" && readable.y < 0) readable.multiplyScalar(-1);
  if (preference === "west" && readable.x < 0) readable.multiplyScalar(-1);
  return readable;
}

function topoGraticuleEdgeTextBasis(preference: "west" | "north"): {
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
} {
  return preference === "north"
    ? {
        tangent: new THREE.Vector3(0, 1, 0),
        outward: new THREE.Vector3(0, 1, 0),
      }
    : {
        tangent: new THREE.Vector3(1, 0, 0),
        outward: new THREE.Vector3(-1, 0, 0),
      };
}

function topoGraticuleReadableAngle(
  direction: THREE.Vector3,
  preference: "west" | "north",
): number {
  const tangent = topoGraticuleReadableTangent(direction, preference);
  return normalizeFullGroundTextAngle(Math.atan2(tangent.y, tangent.x));
}

function edgeOutwardLineTangent(
  candidate: TopoGraticuleLabelCandidate,
  edge: TerrainEdgeFadeState,
): THREE.Vector3 {
  const step = 1000;
  const plus = candidate.position
    .clone()
    .addScaledVector(candidate.tangent, step);
  const minus = candidate.position
    .clone()
    .addScaledVector(candidate.tangent, -step);
  const plusInside = terrainEdgeInsideDistance(plus, edge);
  const minusInside = terrainEdgeInsideDistance(minus, edge);
  const direction = candidate.tangent.clone();
  if (plusInside > minusInside) direction.multiplyScalar(-1);
  direction.z = 0;
  if (direction.lengthSq() <= 0.000001) direction.set(1, 0, 0);
  else direction.normalize();
  return direction;
}

interface PointDistanceLightShader {
  uniforms: Record<string, { value: number }>;
  vertexShader: string;
  fragmentShader: string;
}

interface WorkingAreaFocusShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function setWorkingAreaFocusShaderUniforms(
  uniforms: Record<string, { value: unknown }> | undefined,
  enabled: boolean,
  boundsMin: THREE.Vector3,
  boundsMax: THREE.Vector3,
  outsideOpacity: number,
): void {
  if (!uniforms) return;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  ensure<number>("uWorkingAreaFocusEnabled", 0).value = enabled ? 1 : 0;
  ensure<THREE.Vector3>(
    "uWorkingAreaFocusBoundsMin",
    new THREE.Vector3(),
  ).value.copy(boundsMin);
  ensure<THREE.Vector3>(
    "uWorkingAreaFocusBoundsMax",
    new THREE.Vector3(),
  ).value.copy(boundsMax);
  ensure<number>("uWorkingAreaFocusOutsideOpacity", 1).value =
    clamp01(outsideOpacity);
}

function applyWorkingAreaFocusBuiltInMaterial(
  material: THREE.Material,
  enabled: boolean,
  boundsMin: THREE.Vector3,
  boundsMax: THREE.Vector3,
  outsideOpacity: number,
): void {
  material.userData.workingAreaFocusEnabled = enabled;
  material.userData.workingAreaFocusBoundsMin = boundsMin.clone();
  material.userData.workingAreaFocusBoundsMax = boundsMax.clone();
  material.userData.workingAreaFocusOutsideOpacity = clamp01(outsideOpacity);

  if (material.userData.workingAreaFocusPatched !== true) {
    const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);
      const patchedShader = shader as WorkingAreaFocusShader;
      setWorkingAreaFocusShaderUniforms(
        patchedShader.uniforms,
        material.userData.workingAreaFocusEnabled === true,
        (material.userData.workingAreaFocusBoundsMin as THREE.Vector3) ??
          WORKING_AREA_FOCUS_DEFAULT_BOUNDS.min,
        (material.userData.workingAreaFocusBoundsMax as THREE.Vector3) ??
          WORKING_AREA_FOCUS_DEFAULT_BOUNDS.max,
        typeof material.userData.workingAreaFocusOutsideOpacity === "number"
          ? material.userData.workingAreaFocusOutsideOpacity
          : 1,
      );
      if (
        patchedShader.vertexShader.includes("void main() {") &&
        patchedShader.fragmentShader.includes("diffuseColor")
      ) {
        patchedShader.vertexShader = patchedShader.vertexShader.replace(
          "void main() {",
          [
            "varying vec3 vWorkingAreaFocusWorldPosition;",
            "void main() {",
            "  vWorkingAreaFocusWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
          ].join("\n"),
        );
        patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
          "void main() {",
          [
            "uniform int uWorkingAreaFocusEnabled;",
            "uniform vec3 uWorkingAreaFocusBoundsMin;",
            "uniform vec3 uWorkingAreaFocusBoundsMax;",
            "uniform float uWorkingAreaFocusOutsideOpacity;",
            "varying vec3 vWorkingAreaFocusWorldPosition;",
            "float workingAreaFocusAlpha(vec3 position) {",
            "  if (uWorkingAreaFocusEnabled == 0) return 1.0;",
            "  bool inside = all(greaterThanEqual(position, uWorkingAreaFocusBoundsMin)) && all(lessThanEqual(position, uWorkingAreaFocusBoundsMax));",
            "  return inside ? 1.0 : clamp(uWorkingAreaFocusOutsideOpacity, 0.0, 1.0);",
            "}",
            "void main() {",
          ].join("\n"),
        );
        const alphaPatch = [
          "float workingAreaFocusLayerAlpha = workingAreaFocusAlpha(vWorkingAreaFocusWorldPosition);",
          "diffuseColor.a *= workingAreaFocusLayerAlpha;",
          "if (diffuseColor.a <= 0.001) discard;",
        ].join("\n");
        if (
          patchedShader.fragmentShader.includes("#include <alphatest_fragment>")
        ) {
          patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
            "#include <alphatest_fragment>",
            `${alphaPatch}\n#include <alphatest_fragment>`,
          );
        } else {
          patchedShader.fragmentShader = patchedShader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `${alphaPatch}\n#include <dithering_fragment>`,
          );
        }
      }
      material.userData.workingAreaFocusShader = patchedShader;
    };
    material.customProgramCacheKey = () =>
      `${previousKey()}|geosee-working-area-focus-v1`;
    material.userData.workingAreaFocusPatched = true;
    material.needsUpdate = true;
  }

  const shader = material.userData.workingAreaFocusShader as
    | WorkingAreaFocusShader
    | undefined;
  if (shader) {
    setWorkingAreaFocusShaderUniforms(
      shader.uniforms,
      enabled,
      boundsMin,
      boundsMax,
      outsideOpacity,
    );
  }
}

function applyPointDistanceLightMaterial(
  material: THREE.PointsMaterial,
  strength: number,
): void {
  const clampedStrength = clamp01(strength);
  material.userData.pointDistanceLightStrength = clampedStrength;
  material.userData.pointDistanceLightNearM = POINT_DISTANCE_LIGHT_NEAR_M;
  material.userData.pointDistanceLightFarM = POINT_DISTANCE_LIGHT_FAR_M;

  if (material.userData.pointDistanceLightPatched !== true) {
    const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);
      const patchedShader = shader as PointDistanceLightShader;
      patchedShader.uniforms.uPointDistanceLightStrength = {
        value: material.userData.pointDistanceLightStrength as number,
      };
      patchedShader.uniforms.uPointDistanceLightNear = {
        value: material.userData.pointDistanceLightNearM as number,
      };
      patchedShader.uniforms.uPointDistanceLightFar = {
        value: material.userData.pointDistanceLightFarM as number,
      };
      patchedShader.vertexShader = patchedShader.vertexShader
        .replace(
          "void main() {",
          [
            "uniform float uPointDistanceLightNear;",
            "uniform float uPointDistanceLightFar;",
            "varying float vPointDistanceLight;",
            "void main() {",
          ].join("\n"),
        )
        .replace(
          "#include <project_vertex>",
          [
            "#include <project_vertex>",
            "vPointDistanceLight = clamp((length(transformed.xy) - uPointDistanceLightNear) / max(1.0, uPointDistanceLightFar - uPointDistanceLightNear), 0.0, 1.0);",
          ].join("\n"),
        );
      patchedShader.fragmentShader = patchedShader.fragmentShader
        .replace(
          "void main() {",
          [
            "uniform float uPointDistanceLightStrength;",
            "varying float vPointDistanceLight;",
            "void main() {",
          ].join("\n"),
        )
        .replace(
          "#include <color_fragment>",
          [
            "#include <color_fragment>",
            "float pointDistanceLight = pow(vPointDistanceLight, 0.72);",
            "float pointDistanceMultiplier = mix(0.68, 1.42, pointDistanceLight);",
            "diffuseColor.rgb *= mix(1.0, pointDistanceMultiplier, uPointDistanceLightStrength);",
          ].join("\n"),
        );
      material.userData.pointDistanceLightShader = patchedShader;
    };
    material.customProgramCacheKey = () => "geosee-point-distance-light-v2";
    material.userData.pointDistanceLightPatched = true;
    material.needsUpdate = true;
  }

  const shader = material.userData.pointDistanceLightShader as
    | PointDistanceLightShader
    | undefined;
  if (shader) {
    shader.uniforms.uPointDistanceLightStrength.value = clampedStrength;
    shader.uniforms.uPointDistanceLightNear.value = POINT_DISTANCE_LIGHT_NEAR_M;
    shader.uniforms.uPointDistanceLightFar.value = POINT_DISTANCE_LIGHT_FAR_M;
  }
}

function surfaceGradientColorAt(
  t: number,
  midpoint: number,
  contrast: number,
  lowColor: THREE.Color,
  midColor: THREE.Color,
  highColor: THREE.Color,
  target: THREE.Color,
): THREE.Color {
  const shaped = clamp01((clamp01(t) - 0.5) * contrast + 0.5);
  if (shaped < midpoint) {
    const localT = midpoint > 0 ? shaped / midpoint : 0;
    target.lerpColors(lowColor, midColor, clamp01(localT));
  } else {
    const highRange = Math.max(0.0001, 1 - midpoint);
    target.lerpColors(
      midColor,
      highColor,
      clamp01((shaped - midpoint) / highRange),
    );
  }
  return target;
}

function scalarColorAt(
  value: number,
  displayMin: number,
  displayMax: number,
  midpoint: number,
  contrast: number,
  lowColor: THREE.Color,
  midColor: THREE.Color,
  highColor: THREE.Color,
  target: THREE.Color,
): THREE.Color {
  const range = Math.max(0.000001, displayMax - displayMin);
  return surfaceGradientColorAt(
    (value - displayMin) / range,
    midpoint,
    contrast,
    lowColor,
    midColor,
    highColor,
    target,
  );
}

function seismicColorAt(
  value: number,
  displayMin: number,
  displayMax: number,
  colormap: string,
  amplitudeGamma: number,
  target: THREE.Color,
): THREE.Color {
  const rawT = clamp01(
    (value - displayMin) / Math.max(0.000001, displayMax - displayMin),
  );
  const gamma = clampRange(amplitudeGamma, 0.35, 2.5);
  const signed = (rawT - 0.5) * 2;
  const t =
    signed === 0
      ? 0.5
      : clamp01(
          0.5 + Math.sign(signed) * Math.pow(Math.abs(signed), gamma) * 0.5,
        );
  if (colormap === "grayscale") {
    return target.setRGB(t, t, t);
  }
  if (colormap === "velocity") {
    if (t < 0.33) {
      return target.lerpColors(
        new THREE.Color("#173b9a"),
        new THREE.Color("#33b6d7"),
        t / 0.33,
      );
    }
    if (t < 0.66) {
      return target.lerpColors(
        new THREE.Color("#33b6d7"),
        new THREE.Color("#f4df63"),
        (t - 0.33) / 0.33,
      );
    }
    return target.lerpColors(
      new THREE.Color("#f4df63"),
      new THREE.Color("#d34b2d"),
      (t - 0.66) / 0.34,
    );
  }
  if (t < 0.5) {
    return target.lerpColors(
      new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
      new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
      t / 0.5,
    );
  }
  return target.lerpColors(
    new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
    new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
    (t - 0.5) / 0.5,
  );
}

function seismicBackgroundAlphaAt(
  value: number,
  displayMin: number,
  displayMax: number,
  removeBackground: boolean,
  amplitudeGamma: number,
  backgroundCutoff: number,
): number {
  if (!removeBackground) return 1;
  const rawT = clamp01(
    (value - displayMin) / Math.max(0.000001, displayMax - displayMin),
  );
  const gamma = clampRange(amplitudeGamma, 0.35, 2.5);
  const signed = (rawT - 0.5) * 2;
  const t =
    signed === 0
      ? 0.5
      : clamp01(
          0.5 + Math.sign(signed) * Math.pow(Math.abs(signed), gamma) * 0.5,
        );
  const contrast = Math.abs(t - 0.5) * 2;
  const cutoff = clampRange(backgroundCutoff, 0, 0.45);
  return THREE.MathUtils.smoothstep(
    contrast,
    cutoff,
    Math.min(0.96, Math.max(0.62, cutoff + 0.22)),
  );
}

function scalarDefaultRange(geometry: THREE.BufferGeometry): {
  min: number;
  max: number;
} {
  const scalar = geometry.userData.scalar as
    | { displayMin?: number; displayMax?: number; min?: number; max?: number }
    | undefined;
  const min =
    typeof scalar?.displayMin === "number" && Number.isFinite(scalar.displayMin)
      ? scalar.displayMin
      : typeof scalar?.min === "number" && Number.isFinite(scalar.min)
        ? scalar.min
        : 0;
  const max =
    typeof scalar?.displayMax === "number" && Number.isFinite(scalar.displayMax)
      ? scalar.displayMax
      : typeof scalar?.max === "number" && Number.isFinite(scalar.max)
        ? scalar.max
        : min + 1;
  return max > min ? { min, max } : { min, max: min + 1 };
}

function scalarSourceRange(geometry: THREE.BufferGeometry): {
  min: number;
  max: number;
} {
  const scalar = geometry.userData.scalar as
    | { min?: number; max?: number; displayMin?: number; displayMax?: number }
    | undefined;
  const min =
    typeof scalar?.min === "number" && Number.isFinite(scalar.min)
      ? scalar.min
      : typeof scalar?.displayMin === "number" &&
          Number.isFinite(scalar.displayMin)
        ? scalar.displayMin
        : 0;
  const max =
    typeof scalar?.max === "number" && Number.isFinite(scalar.max)
      ? scalar.max
      : typeof scalar?.displayMax === "number" &&
          Number.isFinite(scalar.displayMax)
        ? scalar.displayMax
        : min + 1;
  return max > min ? { min, max } : { min, max: min + 1 };
}

function geometryOriginalIndex(
  geometry: THREE.BufferGeometry,
): Uint32Array | null {
  const existing = geometry.userData.scalarOriginalIndex as
    | { index: Uint32Array | null }
    | undefined;
  if (existing) return existing.index;

  const currentIndex = geometry.getIndex();
  let storedIndex: Uint32Array | null = null;
  if (currentIndex) {
    storedIndex = new Uint32Array(currentIndex.count);
    for (let i = 0; i < currentIndex.count; i += 1) {
      storedIndex[i] = currentIndex.getX(i);
    }
  }
  geometry.userData.scalarOriginalIndex = { index: storedIndex };
  return storedIndex;
}

function sequentialIndex(count: number): Uint32Array {
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) indices[i] = i;
  return indices;
}

function scalarValueIsVisible(
  values: Float32Array | number[],
  index: number,
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
): boolean {
  const value = values[index];
  if (!Number.isFinite(value)) return false;
  if (value < trimMin || value > trimMax) return false;
  if (value >= blendMin && value <= blendMax) return true;

  let weight = 0;
  if (value < blendMin) {
    const span = Math.max(0.000001, blendMin - trimMin);
    weight = (value - trimMin) / span;
  } else {
    const span = Math.max(0.000001, trimMax - blendMax);
    weight = (trimMax - value) / span;
  }

  if (weight >= 1) return true;
  if (weight <= 0) return false;
  return deterministicScalarSample(index) <= weight;
}

function deterministicScalarSample(index: number): number {
  let value = Math.imul(index + 1, 2654435761) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 4294967295;
}

function scalarVisibilityWeight(
  values: Float32Array | number[],
  index: number,
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
): number {
  const value = values[index];
  if (!Number.isFinite(value)) return 0;
  if (value < trimMin || value > trimMax) return 0;
  if (value >= blendMin && value <= blendMax) return 1;
  if (value < blendMin) {
    return clamp01((value - trimMin) / Math.max(0.000001, blendMin - trimMin));
  }
  return clamp01((trimMax - value) / Math.max(0.000001, trimMax - blendMax));
}

function supportCellKey(ix: number, iy: number, iz: number): number {
  return (ix + 32768) * 4294967296 + (iy + 32768) * 65536 + iz + 32768;
}

function scalarLateralSupport(
  geometry: THREE.BufferGeometry,
): Float32Array | null {
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const cached = geometry.userData.scalarLateralSupport as
    | { count: number; values: Float32Array }
    | undefined;
  if (cached?.count === position.count) return cached.values;

  const occupied = new Set<number>();
  const cells = new Int32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const ix = Math.floor(position.getX(i) / SCALAR_LATERAL_SUPPORT_XY_BIN_M);
    const iy = Math.floor(position.getY(i) / SCALAR_LATERAL_SUPPORT_XY_BIN_M);
    const iz = Math.floor(position.getZ(i) / SCALAR_LATERAL_SUPPORT_Z_BIN_M);
    cells[i * 3] = ix;
    cells[i * 3 + 1] = iy;
    cells[i * 3 + 2] = iz;
    occupied.add(supportCellKey(ix, iy, iz));
  }

  const values = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const ix = cells[i * 3];
    const iy = cells[i * 3 + 1];
    const iz = cells[i * 3 + 2];
    let neighborCount = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        if (occupied.has(supportCellKey(ix + dx, iy + dy, iz))) {
          neighborCount += 1;
        }
      }
    }
    values[i] = neighborCount / 8;
  }

  geometry.userData.scalarLateralSupport = { count: position.count, values };
  return values;
}

interface ScalarEdgeLineOptions {
  trimMin: number;
  blendMin: number;
  blendMax: number;
  trimMax: number;
  edgeLowerValue: number;
  edgeUpperValue: number;
  edgeLineWidth: number;
  edgeAverage: number;
  edgeFillOffset: number;
  edgeLineStyle: "solid" | "dashed";
  noiseThreshold: number;
  colorMin: number;
  colorMax: number;
  midpoint: number;
  contrast: number;
  lowColor: THREE.Color;
  midColor: THREE.Color;
  highColor: THREE.Color;
  supportValues: Float32Array | null;
}

interface ScalarEdgeCell {
  key: string;
  ix: number;
  iy: number;
  iz: number;
  x: number;
  y: number;
  z: number;
  count: number;
  color: THREE.Color;
}

interface ScalarEdgePathPoint {
  x: number;
  y: number;
  z: number;
  count: number;
  color: THREE.Color;
}

function scalarEdgeGridKey(ix: number, iy: number, iz: number): string {
  return `${ix},${iy},${iz}`;
}

function scalarEdgeBandHalfWidth(
  edgeValue: number,
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
): number {
  const lowerSpan = Math.max(0, blendMin - trimMin);
  const upperSpan = Math.max(0, trimMax - blendMax);
  const span =
    edgeValue <= blendMin + 0.000001
      ? lowerSpan
      : edgeValue >= blendMax - 0.000001
        ? upperSpan
        : Math.min(lowerSpan || upperSpan, upperSpan || lowerSpan);
  return Math.max(0.025, Math.min(0.18, Math.max(span * 0.3, 0.035)));
}

function scalarEdgeCellNeighbors(
  cell: ScalarEdgeCell,
  cells: Map<string, ScalarEdgeCell>,
): ScalarEdgeCell[] {
  const neighbors: ScalarEdgeCell[] = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      const neighbor = cells.get(
        scalarEdgeGridKey(cell.ix + dx, cell.iy + dy, cell.iz),
      );
      if (neighbor) neighbors.push(neighbor);
    }
  }
  return neighbors;
}

function scalarEdgeCellDistance(a: ScalarEdgeCell, b: ScalarEdgeCell): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function scalarEdgePointFromCell(cell: ScalarEdgeCell): ScalarEdgePathPoint {
  return {
    x: cell.x,
    y: cell.y,
    z: cell.z,
    count: cell.count,
    color: cell.color.clone(),
  };
}

function scalarEdgeMixPoint(
  a: ScalarEdgePathPoint,
  b: ScalarEdgePathPoint,
  t: number,
): ScalarEdgePathPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    count: a.count + (b.count - a.count) * t,
    color: a.color.clone().lerp(b.color, t),
  };
}

function orderScalarEdgePaths(
  cells: Map<string, ScalarEdgeCell>,
): ScalarEdgePathPoint[][] {
  const unused = new Set(cells.keys());
  const paths: ScalarEdgePathPoint[][] = [];

  while (unused.size > 0) {
    let start: ScalarEdgeCell | null = null;
    let startScore = Infinity;
    for (const key of unused) {
      const cell = cells.get(key);
      if (!cell) continue;
      const degree = scalarEdgeCellNeighbors(cell, cells).length;
      const endpointBonus = degree <= 1 ? -100_000 : 0;
      const score =
        endpointBonus + degree * 100 + cell.x * 0.0001 + cell.y * 0.0001;
      if (score < startScore) {
        start = cell;
        startScore = score;
      }
    }
    if (!start) break;

    const path: ScalarEdgePathPoint[] = [];
    let previous: ScalarEdgeCell | null = null;
    let current: ScalarEdgeCell | null = start;
    while (current) {
      path.push(scalarEdgePointFromCell(current));
      unused.delete(current.key);

      const candidates: ScalarEdgeCell[] = scalarEdgeCellNeighbors(
        current,
        cells,
      ).filter((neighbor) => unused.has(neighbor.key));
      if (candidates.length === 0) break;

      let best: ScalarEdgeCell = candidates[0];
      let bestScore = -Infinity;
      for (const candidate of candidates) {
        const distance = Math.max(
          1,
          scalarEdgeCellDistance(current, candidate),
        );
        let score = -distance;
        if (previous) {
          const inX = current.x - previous.x;
          const inY = current.y - previous.y;
          const outX = candidate.x - current.x;
          const outY = candidate.y - current.y;
          const inLength = Math.max(1, Math.hypot(inX, inY));
          const outLength = Math.max(1, Math.hypot(outX, outY));
          score +=
            ((inX / inLength) * (outX / outLength) +
              (inY / inLength) * (outY / outLength)) *
            10_000;
        }
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      previous = current;
      current = best;
    }

    if (path.length >= 2) paths.push(path);
  }

  return paths;
}

function smoothScalarEdgePath(
  path: ScalarEdgePathPoint[],
  amount: number,
): ScalarEdgePathPoint[] {
  const smoothing = clampRange(amount, 0, 1);
  const passes = Math.round(smoothing * 5);
  if (passes <= 0 || path.length < 3) return path;

  let smoothed = path;
  const corner = 0.12 + smoothing * 0.18;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: ScalarEdgePathPoint[] = [smoothed[0]];
    for (let i = 0; i < smoothed.length - 1; i += 1) {
      const a = smoothed[i];
      const b = smoothed[i + 1];
      next.push(scalarEdgeMixPoint(a, b, corner));
      next.push(scalarEdgeMixPoint(a, b, 1 - corner));
    }
    next.push(smoothed[smoothed.length - 1]);
    smoothed = next;
  }
  return smoothed;
}

function scalarEdgeSupportScale(
  point: ScalarEdgePathPoint,
  minCount: number,
  maxCount: number,
): number {
  if (maxCount <= minCount) return 1;
  const minRoot = Math.sqrt(minCount);
  const maxRoot = Math.sqrt(maxCount);
  const t = clampRange(
    (Math.sqrt(Math.max(0, point.count)) - minRoot) /
      Math.max(0.0001, maxRoot - minRoot),
    0,
    1,
  );
  return 0.035 + t * 0.965;
}

function disposeScalarEdgeLine(obj: THREE.Points): void {
  const line = obj.userData.scalarEdgeLineOverlay as THREE.Mesh | undefined;
  if (!line) return;
  line.removeFromParent();
  line.geometry.dispose();
  const material = line.material;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
  } else {
    material.dispose();
  }
  delete obj.userData.scalarEdgeLineOverlay;
}

function updateScalarEdgeLineOverlay(
  obj: THREE.Points,
  values: Float32Array | number[],
  options: ScalarEdgeLineOptions,
): void {
  if (options.edgeLineWidth <= 0.001) {
    disposeScalarEdgeLine(obj);
    return;
  }

  const position = obj.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) {
    disposeScalarEdgeLine(obj);
    return;
  }

  const edgeTargets = [
    {
      value: clampRange(
        options.edgeLowerValue,
        options.trimMin,
        Math.max(options.trimMin, options.blendMin),
      ),
      halfWidth: scalarEdgeBandHalfWidth(
        options.edgeLowerValue,
        options.trimMin,
        options.blendMin,
        options.blendMax,
        options.trimMax,
      ),
    },
    {
      value: clampRange(
        options.edgeUpperValue,
        Math.min(options.blendMax, options.trimMax),
        options.trimMax,
      ),
      halfWidth: scalarEdgeBandHalfWidth(
        options.edgeUpperValue,
        options.trimMin,
        options.blendMin,
        options.blendMax,
        options.trimMax,
      ),
    },
  ];
  const cells = new Map<string, ScalarEdgeCell>();
  const colorScratch = new THREE.Color();
  const colorAccum = new THREE.Color();
  const fillOffset = clampRange(options.edgeFillOffset, -1, 1);
  const fillTarget =
    fillOffset < 0 ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0);

  for (let i = 0; i < position.count; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    if (
      !scalarValueIsVisible(
        values,
        i,
        options.trimMin,
        options.blendMin,
        options.blendMax,
        options.trimMax,
      )
    ) {
      continue;
    }
    if (
      options.supportValues &&
      options.supportValues[i] < options.noiseThreshold
    ) {
      continue;
    }

    let inEdgeBand = false;
    for (const target of edgeTargets) {
      if (Math.abs(value - target.value) <= target.halfWidth) {
        inEdgeBand = true;
        break;
      }
    }
    if (!inEdgeBand) continue;

    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const ix = Math.floor(x / SCALAR_EDGE_LINE_XY_BIN_M);
    const iy = Math.floor(y / SCALAR_EDGE_LINE_XY_BIN_M);
    const iz = Math.floor(z / SCALAR_EDGE_LINE_Z_BIN_M);
    const key = scalarEdgeGridKey(ix, iy, iz);
    scalarColorAt(
      value,
      options.colorMin,
      options.colorMax,
      options.midpoint,
      options.contrast,
      options.lowColor,
      options.midColor,
      options.highColor,
      colorScratch,
    );
    if (Math.abs(fillOffset) > 0.0001) {
      colorScratch.lerp(fillTarget, Math.abs(fillOffset));
    }
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key,
        ix,
        iy,
        iz,
        x: 0,
        y: 0,
        z: 0,
        count: 0,
        color: new THREE.Color(0, 0, 0),
      };
      cells.set(key, cell);
    }
    cell.x += x;
    cell.y += y;
    cell.z += z;
    colorAccum.copy(colorScratch);
    cell.color.add(colorAccum);
    cell.count += 1;
  }

  for (const cell of cells.values()) {
    if (cell.count < SCALAR_EDGE_LINE_MIN_CELL_POINTS) {
      cells.delete(cell.key);
      continue;
    }
    cell.x /= cell.count;
    cell.y /= cell.count;
    cell.z /= cell.count;
    cell.color.multiplyScalar(1 / cell.count);
  }

  const boundaryCells = new Map<string, ScalarEdgeCell>();
  for (const cell of cells.values()) {
    const leftMissing = !cells.has(
      scalarEdgeGridKey(cell.ix - 1, cell.iy, cell.iz),
    );
    const rightMissing = !cells.has(
      scalarEdgeGridKey(cell.ix + 1, cell.iy, cell.iz),
    );
    const downMissing = !cells.has(
      scalarEdgeGridKey(cell.ix, cell.iy - 1, cell.iz),
    );
    const upMissing = !cells.has(
      scalarEdgeGridKey(cell.ix, cell.iy + 1, cell.iz),
    );
    if (leftMissing || rightMissing || downMissing || upMissing) {
      boundaryCells.set(cell.key, cell);
    }
  }

  if (boundaryCells.size < 2) {
    disposeScalarEdgeLine(obj);
    return;
  }

  let minCount = Infinity;
  let maxCount = -Infinity;
  for (const cell of boundaryCells.values()) {
    minCount = Math.min(minCount, cell.count);
    maxCount = Math.max(maxCount, cell.count);
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseHalfWidthM = options.edgeLineWidth * 45;
  const dashed = options.edgeLineStyle === "dashed";
  const dashCycleM = Math.max(
    SCALAR_EDGE_LINE_XY_BIN_M * 1.1,
    baseHalfWidthM * 18,
  );
  const appendSegment = (a: ScalarEdgePathPoint, b: ScalarEdgePathPoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const aScale = scalarEdgeSupportScale(a, minCount, maxCount);
    const bScale = scalarEdgeSupportScale(b, minCount, maxCount);
    const aHalfWidthM = baseHalfWidthM * aScale;
    const bHalfWidthM = baseHalfWidthM * bScale;
    const nxA = (-dy / length) * aHalfWidthM;
    const nyA = (dx / length) * aHalfWidthM;
    const nxB = (-dy / length) * bHalfWidthM;
    const nyB = (dx / length) * bHalfWidthM;
    const base = positions.length / 3;
    positions.push(
      a.x + nxA,
      a.y + nyA,
      a.z + 15,
      a.x - nxA,
      a.y - nyA,
      a.z + 15,
      b.x + nxB,
      b.y + nyB,
      b.z + 15,
      b.x - nxB,
      b.y - nyB,
      b.z + 15,
    );
    const aIntensity = 0.38 + aScale * 0.62;
    const bIntensity = 0.38 + bScale * 0.62;
    colors.push(
      a.color.r * aIntensity,
      a.color.g * aIntensity,
      a.color.b * aIntensity,
      a.color.r * aIntensity,
      a.color.g * aIntensity,
      a.color.b * aIntensity,
      b.color.r * bIntensity,
      b.color.g * bIntensity,
      b.color.b * bIntensity,
      b.color.r * bIntensity,
      b.color.g * bIntensity,
      b.color.b * bIntensity,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };

  const paths = orderScalarEdgePaths(boundaryCells);
  for (const path of paths) {
    const smoothedPath = smoothScalarEdgePath(path, options.edgeAverage);
    let pathDistanceM = 0;
    for (let i = 0; i < smoothedPath.length - 1; i += 1) {
      const a = smoothedPath[i];
      const b = smoothedPath[i + 1];
      const segmentLengthM = Math.hypot(b.x - a.x, b.y - a.y);
      const segmentMidM = pathDistanceM + segmentLengthM * 0.5;
      if (!dashed || Math.floor(segmentMidM / dashCycleM) % 2 === 0) {
        appendSegment(a, b);
      }
      pathDistanceM += segmentLengthM;
    }
  }

  if (positions.length === 0) {
    disposeScalarEdgeLine(obj);
    return;
  }

  let line = obj.userData.scalarEdgeLineOverlay as THREE.Mesh | undefined;
  if (!line) {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const lineGeometry = new THREE.BufferGeometry();
    line = new THREE.Mesh(lineGeometry, material);
    line.name = "mt-scalar-edge-line-overlay";
    line.renderOrder = 6.8;
    line.userData.ignoreLayerStyle = true;
    obj.userData.scalarEdgeLineOverlay = line;
    obj.add(line);
  }

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  lineGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  lineGeometry.setIndex(indices);
  lineGeometry.computeBoundingSphere();
  line.geometry.dispose();
  line.geometry = lineGeometry;
  const material = line.material as THREE.MeshBasicMaterial;
  material.opacity = clampRange(0.4 + options.edgeLineWidth / 10, 0.4, 0.96);
  material.needsUpdate = true;
  line.visible = true;
}

interface ScalarSectionIsoOptions {
  layerId: string;
  enabled: boolean;
  linesVisible: boolean;
  bandsVisible: boolean;
  selectedTargetIds: Record<string, boolean>;
  targetKey?: string;
  alphaValues?: Float32Array | number[];
  colorMode?:
    | "scalar"
    | "seismic-blue-white-red"
    | "seismic-grayscale"
    | "seismic-velocity";
  amplitudeGamma?: number;
  skipSceneSectionClipping?: boolean;
  isoMin: number;
  isoMax: number;
  levelCount: number;
  lineWidth: number;
  lineStyle: "solid" | "dashed";
  bandOpacity: number;
  fillOffset: number;
  colorMin: number;
  colorMax: number;
  midpoint: number;
  contrast: number;
  lowColor: THREE.Color;
  midColor: THREE.Color;
  highColor: THREE.Color;
}

function scalarSectionMeshId(obj: THREE.Object3D): string | null {
  const data = obj.userData ?? {};
  const candidates = [
    data.resistivitySliceId,
    data.scalarSectionId,
    data.sectionId,
    data.productId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return obj.name ? obj.name : null;
}

function scalarSectionTargetKey(layerId: string, obj: THREE.Object3D): string {
  return `${layerId}:${scalarSectionMeshId(obj) ?? obj.uuid}`;
}

function scalarSectionMeshLabel(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const slice = data.resistivitySlice as
    | { label?: unknown; id?: unknown }
    | undefined;
  if (typeof slice?.label === "string" && slice.label.trim())
    return slice.label;
  if (
    typeof data.scalarSectionLabel === "string" &&
    data.scalarSectionLabel.trim()
  ) {
    return data.scalarSectionLabel;
  }
  if (typeof data.displayName === "string" && data.displayName.trim()) {
    return data.displayName;
  }
  if (typeof slice?.id === "string" && slice.id.trim()) return slice.id;
  if (obj.name) return obj.name;
  return "Scalar section";
}

function scalarSectionMeshKind(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  if (typeof data.resistivitySliceKind === "string")
    return data.resistivitySliceKind;
  if (typeof data.scalarSectionKind === "string") return data.scalarSectionKind;
  return "section";
}

function seismicSectionMeshId(obj: THREE.Object3D): string | null {
  const data = obj.userData ?? {};
  const sectionId =
    typeof data.seismicSectionId === "string" && data.seismicSectionId.trim()
      ? data.seismicSectionId
      : null;
  const axis =
    typeof data.seismicSectionAxis === "string" &&
    data.seismicSectionAxis.trim()
      ? data.seismicSectionAxis
      : null;
  if (sectionId && axis) return `${axis}-${sectionId}`;
  if (sectionId) return sectionId;
  return obj.name ? obj.name : null;
}

function seismicSectionTargetKey(layerId: string, obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const productId =
    typeof data.seismicProductId === "string" && data.seismicProductId.trim()
      ? data.seismicProductId
      : "seismic-product";
  return `${layerId}:${productId}:${seismicSectionMeshId(obj) ?? obj.uuid}`;
}

function seismicSectionMeshLabel(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const productLabel =
    typeof data.seismicProductLabel === "string" &&
    data.seismicProductLabel.trim()
      ? data.seismicProductLabel
      : "Seismic";
  const sectionId =
    typeof data.seismicSectionId === "string" && data.seismicSectionId.trim()
      ? data.seismicSectionId
      : "";
  const axis =
    typeof data.seismicSectionAxis === "string" &&
    data.seismicSectionAxis.trim()
      ? data.seismicSectionAxis
      : "section";
  return sectionId
    ? `${productLabel} ${axis} ${sectionId}`
    : `${productLabel} ${axis}`;
}

function seismicSectionMeshKind(obj: THREE.Object3D): string {
  const axis =
    typeof obj.userData?.seismicSectionAxis === "string"
      ? obj.userData.seismicSectionAxis
      : "section";
  return `seismic ${axis}`;
}

function mtVolumeCutSectionId(
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${productId}-${axis}-section`;
}

function mtVolumeCutTargetKey(
  layerId: string,
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${layerId}:${productId}:${axis}`;
}

function seismicVolumeCutSectionId(
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${productId}-volume-${axis}-section`;
}

function seismicVolumeCutTargetKey(
  layerId: string,
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${layerId}:${productId}:volume:${axis}`;
}

function isScalarSectionMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  if (!(obj instanceof THREE.Mesh)) return false;
  if (obj.userData?.scalarSectionIsoOverlay === true) return false;
  const values = obj.geometry.userData.scalarValues as
    | Float32Array
    | number[]
    | undefined;
  if (!values || values.length === 0) return false;
  return (
    obj.userData?.resistivitySlicePreview === true ||
    obj.userData?.scalarSectionPreview === true ||
    obj.userData?.sectionPreview === true
  );
}

function isSeismicSectionMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  if (!(obj instanceof THREE.Mesh)) return false;
  if (obj.userData?.scalarSectionIsoOverlay === true) return false;
  if (obj.userData?.seismicSection !== true) return false;
  const values = obj.geometry.userData.seismicAmplitudeValues as
    | Float32Array
    | number[]
    | undefined;
  return !!values && values.length > 0;
}

function sectionIsoAlphaAt(
  alphaValues: Float32Array | number[] | undefined,
  index: number,
): number {
  if (!alphaValues || index < 0 || index >= alphaValues.length) return 1;
  const value = alphaValues[index];
  return Number.isFinite(value) ? clamp01(value) : 0;
}

function sectionIsoTriangleSuppressed(
  alphaValues: Float32Array | number[] | undefined,
  ia: number,
  ib: number,
  ic: number,
): boolean {
  if (!alphaValues) return false;
  return (
    sectionIsoAlphaAt(alphaValues, ia) <= 0.01 &&
    sectionIsoAlphaAt(alphaValues, ib) <= 0.01 &&
    sectionIsoAlphaAt(alphaValues, ic) <= 0.01
  );
}

function sectionIsoAttributeValues(
  attribute:
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined,
  count: number,
): Float32Array | undefined {
  if (!attribute || attribute.itemSize < 1 || attribute.count < count)
    return undefined;
  const values = new Float32Array(count);
  for (let i = 0; i < count; i += 1) values[i] = attribute.getX(i);
  return values;
}

function disposeScalarSectionIsoOverlay(obj: THREE.Mesh): void {
  const root = obj.userData.scalarSectionIsoOverlayRoot as
    | THREE.Object3D
    | undefined;
  if (!root) return;
  root.removeFromParent();
  disposeObjectTree(root);
  delete obj.userData.scalarSectionIsoOverlayRoot;
}

function sectionIsoLevels(min: number, max: number, count: number): number[] {
  const safeCount = Math.max(2, Math.round(count));
  const range = Math.max(0.000001, max - min);
  const levels: number[] = [];
  for (let i = 1; i <= safeCount; i += 1) {
    levels.push(min + (range * i) / (safeCount + 1));
  }
  return levels;
}

function sectionIsoColorAt(
  value: number,
  options: ScalarSectionIsoOptions,
  target: THREE.Color,
): THREE.Color {
  const colorMode = options.colorMode ?? "scalar";
  if (colorMode === "seismic-blue-white-red") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "blue-white-red",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else if (colorMode === "seismic-grayscale") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "grayscale",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else if (colorMode === "seismic-velocity") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "velocity",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else {
    scalarColorAt(
      value,
      options.colorMin,
      options.colorMax,
      options.midpoint,
      options.contrast,
      options.lowColor,
      options.midColor,
      options.highColor,
      target,
    );
  }
  const fillOffset = clampRange(options.fillOffset, -1, 1);
  if (Math.abs(fillOffset) > 0.0001) {
    target.lerp(
      fillOffset < 0 ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0),
      Math.abs(fillOffset),
    );
  }
  return target;
}

function addUniqueIsoPoint(
  points: THREE.Vector3[],
  point: THREE.Vector3,
): void {
  for (const existing of points) {
    if (existing.distanceToSquared(point) < 0.01) return;
  }
  points.push(point);
}

function sectionIsoTriangleIntersections(
  position: THREE.BufferAttribute,
  values: Float32Array | number[],
  ia: number,
  ib: number,
  ic: number,
  level: number,
  target: THREE.Vector3[],
): void {
  target.length = 0;
  const addEdge = (a: number, b: number) => {
    const va = values[a];
    const vb = values[b];
    if (!Number.isFinite(va) || !Number.isFinite(vb)) return;
    const da = va - level;
    const db = vb - level;
    if (Math.abs(da) < 0.000001 && Math.abs(db) < 0.000001) return;
    if ((da < 0 && db < 0) || (da > 0 && db > 0)) return;
    const denom = vb - va;
    if (Math.abs(denom) < 0.000001) return;
    const t = clampRange((level - va) / denom, 0, 1);
    addUniqueIsoPoint(
      target,
      new THREE.Vector3(
        position.getX(a) + (position.getX(b) - position.getX(a)) * t,
        position.getY(a) + (position.getY(b) - position.getY(a)) * t,
        position.getZ(a) + (position.getZ(b) - position.getZ(a)) * t,
      ),
    );
  };
  addEdge(ia, ib);
  addEdge(ib, ic);
  addEdge(ic, ia);
}

function farthestIsoPair(
  points: THREE.Vector3[],
): [THREE.Vector3, THREE.Vector3] | null {
  if (points.length < 2) return null;
  let bestA = points[0];
  let bestB = points[1];
  let bestDistance = bestA.distanceToSquared(bestB);
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = points[i].distanceToSquared(points[j]);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestA = points[i];
        bestB = points[j];
      }
    }
  }
  return bestDistance > 1 ? [bestA, bestB] : null;
}

function appendSectionIsoRibbonSegment(
  positions: number[],
  colors: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  normal: THREE.Vector3,
  color: THREE.Color,
  halfWidthM: number,
): void {
  if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) return;
  const direction = b.clone().sub(a);
  const length = direction.length();
  if (length < 1) return;
  direction.multiplyScalar(1 / length);
  const side = direction.clone().cross(normal).normalize();
  if (side.lengthSq() < 0.000001) return;
  side.multiplyScalar(halfWidthM);
  const lift = normal.clone().multiplyScalar(SECTION_ISO_LIFT_M);
  const p0 = a.clone().add(lift).add(side);
  const p1 = a.clone().add(lift).sub(side);
  const p2 = b.clone().add(lift).add(side);
  const p3 = b.clone().add(lift).sub(side);
  const base = positions.length / 3;
  positions.push(
    p0.x,
    p0.y,
    p0.z,
    p1.x,
    p1.y,
    p1.z,
    p2.x,
    p2.y,
    p2.z,
    p3.x,
    p3.y,
    p3.z,
  );
  for (let i = 0; i < 4; i += 1) {
    colors.push(color.r, color.g, color.b);
  }
  indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
}

function appendSectionIsoRibbon(
  positions: number[],
  colors: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  normal: THREE.Vector3,
  color: THREE.Color,
  halfWidthM: number,
  dashed: boolean,
): void {
  if (!dashed) {
    appendSectionIsoRibbonSegment(
      positions,
      colors,
      indices,
      a,
      b,
      normal,
      color,
      halfWidthM,
    );
    return;
  }
  const length = a.distanceTo(b);
  if (length < 1) return;
  const direction = b
    .clone()
    .sub(a)
    .multiplyScalar(1 / length);
  const dashLength = Math.max(halfWidthM * 8, 220);
  const gapLength = Math.max(halfWidthM * 4, 140);
  const cycle = dashLength + gapLength;
  for (let start = 0; start < length; start += cycle) {
    const end = Math.min(start + dashLength, length);
    if (end <= start) continue;
    appendSectionIsoRibbonSegment(
      positions,
      colors,
      indices,
      a.clone().addScaledVector(direction, start),
      a.clone().addScaledVector(direction, end),
      normal,
      color,
      halfWidthM,
    );
  }
}

function buildSectionIsoLineGeometry(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): THREE.BufferGeometry | null {
  const position = obj.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const index = obj.geometry.getIndex();
  const sourceIndex = index
    ? Array.from({ length: index.count }, (_, i) => index.getX(i))
    : Array.from({ length: position.count }, (_, i) => i);
  const triangleLimit = sourceIndex.length - (sourceIndex.length % 3);
  if (triangleLimit <= 0) return null;
  const triangleCount = triangleLimit / 3;
  const triangleStride = Math.max(
    1,
    Math.ceil(triangleCount / SECTION_ISO_MAX_TRIANGLES),
  );

  const levels = sectionIsoLevels(
    options.isoMin,
    options.isoMax,
    options.levelCount,
  );
  const halfWidthM = Math.max(
    6,
    options.lineWidth * SECTION_ISO_LINE_WIDTH_M_PER_PX * 0.5,
  );
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const intersections: THREE.Vector3[] = [];
  const triangleA = new THREE.Vector3();
  const triangleB = new THREE.Vector3();
  const triangleC = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  const dashed = options.lineStyle === "dashed";

  triangleLoop: for (let i = 0; i < triangleLimit; i += 3 * triangleStride) {
    const ia = sourceIndex[i];
    const ib = sourceIndex[i + 1];
    const ic = sourceIndex[i + 2];
    if (sectionIsoTriangleSuppressed(options.alphaValues, ia, ib, ic)) continue;
    triangleA.set(position.getX(ia), position.getY(ia), position.getZ(ia));
    triangleB.set(position.getX(ib), position.getY(ib), position.getZ(ib));
    triangleC.set(position.getX(ic), position.getY(ic), position.getZ(ic));
    normal
      .copy(triangleB)
      .sub(triangleA)
      .cross(triangleC.clone().sub(triangleA))
      .normalize();
    if (normal.lengthSq() < 0.000001) continue;

    for (const level of levels) {
      sectionIsoTriangleIntersections(
        position,
        values,
        ia,
        ib,
        ic,
        level,
        intersections,
      );
      const pair = farthestIsoPair(intersections);
      if (!pair) continue;
      sectionIsoColorAt(level, options, color);
      appendSectionIsoRibbon(
        positions,
        colors,
        indices,
        pair[0],
        pair[1],
        normal,
        color,
        halfWidthM,
        dashed,
      );
      if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) {
        break triangleLoop;
      }
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSectionIsoBandMaterial(
  options: ScalarSectionIsoOptions,
): THREE.ShaderMaterial {
  const fillOffset = clampRange(options.fillOffset, -1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    uniforms: {
      uIsoMin: { value: options.isoMin },
      uIsoMax: { value: options.isoMax },
      uLevelCount: { value: options.levelCount },
      uOpacity: { value: clampRange(options.bandOpacity, 0, 0.85) },
      uFillOffset: { value: fillOffset },
      uColorMin: { value: options.colorMin },
      uColorMax: { value: options.colorMax },
      uMidpoint: { value: options.midpoint },
      uContrast: { value: options.contrast },
      uColorMode: {
        value:
          options.colorMode === "seismic-grayscale"
            ? 2
            : options.colorMode === "seismic-velocity"
              ? 3
              : options.colorMode === "seismic-blue-white-red"
                ? 1
                : 0,
      },
      uAmplitudeGamma: {
        value: clampRange(options.amplitudeGamma ?? 1, 0.35, 2.5),
      },
      uLiftM: { value: SECTION_ISO_LIFT_M * 0.55 },
      uLowColor: { value: options.lowColor.clone() },
      uMidColor: { value: options.midColor.clone() },
      uHighColor: { value: options.highColor.clone() },
    },
    vertexShader: `
      attribute float sectionIsoScalar;
      attribute float sectionIsoAlpha;
      uniform float uLiftM;
      varying float vSectionIsoScalar;
      varying float vSectionIsoAlpha;
      void main() {
        vSectionIsoScalar = sectionIsoScalar;
        vSectionIsoAlpha = sectionIsoAlpha;
        vec3 lifted = position + normal * uLiftM;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(lifted, 1.0);
      }
    `,
    fragmentShader: `
      varying float vSectionIsoScalar;
      varying float vSectionIsoAlpha;
      uniform float uIsoMin;
      uniform float uIsoMax;
      uniform float uLevelCount;
      uniform float uOpacity;
      uniform float uFillOffset;
      uniform float uColorMin;
      uniform float uColorMax;
      uniform float uMidpoint;
      uniform float uContrast;
      uniform int uColorMode;
      uniform float uAmplitudeGamma;
      uniform vec3 uLowColor;
      uniform vec3 uMidColor;
      uniform vec3 uHighColor;

      float saturate(float value) {
        return clamp(value, 0.0, 1.0);
      }

      vec3 seismicRampColor(float value) {
        float range = max(0.000001, uColorMax - uColorMin);
        float rawT = saturate((value - uColorMin) / range);
        float signedT = (rawT - 0.5) * 2.0;
        float gamma = clamp(uAmplitudeGamma, 0.35, 2.5);
        float t = abs(signedT) < 0.000001
          ? 0.5
          : saturate(0.5 + sign(signedT) * pow(abs(signedT), gamma) * 0.5);
        if (uColorMode == 2) {
          return vec3(t);
        }
        if (uColorMode == 3) {
          if (t < 0.33) {
            return mix(vec3(0.090, 0.231, 0.604), vec3(0.200, 0.714, 0.843), t / 0.33);
          }
          if (t < 0.66) {
            return mix(vec3(0.200, 0.714, 0.843), vec3(0.957, 0.875, 0.388), (t - 0.33) / 0.33);
          }
          return mix(vec3(0.957, 0.875, 0.388), vec3(0.827, 0.294, 0.176), (t - 0.66) / 0.34);
        }
        if (t < 0.5) {
          return mix(vec3(0.141, 0.337, 0.788), vec3(0.957, 0.969, 1.0), t / 0.5);
        }
        return mix(vec3(0.957, 0.969, 1.0), vec3(0.851, 0.212, 0.184), (t - 0.5) / 0.5);
      }

      vec3 rampColor(float value) {
        if (uColorMode != 0) {
          return seismicRampColor(value);
        }
        float range = max(0.000001, uColorMax - uColorMin);
        float t = saturate((value - uColorMin) / range);
        float shaped = saturate((t - 0.5) * uContrast + 0.5);
        float mid = clamp(uMidpoint, 0.05, 0.95);
        if (shaped < mid) {
          return mix(uLowColor, uMidColor, saturate(shaped / max(0.000001, mid)));
        }
        return mix(
          uMidColor,
          uHighColor,
          saturate((shaped - mid) / max(0.000001, 1.0 - mid))
        );
      }

      void main() {
        if (vSectionIsoAlpha <= 0.01) discard;
        if (vSectionIsoScalar < uIsoMin || vSectionIsoScalar > uIsoMax) discard;
        float range = max(0.000001, uIsoMax - uIsoMin);
        float count = max(2.0, floor(uLevelCount + 0.5));
        float band = floor(saturate((vSectionIsoScalar - uIsoMin) / range) * count);
        float value = uIsoMin + ((band + 0.5) / count) * range;
        vec3 color = rampColor(value);
        if (abs(uFillOffset) > 0.0001) {
          color = mix(color, uFillOffset < 0.0 ? vec3(1.0) : vec3(0.0), abs(uFillOffset));
        }
        gl_FragColor = vec4(color, uOpacity * saturate(vSectionIsoAlpha));
      }
    `,
  });
  material.userData.ignoreLayerStyle = true;
  material.userData.scalarSectionIsoOverlay = true;
  return material;
}

function buildSectionIsoBandMesh(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): THREE.Mesh | null {
  const position = obj.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const geometry = obj.geometry.clone();
  const scalarValues =
    values instanceof Float32Array
      ? new Float32Array(values)
      : Float32Array.from(values);
  if (scalarValues.length !== position.count) return null;
  const alphaValues =
    options.alphaValues && options.alphaValues.length === position.count
      ? options.alphaValues instanceof Float32Array
        ? new Float32Array(options.alphaValues)
        : Float32Array.from(options.alphaValues)
      : new Float32Array(position.count).fill(1);
  geometry.setAttribute(
    "sectionIsoScalar",
    new THREE.Float32BufferAttribute(scalarValues, 1),
  );
  geometry.setAttribute(
    "sectionIsoAlpha",
    new THREE.Float32BufferAttribute(alphaValues, 1),
  );
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, makeSectionIsoBandMaterial(options));
  mesh.name = "scalar-section-iso-band-overlay";
  mesh.renderOrder = SECTION_ISO_RENDER_ORDER;
  mesh.userData.ignoreLayerStyle = true;
  mesh.userData.scalarSectionIsoOverlay = true;
  if (options.skipSceneSectionClipping) {
    mesh.userData.sceneSectionHelper = true;
    if (mesh.material instanceof THREE.Material) {
      mesh.material.userData.sceneSectionHelper = true;
    }
  }
  return mesh;
}

function updateScalarSectionIsoOverlay(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): void {
  const targetKey =
    options.targetKey ?? scalarSectionTargetKey(options.layerId, obj);
  const targetSelected = options.selectedTargetIds[targetKey] !== false;
  const enabled =
    options.enabled &&
    targetSelected &&
    options.isoMax > options.isoMin &&
    (options.linesVisible || options.bandsVisible);
  if (!enabled) {
    disposeScalarSectionIsoOverlay(obj);
    return;
  }

  disposeScalarSectionIsoOverlay(obj);
  const root = new THREE.Group();
  root.name = "scalar-section-iso-overlay";
  root.userData.ignoreLayerStyle = true;
  root.userData.scalarSectionIsoOverlay = true;
  root.userData.sectionIsoTargetKey = targetKey;
  if (options.skipSceneSectionClipping) {
    root.userData.sceneSectionHelper = true;
  }
  root.renderOrder = SECTION_ISO_RENDER_ORDER;

  if (options.bandsVisible && options.bandOpacity > 0.001) {
    const band = buildSectionIsoBandMesh(obj, values, options);
    if (band) root.add(band);
  }

  if (options.linesVisible && options.lineWidth > 0.01) {
    const lineGeometry = buildSectionIsoLineGeometry(obj, values, options);
    if (lineGeometry) {
      const lineMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.96,
        vertexColors: true,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      lineMaterial.userData.ignoreLayerStyle = true;
      lineMaterial.userData.scalarSectionIsoOverlay = true;
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.name = "scalar-section-iso-line-overlay";
      line.renderOrder = SECTION_ISO_RENDER_ORDER + 0.05;
      line.userData.ignoreLayerStyle = true;
      line.userData.scalarSectionIsoOverlay = true;
      if (options.skipSceneSectionClipping) {
        line.userData.sceneSectionHelper = true;
        lineMaterial.userData.sceneSectionHelper = true;
      }
      root.add(line);
    }
  }

  if (root.children.length === 0) {
    disposeObjectTree(root);
    return;
  }
  obj.userData.scalarSectionIsoOverlayRoot = root;
  obj.add(root);
}

function applyScalarFocusIndex(
  obj: THREE.Mesh | THREE.Points,
  values: Float32Array | number[],
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
  filterActive: boolean,
  supportValues: Float32Array | null = null,
  noiseThreshold = 0,
): void {
  const geometry = obj.geometry;
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return;

  const originalIndex = geometryOriginalIndex(geometry);
  if (!filterActive) {
    geometry.setIndex(
      originalIndex
        ? new THREE.BufferAttribute(originalIndex.slice(), 1)
        : null,
    );
    geometry.userData.scalarFocusVisibleCount = position.count;
    return;
  }

  if (obj instanceof THREE.Points) {
    const scratch = new Uint32Array(position.count);
    let count = 0;
    for (let i = 0; i < position.count; i += 1) {
      if (
        scalarValueIsVisible(values, i, trimMin, blendMin, blendMax, trimMax) &&
        (!supportValues || supportValues[i] >= noiseThreshold)
      ) {
        scratch[count] = i;
        count += 1;
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(scratch.slice(0, count), 1));
    geometry.userData.scalarFocusVisibleCount = count;
    return;
  }

  const sourceIndex = originalIndex ?? sequentialIndex(position.count);
  const scratch = new Uint32Array(sourceIndex.length);
  let count = 0;
  const triangleLimit = sourceIndex.length - (sourceIndex.length % 3);
  for (let i = 0; i < triangleLimit; i += 3) {
    const a = sourceIndex[i];
    const b = sourceIndex[i + 1];
    const c = sourceIndex[i + 2];
    const weight =
      (scalarVisibilityWeight(values, a, trimMin, blendMin, blendMax, trimMax) +
        scalarVisibilityWeight(
          values,
          b,
          trimMin,
          blendMin,
          blendMax,
          trimMax,
        ) +
        scalarVisibilityWeight(
          values,
          c,
          trimMin,
          blendMin,
          blendMax,
          trimMax,
        )) /
      3;
    if (
      weight >= 1 ||
      (weight > 0 && deterministicScalarSample(i / 3) <= weight)
    ) {
      scratch[count] = a;
      scratch[count + 1] = b;
      scratch[count + 2] = c;
      count += 3;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(scratch.slice(0, count), 1));
  geometry.userData.scalarFocusVisibleCount = count / 3;
}

function shaderMaterialHasThreeFogUniforms(
  material: THREE.ShaderMaterial,
): boolean {
  const uniforms = material.uniforms as Record<string, { value: unknown }>;
  return !!uniforms?.fogColor && (!!uniforms.fogDensity || !!uniforms.fogNear);
}

function ensureLayerFogDensityShader(
  material: THREE.Material,
  density: number,
): void {
  material.userData.layerFogDensity = density;
  const uniform = material.userData.layerFogDensityUniform as
    | { value: number }
    | undefined;
  if (uniform) uniform.value = density;
  if (material.userData.layerFogDensityShader === true) return;

  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.uniforms.layerFogDensity = {
      value: material.userData.layerFogDensity ?? density,
    };
    material.userData.layerFogDensityUniform = shader.uniforms.layerFogDensity;
    if (shader.fragmentShader.includes("#include <common>")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform float layerFogDensity;",
      );
    } else {
      shader.fragmentShader = `uniform float layerFogDensity;\n${shader.fragmentShader}`;
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      `
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - layerFogDensity * layerFogDensity * vFogDepth * vFogDepth );
          #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif
      `,
    );
  };
  material.customProgramCacheKey = () =>
    `${previousKey()}|${LAYER_FOG_SHADER_KEY}`;
  material.userData.layerFogDensityShader = true;
  material.needsUpdate = true;
}

function setMaterialFog(
  material: THREE.Material,
  enabled: boolean,
  density: number,
): void {
  if (material.userData?.ignoreLayerFog === true) return;
  const foggable = material as THREE.Material & {
    fog?: boolean;
    uniforms?: Record<string, { value: unknown }>;
  };
  if (material instanceof THREE.ShaderMaterial) {
    if (!shaderMaterialHasThreeFogUniforms(material)) {
      if (foggable.fog !== false) {
        foggable.fog = false;
        material.needsUpdate = true;
      }
      return;
    }
  }
  if (enabled) ensureLayerFogDensityShader(material, density);
  if (foggable.fog === enabled) return;
  foggable.fog = enabled;
  material.needsUpdate = true;
}

function easeProgress(t: number, easing: EasingName): number {
  const x = clamp01(t);
  switch (easing) {
    case "linear":
      return x;
    case "easeInOutSine":
      return -(Math.cos(Math.PI * x) - 1) / 2;
    case "easeOutQuart":
      return 1 - Math.pow(1 - x, 4);
    case "easeOutCubic":
      return 1 - Math.pow(1 - x, 3);
    case "easeInOutCubic":
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

function scalarInclusionFilterActive(
  layerId: string,
  style: EditableStyle,
  filterActive: boolean,
): boolean {
  const inclusionMode = style.scalarInclusionMode;
  if (inclusionMode === "thresholded") return filterActive;
  if (
    inclusionMode === "all-valid" ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
  ) {
    return false;
  }
  return filterActive;
}

function scalarFullDensityAllValidMode(
  layerId: string,
  style: EditableStyle,
): boolean {
  return (
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID &&
    style.scalarInclusionMode !== "thresholded"
  );
}

interface LayerOpacityTween {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

interface LayerTransitionSnapshot extends LayerOpacityTween {
  id: string;
  group: THREE.Group;
  style?: EditableStyle;
}

interface ScalarStyleTween extends LayerOpacityTween {
  id: string;
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
}

interface WorkingAreaFocusStyleTween {
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

type NavigationReason =
  | "page-click"
  | "keyboard"
  | "programmatic"
  | "freelook"
  | "interrupted";

type LayerTransitionKind =
  | "continuous"
  | "discrete-crossfade"
  | "full-density-scalar"
  | "none";

interface ResolvedLayerRenderState {
  id: string;
  visible: boolean;
  opacity: number;
  style: EditableStyle;
}

interface SceneTransitionContext {
  sourcePageId: string;
  targetPageId: string;
  reason: NavigationReason;
  startMs: number;
  durationMs: number;
  easing: EasingName;
  layerKinds: Record<string, LayerTransitionKind>;
  sourceLayers: Map<string, ResolvedLayerRenderState>;
}

const SCALAR_TRANSITION_STYLE_FIELDS: readonly (keyof EditableStyle)[] = [
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarDisplayMin",
  "scalarDisplayMax",
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarMidpoint",
  "scalarContrast",
  "scalarEdgeLowerValue",
  "scalarEdgeUpperValue",
  "scalarEdgeLineWidth",
  "scalarEdgeAverage",
  "scalarEdgeFillOffset",
  "scalarNoiseThreshold",
  "scalarDistanceLightStrength",
  "scalarVolumeThresholdMin",
  "scalarVolumeThresholdMax",
  "scalarVolumeOpacity",
  "scalarVolumeDensity",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
];

function scalarStyleNumber(
  style: EditableStyle,
  field: keyof EditableStyle,
): number | null {
  const value = style[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const displayMin =
    typeof style.scalarDisplayMin === "number" &&
    Number.isFinite(style.scalarDisplayMin)
      ? style.scalarDisplayMin
      : 0.139879;
  const displayMax =
    typeof style.scalarDisplayMax === "number" &&
    Number.isFinite(style.scalarDisplayMax)
      ? style.scalarDisplayMax
      : 3.937122;
  const focusMin =
    typeof style.scalarFocusMin === "number" &&
    Number.isFinite(style.scalarFocusMin)
      ? style.scalarFocusMin
      : -2;
  const focusMax =
    typeof style.scalarFocusMax === "number" &&
    Number.isFinite(style.scalarFocusMax)
      ? style.scalarFocusMax
      : 4.5;
  const blendMin =
    typeof style.scalarBlendMin === "number" &&
    Number.isFinite(style.scalarBlendMin)
      ? style.scalarBlendMin
      : displayMin;
  const blendMax =
    typeof style.scalarBlendMax === "number" &&
    Number.isFinite(style.scalarBlendMax)
      ? style.scalarBlendMax
      : displayMax;

  if (field === "scalarEdgeLowerValue") {
    return (Math.min(focusMin, focusMax) + Math.min(blendMin, blendMax)) / 2;
  }
  if (field === "scalarEdgeUpperValue") {
    return (Math.max(blendMin, blendMax) + Math.max(focusMin, focusMax)) / 2;
  }
  if (field === "scalarEdgeLineWidth") {
    return (scalarStyleNumber(style, "scalarEdgeHighlight") ?? 0) * 8;
  }
  if (field === "scalarEdgeAverage") return 0.45;
  if (field === "scalarEdgeFillOffset") return 0;
  if (field === "scalarNoiseThreshold") return 0;
  if (field === "scalarDistanceLightStrength") return 0;
  if (field === "sectionIsoMin") return displayMin;
  if (field === "sectionIsoMax") return displayMax;
  if (field === "sectionIsoLevelCount") return 5;
  if (field === "sectionIsoLineWidth") return 2.6;
  if (field === "sectionIsoBandOpacity") return 0.32;
  if (field === "sectionIsoFillOffset") return 0;
  if (field === "sectionIsoSourceOpacity") return 0;
  return null;
}

function scalarTransitionStyleChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): boolean {
  return SCALAR_TRANSITION_STYLE_FIELDS.some((field) => {
    const from = scalarStyleNumber(fromStyle, field);
    const to = scalarStyleNumber(toStyle, field);
    return (
      typeof from === "number" &&
      typeof to === "number" &&
      Math.abs(from - to) > 0.000001
    );
  });
}

function styleFieldChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  field: keyof EditableStyle,
): boolean {
  return (
    JSON.stringify(fromStyle[field] ?? null) !==
    JSON.stringify(toStyle[field] ?? null)
  );
}

function styleFieldsChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  fields: readonly (keyof EditableStyle)[],
): boolean {
  return fields.some((field) => styleFieldChanged(fromStyle, toStyle, field));
}

function forgeDiscreteDataStyleChanged(
  layerId: string,
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): boolean {
  if (!UTAH_FORGE_DISCRETE_CROSSFADE_LAYER_IDS.has(layerId)) return false;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "scalarVolumeProductId",
      "scalarVolumeRenderMode",
      "scalarVolumeTransferMode",
      "scalarVolumeMaskVisible",
    ]);
  }
  if (layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "mtThresholdSurfaceVisibility",
      "mtThresholdSurfaceWireframe",
    ]);
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "resistivityHorizontalSlicesVisible",
      "resistivityVerticalSectionsVisible",
      "resistivitySliceVisibility",
    ]);
  }
  if (layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "seismicProductId",
      "seismicProductVisibility",
      "seismicRenderMode",
      "seismicSliceAxis",
      "seismicSliceFraction",
      "seismicSliceThroughVolume",
      "seismicComparisonProductId",
      "seismicComparisonMode",
      "seismicComparisonSpacingM",
      "seismicNavigationVisible",
      "seismicNavigationRoleVisibility",
      "sectionIsoEnabled",
      "sectionIsoTargetIds",
    ]);
  }
  if (layerId === UTAH_FORGE_TOPO_GRATICULE_LAYER_ID) {
    return styleFieldsChanged(
      fromStyle,
      toStyle,
      UTAH_FORGE_GRATICULE_EDGE_STYLE_FIELDS,
    );
  }
  return false;
}

interface TerrainGridHandle {
  update(params?: NonNullable<SceneProperties["terrain"]>): void;
  updateCameraVisibility(camera: THREE.Camera): void;
}

type PresentationLightSource = NonNullable<
  NonNullable<SceneProperties["lighting"]>["sources"]
>[number];
type PresentationLightType = NonNullable<PresentationLightSource["type"]>;
type LightingHandleKind = "position" | "target";
type LightingHandleMode = "plane" | "height";
export type AreaOutlineHandleMode = "move" | "scaleX" | "scaleY";

interface LightingStudioRuntime {
  type: PresentationLightType;
  light: THREE.Object3D;
  target?: THREE.Object3D;
  helper?: THREE.Object3D;
}

function presentationLightGain(type: PresentationLightType): number {
  switch (type) {
    case "point":
      return 220000;
    case "spot":
      return 140000;
    case "area":
      return 160;
    case "directional":
    default:
      return 1;
  }
}

interface LightingHandleRuntime {
  sourceId: string;
  kind: LightingHandleKind;
  group: THREE.Group;
  pickables: THREE.Object3D[];
}

interface OrbitCenterHandleRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  directionArrow: THREE.Object3D;
}

interface PageCameraMarkerRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  line: THREE.Line;
  label: THREE.Sprite;
  targetLocal: THREE.Vector3;
  labelBaseWidth: number;
  labelBaseHeight: number;
  labelLift: number;
}

export interface AreaOutlinePreview {
  center: [number, number];
  radiusX: number;
  radiusY: number;
}

export type OrbitCenterHandleMode = "plane" | "x" | "y" | "z";
export type SceneSectionAxis = "x" | "y" | "z";
export type SectionIsoTargetGroup =
  | "mt-slices"
  | "mt-volume-cuts"
  | "seismic-sections"
  | "seismic-volume-cuts";

export interface ScalarSectionIsoTarget {
  targetKey: string;
  layerId: string;
  sectionId: string;
  label: string;
  kind: string;
  group: SectionIsoTargetGroup;
  groupLabel: string;
  visible: boolean;
  scalarMin: number;
  scalarMax: number;
}

interface ResolvedSceneSectionPlane {
  axis: SceneSectionAxis;
  enabled: boolean;
  positionM: number;
  invert: boolean;
  normal: THREE.Vector3;
}

interface SceneSectionRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  planes: Map<SceneSectionAxis, THREE.Object3D>;
}

interface PublicSurfaceClipRuntime {
  group: THREE.Group;
  line: LineSegments2;
}

interface PublicSurfaceClipBox {
  enabled: boolean;
  shape: "box" | "circle";
  center: THREE.Vector3;
  halfSize: THREE.Vector3;
  rotationZRad: number;
}

interface WorkingAreaFocusRuntime {
  group: THREE.Group;
  line: LineSegments2;
}

interface WorkingAreaFocusState {
  enabled: boolean;
  mode: "inside-only" | "outside-context";
  boundsLayerId: string;
  boundsMin: THREE.Vector3;
  boundsMax: THREE.Vector3;
  targetLayerIds: Set<string>;
  outsideOpacityByLayerId: Map<string, number>;
  helperVisible: boolean;
}

export interface PageCameraMarkerSpec {
  id: string;
  title: string;
  pose: Pose;
  color: string;
}

function ensureRectAreaLights(): void {
  if (rectAreaLightsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightsReady = true;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

function hardenStudioHelperTree(obj: THREE.Object3D): void {
  obj.renderOrder = 4500;
  obj.traverse((child) => {
    child.renderOrder = 4500;
    const mesh = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) hardenStudioHelperMaterial(mat);
  });
}

export class SceneManager {
  private layers = new Map<string, THREE.Group>();
  private envHemiLight: THREE.HemisphereLight | null = null;
  private envKeyLight: THREE.DirectionalLight | null = null;
  private envFillLight: THREE.DirectionalLight | null = null;
  private envRimLight: THREE.DirectionalLight | null = null;
  private envCustomLights: THREE.Light[] = [];
  private envCustomLightTargets: THREE.Object3D[] = [];
  private envLightHelperGroup: THREE.Group | null = null;
  private envLightRuntimes = new Map<string, LightingStudioRuntime>();
  private envLightHandles = new Map<string, LightingHandleRuntime>();
  private envLightHandlePickables: THREE.Object3D[] = [];
  private orbitCenterHandle: OrbitCenterHandleRuntime | null = null;
  private pageCameraMarker: PageCameraMarkerRuntime | null = null;
  private globalPageCameraMarkers = new Map<string, PageCameraMarkerRuntime>();
  private sceneSectionRuntime: SceneSectionRuntime | null = null;
  private publicSurfaceClipRuntime: PublicSurfaceClipRuntime | null = null;
  private workingAreaFocusRuntime: WorkingAreaFocusRuntime | null = null;
  private lastSceneSectionStyle: EditableStyle = {};
  private lastWorkingAreaFocusStyle: EditableStyle = {};
  private currentWorkingAreaFocusStyle: EditableStyle = {};
  private sceneSectionClippingActive = false;
  private publicSurfaceClippingActive = false;
  private appliedLayerStyles = new Map<string, EditableStyle>();
  private editorMode = true;
  private studioSceneElementsVisible = true;
  private envFog: THREE.FogExp2 | null = null;
  private envFogEnabled = true;
  private envFogDensity = DEFAULT_SCENE_FOG_DENSITY;
  private postHandle: PostHandle | null = null;
  private baseExposure = 1.0;
  private currentSunDir = new THREE.Vector3(0.6, -0.4, 0.7).normalize();
  private authoredWorldSunDir = new THREE.Vector3(0.6, -0.4, 0.7).normalize();
  private baseSunLockToCamera = false;
  private sunLockToCamera = false;
  private pendingCameraSunCapture = false;
  private lastSunConfigKey = "";
  private readonly cameraLocalSunDir = new THREE.Vector3(
    0.6,
    -0.4,
    0.7,
  ).normalize();
  private readonly pendingCameraSunWorldDir = new THREE.Vector3(
    0.6,
    -0.4,
    0.7,
  ).normalize();
  private readonly cameraSunRight = new THREE.Vector3();
  private readonly cameraSunUp = new THREE.Vector3();
  private readonly cameraSunBack = new THREE.Vector3();
  private readonly previousSunDir = new THREE.Vector3();
  private readonly boreLensPos = new THREE.Vector3();
  private readonly boreLensNormal = new THREE.Vector3();
  private readonly boreLensToCamera = new THREE.Vector3();
  private readonly studioHandleWorldPos = new THREE.Vector3();
  private readonly orbitCenterWorldPos = new THREE.Vector3();
  private readonly pageCameraMarkerWorldPos = new THREE.Vector3();
  private readonly ezGammaWorldPos = new THREE.Vector3();
  private readonly ezGammaToCamera = new THREE.Vector3();
  // Last env applied. Stashed so a layer that arrives after the initial
  // applyEnvironment call (terrain is async, loadTerrain resolves later
  // than the PageController mount effect) can trigger a re-apply once
  // its userData.terrainHandle exists. Without this, terrain material
  // uniforms ran on buildTerrainMaterial's construction-time defaults
  // until the user touched any env control.
  private lastEnv: EnvironmentSetup | null = null;
  // Last effective page state applied by PageController. Async loaders often
  // resolve after the initial visibility/style pass; replaying this state keeps
  // freshly-added meshes from showing loader defaults until the next UI edit.
  private lastEffectiveEnv: EnvironmentSetup | null = null;
  private lastEffectivePage: PresentationPage | null = null;
  // Page-to-page layer fades. Keyed by layer id; frameUpdate advances material
  // opacity and terrain-composite uniforms until the target page state settles.
  private layerTweens = new Map<string, LayerOpacityTween>();
  private scalarStyleTweens = new Map<string, ScalarStyleTween>();
  private layerTransitionSnapshots = new Map<string, LayerTransitionSnapshot>();
  private workingAreaFocusTween: WorkingAreaFocusStyleTween | null = null;
  private activeSceneTransitionContext: SceneTransitionContext | null = null;
  private materialBaseOpacity = new WeakMap<THREE.Material, number>();
  private currentVisibleLayerIds: ReadonlySet<string> | null = null;
  // Scene overlay registry: one handle per env.sceneOverlays entry.
  // Loaded eagerly at scene mount; opacity is per-page and tweened by
  // applySceneOverlaysForPage.
  private sceneOverlays = new Map<string, SceneOverlayHandle>();
  private sceneOverlayGroup: THREE.Group | null = null;
  private areaOutlineBuildSeq = 0;
  private areaOutlinePickables: THREE.Object3D[] = [];
  // Last (env, page) applied to scene overlays. Cached so that when the
  // async loader resolves AFTER PageController's initial mount-time
  // applySceneOverlaysForPage call, we can replay the apply against
  // the freshly-registered handles. Same race pattern as terrain shader
  // uniforms (see lastEnv / reapplyEnvironment above).
  private lastOverlayPage: PresentationPage | null = null;
  private lastOverlayEnv: EnvironmentSetup | null = null;
  // Hooks passed in by scene.ts so SceneManager can load a single
  // overlay at runtime (when the user adds one via the editor) without
  // taking a hard dependency on the renderer or path resolver.
  private overlayResolveAssetPath: (rel: string) => string = (p) => "/" + p;
  private overlayMaxAnisotropy = 1;
  // Currently hovered overlay id (for drag-handle cursor + visual
  // brightness boost).
  private hoveredOverlayId: string | null = null;
  // Geology layer handle. Stashed so applyEffectiveStylesForPage can
  // forward env overrides (per-unit visibility / colour) into the
  // mask rebuild, and the editor's sub-layer panel can read the
  // distinct-units list.
  private geologyHandle: GeologyHandle | null = null;
  private environmentScenePreviewPatch: Partial<SceneProperties> | null = null;
  private lastAppliedRenderPresetId: string | null = null;
  private currentTerrainScene: NonNullable<SceneProperties["terrain"]> = {};
  private topoMapBrandingGroup: THREE.Group | null = null;
  private topoMapBrandingLogoLoadSeq = 0;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
  ) {}

  setPostHandle(handle: PostHandle): void {
    this.postHandle = handle;
  }

  setEditorMode(enabled: boolean): void {
    this.editorMode = enabled;
    if (this.envLightHelperGroup) {
      this.envLightHelperGroup.visible =
        enabled && this.studioSceneElementsVisible;
    }
    if (this.orbitCenterHandle) {
      this.orbitCenterHandle.group.visible = enabled;
    }
    if (this.sceneSectionRuntime) {
      const helperVisible =
        this.lastSceneSectionStyle.sceneSectionHelperVisible !== false;
      this.sceneSectionRuntime.group.visible =
        enabled &&
        this.lastSceneSectionStyle.sceneSectionEnabled === true &&
        helperVisible;
    }
    if (this.publicSurfaceClipRuntime) {
      this.publicSurfaceClipRuntime.group.visible =
        enabled && this.publicSurfaceClippingActive;
    }
    if (this.workingAreaFocusRuntime) {
      const focusState = this.workingAreaFocusState(
        this.lastWorkingAreaFocusStyle,
      );
      this.workingAreaFocusRuntime.group.visible =
        enabled && focusState.enabled && focusState.helperVisible;
    }
    this.updateAreaOutlineHandleVisibility();
    this.updatePageCameraMarkerVisibility();
  }

  private applySunDirectionToRuntime(): void {
    if (this.envKeyLight) {
      this.envKeyLight.position.copy(this.currentSunDir).multiplyScalar(8000);
      this.envKeyLight.target.position.set(0, 0, 0);
      this.envKeyLight.target.updateMatrixWorld();
    }

    const terrainGroup = this.layers.get("terrain");
    if (terrainGroup) {
      terrainGroup.traverse((obj) => {
        const handle = (obj as THREE.Mesh).userData?.terrainHandle as
          | TerrainMaterialHandle
          | undefined;
        handle?.setSunDirection(this.currentSunDir);
      });
    }
  }

  private requestCameraSunCapture(worldDir: THREE.Vector3): void {
    this.pendingCameraSunWorldDir.copy(worldDir).normalize();
    this.pendingCameraSunCapture = true;
  }

  private setEffectiveSunLockToCamera(enabled: boolean): void {
    if (enabled === this.sunLockToCamera) return;
    this.sunLockToCamera = enabled;
    this.pendingCameraSunCapture = false;

    if (enabled) {
      this.requestCameraSunCapture(this.currentSunDir);
      return;
    }

    this.currentSunDir.copy(this.authoredWorldSunDir);
    this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
    this.applySunDirectionToRuntime();
  }

  private updateCameraLockedSun(camera: THREE.Camera): void {
    if (!this.sunLockToCamera) return;

    this.cameraSunRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.cameraSunUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.cameraSunBack.set(0, 0, 1).applyQuaternion(camera.quaternion);

    if (this.pendingCameraSunCapture) {
      this.cameraLocalSunDir.set(
        this.pendingCameraSunWorldDir.dot(this.cameraSunRight),
        this.pendingCameraSunWorldDir.dot(this.cameraSunBack),
        this.pendingCameraSunWorldDir.dot(this.cameraSunUp),
      );
      if (this.cameraLocalSunDir.lengthSq() < 0.000001) {
        this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
      } else {
        this.cameraLocalSunDir.normalize();
      }
      this.pendingCameraSunCapture = false;
    }

    this.currentSunDir
      .copy(this.cameraSunRight)
      .multiplyScalar(this.cameraLocalSunDir.x)
      .addScaledVector(this.cameraSunBack, this.cameraLocalSunDir.y)
      .addScaledVector(this.cameraSunUp, this.cameraLocalSunDir.z)
      .normalize();
    this.applySunDirectionToRuntime();
  }

  private setStudioSceneElementsVisible(enabled: boolean): void {
    this.studioSceneElementsVisible = enabled;
    if (this.envLightHelperGroup) {
      this.envLightHelperGroup.visible = this.editorMode && enabled;
    }
  }

  private clearLightingStudioSources(): void {
    for (const light of this.envCustomLights) {
      this.scene.remove(light);
      (light as { dispose?: () => void }).dispose?.();
    }
    for (const target of this.envCustomLightTargets) {
      this.scene.remove(target);
    }
    this.envCustomLights = [];
    this.envCustomLightTargets = [];
    this.envLightRuntimes.clear();
    this.envLightHandles.clear();
    this.envLightHandlePickables = [];
    if (this.envLightHelperGroup) {
      this.scene.remove(this.envLightHelperGroup);
      disposeObjectTree(this.envLightHelperGroup);
      this.envLightHelperGroup = null;
    }
  }

  private lightingHandleKey(
    sourceId: string,
    kind: LightingHandleKind,
  ): string {
    return `${sourceId}:${kind}`;
  }

  private makeLightingHandleMaterial(
    color: THREE.ColorRepresentation,
    opacity = 0.92,
  ): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(mat);
    return mat;
  }

  private markLightingPickable(
    obj: THREE.Object3D,
    sourceId: string,
    kind: LightingHandleKind,
    mode: LightingHandleMode,
    pickables: THREE.Object3D[],
  ): void {
    obj.userData.lightingHandle = true;
    obj.userData.lightingSourceId = sourceId;
    obj.userData.lightingHandleKind = kind;
    obj.userData.lightingHandleMode = mode;
    obj.renderOrder = 4500;
    pickables.push(obj);
  }

  private addLightingStudioHandle(
    sourceId: string,
    kind: LightingHandleKind,
    position: THREE.Vector3,
    color: THREE.Color,
    helperGroup: THREE.Group,
  ): void {
    const group = new THREE.Group();
    group.name = `lighting-handle-${kind}-${sourceId}`;
    group.position.copy(position);
    group.renderOrder = 4500;

    const pickables: THREE.Object3D[] = [];
    const scale = kind === "target" ? 0.68 : 1;
    const axisLength = 720 * scale;
    const coneLength = 150 * scale;
    const axisRadius = 16 * scale;
    const ringRadius = 360 * scale;
    const coreRadius = 120 * scale;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius, 18, 12),
      this.makeLightingHandleMaterial(color, kind === "target" ? 0.45 : 0.55),
    );
    this.markLightingPickable(core, sourceId, kind, "plane", pickables);
    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 9 * scale, 8, 72),
      this.makeLightingHandleMaterial("#ffffff", 0.72),
    );
    this.markLightingPickable(ring, sourceId, kind, "plane", pickables);
    group.add(ring);

    const addAxis = (
      axis: "x" | "y" | "z",
      axisColor: THREE.ColorRepresentation,
    ) => {
      const mode: LightingHandleMode = axis === "z" ? "height" : "plane";
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeLightingHandleMaterial(axisColor, 0.88),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(48 * scale, coneLength, 18),
        this.makeLightingHandleMaterial(axisColor, 0.92),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markLightingPickable(shaft, sourceId, kind, mode, pickables);
      this.markLightingPickable(head, sourceId, kind, mode, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const labelColor = kind === "target" ? "#ffcc66" : "#ffffff";
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(185 * scale, 7 * scale, 8, 48),
      this.makeLightingHandleMaterial(
        labelColor,
        kind === "target" ? 0.85 : 0.35,
      ),
    );
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.z = 8 * scale;
    this.markLightingPickable(targetRing, sourceId, kind, "plane", pickables);
    group.add(targetRing);

    helperGroup.add(group);
    hardenStudioHelperTree(group);
    const runtime: LightingHandleRuntime = { sourceId, kind, group, pickables };
    this.envLightHandles.set(this.lightingHandleKey(sourceId, kind), runtime);
    this.envLightHandlePickables.push(...pickables);
  }

  private updateLightingStudioHelpers(): void {
    if (!this.envLightHelperGroup) return;
    this.envLightHelperGroup.traverse((obj) => {
      (obj as { update?: () => void }).update?.();
    });
    hardenStudioHelperTree(this.envLightHelperGroup);
  }

  private makeOrbitCenterMaterial(
    color: THREE.ColorRepresentation,
    opacity = 0.9,
  ): THREE.MeshStandardMaterial {
    const tint = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint.clone().multiplyScalar(0.28),
      emissiveIntensity: 0.18,
      roughness: 0.46,
      metalness: 0.08,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    mat.side = THREE.DoubleSide;
    hardenStudioHelperMaterial(mat);
    return mat;
  }

  private markOrbitCenterPickable(
    obj: THREE.Object3D,
    mode: OrbitCenterHandleMode,
    pickables: THREE.Object3D[],
  ): void {
    obj.userData.dynamicCameraOrbitCenter = true;
    obj.userData.dynamicCameraOrbitCenterMode = mode;
    obj.renderOrder = 4520;
    pickables.push(obj);
  }

  private markPageCameraPickable(
    obj: THREE.Object3D,
    pickables: THREE.Object3D[],
    id: string,
    kind: "current" | "global",
  ): void {
    obj.userData.pageCameraMarker = true;
    obj.userData.pageCameraMarkerId = id;
    obj.userData.pageCameraMarkerKind = kind;
    obj.renderOrder = 4540;
    pickables.push(obj);
  }

  private createPageCameraLabel(
    text = "Camera",
    accentColor = "rgba(48, 48, 48, 0.22)",
    fillColor = "rgba(255, 255, 255, 0.92)",
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 104;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fillColor;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 7;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
      let fontSize = 27;
      const fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      while (fontSize > 17 && ctx.measureText(text).width > 420) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, 47);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(material);
    const sprite = new THREE.Sprite(material);
    sprite.name = "page-camera-label";
    sprite.renderOrder = 4540;
    return sprite;
  }

  private createPageCameraMarker(
    pose: Pose,
    opts: {
      id: string;
      kind: "current" | "global";
      label: string;
      color?: string;
      fillColor?: string;
      labelBaseWidth?: number;
      labelBaseHeight?: number;
      labelLift?: number;
    },
  ): PageCameraMarkerRuntime {
    const group = new THREE.Group();
    group.name = `__page_camera_marker_${opts.kind}_${opts.id}__`;
    group.visible = this.editorMode;
    group.renderOrder = 4540;

    const pickables: THREE.Object3D[] = [];
    const labelStroke =
      opts.kind === "global"
        ? (opts.color ?? "rgba(48, 48, 48, 0.22)")
        : "rgba(48, 48, 48, 0.22)";
    const label = this.createPageCameraLabel(
      opts.label,
      labelStroke,
      opts.fillColor,
    );
    this.markPageCameraPickable(label, pickables, opts.id, opts.kind);
    group.add(label);

    const lineMaterial = new THREE.LineDashedMaterial({
      color: opts.color ?? "#ffffff",
      transparent: true,
      opacity: 0.82,
      dashSize: 120,
      gapSize: 72,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(lineMaterial);
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);
    line.name = "page-camera-to-target-line";
    line.renderOrder = 4538;
    group.add(line);

    this.scene.add(group);
    const runtime = {
      group,
      pickables,
      line,
      label,
      targetLocal: new THREE.Vector3(),
      labelBaseWidth: opts.labelBaseWidth ?? 520,
      labelBaseHeight: opts.labelBaseHeight ?? 106,
      labelLift: opts.labelLift ?? 250,
    };
    this.updatePageCameraMarkerPose(runtime, pose);
    return runtime;
  }

  private updatePageCameraMarkerLine(marker: PageCameraMarkerRuntime): void {
    const start = marker.label.position;
    const end = marker.targetLocal;
    const positionAttribute = marker.line.geometry.getAttribute("position");
    if (
      positionAttribute instanceof THREE.BufferAttribute &&
      positionAttribute.count >= 2
    ) {
      positionAttribute.setXYZ(0, start.x, start.y, start.z);
      positionAttribute.setXYZ(1, end.x, end.y, end.z);
      positionAttribute.needsUpdate = true;
      marker.line.geometry.computeBoundingSphere();
    } else {
      marker.line.geometry.dispose();
      marker.line.geometry = new THREE.BufferGeometry().setFromPoints([
        start.clone(),
        end.clone(),
      ]);
    }
    marker.line.computeLineDistances();
  }

  private updatePageCameraMarkerPose(
    marker: PageCameraMarkerRuntime,
    pose: Pose,
  ): void {
    const position = new THREE.Vector3(...pose.position);
    const target = new THREE.Vector3(...pose.target);
    marker.group.position.copy(position);
    marker.label.position.set(0, 0, marker.labelLift);
    marker.targetLocal.copy(target.sub(position));
    this.updatePageCameraMarkerLine(marker);
    hardenStudioHelperTree(marker.group);
  }

  private updatePageCameraMarkerVisibility(): void {
    const showGlobal = this.editorMode && this.globalPageCameraMarkers.size > 0;
    for (const marker of this.globalPageCameraMarkers.values()) {
      marker.group.visible = showGlobal;
    }
    if (this.pageCameraMarker) {
      this.pageCameraMarker.group.visible = this.editorMode && !showGlobal;
    }
  }

  private createOrbitCenterHandle(
    position: THREE.Vector3,
  ): OrbitCenterHandleRuntime {
    const group = new THREE.Group();
    group.name = "__dynamic_camera_orbit_center__";
    group.position.copy(position);
    group.visible = this.editorMode;
    group.renderOrder = 4520;

    const pickables: THREE.Object3D[] = [];
    const ringRadius = 150;
    const innerRadius = 78;
    const axisLength = 260;
    const coneLength = 60;
    const axisRadius = 6;
    const ringZ = 16;

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 5, 8, 72),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    halo.position.z = ringZ;
    this.markOrbitCenterPickable(halo, "plane", pickables);

    const directionArrow = new THREE.Mesh(
      new THREE.ConeGeometry(18, 38, 3),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    directionArrow.position.set(ringRadius, 0, ringZ);
    this.markOrbitCenterPickable(directionArrow, "plane", pickables);

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(innerRadius, 4, 8, 64),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    inner.position.z = 18;
    this.markOrbitCenterPickable(inner, "plane", pickables);

    const addAxis = (
      axis: OrbitCenterHandleMode,
      axisColor: THREE.ColorRepresentation,
    ) => {
      if (axis === "plane") return;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(22, coneLength, 18),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markOrbitCenterPickable(shaft, axis, pickables);
      this.markOrbitCenterPickable(head, axis, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const cameraIcon = new THREE.Group();
    cameraIcon.name = "dynamic-camera-orbit-center-camera-icon";
    cameraIcon.position.set(0, -205, 122);
    const iconMaterial = this.makeOrbitCenterMaterial("#ffffff", 0.8);
    const iconBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 58, 34),
      iconMaterial,
    );
    const iconPrism = new THREE.Mesh(
      new THREE.BoxGeometry(8, 24, 12),
      iconMaterial,
    );
    iconPrism.position.set(0, -8, 23);
    const iconLens = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 8, 24),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    iconLens.rotation.z = Math.PI / 2;
    iconLens.position.set(-6, 8, 0);
    cameraIcon.add(iconBody, iconPrism, iconLens);

    group.add(halo, directionArrow, inner, cameraIcon);
    hardenStudioHelperTree(group);
    this.scene.add(group);
    return { group, pickables, directionArrow };
  }

  private updateOrbitCenterDirection(direction: 1 | -1): void {
    if (!this.orbitCenterHandle) return;
    this.orbitCenterHandle.directionArrow.rotation.z =
      direction === -1 ? Math.PI : 0;
  }

  setDynamicCameraOrbitCenter(point: Vec3 | null, direction: 1 | -1 = 1): void {
    if (!point) {
      if (this.orbitCenterHandle) {
        this.scene.remove(this.orbitCenterHandle.group);
        disposeObjectTree(this.orbitCenterHandle.group);
        this.orbitCenterHandle = null;
      }
      return;
    }
    const position = new THREE.Vector3(point[0], point[1], point[2]);
    if (!this.orbitCenterHandle) {
      this.orbitCenterHandle = this.createOrbitCenterHandle(position);
      this.updateOrbitCenterDirection(direction);
      return;
    }
    this.orbitCenterHandle.group.position.copy(position);
    this.orbitCenterHandle.group.visible = this.editorMode;
    this.updateOrbitCenterDirection(direction);
  }

  listDynamicCameraOrbitCenterPickables(): THREE.Object3D[] {
    return this.editorMode && this.orbitCenterHandle
      ? this.orbitCenterHandle.pickables
      : [];
  }

  getDynamicCameraOrbitCenter(): THREE.Vector3 | null {
    return this.orbitCenterHandle
      ? this.orbitCenterHandle.group.position.clone()
      : null;
  }

  previewDynamicCameraOrbitCenter(position: THREE.Vector3): void {
    if (!this.orbitCenterHandle) {
      this.orbitCenterHandle = this.createOrbitCenterHandle(position);
      return;
    }
    this.orbitCenterHandle.group.position.copy(position);
  }

  setPageCameraMarker(pose: Pose | null): void {
    if (!pose) {
      if (this.pageCameraMarker) {
        this.scene.remove(this.pageCameraMarker.group);
        disposeObjectTree(this.pageCameraMarker.group);
        this.pageCameraMarker = null;
      }
      return;
    }
    if (!this.pageCameraMarker) {
      this.pageCameraMarker = this.createPageCameraMarker(pose, {
        id: "__current_page_camera__",
        kind: "current",
        label: "Camera",
        color: "#ffffff",
      });
      this.updatePageCameraMarkerVisibility();
      return;
    }
    this.updatePageCameraMarkerPose(this.pageCameraMarker, pose);
    this.updatePageCameraMarkerVisibility();
  }

  setGlobalPageCameraMarkers(markers: PageCameraMarkerSpec[] | null): void {
    for (const marker of this.globalPageCameraMarkers.values()) {
      this.scene.remove(marker.group);
      disposeObjectTree(marker.group);
    }
    this.globalPageCameraMarkers.clear();
    if (!markers || markers.length === 0) {
      this.updatePageCameraMarkerVisibility();
      return;
    }
    for (const marker of markers) {
      const runtime = this.createPageCameraMarker(marker.pose, {
        id: marker.id,
        kind: "global",
        label: marker.title,
        color: marker.color,
        fillColor: marker.color,
        labelBaseWidth: 760,
        labelBaseHeight: 154,
        labelLift: 270,
      });
      this.globalPageCameraMarkers.set(marker.id, runtime);
    }
    this.updatePageCameraMarkerVisibility();
  }

  listPageCameraMarkerPickables(): THREE.Object3D[] {
    if (!this.editorMode) return [];
    const pickables: THREE.Object3D[] = [];
    if (this.pageCameraMarker?.group.visible) {
      pickables.push(...this.pageCameraMarker.pickables);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible) pickables.push(...marker.pickables);
    }
    return pickables;
  }

  private addLightingStudioSource(
    source: PresentationLightSource,
    helperGroup: THREE.Group,
  ): void {
    if (source.enabled === false) return;
    const color = new THREE.Color(source.color ?? "#ffffff");
    const [px, py, pz] = source.position ?? [0, -3500, 2500];
    const [tx, ty, tz] = source.target ?? [0, 0, 0];
    const type = source.type ?? "spot";
    const intensity =
      (source.intensity ?? 1) * (source.gain ?? presentationLightGain(type));

    if (type === "point") {
      const light = new THREE.PointLight(
        color,
        intensity,
        source.distance ?? 9000,
        source.decay ?? 1.6,
      );
      light.position.set(px, py, pz);
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.PointLightHelper(light, 300, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "area") {
      ensureRectAreaLights();
      const light = new THREE.RectAreaLight(
        color,
        intensity,
        source.width ?? 1600,
        source.height ?? 900,
      );
      light.position.set(px, py, pz);
      light.lookAt(tx, ty, tz);
      light.name = source.label ?? source.id;
      const target = new THREE.Object3D();
      target.position.set(tx, ty, tz);
      target.name = `${source.id}-target`;
      this.scene.add(target);
      this.envCustomLightTargets.push(target);
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new RectAreaLightHelper(light);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, target, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        target.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "directional") {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(px, py, pz);
      light.target.position.set(tx, ty, tz);
      this.scene.add(light.target);
      this.envCustomLightTargets.push(light.target);
      light.target.updateMatrixWorld();
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.DirectionalLightHelper(light, 650, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, {
        type,
        light,
        target: light.target,
        helper,
      });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        light.target.position,
        color,
        helperGroup,
      );
      return;
    }

    const light = new THREE.SpotLight(
      color,
      intensity,
      source.distance ?? 12000,
      THREE.MathUtils.degToRad(source.angle ?? 24),
      source.penumbra ?? 0.35,
      source.decay ?? 1.4,
    );
    light.position.set(px, py, pz);
    light.target.position.set(tx, ty, tz);
    this.scene.add(light.target);
    this.envCustomLightTargets.push(light.target);
    light.target.updateMatrixWorld();
    light.castShadow = false;
    light.name = source.label ?? source.id;
    this.scene.add(light);
    this.envCustomLights.push(light);
    const helper = new THREE.SpotLightHelper(light, color);
    helper.update();
    hardenStudioHelperTree(helper);
    helperGroup.add(helper);
    this.envLightRuntimes.set(source.id, {
      type,
      light,
      target: light.target,
      helper,
    });
    this.addLightingStudioHandle(
      source.id,
      "position",
      light.position,
      color,
      helperGroup,
    );
    this.addLightingStudioHandle(
      source.id,
      "target",
      light.target.position,
      color,
      helperGroup,
    );
  }

  listLightingHandlePickables(): THREE.Object3D[] {
    return this.editorMode && this.studioSceneElementsVisible
      ? this.envLightHandlePickables
      : [];
  }

  getLightingHandlePosition(
    sourceId: string,
    kind: LightingHandleKind,
  ): THREE.Vector3 | null {
    const handle = this.envLightHandles.get(
      this.lightingHandleKey(sourceId, kind),
    );
    return handle ? handle.group.position.clone() : null;
  }

  previewLightingHandle(
    sourceId: string,
    kind: LightingHandleKind,
    position: THREE.Vector3,
  ): void {
    const handle = this.envLightHandles.get(
      this.lightingHandleKey(sourceId, kind),
    );
    const runtime = this.envLightRuntimes.get(sourceId);
    if (!handle || !runtime) return;
    handle.group.position.copy(position);
    if (kind === "position") {
      runtime.light.position.copy(position);
      if (runtime.type === "area" && runtime.target) {
        runtime.light.lookAt(runtime.target.position);
      }
    } else if (runtime.target) {
      runtime.target.position.copy(position);
      runtime.target.updateMatrixWorld();
      if (runtime.type === "area") {
        runtime.light.lookAt(position);
      }
    }
    this.updateLightingStudioHelpers();
  }

  registerLayer(id: string): THREE.Group {
    if (this.layers.has(id)) {
      console.warn(`[SceneManager] layer "${id}" already registered`);
      return this.layers.get(id)!;
    }
    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    this.scene.add(group);
    this.layers.set(id, group);
    return group;
  }

  setVisible(nextVisible: ReadonlySet<string>): void {
    this.currentVisibleLayerIds = nextVisible;
    for (const [id, group] of this.layers) {
      group.visible = nextVisible.has(id);
    }
    for (const id of Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES)) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id));
    }
    this.applyTopoGraticuleStyle(
      UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
      this.styleForLayer(UTAH_FORGE_TOPO_GRATICULE_LAYER_ID),
    );
    this.reapplySceneSectionPlanes();
    this.reapplyWorkingAreaFocus();
  }

  private targetOpacityForLayer(
    environment: EnvironmentSetup,
    page: PresentationPage,
    layerId: string,
  ): number {
    const visible = effectiveVisibility(environment, page).has(layerId);
    if (!visible) return 0;
    const style = effectiveStyle(environment, page, layerId);
    return typeof style.opacity === "number"
      ? style.opacity
      : this.baseOpacityForLayer(layerId);
  }

  private baseOpacityForMaterial(material: THREE.Material): number {
    const stored = this.materialBaseOpacity.get(material);
    if (typeof stored === "number") return stored;
    this.materialBaseOpacity.set(material, material.opacity);
    return material.opacity;
  }

  private baseOpacityForLayer(id: string): number {
    const group = this.layers.get(id);
    if (!group) return 1;
    let opacity: number | null = null;
    group.traverse((obj) => {
      if (opacity !== null) return;
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const first = Array.isArray(mat) ? mat[0] : mat;
      if (first) opacity = this.baseOpacityForMaterial(first);
    });
    return opacity ?? 1;
  }

  private currentRenderOpacityForTree(
    root: THREE.Object3D,
    fallback: number,
  ): number {
    if (!root.visible) return 0;
    let opacity: number | null = null;
    root.traverse((obj) => {
      if (!obj.visible) return;
      const mat = (
        obj as THREE.Object3D & {
          material?: THREE.Material | THREE.Material[];
        }
      ).material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const material of mats) {
        if (material.userData?.ignoreLayerStyle === true) continue;
        const shaderOpacity =
          material instanceof THREE.ShaderMaterial &&
          typeof material.uniforms?.uOpacity?.value === "number"
            ? material.uniforms.uOpacity.value
            : null;
        const next =
          typeof shaderOpacity === "number" && Number.isFinite(shaderOpacity)
            ? shaderOpacity
            : material.opacity;
        if (typeof next !== "number" || !Number.isFinite(next)) continue;
        opacity = Math.max(opacity ?? 0, next);
      }
    });
    return clamp01(opacity ?? fallback);
  }

  private captureLayerRenderStates(
    environment: EnvironmentSetup,
    page: PresentationPage,
    layerIds: ReadonlySet<string>,
  ): Map<string, ResolvedLayerRenderState> {
    const visibleSet = effectiveVisibility(environment, page);
    const states = new Map<string, ResolvedLayerRenderState>();
    for (const id of layerIds) {
      const fallbackStyle = effectiveStyle(environment, page, id);
      const appliedStyle = this.appliedLayerStyles.get(id) ?? fallbackStyle;
      const fallbackOpacity = visibleSet.has(id)
        ? this.targetOpacityForLayer(environment, page, id)
        : 0;
      const group = this.layers.get(id);
      const opacity = group
        ? this.currentRenderOpacityForTree(group, fallbackOpacity)
        : fallbackOpacity;
      const snapshot = this.layerTransitionSnapshots.get(id);
      const snapshotOpacity = snapshot
        ? this.currentRenderOpacityForTree(snapshot.group, snapshot.from)
        : 0;
      const useSnapshot =
        !!snapshot &&
        snapshotOpacity > opacity + 0.001 &&
        snapshot.style !== undefined;
      states.set(id, {
        id,
        visible: group
          ? (group.visible && opacity > 0.001) || snapshotOpacity > 0.001
          : visibleSet.has(id) && fallbackOpacity > 0.001,
        opacity: Math.max(opacity, snapshotOpacity),
        style: { ...(useSnapshot ? snapshot.style! : appliedStyle) },
      });
    }
    return states;
  }

  private applyRenderOpacityToTree(
    root: THREE.Object3D,
    opacity: number,
  ): void {
    const next = clamp01(opacity);
    root.visible = next > 0.001;
    root.traverse((obj) => {
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        this.baseOpacityForMaterial(m);
        m.opacity = next;
        m.transparent = m.userData?.forceTransparent === true || next < 1;
        if (m instanceof THREE.ShaderMaterial && m.uniforms.uOpacity) {
          m.uniforms.uOpacity.value = next;
        }
        if (m.userData?.terrainMaterial === true) {
          m.transparent = true;
          m.depthWrite = next >= 0.999;
        }
        m.needsUpdate = true;
      }
    });
  }

  private applyLayerRenderOpacity(id: string, opacity: number): void {
    const group = this.layers.get(id);
    const next = clamp01(opacity);
    if (!group) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
      return;
    }
    this.applyRenderOpacityToTree(group, next);
    this.applyTerrainCompositeOpacity(id, next);
    this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
  }

  private layerHasScalarPreviewData(group: THREE.Group): boolean {
    let found = false;
    group.traverse((obj) => {
      if (found) return;
      if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Points))
        return;
      const values = obj.geometry.userData.scalarValues as
        | Float32Array
        | number[]
        | undefined;
      found = !!values && values.length > 0;
    });
    return found;
  }

  private layerSupportsScalarStyleTween(
    id: string,
    group: THREE.Group,
  ): boolean {
    return (
      this.layerHasScalarPreviewData(group) ||
      id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
    );
  }

  private cloneTransitionUserData(
    userData: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(userData ?? {})) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        next[key] = value;
      } else if (
        Array.isArray(value) &&
        value.every(
          (item) =>
            item === null ||
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
      ) {
        next[key] = [...value];
      }
    }
    return next;
  }

  private cloneTransitionGeometry(
    geometry: THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    const originalUserData = geometry.userData;
    geometry.userData = {};
    try {
      const clone = geometry.clone();
      clone.userData = {};
      return clone;
    } finally {
      geometry.userData = originalUserData;
    }
  }

  private cloneTransitionMaterial(material: THREE.Material): THREE.Material {
    const originalUserData = material.userData;
    material.userData = this.cloneTransitionUserData(originalUserData);
    try {
      const clone = material.clone();
      clone.userData = this.cloneTransitionUserData(originalUserData);
      return clone;
    } finally {
      material.userData = originalUserData;
    }
  }

  private cloneTransitionObjectTree(
    id: string,
    source: THREE.Object3D,
  ): THREE.Object3D {
    const originalUserData = source.userData;
    source.userData = this.cloneTransitionUserData(originalUserData);
    let snapshot: THREE.Object3D;
    try {
      snapshot = source.clone(false);
    } finally {
      source.userData = originalUserData;
    }
    snapshot.userData = {
      ...this.cloneTransitionUserData(originalUserData),
      transitionSnapshotForLayer: id,
    };
    const sourceRenderable = source as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    const snapshotRenderable = snapshot as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (sourceRenderable.geometry) {
      snapshotRenderable.geometry = this.cloneTransitionGeometry(
        sourceRenderable.geometry,
      );
    }
    if (sourceRenderable.material) {
      snapshotRenderable.material = Array.isArray(sourceRenderable.material)
        ? sourceRenderable.material.map((material) =>
            this.cloneTransitionMaterial(material),
          )
        : this.cloneTransitionMaterial(sourceRenderable.material);
    }
    for (const child of source.children) {
      snapshot.add(this.cloneTransitionObjectTree(id, child));
    }
    return snapshot;
  }

  private cloneLayerTransitionSnapshot(
    id: string,
    source: THREE.Group,
  ): THREE.Group {
    const snapshot = this.cloneTransitionObjectTree(id, source) as THREE.Group;
    snapshot.name = `${id}-transition-snapshot`;
    snapshot.userData = {
      ...snapshot.userData,
      transitionSnapshotForLayer: id,
    };
    this.scene.add(snapshot);
    return snapshot;
  }

  private removeLayerTransitionSnapshot(id: string): void {
    const snapshot = this.layerTransitionSnapshots.get(id);
    if (!snapshot) return;
    this.layerTransitionSnapshots.delete(id);
    snapshot.group.parent?.remove(snapshot.group);
    disposeObjectTree(snapshot.group);
  }

  private clearLayerTransitionSnapshots(): void {
    for (const id of Array.from(this.layerTransitionSnapshots.keys())) {
      this.removeLayerTransitionSnapshot(id);
    }
  }

  private applyTerrainCompositeOpacity(layerId: string, opacity: number): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.layers.get("terrain");
    if (!terrainGroup) return;
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          handle.setLakeOpacity(opacity);
          break;
        case "three-firs-target":
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
  }

  private applyTerrainFogStyle(
    layerId: string,
    affectedByFog: boolean,
    fogDensity: number,
  ): void {
    if (
      layerId !== "terrain" &&
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.layers.get("terrain");
    if (!terrainGroup) return;
    const enabled = this.envFogEnabled && affectedByFog;
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "terrain":
          handle.setTerrainFogEnabled(enabled);
          handle.setTerrainFogDensity(fogDensity);
          break;
        case "hydrography-lakes":
          handle.setLakeFogEnabled(enabled);
          handle.setLakeFogDensity(fogDensity);
          break;
        case "three-firs-target":
          handle.setTargetFogEnabled("target-three-firs", enabled);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          break;
        case "great-plains-target":
          handle.setTargetFogEnabled("target-great-plains", enabled);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          break;
        case "claim-boundary":
          handle.setClaimFogEnabled(enabled);
          handle.setClaimFogDensity(fogDensity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(enabled);
          handle.setGeologyFogDensity(fogDensity);
          break;
        case "trees-vri":
          handle.setForestFogEnabled(enabled);
          handle.setForestFogDensity(fogDensity);
          break;
      }
    });
  }

  private styleForLayer(id: string): EditableStyle {
    const appliedStyle = this.appliedLayerStyles.get(id);
    if (appliedStyle) return appliedStyle;
    if (this.lastEffectiveEnv && this.lastEffectivePage) {
      return effectiveStyle(this.lastEffectiveEnv, this.lastEffectivePage, id);
    }
    return this.lastEnv?.layerStyles[id] ?? {};
  }

  private sceneSectionProductIds(style: EditableStyle): Set<string> {
    const seismic = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    const selected =
      typeof seismic?.userData.seismicSelectedProductId === "string"
        ? seismic.userData.seismicSelectedProductId
        : typeof style.seismicProductId === "string"
          ? style.seismicProductId
          : "";
    if (style.sceneSectionTargetScope === "all-visible") {
      const ids = new Set<string>();
      seismic?.traverse((obj) => {
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

  private sceneSectionLayerIds(style: EditableStyle): Set<string> {
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

  private resolveSceneSectionPlanes(
    style: EditableStyle,
  ): ResolvedSceneSectionPlane[] {
    const planes = style.sceneSectionPlanes ?? {};
    const axes: SceneSectionAxis[] = ["x", "y", "z"];
    return axes.map((axis) => {
      const plane = planes[axis] ?? {};
      const position =
        typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
          ? clampRange(plane.positionM, -250_000, 250_000)
          : SCENE_SECTION_DEFAULT_POSITIONS[axis];
      return {
        axis,
        enabled: plane.enabled === true,
        positionM: position,
        invert: plane.invert === true,
        normal: SCENE_SECTION_AXIS_NORMALS[axis].clone(),
      };
    });
  }

  private sceneSectionActivePlanes(
    style: EditableStyle,
  ): ResolvedSceneSectionPlane[] {
    if (style.sceneSectionEnabled !== true) return [];
    return this.resolveSceneSectionPlanes(style).filter(
      (plane) => plane.enabled,
    );
  }

  private sceneSectionObjectTargeted(
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

  private sceneSectionClippingPlanes(
    planes: ResolvedSceneSectionPlane[],
  ): THREE.Plane[] {
    const clippingPlanes: THREE.Plane[] = [];
    for (const plane of planes) {
      const position = plane.positionM;
      const normal = plane.invert
        ? plane.normal.clone()
        : plane.normal.clone().multiplyScalar(-1);
      const constant = plane.invert ? -position : position;
      clippingPlanes.push(new THREE.Plane(normal, constant));
    }
    return clippingPlanes;
  }

  private setSceneSectionUniforms(
    material: THREE.ShaderMaterial,
    planes: ResolvedSceneSectionPlane[],
    targeted: boolean,
  ): void {
    const uniforms = material.uniforms;
    const ensure = <T>(key: string, value: T) => {
      if (!uniforms[key]) uniforms[key] = { value };
      return uniforms[key] as { value: T };
    };
    ensure<number>("uSceneSectionEnabled", 0).value =
      targeted && planes.length > 0 ? 1 : 0;
    ensure<number>("uSceneSectionMode", 0).value = 0;
    ensure<number>("uSceneSectionPlaneCount", 0).value = targeted
      ? planes.length
      : 0;
    const normalUniform = ensure<THREE.Vector3[]>("uSceneSectionNormals", [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const positionUniform = ensure<number[]>(
      "uSceneSectionPositions",
      [0, 0, 0],
    );
    const thicknessUniform = ensure<number[]>(
      "uSceneSectionThickness",
      [1, 1, 1],
    );
    const invertUniform = ensure<number[]>("uSceneSectionInvert", [0, 0, 0]);
    const normals = normalUniform.value;
    const positions = positionUniform.value;
    const thickness = thicknessUniform.value;
    const invert = invertUniform.value;
    for (let i = 0; i < 3; i += 1) {
      const plane = planes[i];
      normals[i].copy(plane?.normal ?? new THREE.Vector3());
      positions[i] = plane?.positionM ?? 0;
      thickness[i] = 1;
      invert[i] = plane?.invert ? 1 : 0;
    }
  }

  private applySceneSectionMaterial(
    material: THREE.Material,
    planes: ResolvedSceneSectionPlane[],
    targeted: boolean,
    clippingPlanes: THREE.Plane[],
  ): void {
    if (material.userData?.sceneSectionHelper === true) return;
    const seismicShader =
      material instanceof THREE.ShaderMaterial &&
      (material.userData?.seismicRaymarchMaterial === true ||
        material.userData?.seismicSectionMaterial === true ||
        material.userData?.scalarVolumeRaymarchMaterial === true);
    if (seismicShader) {
      this.setSceneSectionUniforms(material, planes, targeted);
      material.needsUpdate = true;
      return;
    }
    const active = targeted && clippingPlanes.length > 0;
    const publicSurfaceClipPlanes = Array.isArray(
      material.userData?.publicSurfaceClipPlanes,
    )
      ? (material.userData.publicSurfaceClipPlanes as THREE.Plane[])
      : [];
    const combinedPlanes = active
      ? [...publicSurfaceClipPlanes, ...clippingPlanes]
      : publicSurfaceClipPlanes;
    material.clippingPlanes = combinedPlanes.length > 0 ? combinedPlanes : null;
    material.clipIntersection = false;
    material.needsUpdate = true;
  }

  private sceneSectionBounds(
    style: EditableStyle,
    layerTargets: Set<string>,
    productTargets: Set<string>,
  ): THREE.Box3 {
    const box = new THREE.Box3();
    for (const [layerId, group] of this.layers) {
      if (!group.visible) continue;
      group.updateMatrixWorld(true);
      group.traverse((obj) => {
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

  private ensureSceneSectionRuntime(): SceneSectionRuntime {
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

  private createSceneSectionLabel(text: string, color: string): THREE.Mesh {
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

  private rebuildSceneSectionHelpers(
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

    const helperVisible = style.sceneSectionHelperVisible !== false;
    runtime.group.visible =
      this.editorMode &&
      style.sceneSectionEnabled === true &&
      helperVisible &&
      planes.length > 0;
    if (!runtime.group.visible) return;

    const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const activeAxis =
      style.sceneSectionActiveAxis === "x" ||
      style.sceneSectionActiveAxis === "y" ||
      style.sceneSectionActiveAxis === "z"
        ? style.sceneSectionActiveAxis
        : "z";

    for (const plane of planes) {
      const color = SCENE_SECTION_AXIS_COLORS[plane.axis];
      const tangentA =
        plane.axis === "x"
          ? new THREE.Vector3(0, 1, 0)
          : plane.axis === "y"
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(1, 0, 0);
      const tangentB =
        plane.axis === "z"
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
      const width =
        plane.axis === "x" ? size.y : plane.axis === "y" ? size.x : size.x;
      const height =
        plane.axis === "x" ? size.z : plane.axis === "y" ? size.z : size.y;
      const paddedWidth = Math.max(
        SCENE_SECTION_MIN_HELPER_SIZE_M,
        width * SCENE_SECTION_HELPER_PADDING,
      );
      const paddedHeight = Math.max(
        SCENE_SECTION_MIN_HELPER_SIZE_M,
        height * SCENE_SECTION_HELPER_PADDING,
      );
      const halfWidth = paddedWidth * 0.5;
      const halfHeight = paddedHeight * 0.5;
      const planeCenter = center.clone();
      if (plane.axis === "x") {
        planeCenter.x = plane.positionM;
      } else if (plane.axis === "y") {
        planeCenter.y = plane.positionM;
      } else {
        planeCenter.z = plane.positionM;
      }
      const planeBasis = new THREE.Matrix4().makeBasis(
        tangentA,
        tangentB,
        plane.normal,
      );
      const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
        planeBasis,
      );

      const cornerA = planeCenter
        .clone()
        .addScaledVector(tangentA, -halfWidth)
        .addScaledVector(tangentB, -halfHeight);
      const cornerB = planeCenter
        .clone()
        .addScaledVector(tangentA, halfWidth)
        .addScaledVector(tangentB, -halfHeight);
      const cornerC = planeCenter
        .clone()
        .addScaledVector(tangentA, halfWidth)
        .addScaledVector(tangentB, halfHeight);
      const cornerD = planeCenter
        .clone()
        .addScaledVector(tangentA, -halfWidth)
        .addScaledVector(tangentB, halfHeight);
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
        cornerA,
        cornerB,
        cornerC,
        cornerD,
        cornerA,
      ]);
      const outlineMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: plane.axis === activeAxis ? 0.98 : 0.72,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      hardenStudioHelperMaterial(outlineMaterial);
      outlineMaterial.userData.sceneSectionHelper = true;
      const outline = new THREE.Line(outlineGeometry, outlineMaterial);
      outline.name = `${plane.axis.toUpperCase()} Section outline`;
      outline.userData.sceneSectionHelper = true;
      outline.renderOrder = SCENE_SECTION_RENDER_ORDER;
      runtime.group.add(outline);

      const controlGroup = new THREE.Group();
      controlGroup.name = `${plane.axis.toUpperCase()} Section push/pull controls`;
      controlGroup.position.copy(planeCenter);
      controlGroup.quaternion.copy(planeQuaternion);
      controlGroup.userData.sceneSectionHelper = true;
      controlGroup.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;

      const handleSpan = clampRange(
        Math.min(paddedWidth, paddedHeight) * 0.16,
        SCENE_SECTION_HANDLE_MIN_SPAN_M,
        SCENE_SECTION_HANDLE_MAX_SPAN_M,
      );
      const coneLength = clampRange(handleSpan * 1.12, 520, 1120);
      const coneRadius = coneLength * 0.52;
      const guideMaterial = new THREE.LineDashedMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: plane.axis === activeAxis ? 0.86 : 0.58,
        dashSize: Math.max(80, handleSpan * 0.18),
        gapSize: Math.max(55, handleSpan * 0.12),
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      hardenStudioHelperMaterial(guideMaterial);
      guideMaterial.userData.sceneSectionHelper = true;
      const guide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, -handleSpan),
          new THREE.Vector3(0, 0, handleSpan),
        ]),
        guideMaterial,
      );
      guide.name = `${plane.axis.toUpperCase()} Section push/pull guide`;
      guide.userData.sceneSectionHelper = true;
      guide.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;
      guide.computeLineDistances();
      controlGroup.add(guide);

      const makeHandle = (direction: 1 | -1): THREE.Mesh => {
        const handleMaterial = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: plane.axis === activeAxis ? 0.96 : 0.72,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        });
        hardenStudioHelperMaterial(handleMaterial);
        handleMaterial.userData.sceneSectionHelper = true;
        const handle = new THREE.Mesh(
          new THREE.ConeGeometry(coneRadius, coneLength, 3),
          handleMaterial,
        );
        handle.name = `${plane.axis.toUpperCase()} Section ${
          direction > 0 ? "push" : "pull"
        } handle`;
        handle.position.z = direction * handleSpan;
        handle.rotation.x = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        handle.userData.sceneSectionHelper = true;
        handle.userData.sceneSectionPlaneHandle = true;
        handle.userData.sceneSectionAxis = plane.axis;
        handle.userData.sceneSectionPlaneHandleKind = "push-pull";
        handle.userData.sceneSectionPlaneHandleDirection = direction;
        handle.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
        runtime.pickables.push(handle);
        return handle;
      };
      controlGroup.add(makeHandle(-1), makeHandle(1));
      runtime.group.add(controlGroup);
      runtime.planes.set(plane.axis, controlGroup);

      const label = this.createSceneSectionLabel(
        `${plane.axis.toUpperCase()} Section`,
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

  private applySceneSectionPlanes(style: EditableStyle): void {
    this.lastSceneSectionStyle = style;
    const planes = this.sceneSectionActivePlanes(style);
    const clippingPlanes = this.sceneSectionClippingPlanes(planes);
    const layerTargets = this.sceneSectionLayerIds(style);
    const productTargets = this.sceneSectionProductIds(style);
    this.sceneSectionClippingActive = planes.length > 0;
    this.updateRendererLocalClipping();

    for (const [layerId, group] of this.layers) {
      group.traverse((obj) => {
        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const targeted = this.sceneSectionObjectTargeted(
          layerId,
          obj,
          style,
          layerTargets,
          productTargets,
        );
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          this.applySceneSectionMaterial(m, planes, targeted, clippingPlanes);
        }
      });
    }
    this.rebuildSceneSectionHelpers(
      style,
      planes,
      layerTargets,
      productTargets,
    );
    this.updateMtVolumeCutIsoOverlays(
      this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID),
    );
    this.updateSeismicVolumeCutIsoOverlays(
      this.styleForLayer(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID),
    );
  }

  private reapplySceneSectionPlanes(): void {
    this.applySceneSectionPlanes(
      this.styleForLayer(UTAH_FORGE_SCENE_SECTION_LAYER_ID),
    );
  }

  listSceneSectionPlanePickables(): THREE.Object3D[] {
    return this.sceneSectionRuntime?.pickables ?? [];
  }

  getSceneSectionPlanePosition(axis: SceneSectionAxis): THREE.Vector3 | null {
    const obj = this.sceneSectionRuntime?.planes.get(axis);
    return obj ? obj.position.clone() : null;
  }

  getSceneSectionPlaneScalar(axis: SceneSectionAxis): number | null {
    const plane = this.resolveSceneSectionPlanes(
      this.lastSceneSectionStyle,
    ).find((candidate) => candidate.axis === axis);
    return plane ? plane.positionM : null;
  }

  previewSceneSectionPlane(axis: SceneSectionAxis, positionM: number): void {
    const style = this.lastSceneSectionStyle;
    const planes = style.sceneSectionPlanes ?? {};
    this.applySceneSectionPlanes({
      ...style,
      sceneSectionEnabled: true,
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: {
        ...planes,
        [axis]: {
          ...(planes[axis] ?? {}),
          enabled: true,
          positionM,
        },
      },
    });
  }

  private applyCaseStudyBDemoLayerAlias(
    id: string,
    style: EditableStyle,
    renderOpacity?: number,
  ): void {
    const alias = CASE_STUDY_B_DEMO_LAYER_ALIASES[id];
    if (!alias) return;
    const shell = this.layers.get(CASE_STUDY_B_DEMO_SHELL_LAYER_ID);
    if (!shell) return;

    const layerVisible = this.currentVisibleLayerIds
      ? this.currentVisibleLayerIds.has(id)
      : true;
    const layerOpacity =
      renderOpacity !== undefined
        ? clamp01(renderOpacity)
        : layerVisible
          ? clamp01(typeof style.opacity === "number" ? style.opacity : 1)
          : 0;
    const showLabels = style.showLabels !== false;

    shell.traverse((obj) => {
      const zoneId =
        typeof obj.userData?.demoZoneId === "string"
          ? obj.userData.demoZoneId
          : null;
      const matches =
        alias.all === true ||
        (zoneId !== null && alias.zoneIds?.includes(zoneId)) ||
        alias.objectNames?.includes(obj.name);
      if (!matches) return;

      const isLabelAnchor = obj.userData?.demoZoneLabelAnchor === true;
      obj.visible = isLabelAnchor
        ? layerOpacity > 0.001 && showLabels
        : layerOpacity > 0.001;

      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const material of mats) {
        if (typeof material.userData.caseBDemoBaseOpacity !== "number") {
          material.userData.caseBDemoBaseOpacity =
            typeof material.userData.demoBaseOpacity === "number"
              ? material.userData.demoBaseOpacity
              : this.baseOpacityForMaterial(material);
        }
        const baseOpacity = material.userData.caseBDemoBaseOpacity as number;
        const nextOpacity = clamp01(baseOpacity * layerOpacity);
        const colored = material as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        if (
          alias.applyColor !== false &&
          typeof style.color === "string" &&
          colored.color
        ) {
          colored.color.set(style.color);
          colored.emissive?.set(style.color);
        }
        material.opacity = nextOpacity;
        material.transparent =
          material.userData?.forceTransparent === true || nextOpacity < 1;
        material.needsUpdate = true;
      }
    });
  }

  private applyTerrainLiftStyle(layerId: string, style: EditableStyle): void {
    if (layerId !== "terrain" && !PUBLIC_SURFACE_LAYER_IDS.has(layerId)) return;
    const terrainStyle =
      layerId === "terrain" ? style : this.styleForLayer("terrain");
    const liftM = styleNumber(
      terrainStyle,
      "meshSurfaceLiftM",
      0,
      -12000,
      12000,
    );
    for (const publicLayerId of PUBLIC_SURFACE_LAYER_IDS) {
      const group = this.layers.get(publicLayerId);
      if (!group) continue;
      if (publicLayerId === "terrain") {
        group.traverse((obj) => {
          const terrainMesh = obj as THREE.Mesh;
          if (!terrainMesh.userData?.terrainHandle) return;
          const baseZ =
            typeof terrainMesh.userData.terrainBaseZ === "number"
              ? terrainMesh.userData.terrainBaseZ
              : terrainMesh.position.z;
          terrainMesh.userData.terrainBaseZ = baseZ;
          terrainMesh.position.z = baseZ;
        });
      }
      const baseZ =
        typeof group.userData.publicSurfaceBaseZ === "number"
          ? group.userData.publicSurfaceBaseZ
          : group.position.z;
      group.userData.publicSurfaceBaseZ = baseZ;
      group.position.z = baseZ + liftM;
      group.updateMatrixWorld(true);
    }
  }

  private updateRendererLocalClipping(): void {
    this.renderer.localClippingEnabled =
      this.sceneSectionClippingActive || this.publicSurfaceClippingActive;
  }

  private publicSurfaceClipBox(style: EditableStyle): PublicSurfaceClipBox {
    const sizeX = styleNumber(
      style,
      "publicSurfaceClipSizeX",
      PUBLIC_SURFACE_CLIP_DEFAULTS.sizeX,
      100,
      500_000,
    );
    const sizeY = styleNumber(
      style,
      "publicSurfaceClipSizeY",
      PUBLIC_SURFACE_CLIP_DEFAULTS.sizeY,
      100,
      500_000,
    );
    const sizeZ = styleNumber(
      style,
      "publicSurfaceClipSizeZ",
      PUBLIC_SURFACE_CLIP_DEFAULTS.sizeZ,
      100,
      50_000,
    );
    return {
      enabled: style.publicSurfaceClipEnabled === true,
      shape: style.publicSurfaceClipShape === "circle" ? "circle" : "box",
      center: new THREE.Vector3(
        styleNumber(
          style,
          "publicSurfaceClipCenterX",
          PUBLIC_SURFACE_CLIP_DEFAULTS.centerX,
          -300_000,
          300_000,
        ),
        styleNumber(
          style,
          "publicSurfaceClipCenterY",
          PUBLIC_SURFACE_CLIP_DEFAULTS.centerY,
          -300_000,
          300_000,
        ),
        styleNumber(
          style,
          "publicSurfaceClipCenterZ",
          PUBLIC_SURFACE_CLIP_DEFAULTS.centerZ,
          -20_000,
          30_000,
        ),
      ),
      halfSize: new THREE.Vector3(sizeX * 0.5, sizeY * 0.5, sizeZ * 0.5),
      rotationZRad: THREE.MathUtils.degToRad(
        styleNumber(
          style,
          "publicSurfaceClipRotationZDeg",
          PUBLIC_SURFACE_CLIP_DEFAULTS.rotationZDeg,
          -180,
          180,
        ),
      ),
    };
  }

  private publicSurfaceClipAxes(box: PublicSurfaceClipBox): {
    xAxis: THREE.Vector3;
    yAxis: THREE.Vector3;
    zAxis: THREE.Vector3;
  } {
    const c = Math.cos(box.rotationZRad);
    const s = Math.sin(box.rotationZRad);
    return {
      xAxis: new THREE.Vector3(c, s, 0),
      yAxis: new THREE.Vector3(-s, c, 0),
      zAxis: new THREE.Vector3(0, 0, 1),
    };
  }

  private publicSurfaceClipPlanes(box: PublicSurfaceClipBox): THREE.Plane[] {
    const { xAxis, yAxis, zAxis } = this.publicSurfaceClipAxes(box);
    const makePlane = (
      normal: THREE.Vector3,
      axis: THREE.Vector3,
      distance: number,
    ) => {
      const point = box.center.clone().addScaledVector(axis, distance);
      return new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal.clone(),
        point,
      );
    };
    const zPlanes = [
      makePlane(zAxis.clone().negate(), zAxis, box.halfSize.z),
      makePlane(zAxis, zAxis, -box.halfSize.z),
    ];
    if (box.shape === "circle") {
      const radius = Math.min(box.halfSize.x, box.halfSize.y);
      const radialPlanes: THREE.Plane[] = [];
      for (let i = 0; i < PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS; i += 1) {
        const theta = (i / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
        const outward = xAxis
          .clone()
          .multiplyScalar(Math.cos(theta))
          .addScaledVector(yAxis, Math.sin(theta))
          .normalize();
        const point = box.center.clone().addScaledVector(outward, radius);
        radialPlanes.push(
          new THREE.Plane().setFromNormalAndCoplanarPoint(
            outward.clone().negate(),
            point,
          ),
        );
      }
      return [...radialPlanes, ...zPlanes];
    }
    return [
      makePlane(xAxis.clone().negate(), xAxis, box.halfSize.x),
      makePlane(xAxis, xAxis, -box.halfSize.x),
      makePlane(yAxis.clone().negate(), yAxis, box.halfSize.y),
      makePlane(yAxis, yAxis, -box.halfSize.y),
      ...zPlanes,
    ];
  }

  private publicSurfaceClipSegmentPositions(
    box: PublicSurfaceClipBox,
  ): number[] {
    const { xAxis, yAxis, zAxis } = this.publicSurfaceClipAxes(box);
    if (box.shape === "circle") {
      const positions: number[] = [];
      const radius = Math.min(box.halfSize.x, box.halfSize.y);
      const point = (theta: number, zSign: number) =>
        box.center
          .clone()
          .addScaledVector(xAxis, Math.cos(theta) * radius)
          .addScaledVector(yAxis, Math.sin(theta) * radius)
          .addScaledVector(zAxis, zSign * box.halfSize.z);
      for (let i = 0; i < PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS; i += 1) {
        const a = (i / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
        const b = ((i + 1) / PUBLIC_SURFACE_CLIP_CIRCLE_SEGMENTS) * Math.PI * 2;
        const bottomA = point(a, -1);
        const bottomB = point(b, -1);
        const topA = point(a, 1);
        const topB = point(b, 1);
        positions.push(
          bottomA.x,
          bottomA.y,
          bottomA.z,
          bottomB.x,
          bottomB.y,
          bottomB.z,
          topA.x,
          topA.y,
          topA.z,
          topB.x,
          topB.y,
          topB.z,
        );
        if (i % 6 === 0) {
          positions.push(
            bottomA.x,
            bottomA.y,
            bottomA.z,
            topA.x,
            topA.y,
            topA.z,
          );
        }
      }
      return positions;
    }
    const corner = (sx: number, sy: number, sz: number) =>
      box.center
        .clone()
        .addScaledVector(xAxis, sx * box.halfSize.x)
        .addScaledVector(yAxis, sy * box.halfSize.y)
        .addScaledVector(zAxis, sz * box.halfSize.z);
    const corners = [
      corner(-1, -1, -1),
      corner(1, -1, -1),
      corner(1, 1, -1),
      corner(-1, 1, -1),
      corner(-1, -1, 1),
      corner(1, -1, 1),
      corner(1, 1, 1),
      corner(-1, 1, 1),
    ];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ] as const;
    return edges.flatMap(([a, b]) => [
      corners[a].x,
      corners[a].y,
      corners[a].z,
      corners[b].x,
      corners[b].y,
      corners[b].z,
    ]);
  }

  private ensurePublicSurfaceClipRuntime(): PublicSurfaceClipRuntime {
    if (this.publicSurfaceClipRuntime) return this.publicSurfaceClipRuntime;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([]);
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: 2.2,
      worldUnits: false,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      dashed: false,
    });
    material.fog = false;
    material.userData.forceTransparent = true;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    const line = new LineSegments2(geometry, material);
    line.name = "Public surface clipping box";
    line.renderOrder = PUBLIC_SURFACE_CLIP_RENDER_ORDER;
    line.userData.publicSurfaceClipHelper = true;
    const group = new THREE.Group();
    group.name = "__public_surface_clip_box__";
    group.visible = false;
    group.userData.publicSurfaceClipHelper = true;
    group.add(line);
    this.scene.add(group);
    this.publicSurfaceClipRuntime = { group, line };
    return this.publicSurfaceClipRuntime;
  }

  private rebuildPublicSurfaceClipHelper(box: PublicSurfaceClipBox): void {
    const runtime = this.ensurePublicSurfaceClipRuntime();
    runtime.group.visible = this.editorMode && box.enabled;
    if (!box.enabled) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(this.publicSurfaceClipSegmentPositions(box));
    runtime.line.geometry.dispose();
    runtime.line.geometry = geometry;
    runtime.line.computeLineDistances();
  }

  private applyPublicSurfaceClipStyle(style: EditableStyle): void {
    const box = this.publicSurfaceClipBox(style);
    const planes = box.enabled ? this.publicSurfaceClipPlanes(box) : [];
    this.publicSurfaceClippingActive = box.enabled;
    this.updateRendererLocalClipping();

    for (const layerId of PUBLIC_SURFACE_LAYER_IDS) {
      const group = this.layers.get(layerId);
      if (!group) continue;
      const graticuleUsesTerrainEdgeFrame =
        layerId === UTAH_FORGE_TOPO_GRATICULE_LAYER_ID &&
        this.styleForLayer(layerId).graticuleEdgeFadeAware !== false;
      group.traverse((obj) => {
        const handle = (obj as THREE.Mesh).userData?.terrainHandle as
          | TerrainMaterialHandle
          | undefined;
        handle?.setPublicClip(
          box.enabled,
          box.shape,
          box.center,
          box.halfSize,
          box.rotationZRad,
        );

        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          if (m.userData?.publicSurfaceClipHelper === true) continue;
          const terrainShaderHandlesClip =
            box.shape === "circle" && m.userData?.terrainMaterial === true;
          const publicSurfaceClipPlanes =
            box.enabled &&
            !terrainShaderHandlesClip &&
            !graticuleUsesTerrainEdgeFrame
              ? planes
              : null;
          m.userData.publicSurfaceClipPlanes = publicSurfaceClipPlanes;
          m.clippingPlanes = publicSurfaceClipPlanes;
          m.clipIntersection = false;
          m.needsUpdate = true;
        }
      });
    }
    this.rebuildPublicSurfaceClipHelper(box);
  }

  private resolveTerrainEdgeFadeState(): TerrainEdgeFadeState | null {
    const terrainGroup = this.layers.get("terrain");
    let boundsMin: THREE.Vector2 | null = null;
    let boundsMax: THREE.Vector2 | null = null;
    terrainGroup?.traverse((obj) => {
      if (boundsMin && boundsMax) return;
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      const uniforms = handle?.material.uniforms as
        | Record<string, { value: unknown }>
        | undefined;
      const min = uniforms?.uTerrainBoundsMin?.value as
        | THREE.Vector2
        | undefined;
      const max = uniforms?.uTerrainBoundsMax?.value as
        | THREE.Vector2
        | undefined;
      if (min && max) {
        boundsMin = min.clone();
        boundsMax = max.clone();
      }
    });
    if (!boundsMin || !boundsMax) return null;
    const terrain = this.currentTerrainScene;
    return {
      boundsMin,
      boundsMax,
      shape: terrainEdgeShape(terrain.edgeFadeShape),
      fadeDistanceM: Math.max(0, terrain.edgeFadeDistanceM ?? 0),
      insetM: Math.max(0, terrain.edgeFadeInsetM ?? 0),
      cornerRadiusM: Math.max(0, terrain.edgeFadeCornerRadiusM ?? 0),
    };
  }

  private topoGraticuleThresholdCrossing(
    a: TopoGraticuleLabelCandidate,
    b: TopoGraticuleLabelCandidate,
    edge: TerrainEdgeFadeState,
    threshold: number,
  ): TopoGraticuleLabelCandidate | null {
    const aValue = terrainEdgeInsideDistance(a.position, edge) - threshold;
    const bValue = terrainEdgeInsideDistance(b.position, edge) - threshold;
    if (Math.abs(aValue) <= 0.0001) return a;
    if (Math.abs(bValue) <= 0.0001) return b;
    if (aValue * bValue > 0) return null;
    const t = clampRange(aValue / (aValue - bValue), 0, 1);
    const position = a.position.clone().lerp(b.position, t);
    const tangent = b.position.clone().sub(a.position);
    tangent.z = 0;
    if (tangent.lengthSq() <= 0.000001) tangent.copy(a.tangent);
    if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
    else tangent.normalize();
    return { position, tangent };
  }

  private topoGraticulePreferredCrossing(
    candidates: TopoGraticuleLabelCandidate[],
    edge: TerrainEdgeFadeState,
    preference: "west" | "north",
    threshold: number,
  ): TopoGraticuleLabelCandidate | null {
    let best: TopoGraticuleLabelCandidate | null = null;
    let bestScore = -Infinity;
    for (let index = 1; index < candidates.length; index += 1) {
      const crossing = this.topoGraticuleThresholdCrossing(
        candidates[index - 1],
        candidates[index],
        edge,
        threshold,
      );
      if (!crossing) continue;
      const score = terrainEdgePreferenceScore(
        crossing.position,
        edge,
        preference,
      );
      if (score > bestScore) {
        bestScore = score;
        best = crossing;
      }
    }
    return best;
  }

  private pushTopoGraticuleSegment(
    positions: number[],
    a: THREE.Vector3,
    b: THREE.Vector3,
  ): void {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  private topoMapBrandingAnchorPoint(
    anchor: TopoMapBrandingAnchor,
  ): THREE.Vector3 | null {
    const terrainStyle = this.styleForLayer("terrain");
    const publicSurfaceFrameAuthored =
      typeof terrainStyle.publicSurfaceClipCenterX === "number" ||
      typeof terrainStyle.publicSurfaceClipCenterY === "number" ||
      typeof terrainStyle.publicSurfaceClipSizeX === "number" ||
      typeof terrainStyle.publicSurfaceClipSizeY === "number" ||
      typeof terrainStyle.publicSurfaceClipRotationZDeg === "number";
    if (publicSurfaceFrameAuthored) {
      const box = this.publicSurfaceClipBox(terrainStyle);
      const { xAxis, yAxis } = this.publicSurfaceClipAxes(box);
      const west = anchor.includes("west");
      const south = anchor.includes("south");
      return box.center
        .clone()
        .addScaledVector(xAxis, west ? -box.halfSize.x : box.halfSize.x)
        .addScaledVector(yAxis, south ? -box.halfSize.y : box.halfSize.y);
    }

    const edge = this.resolveTerrainEdgeFadeState();
    if (!edge) return null;
    const centerX = (edge.boundsMin.x + edge.boundsMax.x) * 0.5;
    const centerY = (edge.boundsMin.y + edge.boundsMax.y) * 0.5;
    const halfX = Math.max(
      1,
      (edge.boundsMax.x - edge.boundsMin.x) * 0.5 - edge.insetM,
    );
    const halfY = Math.max(
      1,
      (edge.boundsMax.y - edge.boundsMin.y) * 0.5 - edge.insetM,
    );
    const west = anchor.includes("west");
    const south = anchor.includes("south");
    return new THREE.Vector3(
      centerX + (west ? -halfX : halfX),
      centerY + (south ? -halfY : halfY),
      0,
    );
  }

  private topoMapBrandingFrameRotationRad(): number {
    const terrainStyle = this.styleForLayer("terrain");
    const publicSurfaceFrameAuthored =
      typeof terrainStyle.publicSurfaceClipCenterX === "number" ||
      typeof terrainStyle.publicSurfaceClipCenterY === "number" ||
      typeof terrainStyle.publicSurfaceClipSizeX === "number" ||
      typeof terrainStyle.publicSurfaceClipSizeY === "number" ||
      typeof terrainStyle.publicSurfaceClipRotationZDeg === "number";
    return publicSurfaceFrameAuthored
      ? this.publicSurfaceClipBox(terrainStyle).rotationZRad
      : 0;
  }

  private topoMapBrandingAssetUrl(path: string): string {
    const trimmed = path.trim();
    if (
      /^https?:\/\//i.test(trimmed) ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
    return this.overlayResolveAssetPath(trimmed);
  }

  private createTopoMapBrandingText(
    text: string,
    sizeM: number,
    color: string,
    opacity: number,
    weight: number,
    fontFamily: string,
    italic: boolean,
  ): { mesh: TopoMapBrandingTextMesh; widthM: number; heightM: number } {
    const clean = text.trim();
    const canvas = document.createElement("canvas");
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    const font = `${italic ? "italic " : ""}${weight} 96px ${fontFamily}`;
    if (measureCtx) measureCtx.font = font;
    const measuredWidth = measureCtx?.measureText(clean).width ?? 512;
    canvas.width = Math.max(512, Math.min(4096, Math.ceil(measuredWidth + 96)));
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(clean, 36, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const widthM = sizeM * Math.max(2.6, clean.length * 0.66);
    const geometry = new THREE.PlaneGeometry(widthM, sizeM);
    const material = new THREE.MeshBasicMaterial({
      color,
      map: texture,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.toneMapped = false;
    material.fog = false;
    material.userData.forceTransparent = true;
    const mesh = new THREE.Mesh(geometry, material) as TopoMapBrandingTextMesh;
    mesh.renderOrder = 4564;
    mesh.userData.topoMapBranding = true;
    mesh.userData.topoMapBrandingTexture = texture;
    return { mesh, widthM, heightM: sizeM };
  }

  private disposeTopoMapBrandingGroup(): void {
    if (!this.topoMapBrandingGroup) return;
    this.topoMapBrandingGroup.parent?.remove(this.topoMapBrandingGroup);
    this.topoMapBrandingGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map;
        map?.dispose();
        material.dispose();
      }
      const texture = (obj as TopoMapBrandingTextMesh).userData
        ?.topoMapBrandingTexture;
      texture?.dispose();
    });
    this.topoMapBrandingGroup = null;
  }

  private rebuildTopoMapBranding(sp: SceneProperties): void {
    this.disposeTopoMapBrandingGroup();
    const terrain = sp.terrain ?? {};
    const branding = terrain.topoMapBranding ?? {};
    if (branding.visible !== true) return;
    const heading =
      typeof branding.heading === "string" ? branding.heading.trim() : "";
    const subheading =
      typeof branding.subheading === "string"
        ? branding.subheading.trim()
        : "";
    const logoPath =
      typeof branding.logoRenderablePath === "string" &&
      branding.logoRenderablePath.trim()
        ? branding.logoRenderablePath.trim()
        : typeof branding.logoPath === "string"
          ? branding.logoPath.trim()
          : "";
    if (!heading && !subheading && !logoPath) return;

    const anchor: TopoMapBrandingAnchor =
      branding.anchor === "south-west" ||
      branding.anchor === "south-east" ||
      branding.anchor === "north-west" ||
      branding.anchor === "north-east"
        ? branding.anchor
        : TOPO_MAP_BRANDING_DEFAULT_ANCHOR;
    const opacity = clamp01(
      typeof branding.opacity === "number" ? branding.opacity : 0.92,
    );
    const textColor =
      typeof branding.textColor === "string" ? branding.textColor : "#ffffff";
    const fontFamily =
      branding.fontFamily === "sans"
        ? "system-ui, -apple-system, Segoe UI, sans-serif"
        : branding.fontFamily === "serif"
          ? "Georgia, Times New Roman, serif"
          : branding.fontFamily === "condensed"
            ? "Arial Narrow, Helvetica Condensed, sans-serif"
            : "monospace";
    const textAlign =
      branding.textAlign === "center" || branding.textAlign === "right"
        ? branding.textAlign
        : "left";
    const layout = branding.layout === "stacked" ? "stacked" : "horizontal";
    const logoPlacement =
      branding.logoPlacement === "after" ? "after" : "before";
    const logoFit =
      branding.logoFit === "cover" || branding.logoFit === "stretch"
        ? branding.logoFit
        : "contain";
    const liftM = typeof branding.liftM === "number" ? branding.liftM : 260;
    const offsetXM =
      typeof branding.offsetXM === "number"
        ? branding.offsetXM
        : TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M;
    const offsetYM =
      typeof branding.offsetYM === "number"
        ? branding.offsetYM
        : TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M;
    const logoWidthM = Math.max(
      0,
      typeof branding.logoWidthM === "number" ? branding.logoWidthM : 46000,
    );
    const logoGapM =
      typeof branding.logoGapM === "number" ? branding.logoGapM : 16000;
    const logoOpacity = clamp01(
      typeof branding.logoOpacity === "number" ? branding.logoOpacity : opacity,
    );
    const textOpacity = clamp01(
      typeof branding.textOpacity === "number" ? branding.textOpacity : opacity,
    );
    const headingSizeM = Math.max(
      1000,
      typeof branding.headingSizeM === "number"
        ? branding.headingSizeM
        : 18000,
    );
    const subheadingSizeM = Math.max(
      1000,
      typeof branding.subheadingSizeM === "number"
        ? branding.subheadingSizeM
        : 10500,
    );
    const lineGapM =
      typeof branding.lineGapM === "number" ? branding.lineGapM : 2500;
    const anchorPoint = this.topoMapBrandingAnchorPoint(anchor);
    if (!anchorPoint) return;
    const group = new THREE.Group();
    group.name = "__topo_map_branding__";
    group.renderOrder = 4564;
    group.userData.topoMapBranding = true;
    group.rotation.z =
      this.topoMapBrandingFrameRotationRad() +
      THREE.MathUtils.degToRad(
        typeof branding.rotationDeg === "number" ? branding.rotationDeg : 0,
      );
    group.position
      .copy(anchorPoint)
      .add(new THREE.Vector3(offsetXM, offsetYM, liftM));

    const contentGroup = new THREE.Group();
    contentGroup.userData.topoMapBrandingContent = true;

    let logoHeightM = logoPath && logoWidthM > 0 ? logoWidthM : 0;
    let logo: THREE.Mesh | null = null;
    let textBlockWidth = 0;
    const textMeshes: Array<{
      mesh: THREE.Mesh;
      widthM: number;
      heightM: number;
      role: "heading" | "subheading";
    }> = [];

    if (logoPath && logoWidthM > 0) {
      const geometry = new THREE.PlaneGeometry(logoWidthM, logoHeightM);
      const material = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: logoOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      material.toneMapped = false;
      material.fog = false;
      material.userData.forceTransparent = true;
      const logoMesh = new THREE.Mesh(geometry, material);
      logo = logoMesh;
      logoMesh.renderOrder = 4564;
      logoMesh.userData.topoMapBranding = true;
      logoMesh.userData.topoMapBrandingRole = "logo";
      contentGroup.add(logoMesh);
      const loadSeq = ++this.topoMapBrandingLogoLoadSeq;
      new THREE.TextureLoader().load(
        this.topoMapBrandingAssetUrl(logoPath),
        (texture) => {
          if (loadSeq !== this.topoMapBrandingLogoLoadSeq) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          const image = texture.image as { width?: number; height?: number };
          const aspect =
            image?.width && image?.height ? image.height / image.width : 1;
          logoHeightM =
            logoFit === "stretch" ? logoWidthM : Math.max(1, logoWidthM * aspect);
          logoMesh.geometry.dispose();
          logoMesh.geometry = new THREE.PlaneGeometry(logoWidthM, logoHeightM);
          material.map?.dispose();
          material.map = texture;
          material.needsUpdate = true;
          layoutTitleBlock();
        },
        undefined,
        () => {
          logoMesh.visible = false;
        },
      );
    }

    if (heading) {
      const { mesh, widthM } = this.createTopoMapBrandingText(
        heading,
        headingSizeM,
        textColor,
        textOpacity,
        typeof branding.headingWeight === "number"
          ? Math.round(branding.headingWeight)
          : 800,
        fontFamily,
        branding.headingItalic === true,
      );
      mesh.userData.topoMapBrandingRole = "heading";
      contentGroup.add(mesh);
      textBlockWidth = Math.max(textBlockWidth, widthM);
      textMeshes.push({ mesh, widthM, heightM: headingSizeM, role: "heading" });
    }
    if (subheading) {
      const { mesh, widthM } = this.createTopoMapBrandingText(
        subheading,
        subheadingSizeM,
        textColor,
        textOpacity,
        typeof branding.subheadingWeight === "number"
          ? Math.round(branding.subheadingWeight)
          : 500,
        fontFamily,
        branding.subheadingItalic === true,
      );
      mesh.userData.topoMapBrandingRole = "subheading";
      contentGroup.add(mesh);
      textBlockWidth = Math.max(textBlockWidth, widthM);
      textMeshes.push({
        mesh,
        widthM,
        heightM: subheadingSizeM,
        role: "subheading",
      });
    }

    const backgroundEnabled = branding.backgroundEnabled === true;
    const outlineEnabled = branding.outlineEnabled === true;
    const paddingX =
      typeof branding.backgroundPaddingXM === "number"
        ? Math.max(0, branding.backgroundPaddingXM)
        : Math.max(6000, headingSizeM * 0.65);
    const paddingY =
      typeof branding.backgroundPaddingYM === "number"
        ? Math.max(0, branding.backgroundPaddingYM)
        : Math.max(5000, headingSizeM * 0.45);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color:
        typeof branding.backgroundColor === "string"
          ? branding.backgroundColor
          : "#050607",
      transparent: true,
      opacity: clamp01(
        typeof branding.backgroundOpacity === "number"
          ? branding.backgroundOpacity
          : 0.36,
      ),
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    backgroundMaterial.toneMapped = false;
    backgroundMaterial.fog = false;
    backgroundMaterial.userData.forceTransparent = true;
    const background = backgroundEnabled
      ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backgroundMaterial)
      : null;
    if (background) {
      background.renderOrder = 4563;
      background.position.z = -2;
      background.userData.topoMapBranding = true;
      background.userData.topoMapBrandingRole = "background";
      contentGroup.add(background);
    } else {
      backgroundMaterial.dispose();
    }

    const outlineStrips: THREE.Mesh[] = [];
    if (outlineEnabled) {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color:
          typeof branding.outlineColor === "string"
            ? branding.outlineColor
            : textColor,
        transparent: true,
        opacity: clamp01(
          typeof branding.outlineOpacity === "number"
            ? branding.outlineOpacity
            : 0.8,
        ),
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      outlineMaterial.toneMapped = false;
      outlineMaterial.fog = false;
      outlineMaterial.userData.forceTransparent = true;
      for (let i = 0; i < 4; i += 1) {
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          outlineMaterial,
        );
        strip.renderOrder = 4563.5;
        strip.position.z = -1;
        strip.userData.topoMapBranding = true;
        strip.userData.topoMapBrandingRole = "outline";
        outlineStrips.push(strip);
        contentGroup.add(strip);
      }
    }

    const layoutTitleBlock = () => {
      const textBlockHeight =
        heading && subheading
          ? headingSizeM + lineGapM + subheadingSizeM
          : textMeshes.length > 0
            ? textMeshes[0].heightM
            : 0;
      const hasLogo = !!logo && logoWidthM > 0 && logo.visible !== false;
      const hasText = textMeshes.length > 0;
      const gap = hasLogo && hasText ? logoGapM : 0;
      let contentWidth = 1;
      let contentHeight = 1;
      let logoCenterX = logoWidthM * 0.5;
      let logoCenterY = 0;
      let textOriginX = 0;
      let textCenterY = 0;

      if (layout === "stacked") {
        contentWidth = Math.max(hasLogo ? logoWidthM : 0, textBlockWidth, 1);
        contentHeight =
          (hasLogo ? logoHeightM : 0) +
          gap +
          (hasText ? textBlockHeight : 0);
        if (hasLogo) {
          logoCenterX = contentWidth * 0.5;
          logoCenterY =
            logoPlacement === "before"
              ? contentHeight * 0.5 - logoHeightM * 0.5
              : -contentHeight * 0.5 + logoHeightM * 0.5;
        }
        if (hasText) {
          textOriginX = (contentWidth - textBlockWidth) * 0.5;
          textCenterY =
            logoPlacement === "before"
              ? -contentHeight * 0.5 + textBlockHeight * 0.5
              : contentHeight * 0.5 - textBlockHeight * 0.5;
        }
      } else {
        contentWidth =
          (hasLogo ? logoWidthM : 0) + gap + (hasText ? textBlockWidth : 0);
        contentHeight = Math.max(
          hasLogo ? logoHeightM : 0,
          hasText ? textBlockHeight : 0,
          1,
        );
        if (hasLogo) {
          logoCenterX =
            logoPlacement === "before"
              ? logoWidthM * 0.5
              : contentWidth - logoWidthM * 0.5;
        }
        if (hasText) {
          textOriginX =
            logoPlacement === "before" && hasLogo ? logoWidthM + gap : 0;
          textCenterY = 0;
        }
      }

      if (logo) logo.position.set(logoCenterX, logoCenterY, 0);
      for (const item of textMeshes) {
        const y =
          textMeshes.length === 2
            ? item.role === "heading"
              ? textCenterY + textBlockHeight * 0.5 - item.heightM * 0.5
              : textCenterY - textBlockHeight * 0.5 + item.heightM * 0.5
            : textCenterY;
        const x =
          textAlign === "center"
            ? textOriginX + textBlockWidth * 0.5
            : textAlign === "right"
              ? textOriginX + textBlockWidth - item.widthM * 0.5
              : textOriginX + item.widthM * 0.5;
        item.mesh.position.set(x, y, 0);
      }

      const framedWidth = contentWidth + paddingX * 2;
      const framedHeight = contentHeight + paddingY * 2;
      if (background) {
        background.scale.set(framedWidth, framedHeight, 1);
        background.position.set(contentWidth * 0.5, 0, -2);
      }
      if (outlineStrips.length === 4) {
        const outlineWidth = Math.max(
          1,
          typeof branding.outlineWidthM === "number"
            ? branding.outlineWidthM
            : 2500,
        );
        const left = contentWidth * 0.5 - framedWidth * 0.5;
        const right = contentWidth * 0.5 + framedWidth * 0.5;
        const top = framedHeight * 0.5;
        const bottom = -framedHeight * 0.5;
        const [topStrip, rightStrip, bottomStrip, leftStrip] = outlineStrips;
        topStrip.scale.set(framedWidth, outlineWidth, 1);
        topStrip.position.set(contentWidth * 0.5, top, -1);
        bottomStrip.scale.set(framedWidth, outlineWidth, 1);
        bottomStrip.position.set(contentWidth * 0.5, bottom, -1);
        rightStrip.scale.set(outlineWidth, framedHeight, 1);
        rightStrip.position.set(right, 0, -1);
        leftStrip.scale.set(outlineWidth, framedHeight, 1);
        leftStrip.position.set(left, 0, -1);
      }

      contentGroup.position.x = anchor.includes("east") ? -contentWidth : 0;
      contentGroup.position.y = anchor.includes("south")
        ? contentHeight * 0.5
        : -contentHeight * 0.5;
      contentGroup.userData.topoMapBrandingContentWidthM = contentWidth;
      contentGroup.userData.topoMapBrandingContentHeightM = contentHeight;
    };

    layoutTitleBlock();
    group.add(contentGroup);

    this.scene.add(group);
    this.topoMapBrandingGroup = group;
  }

  private topoGraticuleVisibleSegment(
    a: TopoGraticuleLabelCandidate,
    b: TopoGraticuleLabelCandidate,
    edge: TerrainEdgeFadeState,
    threshold: number,
  ): [THREE.Vector3, THREE.Vector3] | null {
    const aValue = terrainEdgeInsideDistance(a.position, edge) - threshold;
    const bValue = terrainEdgeInsideDistance(b.position, edge) - threshold;
    if (aValue < 0 && bValue < 0) return null;
    if (aValue >= 0 && bValue >= 0) return [a.position, b.position];
    const crossing = this.topoGraticuleThresholdCrossing(a, b, edge, threshold);
    if (!crossing) return null;
    return aValue >= 0
      ? [a.position, crossing.position]
      : [crossing.position, b.position];
  }

  private setTopoGraticuleLinePositions(
    line: LineSegments2,
    positions: number[],
  ): void {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    line.geometry.dispose();
    line.geometry = geometry;
    line.computeLineDistances();
    line.userData.topoGraticuleSegmentCount = positions.length / 6;
  }

  private rebuildTopoGraticuleEdgeLines(
    group: THREE.Group,
    edge: TerrainEdgeFadeState | null,
    edgeAware: boolean,
    labelOffsetM: number,
    labelGapM: number,
  ): void {
    let sourceRoot: THREE.Object3D | null =
      group.userData?.topoGraticule === true ? group : null;
    group.traverse((obj) => {
      if (!sourceRoot && obj.userData?.topoGraticule === true) {
        sourceRoot = obj;
      }
    });
    if (!sourceRoot) return;
    const rawSourceLines = sourceRoot.userData?.topoGraticuleSourceLines as
      | unknown[]
      | undefined;
    if (!Array.isArray(rawSourceLines)) return;
    const sourceLines = rawSourceLines
      .map((line) => topoGraticuleSourceLine(line))
      .filter((line): line is TopoGraticuleSourceLine => Boolean(line));
    if (sourceLines.length === 0) return;

    let interiorLine: LineSegments2 | null = null;
    let dashedInteriorLine: LineSegments2 | null = null;
    let leaderLine: LineSegments2 | null = null;
    let dashedLeaderLine: LineSegments2 | null = null;
    group.traverse((obj) => {
      if (!(obj instanceof LineSegments2)) return;
      if (obj.userData?.topoGraticuleLineRole === "leader") leaderLine = obj;
      else if (obj.userData?.topoGraticuleLineRole === "leader-dashed") {
        dashedLeaderLine = obj;
      }
      else if (obj.userData?.topoGraticuleLineRole === "interior-dashed") {
        dashedInteriorLine = obj;
      }
      else if (obj.userData?.topoGraticuleLineRole === "interior") {
        interiorLine = obj;
      }
    });
    const interior = interiorLine as LineSegments2 | null;
    const dashedInterior = dashedInteriorLine as LineSegments2 | null;
    const leader = leaderLine as LineSegments2 | null;
    const dashedLeader = dashedLeaderLine as LineSegments2 | null;
    if (!interior || !dashedInterior || !leader || !dashedLeader) return;

    const interiorPositions: number[] = [];
    const dashedInteriorPositions: number[] = [];
    const leaderPositions: number[] = [];
    const dashedLeaderPositions: number[] = [];
    const labelTargets = new Map<string, TopoGraticuleLabelTarget>();
    const innerThreshold = edgeAware && edge ? edge.fadeDistanceM : -Infinity;
    const labelGap = labelGapM;

    for (const sourceLine of sourceLines) {
      const { candidates } = sourceLine;
      const isMinor = topoGraticuleIsHalfDegree(sourceLine.value);
      const sourceInteriorPositions = isMinor
        ? dashedInteriorPositions
        : interiorPositions;
      for (let index = 1; index < candidates.length; index += 1) {
        if (!edgeAware || !edge) {
          this.pushTopoGraticuleSegment(
            sourceInteriorPositions,
            candidates[index - 1].position,
            candidates[index].position,
          );
          continue;
        }
        const clipped = this.topoGraticuleVisibleSegment(
          candidates[index - 1],
          candidates[index],
          edge,
          innerThreshold,
        );
        if (clipped) {
          this.pushTopoGraticuleSegment(
            sourceInteriorPositions,
            clipped[0],
            clipped[1],
          );
        }
      }

      if (!edgeAware || !edge) continue;
      const inner = this.topoGraticulePreferredCrossing(
        candidates,
        edge,
        sourceLine.preference,
        innerThreshold,
      );
      if (!inner) continue;
      const outer = this.topoGraticulePreferredCrossing(
        candidates,
        edge,
        sourceLine.preference,
        0,
      );
      if (
        !terrainEdgeStraightSideEligible(
          outer?.position ?? inner.position,
          edge,
          sourceLine.preference,
        )
      ) {
        continue;
      }
      const effectiveLabelOffsetM =
        labelOffsetM * (isMinor ? TOPO_GRATICULE_MINOR_SCALE : 1);
      const effectiveLabelThreshold = -Math.max(0, effectiveLabelOffsetM);
      const target =
        this.topoGraticulePreferredCrossing(
          candidates,
          edge,
          sourceLine.preference,
          effectiveLabelThreshold,
        ) ??
        (() => {
          const outward = edgeOutwardLineTangent(inner, edge);
          const currentInside = terrainEdgeInsideDistance(inner.position, edge);
          return {
            position: inner.position
              .clone()
              .addScaledVector(outward, currentInside - effectiveLabelThreshold),
            tangent: inner.tangent.clone(),
          };
        })();
      const leaderDirection = target.position.clone().sub(inner.position);
      leaderDirection.z = 0;
      if (leaderDirection.lengthSq() <= 0.000001) {
        leaderDirection.copy(edgeOutwardLineTangent(inner, edge));
      } else {
        leaderDirection.normalize();
      }
      const edgeTextBasis = topoGraticuleEdgeTextBasis(sourceLine.preference);
      const readableTangent = edgeTextBasis.tangent;
      const positions = isMinor ? dashedLeaderPositions : leaderPositions;
      this.pushTopoGraticuleSegment(positions, inner.position, target.position);
      labelTargets.set(
        topoGraticuleLineKey(
          sourceLine.kind,
          sourceLine.value,
          sourceLine.preference,
        ),
        {
          position: target.position.clone(),
          anchor: target.position.clone(),
          tangent: readableTangent,
          outward: edgeTextBasis.outward,
          insideDistance: terrainEdgeInsideDistance(target.position, edge),
          minor: isMinor,
        },
      );
    }

    this.setTopoGraticuleLinePositions(interior, interiorPositions);
    this.setTopoGraticuleLinePositions(dashedInterior, dashedInteriorPositions);
    this.setTopoGraticuleLinePositions(leader, leaderPositions);
    this.setTopoGraticuleLinePositions(dashedLeader, dashedLeaderPositions);
    interior.visible = interiorPositions.length > 0;
    dashedInterior.visible = dashedInteriorPositions.length > 0;
    leader.visible = edgeAware && leaderPositions.length > 0;
    dashedLeader.visible = edgeAware && dashedLeaderPositions.length > 0;
    for (const target of [group, sourceRoot]) {
      target.userData.topoGraticuleInteriorSegmentCount =
        (interiorPositions.length + dashedInteriorPositions.length) / 6;
      target.userData.topoGraticuleDashedInteriorSegmentCount =
        dashedInteriorPositions.length / 6;
      target.userData.topoGraticuleLeaderSegmentCount =
        (leaderPositions.length + dashedLeaderPositions.length) / 6;
      target.userData.topoGraticuleDashedLeaderSegmentCount =
        dashedLeaderPositions.length / 6;
      target.userData.topoGraticuleInnerTrimInsideDistance = innerThreshold;
      target.userData.topoGraticuleLabelOffsetM = labelOffsetM;
      target.userData.topoGraticuleLabelGapM = labelGap;
      target.userData.topoGraticuleLabelTargets = labelTargets;
    }
  }

  private applyTopoGraticuleLabelPlacement(
    obj: THREE.Object3D,
    edge: TerrainEdgeFadeState | null,
    edgeAware: boolean,
    labelOffsetM: number,
    labelGapM: number,
    labelSizeM: number,
  ): void {
    if (!edgeAware || !edge) return;
    const preference =
      obj.userData?.topoGraticuleLabelPreference === "north"
        ? "north"
        : "west";
    const targetMap = obj.parent?.userData
      ?.topoGraticuleLabelTargets as Map<string, TopoGraticuleLabelTarget> | undefined;
    if (targetMap instanceof Map) {
      const labelKey = topoGraticuleLabelKey(obj);
      const target = labelKey ? targetMap.get(labelKey) : null;
      if (!target) {
        obj.visible = false;
        obj.userData.topoGraticuleLabelHasLeader = false;
        obj.userData.topoGraticuleLabelExcludedReason = "no-edge-leader";
        return;
      }
      const aspect =
        typeof obj.userData?.topoGraticuleLabelAspect === "number"
          ? Math.max(1, obj.userData.topoGraticuleLabelAspect)
          : 2.4;
      const labelScale =
        (labelSizeM / 9000) *
        (target.minor ? TOPO_GRATICULE_MINOR_SCALE : 1);
      const halfTextLengthM = 9000 * aspect * labelScale * 0.5;
      const labelGap = labelGapM;
      const position = target.anchor
        .clone()
        .addScaledVector(target.outward, labelGap + halfTextLengthM);
      obj.position.copy(position);
      obj.rotation.set(
        0,
        0,
        normalizeFullGroundTextAngle(
          Math.atan2(target.tangent.y, target.tangent.x),
        ),
      );
      obj.userData.topoGraticuleLabelHasLeader = true;
      obj.userData.topoGraticuleLabelExcludedReason = null;
      obj.userData.topoGraticuleActiveLabelInsideDistance =
        terrainEdgeInsideDistance(position, edge);
      obj.userData.topoGraticuleActiveLabelAnchor = {
        x: target.anchor.x,
        y: target.anchor.y,
        z: target.anchor.z,
      };
      obj.userData.topoGraticuleActiveLabelTangent = {
        x: target.tangent.x,
        y: target.tangent.y,
        z: target.tangent.z,
      };
      obj.userData.topoGraticuleLabelGapM = labelGapM;
      obj.userData.topoGraticuleLabelMinor = target.minor;
      return;
    }
    const candidates = obj.userData?.topoGraticuleLabelCandidates as
      | unknown[]
      | undefined;
    if (!Array.isArray(candidates) || candidates.length === 0) return;
    const targetInsideDistance = -Math.max(0, labelOffsetM);
    const parsedCandidates = candidates
      .map((candidate) => topoGraticuleLabelCandidate(candidate))
      .filter((candidate): candidate is TopoGraticuleLabelCandidate =>
        Boolean(candidate),
      );
    const target = this.topoGraticulePreferredCrossing(
      parsedCandidates,
      edge,
      preference,
      targetInsideDistance,
    );
    if (target) {
      obj.position.copy(target.position);
      obj.rotation.set(0, 0, topoGraticuleReadableAngle(target.tangent, preference));
      obj.userData.topoGraticuleActiveLabelInsideDistance =
        terrainEdgeInsideDistance(target.position, edge);
      obj.userData.topoGraticuleActiveLabelTangent = {
        x: target.tangent.x,
        y: target.tangent.y,
        z: target.tangent.z,
      };
      return;
    }

    let best: TopoGraticuleLabelCandidate | null = null;
    let bestScore = -Infinity;
    for (const candidate of parsedCandidates) {
      const insideDistance = terrainEdgeInsideDistance(
        candidate.position,
        edge,
      );
      const edgeFit = -Math.abs(insideDistance - targetInsideDistance);
      const sideFit =
        terrainEdgePreferenceScore(candidate.position, edge, preference) *
        0.35;
      const score = sideFit + edgeFit;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) return;

    const position = best.position.clone();
    const currentInsideDistance = terrainEdgeInsideDistance(position, edge);
    if (currentInsideDistance > targetInsideDistance) {
      const outward = edgeOutwardLineTangent(best, edge);
      position.addScaledVector(
        outward,
        currentInsideDistance - targetInsideDistance,
      );
    }
    obj.position.copy(position);
    obj.rotation.set(0, 0, topoGraticuleReadableAngle(best.tangent, preference));
    obj.userData.topoGraticuleActiveLabelInsideDistance =
      terrainEdgeInsideDistance(position, edge);
    obj.userData.topoGraticuleActiveLabelTangent = {
      x: best.tangent.x,
      y: best.tangent.y,
      z: best.tangent.z,
    };
  }

  private applyTopoGraticuleStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_TOPO_GRATICULE_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const clipBox = this.publicSurfaceClipBox(this.styleForLayer("terrain"));
    const clipPlanes = clipBox.enabled
      ? this.publicSurfaceClipPlanes(clipBox)
      : [];
    const labelVisible = style.graticuleLabelVisible !== false;
    const labelSize = styleNumber(
      style,
      "graticuleLabelSizeM",
      9000,
      1500,
      60000,
    );
    const lift = styleNumber(style, "graticuleLiftM", 24, -50, 500);
    group.position.z = lift;
    const opacity = clamp01(styleNumber(style, "opacity", 0.62, 0, 1));
    const color = typeof style.color === "string" ? style.color : "#d7d1c7";
    const edgeAware = style.graticuleEdgeFadeAware !== false;
    const edgeStrength = styleNumber(
      style,
      "graticuleEdgeFadeStrength",
      1,
      0,
      1,
    );
    const edgeLineColor =
      typeof style.graticuleEdgeLineColor === "string"
        ? style.graticuleEdgeLineColor
        : "#ffffff";
    const edgeLabelColor =
      typeof style.graticuleEdgeLabelColor === "string"
        ? style.graticuleEdgeLabelColor
        : "#ffffff";
    const edgeLabelVisible = style.graticuleEdgeLabelVisible !== false;
    const edgeLabelOffsetM = styleNumber(
      style,
      "graticuleEdgeLabelOffsetM",
      90000,
      0,
      160000,
    );
    const edgeLabelGapM = styleNumber(
      style,
      "graticuleEdgeLabelGapM",
      22000,
      -100000,
      100000,
    );
    const graticuleLineWidth = styleNumber(style, "lineWidth", 4.75, 0.1, 24);
    const graticuleEdgeLineWidth = styleNumber(
      style,
      "graticuleEdgeLineWidth",
      graticuleLineWidth,
      0.1,
      32,
    );
    const terrainEdge = this.resolveTerrainEdgeFadeState();
    this.rebuildTopoGraticuleEdgeLines(
      group,
      terrainEdge,
      edgeAware,
      edgeLabelOffsetM,
      edgeLabelGapM,
    );
    group.traverse((obj) => {
      if (obj.userData?.topoGraticuleLabel === true) {
        obj.visible = labelVisible && (!edgeAware || edgeLabelVisible);
        this.applyTopoGraticuleLabelPlacement(
          obj,
          terrainEdge,
          edgeAware,
          edgeLabelOffsetM,
          edgeLabelGapM,
          labelSize,
        );
        const base = obj.userData.topoGraticuleBaseScale as
          | THREE.Vector3
          | undefined;
        const scaleFactor =
          (labelSize / 9000) *
          (obj.userData.topoGraticuleLabelMinor === true
            ? TOPO_GRATICULE_MINOR_SCALE
            : 1);
        if (base) {
          obj.scale.set(
            base.x * scaleFactor,
            base.y * scaleFactor,
            base.z * scaleFactor,
          );
        } else {
          obj.scale.setScalar(scaleFactor);
        }
      }
      const material = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        const lineRole = obj.userData?.topoGraticuleLineRole;
        const minorLine =
          lineRole === "interior-dashed" || lineRole === "leader-dashed";
        const minorLabel =
          obj.userData?.topoGraticuleLabel === true &&
          obj.userData.topoGraticuleLabelMinor === true;
        if ("color" in m && m.color instanceof THREE.Color) {
          m.color.set(
            obj.userData?.topoGraticuleLabel === true && edgeAware
              ? edgeLabelColor
              : (lineRole === "leader" || lineRole === "leader-dashed") &&
                  edgeAware
                ? edgeLineColor
              : color,
          );
        }
        if (m instanceof LineMaterial && m.userData?.topoGraticuleLineMaterial) {
          const edgeLine =
            lineRole === "leader" || lineRole === "leader-dashed";
          const baseLineWidth = edgeLine
            ? graticuleEdgeLineWidth
            : graticuleLineWidth;
          m.linewidth =
            baseLineWidth * (minorLine ? TOPO_GRATICULE_MINOR_SCALE : 1);
          setTopoGraticuleEdgeFade(m, {
            enabled: edgeAware,
            strength: edgeStrength,
            lineColor: edgeLineColor,
            boundsMin: terrainEdge
              ? [terrainEdge.boundsMin.x, terrainEdge.boundsMin.y]
              : undefined,
            boundsMax: terrainEdge
              ? [terrainEdge.boundsMax.x, terrainEdge.boundsMax.y]
              : undefined,
            edgeFadeDistanceM: terrainEdge?.fadeDistanceM ?? 0,
            edgeFadeShape: terrainEdge?.shape ?? "square",
            edgeFadeInsetM: terrainEdge?.insetM ?? 0,
            edgeFadeCornerRadiusM: terrainEdge?.cornerRadiusM ?? 0,
          });
        }
        m.opacity =
          opacity *
          (minorLine || minorLabel ? TOPO_GRATICULE_MINOR_SCALE : 1);
        m.transparent = true;
        m.depthWrite = false;
        const publicSurfaceClipPlanes =
          clipBox.enabled && !edgeAware ? clipPlanes : null;
        m.userData.publicSurfaceClipPlanes = publicSurfaceClipPlanes;
        m.clippingPlanes = publicSurfaceClipPlanes;
        m.clipIntersection = false;
        m.needsUpdate = true;
      }
    });
  }

  private workingAreaFocusTargetLayerIds(style: EditableStyle): Set<string> {
    const configured = Array.isArray(style.workingAreaFocusTargetLayerIds)
      ? style.workingAreaFocusTargetLayerIds.filter(
          (id) => typeof id === "string",
        )
      : [];
    return new Set(
      configured.length > 0
        ? configured
        : Array.from(WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS),
    );
  }

  private workingAreaFocusOutsideOpacity(
    style: EditableStyle,
    layerId: string,
  ): number {
    if (style.workingAreaFocusEnabled !== true) return 1;
    if (style.workingAreaFocusMode === "inside-only") return 0;
    const map = style.workingAreaFocusOutsideOpacityByLayerId ?? {};
    const value = map[layerId];
    return typeof value === "number" && Number.isFinite(value)
      ? clamp01(value)
      : WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY;
  }

  private cleanWorkingAreaFocusVector(value: unknown): THREE.Vector3 | null {
    if (Array.isArray(value) && value.length >= 3) {
      const [x, y, z] = value;
      return typeof x === "number" &&
        typeof y === "number" &&
        typeof z === "number" &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z)
        ? new THREE.Vector3(x, y, z)
        : null;
    }
    const vector = value as { x?: unknown; y?: unknown; z?: unknown } | null;
    if (
      vector &&
      typeof vector.x === "number" &&
      typeof vector.y === "number" &&
      typeof vector.z === "number" &&
      Number.isFinite(vector.x) &&
      Number.isFinite(vector.y) &&
      Number.isFinite(vector.z)
    ) {
      return new THREE.Vector3(vector.x, vector.y, vector.z);
    }
    return null;
  }

  private resolveWorkingAreaFocusBounds(boundsLayerId: string): {
    min: THREE.Vector3;
    max: THREE.Vector3;
  } {
    const layer = this.layers.get(boundsLayerId);
    const candidates: unknown[] = [];
    if (layer?.userData?.sceneBounds)
      candidates.push(layer.userData.sceneBounds);
    layer?.traverse((obj) => {
      if (obj.userData?.sceneBounds) candidates.push(obj.userData.sceneBounds);
    });
    for (const candidate of candidates) {
      const bounds = candidate as { min?: unknown; max?: unknown };
      const min = this.cleanWorkingAreaFocusVector(bounds.min);
      const max = this.cleanWorkingAreaFocusVector(bounds.max);
      if (min && max) return { min, max };
    }
    return {
      min: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.min.clone(),
      max: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.max.clone(),
    };
  }

  private workingAreaFocusState(style: EditableStyle): WorkingAreaFocusState {
    const boundsLayerId =
      typeof style.workingAreaFocusBoundsLayerId === "string"
        ? style.workingAreaFocusBoundsLayerId
        : UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID;
    const bounds = this.resolveWorkingAreaFocusBounds(boundsLayerId);
    const targetLayerIds = this.workingAreaFocusTargetLayerIds(style);
    const outsideOpacityByLayerId = new Map<string, number>();
    for (const layerId of targetLayerIds) {
      outsideOpacityByLayerId.set(
        layerId,
        this.workingAreaFocusOutsideOpacity(style, layerId),
      );
    }
    return {
      enabled: style.workingAreaFocusEnabled === true,
      mode:
        style.workingAreaFocusMode === "inside-only"
          ? "inside-only"
          : "outside-context",
      boundsLayerId,
      boundsMin: bounds.min,
      boundsMax: bounds.max,
      targetLayerIds,
      outsideOpacityByLayerId,
      helperVisible: style.workingAreaFocusHelperVisible !== false,
    };
  }

  private workingAreaFocusSegmentPositions(
    min: THREE.Vector3,
    max: THREE.Vector3,
  ): number[] {
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
    ];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ] as const;
    return edges.flatMap(([a, b]) => [
      corners[a].x,
      corners[a].y,
      corners[a].z,
      corners[b].x,
      corners[b].y,
      corners[b].z,
    ]);
  }

  private ensureWorkingAreaFocusRuntime(): WorkingAreaFocusRuntime {
    if (this.workingAreaFocusRuntime) return this.workingAreaFocusRuntime;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([]);
    const material = new LineMaterial({
      color: 0x69f0ff,
      linewidth: 2,
      worldUnits: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
      dashed: false,
    });
    material.fog = false;
    material.userData.forceTransparent = true;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    const line = new LineSegments2(geometry, material);
    line.name = "Working area focus box";
    line.renderOrder = WORKING_AREA_FOCUS_RENDER_ORDER;
    line.userData.workingAreaFocusHelper = true;
    const group = new THREE.Group();
    group.name = "__working_area_focus_box__";
    group.visible = false;
    group.userData.workingAreaFocusHelper = true;
    group.add(line);
    this.scene.add(group);
    this.workingAreaFocusRuntime = { group, line };
    return this.workingAreaFocusRuntime;
  }

  private rebuildWorkingAreaFocusHelper(state: WorkingAreaFocusState): void {
    const runtime = this.ensureWorkingAreaFocusRuntime();
    runtime.group.visible =
      this.editorMode && state.enabled && state.helperVisible;
    if (!state.enabled) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(
      this.workingAreaFocusSegmentPositions(state.boundsMin, state.boundsMax),
    );
    runtime.line.geometry.dispose();
    runtime.line.geometry = geometry;
    runtime.line.computeLineDistances();
  }

  private setKnownShaderWorkingAreaFocus(
    material: THREE.ShaderMaterial,
    enabled: boolean,
    state: WorkingAreaFocusState,
    outsideOpacity: number,
  ): boolean {
    const uniforms = material.uniforms as Record<string, { value: unknown }>;
    if (!uniforms.uWorkingAreaFocusEnabled) return false;
    setWorkingAreaFocusShaderUniforms(
      uniforms,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
    material.needsUpdate = true;
    return true;
  }

  private applyWorkingAreaFocusMaterial(
    material: THREE.Material,
    enabled: boolean,
    state: WorkingAreaFocusState,
    outsideOpacity: number,
  ): void {
    if (material.userData?.workingAreaFocusHelper === true) return;
    if (material instanceof THREE.ShaderMaterial) {
      if (
        this.setKnownShaderWorkingAreaFocus(
          material,
          enabled,
          state,
          outsideOpacity,
        )
      ) {
        return;
      }
      material.userData.workingAreaFocusUnsupported = enabled;
      return;
    }
    applyWorkingAreaFocusBuiltInMaterial(
      material,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
  }

  private applyWorkingAreaFocusStyle(style: EditableStyle): void {
    this.lastWorkingAreaFocusStyle = style;
    this.currentWorkingAreaFocusStyle = style;
    const state = this.workingAreaFocusState(style);
    for (const [layerId, group] of this.layers) {
      const targeted =
        state.enabled &&
        state.targetLayerIds.has(layerId) &&
        layerId !== state.boundsLayerId;
      const outsideOpacity = state.outsideOpacityByLayerId.get(layerId) ?? 1;
      group.traverse((obj) => {
        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          this.applyWorkingAreaFocusMaterial(
            m,
            targeted,
            state,
            outsideOpacity,
          );
        }
      });
    }
    this.rebuildWorkingAreaFocusHelper(state);
  }

  private reapplyWorkingAreaFocus(): void {
    this.applyWorkingAreaFocusStyle(this.lastWorkingAreaFocusStyle);
  }

  private interpolatedWorkingAreaFocusStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    t: number,
  ): EditableStyle {
    const targetLayerIds = new Set<string>([
      ...this.workingAreaFocusTargetLayerIds(fromStyle),
      ...this.workingAreaFocusTargetLayerIds(toStyle),
    ]);
    const outsideOpacityByLayerId: Record<string, number> = {};
    for (const layerId of targetLayerIds) {
      const from = this.workingAreaFocusOutsideOpacity(fromStyle, layerId);
      const to = this.workingAreaFocusOutsideOpacity(toStyle, layerId);
      outsideOpacityByLayerId[layerId] = from + (to - from) * t;
    }
    return {
      ...toStyle,
      workingAreaFocusEnabled:
        fromStyle.workingAreaFocusEnabled === true ||
        toStyle.workingAreaFocusEnabled === true,
      workingAreaFocusMode: "outside-context",
      workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
      workingAreaFocusOutsideOpacityByLayerId: outsideOpacityByLayerId,
    };
  }

  private transitionWorkingAreaFocusForPage(
    environment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number,
    easing: EasingName,
  ): void {
    const fromStyle =
      Object.keys(this.currentWorkingAreaFocusStyle).length > 0
        ? this.currentWorkingAreaFocusStyle
        : effectiveStyle(
            environment,
            fromPage,
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
          );
    const toStyle = effectiveStyle(
      environment,
      toPage,
      UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
    );
    const duration = Math.max(0, durationMs);
    if (duration <= 0) {
      this.workingAreaFocusTween = null;
      this.applyWorkingAreaFocusStyle(toStyle);
      return;
    }
    this.workingAreaFocusTween = {
      fromStyle,
      toStyle,
      startMs: performance.now(),
      durationMs: duration,
      easing,
    };
    this.applyWorkingAreaFocusStyle(
      this.interpolatedWorkingAreaFocusStyle(fromStyle, toStyle, 0),
    );
  }

  getWorkingAreaFocusDebugState(): {
    enabled: boolean;
    mode: string;
    boundsLayerId: string;
    targetLayerIds: string[];
    outsideOpacityByLayerId: Record<string, number>;
    helperVisible: boolean;
    helperRenderable: boolean;
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
  } {
    const state = this.workingAreaFocusState(this.currentWorkingAreaFocusStyle);
    return {
      enabled: state.enabled,
      mode: state.mode,
      boundsLayerId: state.boundsLayerId,
      targetLayerIds: Array.from(state.targetLayerIds),
      outsideOpacityByLayerId: Object.fromEntries(
        state.outsideOpacityByLayerId,
      ),
      helperVisible: state.helperVisible,
      helperRenderable: this.workingAreaFocusRuntime?.group.visible === true,
      boundsMin: [state.boundsMin.x, state.boundsMin.y, state.boundsMin.z],
      boundsMax: [state.boundsMax.x, state.boundsMax.y, state.boundsMax.z],
    };
  }

  private applyTerrainCompositeStyle(
    layerId: string,
    style: EditableStyle,
  ): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.layers.get("terrain");
    if (!terrainGroup) return;
    const opacity =
      typeof style.opacity === "number" ? clamp01(style.opacity) : 1;
    const fillOpacity =
      typeof style.fillOpacity === "number"
        ? clamp01(style.fillOpacity)
        : opacity;
    const affectedByFog = styleAffectedByFog(style);
    const fogDensity = styleFogDensity(style, this.envFogDensity);
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          if (typeof style.color === "string") handle.setLakeColor(style.color);
          handle.setLakeFogEnabled(affectedByFog);
          handle.setLakeFogDensity(fogDensity);
          handle.setLakeOpacity(fillOpacity);
          break;
        case "three-firs-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-three-firs", style.color);
          }
          handle.setTargetFogEnabled("target-three-firs", affectedByFog);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-great-plains", style.color);
          }
          handle.setTargetFogEnabled("target-great-plains", affectedByFog);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          if (typeof style.color === "string")
            handle.setClaimColor(style.color);
          handle.setClaimFogEnabled(affectedByFog);
          handle.setClaimFogDensity(fogDensity);
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(affectedByFog);
          handle.setGeologyFogDensity(fogDensity);
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          if (typeof style.color === "string") {
            handle.setForestColor(style.color);
            handle.setForestOutlineColor(style.color);
          }
          handle.setForestFogEnabled(affectedByFog);
          handle.setForestFogDensity(fogDensity);
          handle.setForestEdge(
            typeof style.forestEdgeThreshold === "number"
              ? style.forestEdgeThreshold
              : 0.5,
            typeof style.forestEdgeSoftness === "number"
              ? style.forestEdgeSoftness
              : 0.035,
          );
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          // Sync wall geometry material (created by loadTreesVri).
          // wallMaterial lives on the inner group returned by the loader,
          // not on the outer wrapper group, so traverse to find it.
          {
            let wallMat: THREE.ShaderMaterial | undefined;
            this.layers.get("trees-vri")?.traverse((child) => {
              if (
                !wallMat &&
                child.userData?.wallMaterial instanceof THREE.ShaderMaterial
              )
                wallMat = child.userData.wallMaterial;
            });
            if (wallMat) {
              wallMat.uniforms.uWallHeight.value = Math.max(
                0,
                typeof style.forestEmbossHeight === "number"
                  ? style.forestEmbossHeight
                  : 0,
              );
              if (typeof style.color === "string")
                wallMat.uniforms.uColor.value.set(style.color);
              wallMat.uniforms.uFogEnabled.value = affectedByFog ? 1 : 0;
              wallMat.uniforms.uFogFar.value =
                3 / Math.max(fogDensity, 0.00001);
            }
          }
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
  }

  private applyEzGammaStyle(layerId: string, style: EditableStyle): void {
    if (layerId !== "ez-gamma-2024") return;
    const group = this.layers.get(layerId);
    if (!group) return;
    const bool = (value: unknown, fallback: boolean) =>
      typeof value === "boolean" ? value : fallback;
    const color = (value: unknown, fallback: string) =>
      typeof value === "string" ? value : fallback;
    const numeric = (
      value: unknown,
      fallback: number,
      min: number,
      max: number,
    ) =>
      clampRange(
        typeof value === "number" && Number.isFinite(value) ? value : fallback,
        min,
        max,
      );
    const applyMaterial = (
      obj: THREE.Object3D,
      nextColor: string,
      nextOpacity: number,
    ) => {
      const material = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!material) return;
      const mats = Array.isArray(material) ? material : [material];
      for (const mat of mats) {
        const colored = mat as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        colored.color?.set(nextColor);
        colored.emissive?.set(nextColor);
        mat.opacity = clamp01(nextOpacity);
        mat.transparent =
          mat.userData?.forceTransparent === true || mat.opacity < 1;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    };
    const depthScale = clampRange(
      typeof style.gammaDepthScale === "number" ? style.gammaDepthScale : 1,
      0.2,
      1.8,
    );
    const trackOffset = clampRange(
      typeof style.gammaTrackOffsetM === "number"
        ? style.gammaTrackOffsetM
        : 36,
      0,
      220,
    );
    const trackWidth = clampRange(
      typeof style.gammaTrackWidthM === "number" ? style.gammaTrackWidthM : 78,
      20,
      220,
    );
    const panelOpacity = clampRange(
      typeof style.gammaPanelOpacity === "number" ? style.gammaPanelOpacity : 0,
      0,
      1,
    );
    const panelVisible = bool(style.gammaPanelVisible, panelOpacity > 0.001);
    const panelColor = color(style.gammaPanelColor, "#1d211a");
    const trackScale = trackWidth / 78;
    const panelWidth = (trackOffset + trackWidth + 14) * 2;
    const collarVisible = bool(style.gammaCollarVisible, true);
    const collarColor = color(style.gammaCollarColor, "#9ee4ac");
    const collarOpacity = numeric(style.gammaCollarOpacity, 0.94, 0, 1);
    const collarRadius = numeric(style.gammaCollarRadiusM, 14, 2, 60);

    const tubeSettings = {
      surveyTube: {
        visible: bool(style.gammaSurveyTubeVisible, true),
        color: color(style.gammaSurveyTubeColor, "#e7ddc7"),
        opacity: numeric(style.gammaSurveyTubeOpacity, 0.34, 0, 1),
        radius: numeric(style.gammaSurveyTubeRadiusM, 3.6, 0.5, 24),
        mode: style.gammaSurveyTubeMode === "dashed" ? "dashed" : "solid",
      },
      loggedOverburden: {
        visible: bool(style.gammaLoggedOverburdenVisible, true),
        color: color(style.gammaLoggedOverburdenColor, "#d2a35f"),
        opacity: numeric(style.gammaLoggedOverburdenOpacity, 0.42, 0, 1),
        radius: numeric(style.gammaLoggedOverburdenRadiusM, 7.92, 0.5, 36),
        mode: style.gammaLoggedOverburdenMode === "dashed" ? "dashed" : "solid",
      },
      bedrockInterval: {
        visible: bool(style.gammaBedrockIntervalVisible, true),
        color: color(style.gammaBedrockIntervalColor, "#75c878"),
        opacity: numeric(style.gammaBedrockIntervalOpacity, 0.46, 0, 1),
        radius: numeric(style.gammaBedrockIntervalRadiusM, 6.12, 0.5, 36),
        mode: style.gammaBedrockIntervalMode === "dashed" ? "dashed" : "solid",
      },
    } as const;

    const contactShape = style.gammaContactShape === "coin" ? "coin" : "torus";
    const contactBaseRadius = 42;
    const contactRadius = numeric(style.gammaContactRadiusM, 42, 6, 120);
    const contactThickness = numeric(
      style.gammaContactThicknessM,
      3.2,
      0.4,
      18,
    );
    const contactRadiusScale = contactRadius / contactBaseRadius;
    const contactSettings = {
      1: {
        visible: bool(style.gammaContact1Visible, true),
        color: color(style.gammaContact1Color, "#fff2bc"),
        opacity: numeric(style.gammaContact1Opacity, 0.86, 0, 1),
      },
      2: {
        visible: bool(style.gammaContact2Visible, true),
        color: color(style.gammaContact2Color, "#e6d4a2"),
        opacity: numeric(style.gammaContact2Opacity, 0.55, 0, 1),
      },
    } as const;

    const tracesVisible = bool(style.gammaTracesVisible, true);
    const redTraceVisible = bool(style.gammaRedTraceVisible, true);
    const blueTraceVisible = bool(style.gammaBlueTraceVisible, true);
    const mirrorTraceVisible = bool(style.gammaMirrorTraceVisible, true);
    const redTraceColor = color(style.gammaRedTraceColor, "#f04a45");
    const blueTraceColor = color(style.gammaBlueTraceColor, "#3576ff");
    const traceOpacity = numeric(style.gammaTraceOpacity, 0.92, 0, 1);
    const traceWidth = numeric(
      style.gammaTraceWidthPx ?? style.lineWidth,
      2.4,
      0.25,
      14,
    );

    group.traverse((obj) => {
      if (obj.userData?.ezGammaHoleRoot === true) {
        obj.scale.z = depthScale;
      }
      if (obj.userData?.ezGammaPart === "collar") {
        const baseRadius =
          typeof obj.userData.ezGammaBaseRadiusM === "number"
            ? obj.userData.ezGammaBaseRadiusM
            : 14;
        obj.visible = collarVisible;
        obj.scale.setScalar(collarRadius / Math.max(0.001, baseRadius));
        applyMaterial(obj, collarColor, collarOpacity);
      }
      if (obj.userData?.ezGammaTubeMesh === true) {
        const part = obj.userData.ezGammaTubePart as
          | keyof typeof tubeSettings
          | undefined;
        const setting = part ? tubeSettings[part] : undefined;
        if (setting) {
          const variant =
            obj.userData.ezGammaTubeVariant === "dashed" ? "dashed" : "solid";
          const baseRadius =
            typeof obj.userData.ezGammaTubeBaseRadiusM === "number"
              ? obj.userData.ezGammaTubeBaseRadiusM
              : setting.radius;
          const radiusScale = setting.radius / Math.max(0.001, baseRadius);
          obj.visible = setting.visible && variant === setting.mode;
          obj.scale.set(radiusScale, 1, radiusScale);
          applyMaterial(obj, setting.color, setting.opacity);
        }
      }
      if (obj.userData?.ezGammaContact === true) {
        const index = obj.userData.ezGammaContactIndex === 2 ? 2 : 1;
        const setting = contactSettings[index];
        const shape =
          obj.userData.ezGammaContactShape === "coin" ? "coin" : "torus";
        const baseThickness =
          typeof obj.userData.ezGammaContactBaseThicknessM === "number"
            ? obj.userData.ezGammaContactBaseThicknessM
            : contactThickness;
        const thicknessScale =
          contactThickness / Math.max(0.001, baseThickness);
        obj.visible = setting.visible && shape === contactShape;
        if (shape === "coin") {
          obj.scale.set(contactRadiusScale, thicknessScale, contactRadiusScale);
        } else {
          obj.scale.set(contactRadiusScale, contactRadiusScale, thicknessScale);
        }
        applyMaterial(obj, setting.color, setting.opacity);
      }
      if (obj.userData?.ezGammaTrackGroup === true) {
        const side = obj.userData.ezGammaTrackSide === -1 ? -1 : 1;
        obj.position.x = trackOffset * side;
        obj.scale.x = trackScale;
      }
      if (obj.userData?.ezGammaTrackPanel === true) {
        obj.visible = panelVisible && panelOpacity > 0.001;
        const baseWidth =
          typeof obj.userData.ezGammaPanelBaseWidthM === "number"
            ? obj.userData.ezGammaPanelBaseWidthM
            : 256;
        obj.position.x = 0;
        obj.scale.x = baseWidth > 0 ? panelWidth / baseWidth : 1;
        applyMaterial(obj, panelColor, panelOpacity);
      }
      if (obj.userData?.ezGammaCurve === true) {
        const run = obj.userData.ezGammaCurveRun === "red" ? "red" : "blue";
        const side = obj.userData.ezGammaTraceSide === -1 ? -1 : 1;
        obj.visible =
          tracesVisible &&
          (side === 1 || mirrorTraceVisible) &&
          (run === "red" ? redTraceVisible : blueTraceVisible);
        const material = (obj as THREE.Line).material as
          | THREE.Material
          | undefined;
        if (material instanceof LineMaterial) {
          material.color.set(run === "red" ? redTraceColor : blueTraceColor);
          material.opacity = traceOpacity;
          material.transparent = true;
          material.linewidth = traceWidth;
          material.depthWrite = false;
          material.depthTest = false;
          material.needsUpdate = true;
        }
      }
    });
  }

  private updateEzGammaBillboards(camera: THREE.Camera): void {
    const group = this.layers.get("ez-gamma-2024");
    if (!group || !group.visible) return;
    group.traverse((obj) => {
      if (obj.userData?.ezGammaBillboardPivot !== true) return;
      obj.getWorldPosition(this.ezGammaWorldPos);
      this.ezGammaToCamera.copy(camera.position).sub(this.ezGammaWorldPos);
      this.ezGammaToCamera.z = 0;
      if (this.ezGammaToCamera.lengthSq() < 0.0001) return;
      this.ezGammaToCamera.normalize();
      obj.rotation.z =
        Math.atan2(this.ezGammaToCamera.y, this.ezGammaToCamera.x) +
        Math.PI / 2;
    });
  }

  private applyStreamLakeOcclusion(lakesVisible: boolean): void {
    const streamsGroup = this.layers.get("hydrography-streams");
    if (!streamsGroup) return;
    streamsGroup.traverse((obj) => {
      if (obj.userData?.hiddenByLakes === true) {
        obj.visible = !lakesVisible;
      }
    });
  }

  private applyGeochemStyle(layerId: string, style: EditableStyle): void {
    if (layerId !== "geochem-soils-2024") return;
    const group = this.layers.get(layerId);
    if (!group) return;
    const sampleRoots: THREE.Object3D[] = [];
    group.traverse((obj) => {
      if (obj.userData?.geochemSampleRoot === true) sampleRoots.push(obj);
    });
    if (sampleRoots.length === 0) return;

    const elements =
      (group.userData.geochemElements as
        | Record<
            string,
            {
              label?: string;
              symbol?: string;
              unit?: string;
              min?: number;
              q20?: number;
              q40?: number;
              q60?: number;
              q80?: number;
              max?: number;
            }
          >
        | undefined) ?? {};
    const firstElement = Object.keys(elements)[0] ?? "cu_ppm";
    let element =
      typeof style.geochemElement === "string"
        ? style.geochemElement
        : "cu_ppm";
    const hasSelectedElement = sampleRoots.some((root) => {
      const values = root.userData.elements as
        | Record<string, number>
        | undefined;
      return typeof values?.[element] === "number";
    });
    if (!hasSelectedElement) element = firstElement;

    const values = sampleRoots
      .map((root) => {
        const map = root.userData.elements as
          | Record<string, number>
          | undefined;
        const value = map?.[element];
        return typeof value === "number" && Number.isFinite(value)
          ? value
          : null;
      })
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    if (values.length === 0) return;

    const numeric = (
      value: unknown,
      fallback: number,
      min: number,
      max: number,
    ) =>
      clampRange(
        typeof value === "number" && Number.isFinite(value) ? value : fallback,
        min,
        max,
      );
    const color = (value: unknown, fallback: string) =>
      typeof value === "string" ? value : fallback;
    const quantile = (q: number) => {
      if (values.length === 1) return values[0];
      const pos = (values.length - 1) * q;
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      if (lo === hi) return values[lo];
      const t = pos - lo;
      return values[lo] * (1 - t) + values[hi] * t;
    };
    const stats = elements[element] ?? {};
    const breaks = [stats.q20, stats.q40, stats.q60, stats.q80].map((v, i) =>
      typeof v === "number" && Number.isFinite(v) ? v : quantile((i + 1) / 5),
    );
    const minValue =
      typeof stats.min === "number" && Number.isFinite(stats.min)
        ? stats.min
        : values[0];
    const maxValue =
      typeof stats.max === "number" && Number.isFinite(stats.max)
        ? stats.max
        : values[values.length - 1];
    const minRadius = numeric(style.geochemSymbolMinRadiusM, 45, 5, 400);
    const maxRadius = numeric(
      style.geochemSymbolMaxRadiusM,
      160,
      minRadius,
      600,
    );
    const lift = numeric(style.geochemLiftM, 24, 0, 220);
    const thickness = numeric(style.geochemSymbolThicknessM, 5, 0.5, 45);
    const opacity = numeric(
      style.geochemOpacity ?? style.opacity,
      typeof style.opacity === "number" ? style.opacity : 0.92,
      0,
      1,
    );
    const showOutline = style.geochemShowOutline !== false;
    const outlineOpacity = showOutline
      ? numeric(style.geochemOutlineOpacity, 0.65, 0, 1)
      : 0;
    const lowColor = new THREE.Color(color(style.geochemPaletteLow, "#2b6cb0"));
    const midColor = new THREE.Color(color(style.geochemPaletteMid, "#f2cf43"));
    const highColor = new THREE.Color(
      color(style.geochemPaletteHigh, "#c92a2a"),
    );
    const outlineColor = color(style.geochemOutlineColor, "#221f1c");
    const useLogScale = style.geochemUseLogScale !== false;
    const classColor = (classIndex: number) => {
      const t = classIndex / 4;
      const c = new THREE.Color();
      if (t <= 0.5) c.lerpColors(lowColor, midColor, t / 0.5);
      else c.lerpColors(midColor, highColor, (t - 0.5) / 0.5);
      return c;
    };
    const transform = (value: number) =>
      useLogScale ? Math.log10(Math.max(value, 0.000001)) : value;
    const minTransformed = transform(minValue);
    const maxTransformed = transform(maxValue);
    const denom = Math.max(0.000001, maxTransformed - minTransformed);
    const unit = stats.unit ?? (element.endsWith("_pct") ? "%" : "ppm");
    const label = stats.symbol ?? stats.label ?? element.replace("_", " ");
    const formatValue = (value: number) => {
      const decimals = unit === "%" ? 3 : value < 1 ? 3 : value < 10 ? 2 : 1;
      return `${value.toFixed(decimals)} ${unit}`;
    };

    const applyMaterial = (
      obj: THREE.Object3D,
      nextColor: THREE.Color | string,
      nextOpacity: number,
    ) => {
      const material = (obj as THREE.Mesh).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!material) return;
      const mats = Array.isArray(material) ? material : [material];
      for (const mat of mats) {
        const colored = mat as THREE.Material & { color?: THREE.Color };
        if (colored.color) colored.color.set(nextColor);
        mat.opacity = clamp01(nextOpacity);
        mat.transparent = true;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    };

    for (const root of sampleRoots) {
      const map = root.userData.elements as Record<string, number> | undefined;
      const value = map?.[element];
      const valid = typeof value === "number" && Number.isFinite(value);
      root.visible = valid;
      if (!valid) continue;
      let classIndex = breaks.findIndex((breakValue) => value <= breakValue);
      if (classIndex < 0) classIndex = 4;
      const t = clamp01((transform(value) - minTransformed) / denom);
      const radius = minRadius + (maxRadius - minRadius) * t;
      const fillColor = classColor(classIndex);
      const sceneTerrainZ =
        typeof root.userData.sceneTerrainZ === "number"
          ? root.userData.sceneTerrainZ
          : root.position.z - lift;
      root.position.z = sceneTerrainZ + lift;
      const sampleId =
        typeof root.userData.sampleId === "string"
          ? root.userData.sampleId
          : "Soil sample";
      const displayName = `${sampleId} | ${label} ${formatValue(value)}`;
      root.userData.displayName = displayName;

      for (const child of root.children) {
        child.userData.displayName = displayName;
        if (child.userData.geochemPart === "fill") {
          child.visible = opacity > 0.001;
          child.scale.set(radius, thickness, radius);
          applyMaterial(child, fillColor, opacity);
        }
        if (child.userData.geochemPart === "outline") {
          child.visible = showOutline && outlineOpacity > 0.001;
          child.position.z = thickness * 0.62;
          child.scale.setScalar(radius);
          applyMaterial(child, outlineColor, outlineOpacity);
        }
      }
    }
  }

  private applyHyperspectralStyle(layerId: string, style: EditableStyle): void {
    if (layerId !== "hyperspectral-coverage-2024") return;
    const group = this.layers.get(layerId);
    if (!group) return;
    const radius = clampRange(
      typeof style.hyperspectralRadiusM === "number"
        ? style.hyperspectralRadiusM
        : 18,
      2,
      90,
    );
    const endpointVisible = style.hyperspectralEndpointVisible !== false;
    const endpointRadius = clampRange(
      typeof style.hyperspectralEndpointRadiusM === "number"
        ? style.hyperspectralEndpointRadiusM
        : 30,
      2,
      140,
    );
    const opacity = clampRange(
      typeof style.opacity === "number" ? style.opacity : 0.72,
      0,
      1,
    );
    const color = typeof style.color === "string" ? style.color : "#b26cff";
    group.traverse((obj) => {
      if (obj.userData?.hyperspectralCoverage !== true) return;
      const part = obj.userData.hyperspectralPart;
      if (part === "tube") {
        const length =
          typeof obj.userData.segmentLength === "number"
            ? obj.userData.segmentLength
            : obj.scale.y;
        obj.visible = opacity > 0.001;
        obj.scale.set(radius, length, radius);
      } else if (part === "endpoint") {
        obj.visible = endpointVisible && opacity > 0.001;
        obj.scale.setScalar(endpointRadius);
      }
      const material = (obj as THREE.Mesh).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!material) return;
      const mats = Array.isArray(material) ? material : [material];
      for (const mat of mats) {
        const colored = mat as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        colored.color?.set(color);
        colored.emissive?.set(color);
        mat.opacity = opacity;
        mat.transparent = true;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    });
  }

  private applyImageryLidarAoiStyle(
    layerId: string,
    style: EditableStyle,
  ): void {
    if (layerId !== "imagery-lidar-aoi-2024") return;
    const group = this.layers.get(layerId);
    if (!group) return;
    const cornerVisible = style.imageryCornerVisible !== false;
    const cornerRadius = clampRange(
      typeof style.imageryCornerRadiusM === "number"
        ? style.imageryCornerRadiusM
        : 95,
      0,
      240,
    );
    const opacity = clampRange(
      typeof style.opacity === "number" ? style.opacity : 0.95,
      0,
      1,
    );
    group.traverse((obj) => {
      if (obj.userData?.imageryLidarAoi !== true) return;
      if (obj.userData.imageryLidarPart === "corner") {
        obj.visible = cornerVisible && opacity > 0.001 && cornerRadius > 0.001;
        obj.scale.setScalar(cornerRadius);
      }
    });
  }

  private updateAreaOutlineHandleVisibility(): void {
    const layer = this.layers.get("area-outlines");
    if (!layer) return;
    layer.traverse((obj) => {
      if (obj.userData?.areaOutlineEditorHandle === true) {
        obj.visible = this.editorMode;
      }
    });
  }

  listAreaOutlinePickables(): THREE.Object3D[] {
    return this.editorMode ? this.areaOutlinePickables : [];
  }

  private getAreaOutlineRoot(id: string): THREE.Group | null {
    const layer = this.layers.get("area-outlines");
    if (!layer) return null;
    const root = layer.children.find(
      (child) => child.userData?.areaOutlineId === id,
    );
    return root instanceof THREE.Group ? root : null;
  }

  previewAreaOutlineMove(id: string, sceneCenter: THREE.Vector3): void {
    const root = this.getAreaOutlineRoot(id);
    if (!root) return;
    root.position.x = sceneCenter.x;
    root.position.y = sceneCenter.y;
    root.userData.previewCenter = [
      sceneCenter.x + SCENE_ORIGIN.easting,
      sceneCenter.y + SCENE_ORIGIN.northing,
    ];
  }

  getAreaOutlineWorldCenter(id: string): THREE.Vector3 | null {
    const root = this.getAreaOutlineRoot(id);
    return root ? root.position.clone() : null;
  }

  previewAreaOutlineScaleFromWorld(
    id: string,
    mode: "scaleX" | "scaleY",
    worldPoint: THREE.Vector3,
  ): void {
    const root = this.getAreaOutlineRoot(id);
    if (!root) return;
    const local = root.worldToLocal(worldPoint.clone());
    const baseRadiusX = Number(root.userData.baseRadiusX ?? 1);
    const baseRadiusY = Number(root.userData.baseRadiusY ?? 1);
    if (mode === "scaleX") {
      const radius = clampRange(Math.abs(local.x), 10, 20000);
      root.scale.x = radius / Math.max(1, baseRadiusX);
      root.userData.previewRadiusX = radius;
    } else {
      const radius = clampRange(Math.abs(local.y), 10, 20000);
      root.scale.y = radius / Math.max(1, baseRadiusY);
      root.userData.previewRadiusY = radius;
    }
  }

  getAreaOutlinePreview(id: string): AreaOutlinePreview | null {
    const root = this.getAreaOutlineRoot(id);
    if (!root) return null;
    const baseRadiusX = Number(root.userData.baseRadiusX ?? 1);
    const baseRadiusY = Number(root.userData.baseRadiusY ?? 1);
    const center =
      Array.isArray(root.userData.previewCenter) &&
      typeof root.userData.previewCenter[0] === "number" &&
      typeof root.userData.previewCenter[1] === "number"
        ? ([root.userData.previewCenter[0], root.userData.previewCenter[1]] as [
            number,
            number,
          ])
        : ([
            root.position.x + SCENE_ORIGIN.easting,
            root.position.y + SCENE_ORIGIN.northing,
          ] as [number, number]);
    return {
      center,
      radiusX:
        typeof root.userData.previewRadiusX === "number"
          ? root.userData.previewRadiusX
          : baseRadiusX * root.scale.x,
      radiusY:
        typeof root.userData.previewRadiusY === "number"
          ? root.userData.previewRadiusY
          : baseRadiusY * root.scale.y,
    };
  }

  private markAreaOutlinePickable(
    obj: THREE.Object3D,
    id: string,
    mode: AreaOutlineHandleMode,
  ): void {
    obj.userData.areaOutlineEditorHandle = true;
    obj.userData.areaOutlineId = id;
    obj.userData.areaOutlineHandleMode = mode;
    obj.renderOrder = 4560;
    obj.visible = this.editorMode;
    this.areaOutlinePickables.push(obj);
  }

  private addAreaOutlineEditorHandles(
    root: THREE.Group,
    outline: AreaOutlineDef,
    rx: number,
    ry: number,
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: outline.outlineColor ?? outline.fillColor ?? "#ff8a3d",
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(mat);
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(52, 16, 10),
      mat.clone(),
    );
    center.position.set(0, 0, 95);
    this.markAreaOutlinePickable(center, outline.id, "move");
    root.add(center);

    const xHandle = new THREE.Mesh(
      new THREE.BoxGeometry(110, 110, 54),
      mat.clone(),
    );
    xHandle.position.set(rx, 0, 95);
    this.markAreaOutlinePickable(xHandle, outline.id, "scaleX");
    root.add(xHandle);

    const yHandle = new THREE.Mesh(
      new THREE.BoxGeometry(110, 110, 54),
      mat.clone(),
    );
    yHandle.position.set(0, ry, 95);
    this.markAreaOutlinePickable(yHandle, outline.id, "scaleY");
    root.add(yHandle);
  }

  private rebuildAreaOutlines(outlines: AreaOutlineDef[] = []): void {
    const layer = this.layers.get("area-outlines");
    if (!layer) return;
    const buildSeq = ++this.areaOutlineBuildSeq;
    this.areaOutlinePickables = [];
    while (layer.children.length > 0) {
      const child = layer.children.pop()!;
      disposeObjectTree(child);
    }
    if (outlines.length === 0) return;
    getHeightSampler()
      .then((sampleHeight) => {
        if (buildSeq !== this.areaOutlineBuildSeq) return;
        for (const outline of outlines) {
          layer.add(this.makeAreaOutlineObject(outline, sampleHeight));
        }
        this.updateAreaOutlineHandleVisibility();
      })
      .catch((e) => console.warn("area outline rebuild failed:", e));
  }

  private makeAreaOutlineObject(
    outline: AreaOutlineDef,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.Group {
    const centerE = Number(outline.center?.[0] ?? 612000);
    const centerN = Number(outline.center?.[1] ?? 5790000);
    const rx = clampRange(Number(outline.radiusX ?? 600), 10, 20000);
    const ry = clampRange(Number(outline.radiusY ?? 360), 10, 20000);
    const rotation = THREE.MathUtils.degToRad(outline.rotationDeg ?? 0);
    const lift = outline.liftMeters ?? AREA_OUTLINE_DEFAULT_LIFT_M;
    const centerZ = sampleHeight(centerE, centerN) + lift;
    const [cx, cy, cz] = utmToScene(centerE, centerN, centerZ);
    const root = new THREE.Group();
    root.name = outline.id;
    root.position.set(cx, cy, cz);
    root.rotation.z = rotation;
    root.userData = {
      areaOutline: true,
      areaOutlineId: outline.id,
      baseRadiusX: rx,
      baseRadiusY: ry,
      displayName: outline.label,
      labelKind: outline.labelKind ?? "area",
    };

    if (outline.fillVisible !== false) {
      const fillGeom = this.makeAreaOutlineFillGeometry(
        centerE,
        centerN,
        centerZ,
        rx,
        ry,
        rotation,
        lift,
        sampleHeight,
      );
      const fillMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(outline.fillColor ?? "#ff8a3d"),
        transparent: true,
        opacity: clampRange(outline.fillOpacity ?? 0.2, 0, 1),
        depthTest: true,
        depthWrite: false,
        roughness: 0.74,
        metalness: 0.02,
        side: THREE.DoubleSide,
        toneMapped: true,
        fog: false,
      });
      fillMat.userData.forceTransparent = true;
      fillMat.userData.ignoreLayerStyle = true;
      const fill = new THREE.Mesh(fillGeom, fillMat);
      fill.renderOrder = AREA_OUTLINE_RENDER_ORDER - 0.05;
      fill.userData = {
        areaOutline: true,
        areaOutlineId: outline.id,
        areaOutlinePart: "fill",
        displayName: outline.label,
        labelKind: outline.labelKind ?? "area",
      };
      root.add(fill);
    }

    if (outline.outlineVisible !== false) {
      this.addAreaOutlineDashes(
        root,
        outline,
        centerE,
        centerN,
        centerZ,
        rx,
        ry,
        rotation,
        lift,
        sampleHeight,
      );
    }
    this.addAreaOutlineEditorHandles(root, outline, rx, ry);
    return root;
  }

  private makeAreaOutlineFillGeometry(
    centerE: number,
    centerN: number,
    centerZ: number,
    rx: number,
    ry: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const rings = 16;
    const segments = AREA_OUTLINE_SEGMENTS;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const indexAt = (ring: number, seg: number) =>
      ring === 0 ? 0 : 1 + (ring - 1) * segments + (seg % segments);
    const addVertex = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      positions.push(x, y, sampleHeight(e, n) + lift - centerZ);
    };
    addVertex(0, 0);
    for (let r = 1; r <= rings; r++) {
      const f = r / rings;
      for (let s = 0; s < segments; s++) {
        const t = (s / segments) * Math.PI * 2;
        addVertex(Math.cos(t) * rx * f, Math.sin(t) * ry * f);
      }
    }
    const indices: number[] = [];
    for (let s = 0; s < segments; s++) {
      indices.push(0, indexAt(1, s), indexAt(1, s + 1));
    }
    for (let r = 2; r <= rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = indexAt(r - 1, s);
        const b = indexAt(r, s);
        const c = indexAt(r, s + 1);
        const d = indexAt(r - 1, s + 1);
        indices.push(a, b, c, a, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private addAreaOutlineDashes(
    root: THREE.Group,
    outline: AreaOutlineDef,
    centerE: number,
    centerN: number,
    centerZ: number,
    rx: number,
    ry: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): void {
    const color = new THREE.Color(outline.outlineColor ?? "#ff8a3d");
    const opacity = clampRange(outline.outlineOpacity ?? 0.95, 0, 1);
    const width = clampRange(outline.outlineWidthM ?? 14, 1, 300);
    const dashed = outline.dashed !== false;
    const flat2d = outline.outlineMode === "flat2d";
    const dashLength = clampRange(outline.dashLengthM ?? 170, 5, 2000);
    const dashGap = clampRange(outline.dashGapM ?? 90, 0, 2000);
    const circumference =
      Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const pattern = dashed ? dashLength + dashGap : circumference;
    const dashCount = Math.max(1, Math.ceil(circumference / pattern));
    const radialSegments = 8;
    const materialBase = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.015,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      roughness: 0.62,
      metalness: 0.04,
      toneMapped: true,
      fog: false,
    });
    materialBase.userData.forceTransparent = true;
    materialBase.userData.ignoreLayerStyle = true;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const surfaceOffset = flat2d ? 0.35 : 0;
    const localSurfaceZ = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      return sampleHeight(e, n) + lift + surfaceOffset - centerZ;
    };

    for (let i = 0; i < dashCount; i++) {
      const startDistance = i * pattern;
      const endDistance = dashed
        ? Math.min(startDistance + dashLength, circumference)
        : circumference;
      if (endDistance <= startDistance) continue;
      const t0 = (startDistance / circumference) * Math.PI * 2;
      const t1 = (endDistance / circumference) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      const steps = Math.max(3, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 80));
      for (let j = 0; j <= steps; j++) {
        const t = t0 + (t1 - t0) * (j / steps);
        const x = Math.cos(t) * rx;
        const y = Math.sin(t) * ry;
        points.push(new THREE.Vector3(x, y, localSurfaceZ(x, y)));
      }
      const geom = flat2d
        ? this.makeAreaOutlineRibbonGeometry(
            points,
            width,
            centerE,
            centerN,
            centerZ,
            rotation,
            lift + surfaceOffset,
            sampleHeight,
          )
        : new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            steps * 3,
            width * 0.5,
            radialSegments,
            false,
          );
      const dash = new THREE.Mesh(geom, materialBase.clone());
      dash.renderOrder = AREA_OUTLINE_RENDER_ORDER;
      dash.userData = {
        areaOutline: true,
        areaOutlineId: outline.id,
        areaOutlinePart: "outline",
        displayName: outline.label,
        labelKind: outline.labelKind ?? "area",
      };
      root.add(dash);

      if (flat2d) continue;
      const capGeom = new THREE.SphereGeometry(width * 0.5, 12, 8);
      for (const point of [points[0], points[points.length - 1]]) {
        const cap = new THREE.Mesh(capGeom.clone(), materialBase.clone());
        cap.position.copy(point);
        cap.renderOrder = AREA_OUTLINE_RENDER_ORDER;
        cap.userData = {
          areaOutline: true,
          areaOutlineId: outline.id,
          areaOutlinePart: "outline-cap",
          displayName: outline.label,
          labelKind: outline.labelKind ?? "area",
        };
        root.add(cap);
      }
    }
  }

  private makeAreaOutlineRibbonGeometry(
    points: THREE.Vector3[],
    width: number,
    centerE: number,
    centerN: number,
    centerZ: number,
    rotation: number,
    lift: number,
    sampleHeight: (easting: number, northing: number) => number,
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    const half = width * 0.5;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const sampleLocalZ = (x: number, y: number) => {
      const e = centerE + cosR * x - sinR * y;
      const n = centerN + sinR * x + cosR * y;
      return sampleHeight(e, n) + lift - centerZ;
    };

    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const leftX = points[i].x + nx * half;
      const leftY = points[i].y + ny * half;
      const rightX = points[i].x - nx * half;
      const rightY = points[i].y - ny * half;
      positions.push(leftX, leftY, sampleLocalZ(leftX, leftY));
      positions.push(rightX, rightY, sampleLocalZ(rightX, rightY));
      if (i < points.length - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private applyDrillingAssayDisplay(sp: SceneProperties): void {
    const drillGroup = this.layers.get("drillholes-2023");
    const assayGroup = this.layers.get("assay-samples");
    const groups = [drillGroup, assayGroup].filter(
      (group): group is THREE.Group => !!group,
    );
    if (groups.length === 0) return;
    const assays = sp.drilling?.assays ?? {};
    const traceMode = assays.traceMode ?? "assay";
    const showBoreLine = assays.showBoreLine ?? true;
    const boreLineColor = assays.boreLineColor ?? "#e7dcc4";
    const boreWidth = clampRange(assays.boreLineWidthPx ?? 3.25, 0.5, 12);
    const boreLineOpacity = clampRange(assays.boreLineOpacity ?? 0.72, 0, 1);
    const boreLineRenderOrder = clampRange(
      assays.boreLineRenderOrder ?? 6.8,
      0,
      20,
    );
    const showBoreTube = assays.showBoreTube ?? true;
    const boreTubeColor = assays.boreTubeColor ?? "#d8ccb2";
    const boreTubeOpacity = clampRange(assays.boreTubeOpacity ?? 0.88, 0, 1);
    const boreTubeRoughness = clampRange(
      assays.boreTubeRoughness ?? 0.64,
      0,
      1,
    );
    const boreTubeMetalness = clampRange(
      assays.boreTubeMetalness ?? 0.08,
      0,
      1,
    );
    const boreTubeEmissiveColor = assays.boreTubeEmissiveColor ?? "#8d826f";
    const boreTubeEmissive = clampRange(
      assays.boreTubeEmissive ?? 0.012,
      0,
      0.4,
    );
    const boreTubeRenderOrder = clampRange(
      assays.boreTubeRenderOrder ?? 5.4,
      0,
      20,
    );
    const assayWidth =
      boreWidth * clampRange(assays.assayWidthMultiplier ?? 2.6, 1, 10);
    const lithologyWidth =
      boreWidth * clampRange(assays.lithologyWidthMultiplier ?? 2.45, 1, 12);
    const lithologyOpacity = clampRange(assays.lithologyOpacity ?? 0.56, 0, 1);
    const showAssaySides = assays.showAssaySides ?? true;
    const showAssayCaps = assays.showAssayCaps ?? true;
    const assaySideOpacity = clampRange(assays.assaySideOpacity ?? 1, 0, 1);
    const assayCapOpacity = clampRange(assays.assayCapOpacity ?? 1, 0, 1);
    const capThicknessM = clampRange(assays.assayCapThicknessM ?? 1.6, 0.2, 20);
    const sideRoughness = clampRange(assays.assaySideRoughness ?? 0.46, 0, 1);
    const capRoughness = clampRange(assays.assayCapRoughness ?? 0.74, 0, 1);
    const metalness = clampRange(assays.assayMetalness ?? 0.02, 0, 1);
    const sideEmissive = clampRange(assays.assaySideEmissive ?? 0.018, 0, 0.4);
    const capEmissive = clampRange(assays.assayCapEmissive ?? 0.012, 0, 0.4);
    const sideRenderOrder = clampRange(assays.assaySideRenderOrder ?? 6, 0, 20);
    const capRenderOrder = clampRange(assays.assayCapRenderOrder ?? 6, 0, 20);
    const showBoreLens = assays.showBoreLens ?? true;
    const boreLensColor = assays.boreLensColor ?? "#e9dec4";
    const boreLensOpacity = clampRange(assays.boreLensOpacity ?? 0.16, 0, 1);
    const colorStops = new Map(
      DEFAULT_ASSAY_COLOR_STOPS.map((stop) => [stop.id, stop]),
    );
    for (const stop of assays.colorStops ?? []) {
      if (
        typeof stop.id === "string" &&
        typeof stop.color === "string" &&
        typeof stop.label === "string"
      ) {
        colorStops.set(stop.id, stop);
      }
    }

    for (const group of groups) {
      group.traverse((obj) => {
        const traceRole = (obj.userData as { drillTraceRole?: string })
          .drillTraceRole;
        if (traceRole === "assay") {
          const assayVisible = traceMode === "assay" || traceMode === "both";
          const isCap = obj.userData?.drillTubeCap === true;
          const isSide = obj.userData?.drillTubeSegment === true;
          obj.visible =
            assayVisible &&
            (!isCap || showAssayCaps) &&
            (!isSide || showAssaySides);
        } else if (traceRole === "lithology") {
          obj.visible = traceMode === "lithology" || traceMode === "both";
        } else if (traceRole === "bore") {
          obj.visible = true;
        }

        if (traceRole === "bore" && obj.userData?.drillBoreTube === true) {
          obj.visible = showBoreTube;
          const segmentLength =
            typeof obj.userData.segmentLength === "number"
              ? obj.userData.segmentLength
              : obj.scale.y;
          const radiusPerPixel =
            typeof obj.userData.radiusPerPixel === "number"
              ? obj.userData.radiusPerPixel
              : 1.6;
          const radius = boreWidth * radiusPerPixel;
          obj.scale.set(radius, segmentLength, radius);
          obj.renderOrder = boreTubeRenderOrder;
        }

        if (traceRole === "bore" && obj.userData?.drillBoreLens === true) {
          obj.userData.lensEnabled =
            showBoreLens && (traceMode === "assay" || traceMode === "both");
          const center = Array.isArray(obj.userData.capCenter)
            ? obj.userData.capCenter
            : null;
          const axis = Array.isArray(obj.userData.capAxis)
            ? obj.userData.capAxis
            : null;
          const radiusPerPixel =
            typeof obj.userData.radiusPerPixel === "number"
              ? obj.userData.radiusPerPixel
              : 2.1;
          const radius = boreWidth * radiusPerPixel;
          obj.scale.set(radius, radius, 1);
          if (center && axis) {
            const offset = capThicknessM * 0.52 + 0.05;
            obj.position.set(
              Number(center[0]) + Number(axis[0]) * offset,
              Number(center[1]) + Number(axis[1]) * offset,
              Number(center[2]) + Number(axis[2]) * offset,
            );
          }
          const lensMat = (obj as THREE.Mesh).material;
          const lensMats = Array.isArray(lensMat) ? lensMat : [lensMat];
          for (const lensMaterial of lensMats) {
            if (!(lensMaterial instanceof THREE.MeshBasicMaterial)) continue;
            lensMaterial.color.set(boreLensColor);
            lensMaterial.opacity = boreLensOpacity;
            lensMaterial.transparent = true;
            lensMaterial.toneMapped = true;
            lensMaterial.needsUpdate = true;
          }
          obj.renderOrder = capRenderOrder + 0.25;
        }

        if (
          traceRole === "assay" &&
          (obj.userData?.drillTubeSegment === true ||
            obj.userData?.drillTubeCap === true)
        ) {
          const isCap = obj.userData?.drillTubeCap === true;
          const segmentLength = isCap
            ? capThicknessM
            : typeof obj.userData.segmentLength === "number"
              ? obj.userData.segmentLength
              : obj.scale.y;
          const radiusPerPixel =
            typeof obj.userData.radiusPerPixel === "number"
              ? obj.userData.radiusPerPixel
              : 2.5;
          const radius = assayWidth * radiusPerPixel;
          obj.scale.set(radius, segmentLength, radius);
          obj.renderOrder = isCap ? capRenderOrder : sideRenderOrder;
        }

        const mat = (obj as { material?: THREE.Material | THREE.Material[] })
          .material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          const role = m.userData?.drillAssayRole;
          if (!(m instanceof LineMaterial)) {
            if (role === "bore" && m instanceof THREE.MeshStandardMaterial) {
              m.color.set(boreTubeColor);
              m.emissive.set(boreTubeEmissiveColor);
              m.emissiveIntensity = boreTubeEmissive;
              m.roughness = boreTubeRoughness;
              m.metalness = boreTubeMetalness;
              m.opacity = boreTubeOpacity;
              m.transparent = true;
              m.toneMapped = true;
              m.needsUpdate = true;
            }
            if (role === "assay") {
              const surface =
                m.userData?.drillAssaySurface === "cap" ? "cap" : "side";
              const stopId = m.userData?.assayColorStopId;
              const stop =
                typeof stopId === "string" ? colorStops.get(stopId) : undefined;
              const colored = m as THREE.Material & { color?: THREE.Color };
              if (stop?.color && colored.color) {
                const nextColor = new THREE.Color(stop.color);
                colored.color.copy(nextColor);
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.emissive.copy(nextColor);
                  m.emissiveIntensity =
                    surface === "cap" ? capEmissive : sideEmissive;
                  m.roughness =
                    surface === "cap" ? capRoughness : sideRoughness;
                  m.metalness = metalness;
                }
              }
              m.opacity =
                surface === "cap" ? assayCapOpacity : assaySideOpacity;
              m.transparent = true;
              (m as THREE.MeshStandardMaterial).toneMapped = true;
              m.needsUpdate = true;
            }
            continue;
          }
          if (role === "bore") {
            m.color.set(boreLineColor);
            m.linewidth = boreWidth;
            m.opacity = boreLineOpacity;
            m.transparent = true;
            (obj as THREE.Object3D).visible = showBoreLine;
            obj.renderOrder = boreLineRenderOrder;
          } else if (role === "assay") {
            m.linewidth = assayWidth;
          } else if (role === "lithology") {
            m.linewidth = lithologyWidth;
            m.opacity = lithologyOpacity;
            m.transparent = true;
          } else {
            continue;
          }
          if (role === "bore") {
            m.blending = THREE.NormalBlending;
            m.toneMapped = true;
          } else if (role === "lithology") {
            m.blending = THREE.NormalBlending;
            m.toneMapped = true;
          } else {
            // Assay bands are data colour first. Additive blending made distant
            // stacked intervals bleach toward white, so keep the Cu/Au bins as
            // ordinary transparent colour even when the old Glow toggle is on.
            m.blending = THREE.NormalBlending;
            m.toneMapped = true;
          }
          m.needsUpdate = true;
        }
      });
    }
  }

  private applyTopoDetailDistanceDisplay(sp: SceneProperties): void {
    const topo = sp.topoDetails ?? {};
    const near = clampRange(topo.distanceFadeNear ?? 5000, 0, 500000);
    const far = clampRange(topo.distanceFadeFar ?? 19000, near + 250, 750000);
    const minScale = clampRange(topo.farLineScale ?? 0.67, 0.01, 1);
    const minAlpha = clampRange(topo.farOpacity ?? 0.2, 0, 1);

    for (const id of TOPO_DISTANCE_LINE_LAYER_IDS) {
      const group = this.layers.get(id);
      if (!group) continue;
      group.traverse((obj) => {
        const mat = (obj as { material?: THREE.Material | THREE.Material[] })
          .material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (!(m instanceof LineMaterial)) continue;
          if (m.userData.distanceAttenuatedLineWidth !== true) continue;
          setDistanceAttenuatedLineWidth(m, {
            near,
            far,
            minScale,
            minAlpha,
          });
        }
      });
    }
  }

  getLayer(id: string): THREE.Group | undefined {
    return this.layers.get(id);
  }

  getTransitionDebugState(): {
    active: boolean;
    sourcePageId: string | null;
    targetPageId: string | null;
    reason: NavigationReason | null;
    activeDataTransitionCount: number;
    snapshotCount: number;
    scalarTweenCount: number;
    layerTweenCount: number;
  } {
    const transition = this.activeSceneTransitionContext;
    return {
      active: !!transition,
      sourcePageId: transition?.sourcePageId ?? null,
      targetPageId: transition?.targetPageId ?? null,
      reason: transition?.reason ?? null,
      activeDataTransitionCount:
        this.layerTweens.size +
        this.scalarStyleTweens.size +
        (this.workingAreaFocusTween ? 1 : 0),
      snapshotCount: this.layerTransitionSnapshots.size,
      scalarTweenCount: this.scalarStyleTweens.size,
      layerTweenCount: this.layerTweens.size,
    };
  }

  private listAuthoredScalarSectionIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    const targets: ScalarSectionIsoTarget[] = [];
    const entries =
      typeof layerId === "string"
        ? ([[layerId, this.layers.get(layerId)]].filter(
            (entry) => entry[1],
          ) as Array<[string, THREE.Group]>)
        : Array.from(this.layers.entries());
    for (const [id, group] of entries) {
      group.traverse((obj) => {
        if (!isScalarSectionMesh(obj)) return;
        const sectionId = scalarSectionMeshId(obj) ?? obj.uuid;
        const range = scalarSourceRange(obj.geometry);
        targets.push({
          targetKey: scalarSectionTargetKey(id, obj),
          layerId: id,
          sectionId,
          label: scalarSectionMeshLabel(obj),
          kind: scalarSectionMeshKind(obj),
          group: "mt-slices",
          groupLabel: "MT slices",
          visible: group.visible && obj.visible,
          scalarMin: range.min,
          scalarMax: range.max,
        });
      });
    }
    return targets;
  }

  private listSeismicSectionIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const group = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!group) return [];
    const targets: ScalarSectionIsoTarget[] = [];
    group.traverse((obj) => {
      if (!isSeismicSectionMesh(obj)) return;
      const values = obj.geometry.userData.seismicAmplitudeValues as
        | Float32Array
        | number[];
      let scalarMin = 1;
      let scalarMax = 0;
      for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        if (!Number.isFinite(value)) continue;
        scalarMin = Math.min(scalarMin, value);
        scalarMax = Math.max(scalarMax, value);
      }
      if (scalarMax <= scalarMin) {
        scalarMin = 0;
        scalarMax = 1;
      }
      const sectionId = seismicSectionMeshId(obj) ?? obj.uuid;
      targets.push({
        targetKey: seismicSectionTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          obj,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId,
        label: seismicSectionMeshLabel(obj),
        kind: seismicSectionMeshKind(obj),
        group: "seismic-sections",
        groupLabel: "Seismic sections",
        visible: group.visible && obj.visible,
        scalarMin,
        scalarMax,
      });
    });
    return targets;
  }

  private activeScalarVolumeMesh(): THREE.Mesh | null {
    const group = this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID);
    if (!group || !group.visible) return null;
    let active: THREE.Mesh | null = null;
    group.traverse((obj) => {
      if (active) return;
      if (
        obj instanceof THREE.Mesh &&
        obj.userData?.scalarVolume === true &&
        obj.visible
      ) {
        active = obj;
      }
    });
    return active;
  }

  private activeSeismicVolumeMesh(): THREE.Mesh | null {
    const group = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!group || !group.visible) return null;
    let active: THREE.Mesh | null = null;
    group.traverse((obj) => {
      if (active) return;
      if (
        obj instanceof THREE.Mesh &&
        obj.userData?.seismicRaymarchVolume === true &&
        obj.visible
      ) {
        active = obj;
      }
    });
    return active;
  }

  private listMtVolumeCutIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
      return [];
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.scalarVolumeProductLabel === "string"
        ? mesh.userData.scalarVolumeProductLabel
        : "MT volume";
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const scalarMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const scalarMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane) => ({
        targetKey: mtVolumeCutTargetKey(
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        sectionId: mtVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} cut`,
        kind: "MT volume cut",
        group: "mt-volume-cuts",
        groupLabel: "MT volume cuts",
        visible: true,
        scalarMin,
        scalarMax,
      }),
    );
  }

  private listSeismicVolumeCutIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.seismicProductLabel === "string"
        ? mesh.userData.seismicProductLabel
        : "Seismic volume";
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane) => ({
        targetKey: seismicVolumeCutTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId: seismicVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} volume cut`,
        kind: "seismic volume cut",
        group: "seismic-volume-cuts",
        groupLabel: "Seismic volume cuts",
        visible: true,
        scalarMin: 0,
        scalarMax: 1,
      }),
    );
  }

  listSectionIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    const targets = [
      ...this.listAuthoredScalarSectionIsoTargets(layerId),
      ...this.listMtVolumeCutIsoTargets(layerId),
      ...this.listSeismicSectionIsoTargets(layerId),
      ...this.listSeismicVolumeCutIsoTargets(layerId),
    ];
    const groupOrder: Record<SectionIsoTargetGroup, number> = {
      "mt-slices": 0,
      "mt-volume-cuts": 1,
      "seismic-sections": 2,
      "seismic-volume-cuts": 3,
    };
    targets.sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if (a.group !== b.group) return groupOrder[a.group] - groupOrder[b.group];
      if (a.layerId !== b.layerId) return a.layerId.localeCompare(b.layerId);
      return a.label.localeCompare(b.label);
    });
    return targets;
  }

  listScalarSectionIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    return this.listAuthoredScalarSectionIsoTargets(layerId).sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if (a.layerId !== b.layerId) return a.layerId.localeCompare(b.layerId);
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Iterator over (id, group) pairs. Used by the hover-raycaster in
   * scene.ts to assemble the set of intersect targets minus terrain.
   */
  layerEntries(): IterableIterator<[string, THREE.Group]> {
    return this.layers.entries();
  }

  private applySurfaceGradientStyle(id: string, style: EditableStyle): void {
    if (
      id !== SHAHBAZI_GROUND_SURFACE_LAYER_ID ||
      !hasSurfaceGradientStyle(style)
    ) {
      return;
    }

    const group = this.layers.get(id);
    if (!group) return;

    const meshes: THREE.Mesh[] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.meshPreview !== true) return;
      const position = obj.geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) return;
      meshes.push(obj);
      for (let i = 0; i < position.count; i += 1) {
        const z = position.getZ(i);
        if (Number.isFinite(z)) {
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
      }
    });

    if (
      meshes.length === 0 ||
      !Number.isFinite(minZ) ||
      !Number.isFinite(maxZ)
    ) {
      return;
    }

    const zRange = Math.max(0.0001, maxZ - minZ);
    const lowColor = styleColor(
      style,
      "surfaceGradientLowColor",
      DEFAULT_SURFACE_GRADIENT_LOW_COLOR,
    );
    const midColor = styleColor(
      style,
      "surfaceGradientMidColor",
      DEFAULT_SURFACE_GRADIENT_MID_COLOR,
    );
    const highColor = styleColor(
      style,
      "surfaceGradientHighColor",
      DEFAULT_SURFACE_GRADIENT_HIGH_COLOR,
    );
    const midpoint = styleNumber(
      style,
      "surfaceGradientMidpoint",
      0.5,
      0.05,
      0.95,
    );
    const contrast = styleNumber(
      style,
      "surfaceGradientContrast",
      1,
      0.35,
      2.5,
    );
    const scratch = new THREE.Color();

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) continue;

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

      for (let i = 0; i < position.count; i += 1) {
        surfaceGradientColorAt(
          (position.getZ(i) - minZ) / zRange,
          midpoint,
          contrast,
          lowColor,
          midColor,
          highColor,
          scratch,
        );
        color.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      color.needsUpdate = true;

      const material = mesh.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if ("vertexColors" in m) {
          (m as THREE.Material & { vertexColors: boolean }).vertexColors = true;
          m.needsUpdate = true;
        }
      }
    }
  }

  private applyMtTopSurfaceStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const liftM = styleNumber(style, "meshSurfaceLiftM", 0, -12000, 12000);
    const wireframe = style.meshWireframe === true;
    const roughness = styleNumber(style, "meshRoughness", 0.72, 0, 1);
    const metalness = styleNumber(style, "meshMetalness", 0.02, 0, 1);
    const tint = styleColor(style, "color", "#ffffff");

    const liftedRoots = group.children.length > 0 ? group.children : [group];
    for (const child of liftedRoots) {
      const baseZ =
        typeof child.userData.mtTopSurfaceBaseZ === "number"
          ? child.userData.mtTopSurfaceBaseZ
          : child.position.z;
      child.userData.mtTopSurfaceBaseZ = baseZ;
      child.position.z = baseZ + liftM;
      child.updateMatrixWorld();
    }

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        if ("wireframe" in m) {
          (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
        }
        if ("roughness" in m) {
          (m as THREE.Material & { roughness: number }).roughness = roughness;
        }
        if ("metalness" in m) {
          (m as THREE.Material & { metalness: number }).metalness = metalness;
        }
        if ("color" in m) {
          (m as THREE.Material & { color: THREE.Color }).color.copy(tint);
        }
        m.needsUpdate = true;
      }
    });
  }

  private applyScalarPreviewStyle(id: string, style: EditableStyle): void {
    const group = this.layers.get(id);
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

  private applyPointMarkerStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_STATIONS_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const defaultRadius =
      typeof group.userData.defaultMarkerRadiusM === "number"
        ? group.userData.defaultMarkerRadiusM
        : 1;
    const defaultLift =
      typeof group.userData.defaultMarkerLiftM === "number"
        ? group.userData.defaultMarkerLiftM
        : 0;
    const defaultLabelLift =
      typeof group.userData.defaultMarkerLabelLiftM === "number"
        ? group.userData.defaultMarkerLabelLiftM
        : 1;
    const radius = styleNumber(
      style,
      "pointMarkerRadiusM",
      defaultRadius,
      0.05,
      20000,
    );
    const lift = styleNumber(
      style,
      "pointMarkerLiftM",
      defaultLift,
      -20000,
      20000,
    );
    const labelLift = styleNumber(
      style,
      "pointMarkerLabelLiftM",
      defaultLabelLift,
      0,
      50000,
    );
    const selectedStationId =
      typeof style.mtStationQcSelectedStationId === "string"
        ? style.mtStationQcSelectedStationId
        : "";
    group.userData.mtStationQcSelectedStationId = selectedStationId;

    group.traverse((obj) => {
      if (obj.userData?.pointMarker === true && obj instanceof THREE.Mesh) {
        const baseRadius =
          typeof obj.userData.baseMarkerRadiusM === "number"
            ? obj.userData.baseMarkerRadiusM
            : defaultRadius;
        const scale = radius / Math.max(0.0001, baseRadius);
        obj.scale.setScalar(scale);
        const baseZ =
          typeof obj.userData.baseZ === "number"
            ? obj.userData.baseZ
            : obj.position.z;
        obj.position.z = baseZ + lift;
        const stationId =
          typeof obj.userData.sourceProperties?.stationId === "string"
            ? obj.userData.sourceProperties.stationId
            : typeof obj.userData.markerId === "string"
              ? obj.userData.markerId
              : "";
        const material = obj.material;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          if ("color" in m) {
            (m as THREE.Material & { color: THREE.Color }).color.set(
              stationId && stationId === selectedStationId
                ? "#ffd34d"
                : (style.color ?? "#999999"),
            );
          }
          if ("emissive" in m) {
            (m as THREE.Material & { emissive: THREE.Color }).emissive.set(
              stationId && stationId === selectedStationId
                ? "#ff7a2c"
                : "#000000",
            );
          }
          m.needsUpdate = true;
        }
      }
      if (obj.userData?.pointMarkerLabelAnchor === true) {
        const baseZ =
          typeof obj.userData.baseZ === "number"
            ? obj.userData.baseZ
            : obj.position.z;
        obj.position.z = baseZ + lift + labelLift;
      }
    });
  }

  private applyResistivitySliceStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const horizontalVisible =
      style.resistivityHorizontalSlicesVisible !== false;
    const verticalVisible = style.resistivityVerticalSectionsVisible !== false;
    const perSlice =
      typeof style.resistivitySliceVisibility === "object" &&
      style.resistivitySliceVisibility !== null
        ? (style.resistivitySliceVisibility as Record<string, boolean>)
        : {};

    group.traverse((obj) => {
      if (obj.userData?.resistivitySlicePreview !== true) return;
      const kind =
        typeof obj.userData.resistivitySliceKind === "string"
          ? obj.userData.resistivitySliceKind
          : "";
      const sliceId =
        typeof obj.userData.resistivitySliceId === "string"
          ? obj.userData.resistivitySliceId
          : "";
      const groupVisible =
        kind === "vertical-section" ? verticalVisible : horizontalVisible;
      obj.visible = groupVisible && perSlice[sliceId] !== false;
    });
  }

  private scalarVolumeTransferModeCode(style: EditableStyle): number {
    if (style.scalarVolumeTransferMode === "soft") return 0;
    if (style.scalarVolumeTransferMode === "dense") return 2;
    return 1;
  }

  private applyScalarVolumeStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const products = Array.isArray(group.userData.scalarVolumeProducts)
      ? (group.userData.scalarVolumeProducts as Array<{ id?: unknown }>)
          .map((product) => product.id)
          .filter(
            (productId): productId is string => typeof productId === "string",
          )
      : [];
    const requested =
      typeof style.scalarVolumeProductId === "string"
        ? style.scalarVolumeProductId
        : typeof group.userData.scalarVolumeDefaultProductId === "string"
          ? group.userData.scalarVolumeDefaultProductId
          : products[0];
    const selectedProductId =
      requested && (products.length === 0 || products.includes(requested))
        ? requested
        : products[0];
    group.userData.scalarVolumeSelectedProductId = selectedProductId;

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
    const contrast = styleNumber(style, "scalarContrast", 1.05, 0.35, 3);
    const opacity = styleNumber(
      style,
      "scalarVolumeOpacity",
      styleNumber(style, "opacity", 0.48, 0, 1),
      0,
      1,
    );
    const isoSourceOpacity =
      style.sectionIsoEnabled === true
        ? styleNumber(style, "sectionIsoSourceOpacity", 0, 0, 1)
        : 1;
    const renderOpacity = opacity * isoSourceOpacity;
    const density = styleNumber(style, "scalarVolumeDensity", 0.72, 0, 2);
    const sampleSteps = styleNumber(
      style,
      "scalarVolumeSampleSteps",
      112,
      24,
      192,
    );
    const maskVisible = style.scalarVolumeMaskVisible !== false ? 1 : 0;
    const transferMode = this.scalarVolumeTransferModeCode(style);

    group.traverse((obj) => {
      if (obj.userData?.scalarVolume !== true || !(obj instanceof THREE.Mesh))
        return;
      const productId =
        typeof obj.userData.scalarVolumeProductId === "string"
          ? obj.userData.scalarVolumeProductId
          : "";
      obj.visible = productId === selectedProductId;
      const material = obj.material;
      const materials = Array.isArray(material) ? material : [material];
      const sourceRange = Array.isArray(obj.userData.scalarVolumeSourceRange)
        ? (obj.userData.scalarVolumeSourceRange as number[])
        : [-2, 4.5];
      const displayRange = Array.isArray(obj.userData.scalarVolumeDisplayRange)
        ? (obj.userData.scalarVolumeDisplayRange as number[])
        : [0.139879, 3.937122];
      const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
      const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
      const displayMin = styleNumber(
        style,
        "scalarDisplayMin",
        Number.isFinite(displayRange[0]) ? displayRange[0] : 0.139879,
        -100,
        100,
      );
      const rawDisplayMax = styleNumber(
        style,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : 3.937122,
        -100,
        100,
      );
      const displayMax = Math.max(rawDisplayMax, displayMin + 0.000001);
      const thresholdMin = styleNumber(
        style,
        "scalarVolumeThresholdMin",
        styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
        -100,
        100,
      );
      const rawThresholdMax = styleNumber(
        style,
        "scalarVolumeThresholdMax",
        styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
        -100,
        100,
      );
      const thresholdMax = Math.max(rawThresholdMax, thresholdMin + 0.000001);
      for (const m of materials) {
        if (!(m instanceof THREE.ShaderMaterial)) continue;
        const uniforms = m.uniforms;
        if (uniforms.uColorLow) uniforms.uColorLow.value.copy(lowColor);
        if (uniforms.uColorMid) uniforms.uColorMid.value.copy(midColor);
        if (uniforms.uColorHigh) uniforms.uColorHigh.value.copy(highColor);
        if (uniforms.uDisplayMin) uniforms.uDisplayMin.value = displayMin;
        if (uniforms.uDisplayMax) uniforms.uDisplayMax.value = displayMax;
        if (uniforms.uThresholdMin) uniforms.uThresholdMin.value = thresholdMin;
        if (uniforms.uThresholdMax) uniforms.uThresholdMax.value = thresholdMax;
        if (uniforms.uMidpoint) uniforms.uMidpoint.value = midpoint;
        if (uniforms.uContrast) uniforms.uContrast.value = contrast;
        if (uniforms.uOpacity) uniforms.uOpacity.value = renderOpacity;
        if (uniforms.uDensity) uniforms.uDensity.value = density;
        if (uniforms.uSampleSteps) uniforms.uSampleSteps.value = sampleSteps;
        if (uniforms.uTransferMode) uniforms.uTransferMode.value = transferMode;
        if (uniforms.uMaskVisible) uniforms.uMaskVisible.value = maskVisible;
        m.userData.scalarVolumeUniformState = {
          productId,
          visible: obj.visible,
          displayMin,
          displayMax,
          thresholdMin,
          thresholdMax,
          opacity: renderOpacity,
          sourceOpacity: opacity,
          sectionIsoSourceOpacity: isoSourceOpacity,
          density,
          sampleSteps,
          transferMode,
          maskVisible,
        };
        m.needsUpdate = true;
      }
    });
    this.updateMtVolumeCutIsoOverlays(style);
  }

  private scalarVolumeIsoOverlayGroup(volumeLayer: THREE.Group): THREE.Group {
    const existing = volumeLayer.userData.mtVolumeSectionIsoOverlayGroup as
      | THREE.Group
      | undefined;
    if (existing && existing.parent === volumeLayer) return existing;
    const group = new THREE.Group();
    group.name = "mt-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.mtVolumeSectionIsoOverlayGroup = true;
    volumeLayer.userData.mtVolumeSectionIsoOverlayGroup = group;
    volumeLayer.add(group);
    return group;
  }

  private clearMtVolumeCutIsoOverlays(volumeLayer?: THREE.Group): void {
    const group = (
      volumeLayer ?? this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
    )?.userData.mtVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (volumeLayer) delete volumeLayer.userData.mtVolumeSectionIsoOverlayGroup;
  }

  private sampleScalarVolumeByte(
    bytes: Uint8Array,
    dimensions: [number, number, number],
    u: number,
    v: number,
    w: number,
  ): number {
    const [nx, ny, nz] = dimensions;
    const x = clampRange(u, 0, 1) * Math.max(0, nx - 1);
    const y = clampRange(v, 0, 1) * Math.max(0, ny - 1);
    const z = clampRange(w, 0, 1) * Math.max(0, nz - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = Math.min(nx - 1, x0 + 1);
    const y1 = Math.min(ny - 1, y0 + 1);
    const z1 = Math.min(nz - 1, z0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;
    const sample = (ix: number, iy: number, iz: number): number => {
      const index = ix + nx * (iy + ny * iz);
      return bytes[index] ?? 0;
    };
    const c000 = sample(x0, y0, z0);
    const c100 = sample(x1, y0, z0);
    const c010 = sample(x0, y1, z0);
    const c110 = sample(x1, y1, z0);
    const c001 = sample(x0, y0, z1);
    const c101 = sample(x1, y0, z1);
    const c011 = sample(x0, y1, z1);
    const c111 = sample(x1, y1, z1);
    const c00 = c000 + (c100 - c000) * tx;
    const c10 = c010 + (c110 - c010) * tx;
    const c01 = c001 + (c101 - c001) * tx;
    const c11 = c011 + (c111 - c011) * tx;
    const c0 = c00 + (c10 - c00) * ty;
    const c1 = c01 + (c11 - c01) * ty;
    return c0 + (c1 - c0) * tz;
  }

  private buildMtVolumeCutMesh(
    mesh: THREE.Mesh,
    plane: ResolvedSceneSectionPlane,
    options: {
      sourceMin: number;
      sourceMax: number;
      thresholdMin: number;
      thresholdMax: number;
      maskVisible: boolean;
      targetKey: string;
    },
  ): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.scalarVolumeDimensions)
      ? (mesh.userData.scalarVolumeDimensions as [number, number, number])
      : null;
    const bounds = mesh.userData.scalarVolumeBounds as
      | { min?: [number, number, number]; max?: [number, number, number] }
      | undefined;
    const volumeData = mesh.userData.scalarVolumeData as Uint8Array | undefined;
    const maskData = mesh.userData.scalarVolumeMaskData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const normalized =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        const scalar =
          options.sourceMin +
          normalized * (options.sourceMax - options.sourceMin);
        const mask =
          options.maskVisible && maskData
            ? this.sampleScalarVolumeByte(maskData, dimensions, u, v, w) / 255
            : 1;
        values[vertexIndex] = scalar;
        alphaValues[vertexIndex] =
          scalar >= options.thresholdMin &&
          scalar <= options.thresholdMax &&
          mask > 0.01
            ? mask
            : 0;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} MT volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

  private updateMtVolumeCutIsoOverlays(style: EditableStyle): void {
    const volumeLayer = this.layers.get(
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    );
    if (!volumeLayer) return;
    this.clearMtVolumeCutIsoOverlays(volumeLayer);
    if (style.sectionIsoEnabled !== true || !volumeLayer.visible) return;
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;

    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const displayRange = Array.isArray(mesh.userData.scalarVolumeDisplayRange)
      ? (mesh.userData.scalarVolumeDisplayRange as number[])
      : [sourceRange[0], sourceRange[1]];
    const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    const displayMin = styleNumber(
      style,
      "scalarDisplayMin",
      Number.isFinite(displayRange[0]) ? displayRange[0] : sourceMin,
      -100,
      100,
    );
    const displayMax = Math.max(
      styleNumber(
        style,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : sourceMax,
        -100,
        100,
      ),
      displayMin + 0.000001,
    );
    const thresholdMin = styleNumber(
      style,
      "scalarVolumeThresholdMin",
      styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
      -100,
      100,
    );
    const thresholdMax = Math.max(
      styleNumber(
        style,
        "scalarVolumeThresholdMax",
        styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
        -100,
        100,
      ),
      thresholdMin + 0.000001,
    );
    const isoMin = clampRange(
      styleNumber(style, "sectionIsoMin", thresholdMin, sourceMin, sourceMax),
      sourceMin,
      sourceMax,
    );
    const isoMax = clampRange(
      Math.max(
        styleNumber(style, "sectionIsoMax", thresholdMax, sourceMin, sourceMax),
        isoMin + 0.000001,
      ),
      isoMin + 0.000001,
      sourceMax,
    );
    const baseOptions = {
      layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMin: displayMin,
      colorMax: displayMax,
      midpoint: styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95),
      contrast: styleNumber(style, "scalarContrast", 1.05, 0.35, 3),
      lowColor: styleColor(style, "scalarColorLow", DEFAULT_SCALAR_LOW_COLOR),
      midColor: styleColor(style, "scalarColorMid", DEFAULT_SCALAR_MID_COLOR),
      highColor: styleColor(
        style,
        "scalarColorHigh",
        DEFAULT_SCALAR_HIGH_COLOR,
      ),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.scalarVolumeIsoOverlayGroup(volumeLayer);
    for (const plane of planes) {
      const targetKey = mtVolumeCutTargetKey(
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildMtVolumeCutMesh(mesh, plane, {
        sourceMin,
        sourceMax,
        thresholdMin,
        thresholdMax,
        maskVisible: style.scalarVolumeMaskVisible !== false,
        targetKey,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearMtVolumeCutIsoOverlays(volumeLayer);
    }
  }

  private seismicVolumeIsoOverlayGroup(seismicLayer: THREE.Group): THREE.Group {
    const existing = seismicLayer.userData
      .seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (existing && existing.parent === seismicLayer) return existing;
    const group = new THREE.Group();
    group.name = "seismic-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.seismicVolumeSectionIsoOverlayGroup = true;
    seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup = group;
    seismicLayer.add(group);
    return group;
  }

  private clearSeismicVolumeCutIsoOverlays(seismicLayer?: THREE.Group): void {
    const group = (
      seismicLayer ?? this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    )?.userData.seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (seismicLayer) {
      delete seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup;
    }
  }

  private buildSeismicVolumeCutMesh(
    mesh: THREE.Mesh,
    plane: ResolvedSceneSectionPlane,
    options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
    },
  ): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.seismicVolumeDimensions)
      ? (mesh.userData.seismicVolumeDimensions as [number, number, number])
      : null;
    const bounds =
      (mesh.userData.seismicVolumeCurrentBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined) ??
      (mesh.userData.seismicVolumeBaseBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined);
    const volumeData = mesh.userData.seismicVolumeData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const amplitude =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        values[vertexIndex] = amplitude;
        alphaValues[vertexIndex] = seismicBackgroundAlphaAt(
          amplitude,
          options.amplitudeMin,
          options.amplitudeMax,
          options.removeBackground,
          options.amplitudeGamma,
          options.backgroundCutoff,
        );
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} seismic volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

  private updateSeismicVolumeCutIsoOverlays(style: EditableStyle): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    if (style.sectionIsoEnabled !== true || !seismicLayer.visible) return;
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;

    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
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
    const removeBackground = style.seismicRemoveBackground === true;
    const backgroundCutoff = styleNumber(
      style,
      "seismicBackgroundCutoff",
      0.16,
      0,
      0.45,
    );
    const rawIsoMin = styleNumber(style, "sectionIsoMin", amplitudeMin, 0, 1);
    const isoMin = clampRange(rawIsoMin, 0, 1);
    const rawIsoMax = styleNumber(style, "sectionIsoMax", amplitudeMax, 0, 1);
    const isoMax = clampRange(
      Math.max(rawIsoMax, isoMin + 0.000001),
      isoMin + 0.000001,
      1,
    );
    const colormap =
      style.seismicColormap === "grayscale" ||
      style.seismicColormap === "velocity"
        ? style.seismicColormap
        : "blue-white-red";
    const colorMode =
      colormap === "grayscale"
        ? "seismic-grayscale"
        : colormap === "velocity"
          ? "seismic-velocity"
          : "seismic-blue-white-red";
    const baseOptions = {
      layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMode,
      amplitudeGamma,
      colorMin: amplitudeMin,
      colorMax: amplitudeMax,
      midpoint: 0.5,
      contrast: 1,
      lowColor: new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
      midColor: new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
      highColor: new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.seismicVolumeIsoOverlayGroup(seismicLayer);
    for (const plane of planes) {
      const targetKey = seismicVolumeCutTargetKey(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildSeismicVolumeCutMesh(mesh, plane, {
        amplitudeMin,
        amplitudeMax,
        amplitudeGamma,
        removeBackground,
        backgroundCutoff,
        targetKey,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    }
  }

  private applyMtThresholdSurfaceStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const visibility =
      typeof style.mtThresholdSurfaceVisibility === "object" &&
      style.mtThresholdSurfaceVisibility !== null
        ? (style.mtThresholdSurfaceVisibility as Record<string, boolean>)
        : {};
    const wireframe = style.mtThresholdSurfaceWireframe === true;
    group.traverse((obj) => {
      if (obj.userData?.mtThresholdSurfacePreview !== true) return;
      const surfaceId =
        typeof obj.userData.mtThresholdSurfaceId === "string"
          ? obj.userData.mtThresholdSurfaceId
          : "";
      obj.visible = visibility[surfaceId] !== false;
      const material = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      const materials = Array.isArray(material)
        ? material
        : material
          ? [material]
          : [];
      for (const m of materials) {
        if ("wireframe" in m) {
          (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
        }
        if ("vertexColors" in m) {
          (m as THREE.Material & { vertexColors: boolean }).vertexColors = true;
        }
        m.opacity = styleNumber(style, "opacity", 0.42, 0, 1);
        m.transparent = true;
        m.depthWrite = false;
        m.needsUpdate = true;
      }
    });
  }

  private seismicBrowserRoot(group: THREE.Group): THREE.Object3D | null {
    if (group.userData?.seismicBrowser === true) return group;
    let root: THREE.Object3D | null = null;
    group.traverse((obj) => {
      if (!root && obj.userData?.seismicBrowser === true) root = obj;
    });
    return root;
  }

  private seismicBrowserRuntimeIndex(group: THREE.Group): {
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
  } | null {
    const root = this.seismicBrowserRoot(group);
    if (!root) return null;
    const cached = group.userData.seismicRuntimeIndex as
      | ReturnType<SceneManager["seismicBrowserRuntimeIndex"]>
      | undefined;
    if (cached && cached.root === root) return cached;

    const rawSummaries = Array.isArray(root.userData.seismicProducts)
      ? (root.userData.seismicProducts as Array<{
          id?: unknown;
          surveyKind?: unknown;
          productKind?: unknown;
          domainKind?: unknown;
          amplitudeStats?: unknown;
          raymarchCapable?: unknown;
        }>)
      : Array.isArray(group.userData.seismicProducts)
        ? (group.userData.seismicProducts as Array<{
            id?: unknown;
            surveyKind?: unknown;
            productKind?: unknown;
            domainKind?: unknown;
            amplitudeStats?: unknown;
            raymarchCapable?: unknown;
          }>)
        : [];
    const summaryMap = new Map<
      string,
      {
        id: string;
        surveyKind?: string;
        productKind?: string;
        domainKind?: string;
        amplitudeStats?: Record<string, unknown>;
        raymarchCapable: boolean;
      }
    >();
    for (const summary of rawSummaries) {
      if (typeof summary.id !== "string" || summary.id.length === 0) continue;
      summaryMap.set(summary.id, {
        id: summary.id,
        surveyKind:
          typeof summary.surveyKind === "string"
            ? summary.surveyKind
            : undefined,
        productKind:
          typeof summary.productKind === "string"
            ? summary.productKind
            : undefined,
        domainKind:
          typeof summary.domainKind === "string"
            ? summary.domainKind
            : undefined,
        amplitudeStats:
          summary.amplitudeStats &&
          typeof summary.amplitudeStats === "object" &&
          !Array.isArray(summary.amplitudeStats)
            ? (summary.amplitudeStats as Record<string, unknown>)
            : undefined,
        raymarchCapable: summary.raymarchCapable === true,
      });
    }

    const sectionsByProduct = new Map<string, THREE.Object3D[]>();
    const volumesByProduct = new Map<string, THREE.Object3D[]>();
    const navigationObjects: THREE.Object3D[] = [];
    const navigationObjectsByRole = new Map<string, THREE.Object3D[]>();
    root.traverse((obj) => {
      if (obj.userData?.seismicNavigation === true) {
        navigationObjects.push(obj);
        const role =
          typeof obj.userData.seismicNavigationRole === "string"
            ? obj.userData.seismicNavigationRole
            : "all";
        const roleObjects = navigationObjectsByRole.get(role) ?? [];
        roleObjects.push(obj);
        navigationObjectsByRole.set(role, roleObjects);
      }
      const productId =
        typeof obj.userData?.seismicProductId === "string"
          ? obj.userData.seismicProductId
          : "";
      if (!productId) return;
      if (!summaryMap.has(productId)) {
        summaryMap.set(productId, {
          id: productId,
          surveyKind:
            typeof obj.userData.seismicProductSurveyKind === "string"
              ? obj.userData.seismicProductSurveyKind
              : undefined,
          productKind:
            typeof obj.userData.seismicProductKind === "string"
              ? obj.userData.seismicProductKind
              : undefined,
          domainKind:
            typeof obj.userData.seismicProductDomainKind === "string"
              ? obj.userData.seismicProductDomainKind
              : undefined,
          amplitudeStats:
            obj.userData.seismicProductValueStats &&
            typeof obj.userData.seismicProductValueStats === "object" &&
            !Array.isArray(obj.userData.seismicProductValueStats)
              ? (obj.userData.seismicProductValueStats as Record<
                  string,
                  unknown
                >)
              : undefined,
          raymarchCapable: obj.userData?.seismicRaymarchVolume === true,
        });
      } else if (obj.userData?.seismicRaymarchVolume === true) {
        summaryMap.get(productId)!.raymarchCapable = true;
      }
      if (obj.userData?.seismicSection === true) {
        const sections = sectionsByProduct.get(productId) ?? [];
        sections.push(obj);
        sectionsByProduct.set(productId, sections);
      }
      if (obj.userData?.seismicRaymarchVolume === true) {
        const volumes = volumesByProduct.get(productId) ?? [];
        volumes.push(obj);
        volumesByProduct.set(productId, volumes);
      }
    });

    const index = {
      root,
      productSummaries: Array.from(summaryMap.values()),
      sectionsByProduct,
      volumesByProduct,
      navigationObjects,
      navigationObjectsByRole,
    };
    group.userData.seismicRuntimeIndex = index;
    return index;
  }

  private applySeismicBrowserStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const index = this.seismicBrowserRuntimeIndex(group);
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
    const sourceOpacity = opacity * sectionIsoSourceOpacity;
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
    const rawSectionIsoMin = styleNumber(
      style,
      "sectionIsoMin",
      amplitudeMin,
      0,
      1,
    );
    const sectionIsoMin = clampRange(rawSectionIsoMin, 0, 1);
    const rawSectionIsoMax = styleNumber(
      style,
      "sectionIsoMax",
      amplitudeMax,
      0,
      1,
    );
    const sectionIsoMax = clampRange(
      Math.max(rawSectionIsoMax, sectionIsoMin + 0.000001),
      sectionIsoMin + 0.000001,
      1,
    );
    const sectionIsoColorMode =
      colormap === "grayscale"
        ? "seismic-grayscale"
        : colormap === "velocity"
          ? "seismic-velocity"
          : "seismic-blue-white-red";
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

    const scratch = new THREE.Color();
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
        if (uniforms.uOpacity) uniforms.uOpacity.value = sourceOpacity;
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

        const values = geometry.userData.seismicAmplitudeValues as
          | Float32Array
          | number[]
          | undefined;
        const color = geometry.getAttribute("color");
        const alpha = geometry.getAttribute("seismicAlpha");
        if (values && color instanceof THREE.BufferAttribute) {
          for (let i = 0; i < Math.min(color.count, values.length); i += 1) {
            seismicColorAt(
              values[i],
              amplitudeMin,
              amplitudeMax,
              colormap,
              amplitudeGamma,
              scratch,
            );
            color.setXYZ(i, scratch.r, scratch.g, scratch.b);
          }
          color.needsUpdate = true;
        }
        if (values && alpha instanceof THREE.BufferAttribute) {
          for (let i = 0; i < Math.min(alpha.count, values.length); i += 1) {
            alpha.setX(
              i,
              seismicBackgroundAlphaAt(
                values[i],
                amplitudeMin,
                amplitudeMax,
                removeBackground,
                amplitudeGamma,
                backgroundCutoff,
              ),
            );
          }
          alpha.needsUpdate = true;
        }

        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const material of materials) {
          if (material instanceof THREE.ShaderMaterial) {
            if (material.uniforms.uOpacity) {
              material.uniforms.uOpacity.value = sourceOpacity;
            }
          } else if ("opacity" in material) {
            material.opacity = sourceOpacity;
            material.transparent = true;
          }
          material.needsUpdate = true;
        }

        if (obj.visible && values && isSeismicSectionMesh(obj)) {
          const alphaValues =
            alpha instanceof THREE.BufferAttribute
              ? sectionIsoAttributeValues(
                  alpha,
                  position instanceof THREE.BufferAttribute
                    ? position.count
                    : values.length,
                )
              : undefined;
          updateScalarSectionIsoOverlay(obj, values, {
            layerId: id,
            enabled: sectionIsoEnabled,
            linesVisible: sectionIsoLinesVisible,
            bandsVisible: sectionIsoBandsVisible,
            selectedTargetIds: sectionIsoSelectedTargets,
            targetKey: seismicSectionTargetKey(id, obj),
            alphaValues,
            colorMode: sectionIsoColorMode,
            amplitudeGamma,
            isoMin: sectionIsoMin,
            isoMax: sectionIsoMax,
            levelCount: sectionIsoLevelCount,
            lineWidth: sectionIsoLineWidth,
            lineStyle: sectionIsoLineStyle,
            bandOpacity: sectionIsoBandOpacity,
            fillOffset: sectionIsoFillOffset,
            colorMin: amplitudeMin,
            colorMax: amplitudeMax,
            midpoint: 0.5,
            contrast: 1,
            lowColor: new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
            midColor: new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
            highColor: new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
          });
        } else {
          disposeScalarSectionIsoOverlay(obj);
        }
      }
    }
    this.updateSeismicVolumeCutIsoOverlays(style);
  }

  private applyContourDisplayStyle(id: string, style: EditableStyle): void {
    if (id !== SHAHBAZI_GROUND_CONTOUR_LAYER_ID && !isContourLikeLayerId(id)) {
      return;
    }

    const group = this.layers.get(id);
    if (!group) return;

    const near = styleNumber(
      style,
      "contourDistanceFadeNearM",
      DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M,
      5,
      2000,
    );
    const rawFar = styleNumber(
      style,
      "contourDistanceFadeFarM",
      DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M,
      10,
      5000,
    );
    const far = Math.max(rawFar, near + 5);
    const minScale = styleNumber(
      style,
      "contourFarLineScale",
      DEFAULT_CONTOUR_FAR_LINE_SCALE,
      0.03,
      1,
    );
    const minAlpha = styleNumber(
      style,
      "contourFarOpacity",
      DEFAULT_CONTOUR_FAR_OPACITY,
      0.05,
      1,
    );
    const lift = styleNumber(
      style,
      "contourLiftM",
      DEFAULT_CONTOUR_LIFT_M,
      -0.25,
      8,
    );
    const lineColor =
      typeof style.contourPresetColor === "string"
        ? style.contourPresetColor
        : typeof style.color === "string"
          ? style.color
          : null;
    const lineOpacity =
      typeof style.contourPresetOpacity === "number"
        ? clamp01(style.contourPresetOpacity)
        : typeof style.opacity === "number"
          ? clamp01(style.opacity)
          : null;
    const lineWidth =
      typeof style.contourPresetLineWidth === "number"
        ? style.contourPresetLineWidth
        : typeof style.lineWidth === "number"
          ? style.lineWidth
          : null;

    group.traverse((obj) => {
      if (obj.userData?.contourLine === true) {
        obj.position.z = lift;
      }
      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (!(m instanceof LineMaterial)) continue;
        if (lineColor) m.color.set(lineColor);
        if (lineOpacity !== null) {
          m.opacity = lineOpacity;
          m.transparent = lineOpacity < 1;
        }
        if (lineWidth !== null) {
          const worldLineWidthScale =
            typeof m.userData?.worldLineWidthScale === "number"
              ? m.userData.worldLineWidthScale
              : 1;
          const minLineWidth =
            typeof m.userData?.worldLineWidthMin === "number"
              ? m.userData.worldLineWidthMin
              : 0.5;
          const maxLineWidth =
            typeof m.userData?.worldLineWidthMax === "number"
              ? m.userData.worldLineWidthMax
              : 12;
          m.linewidth = clampRange(
            lineWidth * worldLineWidthScale,
            minLineWidth,
            maxLineWidth,
          );
        }
        if (m.userData?.contourDistanceAttenuatedLineWidth === true) {
          setDistanceAttenuatedLineWidth(m, {
            near,
            far,
            minScale,
            minAlpha,
          });
        }
        m.dashed = false;
        m.depthTest = true;
        m.depthFunc = THREE.LessEqualDepth;
        m.depthWrite = false;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -6;
        m.polygonOffsetUnits = -6;
        m.needsUpdate = true;
      }
    });
  }

  applyStyle(id: string, style: EditableStyle): void {
    this.appliedLayerStyles.set(id, style);
    if (id === UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID) {
      this.applyWorkingAreaFocusStyle(style);
      return;
    }
    const group = this.layers.get(id);
    const affectedByFog = styleAffectedByFog(style);
    const fogDensity = styleFogDensity(style, this.envFogDensity);
    if (group) {
      group.traverse((obj) => {
        const mat = (obj as THREE.Mesh | THREE.Line).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (m.userData?.ignoreLayerStyle === true) continue;
          const targetOpacity =
            m.userData?.lakeFillMaterial === true &&
            typeof style.fillOpacity === "number"
              ? clamp01(style.fillOpacity)
              : typeof style.opacity === "number"
                ? style.opacity
                : this.baseOpacityForMaterial(m);
          const colored = m as THREE.Material & {
            color?: THREE.Color;
            emissive?: THREE.Color;
          };
          const preserveVertexColors =
            m.userData?.preserveVertexColors === true;
          const preserveMaterialColor =
            m.userData?.preserveMaterialColor === true;
          const preserveMaterialOpacity =
            m.userData?.preserveMaterialOpacity === true;
          const materialColor =
            m.userData?.lakeOutlineMaterial === true &&
            typeof style.outlineColor === "string"
              ? style.outlineColor
              : m.userData?.lakeFillMaterial === true &&
                  typeof style.color === "string"
                ? style.color
                : style.color;
          if (
            typeof materialColor === "string" &&
            colored.color &&
            !preserveVertexColors &&
            !preserveMaterialColor
          ) {
            colored.color.set(materialColor);
            if (colored.emissive) {
              colored.emissive.set(materialColor);
            }
          }
          if (
            m instanceof LineMaterial &&
            typeof style.lineWidth === "number" &&
            m.userData?.drillAssayRole === undefined
          ) {
            const worldLineWidthScale =
              typeof m.userData?.worldLineWidthScale === "number"
                ? m.userData.worldLineWidthScale
                : 1;
            const minLineWidth =
              typeof m.userData?.worldLineWidthMin === "number"
                ? m.userData.worldLineWidthMin
                : 0.5;
            const maxLineWidth =
              typeof m.userData?.worldLineWidthMax === "number"
                ? m.userData.worldLineWidthMax
                : 12;
            m.linewidth = clampRange(
              style.lineWidth * worldLineWidthScale,
              minLineWidth,
              maxLineWidth,
            );
          }
          if (m instanceof THREE.PointsMaterial) {
            m.size = clampRange(
              typeof style.pointSizePx === "number"
                ? style.pointSizePx
                : m.size,
              0.5,
              24,
            );
            applyPointDistanceLightMaterial(
              m,
              styleNumber(style, "scalarDistanceLightStrength", 0, 0, 1),
            );
          }
          if (
            m instanceof LineMaterial &&
            m.userData?.terrainShadowInfluence !== undefined
          ) {
            setTerrainShadowInfluence(
              m,
              typeof style.terrainShadowInfluence === "number"
                ? style.terrainShadowInfluence
                : 0.09,
            );
          }
          if (!preserveMaterialOpacity) {
            m.opacity = targetOpacity;
            m.transparent =
              m.userData?.forceTransparent === true || targetOpacity < 1;
            if (m instanceof THREE.ShaderMaterial && m.uniforms.uOpacity) {
              m.uniforms.uOpacity.value = targetOpacity;
            }
            if (m.userData?.terrainMaterial === true) {
              m.transparent = true;
              m.depthWrite = targetOpacity >= 0.999;
            }
          }
          setMaterialFog(m, this.envFogEnabled && affectedByFog, fogDensity);
          m.needsUpdate = true;
        }
      });
    }
    this.applyTerrainFogStyle(id, affectedByFog, fogDensity);
    this.applyTerrainLiftStyle(id, style);
    if (id === "terrain" || PUBLIC_SURFACE_LAYER_IDS.has(id)) {
      this.applyPublicSurfaceClipStyle(this.styleForLayer("terrain"));
    }
    if (id === "terrain") {
      this.applyTopoGraticuleStyle(
        UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
        this.styleForLayer(UTAH_FORGE_TOPO_GRATICULE_LAYER_ID),
      );
    }
    this.applyTerrainCompositeStyle(id, style);
    this.applyTopoGraticuleStyle(id, style);
    this.applyGeochemStyle(id, style);
    this.applyHyperspectralStyle(id, style);
    this.applyImageryLidarAoiStyle(id, style);
    this.applyEzGammaStyle(id, style);
    this.applyCaseStudyBDemoLayerAlias(id, style);
    this.applySurfaceGradientStyle(id, style);
    this.applyScalarPreviewStyle(id, style);
    this.applyScalarVolumeStyle(id, style);
    this.applyMtThresholdSurfaceStyle(id, style);
    this.applyMtTopSurfaceStyle(id, style);
    this.applyPointMarkerStyle(id, style);
    this.applyResistivitySliceStyle(id, style);
    this.applySeismicBrowserStyle(id, style);
    this.applyContourDisplayStyle(id, style);
    if (id === UTAH_FORGE_SCENE_SECTION_LAYER_ID) {
      this.applySceneSectionPlanes(style);
    } else {
      this.reapplySceneSectionPlanes();
    }
    this.reapplyWorkingAreaFocus();
  }

  applyEffectiveStylesForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.clearLayerTransitionSnapshots();
    this.activeSceneTransitionContext = null;
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    for (const id of this.layers.keys()) {
      this.applyStyle(id, effectiveStyle(environment, page, id));
    }
    this.applySceneSectionPlanes(
      effectiveStyle(environment, page, UTAH_FORGE_SCENE_SECTION_LAYER_ID),
    );
    this.applyWorkingAreaFocusStyle(
      effectiveStyle(environment, page, UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID),
    );
    this.applyLakesToTerrain(environment, page);
  }

  applyEffectiveVisibilityForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.clearLayerTransitionSnapshots();
    this.activeSceneTransitionContext = null;
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    this.setVisible(effectiveVisibility(environment, page));
    this.applyWorkingAreaFocusStyle(
      effectiveStyle(environment, page, UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID),
    );
    this.applyLakesToTerrain(environment, page);
  }

  transitionEffectiveLayersForPage(
    environment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number = DEFAULT_LAYER_FADE_MS,
    easing: EasingName = "easeInOutCubic",
    scalarStyleDurationMs: number = durationMs,
    scalarStyleEasing: EasingName = easing,
    reason: NavigationReason = "programmatic",
  ): void {
    const layerIds = new Set<string>([
      ...this.layers.keys(),
      ...Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES),
    ]);
    const sourceLayers = this.captureLayerRenderStates(
      environment,
      fromPage,
      layerIds,
    );
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.clearLayerTransitionSnapshots();
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = toPage;

    const toVisible = effectiveVisibility(environment, toPage);
    this.currentVisibleLayerIds = toVisible;
    const now = performance.now();
    const duration = Math.max(0, durationMs);
    const terrainOverrides = new Map<string, number>();
    const layerKinds: Record<string, LayerTransitionKind> = {};
    this.activeSceneTransitionContext = {
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      reason,
      startMs: now,
      durationMs: duration,
      easing,
      layerKinds,
      sourceLayers,
    };

    for (const id of layerIds) {
      const sourceState = sourceLayers.get(id);
      const fromOpacity = sourceState?.opacity ?? 0;
      const toOpacity = toVisible.has(id)
        ? this.targetOpacityForLayer(environment, toPage, id)
        : 0;
      const fromStyle =
        sourceState?.style ?? effectiveStyle(environment, fromPage, id);
      const targetStyle = effectiveStyle(environment, toPage, id);
      const group = this.layers.get(id);
      if (group) group.visible = fromOpacity > 0.001 || toOpacity > 0.001;
      const shouldCrossfadeDiscreteData =
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        forgeDiscreteDataStyleChanged(id, fromStyle, targetStyle);
      const shouldTweenScalarStyle =
        !!group &&
        !shouldCrossfadeDiscreteData &&
        scalarStyleDurationMs > 0 &&
        fromOpacity > 0.001 &&
        toOpacity > 0.001 &&
        this.layerSupportsScalarStyleTween(id, group) &&
        scalarTransitionStyleChanged(fromStyle, targetStyle);
      const shouldCrossfadeScalarStyle =
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        this.layerHasScalarPreviewData(group) &&
        !toVisible.has(id);
      const transitionSnapshot =
        shouldCrossfadeDiscreteData || shouldCrossfadeScalarStyle
          ? this.cloneLayerTransitionSnapshot(id, group)
          : null;
      const transitionKind: LayerTransitionKind =
        shouldCrossfadeDiscreteData || shouldCrossfadeScalarStyle
          ? "discrete-crossfade"
          : shouldTweenScalarStyle
            ? id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
              ? "full-density-scalar"
              : "continuous"
            : "none";
      layerKinds[id] = transitionKind;

      // Apply target page colour/provenance-style immediately, but restore the
      // visual opacity to the old page value before the fade begins.
      this.applyStyle(id, shouldTweenScalarStyle ? fromStyle : targetStyle);
      if (shouldTweenScalarStyle) {
        this.scalarStyleTweens.set(id, {
          id,
          from: 0,
          to: 1,
          fromStyle,
          toStyle: targetStyle,
          startMs: now,
          durationMs: Math.max(0, scalarStyleDurationMs),
          easing: scalarStyleEasing,
        });
      }
      if (transitionSnapshot) {
        this.applyRenderOpacityToTree(transitionSnapshot, fromOpacity);
        this.applyLayerRenderOpacity(id, 0);
        this.layerTweens.set(id, {
          from: 0,
          to: toOpacity,
          startMs: now,
          durationMs: duration,
          easing,
        });
        this.layerTransitionSnapshots.set(id, {
          id,
          group: transitionSnapshot,
          from: fromOpacity,
          to: 0,
          style: fromStyle,
          startMs: now,
          durationMs: duration,
          easing,
        });
        terrainOverrides.set(id, 0);
        continue;
      }
      this.applyLayerRenderOpacity(id, fromOpacity);
      terrainOverrides.set(id, fromOpacity);

      if (duration <= 0 || Math.abs(fromOpacity - toOpacity) < 0.001) {
        this.applyLayerRenderOpacity(id, toOpacity);
        terrainOverrides.set(id, toOpacity);
        continue;
      }

      this.layerTweens.set(id, {
        from: fromOpacity,
        to: toOpacity,
        startMs: now,
        durationMs: duration,
        easing,
      });
    }

    this.transitionWorkingAreaFocusForPage(
      environment,
      fromPage,
      toPage,
      duration,
      easing,
    );

    // Terrain-composite layers (lakes, targets, claims, geology, forest cover)
    // render part of their visual fill through terrain uniforms, not just group
    // materials.
    // This call sets their target colours while preserving old-page opacities;
    // frameUpdate then fades the same uniforms alongside regular materials.
    this.applyLakesToTerrain(environment, toPage, terrainOverrides);
  }

  /**
   * Special-case hook: hydrography-lakes, VRI forest cover, and the two target glow-fills
   * are rendered by the TERRAIN shader (rasterized polygon masks
   * recolor terrain pixels where the layer exists) rather than by
   * their own geometry. Push effective color + visibility into the
   * terrain handle's per-slot uniforms. The ring outlines for the
   * targets remain as Line2 polylines in the layer groups and follow
   * the standard applyStyle path.
   */
  private applyLakesToTerrain(
    environment: EnvironmentSetup,
    page: PresentationPage,
    opacityOverrides: ReadonlyMap<string, number> = new Map(),
  ): void {
    const terrainGroup = this.layers.get("terrain");
    if (!terrainGroup) return;
    const visibleSet = effectiveVisibility(environment, page);

    const lakeStyle = effectiveStyle(environment, page, "hydrography-lakes");
    const lakeFillOpacity =
      typeof lakeStyle.fillOpacity === "number"
        ? lakeStyle.fillOpacity
        : typeof lakeStyle.opacity === "number"
          ? lakeStyle.opacity
          : 1;
    const lakeOp =
      opacityOverrides.get("hydrography-lakes") ??
      (visibleSet.has("hydrography-lakes") ? 1 : 0) * lakeFillOpacity;
    this.applyStreamLakeOcclusion(lakeOp > 0.001);

    const tfStyle = effectiveStyle(environment, page, "three-firs-target");
    const tfOp =
      opacityOverrides.get("three-firs-target") ??
      (visibleSet.has("three-firs-target") ? 1 : 0) *
        (typeof tfStyle.opacity === "number" ? tfStyle.opacity : 1);

    const gpStyle = effectiveStyle(environment, page, "great-plains-target");
    const gpOp =
      opacityOverrides.get("great-plains-target") ??
      (visibleSet.has("great-plains-target") ? 1 : 0) *
        (typeof gpStyle.opacity === "number" ? gpStyle.opacity : 1);

    const claimStyle = effectiveStyle(environment, page, "claim-boundary");
    const claimOp =
      opacityOverrides.get("claim-boundary") ??
      (visibleSet.has("claim-boundary") ? 1 : 0) *
        (typeof claimStyle.opacity === "number" ? claimStyle.opacity : 1);

    const geologyStyle = effectiveStyle(environment, page, "bedrock-geology");
    const geologyOp =
      opacityOverrides.get("bedrock-geology") ??
      (visibleSet.has("bedrock-geology") ? 1 : 0) *
        (typeof geologyStyle.opacity === "number"
          ? geologyStyle.opacity
          : 0.28);

    const forestStyle = effectiveStyle(environment, page, "trees-vri");
    const forestOpacity =
      typeof forestStyle.opacity === "number" ? forestStyle.opacity : 0.4;
    const forestOp =
      opacityOverrides.get("trees-vri") ??
      (visibleSet.has("trees-vri") ? 1 : 0);

    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      if (typeof lakeStyle.color === "string")
        handle.setLakeColor(lakeStyle.color);
      handle.setLakeFogEnabled(styleAffectedByFog(lakeStyle));
      handle.setLakeFogDensity(styleFogDensity(lakeStyle, this.envFogDensity));
      handle.setLakeOpacity(lakeOp);
      if (typeof tfStyle.color === "string")
        handle.setTargetColor("target-three-firs", tfStyle.color);
      handle.setTargetFogEnabled(
        "target-three-firs",
        styleAffectedByFog(tfStyle),
      );
      handle.setTargetFogDensity(
        "target-three-firs",
        styleFogDensity(tfStyle, this.envFogDensity),
      );
      handle.setTargetOpacity("target-three-firs", tfOp);
      if (typeof gpStyle.color === "string")
        handle.setTargetColor("target-great-plains", gpStyle.color);
      handle.setTargetFogEnabled(
        "target-great-plains",
        styleAffectedByFog(gpStyle),
      );
      handle.setTargetFogDensity(
        "target-great-plains",
        styleFogDensity(gpStyle, this.envFogDensity),
      );
      handle.setTargetOpacity("target-great-plains", gpOp);
      if (typeof claimStyle.color === "string")
        handle.setClaimColor(claimStyle.color);
      handle.setClaimFogEnabled(styleAffectedByFog(claimStyle));
      handle.setClaimFogDensity(
        styleFogDensity(claimStyle, this.envFogDensity),
      );
      handle.setClaimOpacity(claimOp);
      handle.setGeologyFogEnabled(styleAffectedByFog(geologyStyle));
      handle.setGeologyFogDensity(
        styleFogDensity(geologyStyle, this.envFogDensity),
      );
      handle.setGeologyOpacity(geologyOp);
      if (typeof forestStyle.color === "string") {
        handle.setForestColor(forestStyle.color);
        handle.setForestOutlineColor(forestStyle.color);
      }
      handle.setForestFogEnabled(styleAffectedByFog(forestStyle));
      handle.setForestFogDensity(
        styleFogDensity(forestStyle, this.envFogDensity),
      );
      handle.setForestEdge(
        typeof forestStyle.forestEdgeThreshold === "number"
          ? forestStyle.forestEdgeThreshold
          : 0.5,
        typeof forestStyle.forestEdgeSoftness === "number"
          ? forestStyle.forestEdgeSoftness
          : 0.035,
      );
      handle.setForestFillOpacity(forestOp * forestOpacity);
      handle.setForestOutlineOpacity(forestOp * forestOpacity);
      // Sync wall geometry material (created by loadTreesVri).
      // wallMaterial lives on the inner group returned by the loader,
      // not on the outer wrapper group, so traverse to find it.
      {
        let wallMat: THREE.ShaderMaterial | undefined;
        this.layers.get("trees-vri")?.traverse((child) => {
          if (
            !wallMat &&
            child.userData?.wallMaterial instanceof THREE.ShaderMaterial
          )
            wallMat = child.userData.wallMaterial;
        });
        if (wallMat) {
          wallMat.uniforms.uWallHeight.value = Math.max(
            0,
            typeof forestStyle.forestEmbossHeight === "number"
              ? forestStyle.forestEmbossHeight
              : 0,
          );
          if (typeof forestStyle.color === "string")
            wallMat.uniforms.uColor.value.set(forestStyle.color);
          wallMat.uniforms.uFogEnabled.value = styleAffectedByFog(forestStyle)
            ? 1
            : 0;
          wallMat.uniforms.uFogFar.value =
            3 /
            Math.max(styleFogDensity(forestStyle, this.envFogDensity), 0.00001);
        }
      }
    });

    // Geology rebuild: per-unit visibility / colour are env-level
    // sparse maps stashed on the bedrock-geology layer style. Forward
    // them to the loader's rebuild() each apply tick. Cheap (single
    // 2048² fillRect-ish pass for ~65 polygons) -- no need to diff
    // overrides against a previous snapshot.
    if (this.geologyHandle) {
      const colorMap =
        (geologyStyle as { geologyColorMap?: Record<string, string> })
          .geologyColorMap ?? {};
      const unitOverrides =
        (
          geologyStyle as {
            geologyUnitOverrides?: Record<
              string,
              { visible?: boolean; opacity?: number }
            >;
          }
        ).geologyUnitOverrides ?? {};
      this.geologyHandle.rebuild({ colorMap, unitOverrides });
    }
  }

  /** Stash the geology handle for per-page apply paths + editor reads. */
  registerGeology(handle: GeologyHandle): void {
    this.geologyHandle = handle;
    // Re-apply if we have a cached env/page so the loader's first
    // rebuild reflects authored overrides.
    if (
      !this.activeSceneTransitionContext &&
      this.lastEffectiveEnv &&
      this.lastEffectivePage
    ) {
      this.applyEffectiveStylesForPage(
        this.lastEffectiveEnv,
        this.lastEffectivePage,
      );
    }
  }

  /** Editor read accessor for the sub-layer panel. */
  getGeology(): GeologyHandle | null {
    return this.geologyHandle;
  }

  /**
   * Per-page mood: cinematicExposure multiplies env exposure, bloomBoost
   * multiplies env bloom strength. sunLockToCamera optionally forces the
   * camera-follow sun mode on/off for the page.
   */
  applyPageScene(page: PresentationPage): void {
    this.lastEffectivePage = page;
    if (this.lastEnv) {
      const nextPresetId = activeRenderPresetIdForPage(this.lastEnv, page);
      if ((nextPresetId ?? null) !== this.lastAppliedRenderPresetId) {
        this.applyEnvironment(this.lastEnv);
      }
    }
    const expMul = page.cinematicExposure ?? 1.0;
    this.renderer.toneMappingExposure = this.baseExposure * expMul;

    if (this.postHandle) {
      const bloomMul = page.bloomBoost ?? 1.0;
      this.postHandle.bloomPass.strength =
        this.postHandle.baseBloomStrength * bloomMul;
    }

    this.setEffectiveSunLockToCamera(
      page.sunLockToCamera ?? this.baseSunLockToCamera,
    );
  }

  setEnvironmentScenePreviewPatch(
    patch: Partial<SceneProperties> | null | undefined,
  ): void {
    this.environmentScenePreviewPatch = patch ? { ...patch } : null;
    if (this.lastEnv) {
      this.applyEnvironment(this.lastEnv);
    }
  }

  applyEnvironment(environment: EnvironmentSetup): void {
    this.lastEnv = environment;
    const presetId = activeRenderPresetIdForPage(
      environment,
      this.lastEffectivePage,
    );
    this.lastAppliedRenderPresetId = presetId ?? null;
    const presetPatch = scenePatchForRenderPreset(
      presetId,
      projectRenderPresets(environment),
    );
    // Precedence: authored environment.scene is the base. Current / Custom
    // leaves presetId empty, so no preset patch is applied. An explicit
    // environment renderPreset patches cinematic/world-building fields, an
    // optional page.renderPreset wins over the environment default, preview/
    // editor patches still win, and existing page mood overrides are applied
    // afterward in applyPageScene. Technical layer renderers are not touched.
    const sp = mergeSceneProperties(
      mergeSceneProperties(environment.scene, presetPatch),
      this.environmentScenePreviewPatch,
    );
    this.currentTerrainScene = sp.terrain ?? {};
    this.setStudioSceneElementsVisible(sp.lighting?.showSceneElements ?? true);
    this.applyDrillingAssayDisplay(sp);
    this.applyTopoDetailDistanceDisplay(sp);
    this.rebuildAreaOutlines(sp.areaOutlines ?? []);

    // ---- tone mapping + exposure ---------------------------------------
    const tm = sp.toneMapping ?? "aces";
    this.renderer.toneMapping = TONE_MAPPING_MAP[tm];
    this.baseExposure = sp.exposure ?? 1.0;
    this.renderer.toneMappingExposure = this.baseExposure;

    // ---- background -- the universal "fade to" color -------------------
    // Renderer clear color and fog share this so terrain dissolves into
    // the same value visible at every screen edge. lightMode overrides
    // the authored value with a neutral grey so the whole frame reads
    // as light/grey rather than warm/dark.
    const lightMode = sp.lightMode === true;
    const bgHex = lightMode ? LIGHT_MODE_BG : (sp.background ?? "#23252a");
    const bgColor = new THREE.Color(bgHex);
    this.renderer.setClearColor(bgColor);
    this.scene.background = bgColor;

    // ---- sun direction (drives key light + terrain hillshade) ---------
    const sunAz = sp.sun?.azimuth ?? 235;
    const sunEl = sp.sun?.elevation ?? 22;
    const sunConfigKey = `${sunAz}:${sunEl}`;
    const sunConfigChanged = sunConfigKey !== this.lastSunConfigKey;
    this.lastSunConfigKey = sunConfigKey;
    this.previousSunDir.copy(this.currentSunDir);
    this.authoredWorldSunDir.copy(sunDirectionFromAngles(sunAz, sunEl));
    this.baseSunLockToCamera = sp.sun?.lockToCamera === true;
    const nextSunLockToCamera =
      this.lastEffectivePage?.sunLockToCamera ?? this.baseSunLockToCamera;
    const keepCameraLockedSun =
      nextSunLockToCamera && this.sunLockToCamera && !sunConfigChanged;
    if (keepCameraLockedSun) {
      this.currentSunDir.copy(this.previousSunDir);
    } else {
      this.currentSunDir.copy(this.authoredWorldSunDir);
      this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
    }
    this.sunLockToCamera = nextSunLockToCamera;
    this.pendingCameraSunCapture = false;
    if (this.sunLockToCamera && !keepCameraLockedSun) {
      this.requestCameraSunCapture(this.currentSunDir);
    }

    // ---- lights --------------------------------------------------------
    const tearDown = (light: THREE.Light | null) => {
      if (!light) return;
      this.scene.remove(light);
      (light as { dispose?: () => void }).dispose?.();
    };
    tearDown(this.envHemiLight);
    tearDown(this.envKeyLight);
    tearDown(this.envFillLight);
    tearDown(this.envRimLight);
    this.clearLightingStudioSources();
    this.envHemiLight = null;
    this.envKeyLight = null;
    this.envFillLight = null;
    this.envRimLight = null;

    const studioLights = sp.lighting?.enabled !== false;
    const showStudioSceneElements =
      this.editorMode && this.studioSceneElementsVisible;

    // Hemisphere with strong floor: "sky" tint (since there's no actual
    // sky now, just a top-coming wash) on top, warm "ground" tint below.
    // Studio off falls back to a neutral wash: useful for checking the
    // presentation lighting treatment without introducing measuring-tool
    // style controls.
    const hemi = sp.lighting?.hemisphere;
    const h = new THREE.HemisphereLight(
      new THREE.Color(hemi?.sky ?? "#c4d4ee"),
      new THREE.Color(hemi?.ground ?? "#48362a"),
      studioLights ? (hemi?.intensity ?? 0.42) : 0,
    );
    this.scene.add(h);
    this.envHemiLight = h;

    // Key light (sun). Position from sun direction.
    const dir = sp.lighting?.directional ?? {};
    const k = new THREE.DirectionalLight(
      new THREE.Color(dir.color ?? "#ffe2b8"),
      studioLights ? (dir.intensity ?? 2.35) : 0,
    );
    k.position.copy(this.currentSunDir).multiplyScalar(8000);
    k.target.position.set(0, 0, 0);
    k.target.updateMatrixWorld();
    // Cast shadows are forced OFF regardless of env config. At 40km
    // terrain scale shadow maps alias visibly even at 8192^2, and the
    // foreground objects (drill collars, target outlines) are emissive
    // HDR pieces rendered through bloom -- shadow casting from them
    // would just add noise. All depth and form on terrain comes from
    // the analytical hillshade in the terrain shader.
    k.castShadow = false;
    this.scene.add(k);
    this.envKeyLight = k;

    if (studioLights) {
      // Fill light: counter to the key, kept modest so scene objects retain
      // visible light direction instead of becoming evenly washed.
      const fill = sp.lighting?.fill ?? {};
      const f = new THREE.DirectionalLight(
        new THREE.Color(fill.color ?? "#9ab7d8"),
        fill.intensity ?? 0.22,
      );
      const [fpx, fpy, fpz] = fill.position ?? [-3500, 3500, 3000];
      f.position.set(fpx, fpy, fpz);
      f.target.position.set(0, 0, 0);
      f.target.updateMatrixWorld();
      this.scene.add(f);
      this.envFillLight = f;

      const rim = sp.lighting?.rim ?? {};
      const r = new THREE.DirectionalLight(
        new THREE.Color(rim.color ?? "#ffd9a0"),
        rim.intensity ?? 0.28,
      );
      const [rpx, rpy, rpz] = rim.position ?? [0, -6000, 1500];
      r.position.set(rpx, rpy, rpz);
      r.target.position.set(0, 0, 0);
      r.target.updateMatrixWorld();
      this.scene.add(r);
      this.envRimLight = r;

      const sources = sp.lighting?.sources ?? [];
      if (sources.length > 0) {
        const helperGroup = new THREE.Group();
        helperGroup.name = "__lighting_studio_helpers__";
        helperGroup.visible = showStudioSceneElements;
        for (const source of sources) {
          this.addLightingStudioSource(source, helperGroup);
        }
        hardenStudioHelperTree(helperGroup);
        if (helperGroup.children.length > 0) {
          this.scene.add(helperGroup);
          this.envLightHelperGroup = helperGroup;
        } else {
          disposeObjectTree(helperGroup);
        }
      }
    }

    // ---- exponential fog ----------------------------------------------
    if (this.envFog) {
      this.scene.fog = null;
      this.envFog = null;
    }
    // Fog color matches background so terrain dissolves into the same
    // tone as the surrounding frame. Density tuned so the far edge of
    // the 27x20 km terrain is lost in fog (reachable visibility ~12 km).
    const fogColor = lightMode
      ? bgColor // fog matches lightMode background, ignoring authored fog tint
      : sp.fog?.color
        ? new THREE.Color(sp.fog.color)
        : bgColor;
    const density = sp.fog?.density ?? DEFAULT_SCENE_FOG_DENSITY;
    const fogEnabled = sp.fog?.enabled !== false;
    this.envFogEnabled = fogEnabled;
    this.envFogDensity = density;
    if (fogEnabled) {
      const fog = new THREE.FogExp2(fogColor, density);
      this.scene.fog = fog;
      this.envFog = fog;
      // Keep the renderer clear color in sync with fog if both diverged.
      this.renderer.setClearColor(fogColor);
      this.scene.background = fogColor;
    } else {
      this.scene.fog = null;
      this.envFog = null;
    }

    // Shadow pass disabled -- no caster, no receiver, no work for the
    // renderer. Hillshade in the terrain shader carries all the depth
    // cues we want.
    this.renderer.shadowMap.enabled = false;

    // ---- terrain shader uniforms --------------------------------------
    const terrainGroup = this.layers.get("terrain");
    if (terrainGroup) {
      terrainGroup.traverse((obj) => {
        const userData = (obj as THREE.Mesh).userData;
        const handle = userData?.terrainHandle as
          | TerrainMaterialHandle
          | undefined;
        if (!handle) return;
        handle.setSunDirection(this.currentSunDir);
        if (sp.terrain) handle.setParams(sp.terrain);
        const gridHandle = userData?.terrainGridHandle as
          | TerrainGridHandle
          | undefined;
        gridHandle?.update(sp.terrain ?? {});
        // lightMode overrides the elevation ramp with greyscale.
        // Applied AFTER the authored sp.terrain push so it wins.
        // Hillshade intensity / shadow sharpness / hue variance are
        // left at authored values: only the colors swap.
        if (lightMode) {
          handle.setParams({
            rampLow: LIGHT_MODE_TERRAIN_RAMP_LOW,
            rampMid: LIGHT_MODE_TERRAIN_RAMP_MID,
            rampHigh: LIGHT_MODE_TERRAIN_RAMP_HIGH,
          });
        }
        // Push the fog color into the terrain shader so its in-shader
        // distance fade ends up at the same tone as the renderer fog.
        handle.setParams({
          fogColor: "#" + fogColor.getHexString(),
          // Approximate exponential -> linear fog distance for the
          // shader's near/far model: full-fade distance = ~3/density.
          fogNear: 0,
          fogFar: 3 / Math.max(density, 0.000001),
        });
      });
      for (const layerId of [
        "terrain",
        "hydrography-lakes",
        "three-firs-target",
        "great-plains-target",
        "claim-boundary",
        "bedrock-geology",
        "trees-vri",
      ]) {
        const style = this.styleForLayer(layerId);
        this.applyTerrainFogStyle(
          layerId,
          styleAffectedByFog(style),
          styleFogDensity(style, density),
        );
      }
      this.applyTopoGraticuleStyle(
        UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
        this.styleForLayer(UTAH_FORGE_TOPO_GRATICULE_LAYER_ID),
      );
      this.rebuildTopoMapBranding(sp);
    }

    // ---- post-processing -----------------------------------------------
    if (this.postHandle) {
      const bp = this.postHandle.bloomPass;
      const b = sp.bloom ?? {};
      this.postHandle.baseBloomStrength = b.strength ?? 0;
      bp.radius = b.radius ?? 0.7;
      bp.threshold = b.threshold ?? 0.82;

      const ao = sp.ambientOcclusion ?? {};
      const ssao = this.postHandle.ssaoPass;
      ssao.enabled = ao.enabled ?? true;
      ssao.kernelRadius = ao.radius ?? 7;
      ssao.minDistance = ao.minDistance ?? 0.004;
      ssao.maxDistance = ao.maxDistance ?? 0.12;

      const gp = this.postHandle.gradePass.uniforms;
      const grade = sp.colorGrade ?? {};
      gp.contrast.value = grade.contrast ?? 1.06;
      gp.saturation.value = grade.saturation ?? 1.06;
      if (grade.tint) {
        gp.tint.value.set(grade.tint);
      } else {
        gp.tint.value.copy(fogColor);
      }
      gp.tintStrength.value = grade.tintStrength ?? 0.04;
      const v = sp.vignette ?? {};
      gp.vignetteStrength.value = v.strength ?? 0.95;
      gp.vignetteSmoothness.value = v.smoothness ?? 0.75;
    }
  }

  /**
   * Re-run applyEnvironment against the last-applied env. Called by
   * scene.ts when an async loader resolves so any uniforms that needed
   * the loader's content (terrain shader uniforms in particular) get
   * the real env values instead of construction-time defaults.
   */
  reapplyEnvironment(): void {
    if (!this.lastEnv) return;
    this.applyEnvironment(this.lastEnv);
  }

  /**
   * Re-run the full current page/env state after an async layer loader resolves.
   * PageController may have applied styles before the mesh existed; this closes
   * that startup race so first open matches the saved presentation immediately.
   */
  reapplyCurrentPageState(): void {
    if (this.activeSceneTransitionContext) return;
    const env = this.lastEnv ?? this.lastEffectiveEnv;
    const page = this.lastEffectivePage;
    if (env) this.applyEnvironment(env);
    if (env && page) {
      this.applyEffectiveVisibilityForPage(env, page);
      this.applyEffectiveStylesForPage(env, page);
      this.applyPageScene(page);
    }
  }

  private tickLayerTweens(nowMs: number): void {
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.workingAreaFocusTween
    ) {
      return;
    }
    if (this.workingAreaFocusTween) {
      const tween = this.workingAreaFocusTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      this.applyWorkingAreaFocusStyle(
        done
          ? tween.toStyle
          : this.interpolatedWorkingAreaFocusStyle(
              tween.fromStyle,
              tween.toStyle,
              eased,
            ),
      );
      if (done) this.workingAreaFocusTween = null;
    }
    for (const [id, tween] of this.scalarStyleTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const style = done
        ? tween.toStyle
        : this.interpolatedScalarStyle(tween.fromStyle, tween.toStyle, eased);
      this.applyStyle(id, style);
      if (done) this.scalarStyleTweens.delete(id);
    }
    for (const [id, tween] of this.layerTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const opacity = tween.from + (tween.to - tween.from) * eased;
      this.applyLayerRenderOpacity(id, done ? tween.to : opacity);
      if (done) this.layerTweens.delete(id);
    }
    for (const [id, snapshot] of this.layerTransitionSnapshots) {
      const t =
        snapshot.durationMs <= 0
          ? 1
          : (nowMs - snapshot.startMs) / snapshot.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, snapshot.easing);
      const opacity = snapshot.from + (snapshot.to - snapshot.from) * eased;
      this.applyRenderOpacityToTree(
        snapshot.group,
        done ? snapshot.to : opacity,
      );
      if (done) this.removeLayerTransitionSnapshot(id);
    }
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.workingAreaFocusTween
    ) {
      this.activeSceneTransitionContext = null;
    }
  }

  private interpolatedScalarStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    amount: number,
  ): EditableStyle {
    const t = clamp01(amount);
    const next: EditableStyle = { ...toStyle };
    for (const field of SCALAR_TRANSITION_STYLE_FIELDS) {
      const from = scalarStyleNumber(fromStyle, field);
      const to = scalarStyleNumber(toStyle, field);
      if (typeof from !== "number" || typeof to !== "number") continue;
      (next as Record<string, unknown>)[field] = from + (to - from) * t;
    }
    return next;
  }

  private updateBoreLensVisibility(camera: THREE.Camera): void {
    const groups = [
      this.layers.get("drillholes-2023"),
      this.layers.get("assay-samples"),
    ].filter((group): group is THREE.Group => !!group && group.visible);
    if (groups.length === 0) return;
    for (const group of groups) {
      group.traverse((obj) => {
        if (obj.userData?.drillBoreLens !== true) return;
        if (obj.userData?.lensEnabled === false) {
          obj.visible = false;
          return;
        }
        const axis = Array.isArray(obj.userData.capAxis)
          ? obj.userData.capAxis
          : null;
        if (!axis) {
          obj.visible = false;
          return;
        }
        this.boreLensNormal
          .set(Number(axis[0]), Number(axis[1]), Number(axis[2]))
          .normalize();
        obj.getWorldPosition(this.boreLensPos);
        this.boreLensToCamera
          .copy(camera.position)
          .sub(this.boreLensPos)
          .normalize();
        // Inverted from the previous attempt: hide the face that was being
        // shown on the visible coin side, and show the opposite contact cue.
        obj.visible = this.boreLensNormal.dot(this.boreLensToCamera) < 0;
      });
    }
  }

  private updateLightingStudioElementScale(camera: THREE.Camera): void {
    if (!this.envLightHelperGroup || !this.studioSceneElementsVisible) return;
    for (const handle of this.envLightHandles.values()) {
      handle.group.getWorldPosition(this.studioHandleWorldPos);
      const distance = camera.position.distanceTo(this.studioHandleWorldPos);
      const scale = clampRange(
        distance / STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M,
        STUDIO_HANDLE_MIN_SCALE,
        STUDIO_HANDLE_MAX_SCALE,
      );
      handle.group.scale.setScalar(scale);
    }
  }

  private updateDynamicCameraOrbitCenterScale(camera: THREE.Camera): void {
    if (!this.orbitCenterHandle) return;
    this.orbitCenterHandle.group.getWorldPosition(this.orbitCenterWorldPos);
    const distance = camera.position.distanceTo(this.orbitCenterWorldPos);
    const scale = clampRange(
      distance / ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M,
      ORBIT_CENTER_HANDLE_MIN_SCALE,
      ORBIT_CENTER_HANDLE_MAX_SCALE,
    );
    this.orbitCenterHandle.group.scale.setScalar(scale);
  }

  private updatePageCameraMarkerScale(
    marker: PageCameraMarkerRuntime,
    camera: THREE.Camera,
  ): void {
    marker.group.getWorldPosition(this.pageCameraMarkerWorldPos);
    const distance = camera.position.distanceTo(this.pageCameraMarkerWorldPos);
    const scale = clampRange(distance / 5200, 0.62, 2.8);
    marker.label.scale.set(
      marker.labelBaseWidth * scale,
      marker.labelBaseHeight * scale,
      1,
    );
    marker.label.position.z = marker.labelLift * scale;
    this.updatePageCameraMarkerLine(marker);
  }

  private updatePageCameraMarkersScale(camera: THREE.Camera): void {
    if (this.pageCameraMarker?.group.visible) {
      this.updatePageCameraMarkerScale(this.pageCameraMarker, camera);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible)
        this.updatePageCameraMarkerScale(marker, camera);
    }
  }

  /**
   * Per-frame tick. Drives scene-overlay opacity tweens and any
   * camera-locked sun updates.
   */
  frameUpdate(camera: THREE.Camera, nowMs: number = performance.now()): void {
    this.updateCameraLockedSun(camera);
    this.tickLayerTweens(nowMs);
    this.updateBoreLensVisibility(camera);
    this.updateLightingStudioElementScale(camera);
    this.updateDynamicCameraOrbitCenterScale(camera);
    this.updatePageCameraMarkersScale(camera);
    this.updateEzGammaBillboards(camera);
    const terrainGroup = this.layers.get("terrain");
    if (terrainGroup) {
      terrainGroup.traverse((obj) => {
        const gridHandle = (obj as THREE.Mesh).userData?.terrainGridHandle as
          | TerrainGridHandle
          | undefined;
        gridHandle?.updateCameraVisibility(camera);
      });
    }
    if (this.sceneOverlays.size > 0) {
      tickSceneOverlayTweens(this.sceneOverlays.values(), nowMs);
    }
  }

  /**
   * Register the eager-loaded scene-overlay meshes. Adds them to a
   * dedicated group on the scene -- intentionally NOT entered into the
   * `layers` map so the editor's regular Layer tab + visibility flow
   * doesn't show or toggle them. Per-page activation is handled by
   * applySceneOverlaysForPage.
   */
  registerSceneOverlays(handles: Map<string, SceneOverlayHandle>): void {
    this.ensureSceneOverlayGroup();
    for (const handle of handles.values()) {
      this.sceneOverlays.set(handle.id, handle);
      this.sceneOverlayGroup!.add(handle.mesh);
      this.sceneOverlayGroup!.add(handle.outlineMesh);
    }
    // Replay any apply that landed before the loader resolved. Without
    // this, freshly-registered handles stay at their construction-time
    // opacity 0 because PageController's mount-time apply found an
    // empty registry and silently no-op'd.
    if (this.lastOverlayEnv && this.lastOverlayPage) {
      this.applySceneOverlaysForPage(this.lastOverlayEnv, this.lastOverlayPage);
    }
  }

  private ensureSceneOverlayGroup(): void {
    if (this.sceneOverlayGroup) return;
    this.sceneOverlayGroup = new THREE.Group();
    this.sceneOverlayGroup.name = "__scene_overlays__";
    this.scene.add(this.sceneOverlayGroup);
  }

  /**
   * Wired by scene.ts at mount with the renderer's anisotropy + the
   * data-path resolver, so SceneManager can hot-load a new overlay at
   * runtime (editor add flow) without depending on the renderer.
   */
  setSceneOverlayLoaderHooks(opts: {
    resolveAssetPath: (rel: string) => string;
    maxAnisotropy: number;
  }): void {
    this.overlayResolveAssetPath = opts.resolveAssetPath;
    this.overlayMaxAnisotropy = opts.maxAnisotropy;
  }

  /**
   * Editor entry point: load a freshly-added overlay and register it.
   * Awaits the heightSampler internally (via the loader) so the
   * mesh's z drape is correct on the first frame.
   */
  async addSceneOverlay(id: string, def: SceneOverlayDef): Promise<void> {
    if (this.sceneOverlays.has(id)) {
      console.warn(`[SceneManager] addSceneOverlay: ${id} already exists`);
      return;
    }
    const handle = await loadSingleSceneOverlay(
      id,
      def,
      this.overlayResolveAssetPath,
      this.overlayMaxAnisotropy,
    );
    if (!handle) return;
    this.ensureSceneOverlayGroup();
    this.sceneOverlays.set(id, handle);
    this.sceneOverlayGroup!.add(handle.mesh);
    this.sceneOverlayGroup!.add(handle.outlineMesh);
    if (this.lastOverlayEnv && this.lastOverlayPage) {
      this.applySceneOverlaysForPage(this.lastOverlayEnv, this.lastOverlayPage);
    }
  }

  /**
   * Editor entry point: tear down an overlay's GPU resources and drop
   * it from the registry. Caller is responsible for stripping page
   * references too (handled in the editor reducer).
   */
  removeSceneOverlay(id: string): void {
    const handle = this.sceneOverlays.get(id);
    if (!handle) return;
    if (this.hoveredOverlayId === id) this.hoveredOverlayId = null;
    handle.mesh.parent?.remove(handle.mesh);
    handle.outlineMesh.parent?.remove(handle.outlineMesh);
    disposeSceneOverlay(handle);
    this.sceneOverlays.delete(id);
  }

  /**
   * Editor entry point: rebuild geometry for an overlay whose bounds
   * just changed (drag commit). Existing material + texture are
   * preserved -- only positions/UVs are recomputed.
   */
  async rebuildSceneOverlayBounds(
    id: string,
    newBounds: SceneOverlayDef["bounds"],
  ): Promise<void> {
    const handle = this.sceneOverlays.get(id);
    if (!handle) return;
    const sample = await getHeightSampler();
    rebuildSceneOverlayGeometry(handle, newBounds, sample);
  }

  /**
   * Look up a handle by id. Used by scene.ts's drag interaction.
   */
  getSceneOverlay(id: string): SceneOverlayHandle | undefined {
    return this.sceneOverlays.get(id);
  }

  /**
   * Set hover state on an overlay; brightens the outline opacity
   * directly. Restores the previous overlay's outline to its current
   * tween target (the steady-state value).
   */
  setHoveredSceneOverlay(id: string | null): void {
    if (id === this.hoveredOverlayId) return;
    const prev = this.hoveredOverlayId
      ? this.sceneOverlays.get(this.hoveredOverlayId)
      : null;
    if (prev && !prev.outlineTween) {
      prev.outlineMaterial.opacity = prev.outlineTarget;
    }
    this.hoveredOverlayId = id;
    if (id) {
      const handle = this.sceneOverlays.get(id);
      if (handle && handle.outlineTarget > 0) {
        handle.outlineMaterial.opacity = Math.min(
          1,
          handle.outlineTarget + 0.3,
        );
      }
    }
  }

  /** Snapshot of registered overlays. Used by editor read-only views. */
  listSceneOverlays(): SceneOverlayHandle[] {
    return Array.from(this.sceneOverlays.values());
  }

  /**
   * Resolve effective per-page overlay state and kick off opacity
   * tweens to the targets. Used on initial mount and on env reapplies
   * (no transition split).
   */
  applySceneOverlaysForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    // Cache BEFORE the early-return so a mount-time apply that lands
    // before the loader resolves still gets replayed once handles
    // register. Without this, the race in the original Week 5 wiring
    // left overlays stuck at opacity 0.
    this.lastOverlayEnv = environment;
    this.lastOverlayPage = page;
    if (this.sceneOverlays.size === 0) {
      debugLog(
        `[applySceneOverlaysForPage:${page.id}] no handles registered yet, caching for later replay`,
      );
      return;
    }
    const resolved = effectiveSceneOverlays(environment, page);
    debugLog(
      `[applySceneOverlaysForPage:${page.id}] resolved:`,
      resolved.map((r) => ({
        id: r.id,
        visible: r.visible,
        opacity: r.opacity,
        tint: r.tint,
        enabled: r.def.enabled,
      })),
    );
    const now = performance.now();
    for (const r of resolved) {
      const handle = this.sceneOverlays.get(r.id);
      if (!handle) continue;
      setSceneOverlayTint(handle, r.tint);
      fadeSceneOverlayTo(handle, r.opacity, now, SCENE_OVERLAY_FADE_MS);
    }
  }

  /**
   * Tween-start half of the per-page overlay update. Only fades OUT
   * overlays whose target opacity on the next page is lower than the
   * current value (i.e., overlays leaving the chapter). Show-ins are
   * deferred to applySceneOverlaysAtTransitionEnd so they appear
   * synced with the camera's arrival rather than fading up over the
   * tweening scene.
   */
  applySceneOverlaysAtTransitionStart(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
  ): void {
    // Cache the target page so a registration during the tween replays
    // the correct end-state instead of the previous page's.
    this.lastOverlayEnv = environment;
    this.lastOverlayPage = nextPage;
    if (this.sceneOverlays.size === 0) return;
    const resolved = effectiveSceneOverlays(environment, nextPage);
    const now = performance.now();
    for (const r of resolved) {
      const handle = this.sceneOverlays.get(r.id);
      if (!handle) continue;
      if (r.opacity < handle.target) {
        fadeSceneOverlayTo(handle, r.opacity, now, SCENE_OVERLAY_FADE_MS);
      }
    }
  }

  /**
   * Tween-end half: fades IN overlays the next page reveals (and tweens
   * any same-overlay opacity changes). Called from the camera tween's
   * onComplete in PageController.
   */
  applySceneOverlaysAtTransitionEnd(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
  ): void {
    this.lastOverlayEnv = environment;
    this.lastOverlayPage = nextPage;
    if (this.sceneOverlays.size === 0) return;
    const resolved = effectiveSceneOverlays(environment, nextPage);
    const now = performance.now();
    for (const r of resolved) {
      const handle = this.sceneOverlays.get(r.id);
      if (!handle) continue;
      // Tint is direct (no tween) so apply unconditionally.
      setSceneOverlayTint(handle, r.tint);
      // Anything not already at target (which includes the show-ins
      // skipped by the start half, plus opacity-shifts on overlays
      // that stayed visible across the transition).
      if (r.opacity !== handle.target) {
        fadeSceneOverlayTo(handle, r.opacity, now, SCENE_OVERLAY_FADE_MS);
      }
    }
  }

  notifyResize(width: number, height: number): void {
    for (const group of this.layers.values()) {
      group.traverse((obj) => {
        const mat = (obj as { material?: THREE.Material | THREE.Material[] })
          .material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (m instanceof LineMaterial) {
            m.resolution.set(width, height);
          }
        }
      });
      const tm = (group.userData as { traceMaterial?: LineMaterial })
        .traceMaterial;
      if (tm) tm.resolution.set(width, height);
    }
    // Scene overlay bounds outlines live outside the layer registry.
    for (const h of this.sceneOverlays.values()) {
      h.outlineMaterial.resolution.set(width, height);
    }
    const clipMaterial = this.publicSurfaceClipRuntime?.line.material;
    if (clipMaterial instanceof LineMaterial) {
      clipMaterial.resolution.set(width, height);
    }
    const focusMaterial = this.workingAreaFocusRuntime?.line.material;
    if (focusMaterial instanceof LineMaterial) {
      focusMaterial.resolution.set(width, height);
    }
  }
}
