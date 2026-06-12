import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);

test("scene-section helper opacity treats reference lines as active across transitions", () => {
  assert.match(
    source,
    /sceneSectionReferenceHelperVisible/,
    "Helper transition opacity should use a shared reference-helper visibility predicate.",
  );
  assert.match(
    source,
    /sceneSectionGroundTraceVisible/,
    "Ground-trace visibility must keep the helper layer active even when editor handles are hidden.",
  );
  assert.match(
    source,
    /sceneSectionAxesVisible/,
    "Axis visibility must keep the helper layer active even when editor handles are hidden.",
  );
  assert.match(
    source,
    /fromActive\s*&&\s*toActive\s*&&\s*tween\.discreteChanged\)\s*return\s*clamp01\(eased\)/,
    "Discrete active-to-active helper changes should crossfade the incoming live helper layer from zero while the outgoing snapshot fades out.",
  );
});

test("scene-section helper snapshots do not bleed into inactive target pages", () => {
  assert.match(
    source,
    /sceneSectionHelperSnapshotAllowedForTween/,
    "Helper snapshot creation should be routed through an explicit bleed guard.",
  );
  assert.match(
    source,
    /targetActive[\s\S]*&&[\s\S]*sourceActive/,
    "Helper snapshots should require both source and target helper states to be active.",
  );
});

test("scene-section ground traces use synchronous height sampling when available", () => {
  assert.match(
    source,
    /peekHeightSampler/,
    "Ground traces should not always wait for a promise microtask after helper rebuild.",
  );
  assert.match(
    source,
    /withSceneSectionHeightSampler/,
    "Ground-trace construction should route through a helper that uses the cached terrain sampler synchronously.",
  );
});

test("scene-section frame outlines are independent from editor handle visibility", () => {
  assert.match(
    source,
    /frameOutlineVisible/,
    "Frame/crop outline visibility should be controlled separately from editor push-pull handle visibility.",
  );
  assert.match(
    source,
    /controlHandlesVisible/,
    "Editor controls should remain separately gated by sceneSectionHelperVisible.",
  );
});

test("scene-section frame outlines and cones render as topmost studio overlays", () => {
  assert.match(
    source,
    /SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER/,
    "Frame outlines and control cones should use a dedicated topmost overlay render order.",
  );
  assert.match(
    source,
    /material\.userData\.forceTransparent\s*=\s*true/,
    "Studio helper material opacity maintenance should force helpers to stay in the transparent queue.",
  );
  const outlineFactory = source.match(
    /function makeSceneSectionOutlineMaterial[\s\S]*?return material;\r?\n}/,
  );
  assert.ok(outlineFactory, "Outline material factory should exist.");
  assert.doesNotMatch(
    outlineFactory[0],
    /material\.transparent\s*=\s*opacity\s*<\s*1/,
    "Frame outlines should not leave the transparent render queue at full opacity.",
  );
  const coneFactory = source.match(
    /function makeSceneSectionConeMaterial[\s\S]*?return material;\r?\n}/,
  );
  assert.ok(coneFactory, "Cone material factory should exist.");
  assert.doesNotMatch(
    coneFactory[0],
    /material\.transparent\s*=\s*opacity\s*<\s*1/,
    "Control cones should not leave the transparent render queue at full opacity.",
  );
  assert.match(
    source,
    /outline\.renderOrder\s*=\s*SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER/,
    "Frame outlines should render above scene content.",
  );
  assert.match(
    source,
    /topCone\.renderOrder\s*=\s*SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER[\s\S]*bottomCone\.renderOrder\s*=\s*SCENE_SECTION_CONTROL_OVERLAY_RENDER_ORDER/,
    "Control cones should render above scene content.",
  );
});

test("scene-section helper visuals read Cinematics sectionVisuals settings", () => {
  assert.match(
    source,
    /currentSceneProperties\?\.sectionVisuals/,
    "Scene-section runtime should read sectionVisuals from the current effective scene.",
  );
  for (const key of [
    "outlineWidthScale",
    "outlineMinWidthM",
    "outlineMaxWidthM",
    "arrowSpanScale",
    "arrowMinLengthM",
    "arrowMaxLengthM",
    "arrowRadiusScale",
    "arrowGapScale",
    "axisTickLengthScale",
    "axisTickMinLengthM",
    "axisTickMaxLengthM",
    "groundTraceWidthM",
  ]) {
    assert.match(
      source,
      new RegExp(key),
      `Scene-section runtime should consume ${key}.`,
    );
  }
  assert.match(
    source,
    /sceneSectionVisualOutlineWidthM/,
    "Frame outline width should route through section visual settings.",
  );
  assert.match(
    source,
    /handleSpan \* sectionVisuals\.arrowSpanScale/,
    "Push-pull arrows should use the authored arrow scale.",
  );
  assert.match(
    source,
    /referenceOutlineWidthM \* sectionVisuals\.axisTickLengthScale/,
    "Scale-axis ticks should use the authored tick scale.",
  );
});
