import { expect, test } from "@playwright/test";
import type {
  EnvironmentSetup,
  PresentationPage,
  ProjectManifest,
} from "../../src/pages/types";
import {
  TOPO_MAP_SURFACE_LABEL,
  isTopoMapGraticuleLayer,
  isTopoMapReferenceLayer,
  isTopoMapSurfaceLayer,
  resolveTopoMapSettings,
  surfaceElevationPositionsFromTerrain,
  topoMapLayerIds,
  topoMapLayerLabel,
  topoMapPresetPatch,
  topoMapRuntimeLayerIds,
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

const roadReferenceLayer = {
  id: "regional-roads",
  label: "Regional roads",
  type: "line",
  files: {},
  metadata: {
    geoSeeTool: {
      id: "topo-map",
      role: "reference",
      surfaceLayerId: "regional-dem",
    },
  },
} as const;

const streamReferenceLayer = {
  id: "regional-streams",
  label: "Regional streams",
  type: "line",
  files: {},
  metadata: {
    geoSeeTool: {
      id: "topo-map",
      role: "reference",
      surfaceLayerId: "regional-dem",
    },
  },
} as const;

const lakeReferenceLayer = {
  id: "regional-lakes",
  label: "Regional lakes",
  type: "polygon",
  files: {},
  metadata: {
    geoSeeTool: {
      id: "topo-map",
      role: "reference",
      surfaceLayerId: "regional-dem",
    },
  },
} as const;

const unrelatedLegacyNamedRoadLayer = {
  id: "transport-roads",
  label: "Transport roads outside topo tool",
  type: "line",
  files: {},
} as const;

function manifest(): ProjectManifest {
  return {
    id: "unit-topo",
    name: "Unit topo",
    crs: { code: "EPSG:32610" },
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    sceneOrigin: [0, 0, 0],
    layers: [
      surfaceLayer,
      graticuleLayer,
      roadReferenceLayer,
      streamReferenceLayer,
      lakeReferenceLayer,
      unrelatedLegacyNamedRoadLayer,
    ],
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
  expect(isTopoMapReferenceLayer(roadReferenceLayer)).toBe(true);
  expect(topoMapLayerLabel(surfaceLayer)).toBe(TOPO_MAP_SURFACE_LABEL);
});

test("metadata-authored topo map selects non-Utah layer ids without legacy defaults", () => {
  const layerIds = topoMapLayerIds(manifest().layers);
  expect(layerIds).toEqual([
    "regional-dem",
    "lat-lon-grid",
    "regional-roads",
    "regional-streams",
    "regional-lakes",
  ]);
  expect(layerIds).not.toContain("terrain");
  expect(layerIds).not.toContain("utah-forge-topo-graticule");
  expect(layerIds).not.toContain("transport-roads");
});

test("legacy topo fallbacks are isolated to projects without topo metadata", () => {
  const legacyLayerIds = topoMapLayerIds([
    {
      id: "terrain",
      label: "Legacy terrain",
      type: "geotiff",
      files: {},
    },
    {
      id: "utah-forge-topo-graticule",
      label: "Legacy grid",
      type: "line",
      files: {},
      metadata: { topoGraticule: true },
    },
    {
      id: "transport-roads",
      label: "Legacy roads",
      type: "line",
      files: {},
    },
  ] as ProjectManifest["layers"]);
  expect(legacyLayerIds).toEqual([
    "terrain",
    "utah-forge-topo-graticule",
    "transport-roads",
  ]);

  const runtimeIds = topoMapRuntimeLayerIds({
    layerSpecs: [],
    hasLoadedLayer: (id) =>
      ["terrain", "utah-forge-topo-graticule"].includes(id),
  });
  expect(runtimeIds).toMatchObject({
    surfaceLayerId: "terrain",
    graticuleLayerIds: ["utah-forge-topo-graticule"],
    publicSurfaceLayerIds: ["terrain", "utah-forge-topo-graticule"],
  });
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
  expect(resolved.referenceLayers.map((layer) => layer.id)).toEqual([
    "regional-roads",
    "regional-streams",
    "regional-lakes",
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
