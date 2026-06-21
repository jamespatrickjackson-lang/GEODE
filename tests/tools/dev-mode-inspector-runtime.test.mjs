import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();

async function importBundled(entryPoint) {
  const dir = await mkdtemp(join(tmpdir(), "geosee-devmode-test-"));
  const outfile = join(dir, "bundle.mjs");
  await esbuild.build({
    entryPoints: [join(repoRoot, entryPoint)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile,
    logLevel: "silent",
  });
  const mod = await import(pathToFileURL(outfile).href);
  await rm(dir, { recursive: true, force: true });
  return mod;
}

function overlaps(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

const { packLabelRects } = await importBundled(
  "src/editor/devMode/labelLayout.ts",
);

test("packLabelRects preserves count and input order mapping", () => {
  const input = [
    { left: 100, top: 50, width: 160, height: 18 },
    { left: 120, top: 60, width: 160, height: 18 },
    { left: 140, top: 70, width: 160, height: 18 },
  ];
  const out = packLabelRects(input, { width: 1280, height: 800 });
  assert.equal(out.length, input.length);
  for (let i = 0; i < input.length; i += 1) {
    assert.equal(out[i].width, input[i].width);
    assert.equal(out[i].height, input[i].height);
  }
});

test("packLabelRects de-overlaps a stack of identical labels (D4)", () => {
  const input = Array.from({ length: 8 }, () => ({
    left: 100,
    top: 50,
    width: 160,
    height: 18,
  }));
  const out = packLabelRects(input, { width: 1280, height: 800 }, { gap: 4 });
  for (let i = 0; i < out.length; i += 1) {
    for (let j = i + 1; j < out.length; j += 1) {
      assert.ok(
        !overlaps(out[i], out[j]),
        `labels ${i} and ${j} must not overlap`,
      );
    }
  }
});

test("packLabelRects leaves already-separated labels in place", () => {
  const input = [
    { left: 100, top: 50, width: 160, height: 18 },
    { left: 100, top: 200, width: 160, height: 18 },
  ];
  const out = packLabelRects(input, { width: 1280, height: 800 });
  assert.deepEqual(out[0], { left: 100, top: 50, width: 160, height: 18 });
  assert.deepEqual(out[1], { left: 100, top: 200, width: 160, height: 18 });
});

// Phase 2 — control scoping registry.
const { relevantControlGroups } = await importBundled(
  "src/editor/devMode/controlRegistry.ts",
);

test("relevantControlGroups scopes by container type", () => {
  assert.ok(relevantControlGroups("top-level-section-header").includes("header"));
  assert.deepEqual(relevantControlGroups("editor-save-footer"), ["padding-body"]);
  assert.ok(relevantControlGroups("editor-panel").includes("panel"));
  assert.equal(relevantControlGroups("").length, 3); // fallback
});

// Phase 3 — session snapshot / restore.
const { buildRestorePatch, captureSnapshot } = await importBundled(
  "src/editor/devMode/session.ts",
);

test("buildRestorePatch restores snapshot values and clears session-added keys", () => {
  const snapshot = captureSnapshot({ uiScale: 1, panelWidthPx: 500 });
  const current = { uiScale: 1, panelWidthPx: 720, headerGapPx: 30 };
  const patch = buildRestorePatch(current, snapshot);
  assert.equal(patch.uiScale, 1);
  assert.equal(patch.panelWidthPx, 500);
  assert.equal(patch.headerGapPx, undefined); // added during session -> cleared
});

// Phase 5 — reorder index math.
const { computeDropIndex, reorderArray, stepsForMove } = await importBundled(
  "src/editor/devMode/reorder.ts",
);

test("computeDropIndex uses item midpoints", () => {
  const items = [
    { id: "a", top: 0, height: 20 },
    { id: "b", top: 20, height: 20 },
    { id: "c", top: 40, height: 20 },
  ];
  assert.equal(computeDropIndex(items, 5), 0);
  assert.equal(computeDropIndex(items, 25), 1);
  assert.equal(computeDropIndex(items, 45), 2);
  assert.equal(computeDropIndex(items, 100), 3);
});

test("reorderArray and stepsForMove agree on direction", () => {
  assert.deepEqual(reorderArray(["a", "b", "c", "d"], 0, 2), ["b", "a", "c", "d"]);
  assert.deepEqual(reorderArray(["a", "b", "c", "d"], 2, 0), ["c", "a", "b", "d"]);
  assert.deepEqual(stepsForMove(0, 2), ["down"]);
  assert.deepEqual(stepsForMove(2, 0), ["up", "up"]);
  assert.deepEqual(stepsForMove(1, 1), []);
});

// Phase 5/6 — reorder registry + manifest guard.
const { registerReorderGroup, commitReorder, clearReorderGroups } =
  await importBundled("src/editor/devMode/reorderRegistry.ts");

test("commitReorder applies data groups and blocks manifest-guarded groups", () => {
  clearReorderGroups();
  let applied = null;
  registerReorderGroup({
    key: "pages",
    kind: "data",
    label: "Pages",
    commit: (c) => {
      applied = c;
    },
  });
  registerReorderGroup({
    key: "sidebar-structure",
    kind: "manifest-guarded",
    label: "Sidebar structure",
  });

  const ok = commitReorder({
    groupKey: "pages",
    fromIndex: 0,
    toIndex: 2,
    itemId: "p1",
    orderedIds: ["p1", "p2", "p3"],
  });
  assert.equal(ok, true);
  assert.equal(applied.itemId, "p1");

  const blocked = commitReorder({
    groupKey: "sidebar-structure",
    fromIndex: 0,
    toIndex: 1,
    itemId: "bar",
    orderedIds: ["bar", "bar2"],
  });
  assert.equal(blocked, false);

  assert.equal(
    commitReorder({
      groupKey: "unknown",
      fromIndex: 0,
      toIndex: 1,
      itemId: "x",
      orderedIds: [],
    }),
    false,
  );
});
