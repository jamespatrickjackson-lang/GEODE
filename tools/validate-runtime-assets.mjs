import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function stripAssetQuery(target) {
  return target.split("?")[0];
}

function assetTargetForExtension(target) {
  return stripAssetQuery(target).toLowerCase();
}

function resolveAssetPath(projectDir, target) {
  const normalized = stripAssetQuery(target).replaceAll("\\", "/");
  const candidates = [
    repoPath(normalized),
    resolve(repoPath(projectDir), normalized),
    repoPath(join(dirname(projectDir), normalized).replaceAll("\\", "/")),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function readWebpInfo(assetPath) {
  const bytes = readFileSync(assetPath);
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (chunk === "VP8X" && start + 10 <= bytes.length) {
      return {
        hasAlpha: (bytes[start] & 0x10) !== 0,
        width: 1 + bytes.readUIntLE(start + 4, 3),
        height: 1 + bytes.readUIntLE(start + 7, 3),
      };
    }
    if (chunk === "VP8 " && start + 10 <= bytes.length) {
      return {
        hasAlpha: false,
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && start + 5 <= bytes.length) {
      const b1 = bytes[start + 1];
      const b2 = bytes[start + 2];
      const b3 = bytes[start + 3];
      const b4 = bytes[start + 4];
      return {
        hasAlpha: false,
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
    offset = start + size + (size % 2);
  }
  return null;
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

  const imageSources = Array.isArray(terrain.topoImageMaterialSources)
    ? terrain.topoImageMaterialSources
    : [];
  for (const source of imageSources) {
    assert.equal(
      typeof source.id,
      "string",
      `${projectDir}:environment.scene.terrain topo image source should have an id`,
    );
    assert.equal(
      typeof source.label,
      "string",
      `${projectDir}:environment.scene.terrain topo image source should have a label`,
    );
    for (const target of [
      source.texturePath,
      source.texture4096Path,
      source.texture8192Path,
      source.provenancePath,
    ].filter((value) => typeof value === "string" && value.length > 0)) {
      for (const fragment of SOURCE_ONLY_FRAGMENTS) {
        assertNotContains(
          target,
          fragment,
          `${projectDir}:environment.scene.terrain.topoImageMaterialSources`,
        );
      }
      const assetPath = resolveAssetPath(projectDir, target);
      assert.equal(
        existsSync(assetPath),
        true,
        `${projectDir}:environment.scene.terrain topo image source asset should exist: ${target} (${displayPath(
          assetPath,
        )})`,
      );
    }
    if (Array.isArray(source.bounds)) {
      assert.equal(
        source.bounds.length,
        4,
        `${projectDir}:environment.scene.terrain topo image source bounds should have four numbers`,
      );
      assert.equal(
        source.bounds.every((value) => Number.isFinite(value)),
        true,
        `${projectDir}:environment.scene.terrain topo image source bounds should be finite`,
      );
      assert.equal(
        source.bounds[2] > source.bounds[0] &&
          source.bounds[3] > source.bounds[1],
        true,
        `${projectDir}:environment.scene.terrain topo image source bounds should be ordered`,
      );
    }
    assert.equal(
      typeof source.baseSourceId,
      "undefined",
      `${projectDir}:environment.scene.terrain topo image source should not composite a base source`,
    );
    if (source.hasAlpha === true) {
      assert.equal(
        source.format === "webp" || source.format === "png",
        true,
        `${projectDir}:environment.scene.terrain alpha topo image source should use an alpha-capable format`,
      );
      for (const target of [
        source.texturePath,
        source.texture4096Path,
        source.texture8192Path,
      ].filter((value) => typeof value === "string" && value.length > 0)) {
        const assetPath = resolveAssetPath(projectDir, target);
        if (assetTargetForExtension(target).endsWith(".webp")) {
          const webpInfo = readWebpInfo(assetPath);
          assert.notEqual(
            webpInfo,
            null,
            `${projectDir}:environment.scene.terrain alpha topo image source should be a valid WebP: ${target}`,
          );
          assert.equal(
            webpInfo?.hasAlpha,
            true,
            `${projectDir}:environment.scene.terrain alpha topo image source should preserve WebP alpha: ${target}`,
          );
          assert.equal(
            (webpInfo?.width ?? 0) > 0 && (webpInfo?.height ?? 0) > 0,
            true,
            `${projectDir}:environment.scene.terrain alpha topo image source should report valid dimensions: ${target}`,
          );
        }
      }
    }
    if (Array.isArray(source.detailOverlays)) {
      for (const overlay of source.detailOverlays) {
        assert.equal(
          typeof overlay.id,
          "string",
          `${projectDir}:environment.scene.terrain topo image detail overlay should have an id`,
        );
        assert.equal(
          Array.isArray(overlay.bounds) && overlay.bounds.length === 4,
          true,
          `${projectDir}:environment.scene.terrain topo image detail overlay bounds should have four numbers`,
        );
        assert.equal(
          overlay.bounds.every((value) => Number.isFinite(value)),
          true,
          `${projectDir}:environment.scene.terrain topo image detail overlay bounds should be finite`,
        );
        if (Array.isArray(source.bounds)) {
          assert.equal(
            overlay.bounds[0] >= source.bounds[0] &&
              overlay.bounds[1] >= source.bounds[1] &&
              overlay.bounds[2] <= source.bounds[2] &&
              overlay.bounds[3] <= source.bounds[3],
            true,
            `${projectDir}:environment.scene.terrain topo image detail overlay bounds should sit inside source bounds`,
          );
        }
        if (typeof overlay.resolutionM === "number") {
          assert.equal(
            overlay.resolutionM > 0 && overlay.resolutionM <= 1.5,
            true,
            `${projectDir}:environment.scene.terrain topo image detail overlay should declare high-detail resolution`,
          );
        }
        for (const target of [
          overlay.texturePath,
          overlay.texture4096Path,
          overlay.texture8192Path,
        ].filter((value) => typeof value === "string" && value.length > 0)) {
          const assetPath = resolveAssetPath(projectDir, target);
          assert.equal(
            existsSync(assetPath),
            true,
            `${projectDir}:environment.scene.terrain topo image detail overlay asset should exist: ${target} (${displayPath(
              assetPath,
            )})`,
          );
          if (assetTargetForExtension(target).endsWith(".webp")) {
            const webpInfo = readWebpInfo(assetPath);
            assert.notEqual(
              webpInfo,
              null,
              `${projectDir}:environment.scene.terrain topo image detail overlay should be a valid WebP: ${target}`,
            );
            assert.equal(
              (webpInfo?.width ?? 0) > 0 && (webpInfo?.height ?? 0) > 0,
              true,
              `${projectDir}:environment.scene.terrain topo image detail overlay should report valid dimensions: ${target}`,
            );
          }
        }
      }
    }
    if (terrain.materialPreset === `image:${source.id}`) {
      const sourceBudget =
        terrain.orthoPhotoTextureBudget === 8192
          ? 8192
          : terrain.orthoPhotoTextureBudget === 4096
            ? 4096
            : source.textureBudget === 8192
              ? 8192
              : 4096;
      const expectedPath =
        sourceBudget === 8192
          ? source.texture8192Path || source.texturePath
          : source.texture4096Path || source.texturePath;
      if (expectedPath) {
        assert.equal(
          terrain.orthoPhotoPath,
          expectedPath,
          `${projectDir}:environment.scene.terrain active image material path should match selected topo image source`,
        );
      }
    }
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

function validateCaptureDirectorFfmpegAssets() {
  const packageLock = readJson("package-lock.json");
  assert.ok(
    packageLock.packages?.["node_modules/@ffmpeg/core"],
    "Capture Director should lock @ffmpeg/core for self-hosted FFmpeg assets",
  );
  for (const filename of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
    assertFileExists(
      `node_modules/@ffmpeg/core/dist/umd/${filename}`,
      `Capture Director FFmpeg asset ${filename}`,
    );
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
  validateCaptureDirectorFfmpegAssets();
});
