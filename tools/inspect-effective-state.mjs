import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_PROJECT = "projects/utah-forge";
const DEFAULT_SCENE_PATHS = [
  "terrain.materialPreset",
  "terrain.surfaceElevationEnabled",
  "terrain.orthoPhotoTextureBudget",
  "terrain.orthoPhotoPath",
  "terrain.orthoPhotoOpacity",
  "terrain.edgeFadeShape",
  "terrain.edgeFadeDistanceM",
  "terrain.edgeFadeCornerRadiusM",
  "fog.enabled",
  "fog.density",
  "background",
  "exposure",
];
const DEFAULT_LAYERS = [
  "terrain",
  "utah-forge-site-boundary",
  "utah-forge-phase3-working-area",
];
const MAX_CONFLICT_LINES = 24;

function parseArgs(argv) {
  const result = {
    project: DEFAULT_PROJECT,
    page: null,
    scenePaths: [...DEFAULT_SCENE_PATHS],
    layers: [...DEFAULT_LAYERS],
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };

    if (arg === "--project") result.project = next();
    else if (arg === "--page") result.page = next();
    else if (arg === "--scene-path") result.scenePaths.push(cleanScenePath(next()));
    else if (arg === "--only-scene-path") result.scenePaths = [cleanScenePath(next())];
    else if (arg === "--layer") result.layers.push(next());
    else if (arg === "--only-layer") result.layers = [next()];
    else if (arg === "--no-layers") result.layers = [];
    else if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  result.project = result.project.replaceAll("\\", "/").replace(/\/+$/, "");
  result.scenePaths = [...new Set(result.scenePaths.map(cleanScenePath))];
  result.layers = [...new Set(result.layers)];
  return result;
}

function printHelp() {
  console.log(`inspect-effective-state

Usage:
  npm run inspect:effective -- [options]

Options:
  --project <dir>              Project directory. Default: ${DEFAULT_PROJECT}
  --page <id|environment>      Page id to inspect. Default: first pageOrder page
  --scene-path <path>          Add a scene path such as terrain.materialPreset
  --only-scene-path <path>     Inspect only this scene path
  --layer <id>                 Add a layer style id to inspect
  --only-layer <id>            Inspect only this layer style id
  --no-layers                  Skip layer style inspection
  --json                       Print machine-readable JSON
`);
}

function cleanScenePath(path) {
  return path.replace(/^scene\./, "").replace(/^\.+|\.+$/g, "");
}

function repoPath(...parts) {
  return resolve(process.cwd(), ...parts);
}

function readJson(path) {
  const absolute = repoPath(path);
  if (!existsSync(absolute)) throw new Error(`Missing file: ${path}`);
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function deepMerge(base = {}, patch = {}) {
  const next = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = deepMerge(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function hasPath(value, path) {
  let current = value;
  for (const part of path.split(".")) {
    if (!isPlainObject(current) && !Array.isArray(current)) return false;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

function getPath(value, path) {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value);
}

function valuesDiffer(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function flattenPaths(value, prefix = "", output = []) {
  if (!isPlainObject(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      flattenPaths(child, path, output);
    } else {
      output.push(path);
    }
  }
  return output;
}

function loadPage(projectDir, project, pageId) {
  if (pageId === "environment") return null;
  const resolvedPageId = pageId ?? project.pageOrder?.[0];
  if (!resolvedPageId) return null;
  return readJson(join(projectDir, "pages", `${resolvedPageId}.json`));
}

function projectRenderPresets(environment) {
  return [
    ...(environment.scene?.renderPresets ?? []),
    ...(environment.customRenderPresets ?? []),
  ];
}

function activeRenderPresetId(environment, page) {
  if (page?.renderPreset) return { id: page.renderPreset, source: "page.renderPreset" };
  if (page?.renderPresetId) return { id: page.renderPresetId, source: "page.renderPresetId" };
  if (environment.renderPreset) {
    return { id: environment.renderPreset, source: "environment.renderPreset" };
  }
  if (environment.scene?.activeRenderPresetId) {
    return {
      id: environment.scene.activeRenderPresetId,
      source: "environment.scene.activeRenderPresetId",
    };
  }
  return { id: null, source: "none" };
}

function findRenderPreset(environment, id) {
  if (!id) return null;
  return projectRenderPresets(environment).find((preset) => preset.id === id) ?? null;
}

function presetScenePatch(preset) {
  if (!preset) return null;
  if (preset.source === "user") return preset.scenePatch ?? {};
  if (preset.scenePatch) return preset.scenePatch;
  if (preset.scene) return preset.scene;
  return null;
}

function layerPatchForPreset(preset, layerId) {
  if (!preset) return null;
  return preset.layerStylePatchesByLayerId?.[layerId] ?? null;
}

function inspectScene(environment, presetPatch, scenePaths) {
  const baseScene = environment.scene ?? {};
  const effectiveScene = deepMerge(baseScene, presetPatch ?? {});
  return scenePaths.map((path) => {
    const baseHas = hasPath(baseScene, path);
    const presetHas = hasPath(presetPatch ?? {}, path);
    const source = presetHas
      ? "active render preset scenePatch"
      : baseHas
        ? "environment.scene"
        : "runtime fallback / unset";
    return {
      path: `scene.${path}`,
      source,
      effective: getPath(effectiveScene, path),
      environment: baseHas ? getPath(baseScene, path) : undefined,
      activeRenderPreset: presetHas ? getPath(presetPatch, path) : undefined,
    };
  });
}

function inspectLayer(environment, page, preset, layerId) {
  const environmentStyle = environment.layerStyles?.[layerId] ?? {};
  const presetPatch = layerPatchForPreset(preset, layerId) ?? {};
  const pageOverride = page?.layerOverrides?.[layerId] ?? {};
  const effectiveStyle = deepMerge(deepMerge(environmentStyle, presetPatch), pageOverride);
  const sources = [];
  if (Object.keys(environmentStyle).length > 0) sources.push("environment.layerStyles");
  if (Object.keys(presetPatch).length > 0) sources.push("active render preset layer patch");
  if (Object.keys(pageOverride).length > 0) sources.push("page.layerOverrides");

  return {
    layerId,
    sources,
    effectiveStyle,
    environmentStyle,
    activeRenderPresetPatch: presetPatch,
    pageOverride,
  };
}

function collectSceneConflicts(environment, presetPatch) {
  if (!presetPatch) return [];
  const baseScene = environment.scene ?? {};
  return flattenPaths(presetPatch)
    .filter((path) => hasPath(baseScene, path))
    .filter((path) => valuesDiffer(getPath(baseScene, path), getPath(presetPatch, path)))
    .map((path) => ({
      path: `scene.${path}`,
      environment: getPath(baseScene, path),
      activeRenderPreset: getPath(presetPatch, path),
      winner: "active render preset scenePatch",
    }));
}

function collectLayerConflicts(layerInspections) {
  const conflicts = [];
  for (const inspection of layerInspections) {
    const presetPaths = flattenPaths(inspection.activeRenderPresetPatch);
    for (const path of presetPaths) {
      if (
        hasPath(inspection.environmentStyle, path) &&
        valuesDiffer(
          getPath(inspection.environmentStyle, path),
          getPath(inspection.activeRenderPresetPatch, path),
        )
      ) {
        conflicts.push({
          layerId: inspection.layerId,
          path,
          environment: getPath(inspection.environmentStyle, path),
          activeRenderPreset: getPath(inspection.activeRenderPresetPatch, path),
          winner: "active render preset layer patch",
        });
      }
    }

    const overridePaths = flattenPaths(inspection.pageOverride);
    for (const path of overridePaths) {
      const prior = getPath(
        deepMerge(inspection.environmentStyle, inspection.activeRenderPresetPatch),
        path,
      );
      const override = getPath(inspection.pageOverride, path);
      if (valuesDiffer(prior, override)) {
        conflicts.push({
          layerId: inspection.layerId,
          path,
          prior,
          pageOverride: override,
          winner: "page.layerOverrides",
        });
      }
    }
  }
  return conflicts;
}

function buildReport(options) {
  const project = readJson(join(options.project, "project.json"));
  const environment = readJson(join(options.project, "environment.json"));
  const page = loadPage(options.project, project, options.page);
  const activePreset = activeRenderPresetId(environment, page);
  const preset = findRenderPreset(environment, activePreset.id);
  const scenePatch = presetScenePatch(preset);
  const sceneInspections = inspectScene(environment, scenePatch, options.scenePaths);
  const layerInspections = options.layers.map((layerId) =>
    inspectLayer(environment, page, preset, layerId),
  );
  const sceneConflicts = collectSceneConflicts(environment, scenePatch);
  const layerConflicts = collectLayerConflicts(layerInspections);
  const warnings = [];

  if (activePreset.id && !preset) {
    warnings.push(
      `Active render preset ${activePreset.id} is not project-local; built-in patch is not expanded by this CLI inspector.`,
    );
  } else if (preset && !scenePatch) {
    warnings.push(
      `Active render preset ${activePreset.id} has no explicit scene patch in project JSON.`,
    );
  }

  return {
    project: {
      dir: options.project,
      id: project.id,
      name: project.name,
    },
    page: page
      ? { id: page.id, title: page.title ?? null }
      : { id: "environment", title: "Global Settings / environment" },
    activeRenderPreset: {
      id: activePreset.id,
      selectorSource: activePreset.source,
      foundInProject: Boolean(preset),
      label: preset?.label ?? null,
      source: preset?.source ?? null,
    },
    scene: sceneInspections,
    layers: layerInspections,
    conflicts: {
      scene: sceneConflicts,
      layers: layerConflicts,
    },
    warnings,
  };
}

function printReport(report) {
  console.log("Effective state inspector");
  console.log(`  project: ${report.project.dir} (${report.project.name ?? report.project.id})`);
  console.log(`  page: ${report.page.id}${report.page.title ? ` — ${report.page.title}` : ""}`);
  console.log(
    `  active render preset: ${report.activeRenderPreset.id ?? "none"} (${report.activeRenderPreset.selectorSource})`,
  );
  if (report.activeRenderPreset.label) {
    console.log(`  preset label: ${report.activeRenderPreset.label}`);
  }

  if (report.warnings.length > 0) {
    console.log("\nWarnings");
    for (const warning of report.warnings) console.log(`  ${warning}`);
  }

  console.log("\nScene values");
  for (const row of report.scene) {
    console.log(`  ${row.path}`);
    console.log(`    source: ${row.source}`);
    console.log(`    effective: ${formatValue(row.effective)}`);
    console.log(`    environment: ${formatValue(row.environment)}`);
    console.log(`    active preset: ${formatValue(row.activeRenderPreset)}`);
  }

  if (report.layers.length > 0) {
    console.log("\nLayer styles");
    for (const layer of report.layers) {
      console.log(`  ${layer.layerId}`);
      console.log(`    sources: ${layer.sources.length ? layer.sources.join(", ") : "none"}`);
      for (const key of [
        "color",
        "opacity",
        "lineWidth",
        "affectedByFog",
        "showLabels",
        "labelKind",
        "labelFadeNearM",
        "labelFadeFarM",
      ]) {
        if (hasPath(layer.effectiveStyle, key)) {
          console.log(`    ${key}: ${formatValue(getPath(layer.effectiveStyle, key))}`);
        }
      }
    }
  }

  const sceneConflicts = report.conflicts.scene.slice(0, MAX_CONFLICT_LINES);
  const layerConflicts = report.conflicts.layers.slice(0, MAX_CONFLICT_LINES);
  console.log("\nAuthority conflicts");
  if (sceneConflicts.length === 0 && layerConflicts.length === 0) {
    console.log("  none in inspected project-local contributors");
    return;
  }

  for (const conflict of sceneConflicts) {
    console.log(`  ${conflict.path}`);
    console.log(`    environment: ${formatValue(conflict.environment)}`);
    console.log(`    active preset: ${formatValue(conflict.activeRenderPreset)}`);
    console.log(`    winner: ${conflict.winner}`);
  }
  for (const conflict of layerConflicts) {
    console.log(`  layer.${conflict.layerId}.${conflict.path}`);
    if ("environment" in conflict) {
      console.log(`    environment: ${formatValue(conflict.environment)}`);
      console.log(`    active preset: ${formatValue(conflict.activeRenderPreset)}`);
    } else {
      console.log(`    prior: ${formatValue(conflict.prior)}`);
      console.log(`    page override: ${formatValue(conflict.pageOverride)}`);
    }
    console.log(`    winner: ${conflict.winner}`);
  }

  const hidden =
    report.conflicts.scene.length +
    report.conflicts.layers.length -
    sceneConflicts.length -
    layerConflicts.length;
  if (hidden > 0) console.log(`  ... ${hidden} additional conflict(s) omitted`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = buildReport(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
