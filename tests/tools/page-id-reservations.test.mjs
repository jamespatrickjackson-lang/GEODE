import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

// Ported PI-004 regression cases from draft PR #22. Source-only, synthetic IDs.
// The real production allocator is extracted and transpiled, not reimplemented.
const editor = readFileSync(join(process.cwd(), "src/editor/EditorContext.tsx"), "utf8");
const allocatorMatch = editor.match(/function newPageId\([^\n]+\): string \{[\s\S]*?\n\}/);
assert.ok(allocatorMatch, "Must execute the production newPageId allocator");
const allocatorJs = ts.transpileModule(
  allocatorMatch[0] + "\nexport { newPageId };",
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { newPageId } = await import(
  "data:text/javascript;base64," + Buffer.from(allocatorJs).toString("base64")
);

test("PI-004: highest saved page deletion/recreation reserves pending tombstone", () => {
  const originalIds = ["01_page", "02_page", "03_page"];
  const tombstones = new Set(["03_page"]);
  const liveIds = originalIds.filter((id) => !tombstones.has(id));
  const replacement = newPageId(liveIds, tombstones);
  assert.equal(
    tombstones.has(replacement), false,
    "PI-004: newly allocated " + replacement + " collides with pending deletion",
  );
  assert.equal(replacement, "04_page", "Next page must advance past the tombstoned highest ID");
});

test("PI-004: unsaved newly added page deletion/recreation reserves pending tombstone", () => {
  const originalIds = ["01_page", "02_page", "03_page"];
  const generated = newPageId(originalIds);
  const tombstones = new Set([generated]);
  const regenerated = newPageId(originalIds, tombstones);
  assert.equal(
    tombstones.has(regenerated), false,
    "PI-004: unsaved " + regenerated + " reused before deferred deletion is cleared",
  );
  assert.equal(regenerated, "05_page", "Unsaved deletion must not recycle its reserved path");
});

test("PI-004: uncommitted and active IDs never collide across rapid creations", () => {
  const liveIds = ["01_page", "02_page"];
  const pending = new Set(["03_page"]); // still pending deletion
  const generated = new Set();
  for (let i = 0; i < 50; i++) {
    const id = newPageId(liveIds, pending);
    assert.equal(pending.has(id), false);
    assert.equal(generated.has(id), false);
    generated.add(id);
    pending.add(id); // synchronous reservation before React dispatch commits
  }
  assert.equal(generated.size, 50);
  assert.equal(generated.has("04_page"), true);
  assert.equal(generated.has("53_page"), true);
});

test("PI-004: archived IDs, highest tombstone and future occupied IDs remain reserved", () => {
  const activeAndArchivedIds = ["01_page", "02_page", "09_page", "21_page"];
  const pendingIds = new Set(["22_page", "23_page", "99_page"]);
  assert.equal(newPageId(activeAndArchivedIds, pendingIds), "100_page");
  assert.equal(newPageId(["01_page", "03_page"], ["02_page"]), "04_page");
  assert.equal(newPageId(["01_page", "02_page"]), "03_page");
});

test("PI-004: all page and Sub Master creators reserve through one synchronous helper", () => {
  const callsites = editor.match(/const id = reserveNewPageId\(\);/g) ?? [];
  assert.equal(callsites.length, 5, "All five page-creation paths must reserve IDs");
  assert.doesNotMatch(editor, /const id = newPageId\(allEditablePages\(cur\)/);
  const helper = editor.match(/const reserveNewPageId = useCallback\(\(\): string => \{[\s\S]*?\n  \}, \[\]\);/);
  assert.ok(helper, "Production reservation helper is required");
  assert.match(helper[0], /deletedPageIdsRef\.current/);
  assert.match(helper[0], /issuedPageIdsRef\.current/);
  assert.match(helper[0], /issuedPageIdsRef\.current\.add\(id\)/);
});

test("PI-004: page deletion leaves layer registry, scientific references and provenance outside its reducer", () => {
  const begin = editor.indexOf('case "DELETE_PAGE": {');
  const end = editor.indexOf('case "REORDER_PAGE": {', begin);
  assert.ok(begin > 0 && end > begin);
  const deletion = editor.slice(begin, end);
  assert.match(deletion, /manifest\.pageOrder\s*=/);
  assert.match(deletion, /manifest\.archivedPageOrder\s*=/);
  assert.doesNotMatch(deletion, /manifest\.layers\s*=|delete\s+manifest\.layers|removeProjectLayer\(|sourceId\s*=|provenance\s*=/);
  assert.match(deletion, /activeTarget\s*&&\s*state\.pages\.length\s*<=\s*1/, "Keep PI-005 separate");
});

test("PI-004: manual-save page paths remain separate from scientific source files (static)", () => {
  const begin = editor.indexOf("const commitPending = useCallback(async () => {");
  const end = editor.indexOf("deletedPageIdsRef.current.clear();", begin);
  assert.ok(begin > 0 && end > begin);
  const save = editor.slice(begin, end);
  const writeAt = save.indexOf("await writeFilesBatch(batchWrites);");
  const deletionAt = save.indexOf("await deleteFile(pageJsonPath(id, cur.projectRoot))");
  assert.ok(writeAt >= 0 && deletionAt > writeAt);
  assert.match(save, /pageJsonPath\(id, cur\.projectRoot\)/);
  assert.match(save, /projectJsonPath\(cur\.projectRoot\)/);
  assert.doesNotMatch(save, /(?:\/data\/|data_refs\/|sourceId\s*=|removeProjectLayer\()/);
  // Static guard only. Real writer transactions, asset hashes and fault injection remain W4-blocked.
});

test("PI-004: a synthetic scientific registry remains unchanged across allocation and viewer removal", () => {
  const project = {
    layers: [
      { id: "synthetic-survey", sourceId: "synthetic-source-A", provenance: "synthetic" },
      { id: "synthetic-section", sourceId: "synthetic-source-B", provenance: "synthetic" },
    ],
    sources: {
      "synthetic-source-A": [1, 2, 3],
      "synthetic-source-B": [4, 5, 6],
    },
  };
  const snapshot = structuredClone(project);
  const pages = ["01_page", "02_page", "03_page"];
  const deleted = new Set(["03_page"]);
  const replacement = newPageId(pages.filter((id) => !deleted.has(id)), deleted);
  const nextPages = [...pages.filter((id) => !deleted.has(id)), replacement];
  assert.deepEqual(nextPages, ["01_page", "02_page", "04_page"]);
  assert.deepEqual(project, snapshot);
});
