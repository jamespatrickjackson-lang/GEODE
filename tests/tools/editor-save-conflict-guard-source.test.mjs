import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const authorWritePluginSource = readFileSync(
  "plugins/vite-plugin-author-write.ts",
  "utf8",
);
const saveSource = readFileSync("src/editor/save.ts", "utf8");
const editorContextSource = readFileSync("src/editor/EditorContext.tsx", "utf8");
const decisionsSource = readFileSync("docs/03-decisions.md", "utf8");

test("dev write batches enforce expected disk content preconditions", () => {
  assert.match(
    saveSource,
    /expectedContent\?:\s*string\s*\|\s*null/,
    "save helper should allow callers to pass an expected disk snapshot",
  );
  assert.match(
    authorWritePluginSource,
    /assertExpectedContent/s,
    "author-write plugin should validate expected disk content before writing",
  );
  assert.match(
    authorWritePluginSource,
    /write conflict:[^`]+changed on disk/s,
    "write endpoint should surface stale-save conflicts as write conflicts",
  );
});

test("editor saves compare current disk state before writing dirty project files", () => {
  assert.match(
    editorContextSource,
    /knownDiskContentRef/,
    "editor should track the disk state loaded for each saved entity",
  );
  assert.match(
    editorContextSource,
    /expectedContentForSave/s,
    "editor should compute write preconditions from the current disk state",
  );
  assert.match(
    editorContextSource,
    /expectedContent:\s*await expectedContentForSave/s,
    "editor should pass expected content into the batch write request",
  );
  assert.match(
    editorContextSource,
    /\[editor\] save conflict/,
    "editor should log stale-save conflicts distinctly from generic save errors",
  );
});

test("decision log records stale editor save conflict policy", () => {
  assert.match(
    decisionsSource,
    /DEC-101 - Editor saves reject stale disk snapshots/,
    "decision log should document the conflict guard",
  );
  assert.match(
    decisionsSource,
    /Global Settings.*environment\.json.*stale/s,
    "decision should record the Global Settings stale overwrite failure mode",
  );
});
