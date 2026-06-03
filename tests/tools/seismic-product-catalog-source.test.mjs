import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readJson(...segments) {
  return JSON.parse(readFileSync(join(...segments), "utf8"));
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

function requiredProductsById(manifest) {
  return new Map(
    manifest.products
      .filter((product) => allRequiredProductIds().includes(product.id))
      .map((product) => [product.id, product]),
  );
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
          existsSync(join(browserRoot, section.amplitudeFile)),
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
