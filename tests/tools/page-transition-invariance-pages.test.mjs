import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

// #18: pure source/unit tests only. No browser, dev server, project writer or real assets.
// RED is a production allocator + tombstone collision reproduction, NOT an on-disk save.
const editor = readFileSync(join(process.cwd(), "src/editor/EditorContext.tsx"), "utf8");
const fixture = JSON.parse(readFileSync(
  join(process.cwd(), "tests/fixtures/page-transition-invariance/synthetic-project.json"), "utf8"
));
assert.equal(fixture._scope, "SYNTHETIC_ONLY_NO_REAL_GEODE_PROJECT_OR_DATA");

const allocatorMatch = editor.match(/function newPageId\(existingIds: string\[\]\): string \{[\s\S]*?\n\}/);
assert.ok(allocatorMatch, "Must execute the real production allocator, not a test copy");
const allocatorJs = ts.transpileModule(
  allocatorMatch[0] + "\nexport { newPageId };",
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }
).outputText;
const { newPageId } = await import(
  "data:text/javascript;base64," + Buffer.from(allocatorJs).toString("base64")
);

function reducerCase(key, nextKey) {
  const start = editor.indexOf('case "' + key + '": {');
  const end = editor.indexOf('case "' + nextKey + '":', start);
  assert.ok(start >= 0 && end > start, "Source reducer case must be located: " + key);
  return editor.slice(start, end);
}
const deleteReducer = reducerCase("DELETE_PAGE", "REORDER_PAGE");

test("PI-004 RED: highest saved page deletion/recreation reserves pending tombstone", () => {
  const originalIds = fixture.pages.map((p) => p.id);
  const tombstones = new Set([originalIds.at(-1)]);
  const liveIds = originalIds.filter((id) => !tombstones.has(id));
  const replacement = newPageId(liveIds);
  assert.equal(
    tombstones.has(replacement), false,
    "PI-004: newly allocated " + replacement + " collides with pending deletion"
  );
});

test("PI-004 RED: unsaved newly added page deletion/recreation reserves pending tombstone", () => {
  const originalIds = fixture.pages.map((p) => p.id);
  const generated = newPageId(originalIds);
  const tombstones = new Set([generated]);
  const regenerated = newPageId(originalIds);
  assert.equal(
    tombstones.has(regenerated), false,
    "PI-004: unsaved " + regenerated + " reused before deferred deletion is cleared"
  );
});

test("PI-004 source receipt: deletion registers tombstone and Save writes before deleting", () => {
  assert.match(editor, /deletedPageIdsRef\.current\.add\(pageId\)/);
  const writeAt = editor.indexOf("await writeFilesBatch(batchWrites);");
  const deleteAt = editor.indexOf("await deleteFile(pageJsonPath(id, cur.projectRoot))", writeAt);
  assert.ok(writeAt >= 0 && deleteAt > writeAt, "Write then deletion must be verified in production source");
});

test("PI-A/H static guard: page deletion removes page references without removing layer specs", () => {
  assert.match(deleteReducer, /manifest\.pageOrder\s*=/);
  assert.match(deleteReducer, /manifest\.archivedPageOrder\s*=/);
  assert.doesNotMatch(deleteReducer, /manifest\.layers\s*=|delete\s+manifest\.layers|removeProjectLayer\(/);
});

test("PI-005 known constraint: do not assume zero-page support is authorized", () => {
  assert.match(deleteReducer, /activeTarget\s*&&\s*state\.pages\.length\s*<=\s*1/);
  assert.match(editor, /activeTarget\s*&&\s*cur\.pages\.length\s*<=\s*1/);
});

test("PI-B/E fixture-only contract: permutation, duplication and view overrides preserve scientific identities", () => {
  // This checks synthetic contract data, not real reducer behavior or runtime layer availability.
  const project = structuredClone(fixture.project);
  const before = JSON.stringify({ layers: project.layers, sources: project.sources });
  const pages = structuredClone(fixture.pages).reverse();
  pages[0].title = "Renamed arbitrary viewer state";
  pages[0].styleOverrides["synthetic-section"] = { opacity: 0.25 };
  pages.push({ id: "arbitrary-new-view", title: "New", camera: {}, styleOverrides: {}, visibilityOverrides: {} });
  assert.equal(JSON.stringify({ layers: project.layers, sources: project.sources }), before);
  assert.deepEqual(project.layers.map((l) => l.sourceId), ["source:survey-alpha", "source:section-beta", "source:section-beta"]);
  assert.equal(pages.find((p) => p.id === "01_page").styleOverrides["synthetic-section"], undefined);
});

test("PI-F/H static save guard: page commit paths do not address scientific data directories", () => {
  const start = editor.indexOf("const commitPending = useCallback(async () => {");
  const end = editor.indexOf("deletedPageIdsRef.current.clear();", start);
  assert.ok(start >= 0 && end > start, "Expected manual-save source section must exist");
  const commit = editor.slice(start, end);
  assert.match(commit, /pageJsonPath\(id, cur\.projectRoot\)/);
  assert.match(commit, /projectJsonPath\(cur\.projectRoot\)/);
  assert.doesNotMatch(commit, /(?:\/data\/|data_refs\/|sourceId\s*=)/);
});
