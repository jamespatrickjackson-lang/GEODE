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
