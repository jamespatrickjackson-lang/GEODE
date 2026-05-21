import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { getHeightSampler } from "../scene/heightSampler";
import {
  resolveGeoSceneTransform,
  utmToSceneWithTransform,
  type GeoSceneTransformOptions,
} from "./geoTransform";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996;
const UTM_ZONE = 12;
const UTM_CENTRAL_MERIDIAN_RAD =
  (((UTM_ZONE - 1) * 6 - 180 + 3) * Math.PI) / 180;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const DEFAULT_STEP_DEG = 0.5;
const DEFAULT_SAMPLES_PER_LINE = 192;
const DEFAULT_LABEL_SIZE_M = 9000;

interface TopoGraticuleOptions extends GeoSceneTransformOptions {
  clipCenterScene?: [number, number];
  clipSizeScene?: [number, number];
  clipRotationDeg?: number;
  latitudeStepDeg?: number;
  longitudeStepDeg?: number;
  samplesPerLine?: number;
}

interface LatLon {
  lat: number;
  lon: number;
}

interface UtmPoint {
  easting: number;
  northing: number;
}

interface LabelCandidate {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
}

interface TopoGraticuleSourceLine {
  kind: "lat" | "lon";
  value: number;
  label: string;
  preference: "west" | "north";
  candidates: LabelCandidate[];
}

interface SceneBounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function latLonToUtm(latDeg: number, lonDeg: number): UtmPoint {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = WGS84_EP2 * cosLat * cosLat;
  const a = cosLat * (lon - UTM_CENTRAL_MERIDIAN_RAD);
  const m =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256) *
      lat -
      ((3 * WGS84_E2) / 8 +
        (3 * WGS84_E2 ** 2) / 32 +
        (45 * WGS84_E2 ** 3) / 1024) *
        Math.sin(2 * lat) +
      ((15 * WGS84_E2 ** 2) / 256 + (45 * WGS84_E2 ** 3) / 1024) *
        Math.sin(4 * lat) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * lat));
  const easting =
    500000 +
    UTM_K0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * WGS84_EP2) * a ** 5) / 120);
  const northing =
    UTM_K0 *
    (m +
      n *
        tanLat *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * WGS84_EP2) * a ** 6) / 720));
  return { easting, northing };
}

function utmToLatLon(easting: number, northing: number): LatLon {
  const x = easting - 500000;
  const y = northing;
  const m = y / UTM_K0;
  const mu =
    m /
    (WGS84_A *
      (1 -
        WGS84_E2 / 4 -
        (3 * WGS84_E2 ** 2) / 64 -
        (5 * WGS84_E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = WGS84_EP2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinFp * sinFp);
  const r1 = (WGS84_A * (1 - WGS84_E2)) / (1 - WGS84_E2 * sinFp * sinFp) ** 1.5;
  const d = x / (n1 * UTM_K0);
  const lat =
    fp -
    ((n1 * tanFp) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * WGS84_EP2) * d ** 4) / 24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 * t1 -
          252 * WGS84_EP2 -
          3 * c1 * c1) *
          d ** 6) /
          720);
  const lon =
    UTM_CENTRAL_MERIDIAN_RAD +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * WGS84_EP2 + 24 * t1 * t1) *
        d ** 5) /
        120) /
      cosFp;
  return { lat: lat * RAD, lon: lon * RAD };
}

function formatLat(value: number): string {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? "N" : "S"}`;
}

function formatLon(value: number): string {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? "E" : "W"}`;
}

function makeTextPlane(
  label: string,
  sizeM: number,
  color: string,
): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const width = sizeM * Math.max(2.4, label.length * 0.62);
  const geometry = new THREE.PlaneGeometry(width, sizeM);
  const material = new THREE.MeshBasicMaterial({
    color,
    map: texture,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.toneMapped = false;
  material.userData.forceTransparent = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4562;
  mesh.userData.topoGraticuleLabel = true;
  mesh.userData.topoGraticuleLabelAspect = Math.max(
    2.4,
    label.length * 0.62,
  );
  mesh.userData.topoGraticuleLabelMaterial = material;
  return mesh;
}

function metadataOptions(
  metadata: Record<string, unknown>,
): TopoGraticuleOptions {
  const graticule =
    metadata.topoGraticule && typeof metadata.topoGraticule === "object"
      ? (metadata.topoGraticule as Record<string, unknown>)
      : {};
  const center = Array.isArray(graticule.clipCenterScene)
    ? graticule.clipCenterScene
    : [-1750, 0];
  const size = Array.isArray(graticule.clipSizeScene)
    ? graticule.clipSizeScene
    : [487600, 484100];
  return {
    clipCenterScene: [safeNumber(center[0], -1750), safeNumber(center[1], 0)],
    clipSizeScene: [safeNumber(size[0], 487600), safeNumber(size[1], 484100)],
    clipRotationDeg: safeNumber(graticule.clipRotationDeg, -20),
    latitudeStepDeg: safeNumber(graticule.latitudeStepDeg, DEFAULT_STEP_DEG),
    longitudeStepDeg: safeNumber(graticule.longitudeStepDeg, DEFAULT_STEP_DEG),
    samplesPerLine: Math.round(
      clamp(
        safeNumber(graticule.samplesPerLine, DEFAULT_SAMPLES_PER_LINE),
        32,
        512,
      ),
    ),
  };
}

function labelCandidatesForLine(points: THREE.Vector3[]): LabelCandidate[] {
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)] ?? point;
    const next = points[Math.min(points.length - 1, index + 1)] ?? point;
    const tangent = next.clone().sub(prev);
    tangent.z = 0;
    if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
    else tangent.normalize();
    return {
      position: point.clone(),
      tangent,
    };
  });
}

function terrainBoundsCorners(
  transform: ReturnType<typeof resolveGeoSceneTransform>,
): LatLon[] {
  const { min, max } = transform.bounds;
  return [
    { easting: min.easting, northing: min.northing },
    { easting: max.easting, northing: min.northing },
    { easting: max.easting, northing: max.northing },
    { easting: min.easting, northing: max.northing },
  ].map((point) => utmToLatLon(point.easting, point.northing));
}

function initialLabelCandidate(
  candidates: LabelCandidate[],
  preference: "west" | "north",
): LabelCandidate | null {
  let best: LabelCandidate | null = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score =
      preference === "west" ? -candidate.position.x : candidate.position.y;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function makeGraticuleLine(
  name: string,
  role: "interior" | "interior-dashed" | "leader" | "leader-dashed",
  color: string,
  opacity: number,
  lineWidth: number,
  dashed = false,
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions([]);
  const material = new LineMaterial({
    color,
    linewidth: lineWidth,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    dashed,
    dashSize: 18000,
    gapSize: 14000,
  });
  material.fog = false;
  material.userData.forceTransparent = true;
  material.userData.topoGraticuleLineMaterial = true;
  enableDistanceAttenuatedLineWidth(material);
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );

  const line = new LineSegments2(geometry, material);
  line.name = name;
  line.renderOrder =
    role === "interior" || role === "interior-dashed" ? 4560 : 4561;
  line.userData.topoGraticuleLines = true;
  line.userData.topoGraticuleLineRole = role;
  line.userData.topoGraticuleLineDashed = dashed;
  return line;
}

export async function loadTopoGraticule(
  metadata: Record<string, unknown>,
  transformOptions?: GeoSceneTransformOptions,
): Promise<THREE.Group> {
  const transform = resolveGeoSceneTransform(transformOptions);
  const sampleHeight = await getHeightSampler();
  const options = metadataOptions(metadata);
  const samples = options.samplesPerLine ?? DEFAULT_SAMPLES_PER_LINE;
  const labelSizeM = DEFAULT_LABEL_SIZE_M;
  const latStep = Math.max(0.05, options.latitudeStepDeg ?? DEFAULT_STEP_DEG);
  const lonStep = Math.max(0.05, options.longitudeStepDeg ?? DEFAULT_STEP_DEG);
  const corners = terrainBoundsCorners(transform);
  const domainMarginDeg = Math.max(1.5, Math.max(latStep, lonStep) * 3);
  const minLat =
    Math.min(...corners.map((corner) => corner.lat)) - domainMarginDeg;
  const maxLat =
    Math.max(...corners.map((corner) => corner.lat)) + domainMarginDeg;
  const minLon =
    Math.min(...corners.map((corner) => corner.lon)) - domainMarginDeg;
  const maxLon =
    Math.max(...corners.map((corner) => corner.lon)) + domainMarginDeg;
  const firstLat = Math.ceil(minLat / latStep) * latStep;
  const firstLon = Math.ceil(minLon / lonStep) * lonStep;

  const labels: THREE.Mesh[] = [];
  const sourceLines: TopoGraticuleSourceLine[] = [];
  const generatedBounds: SceneBounds2D = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const updateGeneratedBounds = (point: THREE.Vector3) => {
    generatedBounds.minX = Math.min(generatedBounds.minX, point.x);
    generatedBounds.minY = Math.min(generatedBounds.minY, point.y);
    generatedBounds.maxX = Math.max(generatedBounds.maxX, point.x);
    generatedBounds.maxY = Math.max(generatedBounds.maxY, point.y);
  };
  const pushScenePoint = (lat: number, lon: number): THREE.Vector3 => {
    const utm = latLonToUtm(lat, lon);
    const [x, y, z] = utmToSceneWithTransform(
      transform,
      utm.easting,
      utm.northing,
      sampleHeight(utm.easting, utm.northing),
    );
    return new THREE.Vector3(x, y, z);
  };
  const pushSegmentedLine = (
    fixed: number,
    minVar: number,
    maxVar: number,
    constantKind: "lat" | "lon",
  ): THREE.Vector3[] => {
    const linePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= samples; i += 1) {
      const variable = minVar + ((maxVar - minVar) * i) / samples;
      const point =
        constantKind === "lat"
          ? pushScenePoint(fixed, variable)
          : pushScenePoint(variable, fixed);
      linePoints.push(point);
      updateGeneratedBounds(point);
    }
    return linePoints;
  };
  const addLabel = (
    text: string,
    points: THREE.Vector3[],
    preference: "west" | "north",
    kind: "lat" | "lon",
    value: number,
  ) => {
    const candidates = labelCandidatesForLine(points);
    const best = initialLabelCandidate(candidates, preference);
    if (!best) return;
    const label = makeTextPlane(text, labelSizeM, "#f4f0e8");
    label.position.copy(best.position);
    label.rotation.set(0, 0, Math.atan2(best.tangent.y, best.tangent.x));
    label.userData.topoGraticuleBaseScale = label.scale.clone();
    label.userData.topoGraticuleLabelPreference = preference;
    label.userData.topoGraticuleLineKind = kind;
    label.userData.topoGraticuleLineValue = value;
    label.userData.topoGraticuleLabelCandidates = candidates;
    labels.push(label);
  };

  for (let lon = firstLon; lon <= maxLon + 0.00001; lon += lonStep) {
    const linePoints = pushSegmentedLine(lon, minLat, maxLat, "lon");
    const candidates = labelCandidatesForLine(linePoints);
    sourceLines.push({
      kind: "lon",
      value: lon,
      label: formatLon(lon),
      preference: "north",
      candidates,
    });
    addLabel(formatLon(lon), linePoints, "north", "lon", lon);
  }
  for (let lat = firstLat; lat <= maxLat + 0.00001; lat += latStep) {
    const linePoints = pushSegmentedLine(lat, minLon, maxLon, "lat");
    const candidates = labelCandidatesForLine(linePoints);
    sourceLines.push({
      kind: "lat",
      value: lat,
      label: formatLat(lat),
      preference: "west",
      candidates,
    });
    addLabel(formatLat(lat), linePoints, "west", "lat", lat);
  }

  const interiorLine = makeGraticuleLine(
    "Longitude / latitude interior graticule lines",
    "interior",
    "#d7d1c7",
    0.62,
    1.15,
  );
  interiorLine.userData.topoGraticuleGeneratedBounds = generatedBounds;
  const dashedInteriorLine = makeGraticuleLine(
    "Longitude / latitude half-degree interior graticule lines",
    "interior-dashed",
    "#d7d1c7",
    0.5,
    0.92,
    true,
  );
  dashedInteriorLine.userData.topoGraticuleGeneratedBounds = generatedBounds;
  const leaderLine = makeGraticuleLine(
    "Longitude / latitude edge leader lines",
    "leader",
    "#ffffff",
    0.88,
    1.25,
  );
  leaderLine.userData.topoGraticuleGeneratedBounds = generatedBounds;
  const dashedLeaderLine = makeGraticuleLine(
    "Longitude / latitude half-degree edge leader lines",
    "leader-dashed",
    "#ffffff",
    0.88,
    1.25,
    true,
  );
  dashedLeaderLine.userData.topoGraticuleGeneratedBounds = generatedBounds;

  const group = new THREE.Group();
  group.name = "Longitude / latitude grid";
  group.userData.displayName = "Longitude / latitude grid";
  group.userData.topoGraticule = true;
  group.userData.topoGraticuleGeneratedBounds = generatedBounds;
  group.userData.topoGraticuleSourceLines = sourceLines;
  group.userData.traceMaterial = interiorLine.material;
  group.add(
    interiorLine,
    dashedInteriorLine,
    leaderLine,
    dashedLeaderLine,
    ...labels,
  );
  return group;
}
