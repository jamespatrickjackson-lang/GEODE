import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const primaryUtahForgeLayerIds = [
  "terrain",
  "utah-forge-phase3-seismic-browser",
  "utah-forge-mt-resistivity-full-density",
  "utah-forge-mt-resistivity-volume",
  "utah-forge-mt-resistivity-threshold-surfaces",
  "utah-forge-mt-top-surface",
  "utah-forge-mt-top-contact-surface",
  "utah-forge-mt-resistivity-slices",
];

const showcasePageIds = [
  "40_geophysics_product_overview",
  "41_mt_station_network_footprint",
  "42_resistivity_volume_overview",
  "43_resistivity_depth_elevation_slices",
  "44_resistivity_cross_sections",
  "45_resistivity_isosurfaces",
  "49_seismic_fence_panels",
  "50_integrated_seismic_resistivity_context",
];

const forbiddenPrimaryLanguage = [
  /low-resolution preview/i,
  /downsampled visual products/i,
  /compact downsampled/i,
  /not engineering-grade/i,
  /not the final sliceable/i,
  /validation\/presentation preview/i,
];

function readText(...segments) {
  return readFileSync(join(...segments), "utf8");
}

function readJson(...segments) {
  return JSON.parse(readText(...segments));
}

function assertNoForbiddenLanguage(text, label) {
  for (const pattern of forbiddenPrimaryLanguage) {
    assert.doesNotMatch(text, pattern, `${label} should not use ${pattern}`);
  }
}

test("primary Utah FORGE visual layers use source-fidelity language", () => {
  const project = readJson("projects", "utah-forge", "project.json");

  for (const layerId of primaryUtahForgeLayerIds) {
    const layer = project.layers.find((candidate) => candidate.id === layerId);
    assert.ok(layer, `primary layer exists: ${layerId}`);
    const userFacingText = JSON.stringify({
      id: layer.id,
      label: layer.label,
      description: layer.description,
      metadata: layer.metadata,
    });
    assertNoForbiddenLanguage(userFacingText, layerId);
  }
});

test("primary Utah FORGE artifacts do not self-label intended visuals as low-grade previews", () => {
  const seismicManifest = readText(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  assertNoForbiddenLanguage(seismicManifest, "seismic manifest");

  const docsToCheck = [
    join("projects", "utah-forge", "DATA_LAYER_STATUS.md"),
    join("docs", "tool-manifest.md"),
    join("docs", "dev-context", "Computed-Artifact-Pipeline.md"),
    join("docs", "dev-context", "Layer-Artifact-Classification.md"),
  ];

  for (const path of docsToCheck) {
    const text = readFileSync(path, "utf8");
    assertNoForbiddenLanguage(text, path);
  }
});

test("seismic prep script derives product resolution instead of applying global 128 or 64 caps", () => {
  const source = readText("prep", "build_utah_forge_seismic_browser.py");

  assert.doesNotMatch(source, /^SECTION_WIDTH\s*=\s*128/m);
  assert.doesNotMatch(source, /^SECTION_HEIGHT\s*=\s*128/m);
  assert.doesNotMatch(source, /^VOLUME_DIM\s*=\s*64/m);
  assert.doesNotMatch(source, /trace_grid_shape\(trace_count,\s*VOLUME_DIM,\s*VOLUME_DIM\)/);
  assert.doesNotMatch(source, /selected_sample_indices\(sample_count,\s*SECTION_HEIGHT\)/);
  assert.match(source, /source_aligned_section_shape|section_shape_for_product/);
  assert.match(source, /source_aligned_volume_shape|volume_shape_for_product/);
});

test("seismic prep script parses vertical datum from source headers", () => {
  const source = readText("prep", "build_utah_forge_seismic_browser.py");

  assert.match(source, /parsed_datum_m/);
  assert.match(source, /header_measure\(text_header,\s*"DATUM"\)/);
  assert.doesNotMatch(
    source,
    /if\s+"302"\s+in\s+name:\s*\n\s*return\s+2100\.0/,
    "seismic datum must not be inferred from Line 302 product naming",
  );
  assert.match(source, /SEISMIC_REFERENCE_DATUM_M\s*=\s*1800\.0/);
});

test("seismic navigation import uses declared CRS transform before scene-origin subtraction", () => {
  const source = readText("prep", "build_utah_forge_seismic_browser.py");
  const registrationHelper = readText("prep", "geosee_registration.py");

  assert.match(source, /parse_sp1\(path:\s*Path,\s*source_crs:\s*str\)/);
  assert.match(source, /source_to_scene\(easting,\s*northing,\s*elevation,\s*source_crs\)/);
  assert.match(source, /Transformer\.from_crs\(f"EPSG:\{candidate\['epsg'\]\}"/);
  assert.doesNotMatch(source, /easting\s*-\s*SCENE_ORIGIN_E/);
  assert.doesNotMatch(source, /northing\s*-\s*SCENE_ORIGIN_N/);
  assert.match(registrationHelper, /Transformer\.from_crs/);
  assert.match(registrationHelper, /require_source_crs/);
  assert.match(registrationHelper, /project_easting_m - frame\.origin_easting_m/);
});

test("legacy seismic trace-header lines cannot claim precise registration", () => {
  const source = readText("prep", "build_utah_forge_seismic_browser.py");
  const demoRecipeSource = readText("prep", "build_utah_forge_seismic_demo_recipes.mjs");
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );

  assert.match(source, /navigationSource/);
  assert.match(source, /placementAccuracy/);
  assert.match(source, /canClaimPreciseRegistration/);
  assert.match(source, /precise registration not validated/);
  assert.match(demoRecipeSource, /approximate reference section curtains/);
  assert.doesNotMatch(demoRecipeSource, /Legacy lines L5 and L11 as georeferenced/);

  const legacyProducts = manifest.products.filter(
    (product) =>
      product.surveyKind === "legacy-2d" ||
      /legacy-l(?:5|11)|line-l(?:5|11)/i.test(product.id),
  );
  assert.ok(legacyProducts.length > 0, "legacy L5/L11 products should exist");
  for (const product of legacyProducts) {
    assert.equal(product.sourceGeometry?.status, "trace-header-derived", product.id);
    assert.equal(product.navigationPlacement?.navigationSource, "delivered", product.id);
    assert.notEqual(product.navigationPlacement?.placementAccuracy, "validated", product.id);
    assert.equal(product.navigationPlacement?.canClaimPreciseRegistration, false, product.id);
    assert.match(product.navigationPlacement?.statusLabel ?? "", /precise registration requires validation/i);
    for (const section of product.sections ?? []) {
      assert.equal(section.navigationPlacement?.navigationSource, "delivered", `${product.id}/${section.id}`);
      assert.notEqual(
        section.navigationPlacement?.placementAccuracy,
        "validated",
        `${product.id}/${section.id}`,
      );
      assert.equal(section.navigationPlacement?.canClaimPreciseRegistration, false, `${product.id}/${section.id}`);
      assert.match(section.geometrySource ?? "", /trace-header/);
    }
  }

  const deliveredProducts = manifest.products.filter(
    (product) => product.navigationPlacement?.navigationSource === "delivered",
  );
  assert.ok(deliveredProducts.length > 0, "delivered-navigation products should exist");
  for (const product of deliveredProducts) {
    assert.notEqual(product.navigationPlacement?.placementAccuracy, "validated", product.id);
    assert.equal(product.navigationPlacement?.canClaimPreciseRegistration, false, product.id);
  }
});

test("audited missing-source gates are non-blocking only after source search is recorded", async () => {
  const { isBlockingRequiredSourceGate } = await import(
    "../../tools/validate-seismic-source-gates.mjs"
  );

  assert.equal(
    isBlockingRequiredSourceGate({
      required: true,
      status: "missing-source",
      productIds: [],
      searchedRoots: ["active-source-root"],
    }),
    false,
    "audited missing-source gates with no generated products should be non-blocking",
  );
  assert.equal(
    isBlockingRequiredSourceGate({
      required: true,
      status: "missing-source",
      productIds: ["line-95-product"],
      searchedRoots: ["active-source-root"],
    }),
    true,
    "missing-source gates with product ids should remain blocking",
  );
  assert.equal(
    isBlockingRequiredSourceGate({
      required: true,
      status: "missing-source",
      productIds: [],
      searchedRoots: [],
    }),
    true,
    "missing-source gates without searched roots are not audited",
  );
  assert.equal(
    isBlockingRequiredSourceGate({
      required: true,
      status: "source-present-not-generated",
      productIds: [],
      searchedRoots: ["active-source-root"],
    }),
    true,
    "source-present-not-generated gates should remain blocking",
  );
});

test("Utah FORGE runtime layers declare CRS registration status", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  assert.equal(project.registrationFrame?.horizontalCrs, "EPSG:26912");
  assert.equal(project.registrationFrame?.registrationStatus, "unverified");

  const requiredFields = [
    "horizontalCrs",
    "verticalDatum",
    "units",
    "coordinateBasis",
    "origin",
    "rotationDeg",
    "registrationStatus",
  ];
  const missingRegistration = [];
  const malformedRegistration = [];
  for (const layer of project.layers) {
    const registration = layer.metadata?.crsRegistration;
    if (!registration) {
      missingRegistration.push(layer.id);
      continue;
    }
    for (const field of requiredFields) {
      if (!Object.hasOwn(registration, field)) {
        malformedRegistration.push(`${layer.id} missing ${field}`);
      }
    }
    if (!/^(unverified|validated)$/.test(registration.registrationStatus)) {
      malformedRegistration.push(
        `${layer.id} invalid registrationStatus ${registration.registrationStatus}`,
      );
    }
    if (registration.registrationStatus === "validated") {
      if (
        !Array.isArray(registration.controlPoints) ||
        registration.controlPoints.length === 0
      ) {
        malformedRegistration.push(
          `${layer.id} validated registration requires control points`,
        );
      }
    }
  }
  assert.deepEqual(missingRegistration, [], "layers missing CRS registration");
  assert.deepEqual(malformedRegistration, [], "malformed CRS registration");
});

test("Utah FORGE Bore Holes container keeps priority records honest", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "demo_boreholes",
    "phase3_demo_boreholes.json",
  );
  const layerPanelConfig = readText(
    "src",
    "editor",
    "layerControls",
    "layerPanelConfig.ts",
  );
  const layerPanel = readText("src", "editor", "LayerPanel.tsx");
  const siteDetailsPanel = readText("src", "editor", "SiteDetailsPanel.tsx");
  const boreholeGenerator = readText("tools", "generate-utah-forge-demo-boreholes.py");
  const boreholeLoader = readText("src", "loaders", "loadUtahForgeDemoBoreholes.ts");
  const siteDetailStyles = readText("src", "scene", "styles", "siteDetailStyles.ts");

  const siteDetailsBlock = layerPanelConfig.match(
    /title:\s*"Site Details",\s*ids:\s*\[([\s\S]*?)\],/,
  );
  assert.ok(siteDetailsBlock, "Site Details group should exist");
  assert.doesNotMatch(
    siteDetailsBlock[1],
    /UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID/,
    "demo boreholes should not remain mixed into Site Details",
  );
  assert.match(
    layerPanelConfig,
    /title:\s*"Bore Holes",\s*ids:\s*\[UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID\]/,
    "Forge should expose a Bore Holes container",
  );
  assert.match(layerPanel, /boreholePriorityRegistry/);
  assert.match(layerPanel, /Source rows:/);
  assert.match(siteDetailsPanel, /Source Locations/);
  assert.match(siteDetailsPanel, /site-details-borehole-line-visible/);
  assert.match(siteDetailsPanel, /Per-borehole show \/ hide/);
  assert.match(siteDetailsPanel, /updateSourceLocationItem/);
  assert.match(siteDetailsPanel, /Ground torus/);
  assert.match(siteDetailsPanel, /site-details-borehole-icon-upload/);
  assert.match(boreholeGenerator, /build_priority_registry/);
  assert.match(boreholeGenerator, /58-32-WELL/);
  assert.match(boreholeGenerator, /78B-32-WELL/);
  assert.match(boreholeGenerator, /BOR1/);
  assert.match(boreholeLoader, /addPrioritySourceMarkers/);
  assert.match(boreholeLoader, /demoBoreholeSourceTraceRoot/);
  assert.match(boreholeLoader, /demoBoreholeSourceTrace/);
  assert.match(boreholeLoader, /demoBoreholeSourceLine/);
  assert.match(boreholeLoader, /demoBoreholeSourceTopRing/);
  assert.match(boreholeLoader, /CylinderGeometry/);
  assert.match(boreholeLoader, /SphereGeometry/);
  assert.match(boreholeLoader, /TorusGeometry/);
  assert.match(boreholeLoader, /source-location-marker-not-trajectory/);
  assert.match(siteDetailStyles, /resolveDemoBoreholeSourceLocationStyle/);
  assert.match(siteDetailStyles, /resolveDemoBoreholeSourceLocationItemStyle/);
  assert.match(siteDetailStyles, /demoBoreholeSourceTrace/);
  assert.match(siteDetailStyles, /demoBoreholeSourceTopRing/);

  const boreholeLayer = project.layers.find(
    (layer) => layer.id === "utah-forge-phase3-demo-boreholes",
  );
  assert.ok(boreholeLayer, "demo borehole layer should exist");
  const projectRegistry = boreholeLayer.metadata?.demoBoreholes?.priorityRegistry;
  const manifestRegistry = manifest.priorityRegistry;
  assert.deepEqual(projectRegistry, manifestRegistry, "project and manifest registries should match");

  const expectedIds = [
    "58-32",
    "16A(78)-32",
    "78B-32",
    "16B",
    "Acord-1",
    "FDST",
    "unnamed-possible-seismic-monitoring-well",
  ];
  assert.deepEqual(
    manifestRegistry.map((entry) => entry.id),
    expectedIds,
    "priority registry should preserve the requested order",
  );
  assert.deepEqual(
    manifestRegistry.map((entry) => entry.displayLabel),
    [
      "58-32: core characterization and seismic/geologic anchor",
      "16A (78)-32: primary injection/source well for stimulation and EM monitoring.",
      "78B-32: key observation well for borehole EM/VEMP measurements.",
      "16B: production well, relevant to injection/production pair context.",
      "Acord-1: supporting mapped reference well.",
      "FDST/ FORGE test drill site: supporting mapped reference site.",
      "Unnamed: possible seismic monitoring well, low priority unless ID is recovered.",
    ],
    "Bore Holes list labels should match the requested demo wording",
  );

  const renderedWellIds = new Set(manifest.wells.map((well) => well.id));
  assert.deepEqual(
    [...renderedWellIds].sort(),
    ["16A(78)-32", "16B(78)-32"],
    "only sourced 16A/16B trajectories should be rendered in this pass",
  );

  for (const entry of manifestRegistry) {
    for (const field of [
      "sourceStatus",
      "renderStatus",
      "registrationStatus",
      "claimStatus",
      "linkedLayerId",
      "aliases",
      "sourceRecordIds",
      "notes",
    ]) {
      assert.ok(Object.hasOwn(entry, field), `${entry.id} should include ${field}`);
    }

    if (entry.renderStatus !== "trajectory-rendered") {
      assert.equal(entry.renderStatus, "not-rendered", entry.id);
      assert.equal(entry.linkedLayerId, null, entry.id);
      assert.ok(
        !renderedWellIds.has(entry.id) &&
          !entry.aliases.some((alias) => renderedWellIds.has(alias)),
        `${entry.id} should not silently map to fabricated geometry`,
      );
    } else {
      assert.equal(
        entry.linkedLayerId,
        "utah-forge-phase3-demo-boreholes",
        entry.id,
      );
    }
  }

  const entriesById = new Map(manifestRegistry.map((entry) => [entry.id, entry]));
  assert.deepEqual(entriesById.get("58-32")?.sourceRecordIds, [
    "58-32-WELL",
    "58-32-NEC",
    "58-32-NWC",
    "58-32-SEC",
    "58-32-SWC",
  ]);
  assert.equal(entriesById.get("58-32")?.sourceLocation?.featureCode, "WELL");
  assert.equal(
    entriesById.get("58-32")?.claimStatus,
    "claim-safe-source-location-only",
  );
  assert.deepEqual(entriesById.get("78B-32")?.sourceRecordIds, [
    "78B-32-WELL",
    "78B-32-NEC",
    "78B-32-NWC",
    "78B-32-SEC",
    "78B-32-SWC",
  ]);
  assert.equal(entriesById.get("78B-32")?.sourceLocation?.featureCode, "WELL");
  assert.equal(
    entriesById.get("78B-32")?.claimStatus,
    "claim-safe-source-location-only",
  );
  assert.deepEqual(entriesById.get("16A(78)-32")?.sourceRecordIds, [
    "16A-32-WELL",
    "16A-32-NEC",
    "16A-32-NWC",
    "16A-32-SEC",
    "16A-32-SWC",
  ]);
  assert.deepEqual(entriesById.get("16B")?.sourceRecordIds, [
    "16B(78)-32 Final Survey Report.xlsx",
  ]);
  assert.deepEqual(entriesById.get("Acord-1")?.sourceRecordIds, []);
  assert.equal(entriesById.get("Acord-1")?.sourceStatus, "not-found-in-active-source");
  assert.deepEqual(entriesById.get("FDST")?.sourceRecordIds, []);
  assert.equal(entriesById.get("FDST")?.sourceStatus, "not-found-in-active-source");
  assert.deepEqual(
    entriesById
      .get("unnamed-possible-seismic-monitoring-well")
      ?.sourceCandidates?.map((candidate) => candidate.id),
    ["BOR1", "BOR2", "BOR3"],
  );
});

test("seismic manifest records datum-aligned vertical metadata", () => {
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );

  assert.equal(manifest.verticalReference?.referenceDatumM, 1800);
  assert.match(manifest.verticalReference?.transform ?? "", /datumM - sample/);
  assert.equal(
    manifest.verticalReference?.calibration?.expectedDepthConversionErrorM,
    20,
  );
  const depthProducts = manifest.products.filter(
    (product) => product.domainKind === "depth",
  );
  assert.ok(depthProducts.length > 0, "depth-domain seismic products should exist");
  for (const product of depthProducts) {
    assert.equal(typeof product.datumM, "number", `${product.id} depth datum`);
    assert.ok(Number.isFinite(product.datumM), `${product.id} finite depth datum`);
    assert.equal(product.verticalReference?.sourceDatumM, product.datumM);
    for (const section of product.sections ?? []) {
      assert.equal(section.datumM, product.datumM, `${product.id}/${section.id} datum`);
      assert.equal(
        section.verticalReference?.sourceDatumM,
        product.datumM,
        `${product.id}/${section.id} vertical reference`,
      );
    }
  }

  const velocityProducts = manifest.products.filter(
    (product) => product.productKind === "velocity",
  );
  assert.ok(velocityProducts.length > 0, "velocity seismic products should exist");
  for (const product of velocityProducts) {
    assert.deepEqual(
      product.valueEncoding?.displayRangeMPerS,
      [2000, 5000],
      `${product.id} velocity display scale`,
    );
  }
});

test("working-area boundary uses the seismic reference datum top", () => {
  for (const filePath of [
    ["src", "projectModules", "utahForge", "workingAreaFocus.ts"],
    ["src", "scene", "layerLoaders.ts"],
    [
      "projects",
      "utah-forge",
      "data",
      "geosee_processed",
      "utah_forge_phase_3",
      "site_container",
      "phase3_required_working_area_container.geojson",
    ],
    ["projects", "utah-forge", "project.json"],
  ]) {
    const source = readText(...filePath);
    assert.doesNotMatch(
      source,
      /2045\.3/,
      `${filePath.join("/")} must not use the old navigation-elevation top`,
    );
  }
});

test("3D seismic browser products are capped for interactive source-fidelity rendering", () => {
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  const threeDimensionalProducts = manifest.products.filter(
    (product) => product.surveyKind === "3d",
  );

  assert.ok(threeDimensionalProducts.length > 0, "expected 3D seismic products");
  for (const product of threeDimensionalProducts) {
    for (const section of product.sections ?? []) {
      assert.ok(
        Math.max(section.width, section.height) <= 2048,
        `${product.id}/${section.id} should stay within the 2048px browser cap`,
      );
      assert.ok(
        section.width !== 128 || section.height !== 128,
        `${product.id}/${section.id} should not fall back to the old 128x128 preview`,
      );
      assert.ok(section.lods?.coarse, `${product.id}/${section.id} should expose a coarse LOD tier`);
      assert.ok(section.lods?.standard, `${product.id}/${section.id} should expose a standard LOD tier`);
      assert.ok(section.lods?.source, `${product.id}/${section.id} should expose a source LOD tier`);
      assert.ok(
        Math.max(section.lods.coarse.width, section.lods.coarse.height) <=
          Math.max(section.width, section.height),
        `${product.id}/${section.id} coarse tier should not exceed the standard tier`,
      );
    }

    if (product.raymarchVolume) {
      const [nx, ny, nz] = product.raymarchVolume.dimensions;
      assert.ok(
        nx * ny * nz <= 8_388_608,
        `${product.id} raymarch volume should stay within the interactive voxel budget`,
      );
      assert.ok(
        Math.min(nx, ny, nz) > 64 || product.id.includes("velo5d"),
        `${product.id} should not fall back to the old 64-cube preview`,
      );
      assert.ok(product.raymarchVolume.lods?.coarse, `${product.id} should expose a coarse volume tier`);
      assert.ok(product.raymarchVolume.lods?.standard, `${product.id} should expose a standard volume tier`);
      assert.ok(product.raymarchVolume.lods?.source, `${product.id} should expose a source volume tier`);
      const [cx, cy, cz] = product.raymarchVolume.lods.coarse.dimensions;
      assert.ok(
        cx * cy * cz <= nx * ny * nz,
        `${product.id} coarse volume tier should not exceed the standard tier`,
      );
    }
  }
});

test("MT volume prep script derives grid dimensions from source spacing", () => {
  const source = readText("prep", "build_utah_forge_mt_volume_products.mjs");

  assert.doesNotMatch(source, /dimensions:\s*\[80,\s*64,\s*56\]/);
  assert.doesNotMatch(source, /dimensions:\s*\[96,\s*80,\s*64\]/);
  assert.match(source, /deriveSourceFidelityVolumeDimensions/);
});

test("terrain primary artifact uses the full-extent 1000 m public context raster", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const terrain = project.layers.find((layer) => layer.id === "terrain");
  assert.ok(terrain, "terrain layer should exist");
  assert.match(
    terrain.files?.raster ?? "",
    /terrain_public_context_1000m\.tif$/,
  );

  const publicContext = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "public_context",
    "manifest.json",
  );
  assert.equal(publicContext.terrain?.file, "terrain_public_context_1000m.tif");
  assert.equal(publicContext.terrain?.width, 1396);
  assert.equal(publicContext.terrain?.height, 1140);
  assert.equal(publicContext.terrain?.resolutionM, 1000);
  assert.equal(
    terrain.metadata?.geoTransform?.terrainMaxVertices,
    450000,
    "terrain runtime budget should stay below unsafe full-raster rendering",
  );
});

test("runtime loaders separate source-fidelity artifacts from render budgets", () => {
  const scalarVolume = readText("src", "loaders", "loadScalarVolume.ts");
  const seismicBrowser = readText("src", "loaders", "loadSeismicBrowser.ts");
  const terrainLoader = readText("src", "loaders", "loadTerrain.ts");
  const seismicStyle = readText("src", "scene", "styles", "seismicBrowserStyle.ts");

  assert.doesNotMatch(scalarVolume, /clamp\(uSampleSteps,\s*24\.0,\s*192\.0\)/);
  assert.doesNotMatch(seismicBrowser, /clamp\(uSampleSteps,\s*24\.0,\s*160\.0\)/);
  assert.match(scalarVolume, /SOURCE_FIDELITY_MAX_SAMPLE_STEPS/);
  assert.match(seismicBrowser, /SOURCE_FIDELITY_MAX_SAMPLE_STEPS/);
  assert.match(terrainLoader, /DEFAULT_TERRAIN_MAX_VERTICES\s*=\s*900_000/);
  assert.match(terrainLoader, /terrainLodHandle/);
  assert.match(terrainLoader, /TERRAIN_TILE_COLUMNS/);
  assert.doesNotMatch(
    seismicBrowser,
    /Promise\.all\(\s*manifest\.products\.map/s,
    "seismic loader should not eagerly build every manifest product",
  );
  assert.match(seismicBrowser, /seismicEnsureProductsLoaded/);
  assert.match(seismicBrowser, /seismicRetainProducts/);
  assert.match(seismicBrowser, /seismicActiveLodByProduct/);
  assert.match(seismicStyle, /seismicEnsureProductsLoaded/);
  assert.match(seismicStyle, /seismicRetainProducts/);
  assert.match(seismicBrowser, /new THREE\.DataTexture/);
  assert.match(seismicBrowser, /sampler2D uAmplitudeMap/);
  assert.match(seismicBrowser, /seismicTexturePlane/);
  assert.doesNotMatch(
    seismicBrowser,
    /buildGridIndices\(section\.width,\s*section\.height\)/,
    "seismic section render geometry should no longer allocate per-sample grid indices",
  );
  assert.doesNotMatch(
    seismicBrowser,
    /geometry\.setAttribute\("color"/,
    "seismic section color should be produced by the texture shader, not per-sample vertex colors",
  );
  assert.doesNotMatch(
    seismicBrowser,
    /geometry\.setAttribute\("seismicAlpha"/,
    "seismic section alpha should be produced by the texture shader, not per-sample vertex alpha",
  );
  assert.doesNotMatch(
    seismicStyle,
    /for\s*\(\s*let i = 0;\s*i < Math\.min\(color\.count,\s*values\.length\)/,
    "seismic section style should update shader uniforms instead of recoloring every sample",
  );
  assert.doesNotMatch(
    seismicStyle,
    /sectionIsoAttributeValues/,
    "texture-backed seismic sections should not build v1 section ISO overlays from render attributes",
  );
  assert.match(seismicStyle, /seismicSectionIsoDisabledReason/);
});

test("seismic runtime uses coarse LOD during transient interaction windows", () => {
  const sceneManager = readText("src", "scene", "SceneManager.ts");
  const seismicBrowser = readText("src", "loaders", "loadSeismicBrowser.ts");
  const seismicStyle = readText("src", "scene", "styles", "seismicBrowserStyle.ts");

  assert.match(seismicStyle, /function seismicResolveTargetLodTier/);
  assert.match(seismicStyle, /seismicPendingLodByProduct/);
  assert.match(seismicStyle, /seismicActiveLodByProduct/);
  assert.match(seismicStyle, /seismicTransitionActive/);
  assert.match(seismicStyle, /seismicCameraMoving/);
  assert.match(seismicStyle, /previousProductId\s*&&\s*previousProductId !== productId/);
  assert.match(seismicStyle, /pendingTier === "coarse"/);
  assert.match(seismicStyle, /pendingTier && !activeTier/);
  assert.doesNotMatch(
    seismicStyle,
    /pendingProductIds\.length\s*>\s*0/,
    "settled standard promotion must not be downgraded just because a standard tier is pending",
  );
  assert.match(sceneManager, /updateSeismicTransientLodState/);
  assert.match(sceneManager, /seismicCameraMovingUntilMs/);
  assert.match(sceneManager, /seismicTransientLodReason/);
  assert.match(seismicBrowser, /requestedTier === SEISMIC_COARSE_LOD_TIER/);
});

test("showcase pages do not use the MT QA subset as a primary visual", () => {
  for (const pageId of showcasePageIds) {
    const page = readJson("projects", "utah-forge", "pages", `${pageId}.json`);
    assert.notEqual(
      page.visibilityOverrides?.["utah-forge-mt-resistivity-preview"],
      true,
      `${pageId} should not turn on the 90k MT QA subset as a primary visual`,
    );
  }
});
