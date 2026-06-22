import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reviewTest } from "./reviewFlag.mjs";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

function readJson(...parts) {
  return JSON.parse(readSource(...parts));
}

function readSourceIfExists(...parts) {
  const filePath = join(repoRoot, ...parts);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

const SEISMIC_LAYER_ID = "utah-forge-phase3-seismic-browser";
const TIE_PAGE_ID = "61_psdm_mt_58_32_source_location_tie";
const PSDM_SURROGATE_PRESET_ID = "psdm-depth-surrogate-showcase";
const PSDM_TIE_PRESET_ID = "psdm-mt-58-32-source-location-tie";
const UNENHANCED_PRODUCT_ID = "gdr-1141-forge3d-ani-psdm-stack-unenh";
const ENHANCED_PRODUCT_ID = "gdr-1141-forge3d-ani-psdm-stack-enh";
const VELOCITY_PRODUCT_ID = "gdr-1015-forge3d-velo5d-float-01312018";

test("seismic presentation bar has a stored style flag and editor toggle", () => {
  const typesSource = readSource("src", "pages", "types.ts");
  const displayControlsSource = readSource(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicDisplayTuningControls.tsx",
  );
  const previewFieldsSource = readSource(
    "src",
    "projectModules",
    "utahForge",
    "editorPreviewFields.ts",
  );
  const manifest = readJson(
    "docs",
    "dev-context",
    "editor-control-manifest.json",
  );

  assert.match(
    typesSource,
    /seismicPresentationBarVisible\?: boolean/,
    "EditableStyle should include the presentation bar visibility flag",
  );
  assert.match(
    displayControlsSource,
    /data-testid="seismic-presentation-bar-visible"/,
    "seismic editor should expose a stable Presentation bar toggle",
  );
  assert.match(
    displayControlsSource,
    /seismicPresentationBarVisible: e\.target\.checked/,
    "Presentation bar toggle should write the dedicated style field",
  );
  assert.match(
    previewFieldsSource,
    /"seismicPresentationBarVisible"/,
    "Utah FORGE page-preview field map should preserve the presentation bar flag",
  );
  assert.ok(
    manifest.entries.some(
      (entry) =>
        entry.id === "seismic.display.presentation-bar" &&
        entry.sourceAnchor === 'data-testid="seismic-presentation-bar-visible"' &&
        entry.backedBy.includes("seismicPresentationBarVisible") &&
        entry.status === "active",
    ),
    "editor control manifest should register the Presentation bar toggle",
  );
});

test("seismic presentation bar model is claim-safe and uses companion velocity scale", () => {
  const modelSource = readSourceIfExists(
    "src",
    "ui",
    "seismicPresentationLegendModel.ts",
  );
  const componentSource = readSourceIfExists(
    "src",
    "ui",
    "SeismicPresentationLegendBar.tsx",
  );
  const editorChromeSource = readSource("src", "editor", "EditorChrome.tsx");
  const project = readJson("projects", "utah-forge", "project.json");
  const seismicLayer = project.layers.find((layer) => layer.id === SEISMIC_LAYER_ID);
  const products = seismicLayer?.metadata?.seismicProducts ?? [];
  const velocityProduct = products.find((product) => product.id === VELOCITY_PRODUCT_ID);
  const unenhancedProduct = products.find((product) => product.id === UNENHANCED_PRODUCT_ID);

  assert.match(
    modelSource,
    new RegExp(VELOCITY_PRODUCT_ID),
    "presentation model should explicitly use the GDR 1015 velocity companion",
  );
  assert.match(modelSource, /Velocity reference/);
  assert.match(modelSource, /2,000/);
  assert.match(modelSource, /5,000/);
  assert.match(modelSource, /m\/s/);
  assert.match(modelSource, /source-derived/);
  assert.match(modelSource, /1,800 m/);
  assert.match(modelSource, /VE/);
  assert.match(modelSource, /formatSeismicPresentationSliceReadout/);
  assert.match(modelSource, /inlineRange/);
  assert.match(modelSource, /crosslineRange/);
  assert.match(modelSource, /sampleRange/);
  assert.doesNotMatch(
    modelSource,
    new RegExp(ENHANCED_PRODUCT_ID),
    "presentation model should not use the source-gated enhanced PSDM product",
  );

  assert.match(componentSource, /export function SeismicPresentationLegendBar/);
  assert.match(componentSource, /data-testid="seismic-presentation-legend-bar"/);
  assert.match(componentSource, /data-testid="seismic-presentation-slice-axis"/);
  assert.match(componentSource, /data-testid="seismic-presentation-slice-fraction"/);
  assert.match(componentSource, /seismicSliceAxis/);
  assert.match(componentSource, /seismicSliceFraction/);
  assert.match(componentSource, /seismicPresentationBarVisible/);
  assert.match(componentSource, /seismicLegendVisible/);
  assert.match(componentSource, /resolveTopoMapSettings/);
  assert.match(
    componentSource,
    /const visible = editingEnvironment\s*\?\s*new Set\(state\.environment\.defaultVisibleLayers\)\s*:\s*page\s*\?\s*effectiveVisibility\(pageEnvironment,\s*page\)/,
    "presentation bar display should follow active page visibility outside Global Settings.",
  );

  assert.match(editorChromeSource, /SeismicPresentationLegendBar/);
  assert.match(editorChromeSource, /<SeismicPresentationLegendBar sceneHandle=\{sceneHandle\} \/>/);

  assert.deepEqual(
    velocityProduct?.valueEncoding?.displayRangeMPerS,
    [2000, 5000],
    "velocity companion product should carry the required m/s display range",
  );
  assert.deepEqual(
    [
      unenhancedProduct?.raymarchVolume?.sampleDomain?.min,
      unenhancedProduct?.raymarchVolume?.sampleDomain?.max,
    ],
    [0, 5000],
    "unenhanced PSDM product should carry a 0-5000 m depth sample domain",
  );
});

test("seismic presentation legend follows compact quick legend contract", () => {
  const componentSource = readSourceIfExists(
    "src",
    "ui",
    "SeismicPresentationLegendBar.tsx",
  );
  const editorChromeSource = readSource("src", "editor", "EditorChrome.tsx");
  const visualStandardsSource = readSource(
    "docs",
    "dev-context",
    "UI-Visual-Standards.md",
  );

  assert.match(
    componentSource,
    /compactQuickLegendPrimaryButtonBaseStyle/,
    "seismic presentation legend should use the shared compact primary pill",
  );
  assert.match(
    componentSource,
    /compactQuickLegendIconButtonBaseStyle/,
    "seismic presentation controls should use shared compact icon buttons",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-name"/,
    "seismic presentation legend should expose a compact name pill",
  );
  assert.match(
    componentSource,
    /const layerVisible = visible\.has\(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\);/,
    "seismic presentation legend should resolve the real seismic layer visibility.",
  );
  assert.match(
    componentSource,
    /const explicitPageOverride =\s*writePage\?\.visibilityOverrides\?\.\[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\] !== undefined;/,
    "seismic presentation legend should keep an explicit off override available for re-enabling.",
  );
  assert.match(
    componentSource,
    /if \(!layerVisible && !explicitPageOverride && !editingEnvironment\) return null;/,
    "seismic presentation legend should not render from presentation-bar opt-in alone.",
  );
  assert.match(
    componentSource,
    /const setLayerVisible = \(nextVisible: boolean\) => \{/,
    "seismic presentation name pill should write layer visibility.",
  );
  assert.match(
    componentSource,
    /toggleEnvDefaultVisible\(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\)/,
    "seismic presentation layer toggle should support Global Settings visibility.",
  );
  assert.match(
    componentSource,
    /setPageVisibilityOverride\(\s*writePage\.id,\s*UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,\s*nextVisible,\s*\)/,
    "seismic presentation layer toggle should write page visibility overrides.",
  );
  assert.match(
    componentSource,
    /<button[\s\S]{0,260}data-testid="seismic-presentation-legend-name"[\s\S]{0,260}aria-pressed=\{layerVisible\}/,
    "seismic presentation name pill should be the layer visibility button.",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-palette-select"/,
    "seismic presentation legend should expose the palette dropdown in the header row",
  );
  assert.doesNotMatch(
    componentSource,
    /<label[\s\S]{0,160}Palette/,
    "seismic presentation header should not render a visible Palette label",
  );
  assert.match(
    componentSource,
    /paletteSelectStyle[\s\S]*color:\s*"#101216"/,
    "seismic presentation palette dropdown should use black readable text",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-controls-toggle"/,
    "seismic presentation legend should expose a compact controls button",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-info-toggle"/,
    "seismic presentation legend should expose a compact information button",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-controls-popout"/,
    "seismic presentation controls should move into a controls popout",
  );
  assert.match(
    componentSource,
    /const amplitudeRampStyle:[\s\S]{0,180}height:\s*13/,
    "seismic amplitude color map should match the MT ramp height.",
  );
  assert.match(
    componentSource,
    /const amplitudeRampWrapStyle:[\s\S]{0,180}height:\s*28/,
    "seismic amplitude color map wrapper should match the MT slider bar height.",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-amplitude-ramp"/,
    "seismic amplitude should show its color map in the visible legend body.",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-amplitude-ticks"/,
    "seismic amplitude should show numeric tick labels under the color map.",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-bar"[\s\S]*data-testid="seismic-presentation-amplitude-ramp"[\s\S]*data-testid="seismic-presentation-amplitude-ticks"[\s\S]*<\/aside>/,
    "seismic amplitude map and numbers should render in the visible legend body.",
  );
  assert.match(
    componentSource,
    /\{layerVisible \? \(\s*<div style=\{amplitudeBodyStyle\}>[\s\S]*data-testid="seismic-presentation-amplitude-ramp"[\s\S]*\)\s*:\s*null\}/,
    "seismic amplitude body should hide when the seismic layer is off.",
  );
  assert.doesNotMatch(
    componentSource,
    /data-testid="seismic-presentation-legend-bar"[\s\S]*data-testid="seismic-presentation-slice-fraction"[\s\S]*<\/aside>/,
    "seismic slice axis buttons and slider should not render in the visible legend body.",
  );
  const controlsPopoutStart = componentSource.indexOf(
    'data-testid="seismic-presentation-legend-controls-popout"',
  );
  const infoPopoutStart = componentSource.indexOf(
    'data-testid="seismic-presentation-legend-info-popout"',
  );
  assert.ok(controlsPopoutStart >= 0 && infoPopoutStart > controlsPopoutStart);
  const controlsPopoutSource = componentSource.slice(
    controlsPopoutStart,
    infoPopoutStart,
  );
  assert.doesNotMatch(
    controlsPopoutSource,
    /Seismic Amplitude|model\.amplitudeLabel|seismic-presentation-amplitude-ramp/,
    "seismic controls popout should not duplicate the visible amplitude map or add a heading.",
  );
  assert.match(
    controlsPopoutSource,
    /data-testid="seismic-presentation-slice-axis"[\s\S]*data-testid="seismic-presentation-slice-fraction"/,
    "seismic slice axis buttons and slider should live in the controls popout.",
  );
  assert.match(
    componentSource,
    /data-testid="seismic-presentation-legend-info-popout"/,
    "seismic presentation information blocks should move into an info popout",
  );
  assert.match(
    editorChromeSource,
    /"seismic-presentation"[\s\S]{0,240}"mt-resistivity"/,
    "Utah FORGE legend stack should keep seismic presentation directly above MT resistivity",
  );
  assert.match(
    editorChromeSource,
    /<SeismicPresentationLegendBar[\s\S]{0,140}sceneHandle=\{sceneHandle\}[\s\S]{0,140}stacked[\s\S]{0,140}pageOverride=\{pageOverride\}/,
    "Utah FORGE stack should render seismic presentation as a stacked legend",
  );
  assert.match(
    editorChromeSource,
    /const seismicLayerVisible =\s*visible\.has\(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\);/,
    "Utah FORGE stack should track seismic layer visibility once.",
  );
  assert.match(
    editorChromeSource,
    /const seismicPresentationExplicitPageOverride =\s*page\.visibilityOverrides\?\.\[UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\] !== undefined;/,
    "Utah FORGE stack should keep explicitly hidden seismic presentation rows available for re-enabling.",
  );
  assert.match(
    editorChromeSource,
    /seismicPresentationVisible =\s*seismicLegendEnabled &&\s*\(seismicLayerVisible \|\| seismicPresentationExplicitPageOverride \|\| globalSettingsAuthoring\) &&\s*seismicPresentationOptIn;/,
    "Utah FORGE stack should not let presentation-bar opt-in alone force the compact seismic legend on.",
  );
  assert.doesNotMatch(
    editorChromeSource,
    /visible\.has\(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID\)\s*\|\|\s*seismicStyle\.seismicPresentationBarVisible === true/,
    "Utah FORGE stack should not preserve the stale presentation-bar opt-in visibility rule.",
  );
  assert.match(
    editorChromeSource,
    /seismic:\s*seismicPresentationVisible\s*\?\s*false\s*:\s*seismicVisible/,
    "Utah FORGE stack should suppress the legacy seismic amplitude legend when the compact seismic presentation legend is visible.",
  );
  assert.match(
    visualStandardsSource,
    /Seismic amplitude/,
    "UI visual standards should document the seismic amplitude quick legend contract",
  );
});

reviewTest("DECK-REVIEW", "PSDM surrogate presets and 58-32 page opt in to the presentation bar", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const recipes = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_demo_recipes.json",
  );
  const environment = readJson("projects", "utah-forge", "environment.json");
  const tiePage = readJson(
    "projects",
    "utah-forge",
    "pages",
    `${TIE_PAGE_ID}.json`,
  );
  const seismicLayer = project.layers.find((layer) => layer.id === SEISMIC_LAYER_ID);
  const presetCollections = [
    recipes.audiencePresets ?? [],
    recipes.capabilityPresets ?? [],
    seismicLayer?.metadata?.seismicAudiencePresets ?? [],
    seismicLayer?.metadata?.seismicCapabilityPresets ?? [],
  ];

  for (const presetId of [PSDM_SURROGATE_PRESET_ID, PSDM_TIE_PRESET_ID]) {
    for (const presets of presetCollections) {
      const preset = presets.find((candidate) => candidate.id === presetId);
      assert.ok(preset, `${presetId} should exist in generated and project metadata`);
      assert.equal(
        preset.presentationBarVisible,
        true,
        `${presetId} should explicitly enable the presentation bar`,
      );
      assert.equal(preset.productId, UNENHANCED_PRODUCT_ID);
      assert.equal(
        (preset.visibleProductIds ?? []).includes(ENHANCED_PRODUCT_ID),
        false,
        `${presetId} should not render the source-gated enhanced PSDM`,
      );
    }
  }

  const globalSeismicStyle =
    environment.layerStyles?.[SEISMIC_LAYER_ID] ?? {};
  assert.equal(
    globalSeismicStyle.seismicPresentationBarVisible,
    true,
    "global surrogate demo default should show the presentation bar",
  );

  const tieSeismicStyle = tiePage.layerOverrides?.[SEISMIC_LAYER_ID] ?? {};
  assert.equal(
    tieSeismicStyle.seismicPresentationBarVisible,
    true,
    "PSDM + MT + 58-32 page should show the presentation bar",
  );
  assert.equal(tieSeismicStyle.seismicProductId, UNENHANCED_PRODUCT_ID);
  assert.equal(tieSeismicStyle.seismicProductVisibility?.[ENHANCED_PRODUCT_ID], undefined);
});
