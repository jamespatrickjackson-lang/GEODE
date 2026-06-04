import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

const pagePanel = readSource("src", "editor", "PagePanel.tsx");
const editorContext = readSource("src", "editor", "EditorContext.tsx");
const editorTypes = readSource("src", "editor", "types.ts");

test("page manager uses a drag grip instead of arrow reorder buttons", () => {
  assert.match(
    pagePanel,
    /aria-label="Drag page to reorder"/,
    "Page rows should expose a single grip handle for drag reordering.",
  );
  assert.doesNotMatch(
    pagePanel,
    /aria-label="Move page up"/,
    "The old up arrow reorder button should be removed.",
  );
  assert.doesNotMatch(
    pagePanel,
    /aria-label="Move page down"/,
    "The old down arrow reorder button should be removed.",
  );
  assert.match(
    pagePanel,
    /onPointerDown=\{[^}]*startPageDrag/s,
    "The reorder grip should start pointer-based drag behavior.",
  );
});
test("footer exposes Make Master and Make Child hierarchy actions", () => {
  for (const label of ["Make Master", "Make Child"]) {
    assert.match(
      pagePanel,
      new RegExp(`aria-label="${label}"`),
      `Pages footer should expose ${label}.`,
    );
  }
  assert.match(
    pagePanel,
    /makePageSubMaster\(selectedActionPage\.id\)/,
    "Make Master should convert the selected page into a Sub Master.",
  );
  assert.match(
    pagePanel,
    /duplicateSubMasterAsChild\(selectedActionPage\.id\)/,
    "Make Child should duplicate the selected Sub Master as its child.",
  );
});
test("editor context defines hierarchy conversion and drag reorder actions", () => {
  for (const expected of [
    "MAKE_PAGE_SUB_MASTER",
    "DUPLICATE_SUB_MASTER_AS_CHILD",
    "MOVE_PAGE_BLOCK",
  ]) {
    assert.match(
      editorTypes,
      new RegExp(`type: "${expected}"`),
      `EditorAction should declare ${expected}.`,
    );
    assert.match(
      editorContext,
      new RegExp(`case "${expected}"`),
      `EditorContext reducer should handle ${expected}.`,
    );
  }

  assert.match(
    editorContext,
    /makePageSubMaster:\s*\(pageId:\s*string\)\s*=>\s*void/,
    "EditorContextValue should expose makePageSubMaster.",
  );
  assert.match(
    editorContext,
    /duplicateSubMasterAsChild:\s*\(pageId:\s*string\)\s*=>\s*string\s*\|\s*null/,
    "EditorContextValue should expose duplicateSubMasterAsChild.",
  );
  assert.match(
    editorContext,
    /movePageBlock:\s*\(pageId:\s*string,\s*targetPageId:\s*string\)\s*=>\s*void/,
    "EditorContextValue should expose movePageBlock.",
  );
});
