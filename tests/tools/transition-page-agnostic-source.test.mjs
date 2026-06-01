import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const protectedRuntimeRoots = [
  join("src", "editor"),
  join("src", "pages"),
  join("src", "scene"),
];

const runtimeFilePattern = /\.(ts|tsx)$/;
const disposableUtahFixturePattern =
  /\b(?:\d{2,3}_[a-z][a-z0-9_]*|A\d{2}|S\d{2})\b/;
const fixedIndexTransitionCasePattern =
  /\b(?:fromIndex|toIndex|firstTargetIndex|finalTargetIndex)\s*:\s*\d+\b/;

function walkFiles(root) {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return walkFiles(fullPath);
    }
    return runtimeFilePattern.test(entry) ? [fullPath] : [];
  });
}

test("runtime transition source does not bake disposable Utah page fixtures", () => {
  const violations = [];
  for (const root of protectedRuntimeRoots) {
    for (const filePath of walkFiles(root)) {
      const source = readFileSync(filePath, "utf8");
      if (disposableUtahFixturePattern.test(source)) {
        violations.push(filePath);
      }
      if (fixedIndexTransitionCasePattern.test(source)) {
        violations.push(filePath);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    "Runtime transition/editor/page code must stay page-agnostic; numbered pages and matrix cases belong only in fixture evidence.",
  );
});

test("transition matrix selected cases are feature-family fixtures, not fixed page indexes", () => {
  const source = readFileSync(
    join("tools", "capture-transition-matrix.mjs"),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /ADJACENT_SURFACE_NOTES/,
    "Adjacent diagnostics should be classified from feature-family state, not hard-coded page-order notes.",
  );
  assert.doesNotMatch(
    source,
    fixedIndexTransitionCasePattern,
    "Supplemental and interruption matrix cases should resolve from page feature predicates, not fixed page-order indexes.",
  );
  assert.doesNotMatch(
    source,
    /\bid:\s*"S\d{2}"/,
    "Supplemental matrix IDs should be feature-family labels rather than numbered page-pair cases.",
  );
});

test("base transition classifier stays independent from project and renderer fixtures", () => {
  const source = readFileSync(
    join("src", "scene", "transitions", "transitionEntityPolicy.ts"),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /projectModules|UTAH_|ProductTransitionFamily|ProductTransitionPolicy|layerId|pageId|toolName|toolLabel/,
    "Base transition policy should classify resolved render-graph facts, while project/render metadata stays in adapters and diagnostics.",
  );
});
