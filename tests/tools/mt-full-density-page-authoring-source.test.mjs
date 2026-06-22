import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reviewTest } from "./reviewFlag.mjs";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const projectRoot = join(repoRoot, "projects", "utah-forge");
const MT_FULL_DENSITY_LAYER_ID = "utah-forge-mt-resistivity-full-density";
const EXPECTED_PAGE_CLOUD_STYLE = {
  opacity: 0.48,
  pointSizePx: 1.25,
  scalarInclusionMode: "all-valid",
};

function readJson(...parts) {
  return JSON.parse(readFileSync(join(projectRoot, ...parts), "utf8"));
}

function mtStyleForPage(pageId) {
  const page = readJson("pages", `${pageId}.json`);
  return page.layerOverrides?.[MT_FULL_DENSITY_LAYER_ID] ?? {};
}

reviewTest("DECK-REVIEW", "Global Settings keeps the MT full-density point cloud page baseline", () => {
  const environment = readJson("environment.json");
  const style = environment.layerStyles?.[MT_FULL_DENSITY_LAYER_ID] ?? {};

  assert.equal(style.opacity, EXPECTED_PAGE_CLOUD_STYLE.opacity);
  assert.equal(style.pointSizePx, EXPECTED_PAGE_CLOUD_STYLE.pointSizePx);
  assert.equal(
    style.scalarInclusionMode,
    EXPECTED_PAGE_CLOUD_STYLE.scalarInclusionMode,
  );
  assert.equal(
    environment.defaultVisibleLayers?.includes(MT_FULL_DENSITY_LAYER_ID),
    true,
  );
});

test("GeoSee intro duplicate pages keep MT full-density visibility and style", () => {
  for (const pageId of ["156_page", "157_page", "158_page"]) {
    const page = readJson("pages", `${pageId}.json`);
    const style = mtStyleForPage(pageId);

    assert.equal(
      page.visibilityOverrides?.[MT_FULL_DENSITY_LAYER_ID],
      true,
      `${pageId} should keep the MT full-density cloud visible.`,
    );
    assert.equal(style.opacity, EXPECTED_PAGE_CLOUD_STYLE.opacity, pageId);
    assert.equal(style.pointSizePx, EXPECTED_PAGE_CLOUD_STYLE.pointSizePx, pageId);
    assert.equal(
      style.scalarInclusionMode,
      EXPECTED_PAGE_CLOUD_STYLE.scalarInclusionMode,
      pageId,
    );
  }
});
