import * as THREE from "three";
import { appAssetUrl } from "../projects/projectPathsRuntime";

const SCENE_SECTION_SHADER_SLOT_COUNT = 8;
const SOURCE_FIDELITY_MAX_SAMPLE_STEPS = 384;

type Vec3 = [number, number, number];
type SeismicLodTierName = "coarse" | "standard" | "source";
type SeismicProductLoadOptions = {
  includeVolume?: boolean;
};

const SEISMIC_DEFAULT_LOD_TIER: SeismicLodTierName = "standard";
const SEISMIC_COARSE_LOD_TIER: SeismicLodTierName = "coarse";
const SEISMIC_LOD_RANK: Record<SeismicLodTierName, number> = {
  coarse: 0,
  standard: 1,
  source: 2,
};

interface SeismicBounds {
  min: Vec3;
  max: Vec3;
}

interface SeismicSampleDomain {
  kind: string;
  unit: string;
  min: number;
  max: number;
  verticalScaleMPerUnit: number;
}

interface SeismicValueStats {
  min?: number;
  max?: number;
  p02?: number;
  p98?: number;
  mean?: number;
}

interface SeismicNavigationPlacement {
  navigationSource: "delivered" | "digitized" | "fallback";
  placementAccuracy: "validated" | "approximate" | "unknown";
  canClaimPreciseRegistration: boolean;
  lineId?: string;
  statusLabel?: string;
  reason?: string;
  validationPath?: string[];
}

interface SeismicSectionLodSpec {
  width: number;
  height: number;
  amplitudeFile: string;
}

interface SeismicSurfaceGridSpec {
  corners?: Vec3[] | Partial<Record<"sw" | "nw" | "ne" | "se", Vec3>>;
  points?: Vec3[];
  width?: number;
  height?: number;
  columns?: number;
  rows?: number;
}

interface SeismicSectionSpec {
  id: string;
  label: string;
  axis: "inline" | "crossline" | "sample" | "line";
  fraction: number;
  width: number;
  height: number;
  amplitudeFile: string;
  sampleDomain: SeismicSampleDomain;
  datumM: number;
  sceneBounds?: SeismicBounds;
  geometrySource?: string;
  sourceAxis?: string | Record<string, unknown>;
  path?: Vec3[];
  surfaceGrid?: SeismicSurfaceGridSpec;
  lods?: Partial<Record<SeismicLodTierName, SeismicSectionLodSpec>>;
  verticalReference?: Record<string, unknown>;
  valueEncoding?: Record<string, unknown>;
  navigationPlacement?: SeismicNavigationPlacement;
}

interface SeismicVolumeLodSpec {
  file: string;
  dimensions: Vec3;
}

interface SeismicVolumeSpec {
  file: string;
  dimensions: Vec3;
  sceneBounds: SeismicBounds;
  sampleDomain: SeismicSampleDomain;
  amplitudeStats?: SeismicValueStats;
  lods?: Partial<Record<SeismicLodTierName, SeismicVolumeLodSpec>>;
  verticalReference?: Record<string, unknown>;
  valueEncoding?: Record<string, unknown>;
}

interface SeismicProductSpec {
  id: string;
  label: string;
  lineLabel?: string;
  sourceSubmission: string;
  surveyKind: "2d" | "3d" | "legacy-2d";
  productKind: string;
  domainKind: string;
  domainUnit: string;
  datumM?: number;
  verticalReference?: Record<string, unknown>;
  valueEncoding?: Record<string, unknown>;
  navigationPlacement?: SeismicNavigationPlacement;
  amplitudeStats?: SeismicValueStats;
  sections: SeismicSectionSpec[];
  raymarchVolume?: SeismicVolumeSpec | null;
}

interface SeismicManifest {
  schema: "geosee.seismic-browser.v1";
  label: string;
  defaultProductId: string;
  navigation?: {
    geojson?: string;
    sceneBounds?: SeismicBounds;
  };
  verticalReference?: Record<string, unknown>;
  valueEncoding?: Record<string, unknown>;
  products: SeismicProductSpec[];
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry:
      | {
          type: "Point";
          coordinates: [number, number, number?];
        }
      | {
          type: "LineString";
          coordinates: Array<[number, number, number?]>;
        }
      | null;
  }>;
}

type SeismicNavigationRole = "sources" | "receivers" | "lines";

const DEFAULT_SECTION_OPACITY = 0.62;
const SECTION_RENDER_ORDER = 13.45;
const NAVIGATION_RENDER_ORDER = 13.7;
const VOLUME_RENDER_ORDER = 13.35;

function seismicLodOrFallback<T>(
  lods: Partial<Record<SeismicLodTierName, T>> | undefined,
  tier: SeismicLodTierName,
): T | undefined {
  return (
    lods?.[tier] ??
    lods?.standard ??
    lods?.source ??
    lods?.coarse
  );
}

function sectionForLod(
  section: SeismicSectionSpec,
  tier: SeismicLodTierName,
): SeismicSectionSpec {
  const lod = seismicLodOrFallback(section.lods, tier);
  if (!lod) return section;
  return {
    ...section,
    width: lod.width,
    height: lod.height,
    amplitudeFile: lod.amplitudeFile,
  };
}

function volumeForLod(
  volume: SeismicVolumeSpec,
  tier: SeismicLodTierName,
): SeismicVolumeSpec {
  const lod = seismicLodOrFallback(volume.lods, tier);
  if (!lod) return volume;
  return {
    ...volume,
    file: lod.file,
    dimensions: lod.dimensions,
  };
}

function estimateProductBytes(
  product: SeismicProductSpec,
  tier: SeismicLodTierName,
  options: SeismicProductLoadOptions = {},
): number {
  let total = 0;
  for (const section of product.sections) {
    const resolved = sectionForLod(section, tier);
    const samples = resolved.width * resolved.height;
    const surfaceGridPointCount = surfaceGridPoints(resolved.surfaceGrid)?.length ?? 0;
    const geometryVertexCount =
      resolved.path && resolved.path.length >= 2
        ? resolved.path.length * 2
        : resolved.axis === "sample" && surfaceGridPointCount >= 4
          ? surfaceGridPointCount
          : 4;
    const geometryQuadCount =
      resolved.path && resolved.path.length >= 2
        ? Math.max(0, resolved.path.length - 1)
        : resolved.axis === "sample" && surfaceGridPointCount >= 4
          ? Math.max(0, geometryVertexCount - 1)
          : 1;
    total += samples; // amplitude texture bytes
    total += geometryVertexCount * 3 * 4; // section plane positions
    total += geometryVertexCount * 2 * 4; // section plane UVs
    total += geometryQuadCount * 6 * 4; // section plane indices
  }
  if (options.includeVolume === true && product.raymarchVolume) {
    const volume = volumeForLod(product.raymarchVolume, tier);
    const [nx, ny, nz] = volume.dimensions;
    total += nx * ny * nz;
  }
  return total;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function assetResolver(manifestUrl: string): (path: string) => string {
  const manifestBase = new URL(manifestUrl, window.location.href);
  const browserRoot = new URL(".", manifestBase);
  return (path: string) => {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const clean = path.replace(/^\/+/, "");
    if (clean.startsWith("projects/") || clean.startsWith("data/")) {
      return appAssetUrl(clean);
    }
    return new URL(path, browserRoot).toString();
  };
}

function normalizeCoordinate(raw: [number, number, number?]): Vec3 | null {
  const x = raw[0];
  const y = raw[1];
  const z = raw[2] ?? 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

function sceneSectionVectorSlots(): THREE.Vector3[] {
  return Array.from(
    { length: SCENE_SECTION_SHADER_SLOT_COUNT },
    () => new THREE.Vector3(),
  );
}

function sceneSectionVector4Slots(): THREE.Vector4[] {
  return Array.from(
    { length: SCENE_SECTION_SHADER_SLOT_COUNT },
    () => new THREE.Vector4(-250000, 250000, -250000, 250000),
  );
}

function sceneSectionNumberSlots(value: number): number[] {
  return Array.from({ length: SCENE_SECTION_SHADER_SLOT_COUNT }, () => value);
}

function sectionVertexShader(): string {
  return `
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
}

function sectionFragmentShader(): string {
  return `
precision highp float;

uniform sampler2D uAmplitudeMap;
uniform float uOpacity;
uniform float uAmplitudeMin;
uniform float uAmplitudeMax;
uniform float uAmplitudeGamma;
uniform int uColormap;
uniform int uRemoveBackground;
uniform float uBackgroundCutoff;
uniform int uSceneSectionEnabled;
uniform int uSceneSectionMode;
uniform int uSceneSectionPlaneCount;
uniform vec3 uSceneSectionNormals[8];
uniform float uSceneSectionPositions[8];
uniform float uSceneSectionThickness[8];
uniform int uSceneSectionInvert[8];
uniform float uSceneSectionPlaneOutsideOpacity[8];
uniform int uSceneSectionFrameCount;
uniform vec3 uSceneSectionFrameAxisA[8];
uniform vec3 uSceneSectionFrameAxisB[8];
uniform vec4 uSceneSectionFrameBounds[8];
uniform float uSceneSectionFrameOutsideOpacity[8];
uniform int uWorkingAreaFocusEnabled;
uniform vec3 uWorkingAreaFocusBoundsMin;
uniform vec3 uWorkingAreaFocusBoundsMax;
uniform float uWorkingAreaFocusOutsideOpacity;
varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 colorRamp(float t) {
  float c = clamp(t, 0.0, 1.0);
  if (uColormap == 1) {
    return vec3(c);
  }
  if (uColormap == 2) {
    if (c < 0.33) {
      return mix(vec3(0.090, 0.231, 0.604), vec3(0.200, 0.714, 0.843), c / 0.33);
    }
    if (c < 0.66) {
      return mix(vec3(0.200, 0.714, 0.843), vec3(0.957, 0.875, 0.388), (c - 0.33) / 0.33);
    }
    return mix(vec3(0.957, 0.875, 0.388), vec3(0.827, 0.294, 0.176), (c - 0.66) / 0.34);
  }
  if (c < 0.5) {
    return mix(vec3(0.141, 0.337, 0.788), vec3(0.957, 0.969, 1.0), c / 0.5);
  }
  return mix(vec3(0.957, 0.969, 1.0), vec3(0.851, 0.212, 0.184), (c - 0.5) / 0.5);
}

float shapedAmplitude(float t) {
  float c = clamp(t, 0.0, 1.0);
  float gamma = clamp(uAmplitudeGamma, 0.35, 2.5);
  float signedT = (c - 0.5) * 2.0;
  if (abs(signedT) <= 0.0001) {
    return 0.5;
  }
  return clamp(0.5 + sign(signedT) * pow(abs(signedT), gamma) * 0.5, 0.0, 1.0);
}

float sceneSectionAlpha(vec3 position) {
  if (uSceneSectionEnabled == 0) return 1.0;
  float alpha = 1.0;
  for (int i = 0; i < 8; i += 1) {
    if (i >= uSceneSectionPlaneCount) break;
    vec3 normal = normalize(uSceneSectionNormals[i]);
    float distance = dot(position, normal) - uSceneSectionPositions[i];
    if (uSceneSectionInvert[i] == 1) distance = -distance;
    if (distance > 0.0) {
      alpha = min(alpha, clamp(uSceneSectionPlaneOutsideOpacity[i], 0.0, 1.0));
    }
  }
  for (int i = 0; i < 8; i += 1) {
    if (i >= uSceneSectionFrameCount) break;
    vec3 axisA = normalize(uSceneSectionFrameAxisA[i]);
    vec3 axisB = normalize(uSceneSectionFrameAxisB[i]);
    vec4 bounds = uSceneSectionFrameBounds[i];
    float a = dot(position, axisA);
    float b = dot(position, axisB);
    bool inside = a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w;
    if (!inside) {
      alpha = min(alpha, clamp(uSceneSectionFrameOutsideOpacity[i], 0.0, 1.0));
    }
  }
  return alpha;
}

float workingAreaFocusAlpha(vec3 position) {
  if (uWorkingAreaFocusEnabled == 0) return 1.0;
  bool inside =
    all(greaterThanEqual(position, uWorkingAreaFocusBoundsMin)) &&
    all(lessThanEqual(position, uWorkingAreaFocusBoundsMax));
  return inside ? 1.0 : clamp(uWorkingAreaFocusOutsideOpacity, 0.0, 1.0);
}

void main() {
  float sectionAlpha = sceneSectionAlpha(vWorldPosition);
  if (sectionAlpha <= 0.0001) discard;
  float windowMax = max(uAmplitudeMax, uAmplitudeMin + 0.0001);
  float amplitude = texture2D(uAmplitudeMap, clamp(vUv, vec2(0.0), vec2(1.0))).r;
  float rampT = clamp((amplitude - uAmplitudeMin) / (windowMax - uAmplitudeMin), 0.0, 1.0);
  float displayT = shapedAmplitude(rampT);
  float contrast = abs(displayT - 0.5) * 2.0;
  float alpha = uOpacity * workingAreaFocusAlpha(vWorldPosition) * sectionAlpha;
  if (uRemoveBackground == 1) {
    float muteHigh = min(0.96, max(0.62, uBackgroundCutoff + 0.22));
    alpha *= smoothstep(uBackgroundCutoff, muteHigh, contrast);
  }
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(colorRamp(displayT), alpha);
}
`;
}

function sectionVertexPosition(
  section: SeismicSectionSpec,
  xIndex: number,
  yIndex: number,
): Vec3 {
  const widthT = section.width <= 1 ? 0 : xIndex / (section.width - 1);
  const heightT = section.height <= 1 ? 0 : yIndex / (section.height - 1);
  const sampleMin = section.sampleDomain.min;
  const sampleMax = section.sampleDomain.max;
  const sample = sampleMin + (sampleMax - sampleMin) * heightT;
  const z = section.datumM - sample * section.sampleDomain.verticalScaleMPerUnit;

  const bounds = section.sceneBounds;
  if (!bounds) return [0, 0, z];
  const min = bounds.min;
  const max = bounds.max;
  if (section.axis === "sample") {
    const sampleValue = section.sampleDomain.min;
    const planeZ =
      section.datumM -
      sampleValue * section.sampleDomain.verticalScaleMPerUnit;
    return [
      min[0] + (max[0] - min[0]) * widthT,
      min[1] + (max[1] - min[1]) * heightT,
      planeZ,
    ];
  }
  if (section.axis === "crossline") {
    return [
      min[0] + (max[0] - min[0]) * section.fraction,
      min[1] + (max[1] - min[1]) * widthT,
      z,
    ];
  }
  return [
    min[0] + (max[0] - min[0]) * widthT,
    min[1] + (max[1] - min[1]) * section.fraction,
    z,
  ];
}

function sectionSampleValue(section: SeismicSectionSpec, yIndex: number): number {
  if (section.axis === "sample") return section.sampleDomain.min;
  const heightT = section.height <= 1 ? 0 : yIndex / (section.height - 1);
  return section.sampleDomain.min + (section.sampleDomain.max - section.sampleDomain.min) * heightT;
}

function makeSectionGeometry(
  section: SeismicSectionSpec,
  positions: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array | Uint32Array,
  sampleValues: Float32Array,
  geometryKind: string,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.userData.seismicSampleValues = sampleValues;
  geometry.userData.seismicSection = section;
  geometry.userData.seismicTexturePlane = true;
  geometry.userData.seismicSectionTextureSize = [section.width, section.height];
  geometry.userData.seismicSectionGeometryKind = geometryKind;
  geometry.userData.seismicSectionGeometrySource =
    section.geometrySource ?? (geometryKind === "legacy-corners" ? "scene-bounds" : "trace-derived");
  geometry.userData.seismicSectionPathPointCount = section.path?.length ?? 0;
  geometry.userData.seismicSectionSurfaceGridPointCount =
    surfaceGridPoints(section.surfaceGrid)?.length ?? 0;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function linePathDistanceFractions(path: Vec3[]): number[] {
  const distances = new Array<number>(path.length).fill(0);
  for (let i = 1; i < path.length; i += 1) {
    const previous = path[i - 1];
    const current = path[i];
    distances[i] =
      distances[i - 1] +
      Math.hypot(
        current[0] - previous[0],
        current[1] - previous[1],
        current[2] - previous[2],
      );
  }
  const total = distances[distances.length - 1] || 1;
  return distances.map((distance) => distance / total);
}

function buildPathCurtainGeometry(
  section: SeismicSectionSpec,
  path: Vec3[],
): THREE.BufferGeometry {
  const vertexCount = path.length * 2;
  const indexArray =
    vertexCount > 65535 ? new Uint32Array((path.length - 1) * 6) : new Uint16Array((path.length - 1) * 6);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const sampleValues = new Float32Array(vertexCount);
  const sampleMin = section.sampleDomain.min;
  const sampleMax = section.sampleDomain.max;
  const topZ = section.datumM - sampleMin * section.sampleDomain.verticalScaleMPerUnit;
  const bottomZ = section.datumM - sampleMax * section.sampleDomain.verticalScaleMPerUnit;
  const distanceFractions = linePathDistanceFractions(path);

  for (let pathIndex = 0; pathIndex < path.length; pathIndex += 1) {
    const point = path[pathIndex];
    const u = distanceFractions[pathIndex];
    const topVertex = pathIndex * 2;
    const bottomVertex = topVertex + 1;
    positions[topVertex * 3] = point[0];
    positions[topVertex * 3 + 1] = point[1];
    positions[topVertex * 3 + 2] = topZ;
    positions[bottomVertex * 3] = point[0];
    positions[bottomVertex * 3 + 1] = point[1];
    positions[bottomVertex * 3 + 2] = bottomZ;
    uvs[topVertex * 2] = u;
    uvs[topVertex * 2 + 1] = 0;
    uvs[bottomVertex * 2] = u;
    uvs[bottomVertex * 2 + 1] = 1;
    sampleValues[topVertex] = sampleMin;
    sampleValues[bottomVertex] = sampleMax;
  }

  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
    const indexOffset = segmentIndex * 6;
    const topLeft = segmentIndex * 2;
    const bottomLeft = topLeft + 1;
    const topRight = topLeft + 2;
    const bottomRight = topLeft + 3;
    indexArray[indexOffset] = topLeft;
    indexArray[indexOffset + 1] = bottomLeft;
    indexArray[indexOffset + 2] = topRight;
    indexArray[indexOffset + 3] = topRight;
    indexArray[indexOffset + 4] = bottomLeft;
    indexArray[indexOffset + 5] = bottomRight;
  }

  return makeSectionGeometry(
    section,
    positions,
    uvs,
    indexArray,
    sampleValues,
    "trace-path-curtain",
  );
}

function surfaceGridPoints(surfaceGrid?: SeismicSurfaceGridSpec): Vec3[] | null {
  if (!surfaceGrid) return null;
  if (surfaceGrid.points && surfaceGrid.points.length >= 4) return surfaceGrid.points;
  const corners = surfaceGrid.corners;
  if (Array.isArray(corners)) return corners.length >= 4 ? corners : null;
  if (corners?.sw && corners?.nw && corners?.ne && corners?.se) {
    return [corners.sw, corners.nw, corners.ne, corners.se];
  }
  return null;
}

function buildSurfaceGridGeometry(
  section: SeismicSectionSpec,
  surfaceGrid: SeismicSurfaceGridSpec,
): THREE.BufferGeometry | null {
  const points = surfaceGridPoints(surfaceGrid);
  if (!points || points.length < 4) return null;
  const columns = surfaceGrid.width ?? surfaceGrid.columns;
  const rows = surfaceGrid.height ?? surfaceGrid.rows;
  const hasStructuredGrid =
    typeof columns === "number" &&
    typeof rows === "number" &&
    columns >= 2 &&
    rows >= 2 &&
    columns * rows === points.length;
  const vertexCount = points.length;
  const indexCount = hasStructuredGrid
    ? (columns - 1) * (rows - 1) * 6
    : Math.max(0, points.length - 2) * 3;
  const indexArray =
    vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const sampleValues = new Float32Array(vertexCount);
  const sampleValue = section.sampleDomain.min;
  const planeZ =
    section.datumM - sampleValue * section.sampleDomain.verticalScaleMPerUnit;
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxY = Math.max(...points.map((point) => point[1]));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex];
    positions[pointIndex * 3] = point[0];
    positions[pointIndex * 3 + 1] = point[1];
    positions[pointIndex * 3 + 2] = planeZ;
    if (hasStructuredGrid) {
      const column = pointIndex % columns;
      const row = Math.floor(pointIndex / columns);
      uvs[pointIndex * 2] = column / (columns - 1);
      uvs[pointIndex * 2 + 1] = row / (rows - 1);
    } else {
      uvs[pointIndex * 2] = (point[0] - minX) / rangeX;
      uvs[pointIndex * 2 + 1] = (point[1] - minY) / rangeY;
    }
    sampleValues[pointIndex] = sampleValue;
  }

  if (hasStructuredGrid) {
    let indexOffset = 0;
    for (let row = 0; row < rows - 1; row += 1) {
      for (let column = 0; column < columns - 1; column += 1) {
        const topLeft = row * columns + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + columns;
        const bottomRight = bottomLeft + 1;
        indexArray[indexOffset] = topLeft;
        indexArray[indexOffset + 1] = bottomLeft;
        indexArray[indexOffset + 2] = topRight;
        indexArray[indexOffset + 3] = topRight;
        indexArray[indexOffset + 4] = bottomLeft;
        indexArray[indexOffset + 5] = bottomRight;
        indexOffset += 6;
      }
    }
  } else {
    let indexOffset = 0;
    for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
      indexArray[indexOffset] = 0;
      indexArray[indexOffset + 1] = pointIndex;
      indexArray[indexOffset + 2] = pointIndex + 1;
      indexOffset += 3;
    }
  }

  return makeSectionGeometry(
    section,
    positions,
    uvs,
    indexArray,
    sampleValues,
    surfaceGrid.points ? "trace-surface-grid" : "trace-surface-corners",
  );
}

function buildLegacyCornerGeometry(section: SeismicSectionSpec): THREE.BufferGeometry {
  const right = Math.max(0, section.width - 1);
  const bottom = Math.max(0, section.height - 1);
  const corners: Array<[number, number, number, number]> = [
    [0, 0, 0, 0],
    [right, 0, 1, 0],
    [0, bottom, 0, 1],
    [right, bottom, 1, 1],
  ];
  const positions = new Float32Array(4 * 3);
  const uvs = new Float32Array(4 * 2);
  const sampleValues = new Float32Array(4);

  for (let i = 0; i < corners.length; i += 1) {
    const [xIndex, yIndex, u, v] = corners[i];
    const point = sectionVertexPosition(section, xIndex, yIndex);
    positions[i * 3] = point[0];
    positions[i * 3 + 1] = point[1];
    positions[i * 3 + 2] = point[2];
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
    sampleValues[i] = sectionSampleValue(section, yIndex);
  }

  return makeSectionGeometry(
    section,
    positions,
    uvs,
    new Uint16Array([0, 2, 1, 1, 2, 3]),
    sampleValues,
    "legacy-corners",
  );
}

function buildSectionPlaneGeometry(section: SeismicSectionSpec): THREE.BufferGeometry {
  if (section.path && section.path.length >= 2) {
    return buildPathCurtainGeometry(section, section.path);
  }
  if (section.axis === "sample" && section.surfaceGrid) {
    const surfaceGeometry = buildSurfaceGridGeometry(section, section.surfaceGrid);
    if (surfaceGeometry) return surfaceGeometry;
  }
  return buildLegacyCornerGeometry(section);
}

function buildSectionAmplitudeTexture(
  amplitude: Uint8Array,
  width: number,
  height: number,
): THREE.DataTexture {
  const expected = width * height;
  const textureData = new Uint8Array(expected);
  textureData.set(amplitude.subarray(0, expected));
  const texture = new THREE.DataTexture(
    textureData,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

async function buildSectionMesh(
  product: SeismicProductSpec,
  section: SeismicSectionSpec,
  resolveAsset: (path: string) => string,
  tier: SeismicLodTierName,
): Promise<THREE.Mesh> {
  const amplitude = await fetchBytes(resolveAsset(section.amplitudeFile));
  const expected = section.width * section.height;
  if (amplitude.length < expected) {
    throw new Error(
      `${product.id}/${section.id} expected ${expected} amplitude bytes, received ${amplitude.length}`,
    );
  }

  const amplitudeMap = buildSectionAmplitudeTexture(
    amplitude,
    section.width,
    section.height,
  );
  const geometry = buildSectionPlaneGeometry(section);

  const material = new THREE.ShaderMaterial({
    vertexShader: sectionVertexShader(),
    fragmentShader: sectionFragmentShader(),
    uniforms: {
      uAmplitudeMap: { value: amplitudeMap },
      uOpacity: { value: DEFAULT_SECTION_OPACITY },
      uAmplitudeMin: { value: 0.08 },
      uAmplitudeMax: { value: 0.92 },
      uAmplitudeGamma: { value: 1 },
      uColormap: { value: 0 },
      uRemoveBackground: { value: 0 },
      uBackgroundCutoff: { value: 0.16 },
      uSceneSectionEnabled: { value: 0 },
      uSceneSectionMode: { value: 0 },
      uSceneSectionPlaneCount: { value: 0 },
      uSceneSectionNormals: { value: sceneSectionVectorSlots() },
      uSceneSectionPositions: { value: sceneSectionNumberSlots(0) },
      uSceneSectionThickness: { value: sceneSectionNumberSlots(1) },
      uSceneSectionInvert: { value: sceneSectionNumberSlots(0) },
      uSceneSectionPlaneOutsideOpacity: { value: sceneSectionNumberSlots(1) },
      uSceneSectionFrameCount: { value: 0 },
      uSceneSectionFrameAxisA: { value: sceneSectionVectorSlots() },
      uSceneSectionFrameAxisB: { value: sceneSectionVectorSlots() },
      uSceneSectionFrameBounds: { value: sceneSectionVector4Slots() },
      uSceneSectionFrameOutsideOpacity: { value: sceneSectionNumberSlots(1) },
      uWorkingAreaFocusEnabled: { value: 0 },
      uWorkingAreaFocusBoundsMin: { value: new THREE.Vector3() },
      uWorkingAreaFocusBoundsMax: { value: new THREE.Vector3() },
      uWorkingAreaFocusOutsideOpacity: { value: 1 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveVertexColors = true;
  material.userData.preserveMaterialColor = true;
  material.userData.preserveMaterialOpacity = true;
  material.userData.seismicSectionMaterial = true;
  material.userData.seismicTexturePlane = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${product.label} - ${section.label}`;
  mesh.renderOrder = SECTION_RENDER_ORDER;
  mesh.visible = false;
  mesh.userData = {
    displayName: mesh.name,
    seismicSection: true,
    seismicTexturePlane: true,
    seismicSectionTextureSize: [section.width, section.height],
    seismicSectionIsoDisabledReason: "texture-plane-v1",
    seismicProductId: product.id,
    seismicProductLabel: product.label,
    seismicProductLineLabel: product.lineLabel,
    seismicProductSourceSubmission: product.sourceSubmission,
    seismicProductSurveyKind: product.surveyKind,
    seismicProductKind: product.productKind,
    seismicProductDomainKind: product.domainKind,
    seismicProductValueStats: product.amplitudeStats,
    seismicSectionId: section.id,
    seismicSectionAxis: section.axis,
    seismicSectionSourceAxis: section.sourceAxis,
    seismicSectionFraction: section.fraction,
    seismicSectionGeometrySource:
      section.geometrySource ?? geometry.userData.seismicSectionGeometrySource,
    seismicSectionGeometryKind: geometry.userData.seismicSectionGeometryKind,
    seismicSectionVertexCount:
      geometry.getAttribute("position")?.count ?? 0,
    seismicSectionPath: section.path,
    seismicSectionPathPointCount:
      geometry.userData.seismicSectionPathPointCount,
    seismicSectionSurfaceGrid: section.surfaceGrid,
    seismicSectionSurfaceGridPointCount:
      geometry.userData.seismicSectionSurfaceGridPointCount,
    seismicLodTier: tier,
    seismicSampleDomainUnit: section.sampleDomain.unit,
    seismicDatumM: section.datumM,
    seismicVerticalReference: section.verticalReference,
    seismicValueEncoding: section.valueEncoding ?? product.valueEncoding,
    seismicNavigationPlacement:
      section.navigationPlacement ?? product.navigationPlacement,
  };
  return mesh;
}

function raymarchVertexShader(): string {
  return `
out vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
}

function raymarchFragmentShader(): string {
  return `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uAmplitudeMin;
uniform float uAmplitudeMax;
uniform float uAmplitudeGamma;
uniform float uOpacity;
uniform int uColormap;
uniform int uRemoveBackground;
uniform float uBackgroundCutoff;
uniform float uSampleSteps;
uniform int uSceneSectionEnabled;
uniform int uSceneSectionMode;
uniform int uSceneSectionPlaneCount;
uniform vec3 uSceneSectionNormals[8];
uniform float uSceneSectionPositions[8];
uniform float uSceneSectionThickness[8];
uniform int uSceneSectionInvert[8];
uniform float uSceneSectionPlaneOutsideOpacity[8];
uniform int uSceneSectionFrameCount;
uniform vec3 uSceneSectionFrameAxisA[8];
uniform vec3 uSceneSectionFrameAxisB[8];
uniform vec4 uSceneSectionFrameBounds[8];
uniform float uSceneSectionFrameOutsideOpacity[8];
uniform int uWorkingAreaFocusEnabled;
uniform vec3 uWorkingAreaFocusBoundsMin;
uniform vec3 uWorkingAreaFocusBoundsMax;
uniform float uWorkingAreaFocusOutsideOpacity;

in vec3 vWorldPosition;
out vec4 fragColor;

vec3 colorRamp(float t) {
  float c = clamp(t, 0.0, 1.0);
  if (uColormap == 1) {
    return vec3(c);
  }
  if (uColormap == 2) {
    if (c < 0.33) {
      return mix(vec3(0.090, 0.231, 0.604), vec3(0.200, 0.714, 0.843), c / 0.33);
    }
    if (c < 0.66) {
      return mix(vec3(0.200, 0.714, 0.843), vec3(0.957, 0.875, 0.388), (c - 0.33) / 0.33);
    }
    return mix(vec3(0.957, 0.875, 0.388), vec3(0.827, 0.294, 0.176), (c - 0.66) / 0.34);
  }
  if (c < 0.5) {
    return mix(vec3(0.141, 0.337, 0.788), vec3(0.957, 0.969, 1.0), c / 0.5);
  }
  return mix(vec3(0.957, 0.969, 1.0), vec3(0.851, 0.212, 0.184), (c - 0.5) / 0.5);
}

float shapedAmplitude(float t) {
  float c = clamp(t, 0.0, 1.0);
  float gamma = clamp(uAmplitudeGamma, 0.35, 2.5);
  float signedT = (c - 0.5) * 2.0;
  if (abs(signedT) <= 0.0001) {
    return 0.5;
  }
  return clamp(0.5 + sign(signedT) * pow(abs(signedT), gamma) * 0.5, 0.0, 1.0);
}

vec2 intersectBox(vec3 origin, vec3 direction) {
  vec3 invDirection = 1.0 / direction;
  vec3 tMin = (uBoundsMin - origin) * invDirection;
  vec3 tMax = (uBoundsMax - origin) * invDirection;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}

float sceneSectionAlpha(vec3 position) {
  if (uSceneSectionEnabled == 0) return 1.0;
  float alpha = 1.0;
  for (int i = 0; i < 8; i += 1) {
    if (i >= uSceneSectionPlaneCount) break;
    vec3 normal = normalize(uSceneSectionNormals[i]);
    float distance = dot(position, normal) - uSceneSectionPositions[i];
    if (uSceneSectionInvert[i] == 1) distance = -distance;
    if (distance > 0.0) {
      alpha = min(alpha, clamp(uSceneSectionPlaneOutsideOpacity[i], 0.0, 1.0));
    }
  }
  for (int i = 0; i < 8; i += 1) {
    if (i >= uSceneSectionFrameCount) break;
    vec3 axisA = normalize(uSceneSectionFrameAxisA[i]);
    vec3 axisB = normalize(uSceneSectionFrameAxisB[i]);
    vec4 bounds = uSceneSectionFrameBounds[i];
    float a = dot(position, axisA);
    float b = dot(position, axisB);
    bool inside = a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w;
    if (!inside) {
      alpha = min(alpha, clamp(uSceneSectionFrameOutsideOpacity[i], 0.0, 1.0));
    }
  }
  return alpha;
}

float workingAreaFocusAlpha(vec3 position) {
  if (uWorkingAreaFocusEnabled == 0) return 1.0;
  bool inside =
    all(greaterThanEqual(position, uWorkingAreaFocusBoundsMin)) &&
    all(lessThanEqual(position, uWorkingAreaFocusBoundsMax));
  return inside ? 1.0 : clamp(uWorkingAreaFocusOutsideOpacity, 0.0, 1.0);
}

void main() {
  vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
  vec2 hit = intersectBox(cameraPosition, rayDirection);
  if (hit.x > hit.y || hit.y < 0.0) discard;

  float t = max(hit.x, 0.0);
  float tEnd = hit.y;
  float sampleSteps = clamp(uSampleSteps, 24.0, ${SOURCE_FIDELITY_MAX_SAMPLE_STEPS.toFixed(1)});
  float stepSize = max((tEnd - t) / sampleSteps, 1.0);
  float windowMax = max(uAmplitudeMax, uAmplitudeMin + 0.0001);
  vec4 accum = vec4(0.0);

  for (int i = 0; i < ${SOURCE_FIDELITY_MAX_SAMPLE_STEPS + 16}; i += 1) {
    if (float(i) >= sampleSteps) break;
    if (t > tEnd || accum.a > 0.96) break;
    vec3 position = cameraPosition + rayDirection * t;
    float sectionAlpha = sceneSectionAlpha(position);
    if (sectionAlpha <= 0.0001) {
      t += stepSize;
      continue;
    }
    float focusAlpha = workingAreaFocusAlpha(position);
    if (focusAlpha <= 0.0001) {
      t += stepSize;
      continue;
    }
    vec3 uvw = (position - uBoundsMin) / (uBoundsMax - uBoundsMin);
    float amplitude = texture(uVolume, clamp(uvw, vec3(0.0), vec3(1.0))).r;
    float rampT = clamp((amplitude - uAmplitudeMin) / (windowMax - uAmplitudeMin), 0.0, 1.0);
    float displayT = shapedAmplitude(rampT);
    float contrast = abs(displayT - 0.5) * 2.0;
    float alpha = smoothstep(0.06, 0.92, contrast) * uOpacity * 0.085 * focusAlpha * sectionAlpha;
    if (uRemoveBackground == 1) {
      float muteHigh = min(0.96, max(0.62, uBackgroundCutoff + 0.22));
      alpha *= smoothstep(uBackgroundCutoff, muteHigh, contrast);
    }
    vec3 color = colorRamp(displayT);
    accum.rgb += (1.0 - accum.a) * alpha * color;
    accum.a += (1.0 - accum.a) * alpha;
    t += stepSize;
  }

  if (accum.a <= 0.01) discard;
  fragColor = vec4(accum.rgb / max(accum.a, 0.0001), accum.a);
}
`;
}

async function buildRaymarchMesh(
  product: SeismicProductSpec,
  volume: SeismicVolumeSpec,
  resolveAsset: (path: string) => string,
  tier: SeismicLodTierName,
): Promise<THREE.Mesh> {
  const bytes = await fetchBytes(resolveAsset(volume.file));
  const [nx, ny, nz] = volume.dimensions;
  const expected = nx * ny * nz;
  if (bytes.length < expected) {
    throw new Error(
      `${product.id} volume expected ${expected} bytes, received ${bytes.length}`,
    );
  }

  const volumeData = bytes.slice(0, expected);
  const texture = new THREE.Data3DTexture(volumeData, nx, ny, nz);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const min = volume.sceneBounds.min;
  const max = volume.sceneBounds.max;
  const size = new THREE.Vector3(
    Math.max(1, max[0] - min[0]),
    Math.max(1, max[1] - min[1]),
    Math.max(1, max[2] - min[2]),
  );
  const center = new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  );

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: raymarchVertexShader(),
    fragmentShader: raymarchFragmentShader(),
    uniforms: {
      uVolume: { value: texture },
      uBoundsMin: { value: new THREE.Vector3(min[0], min[1], min[2]) },
      uBoundsMax: { value: new THREE.Vector3(max[0], max[1], max[2]) },
      uAmplitudeMin: { value: 0.08 },
      uAmplitudeMax: { value: 0.92 },
      uAmplitudeGamma: { value: 1 },
      uOpacity: { value: DEFAULT_SECTION_OPACITY },
      uColormap: { value: 0 },
      uRemoveBackground: { value: 0 },
      uBackgroundCutoff: { value: 0.16 },
      uSampleSteps: { value: 96 },
      uSceneSectionEnabled: { value: 0 },
      uSceneSectionMode: { value: 0 },
      uSceneSectionPlaneCount: { value: 0 },
      uSceneSectionNormals: { value: sceneSectionVectorSlots() },
      uSceneSectionPositions: { value: sceneSectionNumberSlots(0) },
      uSceneSectionThickness: { value: sceneSectionNumberSlots(1) },
      uSceneSectionInvert: { value: sceneSectionNumberSlots(0) },
      uSceneSectionPlaneOutsideOpacity: { value: sceneSectionNumberSlots(1) },
      uSceneSectionFrameCount: { value: 0 },
      uSceneSectionFrameAxisA: { value: sceneSectionVectorSlots() },
      uSceneSectionFrameAxisB: { value: sceneSectionVectorSlots() },
      uSceneSectionFrameBounds: { value: sceneSectionVector4Slots() },
      uSceneSectionFrameOutsideOpacity: { value: sceneSectionNumberSlots(1) },
      uWorkingAreaFocusEnabled: { value: 0 },
      uWorkingAreaFocusBoundsMin: { value: new THREE.Vector3() },
      uWorkingAreaFocusBoundsMax: { value: new THREE.Vector3() },
      uWorkingAreaFocusOutsideOpacity: { value: 1 },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialOpacity = true;
  material.userData.preserveMaterialColor = true;
  material.userData.seismicRaymarchMaterial = true;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(center);
  mesh.name = `${product.label} - raymarch volume`;
  mesh.renderOrder = VOLUME_RENDER_ORDER;
  mesh.visible = false;
  mesh.userData = {
    displayName: mesh.name,
    seismicRaymarchVolume: true,
    seismicProductId: product.id,
    seismicProductLabel: product.label,
    seismicProductSurveyKind: product.surveyKind,
    seismicProductKind: product.productKind,
    seismicProductDomainKind: product.domainKind,
    seismicLodTier: tier,
    seismicProductValueStats: product.amplitudeStats,
    seismicVolumeValueStats: volume.amplitudeStats ?? product.amplitudeStats,
    seismicVolumeData: volumeData,
    seismicVolumeDimensions: volume.dimensions,
    seismicVolumeSampleDomain: volume.sampleDomain,
    seismicVolumeBaseBounds: volume.sceneBounds,
    seismicVolumeCurrentBounds: volume.sceneBounds,
    seismicVolumeBaseSize: [size.x, size.y, size.z],
    seismicVolumeGeometryModel: "axis-aligned-envelope",
    seismicVolumeGeometryModelDescription:
      "Raymarch volume renders inside the axis-aligned sceneBounds envelope; exact trace-grid orientation is not validated here.",
    seismicVolumeVerticalReference:
      volume.verticalReference ?? product.verticalReference,
    seismicVolumeValueEncoding: volume.valueEncoding ?? product.valueEncoding,
    seismicVolumeDatumM:
      max[2] +
      volume.sampleDomain.min * volume.sampleDomain.verticalScaleMPerUnit,
  };
  return mesh;
}

function buildNavigationObjects(collection: GeoJsonFeatureCollection): THREE.Object3D {
  const group = new THREE.Group();
  group.name = "Seismic navigation";
  group.userData.displayName = "Seismic navigation";
  group.userData.seismicNavigation = true;
  group.userData.seismicNavigationRole = "container";
  group.visible = false;

  const sourcePoints: number[] = [];
  const receiverPoints: number[] = [];
  const lineGroup = new THREE.Group();
  lineGroup.name = "Seismic survey lines";
  lineGroup.userData.displayName = "Seismic survey lines";
  lineGroup.userData.seismicNavigation = true;
  lineGroup.userData.seismicNavigationRole = "lines";
  lineGroup.visible = false;

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Point") {
      const point = normalizeCoordinate(geometry.coordinates);
      if (!point) continue;
      const role = feature.properties?.role === "source" ? "sources" : "receivers";
      if (role === "sources") {
        sourcePoints.push(...point);
      } else {
        receiverPoints.push(...point);
      }
      continue;
    }
    if (geometry.type !== "LineString") continue;
    const coords = geometry.coordinates
      .map(normalizeCoordinate)
      .filter((point): point is Vec3 => point !== null);
    if (coords.length < 2) continue;
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(coords.flat()), 3),
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#35c7e8",
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      toneMapped: false,
    });
    lineMaterial.userData.forceTransparent = true;
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = NAVIGATION_RENDER_ORDER;
    line.visible = false;
    line.userData.seismicNavigation = true;
    line.userData.seismicNavigationRole = "lines";
    line.name =
      typeof feature.properties?.label === "string"
        ? feature.properties.label
        : "Seismic navigation line";
    lineGroup.add(line);
  }

  const addPointGroup = (
    points: number[],
    role: SeismicNavigationRole,
    color: string,
    name: string,
  ) => {
    if (points.length === 0) return;
    const roleGroup = new THREE.Group();
    roleGroup.name = name;
    roleGroup.userData.displayName = name;
    roleGroup.userData.seismicNavigation = true;
    roleGroup.userData.seismicNavigationRole = role;
    roleGroup.visible = false;
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(points), 3),
    );
    const pointMaterial = new THREE.PointsMaterial({
      color,
      size: 42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    pointMaterial.userData.forceTransparent = true;
    const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    pointCloud.renderOrder = NAVIGATION_RENDER_ORDER;
    pointCloud.visible = false;
    pointCloud.userData.seismicNavigation = true;
    pointCloud.userData.seismicNavigationRole = role;
    pointCloud.name = name;
    roleGroup.add(pointCloud);
    group.add(roleGroup);
  };

  addPointGroup(sourcePoints, "sources", "#f5d36a", "Seismic source points");
  addPointGroup(receiverPoints, "receivers", "#76d7ff", "Seismic receiver points");
  if (lineGroup.children.length > 0) group.add(lineGroup);

  return group;
}

function productSummary(product: SeismicProductSpec) {
  return {
    id: product.id,
    label: product.label,
    sourceSubmission: product.sourceSubmission,
    surveyKind: product.surveyKind,
    productKind: product.productKind,
    domainKind: product.domainKind,
    domainUnit: product.domainUnit,
    datumM: product.datumM,
    navigationPlacement: product.navigationPlacement,
    verticalReference: product.verticalReference,
    valueEncoding: product.valueEncoding,
    amplitudeStats: product.amplitudeStats,
    raymarchVolumeStats: product.raymarchVolume?.amplitudeStats,
    raymarchCapable: !!product.raymarchVolume,
    sectionAxes: Array.from(new Set(product.sections.map((section) => section.axis))),
  };
}

async function buildSeismicProductGroup(
  product: SeismicProductSpec,
  resolveAsset: (path: string) => string,
  tier: SeismicLodTierName,
  options: SeismicProductLoadOptions = {},
): Promise<THREE.Group> {
  const productGroup = new THREE.Group();
  productGroup.name = product.label;
  productGroup.userData.seismicProductId = product.id;
  productGroup.userData.seismicProductLabel = product.label;
  productGroup.userData.seismicProductSurveyKind = product.surveyKind;
  productGroup.userData.seismicProductLodTier = tier;
  productGroup.userData.seismicProductIncludesVolume =
    options.includeVolume === true;
  productGroup.userData.seismicNavigationPlacement = product.navigationPlacement;

  const sectionMeshes = await Promise.all(
    product.sections.map((section) =>
      buildSectionMesh(product, sectionForLod(section, tier), resolveAsset, tier),
    ),
  );
  productGroup.add(...sectionMeshes);

  if (options.includeVolume === true && product.raymarchVolume) {
    productGroup.add(
      await buildRaymarchMesh(
        product,
        volumeForLod(product.raymarchVolume, tier),
        resolveAsset,
        tier,
      ),
    );
  }
  return productGroup;
}

function disposeMaterial(material: THREE.Material): void {
  const uniforms = (
    material as THREE.Material & {
      uniforms?: Record<string, { value?: unknown }>;
    }
  ).uniforms;
  if (uniforms) {
    for (const uniform of Object.values(uniforms)) {
      if (uniform?.value instanceof THREE.Texture) {
        uniform.value.dispose();
      }
    }
  }
  material.dispose();
}

function disposeSeismicProductObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
      child.geometry?.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        for (const item of material) disposeMaterial(item);
      } else if (material) {
        disposeMaterial(material);
      }
    }
  });
}

export async function loadSeismicBrowser(manifestUrl: string): Promise<THREE.Object3D> {
  const resolvedManifestUrl = new URL(manifestUrl, window.location.href).toString();
  const manifest = await fetchJson<SeismicManifest>(resolvedManifestUrl);
  if (manifest.schema !== "geosee.seismic-browser.v1") {
    throw new Error(`Unsupported seismic manifest schema: ${manifest.schema}`);
  }
  const resolveAsset = assetResolver(resolvedManifestUrl);
  const group = new THREE.Group();
  group.name = manifest.label;
  group.userData.seismicVerticalReference = manifest.verticalReference;
  group.userData.seismicValueEncoding = manifest.valueEncoding;
  const productsById = new Map(
    manifest.products.map((product) => [product.id, product] as const),
  );
  const loadedProducts = new Map<
    string,
    {
      group: THREE.Group;
      tier: SeismicLodTierName;
      includeVolume: boolean;
      approxBytes: number;
    }
  >();
  const pendingProducts = new Map<
    string,
    {
      promise: Promise<void>;
      tier: SeismicLodTierName;
      includeVolume: boolean;
    }
  >();
  const loadSequences = new Map<string, number>();
  const retainedProductIds = new Set<string>();
  const disposedProductIds: string[] = [];

  const publishRuntimeState = () => {
    const activeLodByProduct: Record<string, SeismicLodTierName> = {};
    const approxBytesByProduct: Record<string, number> = {};
    for (const [productId, record] of loadedProducts) {
      activeLodByProduct[productId] = record.tier;
      approxBytesByProduct[productId] = record.approxBytes;
    }
    group.userData.seismicLoadedProductIds = Array.from(loadedProducts.keys());
    group.userData.seismicPendingProductIds = Array.from(pendingProducts.keys());
    group.userData.seismicPendingLodByProduct = Object.fromEntries(
      Array.from(pendingProducts, ([productId, record]) => [productId, record.tier]),
    );
    group.userData.seismicActiveLodByProduct = activeLodByProduct;
    group.userData.seismicDisposedProductIds = disposedProductIds.slice(-20);
    group.userData.seismicApproxBytesByProduct = approxBytesByProduct;
    group.userData.seismicApproxTotalBytes = Object.values(
      approxBytesByProduct,
    ).reduce((sum, value) => sum + value, 0);
  };

  const invalidateRuntimeIndex = () => {
    delete group.userData.seismicRuntimeIndex;
    if (group.parent) delete group.parent.userData.seismicRuntimeIndex;
  };

  const notifyProductsChanged = () => {
    invalidateRuntimeIndex();
    const callback = group.userData.seismicOnProductsLoaded;
    if (typeof callback === "function") callback();
  };

  const installProductGroup = (
    productId: string,
    productGroup: THREE.Group,
    tier: SeismicLodTierName,
    options: SeismicProductLoadOptions,
  ) => {
    const existing = loadedProducts.get(productId);
    if (existing) {
      group.remove(existing.group);
      disposeSeismicProductObject(existing.group);
    }
    loadedProducts.set(productId, {
      group: productGroup,
      tier,
      includeVolume: options.includeVolume === true,
      approxBytes: estimateProductBytes(productsById.get(productId)!, tier, options),
    });
    group.add(productGroup);
    publishRuntimeState();
    notifyProductsChanged();
  };

  const disposeProduct = (productId: string) => {
    const record = loadedProducts.get(productId);
    if (!record) return;
    group.remove(record.group);
    disposeSeismicProductObject(record.group);
    loadedProducts.delete(productId);
    disposedProductIds.push(productId);
    publishRuntimeState();
    notifyProductsChanged();
  };

  const ensureOneProductLoaded = async (
    productId: string,
    requestedTier: SeismicLodTierName,
    options: SeismicProductLoadOptions = {},
  ): Promise<void> => {
    const product = productsById.get(productId);
    if (!product) return;
    const includeVolume = options.includeVolume === true;
    const loaded = loadedProducts.get(productId);
    const exactTierRequired = requestedTier === SEISMIC_COARSE_LOD_TIER;
    const keepLoaded =
      loaded &&
      (loaded.includeVolume || !includeVolume) &&
      (loaded.tier === requestedTier ||
        (!exactTierRequired &&
          SEISMIC_LOD_RANK[loaded.tier] >= SEISMIC_LOD_RANK[requestedTier]));
    if (keepLoaded) {
      return;
    }
    const pending = pendingProducts.get(productId);
    if (pending?.tier === requestedTier && (pending.includeVolume || !includeVolume)) {
      await pending.promise;
      return;
    }
    if (pending?.tier === requestedTier) {
      await pending.promise;
      const afterPending = loadedProducts.get(productId);
      if (
        afterPending &&
        afterPending.includeVolume &&
        (afterPending.tier === requestedTier ||
          (!exactTierRequired &&
            SEISMIC_LOD_RANK[afterPending.tier] >= SEISMIC_LOD_RANK[requestedTier]))
      ) {
        return;
      }
    }
    const nextSeq = (loadSequences.get(productId) ?? 0) + 1;
    loadSequences.set(productId, nextSeq);
    const task = (async () => {
      const loadTier = async (tier: SeismicLodTierName) => {
        const current = loadedProducts.get(productId);
        const exactLoadTierRequired = tier === SEISMIC_COARSE_LOD_TIER;
        const keepCurrent =
          current &&
          (current.includeVolume || !includeVolume) &&
          (current.tier === tier ||
            (!exactLoadTierRequired &&
              SEISMIC_LOD_RANK[current.tier] >= SEISMIC_LOD_RANK[tier]));
        if (keepCurrent) {
          return;
        }
        const productGroup = await buildSeismicProductGroup(
          product,
          resolveAsset,
          tier,
          { includeVolume },
        );
        if (
          loadSequences.get(productId) !== nextSeq ||
          (retainedProductIds.size > 0 && !retainedProductIds.has(productId))
        ) {
          disposeSeismicProductObject(productGroup);
          return;
        }
        installProductGroup(productId, productGroup, tier, { includeVolume });
      };
      if (!loadedProducts.has(productId) && requestedTier !== SEISMIC_COARSE_LOD_TIER) {
        await loadTier(SEISMIC_COARSE_LOD_TIER);
      }
      await loadTier(requestedTier);
    })().finally(() => {
      const currentPending = pendingProducts.get(productId);
      if (currentPending?.promise === task) {
        pendingProducts.delete(productId);
      }
      publishRuntimeState();
    });
    pendingProducts.set(productId, {
      promise: task,
      tier: requestedTier,
      includeVolume,
    });
    publishRuntimeState();
    await task;
  };

  group.userData = {
    displayName: manifest.label,
    seismicBrowser: true,
    seismicDefaultProductId: manifest.defaultProductId,
    seismicProducts: manifest.products.map(productSummary),
    seismicLoadedProductIds: [],
    seismicPendingProductIds: [],
    seismicPendingLodByProduct: {},
    seismicActiveLodByProduct: {},
    seismicDisposedProductIds: [],
    seismicApproxBytesByProduct: {},
    seismicApproxTotalBytes: 0,
    seismicProductPayloadPolicy: "visible-style-request-only",
    seismicEnsureProductsLoaded(
      productIds: string[],
      tier?: SeismicLodTierName,
      options?: SeismicProductLoadOptions,
    ) {
      const requestedTier =
        tier === "coarse" || tier === "source" || tier === "standard"
          ? tier
          : SEISMIC_DEFAULT_LOD_TIER;
      const uniqueProductIds = Array.from(
        new Set(productIds.filter((productId) => productsById.has(productId))),
      );
      return Promise.all(
        uniqueProductIds.map((productId) =>
          ensureOneProductLoaded(productId, requestedTier, options),
        ),
      ).then(() => undefined);
    },
    seismicRetainProducts(productIds: string[]) {
      retainedProductIds.clear();
      for (const productId of productIds) {
        if (productsById.has(productId)) retainedProductIds.add(productId);
      }
      for (const productId of Array.from(loadedProducts.keys())) {
        if (!retainedProductIds.has(productId)) disposeProduct(productId);
      }
      publishRuntimeState();
    },
  };

  if (manifest.navigation?.geojson) {
    const navigation = await fetchJson<GeoJsonFeatureCollection>(
      resolveAsset(manifest.navigation.geojson),
    );
    group.add(buildNavigationObjects(navigation));
  }

  publishRuntimeState();
  return group;
}
