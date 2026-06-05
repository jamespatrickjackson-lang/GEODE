import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const viteConfigSource = readFileSync("vite.config.ts", "utf8");
const editorChromeSource = readFileSync("src/editor/EditorChrome.tsx", "utf8");
const layerLoadersSource = readFileSync("src/scene/layerLoaders.ts", "utf8");
const decisionsSource = readFileSync("docs/03-decisions.md", "utf8");

test("Vite manual chunks split scene loaders without raising warning limit", () => {
  assert.match(
    viteConfigSource,
    /function sourceManualChunk\(id: string\): string \| undefined/,
    "vite config should define source-level manual chunk routing.",
  );
  assert.match(
    viteConfigSource,
    /sourcePath\.includes\("\/src\/loaders\/"\)[\s\S]{0,80}return "app-scene-loaders";/,
    "scene loader modules should build as a dedicated source chunk.",
  );
  assert.match(
    viteConfigSource,
    /const sourceChunk = sourceManualChunk\(id\);[\s\S]{0,120}if \(sourceChunk\) return sourceChunk;/,
    "source chunk routing should run before vendor fallback routing.",
  );
  assert.match(
    viteConfigSource,
    /chunkSizeWarningLimit: 600/,
    "build should keep the 600 kB chunk warning guard instead of hiding the warning.",
  );
  assert.doesNotMatch(
    viteConfigSource,
    /onlyExplicitManualChunks/,
    "source chunking should avoid explicit dependency slicing that creates circular chunk warnings.",
  );
});

test("EditorRoot is lazy-loaded instead of bundled into EditorChrome", () => {
  assert.match(
    editorChromeSource,
    /const EditorRoot = lazy\(\(\) =>\s+import\("\.\/EditorRoot"\)/,
    "EditorRoot should be a React lazy boundary.",
  );
  assert.match(
    editorChromeSource,
    /<Suspense fallback=\{null\}>[\s\S]{0,240}<EditorRoot/,
    "EditorRoot should render inside its own Suspense boundary.",
  );
});

test("scene loader registry avoids runtime SceneManager back-reference", () => {
  assert.match(
    layerLoadersSource,
    /import type \{ SceneManager \} from "\.\/SceneManager";/,
    "layerLoaders should import SceneManager as a type-only dependency.",
  );
  assert.doesNotMatch(
    layerLoadersSource,
    /import \{ SceneManager \} from "\.\/SceneManager";/,
    "layerLoaders should not create a runtime SceneManager cycle.",
  );
});

test("decision log records the source chunking contract", () => {
  assert.match(
    decisionsSource,
    /## DEC-104 - Vite source chunks stay at async app boundaries/,
    "DEC-104 should document the code-splitting contract.",
  );
});
