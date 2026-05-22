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
const DEFAULT_OUTPUT_DIR = path.join(
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
  "resistivity_model",
);
const DEFAULT_TARGET_PREVIEW_POINTS = 90000;

function parseArgs(argv) {
  const options = {
    inputZip: DEFAULT_INPUT_ZIP,
    zipEntry: DEFAULT_ZIP_ENTRY,
    transformPath: DEFAULT_TRANSFORM_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    targetPreviewPoints: DEFAULT_TARGET_PREVIEW_POINTS,
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
    } else if (arg === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (arg === "--target-points" && value) {
      options.targetPreviewPoints = Math.max(1000, Number.parseInt(value, 10));
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

function boundsJson(bounds, labels = ["x", "y", "z"]) {
  return {
    [`min${labels[0]}`]: round(bounds.minX),
    [`max${labels[0]}`]: round(bounds.maxX),
    [`min${labels[1]}`]: round(bounds.minY),
    [`max${labels[1]}`]: round(bounds.maxY),
    [`min${labels[2]}`]: round(bounds.minZ),
    [`max${labels[2]}`]: round(bounds.maxZ),
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

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)),
  );
  return sorted[index];
}

function lcg(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
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
    onRow({ northing, easting, elevation, resistivity });
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
  const origin = readOrigin(transform);
  const rand = lcg();
  const sample = [];
  const logValues = [];

  const sourceBounds = makeBounds();
  const sceneBounds = makeBounds();
  let rowCount = 0;
  let positiveCount = 0;
  let zeroOrNegativeCount = 0;
  let minResistivity = Infinity;
  let maxResistivity = -Infinity;
  let minPositiveResistivity = Infinity;
  let maxPositiveResistivity = -Infinity;

  await streamModelRows(options.inputZip, options.zipEntry, (row) => {
    rowCount += 1;
    minResistivity = Math.min(minResistivity, row.resistivity);
    maxResistivity = Math.max(maxResistivity, row.resistivity);
    includeBounds(sourceBounds, row.easting, row.northing, row.elevation);

    if (row.resistivity <= 0) {
      zeroOrNegativeCount += 1;
      return;
    }

    positiveCount += 1;
    minPositiveResistivity = Math.min(minPositiveResistivity, row.resistivity);
    maxPositiveResistivity = Math.max(maxPositiveResistivity, row.resistivity);
    const logRho = Math.log10(row.resistivity);
    logValues.push(logRho);

    const point = {
      x: row.easting - origin.easting_m,
      y: row.northing - origin.northing_m,
      z: row.elevation - origin.elevation_m,
      logRho,
      resistivity: row.resistivity,
    };
    includeBounds(sceneBounds, point.x, point.y, point.z);

    if (sample.length < options.targetPreviewPoints) {
      sample.push(point);
      return;
    }
    const replacementIndex = Math.floor(rand() * positiveCount);
    if (replacementIndex < options.targetPreviewPoints) {
      sample[replacementIndex] = point;
    }
  });

  logValues.sort((a, b) => a - b);
  sample.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);

  const q02 = quantile(logValues, 0.02);
  const q10 = quantile(logValues, 0.1);
  const q50 = quantile(logValues, 0.5);
  const q90 = quantile(logValues, 0.9);
  const q98 = quantile(logValues, 0.98);
  const logMin = logValues[0] ?? 0;
  const logMax = logValues[logValues.length - 1] ?? 1;
  const displayMin = q02 ?? logMin;
  const displayMax = q98 ?? logMax;
  const displayMid = q50 ?? (displayMin + displayMax) * 0.5;

  const points = [];
  const scalarValues = [];
  for (const point of sample) {
    points.push(round(point.x, 2), round(point.y, 2), round(point.z, 2));
    scalarValues.push(round(point.logRho, 4));
  }

  const stats = {
    project: "utah-forge",
    area: "utah_forge_phase_3",
    dataset: "electrical_resistivity",
    artifact: "model_stats.json",
    generatedDate: DERIVED_DATE,
    source: {
      archive: path.relative(process.cwd(), options.inputZip).replaceAll("\\", "/"),
      entry: options.zipEntry,
      crs: "EPSG:26912 NAD83 / UTM Zone 12N",
      fields: ["northing_m", "easting_m", "elevation_m", "resistivity_ohm_m"],
    },
    rowCount,
    positiveResistivityRowCount: positiveCount,
    zeroOrNegativeResistivityRowCount: zeroOrNegativeCount,
    resistivityOhmM: {
      min: round(minResistivity, 6),
      max: round(maxResistivity, 6),
      minPositive: round(minPositiveResistivity, 6),
      maxPositive: round(maxPositiveResistivity, 6),
    },
    log10Resistivity: {
      min: round(logMin, 6),
      p02: round(q02 ?? logMin, 6),
      p10: round(q10 ?? logMin, 6),
      p50: round(q50 ?? logMin, 6),
      p90: round(q90 ?? logMax, 6),
      p98: round(q98 ?? logMax, 6),
      max: round(logMax, 6),
      displayMin: round(displayMin, 6),
      displayMax: round(displayMax, 6),
    },
    sourceBounds: {
      easting_m: [round(sourceBounds.minX), round(sourceBounds.maxX)],
      northing_m: [round(sourceBounds.minY), round(sourceBounds.maxY)],
      elevation_m: [round(sourceBounds.minZ), round(sourceBounds.maxZ)],
    },
    sceneBounds: {
      x_m: [round(sceneBounds.minX), round(sceneBounds.maxX)],
      y_m: [round(sceneBounds.minY), round(sceneBounds.maxY)],
      z_m: [round(sceneBounds.minZ), round(sceneBounds.maxZ)],
    },
    preview: {
      targetPointCount: options.targetPreviewPoints,
      emittedPointCount: sample.length,
      sampling: "deterministic reservoir sample over every positive-resistivity source row",
      cropApplied: false,
      verticalExaggeration: 1,
    },
  };

  const preview = {
    schema: "geosee.pointcloud-preview.v1",
    label: "Utah FORGE Phase 3 MT resistivity model preview",
    points,
    source: {
      dataset: "Utah FORGE Phase 3 MT updated cell-center inversion model",
      sourceArchive: stats.source.archive,
      sourceEntry: options.zipEntry,
      classification: "source-derived inversion model",
    },
    sourceBounds: stats.sourceBounds,
    scenePlacement: {
      crs: "scene-local meters",
      axisConvention: "X east, Y north, Z up",
      sceneOriginUtm: origin,
      cropApplied: false,
      verticalExaggeration: 1,
    },
    attributes: {
      scalarValues,
      scalar: {
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
      },
    },
  };

  const provenance = {
    artifact: "resistivity_point_preview.json",
    classification: "source-derived inversion model",
    source: {
      project: "Utah FORGE",
      dataset: "GDR submission 1255 updated MT model cell-center package",
      sourceArchive: stats.source.archive,
      sourceEntry: options.zipEntry,
      sourceArchiveNote:
        "Delivered source/client file is archived under C:/GeoSee/GeoSee_Archive; repo-relative path is retained as a historical provenance identifier.",
    },
    transform: {
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
      sceneOriginUtm: origin,
      localAxes: "X east, Y north, Z up",
      verticalExaggeration: 1,
      cropApplied: false,
    },
    processing: {
      script: "prep/build_utah_forge_mt_resistivity_preview.mjs",
      generatedDate: DERIVED_DATE,
      valueTransform: "log10(resistivity_ohm_m)",
      zeroOrNegativeRule: "masked from preview because log10 is undefined",
      sampling: stats.preview.sampling,
      sourceRows: rowCount,
      positiveRows: positiveCount,
      previewPoints: sample.length,
    },
    output: {
      preview: path
        .relative(process.cwd(), path.join(options.outputDir, "resistivity_point_preview.json"))
        .replaceAll("\\", "/"),
      stats: path
        .relative(process.cwd(), path.join(options.outputDir, "model_stats.json"))
        .replaceAll("\\", "/"),
      provenance: path
        .relative(process.cwd(), path.join(options.outputDir, "model_provenance.json"))
        .replaceAll("\\", "/"),
    },
    notes: [
      "This is a low-resolution validation and presentation preview, not the final slice/volume renderer.",
      "The full source extent is sampled; no crop is applied.",
      "Vertical scale remains true 1:1 meters.",
    ],
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(
    path.join(options.outputDir, "resistivity_point_preview.json"),
    `${JSON.stringify(preview)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(options.outputDir, "model_stats.json"),
    `${JSON.stringify(stats, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(options.outputDir, "model_provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );

  console.log(`Read ${rowCount} model rows.`);
  console.log(`Wrote ${sample.length} preview points.`);
  console.log(path.relative(process.cwd(), path.join(options.outputDir, "resistivity_point_preview.json")));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
