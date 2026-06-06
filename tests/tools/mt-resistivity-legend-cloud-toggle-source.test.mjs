import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

function readSource(path) {
  return readFileSync(path, "utf8");
}

const legendSource = readSource("src/ui/ResistivityLegend.tsx");
const scalarPreviewSource = readSource("src/scene/styles/scalarPreviewStyle.ts");
const sceneManagerSource = readSource("src/scene/SceneManager.ts");
const transitionSource = readSource("src/scene/transitions/transitionStyles.ts");
const transitionEffectiveSource = readSource(
  "src/scene/transitions/transitionEffectiveLayersForPage.ts",
);
const layerIdsSource = readSource("src/projectModules/utahForge/layerIds.ts");
const editorPreviewFieldsSource = readSource(
  "src/projectModules/utahForge/editorPreviewFields.ts",
);
const decisionsSource = readSource("docs/03-decisions.md");
const uiStandardsSource = readSource("docs/dev-context/UI-Visual-Standards.md");
const transitionDocsSource = readSource(
  "docs/dev-context/Page-Transitions-And-Section-Frames.md",
);
const agentsSource = readSource("AGENTS.md");
const claudeSource = readSource("CLAUDE.md");

test("MT Cell Points legend is point-cloud-only", () => {
  assert.match(
    layerIdsSource,
    /UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS\s*=\s*\[\s*UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,\s*\]\s*as const/,
    "The MT Cell Points legend layer tuple should contain only full-density points.",
  );
  assert.doesNotMatch(
    layerIdsSource,
    /UTAH_FORGE_MT_RESISTIVITY_CLOUD_MASTER_LAYER_IDS/,
    "The old full-density-plus-volume cloud master tuple should not remain.",
  );
  assert.match(
    legendSource,
    /import \{ UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID \} from "\.\.\/projectModules\/utahForge\/layerIds"/,
    "ResistivityLegend should import the canonical full-density layer id.",
  );
  assert.doesNotMatch(
    legendSource,
    /MT_RESISTIVITY_VOLUME_LAYER_ID|MT_RESISTIVITY_SLICES_LAYER_ID|MT_RESISTIVITY_PREVIEW_LAYER_ID|ScalarLegendLayer|resistivity-legend-target-volume|3D volume/,
    "The MT Cell Points legend should not own volume, slices, preview, or target selector behavior.",
  );
  assert.match(
    legendSource,
    /MT Cell Points/,
    "The viewport legend name should be MT Cell Points.",
  );
});

test("MT Cell Points header has exclusive Full Cloud and Spectrum modes", () => {
  assert.match(
    legendSource,
    /data-testid=\{testId\("resistivity-legend-master-toggle"\)\}/,
    "The point-cloud visibility title button should stay addressable.",
  );
  assert.match(
    legendSource,
    /data-testid=\{testId\("resistivity-legend-full-cloud-toggle"\)\}/,
    "Full Cloud mode should have a stable test id.",
  );
  assert.match(
    legendSource,
    /data-testid=\{testId\("resistivity-legend-spectrum-toggle"\)\}/,
    "Spectrum mode should have a stable test id.",
  );
  assert.match(
    legendSource,
    /data-testid=\{testId\("resistivity-legend-controls-toggle"\)\}/,
    "The controls opener should have a stable test id.",
  );
  assert.match(
    legendSource,
    /role="radiogroup"[\s\S]*role="radio"[\s\S]*aria-checked=\{displayedMode === "full-cloud"\}[\s\S]*role="radio"[\s\S]*aria-checked=\{displayedMode === "spectrum"\}/,
    "Full Cloud and Spectrum should be a one-of-two radio mode group.",
  );
  assert.match(
    legendSource,
    /disabled=\{[\s\S]{0,220}displayedMode === "full-cloud"[\s\S]{0,220}modeTransitionTarget !== null[\s\S]{0,700}disabled=\{[\s\S]{0,220}displayedMode === "spectrum"[\s\S]{0,220}modeTransitionTarget !== null/,
    "The active mode should be disabled/no-op and both mode buttons should lock during transition.",
  );
  assert.match(
    legendSource,
    /const targetMode: MtCellPointsMode = styleBoolean\(\s*targetStyle,\s*"scalarLegendVisible",\s*true,\s*\)[\s\S]{0,180}\? "spectrum"\s*:\s*"full-cloud";/,
    "The selected header mode should be derived from the target authored style, not the transient interpolated ramp style.",
  );
  assert.match(
    legendSource,
    /const displayedMode = modeTransitionTarget \?\? targetMode;/,
    "A local click transition may temporarily override the displayed mode, but page navigation should use the target mode.",
  );
  assert.match(
    legendSource,
    /controlsAvailable\s*=\s*[\s\S]{0,220}pointCloudVisible[\s\S]{0,220}targetMode === "spectrum"[\s\S]{0,220}modeTransitionTarget === null/,
    "Controls should only open when the point cloud is visible, target Spectrum mode is selected, and no mode transition is running.",
  );
});

test("MT Cell Points Spectrum lines ride the page scalar transition", () => {
  assert.doesNotMatch(
    sceneManagerSource,
    /assertFinalTransitionTargetState[\s\S]{0,1000}applyEffectiveVisibilityForPage\(environment, nextPage\)[\s\S]{0,1000}applyEffectiveStylesForPage\(environment, nextPage\)/,
    "SceneManager must not repair MT Cell Points lines by replaying final visibility/styles after commit, because that snaps the overlay in.",
  );
  assert.doesNotMatch(
    sceneManagerSource,
    /phase: "post-commit-graph-check"[\s\S]{0,700}this\.assertFinalTransitionTargetState\(environment, nextPage\)/,
    "The post-commit graph check should remain observational and must not trigger a full target-style replay.",
  );
  assert.match(
    transitionEffectiveSource,
    /const shouldTweenFullDensityScalarStyle\s*=[\s\S]{0,260}id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID[\s\S]{0,260}scalarTransitionStyleChanged\(fromStyle, targetStyle\)/,
    "The transition classifier should force an MT full-density scalar tween when authored Spectrum fields change, even before scalar edge geometry is ready.",
  );
  assert.match(
    transitionEffectiveSource,
    /const shouldTweenScalarStyle\s*=[\s\S]{0,700}\(this\.layerSupportsScalarStyleTween\(id, group\)\s*\|\|\s*shouldTweenFullDensityScalarStyle\)[\s\S]{0,220}scalarTransitionStyleChanged\(fromStyle, targetStyle\)/,
    "The full-density scalar tween should use the same scalar tween path as slider/page scalar transitions.",
  );
  assert.match(
    transitionEffectiveSource,
    /this\.scalarStyleTweens\.set\(id,\s*\{[\s\S]{0,500}fromStyle,[\s\S]{0,500}toStyle: targetStyle/,
    "The tween must retain the final target style so late-loaded scalar edge overlays converge through the transition clock.",
  );
  assert.match(
    sceneManagerSource,
    /private applySettledMtCellPointsTargetStyle\(\s*pageId: string \| null,\s*\): void \{[\s\S]{0,900}UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID[\s\S]{0,900}this\.applyStyle\(\s*UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,\s*effectiveStyle\(/,
    "Suppressed settled-page reapply should still refresh only the MT full-density target style so page-load edge overlays are built.",
  );
  assert.match(
    sceneManagerSource,
    /suppressPostCommitTargetAssertion\([\s\S]{0,900}this\.applySettledMtCellPointsTargetStyle\(pageId\)/,
    "PageController post-commit suppression should call the narrow MT Cell Points target-style refresh before returning.",
  );
  assert.doesNotMatch(
    sceneManagerSource,
    /applySettledMtCellPointsTargetStyle[\s\S]{0,1200}applyEffectiveVisibilityForPage|applySettledMtCellPointsTargetStyle[\s\S]{0,1200}applyEffectiveStylesForPage/,
    "The narrow MT Cell Points refresh must not replay full effective visibility or styles.",
  );
});

test("MT Cell Points mode transition is 1.5s and slider-style", () => {
  assert.match(
    legendSource,
    /const MT_CELL_POINTS_MODE_TRANSITION_MS = 1500/,
    "Mode button transitions should run for 1.5 seconds.",
  );
  assert.match(
    legendSource,
    /easeProgress\(progress, "easeInOutSine"\)/,
    "Mode button transitions should use the soft sine easing path.",
  );
  assert.match(
    legendSource,
    /interpolatedScalarLegendStyle\(\s*fromStyle,\s*toStyle,\s*eased,\s*\)/,
    "Mode switches should reuse scalar numeric interpolation instead of snapping scalar fields.",
  );
  assert.match(
    legendSource,
    /const patch: Partial<EditableStyle> = \{\s*scalarLegendVisible: mode === "spectrum",\s*scalarInclusionMode: mode === "spectrum" \? "thresholded" : "all-valid",\s*\}/,
    "Final mode persistence should write only scalarLegendVisible and scalarInclusionMode.",
  );
  assert.doesNotMatch(
    legendSource,
    /persistMtCellPointsMode[\s\S]{0,500}scalarFocusMin|persistMtCellPointsMode[\s\S]{0,500}scalarBlendMin|persistMtCellPointsMode[\s\S]{0,500}scalarNoiseThreshold|persistMtCellPointsMode[\s\S]{0,500}scalarEdgeLineWidth/,
    "Final mode persistence must not save trim, feather, noise, or edge-line settings.",
  );
});

test("MT Cell Points local mode transitions are scoped to the effective page context", () => {
  assert.match(
    legendSource,
    /function mtCellPointsModeTransitionScopeKey\(/,
    "The MT mode animation needs a reusable scope key instead of page-specific branching.",
  );
  assert.match(
    legendSource,
    /const modeTransitionScopeKey = mtCellPointsModeTransitionScopeKey\(\{[\s\S]{0,500}pageId: page\?\.id[\s\S]{0,500}writePageId: writePage\?\.id[\s\S]{0,500}layerId[\s\S]{0,500}\}\)/,
    "The scope key should be based on the generic effective page/write target/layer context.",
  );
  assert.match(
    legendSource,
    /useLayoutEffect\(\(\) => \{[\s\S]{0,1200}modeTransitionScopeKeyRef\.current = modeTransitionScopeKey[\s\S]{0,1200}modeTransitionTokenRef\.current \+= 1[\s\S]{0,1200}window\.cancelAnimationFrame\(modeTransitionFrameRef\.current\)[\s\S]{0,1200}setModeTransitionTarget\(null\)[\s\S]{0,1200}\}, \[modeTransitionScopeKey\]\)/,
    "Changing pages or authoring targets should cancel the local RAF transition and clear the displayed mode override.",
  );
  assert.match(
    legendSource,
    /const transitionToken = modeTransitionTokenRef\.current \+ 1;\s*modeTransitionTokenRef\.current = transitionToken;/,
    "Each MT mode transition should get a token so stale animation ticks can be rejected.",
  );
  assert.match(
    legendSource,
    /if \(\s*transitionToken !== modeTransitionTokenRef\.current \|\|\s*transitionScopeKey !== modeTransitionScopeKeyRef\.current\s*\) \{[\s\S]{0,220}modeTransitionFrameRef\.current = null;[\s\S]{0,220}return;/,
    "RAF ticks from a previous page context must not apply live styles or final mode patches.",
  );
});

test("MT Cell Points Spectrum page-load preview preserves authored scalar fields", () => {
  assert.match(
    editorPreviewFieldsSource,
    /const MT_FULL_DENSITY_PREVIEW_FIELDS = \[\s*\.\.\.MT_SCALAR_WINDOW_FIELDS,/,
    "Full-density preview-environment mode should preserve the MT scalar window fields used by Spectrum pages.",
  );
  for (const field of [
    "scalarInclusionMode",
    "scalarLegendVisible",
    "scalarColorLow",
    "scalarColorMid",
    "scalarColorHigh",
    "scalarDisplayMin",
    "scalarDisplayMax",
    "scalarMidpoint",
    "scalarContrast",
    "scalarSurfaceMaskEnabled",
    "scalarSurfaceMaskDepthM",
    "scalarSurfaceMaskFeatherM",
    "opacity",
  ]) {
    assert.match(
      editorPreviewFieldsSource,
      new RegExp(`"${field}"`),
      `Full-density preview-environment mode should preserve ${field}.`,
    );
  }
  assert.doesNotMatch(
    editorPreviewFieldsSource,
    /MT_FULL_DENSITY_PREVIEW_FIELDS = \[\s*"scalarInclusionMode",\s*"scalarDistanceLightStrength"/,
    "Full-density preview fields must not preserve only inclusion mode plus ISO/distance-light fields.",
  );
  assert.doesNotMatch(
    editorPreviewFieldsSource,
    /page-id|pageIndex|fixture-title|134_page|156_page/,
    "The Spectrum load fix must not use page ids, page indexes, or fixture-title special cases.",
  );
});

test("Full Cloud suppresses edge-line overlays without changing inclusion helpers", () => {
  assert.match(
    legendSource,
    /function fullCloudScalarLegendStyle\(style: EditableStyle\): EditableStyle[\s\S]{0,700}scalarNoiseThreshold: 0,\s*scalarEdgeLineWidth: 0/,
    "Full Cloud live style should clear noise and edge-line width.",
  );
  assert.match(
    scalarPreviewSource,
    /const scalarLegendVisible = style\.scalarLegendVisible !== false;\s*const edgeLineWidth = scalarLegendVisible[\s\S]{0,280}:\s*0;/,
    "The renderer should dispose scalar edge-line overlays when the spectrum legend is hidden.",
  );
  assert.match(
    scalarPreviewSource,
    /scalarInclusionFilterActive\(/,
    "Full-density point filtering should remain guarded by scalarInclusionFilterActive.",
  );
  assert.match(
    scalarPreviewSource,
    /scalarFullDensityAllValidMode\(/,
    "All-valid full-density behavior should remain guarded by scalarFullDensityAllValidMode.",
  );
  assert.match(
    transitionSource,
    /export const SCALAR_TRANSITION_STYLE_FIELDS[\s\S]*"scalarEdgeLineWidth"[\s\S]*"scalarNoiseThreshold"/,
    "The existing full-density scalar transition field list should remain the scalar numeric path.",
  );
  assert.doesNotMatch(
    legendSource,
    /full-density-scalar|SCALAR_TRANSITION_STYLE_FIELDS|scalarInclusionFilterActive|scalarFullDensityAllValidMode/,
    "The legend click should not mutate transition runtime internals.",
  );
});

test("docs and agent directives guard the MT Cell Points mode contract", () => {
  assert.match(
    decisionsSource,
    /DEC-111 - MT Cell Points mode buttons are exclusive and slider-transitioned/,
    "Decision log should contain DEC-111.",
  );
  assert.match(
    decisionsSource,
    /local 1\.5s slider-style scalar interpolation[\s\S]*scalar edge-line width/,
    "DEC-111 should document the 1.5s transition and Full Cloud edge-line suppression.",
  );
  for (const [name, source] of [
    ["UI standards", uiStandardsSource],
    ["AGENTS.md", agentsSource],
    ["CLAUDE.md", claudeSource],
  ]) {
    assert.match(
      source,
      /MT Cell Points[\s\S]*Full Cloud[\s\S]*Spectrum/,
      `${name} should route future agents to the Full Cloud/Spectrum split.`,
    );
    assert.match(
      source,
      /no page-id|No page-id|Do not edit `projects\/\*\/pages\/\*\*`|project page/,
      `${name} should retain the no page-fixture guard.`,
    );
  }
  assert.match(
    decisionsSource,
    /stale local mode animation[\s\S]*page context/,
    "Decision docs should guard against stale local MT mode animations crossing page contexts.",
  );
  assert.match(
    decisionsSource,
    /DEC-112 - MT Cell Points Spectrum load preserves authored scalar fields/,
    "Decision log should contain DEC-112 for the preview-environment load fix.",
  );
  assert.match(
    decisionsSource,
    /DEC-114 - MT Cell Points Spectrum lines assert final target style after page navigation/,
    "Decision log should contain DEC-114 for the transition-completion target-style assertion.",
  );
  assert.match(
    decisionsSource,
    /DEC-115 - MT Cell Points Spectrum lines use scalar transition ownership/,
    "Decision log should contain DEC-115 for transition-tweened Spectrum line entry.",
  );
  assert.match(
    decisionsSource,
    /DEC-116 - MT Cell Points settled loads refresh only full-density target style/,
    "Decision log should contain DEC-116 for settled page-load line rebuilds.",
  );
  for (const [name, source] of [
    ["UI standards", uiStandardsSource],
    ["transition docs", transitionDocsSource],
    ["AGENTS.md", agentsSource],
    ["CLAUDE.md", claudeSource],
  ]) {
    assert.match(
      source,
      /preview-environment|preview environment|previewEnvironmentBase/,
      `${name} should document the preview-environment Spectrum load guard.`,
    );
    assert.match(
      source,
      /scalarInclusionFilterActive|SCALAR_TRANSITION_STYLE_FIELDS|full-density-scalar/,
      `${name} should preserve the existing scalar transition/inclusion internals.`,
    );
    assert.match(
      source,
      /target authored mode|target effective style|scalar transition ownership|transition-time scalar tween|transition-tweened/,
      `${name} should document the MT Cell Points target-mode and transition-owned scalar line guard.`,
    );
  }
});
