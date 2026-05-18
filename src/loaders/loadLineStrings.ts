import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { enableDistanceAttenuatedLineWidth } from "./topoLineMaterial";
import { SURFACE_RENDER_ORDER } from "./surfaceRenderPolicy";
import { debugLog } from "../utils/debugLog";

type LineCoordinate = [number, number, number?];

interface LineStringFeature {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry:
    | {
        type: "LineString";
        coordinates: LineCoordinate[];
      }
    | {
        type: "MultiLineString";
        coordinates: LineCoordinate[][];
      }
    | null;
}

interface LineStringCollection {
  type: "FeatureCollection";
  name?: string;
  properties?: Record<string, unknown>;
  features: LineStringFeature[];
}

const DEFAULT_LINE_WIDTH_PX = 1.35;
const DEFAULT_CONTOUR_LIFT_M = 0;
const DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M = 80;
const DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M = 420;
const DEFAULT_CONTOUR_FAR_LINE_SCALE = 0.28;
const DEFAULT_CONTOUR_FAR_OPACITY = 0.72;
const DEFAULT_CONTOUR_SMOOTHING_ITERATIONS = 4;
const DEFAULT_CONTOUR_SIMPLIFY_TOLERANCE_M = 0.85;
const DEFAULT_CONTOUR_SPLINE_STEP_M = 0.7;
const RENDER_ORDER = SURFACE_RENDER_ORDER.contourLine;

type FinitePoint = [number, number, number];

interface ContourLineEntry {
  coordinates: FinitePoint[];
  levelIndex: number | null;
}

interface ContourGraphNode {
  point: FinitePoint;
  edges: ContourGraphEdge[];
}

interface ContourGraphEdge {
  a: string;
  b: string;
  visited: boolean;
}

function pointIsFinite(point: LineCoordinate): point is [number, number, number] {
  return (
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Number.isFinite(point[2] ?? 0)
  );
}

function appendLineString(segments: number[], coordinates: LineCoordinate[]) {
  let previous: [number, number, number] | null = null;
  for (const rawPoint of coordinates) {
    const point: [number, number, number] = [
      rawPoint[0],
      rawPoint[1],
      rawPoint[2] ?? 0,
    ];
    if (!pointIsFinite(point)) continue;
    if (previous) {
      segments.push(previous[0], previous[1], previous[2]);
      segments.push(point[0], point[1], point[2]);
    }
    previous = point;
  }
}

function finiteLine(coordinates: LineCoordinate[]): FinitePoint[] {
  const line: FinitePoint[] = [];
  for (const rawPoint of coordinates) {
    const point: FinitePoint = [
      rawPoint[0],
      rawPoint[1],
      rawPoint[2] ?? 0,
    ];
    if (pointIsFinite(point)) line.push(point);
  }
  return line;
}

function pointKey(point: FinitePoint): string {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)},${point[2].toFixed(3)}`;
}

function addContourNode(
  nodes: Map<string, ContourGraphNode>,
  point: FinitePoint,
): string {
  const key = pointKey(point);
  if (!nodes.has(key)) nodes.set(key, { point, edges: [] });
  return key;
}

function traceContourLine(
  startKey: string,
  startEdge: ContourGraphEdge,
  nodes: Map<string, ContourGraphNode>,
): FinitePoint[] {
  const first = nodes.get(startKey);
  if (!first) return [];
  const line: FinitePoint[] = [first.point];
  let currentKey = startKey;
  let edge: ContourGraphEdge | undefined = startEdge;

  while (edge && !edge.visited) {
    edge.visited = true;
    const nextKey = edge.a === currentKey ? edge.b : edge.a;
    const nextNode = nodes.get(nextKey);
    if (!nextNode) break;
    line.push(nextNode.point);
    currentKey = nextKey;
    if (nextNode.edges.length !== 2) break;
    edge = nextNode.edges.find((candidate) => !candidate.visited);
  }

  return line;
}

function mergeContourLineStrings(lineStrings: LineCoordinate[][]): FinitePoint[][] {
  const nodes = new Map<string, ContourGraphNode>();
  const edges: ContourGraphEdge[] = [];

  for (const coordinates of lineStrings) {
    const line = finiteLine(coordinates);
    for (let i = 1; i < line.length; i += 1) {
      const a = addContourNode(nodes, line[i - 1]);
      const b = addContourNode(nodes, line[i]);
      if (a === b) continue;
      const edge: ContourGraphEdge = { a, b, visited: false };
      edges.push(edge);
      nodes.get(a)?.edges.push(edge);
      nodes.get(b)?.edges.push(edge);
    }
  }

  const merged: FinitePoint[][] = [];
  for (const [key, node] of nodes) {
    if (node.edges.length === 2) continue;
    for (const edge of node.edges) {
      if (edge.visited) continue;
      const line = traceContourLine(key, edge, nodes);
      if (line.length >= 2) merged.push(line);
    }
  }

  for (const edge of edges) {
    if (edge.visited) continue;
    const line = traceContourLine(edge.a, edge, nodes);
    if (line.length >= 2) merged.push(line);
  }

  return merged;
}

function collectFeatureLineStrings(feature: LineStringFeature): LineCoordinate[][] {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "LineString") {
    return [feature.geometry.coordinates];
  }
  return feature.geometry.coordinates;
}

function contourLevelIndex(feature: LineStringFeature): number | null {
  const value = feature.properties?.levelIndex;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function collectionIntervalM(data: LineStringCollection): number | null {
  const value = data.properties?.intervalM;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function distanceSq2d(a: FinitePoint, b: FinitePoint): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function distance2d(a: FinitePoint, b: FinitePoint): number {
  return Math.sqrt(distanceSq2d(a, b));
}

function lineLength2d(line: FinitePoint[]): number {
  let length = 0;
  for (let i = 1; i < line.length; i += 1) {
    length += distance2d(line[i - 1], line[i]);
  }
  return length;
}

function removeNearDuplicatePoints(
  line: FinitePoint[],
  minDistanceM: number,
): FinitePoint[] {
  if (line.length <= 2) return line;
  const minDistanceSq = minDistanceM * minDistanceM;
  const next: FinitePoint[] = [line[0]];
  for (let i = 1; i < line.length - 1; i += 1) {
    if (distanceSq2d(line[i], next[next.length - 1]) >= minDistanceSq) {
      next.push(line[i]);
    }
  }
  const last = line[line.length - 1];
  if (distanceSq2d(last, next[next.length - 1]) > 0.000001) {
    next.push(last);
  }
  return next;
}

function perpendicularDistanceSq2d(
  point: FinitePoint,
  start: FinitePoint,
  end: FinitePoint,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.000001) return distanceSq2d(point, start);
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lenSq),
  );
  const px = start[0] + dx * t;
  const py = start[1] + dy * t;
  const ox = point[0] - px;
  const oy = point[1] - py;
  return ox * ox + oy * oy;
}

function simplifyLineRdp(line: FinitePoint[], toleranceM: number): FinitePoint[] {
  if (line.length <= 3 || toleranceM <= 0) return line;
  const toleranceSq = toleranceM * toleranceM;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, line.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDistanceSq = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distanceSq = perpendicularDistanceSq2d(line[i], line[start], line[end]);
      if (distanceSq > maxDistanceSq) {
        maxDistanceSq = distanceSq;
        index = i;
      }
    }
    if (index >= 0 && maxDistanceSq > toleranceSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return line.filter((_, index) => keep[index] === 1);
}

function lerpPoint(a: FinitePoint, b: FinitePoint, t: number): FinitePoint {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function chaikinSmoothLine(
  line: FinitePoint[],
  iterations: number,
): FinitePoint[] {
  let current = line;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) break;
    const closed = distanceSq2d(current[0], current[current.length - 1]) < 0.001;
    const source = closed ? current.slice(0, -1) : current;
    const next: FinitePoint[] = closed ? [] : [source[0]];
    const count = source.length;
    const segmentCount = closed ? count : count - 1;

    for (let i = 0; i < segmentCount; i += 1) {
      const a = source[i];
      const b = source[(i + 1) % count];
      next.push(lerpPoint(a, b, 0.25), lerpPoint(a, b, 0.75));
    }

    if (closed) {
      next.push(next[0]);
    } else {
      next.push(source[source.length - 1]);
    }
    current = next;
  }
  return current;
}

function smoothContourLine(line: FinitePoint[]): FinitePoint[] {
  if (line.length < 3) return line;
  const deduped = removeNearDuplicatePoints(line, 0.08);
  const simplified = simplifyLineRdp(
    deduped,
    DEFAULT_CONTOUR_SIMPLIFY_TOLERANCE_M,
  );
  const rounded = chaikinSmoothLine(
    simplified,
    DEFAULT_CONTOUR_SMOOTHING_ITERATIONS,
  );
  const splineReady = removeNearDuplicatePoints(rounded, 0.05);
  if (splineReady.length < 4) return splineReady;

  const closed =
    distanceSq2d(splineReady[0], splineReady[splineReady.length - 1]) < 0.05;
  const source = closed ? splineReady.slice(0, -1) : splineReady;
  if (source.length < 4) return splineReady;

  const vectors = source.map((point) => new THREE.Vector3(...point));
  const curve = new THREE.CatmullRomCurve3(vectors, closed, "centripetal", 0.5);
  const length = Math.max(DEFAULT_CONTOUR_SPLINE_STEP_M, lineLength2d(source));
  const divisions = Math.max(
    source.length,
    Math.min(900, Math.ceil(length / DEFAULT_CONTOUR_SPLINE_STEP_M)),
  );
  const points = curve
    .getPoints(divisions)
    .map((point): FinitePoint => [point.x, point.y, point.z]);
  if (closed && points.length > 0) points.push(points[0]);
  return points;
}

function isDerivedContourCollection(data: LineStringCollection): boolean {
  const schema = data.properties?.schema;
  if (typeof schema === "string" && schema.includes("derived-contours")) {
    return true;
  }
  return (data.name ?? "").toLowerCase().includes("contour");
}

function isBoundaryCollection(data: LineStringCollection): boolean {
  const schema = data.properties?.schema;
  return typeof schema === "string" && schema.includes("boundary");
}

function createLineMaterial({
  isDerivedContour,
  isBoundary = false,
  lineWidthScale = 1,
}: {
  isDerivedContour: boolean;
  isBoundary?: boolean;
  lineWidthScale?: number;
}): LineMaterial {
  const material = new LineMaterial({
    color: isBoundary ? 0xffffff : 0x142a31,
    linewidth: isBoundary ? 1.6 : DEFAULT_LINE_WIDTH_PX,
    worldUnits: false,
    transparent: true,
    opacity: isBoundary ? 0.92 : 0.82,
    depthTest: true,
    depthWrite: false,
    dashed: isBoundary,
    dashSize: 10,
    gapSize: 6,
  });
  material.fog = false;
  if (isDerivedContour) {
    material.userData.contourDistanceAttenuatedLineWidth = true;
    material.userData.worldLineWidthScale = lineWidthScale;
    material.userData.worldLineWidthMin = 0.08;
    material.userData.worldLineWidthMax = 8;
    enableDistanceAttenuatedLineWidth(material, {
      near: DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M,
      far: DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M,
      minScale: DEFAULT_CONTOUR_FAR_LINE_SCALE,
      minAlpha: DEFAULT_CONTOUR_FAR_OPACITY,
    });
  }
  material.resolution.set(
    window.innerWidth || 1920,
    window.innerHeight || 1080,
  );
  return material;
}

export async function loadLineStrings(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch line GeoJSON ${url}: ${response.status}`);
  }

  const data = (await response.json()) as LineStringCollection;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`Invalid line GeoJSON: ${url}`);
  }

  const segments: number[] = [];
  const contourLines: ContourLineEntry[] = [];
  let featureCount = 0;
  const isDerivedContour = isDerivedContourCollection(data);
  const isBoundary = isBoundaryCollection(data);
  for (const feature of data.features) {
    if (!feature.geometry) continue;
    if (isDerivedContour) {
      const levelIndex = contourLevelIndex(feature);
      contourLines.push(
        ...mergeContourLineStrings(collectFeatureLineStrings(feature)).map(
          (coordinates): ContourLineEntry => ({ coordinates, levelIndex }),
        ),
      );
      featureCount += 1;
      continue;
    }
    if (feature.geometry.type === "LineString") {
      appendLineString(segments, feature.geometry.coordinates);
      featureCount += 1;
      continue;
    }
    if (feature.geometry.type === "MultiLineString") {
      for (const line of feature.geometry.coordinates) {
        appendLineString(segments, line);
      }
      featureCount += 1;
    }
  }

  const group = new THREE.Group();
  group.name = data.name ?? "line strings";
  group.userData.displayName = data.name ?? "Line strings";
  group.userData.sourceProperties = data.properties;

  const material = createLineMaterial({ isDerivedContour, isBoundary });
  const indexContourMaterial = isDerivedContour
    ? createLineMaterial({ isDerivedContour: true, lineWidthScale: 1.45 })
    : material;
  group.userData.traceMaterial = material;
  const intervalM = isDerivedContour ? collectionIntervalM(data) : null;
  const displayedContourModulo =
    intervalM !== null ? Math.max(1, Math.round(1 / intervalM)) : 1;
  const indexContourModulo =
    intervalM !== null ? Math.max(displayedContourModulo, Math.round(5 / intervalM)) : 5;

  if (isDerivedContour) {
    for (const entry of contourLines) {
      const { coordinates, levelIndex } = entry;
      if (
        levelIndex !== null &&
        Math.abs(levelIndex % displayedContourModulo) !== 0
      ) {
        continue;
      }
      if (coordinates.length < 2) continue;
      const smoothed = smoothContourLine(coordinates);
      if (smoothed.length < 2) continue;
      const positions = smoothed.flatMap((point) => point);
      const geometry = new LineGeometry();
      geometry.setPositions(positions);
      const isIndexContour =
        levelIndex !== null && Math.abs(levelIndex % indexContourModulo) === 0;
      const line = new Line2(
        geometry,
        isIndexContour ? indexContourMaterial : material,
      );
      line.computeLineDistances();
      line.position.z = DEFAULT_CONTOUR_LIFT_M;
      line.renderOrder = isBoundary ? RENDER_ORDER + 0.2 : RENDER_ORDER;
      line.userData.contourLine = true;
      line.userData.indexContour = isIndexContour;
      line.userData.displayName = data.name ?? "Line strings";
      group.add(line);
    }
  } else if (segments.length > 0) {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(segments);
    const line = new LineSegments2(geometry, material);
    line.computeLineDistances();
    line.renderOrder = isBoundary ? RENDER_ORDER + 0.2 : RENDER_ORDER;
    line.userData.displayName = data.name ?? "Line strings";
    group.add(line);
  }

  debugLog(
    `[loadLineStrings] ${featureCount} features, ${
      isDerivedContour ? contourLines.length : segments.length / 6
    } ${isDerivedContour ? "merged contour lines" : "segments"} from ${url}`,
  );
  return group;
}
