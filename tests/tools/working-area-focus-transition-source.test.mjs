import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sceneManager = readFileSync("src/scene/SceneManager.ts", "utf8");
const workingAreaFocusController = readFileSync(
  "src/scene/workingArea/workingAreaFocusController.ts",
  "utf8",
);
const sceneSectionObjectVisibilityShader = readFileSync(
  "src/scene/shaders/sceneSectionObjectVisibilityShader.ts",
  "utf8",
);

test("transition snapshot material clones rehydrate working-area focus shader hooks", () => {
  assert.match(
    workingAreaFocusController,
    /applyWorkingAreaFocusBuiltInMaterial/,
    "Working-area focus should patch built-in materials through a shader hook.",
  );
  assert.match(
    sceneManager,
    /rehydrateWorkingAreaFocusTransitionMaterial/,
    "SceneManager should rehydrate cloned transition-snapshot materials that carried working-area focus.",
  );
  const cloneBody = sceneManager.match(
    /private cloneTransitionMaterial\(material: THREE\.Material\): THREE\.Material \{[\s\S]*?\n  \}/,
  );
  assert.ok(cloneBody, "cloneTransitionMaterial should have an inspectable body.");
  assert.match(
    cloneBody[0],
    /this\.rehydrateWorkingAreaFocusTransitionMaterial\(\s*clone,\s*originalUserData,?\s*\)/,
    "Transition snapshot material clones should be rehydrated before use.",
  );
  const rehydrateBody = sceneManager.match(
    /private rehydrateWorkingAreaFocusTransitionMaterial[\s\S]*?\n  \}/,
  );
  assert.ok(
    rehydrateBody,
    "Working-area focus material rehydration should have an inspectable body.",
  );
  assert.match(
    rehydrateBody[0],
    /delete clone\.userData\.workingAreaFocusPatched/,
    "A cloned material must clear stale patch metadata before reapplying the shader hook.",
  );
  assert.match(
    rehydrateBody[0],
    /this\.applyWorkingAreaFocusMaterial\(\s*clone,\s*enabled,\s*state,\s*outsideOpacity,\s*\)/,
    "Snapshot rehydration should use the same app-level working-area material owner as live layers.",
  );
});

test("transition snapshot material clones rehydrate scene-section object-visibility shader hooks", () => {
  assert.match(
    sceneSectionObjectVisibilityShader,
    /applySceneSectionObjectVisibilityBuiltInMaterial/,
    "Scene-section object visibility should patch built-in materials through a shader hook.",
  );
  assert.match(
    sceneManager,
    /applySceneSectionObjectVisibilityBuiltInMaterial/,
    "SceneManager should be able to rehydrate cloned transition-snapshot materials that carried scene-section object visibility.",
  );
  const cloneBody = sceneManager.match(
    /private cloneTransitionMaterial\(material: THREE\.Material\): THREE\.Material \{[\s\S]*?\n  \}/,
  );
  assert.ok(cloneBody, "cloneTransitionMaterial should have an inspectable body.");
  assert.match(
    cloneBody[0],
    /const originalClippingPlanes\s*=/,
    "Transition snapshot material clones should capture source clipping planes before cloning.",
  );
  assert.match(
    cloneBody[0],
    /this\.rehydrateSceneSectionTransitionMaterial\(\s*clone,\s*originalUserData,\s*originalClippingPlanes,\s*originalClipIntersection,?\s*\)/,
    "Transition snapshot material clones should rehydrate source scene-section masks before use.",
  );
  const rehydrateBody = sceneManager.match(
    /private rehydrateSceneSectionTransitionMaterial[\s\S]*?\n  \}/,
  );
  assert.ok(
    rehydrateBody,
    "Scene-section material rehydration should have an inspectable body.",
  );
  assert.match(
    rehydrateBody[0],
    /delete clone\.userData\.sceneSectionObjectVisibilityPatched/,
    "A cloned material must clear stale scene-section patch metadata before reapplying the shader hook.",
  );
  assert.match(
    rehydrateBody[0],
    /delete clone\.userData\.sceneSectionObjectVisibilityShader/,
    "A cloned material must clear stale scene-section shader references before reapplying the shader hook.",
  );
  assert.match(
    rehydrateBody[0],
    /applySceneSectionObjectVisibilityBuiltInMaterial\(\s*clone,/,
    "Snapshot rehydration should use the same app-level scene-section material owner as live layers.",
  );
  assert.match(
    rehydrateBody[0],
    /clone\.clippingPlanes\s*=\s*originalClippingPlanes/,
    "Snapshot rehydration should preserve source clipping planes on source visual snapshots.",
  );
});
