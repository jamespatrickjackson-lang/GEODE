import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const source = () => readFileSync(resolve(root, "src/public/gateAExperience.ts"), "utf8");
async function policy() {
  const js = ts.transpileModule(source(), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(js.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  return import("data:text/javascript;base64," + Buffer.from(js.outputText).toString("base64"));
}

test("public landing is the default without creating a project", async () => {
  const { resolveGateAExperience } = await policy();
  assert.deepEqual(resolveGateAExperience("", false), {
    mode: "public", initialProjectSlug: null, error: null,
  });
});

test("Utah FORGE is the only permitted public project route", async () => {
  const { resolveGateAExperience, canOpenProject } = await policy();
  const route = resolveGateAExperience("?project=utah-forge", false);
  assert.equal(route.mode, "public");
  assert.equal(route.initialProjectSlug, "utah-forge");
  assert.equal(canOpenProject(route, "utah-forge"), true);
  assert.equal(canOpenProject(route, "woodjam"), false);
  assert.equal(canOpenProject(route, "base-gui"), false);
});

test("invalid, unknown or misleading public routes fail closed with a visible error", async () => {
  const { resolveGateAExperience } = await policy();
  for (const search of [
    "?project=unknown", "?project=woodjam", "?project=base-gui",
    "?project=../utah-forge", "?mode=editor&project=utah-forge",
  ]) {
    const route = resolveGateAExperience(search, false);
    assert.equal(route.mode, "public");
    assert.equal(route.initialProjectSlug, null);
    assert.match(route.error, /unavailable|not supported|developer/i);
  }
});

test("explicit developer workflow remains available only under a development build", async () => {
  const { resolveGateAExperience, canOpenProject } = await policy();
  const dev = resolveGateAExperience("?mode=developer&project=woodjam", true);
  assert.equal(dev.mode, "developer");
  assert.equal(dev.initialProjectSlug, "woodjam");
  assert.equal(canOpenProject(dev, "woodjam"), true);
  const production = resolveGateAExperience("?mode=developer&project=woodjam", false);
  assert.equal(production.mode, "public");
  assert.equal(production.initialProjectSlug, null);
  assert.match(production.error, /development|unavailable/i);
});

test("public view actions are limited to safe navigation and inspection", async () => {
  const { canUseGateACapability } = await policy();
  for (const action of ["project.open", "view.orbit", "view.pan", "view.zoom", "view.reset"]) {
    assert.equal(canUseGateACapability("public", action), true, action);
  }
  assert.equal(canUseGateACapability("developer", "project.save"), true);
});

test("public authoring, import, save and keyboard save cannot cross the action boundary", async () => {
  const { canUseGateACapability, requireGateACapability } = await policy();
  for (const action of [
    "project.create", "project.import", "project.save", "project.write",
    "page.author", "layer.author", "presenter.launch", "capture.advanced",
    "keyboard.save", "dev.writeBatch",
  ]) {
    assert.equal(canUseGateACapability("public", action), false, action);
    assert.throws(() => requireGateACapability("public", action), /not available/i);
  }
});

test("public route does not derive permissions from authored page IDs, titles, count or order", async () => {
  const { resolveGateAExperience, canOpenProject } = await policy();
  for (const pageQuery of ["", "&page=00", "&page=archived-200", "&page=other&order=99"]) {
    const route = resolveGateAExperience("?project=utah-forge" + pageQuery, false);
    assert.equal(canOpenProject(route, "utah-forge"), true);
  }
  assert.doesNotMatch(source(), /pageOrder|pageId|pageTitle|pages\.length|archivedPages/);
});

test("App gates project loading and only mounts the editor in development mode", () => {
  const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  assert.match(app, /resolveGateAExperience/);
  assert.match(app, /canOpenProject\(experience, projectSlug\)/);
  assert.match(app, /experience\.mode === "developer" &&[\s\S]*?<EditorProvider/);
  assert.match(app, /experience\.mode === "public" &&[\s\S]*?<CuratedExplorerShell/);
});

test("public viewer does not mount editing, capture or developer-write UI", () => {
  const shell = readFileSync(resolve(root, "src/public/CuratedExplorerShell.tsx"), "utf8");
  assert.match(shell, /PageControllerProvider/);
  assert.doesNotMatch(shell, /<(?:EditorProvider|EditorRoot|EditorChrome|CaptureDirector|UtahForgeAddToProjectDrop)\b/);
  assert.doesNotMatch(shell, /\b(?:writeFilesBatch|commitPending)\s*\(/);
  const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  assert.match(app, /stopImmediatePropagation/);
  assert.match(app, /addEventListener\("keydown", blockPublicSaveShortcut, true\)/);
  assert.match(app, /experience\.mode !== "developer"\) return;\n    return installDevLayerDiagnostics/);
});

test("production route denies developer mode regardless of direct query parameters", async () => {
  const { resolveGateAExperience } = await policy();
  for (const query of ["?mode=developer", "?mode=developer&project=base-gui"]) {
    const route = resolveGateAExperience(query, false);
    assert.equal(route.mode, "public");
    assert.equal(route.initialProjectSlug, null);
  }
});
