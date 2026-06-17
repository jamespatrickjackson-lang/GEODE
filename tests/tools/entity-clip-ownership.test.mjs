import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Phase 1 of the per-entity clip-ownership move. Validates the pure clip
// behavior resolver against the governing invariant: no transition frame may
// reveal geometry that neither endpoint shows. The module is dependency-free, so
// it is transpiled standalone and imported. No live Utah pages, page ids, page
// order, or fixture pairs are used.

async function loadResolver() {
  const tempRoot = join(
    tmpdir(),
    `geosee-entity-clip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const source = readFileSync(
    join(
      process.cwd(),
      "src",
      "scene",
      "transitions",
      "entityClipOwnership.ts",
    ),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const file = join(tempRoot, "entityClipOwnership.mjs");
  writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}

test("leaving clipped entity holds source clip (no exterior reveal)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: true,
    presentTarget: false,
    clippedSource: true,
    clippedTarget: false,
  });
  assert.equal(d.behavior, "exit-hold");
  assert.equal(d.maskFrom, "source");
  assert.equal(d.maskTo, "source");
  assert.equal(d.pinned, true);
});

test("entering clipped entity applies target clip from frame 0 (no unclipped flash)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: false,
    presentTarget: true,
    clippedSource: false,
    clippedTarget: true,
  });
  assert.equal(d.behavior, "enter");
  assert.equal(d.maskFrom, "target");
  assert.equal(d.maskTo, "target");
  assert.equal(d.pinned, true);
});

test("persisting clipped entity interpolates its own clip (move)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: true,
    presentTarget: true,
    clippedSource: true,
    clippedTarget: true,
  });
  assert.equal(d.behavior, "move");
  assert.equal(d.maskFrom, "source");
  assert.equal(d.maskTo, "target");
  assert.equal(d.pinned, false);
});

test("entity unclipped on both endpoints is inert (clip channel has no work)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: true,
    presentTarget: true,
    clippedSource: false,
    clippedTarget: false,
  });
  assert.equal(d.behavior, "inert");
  assert.equal(d.pinned, false);
});

test("leaving entity that was not clipped has nothing to hold (inert)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: true,
    presentTarget: false,
    clippedSource: false,
    clippedTarget: true,
  });
  assert.equal(d.behavior, "inert");
});

test("entering entity that is not clipped in target has nothing to apply (inert)", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: false,
    presentTarget: true,
    clippedSource: true,
    clippedTarget: false,
  });
  assert.equal(d.behavior, "inert");
});

test("entity absent on both endpoints is inert", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  const d = resolveEntityClipDecision({
    entityId: "e",
    presentSource: false,
    presentTarget: false,
    clippedSource: true,
    clippedTarget: true,
  });
  assert.equal(d.behavior, "inert");
});

test("invariant: a pinned decision never interpolates toward a looser endpoint", async () => {
  const { resolveEntityClipDecision } = await loadResolver();
  // Every present/absent x clipped combination: any pinned decision must have
  // identical mask endpoints (it holds one clip and never loosens mid-fade).
  for (const presentSource of [true, false]) {
    for (const presentTarget of [true, false]) {
      for (const clippedSource of [true, false]) {
        for (const clippedTarget of [true, false]) {
          const d = resolveEntityClipDecision({
            entityId: "e",
            presentSource,
            presentTarget,
            clippedSource,
            clippedTarget,
          });
          if (d.pinned) {
            assert.equal(
              d.maskFrom,
              d.maskTo,
              `pinned decision must hold one endpoint for ${JSON.stringify({
                presentSource,
                presentTarget,
                clippedSource,
                clippedTarget,
              })}`,
            );
          }
        }
      }
    }
  }
});
