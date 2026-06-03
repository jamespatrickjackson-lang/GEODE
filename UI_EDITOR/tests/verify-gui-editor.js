#!/usr/bin/env node
"use strict";

import childProcess from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_EDITOR_ROOT = path.resolve(__dirname, "..");
const TARGET_PATH = "/gui-editor.html";
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");
const DEFAULT_TIMEOUT_MS = 20000;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

function parseArgs(argv) {
  const options = {
    baseUrl: null,
    browser: process.env.GEOSEE_BROWSER || process.env.BROWSER || null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--url" || arg === "--base-url") {
      options.baseUrl = argv[++index];
    } else if (arg.startsWith("--url=")) {
      options.baseUrl = arg.slice("--url=".length);
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--browser") {
      options.browser = argv[++index];
    } else if (arg.startsWith("--browser=")) {
      options.browser = arg.slice("--browser=".length);
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[++index]);
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error("--timeout-ms must be a number greater than or equal to 1000");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node UI_EDITOR\\tests\\verify-gui-editor.js [options]

Options:
  --browser <path>       Use a specific chrome.exe or msedge.exe path.
  --url <base-url>       Use an existing static UI_EDITOR server.
  --timeout-ms <ms>      Browser command timeout. Default: ${DEFAULT_TIMEOUT_MS}.
  -h, --help             Show this help.

Environment:
  GEOSEE_BROWSER         Browser path override.
`);
}

function normalizeBaseUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.hostname !== HOST) {
    throw new Error(`Expected ${HOST} base URL, got ${url.href}`);
  }
  return url.href.replace(/\/+$/, "");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pass(label, detail) {
  console.log(`PASS ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(failures, label, detail) {
  failures.push({ label, detail });
  console.error(`FAIL ${label}${detail ? ` - ${detail}` : ""}`);
}

function info(message) {
  console.log(`INFO ${message}`);
}

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function createStaticServer(rootDir) {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${HOST}`);
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      let filePath = path.resolve(root, `.${decodedPath}`);

      if (decodedPath.endsWith("/")) {
        filePath = path.join(filePath, "index.html");
      }

      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        const type = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
        res.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": type,
        });
        fs.createReadStream(filePath).pipe(res);
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.stack || String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });

  const address = server.address();
  return {
    baseUrl: `http://${HOST}:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function where(command) {
  try {
    return childProcess
      .execFileSync("where.exe", [command], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (_error) {
    return [];
  }
}

function findBrowser(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Browser path does not exist: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [];
  const envDirs = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  for (const dir of envDirs) {
    candidates.push(path.join(dir, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(path.join(dir, "Microsoft", "Edge", "Application", "msedge.exe"));
  }

  candidates.push(...where("chrome.exe"));
  candidates.push(...where("msedge.exe"));
  candidates.push(...where("chrome"));
  candidates.push(...where("msedge"));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Chrome or Edge was not found. Install one or set GEOSEE_BROWSER to the browser executable path.");
  }
  return found;
}

function runBrowser(browserPath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(browserPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Browser command timed out after ${timeoutMs}ms: ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function runHeadless(browserPath, args, timeoutMs) {
  const headlessModes = ["--headless=new", "--headless"];
  let lastResult = null;

  for (const headlessMode of headlessModes) {
    const result = await runBrowser(browserPath, [headlessMode, ...args], timeoutMs);
    lastResult = result;
    if (result.code === 0) {
      return result;
    }
  }

  return lastResult;
}

function createProbeHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>GUI Editor Smoke Probe</title>
</head>
<body>
<pre id="status">pending</pre>
<iframe id="probe" src="${TARGET_PATH}" style="width:1365px;height:900px;border:0"></iframe>
<script>
(function () {
  "use strict";
  var status = document.getElementById("status");
  var frame = document.getElementById("probe");
  var timer = window.setTimeout(function () {
    emit({ error: "Timed out waiting for iframe load" });
  }, 1500);

  function norm(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }

  function isVisible(win, el) {
    if (!el) return false;
    var style = win.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function textOf(el) {
    return norm(el ? el.textContent : "");
  }

  function visibleTextProbe(doc, win, selector, expectedText) {
    var el = doc.querySelector(selector);
    return {
      selector: selector,
      exists: Boolean(el),
      visible: isVisible(win, el),
      text: textOf(el),
      matches: Boolean(el) && textOf(el) === expectedText
    };
  }

  function treeRows(doc) {
    return Array.prototype.slice.call(doc.querySelectorAll(".tree-row"));
  }

  function treeRowByName(doc, name) {
    return treeRows(doc).find(function (row) {
      var label = row.querySelector(".name");
      return textOf(label) === name;
    });
  }

  function treeHasName(doc, name) {
    return Boolean(treeRowByName(doc, name));
  }

  function dispatchInput(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function runInteractions(doc) {
    var out = {};

    var pages = treeRowByName(doc, "Pages");
    out.hasPagesRow = Boolean(pages);
    if (pages) pages.click();

    out.pagesSelected = /Pages/.test(textOf(doc.querySelector("#selInfo")));
    out.notesVisibleAfterSelection = isVisible(doc.defaultView, doc.querySelector("#notesSec h4"));

    var kind = doc.querySelector("#inKind");
    out.kindPickerExists = Boolean(kind);
    if (kind) {
      kind.value = "button";
      dispatchInput(kind, "change");
    }
    out.kindChangedToButton = Boolean(kind) && kind.value === "button";
    out.selectedGlyphAfterKindChange = textOf(doc.querySelector(".tree-row.is-selected .kind"));

    var sidebar = treeRowByName(doc, "Sidebar");
    out.hasSidebarRow = Boolean(sidebar);
    if (sidebar) sidebar.click();

    var addText = doc.querySelector("#addText");
    out.hasAddText = Boolean(addText);
    if (addText) addText.click();
    out.textExistsAfterCreate = treeHasName(doc, "Text");

    var undo = doc.querySelector("#btnUndo");
    var redo = doc.querySelector("#btnRedo");
    out.hasUndoRedo = Boolean(undo && redo);
    if (undo) undo.click();
    out.textRemovedByUndo = !treeHasName(doc, "Text");
    if (redo) redo.click();
    out.textRestoredByRedo = treeHasName(doc, "Text");

    try {
      var saved = JSON.parse(doc.defaultView.localStorage.getItem("gui-editor.layout.v2") || "{}");
      out.savedHostHtml = typeof saved.hostHTML === "string" && saved.hostHTML.indexOf("data-label=\\"Text\\"") !== -1;
    } catch (_error) {
      out.savedHostHtml = false;
    }

    return out;
  }

  function encode(value) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  }

  function emit(value) {
    window.clearTimeout(timer);
    status.textContent = encode(value);
    status.setAttribute("data-ready", "true");
  }

  frame.addEventListener("load", function () {
    try {
      var doc = frame.contentDocument;
      var win = frame.contentWindow;
      var notesHeading = doc.querySelector("#notesSec h4");
      var result = {
        title: doc.title,
        readyState: doc.readyState,
        bodyClass: doc.body ? doc.body.className : "",
        visibleText: norm(doc.body ? doc.body.innerText : ""),
        fullBodyText: norm(doc.body ? doc.body.textContent : ""),
        hasBody: Boolean(doc.body),
        hasMain: Boolean(doc.querySelector(".main")),
        hasStage: Boolean(doc.querySelector("#stage")),
        hasHost: Boolean(doc.querySelector("#host")),
        hasInspector: Boolean(doc.querySelector("#inspector")),
        layers: visibleTextProbe(doc, win, ".layers-head", "Layers"),
        selection: visibleTextProbe(doc, win, ".inspector .insp-sec h4", "Selection"),
        notes: {
          selector: "#notesSec h4",
          exists: Boolean(notesHeading),
          visible: isVisible(win, notesHeading),
          text: textOf(notesHeading),
          matches: Boolean(notesHeading) && textOf(notesHeading) === "Notes"
        },
        interactions: runInteractions(doc)
      };
      emit(result);
    } catch (error) {
      emit({ error: error && error.stack ? error.stack : String(error) });
    }
  });
}());
</script>
</body>
</html>
`;
}

function decodeProbeResult(dumpDom) {
  const match = dumpDom.match(/<pre id="status"[^>]*>([^<]*)<\/pre>/i);
  if (!match) {
    throw new Error("Probe output was not found in --dump-dom output.");
  }

  const payload = match[1].trim();
  if (!payload || payload === "pending") {
    throw new Error("Probe did not finish before --dump-dom captured the page.");
  }

  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
}

function checkText(failures, result) {
  if (result.error) {
    fail(failures, "DOM probe", result.error);
    return;
  }

  if (result.title === "GUI Editor") {
    pass("title", result.title);
  } else {
    fail(failures, "title", `Expected "GUI Editor", got "${result.title || ""}"`);
  }

  if (result.hasBody && result.readyState === "complete" && result.visibleText.length > 20) {
    pass("body loads", `readyState=${result.readyState}, visible text chars=${result.visibleText.length}`);
  } else {
    fail(failures, "body loads", `readyState=${result.readyState}, visible text chars=${result.visibleText.length}`);
  }

  for (const [label, ok] of [
    ["main shell exists", result.hasMain],
    ["stage exists", result.hasStage],
    ["host exists", result.hasHost],
    ["inspector exists", result.hasInspector],
  ]) {
    if (ok) pass(label);
    else fail(failures, label, "Expected selector was missing");
  }

  if (result.layers.exists && result.layers.visible && result.layers.matches) {
    pass("Layers exists", `${result.layers.selector} is visible`);
  } else {
    fail(failures, "Layers exists", JSON.stringify(result.layers));
  }

  if (result.selection.exists && result.selection.visible && result.selection.matches) {
    pass("Selection exists", `${result.selection.selector} is visible`);
  } else {
    fail(failures, "Selection exists", JSON.stringify(result.selection));
  }

  if (result.notes.exists && result.notes.matches) {
    pass("Notes exists", `${result.notes.selector} is present${result.notes.visible ? " and visible" : " and hidden until selection"}`);
  } else {
    fail(failures, "Notes exists", JSON.stringify(result.notes));
  }

  const forbiddenVisibleText = [
    { label: "visible AI note text", pattern: /\bAI(?:[- ]?(?:note|notes|agent|handoff|brief))?\b/i },
    { label: "old dev-mode tagline", pattern: /\bdev[- ]mode\b|\bdevelopment mode\b|\bReact\/Vite package workbench\b/i },
  ];

  for (const forbidden of forbiddenVisibleText) {
    const match = result.visibleText.match(forbidden.pattern);
    if (match) {
      fail(failures, `no ${forbidden.label}`, `Matched visible text: "${match[0]}"`);
    } else {
      pass(`no ${forbidden.label}`);
    }
  }

  const interactions = result.interactions || {};
  const interactionChecks = [
    ["tree Pages row selectable", interactions.hasPagesRow && interactions.pagesSelected],
    ["Notes visible after selection", interactions.notesVisibleAfterSelection],
    ["Kind picker changes to button", interactions.kindPickerExists && interactions.kindChangedToButton],
    ["Tree glyph updates after kind change", interactions.selectedGlyphAfterKindChange === "B"],
    ["Create text from toolbar", interactions.hasAddText && interactions.textExistsAfterCreate],
    ["Undo removes created text", interactions.hasUndoRedo && interactions.textRemovedByUndo],
    ["Redo restores created text", interactions.hasUndoRedo && interactions.textRestoredByRedo],
    ["Saved DOM includes created text", interactions.savedHostHtml],
  ];

  for (const [label, ok] of interactionChecks) {
    if (ok) pass(label);
    else fail(failures, label, JSON.stringify(interactions));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  ensureArtifactsDir();

  const browserPath = findBrowser(options.browser);
  const stamp = timestamp();
  const screenshotPath = path.join(ARTIFACTS_DIR, `gui-editor-smoke-${stamp}.png`);
  const probePath = path.join(ARTIFACTS_DIR, `gui-editor-probe-${stamp}.html`);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "geosee-gui-editor-smoke-"));
  const failures = [];
  let server = null;

  try {
    const baseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : null;
    if (baseUrl) {
      info(`Using existing static server: ${baseUrl}`);
    } else {
      server = await createStaticServer(UI_EDITOR_ROOT);
      info(`Started static server: ${server.baseUrl}`);
    }

    const activeBaseUrl = baseUrl || server.baseUrl;
    const targetUrl = `${activeBaseUrl}${TARGET_PATH}`;
    const probeUrl = `${activeBaseUrl}/tests/artifacts/${path.basename(probePath)}`;
    fs.writeFileSync(probePath, createProbeHtml(), "utf8");

    info(`Browser: ${browserPath}`);
    info(`Target: ${targetUrl}`);
    info("Limitation: dependency-free smoke covers render plus synthetic click/change/undo/redo probes; real pointer drag/drop automation is not covered.");

    const commonArgs = [
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-sync",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-first-run",
      `--user-data-dir=${profileDir}`,
      "--window-size=1365,900",
    ];

    const screenshotResult = await runHeadless(browserPath, [
      ...commonArgs,
      "--virtual-time-budget=1500",
      `--screenshot=${screenshotPath}`,
      targetUrl,
    ], options.timeoutMs);

    if (screenshotResult.code !== 0) {
      fail(failures, "screenshot capture", `Browser exited ${screenshotResult.code || screenshotResult.signal}: ${screenshotResult.stderr.trim()}`);
    } else if (fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 5000) {
      pass("screenshot capture", screenshotPath);
    } else {
      const size = fs.existsSync(screenshotPath) ? fs.statSync(screenshotPath).size : 0;
      fail(failures, "screenshot capture", `Missing or too small screenshot at ${screenshotPath}; size=${size}`);
    }

    const dumpResult = await runHeadless(browserPath, [
      ...commonArgs,
      "--virtual-time-budget=3000",
      "--dump-dom",
      probeUrl,
    ], options.timeoutMs);

    if (dumpResult.code !== 0) {
      fail(failures, "DOM dump", `Browser exited ${dumpResult.code || dumpResult.signal}: ${dumpResult.stderr.trim()}`);
    } else {
      pass("DOM dump");
      const probeResult = decodeProbeResult(dumpResult.stdout);
      checkText(failures, probeResult);
    }

    if (failures.length > 0) {
      console.error(`FAIL gui-editor smoke - ${failures.length} failure(s)`);
      return 1;
    }

    console.log("PASS gui-editor smoke");
    return 0;
  } finally {
    try {
      if (fs.existsSync(probePath)) fs.unlinkSync(probePath);
    } catch (_error) {
      // Best-effort cleanup only; stale probes are artifacts, not test failures.
    }

    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_error) {
      // Best-effort cleanup only.
    }

    if (server) {
      await server.close();
    }
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`FAIL gui-editor smoke - ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
