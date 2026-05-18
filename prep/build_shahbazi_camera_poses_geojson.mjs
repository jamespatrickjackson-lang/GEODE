import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_CRS,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  SHAHBAZI_RAW_DIR,
} from "./shahbazi_config.mjs";

const RAW_DIR = SHAHBAZI_RAW_DIR;
const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const REFINED_EOPS = path.join(RAW_DIR, "RefinedEOPs.txt");
const DIRECT_EOPS = path.join(RAW_DIR, "DirectEOPs.txt");
const TIMESTAMPS = path.join(RAW_DIR, "TimeStamps.txt");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTPUT = path.join(PROCESSED_DIR, "camera_poses.geojson");
const PROVENANCE_OUTPUT = path.join(PROCESSED_DIR, "camera_poses.provenance.json");

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
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

function parseEopLine(line, lineNumber, sourceName) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 7) return null;
  const [rawId, rawX, rawY, rawZ, rawOmega, rawPhi, rawKappa] = parts;
  const row = {
    imageId: Number(rawId),
    x: Number(rawX),
    y: Number(rawY),
    z: Number(rawZ),
    omega: Number(rawOmega),
    phi: Number(rawPhi),
    kappa: Number(rawKappa),
  };
  if (Object.values(row).some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid ${sourceName} row at line ${lineNumber}: ${line}`);
  }
  return row;
}

function parseTimestampLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const imageId = Number(parts[0]);
  const timestampSec = Number(parts[1]);
  if (!Number.isFinite(imageId) || !Number.isFinite(timestampSec)) {
    throw new Error(`Invalid TimeStamps row at line ${lineNumber}: ${line}`);
  }
  return [imageId, timestampSec];
}

function parseEopTable(text, sourceName) {
  return text
    .split(/\r?\n/)
    .map((line, index) => parseEopLine(line, index + 1, sourceName))
    .filter(Boolean)
    .sort((a, b) => a.imageId - b.imageId);
}

function parseTimestampMap(text) {
  return new Map(
    text
      .split(/\r?\n/)
      .map((line, index) => parseTimestampLine(line, index + 1))
      .filter(Boolean),
  );
}

function transformScene(row, transform) {
  return [
    (row.x - transform.center[0]) * transform.horizontalScale,
    (row.y - transform.center[1]) * transform.horizontalScale,
    (row.z - transform.minZ) * transform.verticalScale + transform.zLiftMeters,
  ].map(roundMillimeter);
}

function updateBounds(bounds, values) {
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], values[i]);
    bounds.max[i] = Math.max(bounds.max[i], values[i]);
  }
}

async function main() {
  const [refinedText, directText, timestampsText, tlsProvenanceText] =
    await Promise.all([
      readFile(REFINED_EOPS, "utf8"),
      readFile(DIRECT_EOPS, "utf8"),
      readFile(TIMESTAMPS, "utf8"),
      readFile(TLS_PROVENANCE, "utf8"),
    ]);

  const transform = readSceneTransform(JSON.parse(tlsProvenanceText));
  const refinedRows = parseEopTable(refinedText, "RefinedEOPs.txt");
  const directRowsById = new Map(
    parseEopTable(directText, "DirectEOPs.txt").map((row) => [
      row.imageId,
      row,
    ]),
  );
  const timestampsById = parseTimestampMap(timestampsText);

  const sourceBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const sceneBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };

  const pathCoordinates = [];
  const pointFeatures = [];

  for (const row of refinedRows) {
    const sourceCoordinates = [row.x, row.y, row.z].map(roundMillimeter);
    const sceneCoordinates = transformScene(row, transform);
    const direct = directRowsById.get(row.imageId);
    const directPositionDeltaM = direct
      ? Math.sqrt(
          (row.x - direct.x) ** 2 +
            (row.y - direct.y) ** 2 +
            (row.z - direct.z) ** 2,
        )
      : null;

    updateBounds(sourceBounds, sourceCoordinates);
    updateBounds(sceneBounds, sceneCoordinates);
    pathCoordinates.push(sceneCoordinates);

    pointFeatures.push({
      type: "Feature",
      properties: {
        id: `image-${String(row.imageId).padStart(3, "0")}`,
        imageId: row.imageId,
        displayName: `Shahbazi image ${String(row.imageId).padStart(3, "0")} camera`,
        sourceRole: "refined_exterior_orientation_camera_pose",
        timestampSec: timestampsById.get(row.imageId) ?? null,
        omega: row.omega,
        phi: row.phi,
        kappa: row.kappa,
        orientationUnits: "degrees, per source EOP table",
        sourceCoordinates: {
          x: sourceCoordinates[0],
          y: sourceCoordinates[1],
          z: sourceCoordinates[2],
        },
        directPositionDeltaM:
          directPositionDeltaM === null ? null : roundMillimeter(directPositionDeltaM),
      },
      geometry: {
        type: "Point",
        coordinates: sceneCoordinates,
      },
    });
  }

  const pathFeature = {
    type: "Feature",
    properties: {
      id: "shahbazi-uav-flight-path",
      displayName: "Shahbazi UAV camera path",
      sourceRole: "refined_exterior_orientation_flight_path",
      pointCount: pointFeatures.length,
      sourceFile: "RefinedEOPs.txt",
    },
    geometry: {
      type: "LineString",
      coordinates: pathCoordinates,
    },
  };

  const payload = {
    type: "FeatureCollection",
    name: "Shahbazi UAV camera positions / flight path",
    properties: {
      schema: "geosee.camera-poses.v1",
      sourcePath: "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedEOPs.txt",
      supportingSources: [
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/DirectEOPs.txt",
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/TimeStamps.txt",
      ],
      citation: SHAHBAZI_CITATION,
      sourceCrs: SHAHBAZI_CRS,
      scenePlacement: {
        mode: "tls-preview-aligned",
        horizontalScale: transform.horizontalScale,
        verticalScale: transform.verticalScale,
        zLiftMeters: transform.zLiftMeters,
        note: "Camera positions are centered and lifted with the same transform as the sampled TLS preview.",
      },
      sourceBounds: {
        min: sourceBounds.min.map(roundMillimeter),
        max: sourceBounds.max.map(roundMillimeter),
      },
      sceneBounds: {
        min: sceneBounds.min.map(roundMillimeter),
        max: sceneBounds.max.map(roundMillimeter),
      },
      cameraPoseCount: pointFeatures.length,
    },
    features: [pathFeature, ...pointFeatures],
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "camera_poses.geojson",
    artifactType: "normalized-camera-poses-and-flight-path",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      primaryPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedEOPs.txt",
      supportingPaths: [
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/DirectEOPs.txt",
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/TimeStamps.txt",
      ],
      citation: SHAHBAZI_FULL_CITATION,
      rows: refinedRows.length,
      columns: ["image_id", "x", "y", "z", "omega", "phi", "kappa"],
    },
    processing: {
      script: "prep/build_shahbazi_camera_poses_geojson.mjs",
      method:
        "Parsed refined exterior orientation rows, joined timestamps and direct EOP comparison values, and transformed positions into Case Study B scene coordinates using the sampled TLS preview transform.",
      sceneTransform: payload.properties.scenePlacement,
      sourceBounds: payload.properties.sourceBounds,
      sceneBounds: payload.properties.sceneBounds,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This layer shows the published camera positions and a flight-path preview. It does not reconstruct imagery or camera frustums yet; final CRS/orientation review remains required.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${pointFeatures.length} Shahbazi camera poses to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
