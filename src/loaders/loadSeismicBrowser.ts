import * as THREE from "three";
import { appAssetUrl } from "../projects/projectPathsRuntime";

const SCENE_SECTION_SHADER_SLOT_COUNT = 8;

type Vec3 = [number, number, number];

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
  path?: Vec3[];
}

interface SeismicVolumeSpec {
  file: string;
  dimensions: Vec3;
  sceneBounds: SeismicBounds;
  sampleDomain: SeismicSampleDomain;
  amplitudeStats?: SeismicValueStats;
}

interface SeismicProductSpec {
  id: string;
  label: string;
  sourceSubmission: string;
  surveyKind: "2d" | "3d" | "legacy-2d";
  productKind: string;
  domainKind: string;
  domainUnit: string;
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

function seismicColor(t: number, colormap = "blue-white-red"): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const color = new THREE.Color();
  if (colormap === "grayscale") {
    return color.setRGB(clamped, clamped, clamped);
  }
  if (colormap === "velocity") {
    if (clamped < 0.33) {
      return color.lerpColors(
        new THREE.Color("#173b9a"),
        new THREE.Color("#33b6d7"),
        clamped / 0.33,
      );
    }
    if (clamped < 0.66) {
      return color.lerpColors(
        new THREE.Color("#33b6d7"),
        new THREE.Color("#f4df63"),
        (clamped - 0.33) / 0.33,
      );
    }
    return color.lerpColors(
      new THREE.Color("#f4df63"),
      new THREE.Color("#d34b2d"),
      (clamped - 0.66) / 0.34,
    );
  }
  if (clamped < 0.5) {
    return color.lerpColors(
      new THREE.Color("#2456c9"),
      new THREE.Color("#f4f7ff"),
      clamped / 0.5,
    );
  }
  return color.lerpColors(
    new THREE.Color("#f4f7ff"),
    new THREE.Color("#d9362f"),
    (clamped - 0.5) / 0.5,
  );
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
attribute float seismicAlpha;
varying vec3 vColor;
varying float vAlpha;
varying vec3 vWorldPosition;

void main() {
  vColor = color;
  vAlpha = seismicAlpha;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
}

function sectionFragmentShader(): string {
  return `
precision highp float;

uniform float uOpacity;
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
varying vec3 vColor;
varying float vAlpha;
varying vec3 vWorldPosition;

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
  float alpha = clamp(vAlpha * uOpacity, 0.0, 1.0) * workingAreaFocusAlpha(vWorldPosition) * sectionAlpha;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
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

  if (section.axis === "line" && section.path && section.path.length >= 2) {
    const first = section.path[0];
    const last = section.path[section.path.length - 1];
    return [
      first[0] + (last[0] - first[0]) * widthT,
      first[1] + (last[1] - first[1]) * widthT,
      z,
    ];
  }

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

function buildGridIndices(width: number, height: number): Uint32Array {
  const indices = new Uint32Array(Math.max(0, width - 1) * Math.max(0, height - 1) * 6);
  let offset = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const a = y * width + x;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices[offset++] = a;
      indices[offset++] = c;
      indices[offset++] = b;
      indices[offset++] = b;
      indices[offset++] = c;
      indices[offset++] = d;
    }
  }
  return indices;
}

async function buildSectionMesh(
  product: SeismicProductSpec,
  section: SeismicSectionSpec,
  resolveAsset: (path: string) => string,
): Promise<THREE.Mesh> {
  const amplitude = await fetchBytes(resolveAsset(section.amplitudeFile));
  const expected = section.width * section.height;
  if (amplitude.length < expected) {
    throw new Error(
      `${product.id}/${section.id} expected ${expected} amplitude bytes, received ${amplitude.length}`,
    );
  }

  const vertices = new Float32Array(expected * 3);
  const colors = new Float32Array(expected * 3);
  const alphas = new Float32Array(expected);
  const values = new Float32Array(expected);
  const sampleValues = new Float32Array(expected);
  const scratch = new THREE.Color();
  alphas.fill(1);

  for (let y = 0; y < section.height; y += 1) {
    for (let x = 0; x < section.width; x += 1) {
      const i = y * section.width + x;
      const point = sectionVertexPosition(section, x, y);
      vertices[i * 3] = point[0];
      vertices[i * 3 + 1] = point[1];
      vertices[i * 3 + 2] = point[2];
      sampleValues[i] = sectionSampleValue(section, y);
      const value = amplitude[i] / 255;
      values[i] = value;
      scratch.copy(seismicColor(value));
      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("seismicAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setIndex(new THREE.BufferAttribute(buildGridIndices(section.width, section.height), 1));
  geometry.userData.seismicAmplitudeValues = values;
  geometry.userData.seismicSampleValues = sampleValues;
  geometry.userData.seismicSection = section;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    vertexShader: sectionVertexShader(),
    fragmentShader: sectionFragmentShader(),
    uniforms: {
      uOpacity: { value: DEFAULT_SECTION_OPACITY },
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
    vertexColors: true,
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

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${product.label} - ${section.label}`;
  mesh.renderOrder = SECTION_RENDER_ORDER;
  mesh.visible = false;
  mesh.userData = {
    displayName: mesh.name,
    seismicSection: true,
    seismicProductId: product.id,
    seismicProductLabel: product.label,
    seismicProductSurveyKind: product.surveyKind,
    seismicProductKind: product.productKind,
    seismicProductDomainKind: product.domainKind,
    seismicProductValueStats: product.amplitudeStats,
    seismicSectionId: section.id,
    seismicSectionAxis: section.axis,
    seismicSectionFraction: section.fraction,
    seismicSampleDomainUnit: section.sampleDomain.unit,
    seismicDatumM: section.datumM,
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
  float sampleSteps = clamp(uSampleSteps, 24.0, 160.0);
  float stepSize = max((tEnd - t) / sampleSteps, 1.0);
  float windowMax = max(uAmplitudeMax, uAmplitudeMin + 0.0001);
  vec4 accum = vec4(0.0);

  for (int i = 0; i < 176; i += 1) {
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
    seismicProductValueStats: product.amplitudeStats,
    seismicVolumeValueStats: volume.amplitudeStats ?? product.amplitudeStats,
    seismicVolumeData: volumeData,
    seismicVolumeDimensions: volume.dimensions,
    seismicVolumeSampleDomain: volume.sampleDomain,
    seismicVolumeBaseBounds: volume.sceneBounds,
    seismicVolumeCurrentBounds: volume.sceneBounds,
    seismicVolumeBaseSize: [size.x, size.y, size.z],
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
    amplitudeStats: product.amplitudeStats,
    raymarchVolumeStats: product.raymarchVolume?.amplitudeStats,
    raymarchCapable: !!product.raymarchVolume,
    sectionAxes: Array.from(new Set(product.sections.map((section) => section.axis))),
  };
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
  group.userData = {
    displayName: manifest.label,
    seismicBrowser: true,
    seismicDefaultProductId: manifest.defaultProductId,
    seismicProducts: manifest.products.map(productSummary),
  };

  if (manifest.navigation?.geojson) {
    const navigation = await fetchJson<GeoJsonFeatureCollection>(
      resolveAsset(manifest.navigation.geojson),
    );
    group.add(buildNavigationObjects(navigation));
  }

  const productObjects = await Promise.all(
    manifest.products.map(async (product) => {
      const productGroup = new THREE.Group();
      productGroup.name = product.label;
      productGroup.userData.seismicProductId = product.id;
      productGroup.userData.seismicProductLabel = product.label;
      productGroup.userData.seismicProductSurveyKind = product.surveyKind;

      const sectionMeshes = await Promise.all(
        product.sections.map((section) =>
          buildSectionMesh(product, section, resolveAsset),
        ),
      );
      productGroup.add(...sectionMeshes);

      if (product.raymarchVolume) {
        productGroup.add(
          await buildRaymarchMesh(product, product.raymarchVolume, resolveAsset),
        );
      }
      return productGroup;
    }),
  );
  group.add(...productObjects);
  return group;
}
