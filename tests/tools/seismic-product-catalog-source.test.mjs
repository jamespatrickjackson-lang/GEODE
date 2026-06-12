import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readJson(...segments) {
  return JSON.parse(readFileSync(join(...segments), "utf8"));
}

function assetFilePath(assetPath) {
  return String(assetPath).split("?")[0];
}

const seismicManifestPath = [
  "projects",
  "utah-forge",
  "data",
  "geosee_processed",
  "utah_forge_phase_3",
  "seismic_analysis",
  "browser",
  "seismic_manifest.json",
];

const seismicInventoryPath = [
  "projects",
  "utah-forge",
  "data",
  "geosee_processed",
  "utah_forge_phase_3",
  "seismic_analysis",
  "inventory",
  "seismic_source_inventory.json",
];

const seismicDemoRecipesPath = [
  "projects",
  "utah-forge",
  "data",
  "geosee_processed",
  "utah_forge_phase_3",
  "seismic_analysis",
  "browser",
  "seismic_demo_recipes.json",
];

const requiredLineProductIds = {
  "301": [
    "gdr-1015-forge2d-301-migr-depth",
    "gdr-1015-forge2d-301-stack-01312018",
    "gdr-1141-line-301-pdm-enh",
    "gdr-1141-line-301-psdm-unenh",
    "gdr-1141-line-301-psdm-interval-velocity",
    "gdr-1141-line-301-pstm-stack-enh",
    "gdr-1141-line-301-pstm-stack-unenh",
    "gdr-1141-line-301-unmigrated-stack",
  ],
  "302": [
    "gdr-1015-forge2d-302-stack",
    "gdr-1141-line-302-psdm-enh",
    "gdr-1141-line-302-psdm-unenh",
    "gdr-1141-line-302-psdm-interval-velocity",
    "gdr-1141-line-302-pstm-stack-enh",
    "gdr-1141-line-302-pstm-stack-unenh",
    "gdr-1141-line-302-unmigrated-stack",
  ],
  L11: [
    "gdr-1141-line-l11-psdm-enh",
    "gdr-1141-line-l11-psdm-enh-meters",
    "gdr-1141-line-l11-psdm-unenh",
    "gdr-1141-line-l11-psdm-interval-velocity",
    "gdr-1141-line-l11-pstm-enh",
    "gdr-1141-line-l11-pstm-unenh",
    "gdr-1141-line-l11-unmigrated-time-stack",
  ],
  L5: [
    "gdr-1141-line-l5-psdm-enh",
    "gdr-1141-line-l5-psdm-enh-meters",
    "gdr-1141-line-l5-psdm-unenh",
    "gdr-1141-line-l5-psdm-unenh-meters",
    "gdr-1141-line-l5-psdm-interval-velocity",
    "gdr-1141-line-l5-pstm-enh",
    "gdr-1141-line-l5-pstm-unenh",
    "gdr-1141-line-l5-unmigrated-time-stack",
  ],
};

const expectedCanonicalLabels = {
  "gdr-1015-forge2d-301-migr-depth": "2D Line 301 migrated depth section",
  "gdr-1141-line-301-pdm-enh": "2D Line 301 PSDM depth section (enhanced)",
  "gdr-1141-line-l11-psdm-enh": "2D Line L11 PSDM depth section (enhanced)",
  "gdr-1141-line-l5-unmigrated-time-stack": "2D Line L5 unmigrated time stack",
};

const expectedProcessingStages = new Set([
  "migrated-depth-section",
  "psdm-depth-section",
  "pstm-time-stack",
  "unmigrated-time-stack",
  "time-stack",
  "psdm-interval-velocity",
]);

function allRequiredProductIds() {
  return Object.values(requiredLineProductIds).flat();
}

function readText(...segments) {
  return readFileSync(join(...segments), "utf8");
}

function requiredProductsById(manifest) {
  return new Map(
    manifest.products
      .filter((product) => allRequiredProductIds().includes(product.id))
      .map((product) => [product.id, product]),
  );
}

function sourceSlice(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `source should include ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `source should include ${endNeedle}`);
  return source.slice(start, end);
}

function assertProductMetadata(product, expectedLineId) {
  assert.equal(product.lineId, expectedLineId, `${product.id} lineId`);
  assert.equal(product.lineLabel, `Line ${expectedLineId}`, `${product.id} lineLabel`);
  assert.equal(product.label, product.canonicalLabel, `${product.id} label should match canonicalLabel`);
  assert.match(
    product.canonicalLabel,
    new RegExp(`^2D Line ${expectedLineId} `),
    `${product.id} canonical label format`,
  );
  assert.doesNotMatch(product.canonicalLabel, /\blegacy\b/i, `${product.id} canonical label`);
  assert.ok(expectedProcessingStages.has(product.processingStage), `${product.id} processingStage`);
  assert.equal(product.nameEvidence?.labelBasis, "segy-text-header", `${product.id} label basis`);
  assert.equal(product.nameEvidence?.sourceSubmission, product.sourceSubmission, `${product.id} source submission evidence`);
  assert.equal(product.nameEvidence?.sourceFile, product.sourceFile, `${product.id} source file evidence`);
  assert.ok(product.nameEvidence?.textHeaderExcerpt, `${product.id} text header evidence`);
}

test("required Utah FORGE seismic line products have canonical source-backed labels and artifacts", () => {
  const manifest = readJson(...seismicManifestPath);
  const browserRoot = join(...seismicManifestPath.slice(0, -1));
  const productsById = requiredProductsById(manifest);

  for (const [lineId, productIds] of Object.entries(requiredLineProductIds)) {
    for (const productId of productIds) {
      const product = productsById.get(productId);
      assert.ok(product, `${lineId} product should exist: ${productId}`);
      assertProductMetadata(product, lineId);
      assert.ok(product.sections?.length > 0, `${product.id} section artifact metadata`);
      for (const section of product.sections) {
        assert.ok(section.amplitudeFile, `${product.id}/${section.id} amplitude file`);
        assert.ok(
          existsSync(join(browserRoot, assetFilePath(section.amplitudeFile))),
          `${product.id}/${section.id} generated amplitude artifact should exist`,
        );
      }
    }
  }

  for (const [productId, canonicalLabel] of Object.entries(expectedCanonicalLabels)) {
    const product = productsById.get(productId);
    assert.equal(product?.canonicalLabel, canonicalLabel, productId);
  }
});

test("seismic browser loader preserves trace-derived section geometry", () => {
  const source = readText("src", "loaders", "loadSeismicBrowser.ts");
  const sectionSpec = sourceSlice(
    source,
    "interface SeismicSectionSpec",
    "interface SeismicVolumeLodSpec",
  );
  assert.match(sectionSpec, /geometrySource\?:/, "section metadata should expose geometry source");
  assert.match(sectionSpec, /sourceAxis\?:/, "section metadata should expose source axis");
  assert.match(sectionSpec, /path\?: Vec3\[\]/, "section metadata should preserve trace path vertices");
  assert.match(sectionSpec, /surfaceGrid\?:/, "section metadata should expose trace surface grids");

  const geometryBuilder = sourceSlice(
    source,
    "function buildSectionPlaneGeometry",
    "function buildSectionDisplayAmplitudeTexture",
  );
  assert.doesNotMatch(
    geometryBuilder,
    /Float32Array\(4 \* 3\)/,
    "section geometry must not force every section into four vertices",
  );
  assert.match(
    geometryBuilder,
    /buildPathCurtainGeometry/,
    "line sections with interior path points should build tessellated path curtains",
  );
  assert.match(
    geometryBuilder,
    /surfaceGrid/,
    "sample sections should use trace-derived surface grid geometry when available",
  );

  assert.match(
    source,
    /seismicVolumeGeometryModel:\s*"axis-aligned-envelope"/,
    "raymarch volume userData should explicitly describe AABB/envelope geometry",
  );
});

test("source inventory and project metadata retain seismic line grouping and name evidence", () => {
  const manifest = readJson(...seismicManifestPath);
  const inventory = readJson(...seismicInventoryPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );
  assert.ok(seismicLayer, "seismic browser layer should exist");

  const inventoryById = new Map(inventory.activeProducts.map((product) => [product.id, product]));
  const projectById = new Map(
    seismicLayer.metadata.seismicProducts.map((product) => [product.id, product]),
  );
  const manifestById = requiredProductsById(manifest);

  for (const [productId, manifestProduct] of manifestById) {
    for (const [sourceLabel, product] of [
      ["inventory", inventoryById.get(productId)],
      ["project", projectById.get(productId)],
    ]) {
      assert.ok(product, `${sourceLabel} product exists: ${productId}`);
      for (const field of [
        "lineId",
        "lineLabel",
        "processingStage",
        "canonicalLabel",
        "nameEvidence",
      ]) {
        assert.ok(Object.hasOwn(manifestProduct, field), `manifest ${productId} ${field}`);
        assert.ok(Object.hasOwn(product, field), `${sourceLabel} ${productId} ${field}`);
        assert.deepEqual(
          product?.[field],
          manifestProduct[field],
          `${sourceLabel} ${productId} ${field}`,
        );
      }
    }
  }
});

test("GDR 1141 enhanced ANI PSDM 3D stack is audited as source-gated", () => {
  const manifest = readJson(...seismicManifestPath);
  const inventory = readJson(...seismicInventoryPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const productId = "gdr-1141-forge3d-ani-psdm-stack-enh";
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );

  assert.equal(
    manifest.products.some((candidate) => candidate.id === productId),
    false,
    "enhanced ANI PSDM render product must not be fabricated while the SEG-Y member is corrupt",
  );
  assert.equal(
    inventory.activeProducts.some((candidate) => candidate.id === productId),
    false,
    "enhanced ANI PSDM inventory product must not be fabricated while the SEG-Y member is corrupt",
  );
  assert.equal(
    seismicLayer?.metadata?.seismicProducts?.some(
      (candidate) => candidate.id === productId,
    ),
    false,
    "enhanced ANI PSDM project product must not be fabricated while the SEG-Y member is corrupt",
  );

  for (const [label, gates] of [
    ["manifest", manifest.requiredProductSourceGates],
    ["inventory", inventory.requiredProductSourceGates],
    ["project", seismicLayer?.metadata?.seismicRequiredProductSourceGates],
  ]) {
    assert.ok(Array.isArray(gates), `${label} required product gates`);
    const gate = gates.find((candidate) => candidate.id === productId);
    assert.ok(gate, `${label} enhanced ANI PSDM source gate`);
    assert.equal(gate.label, "3D anisotropic PSDM depth stack (enhanced)");
    assert.equal(gate.filename, "Forge3d_ANI_PSDM_Stack_Enh.segy");
    assert.equal(gate.expectedBytes, 153_678_840);
    assert.equal(gate.sourceSubmission, "GDR 1141");
    assert.equal(gate.downloadLandingPage, "https://gdr.openei.org/submissions/1141");
    assert.equal(gate.status, "source-member-corrupt");
    assert.match(
      gate.sourceZipMember,
      /2018-19 Reflection Processing\/3D Survey\/Forge3d_ANI_PSDM_Stack_Enh\.segy/,
      `${label} enhanced ANI PSDM zip member`,
    );
  }
});

test("approved PSDM surrogate recipe renders only the unenhanced depth source", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const recipes = readJson(...seismicDemoRecipesPath);
  const environment = readJson("projects", "utah-forge", "environment.json");
  const seismicModelSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "seismicModel.ts",
  );
  const sourceRegistrationSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicSourceAndRegistrationControls.tsx",
  );
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );
  const recipeId = "psdm-depth-surrogate-showcase";
  const unenhancedProductId = "gdr-1141-forge3d-ani-psdm-stack-unenh";
  const enhancedProductId = "gdr-1141-forge3d-ani-psdm-stack-enh";
  const timeProductIds = [
    "gdr-1141-forge3d-pstm-stack-enh",
    "gdr-1141-forge3d-poststack-time-migration-fxydecon-stack",
  ];
  const expectedLabel =
    "Presentation-enhanced PSDM surrogate - GDR 1141, unenhanced source";

  const artifactPreset = recipes.capabilityPresets.find(
    (preset) => preset.id === recipeId,
  );
  const projectPreset = seismicLayer?.metadata?.seismicCapabilityPresets?.find(
    (preset) => preset.id === recipeId,
  );
  for (const [source, preset] of [
    ["artifact", artifactPreset],
    ["project", projectPreset],
  ]) {
    assert.ok(preset, `${source} surrogate preset`);
    assert.equal(preset.label, expectedLabel, `${source} label`);
    assert.equal(preset.provenanceClassification, "source-derived", `${source} provenance`);
    assert.match(preset.provenanceNote, /Presentation-enhanced PSDM surrogate/);
    assert.match(preset.provenanceNote, /unenhanced anisotropic PSDM depth volume/);
    assert.match(preset.provenanceNote, /no enhanced SEG-Y is held/i);
    assert.equal(preset.productId, unenhancedProductId, `${source} product`);
    assert.deepEqual(
      preset.visibleProductIds,
      [unenhancedProductId],
      `${source} visible products`,
    );
    assert.equal(preset.renderMode, "raymarch", `${source} render mode`);
    assert.equal(preset.sliceAxis, "crossline", `${source} slice axis`);
    assert.equal(preset.sliceFraction, 0.52, `${source} slice fraction`);
    assert.equal(preset.sliceThroughVolume, true, `${source} slice-through-volume`);
    assert.equal(preset.colormap, "blue-white-red", `${source} colormap`);
    assert.equal(preset.volumeSampleSteps, 112, `${source} ray steps`);
    assert.equal(preset.mtCoRender, "integrated", `${source} MT co-render`);
    assert.equal(
      preset.visibleProductIds.includes(enhancedProductId),
      false,
      `${source} must not render the source-gated enhanced PSDM`,
    );
    for (const productId of timeProductIds) {
      assert.equal(
        preset.visibleProductIds.includes(productId),
        false,
        `${source} surrogate must hide ${productId}`,
      );
    }
  }

  const allRecipePresets = [
    ...(recipes.audiencePresets ?? []),
    ...(recipes.capabilityPresets ?? []),
  ];
  for (const preset of allRecipePresets) {
    assert.notEqual(
      preset.productId,
      enhancedProductId,
      `${preset.id} must not select the source-gated enhanced PSDM`,
    );
    assert.equal(
      (preset.visibleProductIds ?? []).includes(enhancedProductId),
      false,
      `${preset.id} must not show the source-gated enhanced PSDM`,
    );
  }

  const seismicStyle =
    environment.layerStyles?.["utah-forge-phase3-seismic-browser"] ?? {};
  assert.equal(seismicStyle.seismicAudiencePresetId, recipeId);
  assert.equal(seismicStyle.seismicCapabilityPresetId, recipeId);
  assert.equal(seismicStyle.seismicProductId, unenhancedProductId);
  assert.equal(
    seismicStyle.seismicProductVisibility?.[unenhancedProductId],
    true,
    "global demo default should show the unenhanced PSDM surrogate",
  );
  assert.equal(
    seismicStyle.seismicProductVisibility?.[enhancedProductId],
    undefined,
    "global demo default should not include the source-gated enhanced PSDM",
  );
  for (const productId of timeProductIds) {
    assert.equal(
      seismicStyle.seismicProductVisibility?.[productId],
      false,
      `global demo default should hide ${productId}`,
    );
  }
  assert.match(
    seismicModelSource,
    /provenanceClassification/,
    "seismic preset parser should preserve provenance classification",
  );
  assert.match(
    seismicModelSource,
    /provenanceNote/,
    "seismic preset parser should preserve provenance note",
  );
  assert.match(
    sourceRegistrationSource,
    /activePreset\?\.label/,
    "source registration UI should show the active preset label",
  );
  assert.match(
    sourceRegistrationSource,
    /activePreset\?\.provenanceNote/,
    "source registration UI should show the active preset provenance note",
  );
});

test("PSDM MT 58-32 source-location tie preset stays claim-safe", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const recipes = readJson(...seismicDemoRecipesPath);
  const pageId = "61_psdm_mt_58_32_source_location_tie";
  const pagePath = join("projects", "utah-forge", "pages", `${pageId}.json`);
  const overlayPath = join(
    "projects",
    "utah-forge",
    "overlays",
    pageId,
    "text.md",
  );
  const page = readJson(pagePath);
  const overlay = readFileSync(overlayPath, "utf8");
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );
  const recipeId = "psdm-mt-58-32-source-location-tie";
  const unenhancedProductId = "gdr-1141-forge3d-ani-psdm-stack-unenh";
  const enhancedProductId = "gdr-1141-forge3d-ani-psdm-stack-enh";
  const timeProductIds = [
    "gdr-1141-forge3d-pstm-stack-enh",
    "gdr-1141-forge3d-poststack-time-migration-fxydecon-stack",
  ];
  const expectedLabel = "PSDM + MT + 58-32 source-location tie";

  assert.equal(
    project.pageOrder.indexOf(pageId),
    4,
    "project should place the tie review page at actual page 5",
  );
  assert.equal(page.id, pageId);
  assert.match(page.title, /PSDM \+ MT \+ 58-32 Source-Location Tie/);
  assert.match(overlay, /depth-only PSDM/i);
  assert.match(overlay, /inline review near IL-93/i);
  assert.match(overlay, /0-2600 m/i);
  assert.match(overlay, /25 m CMP bin/i);
  assert.match(overlay, /NAD83 UTM Zone 12N \(EPSG:26912\)/i);
  assert.match(overlay, /1800 m datum/i);
  assert.match(overlay, /GDR 1255/i);
  assert.match(overlay, /Legacy lines L5\/L11 stay excluded/i);
  assert.match(overlay, /68-32 anchor is not asserted/i);
  assert.match(overlay, /source-location marker only/i);
  assert.match(overlay, /no 58-32 trajectory/i);
  assert.match(overlay, /no well-tie calibration geometry/i);

  const artifactPresets = [
    recipes.audiencePresets.find((preset) => preset.id === recipeId),
    recipes.capabilityPresets.find((preset) => preset.id === recipeId),
  ];
  const projectPresets = [
    seismicLayer?.metadata?.seismicAudiencePresets?.find(
      (preset) => preset.id === recipeId,
    ),
    seismicLayer?.metadata?.seismicCapabilityPresets?.find(
      (preset) => preset.id === recipeId,
    ),
  ];

  for (const preset of [...artifactPresets, ...projectPresets]) {
    assert.ok(preset, "tie preset should be present in generated and project metadata");
    assert.equal(preset.label, expectedLabel);
    assert.equal(preset.productId, unenhancedProductId);
    assert.deepEqual(preset.visibleProductIds, [unenhancedProductId]);
    assert.equal(preset.provenanceClassification, "source-derived");
    assert.match(preset.provenanceNote, /source-location-only/i);
    assert.match(preset.provenanceNote, /no 58-32 trajectory/i);
    assert.match(preset.provenanceNote, /no enhanced SEG-Y is held/i);
    assert.equal(preset.mtCoRender, "integrated");
    assert.equal(preset.renderMode, "raymarch");
    assert.equal(preset.sliceAxis, "inline");
    assert.equal(preset.sliceFraction, 0.544);
    assert.equal(preset.sliceThroughVolume, true);
    assert.equal(preset.visibleProductIds.includes(enhancedProductId), false);
    for (const productId of timeProductIds) {
      assert.equal(
        preset.visibleProductIds.includes(productId),
        false,
        `${preset.id} should keep time-domain products hidden`,
      );
    }
  }

  const seismicStyle =
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"] ?? {};
  assert.equal(seismicStyle.seismicCapabilityPresetId, recipeId);
  assert.equal(seismicStyle.seismicProductId, unenhancedProductId);
  assert.equal(seismicStyle.seismicRenderMode, "raymarch");
  assert.equal(seismicStyle.seismicSliceAxis, "inline");
  assert.equal(seismicStyle.seismicSliceFraction, 0.544);
  assert.equal(seismicStyle.seismicVerticalDatumMode, "reference-1800m");
  assert.equal(seismicStyle.seismicColormap, "blue-white-red");
  assert.equal(seismicStyle.seismicVolumeSampleSteps, 112);
  assert.equal(seismicStyle.seismicSliceThroughVolume, true);
  assert.equal(seismicStyle.seismicMtCoRender, "integrated");
  assert.equal(seismicStyle.seismicProductVisibility?.[unenhancedProductId], true);
  assert.equal(seismicStyle.seismicProductVisibility?.[enhancedProductId], undefined);
  for (const productId of timeProductIds) {
    assert.equal(
      seismicStyle.seismicProductVisibility?.[productId],
      false,
      `tie page should hide ${productId}`,
    );
  }

  const boreholeStyle =
    page.layerOverrides?.["utah-forge-phase3-demo-boreholes"] ?? {};
  assert.equal(
    boreholeStyle.demoBoreholeWells?.["16A(78)-32"]?.visible,
    true,
    "tie page should show source-derived 16A trajectory context",
  );
  assert.equal(
    boreholeStyle.demoBoreholeWells?.["16B(78)-32"]?.visible,
    true,
    "tie page should show source-derived 16B trajectory context",
  );
  assert.equal(
    boreholeStyle.demoBoreholeSourceLocations?.items?.["58-32-WELL"]?.visible,
    true,
    "tie page should show the 58-32 source-location marker",
  );
  assert.equal(
    boreholeStyle.demoBoreholeWells?.["58-32-WELL"]?.visible,
    undefined,
    "tie page should not imply a 58-32 trajectory layer",
  );

  assert.equal(page.visibilityOverrides?.terrain, true, "tie page should show topo context");
  assert.equal(
    page.visibilityOverrides?.["utah-forge-mt-resistivity-full-density"],
    true,
    "tie page should show MT resistivity context",
  );
  assert.equal(
    page.visibilityOverrides?.["utah-forge-mt-resistivity-threshold-surfaces"],
    true,
    "tie page should show MT threshold context",
  );

  const sceneSectionStyle =
    page.layerOverrides?.["utah-forge-scene-section-planes"] ?? {};
  assert.equal(sceneSectionStyle.sceneSectionWindowEnabled, true);
  assert.equal(sceneSectionStyle.sceneSectionWindowActiveAxis, "y");
  assert.ok(
    sceneSectionStyle.sceneSectionWindowByAxis?.y,
    "tie page should use the shared scene-section y window",
  );
  assert.ok(
    sceneSectionStyle.sceneSectionFrameByAxis?.y,
    "tie page should use the shared scene-section y frame",
  );
  assert.deepEqual(sceneSectionStyle.sceneSectionTargetProductIds, [
    unenhancedProductId,
  ]);
});

test("seismic prep recovers required zip-contained GDR 1141 source members", () => {
  const prepSource = readText("prep", "build_utah_forge_seismic_browser.py");
  assert.match(
    prepSource,
    /Forge3d_ANI_PSDM_Stack_Enh\.segy/,
    "prep script should name the required zip-contained enhanced ANI PSDM source",
  );
  assert.match(
    prepSource,
    /extract_required_zip_source_members/,
    "prep script should recover required SEG-Y members that remain inside source zips",
  );
});

test("seismic editor exposes first-class all-2D section controls", () => {
  const containerSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicCapabilityLayerContainers.tsx",
  );
  const graphControlsSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SectionGraphOptionsControls.tsx",
  );
  const seismicModelSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "seismicModel.ts",
  );
  assert.match(
    graphControlsSource,
    /section-graph-option-\$\{option\.id\}/,
    "editor should render section graph options with stable option-derived test ids",
  );
  for (const label of [
    "Line 301 depth sections",
    "Line 301 time sections",
    "Line 301 velocity section",
    "Line 302 depth sections",
    "Line 302 time sections",
    "Line 302 velocity section",
    "Line L5 depth sections",
    "Line L5 time sections",
    "Line L5 velocity section",
    "Line L11 depth sections",
    "Line L11 time sections",
    "Line L11 velocity section",
  ]) {
    assert.match(
      seismicModelSource,
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `editor should expose ${label} under Section Options`,
    );
  }
  assert.doesNotMatch(
    seismicModelSource,
    /id: "all-2d-sections"|id: "hide-2d-sections"|id: "survey-plus-2d-sections"/,
    "editor should not expose the removed bulk 2D shortcut commands",
  );
  assert.match(
    containerSource,
    /seismic-source-gate-/,
    "editor should expose source-gated seismic product headings",
  );
  assert.match(
    seismicModelSource,
    /visible:\s*true,[\s\S]*seismicProductVisibility: selectedProductVisibility/,
    "direct product capability activation should make the seismic layer visible",
  );
});

test("seismic editor container uses logical source and display groups without audience framing", () => {
  const capabilitySource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicCapabilityLayerContainers.tsx",
  );
  const browserSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicBrowserControls.tsx",
  );
  const surveyGeometrySource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicSurveyGeometryControls.tsx",
  );
  const sectionGraphSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SectionGraphOptionsControls.tsx",
  );
  const visibilitySource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicProductVisibilityControls.tsx",
  );
  const sourceRegistrationSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicSourceAndRegistrationControls.tsx",
  );
  const seismicModelSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "seismicModel.ts",
  );
  const capabilityGroupSource = `${capabilitySource}\n${surveyGeometrySource}\n${sectionGraphSource}\n${seismicModelSource}`;

  for (const source of [capabilitySource, browserSource]) {
    assert.doesNotMatch(source, /SEISMIC_AUDIENCE_MODE_OPTIONS/);
    assert.doesNotMatch(source, /seismic-audience-mode-select/);
    assert.doesNotMatch(source, /seismic-audience-preset-select/);
    assert.doesNotMatch(source, /seismic-export-summary/);
  }
  assert.doesNotMatch(sourceRegistrationSource, /Audience/);
  assert.match(sourceRegistrationSource, /Source and registration/);
  assert.match(sourceRegistrationSource, /visibleProductCount/);
  assert.match(sourceRegistrationSource, /placementLabel/);
  assert.match(sourceRegistrationSource, /seismicVerticalDatumMode/);
  assert.match(seismicModelSource, /Source datum/);
  assert.match(seismicModelSource, /1800 m/);
  assert.match(seismicModelSource, /Terrain top/);
  assert.match(capabilitySource, /seismicVerticalDatumMode/);
  assert.match(browserSource, /seismicVerticalDatumMode/);

  assert.match(visibilitySource, /Product visibility/);

  for (const label of [
    "Source-gated products",
    "SeismicSourceAndRegistrationControls",
    "2D Section Line",
    "3D Volume",
    "3D Section Plane",
    "Processing Comparison",
    "Display",
    "Seismic survey geometry",
    "Figure Annotation",
    "Integrated Geophysics",
  ]) {
    assert.match(capabilityGroupSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(capabilitySource, /title="Display cleanup"/);
  assert.doesNotMatch(capabilitySource, /2D \/ legacy section theatre/);
  assert.doesNotMatch(capabilitySource, /3D \/ raymarch products/);
  assert.doesNotMatch(capabilitySource, /Section-only products/);
  assert.doesNotMatch(browserSource, /Technical controls/);
  assert.doesNotMatch(browserSource, /Seismic product controls/);
  assert.match(browserSource, /Source and registration/);
  assert.match(browserSource, /Integrated geophysics/);
});

test("all-2D review page uses shared 1800m datum display mode", () => {
  const page = readJson(
    "projects",
    "utah-forge",
    "pages",
    "60_all_2d_seismic_sections_review.json",
  );
  const seismicOverride =
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"];

  assert.equal(
    seismicOverride?.visible,
    true,
    "all-2D review page should force the seismic layer visible so products load",
  );
  assert.equal(
    seismicOverride?.seismicVerticalDatumMode,
    "reference-1800m",
    "all-2D review page should align section tops to the shared FORGE reference datum",
  );
});

test("seismic show actions restore real layer visibility before product loading", () => {
  const layerPanelSource = readText("src", "editor", "LayerPanel.tsx");
  const layerPanelGroupsSource = readText(
    "src",
    "editor",
    "LayerPanelGroups.tsx",
  );
  const browserControlsSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicBrowserControls.tsx",
  );
  const capabilityControlsSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicCapabilityLayerContainers.tsx",
  );

  assert.match(
    layerPanelSource,
    /const ensureLayerVisible = \(\) => \{[\s\S]*setPageVisibilityOverride\(currentPage\.id, layer\.id, true\)/,
    "LayerPanel should expose a page-visibility restore callback for hidden seismic layers",
  );
  assert.match(
    layerPanelSource,
    /ensureLayerVisible=\{ensureLayerVisible\}/,
    "active seismic controls should receive the layer visibility restore callback",
  );
  assert.match(
    layerPanelGroupsSource,
    /const ensureSeismicLayerVisible = \(\) => \{[\s\S]*setPageVisibilityOverride\(currentPage\.id, seismicLayer\.id, true\)/,
    "grouped seismic controls should restore page visibility for hidden seismic layers",
  );
  assert.match(
    layerPanelGroupsSource,
    /ensureLayerVisible=\{ensureSeismicLayerVisible\}/,
    "grouped seismic controls should receive the layer visibility restore callback",
  );
  for (const [label, source] of [
    ["browser", browserControlsSource],
    ["capability", capabilityControlsSource],
  ]) {
    assert.match(
      source,
      /ensureLayerVisible\?: \(\) => void/,
      `${label} seismic controls should accept the layer visibility restore callback`,
    );
    assert.match(
      source,
      /patch\.visible === true[\s\S]*ensureLayerVisible\?\.\(\)/,
      `${label} seismic controls should restore layer visibility for show-producing patches`,
    );
  }
});

test("every required line product has a direct capability preset", () => {
  const manifest = readJson(...seismicManifestPath);
  const directPresetProductIds = new Set(
    manifest.capabilityPresets
      .filter((preset) => preset.capabilityGroup === "seismic-product-catalog")
      .map((preset) => preset.productId),
  );

  for (const productId of allRequiredProductIds()) {
    assert.ok(directPresetProductIds.has(productId), `${productId} direct capability preset`);
  }
});

test("Line 95 remains source-gated until a real source product exists", () => {
  const manifest = readJson(...seismicManifestPath);
  const inventory = readJson(...seismicInventoryPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const seismicLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-seismic-browser",
  );

  for (const [label, gates] of [
    ["manifest", manifest.requiredLineSourceGates],
    ["inventory", inventory.requiredLineSourceGates],
    ["project", seismicLayer?.metadata?.seismicRequiredLineSourceGates],
  ]) {
    assert.ok(Array.isArray(gates), `${label} source gates`);
    const line95Gate = gates.find((gate) => gate.lineId === "95");
    assert.ok(line95Gate, `${label} Line 95 gate`);
    assert.equal(line95Gate.status, "missing-source", `${label} Line 95 status`);
    assert.deepEqual(line95Gate.productIds, [], `${label} Line 95 product ids`);
    assert.match(
      JSON.stringify(line95Gate.searchedRoots),
      /GeoSee_Archive/,
      `${label} Line 95 gate should record archive search coverage`,
    );
  }

  assert.equal(
    manifest.products.some((product) => product.lineId === "95"),
    false,
    "Line 95 product must not be fabricated",
  );
});

test("authored seismic catalog pages cover only source-backed required lines", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const requiredPageIds = [
    "54_seismic_product_catalog",
    "55_line_301_seismic_products",
    "56_line_302_seismic_products",
    "57_legacy_line_l11_seismic_products",
    "58_legacy_line_l5_seismic_products",
  ];

  for (const pageId of requiredPageIds) {
    assert.ok(project.pageOrder.includes(pageId), `${pageId} in project page order`);
    assert.ok(
      existsSync(join("projects", "utah-forge", "pages", `${pageId}.json`)),
      `${pageId} page file`,
    );
  }

  assert.equal(
    project.pageOrder.some((pageId) => /line[_-]?95|95[_-]?seismic/i.test(pageId)),
    false,
    "Line 95 page must not be authored without source data",
  );
});

test("2D seismic survey-lines review page keeps a fixed review view and shows representative line curtains", () => {
  const manifest = readJson(...seismicManifestPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const page = readJson(
    "projects",
    "utah-forge",
    "pages",
    "59_all_seismic_sections_review.json",
  );

  assert.ok(
    project.pageOrder.includes("59_all_seismic_sections_review"),
    "all seismic sections review page should be in project order",
  );
  assert.equal(
    project.pageOrder.indexOf("59_all_seismic_sections_review"),
    project.pageOrder.indexOf("58_legacy_line_l5_seismic_products") + 1,
    "all seismic sections review page should sit after the seismic catalog block",
  );
  assert.ok(page.camera, "page should carry an authored review camera");
  assert.ok(page.dynamicCamera, "page should carry an authored dynamic camera");

  const visibility = page.layerOverrides?.["utah-forge-phase3-seismic-browser"]
    ?.seismicProductVisibility;
  assert.equal(page.visibilityOverrides?.["utah-forge-phase3-seismic-browser"], true);
  assert.equal(page.visibilityOverrides?.terrain, true);
  assert.equal(page.visibilityOverrides?.["utah-forge-phase3-demo-boreholes"], true);
  assert.equal(
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"]?.seismicRenderMode,
    "slice",
  );
  assert.equal(
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"]?.seismicSliceAxis,
    "line",
  );
  assert.equal(
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"]?.seismicNavigationVisible,
    true,
  );
  assert.equal(
    page.layerOverrides?.["utah-forge-phase3-seismic-browser"]
      ?.seismicNavigationRoleVisibility?.lines,
    true,
  );

  const expectedVisibleProducts = new Set([
    "gdr-1141-line-301-pdm-enh",
    "gdr-1141-line-302-psdm-enh",
    "gdr-1141-line-l11-psdm-enh-meters",
    "gdr-1141-line-l5-psdm-enh-meters",
  ]);
  for (const product of manifest.products) {
    assert.equal(
      visibility?.[product.id],
      expectedVisibleProducts.has(product.id),
      `${product.id} representative 2D review visibility`,
    );
  }
  assert.equal(
    Object.keys(visibility ?? {}).length,
    manifest.products.length,
    "review page visibility should explicitly cover each source-backed manifest product",
  );
  assert.equal(
    manifest.products
      .filter((product) => visibility?.[product.id] === true)
      .every((product) => product.surveyKind !== "3d"),
    true,
    "review page must not show 3D center slices over the 2D survey-line curtains",
  );
  for (const product of manifest.products.filter(
    (candidate) => visibility?.[candidate.id] === true,
  )) {
    assert.equal(product.sections?.[0]?.axis, "line", `${product.id} uses line-axis section geometry`);
    assert.ok(
      (product.sections?.[0]?.path?.length ?? 0) >= 2,
      `${product.id} has a survey path for its section curtain`,
    );
  }
  assert.equal(
    visibility?.["gdr-1141-forge3d-ani-psdm-stack-enh"],
    undefined,
    "source-gated enhanced ANI PSDM should remain non-renderable",
  );
});

test("all 2D seismic sections review page enables every non-3D source-backed section", () => {
  const manifest = readJson(...seismicManifestPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const representativePage = readJson(
    "projects",
    "utah-forge",
    "pages",
    "59_all_seismic_sections_review.json",
  );
  const page = readJson(
    "projects",
    "utah-forge",
    "pages",
    "60_all_2d_seismic_sections_review.json",
  );
  const seismicOverrides = page.layerOverrides?.["utah-forge-phase3-seismic-browser"];
  const visibility = seismicOverrides?.seismicProductVisibility;

  assert.ok(
    project.pageOrder.includes("60_all_2d_seismic_sections_review"),
    "all 2D seismic sections review page should be in project order",
  );
  assert.equal(
    project.pageOrder.indexOf("60_all_2d_seismic_sections_review"),
    project.pageOrder.indexOf("59_all_seismic_sections_review") + 1,
    "all 2D seismic sections review page should sit directly after the representative review page",
  );
  assert.deepEqual(page.camera, representativePage.camera, "all-2D page should share the representative review camera");
  assert.deepEqual(
    page.dynamicCamera,
    representativePage.dynamicCamera,
    "all-2D page should share the representative review dynamic camera",
  );
  assert.equal(page.visibilityOverrides?.["utah-forge-phase3-seismic-browser"], true);
  assert.equal(page.visibilityOverrides?.terrain, true);
  assert.equal(page.visibilityOverrides?.["utah-forge-phase3-demo-boreholes"], true);
  assert.equal(seismicOverrides?.seismicRenderMode, "slice");
  assert.equal(seismicOverrides?.seismicSliceAxis, "line");
  assert.equal(seismicOverrides?.seismicNavigationVisible, true);
  assert.deepEqual(seismicOverrides?.seismicNavigationRoleVisibility, {
    sources: true,
    receivers: true,
    lines: true,
  });
  assert.equal(
    Object.keys(visibility ?? {}).length,
    manifest.products.length,
    "all 2D page visibility should explicitly cover each source-backed manifest product",
  );

  const visibleProducts = manifest.products.filter((product) => visibility?.[product.id] === true);
  assert.equal(visibleProducts.length, 30, "all 2D page should enable all 30 section products");
  for (const product of manifest.products) {
    assert.equal(
      visibility?.[product.id],
      product.surveyKind !== "3d",
      `${product.id} all 2D review visibility`,
    );
  }
  for (const product of visibleProducts) {
    assert.equal(product.sections?.[0]?.axis, "line", `${product.id} uses line-axis section geometry`);
    assert.ok(
      (product.sections?.[0]?.path?.length ?? 0) >= 2,
      `${product.id} has a survey path for its section curtain`,
    );
  }
  assert.equal(
    visibility?.["gdr-1141-forge3d-ani-psdm-stack-enh"],
    undefined,
    "source-gated enhanced ANI PSDM should remain non-renderable",
  );
});
