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
    "function buildSectionAmplitudeTexture",
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
  const controlsSource = readText(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicCapabilityLayerContainers.tsx",
  );
  assert.match(
    controlsSource,
    /seismic-capability-all-2d-sections/,
    "editor should expose a direct all-2D section visibility command",
  );
  assert.match(
    controlsSource,
    /seismic-capability-hide-2d-sections/,
    "editor should expose a direct 2D section hide command",
  );
  assert.match(
    controlsSource,
    /seismic-capability-survey-plus-2d-sections/,
    "editor should expose a survey geometry plus 2D sections command",
  );
  assert.match(
    controlsSource,
    /seismic-source-gate-/,
    "editor should expose source-gated seismic product headings",
  );
  assert.match(
    controlsSource,
    /product\.surveyKind !== "3d"/,
    "2D section controls should derive scope from surveyKind rather than hard-coded page fixtures",
  );
  assert.match(
    controlsSource,
    /visible:\s*true,[\s\S]*seismicProductVisibility: selectedOnlyVisibility/,
    "direct product capability activation should make the seismic layer visible",
  );
  assert.match(
    controlsSource,
    /visible:\s*true,[\s\S]*seismicProductVisibility: Object\.fromEntries\([\s\S]*product\.surveyKind !== "3d"/,
    "all-2D section activation should make the seismic layer visible",
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
    "2D sections",
    "3D products",
    "2D product details",
    "Processing comparison",
    "Display",
    "Survey geometry",
    "Figure annotations",
    "Integrated geophysics",
  ]) {
    assert.match(capabilitySource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

test("2D seismic survey-lines review page inherits page 5 view and shows representative line curtains", () => {
  const manifest = readJson(...seismicManifestPath);
  const project = readJson("projects", "utah-forge", "project.json");
  const page5 = readJson(
    "projects",
    "utah-forge",
    "pages",
    "05_mt_threshold_focus.json",
  );
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
  assert.deepEqual(page.camera, page5.camera, "page should inherit page 5 camera");
  assert.deepEqual(
    page.dynamicCamera,
    page5.dynamicCamera,
    "page should inherit page 5 dynamic camera",
  );

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
  const page5 = readJson(
    "projects",
    "utah-forge",
    "pages",
    "05_mt_threshold_focus.json",
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
  assert.deepEqual(page.camera, page5.camera, "page should inherit page 5 camera");
  assert.deepEqual(
    page.dynamicCamera,
    page5.dynamicCamera,
    "page should inherit page 5 dynamic camera",
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
