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
const SOURCE = rawPath("GCPs.txt");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTPUT = path.join(PROCESSED_DIR, "ground_control_points.geojson");
const PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "ground_control_points.provenance.json",
);

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
}

function readSceneTransform(tlsProvenance) {
  const bounds = tlsProvenance.processing?.sourceBounds;
  const transform = tlsProvenance.processing?.sceneTransform;
  if (!bounds?.min || !bounds?.max || !transform) {
    throw new Error("TLS provenance is missing sourceBounds or sceneTransform.");
  }
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  return {
    center,
    minZ: bounds.min[2],
    horizontalScale: transform.horizontalScale ?? 1,
    verticalScale: transform.verticalScale ?? 1,
    zLiftMeters: transform.zLiftMeters ?? 115,
  };
}

function parseGcpLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const [rawId, rawX, rawY, rawZ] = parts;
  const id = Number(rawId);
  const x = Number(rawX);
  const y = Number(rawY);
  const z = Number(rawZ);
  if (
    !Number.isFinite(id) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    throw new Error(`Invalid GCP row at line ${lineNumber}: ${line}`);
  }
  return { id, x, y, z };
}

async function main() {
  const [sourceText, tlsProvenanceText] = await Promise.all([
    readFile(SOURCE, "utf8"),
    readFile(TLS_PROVENANCE, "utf8"),
  ]);
  const transform = readSceneTransform(JSON.parse(tlsProvenanceText));
  const rows = sourceText
    .split(/\r?\n/)
    .map((line, index) => parseGcpLine(line, index + 1))
    .filter(Boolean);

  const sceneBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const sourceBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };

  const features = rows.map((row) => {
    const scene = [
      (row.x - transform.center[0]) * transform.horizontalScale,
      (row.y - transform.center[1]) * transform.horizontalScale,
      (row.z - transform.minZ) * transform.verticalScale + transform.zLiftMeters,
    ].map(roundMillimeter);

    const source = [row.x, row.y, row.z].map(roundMillimeter);
    for (let i = 0; i < 3; i += 1) {
      sceneBounds.min[i] = Math.min(sceneBounds.min[i], scene[i]);
      sceneBounds.max[i] = Math.max(sceneBounds.max[i], scene[i]);
      sourceBounds.min[i] = Math.min(sourceBounds.min[i], source[i]);
      sourceBounds.max[i] = Math.max(sourceBounds.max[i], source[i]);
    }

    return {
      type: "Feature",
      properties: {
        id: row.id,
        displayName: `Shahbazi GCP/check point ${row.id}`,
        sourceRole: "ground_control_or_check_point",
        sourceFile: "GCPs.txt",
        sourceCoordinates: {
          x: source[0],
          y: source[1],
          z: source[2],
        },
      },
      geometry: {
        type: "Point",
        coordinates: scene,
      },
    };
  });

  const payload = {
    type: "FeatureCollection",
    name: "Shahbazi ground control / check points",
    properties: {
      schema: "geosee.point-markers.v1",
      sourcePath: "projects/case-study-b/data/raw/shahbazi_gravel_pit/GCPs.txt",
      citation: SHAHBAZI_CITATION,
      sourceCrs: SHAHBAZI_CRS,
      scenePlacement: {
        mode: "tls-preview-aligned",
        horizontalScale: transform.horizontalScale,
        verticalScale: transform.verticalScale,
        zLiftMeters: transform.zLiftMeters,
        note: "GCP rows are centered and lifted with the same transform as the sampled TLS preview so the two real layers line up in Case Study B.",
      },
      sourceBounds: {
        min: sourceBounds.min.map(roundMillimeter),
        max: sourceBounds.max.map(roundMillimeter),
      },
      sceneBounds: {
        min: sceneBounds.min.map(roundMillimeter),
        max: sceneBounds.max.map(roundMillimeter),
      },
      pointCount: features.length,
    },
    features,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "ground_control_points.geojson",
    artifactType: "normalized-point-markers",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      path: "projects/case-study-b/data/raw/shahbazi_gravel_pit/GCPs.txt",
      citation: SHAHBAZI_FULL_CITATION,
      rows: rows.length,
      format: "tab-delimited text",
      columns: ["point_id", "x", "y", "z"],
    },
    processing: {
      script: "prep/build_shahbazi_gcp_geojson.mjs",
      method:
        "Parsed source GCP/check point rows and transformed them into Case Study B scene coordinates using the sampled TLS preview transform.",
      sceneTransform: payload.properties.scenePlacement,
      sourceBounds: payload.properties.sourceBounds,
      sceneBounds: payload.properties.sceneBounds,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This layer is a normalized preview of the published control/check point table. It is aligned to the current Shahbazi TLS preview in scene space; final CRS/orientation review is still required before GIS-grade use.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${features.length} Shahbazi GCP/check points to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
