import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { EditableStyle } from "../pages/types";
import { debugLog } from "../utils/debugLog";

type TrackKind = "gamma" | "resistivity" | "lithology";
const RENDER_KINDS: readonly { kind: TrackKind }[] = [
  { kind: "gamma" },
  { kind: "resistivity" },
  { kind: "lithology" },
];

interface BoreholeLogTrajectoryPoint {
  mdFt: number;
  scene: [number, number, number];
}

interface BoreholeLogSample {
  mdFt: number;
  value: number;
}

interface BoreholeLogTrack {
  id: string;
  kind: "gamma" | "resistivity";
  mnemonic: string;
  unit: string;
  axisScale?: "linear" | "log10";
  renderStatus: string;
  samples: BoreholeLogSample[];
  source?: {
    submission?: string;
    file?: string;
    member?: string | null;
  };
}

interface BoreholeLogLithologyInterval {
  fromMdFt: number;
  toMdFt: number;
  lithology: string;
  renderStatus: string;
  source?: {
    submission?: string;
    file?: string;
    member?: string | null;
  };
}

interface BoreholeLogWell {
  id: string;
  label?: string;
  renderStatus: string;
  trajectory: {
    status: string;
    points?: BoreholeLogTrajectoryPoint[];
  };
  tracks?: BoreholeLogTrack[];
  lithologyIntervals?: BoreholeLogLithologyInterval[];
}

interface BoreholeLogManifest {
  schema: string;
  label: string;
  wells: BoreholeLogWell[];
}

const RENDER_ORDER = 8.4;
const DEFAULT_TRACK_OFFSET_M = 54;
const DEFAULT_TRACK_WIDTH_M = 120;
const DEFAULT_GAMMA_SCALE_API = 160;
const DEFAULT_RESISTIVITY_MIN = 1;
const DEFAULT_RESISTIVITY_MAX = 1000;
const DEFAULT_LITHOLOGY_LINE_WIDTH = 12;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTrackKind(value: unknown): value is TrackKind {
  return (
    typeof value === "string" &&
    RENDER_KINDS.some((candidate) => candidate.kind === value)
  );
}

function vectorFromScene(point: BoreholeLogTrajectoryPoint): THREE.Vector3 {
  const [x, y, z] = point.scene;
  return new THREE.Vector3(x, y, z);
}

function sortedTrajectory(points: BoreholeLogTrajectoryPoint[]): BoreholeLogTrajectoryPoint[] {
  return [...points]
    .filter(
      (point) =>
        finiteNumber(point.mdFt) &&
        Array.isArray(point.scene) &&
        point.scene.length >= 3 &&
        point.scene.every(finiteNumber),
    )
    .sort((a, b) => a.mdFt - b.mdFt);
}

export function interpolateTrajectoryByMdFt(
  points: BoreholeLogTrajectoryPoint[],
  mdFt: number,
): THREE.Vector3 | null {
  const ordered = sortedTrajectory(points);
  if (ordered.length === 0 || !Number.isFinite(mdFt)) return null;
  if (mdFt <= ordered[0].mdFt) return vectorFromScene(ordered[0]);
  const last = ordered[ordered.length - 1];
  if (mdFt >= last.mdFt) return vectorFromScene(last);
  for (let index = 1; index < ordered.length; index += 1) {
    const end = ordered[index];
    if (end.mdFt < mdFt) continue;
    const start = ordered[index - 1];
    const span = Math.max(0.0001, end.mdFt - start.mdFt);
    const t = (mdFt - start.mdFt) / span;
    return vectorFromScene(start).lerp(vectorFromScene(end), t);
  }
  return vectorFromScene(last);
}

function tangentAtMdFt(points: BoreholeLogTrajectoryPoint[], mdFt: number): THREE.Vector3 {
  const before = interpolateTrajectoryByMdFt(points, mdFt - 8);
  const after = interpolateTrajectoryByMdFt(points, mdFt + 8);
  if (!before || !after || before.distanceToSquared(after) < 0.0001) {
    return new THREE.Vector3(1, 0, 0);
  }
  return after.sub(before).normalize();
}

function lateralNormal(points: BoreholeLogTrajectoryPoint[], mdFt: number): THREE.Vector3 {
  const tangent = tangentAtMdFt(points, mdFt);
  const normal = new THREE.Vector3().crossVectors(Z_AXIS, tangent);
  if (normal.lengthSq() < 0.0001) return new THREE.Vector3(1, 0, 0);
  return normal.normalize();
}

function styleNumber(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): number {
  const raw = style[field];
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  return Math.max(min, Math.min(max, value));
}

function trackSelection(style: EditableStyle, kind: TrackKind): boolean {
  const selection = style.boreholeLogTrackSelection;
  if (!selection || typeof selection !== "object") return true;
  return selection[kind] !== false;
}

function activeWellVisible(style: EditableStyle, wellId: string): boolean {
  const active = style.boreholeLogActiveWell;
  return !active || active === "all" || active === wellId;
}

function depthWindow(style: EditableStyle): [number, number] {
  const min = styleNumber(style, "boreholeLogDepthMinFt", 0, 0, 30_000);
  const max = styleNumber(style, "boreholeLogDepthMaxFt", 30_000, 0, 30_000);
  return min <= max ? [min, max] : [max, min];
}

function sampleAmplitude(track: BoreholeLogTrack, value: number, style: EditableStyle): number {
  if (track.kind === "resistivity") {
    const min = styleNumber(
      style,
      "boreholeLogResistivityMinOhmM",
      DEFAULT_RESISTIVITY_MIN,
      0.01,
      100_000,
    );
    const max = styleNumber(
      style,
      "boreholeLogResistivityMaxOhmM",
      DEFAULT_RESISTIVITY_MAX,
      0.01,
      1_000_000,
    );
    const lower = Math.log10(Math.max(0.01, Math.min(min, max)));
    const upper = Math.log10(Math.max(0.01, Math.max(min, max)));
    const logValue = Math.log10(Math.max(0.01, value));
    return upper > lower ? (logValue - lower) / (upper - lower) : 0;
  }
  const scale = styleNumber(
    style,
    "boreholeLogGammaScaleApi",
    DEFAULT_GAMMA_SCALE_API,
    1,
    1000,
  );
  return value / scale;
}

function transformedPoint(
  base: THREE.Vector3,
  origin: THREE.Vector3,
  verticalExaggeration: number,
): THREE.Vector3 {
  const point = base.clone();
  point.z = origin.z + (point.z - origin.z) * verticalExaggeration;
  return point;
}

function trackPositions(
  trajectory: BoreholeLogTrajectoryPoint[],
  track: BoreholeLogTrack,
  style: EditableStyle,
): number[] {
  const positions: number[] = [];
  const [depthMin, depthMax] = depthWindow(style);
  const trackOffset = styleNumber(
    style,
    "boreholeLogTrackOffsetM",
    DEFAULT_TRACK_OFFSET_M,
    0,
    600,
  );
  const trackWidth = styleNumber(
    style,
    "boreholeLogTrackWidthM",
    DEFAULT_TRACK_WIDTH_M,
    1,
    800,
  );
  const cutoff = styleNumber(style, "boreholeLogCurveFillCutoff", 0, 0, 1);
  const verticalExaggeration = styleNumber(
    style,
    "boreholeLogVerticalExaggeration",
    1,
    0.25,
    8,
  );
  const origin = interpolateTrajectoryByMdFt(trajectory, trajectory[0]?.mdFt ?? 0);
  if (!origin) return positions;
  for (const sample of track.samples) {
    if (sample.mdFt < depthMin || sample.mdFt > depthMax) continue;
    const base = interpolateTrajectoryByMdFt(trajectory, sample.mdFt);
    if (!base) continue;
    const amplitude = Math.max(cutoff, Math.min(1.4, sampleAmplitude(track, sample.value, style)));
    const normal = lateralNormal(trajectory, sample.mdFt);
    const offsetBase = normal.multiplyScalar(trackOffset + amplitude * trackWidth);
    const point = transformedPoint(base.add(offsetBase), origin, verticalExaggeration);
    positions.push(point.x, point.y, point.z);
  }
  return positions;
}

function lithologyPositions(
  trajectory: BoreholeLogTrajectoryPoint[],
  interval: BoreholeLogLithologyInterval,
  style: EditableStyle,
): number[] {
  const [depthMin, depthMax] = depthWindow(style);
  const from = Math.max(interval.fromMdFt, depthMin);
  const to = Math.min(interval.toMdFt, depthMax);
  if (to <= from) return [];
  const start = interpolateTrajectoryByMdFt(trajectory, from);
  const end = interpolateTrajectoryByMdFt(trajectory, to);
  const origin = interpolateTrajectoryByMdFt(trajectory, trajectory[0]?.mdFt ?? 0);
  if (!start || !end || !origin) return [];
  const verticalExaggeration = styleNumber(
    style,
    "boreholeLogVerticalExaggeration",
    1,
    0.25,
    8,
  );
  const normal = lateralNormal(trajectory, (from + to) * 0.5).multiplyScalar(
    styleNumber(style, "boreholeLogTrackOffsetM", DEFAULT_TRACK_OFFSET_M, 0, 600) * -0.55,
  );
  const a = transformedPoint(start.add(normal), origin, verticalExaggeration);
  const b = transformedPoint(end.add(normal), origin, verticalExaggeration);
  return [a.x, a.y, a.z, b.x, b.y, b.z];
}

function trackColor(track: BoreholeLogTrack): string {
  return track.kind === "resistivity" ? "#4dd6ff" : "#ffe26d";
}

function lithologyColor(lithology: string): string {
  const value = lithology.toLowerCase();
  if (value.includes("granite") || value.includes("diorite") || value.includes("basement")) {
    return "#86d279";
  }
  if (value.includes("fill") || value.includes("sand") || value.includes("gravel") || value.includes("silt")) {
    return "#d8aa66";
  }
  return "#c9c3ad";
}

function makeLineMaterial(color: string, linewidth: number, opacity: number): LineMaterial {
  const material = new LineMaterial({
    color,
    linewidth,
    worldUnits: false,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
  });
  material.resolution.set(window.innerWidth || 1920, window.innerHeight || 1080);
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  return material;
}

function makeTrackLine(
  well: BoreholeLogWell,
  trajectory: BoreholeLogTrajectoryPoint[],
  track: BoreholeLogTrack,
): Line2 {
  const geometry = new LineGeometry();
  const material = makeLineMaterial(trackColor(track), 2.6, 0.92);
  const line = new Line2(geometry, material);
  line.name = `${well.id} ${track.mnemonic} borehole log`;
  line.renderOrder = RENDER_ORDER;
  line.userData = {
    utahForgeBoreholeLogTrack: true,
    boreholeLogWellId: well.id,
    boreholeLogTrackKind: track.kind,
    boreholeLogTrajectory: trajectory,
    boreholeLogTrack: track,
    displayName: `${well.id} ${track.mnemonic}`,
    sourceSubmission: track.source?.submission,
    sourceFile: track.source?.file,
    sourceMember: track.source?.member,
  };
  line.userData.utahForgeBoreholeLogTrack = true;
  updateUtahForgeBoreholeLogObject(line, {});
  return line;
}

function makeLithologyLine(
  well: BoreholeLogWell,
  trajectory: BoreholeLogTrajectoryPoint[],
  interval: BoreholeLogLithologyInterval,
): Line2 {
  const geometry = new LineGeometry();
  const material = makeLineMaterial(
    lithologyColor(interval.lithology),
    DEFAULT_LITHOLOGY_LINE_WIDTH,
    0.72,
  );
  const line = new Line2(geometry, material);
  line.name = `${well.id} ${interval.lithology} lithology interval`;
  line.renderOrder = RENDER_ORDER - 0.1;
  line.userData = {
    utahForgeBoreholeLogTrack: true,
    boreholeLogWellId: well.id,
    boreholeLogTrackKind: "lithology",
    boreholeLogTrajectory: trajectory,
    boreholeLogLithologyInterval: interval,
    displayName: `${well.id} ${interval.lithology}`,
    sourceSubmission: interval.source?.submission,
    sourceFile: interval.source?.file,
    sourceMember: interval.source?.member,
  };
  line.userData.utahForgeBoreholeLogTrack = true;
  updateUtahForgeBoreholeLogObject(line, {});
  return line;
}

export function updateUtahForgeBoreholeLogObject(
  obj: THREE.Object3D,
  style: EditableStyle,
): void {
  const rawKind = obj.userData.boreholeLogTrackKind;
  const kind = isTrackKind(rawKind) ? rawKind : undefined;
  const wellId = obj.userData.boreholeLogWellId;
  if (!kind || typeof wellId !== "string") return;
  const selected = trackSelection(style, kind) && activeWellVisible(style, wellId);
  const material = (obj as Line2).material as LineMaterial | undefined;
  const trajectory = obj.userData.boreholeLogTrajectory as
    | BoreholeLogTrajectoryPoint[]
    | undefined;
  if (!trajectory) return;
  let positions: number[] = [];
  if (kind === "lithology") {
    const interval = obj.userData.boreholeLogLithologyInterval as
      | BoreholeLogLithologyInterval
      | undefined;
    if (interval) positions = lithologyPositions(trajectory, interval, style);
    if (material) {
      material.opacity = styleNumber(style, "boreholeLogLithologyOpacity", 0.72, 0, 1);
      material.linewidth = styleNumber(
        style,
        "boreholeLogLithologyWidthPx",
        DEFAULT_LITHOLOGY_LINE_WIDTH,
        1,
        36,
      );
    }
  } else {
    const track = obj.userData.boreholeLogTrack as BoreholeLogTrack | undefined;
    if (track) positions = trackPositions(trajectory, track, style);
    if (material) {
      material.opacity = styleNumber(style, "boreholeLogCurveOpacity", 0.92, 0, 1);
      material.linewidth = styleNumber(style, "boreholeLogCurveLineWidthPx", 2.6, 0.5, 18);
    }
  }
  const line = obj as Line2;
  const geometry = line.geometry as LineGeometry;
  geometry.setPositions(positions);
  line.computeLineDistances();
  obj.visible = selected && positions.length >= 6;
  if (material) {
    material.transparent = true;
    material.needsUpdate = true;
  }
}

export function applyUtahForgeBoreholeLogStyleToGroup(
  group: THREE.Group,
  style: EditableStyle,
): void {
  group.traverse((obj) => {
    if (obj.userData?.utahForgeBoreholeLogTrack === true) {
      updateUtahForgeBoreholeLogObject(obj, style);
    }
  });
}

export async function loadUtahForgeBoreholeLogs(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const manifest = (await response.json()) as BoreholeLogManifest;
  const group = new THREE.Group();
  group.name = "utah-forge-borehole-logs";
  group.userData.displayName = manifest.label ?? "Utah FORGE Borehole Logs";
  group.userData.sourceManifest = url;

  for (const well of manifest.wells ?? []) {
    const trajectory = sortedTrajectory(well.trajectory?.points ?? []);
    if (well.trajectory?.status !== "available" || trajectory.length < 2) continue;
    const wellGroup = new THREE.Group();
    wellGroup.name = `${well.id} borehole logs`;
    wellGroup.userData.displayName = well.label ?? well.id;
    wellGroup.userData.boreholeLogWellId = well.id;
    for (const track of well.tracks ?? []) {
      if (track.renderStatus !== "renderable") continue;
      wellGroup.add(makeTrackLine(well, trajectory, track));
    }
    for (const interval of well.lithologyIntervals ?? []) {
      if (interval.renderStatus !== "renderable") continue;
      wellGroup.add(makeLithologyLine(well, trajectory, interval));
    }
    if (wellGroup.children.length > 0) group.add(wellGroup);
  }

  debugLog(`[loadUtahForgeBoreholeLogs] ${group.children.length} wells from ${url}`);
  return group;
}
