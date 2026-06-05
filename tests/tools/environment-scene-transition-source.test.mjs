import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

async function loadEnvironmentTransitionModule() {
  const sourcePath = join(
    repoRoot,
    "src",
    "scene",
    "transitions",
    "environmentSceneTransition.ts",
  );
  assert.ok(
    existsSync(sourcePath),
    "environment-scene transition helper should exist.",
  );
  const threeModuleUrl = pathToFileURL(require.resolve("three")).href;
  const source = readFileSync(sourcePath, "utf8")
    .replace(
      /import\s+\*\s+as\s+THREE\s+from\s+"three";/,
      `import * as THREE from "${threeModuleUrl}";`,
    )
    .replace(
      /import\s+\{\s*easeProgress\s*\}\s+from\s+"\.\/transitionStyles";/,
      "const easeProgress = (raw) => raw;",
    );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const filePath = join(
    tmpdir(),
    `geosee-environment-scene-transition-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`,
  );
  writeFileSync(filePath, output);
  return import(pathToFileURL(filePath).href);
}

const transitionModule = await loadEnvironmentTransitionModule();

test("environment scene transition blends dark background to light background", () => {
  const transition = transitionModule.createEnvironmentSceneTransition({
    sourcePageId: "source-page",
    targetPageId: "target-page",
    sourceScene: {
      lightMode: false,
      background: "#000000",
      lightModeBackground: "#eeeeee",
      fog: { enabled: true, color: "#101010", density: 0.0001 },
    },
    targetScene: {
      lightMode: true,
      background: "#111111",
      lightModeBackground: "#ffffff",
      fog: { enabled: true, lightModeColor: "#f0f0f0", density: 0.0003 },
    },
    durationMs: 1000,
    easing: "linear",
    startMs: 0,
  });

  const frame = transitionModule.blendEnvironmentSceneTransitionFrame(
    transition,
    500,
  );

  assert.equal(frame.backgroundHex, "#bcbcbc");
  assert.equal(frame.fogHex, "#b1b1b1");
  assert.ok(Math.abs(frame.fogDensity - 0.0002) < 1e-12);
  assert.equal(frame.done, false);
});

test("environment scene transition fades disabled fog from density zero", () => {
  const transition = transitionModule.createEnvironmentSceneTransition({
    sourcePageId: "source-page",
    targetPageId: "target-page",
    sourceScene: {
      lightMode: false,
      background: "#000000",
      fog: { enabled: false, color: "#000000", density: 0.0005 },
    },
    targetScene: {
      lightMode: false,
      background: "#000000",
      fog: { enabled: true, color: "#ffffff", density: 0.0004 },
    },
    durationMs: 1000,
    easing: "linear",
    startMs: 0,
  });

  const frame = transitionModule.blendEnvironmentSceneTransitionFrame(
    transition,
    500,
  );

  assert.equal(frame.fogEnabled, true);
  assert.equal(frame.fogDensity, 0.0002);
});

test("page navigation starts background and fog smoothing with page timing", () => {
  const pageController = readSource("src", "pages", "PageController.tsx");

  assert.match(
    pageController,
    /beginEnvironmentSceneTransition\(\s*sourceResolved\.environment,\s*targetResolved\.environment,\s*sourceResolved\.page,\s*targetResolved\.page,\s*transitionDuration,\s*target\.transition\.easing,\s*transitionStartMs/s,
    "PageController should start environment-scene blending with the page transition timing.",
  );
});

test("SceneManager applies environment-scene frames before cinematic post frames", () => {
  const sceneManager = readSource("src", "scene", "SceneManager.ts");
  const frameUpdateIndex = sceneManager.indexOf("frameUpdate(");
  assert.notEqual(frameUpdateIndex, -1, "SceneManager.frameUpdate should exist.");
  const frameUpdate = sceneManager.slice(frameUpdateIndex);
  const environmentFrameIndex = frameUpdate.indexOf(
    "updateEnvironmentSceneTransitionFrame(nowMs)",
  );
  const cinematicFrameIndex = frameUpdate.indexOf("updateCinematicPostFrame(nowMs)");

  assert.ok(
    environmentFrameIndex >= 0,
    "SceneManager should tick environment scene transition frames.",
  );
  assert.ok(
    cinematicFrameIndex > environmentFrameIndex,
    "Environment scene frames should update before cinematic post frames.",
  );
  assert.match(
    sceneManager,
    /private\s+applyEnvironmentSceneTransitionFrame\([^)]*frame:\s*EnvironmentSceneTransitionFrame/,
    "SceneManager should use a narrow background/fog frame applier.",
  );
  assert.doesNotMatch(
    sceneManager,
    /applyEnvironmentSceneTransitionFrame[\s\S]{0,1200}applyEnvironment\(/,
    "Transition frame application should not call full applyEnvironment.",
  );
});

test("topo runtime exposes a narrow fog-frame path", () => {
  const topoRuntime = readSource("src", "topoMap", "runtime.ts");
  const surfaceRuntime = readSource("src", "topoMap", "surfaceRuntime.ts");

  assert.match(
    topoRuntime,
    /applyFogFrame\(\s*\{[\s\S]*fogColor[\s\S]*fogDensity/s,
    "TopoMapRuntime should expose a narrow fog-frame updater.",
  );
  assert.match(
    surfaceRuntime,
    /applyFogFrame\([^)]*TopoSurfaceFogFrameParams[^)]*\)/,
    "TopoSurfaceRuntime should expose a narrow fog-frame updater.",
  );
  assert.doesNotMatch(
    surfaceRuntime,
    /applyFogFrame[\s\S]{0,1000}LIGHT_MODE_TERRAIN_RAMP_LOW/,
    "Fog-frame updates should not apply the light-mode terrain ramp.",
  );
});

test("transition docs classify background and fog as environment-scene channels", () => {
  const decisionLog = readSource(
    "docs",
    "dev-context",
    "Transition-Decision-Log.md",
  );
  const continuity = readSource(
    "docs",
    "dev-context",
    "Transition-Continuity-Contract.md",
  );
  const sectionFrames = readSource(
    "docs",
    "dev-context",
    "Page-Transitions-And-Section-Frames.md",
  );

  assert.match(
    decisionLog,
    /TRD-009\s+-\s+Background\/Fog Scene Channels Blend During Page Transitions/,
    "Transition decision log should record TRD-009.",
  );
  assert.match(
    continuity,
    /environment-scene transition channels[\s\S]{0,500}background[\s\S]{0,500}fog/i,
    "Continuity contract should define background/fog environment-scene channels.",
  );
  assert.match(
    sectionFrames,
    /background\/fog[\s\S]{0,240}not[\s\S]{0,120}LayerTransitionKind/i,
    "Page transition docs should keep background/fog outside LayerTransitionKind.",
  );
});
