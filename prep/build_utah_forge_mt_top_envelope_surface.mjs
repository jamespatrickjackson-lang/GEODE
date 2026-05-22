import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Delaunator from "delaunator";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";

const DEFAULT_INPUT_MANIFEST = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "full_density",
  "manifest.json",
);
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "top_envelope_surface",
);

const XY_PRECISION_M = 0.01;
const MAX_BRIDGE_EDGE_M = 10_000;
const SURFACE_ELEVATION_MIN_M = 1500;
const SURFACE_ELEVATION_MAX_M = 3500;
const SURFACE_ELEVATION_STOPS = [
  { value: 0, color: "#5147b8" },
  { value: 0.25, color: "#2e8fd8" },
  { value: 0.5, color: "#4fc3c7" },
  { value: 0.75, color: "#93d66b" },
  { value: 1, color: "#fff24d" },
];

function parseArgs(argv) {
  const options = {
    inputManifest: DEFAULT_INPUT_MANIFEST,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputManifest = path.resolve(value);
      index += 1;
    } else if (arg === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function quantile(sortedValues, fraction) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * fraction)),
  );
  return sortedValues[index];
}

function summarize(values, decimals = 3) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: round(quantile(sorted, 0) ?? 0, decimals),
    p50: round(quantile(sorted, 0.5) ?? 0, decimals),
    p90: round(quantile(sorted, 0.9) ?? 0, decimals),
    p95: round(quantile(sorted, 0.95) ?? 0, decimals),
    p99: round(quantile(sorted, 0.99) ?? 0, decimals),
    max: round(quantile(sorted, 1) ?? 0, decimals),
  };
}

function makeBounds() {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
}

function includeBounds(bounds, x, y, z) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function boundsTuple(bounds, decimals = 2) {
  return {
    min: [
      round(bounds.minX, decimals),
      round(bounds.minY, decimals),
      round(bounds.minZ, decimals),
    ],
    max: [
      round(bounds.maxX, decimals),
      round(bounds.maxY, decimals),
      round(bounds.maxZ, decimals),
    ],
  };
}

function sourceBoundsFromSceneBounds(sceneBounds, origin) {
  return {
    easting_m: [
      round(sceneBounds.minX + origin.easting_m, 3),
      round(sceneBounds.maxX + origin.easting_m, 3),
    ],
    northing_m: [
      round(sceneBounds.minY + origin.northing_m, 3),
      round(sceneBounds.maxY + origin.northing_m, 3),
    ],
    elevation_m: [
      round(sceneBounds.minZ + origin.elevation_m, 3),
      round(sceneBounds.maxZ + origin.elevation_m, 3),
    ],
  };
}

function sourcePoint(scenePoint, origin) {
  return {
    scene: scenePoint.map((value) => round(value, 3)),
    sourceUtm: [
      round(scenePoint[0] + origin.easting_m, 3),
      round(scenePoint[1] + origin.northing_m, 3),
      round(scenePoint[2] + origin.elevation_m, 3),
    ],
  };
}

function safeHexToRgb(hex) {
  const raw = hex.replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw;
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return [1, 1, 1];
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function colorAt(value, stops) {
  if (value <= stops[0].value) return safeHexToRgb(stops[0].color);
  const last = stops[stops.length - 1];
  if (value >= last.value) return safeHexToRgb(last.color);
  for (let index = 1; index < stops.length; index += 1) {
    const high = stops[index];
    const low = stops[index - 1];
    if (value > high.value) continue;
    const t = Math.max(
      0,
      Math.min(1, (value - low.value) / Math.max(1e-9, high.value - low.value)),
    );
    const a = safeHexToRgb(low.color);
    const b = safeHexToRgb(high.color);
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }
  return safeHexToRgb(last.color);
}

function elevationColor(z) {
  const t = Math.max(
    0,
    Math.min(
      1,
      (z - SURFACE_ELEVATION_MIN_M) /
        Math.max(1e-9, SURFACE_ELEVATION_MAX_M - SURFACE_ELEVATION_MIN_M),
    ),
  );
  return colorAt(t, SURFACE_ELEVATION_STOPS);
}

function xyKey(x, y) {
  const scale = 1 / XY_PRECISION_M;
  return `${Math.round(x * scale) / scale},${Math.round(y * scale) / scale}`;
}

function readOrigin(manifest) {
  const origin = manifest?.scenePlacement?.sceneOriginUtm;
  if (
    !origin ||
    !Number.isFinite(origin.easting_m) ||
    !Number.isFinite(origin.northing_m) ||
    !Number.isFinite(origin.elevation_m)
  ) {
    throw new Error("Full-density manifest is missing scenePlacement.sceneOriginUtm.");
  }
  return origin;
}

function validateManifest(manifest) {
  if (manifest?.schema !== "geosee.tiled-pointcloud-preview.v1") {
    throw new Error("Input must be the Utah FORGE MT full-density tile manifest.");
  }
  if (!Array.isArray(manifest.tiles) || manifest.tiles.length === 0) {
    throw new Error("Full-density manifest is missing tile entries.");
  }
}

function float32ArrayFromBuffer(buffer) {
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("Binary tile length is not divisible by Float32 byte size.");
  }
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

async function collectObservedTopPoints(manifest, manifestPath) {
  validateManifest(manifest);
  const inputDir = path.dirname(manifestPath);
  const topByColumn = new Map();
  let sourcePointCount = 0;
  let skippedRows = 0;

  for (const tile of manifest.tiles) {
    const positionsPath = path.join(inputDir, tile.file);
    const scalarsPath = path.join(inputDir, tile.scalarFile);
    const [positionsBuffer, scalarsBuffer] = await Promise.all([
      readFile(positionsPath),
      readFile(scalarsPath),
    ]);
    const positions = float32ArrayFromBuffer(positionsBuffer);
    const scalars = float32ArrayFromBuffer(scalarsBuffer);
    if (positions.length % 3 !== 0) {
      throw new Error(`Invalid XYZ position tile: ${tile.file}`);
    }
    if (scalars.length !== positions.length / 3) {
      throw new Error(`Scalar tile length mismatch: ${tile.scalarFile}`);
    }

    for (let index = 0; index < scalars.length; index += 1) {
      sourcePointCount += 1;
      const offset = index * 3;
      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];
      const scalar = scalars[index];
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z) ||
        !Number.isFinite(scalar)
      ) {
        skippedRows += 1;
        continue;
      }
      const key = xyKey(x, y);
      const existing = topByColumn.get(key);
      if (!existing || z > existing.z) {
        topByColumn.set(key, {
          key,
          x,
          y,
          z,
          scalar,
          columnPointCount: (existing?.columnPointCount ?? 0) + 1,
        });
      } else {
        existing.columnPointCount += 1;
      }
    }
  }

  const topPoints = [...topByColumn.values()].sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );
  return {
    topPoints,
    sourcePointCount,
    skippedRows,
  };
}

function triangleEdgeStats(a, b, c) {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const bc = Math.hypot(b.x - c.x, b.y - c.y);
  const ca = Math.hypot(c.x - a.x, c.y - a.y);
  return {
    edgeLengths: [ab, bc, ca],
    maxEdge: Math.max(ab, bc, ca),
    area: Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2,
  };
}

function triangulateObservedTopPoints(topPoints) {
  if (topPoints.length < 3) {
    throw new Error("At least three observed top points are required.");
  }

  const triangulation = Delaunator.from(topPoints, (point) => point.x, (point) => point.y);
  const retainedOriginalTriangles = [];
  const allEdgeLengths = [];
  const retainedEdgeLengths = [];
  const droppedMaxEdges = [];
  const retainedAreas = [];
  const droppedAreas = [];
  let droppedBridgeTriangleCount = 0;

  for (let index = 0; index < triangulation.triangles.length; index += 3) {
    const ia = triangulation.triangles[index];
    const ib = triangulation.triangles[index + 1];
    const ic = triangulation.triangles[index + 2];
    const edgeStats = triangleEdgeStats(
      topPoints[ia],
      topPoints[ib],
      topPoints[ic],
    );
    allEdgeLengths.push(...edgeStats.edgeLengths);
    if (edgeStats.maxEdge > MAX_BRIDGE_EDGE_M) {
      droppedBridgeTriangleCount += 1;
      droppedMaxEdges.push(edgeStats.maxEdge);
      droppedAreas.push(edgeStats.area);
      continue;
    }
    retainedOriginalTriangles.push([ia, ib, ic]);
    retainedEdgeLengths.push(...edgeStats.edgeLengths);
    retainedAreas.push(edgeStats.area);
  }

  const usedOriginalIndices = new Set();
  for (const triangle of retainedOriginalTriangles) {
    for (const originalIndex of triangle) usedOriginalIndices.add(originalIndex);
  }
  const orderedOriginalIndices = [...usedOriginalIndices].sort((a, b) => a - b);
  const remap = new Map();
  orderedOriginalIndices.forEach((originalIndex, nextIndex) => {
    remap.set(originalIndex, nextIndex);
  });

  const indices = [];
  for (const triangle of retainedOriginalTriangles) {
    indices.push(remap.get(triangle[0]), remap.get(triangle[1]), remap.get(triangle[2]));
  }

  return {
    topPoints: orderedOriginalIndices.map((index) => topPoints[index]),
    indices,
    allTriangleCount: triangulation.triangles.length / 3,
    retainedTriangleCount: retainedOriginalTriangles.length,
    droppedBridgeTriangleCount,
    unusedObservedTopPointCount: topPoints.length - orderedOriginalIndices.length,
    hullPointCount: triangulation.hull.length,
    edgeStats: {
      allEdgeLengthM: summarize(allEdgeLengths),
      retainedEdgeLengthM: summarize(retainedEdgeLengths),
      droppedBridgeMaxEdgeM: summarize(droppedMaxEdges),
      retainedTriangleAreaM2: summarize(retainedAreas),
      droppedBridgeTriangleAreaM2: summarize(droppedAreas),
    },
  };
}

function controlPointsForPoints(points, origin) {
  const byMinZ = points.reduce((best, point) => (point.z < best.z ? point : best));
  const byMaxZ = points.reduce((best, point) => (point.z > best.z ? point : best));
  const byMinX = points.reduce((best, point) => (point.x < best.x ? point : best));
  const byMaxX = points.reduce((best, point) => (point.x > best.x ? point : best));
  const byMinY = points.reduce((best, point) => (point.y < best.y ? point : best));
  const byMaxY = points.reduce((best, point) => (point.y > best.y ? point : best));
  const center = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  center.x /= points.length;
  center.y /= points.length;
  const byCenter = points.reduce(
    (best, point) => {
      const distSq = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      return distSq < best.distSq ? { point, distSq } : best;
    },
    { point: points[0], distSq: Infinity },
  ).point;

  const toPayload = (point) => ({
    ...sourcePoint([point.x, point.y, point.z], origin),
    log10Resistivity: round(point.scalar, 6),
    columnPointCount: point.columnPointCount,
    sourceRole: "observed-top-point",
  });

  return {
    minElevation: toPayload(byMinZ),
    maxElevation: toPayload(byMaxZ),
    westEdge: toPayload(byMinX),
    eastEdge: toPayload(byMaxX),
    southEdge: toPayload(byMinY),
    northEdge: toPayload(byMaxY),
    centerNearest: toPayload(byCenter),
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const manifest = JSON.parse(await readFile(options.inputManifest, "utf8"));
  const origin = readOrigin(manifest);
  const observed = await collectObservedTopPoints(manifest, options.inputManifest);
  const mesh = triangulateObservedTopPoints(observed.topPoints);

  const vertices = [];
  const colors = [];
  const scalarValues = [];
  const columnPointCounts = [];
  const sceneBounds = makeBounds();
  const observedBounds = makeBounds();

  for (const point of observed.topPoints) {
    includeBounds(observedBounds, point.x, point.y, point.z);
  }

  for (const point of mesh.topPoints) {
    includeBounds(sceneBounds, point.x, point.y, point.z);
    vertices.push(round(point.x, 3), round(point.y, 3), round(point.z, 3));
    scalarValues.push(round(point.scalar, 6));
    columnPointCounts.push(point.columnPointCount);
    colors.push(...elevationColor(point.z).map((channel) => round(channel, 5)));
  }

  const meshPath = path.join(options.outputDir, "mt_top_envelope_surface_mesh_preview.json");
  const manifestPath = path.join(options.outputDir, "manifest.json");
  const statsPath = path.join(options.outputDir, "stats.json");
  const provenancePath = path.join(options.outputDir, "provenance.json");
  const relativeInputManifest = path
    .relative(process.cwd(), options.inputManifest)
    .replaceAll("\\", "/");
  const relativeMeshPath = path.relative(process.cwd(), meshPath).replaceAll("\\", "/");
  const relativeStatsPath = path.relative(process.cwd(), statsPath).replaceAll("\\", "/");
  const relativeProvenancePath = path
    .relative(process.cwd(), provenancePath)
    .replaceAll("\\", "/");
  const sceneBoundsPayload = boundsTuple(sceneBounds);
  const observedBoundsPayload = boundsTuple(observedBounds);
  const sourceBoundsPayload = sourceBoundsFromSceneBounds(sceneBounds, origin);
  const observedSourceBoundsPayload = sourceBoundsFromSceneBounds(observedBounds, origin);
  const controlPoints = controlPointsForPoints(mesh.topPoints, origin);

  const scalarRange = {
    name: "top-envelope log10 resistivity",
    unit: "log10(ohm-m)",
    sourceField: "full-density observed top-point scalar",
    min: round(Math.min(...scalarValues), 6),
    max: round(Math.max(...scalarValues), 6),
    displayMin: manifest.attributes?.scalar?.displayMin,
    displayMax: manifest.attributes?.scalar?.displayMax,
    colorStops: manifest.attributes?.scalar?.colorStops,
  };

  const commonProcessing = {
    script: "prep/build_utah_forge_mt_top_envelope_surface.mjs",
    generatedDate: DERIVED_DATE,
    method:
      "Observed top-envelope surface from the full-density MT cell-center tile set. The top-most source point is retained per unique XY column and triangulated directly in observed scene coordinates.",
    topology:
      "Delaunay triangulation of observed top points only. Triangles with max edge longer than the bridge cutoff are removed. No rectangular support grid, IDW fill, inferred exterior nodes, smoothing pass, uniform regrid, or flattened surface treatment is used.",
    xyPrecisionM: XY_PRECISION_M,
    maxBridgeEdgeM: MAX_BRIDGE_EDGE_M,
    sourceFullDensityPointCount: observed.sourcePointCount,
    skippedRows: observed.skippedRows,
    observedTopPointCount: observed.topPoints.length,
    renderedVertexCount: mesh.topPoints.length,
    unusedObservedTopPointCount: mesh.unusedObservedTopPointCount,
    delaunayTriangleCount: mesh.allTriangleCount,
    retainedTriangleCount: mesh.retainedTriangleCount,
    droppedBridgeTriangleCount: mesh.droppedBridgeTriangleCount,
    hullPointCount: mesh.hullPointCount,
    edgeStats: mesh.edgeStats,
    elevationColorRamp: {
      role: "top-point elevation colors",
      minM: SURFACE_ELEVATION_MIN_M,
      maxM: SURFACE_ELEVATION_MAX_M,
      stops: SURFACE_ELEVATION_STOPS,
    },
    controlPoints,
    notes: [
      "This is not public topo, lidar, DEM terrain, or measured ground.",
      "This is not an interpreted geological contact, reservoir boundary, well surface, fault, or seismic horizon.",
      "Surface fidelity follows observed MT top-point support: denser areas render finer; sparse extent areas render coarser or remain open.",
      "No exterior fill is fabricated where observed top-point support is absent or too weak.",
      "Visible vertex colors encode top-point elevation for spatial readability; top-contact resistivity values remain scalar metadata.",
    ],
  };

  const meshPayload = {
    schema: "geosee.mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT observed top-envelope surface",
    vertices,
    colors,
    indices: mesh.indices,
    attributes: {
      scalarValues,
      columnPointCounts,
      scalar: scalarRange,
    },
    material: {
      side: "double",
      flatShading: true,
      note: "Observed top-envelope surface derived directly from full-density MT cell-center top points. Vertex colors encode top-point elevation, not resistivity.",
    },
    source: {
      dataset: "Utah FORGE Phase 3 MT resistivity full-density model",
      fullDensityManifest: relativeInputManifest,
      sourceClassification: manifest.source?.classification,
      classification: "source-derived full-density inversion model observed top-envelope surface",
      pointRole: "top-most observed source-derived full-density MT cell center per unique XY column",
    },
    sourceBounds: sourceBoundsPayload,
    observedSourceBounds: observedSourceBoundsPayload,
    sceneBounds: sceneBoundsPayload,
    observedSceneBounds: observedBoundsPayload,
    scenePlacement: {
      crs: "scene-local meters",
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      axisConvention: "X east, Y north, Z up",
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    processing: commonProcessing,
  };

  const stats = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "MT observed top-envelope surface stats",
    generatedDate: DERIVED_DATE,
    source: {
      fullDensityManifest: relativeInputManifest,
      fullDensityPointCount: observed.sourcePointCount,
      tileCount: manifest.tiles.length,
    },
    processing: commonProcessing,
    sourceBounds: sourceBoundsPayload,
    observedSourceBounds: observedSourceBoundsPayload,
    sceneBounds: sceneBoundsPayload,
    observedSceneBounds: observedBoundsPayload,
    topEnvelopeLog10ResistivityRange: scalarRange,
    cartographicControlPoints: controlPoints,
  };

  const surfaceManifest = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "manifest.json",
    generatedDate: DERIVED_DATE,
    classification: "source-derived full-density inversion model observed top-envelope surface",
    source: meshPayload.source,
    outputs: {
      meshPreview: relativeMeshPath,
      stats: relativeStatsPath,
      provenance: relativeProvenancePath,
    },
    processing: commonProcessing,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "mt_top_envelope_surface_mesh_preview.json",
    artifactType: "full-density-mt-observed-top-envelope-surface",
    projectSlug: "utah-forge",
    createdDate: DERIVED_DATE,
    source: {
      fullDensityManifest: relativeInputManifest,
      sourceClassification: manifest.source?.classification,
    },
    transform: meshPayload.scenePlacement,
    processing: commonProcessing,
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "Observed top-envelope from the full-density MT model cell-center tiles. Not measured terrain, not interpreted geology, and not a seismic product.",
    },
  };

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeFile(meshPath, `${JSON.stringify(meshPayload)}\n`, "utf8"),
    writeFile(manifestPath, `${JSON.stringify(surfaceManifest, null, 2)}\n`, "utf8"),
    writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8"),
    writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote MT observed top-envelope surface with ${mesh.topPoints.length.toLocaleString()} vertices and ${mesh.retainedTriangleCount.toLocaleString()} triangles.`,
  );
  console.log(path.relative(process.cwd(), meshPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
