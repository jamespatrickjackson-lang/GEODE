import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  assertFileExists,
  assertNotContains,
  displayPath,
  readJson,
  repoPath,
  runValidation,
} from "./lib/validation.mjs";

const SOURCE_ONLY_FRAGMENTS = [
  "client_preprocessed",
  "prep/raw",
  "data/source",
  "intake_staging",
];

function projectDirs() {
  return readdirSync(repoPath("projects"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `projects/${entry.name}`)
    .filter((projectDir) => existsSync(repoPath(`${projectDir}/project.json`)))
    .sort();
}

function collectPathStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectPathStrings(item, output);
    }
  }

  return output;
}

function resolveAssetPath(projectDir, target) {
  const normalized = target.replaceAll("\\", "/");
  const candidates = [
    repoPath(normalized),
    resolve(repoPath(projectDir), normalized),
    repoPath(join(dirname(projectDir), normalized).replaceAll("\\", "/")),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function validateLayerAssets(projectDir, layer) {
  const targets = [
    ...collectPathStrings(layer.files ?? {}),
    ...collectPathStrings(layer.previewFiles ?? {}),
  ];

  for (const target of targets) {
    for (const fragment of SOURCE_ONLY_FRAGMENTS) {
      assertNotContains(target, fragment, `${projectDir}:${layer.id}`);
    }

    const assetPath = resolveAssetPath(projectDir, target);
    const missingDisabledPlaceholder =
      layer.disabled === true && layer.metadata?.placeholder === true;
    if (!existsSync(assetPath) && missingDisabledPlaceholder) {
      continue;
    }

    assert.equal(
      existsSync(assetPath),
      true,
      `${projectDir}:${layer.id} asset should exist: ${target} (${displayPath(
        assetPath,
      )})`,
    );
  }
}

function validateEnvironmentTerrainAssets(projectDir) {
  const environmentPath = `${projectDir}/environment.json`;
  if (!existsSync(repoPath(environmentPath))) return;
  const environment = readJson(environmentPath);
  const terrain = environment.scene?.terrain;
  if (!terrain || typeof terrain !== "object") return;

  const targets = [
    terrain.orthoPhotoPath,
    terrain.orthoPhotoTexture4096Path,
    terrain.orthoPhotoTexture8192Path,
  ].filter((target) => typeof target === "string" && target.length > 0);

  for (const target of targets) {
    for (const fragment of SOURCE_ONLY_FRAGMENTS) {
      assertNotContains(target, fragment, `${projectDir}:environment.scene.terrain`);
    }
    const assetPath = resolveAssetPath(projectDir, target);
    assert.equal(
      existsSync(assetPath),
      true,
      `${projectDir}:environment.scene.terrain asset should exist: ${target} (${displayPath(
        assetPath,
      )})`,
    );
  }

  if (
    terrain.orthoPhotoTextureBudget === 4096 &&
    terrain.orthoPhotoTexture4096Path
  ) {
    assert.equal(
      terrain.orthoPhotoPath,
      terrain.orthoPhotoTexture4096Path,
      `${projectDir}:environment.scene.terrain active ortho path should match 4096 budget`,
    );
  }
  if (
    terrain.orthoPhotoTextureBudget === 8192 &&
    terrain.orthoPhotoTexture8192Path
  ) {
    assert.equal(
      terrain.orthoPhotoPath,
      terrain.orthoPhotoTexture8192Path,
      `${projectDir}:environment.scene.terrain active ortho path should match 8192 budget`,
    );
  }
}

function validateWoodjamPublicLayers() {
  const project = readJson("projects/woodjam/project.json");
  for (const [id, file] of [
    ["terrain", "data/terrain_woodjam.tif"],
    ["transport-roads", "data/roads.geojson"],
    ["hydrography-streams", "data/hydrography_streams.geojson"],
    ["hydrography-lakes", "data/hydrography_lakes.geojson"],
  ]) {
    const layer = project.layers.find((candidate) => candidate.id === id);
    assert.ok(layer, `Woodjam layer should exist: ${id}`);
    assert.ok(
      Object.values(layer.files ?? {}).includes(file),
      `Woodjam ${id} should reference ${file}`,
    );
    assert.equal(
      layer.metadata?.geoTransform,
      undefined,
      `Woodjam ${id} should not use Utah geoTransform metadata`,
    );
    assertFileExists(file, `Woodjam ${id} asset`);
  }
}

runValidation("runtime asset wiring", () => {
  for (const projectDir of projectDirs()) {
    const project = readJson(`${projectDir}/project.json`);
    for (const layer of project.layers ?? []) {
      validateLayerAssets(projectDir, layer);
    }
    validateEnvironmentTerrainAssets(projectDir);
  }

  validateWoodjamPublicLayers();
});
