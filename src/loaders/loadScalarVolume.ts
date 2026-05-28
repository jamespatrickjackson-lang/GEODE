import * as THREE from "three";
import { appAssetUrl } from "../projects/projectPathsRuntime";

type Vec3 = [number, number, number];

interface ScalarVolumeBounds {
  min: Vec3;
  max: Vec3;
}

interface ScalarVolumeProduct {
  id: string;
  label: string;
  description?: string;
  classification?: string;
  domain?: string;
  unit?: string;
  dimensions: Vec3;
  sceneBounds: ScalarVolumeBounds;
  scalarRange: {
    min: number;
    max: number;
    displayMin?: number;
    displayMax?: number;
  };
  files: {
    volume: string;
    mask: string;
    stats?: string;
    provenance?: string;
  };
  displayRecipe?: {
    opacity?: number;
    density?: number;
    sampleSteps?: number;
    transferMode?: string;
    scalarWindow?: [number, number];
    maskVisible?: boolean;
  };
  caveats?: string[];
}

interface ScalarVolumeManifest {
  schema: "geosee.scalar-volume.v1";
  label: string;
  generatedDate?: string;
  scalar?: {
    name?: string;
    unit?: string;
    sourceRange?: [number, number];
    displayRange?: [number, number];
  };
  products: ScalarVolumeProduct[];
  thresholdSurfaces?: unknown;
  caveats?: string[];
}

const VOLUME_RENDER_ORDER = 12.95;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
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

function volumeVertexShader(): string {
  return `
out vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
}

function volumeFragmentShader(): string {
  return `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform sampler3D uMask;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uSourceMin;
uniform float uSourceMax;
uniform float uDisplayMin;
uniform float uDisplayMax;
uniform float uThresholdMin;
uniform float uThresholdMax;
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform float uMidpoint;
uniform float uContrast;
uniform float uOpacity;
uniform float uDensity;
uniform float uSampleSteps;
uniform int uTransferMode;
uniform int uMaskVisible;
uniform int uSceneSectionEnabled;
uniform int uSceneSectionMode;
uniform int uSceneSectionPlaneCount;
uniform vec3 uSceneSectionNormals[3];
uniform float uSceneSectionPositions[3];
uniform float uSceneSectionThickness[3];
uniform int uSceneSectionInvert[3];
uniform int uSceneSectionWindowEnabled;
uniform int uSceneSectionWindowAxis;
uniform float uSceneSectionWindowMinAlong;
uniform float uSceneSectionWindowMaxAlong;
uniform float uSceneSectionWindowBottomZ;
uniform int uSceneSectionFrameCount;
uniform int uSceneSectionFrameAxes[3];
uniform vec4 uSceneSectionFrameBounds[3];
uniform int uWorkingAreaFocusEnabled;
uniform vec3 uWorkingAreaFocusBoundsMin;
uniform vec3 uWorkingAreaFocusBoundsMax;
uniform float uWorkingAreaFocusOutsideOpacity;

in vec3 vWorldPosition;
out vec4 fragColor;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

vec3 scalarRamp(float scalarValue) {
  float t = saturate((scalarValue - uDisplayMin) / max(0.000001, uDisplayMax - uDisplayMin));
  t = saturate((t - 0.5) * clamp(uContrast, 0.35, 3.0) + 0.5);
  float midpoint = clamp(uMidpoint, 0.05, 0.95);
  if (t < midpoint) {
    return mix(uColorLow, uColorMid, saturate(t / max(0.000001, midpoint)));
  }
  return mix(uColorMid, uColorHigh, saturate((t - midpoint) / max(0.000001, 1.0 - midpoint)));
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

bool sceneSectionAllows(vec3 position) {
  if (uSceneSectionEnabled == 0) return true;
  for (int i = 0; i < 3; i += 1) {
    if (i >= uSceneSectionPlaneCount) break;
    vec3 normal = normalize(uSceneSectionNormals[i]);
    float distance = dot(position, normal) - uSceneSectionPositions[i];
    if (uSceneSectionInvert[i] == 1) distance = -distance;
    if (distance > 0.0) {
      return false;
    }
  }
  return true;
}

bool sceneSectionWindowAllows(vec3 position) {
  if (uSceneSectionFrameCount <= 0) return true;
  for (int i = 0; i < 3; i += 1) {
    if (i >= uSceneSectionFrameCount) break;
    int axis = uSceneSectionFrameAxes[i];
    vec4 bounds = uSceneSectionFrameBounds[i];
    float a = axis == 0 ? position.y : position.x;
    float b = axis == 2 ? position.y : position.z;
    if (a >= bounds.x && a <= bounds.y && b >= bounds.z && b <= bounds.w) {
      return true;
    }
  }
  return false;
}

float workingAreaFocusAlpha(vec3 position) {
  if (uWorkingAreaFocusEnabled == 0) return 1.0;
  bool inside =
    all(greaterThanEqual(position, uWorkingAreaFocusBoundsMin)) &&
    all(lessThanEqual(position, uWorkingAreaFocusBoundsMax));
  return inside ? 1.0 : clamp(uWorkingAreaFocusOutsideOpacity, 0.0, 1.0);
}

float transferAlpha(float scalarValue, float rampT, float maskValue) {
  float rangeGate = smoothstep(uThresholdMin, uThresholdMin + 0.04, scalarValue) *
    (1.0 - smoothstep(uThresholdMax - 0.04, uThresholdMax, scalarValue));
  float contrast = abs(rampT - 0.5) * 2.0;
  float shape = mix(0.56, 1.0, contrast);
  if (uTransferMode == 1) {
    shape = mix(0.42, 1.0, pow(contrast, 0.72));
  } else if (uTransferMode == 2) {
    shape = mix(0.72, 1.0, pow(contrast, 0.45));
  }
  float alpha = clamp(uOpacity, 0.0, 1.0) * clamp(uDensity, 0.0, 2.0) * 0.045;
  return alpha * shape * rangeGate * maskValue;
}

void main() {
  vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
  vec2 hit = intersectBox(cameraPosition, rayDirection);
  if (hit.x > hit.y || hit.y < 0.0) discard;

  float t = max(hit.x, 0.0);
  float tEnd = hit.y;
  float sampleSteps = clamp(uSampleSteps, 24.0, 192.0);
  float stepSize = max((tEnd - t) / sampleSteps, 1.0);
  vec4 accum = vec4(0.0);

  for (int i = 0; i < 208; i += 1) {
    if (float(i) >= sampleSteps) break;
    if (t > tEnd || accum.a > 0.96) break;
    vec3 position = cameraPosition + rayDirection * t;
    if (!sceneSectionAllows(position) || !sceneSectionWindowAllows(position)) {
      t += stepSize;
      continue;
    }
    float focusAlpha = workingAreaFocusAlpha(position);
    if (focusAlpha <= 0.0001) {
      t += stepSize;
      continue;
    }
    vec3 uvw = (position - uBoundsMin) / (uBoundsMax - uBoundsMin);
    uvw = clamp(uvw, vec3(0.0), vec3(1.0));
    float maskValue = texture(uMask, uvw).r;
    if (uMaskVisible == 1 && maskValue <= 0.01) {
      t += stepSize;
      continue;
    }
    float normalized = texture(uVolume, uvw).r;
    float scalarValue = mix(uSourceMin, uSourceMax, normalized);
    float rampT = saturate((scalarValue - uDisplayMin) / max(0.000001, uDisplayMax - uDisplayMin));
    float alpha = transferAlpha(scalarValue, rampT, uMaskVisible == 1 ? maskValue : 1.0) * focusAlpha;
    if (alpha <= 0.0001) {
      t += stepSize;
      continue;
    }
    vec3 color = scalarRamp(scalarValue);
    accum.rgb += (1.0 - accum.a) * alpha * color;
    accum.a += (1.0 - accum.a) * alpha;
    t += stepSize;
  }

  if (accum.a <= 0.01) discard;
  fragColor = vec4(accum.rgb / max(accum.a, 0.0001), accum.a);
}
`;
}

function texture3d(
  bytes: Uint8Array<ArrayBuffer>,
  dimensions: Vec3,
  linear: boolean,
): THREE.Data3DTexture {
  const [nx, ny, nz] = dimensions;
  const texture = new THREE.Data3DTexture(bytes, nx, ny, nz);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  texture.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function transferModeCode(mode: string | undefined): number {
  if (mode === "soft") return 0;
  if (mode === "dense") return 2;
  return 1;
}

async function buildVolumeMesh(
  product: ScalarVolumeProduct,
  resolveAsset: (path: string) => string,
  manifest: ScalarVolumeManifest,
): Promise<THREE.Mesh> {
  const [nx, ny, nz] = product.dimensions;
  const expected = nx * ny * nz;
  const [volumeBytes, maskBytes] = await Promise.all([
    fetchBytes(resolveAsset(product.files.volume)),
    fetchBytes(resolveAsset(product.files.mask)),
  ]);
  if (volumeBytes.length < expected) {
    throw new Error(
      `${product.id} volume expected ${expected} bytes, received ${volumeBytes.length}`,
    );
  }
  if (maskBytes.length < expected) {
    throw new Error(
      `${product.id} mask expected ${expected} bytes, received ${maskBytes.length}`,
    );
  }

  const volumeData = volumeBytes.slice(0, expected);
  const maskData = maskBytes.slice(0, expected);
  const volumeTexture = texture3d(volumeData, product.dimensions, true);
  const maskTexture = texture3d(maskData, product.dimensions, false);
  const min = product.sceneBounds.min;
  const max = product.sceneBounds.max;
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
  const sourceMin =
    product.scalarRange.min ?? manifest.scalar?.sourceRange?.[0] ?? -2;
  const sourceMax =
    product.scalarRange.max ?? manifest.scalar?.sourceRange?.[1] ?? 4.5;
  const displayMin =
    product.displayRecipe?.scalarWindow?.[0] ??
    product.scalarRange.displayMin ??
    manifest.scalar?.displayRange?.[0] ??
    sourceMin;
  const displayMax =
    product.displayRecipe?.scalarWindow?.[1] ??
    product.scalarRange.displayMax ??
    manifest.scalar?.displayRange?.[1] ??
    sourceMax;
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: volumeVertexShader(),
    fragmentShader: volumeFragmentShader(),
    uniforms: {
      uVolume: { value: volumeTexture },
      uMask: { value: maskTexture },
      uBoundsMin: { value: new THREE.Vector3(min[0], min[1], min[2]) },
      uBoundsMax: { value: new THREE.Vector3(max[0], max[1], max[2]) },
      uSourceMin: { value: sourceMin },
      uSourceMax: { value: sourceMax },
      uDisplayMin: { value: displayMin },
      uDisplayMax: { value: displayMax },
      uThresholdMin: { value: sourceMin },
      uThresholdMax: { value: sourceMax },
      uColorLow: { value: new THREE.Color("#2cc9ff") },
      uColorMid: { value: new THREE.Color("#f8dd6d") },
      uColorHigh: { value: new THREE.Color("#ff637a") },
      uMidpoint: { value: 0.5 },
      uContrast: { value: 1.05 },
      uOpacity: { value: product.displayRecipe?.opacity ?? 0.42 },
      uDensity: { value: product.displayRecipe?.density ?? 0.65 },
      uSampleSteps: { value: product.displayRecipe?.sampleSteps ?? 96 },
      uTransferMode: { value: transferModeCode(product.displayRecipe?.transferMode) },
      uMaskVisible: { value: product.displayRecipe?.maskVisible === false ? 0 : 1 },
      uSceneSectionEnabled: { value: 0 },
      uSceneSectionMode: { value: 0 },
      uSceneSectionPlaneCount: { value: 0 },
      uSceneSectionNormals: {
        value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      },
      uSceneSectionPositions: { value: [0, 0, 0] },
      uSceneSectionThickness: { value: [1, 1, 1] },
      uSceneSectionInvert: { value: [0, 0, 0] },
      uSceneSectionWindowEnabled: { value: 0 },
      uSceneSectionWindowAxis: { value: 0 },
      uSceneSectionWindowMinAlong: { value: -250000 },
      uSceneSectionWindowMaxAlong: { value: 250000 },
      uSceneSectionWindowBottomZ: { value: -250000 },
      uSceneSectionFrameCount: { value: 0 },
      uSceneSectionFrameAxes: { value: [0, 1, 2] },
      uSceneSectionFrameBounds: {
        value: [
          new THREE.Vector4(-250000, 250000, -250000, 250000),
          new THREE.Vector4(-250000, 250000, -250000, 250000),
          new THREE.Vector4(-250000, 250000, -250000, 250000),
        ],
      },
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
  material.userData.scalarVolumeRaymarchMaterial = true;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(center);
  mesh.name = `${product.label} - raymarched scalar volume`;
  mesh.renderOrder = VOLUME_RENDER_ORDER;
  mesh.visible = false;
  mesh.userData = {
    displayName: mesh.name,
    scalarVolume: true,
    scalarVolumeProductId: product.id,
    scalarVolumeProductLabel: product.label,
    scalarVolumeClassification: product.classification,
    scalarVolumeData: volumeData,
    scalarVolumeMaskData: maskData,
    scalarVolumeUnit: product.unit ?? manifest.scalar?.unit ?? "log10 Ohm-m",
    scalarVolumeDomain: product.domain ?? manifest.scalar?.name ?? "log10 resistivity",
    scalarVolumeDimensions: product.dimensions,
    scalarVolumeBounds: product.sceneBounds,
    scalarVolumeSourceRange: [sourceMin, sourceMax],
    scalarVolumeDisplayRange: [displayMin, displayMax],
    scalarVolumeCaveats: product.caveats ?? manifest.caveats ?? [],
  };
  return mesh;
}

export async function loadScalarVolume(manifestUrl: string): Promise<THREE.Group> {
  const manifest = await fetchJson<ScalarVolumeManifest>(manifestUrl);
  if (manifest.schema !== "geosee.scalar-volume.v1" || !Array.isArray(manifest.products)) {
    throw new Error(`Invalid scalar volume manifest: ${manifestUrl}`);
  }
  const resolveAsset = assetResolver(manifestUrl);
  const group = new THREE.Group();
  group.name = manifest.label ?? "Scalar volume";
  group.userData = {
    displayName: manifest.label ?? "Scalar volume",
    scalarVolumeLayer: true,
    scalarVolumeManifest: manifest,
    scalarVolumeProducts: manifest.products.map((product) => ({
      id: product.id,
      label: product.label,
      dimensions: product.dimensions,
      sceneBounds: product.sceneBounds,
      displayRecipe: product.displayRecipe,
    })),
    scalarVolumeDefaultProductId:
      manifest.products.find((product) => product.id.includes("focused"))?.id ??
      manifest.products[0]?.id,
  };
  const meshes = await Promise.all(
    manifest.products.map((product) => buildVolumeMesh(product, resolveAsset, manifest)),
  );
  group.add(...meshes);
  return group;
}
