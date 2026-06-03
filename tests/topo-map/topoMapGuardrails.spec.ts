import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("editor exposes Topo from topo metadata, not the Utah FORGE slug", () => {
  const source = readRepoFile("src/editor/EditorRoot.tsx");
  const sectionIndex = source.indexOf('title="Topo"');
  expect(sectionIndex).toBeGreaterThan(-1);
  const sectionSource = source.slice(
    Math.max(0, sectionIndex - 320),
    sectionIndex + 160,
  );

  expect(source).toContain(
    "const hasPublicTopoMap = topoMapLayerIds(state.manifest.layers).length > 0;",
  );
  expect(sectionSource).toContain("{hasPublicTopoMap && (");
  expect(sectionSource).not.toContain('projectSlug === "utah-forge"');
});

test("topo runtime/editor code does not directly depend on the Utah graticule id", () => {
  const checkedFiles = [
    "src/editor/EditorRoot.tsx",
    "src/editor/LayerPanel.tsx",
    "src/scene/SceneManager.ts",
    "src/topoMap/runtime.ts",
    "src/topoMap/graticuleRuntime.ts",
    "src/topoMap/surfaceRuntime.ts",
  ];

  for (const relativePath of checkedFiles) {
    const source = readRepoFile(relativePath);
    expect(source, relativePath).not.toContain(
      "UTAH_FORGE_TOPO_GRATICULE_LAYER_ID",
    );
    expect(source, relativePath).not.toContain("utah-forge-topo-graticule");
  }
});

test("legacy Utah topo fallback is centralized in settings compatibility", () => {
  const source = readRepoFile("src/topoMap/settings.ts");
  expect(source).toContain("TOPO_MAP_LEGACY_GRATICULE_LAYER_ID");
  expect(source.match(/utah-forge-topo-graticule/g)).toHaveLength(1);
});
