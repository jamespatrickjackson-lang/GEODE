import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_CRS,
  SHAHBAZI_PROCESSED_DIR,
  SHAHBAZI_SCENE_Z_LIFT_M,
  numberFromEnv,
  rawPath,
} from "./shahbazi_config.mjs";

const SOURCE = rawPath("LaserScan.xyz");
const OUTPUT_DIR = SHAHBAZI_PROCESSED_DIR;
const OUTPUT = path.join(OUTPUT_DIR, "tls_preview_points.json");
const TARGET_POINTS = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_PREVIEW_TARGET_POINTS",
  120_000,
);

function parsePoint(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
}

async function scanBounds() {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    count: 0,
  };

  const rl = createInterface({
    input: createReadStream(SOURCE),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const point = parsePoint(line);
    if (!point) continue;
    bounds.count += 1;
    for (let i = 0; i < 3; i += 1) {
      bounds.min[i] = Math.min(bounds.min[i], point[i]);
      bounds.max[i] = Math.max(bounds.max[i], point[i]);
    }
  }

  return bounds;
}

async function samplePoints(bounds) {
  const stride = Math.max(1, Math.floor(bounds.count / TARGET_POINTS));
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const points = [];
  let sourceIndex = 0;

  const rl = createInterface({
    input: createReadStream(SOURCE),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const point = parsePoint(line);
    if (!point) continue;

    if (sourceIndex % stride === 0) {
      points.push(roundMillimeter(point[0] - center[0]));
      points.push(roundMillimeter(point[1] - center[1]));
      points.push(
        roundMillimeter(point[2] - bounds.min[2] + SHAHBAZI_SCENE_Z_LIFT_M),
      );
    }

    sourceIndex += 1;
  }

  return {
    center,
    stride,
    points,
    pointCount: points.length / 3,
  };
}

async function main() {
  const bounds = await scanBounds();
  const sample = await samplePoints(bounds);

  const payload = {
    schema: "geosee.pointcloud-preview.v1",
    label: "Shahbazi TLS sub-zone sampled preview",
    source: {
      file: "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_CITATION,
      sourcePointCount: bounds.count,
      sampleStride: sample.stride,
      sampledPointCount: sample.pointCount,
    },
    crs: SHAHBAZI_CRS,
    sourceBounds: {
      min: bounds.min.map(roundMillimeter),
      max: bounds.max.map(roundMillimeter),
      center: sample.center.map(roundMillimeter),
    },
    scenePlacement: {
      mode: "source-centered-preview",
      horizontalScale: 1,
      verticalScale: 1,
      zLiftMeters: SHAHBAZI_SCENE_Z_LIFT_M,
      note: "Preview keeps TLS metric scale, recenters X/Y, and lifts Z into the existing procedural Case Study B scene.",
    },
    columns: ["x_scene_m", "y_scene_m", "z_scene_m"],
    points: sample.points,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, "utf8");
  console.log(
    `Wrote ${sample.pointCount.toLocaleString()} sampled TLS points to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
