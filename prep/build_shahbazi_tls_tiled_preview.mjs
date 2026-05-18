import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
const OUTPUT_DIR = path.join(PROCESSED_DIR, "tls_tiled_preview");
const MANIFEST = path.join(OUTPUT_DIR, "manifest.json");
const PROVENANCE_OUTPUT = path.join(
  OUTPUT_DIR,
  "tls_tiled_preview.provenance.json",
);

const TARGET_POINTS = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_TILED_TARGET_POINTS",
  720_000,
);
const GRID_SIZE = Math.max(
  1,
  Math.round(numberFromEnv("GEOSEE_SHAHBAZI_TLS_TILE_GRID_SIZE", 4)),
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

function tileIndex(point, transform) {
  const xRange = Math.max(0.0001, transform.max[0] - transform.min[0]);
  const yRange = Math.max(0.0001, transform.max[1] - transform.min[1]);
  const col = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor(((point[0] - transform.min[0]) / xRange) * GRID_SIZE)),
  );
  const row = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor(((point[1] - transform.min[1]) / yRange) * GRID_SIZE)),
  );
  return row * GRID_SIZE + col;
}

function toScene(point, transform) {
  return [
    (point[0] - transform.center[0]) * transform.horizontalScale,
    (point[1] - transform.center[1]) * transform.horizontalScale,
    (point[2] - transform.min[2]) * transform.verticalScale + transform.zLiftMeters,
  ].map(roundMillimeter);
}

async function collectTiles(transform) {
  const stride = Math.max(1, Math.floor(transform.sourceRows / TARGET_POINTS));
  const tiles = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
    index,
    points: [],
    sourceBounds: emptyBounds(),
    sceneBounds: emptyBounds(),
  }));

  let validRows = 0;
  let sampledRows = 0;
  const rl = createInterface({
    input: createReadStream(SOURCE),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const point = parsePoint(line);
    if (!point) continue;
    if (validRows % stride === 0) {
      const scenePoint = toScene(point, transform);
      const tile = tiles[tileIndex(point, transform)];
      tile.points.push(...scenePoint);
      updateBounds(tile.sourceBounds, point);
      updateBounds(tile.sceneBounds, scenePoint);
      sampledRows += 1;
    }
    validRows += 1;
  }

  return { tiles, stride, validRows, sampledRows };
}

function finiteBounds(bounds) {
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite);
}

async function main() {
  const tlsProvenance = JSON.parse(await readFile(TLS_PROVENANCE, "utf8"));
  const transform = readSceneTransform(tlsProvenance);
  const { tiles, stride, validRows, sampledRows } = await collectTiles(transform);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const manifestTiles = [];
  for (const tile of tiles) {
    if (tile.points.length === 0) continue;
    const col = tile.index % GRID_SIZE;
    const row = Math.floor(tile.index / GRID_SIZE);
    const id = `tile_${String(row).padStart(2, "0")}_${String(col).padStart(2, "0")}`;
    const file = `${id}.bin`;
    const floatData = new Float32Array(tile.points);
    await writeFile(
      path.join(OUTPUT_DIR, file),
      Buffer.from(floatData.buffer, floatData.byteOffset, floatData.byteLength),
    );
    manifestTiles.push({
      id,
      file,
      grid: [col, row],
      pointCount: floatData.length / 3,
      sourceBounds: finiteBounds(tile.sourceBounds)
        ? {
            min: tile.sourceBounds.min.map(roundMillimeter),
            max: tile.sourceBounds.max.map(roundMillimeter),
          }
        : null,
      sceneBounds: finiteBounds(tile.sceneBounds)
        ? {
            min: tile.sceneBounds.min.map(roundMillimeter),
            max: tile.sceneBounds.max.map(roundMillimeter),
          }
        : null,
    });
  }

  const sceneBounds = emptyBounds();
  for (const tile of manifestTiles) {
    if (!tile.sceneBounds) continue;
    updateBounds(sceneBounds, tile.sceneBounds.min);
    updateBounds(sceneBounds, tile.sceneBounds.max);
  }

  const manifest = {
    schema: "geosee.tiled-pointcloud-preview.v1",
    label: "Shahbazi TLS tiled preview",
    source: {
      file: "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_CITATION,
      sourcePointCount: validRows,
      sampleStride: stride,
      sampledPointCount: sampledRows,
    },
    crs: {
      label: "NAD83 / MTM Zone 7",
      epsg: 32187,
      status: "from article source-data table; confirm against full processing outputs before GIS overlay use",
    },
    sourceBounds: {
      min: transform.min.map(roundMillimeter),
      max: transform.max.map(roundMillimeter),
      center: transform.center.map(roundMillimeter),
    },
    scenePlacement: {
      mode: "tls-preview-aligned",
      horizontalScale: transform.horizontalScale,
      verticalScale: transform.verticalScale,
      zLiftMeters: transform.zLiftMeters,
      note: "Tiled preview keeps TLS metric scale, recenters X/Y, and lifts Z into the existing procedural Case Study B scene.",
    },
    sceneBounds: {
      min: sceneBounds.min.map(roundMillimeter),
      max: sceneBounds.max.map(roundMillimeter),
    },
    encoding: {
      tileFormat: "float32-little-endian",
      columns: ["x_scene_m", "y_scene_m", "z_scene_m"],
    },
    tiling: {
      gridSize: [GRID_SIZE, GRID_SIZE],
      tileCount: manifestTiles.length,
    },
    tiles: manifestTiles,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "tls_tiled_preview/manifest.json",
    artifactType: "tiled-point-cloud-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      path: "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_FULL_CITATION,
      sourcePointRows: validRows,
      format: "XYZ text",
      columns: ["x", "y", "z"],
    },
    processing: {
      script: "prep/build_shahbazi_tls_tiled_preview.mjs",
      method:
        "Deterministic stride sample from valid XYZ rows, split into 4x4 binary float32 scene-coordinate tiles.",
      sampleStride: stride,
      sampledPointRows: sampledRows,
      tileCount: manifestTiles.length,
      sceneTransform: manifest.scenePlacement,
      sourceBounds: manifest.sourceBounds,
      sceneBounds: manifest.sceneBounds,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This is a higher-density browser preview rail, not a full-resolution Potree/EPT conversion. Full LaserScan.xyz still requires dedicated point-cloud conversion before final use.",
    },
  };

  await Promise.all([
    writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${sampledRows.toLocaleString()} sampled TLS points across ${
      manifestTiles.length
    } tiles to ${path.relative(ROOT, MANIFEST)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
