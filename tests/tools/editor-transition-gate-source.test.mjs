import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const editorContextSource = readFileSync(
  join(process.cwd(), "src", "editor", "EditorContext.tsx"),
  "utf8",
);

function extractCallback(name) {
  const start = editorContextSource.indexOf(`const ${name} = useCallback`);
  assert.notEqual(start, -1, `${name} callback should exist`);
  const nextCallback = editorContextSource.indexOf(
    "\n  const ",
    start + `const ${name}`.length,
  );
  assert.notEqual(nextCallback, -1, `${name} callback should have an end`);
  return editorContextSource.slice(start, nextCallback);
}

function assertBlockedBranchDoesNotReturn(callbackName) {
  const source = extractCallback(callbackName);
  const branchStart = source.indexOf("selectedPageWriteBlocked(");
  assert.notEqual(branchStart, -1, `${callbackName} should check write gate`);
  const dispatchStart = source.indexOf("dispatch(", branchStart);
  assert.notEqual(dispatchStart, -1, `${callbackName} should dispatch after gate`);
  const gatedSource = source.slice(branchStart, dispatchStart);
  assert.equal(
    /\breturn\s*;/.test(gatedSource),
    false,
    `${callbackName} must persist editor state while live scene apply is deferred`,
  );
}

test("setPageLayerOverride persists editor state when live transition apply is blocked", () => {
  assertBlockedBranchDoesNotReturn("setPageLayerOverride");
});

test("clearPageLayerOverride persists editor state when live transition apply is blocked", () => {
  assertBlockedBranchDoesNotReturn("clearPageLayerOverride");
});

test("setPageVisibilityOverride persists editor state when live transition apply is blocked", () => {
  assertBlockedBranchDoesNotReturn("setPageVisibilityOverride");
});

test("clearPageVisibilityOverride persists editor state when live transition apply is blocked", () => {
  assertBlockedBranchDoesNotReturn("clearPageVisibilityOverride");
});
