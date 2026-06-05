import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const sceneManager = readFileSync("src/scene/SceneManager.ts", "utf8");
const transitionStyles = readFileSync(
  "src/scene/transitions/transitionStyles.ts",
  "utf8",
);
const layerTweenRuntime = readFileSync(
  "src/scene/transitions/layerTweenRuntime.ts",
  "utf8",
);
const transitionEffectiveLayers = readFileSync(
  "src/scene/transitions/transitionEffectiveLayersForPage.ts",
  "utf8",
);
const sceneSectionController = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);
const volumeCutIsoOverlays = readFileSync(
  "src/scene/isoOverlays/volumeCutIsoOverlays.ts",
  "utf8",
);
const transitionDecisionLog = readFileSync(
  "docs/dev-context/Transition-Decision-Log.md",
  "utf8",
);
const tempLog = readFileSync(
  "docs/dev-context/Section-Iso-Transition-Smoothing-Temp-Log-2026-06-05.md",
  "utf8",
);

test("section ISO transition runtime tracks source and target overlay roots", () => {
  assert.match(
    transitionStyles,
    /export interface SectionIsoOverlayTransitionRoot/,
    "Section ISO transition roots should be explicit transition state.",
  );
  assert.match(
    transitionStyles,
    /export interface SectionIsoOverlayTransition/,
    "Section ISO overlay transition should have a narrow runtime interface.",
  );
  assert.match(
    sceneManager,
    /private sectionIsoOverlayTransition:\s*SectionIsoOverlayTransition\s*\|\s*null/,
    "SceneManager should own one active Section ISO overlay transition.",
  );
});

test("page transitions begin and tick Section ISO overlay fades beside section masks", () => {
  assert.match(
    transitionEffectiveLayers,
    /beginSectionIsoOverlayTransition\(\s*fromSceneSectionStyle,\s*targetSceneSectionStyle,\s*now,\s*duration,\s*easing,\s*\)/,
    "Transition setup should start a Section ISO overlay transition with the page clock.",
  );
  assert.match(
    layerTweenRuntime,
    /this\.tickSectionIsoOverlayTransition\(nowMs,\s*eased\)/,
    "Layer tween ticks should update Section ISO overlay opacity every transition frame.",
  );
  assert.match(
    layerTweenRuntime,
    /this\.commitSectionIsoOverlayTransition\(\)/,
    "Tween completion should commit/dispose Section ISO overlay transition roots.",
  );
});

test("cut ISO overlay updates support non-destructive target preparation", () => {
  assert.match(
    volumeCutIsoOverlays,
    /export interface SectionIsoOverlayUpdateOptions/,
    "Cut ISO updates should accept a narrow option object.",
  );
  assert.match(
    volumeCutIsoOverlays,
    /preserveExisting\?:\s*boolean/,
    "Target preparation should be able to avoid clearing the live source overlay root.",
  );
  assert.match(
    volumeCutIsoOverlays,
    /initialTransitionOpacity\?:\s*number/,
    "New target roots should attach with an explicit initial transition opacity.",
  );
  assert.match(
    volumeCutIsoOverlays,
    /if\s*\(!options\?\.preserveExisting\)\s*\{[\s\S]*clearMtVolumeCutIsoOverlays/,
    "MT cut ISO target preparation should skip clear when preserving source roots.",
  );
  assert.match(
    volumeCutIsoOverlays,
    /if\s*\(!options\?\.preserveExisting\)\s*\{[\s\S]*clearSeismicVolumeCutIsoOverlays/,
    "Seismic cut ISO target preparation should skip clear when preserving source roots.",
  );
});

test("delayed target generation does not attach Section ISO at full opacity", () => {
  assert.match(
    volumeCutIsoOverlays,
    /getHeightSampler\(\)\.then\(\(\)\s*=>\s*\{[\s\S]*initialTransitionOpacity:\s*this\.currentSectionIsoOverlayTransitionOpacity\?\.\(\)\s*\?\?\s*0/,
    "Async height-sampler retries should attach target roots at the current transition opacity.",
  );
  assert.match(
    sceneManager,
    /currentSectionIsoOverlayTransitionOpacity\(\):\s*number/,
    "SceneManager should expose the current Section ISO transition opacity for delayed target builds.",
  );
});

test("durable docs lock Section ISO root crossfade after validation", () => {
  assert.match(
    transitionDecisionLog,
    /TRD-011 - Section ISO Overlay Roots Crossfade During Page Transitions/,
    "Durable transition docs should lock the Section ISO root crossfade contract.",
  );
  assert.match(
    tempLog,
    /Durable Documentation Follow-up/,
    "Temporary implementation log should record the follow-up durable doc pass.",
  );
  assert.match(
    tempLog,
    /ready for visual check/,
    "Temporary log should preserve the manual visual verification status.",
  );
});
