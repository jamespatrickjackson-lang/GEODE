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
