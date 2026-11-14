import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Ported unchanged in substance from PR #22's single TR-02 RED regression.
// No PI-004 tests, browser, writer, authored pages or geoscience assets.
const manager = readFileSync(join(process.cwd(), "src/scene/SceneManager.ts"), "utf8");

test("TR-02 RED source: post-commit comparison must not reuse expected terminal graph as measured committed graph", () => {
  const finalizerStart = manager.indexOf("finalizePageTransitionCommit(");
  const post = manager.indexOf('phase: "post-commit-graph-check"', finalizerStart);
  assert.ok(finalizerStart >= 0 && post > finalizerStart);
  const check = manager.slice(post, post + 350);
  assert.doesNotMatch(
    check,
    /committedGraph:\s*terminalTransitionGraph/,
    "TR-02: post-commit data is still an unmeasured projection from expected target assignments"
  );
});
