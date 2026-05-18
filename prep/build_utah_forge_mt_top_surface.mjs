import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";

const DEFAULT_INPUT_PREVIEW = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "resistivity_point_preview.json",
);
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "top_surface",
);

const GRID_SIZE_M = 2500;
const TOP_QUANTILE = 0.95;
const MIN_SAMPLES_PER_CELL = 3;
const SMOOTHING_PASSES = 2;
const UPPER_COMPONENT_FLOOR_QUANTILE = 0.1;
const DILATION_FLOOR_QUANTILE = 0.05;
const MAX_DILATION_DELTA_M = 900;
const TOPO_COLOR_STOPS = [
  { value: 0, color: "#334653" },
  { value: 0.55, color: "#898b73" },
  { value: 1, color: "#d8c99b" },
];

function parseArgs(argv) {
  const options = {
    inputPreview: DEFAULT_INPUT_PREVIEW,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputPreview = path.resolve(value);
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
  if (sortedValues.length === 0) return Number.NaN;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * fraction)),
  );
  return sortedValues[index];
}

function median(values) {
  return quantile([...values].sort((a, b) => a - b), 0.5);
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

function readOrigin(preview) {
  const origin = preview?.scenePlacement?.sceneOriginUtm;
  if (
    !origin ||
    !Number.isFinite(origin.easting_m) ||
    !Number.isFinite(origin.northing_m) ||
    !Number.isFinite(origin.elevation_m)
  ) {
    throw new Error("Pointcloud preview is missing scenePlacement.sceneOriginUtm.");
  }
  return origin;
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

function parseCellKey(key) {
  const [ix, iy] = key.split(",").map(Number);
  return { ix, iy };
}

function neighborKeys(ix, iy) {
  return [
    cellKey(ix - 1, iy),
    cellKey(ix + 1, iy),
    cellKey(ix, iy - 1),
    cellKey(ix, iy + 1),
  ];
}

function cornerNeighborKeys(ix, iy) {
  return [
    cellKey(ix - 1, iy - 1),
    cellKey(ix, iy - 1),
    cellKey(ix + 1, iy - 1),
    cellKey(ix - 1, iy),
    cellKey(ix + 1, iy),
    cellKey(ix - 1, iy + 1),
    cellKey(ix, iy + 1),
    cellKey(ix + 1, iy + 1),
  ];
}

function validatePreview(preview) {
  if (preview?.schema !== "geosee.pointcloud-preview.v1") {
    throw new Error("Input must be the Utah FORGE MT pointcloud preview JSON.");
  }
  if (!Array.isArray(preview.points)) {
    throw new Error("Pointcloud preview is missing points array.");
  }
}

function collectPreviewCells(preview) {
  validatePreview(preview);
  const cells = new Map();
  const sourcePointCount = Math.floor(preview.points.length / 3);
  let skippedRows = 0;

  for (let index = 0; index < sourcePointCount; index += 1) {
    const x = preview.points[index * 3];
    const y = preview.points[index * 3 + 1];
    const z = preview.points[index * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      skippedRows += 1;
      continue;
    }
    const ix = Math.floor(x / GRID_SIZE_M);
    const iy = Math.floor(y / GRID_SIZE_M);
    const key = cellKey(ix, iy);
    let cell = cells.get(key);
    if (!cell) {
      cell = { key, ix, iy, zs: [] };
      cells.set(key, cell);
    }
    cell.zs.push(z);
  }

  const sampledCells = new Map();
  for (const cell of cells.values()) {
    if (cell.zs.length < MIN_SAMPLES_PER_CELL) continue;
    const sortedZ = [...cell.zs].sort((a, b) => a - b);
    sampledCells.set(cell.key, {
      key: cell.key,
      ix: cell.ix,
      iy: cell.iy,
      sampleCount: cell.zs.length,
      p95Z: quantile(sortedZ, TOP_QUANTILE),
      maxZ: sortedZ[sortedZ.length - 1],
      minZ: sortedZ[0],
    });
  }

  return { sampledCells, sourcePointCount, skippedRows, rawCellCount: cells.size };
}

function largestConnectedComponent(cells) {
  const unvisited = new Set(cells.keys());
  let largest = [];

  while (unvisited.size > 0) {
    const first = unvisited.values().next().value;
    const stack = [first];
    const component = [];
    unvisited.delete(first);

    while (stack.length > 0) {
      const key = stack.pop();
      component.push(key);
      const cell = cells.get(key);
      for (const neighborKey of neighborKeys(cell.ix, cell.iy)) {
        if (!unvisited.has(neighborKey)) continue;
        unvisited.delete(neighborKey);
        stack.push(neighborKey);
      }
    }

    if (component.length > largest.length) largest = component;
  }

  return new Set(largest);
}

function buildGroundCapCells(sampledCells) {
  const topValues = [...sampledCells.values()]
    .map((cell) => cell.p95Z)
    .sort((a, b) => a - b);
  const upperFloorZ = quantile(topValues, UPPER_COMPONENT_FLOOR_QUANTILE);
  const dilationFloorZ = quantile(topValues, DILATION_FLOOR_QUANTILE);
  const upperCandidates = new Map(
    [...sampledCells.entries()].filter(([, cell]) => cell.p95Z >= upperFloorZ),
  );
  const componentKeys = largestConnectedComponent(upperCandidates);
  const capCells = new Map();

  for (const key of componentKeys) {
    const cell = sampledCells.get(key);
    capCells.set(key, {
      key,
      ix: cell.ix,
      iy: cell.iy,
      z: cell.p95Z,
      sampleCount: cell.sampleCount,
      sourceRole: "largest upper component",
    });
  }

  const dilatedCells = [];
  for (const cell of sampledCells.values()) {
    if (capCells.has(cell.key)) continue;
    if (cell.p95Z < dilationFloorZ) continue;
    const adjacentCapHeights = neighborKeys(cell.ix, cell.iy)
      .map((key) => capCells.get(key)?.z)
      .filter(Number.isFinite);
    if (adjacentCapHeights.length === 0) continue;
    const neighborHeight = median(adjacentCapHeights);
    if (Math.abs(cell.p95Z - neighborHeight) > MAX_DILATION_DELTA_M) continue;
    dilatedCells.push({
      key: cell.key,
      ix: cell.ix,
      iy: cell.iy,
      z: cell.p95Z,
      sampleCount: cell.sampleCount,
      sourceRole: "one-cell edge dilation",
    });
  }
  for (const cell of dilatedCells) capCells.set(cell.key, cell);

  return {
    capCells,
    upperFloorZ,
    dilationFloorZ,
    initialUpperCandidateCount: upperCandidates.size,
    largestComponentCount: componentKeys.size,
    dilatedCellCount: dilatedCells.length,
  };
}

function smoothCapCells(capCells) {
  let current = new Map(
    [...capCells.entries()].map(([key, cell]) => [key, { ...cell }]),
  );

  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
    const next = new Map();
    for (const [key, cell] of current.entries()) {
      const values = [cell.z];
      for (const neighborKey of cornerNeighborKeys(cell.ix, cell.iy)) {
        const neighbor = current.get(neighborKey);
        if (neighbor) values.push(neighbor.z);
      }
      next.set(key, {
        ...cell,
        z: median(values),
      });
    }
    current = next;
  }

  return current;
}

function triangulateGrid(capCells) {
  const orderedCells = [...capCells.values()].sort(
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
    const right = capCells.get(cellKey(cell.ix + 1, cell.iy));
    const up = capCells.get(cellKey(cell.ix, cell.iy + 1));
    const upRight = capCells.get(cellKey(cell.ix + 1, cell.iy + 1));
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

async function main() {
  const options = parseArgs(process.argv);
  const preview = JSON.parse(await readFile(options.inputPreview, "utf8"));
  const origin = readOrigin(preview);
  const { sampledCells, sourcePointCount, skippedRows, rawCellCount } =
    collectPreviewCells(preview);
  const capBuild = buildGroundCapCells(sampledCells);
  const smoothedCapCells = smoothCapCells(capBuild.capCells);
  const triangulation = triangulateGrid(smoothedCapCells);

  const vertices = [];
  const colors = [];
  const sceneBounds = makeBounds();
  for (const cell of triangulation.orderedCells) {
    const x = (cell.ix + 0.5) * GRID_SIZE_M;
    const y = (cell.iy + 0.5) * GRID_SIZE_M;
    includeBounds(sceneBounds, x, y, cell.z);
  }
  for (const cell of triangulation.orderedCells) {
    const x = (cell.ix + 0.5) * GRID_SIZE_M;
    const y = (cell.iy + 0.5) * GRID_SIZE_M;
    vertices.push(round(x, 3), round(y, 3), round(cell.z, 3));
    const color = topologyColorAtElevation(cell.z, sceneBounds.minZ, sceneBounds.maxZ);
    colors.push(...color.map((channel) => round(channel, 5)));
  }

  const meshPath = path.join(options.outputDir, "mt_top_surface_mesh_preview.json");
  const manifestPath = path.join(options.outputDir, "manifest.json");
  const statsPath = path.join(options.outputDir, "stats.json");
  const provenancePath = path.join(options.outputDir, "provenance.json");
  const relativeInputPreview = path
    .relative(process.cwd(), options.inputPreview)
    .replaceAll("\\", "/");
  const relativeMeshPath = path.relative(process.cwd(), meshPath).replaceAll("\\", "/");
  const sceneBoundsPayload = boundsTuple(sceneBounds);

  const meshPayload = {
    schema: "geosee.mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT preview-derived ground cap",
    vertices,
    colors,
    indices: triangulation.indices,
    material: {
      side: "double",
      note: "Double-sided standalone approximate ground cap derived only from the existing MT resistivity preview. Colors are elevation/topology colors, independent of the MT resistivity legend.",
    },
    source: {
      dataset: "Utah FORGE Phase 3 MT resistivity model preview",
      sourcePreview: relativeInputPreview,
      classification: "source-derived inversion model preview ground cap",
      pointRole:
        "regular-grid p95 upper-cap samples from the 90,000-point MT resistivity model preview only",
    },
    sourceBounds: sourceBoundsFromSceneBounds(sceneBounds, origin),
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
        "Preview-derived approximate ground cap from regular XY bins over the existing Utah FORGE Phase 3 MT resistivity model preview.",
      topologyInference:
        "Cells use p95 scene-Z values, sparse/deep exterior bins are rejected, only the largest connected upper component is retained, one local edge dilation is allowed, and triangles connect only adjacent grid cells.",
      gridSizeM: GRID_SIZE_M,
      topQuantile: TOP_QUANTILE,
      minSamplesPerCell: MIN_SAMPLES_PER_CELL,
      upperComponentFloorQuantile: UPPER_COMPONENT_FLOOR_QUANTILE,
      dilationFloorQuantile: DILATION_FLOOR_QUANTILE,
      maxDilationDeltaM: MAX_DILATION_DELTA_M,
      smoothingPasses: SMOOTHING_PASSES,
      sourcePreviewPointCount: sourcePointCount,
      skippedRows,
      rawGridCellCount: rawCellCount,
      sampledGridCellCount: sampledCells.size,
      initialUpperCandidateCount: capBuild.initialUpperCandidateCount,
      largestComponentCellCount: capBuild.largestComponentCount,
      dilatedCellCount: capBuild.dilatedCellCount,
      vertexCount: triangulation.orderedCells.length,
      retainedQuadCount: triangulation.retainedQuadCount,
      triangleCount: triangulation.triangleCount,
      upperFloorZ: round(capBuild.upperFloorZ, 3),
      dilationFloorZ: round(capBuild.dilationFloorZ, 3),
      colorRole: "standalone elevation/topology surface colors",
      notes: [
        "This is a standalone approximate ground cap generated only from the existing 90,000-point Utah FORGE Phase 3 MT resistivity model preview.",
        "Only the existing MT resistivity point preview JSON is read by this surface generator.",
        "It is not connected to the MT scalar trim/feather legend or any resistivity subset decomposition.",
        "It intentionally avoids raw sparse-column top triangulation because that creates vertical icicle sheets.",
        "This is not measured ground terrain or interpreted geology.",
        "No seismic, wells, faults, terrain, infrastructure, or other future data family is processed.",
      ],
    },
  };

  const stats = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "MT preview-derived ground cap stats",
    generatedDate: DERIVED_DATE,
    source: {
      preview: relativeInputPreview,
      previewPointCount: sourcePointCount,
    },
    gridSizeM: GRID_SIZE_M,
    topQuantile: TOP_QUANTILE,
    minSamplesPerCell: MIN_SAMPLES_PER_CELL,
    rawGridCellCount: rawCellCount,
    sampledGridCellCount: sampledCells.size,
    initialUpperCandidateCount: capBuild.initialUpperCandidateCount,
    largestComponentCellCount: capBuild.largestComponentCount,
    dilatedCellCount: capBuild.dilatedCellCount,
    smoothingPasses: SMOOTHING_PASSES,
    vertexCount: triangulation.orderedCells.length,
    retainedQuadCount: triangulation.retainedQuadCount,
    triangleCount: triangulation.triangleCount,
    upperFloorZ: round(capBuild.upperFloorZ, 3),
    dilationFloorZ: round(capBuild.dilationFloorZ, 3),
    sourceBounds: meshPayload.sourceBounds,
    sceneBounds: sceneBoundsPayload,
  };

  const surfaceManifest = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "manifest.json",
    generatedDate: DERIVED_DATE,
    classification: "source-derived inversion model preview ground cap",
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
    artifactType: "preview-derived-mt-ground-cap",
    projectSlug: "utah-forge",
    createdDate: DERIVED_DATE,
    source: {
      preview: relativeInputPreview,
      sourceClassification: "preview-derived only",
    },
    transform: meshPayload.scenePlacement,
    processing: meshPayload.processing,
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "Approximate ground cap from the existing 90,000-point MT resistivity preview only. Not surveyed terrain, not an interpreted geological contact, and not a seismic product.",
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
    `Wrote MT preview ground cap with ${triangulation.orderedCells.length.toLocaleString()} vertices and ${triangulation.triangleCount.toLocaleString()} triangles.`,
  );
  console.log(path.relative(process.cwd(), meshPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
