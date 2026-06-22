import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import {
  DERIVED_DATE,
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT,
} from "./utah_forge_config.mjs";
import {
  extractMaskAwareMarchingCubes,
  supersampleFieldTricubic,
} from "./lib/marchingCubes.mjs";
import {
  supportFeatherAlphaField,
  removeSmallComponents3d,
} from "./lib/confidence.mjs";

const REPO_RELATIVE_INPUT_ZIP_REF =
  "projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip";
const ARCHIVE_ROOT = process.env.GEOSEE_ARCHIVE_ROOT || "C:/GeoSee/GeoSee_Archive";
const REPO_INPUT_ZIP = path.join(
  UTAH_FORGE_PHASE3_MT_CLIENT_ROOT,
  "mt_model_cell_center_updated",
  "FORGE_MT_mdl17_cellcenter.zip",
);
const ARCHIVE_INPUT_ZIP = path.join(ARCHIVE_ROOT, REPO_RELATIVE_INPUT_ZIP_REF);
const DEFAULT_INPUT_ZIP = existsSync(REPO_INPUT_ZIP) ? REPO_INPUT_ZIP : ARCHIVE_INPUT_ZIP;
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

// Single uncropped product (DEC supersede: no focused/full-extent duality).
// Full lateral extent; depth bounded to resolved data support (the deep
// halfspace below this is a large unconstrained void, not real structure).
const DEPTH_FLOOR_M = -20000;
// Grid spacing target ~ source core density. Render fineness comes from mesh
// subdivision, not grid blow-up, so this stays near source density.
const TARGET_SPACING_M = 730;
// Continuity-first reconstruction kernel (in voxel units) and the minimum
// blended weight required to treat a voxel as supported. Larger sigma / smaller
// weight bridge wider same-surface gaps; far unconstrained voids stay empty.
const RECON_SIGMA_VOXELS = 2.5;
const RECON_MIN_WEIGHT = 0.05;
// R1: surfaces are extracted from a tricubic-supersampled field at this factor
// (finer, smooth → no grid terracing). The volume render assets stay coarse.
const SURFACE_SUPERSAMPLE = 2;
// R10 (DEC-181, feather-first): uncertainty feathering only — NO extent clip.
// The full model is kept; only the sparsest CONF_FEATHER_PERCENTILE of occupied
// voxels by MT data support fade their opacity toward zero (the genuine
// unreliable outer rind). 95% of the model stays fully solid. Surfaces only;
// the volume-render mask/values are untouched. Tunable; recorded in provenance.
//
// DISABLED for now (2026-06-21) per user: the data-support proxy is not the
// right confidence signal yet. Surfaces render at full opacity. Flip
// CONF_FEATHER_ENABLED back to true to re-enable (the full feather path is
// retained). When revisiting, prefer a better confidence basis than raw
// data-support density.
const CONF_FEATHER_ENABLED = false;
const CONF_FEATHER_PERCENTILE = 0.05;
// Surface-mask despeckle: drop disconnected components smaller than this many
// voxels before extraction. Extent-preserving (no confidence clip) — removes
// only isolated noise islands, not real structure.
const SURFACE_MIN_ISLAND_VOXELS = 8;

const PRODUCTS = [
  {
    id: "mt-resistivity-full-extent-volume",
    label: "MT resistivity volume",
    description:
      "Single uncropped source-derived scalar volume reconstructed from every positive MT cell-center inversion row (full lateral extent, depth bounded to resolved data support).",
    crop: "uncropped-depth-bounded",
    outputDir: "full_extent",
  },
];
const ISOSURFACE_PRODUCT_IDS = {
  "mt-resistivity-full-extent-volume": {
    id: "mt-isosurface-full-extent",
    label: "MT iso-resistivity surfaces",
    cropStatus: "full-source",
    classification: "source-derived iso-resistivity surfaces",
  },
};
const SEMANTIC_THRESHOLDS = [
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
const PRECOMPUTED_BANK_BOUNDARY_COUNT = 20;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgbToHex([r, g, b]) {
  const parts = [r, g, b].map((value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${parts.join("")}`;
}

function bankBoundaryColor(t) {
  const low = [44, 201, 255];
  const mid = [248, 221, 109];
  const high = [255, 99, 122];
  if (t <= 0.5) {
    const local = t / 0.5;
    return rgbToHex([
      lerp(low[0], mid[0], local),
      lerp(low[1], mid[1], local),
      lerp(low[2], mid[2], local),
    ]);
  }
  const local = (t - 0.5) / 0.5;
  return rgbToHex([
    lerp(mid[0], high[0], local),
    lerp(mid[1], high[1], local),
    lerp(mid[2], high[2], local),
  ]);
}

function thresholdSlug(value) {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return value.toFixed(1).replace(".", "p").replace(/p0$/, "");
  return value.toFixed(2).replace(".", "p").replace(/0+$/, "").replace(/p$/, "");
}

function thresholdLabel(comparison, thresholdOhmM) {
  const value =
    thresholdOhmM >= 100
      ? Math.round(thresholdOhmM).toLocaleString("en-US")
      : thresholdOhmM >= 10
        ? thresholdOhmM.toFixed(1).replace(/\.0$/, "")
        : thresholdOhmM.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${comparison}${value} Ohm-m boundary`;
}

function thresholdDefinitions(scalarRange) {
  const displayMin = scalarRange.displayMin ?? scalarRange.min;
  const displayMax = scalarRange.displayMax ?? scalarRange.max;
  const bank = [];
  for (let index = 0; index < PRECOMPUTED_BANK_BOUNDARY_COUNT; index += 1) {
    const t =
      PRECOMPUTED_BANK_BOUNDARY_COUNT <= 1
        ? 0
        : index / (PRECOMPUTED_BANK_BOUNDARY_COUNT - 1);
    const thresholdLog10 = displayMin + (displayMax - displayMin) * t;
    const thresholdOhmM = 10 ** thresholdLog10;
    const comparison = thresholdLog10 <= Math.log10(30) ? "<=" : ">=";
    const direction = comparison === "<=" ? "le" : "ge";
    bank.push({
      id: `bank-${direction}-${thresholdSlug(thresholdOhmM)}-ohm-m`,
      label: thresholdLabel(comparison, thresholdOhmM),
      kind: "precomputed-bank-threshold-surface",
      comparison,
      thresholdOhmM,
      color: bankBoundaryColor(t),
      bankIndex: index,
      bankCount: PRECOMPUTED_BANK_BOUNDARY_COUNT,
      source: "precomputed-bank",
    });
  }
  return [...bank, ...SEMANTIC_THRESHOLDS];
}

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

function sourceArchiveReference(inputZip) {
  const input = path.resolve(inputZip);
  for (const candidate of [REPO_INPUT_ZIP, ARCHIVE_INPUT_ZIP]) {
    if (path.basename(input) === path.basename(candidate)) {
      return REPO_RELATIVE_INPUT_ZIP_REF;
    }
  }
  return path.relative(process.cwd(), input).replaceAll("\\", "/");
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

function productBounds(product, modelBounds) {
  // Full lateral extent (no crop); depth floored to resolved data support.
  return {
    minX: modelBounds.minX,
    maxX: modelBounds.maxX,
    minY: modelBounds.minY,
    maxY: modelBounds.maxY,
    minZ: Math.max(modelBounds.minZ, DEPTH_FLOOR_M),
    maxZ: modelBounds.maxZ,
  };
}

function containsPoint(bounds, x, y, z) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY &&
    z >= bounds.minZ &&
    z <= bounds.maxZ
  );
}

function makeAxisStats(product) {
  return {
    productId: product.id,
    positiveRowsInBounds: 0,
  };
}

async function collectSourceAxisStats(options, origin, products) {
  const byProduct = new Map(products.map((product) => [product.id, makeAxisStats(product)]));
  await streamModelRows(options.inputZip, options.zipEntry, async (row) => {
    if (!(row.resistivity > 0)) return;
    const x = row.easting - origin.easting_m;
    const y = row.northing - origin.northing_m;
    const z = row.elevation - origin.elevation_m;
    for (const product of products) {
      if (!containsPoint(product.bounds, x, y, z)) continue;
      const axisStats = byProduct.get(product.id);
      axisStats.positiveRowsInBounds += 1;
    }
  });
  return byProduct;
}

function deriveSourceFidelityVolumeDimensions(bounds) {
  // Grid sized to a fixed target spacing (~source core density). Fineness is
  // delivered by mesh subdivision downstream, not by refining this grid.
  const extentX = Math.max(1, bounds.maxX - bounds.minX);
  const extentY = Math.max(1, bounds.maxY - bounds.minY);
  const extentZ = Math.max(1, bounds.maxZ - bounds.minZ);
  return [
    Math.max(2, Math.ceil(extentX / TARGET_SPACING_M)),
    Math.max(2, Math.ceil(extentY / TARGET_SPACING_M)),
    Math.max(2, Math.ceil(extentZ / TARGET_SPACING_M)),
  ];
}

function gaussianKernel1D(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const value = Math.exp(-0.5 * (i / sigma) ** 2);
    kernel[i + radius] = value;
    sum += value;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum;
  return { kernel, radius };
}

// Separable 3D Gaussian blur with clamped (replicate) edges. Voxel order is
// x-fastest, then y, then z (matches volumeIndex).
function blur3DSeparable(source, dimensions, sigma) {
  const [nx, ny, nz] = dimensions;
  const { kernel, radius } = gaussianKernel1D(sigma);
  const slice = nx * ny;
  let a = source;
  let b = new Float64Array(a.length);
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      const base = z * slice + y * nx;
      for (let x = 0; x < nx; x += 1) {
        let acc = 0;
        for (let t = -radius; t <= radius; t += 1) {
          let xx = x + t;
          if (xx < 0) xx = 0;
          else if (xx >= nx) xx = nx - 1;
          acc += a[base + xx] * kernel[t + radius];
        }
        b[base + x] = acc;
      }
    }
  }
  [a, b] = [b, a];
  for (let z = 0; z < nz; z += 1) {
    for (let x = 0; x < nx; x += 1) {
      const base = z * slice + x;
      for (let y = 0; y < ny; y += 1) {
        let acc = 0;
        for (let t = -radius; t <= radius; t += 1) {
          let yy = y + t;
          if (yy < 0) yy = 0;
          else if (yy >= ny) yy = ny - 1;
          acc += a[base + yy * nx] * kernel[t + radius];
        }
        b[base + y * nx] = acc;
      }
    }
  }
  [a, b] = [b, a];
  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) {
      const base = y * nx + x;
      for (let z = 0; z < nz; z += 1) {
        let acc = 0;
        for (let t = -radius; t <= radius; t += 1) {
          let zz = z + t;
          if (zz < 0) zz = 0;
          else if (zz >= nz) zz = nz - 1;
          acc += a[base + zz * slice] * kernel[t + radius];
        }
        b[base + z * slice] = acc;
      }
    }
  }
  [a, b] = [b, a];
  return a;
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
    // Capture-tier high-precision volume: normalized 0..1 (same range as the
    // uint8 `volume`) stored as Float32 to remove 8-bit banding in capture.
    volumeHigh: new Float32Array(voxelCount),
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
  const {
    counts,
    sums,
    values,
    mask,
    volume,
    volumeHigh,
    scalarRange,
    dimensions,
  } = accumulator;
  const occupiedValues = [];
  const sourceSpan = Math.max(1e-9, scalarRange.max - scalarRange.min);
  let occupiedVoxelCount = 0;
  let extrapolatedVoxelCount = 0;
  let logMin = Infinity;
  let logMax = -Infinity;
  // Continuity-first reconstruction: Gaussian-weighted blend of the binned
  // source values. The field is continuous across data gaps so iso-surfaces
  // bridge naturally (no interior holes/fragments). A weighted blend of in-range
  // source values is itself in-range, so no value is fabricated outside the
  // source range (the clamp is belt-and-suspenders). Voxels with negligible
  // nearby data (large unconstrained voids: deep halfspace, far lateral
  // padding) stay empty and produce no surfaces.
  const blurredSums = blur3DSeparable(
    Float64Array.from(sums),
    dimensions,
    RECON_SIGMA_VOXELS,
  );
  const blurredCounts = blur3DSeparable(
    Float64Array.from(counts),
    dimensions,
    RECON_SIGMA_VOXELS,
  );
  for (let index = 0; index < counts.length; index += 1) {
    if (!(blurredCounts[index] > RECON_MIN_WEIGHT)) {
      values[index] = Number.NaN;
      volume[index] = 0;
      volumeHigh[index] = 0;
      mask[index] = 0;
      continue;
    }
    let logValue = blurredSums[index] / blurredCounts[index];
    if (logValue < scalarRange.min) logValue = scalarRange.min;
    else if (logValue > scalarRange.max) logValue = scalarRange.max;
    values[index] = logValue;
    if (counts[index] <= 0) extrapolatedVoxelCount += 1;
    occupiedValues.push(logValue);
    occupiedVoxelCount += 1;
    logMin = Math.min(logMin, logValue);
    logMax = Math.max(logMax, logValue);
    const normalizedFloat = Math.max(
      0,
      Math.min(1, (logValue - scalarRange.min) / sourceSpan),
    );
    volume[index] = Math.round(normalizedFloat * 255);
    volumeHigh[index] = normalizedFloat;
    mask[index] = 255;
  }
  occupiedValues.sort((a, b) => a - b);
  // R10 (feather-first): per-voxel feather alpha field. Full extent is kept;
  // only the sparsest CONF_FEATHER_PERCENTILE of occupied voxels fade. The field
  // is sampled per surface vertex at extraction time. Disabled by flag for now.
  const feather = CONF_FEATHER_ENABLED
    ? supportFeatherAlphaField({
        blurredCounts,
        occupiedMask: mask,
        minWeight: RECON_MIN_WEIGHT,
        featherPercentile: CONF_FEATHER_PERCENTILE,
      })
    : null;
  accumulator.confidence = feather ? feather.alpha : null;
  // Surface-mask despeckle: drop tiny disconnected components before extraction.
  // Extent-preserving (no confidence clip) — only isolated noise islands go.
  const surfaceCleanup = removeSmallComponents3d(
    mask,
    dimensions,
    SURFACE_MIN_ISLAND_VOXELS,
  );
  accumulator.surfaceMask = surfaceCleanup.mask;
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
    reconstruction: {
      method: "gaussian-blend-bounded-extrapolation",
      sigmaVoxels: RECON_SIGMA_VOXELS,
      minWeight: RECON_MIN_WEIGHT,
      kernelScaleM: round(RECON_SIGMA_VOXELS * TARGET_SPACING_M, 3),
      cellScaleM: TARGET_SPACING_M,
      extrapolatedVoxelCount,
      directlySampledVoxelCount: occupiedVoxelCount - extrapolatedVoxelCount,
      inRangeClamped: true,
    },
    confidence: feather
      ? {
          provider: "mt-data-support-percentile-feather",
          metric: "Gaussian-blurred MT sample density",
          mode: "feather-only-no-extent-clip",
          featherPercentile: CONF_FEATHER_PERCENTILE,
          supportThreshold: round(feather.supportThreshold, 6),
          supportFloor: round(feather.supportFloor, 6),
          featheredVoxelCount: feather.featheredVoxelCount,
          featheredFraction: round(
            feather.featheredVoxelCount / Math.max(1, occupiedVoxelCount),
            4,
          ),
          note: "Full model kept; only the sparsest 5% of occupied voxels by MT data support feather opacity toward zero. No extent clip; volume-render mask unaffected.",
        }
      : {
          provider: "mt-data-support-percentile-feather",
          mode: "disabled",
          note: "Confidence feather disabled (CONF_FEATHER_ENABLED=false); surfaces render at full opacity.",
        },
    surfaceCleanup: {
      method: "connected-component-island-removal",
      minIslandVoxels: SURFACE_MIN_ISLAND_VOXELS,
      removedComponents: surfaceCleanup.removedComponents,
      removedVoxels: surfaceCleanup.removedVoxels,
      removedFraction: round(
        surfaceCleanup.removedVoxels / Math.max(1, occupiedVoxelCount),
        6,
      ),
      note: "Extent-preserving despeckle of the surface extraction mask; no confidence clip.",
    },
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

function voxelSpacing(bounds, dimensions) {
  const [nx, ny, nz] = dimensions;
  return {
    x_m: round((bounds.maxX - bounds.minX) / nx, 3),
    y_m: round((bounds.maxY - bounds.minY) / ny, 3),
    z_m: round((bounds.maxZ - bounds.minZ) / nz, 3),
  };
}

function isosurfaceProductForAccumulator(accumulator) {
  const product = ISOSURFACE_PRODUCT_IDS[accumulator.id];
  if (!product) {
    throw new Error(`Missing isosurface product metadata for ${accumulator.id}`);
  }
  return product;
}

function appendMarchingCubesSurface(mesh, accumulator, threshold) {
  const isoProduct = isosurfaceProductForAccumulator(accumulator);
  const color = hexToRgb(threshold.color);
  const vertexStart = mesh.vertices.length / 3;
  const indexStart = mesh.indices.length;
  let valueSum = 0;
  let valueCount = 0;
  for (let index = 0; index < accumulator.values.length; index += 1) {
    const value = accumulator.values[index];
    if (accumulator.mask[index] !== 0 && conditionMatches(value, threshold)) {
      valueSum += value;
      valueCount += 1;
    }
  }

  const extracted = extractMaskAwareMarchingCubes({
    values: accumulator.valuesHi,
    mask: accumulator.maskHi,
    dimensions: accumulator.dimensionsHi,
    bounds: accumulator.bounds,
    thresholdLog10: Math.log10(threshold.thresholdOhmM),
    comparison: threshold.comparison,
    color,
    round,
    featherAlphaField: accumulator.confidence,
    featherDimensions: accumulator.dimensions,
  });
  const vertexOffset = mesh.vertices.length / 3;
  // Append element-by-element: spread (push(...arr)) overflows the argument
  // limit now that subdivided surfaces can contain millions of entries.
  for (let i = 0; i < extracted.vertices.length; i += 1)
    mesh.vertices.push(extracted.vertices[i]);
  for (let i = 0; i < extracted.colors.length; i += 1)
    mesh.colors.push(extracted.colors[i]);
  for (let i = 0; i < extracted.normals.length; i += 1)
    mesh.normals.push(extracted.normals[i]);
  if (extracted.alpha) {
    for (let i = 0; i < extracted.alpha.length; i += 1)
      mesh.alpha.push(extracted.alpha[i]);
  }
  for (let i = 0; i < extracted.scalarValues.length; i += 1)
    mesh.scalarValues.push(extracted.scalarValues[i]);
  for (let i = 0; i < extracted.indices.length; i += 1)
    mesh.indices.push(extracted.indices[i] + vertexOffset);

  const vertexCount = mesh.vertices.length / 3 - vertexStart;
  const indexCount = mesh.indices.length - indexStart;
  return {
    id: threshold.id,
    meshId: `${isoProduct.id}:${threshold.id}`,
    label: threshold.label,
    kind: threshold.kind,
    isoProductId: isoProduct.id,
    isoProductLabel: isoProduct.label,
    sourceProductId: accumulator.id,
    cropStatus: isoProduct.cropStatus,
    comparison: threshold.comparison,
    thresholdOhmM: threshold.thresholdOhmM,
    thresholdLog10: round(Math.log10(threshold.thresholdOhmM), 6),
    color: threshold.color,
    bankIndex: Number.isInteger(threshold.bankIndex) ? threshold.bankIndex : null,
    bankCount: Number.isInteger(threshold.bankCount) ? threshold.bankCount : null,
    boundarySource: threshold.source ?? "semantic-preset",
    extractionMethod: "mask-aware-marching-cubes",
    smoothing: extracted.stats.smoothing,
    vertexWelding: extracted.stats.welding,
    normalPolicy: "precomputed-field-gradient-normals",
    decimation: "none",
    reconstruction: "tricubic-supersample",
    supersampleFactor: SURFACE_SUPERSAMPLE,
    dimensions: accumulator.dimensionsHi,
    voxelSpacingM: voxelSpacing(accumulator.bounds, accumulator.dimensionsHi),
    marchingCubes: extracted.stats,
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

function buildThresholdMesh(accumulators, options) {
  const mesh = {
    vertices: [],
    normals: [],
    colors: [],
    alpha: [],
    scalarValues: [],
    indices: [],
  };
  const isosurfaceProducts = accumulators.map((accumulator) => ({
    ...isosurfaceProductForAccumulator(accumulator),
    sourceProductId: accumulator.id,
    dimensions: accumulator.dimensionsHi,
    sceneBounds: sceneBoundsTuple(accumulator.bounds),
    voxelSpacingM: voxelSpacing(accumulator.bounds, accumulator.dimensionsHi),
  }));
  const thresholds = thresholdDefinitions(accumulators[0].scalarRange);
  const thresholdSurfaces = accumulators.flatMap((accumulator) =>
    thresholds.map((threshold) =>
      appendMarchingCubesSurface(mesh, accumulator, threshold),
    ),
  );
  const sceneBounds = accumulators.reduce(
    (bounds, accumulator) => ({
      minX: Math.min(bounds.minX, accumulator.bounds.minX),
      maxX: Math.max(bounds.maxX, accumulator.bounds.maxX),
      minY: Math.min(bounds.minY, accumulator.bounds.minY),
      maxY: Math.max(bounds.maxY, accumulator.bounds.maxY),
      minZ: Math.min(bounds.minZ, accumulator.bounds.minZ),
      maxZ: Math.max(bounds.maxZ, accumulator.bounds.maxZ),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    },
  );
  return {
    schema: "geosee.scalar-grid-mesh-preview.v1",
    label: "Utah FORGE Phase 3 MT source-derived isosurfaces",
    source: {
      project: "Utah FORGE",
      dataset: "Phase 3 MT updated cell-center resistivity inversion model",
      sourceArchive: sourceArchiveReference(options.inputZip),
      sourceEntry: options.zipEntry,
      productIds: accumulators.map((accumulator) => accumulator.id),
    },
    sceneBounds: sceneBoundsTuple(sceneBounds),
    material: {
      side: "double",
      note: "Vertex colors distinguish source-derived threshold surfaces; per-vertex alpha feathers opacity across the low-confidence falloff (R10).",
      feathered: mesh.alpha.length === mesh.vertices.length / 3 && mesh.alpha.length > 0,
    },
    attributes: {
      scalarValues: mesh.scalarValues,
      scalar: {
        name: "log10 resistivity",
        unit: "log10 Ohm-m",
        min: accumulators[0].scalarRange.min,
        max: accumulators[0].scalarRange.max,
        displayMin: accumulators[0].scalarRange.displayMin,
        displayMax: accumulators[0].scalarRange.displayMax,
      },
    },
    processing: {
      script: "prep/build_utah_forge_mt_volume_products.mjs",
      generatedDate: DERIVED_DATE,
      extractionMethod: "mask-aware-marching-cubes",
      boundaryBank: {
        mode: "precomputed-bank",
        intervalCount: PRECOMPUTED_BANK_BOUNDARY_COUNT,
        semanticBoundaryIds: SEMANTIC_THRESHOLDS.map((threshold) => threshold.id),
        note:
          "Bank boundaries are log-spaced across the shared MT display range; semantic boundaries are exact pinned thresholds.",
      },
      sourceProductIds: accumulators.map((accumulator) => accumulator.id),
      isosurfaceProducts,
      thresholdSurfaces,
      caveats: [
        "Source-derived threshold surfaces are fixed visualization meshes generated from resampled scalar volumes with mask-aware Marching Cubes.",
        "They are not faults, horizons, mineralization, ore bodies, targets, or resource estimates.",
        "Focused isosurfaces are presentation crops and must be labeled as such.",
      ],
    },
    vertices: mesh.vertices,
    normals: mesh.normals,
    colors: mesh.colors,
    alpha: mesh.alpha,
    indices: mesh.indices,
  };
}

// R4 quantization helpers. Positions → per-tile uint16 over the tile bbox;
// normals → octahedral snorm16 (2x int16). Both decode in the runtime tile
// loader. Visual-grade precision: position step = bboxExtent/65535 (sub-metre
// on these tiles); oct-snorm16 normal error is ~0.1deg (negligible for shading).
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const clampSnorm = (t) => (t < -1 ? -1 : t > 1 ? 1 : t);

function octEncodeNormal(x, y, z) {
  const sum = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / sum;
  let v = y / sum;
  if (z < 0) {
    const ou = u;
    const ov = v;
    u = (1 - Math.abs(ov)) * (ou >= 0 ? 1 : -1);
    v = (1 - Math.abs(ou)) * (ov >= 0 ? 1 : -1);
  }
  return [u, v];
}

async function writeThresholdBoundaryAssets(thresholdMesh, thresholdDir) {
  const boundaryRoot = path.join(thresholdDir, "boundaries");
  await mkdir(boundaryRoot, { recursive: true });
  const surfaces = thresholdMesh.processing.thresholdSurfaces;
  for (const surface of surfaces) {
    const range = surface.meshRange;
    if (!range || range.vertexCount <= 0 || range.indexCount <= 0) continue;
    const productDir = path.join(boundaryRoot, surface.isoProductId);
    await mkdir(productDir, { recursive: true });
    const vertexStart = range.vertexStart;
    const vertexEnd = range.vertexStart + range.vertexCount;
    const indexStart = range.indexStart;
    const indexEnd = range.indexStart + range.indexCount;
    const vertexCount = range.vertexCount;
    const indexCount = range.indexCount;
    // R4: pack geometry into a binary tile (positions f32, normals f32,
    // indices u32, optional feather alpha f32). Per-vertex RGB and the constant
    // per-surface scalarValues array are dropped — both redundant (surface
    // color comes from the layer style; scalar is the constant threshold value
    // carried in metadata). ~5-10x smaller than the prior JSON arrays.
    const rawPos = thresholdMesh.vertices.slice(vertexStart * 3, vertexEnd * 3);
    const rawNrm = thresholdMesh.normals.slice(vertexStart * 3, vertexEnd * 3);
    const indices = Uint32Array.from(
      thresholdMesh.indices
        .slice(indexStart, indexEnd)
        .map((index) => index - vertexStart),
    );
    // Position bbox for per-tile uint16 quantization.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < rawPos.length; i += 3) {
      const x = rawPos[i], y = rawPos[i + 1], z = rawPos[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const extX = Math.max(1e-6, maxX - minX);
    const extY = Math.max(1e-6, maxY - minY);
    const extZ = Math.max(1e-6, maxZ - minZ);
    const qpos = new Uint16Array(vertexCount * 3);
    const qnrm = new Int16Array(vertexCount * 2);
    for (let v = 0; v < vertexCount; v += 1) {
      qpos[v * 3] = Math.round(clamp01((rawPos[v * 3] - minX) / extX) * 65535);
      qpos[v * 3 + 1] = Math.round(clamp01((rawPos[v * 3 + 1] - minY) / extY) * 65535);
      qpos[v * 3 + 2] = Math.round(clamp01((rawPos[v * 3 + 2] - minZ) / extZ) * 65535);
      const [ou, ov] = octEncodeNormal(rawNrm[v * 3], rawNrm[v * 3 + 1], rawNrm[v * 3 + 2]);
      qnrm[v * 2] = Math.round(clampSnorm(ou) * 32767);
      qnrm[v * 2 + 1] = Math.round(clampSnorm(ov) * 32767);
    }
    // Layout: indices (u32) first for 4-byte alignment, then positions (u16),
    // then oct-encoded normals (i16).
    const binName = `${surface.id}.bin`;
    await writeFile(
      path.join(productDir, binName),
      Buffer.concat([
        Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength),
        Buffer.from(qpos.buffer, qpos.byteOffset, qpos.byteLength),
        Buffer.from(qnrm.buffer, qnrm.byteOffset, qnrm.byteLength),
      ]),
    );
    const assetSurface = {
      ...surface,
      meshRange: { vertexStart: 0, vertexCount, indexStart: 0, indexCount },
    };
    const sidecar = {
      schema: "geosee.iso-surface-tile.v1",
      label: `${surface.isoProductLabel} ${surface.label}`,
      source: thresholdMesh.source,
      sceneBounds: thresholdMesh.sceneBounds,
      material: { side: "double", color: surface.color },
      attributes: { scalar: thresholdMesh.attributes.scalar },
      processing: {
        ...thresholdMesh.processing,
        thresholdSurfaces: [assetSurface],
      },
      geometry: {
        format: "binary-tile-quant-v1",
        file: binName,
        vertexCount,
        indexCount,
        hasNormals: true,
        hasAlpha: false,
        positionQuantization: {
          bits: 16,
          min: [round(minX, 3), round(minY, 3), round(minZ, 3)],
          extent: [round(extX, 3), round(extY, 3), round(extZ, 3)],
        },
        normalEncoding: "oct-snorm16",
        layout: "indices:u32x(3T), positions:u16x3V, normals:oct-snorm16x2V",
      },
    };
    const relativeFile = `threshold_surfaces/boundaries/${surface.isoProductId}/${surface.id}.json`;
    await writeFile(
      path.join(productDir, `${surface.id}.json`),
      `${JSON.stringify(sidecar)}\n`,
      "utf8",
    );
    surface.assetFile = relativeFile;
  }
}

async function writeProduct(accumulator, options) {
  const productDir = path.join(options.outputDir, accumulator.outputDir);
  await mkdir(productDir, { recursive: true });
  await writeFile(path.join(productDir, "volume.u8"), Buffer.from(accumulator.volume));
  await writeFile(
    path.join(productDir, "volume_high.f32"),
    Buffer.from(
      accumulator.volumeHigh.buffer,
      accumulator.volumeHigh.byteOffset,
      accumulator.volumeHigh.byteLength,
    ),
  );
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
      sourceArchive: sourceArchiveReference(options.inputZip),
      sourceEntry: options.zipEntry,
      sourceCrs: "EPSG:26912 NAD83 / UTM Zone 12N",
    },
    transform: {
      sceneCrs: "local meters, X east, Y north, Z up",
      verticalExaggeration: 1,
      crop: accumulator.crop,
      resampling:
        "Gaussian-weighted blend of cell-center source values with bounded in-range extrapolation (continuity-first); not nearest-bin",
      scalarEncoding:
        "uint8 normalized over source log10 resistivity range; mask.u8 defines occupied voxels (empty over large unconstrained voids)",
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
  const origin = readOrigin(transform);
  const modelBounds = readSceneBounds(stats);
  const scalarRange = {
    min: stats.log10Resistivity?.min ?? -2,
    max: stats.log10Resistivity?.max ?? 4.5,
    displayMin: stats.log10Resistivity?.displayMin ?? stats.log10Resistivity?.p02 ?? 0.14,
    displayMax: stats.log10Resistivity?.displayMax ?? stats.log10Resistivity?.p98 ?? 3.94,
  };
  const productPlans = PRODUCTS.map((product) => ({
    ...product,
    bounds: productBounds(product, modelBounds),
  }));
  const sourceAxisStats = await collectSourceAxisStats(options, origin, productPlans);
  const accumulators = productPlans.map((product) => {
    const dimensions = deriveSourceFidelityVolumeDimensions(product.bounds);
    return makeAccumulator({ ...product, dimensions }, product.bounds, scalarRange);
  });

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
    // R1: tricubic-supersampled field used only for surface extraction (volume
    // render assets stay at the coarse grid written by writeProduct).
    // Surface extraction uses the despeckled surface mask (tiny disconnected
    // islands removed; extent otherwise preserved — no confidence clip). The
    // volume-render products above keep the full occupied mask.
    const hi = supersampleFieldTricubic({
      values: accumulator.values,
      mask: accumulator.surfaceMask,
      dimensions: accumulator.dimensions,
      factor: SURFACE_SUPERSAMPLE,
      valueMin: accumulator.scalarRange.min,
      valueMax: accumulator.scalarRange.max,
    });
    accumulator.valuesHi = hi.values;
    accumulator.maskHi = hi.mask;
    accumulator.dimensionsHi = hi.dimensions;
    await writeProduct(accumulator, options);
    productEntries.push({
      id: accumulator.id,
      label: accumulator.label,
      description: accumulator.description,
      classification: "source-derived MT inversion scalar volume",
      domain: "log10 resistivity",
      unit: "log10 Ohm-m",
      sourceRowsInBounds: accumulator.positiveRowsInBounds,
      sourceDensityEstimate: {
        method: "equivalent isotropic spacing from product bounds and positive source rows",
        positiveRowsInBounds: sourceAxisStats.get(accumulator.id)?.positiveRowsInBounds ?? 0,
      },
      dimensions: accumulator.dimensions,
      voxelOrder: "x-fastest, then y, then z",
      sceneBounds: sceneBoundsTuple(accumulator.bounds),
      scalarRange,
      files: {
        volume: `${accumulator.outputDir}/volume.u8`,
        volumeHigh: `${accumulator.outputDir}/volume_high.f32`,
        mask: `${accumulator.outputDir}/mask.u8`,
        stats: `${accumulator.outputDir}/stats.json`,
        provenance: `${accumulator.outputDir}/provenance.json`,
      },
      volumeHighEncoding: "float32-normalized",
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

  const thresholdDir = path.join(options.outputDir, "threshold_surfaces");
  await mkdir(thresholdDir, { recursive: true });
  const thresholdMesh = buildThresholdMesh(accumulators, options);
  await writeThresholdBoundaryAssets(thresholdMesh, thresholdDir);
  // Slim preview: geometry is lazy-loaded per boundary at runtime (each
  // boundaries/<product>/<id>.json is itself a valid single-surface payload).
  // The preview carries only metadata (surface descriptors with assetFile +
  // isosurface products), so the runtime fetches it cheaply to discover what
  // exists, then fetches geometry only for visible surfaces.
  const slimPreview = {
    ...thresholdMesh,
    lazyBoundaries: true,
    vertices: [],
    normals: [],
    colors: [],
    alpha: [],
    indices: [],
    attributes: { scalar: thresholdMesh.attributes.scalar, scalarValues: [] },
  };
  await writeFile(
    path.join(thresholdDir, "mt_threshold_surfaces_mesh_preview.json"),
    `${JSON.stringify(slimPreview)}\n`,
    "utf8",
  );
  const thresholdProvenance = {
    artifact: "threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
    classification: "source-derived iso-resistivity communication surfaces",
    extractionMethod: thresholdMesh.processing.extractionMethod,
    sourceProductIds: thresholdMesh.processing.sourceProductIds,
    products: thresholdMesh.processing.isosurfaceProducts.map((product) => ({
      id: product.id,
      label: product.label,
      sourceProductId: product.sourceProductId,
      cropStatus: product.cropStatus,
      sourceVolume:
        product.sourceProductId === "mt-resistivity-full-extent-volume"
          ? "full_extent/volume.u8"
          : "forge_focused/volume.u8",
      sourceMask:
        product.sourceProductId === "mt-resistivity-full-extent-volume"
          ? "full_extent/mask.u8"
          : "forge_focused/mask.u8",
      dimensions: product.dimensions,
      voxelSpacingM: product.voxelSpacingM,
    })),
    thresholdSurfaces: thresholdMesh.processing.thresholdSurfaces,
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
      archive: sourceArchiveReference(options.inputZip),
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
      defaultProductId: "mt-isosurface-full-extent",
      products: thresholdMesh.processing.isosurfaceProducts,
      surfaces: thresholdMesh.processing.thresholdSurfaces,
    },
    displayRecipes: [
      {
        id: "mt-volume-default",
        label: "MT resistivity volume",
        productId: "mt-resistivity-full-extent-volume",
        opacity: 0.46,
        density: 0.72,
        sampleSteps: 112,
        transferMode: "balanced",
        thresholdSurfaceProductId: "mt-isosurface-full-extent",
        thresholdSurfaces: ["conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
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
