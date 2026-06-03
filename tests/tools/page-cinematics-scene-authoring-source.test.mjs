import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

function functionBody(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nexport function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const pagePanel = readSource("src", "editor", "PagePanel.tsx");
const environmentPanel = readSource(
  "src",
  "editor",
  "EnvironmentScenePanel.tsx",
);
const editorContext = readSource("src", "editor", "EditorContext.tsx");
const applyEnvironment = readSource(
  "src",
  "scene",
  "environment",
  "applyEnvironment.ts",
);
const typesSource = readSource("src", "pages", "types.ts");

test("Cinematics keeps the selected authoring target instead of forcing Global Settings", () => {
  const visualStudioPanel = functionBody(pagePanel, "VisualStudioPanel");

  assert.doesNotMatch(
    visualStudioPanel,
    /selectPage\(ENVIRONMENT_SENTINEL\)|onPointerDownCapture=\{activateGlobalSettings\}/,
    "Cinematics should not force Global Settings when a presentation page is selected.",
  );
  assert.match(
    visualStudioPanel,
    /scene=\{[^}]*cinematicsScene[^}]*\}/,
    "Cinematics should pass a scoped scene into scene panels.",
  );
  assert.match(
    visualStudioPanel,
    /setScene=\{[^}]*setCinematicsScene[^}]*\}/,
    "Cinematics should pass a scoped scene writer into scene panels.",
  );
  assert.match(
    visualStudioPanel,
    /sceneOverrides:\s*mergeSceneProperties\([^)]*sceneOverrides[^)]*patch/s,
    "Selected-page Cinematics writes should persist into page.sceneOverrides.",
  );
});

test("Environment and Camera panels are scoped by props, not global editor state", () => {
  const environmentScenePanel = functionBody(
    environmentPanel,
    "EnvironmentScenePanel",
  );
  const cameraSetupPanel = functionBody(environmentPanel, "CameraSetupPanel");

  for (const [name, source] of [
    ["EnvironmentScenePanel", environmentScenePanel],
    ["CameraSetupPanel", cameraSetupPanel],
  ]) {
    assert.match(source, /\bscene\b[^=]*,\s*\bsetScene\b/s, `${name} should accept scene and setScene props.`);
    assert.doesNotMatch(
      source,
      /const\s+\{\s*state,\s*setEnvScene\s*\}\s*=\s*useEditor\(\)/,
      `${name} should not bind directly to global environment scene state.`,
    );
    assert.doesNotMatch(
      source,
      /state\.environment\.scene/,
      `${name} should render from the scoped scene prop.`,
    );
  }
});

test("SceneProperties exposes separate light-mode background and fog color", () => {
  assert.match(
    typesSource,
    /lightModeBackground\?:\s*string/,
    "SceneProperties should expose a dedicated light-mode background color.",
  );
  assert.match(
    typesSource,
    /fog\?:\s*\{[^}]*lightModeColor\?:\s*string/s,
    "SceneProperties.fog should expose a dedicated light-mode fog color.",
  );
});

test("Environment UI exposes dark and light background and fog color controls", () => {
  const environmentScenePanel = functionBody(
    environmentPanel,
    "EnvironmentScenePanel",
  );

  for (const label of [
    "Light mode",
    "Dark background",
    "Dark fog",
    "Light background",
    "Light fog",
  ]) {
    assert.match(
      environmentScenePanel,
      new RegExp(`label=["']${label}["']`),
      `Environment panel should expose ${label}.`,
    );
  }
});

test("Runtime decouples background and fog for dark and light scene modes", () => {
  assert.match(
    applyEnvironment,
    /sp\.lightModeBackground\s*\?\?\s*LIGHT_MODE_BG/,
    "Light mode should use scene.lightModeBackground before the fallback constant.",
  );
  assert.match(
    applyEnvironment,
    /sp\.fog\?\.lightModeColor\s*\?\?\s*lightBgHex/,
    "Light mode fog should use fog.lightModeColor before light background fallback.",
  );
  assert.doesNotMatch(
    applyEnvironment,
    /\?\s*bgColor\s*\/\/ fog matches lightMode background/,
    "Light mode fog should not be hard-wired to the background color.",
  );
});

test("Render preset scene patches do not override page-local scene overrides", () => {
  assert.match(
    applyEnvironment,
    /mergeSceneProperties\(\s*environment\.scene,\s*presetPatch\s*\)/s,
    "Preset patches should be applied over the base scene before page overrides.",
  );
  assert.match(
    applyEnvironment,
    /mergeSceneProperties\(\s*sceneWithPreset,\s*this\.lastEffectivePage\?\.sceneOverrides\s*\?\?\s*null/s,
    "Page scene overrides should be re-applied after preset patches.",
  );
});

test("Lighting source drag commits target page sceneOverrides when a page is selected", () => {
  const commitStart = editorContext.indexOf("setLightingSourceCommitHandler");
  assert.notEqual(commitStart, -1, "lighting source commit handler should exist");
  const commitSource = editorContext.slice(
    commitStart,
    editorContext.indexOf("setAreaOutlineCommitHandler", commitStart),
  );

  assert.match(
    commitSource,
    /selectedPageId.*ENVIRONMENT_SENTINEL/s,
    "Lighting source commit should inspect whether a presentation page is selected.",
  );
  assert.match(
    commitSource,
    /sceneOverrides:\s*mergeSceneEdit\([^)]*sceneOverrides[^)]*\{\s*lighting/s,
    "Selected-page lighting source commits should persist to page.sceneOverrides.lighting.",
  );
  assert.match(
    commitSource,
    /type:\s*"SET_PAGE_FIELD"/,
    "Selected-page lighting commits should dispatch page updates.",
  );
  assert.match(
    commitSource,
    /type:\s*"SET_ENV_SCENE"/,
    "Global lighting commits should keep dispatching environment updates.",
  );
});
