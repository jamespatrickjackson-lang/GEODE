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
const DEFAULT_TRACK_OFFSET_M = 24;
const DEFAULT_TRACK_WIDTH_M = 36;
const DEFAULT_GAMMA_SCALE_API = 150;
const DEFAULT_RESISTIVITY_MIN = 1;
const DEFAULT_RESISTIVITY_MAX = 1000;
const DEFAULT_LITHOLOGY_LINE_WIDTH = 12;
const DEFAULT_HCGR_COLOR = "#ffe26d";
const DEFAULT_HSGR_COLOR = "#ff9f43";
const DEFAULT_RESISTIVITY_COLOR = "#4dd6ff";
const DEFAULT_BASELINE_COLOR = "#eef7f2";
const TRACK_LANE_GAP_M = 18;

export interface BoreholeLogLaneFrame {
  laneAxis: THREE.Vector3;
  trajectoryAxis: THREE.Vector3;
}

export interface BoreholeLogRibbonGeometry {
  baseline: THREE.Vector3[];
  curve: THREE.Vector3[];
  positions: number[];
  baselinePositions: number[];
  curvePositions: number[];
  indices: number[];
  laneAxis: THREE.Vector3;
  laneBaseOffsetM: number;
}

export interface BoreholeLogColumnGeometry {
  start: THREE.Vector3;
  end: THREE.Vector3;
  positions: number[];
}

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

function styleString(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: string,
): string {
  const raw = style[field];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : fallback;
}

function trackSelection(style: EditableStyle, kind: TrackKind): boolean {
  const selection = style.boreholeLogTrackSelection;
  if (!selection || typeof selection !== "object") return true;
  return selection[kind] !== false;
}

function boreholeLogMnemonicVisible(
  style: EditableStyle,
  track: BoreholeLogTrack,
): boolean {
  if (track.kind !== "gamma") return true;
  const selection = style.boreholeLogTrackSelection;
  if (!selection || typeof selection !== "object") return true;
  if (selection.gamma === false) return false;
  const mnemonic = track.mnemonic.toUpperCase();
  if (mnemonic.includes("HCGR")) return selection.hcgr !== false;
  if (mnemonic.includes("HSGR")) return selection.hsgr !== false;
  return true;
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

export function computeBoreholeLogLaneFrame(
  trajectory: BoreholeLogTrajectoryPoint[],
): BoreholeLogLaneFrame {
  const ordered = sortedTrajectory(trajectory);
  let trend = new THREE.Vector3();
  if (ordered.length >= 2) {
    trend = vectorFromScene(ordered[ordered.length - 1]).sub(vectorFromScene(ordered[0]));
    trend.z = 0;
  }
  if (trend.lengthSq() < 0.0001) {
    let best = new THREE.Vector3();
    let bestLengthSq = 0;
    for (let index = 1; index < ordered.length; index += 1) {
      const segment = vectorFromScene(ordered[index]).sub(vectorFromScene(ordered[index - 1]));
      segment.z = 0;
      const lengthSq = segment.lengthSq();
      if (lengthSq > bestLengthSq) {
        best = segment;
        bestLengthSq = lengthSq;
      }
    }
    trend = best;
  }
  if (trend.lengthSq() < 0.0001) {
    return {
      laneAxis: new THREE.Vector3(1, 0, 0),
      trajectoryAxis: new THREE.Vector3(0, 1, 0),
    };
  }
  const trajectoryAxis = trend.normalize();
  const laneAxis = new THREE.Vector3(-trajectoryAxis.y, trajectoryAxis.x, 0);
  if (laneAxis.x < -1e-9 || (Math.abs(laneAxis.x) <= 1e-9 && laneAxis.y < 0)) {
    laneAxis.negate();
  }
  return {
    laneAxis: laneAxis.normalize(),
    trajectoryAxis,
  };
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

function trackLaneBaseOffset(style: EditableStyle, trackIndex: number): number {
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
  return trackOffset + Math.max(0, trackIndex) * (trackWidth + TRACK_LANE_GAP_M);
}

export function buildTrackRibbonGeometry(
  trajectory: BoreholeLogTrajectoryPoint[],
  track: BoreholeLogTrack,
  style: EditableStyle,
  trackIndex = 0,
  laneFrame = computeBoreholeLogLaneFrame(trajectory),
): BoreholeLogRibbonGeometry {
  const baseline: THREE.Vector3[] = [];
  const curve: THREE.Vector3[] = [];
  const positions: number[] = [];
  const baselinePositions: number[] = [];
  const curvePositions: number[] = [];
  const indices: number[] = [];
  const [depthMin, depthMax] = depthWindow(style);
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
  const laneBaseOffsetM = trackLaneBaseOffset(style, trackIndex);
  const origin = interpolateTrajectoryByMdFt(trajectory, trajectory[0]?.mdFt ?? 0);
  if (!origin) {
    return {
      baseline,
      curve,
      positions,
      baselinePositions,
      curvePositions,
      indices,
      laneAxis: laneFrame.laneAxis.clone(),
      laneBaseOffsetM,
    };
  }
  for (const sample of track.samples) {
    if (sample.mdFt < depthMin || sample.mdFt > depthMax) continue;
    const base = interpolateTrajectoryByMdFt(trajectory, sample.mdFt);
    if (!base) continue;
    const amplitude = Math.max(cutoff, Math.min(1, sampleAmplitude(track, sample.value, style)));
    const laneBasePoint = transformedPoint(
      base.clone().add(laneFrame.laneAxis.clone().multiplyScalar(laneBaseOffsetM)),
      origin,
      verticalExaggeration,
    );
    const curvePoint = transformedPoint(
      base.clone().add(laneFrame.laneAxis.clone().multiplyScalar(laneBaseOffsetM + amplitude * trackWidth)),
      origin,
      verticalExaggeration,
    );
    baseline.push(laneBasePoint);
    curve.push(curvePoint);
    positions.push(laneBasePoint.x, laneBasePoint.y, laneBasePoint.z, curvePoint.x, curvePoint.y, curvePoint.z);
    baselinePositions.push(laneBasePoint.x, laneBasePoint.y, laneBasePoint.z);
    curvePositions.push(curvePoint.x, curvePoint.y, curvePoint.z);
  }
  for (let index = 0; index < baseline.length - 1; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  return {
    baseline,
    curve,
    positions,
    baselinePositions,
    curvePositions,
    indices,
    laneAxis: laneFrame.laneAxis.clone(),
    laneBaseOffsetM,
  };
}

export function buildLithologyColumnGeometry(
  trajectory: BoreholeLogTrajectoryPoint[],
  interval: BoreholeLogLithologyInterval,
  style: EditableStyle,
): BoreholeLogColumnGeometry | null {
  const [depthMin, depthMax] = depthWindow(style);
  const from = Math.max(interval.fromMdFt, depthMin);
  const to = Math.min(interval.toMdFt, depthMax);
  if (to <= from) return null;
  const start = interpolateTrajectoryByMdFt(trajectory, from);
  const end = interpolateTrajectoryByMdFt(trajectory, to);
  const origin = interpolateTrajectoryByMdFt(trajectory, trajectory[0]?.mdFt ?? 0);
  if (!start || !end || !origin) return null;
  const verticalExaggeration = styleNumber(
    style,
    "boreholeLogVerticalExaggeration",
    1,
    0.25,
    8,
  );
  const a = transformedPoint(start, origin, verticalExaggeration);
  const b = transformedPoint(end, origin, verticalExaggeration);
  return {
    start: a,
    end: b,
    positions: [a.x, a.y, a.z, b.x, b.y, b.z],
  };
}

export function boreholeLogTrackColor(
  track: BoreholeLogTrack,
  style: EditableStyle = {},
): string {
  if (track.kind === "resistivity") {
    return styleString(
      style,
      "boreholeLogResistivityColor",
      DEFAULT_RESISTIVITY_COLOR,
    );
  }
  const mnemonic = track.mnemonic.toUpperCase();
  if (mnemonic.includes("HSGR")) {
    return styleString(style, "boreholeLogHsgrColor", DEFAULT_HSGR_COLOR);
  }
  if (mnemonic.includes("HCGR")) {
    return styleString(style, "boreholeLogHcgrColor", DEFAULT_HCGR_COLOR);
  }
  return "#ffd166";
}

function boreholeLogBaselineColor(style: EditableStyle): string {
  return styleString(style, "boreholeLogBaselineColor", DEFAULT_BASELINE_COLOR);
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

function makeRibbonMaterial(color: string): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: true,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialColor = true;
  return material;
}

function makeTrackObject(
  well: BoreholeLogWell,
  trajectory: BoreholeLogTrajectoryPoint[],
  track: BoreholeLogTrack,
  trackIndex: number,
  laneFrame: BoreholeLogLaneFrame,
): THREE.Group {
  const color = boreholeLogTrackColor(track);
  const root = new THREE.Group();
  root.name = `${well.id} ${track.mnemonic} borehole log`;
  root.renderOrder = RENDER_ORDER;
  root.userData = {
    utahForgeBoreholeLogTrack: true,
    boreholeLogWellId: well.id,
    boreholeLogTrackKind: track.kind,
    boreholeLogTrajectory: trajectory,
    boreholeLogTrack: track,
    boreholeLogTrackIndex: trackIndex,
    boreholeLogLaneFrame: laneFrame,
    displayName: `${well.id} ${track.mnemonic}`,
    sourceSubmission: track.source?.submission,
    sourceFile: track.source?.file,
    sourceMember: track.source?.member,
  };

  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), makeRibbonMaterial(color));
  ribbon.name = `${well.id} ${track.mnemonic} borehole log ribbon`;
  ribbon.renderOrder = RENDER_ORDER - 0.02;
  ribbon.userData = {
    boreholeLogPart: "ribbon",
    displayName: `${well.id} ${track.mnemonic}`,
  };
  root.add(ribbon);

  const baseline = new Line2(
    new LineGeometry(),
    makeLineMaterial(DEFAULT_BASELINE_COLOR, 1.2, 0.72),
  );
  baseline.name = `${well.id} ${track.mnemonic} borehole log lane baseline`;
  baseline.renderOrder = RENDER_ORDER - 0.01;
  baseline.userData = {
    boreholeLogPart: "lane-baseline",
    displayName: `${well.id} ${track.mnemonic} baseline`,
  };
  root.add(baseline);

  const edge = new Line2(new LineGeometry(), makeLineMaterial(color, 2.6, 0.92));
  edge.name = `${well.id} ${track.mnemonic} borehole log curve`;
  edge.renderOrder = RENDER_ORDER;
  edge.userData = {
    boreholeLogPart: "curve-edge",
    displayName: `${well.id} ${track.mnemonic}`,
  };
  root.add(edge);

  updateUtahForgeBoreholeLogObject(root, {});
  return root;
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

function childByPart<T extends THREE.Object3D>(
  obj: THREE.Object3D,
  part: string,
): T | undefined {
  return obj.children.find((child) => child.userData?.boreholeLogPart === part) as
    | T
    | undefined;
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
  if (kind === "lithology") {
    let positions: number[] = [];
    const interval = obj.userData.boreholeLogLithologyInterval as
      | BoreholeLogLithologyInterval
      | undefined;
    const column = interval
      ? buildLithologyColumnGeometry(trajectory, interval, style)
      : null;
    if (column) positions = column.positions;
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
    if (material) {
      material.transparent = true;
      material.needsUpdate = true;
    }
    const line = obj as Line2;
    const geometry = line.geometry as LineGeometry;
    geometry.setPositions(positions);
    line.computeLineDistances();
    obj.visible = selected && positions.length >= 6;
    return;
  }

  const track = obj.userData.boreholeLogTrack as BoreholeLogTrack | undefined;
  if (!track) {
    obj.visible = false;
    return;
  }
  const trackIndex =
    typeof obj.userData.boreholeLogTrackIndex === "number"
      ? obj.userData.boreholeLogTrackIndex
      : 0;
  const laneFrame =
    obj.userData.boreholeLogLaneFrame &&
    obj.userData.boreholeLogLaneFrame.laneAxis instanceof THREE.Vector3
      ? (obj.userData.boreholeLogLaneFrame as BoreholeLogLaneFrame)
      : computeBoreholeLogLaneFrame(trajectory);
  const ribbon = buildTrackRibbonGeometry(trajectory, track, style, trackIndex, laneFrame);
  const ribbonMesh = childByPart<THREE.Mesh>(obj, "ribbon");
  const baselineLine = childByPart<Line2>(obj, "lane-baseline");
  const edgeLine = childByPart<Line2>(obj, "curve-edge");
  const curveOpacity = styleNumber(style, "boreholeLogCurveOpacity", 0.92, 0, 1);
  const curveLineWidth = styleNumber(style, "boreholeLogCurveLineWidthPx", 2.6, 0.5, 18);
  const color = boreholeLogTrackColor(track, style);
  const visible =
    selected &&
    boreholeLogMnemonicVisible(style, track) &&
    ribbon.curvePositions.length >= 6;

  if (ribbonMesh) {
    const geometry = ribbonMesh.geometry as THREE.BufferGeometry;
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(ribbon.positions, 3));
    geometry.setIndex(ribbon.indices);
    geometry.computeBoundingSphere();
    const meshMaterial = ribbonMesh.material as THREE.MeshBasicMaterial | undefined;
    if (meshMaterial) {
      meshMaterial.color.set(color);
      meshMaterial.opacity = Math.min(0.34, curveOpacity * 0.24);
      meshMaterial.transparent = true;
      meshMaterial.depthWrite = false;
      meshMaterial.needsUpdate = true;
    }
    ribbonMesh.visible = visible && ribbon.indices.length >= 6;
  }

  if (baselineLine) {
    const baselineGeometry = baselineLine.geometry as LineGeometry;
    baselineGeometry.setPositions(ribbon.baselinePositions);
    baselineLine.computeLineDistances();
    const baselineMaterial = baselineLine.material as LineMaterial | undefined;
    if (baselineMaterial) {
      baselineMaterial.color.set(boreholeLogBaselineColor(style));
      baselineMaterial.opacity = Math.min(0.82, Math.max(0.32, curveOpacity * 0.58));
      baselineMaterial.linewidth = Math.max(1, curveLineWidth * 0.36);
      baselineMaterial.transparent = true;
      baselineMaterial.needsUpdate = true;
    }
    baselineLine.visible = visible && ribbon.baselinePositions.length >= 6;
  }

  if (edgeLine) {
    const edgeGeometry = edgeLine.geometry as LineGeometry;
    edgeGeometry.setPositions(ribbon.curvePositions);
    edgeLine.computeLineDistances();
    const edgeMaterial = edgeLine.material as LineMaterial | undefined;
    if (edgeMaterial) {
      edgeMaterial.color.set(color);
      edgeMaterial.opacity = curveOpacity;
      edgeMaterial.linewidth = curveLineWidth;
      edgeMaterial.transparent = true;
      edgeMaterial.needsUpdate = true;
    }
    edgeLine.visible = visible;
  }

  obj.visible = visible;
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
    const laneFrame = computeBoreholeLogLaneFrame(trajectory);
    const wellGroup = new THREE.Group();
    wellGroup.name = `${well.id} borehole logs`;
    wellGroup.userData.displayName = well.label ?? well.id;
    wellGroup.userData.boreholeLogWellId = well.id;
    let trackIndex = 0;
    for (const track of well.tracks ?? []) {
      if (track.renderStatus !== "renderable") continue;
      wellGroup.add(makeTrackObject(well, trajectory, track, trackIndex, laneFrame));
      trackIndex += 1;
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
