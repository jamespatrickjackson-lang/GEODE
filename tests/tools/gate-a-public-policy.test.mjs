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

function syntheticEvent(key, options = {}) {
  return {
    key,
    ctrlKey: Boolean(options.ctrlKey),
    metaKey: Boolean(options.metaKey),
    altKey: Boolean(options.altKey),
    target: options.target ?? { tagName: "DIV", isContentEditable: false },
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    stopImmediatePropagation() { this.immediateStopped = true; },
  };
}

function syntheticWindow() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, callback, capture) { listeners.push({ type, callback, capture }); },
    removeEventListener(type, callback, capture) {
      const i = listeners.findIndex(x => x.type === type && x.callback === callback && x.capture === capture);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch(event) {
      for (const listener of [...listeners].sort((a, b) => Number(Boolean(b.capture)) - Number(Boolean(a.capture)))) {
        if (event.immediateStopped) break;
        if (listener.type === "keydown") listener.callback(event);
      }
    },
  };
}

test("R1: public viewer consumes page-navigation keys before presentation-page listeners", async () => {
  const { attachPublicKeyboardGuard } = await policy();
  const host = syntheticWindow();
  const consumed = [];
  const detach = attachPublicKeyboardGuard(host, true);
  host.addEventListener("keydown", e => consumed.push(e.key), false); // pre-existing PageController listener
  for (const key of ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "Home", "End"]) {
    const event = syntheticEvent(key);
    host.dispatch(event);
    assert.equal(event.defaultPrevented, true, key);
    assert.equal(event.immediateStopped, true, key);
  }
  assert.deepEqual(consumed, []);
  detach();
  assert.equal(host.listeners.filter(x => x.capture === true).length, 0);
});

test("R1: public landing and editable elements retain normal arrow-key behavior", async () => {
  const { attachPublicKeyboardGuard } = await policy();
  for (const viewerActive of [false, true]) {
    const host = syntheticWindow();
    const consumed = [];
    const detach = attachPublicKeyboardGuard(host, viewerActive);
    host.addEventListener("keydown", e => consumed.push(e.key), false);
    const editable = { tagName: "INPUT", isContentEditable: false };
    const a = syntheticEvent("ArrowLeft", { target: editable });
    host.dispatch(a);
    assert.equal(a.defaultPrevented, false);
    if (!viewerActive) {
      const b = syntheticEvent("PageDown");
      host.dispatch(b);
      assert.equal(b.defaultPrevented, false);
    }
    const ordinary = syntheticEvent("z");
    host.dispatch(ordinary);
    assert.equal(ordinary.defaultPrevented, false);
    assert.ok(consumed.length >= 2);
    detach();
  }
});

test("R3: Ctrl/Cmd+S is captured in public mode, preventing a downstream save handler", async () => {
  const { attachPublicKeyboardGuard } = await policy();
  for (const options of [{ ctrlKey: true }, { metaKey: true }]) {
    for (const viewerActive of [false, true]) {
      const host = syntheticWindow();
      let saves = 0;
      const detach = attachPublicKeyboardGuard(host, viewerActive);
      host.addEventListener("keydown", () => { saves += 1; }, false);
      const event = syntheticEvent("S", options);
      host.dispatch(event);
      assert.equal(event.defaultPrevented, true);
      assert.equal(saves, 0);
      detach();
    }
  }
});

test("R3: denied public actions never invoke their authoring/write callbacks; developer mode preserves them", async () => {
  const { performGateAAction } = await policy();
  for (const capability of ["project.create", "project.import", "project.save", "project.write", "dev.writeBatch", "layer.author", "page.author", "presenter.launch", "capture.advanced"]) {
    let writes = 0;
    const action = () => { writes++; return "done"; };
    assert.throws(() => performGateAAction("public", capability, action), /not available/i);
    assert.equal(writes, 0, capability);
    assert.equal(performGateAAction("developer", capability, action), "done");
    assert.equal(writes, 1, capability);
  }
});

test("R3: public App uses a capture-stage listener; editor is exclusive to developer mode", () => {
  const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  assert.match(app, /attachPublicKeyboardGuard\(window, Boolean\(sceneHandle && project\)\)/);
  assert.match(app, /experience\.mode === "public" &&\s*\(\s*<CuratedExplorerShell/);
  assert.match(app, /experience\.mode === "developer" &&\s*\(\s*<EditorProvider/);
  assert.doesNotMatch(readFileSync(resolve(root, "src/public/CuratedExplorerShell.tsx"), "utf8"), /\bEditorProvider\b\s*\(/);
});

test("R4: public URL helper clears stale developer/page/project query but preserves path and hash", async () => {
  const { publicRouteUrl } = await policy();
  assert.equal(publicRouteUrl("https://example.test/geosee/?mode=developer&project=woodjam&page=123#viewer", "utah-forge"), "/geosee/?project=utah-forge#viewer");
  assert.equal(publicRouteUrl("https://example.test/geosee/?project=utah-forge&page=123#viewer", null), "/geosee/#viewer");
  assert.equal(publicRouteUrl("https://example.test/geosee/?project=utah-forge", null), "/geosee/");
  assert.throws(() => publicRouteUrl("https://example.test/?project=base-gui", "woodjam"), /unavailable|not supported/i);
});

test("R4: public App normalizes URL for CTA and Back, preserving developer URLs", () => {
  const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  assert.match(app, /window\.history\.replaceState\(window\.history\.state, "", publicRouteUrl\(window\.location\.href, projectSlug\)\)/);
  assert.match(app, /window\.history\.replaceState\(window\.history\.state, "", publicRouteUrl\(window\.location\.href, null\)\)/);
  assert.match(app, /if \(experience\.mode === "public" && updatePublicUrl\)/);
});
