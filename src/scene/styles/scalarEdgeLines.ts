import * as THREE from "three";
import { scalarLateralSupportValues, scalarValueIsVisible } from "../scalarFocus";
import { scalarColorAt } from "./colorScales";

const SCALAR_EDGE_LINE_XY_BIN_M = 2600;
const SCALAR_EDGE_LINE_Z_BIN_M = 1300;
const SCALAR_EDGE_LINE_MIN_CELL_POINTS = 2;

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function geometryOriginalIndex(
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

export function sequentialIndex(count: number): Uint32Array {
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) indices[i] = i;
  return indices;
}

export function scalarLateralSupport(
  geometry: THREE.BufferGeometry,
): Float32Array | null {
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const cached = geometry.userData.scalarLateralSupport as
    | { count: number; values: Float32Array }
    | undefined;
  if (cached?.count === position.count) return cached.values;

  const values = scalarLateralSupportValues(position);
  geometry.userData.scalarLateralSupport = { count: position.count, values };
  return values;
}

export interface ScalarEdgeLineOptions {
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

export function disposeScalarEdgeLine(obj: THREE.Points): void {
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

export function updateScalarEdgeLineOverlay(
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
