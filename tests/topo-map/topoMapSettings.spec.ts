import { expect, test } from "@playwright/test";
import type {
  EnvironmentSetup,
  PresentationPage,
  ProjectManifest,
} from "../../src/pages/types";
import {
  TOPO_MAP_SURFACE_LABEL,
  isTopoMapGraticuleLayer,
  isTopoMapSurfaceLayer,
  resolveTopoMapSettings,
  surfaceElevationPositionsFromTerrain,
  topoMapLayerLabel,
  topoMapPresetPatch,
} from "../../src/topoMap/settings";

const surfaceLayer = {
  id: "regional-dem",
  label: "Regional DEM",
  type: "geotiff",
  files: { raster: "dem.tif" },
  metadata: {
    geoSeeTool: {
      id: "topo-map",
      role: "surface",
      settingsScope: "mixed",
    },
  },
} as const;

const graticuleLayer = {
  id: "lat-lon-grid",
  label: "Latitude / longitude grid",
  type: "line",
  files: {},
  metadata: {
    geoSeeTool: {
      id: "topo-map",
      role: "graticule",
      surfaceLayerId: "regional-dem",
    },
  },
} as const;

function manifest(): ProjectManifest {
  return {
    id: "unit-topo",
    name: "Unit topo",
    crs: { code: "EPSG:32610" },
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    sceneOrigin: [0, 0, 0],
    layers: [surfaceLayer, graticuleLayer],
    pageOrder: [],
    watermark: "",
  };
}

function environment(): EnvironmentSetup {
  return {
    id: "environment",
    layerStyles: {
      "regional-dem": { opacity: 0.5 },
    },
    defaultVisibleLayers: ["regional-dem", "lat-lon-grid"],
    scene: {
      terrain: {
        materialPreset: "surface-elevation",
        surfaceElevationColors: ["#111111"],
        edgeFadeDistanceM: 15000,
      },
    },
  };
}

function page(): PresentationPage {
  return {
    id: "page-1",
    title: "Page",
    camera: {
      position: [0, 0, 1],
      target: [0, 0, 0],
      up: [0, 1, 0],
      fov: 50,
    },
    transition: { duration: 1000, easing: "linear" },
    holdDuration: 1000,
    layerOverrides: {
      "regional-dem": { opacity: 0.75 },
    },
  };
}

test("topo-map role metadata identifies surface and graticule layers", () => {
  expect(isTopoMapSurfaceLayer(surfaceLayer)).toBe(true);
  expect(isTopoMapGraticuleLayer(graticuleLayer)).toBe(true);
  expect(topoMapLayerLabel(surfaceLayer)).toBe(TOPO_MAP_SURFACE_LABEL);
});

test("procedural presets enable elevation gradients with distinct palettes", () => {
  const desert = topoMapPresetPatch("desert-relief");
  const grey = topoMapPresetPatch("grey-relief");
  expect(desert).toMatchObject({
    materialPreset: "desert-relief",
    surfaceElevationEnabled: true,
  });
  expect(grey).toMatchObject({
    materialPreset: "grey-relief",
    surfaceElevationEnabled: true,
  });
  expect(desert?.surfaceElevationColors).toEqual([
    "#5b4130",
    "#8b6240",
    "#bf8f54",
    "#dec37a",
    "#f4e6aa",
  ]);
  expect(grey?.surfaceElevationColors).not.toEqual(
    desert?.surfaceElevationColors,
  );
});

test("ortho-photo preset preserves imported paths and does not enable elevation gradient", () => {
  const patch = topoMapPresetPatch("ortho-photo", {
    orthoPhotoTexture4096Path: "project/ortho-4096.jpg",
    orthoPhotoTexture8192Path: "project/ortho-8192.jpg",
    orthoPhotoTextureBudget: 8192,
  });
  expect(patch).toMatchObject({
    materialPreset: "ortho-photo",
    surfaceElevationEnabled: false,
    orthoPhotoPath: "project/ortho-8192.jpg",
    orthoPhotoTextureBudget: 8192,
  });
});

test("custom preset preserves explicit settings", () => {
  expect(topoMapPresetPatch("custom", { edgeFadeDistanceM: 123 })).toBeNull();
});

test("resolver merges defaults, legacy terrain values, and page style overrides", () => {
  const resolved = resolveTopoMapSettings({
    manifest: manifest(),
    environment: environment(),
    page: page(),
  });
  expect(resolved.surfaceLayerId).toBe("regional-dem");
  expect(resolved.surfaceStyle.opacity).toBe(0.75);
  expect(resolved.graticuleLayers.map((layer) => layer.id)).toEqual([
    "lat-lon-grid",
  ]);
  expect(resolved.terrain).toMatchObject({
    materialPreset: "surface-elevation",
    edgeFadeDistanceM: 15000,
    surfaceElevationEnabled: true,
  });
  expect(resolved.terrain.surfaceElevationColors?.[0]).toBe("#111111");
});

test("gradient positions are clamped into stable draggable stop order", () => {
  expect(
    surfaceElevationPositionsFromTerrain({
      surfaceElevationColorPositions: [0, -1, 0.5, 2, 1],
    }),
  ).toEqual([0, 0.01, 0.5, 0.99, 1]);
});
