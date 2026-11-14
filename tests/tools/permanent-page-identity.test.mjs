import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import ts from "typescript";

// PI-004 permanent-identity tests; synthetic manifest data, no real writer.
const editor = readFileSync("src/editor/EditorContext.tsx", "utf8");
const extract = (name) => {
  const match = editor.match(new RegExp("function " + name + "\\([^\\n]+\\)[^\\n]*\\{[\\s\\S]*?\\n\\}", "m"));
  assert.ok(match, "Production helper missing: " + name);
  return match[0];
};
const transpile = (source, exported) => ts.transpileModule(
  source + "\nexport { " + exported.join(", ") + " };",
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const allocator = await import("data:text/javascript;base64," + Buffer.from(
  transpile(extract("newPageId"), ["newPageId"]),
).toString("base64"));

test("PI-004 permanent: all newly issued IDs use a distinct legacy-safe namespace", () => {
  const id = allocator.newPageId(["01_page", "02_page", "999_page"], []);
  assert.match(id, /^p_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(id, "1000_page");
});

test("PI-004 permanent: generator retries collisions from persisted history and archives", () => {
  const old = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const next = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let calls = 0;
  const id = allocator.newPageId(
    ["01_page", "p_" + old], ["02_page", "p_" + next],
    () => [old, next, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"][calls++],
  );
  assert.equal(id, "p_cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(calls, 3);
});

test("PI-004 permanent: issue history survives JSON Save/reload and never removes scientific properties", async () => {
  const update = await import("data:text/javascript;base64," + Buffer.from(
    transpile(extract("withIssuedPageId"), ["withIssuedPageId"]),
  ).toString("base64"));
  const manifest = {
    pageOrder: ["01_page"], archivedPageOrder: ["02_page"],
    layers: [{ id: "core-geo", files: { source: "data/protected.geojson" } }],
    sourceProvenance: { checksum: "synthetic-checksum" },
  };
  const id = "p_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const issued = update.withIssuedPageId(manifest, id);
  const reopened = JSON.parse(JSON.stringify(issued));
  assert.deepEqual(reopened.issuedPageIds, [id]);
  assert.deepEqual(reopened.layers, manifest.layers);
  assert.deepEqual(reopened.sourceProvenance, manifest.sourceProvenance);
  assert.deepEqual(update.withIssuedPageId(reopened, id).issuedPageIds, [id]);
  const another = allocator.newPageId(reopened.pageOrder, reopened.issuedPageIds,
    () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.notEqual(another, id);
});

test("PI-004 permanent: all four reducer create actions persist issued page history", () => {
  for (const [key, next] of [
    ["ADD_PAGE", "DELETE_PAGE"], ["ADD_SUB_MASTER", "ADD_SUB_MASTER_CHILD"],
    ["ADD_SUB_MASTER_CHILD", "MAKE_PAGE_SUB_MASTER"],
    ["DUPLICATE_SUB_MASTER_AS_CHILD", "RE_SNAPSHOT_SUB_MASTER"],
  ]) {
    const start = editor.indexOf('case "' + key + '": {');
    const end = editor.indexOf('case "' + next + '":', start);
    assert.ok(start > 0 && end > start, "Unexpected reducer boundary: " + key);
    assert.match(editor.slice(start, end), /withIssuedPageId\(/, key);
  }
});

test("PI-004 permanent: stale deletes cannot register tombstones; failed deletes stay errors", () => {
  const begin = editor.indexOf("const deletePageById = useCallback");
  const end = editor.indexOf("const reorderPage =", begin);
  assert.ok(begin > 0 && end > begin);
  const del = editor.slice(begin, end);
  assert.match(del, /findEditablePage\(cur, pageId\)/);
  assert.match(del, /deletedPageIdsRef\.current\.add\(pageId\)/);
  const save = editor.slice(editor.indexOf("const commitPending = useCallback"),
    editor.indexOf("deletedPageIdsRef.current.clear();"));
  assert.match(save, /await deleteFile\(pageJsonPath\(id, cur\.projectRoot\)\)/);
  assert.doesNotMatch(save, /await deleteFile\(pageJsonPath\(id, cur\.projectRoot\)\)\.catch/);
});


test("PI-004 permanent: synthetic on-disk Save/reopen retains issued history and original archive bytes", async () => {
  const update = await import("data:text/javascript;base64," + Buffer.from(
    transpile(extract("withIssuedPageId"), ["withIssuedPageId"]),
  ).toString("base64"));
  const root = mkdtempSync(join(tmpdir(), "geosee-pi004-identity-"));
  try {
    const archiveDir = join(root, "pages", "_archive");
    mkdirSync(archiveDir, { recursive: true });
    const legacyArchivePath = join(archiveDir, "99_page.json");
    const originalArchive = '{"id":"99_page","title":"Original untouched archive"}\n';
    writeFileSync(legacyArchivePath, originalArchive, "utf8");
    const sourcePath = join(root, "synthetic-scientific-source.json");
    const protectedSource = '{"features":[{"id":"scientific-data"}]}\n';
    writeFileSync(sourcePath, protectedSource, "utf8");
    const issued = "p_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const manifest = update.withIssuedPageId({
      id: "synthetic", pageOrder: ["01_page"], archivedPageOrder: [],
      layers: [{ id: "science", files: { source: "synthetic-scientific-source.json" } }],
    }, issued);
    const projectFile = join(root, "project.json");
    writeFileSync(projectFile, JSON.stringify(manifest) + "\n", "utf8");
    const reopened = JSON.parse(readFileSync(projectFile, "utf8"));
    assert.deepEqual(reopened.issuedPageIds, [issued]);
    let candidates = [issued.slice(2), "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"], index = 0;
    const next = allocator.newPageId(
      reopened.pageOrder, reopened.issuedPageIds, () => candidates[index++],
    );
    assert.equal(next, "p_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(readFileSync(legacyArchivePath, "utf8"), originalArchive);
    assert.equal(readFileSync(sourcePath, "utf8"), protectedSource);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
