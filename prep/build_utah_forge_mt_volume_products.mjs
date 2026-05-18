import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";

const DEFAULT_INPUT_ZIP = path.join(
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  "mt_model_cell_center_updated",
  "FORGE_MT_mdl17_cellcenter.zip",
);
const DEFAULT_ZIP_ENTRY = "FRG200614_mdl17_cellcenter.dat";
const DEFAULT_TRANSFORM_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "intake",
  "crs_transform.json",
);
const DEFAULT_STATS_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "model_stats.json",
);
const DEFAULT_STATION_PATH = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "stations",
  "mt_stations.geojson",
);
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "volume",
);

const MAX_FACES_PER_THRESHOLD = 22000;
const PRODUCTS = [
  {
    id: "mt-resistivity-full-extent-volume",
    label: "MT resistivity full-extent volume",
    description:
      "Uncropped source-derived scalar volume resampled from every positive MT cell-center inversion row.",
    dimensions: [80, 64, 56],
    crop: "full-extent",
    outputDir: "full_extent",
  },
  {
    id: "mt-resistivity-forge-focused-volume",
    label: "MT resistivity FORGE-focused volume",
    description:
      "Meeting-focused scalar volume cropped around the MT station footprint and upper 30 km of the model.",
    dimensions: [96, 80, 64],
    crop: "station-footprint-upper-model",
    outputDir: "forge_focused",
  },
];
const THRESHOLDS = [
  {
    id: "conductive-le-10-ohm-m",
    label: "Conductive shell <=10 Ohm-m",
    kind: "conductive-threshold-surface",
    comparison: "<=",
    thresholdOhmM: 10,
    color: "#2cc9ff",
  },
  {
    id: "conductive-le-30-ohm-m",
    label: "Conductive shell <=30 Ohm-m",
    kind: "conductive-threshold-surface",
    comparison: "<=",
    thresholdOhmM: 30,
    color: "#38f0b3",
  },
  {
    id: "resistive-ge-1000-ohm-m",
    label: "Resistive shell >=1000 Ohm-m",
    kind: "resistive-threshold-surface",
    comparison: ">=",
    thresholdOhmM: 1000,
    color: "#ff637a",
  },
];

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    zipEntry: DEFAULT_ZIP_ENTRY,
    transformPath: DEFAULT_TRANSFORM_PATH,
    statsPath: DEFAULT_STATS_PATH,
    stationPath: DEFAULT_STATION_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input" && value) {
      options.inputZip = path.resolve(value);
      index += 1;
    } else if (arg === "--entry" && value) {
      options.zipEntry = value;
      index += 1;
    } else if (arg === "--transform" && value) {
      options.transformPath = path.resolve(value);
      index += 1;
    } else if (arg === "--stats" && value) {
      options.statsPath = path.resolve(value);
      index += 1;
    } else if (arg === "--stations" && value) {
      options.stationPath = path.resolve(value);
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

function readOrigin(transform) {
  const origin = transform?.scene_transform?.scene_origin_utm;
  if (
    !origin ||
    !Number.isFinite(origin.easting_m) ||
    !Number.isFinite(origin.northing_m) ||
    !Number.isFinite(origin.elevation_m)
  ) {
    throw new Error("crs_transform.json is missing scene_transform.scene_origin_utm.");
  }
  return origin;
}

function readSceneBounds(stats) {
  const x = stats?.sceneBounds?.x_m;
  const y = stats?.sceneBounds?.y_m;
  const z = stats?.sceneBounds?.z_m;
  if (
    !Array.isArray(x) ||
    !Array.isArray(y) ||
    !Array.isArray(z) ||
    x.length !== 2 ||
    y.length !== 2 ||
    z.length !== 2
  ) {
    throw new Error("model_stats.json is missing sceneBounds.");
  }
  return {
    minX: x[0],
    maxX: x[1],
    minY: y[0],
    maxY: y[1],
    minZ: z[0],
    maxZ: z[1],
  };
}

function sceneBoundsTuple(bounds) {
  return {
    min: [round(bounds.minX, 3), round(bounds.minY, 3), round(bounds.minZ, 3)],
    max: [round(bounds.maxX, 3), round(bounds.maxY, 3), round(bounds.maxZ, 3)],
  };
}

function clampBounds(bounds, modelBounds) {
  return {
    minX: Math.max(modelBounds.minX, bounds.minX),
    maxX: Math.min(modelBounds.maxX, bounds.maxX),
    minY: Math.max(modelBounds.minY, bounds.minY),
    maxY: Math.min(modelBounds.maxY, bounds.maxY),
    minZ: Math.max(modelBounds.minZ, bounds.minZ),
    maxZ: Math.min(modelBounds.maxZ, bounds.maxZ),
  };
}

function stationSceneBounds(collection) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const feature of collection.features ?? []) {
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 3) continue;
    const [x, y, z] = coordinates;
    if (![x, y, z].every(Number.isFinite)) continue;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  if (!Number.isFinite(bounds.minX)) {
    throw new Error("MT station GeoJSON has no valid scene coordinates.");
  }
  return bounds;
}

function productBounds(product, modelBounds, stationBounds) {
  if (product.crop === "full-extent") return modelBounds;
  const padX = Math.max(8000, (stationBounds.maxX - stationBounds.minX) * 0.08);
  const padY = Math.max(8000, (stationBounds.maxY - stationBounds.minY) * 0.08);
  return clampBounds(
    {
      minX: stationBounds.minX - padX,
      maxX: stationBounds.maxX + padX,
      minY: stationBounds.minY - padY,
      maxY: stationBounds.maxY + padY,
      minZ: -30000,
      maxZ: Math.min(modelBounds.maxZ, Math.max(3500, stationBounds.maxZ + 1000)),
    },
    modelBounds,
  );
}

function makeAccumulator(product, bounds, scalarRange) {
  const [nx, ny, nz] = product.dimensions;
  const voxelCount = nx * ny * nz;
  return {
    ...product,
    bounds,
    scalarRange,
    sums: new Float64Array(voxelCount),
    counts: new Uint32Array(voxelCount),
    values: new Float32Array(voxelCount),
    mask: new Uint8Array(voxelCount),
    volume: new Uint8Array(voxelCount),
    observedRows: 0,
    positiveRowsInBounds: 0,
  };
}

function bucketIndex(value, min, max, count) {
  if (value < min || value > max) return -1;
  const t = (value - min) / Math.max(1e-9, max - min);
  return Math.max(0, Math.min(count - 1, Math.floor(t * count)));
}

function volumeIndex(x, y, z, dimensions) {
  const [nx, ny] = dimensions;
  return z * nx * ny + y * nx + x;
}

function addValue(accumulator, x, y, z, value) {
  const { bounds, dimensions } = accumulator;
  const [nx, ny, nz] = dimensions;
  const xi = bucketIndex(x, bounds.minX, bounds.maxX, nx);
  const yi = bucketIndex(y, bounds.minY, bounds.maxY, ny);
  const zi = bucketIndex(z, bounds.minZ, bounds.maxZ, nz);
  if (xi < 0 || yi < 0 || zi < 0) return;
  const index = volumeIndex(xi, yi, zi, dimensions);
  accumulator.sums[index] += value;
  accumulator.counts[index] += 1;
  accumulator.positiveRowsInBounds += 1;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index];
}

function finalizeAccumulator(accumulator) {
  const { counts, sums, values, mask, volume, scalarRange } = accumulator;
  const occupiedValues = [];
  const sourceSpan = Math.max(1e-9, scalarRange.max - scalarRange.min);
  let occupiedVoxelCount = 0;
  let logMin = Infinity;
  let logMax = -Infinity;
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] <= 0) {
      values[index] = Number.NaN;
      volume[index] = 0;
      mask[index] = 0;
      continue;
    }
    const logValue = sums[index] / counts[index];
    values[index] = logValue;
    occupiedValues.push(logValue);
    occupiedVoxelCount += 1;
    logMin = Math.min(logMin, logValue);
    logMax = Math.max(logMax, logValue);
    const normalized = Math.max(
      0,
      Math.min(255, Math.round(((logValue - scalarRange.min) / sourceSpan) * 255)),
    );
    volume[index] = normalized;
    mask[index] = 255;
  }
  occupiedValues.sort((a, b) => a - b);
  const stats = {
    productId: accumulator.id,
    label: accumulator.label,
    generatedDate: DERIVED_DATE,
    dimensions: accumulator.dimensions,
    voxelCount: counts.length,
    occupiedVoxelCount,
    emptyVoxelCount: counts.length - occupiedVoxelCount,
    sourceRowsInBounds: accumulator.positiveRowsInBounds,
    occupancyFraction: round(occupiedVoxelCount / Math.max(1, counts.length), 6),
    log10Resistivity: {
      min: round(Number.isFinite(logMin) ? logMin : scalarRange.min, 6),
      p02: round(percentile(occupiedValues, 0.02) ?? scalarRange.min, 6),
      p50: round(percentile(occupiedValues, 0.5) ?? scalarRange.min, 6),
      p98: round(percentile(occupiedValues, 0.98) ?? scalarRange.max, 6),
      max: round(Number.isFinite(logMax) ? logMax : scalarRange.max, 6),
      sourceMin: scalarRange.min,
      sourceMax: scalarRange.max,
      displayMin: scalarRange.displayMin,
      displayMax: scalarRange.displayMax,
    },
    sceneBounds: sceneBoundsTuple(accumulator.bounds),
  };
  accumulator.stats = stats;
  return stats;
}

async function streamModelRows(inputZip, zipEntry, onRow) {
  const child = spawn("tar", ["-xOf", inputZip, zipEntry], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const rl = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    const northing = Number.parseFloat(parts[0]);
    const easting = Number.parseFloat(parts[1]);
    const elevation = Number.parseFloat(parts[2]);
    const resistivity = Number.parseFloat(parts[3]);
    if (
      !Number.isFinite(northing) ||
      !Number.isFinite(easting) ||
      !Number.isFinite(elevation) ||
      !Number.isFinite(resistivity)
    ) {
      continue;
    }
    await onRow({ northing, easting, elevation, resistivity });
  }

  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  if (exitCode !== 0) {
    throw new Error(`tar failed while reading ${zipEntry}: ${stderr}`);
  }
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function conditionMatches(value, threshold) {
  if (!Number.isFinite(value)) return false;
  const thresholdLog = Math.log10(threshold.thresholdOhmM);
  return threshold.comparison === "<=" ? value <= thresholdLog : value >= thresholdLog;
}

function countBoundaryFaces(accumulator, threshold) {
  const [nx, ny, nz] = accumulator.dimensions;
  const { values, mask } = accumulator;
  let count = 0;
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const index = volumeIndex(x, y, z, accumulator.dimensions);
        if (mask[index] === 0 || !conditionMatches(values[index], threshold)) continue;
        const neighbors = [
          [x - 1, y, z],
          [x + 1, y, z],
          [x, y - 1, z],
          [x, y + 1, z],
          [x, y, z - 1],
          [x, y, z + 1],
        ];
        for (const [nxi, nyi, nzi] of neighbors) {
          if (nxi < 0 || nyi < 0 || nzi < 0 || nxi >= nx || nyi >= ny || nzi >= nz) {
            count += 1;
            continue;
          }
          const neighborIndex = volumeIndex(nxi, nyi, nzi, accumulator.dimensions);
          if (mask[neighborIndex] === 0 || !conditionMatches(values[neighborIndex], threshold)) {
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

function cellBoundaryCoordinate(min, max, count, index) {
  return min + ((max - min) * index) / count;
}

function faceCorners(accumulator, x, y, z, side) {
  const [nx, ny, nz] = accumulator.dimensions;
  const { bounds } = accumulator;
  const x0 = cellBoundaryCoordinate(bounds.minX, bounds.maxX, nx, x);
  const x1 = cellBoundaryCoordinate(bounds.minX, bounds.maxX, nx, x + 1);
  const y0 = cellBoundaryCoordinate(bounds.minY, bounds.maxY, ny, y);
  const y1 = cellBoundaryCoordinate(bounds.minY, bounds.maxY, ny, y + 1);
  const z0 = cellBoundaryCoordinate(bounds.minZ, bounds.maxZ, nz, z);
  const z1 = cellBoundaryCoordinate(bounds.minZ, bounds.maxZ, nz, z + 1);
  if (side === 0) return [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]];
  if (side === 1) return [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]];
  if (side === 2) return [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]];
  if (side === 3) return [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  if (side === 4) return [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
  return [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]];
}

function addFace(mesh, corners, color, scalarValue) {
  const vertexStart = mesh.vertices.length / 3;
  for (const corner of corners) {
    mesh.vertices.push(round(corner[0], 2), round(corner[1], 2), round(corner[2], 2));
    mesh.colors.push(color[0], color[1], color[2]);
    mesh.scalarValues.push(round(scalarValue, 6));
  }
  mesh.indices.push(
    vertexStart,
    vertexStart + 1,
    vertexStart + 2,
    vertexStart,
    vertexStart + 2,
    vertexStart + 3,
  );
}

function appendThresholdSurface(mesh, accumulator, threshold) {
  const candidateFaces = countBoundaryFaces(accumulator, threshold);
  const stride = Math.max(1, Math.ceil(candidateFaces / MAX_FACES_PER_THRESHOLD));
  const [nx, ny, nz] = accumulator.dimensions;
  const { values, mask } = accumulator;
  const color = hexToRgb(threshold.color);
  const vertexStart = mesh.vertices.length / 3;
  const indexStart = mesh.indices.length;
  let candidateIndex = 0;
  let emittedFaces = 0;
  let valueSum = 0;
  let valueCount = 0;

  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const index = volumeIndex(x, y, z, accumulator.dimensions);
        const value = values[index];
        if (mask[index] === 0 || !conditionMatches(value, threshold)) continue;
        valueSum += value;
        valueCount += 1;
        const neighbors = [
          [x - 1, y, z],
          [x + 1, y, z],
          [x, y - 1, z],
          [x, y + 1, z],
          [x, y, z - 1],
          [x, y, z + 1],
        ];
        for (let side = 0; side < neighbors.length; side += 1) {
          const [nxi, nyi, nzi] = neighbors[side];
          let boundary = false;
          if (nxi < 0 || nyi < 0 || nzi < 0 || nxi >= nx || nyi >= ny || nzi >= nz) {
            boundary = true;
          } else {
            const neighborIndex = volumeIndex(nxi, nyi, nzi, accumulator.dimensions);
            boundary =
              mask[neighborIndex] === 0 ||
              !conditionMatches(values[neighborIndex], threshold);
          }
          if (!boundary) continue;
          if (candidateIndex % stride === 0) {
            addFace(mesh, faceCorners(accumulator, x, y, z, side), color, value);
            emittedFaces += 1;
          }
          candidateIndex += 1;
        }
      }
    }
  }

  const vertexCount = mesh.vertices.length / 3 - vertexStart;
  const indexCount = mesh.indices.length - indexStart;
  return {
    id: threshold.id,
    label: threshold.label,
    kind: threshold.kind,
    comparison: threshold.comparison,
    thresholdOhmM: threshold.thresholdOhmM,
    thresholdLog10: round(Math.log10(threshold.thresholdOhmM), 6),
    color: threshold.color,
    candidateBoundaryFaceCount: candidateFaces,
    emittedBoundaryFaceCount: emittedFaces,
    decimationStride: stride,
    matchingVoxelCount: valueCount,
    meanLog10Resistivity: round(valueCount > 0 ? valueSum / valueCount : 0, 6),
    meshRange: {
      vertexStart,
      vertexCount,
      indexStart,
      indexCount,
    },
    classification: "source-derived iso-resistivity communication surface",
    caveat:
      "Generated from a resampled MT inversion volume for visualization; not an interpreted geological contact, ore body, target, fault, or mineralization shell.",
  };
}

function buildThresholdMesh(accumulator, options) {
  const mesh = {
    vertices: [],
    colors: [],
    scalarValues: [],
    indices: [],
  };
  const thresholdSurfaces = THRESHOLDS.map((threshold) =>
    appendThresholdSurface(mesh, accumulator, threshold),
  );
  return {
    schema: "geosee.scalar-grid-mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT source-derived threshold surfaces",
    source: {
      project: "Utah FORGE",
      dataset: "Phase 3 MT updated cell-center resistivity inversion model",
      sourceArchive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
      sourceEntry: options.zipEntry,
      productId: accumulator.id,
    },
    sceneBounds: sceneBoundsTuple(accumulator.bounds),
    material: {
      side: "double",
      note: "Vertex colors distinguish source-derived threshold surfaces.",
    },
    attributes: {
      scalarValues: mesh.scalarValues,
      scalar: {
        name: "log10 resistivity",
        unit: "log10 Ohm-m",
        min: accumulator.scalarRange.min,
        max: accumulator.scalarRange.max,
        displayMin: accumulator.scalarRange.displayMin,
        displayMax: accumulator.scalarRange.displayMax,
      },
    },
    processing: {
      script: "prep/build_utah_forge_mt_volume_products.mjs",
      generatedDate: DERIVED_DATE,
      sourceProductId: accumulator.id,
      thresholdSurfaces,
      caveats: [
        "Source-derived threshold surfaces are fixed visualization meshes generated from the resampled scalar volume.",
        "They are not faults, horizons, mineralization, ore bodies, targets, or resource estimates.",
        "Surfaces are decimated for browser preview performance.",
      ],
    },
    vertices: mesh.vertices,
    colors: mesh.colors,
    indices: mesh.indices,
  };
}

async function writeProduct(accumulator, options) {
  const productDir = path.join(options.outputDir, accumulator.outputDir);
  await mkdir(productDir, { recursive: true });
  await writeFile(path.join(productDir, "volume.u8"), Buffer.from(accumulator.volume));
  await writeFile(path.join(productDir, "mask.u8"), Buffer.from(accumulator.mask));
  await writeFile(
    path.join(productDir, "stats.json"),
    `${JSON.stringify(accumulator.stats, null, 2)}\n`,
    "utf8",
  );
  const provenance = {
    artifact: `${accumulator.outputDir}/volume.u8`,
    classification: "source-derived MT inversion scalar volume",
    source: {
      project: "Utah FORGE",
      dataset: "GDR submission 1255 updated MT model cell-center inversion package",
      sourceArchive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
      sourceEntry: options.zipEntry,
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
    },
    transform: {
      sceneCrs: "local meters, X east, Y north, Z up",
      verticalExaggeration: 1,
      crop: accumulator.crop,
      resampling: "cell-center bin average into regular browser volume",
      scalarEncoding:
        "uint8 normalized over source log10 resistivity range; mask.u8 defines occupied voxels",
    },
    processing: {
      script: "prep/build_utah_forge_mt_volume_products.mjs",
      generatedDate: DERIVED_DATE,
      dimensions: accumulator.dimensions,
      sourceRowsInBounds: accumulator.positiveRowsInBounds,
      occupiedVoxelCount: accumulator.stats.occupiedVoxelCount,
    },
    caveats: [
      "Source-derived visualization volume resampled from the inversion model.",
      "Empty voxels are transparent through mask.u8.",
      "This is not an interpreted geological model, target, or resource estimate.",
    ],
  };
  await writeFile(
    path.join(productDir, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const options = parseArgs(process.argv);
  const transform = JSON.parse(await readFile(options.transformPath, "utf8"));
  const stats = JSON.parse(await readFile(options.statsPath, "utf8"));
  const stations = JSON.parse(await readFile(options.stationPath, "utf8"));
  const origin = readOrigin(transform);
  const modelBounds = readSceneBounds(stats);
  const stationBounds = stationSceneBounds(stations);
  const scalarRange = {
    min: stats.log10Resistivity?.min ?? -2,
    max: stats.log10Resistivity?.max ?? 4.5,
    displayMin: stats.log10Resistivity?.displayMin ?? stats.log10Resistivity?.p02 ?? 0.14,
    displayMax: stats.log10Resistivity?.displayMax ?? stats.log10Resistivity?.p98 ?? 3.94,
  };
  const accumulators = PRODUCTS.map((product) =>
    makeAccumulator(product, productBounds(product, modelBounds, stationBounds), scalarRange),
  );

  let rowCount = 0;
  let positiveRows = 0;
  let maskedRows = 0;
  await streamModelRows(options.inputZip, options.zipEntry, async (row) => {
    rowCount += 1;
    if (!(row.resistivity > 0)) {
      maskedRows += 1;
      return;
    }
    positiveRows += 1;
    const x = row.easting - origin.easting_m;
    const y = row.northing - origin.northing_m;
    const z = row.elevation - origin.elevation_m;
    const logValue = Math.log10(row.resistivity);
    for (const accumulator of accumulators) {
      accumulator.observedRows += 1;
      addValue(accumulator, x, y, z, logValue);
    }
  });

  await mkdir(options.outputDir, { recursive: true });
  const productEntries = [];
  for (const accumulator of accumulators) {
    finalizeAccumulator(accumulator);
    await writeProduct(accumulator, options);
    productEntries.push({
      id: accumulator.id,
      label: accumulator.label,
      description: accumulator.description,
      classification: "source-derived MT inversion scalar volume",
      domain: "log10 resistivity",
      unit: "log10 Ohm-m",
      sourceRowsInBounds: accumulator.positiveRowsInBounds,
      dimensions: accumulator.dimensions,
      voxelOrder: "x-fastest, then y, then z",
      sceneBounds: sceneBoundsTuple(accumulator.bounds),
      scalarRange,
      files: {
        volume: `${accumulator.outputDir}/volume.u8`,
        mask: `${accumulator.outputDir}/mask.u8`,
        stats: `${accumulator.outputDir}/stats.json`,
        provenance: `${accumulator.outputDir}/provenance.json`,
      },
      displayRecipe: {
        opacity: accumulator.id.includes("focused") ? 0.46 : 0.34,
        density: accumulator.id.includes("focused") ? 0.72 : 0.54,
        sampleSteps: accumulator.id.includes("focused") ? 112 : 96,
        transferMode: "balanced",
        scalarWindow: [scalarRange.displayMin, scalarRange.displayMax],
        maskVisible: true,
      },
      caveats: [
        "Source-derived visualization volume resampled from MT inversion cell centers.",
        "Empty voxels are transparent through the occupancy mask.",
        "Not an interpreted geological model, target, or resource estimate.",
      ],
    });
  }

  const focused = accumulators.find((item) => item.id.includes("focused")) ?? accumulators[0];
  const thresholdDir = path.join(options.outputDir, "threshold_surfaces");
  await mkdir(thresholdDir, { recursive: true });
  const thresholdMesh = buildThresholdMesh(focused, options);
  await writeFile(
    path.join(thresholdDir, "mt_threshold_surfaces_mesh_preview.json"),
    `${JSON.stringify(thresholdMesh)}\n`,
    "utf8",
  );
  const thresholdProvenance = {
    artifact: "threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
    classification: "source-derived iso-resistivity communication surfaces",
    sourceProductId: focused.id,
    sourceVolume: `${focused.outputDir}/volume.u8`,
    sourceMask: `${focused.outputDir}/mask.u8`,
    generatedDate: DERIVED_DATE,
    script: "prep/build_utah_forge_mt_volume_products.mjs",
    caveats: thresholdMesh.processing.caveats,
  };
  await writeFile(
    path.join(thresholdDir, "provenance.json"),
    `${JSON.stringify(thresholdProvenance, null, 2)}\n`,
    "utf8",
  );

  const manifest = {
    schema: "geosee.scalar-volume.v1",
    label: "Utah FORGE Phase 3 MT resistivity volumes",
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    generatedDate: DERIVED_DATE,
    source: {
      archive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
      entry: options.zipEntry,
      crs: "EPSG:26912 NAD83 / UTM Zone 12N",
      fields: ["northing_m", "easting_m", "elevation_m", "resistivity_ohm_m"],
    },
    scene: {
      crs: "local meters, X east, Y north, Z up",
      sceneOriginUtm: origin,
    },
    rowCounts: {
      sourceRows: rowCount,
      positiveResistivityRows: positiveRows,
      zeroOrNegativeRows: maskedRows,
    },
    scalar: {
      name: "log10 resistivity",
      unit: "log10 Ohm-m",
      sourceRange: [scalarRange.min, scalarRange.max],
      displayRange: [scalarRange.displayMin, scalarRange.displayMax],
      normalizedEncoding: "uint8",
      maskEncoding: "uint8 occupancy, 255 occupied and 0 empty",
    },
    products: productEntries,
    thresholdSurfaces: {
      file: "threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
      provenance: "threshold_surfaces/provenance.json",
      sourceProductId: focused.id,
      surfaces: thresholdMesh.processing.thresholdSurfaces,
    },
    displayRecipes: [
      {
        id: "mt-volume-investor-focused",
        label: "MT focused volume",
        productId: "mt-resistivity-forge-focused-volume",
        opacity: 0.46,
        density: 0.72,
        sampleSteps: 112,
        transferMode: "balanced",
        thresholdSurfaces: ["conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
      },
      {
        id: "mt-volume-full-extent-context",
        label: "MT full-extent context",
        productId: "mt-resistivity-full-extent-volume",
        opacity: 0.34,
        density: 0.54,
        sampleSteps: 96,
        transferMode: "soft",
        thresholdSurfaces: [],
      },
    ],
    caveats: [
      "Volumes are source-derived browser resamplings of the MT inversion cell-center model.",
      "Threshold surfaces are source-derived iso-resistivity communication surfaces, not interpreted geology.",
      "This dataset is public geothermal demo data and not a mineral resource estimate.",
    ],
  };
  await writeFile(
    path.join(options.outputDir, "mt_volume_manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${productEntries.length} MT volume products.`);
  console.log(path.relative(process.cwd(), path.join(options.outputDir, "mt_volume_manifest.json")));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
