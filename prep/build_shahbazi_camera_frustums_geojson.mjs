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
  numberFromEnv,
} from "./shahbazi_config.mjs";

const RAW_DIR = SHAHBAZI_RAW_DIR;
const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const REFINED_EOPS = path.join(RAW_DIR, "RefinedEOPs.txt");
const REFINED_IOPS = path.join(RAW_DIR, "RefinedIOPs.txt");
const TLS_PROVENANCE = path.join(PROCESSED_DIR, "tls_preview_points.provenance.json");
const OUTPUT = path.join(PROCESSED_DIR, "camera_frustums.geojson");
const PROVENANCE_OUTPUT = path.join(PROCESSED_DIR, "camera_frustums.provenance.json");

const DISPLAY_STRIDE = Math.max(
  1,
  Math.round(numberFromEnv("GEOSEE_SHAHBAZI_FRUSTUM_DISPLAY_STRIDE", 6)),
);
const FRUSTUM_LENGTH_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_FRUSTUM_LENGTH_M",
  42,
);

function roundMillimeter(value) {
  return Math.round(value * 1000) / 1000;
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
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

function parseIops(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [rawKey, rawValue] = trimmed.split("=");
    const keys = rawKey.split(",").map((value) => value.trim());
    const values = rawValue.split(",").map((value) => Number(value.trim()));
    for (let i = 0; i < keys.length; i += 1) {
      result[keys[i]] = values[i];
    }
  }
  for (const key of ["s", "w", "h", "xp", "yp", "f"]) {
    if (!Number.isFinite(result[key])) {
      throw new Error(`RefinedIOPs.txt is missing numeric key ${key}.`);
    }
  }
  return result;
}

function parseEopLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 7) return null;
  const row = {
    imageId: Number(parts[0]),
    x: Number(parts[1]),
    y: Number(parts[2]),
    z: Number(parts[3]),
    omega: Number(parts[4]),
    phi: Number(parts[5]),
    kappa: Number(parts[6]),
  };
  if (Object.values(row).some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid RefinedEOPs row at line ${lineNumber}: ${line}`);
  }
  return row;
}

function parseEops(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => parseEopLine(line, index + 1))
    .filter(Boolean)
    .sort((a, b) => a.imageId - b.imageId);
}

function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function rotationZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

function multiplyMatrix(a, b) {
  return a.map((row) =>
    b[0].map((_, columnIndex) =>
      row.reduce((sum, value, rowIndex) => sum + value * b[rowIndex][columnIndex], 0),
    ),
  );
}

function applyMatrix(matrix, vector) {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  if (length <= 0) return [0, 0, -1];
  return vector.map((value) => value / length);
}

function transformScene(source, transform) {
  return [
    (source[0] - transform.center[0]) * transform.horizontalScale,
    (source[1] - transform.center[1]) * transform.horizontalScale,
    (source[2] - transform.minZ) * transform.verticalScale + transform.zLiftMeters,
  ].map(roundMillimeter);
}

function updateBounds(bounds, values) {
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], values[i]);
    bounds.max[i] = Math.max(bounds.max[i], values[i]);
  }
}

function cameraCornerRays(iops) {
  const halfWidthMm = (iops.w * iops.s) / 2;
  const halfHeightMm = (iops.h * iops.s) / 2;
  const left = -halfWidthMm - iops.xp;
  const right = halfWidthMm - iops.xp;
  const top = halfHeightMm - iops.yp;
  const bottom = -halfHeightMm - iops.yp;
  return [
    [left, top, -iops.f],
    [right, top, -iops.f],
    [right, bottom, -iops.f],
    [left, bottom, -iops.f],
  ];
}

function imageIdsForPreview(rows) {
  const ids = new Set();
  for (const row of rows) {
    if ((row.imageId - 1) % DISPLAY_STRIDE === 0 || row.imageId === rows.length) {
      ids.add(row.imageId);
    }
  }
  return ids;
}

async function main() {
  const [eopsText, iopsText, tlsProvenanceText] = await Promise.all([
    readFile(REFINED_EOPS, "utf8"),
    readFile(REFINED_IOPS, "utf8"),
    readFile(TLS_PROVENANCE, "utf8"),
  ]);
  const eops = parseEops(eopsText);
  const iops = parseIops(iopsText);
  const transform = readSceneTransform(JSON.parse(tlsProvenanceText));
  const cornerRays = cameraCornerRays(iops);
  const selectedImageIds = imageIdsForPreview(eops);

  const sourceBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const sceneBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const features = [];

  for (const row of eops) {
    if (!selectedImageIds.has(row.imageId)) continue;
    const rotation = multiplyMatrix(
      multiplyMatrix(rotationZ(degToRad(row.kappa)), rotationY(degToRad(row.phi))),
      rotationX(degToRad(row.omega)),
    );
    const cameraSource = [row.x, row.y, row.z].map(roundMillimeter);
    const cameraScene = transformScene(cameraSource, transform);
    updateBounds(sourceBounds, cameraSource);
    updateBounds(sceneBounds, cameraScene);

    const cornerSources = cornerRays.map((ray) => {
      const worldRay = normalize(applyMatrix(rotation, ray));
      const point = [
        row.x + worldRay[0] * FRUSTUM_LENGTH_M,
        row.y + worldRay[1] * FRUSTUM_LENGTH_M,
        row.z + worldRay[2] * FRUSTUM_LENGTH_M,
      ].map(roundMillimeter);
      updateBounds(sourceBounds, point);
      return point;
    });
    const cornerScenes = cornerSources.map((point) => {
      const scenePoint = transformScene(point, transform);
      updateBounds(sceneBounds, scenePoint);
      return scenePoint;
    });

    const lines = [
      [cameraScene, cornerScenes[0]],
      [cameraScene, cornerScenes[1]],
      [cameraScene, cornerScenes[2]],
      [cameraScene, cornerScenes[3]],
      [cornerScenes[0], cornerScenes[1]],
      [cornerScenes[1], cornerScenes[2]],
      [cornerScenes[2], cornerScenes[3]],
      [cornerScenes[3], cornerScenes[0]],
    ];

    features.push({
      type: "Feature",
      properties: {
        id: `frustum-${String(row.imageId).padStart(3, "0")}`,
        imageId: row.imageId,
        displayName: `Shahbazi image ${String(row.imageId).padStart(3, "0")} frustum`,
        sourceRole: "approximate_camera_frustum_preview",
        frustumLengthM: FRUSTUM_LENGTH_M,
        orientationConvention:
          "Preview uses Rz(kappa) * Ry(phi) * Rx(omega), negative camera Z as forward. Verify convention before metric use.",
        omega: row.omega,
        phi: row.phi,
        kappa: row.kappa,
        cameraSourceCoordinates: {
          x: cameraSource[0],
          y: cameraSource[1],
          z: cameraSource[2],
        },
        apex: cameraScene,
      },
      geometry: {
        type: "MultiLineString",
        coordinates: lines,
      },
    });
  }

  const sensorWidthMm = iops.w * iops.s;
  const sensorHeightMm = iops.h * iops.s;
  const payload = {
    type: "FeatureCollection",
    name: "Shahbazi sampled camera frustums",
    properties: {
      schema: "geosee.camera-frustums.v1",
      sourcePath: "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedEOPs.txt",
      supportingSources: [
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedIOPs.txt",
      ],
      citation: SHAHBAZI_CITATION,
      sourceCrs: SHAHBAZI_CRS,
      cameraModel: {
        pixelSizeMm: iops.s,
        imageWidthPx: iops.w,
        imageHeightPx: iops.h,
        principalPointOffsetMm: [iops.xp, iops.yp],
        focalLengthMm: iops.f,
        sensorSizeMm: [roundMillimeter(sensorWidthMm), roundMillimeter(sensorHeightMm)],
        horizontalFovDeg: roundMillimeter(
          2 * Math.atan(sensorWidthMm / (2 * iops.f)) * (180 / Math.PI),
        ),
        verticalFovDeg: roundMillimeter(
          2 * Math.atan(sensorHeightMm / (2 * iops.f)) * (180 / Math.PI),
        ),
      },
      scenePlacement: {
        mode: "tls-preview-aligned",
        horizontalScale: transform.horizontalScale,
        verticalScale: transform.verticalScale,
        zLiftMeters: transform.zLiftMeters,
        note: "Frustum vertices are centered and lifted with the same transform as the sampled TLS preview.",
      },
      preview: {
        sourcePoseCount: eops.length,
        displayStride: DISPLAY_STRIDE,
        displayedFrustumCount: features.length,
        displayFrustumLengthM: FRUSTUM_LENGTH_M,
        orientationStatus: "approximate-preview",
      },
      sourceBounds: {
        min: sourceBounds.min.map(roundMillimeter),
        max: sourceBounds.max.map(roundMillimeter),
      },
      sceneBounds: {
        min: sceneBounds.min.map(roundMillimeter),
        max: sceneBounds.max.map(roundMillimeter),
      },
    },
    features,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "camera_frustums.geojson",
    artifactType: "sampled-camera-frustum-preview",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      primaryPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedEOPs.txt",
      supportingPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/RefinedIOPs.txt",
      citation: SHAHBAZI_FULL_CITATION,
      eopRows: eops.length,
      iopModel: payload.properties.cameraModel,
    },
    processing: {
      script: "prep/build_shahbazi_camera_frustums_geojson.mjs",
      method:
        "Built sampled display frustums from refined exterior and interior orientation parameters, using a capped display length and the same scene transform as the TLS preview.",
      displayStride: DISPLAY_STRIDE,
      displayedFrustumCount: features.length,
      sceneTransform: payload.properties.scenePlacement,
      sourceBounds: payload.properties.sourceBounds,
      sceneBounds: payload.properties.sceneBounds,
      orientationConvention:
        "Preview uses Rz(kappa) * Ry(phi) * Rx(omega), negative camera Z as forward. Verify convention before metric use.",
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This is a sampled visual QA layer for camera acquisition geometry. It is not a final photogrammetric camera model or image footprint product.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${features.length} sampled Shahbazi camera frustums to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
