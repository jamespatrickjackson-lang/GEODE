import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

const pageTypes = readSource("src", "pages", "types.ts");
const loadPages = readSource("src", "pages", "loadPages.ts");
const editorTypes = readSource("src", "editor", "types.ts");
const editorContext = readSource("src", "editor", "EditorContext.tsx");
const pageController = readSource("src", "pages", "PageController.tsx");
const pagePanel = readSource("src", "editor", "PagePanel.tsx");
const viteConfig = readSource("vite.config.ts");

test("project and editor state expose active and archived page orders separately", () => {
  assert.match(
    pageTypes,
    /archivedPageOrder\?:\s*string\[\]/,
    "ProjectManifest should type archivedPageOrder as optional string ids.",
  );
  assert.match(
    loadPages,
    /archivedPageOrder/,
    "loadProject should load archived page ids from the manifest.",
  );
  assert.match(
    loadPages,
    /archivedPages:\s*PresentationPage\[\]/,
    "LoadedProject should return archived pages separately from active pages.",
  );
  assert.match(
    editorTypes,
    /archivedPages:\s*PresentationPage\[\]/,
    "EditorState should keep archived pages as a separate ordered collection.",
  );
});

test("editor context exposes archive actions and all editable page lookup", () => {
  for (const expected of [
    "ARCHIVE_PAGE",
    "RESTORE_ARCHIVED_PAGE",
    "MOVE_ARCHIVED_PAGE",
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

  for (const expected of [
    "archivePage",
    "restoreArchivedPage",
    "moveArchivedPage",
    "allEditablePages",
  ]) {
    assert.match(
      editorContext,
      new RegExp(expected),
      `EditorContext should expose ${expected}.`,
    );
  }
});

test("page controller keeps navigation active-only while supporting archived preview", () => {
  assert.match(
    pageController,
    /authoringPages\??:\s*PresentationPage\[\]/,
    "PageControllerProvider should accept all editable authoring pages separately from active pages.",
  );
  for (const expected of [
    "authoringPreviewPageId",
    "previewAuthoringPage",
    "clearAuthoringPreview",
  ]) {
    assert.match(
      pageController,
      new RegExp(expected),
      `PageController should expose ${expected}.`,
    );
  }
  assert.match(
    pageController,
    /allEditablePagesRef/,
    "Sub Master parent lookup should use an all-editable-pages ref.",
  );
});

test("page panel declares archive controls, relationship badges, and archive drag targets", () => {
  for (const id of [
    "page.archive.toggle",
    "page.relationship.badge.master",
    "page.relationship.badge.child",
  ]) {
    assert.match(
      pagePanel,
      new RegExp(`data-editor-control-id="${id}"`),
      `PagePanel should expose ${id}.`,
    );
  }
  assert.match(
    pagePanel,
    /aria-label="Archive"/,
    "Archive header should have a stable accessible label.",
  );
  assert.match(
    pagePanel,
    /archivePage\(/,
    "PagePanel drag should be able to archive active pages.",
  );
  assert.match(
    pagePanel,
    /restoreArchivedPage\(/,
    "PagePanel drag should be able to restore archived pages.",
  );
});

test("build copy filters authoring-only archived pages from output", () => {
  assert.match(
    viteConfig,
    /archivedPageOrder/,
    "Build project copy should inspect archivedPageOrder.",
  );
  assert.match(
    viteConfig,
    /omitArchiveOnlyPageJsonFromBuild/,
    "Build project copy should have an explicit archive-only page filter helper.",
  );
  assert.match(
    viteConfig,
    /sanitizeProjectManifestForBuild/,
    "Build project copy should sanitize emitted project manifests.",
  );
});
