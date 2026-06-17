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
const sectionIsoLegend = readFileSync("src/ui/SectionIsoLegend.tsx", "utf8");
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

test("inactive target Section ISO exits snapshot only detached visual roots", () => {
  assert.doesNotMatch(
    sceneManager,
    /void fromSceneSectionStyle;[\s\S]*void toSceneSectionStyle;/,
    "Section ISO transition gating should consume source and target section styles.",
  );
  assert.match(
    sceneManager,
    /sectionIsoOverlayTransitionShouldStart\(\s*fromSceneSectionStyle:\s*EditableStyle,\s*toSceneSectionStyle:\s*EditableStyle,\s*hasSourceRoots:\s*boolean,?\s*\)/,
    "Section ISO transition start should know whether detached source roots exist.",
  );
  assert.match(
    sceneManager,
    /return\s+targetActive\s*\|\|\s*\(\s*sourceActive\s*&&\s*hasSourceRoots\s*\)/,
    "Detached source roots may fade out even when the target page has inactive section state.",
  );
  assert.match(
    sceneManager,
    /const\s+sourceRootsForTransition\s*=\s*this\.sectionIsoOverlayGroupsForTransition\(\)/,
    "Source roots should be collected before inactive target application clears live roots.",
  );
  assert.match(
    sceneManager,
    /this\.sectionIsoOverlayTransitionShouldStart\(\s*fromSceneSectionStyle,\s*toSceneSectionStyle,\s*sourceRootsForTransition\.length\s*>\s*0,?\s*\)/,
    "The start gate should allow source-only detached root exits without live section carry.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const sourceSceneSectionTransitionActive\s*=\s*sceneSectionTransitionActiveForStyle\(\s*fromSceneSectionStyle\s*\)/,
    "Section ISO root presence should know whether the source section is active.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const fromOn\s*=\s*sourceSceneSectionTransitionActive\s*&&\s*fromVisible\.has\(id\)\s*&&\s*sectionIsoOverlayVisible\(fromStyle\)/,
    "Source Section ISO roots should count as present only when source section state is active.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const toOn\s*=\s*targetSceneSectionTransitionActive\s*&&\s*toVisible\.has\(id\)\s*&&\s*sectionIsoOverlayVisible\(toStyle\)/,
    "Inactive target Section ISO styles should not look like live target roots.",
  );
  assert.match(
    transitionEffectiveLayers,
    /else\s+if\s*\(\s*sceneSectionStyleChanged\s*&&\s*!targetSceneSectionTransitionActive\s*\)\s*\{[\s\S]*?beginSectionIsoOverlayTransition\(\s*fromSceneSectionStyle,\s*targetSceneSectionStyle,\s*now,\s*duration,\s*easing,\s*\)[\s\S]*?applyInactiveTargetSceneSectionAfterLayerSnapshots\s*=\s*true/,
    "Detached Section ISO source roots should be snapshotted before inactive target state is scheduled.",
  );
  assert.match(
    transitionEffectiveLayers,
    /else\s+if\s*\(\s*applyInactiveTargetSceneSectionAfterLayerSnapshots\s*\)\s*\{[\s\S]*this\.applySceneSectionPlanes\(\s*targetSceneSectionStyle\s*\)/,
    "Inactive target state should apply after source-clipped exit snapshots are cloned.",
  );
});

test("Section ISO exits during pure section moves follow the moving cut while fading", () => {
  assert.match(
    transitionStyles,
    /sectionIsoMoveFollowSourceStyles\?:\s*Map<string,\s*EditableStyle>/,
    "Scene-section tweens should carry source ISO styles for move-follow exits.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const sectionIsoMoveFollowSourceStyles\s*=\s*new Map<\s*string,\s*ReturnType<typeof effectiveStyle>\s*>\(\)/,
    "Transition setup should prepare a source-style map for moving ISO exits.",
  );
  assert.match(
    transitionEffectiveLayers,
    /!sectionHasDissolve[\s\S]*fromOn[\s\S]*!toOn[\s\S]*sectionIsoMoveFollowSourceStyles\.set\(id,\s*fromStyle\)/,
    "Pure section moves with an ISO exit should keep the source ISO style available for follow updates.",
  );
  assert.match(
    transitionEffectiveLayers,
    /sectionIsoRootStateChangedForTransition\s*=[\s\S]*if\s*\(!state\.changed\)\s*return false[\s\S]*if\s*\(sectionIsoMoveFollowSourceStyles\.has\(state\.id\)\)\s*return false/,
    "Move-follow ISO exits should not also start a fixed source-root snapshot transition.",
  );
  assert.match(
    transitionEffectiveLayers,
    /sectionIsoMoveFollowSourceStyles:\s*sectionIsoMoveFollowSourceStyles\.size\s*>\s*0\s*\?\s*sectionIsoMoveFollowSourceStyles\s*:\s*undefined/,
    "The scene-section tween should own the moving source ISO exit styles.",
  );
  assert.match(
    sceneManager,
    /sectionIsoMoveFollowSourceStyle\s*=\s*tween\?\.sectionIsoMoveFollowSourceStyles\?\.get\(\s*UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,?\s*\)/,
    "Move-follow should prefer the source ISO style when the target turns the overlay off.",
  );
  assert.match(
    sceneManager,
    /style\.sectionIsoEnabled\s*!==\s*true[\s\S]*sectionIsoMoveFollowSourceStyle[\s\S]*transitionTweenEasedProgress\(\s*tween,\s*performance\.now\(\),?\s*\)[\s\S]*updateMtVolumeCutIsoOverlaysImpl\.call\(\s*this,\s*sectionIsoMoveFollowSourceStyle,/,
    "Applying a target-off style during a move-follow ISO exit should not clear the moving source contours.",
  );
  assert.match(
    sceneManager,
    /initialTransitionOpacity:\s*sectionIsoMoveFollowOpacity/,
    "Source-style move-follow exits should fade on the section transition clock.",
  );
});

test("compatible section moves do not start fixed ISO root crossfades for generic section discrete changes", () => {
  assert.match(
    transitionEffectiveLayers,
    /let sectionHasDissolveForTransition\s*=\s*false/,
    "Transition setup should track real section-frame dissolves separately from global discrete differences.",
  );
  assert.doesNotMatch(
    transitionEffectiveLayers,
    /sceneSectionDiscreteChanged\s*\|\|\s*sectionIsoRootStateChangedForTransition/,
    "Generic section discrete changes must not force fixed Section ISO root crossfades during compatible moves.",
  );
  assert.match(
    transitionEffectiveLayers,
    /sectionHasDissolveForTransition\s*\|\|\s*sectionIsoRootStateChangedForTransition/,
    "Fixed Section ISO root crossfades should be reserved for dissolved frames or incompatible ISO root changes.",
  );
  assert.match(
    transitionEffectiveLayers,
    /state\.fromOn\s*&&\s*state\.toOn[\s\S]*return false/,
    "Compatible moving cuts with source and target ISO roots should let live overlays follow the cut instead of fixed-root crossfading.",
  );
});

test("Section ISO target roots follow transition-frame section geometry", () => {
  assert.match(
    sceneManager,
    /applyMtVolumeCutIsoFollowForTransitionFrame\(\):\s*void/,
    "SceneManager should expose a transition-frame Section ISO follow/rebuild owner.",
  );
  const followBody = sceneManager.match(
    /applyMtVolumeCutIsoFollowForTransitionFrame\(\):\s*void\s*\{[\s\S]*?\n  \}/,
  );
  assert.ok(followBody, "Transition-frame follow owner should have an inspectable body.");
  assert.doesNotMatch(
    followBody[0],
    /if\s*\(\s*this\.sectionIsoOverlayTransition\s*\)\s*return/,
    "Target-root transition frames must not be blocked merely because a Section ISO overlay transition is active.",
  );
  assert.match(
    followBody[0],
    /initialTransitionOpacity:\s*sectionIsoTransitionOpacity/,
    "Transition-frame target roots should attach at the current Section ISO envelope.",
  );
  assert.match(
    sceneSectionController,
    /options\?\.transitionFrame[\s\S]{0,360}applyMtVolumeCutIsoFollowForTransitionFrame\?\.\(\)/,
    "Transition-frame section applies should update Section ISO roots for enter/dual-mask cases, not only pure moves.",
  );
  assert.match(
    volumeCutIsoOverlays,
    /unregisterSectionIsoOverlayTransitionTargetRoot\?\.\(\s*group\s*\)/,
    "Rebuilding a transition-owned target root should unregister the old root before disposal.",
  );
});

test("ISO Volume quick toggle fades source volume opacity over one second", () => {
  assert.match(
    sectionIsoLegend,
    /const SECTION_ISO_LOCAL_TOGGLE_TRANSITION_MS = 1000/,
    "The ISO Volume quick toggle should use the requested one-second transition.",
  );
  assert.match(
    sectionIsoLegend,
    /function sectionIsoLegendTransitionScopeKey\(/,
    "Local Section ISO toggle animations should be scoped to the current authoring context.",
  );
  assert.match(
    sectionIsoLegend,
    /window\.requestAnimationFrame\(tick\)/,
    "ISO Volume should animate live style writes on requestAnimationFrame.",
  );
  assert.match(
    sectionIsoLegend,
    /sectionIsoSourceOpacity:\s*fromOpacity\s*\+\s*\(toOpacity\s*-\s*fromOpacity\)\s*\*\s*eased/,
    "ISO Volume should interpolate source opacity instead of snapping to the final value.",
  );
  assert.match(
    sectionIsoLegend,
    /setIsoVolumeVisible\(!showVolume\)/,
    "The quick button should route through the local fade owner.",
  );
  assert.doesNotMatch(
    sectionIsoLegend,
    /sectionIsoSourceOpacity:\s*showVolume\s*\?\s*0\s*:\s*1/,
    "The ISO Volume quick button must not directly write a binary opacity patch.",
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

test("MT scalar volume enters and exits through section-aware transition ownership", () => {
  const scalarVolumeLoader = readFileSync("src/loaders/loadScalarVolume.ts", "utf8");

  assert.match(
    scalarVolumeLoader,
    /uniform int uSceneSectionTransitionEnabled;/,
    "The MT raymarch shader should expose the scene-section transition mask gate.",
  );
  assert.match(
    scalarVolumeLoader,
    /uniform int uSceneSectionTargetFrameCount;/,
    "The MT raymarch shader should expose target section-frame uniforms.",
  );
  assert.match(
    scalarVolumeLoader,
    /float sceneSectionTargetAlpha\(vec3 position\)/,
    "The MT raymarch shader should evaluate the target section mask.",
  );
  assert.match(
    scalarVolumeLoader,
    /mix\(\s*sourceAlpha\s*,\s*targetAlpha\s*,\s*clamp\(uSceneSectionTransitionProgress/,
    "The MT raymarch shader should blend source and target section masks on the page transition clock.",
  );
  assert.match(
    scalarVolumeLoader,
    /bool sourceHasSectionMask\s*=\s*uSceneSectionPlaneCount\s*>\s*0\s*\|\|\s*uSceneSectionFrameCount\s*>\s*0;[\s\S]*bool targetHasSectionMask\s*=\s*uSceneSectionTargetPlaneCount\s*>\s*0\s*\|\|\s*uSceneSectionTargetFrameCount\s*>\s*0;[\s\S]*if\s*\(\s*!sourceHasSectionMask\s*&&\s*targetHasSectionMask\s*\)\s*{[\s\S]*sectionAlpha\s*=\s*targetAlpha;/,
    "A hidden/unsectioned source volume entering a sectioned target should render against the target section mask from the first visible frame.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const shouldPreserveScalarVolumeExitStyle\s*=/,
    "Transition setup should name the MT scalar-volume exit style preservation gate.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const shouldSnapshotScalarVolumeSectionExit\s*=[\s\S]*shouldPreserveScalarVolumeExitStyle[\s\S]*sourceSceneSectionTransitionActive[\s\S]*!targetSceneSectionTransitionActive/,
    "Target-hidden MT scalar-volume exits from a source-sectioned page should use a transition-owned source snapshot so inactive target section application cannot unmask the outgoing volume.",
  );
  assert.match(
    transitionEffectiveLayers,
    /shouldTweenScalarStyle\s*\|\|\s*shouldPreserveScalarVolumeExitStyle\s*\?\s*fromStyle\s*:\s*targetStyle/,
    "A target-hidden MT volume should keep source style while opacity fades to zero.",
  );
  assert.match(
    transitionEffectiveLayers,
    /const shouldTweenScalarVolumeExitStyle\s*=/,
    "Target-hidden MT scalar-volume exits should use a named shader-opacity tween gate.",
  );
  assert.match(
    transitionEffectiveLayers,
    /scalarVolumeExitTargetStyle[\s\S]*scalarVolumeOpacity:\s*0/,
    "The MT scalar-volume exit tween should force the shader opacity target to zero.",
  );
  assert.match(
    transitionEffectiveLayers,
    /if\s*\(\s*shouldTweenScalarStyle\s*\|\|\s*shouldTweenScalarVolumeExitStyle\s*\)\s*{[\s\S]*toStyle:\s*shouldTweenScalarVolumeExitStyle\s*\?[\s\S]*scalarVolumeExitTargetStyle[\s\S]*:\s*targetStyle/,
    "Target-hidden MT scalar-volume exits should register a scalar style tween instead of relying on layer opacity.",
  );
  assert.match(
    transitionEffectiveLayers,
    /shouldCrossfadeDiscreteData\s*\|\|[\s\S]*shouldSnapshotScalarVolumeSectionExit[\s\S]*\?\s*this\.cloneLayerTransitionSnapshot\(id,\s*group\)/,
    "The MT scalar-volume source-section exit snapshot should be created before target section state clears live volume uniforms.",
  );
  assert.match(
    transitionEffectiveLayers,
    /this\.sceneSectionTweenStyle\(\s*this\.sceneSectionStyleTween,\s*0\s*\)/,
    "Target-active section transitions should apply an initial transition-frame section state before the first fade tick.",
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
