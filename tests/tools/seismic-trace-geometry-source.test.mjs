import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

const repoRoot = process.cwd();
const manifestPath = join(
  repoRoot,
  "projects",
  "utah-forge",
  "data",
  "geosee_processed",
  "utah_forge_phase_3",
  "seismic_analysis",
  "browser",
  "seismic_manifest.json",
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function productById(manifest, productId) {
  const product = manifest.products.find((candidate) => candidate.id === productId);
  assert.ok(product, `manifest product should exist: ${productId}`);
  return product;
}

function closeEnough(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
}

test("ANI PSDM 3D product records trace-header IL/XL geometry and depth spacing", () => {
  const manifest = readJson(manifestPath);
  const product = productById(manifest, "gdr-1141-forge3d-ani-psdm-stack-unenh");
  const geometry = product.sourceGeometry;

  assert.equal(geometry?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(geometry?.status, "trace-header-derived");
  assert.equal(geometry?.horizontalCrs?.epsg, 26912);
  assert.deepEqual(geometry?.inlineRange, [1, 170]);
  assert.deepEqual(geometry?.crosslineRange, [1, 213]);
  assert.equal(geometry?.grid?.inlineCount, 170);
  assert.equal(geometry?.grid?.crosslineCount, 213);
  assert.equal(geometry?.validTraceCount, 36210);
  assert.equal(product.datumM, 1800);
  assert.equal(product.sampleDomain?.spacing?.value, 5);
  assert.equal(product.sampleDomain?.spacing?.unit, "m");

  const corners = geometry?.cmpCornersUtm;
  assert.ok(corners, "CMP UTM corner geometry");
  closeEnough(corners.sw[0], 332800.5, 0.1, "SW easting");
  closeEnough(corners.sw[1], 4260778.0, 0.1, "SW northing");
  closeEnough(corners.nw[0], 332874.25, 0.1, "NW easting");
  closeEnough(corners.nw[1], 4265002.25, 0.3, "NW northing");
  closeEnough(corners.ne[0], 338173.44, 0.1, "NE easting");
  closeEnough(corners.ne[1], 4264910.0, 0.1, "NE northing");
});

test("3D inline/crossline sections use trace-derived paths instead of navigation envelope planes", () => {
  const manifest = readJson(manifestPath);
  const product = productById(manifest, "gdr-1141-forge3d-ani-psdm-stack-unenh");
  const inline = product.sections.find((section) => section.id === "inline_50");
  const crossline = product.sections.find((section) => section.id === "crossline_50");
  const sample = product.sections.find((section) => section.id === "sample_50");

  assert.equal(inline?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(inline?.sourceAxis?.kind, "inline");
  assert.ok(inline?.sourceAxis?.value >= 1 && inline.sourceAxis.value <= 170);
  assert.ok(inline?.path?.length >= 200, "inline path should retain crossline trace points");
  assert.notDeepEqual(
    inline?.sceneBounds,
    manifest.navigation?.sceneBounds,
    "inline sections should not reuse the broad navigation envelope as visible geometry",
  );

  assert.equal(crossline?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(crossline?.sourceAxis?.kind, "crossline");
  assert.ok(crossline?.path?.length >= 160, "crossline path should retain inline trace points");

  assert.equal(sample?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(sample?.surfaceGrid?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(sample?.surfaceGrid?.width, 213);
  assert.equal(sample?.surfaceGrid?.height, 170);
  assert.ok(sample?.surfaceGrid?.corners?.sw, "sample plane source grid corners");
});

test("Line 301 GDR 1141 depth sections carry per-trace CMP paths", () => {
  const manifest = readJson(manifestPath);
  const product = productById(manifest, "gdr-1141-line-301-pdm-enh");
  const section = product.sections.find((candidate) => candidate.id === "section");

  assert.equal(product.sourceGeometry?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(section?.geometrySource, "trace-header-cmp-ibm-real");
  assert.equal(section?.sourceAxis?.kind, "line");
  assert.equal(section?.path?.length, 321);
  assert.notDeepEqual(
    section?.path?.[0],
    section?.path?.at(-1),
    "trace-derived line path endpoints should be distinct",
  );
});

test("Legacy L5 and L11 depth sections use trace-header CMP paths transformed to UTM", () => {
  const manifest = readJson(manifestPath);
  const l5 = productById(manifest, "gdr-1141-line-l5-psdm-enh-meters");
  const l11 = productById(manifest, "gdr-1141-line-l11-psdm-enh-meters");
  const l5Section = l5.sections.find((candidate) => candidate.id === "section");
  const l11Section = l11.sections.find((candidate) => candidate.id === "section");

  for (const [label, product, section, expectedTraceCount] of [
    ["L5", l5, l5Section, 439],
    ["L11", l11, l11Section, 681],
  ]) {
    assert.match(
      product.sourceGeometry?.geometrySource ?? "",
      /^trace-header-cmp-ibm-real-state-plane-nad27-ftus-to-utm$/,
      `${label} source geometry should come from transformed trace-header CMP coordinates`,
    );
    assert.equal(product.sourceGeometry?.horizontalCrs?.epsg, 26912);
    assert.equal(product.sourceGeometry?.validTraceCount, expectedTraceCount);
    assert.equal(section?.geometrySource, product.sourceGeometry?.geometrySource);
    assert.equal(section?.sourceAxis?.kind, "line");
    assert.equal(section?.path?.length, expectedTraceCount);
    assert.notEqual(
      section?.geometrySource,
      "fallback-endpoints",
      `${label} must not be displayed from approximate endpoint fallback geometry`,
    );
  }

  assert.notDeepEqual(
    l5Section?.path?.[0],
    l11Section?.path?.[0],
    "legacy line paths should not collapse onto identical fallback endpoints",
  );
  assert.notDeepEqual(
    l5Section?.path?.at(-1),
    l11Section?.path?.at(-1),
    "legacy line end points should remain physically distinct",
  );
});

test("Legacy non-metre PSDM depth headers are converted from feet to scene metres", () => {
  const manifest = readJson(manifestPath);
  const l5 = productById(manifest, "gdr-1141-line-l5-psdm-enh");
  const l11 = productById(manifest, "gdr-1141-line-l11-psdm-enh");

  assert.equal(l5.domainKind, "depth");
  assert.equal(l5.domainUnit, "m");
  assert.equal(l5.sourceUnitStatus, "header-indicated-depth-ft-converted-to-m");
  assert.equal(l5.sections[0]?.sampleDomain?.sourceUnitStatus, l5.sourceUnitStatus);
  closeEnough(l5.datumM, 1800, 0.01, "L5 render datum normalized to reference datum");
  closeEnough(
    l5.verticalReference?.sourceHeaderDatumM,
    2133.6,
    0.01,
    "L5 source header datum retained for audit",
  );
  closeEnough(
    l5.verticalReference?.datumNormalizationM,
    -333.6,
    0.01,
    "L5 source header datum offset retained for audit",
  );
  closeEnough(l5.sampleDomain?.spacing?.value, 3.048, 0.000001, "L5 validated 10 ft sample spacing in metres");
  closeEnough(l5.sampleRange?.[1], 6096, 0.001, "L5 20000 ft depth range in metres");
  assert.equal(
    l5.sampleDomain?.axisSource?.source,
    "segy-sample-labels-validated-by-header-trace-length",
  );

  assert.equal(l11.domainKind, "depth");
  assert.equal(l11.domainUnit, "m");
  assert.equal(l11.sourceUnitStatus, "header-indicated-depth-ft-converted-to-m");
  assert.equal(l11.sections[0]?.sampleDomain?.sourceUnitStatus, l11.sourceUnitStatus);
  closeEnough(l11.datumM, 1800, 0.01, "L11 render datum normalized to reference datum");
  closeEnough(
    l11.verticalReference?.sourceHeaderDatumM,
    2133.6,
    0.01,
    "L11 source header datum retained for audit",
  );
  closeEnough(
    l11.verticalReference?.datumNormalizationM,
    -333.6,
    0.01,
    "L11 source header datum offset retained for audit",
  );
  closeEnough(l11.sampleDomain?.spacing?.value, 0.6096, 0.000001, "L11 2 ft sample spacing in metres");
  closeEnough(l11.sampleRange?.[1], 6096, 0.001, "L11 20000 ft depth range in metres");
});

test("Converted legacy metre products keep header datum and trace-length guards", () => {
  const manifest = readJson(manifestPath);
  const l5 = productById(manifest, "gdr-1141-line-l5-psdm-enh-meters");
  const l11 = productById(manifest, "gdr-1141-line-l11-psdm-enh-meters");

  assert.equal(l5.sourceUnitStatus, "header-indicated-depth-m");
  closeEnough(l5.datumM, 1800, 0.01, "L5 converted datum shift to 1800 m");
  closeEnough(l5.sampleDomain?.spacing?.value, 5, 0.000001, "L5 converted sample spacing");
  closeEnough(l5.sampleRange?.[1], 5800, 0.001, "L5 converted sample max");

  assert.equal(l11.sourceUnitStatus, "header-indicated-depth-m");
  closeEnough(l11.datumM, 1800, 0.01, "L11 converted datum normalized to reference datum");
  closeEnough(l11.verticalReference?.sourceHeaderDatumM, 2133.6, 0.01, "L11 converted header datum retained");
  closeEnough(l11.sampleDomain?.spacing?.value, 0.6, 0.000001, "L11 converted trace-length-derived spacing");
  closeEnough(l11.sampleRange?.[1], 6000, 0.001, "L11 converted trace length");
  assert.equal(l11.sampleDomain?.axisSource?.source, "header-trace-length-derived");
});

test("GDR 1015 migrated-depth product keeps unresolved depth-unit caveat", () => {
  const manifest = readJson(manifestPath);
  const product = productById(manifest, "gdr-1015-forge2d-301-migr-depth");

  assert.equal(product.domainKind, "depth");
  assert.equal(product.domainUnit, "m");
  assert.equal(product.sourceUnitStatus, "header-unresolved-filename-inferred-depth-m");
  assert.match(
    product.verticalReference?.sourceUnitCaveat ?? "",
    /header/i,
    "vertical reference should not over-claim header-proven depth units",
  );
  assert.equal(product.sections[0]?.sampleDomain?.sourceUnitStatus, product.sourceUnitStatus);
});

test("runtime loader preserves trace path and surface-grid geometry", () => {
  const loaderPath = join(repoRoot, "src", "loaders", "loadSeismicBrowser.ts");
  const stylePath = join(repoRoot, "src", "scene", "styles", "seismicBrowserStyle.ts");
  assert.ok(existsSync(loaderPath), "runtime loader source");
  assert.ok(existsSync(stylePath), "runtime seismic style source");
  const source = readFileSync(loaderPath, "utf8");
  const styleSource = readFileSync(stylePath, "utf8");

  assert.match(source, /surfaceGrid\?:/);
  assert.match(source, /seismicSectionPathPointCount/);
  assert.match(source, /buildPathCurtainGeometry/);
  assert.doesNotMatch(
    source,
    /const first = section\.path\[0\];\s*const last = section\.path\[section\.path\.length - 1\];/s,
    "runtime must not collapse section.path to first and last points",
  );
  assert.match(
    source,
    /includeVolume\?: boolean/,
    "loader should track whether a product group includes the raymarch volume",
  );
  assert.match(
    source,
    /options\.includeVolume === true && product\.raymarchVolume/,
    "loader should defer raymarch volume construction for section-only loads",
  );
  assert.match(
    styleSource,
    /includeVolume: renderMode === "raymarch"/,
    "style should only request volume payloads for raymarch mode",
  );
});

test("runtime exposes source/reference/terrain vertical datum display modes", () => {
  const loaderPath = join(repoRoot, "src", "loaders", "loadSeismicBrowser.ts");
  const stylePath = join(repoRoot, "src", "scene", "styles", "seismicBrowserStyle.ts");
  const typePath = join(repoRoot, "src", "pages", "types.ts");
  const loaderSource = readFileSync(loaderPath, "utf8");
  const styleSource = readFileSync(stylePath, "utf8");
  const typeSource = readFileSync(typePath, "utf8");

  assert.match(
    typeSource,
    /seismicVerticalDatumMode\?:\s*"source"\s*\|\s*"reference-1800m"\s*\|\s*"terrain-top-preview"/,
    "EditableStyle should expose the vertical datum display mode",
  );
  assert.match(
    loaderSource,
    /seismicSectionPath:\s*section\.path/,
    "section meshes should retain the full trace-derived path, not just a count",
  );
  assert.match(styleSource, /SEISMIC_REFERENCE_DATUM_M\s*=\s*1800/);
  assert.match(styleSource, /seismicVerticalDatumMode/);
  assert.match(styleSource, /terrain-top-preview/);
  assert.match(styleSource, /renderedTopoSurfaceZ/);
  assert.match(
    styleSource,
    /seismicVerticalDatumOffsetM/,
    "runtime should record the display-only Z offset for audit/inspection",
  );
});
