import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

function readJson(...parts) {
  return JSON.parse(readSource(...parts));
}

function exists(...parts) {
  return existsSync(join(repoRoot, ...parts));
}

test("editor control manifest policy and guard are installed", () => {
  assert.equal(
    exists("docs", "dev-context", "editor-control-manifest.json"),
    true,
    "editor control manifest should exist",
  );
  assert.equal(
    exists("docs", "dev-context", "Editor-Control-Manifest-Policy.md"),
    true,
    "editor control manifest policy should exist",
  );
  assert.equal(
    exists("tools", "check-editor-control-manifest.mjs"),
    true,
    "editor control manifest validator should exist",
  );

  const manifest = readJson(
    "docs",
    "dev-context",
    "editor-control-manifest.json",
  );
  assert.equal(manifest.schemaVersion, 1, "manifest schema version should be pinned");
  assert.ok(Array.isArray(manifest.entries), "manifest should contain entries");
  assert.ok(
    manifest.entries.length >= 45,
    "manifest should baseline major editor sidebar controls and groups",
  );

  for (const requiredId of [
    "section.pages",
    "section.cinematics",
    "section.topo",
    "section.forge-data",
    "section.cards",
    "topo.group.surface",
    "topo.group.satellite",
    "topo.group.extents",
    "topo.group.environment",
    "topo.environment.fog",
    "topo.satellite.outside-surface",
    "page.action.add",
    "page.action.make-master",
    "page.action.make-child",
    "page.render-preset",
    "layer.fog.use",
    "editor.chrome.panel-width",
    "mt.threshold.surface-boundaries",
    "seismic.display.palette",
  ]) {
    assert.ok(
      manifest.entries.some((entry) => entry.id === requiredId),
      `manifest should include ${requiredId}`,
    );
  }

  const packageJson = readJson("package.json");
  assert.equal(
    packageJson.scripts?.["check:editor-controls"],
    "node tools/check-editor-control-manifest.mjs",
    "package script should expose the editor-control guard",
  );
  assert.match(
    packageJson.scripts?.["check:workspace"] ?? "",
    /check-editor-control-manifest\.mjs/,
    "workspace check should run the editor-control guard",
  );
});

test("editor source exposes stable manifest anchors", () => {
  const editorRoot = readSource("src", "editor", "EditorRoot.tsx");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const pagePanel = readSource("src", "editor", "PagePanel.tsx");
  const environmentPanel = readSource("src", "editor", "EnvironmentScenePanel.tsx");
  const layoutControls = readSource(
    "src",
    "editor",
    "layerControls",
    "layout",
    "LayoutControls.tsx",
  );

  for (const [sourceName, source, anchor] of [
    ["EditorRoot", editorRoot, 'manifestId="section.topo"'],
    ["LayerPanelGroups", layerPanelGroups, 'manifestId="topo.group.satellite"'],
    ["TopoMapPanel", topoPanel, 'manifestId="topo.satellite.outside-surface"'],
    ["TopoMapPanel", topoPanel, 'manifestId="topo.environment.fog"'],
    ["PagePanel", pagePanel, 'data-editor-control-id="page.action.add"'],
    ["EnvironmentScenePanel", environmentPanel, 'manifestId="editor.chrome.panel-width"'],
    ["LayoutControls", layoutControls, 'editorControlId="layer.fog.use"'],
  ]) {
    assert.match(
      source,
      new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${sourceName} should expose ${anchor}`,
    );
  }
});
