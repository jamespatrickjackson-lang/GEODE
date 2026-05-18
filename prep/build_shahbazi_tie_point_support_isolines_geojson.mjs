import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  numberFromEnv,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;
const INPUT = path.join(PROCESSED_DIR, "object_points_preview.json");
const ISOLINES_OUTPUT = path.join(PROCESSED_DIR, "tie_point_support_isolines.geojson");
const ISOLINES_PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "tie_point_support_isolines.provenance.json",
);
const ISOBANDS_OUTPUT = path.join(PROCESSED_DIR, "tie_point_support_isobands_mesh.json");
const ISOBANDS_PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "tie_point_support_isobands_mesh.provenance.json",
);

const CELL_SIZE_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_TIE_POINT_CELL_SIZE_M",
  1,
);
const SEARCH_RADIUS_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_TIE_POINT_SEARCH_RADIUS_M",
  10,
);
const MIN_NEIGHBORS = Math.max(
  1,
  Math.round(
    numberFromEnv("GEOSEE_SHAHBAZI_TIE_POINT_MIN_NEIGHBORS", 4),
  ),
);
const Z_OFFSET_M = 0;
const LEVELS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const EPSILON = 1e-7;

const COLOR_STOPS = [
  { value: 2, color: [1.0, 0.388, 0.478] },
  { value: 8, color: [0.973, 0.867, 0.427] },
  { value: 14, color: [0.412, 0.941, 0.706] },
  { value: 22, color: [0.259, 0.847, 1.0] },
  { value: 28, color: [0.545, 0.91, 1.0] },
];

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorForValue(value) {
  if (value <= COLOR_STOPS[0].value) return COLOR_STOPS[0].color;
  for (let i = 1; i < COLOR_STOPS.length; i += 1) {
    const prev = COLOR_STOPS[i - 1];
    const next = COLOR_STOPS[i];
    if (value <= next.value) {
      const t = (value - prev.value) / (next.value - prev.value);
      return [
        round(lerp(prev.color[0], next.color[0], t), 4),
        round(lerp(prev.color[1], next.color[1], t), 4),
        round(lerp(prev.color[2], next.color[2], t), 4),
      ];
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}

function payloadPoints(payload) {
  const points = [];
  const observations = payload.attributes?.observations ?? [];
  for (let i = 0; i < payload.points.length; i += 3) {
    const observationCount = observations[i / 3]?.observationCount ?? 0;
    points.push({
      x: payload.points[i],
      y: payload.points[i + 1],
      z: payload.points[i + 2],
      observationCount,
    });
  }
  return points;
}

function boundsFor(points) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const point of points) {
    bounds.min[0] = Math.min(bounds.min[0], point.x);
    bounds.min[1] = Math.min(bounds.min[1], point.y);
    bounds.min[2] = Math.min(bounds.min[2], point.z);
    bounds.max[0] = Math.max(bounds.max[0], point.x);
    bounds.max[1] = Math.max(bounds.max[1], point.y);
    bounds.max[2] = Math.max(bounds.max[2], point.z);
  }
  return bounds;
}

function buildSpatialIndex(points) {
  const bucketSize = SEARCH_RADIUS_M;
  const buckets = new Map();
  for (const point of points) {
    const bx = Math.floor(point.x / bucketSize);
    const by = Math.floor(point.y / bucketSize);
    const key = `${bx},${by}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }
  return { bucketSize, buckets };
}

function nearbyPoints(x, y, index) {
  const bx = Math.floor(x / index.bucketSize);
  const by = Math.floor(y / index.bucketSize);
  const candidates = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bucket = index.buckets.get(`${bx + dx},${by + dy}`);
      if (bucket) candidates.push(...bucket);
    }
  }
  return candidates;
}

function estimateNode(x, y, index) {
  let weightSum = 0;
  let valueSum = 0;
  let zSum = 0;
  let neighborCount = 0;
  const radiusSquared = SEARCH_RADIUS_M * SEARCH_RADIUS_M;

  for (const point of nearbyPoints(x, y, index)) {
    const dx = x - point.x;
    const dy = y - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > radiusSquared) continue;
    const weight = 1 / Math.max(0.7, distanceSquared);
    weightSum += weight;
    valueSum += point.observationCount * weight;
    zSum += point.z * weight;
    neighborCount += 1;
  }

  if (neighborCount < MIN_NEIGHBORS || weightSum <= 0) return null;
  return {
    value: valueSum / weightSum,
    z: zSum / weightSum + Z_OFFSET_M,
    neighborCount,
  };
}

function buildGrid(points, bounds) {
  const index = buildSpatialIndex(points);
  const minX = Math.floor(bounds.min[0] / CELL_SIZE_M) * CELL_SIZE_M;
  const minY = Math.floor(bounds.min[1] / CELL_SIZE_M) * CELL_SIZE_M;
  const maxX = Math.ceil(bounds.max[0] / CELL_SIZE_M) * CELL_SIZE_M;
  const maxY = Math.ceil(bounds.max[1] / CELL_SIZE_M) * CELL_SIZE_M;
  const cols = Math.floor((maxX - minX) / CELL_SIZE_M) + 1;
  const rows = Math.floor((maxY - minY) / CELL_SIZE_M) + 1;
  const nodes = new Array(cols * rows);
  let validNodeCount = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = minX + col * CELL_SIZE_M;
      const y = minY + row * CELL_SIZE_M;
      const estimate = estimateNode(x, y, index);
      const node = estimate
        ? { x, y, z: estimate.z, value: estimate.value, valid: true }
        : { x, y, z: 0, value: Number.NaN, valid: false };
      if (node.valid) validNodeCount += 1;
      nodes[row * cols + col] = node;
    }
  }

  return { minX, minY, maxX, maxY, cols, rows, nodes, validNodeCount };
}

function crosses(a, b, level) {
  if (!a.valid || !b.valid) return false;
  if (Math.abs(a.value - b.value) < EPSILON) return false;
  return (
    (a.value <= level && b.value >= level) ||
    (b.value <= level && a.value >= level)
  );
}

function interpolateEdge(a, b, level) {
  const t = (level - a.value) / (b.value - a.value);
  return [
    round(a.x + (b.x - a.x) * t),
    round(a.y + (b.y - a.y) * t),
    round(a.z + (b.z - a.z) * t),
  ];
}

function cellSegmentsForLevel(corners, level) {
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  const points = [];
  const seen = new Set();
  for (const [a, b] of edges) {
    if (!crosses(a, b, level)) continue;
    const point = interpolateEdge(a, b, level);
    const key = point.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  }

  if (points.length < 2) return [];
  if (points.length === 2) return [[points[0], points[1]]];
  return [
    [points[0], points[1]],
    [points[2], points[3]],
  ];
}

function buildIsolines(grid) {
  const features = [];
  let segmentCount = 0;

  for (const level of LEVELS) {
    const levelSegments = [];
    for (let row = 0; row < grid.rows - 1; row += 1) {
      for (let col = 0; col < grid.cols - 1; col += 1) {
        const ll = grid.nodes[row * grid.cols + col];
        const lr = grid.nodes[row * grid.cols + col + 1];
        const ur = grid.nodes[(row + 1) * grid.cols + col + 1];
        const ul = grid.nodes[(row + 1) * grid.cols + col];
        levelSegments.push(...cellSegmentsForLevel([ll, lr, ur, ul], level));
      }
    }
    if (levelSegments.length === 0) continue;
    segmentCount += levelSegments.length;
    features.push({
      type: "Feature",
      id: `tie-point-support-${level}`,
      properties: {
        id: `tie-point-support-${level}`,
        displayName: `Tie-point support ${level} observations`,
        sourceRole: "tie-point-support-isoline",
        observationCount: level,
        segmentCount: levelSegments.length,
        note:
          "Derived QA isoline from inverse-distance interpolation of object point observation counts. This is not ground geometry or measured pressure.",
      },
      geometry: {
        type: "MultiLineString",
        coordinates: levelSegments,
      },
    });
  }

  return { features, segmentCount };
}

function buildIsobandMesh(grid) {
  const vertices = [];
  const colors = [];
  const indices = [];
  const indexByNode = new Array(grid.nodes.length).fill(-1);
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };

  for (let i = 0; i < grid.nodes.length; i += 1) {
    const node = grid.nodes[i];
    if (!node.valid) continue;
    const vertexIndex = vertices.length / 3;
    indexByNode[i] = vertexIndex;
    vertices.push(round(node.x), round(node.y), round(node.z));
    colors.push(...colorForValue(node.value));
    bounds.min[0] = Math.min(bounds.min[0], node.x);
    bounds.min[1] = Math.min(bounds.min[1], node.y);
    bounds.min[2] = Math.min(bounds.min[2], node.z);
    bounds.max[0] = Math.max(bounds.max[0], node.x);
    bounds.max[1] = Math.max(bounds.max[1], node.y);
    bounds.max[2] = Math.max(bounds.max[2], node.z);
  }

  for (let row = 0; row < grid.rows - 1; row += 1) {
    for (let col = 0; col < grid.cols - 1; col += 1) {
      const ll = row * grid.cols + col;
      const lr = ll + 1;
      const ul = (row + 1) * grid.cols + col;
      const ur = ul + 1;
      const a = indexByNode[ll];
      const b = indexByNode[lr];
      const c = indexByNode[ur];
      const d = indexByNode[ul];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      indices.push(a, b, d, b, c, d);
    }
  }

  return {
    schema: "geosee.scalar-grid-mesh-preview.v1",
    label: "Shahbazi tie-point support infill",
    source: {
      file: "projects/case-study-b/data/processed/shahbazi_gravel_pit/object_points_preview.json",
      scalar: "tie_point_observation_count",
    },
    processing: {
      method: "Inverse-distance interpolation of object-point tie observation counts.",
      cellSizeM: CELL_SIZE_M,
      searchRadiusM: SEARCH_RADIUS_M,
      minNeighbors: MIN_NEIGHBORS,
      colorStops: COLOR_STOPS,
      triangleWinding:
        "counter-clockwise from +Z / upward-facing for app FrontSide rendering",
    },
    sceneBounds: {
      min: bounds.min.map((value) => round(value)),
      max: bounds.max.map((value) => round(value)),
    },
    columns: ["x_scene_m", "y_scene_m", "z_scene_m"],
    colorColumns: ["r", "g", "b"],
    vertices,
    colors,
    indices,
  };
}

async function main() {
  const payload = JSON.parse(await readFile(INPUT, "utf8"));
  if (
    payload.schema !== "geosee.pointcloud-preview.v1" ||
    !Array.isArray(payload.points) ||
    !Array.isArray(payload.attributes?.observations)
  ) {
    throw new Error("Invalid object point preview payload");
  }

  const points = payloadPoints(payload);
  const bounds = boundsFor(points);
  const grid = buildGrid(points, bounds);
  const { features, segmentCount } = buildIsolines(grid);
  const isobandMesh = buildIsobandMesh(grid);

  const commonProcessing = {
    method:
      "Inverse-distance interpolation of object-point tie observation counts onto a scene-coordinate grid.",
    cellSizeM: CELL_SIZE_M,
    searchRadiusM: SEARCH_RADIUS_M,
    minNeighbors: MIN_NEIGHBORS,
    zOffsetM: Z_OFFSET_M,
    levels: LEVELS,
    gridSize: [grid.cols, grid.rows],
    validGridNodeCount: grid.validNodeCount,
    sourceBounds: payload.sourceBounds,
    sceneBounds: payload.sceneBounds,
  };

  const geojson = {
    type: "FeatureCollection",
    name: "Shahbazi tie-point support isolines",
    properties: {
      schema: "geosee.geojson-derived-isolines.v1",
      sourcePreview: "object_points_preview.json",
      scalar: "tie_point_observation_count",
      ...commonProcessing,
      featureCount: features.length,
      segmentCount,
    },
    features,
  };

  const isolineProvenance = {
    schema: "geosee.provenance.v1",
    artifact: "tie_point_support_isolines.geojson",
    artifactType: "derived-tie-point-support-isolines-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: sourceBlock(),
    processing: {
      script: "prep/build_shahbazi_tie_point_support_isolines_geojson.mjs",
      method: `${commonProcessing.method} Marching-squares isoline extraction.`,
      ...commonProcessing,
      featureCount: features.length,
      segmentCount,
    },
    reviewStatus: reviewStatus(
      "This is an isobar-style QA line visualization of tie-point observation support. It is derived from sparse photogrammetry control data and is not a pressure, grade, terrain, or engineering layer.",
    ),
  };

  const isobandProvenance = {
    schema: "geosee.provenance.v1",
    artifact: "tie_point_support_isobands_mesh.json",
    artifactType: "derived-tie-point-support-isobands-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: sourceBlock(),
    processing: {
      script: "prep/build_shahbazi_tie_point_support_isolines_geojson.mjs",
      method: `${commonProcessing.method} Colored scalar mesh infill.`,
      ...commonProcessing,
      colorStops: COLOR_STOPS,
      vertexCount: isobandMesh.vertices.length / 3,
      triangleCount: isobandMesh.indices.length / 3,
      triangleWinding: commonProcessing.triangleWinding,
    },
    reviewStatus: reviewStatus(
      "This is an isoband-style QA infill visualization of tie-point observation support. It is not a measured terrain, pressure, grade, or engineering layer.",
    ),
  };

  await writeFile(ISOLINES_OUTPUT, `${JSON.stringify(geojson, null, 2)}\n`);
  await writeFile(
    ISOLINES_PROVENANCE_OUTPUT,
    `${JSON.stringify(isolineProvenance, null, 2)}\n`,
  );
  await writeFile(ISOBANDS_OUTPUT, `${JSON.stringify(isobandMesh)}\n`);
  await writeFile(
    ISOBANDS_PROVENANCE_OUTPUT,
    `${JSON.stringify(isobandProvenance, null, 2)}\n`,
  );

  console.log(
    `Wrote ${features.length} support isoline levels, ${segmentCount.toLocaleString()} line segments, ${(
      isobandMesh.indices.length / 3
    ).toLocaleString()} infill triangles`,
  );
}

function sourceBlock() {
  return {
    objectPointPreview:
      "projects/case-study-b/data/processed/shahbazi_gravel_pit/object_points_preview.json",
    rawObjectPoints:
      "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
    rawTiePoints:
      "projects/case-study-b/data/raw/shahbazi_gravel_pit/TiePoints.txt",
    citation: SHAHBAZI_FULL_CITATION,
  };
}

function reviewStatus(notes) {
  return {
    readyForDemoPreview: true,
    readyForFinalSpatialAnalysis: false,
    notes,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
