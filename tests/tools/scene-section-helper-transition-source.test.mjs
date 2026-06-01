import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);

test("scene-section helper opacity treats reference lines as active across transitions", () => {
  assert.match(
    source,
    /sceneSectionReferenceHelperVisible/,
    "Helper transition opacity should use a shared reference-helper visibility predicate.",
  );
  assert.match(
    source,
    /sceneSectionGroundTraceVisible/,
    "Ground-trace visibility must keep the helper layer active even when editor handles are hidden.",
  );
  assert.match(
    source,
    /sceneSectionAxesVisible/,
    "Axis visibility must keep the helper layer active even when editor handles are hidden.",
  );
  assert.doesNotMatch(
    source,
    /fromActive\s*&&\s*toActive\s*&&\s*tween\.discreteChanged\)\s*return\s*clamp01\(eased\)/,
    "Already-active helper/reference elements should not fade the target helper layer from zero during discrete changes.",
  );
});

test("scene-section ground traces use synchronous height sampling when available", () => {
  assert.match(
    source,
    /peekHeightSampler/,
    "Ground traces should not always wait for a promise microtask after helper rebuild.",
  );
  assert.match(
    source,
    /withSceneSectionHeightSampler/,
    "Ground-trace construction should route through a helper that uses the cached terrain sampler synchronously.",
  );
});

test("scene-section frame outlines are independent from editor handle visibility", () => {
  assert.match(
    source,
    /frameOutlineVisible/,
    "Frame/crop outline visibility should be controlled separately from editor push-pull handle visibility.",
  );
  assert.match(
    source,
    /controlHandlesVisible/,
    "Editor controls should remain separately gated by sceneSectionHelperVisible.",
  );
});
