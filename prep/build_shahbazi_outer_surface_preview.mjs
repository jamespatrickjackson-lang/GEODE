import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_PROCESSED_DIR,
  numberFromEnv,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const OBJECT_POINTS_INPUT = path.join(PROCESSED_DIR, "object_points_preview.json");
const TLS_SURFACE_INPUT = path.join(PROCESSED_DIR, "tls_surface_mesh_preview.json");
const MESH_OUTPUT = path.join(PROCESSED_DIR, "outer_surface_mesh_preview.json");
const MESH_PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "outer_surface_mesh_preview.provenance.json",
);
const CONTOURS_OUTPUT = path.join(PROCESSED_DIR, "outer_surface_contours.geojson");
const CONTOURS_PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "outer_surface_contours.provenance.json",
);

const CELL_SIZE_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_SURFACE_CELL_SIZE_M",
  2,
);
const SEARCH_RADIUS_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_SURFACE_SEARCH_RADIUS_M",
  18,
);
const MIN_NEIGHBORS = Math.max(
  1,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_OUTER_SURFACE_MIN_NEIGHBORS", 4),
  ),
);
const K_NEIGHBORS = Math.max(
  1,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_OUTER_SURFACE_K_NEIGHBORS", 14),
  ),
);
const IDW_POWER = numberFromEnv("GEOSEE_SHAHBAZI_OUTER_SURFACE_IDW_POWER", 2);
const CONTOUR_INTERVAL_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_CONTOUR_INTERVAL_M",
  0.5,
);
const EPSILON = 1e-7;
const BOUNDARY_SMOOTH_MIN_AREA_M2 = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_BOUNDARY_MIN_AREA_M2",
  16,
);
const BOUNDARY_SMOOTH_ITERATIONS = Math.max(
  0,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_OUTER_BOUNDARY_SMOOTH_ITERATIONS", 5),
  ),
);
const BOUNDARY_SMOOTH_LAMBDA = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_BOUNDARY_SMOOTH_LAMBDA",
  0.35,
);
const BOUNDARY_SMOOTH_Z_LAMBDA = numberFromEnv(
  "GEOSEE_SHAHBAZI_OUTER_BOUNDARY_SMOOTH_Z_LAMBDA",
  0.16,
);
const BOUNDARY_SMOOTH_MAX_SHIFT_M = CELL_SIZE_M * 0.9;
const BOUNDARY_SMOOTH_MAX_Z_SHIFT_M = CELL_SIZE_M * 0.45;

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function parsePreviewPoints(payload) {
  if (!Array.isArray(payload.points) || payload.points.length % 3 !== 0) {
    throw new Error("Invalid object-point preview payload.");
  }

  const points = [];
  for (let i = 0; i < payload.points.length; i += 3) {
    const point = [payload.points[i], payload.points[i + 1], payload.points[i + 2]];
    if (point.every((value) => Number.isFinite(value))) {
      points.push(point);
    }
  }
  return points;
}

function nearestNeighbors(points, x, y) {
  const radiusSq = SEARCH_RADIUS_M * SEARCH_RADIUS_M;
  const nearest = [];

  for (const point of points) {
    const dx = point[0] - x;
    const dy = point[1] - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > radiusSq) continue;

    const entry = { point, distanceSq };
    let insertAt = nearest.length;
    while (insertAt > 0 && nearest[insertAt - 1].distanceSq > distanceSq) {
      insertAt -= 1;
    }
    nearest.splice(insertAt, 0, entry);
    if (nearest.length > K_NEIGHBORS) nearest.pop();
  }

  return nearest;
}

function interpolateZ(points, x, y) {
  const nearest = nearestNeighbors(points, x, y);
  if (nearest.length < MIN_NEIGHBORS) return null;
  if (nearest[0].distanceSq < 0.000001) return nearest[0].point[2];

  let weightedZ = 0;
  let totalWeight = 0;
  for (const entry of nearest) {
    const weight = 1 / Math.max(0.000001, entry.distanceSq ** (IDW_POWER / 2));
    weightedZ += entry.point[2] * weight;
    totalWeight += weight;
  }
  return weightedZ / totalWeight;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function boundaryIndexLoopsFromMesh(mesh) {
  if (
    !Array.isArray(mesh.vertices) ||
    !Array.isArray(mesh.indices) ||
    mesh.vertices.length % 3 !== 0 ||
    mesh.indices.length % 3 !== 0
  ) {
    throw new Error("Invalid TLS surface mesh payload.");
  }

  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const triangle = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
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

function boundaryLoopsFromMesh(mesh) {
  return boundaryIndexLoopsFromMesh(mesh).map((loop) =>
    loop.map((index) => [
      mesh.vertices[index * 3],
      mesh.vertices[index * 3 + 1],
    ]),
  );
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function largestBoundaryLoop(mesh) {
  const loops = boundaryLoopsFromMesh(mesh);
  if (loops.length === 0) {
    throw new Error("Could not derive a TLS island boundary from the TLS mesh.");
  }
  return loops.reduce((best, candidate) =>
    Math.abs(polygonArea(candidate)) > Math.abs(polygonArea(best))
      ? candidate
      : best,
  );
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function loopAreaFromIndices(vertices, loop) {
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
  const loops = boundaryIndexLoopsFromMesh(mesh);
  let smoothedLoops = 0;
  let smoothedVertices = 0;

  for (const loop of loops) {
    if (loop.length < 8) continue;
    if (Math.abs(loopAreaFromIndices(mesh.vertices, loop)) < BOUNDARY_SMOOTH_MIN_AREA_M2) {
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
      mesh.vertices[index] = round(start.x + dx);
      mesh.vertices[index + 1] = round(start.y + dy);
      mesh.vertices[index + 2] = round(start.z + dz);
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
    maxHorizontalShiftM: round(BOUNDARY_SMOOTH_MAX_SHIFT_M),
    maxVerticalShiftM: round(BOUNDARY_SMOOTH_MAX_Z_SHIFT_M),
  };
}

function buildMesh(points, objectPayload, trimPolygon) {
  const sourceBounds = objectPayload.sceneBounds;
  if (!sourceBounds?.min || !sourceBounds?.max) {
    throw new Error("Object-point preview is missing scene bounds.");
  }

  const minX = Math.floor(sourceBounds.min[0] / CELL_SIZE_M) * CELL_SIZE_M;
  const maxX = Math.ceil(sourceBounds.max[0] / CELL_SIZE_M) * CELL_SIZE_M;
  const minY = Math.floor(sourceBounds.min[1] / CELL_SIZE_M) * CELL_SIZE_M;
  const maxY = Math.ceil(sourceBounds.max[1] / CELL_SIZE_M) * CELL_SIZE_M;
  const cols = Math.floor((maxX - minX) / CELL_SIZE_M) + 1;
  const rows = Math.floor((maxY - minY) / CELL_SIZE_M) + 1;

  const vertices = [];
  const indexByGrid = new Int32Array(cols * rows).fill(-1);
  const sceneBounds = emptyBounds();
  let validVertexCount = 0;

  for (let row = 0; row < rows; row += 1) {
    const y = minY + row * CELL_SIZE_M;
    for (let col = 0; col < cols; col += 1) {
      const x = minX + col * CELL_SIZE_M;
      if (pointInPolygon(x, y, trimPolygon)) continue;

      const z = interpolateZ(points, x, y);
      if (!Number.isFinite(z)) continue;

      const point = [round(x), round(y), round(z)];
      indexByGrid[row * cols + col] = validVertexCount;
      vertices.push(...point);
      updateBounds(sceneBounds, point);
      validVertexCount += 1;
    }
  }

  const indices = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = indexByGrid[row * cols + col];
      const b = indexByGrid[row * cols + col + 1];
      const c = indexByGrid[(row + 1) * cols + col];
      const d = indexByGrid[(row + 1) * cols + col + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      indices.push(a, b, c, b, d, c);
    }
  }

  const mesh = {
    vertices,
    indices,
    gridSize: [cols, rows],
    sceneBounds,
    validVertexCount,
    triangleCount: indices.length / 3,
  };
  mesh.boundarySmoothing = smoothBoundaryLoops(mesh);
  mesh.winding = enforceUpwardTriangleWinding(mesh);
  return mesh;
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

function makeLevels(minZ, maxZ) {
  const first = Math.ceil(minZ / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M;
  const last = Math.floor(maxZ / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M;
  const levels = [];
  for (let level = first; level <= last + EPSILON; level += CONTOUR_INTERVAL_M) {
    levels.push(round(level, 3));
  }
  return levels;
}

function edgeIntersection(a, b, level) {
  const za = a[2];
  const zb = b[2];
  if (level < Math.min(za, zb) - EPSILON || level > Math.max(za, zb) + EPSILON) {
    return null;
  }
  if (Math.abs(za - zb) < EPSILON) return null;

  const t = (level - za) / (zb - za);
  if (t < -EPSILON || t > 1 + EPSILON) return null;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    level,
  ];
}

function pointKey(point) {
  return point.map((value) => round(value, 5)).join(",");
}

function farthestPair(points) {
  let pair = [points[0], points[1]];
  let bestDistance = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      const dz = points[i][2] - points[j][2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance > bestDistance) {
        bestDistance = distance;
        pair = [points[i], points[j]];
      }
    }
  }
  return pair;
}

function buildContours(mesh) {
  const levels = makeLevels(mesh.sceneBounds.min[2], mesh.sceneBounds.max[2]);
  const segmentsByLevel = new Map(levels.map((level) => [String(level), []]));

  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ai = mesh.indices[i] * 3;
    const bi = mesh.indices[i + 1] * 3;
    const ci = mesh.indices[i + 2] * 3;
    const tri = [
      [mesh.vertices[ai], mesh.vertices[ai + 1], mesh.vertices[ai + 2]],
      [mesh.vertices[bi], mesh.vertices[bi + 1], mesh.vertices[bi + 2]],
      [mesh.vertices[ci], mesh.vertices[ci + 1], mesh.vertices[ci + 2]],
    ];
    const triMinZ = Math.min(tri[0][2], tri[1][2], tri[2][2]);
    const triMaxZ = Math.max(tri[0][2], tri[1][2], tri[2][2]);

    for (const level of levels) {
      if (level < triMinZ - EPSILON || level > triMaxZ + EPSILON) continue;
      const candidates = [
        edgeIntersection(tri[0], tri[1], level),
        edgeIntersection(tri[1], tri[2], level),
        edgeIntersection(tri[2], tri[0], level),
      ].filter(Boolean);
      const seen = new Set();
      const unique = [];
      for (const point of candidates) {
        const key = pointKey(point);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(point);
      }
      if (unique.length < 2) continue;
      segmentsByLevel
        .get(String(level))
        .push(farthestPair(unique).map((point) => point.map((value) => round(value))));
    }
  }

  return { levels, segmentsByLevel };
}

function sourceElevationForSceneLevel(level, objectPayload) {
  const zLift = objectPayload.scenePlacement?.zLiftMeters ?? 115;
  const verticalScale = objectPayload.scenePlacement?.verticalScale ?? 1;
  const sourceMinZ = objectPayload.sourceBounds?.min?.[2] ?? 0;
  return (level - zLift) / verticalScale + sourceMinZ;
}

async function main() {
  const [objectPayload, tlsMesh] = await Promise.all([
    readFile(OBJECT_POINTS_INPUT, "utf8").then(JSON.parse),
    readFile(TLS_SURFACE_INPUT, "utf8").then(JSON.parse),
  ]);
  const points = parsePreviewPoints(objectPayload);
  const trimPolygon = largestBoundaryLoop(tlsMesh);
  const mesh = buildMesh(points, objectPayload, trimPolygon);
  const { levels, segmentsByLevel } = buildContours(mesh);

  const meshPayload = {
    schema: "geosee.mesh-preview.v1",
    label: "Shahbazi outer ground surface preview",
    source: {
      file: "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
      previewFile:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/object_points_preview.json",
      citation: SHAHBAZI_CITATION,
      sourcePointCount: points.length,
    },
    crs: objectPayload.crs,
    sourceBounds: objectPayload.sourceBounds,
    scenePlacement: objectPayload.scenePlacement,
    processing: {
      method:
        "Standalone inverse-distance weighted outer surface from sparse object points, trimmed inside the actual TLS island footprint.",
      cellSizeM: CELL_SIZE_M,
      searchRadiusM: SEARCH_RADIUS_M,
      minNeighbors: MIN_NEIGHBORS,
      maxNeighbors: K_NEIGHBORS,
      idwPower: IDW_POWER,
      tlsTrimBoundary: {
        sourceMesh:
          "projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_surface_mesh_preview.json",
        method: "Largest boundary loop from TLS mesh boundary edges",
        vertexCount: trimPolygon.length,
      },
      gridSize: mesh.gridSize,
      validVertexCount: mesh.validVertexCount,
      triangleCount: mesh.triangleCount,
      triangleWinding:
        "counter-clockwise from +Z / upward-facing for app FrontSide rendering",
      winding: mesh.winding,
      boundarySmoothing: mesh.boundarySmoothing,
      fillPolicy:
        "Outer surface only. Coarse cells inside the actual TLS island footprint are removed. Exterior and TLS-cutout boundary loops are spline-smoothed in scene space. No seam, no island knit, no combined mesh, and no rectangular TLS cutout.",
    },
    sceneBounds: {
      min: mesh.sceneBounds.min.map(round),
      max: mesh.sceneBounds.max.map(round),
    },
    vertices: mesh.vertices,
    indices: mesh.indices,
  };

  const contourFeatures = levels
    .map((level, levelIndex) => {
      const segments = segmentsByLevel.get(String(level)) ?? [];
      if (segments.length === 0) return null;
      const sourceElevationM = sourceElevationForSceneLevel(level, objectPayload);
      return {
        type: "Feature",
        id: `outer-surface-contour-${sourceElevationM.toFixed(2)}m`,
        properties: {
          id: `outer-surface-contour-${sourceElevationM.toFixed(2)}m`,
          displayName: `Outer surface contour ${sourceElevationM.toFixed(2)} m`,
          sourceRole: "outer-object-point-surface-preview-contour",
          levelIndex,
          intervalM: CONTOUR_INTERVAL_M,
          sceneElevationM: round(level),
          sourceElevationM: round(sourceElevationM),
          segmentCount: segments.length,
          note:
            "Derived from the standalone outer object-point surface after trimming inside the actual TLS island footprint.",
        },
        geometry: {
          type: "MultiLineString",
          coordinates: segments,
        },
      };
    })
    .filter(Boolean);

  const contourSegmentCount = contourFeatures.reduce(
    (sum, feature) => sum + feature.properties.segmentCount,
    0,
  );
  const contourPayload = {
    type: "FeatureCollection",
    name: "Shahbazi outer surface contours",
    properties: {
      schema: "geosee.geojson-derived-contours.v1",
      sourceMesh: "outer_surface_mesh_preview.json",
      intervalM: CONTOUR_INTERVAL_M,
      featureCount: contourFeatures.length,
      segmentCount: contourSegmentCount,
    },
    features: contourFeatures,
  };

  const meshProvenance = {
    schema: "geosee.provenance.v1",
    artifact: "outer_surface_mesh_preview.json",
    artifactType: "outer-object-point-surface-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      primaryPath: "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
      previewPath:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/object_points_preview.json",
      pointRows: points.length,
    },
    processing: meshPayload.processing,
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "Outer source-derived preview only. The coarse surface is trimmed inside the actual TLS island footprint; it does not stitch to the TLS mesh and does not include a rectangular TLS cutout.",
    },
  };

  const contoursProvenance = {
    schema: "geosee.provenance.v1",
    artifact: "outer_surface_contours.geojson",
    artifactType: "outer-object-point-surface-contours-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      meshPreview:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/outer_surface_mesh_preview.json",
      rawSource: "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
    },
    processing: {
      script: "prep/build_shahbazi_outer_surface_preview.mjs",
      method: "Triangle-plane contour extraction from the standalone outer surface preview.",
      contourIntervalM: CONTOUR_INTERVAL_M,
      contourLevels: contourFeatures.length,
      contourSegments: contourSegmentCount,
      boundarySmoothing: mesh.boundarySmoothing,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes: "Contour linework for the outer source-derived surface only.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(MESH_OUTPUT, `${JSON.stringify(meshPayload)}\n`, "utf8"),
    writeFile(MESH_PROVENANCE_OUTPUT, `${JSON.stringify(meshProvenance, null, 2)}\n`, "utf8"),
    writeFile(CONTOURS_OUTPUT, `${JSON.stringify(contourPayload, null, 2)}\n`, "utf8"),
    writeFile(
      CONTOURS_PROVENANCE_OUTPUT,
      `${JSON.stringify(contoursProvenance, null, 2)}\n`,
      "utf8",
    ),
  ]);

  console.log(
    `Wrote outer surface (${mesh.validVertexCount.toLocaleString()} vertices, ${mesh.triangleCount.toLocaleString()} triangles) and ${contourSegmentCount.toLocaleString()} contour segments.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
