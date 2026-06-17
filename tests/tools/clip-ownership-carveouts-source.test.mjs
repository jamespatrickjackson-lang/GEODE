import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

// Phase 2 preflight carve-out guard. Asserts the protected contracts the
// resolver+applier consolidation must NOT remove still exist on the baseline.
// Passes now; fails only if the consolidation later deletes them. Page-agnostic
// (no live Utah pages, page ids, page order, or fixture pairs).

const read = (...p) => readFileSync(join(process.cwd(), ...p), "utf8");

test("MT full-density scalar path symbols are present (protected)", () => {
  const ts = read("src", "scene", "transitions", "transitionStyles.ts");
  assert.match(ts, /SCALAR_TRANSITION_STYLE_FIELDS/);
  assert.match(ts, /export function scalarInclusionFilterActive/);
  assert.match(ts, /export function scalarFullDensityAllValidMode/);
});

test("full-density cloud stays PointsMaterial and is not soft-section-clipped", () => {
  const cloud = read("src", "loaders", "loadPointCloudPreview.ts");
  assert.match(cloud, /new THREE\.PointsMaterial\(/);
  const section = read("src", "scene", "section", "sceneSectionController.ts");
  assert.match(section, /material instanceof THREE\.ShaderMaterial/);
});

test("Section ISO derived-root ownership is present (DEC-169/171)", () => {
  const sm = read("src", "scene", "SceneManager.ts");
  assert.match(sm, /beginSectionIsoOverlayTransition/);
  assert.match(sm, /sectionIsoOverlayTransitionRoot/);
  const dec = read("docs", "03-decisions.md");
  assert.match(dec, /DEC-169/);
  assert.match(dec, /DEC-171/);
});

test("per-frame move-follow partition is present (DEC-164/170)", () => {
  const dec = read("docs", "03-decisions.md");
  assert.match(dec, /DEC-164/);
  assert.match(dec, /DEC-170/);
  const sig = read("src", "scene", "transitions", "sceneSectionFrameSignature.ts");
  assert.match(sig, /sceneSectionFramePartition/);
});

test("helper no-bleed contract is present (DEC-100 / TRD-012)", () => {
  const dec = read("docs", "03-decisions.md");
  assert.match(dec, /DEC-100/);
  const contract = read(
    "docs",
    "dev-context",
    "Transition-Continuity-Contract.md",
  );
  assert.match(contract, /TRD-012/);
});
