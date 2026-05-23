import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

const auditScript = path.join(
  process.cwd(),
  "tools",
  "audit-topo-map-defaults.mjs",
);

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function makeProjectFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "topo-audit-"));
  const pagesDir = path.join(root, "pages");
  mkdirSync(pagesDir, { recursive: true });
  writeJson(path.join(root, "project.json"), {
    id: "utah-forge",
    name: "Utah FORGE",
    layers: [
      {
        id: "terrain",
        label: "Topo Surface",
        type: "geotiff",
        metadata: {
          geoSeeTool: {
            id: "topo-map",
            role: "surface",
            settingsScope: "mixed",
          },
        },
      },
      {
        id: "utah-forge-topo-graticule",
        label: "Grid",
        type: "line",
        metadata: {
          geoSeeTool: {
            id: "topo-map",
            role: "graticule",
            surfaceLayerId: "terrain",
          },
        },
      },
      {
        id: "transport-roads",
        label: "Roads",
        type: "line",
        metadata: {
          geoSeeTool: { id: "topo-map", role: "reference" },
        },
      },
      {
        id: "hydrography-streams",
        label: "Streams",
        type: "line",
        metadata: {
          geoSeeTool: { id: "topo-map", role: "reference" },
        },
      },
      {
        id: "hydrography-lakes",
        label: "Lakes",
        type: "polygon",
        metadata: {
          geoSeeTool: { id: "topo-map", role: "reference" },
        },
      },
    ],
  });
  writeJson(path.join(root, "environment.json"), {
    id: "environment",
    defaultVisibleLayers: ["terrain", "utah-forge-topo-graticule"],
    layerStyles: {
      terrain: { opacity: 0.42, publicSurfaceClipEnabled: false },
      "utah-forge-topo-graticule": { color: "#222222" },
      "transport-roads": { opacity: 0.8 },
      "hydrography-streams": { opacity: 0.48 },
      "hydrography-lakes": { opacity: 0.6 },
    },
    scene: {
      terrain: {
        materialPreset: "surface-elevation",
        surfaceElevationEnabled: true,
        surfaceElevationColors: ["#5147b8", "#2e8fd8"],
        surfaceElevationMinM: 1500,
        surfaceElevationMaxM: 3500,
        surfaceElevationColorPositions: [0, 0.25, 0.5, 0.75, 1],
        surfaceElevationMidpoints: [0.5, 0.5, 0.5, 0.5],
        surfaceElevationTransitionSoftness: 1,
        surfaceElevationColorBlend: 1,
        surfaceElevationReverse: false,
        edgeFadeDistanceM: 15000,
        edgeFadeShape: "rounded-square",
        edgeFadeInsetM: 65000,
        edgeFadeCornerRadiusM: 65000,
        orthoPhotoPath: "rasters/ortho.jpg",
        topoMapBranding: { visible: true, heading: "Utah FORGE" },
      },
    },
    customRenderPresets: [
      {
        id: "preset-1",
        label: "Preset",
        scenePatch: {
          terrain: {
            materialPreset: "surface-elevation",
            surfaceElevationMinM: 1500,
            surfaceElevationMaxM: 3500,
            surfaceElevationColorPositions: [0, 0.25, 0.5, 0.75, 1],
            surfaceElevationMidpoints: [0.5, 0.5, 0.5, 0.5],
            surfaceElevationTransitionSoftness: 1,
            surfaceElevationColorBlend: 1,
            surfaceElevationReverse: false,
            edgeFadeDistanceM: 25000,
          },
        },
      },
    ],
  });
  writeJson(path.join(pagesDir, "page-1.json"), {
    id: "page-1",
    title: "Page",
    visibilityOverrides: {
      terrain: true,
      "transport-roads": false,
      "hydrography-streams": true,
    },
    layerOverrides: {
      terrain: { opacity: 0.42, meshSurfaceLiftM: 10 },
    },
  });
  return root;
}

function runAudit(projectRoot: string, write = false) {
  const output = execFileSync(
    process.execPath,
    [auditScript, projectRoot, ...(write ? ["--write"] : [])],
    { encoding: "utf8" },
  );
  return JSON.parse(output) as {
    write: {
      requested: boolean;
      blocked: boolean;
      equivalence: string;
      removedCount: number;
      writtenFiles: string[];
    };
    topoMap: { metadataIssues: unknown[] };
    candidates: Array<{
      kind: string;
      file: string;
      path: string;
      key: string;
      writeEligible: boolean;
    }>;
    summary: { byKind: Record<string, number> };
  };
}

test("topo audit reports environment, render preset, and page pruning candidates", () => {
  const projectRoot = makeProjectFixture();
  try {
    const report = runAudit(projectRoot);

    expect(report.topoMap.metadataIssues).toEqual([]);
    expect(report.summary.byKind["terrain-default"]).toBe(14);
    expect(
      report.candidates.some(
        (candidate) =>
          candidate.path === "scene.terrain.surfaceElevationMinM",
      ),
    ).toBe(true);
    expect(
      report.candidates.some((candidate) =>
        candidate.path.includes(
          "customRenderPresets[0].scenePatch.terrain.surfaceElevationMaxM",
        ),
      ),
    ).toBe(true);
    expect(
      report.candidates.some(
        (candidate) =>
          candidate.kind === "page-style-override" &&
          candidate.path === "layerOverrides.terrain.opacity",
      ),
    ).toBe(true);
    expect(
      report.candidates.some(
        (candidate) =>
          candidate.kind === "page-visibility-override" &&
          candidate.key === "transport-roads",
      ),
    ).toBe(true);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("topo audit write mode prunes only effective-equivalent topo defaults", () => {
  const projectRoot = makeProjectFixture();
  try {
    const report = runAudit(projectRoot, true);
    const environment = readJson<{
      scene: { terrain: Record<string, unknown> };
      customRenderPresets: Array<{
        scenePatch: { terrain: Record<string, unknown> };
      }>;
    }>(path.join(projectRoot, "environment.json"));
    const page = readJson<{
      visibilityOverrides: Record<string, boolean>;
      layerOverrides: Record<string, Record<string, unknown>>;
    }>(path.join(projectRoot, "pages", "page-1.json"));

    expect(report.write).toMatchObject({
      requested: true,
      blocked: false,
      equivalence: "passed",
    });
    expect(report.write.writtenFiles).toContain("environment.json");
    expect(environment.scene.terrain.surfaceElevationMinM).toBeUndefined();
    expect(environment.scene.terrain.surfaceElevationColorBlend).toBeUndefined();
    expect(
      environment.customRenderPresets[0].scenePatch.terrain
        .surfaceElevationColorPositions,
    ).toBeUndefined();
    expect(environment.scene.terrain.surfaceElevationEnabled).toBe(true);
    expect(environment.scene.terrain.surfaceElevationColors).toEqual([
      "#5147b8",
      "#2e8fd8",
    ]);
    expect(environment.scene.terrain.edgeFadeDistanceM).toBe(15000);
    expect(environment.scene.terrain.orthoPhotoPath).toBe("rasters/ortho.jpg");
    expect(environment.scene.terrain.topoMapBranding).toEqual({
      visible: true,
      heading: "Utah FORGE",
    });
    expect(page.visibilityOverrides.terrain).toBeUndefined();
    expect(page.visibilityOverrides["transport-roads"]).toBeUndefined();
    expect(page.visibilityOverrides["hydrography-streams"]).toBe(true);
    expect(page.layerOverrides.terrain.opacity).toBeUndefined();
    expect(page.layerOverrides.terrain.meshSurfaceLiftM).toBe(10);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("topo audit preserves geoSeeTool metadata and authored terrain fields", () => {
  const projectRoot = makeProjectFixture();
  try {
    runAudit(projectRoot, true);
    const manifest = readJson<{ layers: Array<{ metadata?: unknown }> }>(
      path.join(projectRoot, "project.json"),
    );
    const environment = readJson<{
      scene: { terrain: Record<string, unknown> };
    }>(path.join(projectRoot, "environment.json"));

    expect(manifest.layers.every((layer) => layer.metadata)).toBe(true);
    expect(environment.scene.terrain.materialPreset).toBe("surface-elevation");
    expect(environment.scene.terrain.surfaceElevationEnabled).toBe(true);
    expect(environment.scene.terrain.edgeFadeShape).toBe("rounded-square");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
