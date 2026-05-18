import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  SHAHBAZI_CITATION,
  SHAHBAZI_DERIVED_DATE,
  SHAHBAZI_FULL_CITATION,
  SHAHBAZI_PROCESSED_DIR,
  rawPath,
} from "./shahbazi_config.mjs";

const PROCESSED_DIR = SHAHBAZI_PROCESSED_DIR;

const DENSE_MATCHING = rawPath("DenseMatching.txt");
const CAMERA_POSES = path.join(PROCESSED_DIR, "camera_poses.geojson");
const OUTPUT = path.join(PROCESSED_DIR, "dense_matching_links.geojson");
const PROVENANCE_OUTPUT = path.join(
  PROCESSED_DIR,
  "dense_matching_links.provenance.json",
);

function parsePairLine(line, lineNumber) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const imageA = Number(parts[0]);
  const imageB = Number(parts[1]);
  if (!Number.isFinite(imageA) || !Number.isFinite(imageB)) {
    throw new Error(`Invalid DenseMatching row at line ${lineNumber}: ${line}`);
  }
  return { imageA, imageB };
}

function cameraMapFromGeoJson(cameraGeoJson) {
  const map = new Map();
  for (const feature of cameraGeoJson.features ?? []) {
    if (
      feature.geometry?.type !== "Point" ||
      typeof feature.properties?.imageId !== "number"
    ) {
      continue;
    }
    map.set(feature.properties.imageId, feature.geometry.coordinates);
  }
  return map;
}

function updateBounds(bounds, values) {
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], values[i]);
    bounds.max[i] = Math.max(bounds.max[i], values[i]);
  }
}

async function main() {
  const [denseText, cameraText] = await Promise.all([
    readFile(DENSE_MATCHING, "utf8"),
    readFile(CAMERA_POSES, "utf8"),
  ]);
  const pairs = denseText
    .split(/\r?\n/)
    .map((line, index) => parsePairLine(line, index + 1))
    .filter(Boolean);
  const cameraGeoJson = JSON.parse(cameraText);
  const cameraByImageId = cameraMapFromGeoJson(cameraGeoJson);

  const sceneBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const imageIds = new Set();
  const missingPairs = [];
  const features = [];

  for (const [index, pair] of pairs.entries()) {
    const a = cameraByImageId.get(pair.imageA);
    const b = cameraByImageId.get(pair.imageB);
    imageIds.add(pair.imageA);
    imageIds.add(pair.imageB);
    if (!a || !b) {
      missingPairs.push(pair);
      continue;
    }
    updateBounds(sceneBounds, a);
    updateBounds(sceneBounds, b);
    features.push({
      type: "Feature",
      properties: {
        id: `dense-match-${String(index + 1).padStart(2, "0")}`,
        displayName: `Dense matching pair ${pair.imageA}-${pair.imageB}`,
        sourceRole: "dense_matching_image_pair",
        imageA: pair.imageA,
        imageB: pair.imageB,
        sourceFile: "DenseMatching.txt",
      },
      geometry: {
        type: "LineString",
        coordinates: [a, b],
      },
    });
  }

  const payload = {
    type: "FeatureCollection",
    name: "Shahbazi dense-matching image-pair links",
    properties: {
      schema: "geosee.image-pair-links.v1",
      sourcePath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/DenseMatching.txt",
      supportingSource:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/camera_poses.geojson",
      citation: SHAHBAZI_CITATION,
      sourceCrs: cameraGeoJson.properties?.sourceCrs,
      scenePlacement: cameraGeoJson.properties?.scenePlacement,
      pairCount: pairs.length,
      displayedPairCount: features.length,
      uniqueImageCount: imageIds.size,
      missingPairCount: missingPairs.length,
      sceneBounds: {
        min: sceneBounds.min,
        max: sceneBounds.max,
      },
    },
    features,
  };

  const provenance = {
    schema: "geosee.provenance.v1",
    artifact: "dense_matching_links.geojson",
    artifactType: "dense-matching-image-pair-links",
    projectSlug: "case-study-b",
    createdDate: SHAHBAZI_DERIVED_DATE,
    source: {
      primaryPath:
        "projects/case-study-b/data/raw/shahbazi_gravel_pit/DenseMatching.txt",
      supportingPath:
        "projects/case-study-b/data/processed/shahbazi_gravel_pit/camera_poses.geojson",
      citation: SHAHBAZI_FULL_CITATION,
      pairRows: pairs.length,
      uniqueImageCount: imageIds.size,
      columns: ["image_id_a", "image_id_b"],
    },
    processing: {
      script: "prep/build_shahbazi_dense_matching_links_geojson.mjs",
      method:
        "Parsed DenseMatching image-pair rows and connected each pair using processed camera-pose scene coordinates.",
      sceneTransform: payload.properties.scenePlacement,
      sceneBounds: payload.properties.sceneBounds,
      missingPairs,
    },
    reviewStatus: {
      readyForDemoPreview: true,
      readyForFinalSpatialAnalysis: false,
      notes:
        "This layer is source QA context for the multi-view stereo subset. It shows image-pair relationships, not surveyed ground geometry.",
    },
  };

  await mkdir(PROCESSED_DIR, { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
    writeFile(PROVENANCE_OUTPUT, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `Wrote ${features.length} dense-matching links to ${path.relative(
      ROOT,
      OUTPUT,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
