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
  "docs/dev-context/Archive/Section-Iso-Transition-Smoothing-Temp-Log-2026-06-05.md",
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

test("new transitions discard Section ISO transition roots instead of promoting cancelled targets", () => {
  assert.match(
    sceneManager,
    /discardSectionIsoOverlayTransition\(\):\s*void/,
    "SceneManager should expose a cancel/discard path separate from final commit.",
  );
  const discardBody = sceneManager.match(
    /discardSectionIsoOverlayTransition\(\):\s*void\s*\{[\s\S]*?\n  \}/,
  );
  assert.ok(discardBody, "Discard path should have an inspectable body.");
  assert.doesNotMatch(
    discardBody[0],
    /applyRenderOpacityToTree\(\s*root\.group\s*,\s*1\s*,\s*1\s*\)/,
    "Discarding an interrupted transition must not promote target roots to full opacity.",
  );
  assert.match(
    transitionEffectiveLayers,
    /this\.discardSectionIsoOverlayTransition\?\.\(\)/,
    "Starting a new page transition should discard old Section ISO roots instead of committing them.",
  );
});

test("Section ISO roots are not snapshotted for inactive or unrelated target pages", () => {
  assert.doesNotMatch(
    sceneManager,
    /void fromSceneSectionStyle;[\s\S]*void toSceneSectionStyle;/,
    "Section ISO transition gating should consume source and target section styles.",
  );
  assert.match(
    sceneManager,
    /sectionIsoOverlayTransitionShouldStart\(\s*fromSceneSectionStyle,\s*toSceneSectionStyle,?\s*\)/,
    "Section ISO transition start should be gated by source/target section activity.",
  );
  assert.match(
    sceneManager,
    /if\s*\(\s*!this\.sectionIsoOverlayTransitionShouldStart\(\s*fromSceneSectionStyle,\s*toSceneSectionStyle,?\s*\)\s*\)\s*\{?\s*return/,
    "Inactive or unrelated target pages should not snapshot source Section ISO roots.",
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



test("SceneManager injects non-destructive Section ISO options during active target transitions", () => {
  const sceneManager = readFileSync("src/scene/SceneManager.ts", "utf8");

  assert.match(
    sceneManager,
    /private transitionAwareSectionIsoOverlayUpdateOptions\([\s\S]*?style: EditableStyle,[\s\S]*?options\?: SectionIsoOverlayUpdateOptions/,
    "SceneManager should centralize transition-aware Section ISO update options.",
  );

  assert.match(
    sceneManager,
    /style\.sectionIsoEnabled !== true/,
    "Inactive Section ISO target styles must not receive preserveExisting.",
  );

  assert.match(
    sceneManager,
    /!!sceneSectionStyle[\s\S]*?sceneSectionStyle\.sceneSectionEnabled === true[\s\S]*?sceneSectionActivePlanes\(sceneSectionStyle\)\.length > 0/,
    "Preserve-existing injection must be target-section-active, not just transition-active.",
  );

  assert.match(
    sceneManager,
    /private sectionIsoOverlayUpdateHeldByTransition\([\s\S]*?kind: SectionIsoOverlayTransitionRootKind,[\s\S]*?options\?: SectionIsoOverlayUpdateOptions/,
    "SceneManager should hold ISO overlay rebuilds while a transition owns populated target roots; rebuilds duplicate roots or swap contours at full opacity.",
  );

  assert.match(
    sceneManager,
    /options\?\.bypassTransitionHold === true\) return false/,
    "Height-sampler retries must be able to bypass the transition hold to replace untrimmed contours.",
  );

  assert.match(
    sceneManager,
    /root\.kind === kind && root\.group\.children\.length > 0/,
    "The transition hold must apply only to registered, populated target roots.",
  );

  assert.match(
    sceneManager,
    /initialTransitionOpacity:\s*options\?\.initialTransitionOpacity \?\? transition\.targetOpacity/,
    "Active target preparation should attach target roots at the current transition opacity.",
  );

  const wrapperCalls =
    sceneManager.match(/this\.transitionAwareSectionIsoOverlayUpdateOptions\(style, options\)/g) ?? [];

  assert.ok(
    wrapperCalls.length >= 3,
    "MT, seismic-volume, and seismic-resistivity ISO update wrappers should all inject transition-aware options.",
  );
});
