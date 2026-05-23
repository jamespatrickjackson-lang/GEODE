#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const writeMode = args.includes("--write");
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
const explicitProjectPath = positionalArgs.length > 0;
const projectRoot = positionalArgs[0] ?? "projects/utah-forge";

if (args.some((arg) => arg.startsWith("--") && arg !== "--write")) {
  console.error(
    "Usage: node tools/audit-topo-map-defaults.mjs [project-dir] [--write]",
  );
  process.exit(1);
}

const SAFE_TERRAIN_DEFAULTS = {
  surfaceElevationMinM: 1500,
  surfaceElevationMaxM: 3500,
  surfaceElevationColorPositions: [0, 0.25, 0.5, 0.75, 1],
  surfaceElevationMidpoints: [0.5, 0.5, 0.5, 0.5],
  surfaceElevationTransitionSoftness: 1,
  surfaceElevationColorBlend: 1,
  surfaceElevationReverse: false,
};

const TOPO_TOOL_ID = "topo-map";
const EXPECTED_LAYER_ROLES = {
  terrain: "surface",
  "utah-forge-topo-graticule": "graticule",
  "transport-roads": "reference",
  "hydrography-streams": "reference",
  "hydrography-lakes": "reference",
};

const PRESERVE_TERRAIN_KEYS = new Set([
  "surfaceElevationColors",
  "surfaceElevationEnabled",
  "surfaceElevationLegendVisible",
  "edgeFadeDistanceM",
  "edgeFadeShape",
  "edgeFadeInsetM",
  "edgeFadeCornerRadiusM",
  "materialPreset",
]);

const PRESERVE_TERRAIN_PREFIXES = [
  "orthoPhoto",
  "topoMapBranding",
  "publicSurfaceClip",
];

const projectPath = path.resolve(projectRoot);
const envPath = path.join(projectPath, "environment.json");
const manifestPath = path.join(projectPath, "project.json");

if (
  writeMode &&
  !explicitProjectPath &&
  path.normalize(projectRoot) !== "projects\\utah-forge" &&
  path.normalize(projectRoot) !== "projects/utah-forge"
) {
  console.error(
    "--write without an explicit project path is limited to projects/utah-forge.",
  );
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getAtPath(root, segments) {
  return segments.reduce(
    (current, segment) => (current == null ? undefined : current[segment]),
    root,
  );
}

function deleteAtPath(root, segments) {
  if (segments.length === 0) {
    return false;
  }
  const parent = getAtPath(root, segments.slice(0, -1));
  if (!isPlainObject(parent) && !Array.isArray(parent)) {
    return false;
  }
  const key = segments[segments.length - 1];
  if (!(key in parent)) {
    return false;
  }
  delete parent[key];
  return true;
}

function pruneEmptyObjectAtPath(root, segments) {
  const value = getAtPath(root, segments);
  if (isPlainObject(value) && Object.keys(value).length === 0) {
    deleteAtPath(root, segments);
  }
}

function topoRole(layer) {
  const tool = layer?.metadata?.geoSeeTool;
  return tool?.id === TOPO_TOOL_ID ? tool.role : null;
}

function topoSurfaceLayerIds(manifest) {
  return manifest.layers
    .filter((layer) => topoRole(layer) === "surface")
    .map((layer) => layer.id);
}

function topoGraticuleLayerIds(manifest) {
  return manifest.layers
    .filter((layer) => topoRole(layer) === "graticule")
    .map((layer) => layer.id);
}

function topoReferenceLayerIds(manifest) {
  return manifest.layers
    .filter((layer) => topoRole(layer) === "reference")
    .map((layer) => layer.id);
}

function sortedEntries(value) {
  return Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

function terrainKeyIsProtected(key) {
  return (
    PRESERVE_TERRAIN_KEYS.has(key) ||
    PRESERVE_TERRAIN_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function normalizeTerrain(terrain) {
  const normalized = cloneJson(terrain ?? {});
  for (const [key, value] of Object.entries(SAFE_TERRAIN_DEFAULTS)) {
    if (normalized[key] === undefined) {
      normalized[key] = cloneJson(value);
    }
  }
  return Object.fromEntries(sortedEntries(normalized));
}

function effectiveLayerStyle(environment, page, layerId) {
  return {
    ...(environment.layerStyles?.[layerId] ?? {}),
    ...(page?.layerOverrides?.[layerId] ?? {}),
  };
}

function effectiveVisibility(environment, page, layerId) {
  if (page?.visibilityOverrides?.[layerId] !== undefined) {
    return page.visibilityOverrides[layerId];
  }
  return (environment.defaultVisibleLayers ?? []).includes(layerId);
}

function normalizeRenderPresets(environment) {
  return (environment.customRenderPresets ?? []).map((preset) => ({
    id: preset.id ?? null,
    label: preset.label ?? null,
    terrain: normalizeTerrain(preset.scenePatch?.terrain ?? {}),
  }));
}

function normalizeEffectiveTopoState({ manifest, environment, pages }) {
  const surfaceIds = topoSurfaceLayerIds(manifest);
  const graticuleIds = topoGraticuleLayerIds(manifest);
  const referenceIds = topoReferenceLayerIds(manifest);
  const topoIds = [...surfaceIds, ...graticuleIds, ...referenceIds];
  const environmentLayerStyles = Object.fromEntries(
    topoIds.map((layerId) => [
      layerId,
      Object.fromEntries(sortedEntries(environment.layerStyles?.[layerId] ?? {})),
    ]),
  );
  const environmentVisibility = Object.fromEntries(
    topoIds.map((layerId) => [
      layerId,
      (environment.defaultVisibleLayers ?? []).includes(layerId),
    ]),
  );
  const pageStates = pages.map((page) => ({
    file: page.relativePath,
    layerStyles: Object.fromEntries(
      topoIds.map((layerId) => [
        layerId,
        Object.fromEntries(
          sortedEntries(effectiveLayerStyle(environment, page.data, layerId)),
        ),
      ]),
    ),
    visibility: Object.fromEntries(
      topoIds.map((layerId) => [
        layerId,
        effectiveVisibility(environment, page.data, layerId),
      ]),
    ),
  }));
  return {
    surfaceLayerIds: surfaceIds,
    graticuleLayerIds: graticuleIds,
    referenceLayerIds: referenceIds,
    terrain: normalizeTerrain(environment.scene?.terrain ?? {}),
    environmentLayerStyles,
    environmentVisibility,
    renderPresets: normalizeRenderPresets(environment),
    pages: pageStates,
  };
}

function formatPath(segments) {
  return segments
    .map((segment) =>
      typeof segment === "number"
        ? `[${segment}]`
        : /^[A-Za-z_$][\w$]*$/.test(segment)
          ? `.${segment}`
          : `[${JSON.stringify(segment)}]`,
    )
    .join("")
    .replace(/^\./, "");
}

function addCandidate(candidates, candidate) {
  candidates.push({
    kind: candidate.kind,
    file: candidate.file,
    path: formatPath(candidate.segments),
    key: candidate.key,
    oldValue: cloneJson(candidate.oldValue),
    reason: candidate.reason,
    writeEligible: candidate.writeEligible === true,
    target: candidate.target,
    segments: candidate.segments,
    cleanupSegments: candidate.cleanupSegments ?? [],
  });
}

function collectTerrainDefaultCandidates({
  candidates,
  file,
  target,
  terrain,
  baseSegments,
  reasonPrefix,
}) {
  if (!isPlainObject(terrain)) {
    return;
  }
  for (const [key, defaultValue] of Object.entries(SAFE_TERRAIN_DEFAULTS)) {
    if (terrainKeyIsProtected(key)) {
      continue;
    }
    if (sameJson(terrain[key], defaultValue)) {
      addCandidate(candidates, {
        kind: "terrain-default",
        file,
        target,
        segments: [...baseSegments, key],
        key,
        oldValue: terrain[key],
        reason: `${reasonPrefix} duplicates the topo runtime default`,
        writeEligible: true,
      });
    }
  }
}

function collectRenderPresetCandidates(candidates, environment) {
  for (const [index, preset] of (environment.customRenderPresets ?? []).entries()) {
    collectTerrainDefaultCandidates({
      candidates,
      file: "environment.json",
      target: { fileType: "environment" },
      terrain: preset.scenePatch?.terrain,
      baseSegments: [
        "customRenderPresets",
        index,
        "scenePatch",
        "terrain",
      ],
      reasonPrefix: `customRenderPresets[${index}].scenePatch.terrain`,
    });
  }
}

function collectPageOverrideCandidates({
  candidates,
  environment,
  pages,
  topoLayerIds,
}) {
  const defaultVisible = new Set(environment.defaultVisibleLayers ?? []);
  for (const [pageIndex, page] of pages.entries()) {
    const pageData = page.data;
    for (const layerId of topoLayerIds) {
      const envStyle = environment.layerStyles?.[layerId] ?? {};
      const override = pageData.layerOverrides?.[layerId];
      if (isPlainObject(override)) {
        for (const [key, value] of sortedEntries(override)) {
          if (sameJson(value, envStyle[key])) {
            addCandidate(candidates, {
              kind: "page-style-override",
              file: page.relativePath,
              target: { fileType: "page", pageIndex },
              segments: ["layerOverrides", layerId, key],
              cleanupSegments: [
                ["layerOverrides", layerId],
                ["layerOverrides"],
              ],
              key,
              oldValue: value,
              reason: `${page.relativePath} layer override matches inherited ${layerId}.${key}`,
              writeEligible: true,
            });
          }
        }
      }
      if (pageData.visibilityOverrides?.[layerId] !== undefined) {
        const overrideValue = pageData.visibilityOverrides[layerId];
        const inheritedValue = defaultVisible.has(layerId);
        if (sameJson(overrideValue, inheritedValue)) {
          addCandidate(candidates, {
            kind: "page-visibility-override",
            file: page.relativePath,
            target: { fileType: "page", pageIndex },
            segments: ["visibilityOverrides", layerId],
            cleanupSegments: [["visibilityOverrides"]],
            key: layerId,
            oldValue: overrideValue,
            reason: `${page.relativePath} visibility override matches inherited visibility for ${layerId}`,
            writeEligible: true,
          });
        }
      }
    }
  }
}

function collectMetadataIssues(manifest) {
  const issues = [];
  for (const [layerId, expectedRole] of Object.entries(EXPECTED_LAYER_ROLES)) {
    const layer = manifest.layers.find((candidate) => candidate.id === layerId);
    if (!layer) {
      issues.push({
        layerId,
        issue: "missing-layer",
        expectedRole,
      });
      continue;
    }
    const tool = layer.metadata?.geoSeeTool;
    if (!tool) {
      issues.push({
        layerId,
        issue: "missing-geoSeeTool-metadata",
        expectedRole,
      });
      continue;
    }
    if (tool.id !== TOPO_TOOL_ID || tool.role !== expectedRole) {
      issues.push({
        layerId,
        issue: "invalid-geoSeeTool-metadata",
        expectedRole,
        actual: tool,
      });
    }
  }
  const graticule = manifest.layers.find(
    (layer) => layer.id === "utah-forge-topo-graticule",
  );
  if (
    graticule?.metadata?.geoSeeTool?.role === "graticule" &&
    graticule.metadata.geoSeeTool.surfaceLayerId !== "terrain"
  ) {
    issues.push({
      layerId: graticule.id,
      issue: "invalid-graticule-surface-layer",
      expectedSurfaceLayerId: "terrain",
      actualSurfaceLayerId: graticule.metadata.geoSeeTool.surfaceLayerId,
    });
  }
  return issues;
}

function listPageFiles(pagesRoot) {
  if (!fs.existsSync(pagesRoot)) {
    return [];
  }
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  };
  visit(pagesRoot);
  return files.sort((a, b) => a.localeCompare(b));
}

function loadProjectState() {
  const manifest = readJson(manifestPath);
  const environment = readJson(envPath);
  const pagesRoot = path.join(projectPath, "pages");
  const pages = listPageFiles(pagesRoot).map((pagePath) => ({
    fullPath: pagePath,
    relativePath: path.relative(projectPath, pagePath).replaceAll(path.sep, "/"),
    data: readJson(pagePath),
  }));
  return { manifest, environment, pages };
}

function collectCandidates(state) {
  const candidates = [];
  const surfaceIds = topoSurfaceLayerIds(state.manifest);
  const graticuleIds = topoGraticuleLayerIds(state.manifest);
  const referenceIds = topoReferenceLayerIds(state.manifest);
  const topoLayerIds = [...surfaceIds, ...graticuleIds, ...referenceIds];
  collectTerrainDefaultCandidates({
    candidates,
    file: "environment.json",
    target: { fileType: "environment" },
    terrain: state.environment.scene?.terrain,
    baseSegments: ["scene", "terrain"],
    reasonPrefix: "environment.scene.terrain",
  });
  collectRenderPresetCandidates(candidates, state.environment);
  collectPageOverrideCandidates({
    candidates,
    environment: state.environment,
    pages: state.pages,
    topoLayerIds,
  });
  return candidates;
}

function applyCandidate(state, candidate) {
  const root =
    candidate.target.fileType === "environment"
      ? state.environment
      : state.pages[candidate.target.pageIndex]?.data;
  if (!root) {
    return false;
  }
  const removed = deleteAtPath(root, candidate.segments);
  for (const cleanupPath of candidate.cleanupSegments ?? []) {
    pruneEmptyObjectAtPath(root, cleanupPath);
  }
  return removed;
}

function redactCandidate(candidate) {
  const {
    target: _target,
    segments: _segments,
    cleanupSegments: _cleanupSegments,
    ...publicCandidate
  } = candidate;
  return publicCandidate;
}

function changedJson(before, after) {
  return !sameJson(before, after);
}

const state = loadProjectState();
const candidates = collectCandidates(state);
const metadataIssues = collectMetadataIssues(state.manifest);
let writeSummary = {
  requested: writeMode,
  blocked: false,
  equivalence: writeMode ? "not-run" : "not-requested",
  removedCount: 0,
  writtenFiles: [],
};

if (writeMode) {
  const beforeState = cloneJson(state);
  const afterState = cloneJson(state);
  const writeCandidates = candidates.filter(
    (candidate) => candidate.writeEligible,
  );

  if (metadataIssues.length > 0) {
    writeSummary = {
      ...writeSummary,
      blocked: true,
      equivalence: "not-run",
      reason: "Topo tool metadata issues must be fixed before write mode.",
    };
  } else {
    for (const candidate of writeCandidates) {
      applyCandidate(afterState, candidate);
    }

    const beforeEffective = normalizeEffectiveTopoState(beforeState);
    const afterEffective = normalizeEffectiveTopoState(afterState);
    if (!sameJson(beforeEffective, afterEffective)) {
      writeSummary = {
        ...writeSummary,
        blocked: true,
        equivalence: "failed",
        mismatch: {
          before: beforeEffective,
          after: afterEffective,
        },
      };
    } else {
      writeSummary.equivalence = "passed";
      writeSummary.removedCount = writeCandidates.length;
      if (changedJson(state.environment, afterState.environment)) {
        writeJson(envPath, afterState.environment);
        writeSummary.writtenFiles.push("environment.json");
      }
      for (const [index, page] of state.pages.entries()) {
        if (changedJson(page.data, afterState.pages[index].data)) {
          writeJson(page.fullPath, afterState.pages[index].data);
          writeSummary.writtenFiles.push(page.relativePath);
        }
      }
    }
  }
}

const surfaceLayers = topoSurfaceLayerIds(state.manifest);
const graticuleLayers = topoGraticuleLayerIds(state.manifest);
const referenceLayers = topoReferenceLayerIds(state.manifest);
const publicCandidates = candidates.map(redactCandidate);

const report = {
  project: path.relative(process.cwd(), projectPath) || ".",
  write: writeSummary,
  topoMap: {
    surfaceLayers,
    graticuleLayers,
    referenceLayers,
    metadataIssues,
  },
  candidates: publicCandidates,
  summary: {
    candidateCount: publicCandidates.length,
    writeEligibleCount: publicCandidates.filter(
      (candidate) => candidate.writeEligible,
    ).length,
    byKind: publicCandidates.reduce((counts, candidate) => {
      counts[candidate.kind] = (counts[candidate.kind] ?? 0) + 1;
      return counts;
    }, {}),
  },
};

console.log(JSON.stringify(report, null, 2));

if (writeSummary.blocked) {
  process.exit(2);
}
