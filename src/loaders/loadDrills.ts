import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { utmToScene } from "../constants";
import { CU_ASSAY_BINS } from "./assayPalette";
import { debugLog } from "../utils/debugLog";

// 2023 drillhole campaign. Per content-brief chapter 2, this is the
// "established work" layer -- it should read as serious and intentional,
// not a tech demo line. Treatment:
//   - A thin white Line2 is the actual bore path.
//   - Assay intervals are true 3D cylindrical sleeves around that path, binned
//     like a section figure legend, but with a muted mineral finish so they
//     sit inside the cinematic terrain instead of reading as flat UI candy.
//   - Collars are small bronze survey markers -- findable, not glowing toys.

interface DrillFeature {
  type: "Feature";
  properties: { id: string; [k: string]: unknown };
  geometry: {
    type: "GeometryCollection";
    geometries: Array<
      | { type: "Point"; coordinates: [number, number, number] }
      | { type: "LineString"; coordinates: Array<[number, number, number]> }
    >;
  };
}

interface DrillCollection {
  type: "FeatureCollection";
  features: DrillFeature[];
}

type AssayColorMode = "cu" | "au" | "off";

interface AssayInterval {
  from: number;
  to: number;
  cu: number | null;
  au: number | null;
}

type DrillAssays = Record<string, AssayInterval[]>;

interface LithologyInterval {
  from: number;
  to: number;
  lithology: string;
  localCode: string | null;
  texture: string | null;
  comments: string | null;
}

type DrillLithologies = Record<string, LithologyInterval[]>;

interface TracePoint {
  depth: number;
  position: THREE.Vector3;
}

const ASSAY_COLOR_MODE: AssayColorMode = "cu";
const BORE_LINE_WIDTH_PX = 3.25;
const ASSAY_TRACE_WIDTH_PX = 8.45;
const LITHOLOGY_TRACE_WIDTH_PX = 8.0;
const TRACE_TUBE_RADIUS_PER_PIXEL_M = 2.25;
const BORE_TUBE_RADIUS_PER_PIXEL_M = 1.35;
const TRACE_TUBE_RADIAL_SEGMENTS = 64;
const TRACE_TUBE_HEIGHT_SEGMENTS = 4;
const ASSAY_CAP_RADIUS_SCALE = 0.98;
const ASSAY_CAP_THICKNESS_M = 1.6;
const BORE_TUBE_RENDER_ORDER = 5.4;
const ASSAY_SIDE_RENDER_ORDER = 6;
const ASSAY_CAP_RENDER_ORDER = 6;
const TUBE_AXIS = new THREE.Vector3(0, 1, 0);
const CAP_LENS_AXIS = new THREE.Vector3(0, 0, 1);

const CU_BINS = CU_ASSAY_BINS.map((bin) => ({
  ...bin,
  color: new THREE.Color(bin.color),
}));

const AU_BINS = [
  {
    id: "au-0-1-0-5",
    min: 0.1,
    max: 0.5,
    color: new THREE.Color("#fff36b"),
  },
  {
    id: "au-0-5-0-8",
    min: 0.5,
    max: 0.8,
    color: new THREE.Color("#ffbf2b"),
  },
  {
    id: "au-0-8-1-0",
    min: 0.8,
    max: 1.0,
    color: new THREE.Color("#ff6b18"),
  },
  {
    id: "au-over-1-0",
    min: 1.0,
    max: Infinity,
    color: new THREE.Color("#ff2f6d"),
  },
] as const;

interface AssayBinColor {
  id: string;
  color: THREE.Color;
}

const LITHOLOGY_COLORS: Record<string, string> = {
  OB: "#8f8a80",
  VANSS: "#5f7f68",
  VANAB: "#71905d",
  VANTB: "#587a6f",
  VDAV: "#6b8476",
  IMMOQ: "#c75f4c",
  IMMO: "#c75f4c",
  ICMOQ: "#a8566a",
  IFMOQ: "#d68b48",
  IPMOQ: "#dcac58",
  IFAN: "#b98757",
  IPAN: "#e0b56b",
  IPDA: "#bd8a46",
  IMDQ: "#b56a52",
  Fdyk: "#efe1ad",
  Mdyk: "#9a8c76",
  Idyk: "#c9bd98",
  BX: "#f06f36",
  UTB: "#6d6f87",
  UTG: "#516d8e",
  UT: "#6a7c8d",
  GDIO: "#4e6272",
  MB: "#463d3d",
  SSCO: "#aaa283",
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assayUrlFor(drillUrl: string): string {
  const bareUrl = drillUrl.split(/[?#]/, 1)[0];
  const slash = bareUrl.lastIndexOf("/");
  return `${bareUrl.slice(0, slash + 1)}drillhole_assays.json`;
}

function lithologyUrlFor(drillUrl: string): string {
  const bareUrl = drillUrl.split(/[?#]/, 1)[0];
  const slash = bareUrl.lastIndexOf("/");
  return `${bareUrl.slice(0, slash + 1)}drillhole_lithology.json`;
}

function normalizeAssays(raw: unknown): DrillAssays {
  if (!raw || typeof raw !== "object") return {};
  const assays: DrillAssays = {};
  for (const [holeId, intervals] of Object.entries(raw)) {
    if (!Array.isArray(intervals)) continue;
    const clean = intervals
      .map((interval) => {
        if (!interval || typeof interval !== "object") return null;
        const row = interval as Record<string, unknown>;
        if (!isFiniteNumber(row.from) || !isFiniteNumber(row.to)) return null;
        if (row.to <= row.from) return null;
        return {
          from: row.from,
          to: row.to,
          cu: isFiniteNumber(row.cu) ? row.cu : null,
          au: isFiniteNumber(row.au) ? row.au : null,
        } satisfies AssayInterval;
      })
      .filter((interval): interval is AssayInterval => interval !== null)
      .sort((a, b) => a.from - b.from || a.to - b.to);
    if (clean.length > 0) assays[holeId] = clean;
  }
  return assays;
}

function normalizeLithologies(raw: unknown): DrillLithologies {
  if (!raw || typeof raw !== "object") return {};
  const lithologies: DrillLithologies = {};
  for (const [holeId, intervals] of Object.entries(raw)) {
    if (!Array.isArray(intervals)) continue;
    const clean = intervals
      .map((interval) => {
        if (!interval || typeof interval !== "object") return null;
        const row = interval as Record<string, unknown>;
        if (!isFiniteNumber(row.from) || !isFiniteNumber(row.to)) return null;
        if (row.to <= row.from) return null;
        if (typeof row.lithology !== "string" || row.lithology.length === 0) {
          return null;
        }
        return {
          from: row.from,
          to: row.to,
          lithology: row.lithology,
          localCode:
            typeof row.localCode === "string" && row.localCode.length > 0
              ? row.localCode
              : null,
          texture:
            typeof row.texture === "string" && row.texture.length > 0
              ? row.texture
              : null,
          comments:
            typeof row.comments === "string" && row.comments.length > 0
              ? row.comments
              : null,
        } satisfies LithologyInterval;
      })
      .filter((interval): interval is LithologyInterval => interval !== null)
      .sort((a, b) => a.from - b.from || a.to - b.to);
    if (clean.length > 0) lithologies[holeId] = clean;
  }
  return lithologies;
}

async function loadAssays(url: string): Promise<DrillAssays> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return normalizeAssays(await parseJsonWithExportedNaN(res));
  } catch (error) {
    console.warn(`[loadDrills] assay load skipped (${url}):`, error);
    return {};
  }
}

async function loadLithologies(url: string): Promise<DrillLithologies> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return normalizeLithologies(await parseJsonWithExportedNaN(res));
  } catch (error) {
    console.warn(`[loadDrills] lithology load skipped (${url}):`, error);
    return {};
  }
}

async function parseJsonWithExportedNaN(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!text.includes("NaN")) throw error;
    return JSON.parse(
      text.replace(/(^|[\[,:])\s*NaN(?=\s*[,}\]])/g, "$1 null"),
    );
  }
}

function binColorForInterval(interval: AssayInterval): AssayBinColor | null {
  if (ASSAY_COLOR_MODE === "off") return null;
  const value = ASSAY_COLOR_MODE === "au" ? interval.au : interval.cu;
  if (!isFiniteNumber(value)) return null;
  const bins = ASSAY_COLOR_MODE === "au" ? AU_BINS : CU_BINS;
  const bin = bins.find((entry) => value >= entry.min && value < entry.max);
  if (!bin) return null;
  return { id: bin.id, color: bin.color.clone() };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function colorForLithology(interval: LithologyInterval): THREE.Color {
  const mapped = LITHOLOGY_COLORS[interval.lithology];
  if (mapped) return new THREE.Color(mapped);
  const hue = (hashString(interval.lithology) % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.38, 0.56);
}

function buildTracePoints(
  coordinates: Array<[number, number, number]>,
): TracePoint[] {
  let depth = 0;
  let previous: THREE.Vector3 | null = null;
  return coordinates.map(([e, n, z]) => {
    const [sx, sy, sz] = utmToScene(e, n, z);
    const position = new THREE.Vector3(sx, sy, sz);
    if (previous) depth += previous.distanceTo(position);
    previous = position;
    return { depth, position };
  });
}

function pointAtDepth(trace: TracePoint[], depth: number): THREE.Vector3 {
  if (trace.length === 0) return new THREE.Vector3();
  if (depth <= trace[0].depth) return trace[0].position.clone();
  const last = trace[trace.length - 1];
  if (depth >= last.depth) return last.position.clone();
  for (let i = 1; i < trace.length; i += 1) {
    const prev = trace[i - 1];
    const next = trace[i];
    if (depth <= next.depth) {
      const span = next.depth - prev.depth;
      const t = span > 0 ? (depth - prev.depth) / span : 0;
      return prev.position.clone().lerp(next.position, clamp01(t));
    }
  }
  return last.position.clone();
}

function pushUniqueDepth(depths: number[], depth: number): void {
  if (
    depths.length === 0 ||
    Math.abs(depths[depths.length - 1] - depth) > 1e-3
  ) {
    depths.push(depth);
  }
}

function intervalDepths(
  trace: TracePoint[],
  interval: { from: number; to: number },
): number[] {
  const totalDepth = trace[trace.length - 1]?.depth ?? 0;
  const from = Math.min(totalDepth, Math.max(0, interval.from));
  const to = Math.min(totalDepth, Math.max(0, interval.to));
  if (to <= from) return [];
  const depths: number[] = [];
  pushUniqueDepth(depths, from);
  for (const point of trace) {
    if (point.depth > from && point.depth < to) {
      pushUniqueDepth(depths, point.depth);
    }
  }
  pushUniqueDepth(depths, to);
  return depths;
}

function buildBoreGeometry(
  coordinates: Array<[number, number, number]>,
): LineGeometry {
  const positions: number[] = [];
  for (const [e, n, z] of coordinates) {
    const [sx, sy, sz] = utmToScene(e, n, z);
    positions.push(sx, sy, sz);
  }
  const lineGeom = new LineGeometry();
  lineGeom.setPositions(positions);
  return lineGeom;
}

function makeBoreLensTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("loadDrills: failed to create bore lens texture");
  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.45,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  g.addColorStop(0, "rgba(255,250,226,0.38)");
  g.addColorStop(0.34, "rgba(225,215,186,0.22)");
  g.addColorStop(0.74, "rgba(112,103,85,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function addMineralFinish(
  material: THREE.MeshStandardMaterial,
  surface: "side" | "cap",
): void {
  const desaturate = surface === "cap" ? "0.04" : "0.10";
  const endShade = surface === "cap" ? "0.90" : "0.82";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vDrillLocalPosition;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vDrillLocalPosition = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vDrillLocalPosition;
float drillHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float drillAxial = clamp(vDrillLocalPosition.y + 0.5, 0.0, 1.0);
float drillEndSoftness =
  smoothstep(0.0, 0.24, drillAxial) *
  smoothstep(0.0, 0.24, 1.0 - drillAxial);
float drillAngle = atan(vDrillLocalPosition.z, vDrillLocalPosition.x);
float drillStriation =
  0.5 + 0.5 * sin(drillAngle * 8.0 + drillAxial * 21.0);
float drillGrain = drillHash(vec2(drillAngle * 0.7, drillAxial * 18.0));
float drillMineral = mix(0.92, 1.07, drillStriation * 0.65 + drillGrain * 0.35);
diffuseColor.rgb *= mix(${endShade}, drillMineral, drillEndSoftness);
float drillLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(drillLuma), ${desaturate});`,
      );
  };
  material.customProgramCacheKey = () => `drill-mineral-finish-${surface}`;
}

function buildBoreTubeMeshes(
  coordinates: Array<[number, number, number]>,
  geometry: THREE.CylinderGeometry,
  material: THREE.MeshStandardMaterial,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (let i = 1; i < coordinates.length; i += 1) {
    const prev = coordinates[i - 1];
    const next = coordinates[i];
    const [sx0, sy0, sz0] = utmToScene(prev[0], prev[1], prev[2]);
    const [sx1, sy1, sz1] = utmToScene(next[0], next[1], next[2]);
    const start = new THREE.Vector3(sx0, sy0, sz0);
    const end = new THREE.Vector3(sx1, sy1, sz1);
    const axis = end.clone().sub(start);
    const length = axis.length();
    if (length < 0.01) continue;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(TUBE_AXIS, axis.normalize());
    mesh.scale.set(
      BORE_LINE_WIDTH_PX * BORE_TUBE_RADIUS_PER_PIXEL_M,
      length,
      BORE_LINE_WIDTH_PX * BORE_TUBE_RADIUS_PER_PIXEL_M,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = BORE_TUBE_RENDER_ORDER;
    mesh.userData = {
      kind: "bore-tube-2023",
      drillTraceRole: "bore",
      drillBoreTube: true,
      segmentLength: length,
      radiusPerPixel: BORE_TUBE_RADIUS_PER_PIXEL_M,
      defaultRenderOrder: BORE_TUBE_RENDER_ORDER,
    };
    meshes.push(mesh);
  }
  return meshes;
}

function tubeMaterialFor(
  cache: Map<string, THREE.MeshStandardMaterial>,
  bin: AssayBinColor,
  surface: "side" | "cap",
): THREE.MeshStandardMaterial {
  const key = `assay:${surface}:${bin.id}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const material = new THREE.MeshStandardMaterial({
    color: bin.color,
    roughness: surface === "cap" ? 0.58 : 0.38,
    metalness: 0.08,
    emissive: bin.color,
    emissiveIntensity: surface === "cap" ? 0.008 : 0.012,
    // Full-opacity transparent queue: draw after transparent topo/tree
    // details so assay cylinders read as solid assay data, not glass.
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
    fog: true,
  });
  addMineralFinish(material, surface);
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  material.userData.preserveMaterialOpacity = true;
  material.userData.drillAssayRole = "assay";
  material.userData.drillAssaySurface = surface;
  material.userData.assayColorStopId = bin.id;
  cache.set(key, material);
  return material;
}

function makeTubeSegment(
  geometry: THREE.CylinderGeometry,
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.MeshStandardMaterial,
): THREE.Mesh | null {
  const axis = end.clone().sub(start);
  const length = axis.length();
  if (length < 0.01) return null;
  const radius = ASSAY_TRACE_WIDTH_PX * TRACE_TUBE_RADIUS_PER_PIXEL_M;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(TUBE_AXIS, axis.normalize());
  mesh.scale.set(radius, length, radius);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = ASSAY_SIDE_RENDER_ORDER;
  mesh.userData = {
    kind: "assay-tube-2023",
    drillTraceRole: "assay",
    drillTubeSegment: true,
    segmentLength: length,
    radiusPerPixel: TRACE_TUBE_RADIUS_PER_PIXEL_M,
    radiusMultiplier: 1,
    defaultRenderOrder: ASSAY_SIDE_RENDER_ORDER,
  };
  return mesh;
}

function makeTubeCap(
  geometry: THREE.CylinderGeometry,
  center: THREE.Vector3,
  tangent: THREE.Vector3,
  material: THREE.MeshStandardMaterial,
): THREE.Mesh | null {
  const axis = tangent.clone();
  if (axis.lengthSq() < 1e-6) return null;
  const radius = ASSAY_TRACE_WIDTH_PX *
    TRACE_TUBE_RADIUS_PER_PIXEL_M *
    ASSAY_CAP_RADIUS_SCALE;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(TUBE_AXIS, axis.normalize());
  mesh.scale.set(radius, ASSAY_CAP_THICKNESS_M, radius);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = ASSAY_CAP_RENDER_ORDER;
  mesh.userData = {
    kind: "assay-cap-2023",
    drillTraceRole: "assay",
    drillTubeCap: true,
    segmentLength: ASSAY_CAP_THICKNESS_M,
    radiusPerPixel: TRACE_TUBE_RADIUS_PER_PIXEL_M,
    radiusMultiplier: ASSAY_CAP_RADIUS_SCALE,
    defaultRenderOrder: ASSAY_CAP_RENDER_ORDER,
  };
  return mesh;
}

function makeBoreCapLens(
  geometry: THREE.CircleGeometry,
  center: THREE.Vector3,
  tangent: THREE.Vector3,
  faceSign: 1 | -1,
  material: THREE.MeshBasicMaterial,
): THREE.Mesh | null {
  const axis = tangent.clone();
  if (axis.lengthSq() < 1e-6) return null;
  axis.normalize().multiplyScalar(faceSign);
  const radius = BORE_LINE_WIDTH_PX * BORE_TUBE_RADIUS_PER_PIXEL_M * 1.32;
  const offset = ASSAY_CAP_THICKNESS_M * 0.52 + 0.05;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(center).addScaledVector(axis, offset);
  mesh.quaternion.setFromUnitVectors(CAP_LENS_AXIS, axis);
  mesh.scale.set(radius, radius, 1);
  mesh.renderOrder = ASSAY_CAP_RENDER_ORDER + 0.25;
  mesh.userData = {
    kind: "bore-cap-lens-2023",
    drillTraceRole: "bore",
    drillBoreLens: true,
    capCenter: center.toArray(),
    capAxis: axis.toArray(),
    radiusPerPixel: BORE_TUBE_RADIUS_PER_PIXEL_M * 1.32,
    defaultRenderOrder: ASSAY_CAP_RENDER_ORDER + 0.25,
  };
  return mesh;
}

function buildAssaySegmentMeshes(
  coordinates: Array<[number, number, number]>,
  intervals: AssayInterval[],
  sideGeometry: THREE.CylinderGeometry,
  capGeometry: THREE.CylinderGeometry,
  lensGeometry: THREE.CircleGeometry,
  materialCache: Map<string, THREE.MeshStandardMaterial>,
  boreLensMaterial: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  if (ASSAY_COLOR_MODE === "off" || intervals.length === 0) return [];
  const trace = buildTracePoints(coordinates);
  if (trace.length < 2) return [];
  const meshes: THREE.Mesh[] = [];
  for (const interval of intervals) {
    const bin = binColorForInterval(interval);
    if (!bin) continue;
    const sideMaterial = tubeMaterialFor(materialCache, bin, "side");
    const capMaterial = tubeMaterialFor(materialCache, bin, "cap");
    const depths = intervalDepths(trace, interval);
    for (let i = 1; i < depths.length; i += 1) {
      const start = pointAtDepth(trace, depths[i - 1]);
      const end = pointAtDepth(trace, depths[i]);
      const tangent = end.clone().sub(start);
      if (i === 1) {
        const cap = makeTubeCap(capGeometry, start, tangent, capMaterial);
        if (cap) meshes.push(cap);
        const lensFront = makeBoreCapLens(
          lensGeometry,
          start,
          tangent,
          1,
          boreLensMaterial,
        );
        const lensBack = makeBoreCapLens(
          lensGeometry,
          start,
          tangent,
          -1,
          boreLensMaterial,
        );
        if (lensFront) meshes.push(lensFront);
        if (lensBack) meshes.push(lensBack);
      }
      const mesh = makeTubeSegment(sideGeometry, start, end, sideMaterial);
      if (mesh) meshes.push(mesh);
      if (i === depths.length - 1) {
        const cap = makeTubeCap(capGeometry, end, tangent, capMaterial);
        if (cap) meshes.push(cap);
        const lensFront = makeBoreCapLens(
          lensGeometry,
          end,
          tangent,
          1,
          boreLensMaterial,
        );
        const lensBack = makeBoreCapLens(
          lensGeometry,
          end,
          tangent,
          -1,
          boreLensMaterial,
        );
        if (lensFront) meshes.push(lensFront);
        if (lensBack) meshes.push(lensBack);
      }
    }
  }
  return meshes;
}

function buildLithologySegmentGeometry(
  coordinates: Array<[number, number, number]>,
  intervals: LithologyInterval[],
): LineSegmentsGeometry | null {
  const trace = buildTracePoints(coordinates);
  if (trace.length < 2 || intervals.length === 0) return null;
  const positions: number[] = [];
  const colors: number[] = [];
  for (const interval of intervals) {
    const color = colorForLithology(interval);
    const depths = intervalDepths(trace, interval);
    for (let i = 1; i < depths.length; i += 1) {
      const start = pointAtDepth(trace, depths[i - 1]);
      const end = pointAtDepth(trace, depths[i]);
      positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }
  if (positions.length === 0) return null;
  const lineGeom = new LineSegmentsGeometry();
  lineGeom.setPositions(positions);
  lineGeom.setColors(colors);
  return lineGeom;
}

export async function loadDrills(url: string): Promise<THREE.Group> {
  const [res, assays, lithologies] = await Promise.all([
    fetch(url),
    loadAssays(assayUrlFor(url)),
    loadLithologies(lithologyUrlFor(url)),
  ]);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = (await res.json()) as DrillCollection;

  const group = new THREE.Group();
  group.name = "drillholes-2023";

  // Line2 needs the rendering resolution kept in sync. Stash the material
  // so SceneManager can update it on resize.
  // Subsurface trace treatment: traces descend beneath the terrain mesh.
  // Keep depth testing off so bore and assay intervals remain visible in
  // the normal postprocessing render path.
  const boreMaterial = new LineMaterial({
    color: 0xe7dcc4,
    linewidth: BORE_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.72,
    dashed: false,
    alphaToCoverage: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  boreMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  (boreMaterial as unknown as THREE.Material).toneMapped = true;
  boreMaterial.userData.preserveMaterialColor = true;
  boreMaterial.userData.drillAssayRole = "bore";

  const boreTubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8ccb2,
    roughness: 0.5,
    metalness: 0.12,
    emissive: 0x8d826f,
    emissiveIntensity: 0.008,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
    fog: true,
  });
  boreTubeMaterial.userData.forceTransparent = true;
  boreTubeMaterial.userData.preserveMaterialColor = true;
  boreTubeMaterial.userData.preserveMaterialOpacity = true;
  boreTubeMaterial.userData.drillAssayRole = "bore";
  boreTubeMaterial.userData.drillAssaySurface = "bore-side";

  const boreLensMaterial = new THREE.MeshBasicMaterial({
    map: makeBoreLensTexture(),
    color: 0xe9dec4,
    transparent: true,
    opacity: 0.18,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: true,
    fog: true,
  });
  boreLensMaterial.userData.preserveMaterialColor = true;
  boreLensMaterial.userData.preserveMaterialOpacity = true;

  const lithologyMaterial = new LineMaterial({
    color: 0xffffff,
    linewidth: LITHOLOGY_TRACE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: 0.56,
    dashed: false,
    alphaToCoverage: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexColors: true,
  });
  lithologyMaterial.vertexColors = true;
  lithologyMaterial.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  (lithologyMaterial as unknown as THREE.Material).toneMapped = true;
  lithologyMaterial.userData.preserveVertexColors = true;
  lithologyMaterial.userData.preserveMaterialColor = true;
  lithologyMaterial.userData.drillAssayRole = "lithology";

  group.userData.traceMaterial = boreMaterial;
  group.userData.boreMaterial = boreMaterial;
  group.userData.boreTubeMaterial = boreTubeMaterial;
  group.userData.lithologyMaterial = lithologyMaterial;

  const boreTubeGeometry = new THREE.CylinderGeometry(
    1,
    1,
    1,
    32,
    3,
    true,
  );
  boreTubeGeometry.computeVertexNormals();
  const assayTubeGeometry = new THREE.CylinderGeometry(
    1,
    1,
    1,
    TRACE_TUBE_RADIAL_SEGMENTS,
    TRACE_TUBE_HEIGHT_SEGMENTS,
    true,
  );
  assayTubeGeometry.computeVertexNormals();
  const assayCapGeometry = new THREE.CylinderGeometry(
    1,
    1,
    1,
    TRACE_TUBE_RADIAL_SEGMENTS,
    1,
    false,
  );
  assayCapGeometry.computeVertexNormals();
  const boreLensGeometry = new THREE.CircleGeometry(1, 48);
  const assayTubeMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const collarGeometry = new THREE.SphereGeometry(12, 24, 16);
  const collarMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a66b,
    emissive: 0x6e5935,
    emissiveIntensity: 0.018,
    roughness: 0.48,
    metalness: 0.18,
    toneMapped: true,
    fog: true,
  });
  collarMaterial.userData.preserveMaterialColor = true;

  let assayedHoleCount = 0;
  let assayedIntervalCount = 0;
  let visibleAssayTraceCount = 0;
  let lithologyHoleCount = 0;
  let lithologyIntervalCount = 0;
  let visibleLithologyTraceCount = 0;

  for (const feat of data.features) {
    const holeAssays = assays[feat.properties.id] ?? [];
    const holeLithologies = lithologies[feat.properties.id] ?? [];
    if (holeAssays.length > 0) {
      assayedHoleCount += 1;
      assayedIntervalCount += holeAssays.length;
    }
    if (holeLithologies.length > 0) {
      lithologyHoleCount += 1;
      lithologyIntervalCount += holeLithologies.length;
    }
    for (const geom of feat.geometry.geometries) {
      if (geom.type === "Point") {
        const [e, n, z] = geom.coordinates;
        const [sx, sy, sz] = utmToScene(e, n, z);
        const collar = new THREE.Mesh(collarGeometry, collarMaterial);
        collar.position.set(sx, sy, sz);
        // Match traces (renderOrder 5) so collars remain visible above
        // any scene-overlay texture (renderOrder 2) at the same XY.
        collar.renderOrder = 5;
        collar.userData = {
          holeId: feat.properties.id,
          kind: "collar-2023",
          displayName: feat.properties.id,
        };
        group.add(collar);
      } else if (geom.type === "LineString") {
        const lithologyGeom = buildLithologySegmentGeometry(
          geom.coordinates,
          holeLithologies,
        );
        if (lithologyGeom) {
          const lithologyLine = new LineSegments2(
            lithologyGeom,
            lithologyMaterial,
          );
          lithologyLine.computeLineDistances();
          lithologyLine.renderOrder = 4;
          lithologyLine.visible = false;
          lithologyLine.userData = {
            holeId: feat.properties.id,
            kind: "lithology-trace-2023",
            drillTraceRole: "lithology",
            displayName: feat.properties.id,
          };
          group.add(lithologyLine);
          visibleLithologyTraceCount += 1;
        }

        const assayMeshes = buildAssaySegmentMeshes(
          geom.coordinates,
          holeAssays,
          assayTubeGeometry,
          assayCapGeometry,
          boreLensGeometry,
          assayTubeMaterials,
          boreLensMaterial,
        );
        for (const assayMesh of assayMeshes) {
          assayMesh.userData.holeId = feat.properties.id;
          assayMesh.userData.displayName = feat.properties.id;
          group.add(assayMesh);
        }
        visibleAssayTraceCount += assayMeshes.length;

        const boreTubeMeshes = buildBoreTubeMeshes(
          geom.coordinates,
          boreTubeGeometry,
          boreTubeMaterial,
        );
        for (const boreTube of boreTubeMeshes) {
          boreTube.userData.holeId = feat.properties.id;
          boreTube.userData.displayName = feat.properties.id;
          group.add(boreTube);
        }

        const boreGeom = buildBoreGeometry(geom.coordinates);
        const boreLine = new Line2(boreGeom, boreMaterial);
        boreLine.computeLineDistances();
        boreLine.renderOrder = 6.8;
        boreLine.userData = {
          holeId: feat.properties.id,
          kind: "trace-2023",
          drillTraceRole: "bore",
          displayName: feat.properties.id,
        };
        group.add(boreLine);
      }
    }
  }

  debugLog(
    `[loadDrills] ${data.features.length} holes -> ${group.children.length} objects (${assayedHoleCount} assayed holes, ${assayedIntervalCount} assay intervals, ${visibleAssayTraceCount} assay meshes, ${lithologyHoleCount} lithology holes, ${lithologyIntervalCount} lithology intervals, ${visibleLithologyTraceCount} lithology traces, mode=${ASSAY_COLOR_MODE})`,
  );
  return group;
}
