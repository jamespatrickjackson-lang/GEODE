import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const collapsibleSectionSource = readFileSync(
  join(repoRoot, "src", "editor", "CollapsibleSection.tsx"),
  "utf8",
);

test("Pages top-level icon uses the compact image-three open-book glyph", () => {
  const pagesBranchStart = collapsibleSectionSource.indexOf(
    'if (normalized === "pages" || normalized.includes("page manager"))',
  );
  const nextBranchStart = collapsibleSectionSource.indexOf(
    'if (normalized.includes("cinematics"))',
    pagesBranchStart,
  );
  const pagesBranch = collapsibleSectionSource.slice(
    pagesBranchStart,
    nextBranchStart,
  );

  assert.ok(
    collapsibleSectionSource.includes("function PagesBookLeafIcon"),
    "CollapsibleSection should define a dedicated Pages book-leaf icon",
  );
  assert.ok(
    pagesBranch.includes("<PagesBookLeafIcon />"),
    "Pages should render the dedicated compact open-book icon",
  );
  assert.ok(
    !pagesBranch.includes('<rect x="6" y="4" width="12" height="16" rx="2" />'),
    "Pages should not use the old flat document rectangle",
  );

  for (const part of [
    'data-editor-icon-part="image-three-left-page"',
    'data-editor-icon-part="image-three-right-page"',
    'data-editor-icon-part="image-three-center-fold"',
    'data-editor-icon-part="image-three-bottom-notch"',
  ]) {
    assert.ok(
      collapsibleSectionSource.includes(part),
      `Pages compact open-book icon should expose ${part}`,
    );
  }

  for (const oldPart of [
    'data-editor-icon-part="open-book-left-top-arc"',
    'data-editor-icon-part="open-book-right-top-arc"',
    'data-editor-icon-part="book-center-spine"',
    'data-editor-icon-part="left-page-side"',
    'data-editor-icon-part="right-page-side"',
    'data-editor-icon-part="open-book-bottom-arc"',
    'data-editor-icon-part="left-book-cover"',
    'data-editor-icon-part="right-book-cover"',
    'data-editor-icon-part="bottom-page-stack"',
  ]) {
    assert.ok(
      !collapsibleSectionSource.includes(oldPart),
      `Pages compact open-book icon should not retain busier previous ${oldPart}`,
    );
  }
});

test("top-level icons do not include coral color snares", () => {
  for (const removed of [
    "EDITOR_UNSAVED_CORAL",
    "coralSnareStrokeStyle",
    "coralSnareFillStyle",
    "CoralSnaredIcon",
    'data-editor-coral-snare="pages"',
    'data-editor-coral-snare="cinematics"',
    'data-editor-coral-snare="sections"',
    'data-editor-coral-snare="topo"',
    'data-editor-coral-snare="forge"',
    'data-editor-coral-snare="cards"',
    "#ff6f7f",
  ]) {
    assert.ok(
      !collapsibleSectionSource.includes(removed),
      `Top-level icons should not include ${removed}`,
    );
  }
});
