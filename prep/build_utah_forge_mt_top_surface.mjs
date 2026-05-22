import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
  "top_surface",
);

const GRID_SIZE_M = 2500;
const MIN_POINTS_PER_CELL = 3;
const TOPO_COLOR_STOPS = [
  { value: 0, color: "#334653" },
  { value: 0.55, color: "#898b73" },
  { value: 1, color: "#d8c99b" },
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

function topologyColorAtElevation(z, minZ, maxZ) {
  const t = Math.max(0, Math.min(1, (z - minZ) / Math.max(1e-9, maxZ - minZ)));
  return colorAt(t, TOPO_COLOR_STOPS);
}

function cellKey(ix, iy) {
  return `${ix},${iy}`;
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

async function collectFullDensityTopContacts(manifest, manifestPath) {
  validateManifest(manifest);
  const inputDir = path.dirname(manifestPath);
  const cells = new Map();
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
      const ix = Math.floor(x / GRID_SIZE_M);
      const iy = Math.floor(y / GRID_SIZE_M);
      const key = cellKey(ix, iy);
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          key,
          ix,
          iy,
          sampleCount: 0,
          topContactZ: -Infinity,
          topContactX: x,
          topContactY: y,
          topContactScalar: scalar,
          minZ: Infinity,
          maxZ: -Infinity,
        };
        cells.set(key, cell);
      }
      cell.sampleCount += 1;
      cell.minZ = Math.min(cell.minZ, z);
      cell.maxZ = Math.max(cell.maxZ, z);
      if (z > cell.topContactZ) {
        cell.topContactZ = z;
        cell.topContactX = x;
        cell.topContactY = y;
        cell.topContactScalar = scalar;
      }
    }
  }

  const sampledCells = new Map();
  for (const [key, cell] of cells.entries()) {
    if (cell.sampleCount < MIN_POINTS_PER_CELL) continue;
    sampledCells.set(key, cell);
  }

  return {
    sampledCells,
    sourcePointCount,
    skippedRows,
    rawCellCount: cells.size,
  };
}

function triangulateGrid(cells) {
  const orderedCells = [...cells.values()].sort(
    (a, b) => a.iy - b.iy || a.ix - b.ix,
  );
  const vertexIndexByKey = new Map();
  orderedCells.forEach((cell, index) => {
    vertexIndexByKey.set(cell.key, index);
  });

  const indices = [];
  let candidateQuadCount = 0;
  let retainedQuadCount = 0;

  for (const cell of orderedCells) {
    const right = cells.get(cellKey(cell.ix + 1, cell.iy));
    const up = cells.get(cellKey(cell.ix, cell.iy + 1));
    const upRight = cells.get(cellKey(cell.ix + 1, cell.iy + 1));
    if (!right || !up || !upRight) continue;
    candidateQuadCount += 1;
    retainedQuadCount += 1;
    const a = vertexIndexByKey.get(cell.key);
    const b = vertexIndexByKey.get(right.key);
    const c = vertexIndexByKey.get(upRight.key);
    const d = vertexIndexByKey.get(up.key);
    indices.push(a, b, c, a, c, d);
  }

  return {
    orderedCells,
    indices,
    candidateQuadCount,
    retainedQuadCount,
    triangleCount: indices.length / 3,
  };
}

function controlPointsForCells(cells, origin) {
  const values = [...cells.values()];
  const byMinZ = values.reduce((best, cell) =>
    cell.topContactZ < best.topContactZ ? cell : best,
  );
  const byMaxZ = values.reduce((best, cell) =>
    cell.topContactZ > best.topContactZ ? cell : best,
  );
  const byMinX = values.reduce((best, cell) =>
    cell.topContactX < best.topContactX ? cell : best,
  );
  const byMaxX = values.reduce((best, cell) =>
    cell.topContactX > best.topContactX ? cell : best,
  );
  const byMinY = values.reduce((best, cell) =>
    cell.topContactY < best.topContactY ? cell : best,
  );
  const byMaxY = values.reduce((best, cell) =>
    cell.topContactY > best.topContactY ? cell : best,
  );
  const center = values.reduce(
    (acc, cell) => {
      acc.x += cell.topContactX;
      acc.y += cell.topContactY;
      return acc;
    },
    { x: 0, y: 0 },
  );
  center.x /= values.length;
  center.y /= values.length;
  const byCenter = values.reduce((best, cell) => {
    const distSq =
      (cell.topContactX - center.x) ** 2 + (cell.topContactY - center.y) ** 2;
    return distSq < best.distSq ? { cell, distSq } : best;
  }, { cell: values[0], distSq: Infinity }).cell;

  const toPayload = (cell) => ({
    ...sourcePoint(
      [cell.topContactX, cell.topContactY, cell.topContactZ],
      origin,
    ),
    log10Resistivity: round(cell.topContactScalar, 6),
    sampleCount: cell.sampleCount,
    gridCell: [cell.ix, cell.iy],
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
  const fullDensity = await collectFullDensityTopContacts(
    manifest,
    options.inputManifest,
  );
  const triangulation = triangulateGrid(fullDensity.sampledCells);

  const vertices = [];
  const colors = [];
  const scalarValues = [];
  const sceneBounds = makeBounds();
  for (const cell of triangulation.orderedCells) {
    includeBounds(
      sceneBounds,
      cell.topContactX,
      cell.topContactY,
      cell.topContactZ,
    );
  }
  for (const cell of triangulation.orderedCells) {
    vertices.push(
      round(cell.topContactX, 3),
      round(cell.topContactY, 3),
      round(cell.topContactZ, 3),
    );
    scalarValues.push(round(cell.topContactScalar, 6));
    const color = topologyColorAtElevation(
      cell.topContactZ,
      sceneBounds.minZ,
      sceneBounds.maxZ,
    );
    colors.push(...color.map((channel) => round(channel, 5)));
  }

  const meshPath = path.join(options.outputDir, "mt_top_surface_mesh_preview.json");
  const manifestPath = path.join(options.outputDir, "manifest.json");
  const statsPath = path.join(options.outputDir, "stats.json");
  const provenancePath = path.join(options.outputDir, "provenance.json");
  const relativeInputManifest = path
    .relative(process.cwd(), options.inputManifest)
    .replaceAll("\\", "/");
  const relativeMeshPath = path.relative(process.cwd(), meshPath).replaceAll("\\", "/");
  const sceneBoundsPayload = boundsTuple(sceneBounds);
  const sourceBoundsPayload = sourceBoundsFromSceneBounds(sceneBounds, origin);
  const controlPoints = controlPointsForCells(
    triangulation.orderedCells,
    origin,
  );

  const meshPayload = {
    schema: "geosee.mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT full-density top-contact surface",
    vertices,
    colors,
    indices: triangulation.indices,
    attributes: {
      scalarValues,
      scalar: {
        name: "top-contact log10 resistivity",
        unit: "log10(ohm-m)",
        sourceField: "full-density top-contact cell scalar",
        min: round(Math.min(...scalarValues), 6),
        max: round(Math.max(...scalarValues), 6),
        displayMin: manifest.attributes?.scalar?.displayMin,
        displayMax: manifest.attributes?.scalar?.displayMax,
        colorStops: manifest.attributes?.scalar?.colorStops,
      },
    },
    material: {
      side: "double",
      note: "Double-sided top-contact surface derived from the full-density MT cell-center tile set. Vertex colors encode top-contact elevation, not resistivity.",
    },
    source: {
      dataset: "Utah FORGE Phase 3 MT resistivity full-density model",
      fullDensityManifest: relativeInputManifest,
      sourceClassification: manifest.source?.classification,
      classification: "source-derived full-density inversion model top-contact surface",
      pointRole:
        "top-most source-derived full-density MT cell center retained per XY grid cell",
    },
    sourceBounds: sourceBoundsPayload,
    sceneBounds: sceneBoundsPayload,
    scenePlacement: {
      crs: "scene-local meters",
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      axisConvention: "X east, Y north, Z up",
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    processing: {
      script: "prep/build_utah_forge_mt_top_surface.mjs",
      generatedDate: DERIVED_DATE,
      method:
        "Top-contact surface from the full-density MT cell-center tile set. For each 2.5 km XY grid cell, the highest source-derived cell center is retained as the surface contact point.",
      topologyInference:
        "Adjacent occupied XY cells are triangulated into a renderable surface. No terrain, lidar, seismic, wells, faults, infrastructure, or interpreted geology are used.",
      gridSizeM: GRID_SIZE_M,
      minPointsPerCell: MIN_POINTS_PER_CELL,
      sourceFullDensityPointCount: fullDensity.sourcePointCount,
      skippedRows: fullDensity.skippedRows,
      rawGridCellCount: fullDensity.rawCellCount,
      sampledGridCellCount: fullDensity.sampledCells.size,
      vertexCount: triangulation.orderedCells.length,
      candidateQuadCount: triangulation.candidateQuadCount,
      retainedQuadCount: triangulation.retainedQuadCount,
      triangleCount: triangulation.triangleCount,
      colorRole: "top-contact elevation colors",
      controlPoints,
      notes: [
        "This is not public topo, lidar, DEM terrain, or measured ground.",
        "This is not an interpreted geological contact, reservoir boundary, well surface, fault, or seismic horizon.",
        "This is the top contact of the existing source-derived full-density MT cell-center visualization.",
        "Resistivity values are preserved as per-vertex scalar metadata; visible vertex colors encode contact elevation for spatial readability.",
      ],
    },
  };

  const stats = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "MT full-density top-contact surface stats",
    generatedDate: DERIVED_DATE,
    source: {
      fullDensityManifest: relativeInputManifest,
      fullDensityPointCount: fullDensity.sourcePointCount,
      tileCount: manifest.tiles.length,
    },
    gridSizeM: GRID_SIZE_M,
    minPointsPerCell: MIN_POINTS_PER_CELL,
    skippedRows: fullDensity.skippedRows,
    rawGridCellCount: fullDensity.rawCellCount,
    sampledGridCellCount: fullDensity.sampledCells.size,
    vertexCount: triangulation.orderedCells.length,
    candidateQuadCount: triangulation.candidateQuadCount,
    retainedQuadCount: triangulation.retainedQuadCount,
    triangleCount: triangulation.triangleCount,
    sourceBounds: sourceBoundsPayload,
    sceneBounds: sceneBoundsPayload,
    topContactLog10ResistivityRange: meshPayload.attributes.scalar,
    cartographicControlPoints: controlPoints,
  };

  const surfaceManifest = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "manifest.json",
    generatedDate: DERIVED_DATE,
    classification: "source-derived full-density inversion model top-contact surface",
    source: meshPayload.source,
    outputs: {
      meshPreview: relativeMeshPath,
      stats: path.relative(process.cwd(), statsPath).replaceAll("\\", "/"),
      provenance: path.relative(process.cwd(), provenancePath).replaceAll("\\", "/"),
    },
    processing: meshPayload.processing,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "mt_top_surface_mesh_preview.json",
    artifactType: "full-density-mt-top-contact-surface",
    projectSlug: "utah-forge",
    createdDate: DERIVED_DATE,
    source: {
      fullDensityManifest: relativeInputManifest,
      sourceClassification: manifest.source?.classification,
    },
    transform: meshPayload.scenePlacement,
    processing: meshPayload.processing,
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "Source-derived top contact from the full-density MT model cell-center tiles. Not measured terrain, not interpreted geology, and not a seismic product.",
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
    `Wrote MT full-density top-contact surface with ${triangulation.orderedCells.length.toLocaleString()} vertices and ${triangulation.triangleCount.toLocaleString()} triangles.`,
  );
  console.log(path.relative(process.cwd(), meshPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
