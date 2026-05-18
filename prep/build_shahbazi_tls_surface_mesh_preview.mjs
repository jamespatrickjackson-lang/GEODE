import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  numberFromEnv,
  rawPath,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const SOURCE = rawPath("LaserScan.xyz");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTPUT = path.join(PROCESSED_DIR, "tls_surface_mesh_preview.json");
const PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "tls_surface_mesh_preview.provenance.json",
);

const CREATED_DATE = SHAHBAZI_DERIVED_DATE;
const CELL_SIZE_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_SURFACE_CELL_SIZE_M",
  0.45,
);
const MIN_POINTS_PER_CELL = Math.max(
  1,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_TLS_SURFACE_MIN_POINTS_PER_CELL", 3),
  ),
);
const BOUNDARY_SMOOTH_MIN_AREA_M2 = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_SURFACE_BOUNDARY_MIN_AREA_M2",
  4,
);
const BOUNDARY_SMOOTH_ITERATIONS = Math.max(
  0,
  Math.round(
    numberFromEnv(
      "GEOSEE_SHAHBAZI_TLS_SURFACE_BOUNDARY_SMOOTH_ITERATIONS",
      5,
    ),
  ),
);
const BOUNDARY_SMOOTH_LAMBDA = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_SURFACE_BOUNDARY_SMOOTH_LAMBDA",
  0.34,
);
const BOUNDARY_SMOOTH_Z_LAMBDA = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_SURFACE_BOUNDARY_SMOOTH_Z_LAMBDA",
  0.18,
);
const BOUNDARY_SMOOTH_MAX_SHIFT_M = CELL_SIZE_M * 1.15;
const BOUNDARY_SMOOTH_MAX_Z_SHIFT_M = CELL_SIZE_M * 0.75;
const INTERIOR_GAP_FILL_MAX_CELLS = Math.max(
  0,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_TLS_SURFACE_GAP_FILL_MAX_CELLS", 140),
  ),
);
const INTERIOR_GAP_FILL_MAX_SPAN_CELLS = Math.max(
  0,
  Math.round(
    numberFromEnv(
      "GEOSEE_SHAHBAZI_TLS_SURFACE_GAP_FILL_MAX_SPAN_CELLS",
      16,
    ),
  ),
);
const INTERIOR_GAP_FILL_MIN_BORDER_SAMPLES = Math.max(
  0,
  Math.round(
    numberFromEnv(
      "GEOSEE_SHAHBAZI_TLS_SURFACE_GAP_FILL_MIN_BORDER_SAMPLES",
      4,
    ),
  ),
);
const INTERIOR_GAP_FILL_SEARCH_RADIUS_CELLS = Math.max(
  0,
  Math.round(
    numberFromEnv(
      "GEOSEE_SHAHBAZI_TLS_SURFACE_GAP_FILL_SEARCH_RADIUS_CELLS",
      7,
    ),
  ),
);
const INTERIOR_GAP_FILL_POWER = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_SURFACE_GAP_FILL_POWER",
  2,
);

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
}

function parsePoint(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const point = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  return point.every((value) => Number.isFinite(value)) ? point : null;
}

function readSceneTransform(tlsProvenance) {
  const bounds = tlsProvenance.processing?.sourceBounds;
  const transform = tlsProvenance.processing?.sceneTransform;
  const sourceRows = tlsProvenance.source?.sourcePointRows;
  if (!bounds?.min || !bounds?.max || !transform || !Number.isFinite(sourceRows)) {
    throw new Error("TLS provenance is missing source rows, bounds, or transform.");
  }
  return {
    sourceRows,
    min: bounds.min,
    max: bounds.max,
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    horizontalScale: transform.horizontalScale ?? 1,
    verticalScale: transform.verticalScale ?? 1,
    zLiftMeters: transform.zLiftMeters ?? 115,
  };
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function updateBounds(bounds, point) {
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], point[i]);
    bounds.max[i] = Math.max(bounds.max[i], point[i]);
  }
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function boundaryIndexLoops(vertices, indices) {
  const edges = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    for (const [a, b] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ]) {
      const key = edgeKey(a, b);
      const entry = edges.get(key) ?? { a, b, count: 0 };
      entry.count += 1;
      edges.set(key, entry);
    }
  }

  const boundaryEdges = [...edges.values()].filter((entry) => entry.count === 1);
  const adjacency = new Map();
  for (const edge of boundaryEdges) {
    if (!adjacency.has(edge.a)) adjacency.set(edge.a, []);
    if (!adjacency.has(edge.b)) adjacency.set(edge.b, []);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
  }

  const visited = new Set();
  const loops = [];
  for (const edge of boundaryEdges) {
    const startKey = edgeKey(edge.a, edge.b);
    if (visited.has(startKey)) continue;

    const loop = [edge.a, edge.b];
    visited.add(startKey);
    let previous = edge.a;
    let current = edge.b;
    let guard = 0;

    while (current !== edge.a && guard < boundaryEdges.length + 4) {
      guard += 1;
      const neighbors = adjacency.get(current) ?? [];
      const next = neighbors.find((candidate) => {
        if (candidate === previous && neighbors.length > 1) return false;
        return !visited.has(edgeKey(current, candidate));
      });
      if (next === undefined) break;
      visited.add(edgeKey(current, next));
      loop.push(next);
      previous = current;
      current = next;
    }

    if (loop.length >= 4 && loop[loop.length - 1] === loop[0]) {
      loops.push(loop.slice(0, -1));
    }
  }

  return loops;
}

function loopArea(vertices, loop) {
  let area = 0;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i] * 3;
    const b = loop[(i + 1) % loop.length] * 3;
    area += vertices[a] * vertices[b + 1] - vertices[b] * vertices[a + 1];
  }
  return area / 2;
}

function recomputeSceneBounds(vertices) {
  const bounds = emptyBounds();
  for (let i = 0; i < vertices.length; i += 3) {
    updateBounds(bounds, [vertices[i], vertices[i + 1], vertices[i + 2]]);
  }
  return bounds;
}

function smoothBoundaryLoops(mesh) {
  const loops = boundaryIndexLoops(mesh.vertices, mesh.indices);
  let smoothedLoops = 0;
  let smoothedVertices = 0;

  for (const loop of loops) {
    if (loop.length < 8) continue;
    if (Math.abs(loopArea(mesh.vertices, loop)) < BOUNDARY_SMOOTH_MIN_AREA_M2) {
      continue;
    }

    const original = loop.map((index) => {
      const i = index * 3;
      return { x: mesh.vertices[i], y: mesh.vertices[i + 1], z: mesh.vertices[i + 2] };
    });
    let current = original.map((point) => ({ ...point }));

    for (let pass = 0; pass < BOUNDARY_SMOOTH_ITERATIONS; pass += 1) {
      current = current.map((point, i) => {
        const prev = current[(i + current.length - 1) % current.length];
        const next = current[(i + 1) % current.length];
        return {
          x: point.x + ((prev.x + next.x) * 0.5 - point.x) * BOUNDARY_SMOOTH_LAMBDA,
          y: point.y + ((prev.y + next.y) * 0.5 - point.y) * BOUNDARY_SMOOTH_LAMBDA,
          z: point.z + ((prev.z + next.z) * 0.5 - point.z) * BOUNDARY_SMOOTH_Z_LAMBDA,
        };
      });
    }

    for (let i = 0; i < loop.length; i += 1) {
      const index = loop[i] * 3;
      const start = original[i];
      const target = current[i];
      let dx = target.x - start.x;
      let dy = target.y - start.y;
      let dz = target.z - start.z;
      const horizontalShift = Math.hypot(dx, dy);
      if (horizontalShift > BOUNDARY_SMOOTH_MAX_SHIFT_M) {
        const scale = BOUNDARY_SMOOTH_MAX_SHIFT_M / horizontalShift;
        dx *= scale;
        dy *= scale;
      }
      dz = Math.max(
        -BOUNDARY_SMOOTH_MAX_Z_SHIFT_M,
        Math.min(BOUNDARY_SMOOTH_MAX_Z_SHIFT_M, dz),
      );
      mesh.vertices[index] = roundMillimeter(start.x + dx);
      mesh.vertices[index + 1] = roundMillimeter(start.y + dy);
      mesh.vertices[index + 2] = roundMillimeter(start.z + dz);
      smoothedVertices += 1;
    }
    smoothedLoops += 1;
  }

  mesh.sceneBounds = recomputeSceneBounds(mesh.vertices);
  return {
    candidateLoopCount: loops.length,
    smoothedLoopCount: smoothedLoops,
    smoothedVertexCount: smoothedVertices,
    minLoopAreaM2: BOUNDARY_SMOOTH_MIN_AREA_M2,
    iterations: BOUNDARY_SMOOTH_ITERATIONS,
    maxHorizontalShiftM: roundMillimeter(BOUNDARY_SMOOTH_MAX_SHIFT_M),
    maxVerticalShiftM: roundMillimeter(BOUNDARY_SMOOTH_MAX_Z_SHIFT_M),
  };
}

function toScene(point, transform) {
  return [
    (point[0] - transform.center[0]) * transform.horizontalScale,
    (point[1] - transform.center[1]) * transform.horizontalScale,
    (point[2] - transform.min[2]) * transform.verticalScale + transform.zLiftMeters,
  ].map(roundMillimeter);
}

async function collectGrid(transform) {
  const width = transform.max[0] - transform.min[0];
  const height = transform.max[1] - transform.min[1];
  const cols = Math.ceil(width / CELL_SIZE_M) + 1;
  const rows = Math.ceil(height / CELL_SIZE_M) + 1;
  const cells = Array.from({ length: cols * rows }, () => ({
    count: 0,
    maxZ: -Infinity,
    minZ: Infinity,
    sumZ: 0,
  }));

  const rl = createInterface({
    input: createReadStream(SOURCE),
    crlfDelay: Infinity,
  });

  let validRows = 0;
  for await (const line of rl) {
    const point = parsePoint(line);
    if (!point) continue;
    const col = Math.min(
      cols - 1,
      Math.max(0, Math.floor((point[0] - transform.min[0]) / CELL_SIZE_M)),
    );
    const row = Math.min(
      rows - 1,
      Math.max(0, Math.floor((point[1] - transform.min[1]) / CELL_SIZE_M)),
    );
    const cell = cells[row * cols + col];
    cell.count += 1;
    cell.maxZ = Math.max(cell.maxZ, point[2]);
    cell.minZ = Math.min(cell.minZ, point[2]);
    cell.sumZ += point[2];
    validRows += 1;
  }

  return { cols, rows, cells, validRows };
}

function cellIsValid(cell) {
  return cell.count >= MIN_POINTS_PER_CELL && Number.isFinite(cell.maxZ);
}

function collectInvalidComponent(grid, startRow, startCol, visited) {
  const queue = [[startRow, startCol]];
  const cells = [];
  let touchesBoundary = false;
  let minRow = startRow;
  let maxRow = startRow;
  let minCol = startCol;
  let maxCol = startCol;
  visited[startRow * grid.cols + startCol] = 1;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [row, col] = queue[cursor];
    cells.push([row, col]);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    if (row === 0 || col === 0 || row === grid.rows - 1 || col === grid.cols - 1) {
      touchesBoundary = true;
    }

    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) continue;
      const index = nr * grid.cols + nc;
      if (visited[index]) continue;
      if (cellIsValid(grid.cells[index])) continue;
      visited[index] = 1;
      queue.push([nr, nc]);
    }
  }

  return {
    cells,
    touchesBoundary,
    minRow,
    maxRow,
    minCol,
    maxCol,
    rowSpan: maxRow - minRow + 1,
    colSpan: maxCol - minCol + 1,
  };
}

function collectBorderSamples(grid, component) {
  const samples = new Map();
  for (const [row, col] of component.cells) {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) continue;
        const index = nr * grid.cols + nc;
        const cell = grid.cells[index];
        if (!cellIsValid(cell)) continue;
        samples.set(index, { row: nr, col: nc, z: cell.maxZ });
      }
    }
  }
  return [...samples.values()];
}

function interpolateGapZ(row, col, samples) {
  let weightSum = 0;
  let zSum = 0;
  let used = 0;
  for (const sample of samples) {
    const distanceCells = Math.hypot(sample.row - row, sample.col - col);
    if (distanceCells > INTERIOR_GAP_FILL_SEARCH_RADIUS_CELLS) continue;
    const weight = 1 / Math.max(
      0.0001,
      distanceCells ** INTERIOR_GAP_FILL_POWER,
    );
    weightSum += weight;
    zSum += sample.z * weight;
    used += 1;
  }
  if (used < INTERIOR_GAP_FILL_MIN_BORDER_SAMPLES || weightSum <= 0) return null;
  return zSum / weightSum;
}

function fillSmallInteriorGaps(grid) {
  const visited = new Uint8Array(grid.cells.length);
  let candidateComponentCount = 0;
  let filledComponentCount = 0;
  let filledCellCount = 0;
  let largestFilledComponentCells = 0;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const index = row * grid.cols + col;
      if (visited[index] || cellIsValid(grid.cells[index])) continue;

      const component = collectInvalidComponent(grid, row, col, visited);
      candidateComponentCount += 1;
      if (component.touchesBoundary) continue;
      if (component.cells.length > INTERIOR_GAP_FILL_MAX_CELLS) continue;
      if (
        component.rowSpan > INTERIOR_GAP_FILL_MAX_SPAN_CELLS ||
        component.colSpan > INTERIOR_GAP_FILL_MAX_SPAN_CELLS
      ) {
        continue;
      }

      const samples = collectBorderSamples(grid, component);
      if (samples.length < INTERIOR_GAP_FILL_MIN_BORDER_SAMPLES) continue;

      let componentFilledCells = 0;
      for (const [fillRow, fillCol] of component.cells) {
        const z = interpolateGapZ(fillRow, fillCol, samples);
        if (!Number.isFinite(z)) continue;
        const fillIndex = fillRow * grid.cols + fillCol;
        const cell = grid.cells[fillIndex];
        cell.count = MIN_POINTS_PER_CELL;
        cell.maxZ = z;
        cell.minZ = z;
        cell.sumZ = z * MIN_POINTS_PER_CELL;
        componentFilledCells += 1;
      }

      if (componentFilledCells > 0) {
        filledComponentCount += 1;
        filledCellCount += componentFilledCells;
        largestFilledComponentCells = Math.max(
          largestFilledComponentCells,
          componentFilledCells,
        );
      }
    }
  }

  return {
    method:
      "Small enclosed no-data cells are filled from surrounding TLS cell heights before meshing.",
    candidateComponentCount,
    filledComponentCount,
    filledCellCount,
    largestFilledComponentCells,
    maxComponentCells: INTERIOR_GAP_FILL_MAX_CELLS,
    maxComponentSpanCells: INTERIOR_GAP_FILL_MAX_SPAN_CELLS,
    maxComponentSpanM: roundMillimeter(
      INTERIOR_GAP_FILL_MAX_SPAN_CELLS * CELL_SIZE_M,
    ),
    searchRadiusCells: INTERIOR_GAP_FILL_SEARCH_RADIUS_CELLS,
    searchRadiusM: roundMillimeter(
      INTERIOR_GAP_FILL_SEARCH_RADIUS_CELLS * CELL_SIZE_M,
    ),
    minBorderSamples: INTERIOR_GAP_FILL_MIN_BORDER_SAMPLES,
  };
}

function buildMesh(grid, transform) {
  const vertices = [];
  const counts = [];
  const indexByCell = new Int32Array(grid.cells.length).fill(-1);
  const sourceBounds = emptyBounds();
  const sceneBounds = emptyBounds();
  let validCellCount = 0;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const cellIndex = row * grid.cols + col;
      const cell = grid.cells[cellIndex];
      if (cell.count < MIN_POINTS_PER_CELL) continue;
      const x = transform.min[0] + (col + 0.5) * CELL_SIZE_M;
      const y = transform.min[1] + (row + 0.5) * CELL_SIZE_M;
      const z = cell.maxZ;
      const sourcePoint = [x, y, z].map(roundMillimeter);
      const scenePoint = toScene(sourcePoint, transform);
      indexByCell[cellIndex] = validCellCount;
      vertices.push(...scenePoint);
      counts.push(cell.count);
      updateBounds(sourceBounds, sourcePoint);
      updateBounds(sceneBounds, scenePoint);
      validCellCount += 1;
    }
  }

  const indices = [];
  for (let row = 0; row < grid.rows - 1; row += 1) {
    for (let col = 0; col < grid.cols - 1; col += 1) {
      const a = indexByCell[row * grid.cols + col];
      const b = indexByCell[row * grid.cols + col + 1];
      const c = indexByCell[(row + 1) * grid.cols + col];
      const d = indexByCell[(row + 1) * grid.cols + col + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      indices.push(a, b, c, b, d, c);
    }
  }

  return {
    vertices,
    indices,
    counts,
    sourceBounds,
    sceneBounds,
    validCellCount,
    triangleCount: indices.length / 3,
  };
}

function enforceUpwardTriangleWinding(mesh) {
  let flippedTriangleCount = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ai = mesh.indices[i] * 3;
    const bi = mesh.indices[i + 1] * 3;
    const ci = mesh.indices[i + 2] * 3;
    const ux = mesh.vertices[bi] - mesh.vertices[ai];
    const uy = mesh.vertices[bi + 1] - mesh.vertices[ai + 1];
    const vx = mesh.vertices[ci] - mesh.vertices[ai];
    const vy = mesh.vertices[ci + 1] - mesh.vertices[ai + 1];
    if (ux * vy - uy * vx >= 0) continue;
    const next = mesh.indices[i + 1];
    mesh.indices[i + 1] = mesh.indices[i + 2];
    mesh.indices[i + 2] = next;
    flippedTriangleCount += 1;
  }
  return { flippedTriangleCount };
}

async function main() {
  const tlsProvenance = JSON.parse(await readFile(TLS_PROVENANCE, "utf8"));
  const transform = readSceneTransform(tlsProvenance);
  const grid = await collectGrid(transform);
  const interiorGapFill = fillSmallInteriorGaps(grid);
  const mesh = buildMesh(grid, transform);
  const boundarySmoothing = smoothBoundaryLoops(mesh);
  const winding = enforceUpwardTriangleWinding(mesh);

  const payload = {
    schema: "geosee.mesh-preview.v1",
    label: "Shahbazi TLS binned surface preview",
    source: {
      file: "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_CITATION,
      sourcePointCount: grid.validRows,
    },
    crs: {
      label: "NAD83 / MTM Zone 7",
      epsg: 32187,
      status: "from article source-data table; confirm against full processing outputs before GIS overlay use",
    },
    sourceBounds: {
      min: mesh.sourceBounds.min.map(roundMillimeter),
      max: mesh.sourceBounds.max.map(roundMillimeter),
      center: transform.center.map(roundMillimeter),
    },
    scenePlacement: {
      mode: "tls-preview-aligned",
      horizontalScale: transform.horizontalScale,
      verticalScale: transform.verticalScale,
      zLiftMeters: transform.zLiftMeters,
      note: "Surface preview keeps TLS metric scale, recenters X/Y, and lifts Z into the existing procedural Case Study B scene.",
    },
    processing: {
      method:
        "Binned height-field mesh using maximum observed TLS Z per populated grid cell, with small enclosed interior no-data gaps filled from neighboring TLS cells.",
      cellSizeM: CELL_SIZE_M,
      minPointsPerCell: MIN_POINTS_PER_CELL,
      gridSize: [grid.cols, grid.rows],
      validCellCount: mesh.validCellCount,
      triangleCount: mesh.triangleCount,
      triangleWinding:
        "counter-clockwise from +Z / upward-facing for app FrontSide rendering",
      winding,
      interiorGapFill,
      boundarySmoothing,
      fillPolicy:
        "Small enclosed interior no-data gaps are filled from neighboring TLS heights before meshing. Mesh faces are still not extended outside the observed TLS footprint. Exterior boundary loops are spline-smoothed in scene space to remove binned-grid edge chatter without stitching to the outer surface.",
    },
    sceneBounds: {
      min: mesh.sceneBounds.min.map(roundMillimeter),
      max: mesh.sceneBounds.max.map(roundMillimeter),
    },
    vertices: mesh.vertices,
    indices: mesh.indices,
    attributes: {
      pointCountPerVertex: mesh.counts,
    },
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "tls_surface_mesh_preview.json",
    artifactType: "binned-tls-surface-mesh-preview",
    projectSlug: "case-study-b",
    createdDate: CREATED_DATE,
    source: {
      path: "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_FULL_CITATION,
      sourcePointRows: grid.validRows,
      format: "XYZ text",
      columns: ["x", "y", "z"],
    },
    processing: {
      script: "prep/build_shahbazi_tls_surface_mesh_preview.mjs",
      method: payload.processing.method,
      cellSizeM: CELL_SIZE_M,
      minPointsPerCell: MIN_POINTS_PER_CELL,
      gridSize: payload.processing.gridSize,
      validCellCount: mesh.validCellCount,
      triangleCount: mesh.triangleCount,
      triangleWinding: payload.processing.triangleWinding,
      winding,
      interiorGapFill,
      boundarySmoothing,
      fillPolicy: payload.processing.fillPolicy,
      sceneTransform: payload.scenePlacement,
      sourceBounds: payload.sourceBounds,
      sceneBounds: payload.sceneBounds,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This is a TLS-derived preview, not a final DEM, photogrammetry mesh, or engineered surface. It fills only small enclosed interior display gaps and does not extend the mesh outside the observed TLS footprint.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote TLS surface mesh preview with ${mesh.validCellCount.toLocaleString()} vertices and ${mesh.triangleCount.toLocaleString()} triangles to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
