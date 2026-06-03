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
const POST_STACK = [
  "RenderPass",
  "SSAOPass",
  "BokehPass",
  "UnrealBloomPass",
  "TiltShiftPass",
  "AfterimagePass",
  "LensGradePass",
  "SMAAPass",
  "OutputPass",
];
const CINEMATIC_TRANSITION_POLICIES = [
  { key: "colorGrade", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "vignette", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "depthOfField", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "tiltShift", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "lensEffects", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "motionTrails", transitionKind: "continuous", owner: "cinematic-post" },
  {
    key: "presentationFrame",
    transitionKind: "continuous",
    owner: "cinematic-post",
  },
  { key: "compositionGuides", transitionKind: "continuous", owner: "cinematic-post" },
  { key: "camera.lensPreset", transitionKind: "discrete", owner: "camera-runtime" },
  { key: "dynamicCamera.dolly", transitionKind: "timed-shot", owner: "camera-runtime" },
  { key: "dynamicCamera.truck", transitionKind: "timed-shot", owner: "camera-runtime" },
  { key: "dynamicCamera.crane", transitionKind: "timed-shot", owner: "camera-runtime" },
  { key: "dynamicCamera.handheld", transitionKind: "timed-shot", owner: "camera-runtime" },
];
const TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS = [
  "materialPreset",
  "topoImageMaterialSources",
  "orthoPhotoTextureBudget",
  "orthoPhotoPath",
  "orthoPhotoTexture4096Path",
  "orthoPhotoTexture8192Path",
  "orthoPhotoBounds",
  "orthoPhotoOpacity",
  "orthoPhotoHillshadeBlend",
  "orthoPhotoBrightness",
  "orthoPhotoContrast",
  "orthoPhotoSaturation",
  "orthoPhotoOutsideFillEnabled",
  "orthoPhotoOutsideColor",
  "orthoPhotoOutsideOpacity",
  "orthoPhotoShadowStrength",
  "orthoPhotoShadowFloor",
  "orthoPhotoShadowTint",
  "projectedMapShadowsEnabled",
  "projectedMapShadowOpacity",
  "projectedMapShadowSoftness",
  "projectedMapShadowBias",
  "surfaceElevationEnabled",
  "surfaceElevationLegendVisible",
  "surfaceElevationMinM",
  "surfaceElevationMaxM",
  "surfaceElevationColors",
  "surfaceElevationColorPositions",
  "surfaceElevationMidpoints",
  "surfaceElevationTransitionSoftness",
  "surfaceElevationColorBlend",
  "surfaceElevationReverse",
  "verticalExaggeration",
  "edgeFadeDistanceM",
  "edgeFadeShape",
  "edgeFadeInsetM",
  "edgeFadeCornerRadiusM",
  "edgeOutlineEnabled",
  "edgeOutlineOffsetM",
  "edgeOutlineThicknessM",
  "edgeOutlineColor",
  "edgeOutlineOpacity",
  "edgeTopShine",
  "edgeCornerShine",
  "edgeBottomShine",
  "topoMapBranding",
];

function parseArgs(argv) {
  const result = {
    project: DEFAULT_PROJECT,
    page: null,
    scenePaths: [...DEFAULT_SCENE_PATHS],
    layers: [...DEFAULT_LAYERS],
    json: false,
    renderStack: false,
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
    else if (arg === "--render-stack") result.renderStack = true;
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
  --render-stack               Include runtime render-stack/topo authority trace
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
  if (preset.source === "user") {
    return stripTopoMaterialAuthorityFromScenePatch(preset.scenePatch ?? {});
  }
  if (preset.scenePatch) return preset.scenePatch;
  if (preset.scene) return preset.scene;
  return null;
}

function topoMaterialAuthorityPatch(terrain) {
  if (!isPlainObject(terrain)) return undefined;
  const patch = {};
  for (const field of TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS) {
    if (terrain[field] !== undefined) patch[field] = terrain[field];
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

function applyTopoMaterialAuthority(terrain, authority) {
  const patch = topoMaterialAuthorityPatch(authority);
  if (!terrain && !patch) return undefined;
  return {
    ...(terrain ?? {}),
    ...(patch ?? {}),
  };
}

function stripTopoMaterialAuthorityFromTerrain(terrain) {
  if (!isPlainObject(terrain)) return undefined;
  const next = { ...terrain };
  for (const field of TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS) {
    delete next[field];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function stripTopoMaterialAuthorityFromScenePatch(patch) {
  if (!isPlainObject(patch?.terrain)) return patch;
  const terrain = stripTopoMaterialAuthorityFromTerrain(patch.terrain);
  const next = { ...patch };
  if (terrain) next.terrain = terrain;
  else delete next.terrain;
  return next;
}

function loadPages(projectDir, project) {
  return (project.pageOrder ?? []).map((pageId) =>
    readJson(join(projectDir, "pages", `${pageId}.json`)),
  );
}

function resolveEnvironmentForPage(environment, pages, page) {
  if (!page) return environment;
  if (
    page.envSnapshot &&
    (!page.parentMasterId || page.parentMasterId === "global")
  ) {
    return page.envSnapshot;
  }
  if (page.parentMasterId && page.parentMasterId !== "global") {
    const parent = pages.find((candidate) => candidate.id === page.parentMasterId);
    if (parent?.envSnapshot) return parent.envSnapshot;
  }
  return environment;
}

function runtimeEffectiveScene(baseEnvironment, presetPatch, page) {
  const baseScene = baseEnvironment.scene ?? {};
  const withPreset = deepMerge(baseScene, presetPatch ?? {});
  const withPage = deepMerge(withPreset, page?.sceneOverrides ?? {});
  const terrain = applyTopoMaterialAuthority(withPage.terrain, baseScene.terrain);
  if (terrain) return { ...withPage, terrain };
  return withPage;
}

function textureUrlForTerrain(terrain) {
  const preset = terrain?.materialPreset;
  if (typeof preset === "string" && preset.startsWith("image:")) {
    const sourceId = preset.slice("image:".length);
    const source = (terrain.topoImageMaterialSources ?? []).find(
      (candidate) => candidate.id === sourceId,
    );
    if (source) {
      return (
        source.texture8192Path ??
        source.texture4096Path ??
        source.texturePath ??
        terrain.orthoPhotoTexture8192Path ??
        terrain.orthoPhotoTexture4096Path ??
        terrain.orthoPhotoPath ??
        null
      );
    }
  }
  return (
    terrain?.orthoPhotoTexture8192Path ??
    terrain?.orthoPhotoTexture4096Path ??
    terrain?.orthoPhotoPath ??
    null
  );
}

function cacheKeyForUrl(url) {
  if (typeof url !== "string") return null;
  const query = url.split("?")[1];
  return query || null;
}

function publicClipState(layerStyle) {
  return {
    enabled: layerStyle?.publicSurfaceClipEnabled === true,
    center: [
      layerStyle?.publicSurfaceClipCenterX,
      layerStyle?.publicSurfaceClipCenterY,
      layerStyle?.publicSurfaceClipCenterZ,
    ],
    size: [
      layerStyle?.publicSurfaceClipSizeX,
      layerStyle?.publicSurfaceClipSizeY,
      layerStyle?.publicSurfaceClipSizeZ,
    ],
    rotationZDeg: layerStyle?.publicSurfaceClipRotationZDeg,
    shape: layerStyle?.publicSurfaceClipShape,
  };
}

function materialShaderForTerrain(terrain) {
  const preset = terrain?.materialPreset ?? "runtime fallback";
  if (typeof preset === "string" && preset.startsWith("image:")) {
    return "terrainMaterial/topo-image";
  }
  if (preset === "ortho-photo") return "terrainMaterial/ortho-photo";
  return "terrainMaterial/procedural";
}

function buildRenderStackReport({
  project,
  page,
  activePreset,
  preset,
  scenePatch,
  resolvedEnvironment,
  effectiveScene,
}) {
  const terrain = effectiveScene.terrain ?? {};
  const textureUrl = textureUrlForTerrain(terrain);
  const terrainLayerStyle =
    resolvedEnvironment.layerStyles?.terrain ??
    resolvedEnvironment.layerStyles?.["topo-map"] ??
    {};
  return {
    activeRenderPreset: {
      id: activePreset.id,
      selectorSource: activePreset.source,
      foundInProject: Boolean(preset),
      label: preset?.label ?? null,
      source: preset?.source ?? null,
    },
    envSnapshot: page?.envSnapshot
      ? { present: true, id: page.envSnapshot.id ?? "environment" }
      : { present: false },
    scenePatch: scenePatch ?? {},
    sceneOverrides: page?.sceneOverrides ?? {},
    layerStyles: {
      terrain: terrainLayerStyle,
    },
    topoAuthority: {
      winner: "environment.scene.terrain topo material authority",
      effectiveTerrain: terrain,
      textureUrl,
      cacheKey: cacheKeyForUrl(textureUrl),
      bounds: terrain.orthoPhotoBounds ?? null,
      publicClip: publicClipState(terrainLayerStyle),
      edgeFade: {
        shape: terrain.edgeFadeShape ?? null,
        distanceM: terrain.edgeFadeDistanceM ?? null,
        insetM: terrain.edgeFadeInsetM ?? null,
        cornerRadiusM: terrain.edgeFadeCornerRadiusM ?? null,
      },
      edgeOutline: {
        enabled: terrain.edgeOutlineEnabled === true,
        offsetM: terrain.edgeOutlineOffsetM ?? null,
        thicknessM: terrain.edgeOutlineThicknessM ?? null,
        color: terrain.edgeOutlineColor ?? null,
        opacity: terrain.edgeOutlineOpacity ?? null,
      },
      material: {
        preset: terrain.materialPreset ?? null,
        shader: materialShaderForTerrain(terrain),
      },
      geometry: {
        source: "runtime terrain mesh",
        projectBounds: project.bounds ?? null,
        lod: terrain.orthoPhotoTextureBudget ?? "runtime",
      },
    },
    postProcessing: {
      stack: POST_STACK,
    },
    cinematicTransitions: {
      transitionChannel: "main-camera/cinematic-post",
      policies: CINEMATIC_TRANSITION_POLICIES,
    },
  };
}

function layerPatchForPreset(preset, layerId) {
  if (!preset) return null;
  return preset.layerStylePatchesByLayerId?.[layerId] ?? null;
}

function inspectScene(environment, presetPatch, pageOverride, effectiveScene, scenePaths) {
  const baseScene = environment.scene ?? {};
  return scenePaths.map((path) => {
    const baseHas = hasPath(baseScene, path);
    const presetHas = hasPath(presetPatch ?? {}, path);
    const pageHas = hasPath(pageOverride ?? {}, path);
    const authorityHas =
      path.startsWith("terrain.") &&
      TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS.includes(path.slice("terrain.".length));
    const source = authorityHas && baseHas
      ? "topo material authority (environment.scene.terrain)"
      : pageHas
        ? "page.sceneOverrides"
        : presetHas
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
      pageOverride: pageHas ? getPath(pageOverride, path) : undefined,
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

function collectSceneConflicts(environment, presetPatch, pageOverride) {
  const baseScene = environment.scene ?? {};
  const conflicts = flattenPaths(presetPatch ?? {})
    .filter((path) => hasPath(baseScene, path))
    .filter((path) => valuesDiffer(getPath(baseScene, path), getPath(presetPatch, path)))
    .map((path) => ({
      path: `scene.${path}`,
      environment: getPath(baseScene, path),
      activeRenderPreset: getPath(presetPatch, path),
      winner:
        path.startsWith("terrain.") &&
        TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS.includes(path.slice("terrain.".length))
          ? "topo material authority"
          : "active render preset scenePatch",
    }));
  for (const path of flattenPaths(pageOverride ?? {})) {
    const prior = getPath(deepMerge(baseScene, presetPatch ?? {}), path);
    const override = getPath(pageOverride, path);
    if (valuesDiffer(prior, override)) {
      conflicts.push({
        path: `scene.${path}`,
        prior,
        pageOverride: override,
        winner: "page.sceneOverrides",
      });
    }
  }
  return conflicts;
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
  const pages = loadPages(options.project, project);
  const resolvedEnvironment = resolveEnvironmentForPage(environment, pages, page);
  const activePreset = activeRenderPresetId(resolvedEnvironment, page);
  const preset = findRenderPreset(resolvedEnvironment, activePreset.id);
  const scenePatch = presetScenePatch(preset);
  const effectiveScene = runtimeEffectiveScene(resolvedEnvironment, scenePatch, page);
  const sceneInspections = inspectScene(
    resolvedEnvironment,
    scenePatch,
    page?.sceneOverrides ?? null,
    effectiveScene,
    options.scenePaths,
  );
  const layerInspections = options.layers.map((layerId) =>
    inspectLayer(resolvedEnvironment, page, preset, layerId),
  );
  const sceneConflicts = collectSceneConflicts(
    resolvedEnvironment,
    scenePatch,
    page?.sceneOverrides ?? null,
  );
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

  const report = {
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
  if (options.renderStack) {
    report.renderStack = buildRenderStackReport({
      project,
      page,
      activePreset,
      preset,
      scenePatch,
      resolvedEnvironment,
      effectiveScene,
    });
  }
  return report;
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

  if (report.renderStack) {
    const topo = report.renderStack.topoAuthority;
    console.log("\nRender stack");
    console.log(`  post-processing: ${report.renderStack.postProcessing.stack.join(" -> ")}`);
    console.log(
      `  cinematic transitions: ${report.renderStack.cinematicTransitions.policies.length} policies (${report.renderStack.cinematicTransitions.transitionChannel})`,
    );
    console.log(`  topo winner: ${topo.winner}`);
    console.log(`  material preset: ${formatValue(topo.material.preset)}`);
    console.log(`  shader/material: ${formatValue(topo.material.shader)}`);
    console.log(`  texture URL: ${formatValue(topo.textureUrl)}`);
    console.log(`  cache key: ${formatValue(topo.cacheKey)}`);
    console.log(`  bounds: ${formatValue(topo.bounds)}`);
    console.log(`  public clip: ${formatValue(topo.publicClip)}`);
    console.log(`  edge fade: ${formatValue(topo.edgeFade)}`);
    console.log(`  edge outline: ${formatValue(topo.edgeOutline)}`);
    console.log(`  geometry/LOD: ${formatValue(topo.geometry)}`);
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
    if ("pageOverride" in conflict) {
      console.log(`    prior: ${formatValue(conflict.prior)}`);
      console.log(`    page override: ${formatValue(conflict.pageOverride)}`);
    } else {
      console.log(`    environment: ${formatValue(conflict.environment)}`);
      console.log(`    active preset: ${formatValue(conflict.activeRenderPreset)}`);
    }
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
