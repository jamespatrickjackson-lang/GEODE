import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Phase 2 F1 — opacity verb resolver. Pure, dependency-free, transpiled
// standalone and imported. Asserts the resolver reproduces the legacy generic
// opacity-tween decision (parity). No live Utah pages / page ids / order.

async function loadResolver() {
  const tempRoot = join(
    tmpdir(),
    `geosee-behavior-resolver-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const source = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "entityBehaviorResolver.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const file = join(tempRoot, "entityBehaviorResolver.mjs");
  writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}

test("distinct source/target opacity resolves to a fade carrying the endpoints", async () => {
  const { resolveOpacityFade } = await loadResolver();
  const d = resolveOpacityFade({ fromOpacity: 0, toOpacity: 0.8 });
  assert.equal(d.kind, "fade");
  assert.equal(d.from, 0);
  assert.equal(d.to, 0.8);
});

test("fade-out endpoints are carried in order", async () => {
  const { resolveOpacityFade } = await loadResolver();
  const d = resolveOpacityFade({ fromOpacity: 0.86, toOpacity: 0 });
  assert.equal(d.kind, "fade");
  assert.equal(d.from, 0.86);
  assert.equal(d.to, 0);
});

test("source/target within epsilon resolves to constant (no fade)", async () => {
  const { resolveOpacityFade } = await loadResolver();
  const d = resolveOpacityFade({ fromOpacity: 0.5, toOpacity: 0.5 });
  assert.equal(d.kind, "constant");
  const near = resolveOpacityFade({ fromOpacity: 0.5, toOpacity: 0.5005 });
  assert.equal(near.kind, "constant");
});

test("epsilon threshold matches the legacy 0.001 boundary", async () => {
  const { resolveOpacityFade } = await loadResolver();
  // 0.0009 < 0.001 -> constant; 0.002 >= 0.001 -> fade.
  assert.equal(resolveOpacityFade({ fromOpacity: 0, toOpacity: 0.0009 }).kind, "constant");
  assert.equal(resolveOpacityFade({ fromOpacity: 0, toOpacity: 0.002 }).kind, "fade");
});
