import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

function readSource(path) {
  return readFileSync(path, "utf8");
}

const legendSource = readSource("src/ui/SceneSectionLegend.tsx");
const sectionIsoLegendSource = readSource("src/ui/SectionIsoLegend.tsx");
const mtBoundaryLegendSource = readSource("src/ui/MtSurfaceBoundaryLegend.tsx");
const editorChromeSource = readSource("src/editor/EditorChrome.tsx");
const pageControllerSource = readSource("src/pages/PageController.tsx");
const pageTransitionUiPolicySource = readSource(
  "src/pages/pageTransitionUiPolicy.ts",
);
const legendStylesSource = readSource("src/ui/legendStyles.ts");
const uiVisualStandardsSource = readSource(
  "docs/dev-context/UI-Visual-Standards.md",
);
const decisionsSource = readSource("docs/03-decisions.md");
const claudeSource = readSource("CLAUDE.md");
const agentsSource = readSource("AGENTS.md");
const editorSource = readSource(
  "src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx",
);
const controllerSource = readSource(
  "src/scene/section/sceneSectionController.ts",
);
const typesSource = readSource("src/pages/types.ts");

test("compact quick legend geometry is shared and guarded", () => {
  assert.match(
    legendStylesSource,
    /export const QUICK_LEGEND_INACTIVE_BACKGROUND\s*=\s*"rgba\(128, 134, 145, 0\.38\)"/,
    "Shared quick legend inactive background should be exported from legendStyles.",
  );
  assert.match(
    legendStylesSource,
    /export function colorWithAlpha\(/,
    "Shared quick legend color alpha helper should be exported from legendStyles.",
  );
  assert.match(
    legendStylesSource,
    /export const compactQuickLegendRowStyle[\s\S]*gap:\s*6/,
    "Shared quick legend row style should define the compact horizontal gap.",
  );
  assert.match(
    legendStylesSource,
    /export const compactQuickLegendStackStyle[\s\S]*gap:\s*7/,
    "Shared quick legend stack style should define the compact vertical gap.",
  );
  assert.match(
    legendStylesSource,
    /export const compactQuickLegendPrimaryButtonBaseStyle[\s\S]*width:\s*108[\s\S]*height:\s*28[\s\S]*justifyContent:\s*"center"[\s\S]*fontSize:\s*11/,
    "Shared quick legend primary pills should lock centered 108x28 geometry.",
  );
  assert.match(
    legendStylesSource,
    /export const compactQuickLegendIconButtonBaseStyle[\s\S]*width:\s*24[\s\S]*height:\s*24[\s\S]*justifyContent:\s*"center"/,
    "Shared quick legend icon buttons should lock centered 24px geometry.",
  );
  for (const [name, source] of [
    ["Scene Section", legendSource],
    ["Section ISO", sectionIsoLegendSource],
    ["MT threshold", mtBoundaryLegendSource],
  ]) {
    assert.match(
      source,
      /compactQuickLegendPrimaryButtonBaseStyle/,
      `${name} quick legend should use the shared primary pill base.`,
    );
  }
  assert.match(
    legendSource,
    /compactQuickLegendIconButtonBaseStyle/,
    "Scene Section quick legend should use the shared icon circle base.",
  );
  assert.match(
    sectionIsoLegendSource,
    /compactQuickLegendIconButtonBaseStyle/,
    "Section ISO quick legend should use the shared icon circle base.",
  );
  assert.match(
    mtBoundaryLegendSource,
    /QUICK_LEGEND_INACTIVE_BACKGROUND/,
    "MT threshold quick legend should use the shared inactive gray.",
  );
  assert.doesNotMatch(
    `${legendSource}\n${mtBoundaryLegendSource}`,
    /function colorWithAlpha\(/,
    "Scene Section and MT quick legends should use the shared color alpha helper.",
  );
  assert.match(
    uiVisualStandardsSource,
    /Compact quick legend geometry/,
    "UI standards should name the shared compact quick legend geometry rule.",
  );
  assert.match(
    decisionsSource,
    /DEC-107 - Compact quick legends use shared geometry/,
    "Decision log should lock the shared compact quick legend geometry rule.",
  );
  for (const [name, source] of [
    ["CLAUDE.md", claudeSource],
    ["AGENTS.md", agentsSource],
  ]) {
    assert.match(
      source,
      /Before changing viewport quick legends[\s\S]*compact quick legend helpers/,
      `${name} should direct agents to the shared quick legend helpers.`,
    );
  }
});

test("section legend exposes per-axis controls and Section Options popout", () => {
  const firstReturnIndex = legendSource.indexOf("return null");
  const popoverEffectIndex = legendSource.indexOf("useEffect(() =>");
  assert.ok(
    popoverEffectIndex >= 0 &&
      (firstReturnIndex < 0 || popoverEffectIndex < firstReturnIndex),
    "SceneSectionLegend hooks should run before conditional null returns",
  );
  assert.match(
    legendSource,
    /const SCENE_SECTION_AXES = \["z", "x", "y"\] as const;/,
    "Quick legend should put Z Section on top, followed by X and Y.",
  );
  assert.doesNotMatch(
    legendSource,
    /iconSpacerStyle|style=\{iconSpacerStyle\}/,
    "Z section should not reserve a blank ground-trace spacer; its Control frame button should fill the gap.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-show/,
    "Quick legend should expose a per-axis Show button.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-flip/,
    "Quick legend should expose a per-axis Flip button.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-section-options/,
    "Quick legend should expose a per-axis Section Options popout button.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-ground-trace-visible/,
    "Quick legend should expose Ground trace for supported axes.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-axes-visible/,
    "Quick legend should expose Scale axes per axis.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-controls-visible/,
    "Quick legend should expose Control frame per axis.",
  );
  assert.match(
    legendSource,
    /aria-pressed=\{model\.shown\}/,
    "Quick legend axis buttons should expose pressed state.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-show[\s\S]*scene-section-legend-\$\{axis\}-section-options[\s\S]*scene-section-legend-\$\{axis\}-flip[\s\S]*scene-section-legend-\$\{axis\}-axes-visible[\s\S]*scene-section-legend-\$\{axis\}-ground-trace-visible[\s\S]*scene-section-legend-\$\{axis\}-controls-visible/,
    "X/Y quick legend rows should order controls as Show, Section Options, Flip, Scale axes, Ground trace, Control frame.",
  );
  assert.match(
    legendSource,
    /<LegendToggleIcon kind="controls" \/>[\s\S]{0,120}<\/button>/,
    "Quick legend should render icon-only Section Options controls.",
  );
  assert.match(
    legendSource,
    /createPortal/,
    "Quick legend should use the same portal popout pattern as Section ISO.",
  );
  assert.match(
    legendSource,
    /data-testid="scene-section-options-popout"/,
    "Quick legend should render a Section Options popout.",
  );
  assert.match(
    legendSource,
    /<SectionGraphOptionsControls/,
    "Section Options popout should reuse the shared seismic graph controls.",
  );
  assert.match(
    legendSource,
    /scene-section-face-channel-controls/,
    "Section Options popout should expose section-face display channel controls.",
  );
  for (const channel of ["seismic", "volume", "isobars", "mtScalar"]) {
    assert.match(
      legendSource,
      new RegExp(`scene-section-face-channel-\\$\\{channel\\.key\\}`),
      `Section face channel ${channel} should use compact generated controls.`,
    );
  }
  assert.match(
    typesSource,
    /export interface SceneSectionFaceChannelState[\s\S]*seismic\?: boolean[\s\S]*volume\?: boolean[\s\S]*isobars\?: boolean[\s\S]*mtScalar\?: boolean/,
    "Scene section face channels should be typed as reusable app-level state.",
  );
  assert.match(
    legendSource,
    /commitRuntimeLayerStyle\(SCENE_SECTION_LAYER_ID[\s\S]*sceneSectionFaceChannels/,
    "Face channel toggles should apply scene-section state through live runtime style.",
  );
  assert.doesNotMatch(
    legendSource,
    /setPageLayerOverride\(writePage\.id,\s*SCENE_SECTION_LAYER_ID[\s\S]*sceneSectionFaceChannels/,
    "Face channel toggles should not persist computed display state into page fixtures.",
  );
  assert.match(
    legendSource,
    /<LegendToggleIcon kind="flip" \/>[\s\S]{0,120}<\/button>/,
    "Quick legend should render icon-only Flip controls.",
  );
  assert.match(
    legendSource,
    /<LegendToggleIcon kind="controlFrame" \/>[\s\S]{0,120}<\/button>/,
    "Quick legend should render icon-only Control frame controls.",
  );
  assert.match(
    legendSource,
    /controlsVisible: !model\.controlsVisible/,
    "Control frame quick toggle should update per-axis controlsVisible.",
  );
  assert.match(
    legendSource,
    /function activeFrameIdForAxis[\s\S]*style\.sceneSectionActiveFrameId[\s\S]*builtInFrameId\(axis\)/,
    "Quick legend axis actions should preserve active source/custom frame ids before falling back to built-in axes.",
  );
  assert.match(
    legendSource,
    /function builtInAxisForFrameId[\s\S]*\^axis:\(\[xyz\]\)\$/,
    "Quick legend should be able to identify built-in frame ids by axis.",
  );
  assert.match(
    legendSource,
    /activeBuiltInAxis[\s\S]*activeBuiltInAxis === axis \? activeFrameId : builtInFrameId\(axis\)/,
    "Quick legend must not preserve a stale built-in frame id from another axis.",
  );
  assert.match(
    legendSource,
    /function seismicSourceTargetPatch[\s\S]*sceneSectionTargetLayerIds[\s\S]*SEISMIC_LAYER_ID[\s\S]*sceneSectionTargetProductIds/,
    "Quick legend axis actions should carry seismic source targets when the face display is seismic.",
  );
  assert.match(
    legendSource,
    /seismicSourceTargetPatch\([\s\S]*style,[\s\S]*seismicStyle,[\s\S]*seismicLayer,[\s\S]*activeFaceChannels/,
    "Quick legend axis toggles should apply the source-aware section target patch.",
  );
  assert.match(
    legendSource,
    /M8 8 4 12l4 4M4 12h16M16 8l4 4-4 4/,
    "Quick legend Flip icon should be centered inside the 24px viewBox.",
  );
  assert.doesNotMatch(
    legendSource,
    /M8 6 4 10l4 4M4 10h16M16 6l4 4-4 4/,
    "Quick legend Flip icon should not use the old high-biased y=10 path.",
  );
  assert.doesNotMatch(
    legendSource,
    /<span>Flip<\/span>|<span>Controls<\/span>|<span>Ground trace<\/span>|<span>Scale axes<\/span>|<span>Section Options<\/span>/,
    "Quick legend action controls should not render crowding text labels.",
  );
  assert.doesNotMatch(
    legendSource,
    /<h2|Section Planes/,
    "Quick legend should not render a heading above compact rows.",
  );
  assert.match(
    legendSource,
    /QUICK_LEGEND_INACTIVE_BACKGROUND/,
    "Unavailable quick legend icon buttons should use the shared inactive gray.",
  );
  assert.match(
    legendSource,
    /function iconButtonStyle\(\s*color: string,\s*available: boolean/,
    "Quick legend icon button color should be driven by section availability.",
  );
  assert.match(
    legendSource,
    /const rowActive = model\.shown;/,
    "Quick legend rows should derive all button coloring from the section's on/off state.",
  );
  assert.match(
    legendSource,
    /style=\{axisButtonStyle\(axisColor, rowActive\)\}/,
    "Quick legend section show buttons should turn gray when the section is off.",
  );
  assert.match(
    legendSource,
    /style=\{iconButtonStyle\(axisColor, rowActive && Boolean\(seismicLayer\)\)\}/,
    "Quick legend Section Options buttons should also turn gray when the section is off.",
  );
  assert.match(
    legendSource,
    /style=\{iconButtonStyle\(axisColor, rowActive\)\}/,
    "Quick legend child action buttons should use full axis color only when their section is on.",
  );
  assert.doesNotMatch(
    legendSource,
    /disabled\s*\?\s*0\.24\s*:\s*active\s*\?\s*1\s*:\s*0\.36|border:\s*"1px solid transparent"/,
    "Quick legend action buttons should not dim active section rows based on sub-toggle state.",
  );
  assert.match(
    legendSource,
    /axis\s*!==\s*"z"[\s\S]{0,900}Ground trace/,
    "Z section rows should not render a ground-trace toggle.",
  );
  assert.doesNotMatch(
    legendSource,
    /P Controle|scene-section-legend-helper-visible|scene-section-legend-\$\{axis\}-controls(?!-visible)/,
    "Quick legend should not keep the global P Controle helper toggle.",
  );
});

test("Utah FORGE legend stack keeps ISO rows above scene sections and hides vertical motion for entering/exiting containers", () => {
  assert.match(
    editorChromeSource,
    /LEGEND_PANEL_WIDTH_PX/,
    "Legend transition slide distance should know the full legend panel width.",
  );
  assert.match(
    editorChromeSource,
    /const UTAH_FORGE_NON_RESISTIVITY_LEGENDS:[\s\S]{0,80}\[\s*"mt-boundaries"/,
    "MT threshold surface buttons should be the top-most Utah FORGE quick legend when visible.",
  );
  assert.match(
    editorChromeSource,
    /const UTAH_FORGE_LEGEND_SLIDE_PX =\s*LEGEND_PANEL_WIDTH_PX \+ LEGEND_PAGE_EDGE_MARGIN_PX;/,
    "Entering and exiting legend containers should slide fully off-canvas before row resize can be visible.",
  );
  assert.match(
    pageTransitionUiPolicySource,
    /export const UTAH_FORGE_LEGEND_EXIT_END = 0\.34;/,
    "Legend transition exit timing should be centralized with page transition UI policy.",
  );
  assert.match(
    pageTransitionUiPolicySource,
    /export const UTAH_FORGE_LEGEND_LAYOUT_END = 0\.68;/,
    "Legend transition layout timing should be centralized with page transition UI policy.",
  );
  assert.match(
    editorChromeSource,
    /from "\.\.\/pages\/pageTransitionUiPolicy"/,
    "EditorChrome should import shared legend timing constants instead of duplicating them.",
  );
  assert.match(
    pageControllerSource,
    /from "\.\/pageTransitionUiPolicy"/,
    "PageController transition debug state should import the same legend timing constants.",
  );
  assert.doesNotMatch(
    editorChromeSource,
    /const UTAH_FORGE_LEGEND_EXIT_END = 0\.34|const UTAH_FORGE_LEGEND_LAYOUT_END = 0\.68/,
    "EditorChrome should not duplicate legend timing constants.",
  );
  assert.doesNotMatch(
    pageControllerSource,
    /const UTAH_FORGE_LEGEND_EXIT_END = 0\.34|const UTAH_FORGE_LEGEND_LAYOUT_END = 0\.68/,
    "PageController should not duplicate legend timing constants.",
  );
  assert.match(
    editorChromeSource,
    /function useLocalLegendPresenceTransition/,
    "Legend stack should animate live visibility toggles outside page transitions.",
  );
  assert.match(
    editorChromeSource,
    /window\.requestAnimationFrame/,
    "Live legend presence transitions should use animation frames.",
  );
  assert.match(
    editorChromeSource,
    /previousPresenceRef/,
    "Live legend presence transitions should compare previous and next presence.",
  );
  assert.match(
    editorChromeSource,
    /targetPresenceRef/,
    "Live legend presence transitions should key off stable presence signatures without cancelling on rerenders.",
  );
  assert.match(
    editorChromeSource,
    /useLayoutEffect\(\(\) => \{\s*const nextTargetPresence = targetPresenceRef\.current;/,
    "Live legend presence transitions should be established before paint to avoid one-frame disappearance.",
  );
  assert.match(
    editorChromeSource,
    /interactive:\s*pageTransition\s*\?\s*progress > PAGE_BOUND_UI_SWITCH_THRESHOLD\s*:\s*true/,
    "Stable legend rows should remain interactive during local visibility animations.",
  );
  assert.match(
    editorChromeSource,
    /transitionTargetPresence \?\? currentPresence/,
    "Local presence animation should reset to the target page presence while page transitions are active.",
  );
  assert.doesNotMatch(
    editorChromeSource,
    /gridTemplateRows:\s*`\$\{Math\.max\(0\.001, item\.layoutWeight\)\.toFixed\(3\)\}fr`/,
    "Legend row collapse should not use fr units inside auto-height grid rows.",
  );
  assert.match(
    editorChromeSource,
    /heightPx: number \| null/,
    "Legend rows should carry measured pixel heights for stable collapse.",
  );
  assert.match(
    editorChromeSource,
    /ResizeObserver|getBoundingClientRect\(\)\.height/,
    "Legend rows should measure rendered content height before pixel-based collapse.",
  );
  assert.match(
    editorChromeSource,
    /height:\s*resolvedHeightPx !== null\s*\?\s*`\$\{Math\.max\(0, resolvedHeightPx \* item\.layoutWeight\)\.toFixed\(1\)\}px`\s*:\s*undefined/,
    "Legend row height should collapse in measured pixels.",
  );
  assert.match(
    editorChromeSource,
    /overflow:\s*"visible"[\s\S]{0,220}clipPath:\s*rowClipPath/,
    "Legend rows should not horizontally clip panels while they slide left; clipping should come from expanded row clip paths.",
  );
  assert.match(
    editorChromeSource,
    /inset\(0 -\$\{UTAH_FORGE_LEGEND_SLIDE_PX\}px 0 -\$\{UTAH_FORGE_LEGEND_SLIDE_PX\}px\)/,
    "Legend row clip paths should expand horizontally enough for off-screen slide motion.",
  );
  assert.match(
    editorChromeSource,
    /stableLegendPageOverride/,
    "Same-id stable legend rows should not switch to target content at transition start.",
  );
  assert.match(
    editorChromeSource,
    /const UTAH_FORGE_NON_RESISTIVITY_LEGENDS:[\s\S]{0,180}"section-iso"[\s\S]{0,80}"scene-section"/,
    "Section ISO quick legend should stack above Scene Section quick legend.",
  );
  assert.match(
    sectionIsoLegendSource,
    /useState<ScalarSectionIsoTarget\[\]>\(\(\) => sectionIsoTargetsSnapshot\(sceneHandle\.manager\)\)/,
    "Section ISO legend should synchronously initialize from current runtime targets to avoid an empty first render.",
  );
  assert.match(
    sectionIsoLegendSource,
    /function sectionIsoTargetsSnapshot/,
    "Section ISO target lookup should be centralized for initial and interval refreshes.",
  );
});

test("editor section frame header uses Show and Controls as separate fields", () => {
  assert.match(
    editorSource,
    /scene-section-plane-\$\{controlKey\}-enabled[\s\S]{0,900}<span>Show<\/span>/,
    "Editor frame header should label the plane enabled checkbox as Show.",
  );
  assert.match(
    editorSource,
    /scene-section-plane-\$\{controlKey\}-controls[\s\S]{0,900}<span>Controls<\/span>/,
    "Editor frame header should write per-axis Controls.",
  );
  assert.doesNotMatch(
    editorSource,
    /data-testid="scene-section-helper-visible"|<span style=\{nestedFieldLabelStyle\}>Gizmo<\/span>/,
    "The global Gizmo checkbox should be removed.",
  );
});

test("built-in section frame state treats modern per-axis fields as authoritative", () => {
  assert.match(
    legendSource,
    /const nextPlane = \{\s*\.\.\.\(entry\?\.plane \?\? \{\}\),\s*\.\.\.\(style\.sceneSectionPlanes\?\.\[entryAxis\] \?\? \{\}\),\s*\.\.\.\(entryAxis === axis \? planePatch : \{\}\),\s*\};/,
    "Quick legend frame entries should let sceneSectionPlanes override stale built-in frame plane defaults.",
  );
  assert.match(
    legendSource,
    /const nextFrame = \{\s*\.\.\.\(entry\?\.frame \?\? \{\}\),\s*\.\.\.\(style\.sceneSectionFrameByAxis\?\.\[entryAxis\] \?\? \{\}\),\s*\.\.\.\(entryAxis === axis \? framePatch : \{\}\),\s*\};/,
    "Quick legend frame entries should let sceneSectionFrameByAxis override stale built-in frame defaults.",
  );
  assert.match(
    legendSource,
    /const plane = \{\s*\.\.\.\(entry\?\.plane \?\? \{\}\),\s*\.\.\.\(style\.sceneSectionPlanes\?\.\[axis\] \?\? \{\}\),\s*\};/,
    "Quick legend row state should read modern per-axis plane fields over stale built-in frame entries.",
  );
  assert.match(
    legendSource,
    /const frame = \{\s*\.\.\.\(entry\?\.frame \?\? \{\}\),\s*\.\.\.\(style\.sceneSectionFrameByAxis\?\.\[axis\] \?\? \{\}\),\s*\};/,
    "Quick legend row state should read modern per-axis frame fields over stale built-in frame entries.",
  );
  assert.match(
    editorSource,
    /const frame = \{\s*\.\.\.\(entry\?\.frame \?\? \{\}\),\s*\.\.\.\(frameByAxis\[axis\] \?\? \{\}\),\s*\};/,
    "Editor section frame rows should let sceneSectionFrameByAxis override stale built-in frame entries.",
  );
  assert.match(
    editorSource,
    /plane: \{\s*\.\.\.\(entry\?\.plane \?\? \{\}\),\s*\.\.\.\(planes\[axis\] \?\? \{\}\),\s*\},/,
    "Editor section frame rows should let sceneSectionPlanes override stale built-in frame entries.",
  );
});

test("section face channel toggles do not overwrite seismic render mode", () => {
  const setFaceChannelMatch = legendSource.match(
    /const setFaceChannel = \(channel: FaceChannelKey, active: boolean\) => \{[\s\S]*?\n  \};/,
  );
  assert.ok(setFaceChannelMatch, "Scene section legend should define setFaceChannel.");
  assert.match(
    setFaceChannelMatch[0],
    /sceneSectionFaceChannels:\s*nextChannels/,
    "Face channel toggles should still update scene-section face channel state.",
  );
  assert.match(
    setFaceChannelMatch[0],
    /seismicSliceThroughVolume:\s*nextChannels\.seismic/,
    "Face channel toggles may still update volume slicing intent.",
  );
  assert.doesNotMatch(
    setFaceChannelMatch[0],
    /seismicRenderMode/,
    "Face channel toggles must not switch the seismic renderer between slice and raymarch.",
  );
});

test("section ISO legend uses white primary rows with icon sub-controls", () => {
  assert.match(
    sectionIsoLegendSource,
    /ISO_BUTTON_ACTIVE_BACKGROUND\s*=\s*"#ffffff"/,
    "Section ISO quick legend should use white active buttons.",
  );
  assert.match(
    sectionIsoLegendSource,
    /ISO_BUTTON_INACTIVE_BACKGROUND\s*=\s*QUICK_LEGEND_INACTIVE_BACKGROUND/,
    "Inactive Section ISO parent buttons should use the shared gray and transparent state.",
  );
  assert.match(
    sectionIsoLegendSource,
    /section-iso-show-volume[\s\S]*section-iso-volume-controls[\s\S]*section-iso-remove-empty[\s\S]*section-iso-section-toggle[\s\S]*section-iso-configure[\s\S]*section-iso-lines-quick[\s\S]*section-iso-bands-quick/,
    "Section ISO quick legend should order Volume row first, then Section row.",
  );
  assert.match(
    sectionIsoLegendSource,
    /<IsoLegendIcon kind="volumeControls" \/>[\s\S]{0,120}<\/button>/,
    "Volume controls should render as an icon-only circle.",
  );
  assert.match(
    sectionIsoLegendSource,
    /<IsoLegendIcon kind="removeEmpty" \/>[\s\S]{0,120}<\/button>/,
    "Remove empty should render as an icon-only circle.",
  );
  assert.match(
    sectionIsoLegendSource,
    /<IsoLegendIcon kind="sectionControls" \/>[\s\S]{0,120}<\/button>/,
    "Section controls should render as an icon-only circle.",
  );
  assert.match(
    sectionIsoLegendSource,
    /kind === "sectionControls"[\s\S]{0,500}M5 7h14M5 12h14M5 17h14/,
    "Section controls should use the same sliders icon language as other controls.",
  );
  assert.doesNotMatch(
    sectionIsoLegendSource,
    /kind === "sectionControls"[\s\S]{0,500}M6 6h12v12H6z/,
    "Section controls should not use the old document/list icon.",
  );
  assert.match(
    sectionIsoLegendSource,
    /<IsoLegendIcon kind="lines" \/>[\s\S]{0,120}<\/button>/,
    "ISO Lines should render as an icon-only circle.",
  );
  assert.match(
    sectionIsoLegendSource,
    /<IsoLegendIcon kind="bands" \/>[\s\S]{0,120}<\/button>/,
    "ISO Bands should render as an icon-only circle.",
  );
  assert.match(
    sectionIsoLegendSource,
    /scalarVolumeMaskVisible/,
    "Remove empty should toggle the scalar volume mask field.",
  );
  assert.match(
    sectionIsoLegendSource,
    /function availabilityIconButtonStyle\(\{[\s\S]*available[\s\S]*disabled/,
    "Section ISO controls opener buttons should use an availability-specific style helper.",
  );
  assert.match(
    sectionIsoLegendSource,
    /function stateIconButtonStyle\(\{[\s\S]*active[\s\S]*parentActive[\s\S]*disabled/,
    "Section ISO state toggles should use a separate active-state style helper.",
  );
  assert.match(
    sectionIsoLegendSource,
    /aria-expanded=\{popoverOpen\}[\s\S]{0,180}data-testid="section-iso-volume-controls"[\s\S]{0,600}style=\{availabilityIconButtonStyle\(\{[\s\S]{0,180}available: supportsVolumeToggle && showVolume/,
    "ISO Volume controls should render full active color when ISO Volume is on, independent from popout-open state.",
  );
  assert.match(
    sectionIsoLegendSource,
    /aria-pressed=\{supportsVolumeToggle && showVolume && maskVisible\}[\s\S]{0,180}data-testid="section-iso-remove-empty"/,
    "Remove empty pressed state should be off when ISO Volume is off.",
  );
  assert.match(
    sectionIsoLegendSource,
    /section-iso-remove-empty[\s\S]{0,650}style=\{stateIconButtonStyle\(\{[\s\S]{0,240}active: supportsVolumeToggle && showVolume && maskVisible/,
    "Remove empty should only render active when ISO Volume is on.",
  );
  assert.match(
    sectionIsoLegendSource,
    /aria-expanded=\{popoverOpen\}[\s\S]{0,180}data-testid="section-iso-configure"[\s\S]{0,600}style=\{availabilityIconButtonStyle\(\{[\s\S]{0,180}available: enabled/,
    "ISO Section controls should render full active color when ISO Section is on, independent from popout-open state.",
  );
  assert.doesNotMatch(
    sectionIsoLegendSource,
    /section-iso-configure[\s\S]{0,650}active: popoverOpen|section-iso-volume-controls[\s\S]{0,650}active: supportsVolumeToggle && showVolume && popoverOpen/,
    "Controls opener buttons should not key active color to popout-open state.",
  );
  assert.match(
    uiVisualStandardsSource,
    /Controls opener buttons use row availability, not popout-open state/,
    "UI standards should lock the Section ISO controls-opener availability rule.",
  );
  assert.match(
    decisionsSource,
    /DEC-106 - Section ISO quick legend separates availability from state/,
    "Decision log should capture the durable Section ISO quick legend state model.",
  );
  assert.doesNotMatch(
    sectionIsoLegendSource,
    />ISO Lines<|>ISO Bands<|>ISO Options<|<h2[\s\S]{0,120}Section ISO|ISO overlay|Show volume/,
    "Section ISO quick legend should not render old text sub-buttons or checkbox labels.",
  );
});

test("MT threshold boundary legend uses compact MT buttons", () => {
  assert.match(
    mtBoundaryLegendSource,
    /boundaryLegendLabel\(label: string\)[\s\S]*MT /,
    "MT threshold boundary legend should keep a compact MT prefix.",
  );
  assert.match(
    mtBoundaryLegendSource,
    /data-testid=\{`mt-boundary-legend-\$\{boundary\.id\}`\}/,
    "MT threshold boundary legend should expose stable button test ids.",
  );
  assert.match(
    mtBoundaryLegendSource,
    /boundaryButtonBaseStyle[\s\S]*compactQuickLegendPrimaryButtonBaseStyle/,
    "MT threshold boundary buttons should inherit the shared centered primary pill geometry.",
  );
  assert.doesNotMatch(
    mtBoundaryLegendSource,
    /justifyContent:\s*"flex-start"/,
    "MT threshold boundary buttons should not left-align their labels.",
  );
  assert.doesNotMatch(
    mtBoundaryLegendSource,
    /fontSize:\s*10/,
    "MT threshold boundary buttons should not keep smaller local primary font sizing.",
  );
  assert.doesNotMatch(
    mtBoundaryLegendSource,
    /MT Bnd|\d+\s+Ohm-m|<h2[\s\S]{0,160}MT Threshold Boundaries|legendCheckboxStyle|type="checkbox"/,
    "MT threshold boundary legend should not render Bnd, number-unit gaps, the old heading, or checkbox rows.",
  );
});

test("scene section controlsVisible gates helpers without using legendVisible", () => {
  assert.match(
    typesSource,
    /controlsVisible\?: boolean/,
    "SceneSectionFrameState should carry per-axis Controls visibility.",
  );
  assert.match(
    controllerSource,
    /controlsVisible/,
    "Runtime helper visibility should read controlsVisible.",
  );
  assert.doesNotMatch(
    controllerSource,
    /frameHelperVisible\s*=\s*frame\?\.legendVisible/,
    "Runtime helpers should not be gated by the stale legendVisible field.",
  );
});
