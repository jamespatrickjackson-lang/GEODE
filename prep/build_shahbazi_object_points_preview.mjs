import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_CRS,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  rawPath,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const OBJECT_POINTS = rawPath("ObjectPoints.txt");
const TIE_POINTS = rawPath("TiePoints.txt");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTPUT = path.join(PROCESSED_DIR, "object_points_preview.json");
const PROVENANCE_OUTPUT = path.join(PROCESSED_DIR, "object_points_preview.provenance.json");

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
}

function round(value, decimals = 3) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function readSceneTransform(tlsProvenance) {
  const bounds = tlsProvenance.processing?.sourceBounds;
  const transform = tlsProvenance.processing?.sceneTransform;
  if (!bounds?.min || !bounds?.max || !transform) {
    throw new Error("TLS provenance is missing sourceBounds or sceneTransform.");
  }
  return {
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    minZ: bounds.min[2],
    horizontalScale: transform.horizontalScale ?? 1,
    verticalScale: transform.verticalScale ?? 1,
    zLiftMeters: transform.zLiftMeters ?? 115,
  };
}

function parseObjectPointLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const row = {
    id: Number(parts[0]),
    x: Number(parts[1]),
    y: Number(parts[2]),
    z: Number(parts[3]),
  };
  if (Object.values(row).some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid ObjectPoints row at line ${lineNumber}: ${line}`);
  }
  return row;
}

function parseTiePointLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const row = {
    imageId: Number(parts[0]),
    objectPointId: Number(parts[1]),
    imageX: Number(parts[2]),
    imageY: Number(parts[3]),
  };
  if (Object.values(row).some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid TiePoints row at line ${lineNumber}: ${line}`);
  }
  return row;
}

function updateBounds(bounds, values) {
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], values[i]);
    bounds.max[i] = Math.max(bounds.max[i], values[i]);
  }
}

function transformScene(row, transform) {
  return [
    (row.x - transform.center[0]) * transform.horizontalScale,
    (row.y - transform.center[1]) * transform.horizontalScale,
    (row.z - transform.minZ) * transform.verticalScale + transform.zLiftMeters,
  ].map(roundMillimeter);
}

async function main() {
  const [objectText, tieText, tlsProvenanceText] = await Promise.all([
    readFile(OBJECT_POINTS, "utf8"),
    readFile(TIE_POINTS, "utf8"),
    readFile(TLS_PROVENANCE, "utf8"),
  ]);
  const transform = readSceneTransform(JSON.parse(tlsProvenanceText));

  const objectRows = objectText
    .split(/\r?\n/)
    .map((line, index) => parseObjectPointLine(line, index + 1))
    .filter(Boolean);
  const tieRows = tieText
    .split(/\r?\n/)
    .map((line, index) => parseTiePointLine(line, index + 1))
    .filter(Boolean);

  const tieStatsByObjectId = new Map();
  for (const row of tieRows) {
    const stats =
      tieStatsByObjectId.get(row.objectPointId) ??
      { observationCount: 0, imageIds: new Set() };
    stats.observationCount += 1;
    stats.imageIds.add(row.imageId);
    tieStatsByObjectId.set(row.objectPointId, stats);
  }

  const points = [];
  const observations = [];
  const sourceBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const sceneBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  let observedObjectPointCount = 0;
  let minObservationCount = Infinity;
  let maxObservationCount = -Infinity;
  let totalObservationCount = 0;

  for (const row of objectRows) {
    const source = [row.x, row.y, row.z].map(roundMillimeter);
    const scene = transformScene(row, transform);
    const stats = tieStatsByObjectId.get(row.id);
    const observationCount = stats?.observationCount ?? 0;
    const imageCount = stats?.imageIds.size ?? 0;

    if (observationCount > 0) observedObjectPointCount += 1;
    minObservationCount = Math.min(minObservationCount, observationCount);
    maxObservationCount = Math.max(maxObservationCount, observationCount);
    totalObservationCount += observationCount;
    updateBounds(sourceBounds, source);
    updateBounds(sceneBounds, scene);
    points.push(...scene);
    observations.push({
      id: row.id,
      observationCount,
      imageCount,
    });
  }

  const payload = {
    schema: "geosee.pointcloud-preview.v1",
    label: "Shahbazi sparse object points / tie-point QA",
    source: {
      file: "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
      tiePointFile: "projects/case-study-b/data/raw/shahbazi_gravel_pit/TiePoints.txt",
      citation: SHAHBAZI_CITATION,
      sourcePointCount: objectRows.length,
      tiePointRows: tieRows.length,
      observedObjectPointCount,
      observationStats: {
        min: minObservationCount === Infinity ? 0 : minObservationCount,
        max: maxObservationCount === -Infinity ? 0 : maxObservationCount,
        mean: round(totalObservationCount / Math.max(1, objectRows.length), 2),
      },
    },
    crs: SHAHBAZI_CRS,
    sourceBounds: {
      min: sourceBounds.min.map(roundMillimeter),
      max: sourceBounds.max.map(roundMillimeter),
    },
    scenePlacement: {
      mode: "tls-preview-aligned",
      horizontalScale: transform.horizontalScale,
      verticalScale: transform.verticalScale,
      zLiftMeters: transform.zLiftMeters,
      note: "Object points are centered and lifted with the same transform as the sampled TLS preview.",
    },
    sceneBounds: {
      min: sceneBounds.min.map(roundMillimeter),
      max: sceneBounds.max.map(roundMillimeter),
    },
    columns: ["x_scene_m", "y_scene_m", "z_scene_m"],
    attributes: {
      observations,
    },
    points,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "object_points_preview.json",
    artifactType: "sparse-object-point-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      primaryPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/ObjectPoints.txt",
      supportingPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/TiePoints.txt",
      citation: SHAHBAZI_FULL_CITATION,
      objectPointRows: objectRows.length,
      tiePointRows: tieRows.length,
      columns: {
        objectPoints: ["object_point_id", "x", "y", "z"],
        tiePoints: ["image_id", "object_point_id", "image_x", "image_y"],
      },
    },
    processing: {
      script: "prep/build_shahbazi_object_points_preview.mjs",
      method:
        "Parsed source object points, counted matching image observations from TiePoints.txt, and transformed positions into Case Study B scene coordinates using the sampled TLS preview transform.",
      sourceBounds: payload.sourceBounds,
      sceneBounds: payload.sceneBounds,
      sceneTransform: payload.scenePlacement,
      observationStats: payload.source.observationStats,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This sparse object-point preview is source-derived QA context for photogrammetry. It is not a dense reconstruction, orthomosaic, DSM, or final mesh.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${objectRows.length} Shahbazi object points to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
