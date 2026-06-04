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
const pageController = readSource("src", "pages", "PageController.tsx");
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
const sceneManager = readSource("src", "scene", "SceneManager.ts");
const sceneMount = readSource("src", "scene.ts");
const postprocessing = readSource("src", "scene", "postprocessing.ts");
const renderPresets = readSource("src", "pages", "renderPresets.ts");
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

test("New pages capture the currently shown day or night atmosphere", () => {
  assert.match(
    editorContext,
    /function\s+pageAtmosphereSceneOverrides\([^)]*scene:\s*SceneProperties[^)]*\):\s*Partial<SceneProperties>/,
    "EditorContext should have a focused helper for page-local atmosphere snapshots.",
  );
  assert.match(
    editorContext,
    /lightMode:\s*scene\.lightMode\s*===\s*true/,
    "New page atmosphere snapshots should store false as an explicit night value.",
  );
  assert.match(
    editorContext,
    /function\s+currentAuthoringScene\([^)]*state:\s*EditorState[^)]*\):\s*SceneProperties/,
    "New pages should capture the resolved scene currently being authored.",
  );
  assert.match(
    editorContext,
    /sceneOverrides:\s*pageAtmosphereSceneOverrides\([\s\S]*currentAuthoringScene\(cur\)[\s\S]*\)/,
    "New page creation should persist the shown day/night atmosphere into page.sceneOverrides.",
  );
});

test("Environment and Camera panels are scoped by props, not global editor state", () => {
  const environmentScenePanel = functionBody(
    environmentPanel,
    "EnvironmentScenePanel",
  );
  const cameraSetupPanel = functionBody(environmentPanel, "CameraSetupPanel");
  const postProcessingPanel = functionBody(
    environmentPanel,
    "PostProcessingPanel",
  );

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

  assert.match(
    postProcessingPanel,
    /<CameraSetupPanel\s+\{\.\.\.props\}\s+content=["']post["']/s,
    "PostProcessingPanel should reuse the scoped camera panel shell in post-processing mode.",
  );
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

test("SceneProperties exposes expanded cinematic camera and post fields", () => {
  for (const expected of [
    /export type LensPreset\s*=/,
    /lensPreset\?:\s*LensPreset/,
    /depthOfField\?:\s*\{/,
    /focusMode\?:\s*DepthOfFieldFocusMode/,
    /"camera-object"/,
    /tiltShift\?:\s*\{/,
    /lensEffects\?:\s*\{/,
    /halation\?:\s*number/,
    /anamorphicStreak\?:\s*number/,
    /anamorphicStreakLength\?:\s*number/,
    /anamorphicStreakThreshold\?:\s*number/,
    /motionTrails\?:\s*\{/,
    /presentationFrame\?:\s*\{/,
    /letterbox\?:\s*boolean/,
    /gateWeave\?:\s*number/,
    /temperature\?:\s*number/,
    /blackPoint\?:\s*number/,
    /splitToneAmount\?:\s*number/,
    /filterPreset\?:\s*ColorFilterPreset/,
    /compositionGuides\?:\s*\{/,
    /aspectMask\?:\s*"none"\s*\|\s*"16:9"\s*\|\s*"1\.85:1"\s*\|\s*"2\.39:1"/,
  ]) {
    assert.match(typesSource, expected);
  }

  for (const expected of [
    /dollyEnabled\?:\s*boolean/,
    /dollyDistanceM\?:\s*number/,
    /truckEnabled\?:\s*boolean/,
    /truckDistanceM\?:\s*number/,
    /craneEnabled\?:\s*boolean/,
    /craneHeightM\?:\s*number/,
    /shotStartMs\?:\s*number/,
    /shotEndMs\?:\s*number/,
    /shotCurve\?:\s*DynamicCameraCurve/,
    /handheldEnabled\?:\s*boolean/,
    /handheldAmplitudeM\?:\s*number/,
    /handheldFrequencyHz\?:\s*number/,
    /rollDeg\?:\s*number/,
  ]) {
    assert.match(typesSource, expected);
  }
});

test("Render preset capture includes cinematic effects but still strips topo authority", () => {
  for (const key of [
    "depthOfField",
    "tiltShift",
    "lensEffects",
    "motionTrails",
    "presentationFrame",
    "compositionGuides",
  ]) {
    assert.match(
      renderPresets,
      new RegExp(`"${key}"`),
      `Render preset scene patch capture should include ${key}.`,
    );
  }
  assert.match(
    renderPresets,
    /stripTopoMaterialAuthorityFromTerrain\(patch\.terrain\)/,
    "User render presets should keep stripping topo material authority fields.",
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

test("Cinematic scene preset sync keeps light-mode background edits", () => {
  assert.match(
    editorContext,
    /patch\.lightModeBackground\s*!==\s*undefined[\s\S]*next\.lightModeBackground\s*=\s*patch\.lightModeBackground/,
    "Active user render-preset sync should keep lightModeBackground edits.",
  );
});

test("Camera Studio and Post Processing split cinematic control sections", () => {
  const visualStudioPanel = functionBody(pagePanel, "VisualStudioPanel");
  const cameraSetupPanel = functionBody(environmentPanel, "CameraSetupPanel");
  const cameraBranchStart = cameraSetupPanel.indexOf('{content === "camera"');
  const postBranchStart = cameraSetupPanel.indexOf('{content === "post"', cameraBranchStart);
  assert.ok(cameraBranchStart >= 0, "CameraSetupPanel should have a camera branch.");
  assert.ok(postBranchStart > cameraBranchStart, "CameraSetupPanel should have a later post branch.");
  const cameraBranch = cameraSetupPanel.slice(cameraBranchStart, postBranchStart);
  const postBranch = cameraSetupPanel.slice(postBranchStart);

  const cameraPanelIndex = visualStudioPanel.indexOf("<CameraSetupPanel");
  const postPanelIndex = visualStudioPanel.indexOf("<PostProcessingPanel");
  assert.ok(cameraPanelIndex >= 0, "Cinematics should render CameraSetupPanel.");
  assert.ok(
    postPanelIndex > cameraPanelIndex,
    "Post Processing should render after Camera Studio.",
  );
  assert.match(
    visualStudioPanel,
    /<PostProcessingPanel[\s\S]*title=["']Post Processing["']/,
    "Cinematics should expose a named Post Processing panel.",
  );

  for (const label of [
    "Render Preset",
    "Lens Types",
    "Camera Focus",
  ]) {
    assert.match(
      cameraBranch,
      new RegExp(`>${label}<|["']${label}["']`),
      `Camera Studio should expose the ${label} section.`,
    );
  }

  for (const label of [
    "Depth of Field",
    "Tilt-Shift",
    "Post Production",
    "Image finish",
    "Glow",
    "Film / Optics",
    "Motion Trails",
    "Composition Guides",
    "Presentation Frame",
    "Contact Depth",
  ]) {
    assert.match(
      postBranch,
      new RegExp(`>${label}<|["']${label}["']`),
      `Post Processing should expose the ${label} section.`,
    );
    assert.doesNotMatch(
      cameraBranch,
      new RegExp(`>${label}<|["']${label}["']`),
      `Camera Studio should not own the ${label} section after the split.`,
    );
  }

  const expectedCameraOrder = [
    "Render Preset",
    "Lens Types",
    "Camera Focus",
  ];
  let previousIndex = -1;
  for (const label of expectedCameraOrder) {
    const index = cameraBranch.indexOf(`>${label}<`);
    assert.ok(index > previousIndex, `${label} should appear in Camera Studio order.`);
    previousIndex = index;
  }

  const expectedPostOrder = [
    "Depth of Field",
    "Tilt-Shift",
    "Post Production",
    "Image finish",
    "Glow",
    "Film / Optics",
    "Motion Trails",
    "Composition Guides",
    "Presentation Frame",
    "Contact Depth",
  ];
  previousIndex = -1;
  for (const label of expectedPostOrder) {
    const index = postBranch.indexOf(`>${label}<`);
    assert.ok(index > previousIndex, `${label} should appear in Post Processing order.`);
    previousIndex = index;
  }
});

test("Depth of field is object or distance aware in the editor and runtime", () => {
  const cameraSetupPanel = functionBody(environmentPanel, "CameraSetupPanel");
  const postBranchStart = cameraSetupPanel.indexOf('{content === "post"');
  assert.ok(postBranchStart >= 0, "CameraSetupPanel should have a post branch.");
  const postBranch = cameraSetupPanel.slice(postBranchStart);
  for (const expected of [
    "Focus Target",
    "Blur Strength",
    "Focus Debug",
    "camera-object",
    "Focus X",
    "Focus Y",
    "Focus Z",
    "Debug opacity",
    "Debug scale",
    "Debug plane",
  ]) {
    assert.match(
      postBranch,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `Depth of Field editor should expose ${expected}.`,
    );
  }
  assert.match(
    applyEnvironment,
    /resolveDepthOfFieldFocusDistance\(/,
    "Runtime should resolve DOF focus distance through a dedicated helper.",
  );
  assert.match(
    applyEnvironment,
    /dof\.focusMode\s*===\s*"camera-object"[\s\S]*page\?\.cameraObjectFocus\?\.worldPoint/,
    "Runtime DOF should be able to focus the saved camera object focus point.",
  );
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

test("Post-processing stack exposes DOF, tilt-shift, and lens-grade controls in deterministic order", () => {
  assert.match(
    postprocessing,
    /BokehPass/,
    "Post stack should use Three's BokehPass for cinematic depth of field.",
  );
  assert.match(
    postprocessing,
    /tiltShiftShader|TiltShiftPass/,
    "Post stack should include a custom tilt-shift pass.",
  );
  assert.match(
    postprocessing,
    /RenderPass[\s\S]*SSAOPass[\s\S]*BokehPass[\s\S]*UnrealBloomPass[\s\S]*TiltShift[\s\S]*AfterimagePass[\s\S]*LensGrade[\s\S]*SMAAPass[\s\S]*OutputPass/,
    "Post stack order should remain deterministic.",
  );
  for (const uniform of [
    "grainAmount",
    "grainSize",
    "distortion",
    "chromaticAberration",
    "sharpen",
    "diffusion",
    "halation",
    "anamorphicStreak",
    "anamorphicStreakLength",
    "anamorphicStreakThreshold",
    "frameEnabled",
    "frameAspectRatio",
    "frameOpacity",
    "frameColor",
    "cornerFade",
    "gateWeave",
    "temperature",
    "blackPoint",
    "whitePoint",
    "lift",
    "gamma",
    "gain",
    "splitShadowColor",
    "splitHighlightColor",
    "splitToneAmount",
    "filterIntensity",
  ]) {
    assert.match(postprocessing, new RegExp(`\\b${uniform}\\b`));
  }
});

test("Composition guide lines render at the thinner presentation width", () => {
  assert.match(
    postprocessing,
    /uniform float guideLineThickness/,
    "Composition guide shader should expose a runtime thickness uniform.",
  );
  assert.match(
    applyEnvironment,
    /gp\.guideLineThickness\.value\s*=\s*clampRange\(guides\.lineThickness\s*\?\?\s*0\.25,\s*0\.1,\s*2\)/,
    "Composition guide thickness should default to half of the previous half-step and be configurable.",
  );
  assert.match(
    postprocessing,
    /float width = max\(guideLineThickness \/ max\(resolution\.x, resolution\.y\), 0\.0003\)/,
    "Composition guide shader should halve the minimum frame-line thickness again.",
  );
});

test("Runtime wires expanded cinematic scene fields into post-processing", () => {
  for (const expected of [
    /const dof = sp\.depthOfField \?\? \{\}/,
    /postHandle\.bokehPass/,
    /postHandle\.tiltShiftPass/,
    /postHandle\.afterimagePass/,
    /const trails = sp\.motionTrails \?\? \{\}/,
    /const frame = sp\.presentationFrame \?\? \{\}/,
    /const lens = sp\.lensEffects \?\? \{\}/,
    /gp\.grainAmount\.value/,
    /gp\.distortion\.value/,
    /gp\.chromaticAberration\.value/,
    /gp\.halation\.value/,
    /gp\.anamorphicStreak\.value/,
    /gp\.frameAspectRatio\.value/,
    /gp\.gateWeave\.value/,
    /grade\.temperature/,
    /grade\.splitShadowColor/,
    /grade\.filterPreset/,
  ]) {
    assert.match(applyEnvironment, expected);
  }
});

test("Animated cinematic post uniforms are updated from the render frame loop", () => {
  assert.match(
    sceneMount,
    /manager\.frameUpdate\(camera,\s*timeMs\)[\s\S]*post\.composer\.render\(\)/,
    "SceneManager.frameUpdate should run before composer.render so post uniforms are current for the rendered frame.",
  );
  assert.match(
    sceneManager,
    /updateCinematicPostFrame\(nowMs\)/,
    "SceneManager.frameUpdate should refresh animated cinematic post uniforms each frame.",
  );
  assert.match(
    applyEnvironment,
    /applyCinematicPostProcessing/,
    "applyEnvironment should route post-processing uniform writes through the shared cinematic post helper.",
  );
  assert.doesNotMatch(
    applyEnvironment,
    /gp\.time\.value\s*=\s*Date\.now\(\)\s*\/\s*1000/,
    "Lens-grade time should not be stamped once during environment application.",
  );
});

test("Cinematic scene fields declare transition policies", () => {
  const cinematicTransitions = readSource(
    "src",
    "scene",
    "transitions",
    "cinematicSceneTransitions.ts",
  );
  for (const expected of [
    "colorGrade",
    "vignette",
    "depthOfField",
    "tiltShift",
    "lensEffects",
    "motionTrails",
    "presentationFrame",
    "compositionGuides",
    "camera.lensPreset",
    "dynamicCamera.dolly",
    "dynamicCamera.truck",
    "dynamicCamera.crane",
    "dynamicCamera.handheld",
  ]) {
    assert.match(
      cinematicTransitions,
      new RegExp(`["']${expected}["']`),
      `${expected} should have an explicit cinematic transition policy.`,
    );
  }
  assert.match(
    cinematicTransitions,
    /transitionKind:\s*"continuous"/,
    "Numeric post effects should have continuous transition policy coverage.",
  );
  assert.match(
    cinematicTransitions,
    /transitionKind:\s*"timed-shot"/,
    "Dynamic camera shot axes should have timed-shot transition policy coverage.",
  );
  assert.match(
    cinematicTransitions,
    /export function blendCinematicSceneForTransition/,
    "Cinematic scene transition policies should be backed by a shared blend helper.",
  );
});

test("Page navigation starts the cinematic post transition channel", () => {
  assert.match(
    sceneManager,
    /beginCinematicSceneTransition\(/,
    "SceneManager should expose a page-transition channel for cinematic post effects.",
  );
  assert.match(
    pageController,
    /beginCinematicSceneTransition\(\s*sourceResolved\.environment,\s*targetResolved\.environment,\s*sourceResolved\.page,\s*targetResolved\.page,\s*transitionDuration,\s*target\.transition\.easing,\s*transitionStartMs/s,
    "PageController should start cinematic post blending with the same duration/easing as page navigation.",
  );
  assert.doesNotMatch(
    pageController,
    /\/\/ Per-page mood \(cinematicExposure \/ bloomBoost\) flips at start too\.[\s\S]{0,140}applyPageScene\(targetResolved\.page\)/,
    "Page mood should no longer be the only cinematic transition behavior and should not flip at transition start.",
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

test("Dynamic camera panel exposes shot templates and dolly truck crane controls", () => {
  const dynamicCameraPanel = functionBody(pagePanel, "DynamicCameraPanel");
  for (const label of [
    "Shot Templates",
    "Camera Dolly",
    "Camera Truck",
    "Camera Crane",
    "Handheld Polish",
    "Roll",
  ]) {
    assert.match(
      dynamicCameraPanel,
      new RegExp(label),
      `Dynamic Camera should expose ${label}.`,
    );
  }
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
