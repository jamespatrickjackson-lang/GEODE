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
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
  "full_density",
);
const DEFAULT_TILE_POINTS = 100000;

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    zipEntry: DEFAULT_ZIP_ENTRY,
    transformPath: DEFAULT_TRANSFORM_PATH,
    statsPath: DEFAULT_STATS_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    tilePoints: DEFAULT_TILE_POINTS,
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
    } else if (arg === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (arg === "--tile-points" && value) {
      options.tilePoints = Math.max(1000, Number.parseInt(value, 10));
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

function boundsTuple(bounds) {
  return {
    min: [round(bounds.minX, 2), round(bounds.minY, 2), round(bounds.minZ, 2)],
    max: [round(bounds.maxX, 2), round(bounds.maxY, 2), round(bounds.maxZ, 2)],
  };
}

function sourceBoundsJson(bounds) {
  return {
    easting_m: [round(bounds.minX, 3), round(bounds.maxX, 3)],
    northing_m: [round(bounds.minY, 3), round(bounds.maxY, 3)],
    elevation_m: [round(bounds.minZ, 3), round(bounds.maxZ, 3)],
  };
}

function isFinitePair(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => Number.isFinite(item))
  );
}

function sourceBoundsMetadata(modelStats, fallbackBounds) {
  const statsBounds = modelStats?.sourceBounds;
  if (
    isFinitePair(statsBounds?.easting_m) &&
    isFinitePair(statsBounds?.northing_m) &&
    isFinitePair(statsBounds?.elevation_m)
  ) {
    return statsBounds;
  }
  return sourceBoundsJson(fallbackBounds);
}

function sceneBoundsMetadata(modelStats, fallbackBounds) {
  const statsBounds = modelStats?.sceneBounds;
  if (
    isFinitePair(statsBounds?.x_m) &&
    isFinitePair(statsBounds?.y_m) &&
    isFinitePair(statsBounds?.z_m)
  ) {
    return statsBounds;
  }
  return {
    x_m: [round(fallbackBounds.minX, 2), round(fallbackBounds.maxX, 2)],
    y_m: [round(fallbackBounds.minY, 2), round(fallbackBounds.maxY, 2)],
    z_m: [round(fallbackBounds.minZ, 2), round(fallbackBounds.maxZ, 2)],
  };
}

function manifestBoundsTuple(bounds) {
  return {
    min: [bounds.x_m[0], bounds.y_m[0], bounds.z_m[0]],
    max: [bounds.x_m[1], bounds.y_m[1], bounds.z_m[1]],
  };
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

function float32Buffer(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
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

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`tar failed while reading ${zipEntry}: ${stderr}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const transform = JSON.parse(await readFile(options.transformPath, "utf8"));
  const modelStats = JSON.parse(await readFile(options.statsPath, "utf8"));
  const origin = readOrigin(transform);
  const tilesDir = path.join(options.outputDir, "tiles");
  await mkdir(tilesDir, { recursive: true });

  const sourceBounds = makeBounds();
  const sceneBounds = makeBounds();
  let rowCount = 0;
  let positiveRows = 0;
  let maskedRows = 0;
  let logMin = Infinity;
  let logMax = -Infinity;

  const tiles = [];
  let tileIndex = 0;
  let tilePointCount = 0;
  let tileBounds = makeBounds();
  let positions = new Float32Array(options.tilePoints * 3);
  let scalarValues = new Float32Array(options.tilePoints);

  const flushTile = async () => {
    if (tilePointCount === 0) return;
    const id = `tile_${String(tileIndex).padStart(4, "0")}`;
    const positionFile = `tiles/${id}.positions.bin`;
    const scalarFile = `tiles/${id}.scalars.bin`;
    await writeFile(
      path.join(options.outputDir, positionFile),
      float32Buffer(positions.subarray(0, tilePointCount * 3)),
    );
    await writeFile(
      path.join(options.outputDir, scalarFile),
      float32Buffer(scalarValues.subarray(0, tilePointCount)),
    );
    tiles.push({
      id,
      file: positionFile,
      scalarFile,
      pointCount: tilePointCount,
      sceneBounds: boundsTuple(tileBounds),
      byteType: "float32",
    });

    tileIndex += 1;
    tilePointCount = 0;
    tileBounds = makeBounds();
    positions = new Float32Array(options.tilePoints * 3);
    scalarValues = new Float32Array(options.tilePoints);
  };

  await streamModelRows(options.inputZip, options.zipEntry, async (row) => {
    rowCount += 1;
    includeBounds(sourceBounds, row.easting, row.northing, row.elevation);

    if (row.resistivity <= 0) {
      maskedRows += 1;
      return;
    }

    positiveRows += 1;
    const x = row.easting - origin.easting_m;
    const y = row.northing - origin.northing_m;
    const z = row.elevation - origin.elevation_m;
    const logRho = Math.log10(row.resistivity);
    includeBounds(sceneBounds, x, y, z);
    includeBounds(tileBounds, x, y, z);
    logMin = Math.min(logMin, logRho);
    logMax = Math.max(logMax, logRho);

    const offset = tilePointCount * 3;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    scalarValues[tilePointCount] = logRho;
    tilePointCount += 1;

    if (tilePointCount >= options.tilePoints) {
      await flushTile();
    }
  });
  await flushTile();

  const displayMin = modelStats.log10Resistivity?.displayMin ?? logMin;
  const displayMax = modelStats.log10Resistivity?.displayMax ?? logMax;
  const displayMid =
    modelStats.log10Resistivity?.p50 ?? displayMin + (displayMax - displayMin) * 0.5;
  const relativeInput = path
    .relative(process.cwd(), options.inputZip)
    .replaceAll("\\", "/");
  const manifestPath = path.join(options.outputDir, "manifest.json");
  const provenancePath = path.join(options.outputDir, "provenance.json");
  const statsPath = path.join(options.outputDir, "stats.json");

  const scalar = {
    name: "log10 resistivity",
    unit: "log10(ohm-m)",
    sourceField: "resistivity_ohm_m",
    min: round(logMin, 6),
    max: round(logMax, 6),
    displayMin: round(displayMin, 6),
    displayMax: round(displayMax, 6),
    colorStops: [
      { value: round(displayMin, 6), color: "#2cc9ff" },
      { value: round(displayMid, 6), color: "#f8dd6d" },
      { value: round(displayMax, 6), color: "#ff637a" },
    ],
  };
  const sourceBoundsForMetadata = sourceBoundsMetadata(modelStats, sourceBounds);
  const sceneBoundsForMetadata = sceneBoundsMetadata(modelStats, sceneBounds);

  const stats = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "full-density MT point-cloud stats",
    generatedDate: DERIVED_DATE,
    source: {
      archive: relativeInput,
      entry: options.zipEntry,
      crs: "EPSG:26912 NAD83 / UTM Zone 12N",
      fields: ["northing_m", "easting_m", "elevation_m", "resistivity_ohm_m"],
    },
    rowCount,
    emittedPointCount: positiveRows,
    positiveResistivityRowCount: positiveRows,
    zeroOrNegativeResistivityRowCount: maskedRows,
    tileCount: tiles.length,
    tilePointTarget: options.tilePoints,
    log10Resistivity: scalar,
    sourceBounds: sourceBoundsForMetadata,
    sceneBounds: sceneBoundsForMetadata,
    transform: {
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
      localAxes: "X east, Y north, Z up",
    },
  };

  const manifest = {
    schema: "geosee.tiled-pointcloud-preview.v1",
    label: "Utah FORGE Phase 3 MT resistivity full-density model",
    source: {
      dataset: "Utah FORGE Phase 3 MT updated cell-center inversion model",
      sourceArchive: relativeInput,
      sourceEntry: options.zipEntry,
      classification: "source-derived inversion model full-density visualization",
      pointRole: "inversion model cell centers with positive resistivity",
    },
    sourceBounds: stats.sourceBounds,
    sceneBounds: manifestBoundsTuple(sceneBoundsForMetadata),
    scenePlacement: {
      crs: "scene-local meters",
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      axisConvention: "X east, Y north, Z up",
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    attributes: {
      scalar,
      encoding: {
        positions: "Float32Array XYZ triplets",
        scalarValues: "Float32Array one value per point",
      },
    },
    tiles,
    statsFile: path.relative(options.outputDir, statsPath).replaceAll("\\", "/"),
    provenanceFile: path
      .relative(options.outputDir, provenancePath)
      .replaceAll("\\", "/"),
  };

  const provenance = {
    artifact: "full-density tiled MT resistivity point cloud",
    classification: "source-derived inversion model full-density visualization",
    source: {
      project: "Utah FORGE",
      dataset: "GDR submission 1255 updated MT model cell-center package",
      sourceArchive: relativeInput,
      sourceEntry: options.zipEntry,
      sourceArchiveNote: "Delivered source/client file retained under client_preprocessed.",
    },
    transform: manifest.scenePlacement,
    processing: {
      script: "prep/build_utah_forge_mt_resistivity_full_density.mjs",
      generatedDate: DERIVED_DATE,
      valueTransform: "log10(resistivity_ohm_m)",
      zeroOrNegativeRule: "masked from full-density tile output because log10 is undefined",
      sourceRows: rowCount,
      emittedPoints: positiveRows,
      maskedRows,
      tileCount: tiles.length,
      tilePointTarget: options.tilePoints,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    outputs: {
      manifest: path.relative(process.cwd(), manifestPath).replaceAll("\\", "/"),
      stats: path.relative(process.cwd(), statsPath).replaceAll("\\", "/"),
      provenance: path
        .relative(process.cwd(), provenancePath)
        .replaceAll("\\", "/"),
      tiles: tiles.map((tile) => ({
        id: tile.id,
        positions: path
          .relative(process.cwd(), path.join(options.outputDir, tile.file))
          .replaceAll("\\", "/"),
        scalars: path
          .relative(process.cwd(), path.join(options.outputDir, tile.scalarFile))
          .replaceAll("\\", "/"),
        pointCount: tile.pointCount,
      })),
    },
    limitations: [
      "This renders all positive-resistivity model cell centers, not a volumetric voxel surface.",
      "The source model's deep negative elevation extent is preserved and still needs careful narration before client-facing story work.",
      "No seismic, Southwestern/regional MT, wells, faults, terrain, or infrastructure data is included in this artifact.",
    ],
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  console.log(`Read ${rowCount} model rows.`);
  console.log(`Wrote ${positiveRows} full-density points in ${tiles.length} tiles.`);
  console.log(path.relative(process.cwd(), manifestPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
