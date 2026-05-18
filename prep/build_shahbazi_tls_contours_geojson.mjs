import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  numberFromEnv,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;
const MESH_INPUT = path.join(PROCESSED_DIR, "tls_surface_mesh_preview.json");
const PREVIEW_PROVENANCE_INPUT = path.join(
  PROCESSED_DIR,
  "tls_preview_points.provenance.json",
);
const OUTPUT = path.join(PROCESSED_DIR, "tls_surface_contours.geojson");
const PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "tls_surface_contours.provenance.json",
);

const CREATED_DATE = SHAHBAZI_DERIVED_DATE;
const CONTOUR_INTERVAL_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_TLS_CONTOUR_INTERVAL_M",
  0.5,
);
const CONTOUR_Z_OFFSET_M = 0;
const EPSILON = 1e-7;

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pointKey(point) {
  return point.map((value) => round(value, 5)).join(",");
}

function edgeIntersection(a, b, level) {
  const za = a[2];
  const zb = b[2];
  const minZ = Math.min(za, zb);
  const maxZ = Math.max(za, zb);
  if (level < minZ - EPSILON || level > maxZ + EPSILON) return null;
  if (Math.abs(za - zb) < EPSILON) return null;

  const t = (level - za) / (zb - za);
  if (t < -EPSILON || t > 1 + EPSILON) return null;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    level + CONTOUR_Z_OFFSET_M,
  ];
}

function farthestPair(points) {
  let best = [points[0], points[1]];
  let bestDistance = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      const dz = points[i][2] - points[j][2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [points[i], points[j]];
      }
    }
  }
  return best;
}

function makeLevels(minZ, maxZ) {
  const first = Math.ceil(minZ / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M;
  const last = Math.floor(maxZ / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M;
  const levels = [];
  for (
    let level = first;
    level <= last + EPSILON;
    level += CONTOUR_INTERVAL_M
  ) {
    levels.push(round(level, 3));
  }
  return levels;
}

function sourceElevationForSceneLevel(level, mesh, previewProvenance) {
  const scenePlacement = mesh.scenePlacement ?? {};
  const transform = previewProvenance.processing?.sceneTransform ?? {};
  const sourceBounds = previewProvenance.processing?.sourceBounds ?? {};
  const zLift =
    typeof scenePlacement.zLiftMeters === "number"
      ? scenePlacement.zLiftMeters
      : typeof transform.zLiftMeters === "number"
        ? transform.zLiftMeters
        : 0;
  const verticalScale =
    typeof scenePlacement.verticalScale === "number"
      ? scenePlacement.verticalScale
      : typeof transform.verticalScale === "number"
        ? transform.verticalScale
        : 1;
  const sourceMinZ = Array.isArray(sourceBounds.min)
    ? Number(sourceBounds.min[2])
    : Array.isArray(mesh.sourceBounds?.min)
      ? Number(mesh.sourceBounds.min[2])
      : 0;
  return (level - zLift) / verticalScale + sourceMinZ;
}

function buildContours(mesh) {
  const vertices = mesh.vertices;
  const indices = mesh.indices;
  const levels = makeLevels(mesh.sceneBounds.min[2], mesh.sceneBounds.max[2]);
  const segmentsByLevel = new Map(levels.map((level) => [String(level), []]));

  for (let i = 0; i < indices.length; i += 3) {
    const aIndex = indices[i] * 3;
    const bIndex = indices[i + 1] * 3;
    const cIndex = indices[i + 2] * 3;
    const tri = [
      [vertices[aIndex], vertices[aIndex + 1], vertices[aIndex + 2]],
      [vertices[bIndex], vertices[bIndex + 1], vertices[bIndex + 2]],
      [vertices[cIndex], vertices[cIndex + 1], vertices[cIndex + 2]],
    ];
    const triMinZ = Math.min(tri[0][2], tri[1][2], tri[2][2]);
    const triMaxZ = Math.max(tri[0][2], tri[1][2], tri[2][2]);

    for (const level of levels) {
      if (level < triMinZ - EPSILON || level > triMaxZ + EPSILON) continue;

      const candidates = [
        edgeIntersection(tri[0], tri[1], level),
        edgeIntersection(tri[1], tri[2], level),
        edgeIntersection(tri[2], tri[0], level),
      ].filter(Boolean);
      const unique = [];
      const seen = new Set();
      for (const point of candidates) {
        const key = pointKey(point);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(point);
        }
      }
      if (unique.length < 2) continue;

      const segment = farthestPair(unique).map((point) =>
        point.map((value) => round(value, 3)),
      );
      segmentsByLevel.get(String(level)).push(segment);
    }
  }

  return { levels, segmentsByLevel };
}

async function main() {
  const mesh = JSON.parse(await readFile(MESH_INPUT, "utf8"));
  const previewProvenance = JSON.parse(
    await readFile(PREVIEW_PROVENANCE_INPUT, "utf8"),
  );
  if (
    mesh.schema !== "geosee.mesh-preview.v1" ||
    !Array.isArray(mesh.vertices) ||
    !Array.isArray(mesh.indices) ||
    !mesh.sceneBounds
  ) {
    throw new Error("Invalid TLS surface mesh preview payload");
  }

  const { levels, segmentsByLevel } = buildContours(mesh);
  const features = levels
    .map((level, levelIndex) => {
      const segments = segmentsByLevel.get(String(level)) ?? [];
      if (segments.length === 0) return null;
      const sourceElevationM = sourceElevationForSceneLevel(
        level,
        mesh,
        previewProvenance,
      );
      return {
        type: "Feature",
        id: `tls-contour-${sourceElevationM.toFixed(2)}m`,
        properties: {
          id: `tls-contour-${sourceElevationM.toFixed(2)}m`,
          displayName: `TLS contour ${sourceElevationM.toFixed(2)} m`,
          sourceRole: "tls-derived-preview-contour",
          levelIndex,
          intervalM: CONTOUR_INTERVAL_M,
          sceneElevationM: round(level, 3),
          sourceElevationM: round(sourceElevationM, 3),
          segmentCount: segments.length,
          note:
            "Derived preview contour segments from the binned observed-cell TLS mesh. No source gaps are interpolated.",
        },
        geometry: {
          type: "MultiLineString",
          coordinates: segments,
        },
      };
    })
    .filter(Boolean);

  const segmentCount = features.reduce(
    (sum, feature) => sum + feature.properties.segmentCount,
    0,
  );
  const geojson = {
    type: "FeatureCollection",
    name: "Shahbazi TLS surface contours",
    properties: {
      schema: "geosee.geojson-derived-contours.v1",
      sourceMesh: "tls_surface_mesh_preview.json",
      intervalM: CONTOUR_INTERVAL_M,
      zOffsetM: CONTOUR_Z_OFFSET_M,
      featureCount: features.length,
      segmentCount,
    },
    features,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "tls_surface_contours.geojson",
    artifactType: "derived-tls-surface-contours-preview",
    projectSlug: "case-study-b",
    createdDate: CREATED_DATE,
    source: {
      meshPreview:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_surface_mesh_preview.json",
      rawSource:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/LaserScan.xyz",
      citation: SHAHBAZI_FULL_CITATION,
    },
    processing: {
      script: "prep/build_shahbazi_tls_contours_geojson.mjs",
      method:
        "Triangle-plane intersection against the binned observed-cell TLS surface mesh preview.",
      contourIntervalM: CONTOUR_INTERVAL_M,
      renderZOffsetM: CONTOUR_Z_OFFSET_M,
      contourLevels: features.length,
      contourSegments: segmentCount,
      sourceGapPolicy:
        "Contours are emitted only where the TLS surface mesh has faces. The source mesh fills small enclosed interior display gaps but does not extend outside the observed TLS footprint.",
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This is legibility linework for the TLS mesh preview, not a final surveyed contour product.",
    },
  };

  await writeFile(OUTPUT, `${JSON.stringify(geojson, null, 2)}\n`);
  await writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(
    `Wrote ${features.length} contour levels and ${segmentCount.toLocaleString()} contour segments to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
