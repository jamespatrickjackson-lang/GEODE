import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const transitionDecisionLog = readFileSync(
  "docs/dev-context/Transition-Decision-Log.md",
  "utf8",
);
const decisions = readFileSync("docs/03-decisions.md", "utf8");
const transitionDirectives = readFileSync(
  "docs/dev-context/Page-Transitions-And-Section-Frames.md",
  "utf8",
);
const pageSchema = readFileSync("docs/schemas/page.json.md", "utf8");
const transitionStyles = readFileSync(
  "src/scene/transitions/transitionStyles.ts",
  "utf8",
);
const transitionEffectiveLayers = readFileSync(
  "src/scene/transitions/transitionEffectiveLayersForPage.ts",
  "utf8",
);
const layerTweenRuntime = readFileSync(
  "src/scene/transitions/layerTweenRuntime.ts",
  "utf8",
);
const sceneSectionController = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);
const objectVisibilityShader = readFileSync(
  "src/scene/shaders/sceneSectionObjectVisibilityShader.ts",
  "utf8",
);
const terrainMaterial = readFileSync("src/scene/terrainMaterial.ts", "utf8");

test("docs define section masks as transition-scene channels without adding a layer kind", () => {
  assert.match(
    transitionDecisionLog,
    /TRD-010 - Scene Section Masks And Helpers Blend During Page Transitions/,
    "Transition decision log should lock the section-mask transition contract.",
  );
  assert.match(
    transitionDirectives,
    /section masks are transition-scene channels/i,
    "Page transition directives should classify section masks outside LayerTransitionKind.",
  );
  assert.match(
    pageSchema,
    /section masks.*transition\.duration.*transition\.easing/is,
    "Page schema should document that section masks use the page transition clock.",
  );
  assert.doesNotMatch(
    transitionStyles,
    /type LayerTransitionKind =[\s\S]*section-mask/,
    "Section masks should not add a new LayerTransitionKind value.",
  );
});

test("docs supersede section exit fades with the no-bleed target-active contract", () => {
  assert.match(
    decisions,
    /DEC-100 - Scene section transitions do not bleed into inactive target pages/,
    "Durable decisions should supersede active-to-inactive section exit fades.",
  );
  assert.match(
    transitionDecisionLog,
    /TRD-012 - Scene Section No-Bleed Target-Active Guard/,
    "Transition decision log should record the target-active no-bleed guard.",
  );
  assert.match(
    transitionDirectives,
    /active-to-inactive[\s\S]*must not carry source\s+section masks, helpers, frame controls, ground traces, or Section ISO roots/i,
    "Transition directives should forbid section visuals on inactive or unrelated target pages.",
  );
});

test("section object visibility is a continuous opacity channel, not a discrete snap", () => {
  assert.match(
    sceneSectionController,
    /interpolatedSceneSectionObjectVisibilityByAxis/,
    "Scene section interpolation should handle per-axis outside-opacity maps.",
  );
  assert.match(
    sceneSectionController,
    /interpolatedSceneSectionObjectVisibilityByFrameId/,
    "Scene section interpolation should handle per-frame outside-opacity maps.",
  );
  assert.match(
    sceneSectionController,
    /fromOutsideOpacity\s*\+\s*\(toOutsideOpacity\s*-\s*fromOutsideOpacity\)\s*\*\s*t/,
    "Outside opacity values should interpolate from source to target.",
  );
  assert.doesNotMatch(
    transitionStyles,
    /sceneSectionDiscreteSignature[\s\S]*objectVisibilityByAxis/,
    "Object outside-opacity maps should not force the section transition into the discrete path.",
  );
});

test("section object visibility interpolation derives missing defaults from scene-section targeting", () => {
  assert.match(
    sceneSectionController,
    /function sceneSectionVisibilityDefaultOutsideOpacity\(\s*style: EditableStyle,\s*objectId: string/s,
    "Object visibility interpolation should derive missing defaults from the full scene-section style.",
  );
  assert.match(
    sceneSectionController,
    /sceneSectionVisibilityDefaultOutsideOpacity\(\s*fromStyle,\s*objectId\s*\)/,
    "Source interpolation defaults should use source scene-section targeting.",
  );
  assert.match(
    sceneSectionController,
    /sceneSectionVisibilityDefaultOutsideOpacity\(\s*toStyle,\s*objectId\s*\)/,
    "Target interpolation defaults should use target scene-section targeting.",
  );
  assert.match(
    sceneSectionController,
    /sceneSectionProductObjectParts[\s\S]*representationKind[\s\S]*sceneSectionLegacyProductObjectId/,
    "Representation-specific seismic object ids should fall back through their legacy product id during interpolation.",
  );
});

test("incompatible section changes use a dual-mask fade with the page transition clock", () => {
  assert.match(
    transitionStyles,
    /maskMode:\s*"interpolated"\s*\|\s*"dual-mask"/,
    "SceneSectionStyleTween should record the mask transition mode.",
  );
  assert.match(
    transitionEffectiveLayers,
    /maskMode:\s*sectionHasDissolve\s*\?\s*"dual-mask"\s*:\s*"interpolated"/,
    "Section transitions select the dual-mask path per-frame (DEC-164): the mask runs only when there are dissolve frames, not whenever any discrete field changed.",
  );
  assert.match(
    layerTweenRuntime,
    /sceneSectionMaskTransitionForTween\(\s*tween,\s*eased\s*\)/,
    "Tween ticks should pass eased progress into the section mask transition.",
  );
  assert.match(
    sceneSectionController,
    /SceneSectionMaskTransition/,
    "Scene section material application should accept explicit mask transition state.",
  );
});

test("inactive target pages do not carry source section masks into the transition", () => {
  assert.match(
    transitionEffectiveLayers,
    /const targetSceneSectionTransitionActive\s*=\s*sceneSectionTransitionActiveForStyle\(\s*targetSceneSectionStyle\s*\)/,
    "Transition setup should compute target section activity from the target section style.",
  );
  assert.match(
    transitionEffectiveLayers,
    /if\s*\(\s*sceneSectionStyleChanged\s*&&\s*duration\s*>\s*0\s*&&\s*targetSceneSectionTransitionActive\s*\)/,
    "Section mask tweens should only start when the target page owns active section state.",
  );
  assert.match(
    transitionEffectiveLayers,
    /else\s+if\s*\(\s*sceneSectionStyleChanged\s*&&\s*!targetSceneSectionTransitionActive\s*\)\s*\{[\s\S]*this\.applySceneSectionPlanes\(\s*targetSceneSectionStyle\s*\)/,
    "Inactive target pages should apply the target section state immediately instead of fading source masks.",
  );
});

test("scene-section frame transition graph presence requires section enablement", () => {
  assert.match(
    transitionEffectiveLayers,
    /const frameEnabled\s*=\s*sectionEnabled\s*&&\s*input\.style\.sceneSectionFrameEnabled\s*===\s*true/,
    "Transition graph diagnostics should not report frame presence when sceneSectionEnabled is false.",
  );
});

test("transition frame section applies update uniforms without rebuilding helpers", () => {
  assert.match(
    sceneSectionController,
    /transitionFrame\?:\s*boolean/,
    "applySceneSectionPlanes should expose a transition-frame option.",
  );
  assert.match(
    sceneSectionController,
    /if\s*\(!options\?\.transitionFrame\)\s*\{[\s\S]*rebuildSceneSectionHelpers/,
    "Helper rebuilds should be gated away from transition frames.",
  );
  assert.match(
    sceneSectionController,
    /applySceneSectionHelperTransitionOpacity\(\)/,
    "Transition frames should still update helper opacity.",
  );
});

test("terrain and built-in material shaders expose dual-mask transition uniforms", () => {
  for (const source of [terrainMaterial, objectVisibilityShader]) {
    assert.match(
      source,
      /uSceneSectionTransitionEnabled/,
      "Shader source should expose a transition enable uniform.",
    );
    assert.match(
      source,
      /uSceneSectionTransitionProgress/,
      "Shader source should expose transition progress.",
    );
    assert.match(
      source,
      /mix\(\s*sourceAlpha\s*,\s*targetAlpha\s*,\s*clamp\(uSceneSectionTransitionProgress/,
      "Shader alpha should lerp source and target section masks.",
    );
  }
  assert.match(
    sceneSectionController,
    /setSceneSectionUniforms\(material,\s*planes,\s*visibility,\s*frames,\s*maskTransition/,
    "Terrain shader path should receive transition mask state.",
  );
  assert.match(
    objectVisibilityShader,
    /setSceneSectionObjectVisibilityUniforms\([^)]*maskTransition/s,
    "Built-in material shader path should receive transition mask state.",
  );
});

test("terrain target section mask helper does not recurse into itself", () => {
  const targetHelper = terrainMaterial.match(
    /float sceneSectionTargetAlpha\(vec3 position\) \{[\s\S]*?\n      \}/,
  );
  assert.ok(
    targetHelper,
    "Terrain shader should define a target-mask alpha helper.",
  );
  assert.doesNotMatch(
    targetHelper[0],
    /sceneSectionTargetAlpha\(position\)/,
    "Target-mask helper should not recursively call itself.",
  );
  assert.match(
    terrainMaterial,
    /float sourceAlpha = sceneSectionAlpha\(vWorldPos\);[\s\S]*float targetAlpha = sceneSectionTargetAlpha\(vWorldPos\);[\s\S]*mix\(sourceAlpha,\s*targetAlpha,\s*clamp\(uSceneSectionTransitionProgress/,
    "Terrain shader should mix source and target section masks at the call site.",
  );
});
