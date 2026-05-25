import { expect, test } from "@playwright/test";
import type { EnvironmentSetup, UserRenderPreset } from "../../src/pages/types";
import {
  createUserRenderPresetFromEnvironment,
  scenePatchForRenderPreset,
} from "../../src/pages/renderPresets";
import { applyTopoMaterialAuthority } from "../../src/topoMap/materialAuthority";

const naipBounds: [number, number, number, number] = [
  290781, 4227994, 380781, 4279994,
];
const orthoBounds: [number, number, number, number] = [
  -356385.9, 3703652, 1039320.6, 4843097,
];

function userPreset(): UserRenderPreset {
  return {
    id: "user-3",
    label: "User 3",
    source: "user",
    createdAt: "2026-05-23T00:00:00.000Z",
    background: "#111111",
    terrainMode: "relief",
    contourMode: "subtle",
    publicDataMode: "standard",
    labelDensity: "medium",
    fog: { enabled: false, color: "#111111" },
    lighting: {
      ambientIntensity: 1,
      sunIntensity: 1,
      rimIntensity: 0,
      lockSunToCamera: false,
    },
    effects: { dataGlow: 0, lineHalo: 0, atmosphere: 0 },
    scenePatch: {
      terrain: {
        materialPreset: "ortho-photo",
        orthoPhotoPath: "project/ortho-8192.jpg",
        orthoPhotoTextureBudget: 8192,
        orthoPhotoBounds: orthoBounds,
        orthoPhotoOpacity: 1,
        surfaceElevationEnabled: false,
        hillshadeIntensity: 0.42,
      },
    },
  };
}

function environment(): EnvironmentSetup {
  return {
    id: "environment",
    renderPreset: "user-3",
    customRenderPresets: [userPreset()],
    defaultVisibleLayers: [],
    layerStyles: {},
    scene: {
      terrain: {
        materialPreset: "image:naip-2024-aerial",
        topoImageMaterialSources: [
          {
            id: "naip-2024-aerial",
            label: "NAIP 2024 Aerial Image",
            texture8192Path: "project/naip-8192.webp",
            textureBudget: 8192,
            format: "webp",
            hasAlpha: true,
            bounds: naipBounds,
          },
        ],
        orthoPhotoPath: "project/naip-8192.webp",
        orthoPhotoTextureBudget: 8192,
        orthoPhotoBounds: naipBounds,
        orthoPhotoOpacity: 1,
        surfaceElevationEnabled: false,
        surfaceElevationColors: ["#111111", "#222222"],
        hillshadeIntensity: 0.86,
      },
    },
  };
}

test("topo material authority wins over active user render preset terrain fields", () => {
  const env = environment();
  const presetPatch = scenePatchForRenderPreset("user-3", env.customRenderPresets);

  expect(presetPatch?.terrain).toEqual({ hillshadeIntensity: 0.42 });

  const presetMergedTerrain = {
    ...(env.scene?.terrain ?? {}),
    ...(presetPatch?.terrain ?? {}),
  };
  const runtimeTerrain = applyTopoMaterialAuthority(
    presetMergedTerrain,
    env.scene?.terrain,
  );

  expect(runtimeTerrain).toMatchObject({
    materialPreset: "image:naip-2024-aerial",
    orthoPhotoPath: "project/naip-8192.webp",
    orthoPhotoTextureBudget: 8192,
    orthoPhotoBounds: naipBounds,
    surfaceElevationColors: ["#111111", "#222222"],
    hillshadeIntensity: 0.42,
  });
});

test("new user render presets do not capture topo material source fields", () => {
  const preset = createUserRenderPresetFromEnvironment(
    environment(),
    "2026-05-23T01:00:00.000Z",
  );

  expect(preset.scenePatch.terrain).toEqual({ hillshadeIntensity: 0.86 });
});
