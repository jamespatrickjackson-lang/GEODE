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
  }, 5000);

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

  function treeDepth(row) {
    if (!row) return -1;
    var raw = row.style.paddingLeft || "0";
    var px = parseFloat(raw);
    return Number.isFinite(px) ? Math.round((px - 8) / 14) : -1;
  }

  function dispatchInput(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function rowById(doc, id) {
    return doc.querySelector('.tree-row[data-id="' + id + '"]');
  }

  function idsByName(doc, name) {
    return treeRows(doc)
      .filter(function (row) {
        return textOf(row.querySelector(".name")) === name;
      })
      .map(function (row) {
        return row.dataset.id;
      });
  }

  function setField(doc, selector, value, eventType) {
    var field = doc.querySelector(selector);
    if (!field) return false;
    field.value = String(value);
    dispatchInput(field, eventType || "input");
    return true;
  }

  function pointer(win, target, type, x, y, extra) {
    var init = Object.assign({
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      button: type === "pointerup" ? 0 : 0,
      buttons: type === "pointerup" ? 0 : 1,
      isPrimary: true
    }, extra || {});
    var EventCtor = win.PointerEvent || win.MouseEvent;
    target.dispatchEvent(new EventCtor(type, init));
  }

  function clearSelection(doc) {
    var win = doc.defaultView;
    var overlay = doc.querySelector("#overlay");
    var stagePlane = doc.querySelector("#stagePlane");
    if (!overlay || !stagePlane) return;
    var r = stagePlane.getBoundingClientRect();
    pointer(win, overlay, "pointerdown", r.left + 6, r.top + 6);
    pointer(win, win, "pointerup", r.left + 6, r.top + 6);
  }

  function createRootItem(doc, buttonSelector, expectedName) {
    clearSelection(doc);
    var before = idsByName(doc, expectedName);
    var button = doc.querySelector(buttonSelector);
    if (!button) return "";
    button.click();
    var afterRows = treeRows(doc).filter(function (row) {
      return textOf(row.querySelector(".name")) === expectedName &&
        before.indexOf(row.dataset.id) === -1;
    });
    var row = afterRows[afterRows.length - 1] || treeRowByName(doc, expectedName);
    return row ? row.dataset.id : "";
  }

  function setSelectedBox(doc, box) {
    if (box.x != null) setField(doc, "#inX", box.x);
    if (box.y != null) setField(doc, "#inY", box.y);
    if (box.w != null) setField(doc, "#inW", box.w);
    if (box.h != null) setField(doc, "#inH", box.h);
    if (box.padT != null) setField(doc, "#inPadT", box.padT);
    if (box.padR != null) setField(doc, "#inPadR", box.padR);
    if (box.padB != null) setField(doc, "#inPadB", box.padB);
    if (box.padL != null) setField(doc, "#inPadL", box.padL);
  }

  function selectRowId(doc, id) {
    var row = rowById(doc, id);
    if (row) row.click();
    return row;
  }

  function outlineFor(doc, id) {
    return doc.querySelector('.dev-outline[data-target="' + id + '"]');
  }

  function dragOutlineTo(doc, id, finalClientLeft, finalClientTop, gripX, gripY, extra) {
    var win = doc.defaultView;
    selectRowId(doc, id);
    var outline = outlineFor(doc, id);
    if (!outline) return { moved: false, guideVisible: false };
    var r = outline.getBoundingClientRect();
    var sx = r.left + gripX;
    var sy = r.top + gripY;
    var tx = finalClientLeft + gripX;
    var ty = finalClientTop + gripY;
    pointer(win, outline, "pointerdown", sx, sy, extra);
    pointer(win, win, "pointermove", tx, ty, extra);
    var guideVisible = Boolean(doc.querySelector(".snap-line.v, .snap-line.h"));
    pointer(win, win, "pointerup", tx, ty, extra);
    return { moved: true, guideVisible: guideVisible };
  }

  function directChildIds(parentEl) {
    return Array.prototype.slice.call(parentEl ? parentEl.children : [])
      .filter(function (child) {
        return child.dataset && child.dataset.cid;
      })
      .map(function (child) {
        return child.dataset.cid;
      });
  }

  function dragLibraryLabelTo(doc, tier, label, clientX, clientY) {
    var win = doc.defaultView;
    var tab = doc.querySelector('[data-library-tab="' + tier + '"]');
    if (tab) tab.click();
    var items = Array.prototype.slice.call(doc.querySelectorAll('[data-library-item][data-library-tier="' + tier + '"]'));
    var item = items.find(function (candidate) {
      var labelEl = candidate.querySelector("[data-library-label]");
      return norm(labelEl ? labelEl.textContent : candidate.textContent) === label;
    });
    if (!item || !win.DataTransfer || !win.DragEvent) return false;
    var data = new win.DataTransfer();
    item.dispatchEvent(new win.DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data, clientX: clientX, clientY: clientY }));
    var overlay = doc.querySelector("#overlay");
    overlay.dispatchEvent(new win.DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data, clientX: clientX, clientY: clientY }));
    overlay.dispatchEvent(new win.DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data, clientX: clientX, clientY: clientY }));
    item.dispatchEvent(new win.DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: data, clientX: clientX, clientY: clientY }));
    return true;
  }

  function runPlacementInteractions(doc) {
    var out = {};
    var win = doc.defaultView;

    out.behaviorLogExists = Boolean(doc.querySelector("#behaviorLog"));

    var snapAnchorId = createRootItem(doc, "#addRect", "Rect");
    if (snapAnchorId) {
      selectRowId(doc, snapAnchorId);
      setSelectedBox(doc, { x: 920, y: 90, w: 120, h: 64 });
    }
    var snapMoverId = createRootItem(doc, "#addRect", "Rect");
    if (snapMoverId) {
      selectRowId(doc, snapMoverId);
      setSelectedBox(doc, { x: 650, y: 90, w: 80, h: 64 });
    }
    var anchorEl = doc.querySelector('[data-cid="' + snapAnchorId + '"]');
    var moverEl = doc.querySelector('[data-cid="' + snapMoverId + '"]');
    out.snapToSiblingEdge = false;
    out.smartGuideVisibleDuringDrag = false;
    if (anchorEl && moverEl) {
      var anchorRect = anchorEl.getBoundingClientRect();
      var moverRect = moverEl.getBoundingClientRect();
      var desiredLeft = anchorRect.left - moverRect.width + 4;
      var snapDrag = dragOutlineTo(doc, snapMoverId, desiredLeft, moverRect.top, 20, 20);
      var snappedRect = moverEl.getBoundingClientRect();
      out.smartGuideVisibleDuringDrag = snapDrag.guideVisible;
      out.snapToSiblingEdge = Math.abs(snappedRect.right - anchorRect.left) <= 1.5;
    }

    var parentId = createRootItem(doc, "#btnAdd", "Container");
    if (parentId) {
      selectRowId(doc, parentId);
      setSelectedBox(doc, { x: 620, y: 245, w: 240, h: 160, padT: 24, padR: 24, padB: 24, padL: 24 });
    }
    var wideRectId = createRootItem(doc, "#addRect", "Rect");
    if (wideRectId) {
      selectRowId(doc, wideRectId);
      setSelectedBox(doc, { x: 120, y: 560, w: 300, h: 90 });
    }
    out.autoNestByOverlap = false;
    out.autoNestPreservesVisualPlacement = false;
    var parentEl = doc.querySelector('[data-cid="' + parentId + '"]');
    var wideRectEl = doc.querySelector('[data-cid="' + wideRectId + '"]');
    if (parentEl && wideRectEl) {
      var parentRect = parentEl.getBoundingClientRect();
      var beforeRect = wideRectEl.getBoundingClientRect();
      var targetLeft = parentRect.left + 10;
      var targetTop = parentRect.top + 34;
      dragOutlineTo(doc, wideRectId, targetLeft, targetTop, beforeRect.width - 4, 24, { ctrlKey: true });
      var afterRect = wideRectEl.getBoundingClientRect();
      out.autoNestByOverlap = wideRectEl.parentElement === parentEl && treeDepth(rowById(doc, wideRectId)) > treeDepth(rowById(doc, parentId));
      out.autoNestPreservesVisualPlacement = Math.abs(afterRect.left - targetLeft) <= 1.5 && Math.abs(afterRect.top - targetTop) <= 1.5;
    }

    var leafId = createRootItem(doc, "#addText", "Text");
    if (leafId) {
      selectRowId(doc, leafId);
      setSelectedBox(doc, { x: 980, y: 390, w: 100, h: 28 });
    }
    var beforeParent = wideRectEl ? wideRectEl.parentElement : null;
    var leafEl = doc.querySelector('[data-cid="' + leafId + '"]');
    out.invalidDropRejectedAndLogged = false;
    if (wideRectEl && leafEl) {
      var leafRect = leafEl.getBoundingClientRect();
      var moverNow = wideRectEl.getBoundingClientRect();
      dragOutlineTo(doc, wideRectId, leafRect.left + 4, leafRect.top + 2, Math.min(28, moverNow.width - 2), 14);
      var logText = textOf(doc.querySelector("#behaviorLog"));
      out.invalidDropRejectedAndLogged = wideRectEl.parentElement === beforeParent && /reject|cannot|invalid/i.test(logText);
    }

    if (parentId) selectRowId(doc, parentId);
    var orderAId = "";
    var orderBId = "";
    var textBefore = idsByName(doc, "Text");
    var addText = doc.querySelector("#addText");
    if (addText) addText.click();
    orderAId = idsByName(doc, "Text").filter(function (id) { return textBefore.indexOf(id) === -1; })[0] || "";
    if (parentId) selectRowId(doc, parentId);
    textBefore = idsByName(doc, "Text");
    if (addText) addText.click();
    orderBId = idsByName(doc, "Text").filter(function (id) { return textBefore.indexOf(id) === -1; })[0] || "";
    out.treeReorderBeforeLeaf = false;
    if (orderAId && orderBId && parentEl && win.DataTransfer && win.DragEvent) {
      var rowA = rowById(doc, orderAId);
      var rowB = rowById(doc, orderBId);
      var data = new win.DataTransfer();
      var rowARect = rowA.getBoundingClientRect();
      rowB.dispatchEvent(new win.DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data, clientY: rowA.getBoundingClientRect().top + 2 }));
      rowA.dispatchEvent(new win.DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data, clientY: rowARect.top + 1 }));
      rowA.dispatchEvent(new win.DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data, clientY: rowARect.top + 1 }));
      rowB.dispatchEvent(new win.DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: data }));
      var order = directChildIds(parentEl);
      out.treeReorderBeforeLeaf = order.indexOf(orderBId) !== -1 && order.indexOf(orderAId) !== -1 &&
        order.indexOf(orderBId) < order.indexOf(orderAId);
    }

    out.libraryDragDropIntoPadding = false;
    if (parentId && parentEl) {
      selectRowId(doc, parentId);
      var beforeButtons = idsByName(doc, "Visibility eye button");
      var parentDropRect = parentEl.getBoundingClientRect();
      var dropped = dragLibraryLabelTo(doc, "component", "Visibility eye button", parentDropRect.left + 52, parentDropRect.top + 52);
      var newButtonId = idsByName(doc, "Visibility eye button").filter(function (id) {
        return beforeButtons.indexOf(id) === -1;
      })[0] || "";
      var newButtonEl = newButtonId ? doc.querySelector('[data-cid="' + newButtonId + '"]') : null;
      if (dropped && newButtonEl) {
        var nr = newButtonEl.getBoundingClientRect();
        var pr = parentEl.getBoundingClientRect();
        out.libraryDragDropIntoPadding = newButtonEl.parentElement === parentEl &&
          nr.left >= pr.left + 22 &&
          nr.top >= pr.top + 22;
      }
    }

    try {
      var saved = JSON.parse(win.localStorage.getItem("gui-editor.layout.v2") || "{}");
      out.placementPersistence = typeof saved.hostHTML === "string" &&
        saved.hostHTML.indexOf('data-cid="' + wideRectId + '"') !== -1 &&
        saved.hostHTML.indexOf('data-cid="' + orderBId + '"') < saved.hostHTML.indexOf('data-cid="' + orderAId + '"');
    } catch (_error) {
      out.placementPersistence = false;
    }

    return out;
  }

  function runInteractions(doc) {
    var out = {};

    function clickLibraryTab(tier) {
      var tab = doc.querySelector('[data-library-tab="' + tier + '"]');
      if (tab) tab.click();
      return tab;
    }

    function libraryLabels(tier) {
      clickLibraryTab(tier);
      return Array.prototype.slice.call(doc.querySelectorAll('[data-library-item][data-library-tier="' + tier + '"]'))
        .map(function (item) {
          var label = item.querySelector("[data-library-label]");
          return norm(label ? label.textContent : item.textContent);
        });
    }

    function hasLabels(tier, expected) {
      var labels = libraryLabels(tier);
      return expected.every(function (label) {
        return labels.indexOf(label) !== -1;
      });
    }

    function clickLibraryLabel(tier, label) {
      clickLibraryTab(tier);
      var items = Array.prototype.slice.call(doc.querySelectorAll('[data-library-item][data-library-tier="' + tier + '"]'));
      var match = items.find(function (item) {
        var labelEl = item.querySelector("[data-library-label]");
        var itemLabel = norm(labelEl ? labelEl.textContent : item.textContent);
        return itemLabel === label;
      });
      if (match) match.click();
      return Boolean(match);
    }

    function tierHasVisualPreviews(tier) {
      clickLibraryTab(tier);
      var items = Array.prototype.slice.call(doc.querySelectorAll('[data-library-item][data-library-tier="' + tier + '"]'));
      if (!items.length) return false;
      return items.every(function (item) {
        var preview = item.querySelector("[data-library-preview]");
        return preview && isVisible(doc.defaultView, preview) && preview.getBoundingClientRect().height >= 30;
      });
    }

    function previewHasVisibleContent(item) {
      if (!item) return false;
      var preview = item.querySelector("[data-library-preview]");
      if (!preview || !isVisible(doc.defaultView, preview)) return false;
      var pr = preview.getBoundingClientRect();
      var nodes = Array.prototype.slice.call(preview.querySelectorAll("svg, [data-c], .lib-preview-swatch, .lib-preview-token, .lib-preview-style, span"));
      return nodes.some(function (node) {
        var r = node.getBoundingClientRect();
        var overlaps = r.right > pr.left && r.left < pr.right && r.bottom > pr.top && r.top < pr.bottom;
        return overlaps && r.width >= 4 && r.height >= 4;
      });
    }

    out.hasEditorModes = Boolean(
      doc.querySelector("#modeComponent") &&
      doc.querySelector("#modeAssembly") &&
      doc.querySelector("#modeProduct")
    );
    out.topbarHasNamedSections = [
      "Mode",
      "View",
      "Background",
      "Create",
      "Arrange",
      "Align",
      "History"
    ].every(function (name) {
      var section = doc.querySelector('[data-toolbar-section="' + name + '"]');
      var label = section && section.querySelector(".toolbar-section-label");
      return section && label && isVisible(doc.defaultView, label) && textOf(label) === name;
    });
    out.topbarUsesIconButtons = [
      "#modeComponent",
      "#modeAssembly",
      "#modeProduct",
      "#btnDev",
      "#btnGrid",
      "#btnSnap",
      "#btnBgUrl",
      "#btnBgImage",
      "#btnBgClear",
      "#btnAdd",
      "#addText",
      "#addRect",
      "#addEllipse",
      "#addLine",
      "#addIcon",
      "#addDivider",
      "#addSwatch",
      "#addInput",
      "#addRow",
      "#btnGroup",
      "#btnUngroup",
      "#btnDelete",
      "#alignL",
      "#alignC",
      "#alignR",
      "#alignT",
      "#alignM",
      "#alignB",
      "#distH",
      "#distV",
      "#btnUndo",
      "#btnRedo",
      "#btnReset"
    ].every(function (selector) {
      var button = doc.querySelector(selector);
      return button && button.querySelector(".tb-icon");
    });
    out.topbarIconButtonsKeepAccessibleNames = Array.prototype.slice.call(doc.querySelectorAll(".topbar button.tb")).every(function (button) {
      return Boolean(norm(button.getAttribute("title")) || norm(button.textContent) || norm(button.getAttribute("aria-label")));
    });
    var assemblyMode = doc.querySelector("#modeAssembly");
    if (assemblyMode) assemblyMode.click();
    out.assemblyModeActive = doc.body && doc.body.dataset.editorMode === "assembly";
    var productMode = doc.querySelector("#modeProduct");
    if (productMode) productMode.click();
    out.productModeActive = doc.body && doc.body.dataset.editorMode === "product";

    out.hasLibraryPanel = Boolean(doc.querySelector("#libraryPanel"));
    out.libraryPanelIsFloating = false;
    var libraryPanel = doc.querySelector("#libraryPanel");
    var layersPanel = doc.querySelector(".layers");
    if (libraryPanel && layersPanel) {
      var libraryStyle = doc.defaultView.getComputedStyle(libraryPanel);
      var libraryRect = libraryPanel.getBoundingClientRect();
      var layersRect = layersPanel.getBoundingClientRect();
      out.libraryPanelIsFloating = libraryStyle.position === "absolute" &&
        Number(libraryStyle.zIndex || 0) >= 10 &&
        libraryRect.left >= layersRect.right - 1 &&
        libraryRect.top > layersRect.top;
    }
    out.libraryHasSearchLogic = Boolean(doc.querySelector("#librarySearch") && doc.querySelector("#librarySearchCount"));
    out.hasLibraryTabs = [
      "component",
      "assembly",
      "product",
      "colour",
      "icon",
      "token",
      "style"
    ].every(function (kind) {
      return Boolean(doc.querySelector('[data-library-tab="' + kind + '"]'));
    });
    out.hasGeoSeeVariablePresets = Boolean(
      doc.querySelector('#geoPreset option[value="overlay-card"]') &&
      doc.querySelector('#geoPreset option[value="navigator"]') &&
      doc.querySelector('#geoPreset option[value="editor-chrome"]') &&
      doc.querySelector('#geoPreset option[value="label"]')
    );
    out.hasExpandedCreateTools = Boolean(
      doc.querySelector("#addLine") &&
      doc.querySelector("#addIcon") &&
      doc.querySelector("#addDivider") &&
      doc.querySelector("#addSwatch") &&
      doc.querySelector("#addInput")
    );
    out.hasGeoSeeComponentLibrary = hasLabels("component", [
      "Visibility eye button",
      "Disclosure chevron",
      "Slider track",
      "Slider thumb",
      "Override checkbox",
      "Number readout",
      "Material line",
      "Label chip"
    ]);
    out.hasGeoSeeAssemblyLibrary = hasLabels("assembly", [
      "Editor header row",
      "Top-level section header",
      "Nested section header",
      "Layer visibility row",
      "Override style row",
      "Provenance field row",
      "Slider control row",
      "Save footer"
    ]);
    out.hasGeoSeeProductLibrary = hasLabels("product", [
      "GeoSee editor sidebar",
      "Page manager sidebar",
      "Cards editor",
      "Layer card stack",
      "Topo material panel",
      "Floating preview HUD"
    ]);
    out.hasGeoSeeColourLibrary = hasLabels("colour", [
      "Overlay background #121518",
      "Warm text #f4f0e8",
      "Secondary text #b6c3cf",
      "Terrain ramp low #4f4a40",
      "Mist volume #dfe4e8"
    ]);
    out.hasGeoSeeTokenLibrary = hasLabels("token", [
      "Editor panel width 512",
      "UI scale 0.75",
      "Section gap 10",
      "Pill inset 24",
      "Slider track 8",
      "Slider thumb 20",
      "Overlay blur 20",
      "Mist opacity 0.18"
    ]);
    out.hasGeoSeeStyleLibrary = hasLabels("style", [
      "Overlay card glass",
      "Navigator glass",
      "Editor chrome shell",
      "Top-level heading bar",
      "Nested heading bar",
      "Scene label pill",
      "Terrain material ramp",
      "Mist volume material"
    ]);
    out.libraryItemsHaveVisualPreviews = [
      "component",
      "assembly",
      "product",
      "colour",
      "icon",
      "token",
      "style"
    ].every(tierHasVisualPreviews);
    out.libraryPreviewScaleControlExists = Boolean(
      doc.querySelector("#libraryPreviewScale") &&
      doc.querySelector("#libraryPreviewScaleValue")
    );
    out.libraryPreviewScaleApplies = false;
    var previewScale = doc.querySelector("#libraryPreviewScale");
    if (previewScale) {
      clickLibraryTab("component");
      var previewBefore = doc.querySelector("[data-library-preview]");
      var beforeHeight = previewBefore ? previewBefore.getBoundingClientRect().height : 0;
      previewScale.value = "1.6";
      dispatchInput(previewScale, "input");
      var previewAfter = doc.querySelector("[data-library-preview]");
      var afterHeight = previewAfter ? previewAfter.getBoundingClientRect().height : 0;
      var panel = doc.querySelector("#libraryPanel");
      var cssHeight = panel ? panel.style.getPropertyValue("--library-preview-height") : "";
      var cssScale = panel ? panel.style.getPropertyValue("--library-preview-scale") : "";
      out.libraryPreviewScaleApplies = doc.body.dataset.libraryPreviewScale === "1.6" &&
        previewScale.value === "1.6" &&
        cssScale === "1.6" &&
        cssHeight === "83px" &&
        afterHeight >= beforeHeight;
    }
    out.iconLibraryHasAllPackageIcons = hasLabels("icon", [
      "Add",
      "Trash",
      "Duplicate",
      "Reset",
      "Eye",
      "Eye off",
      "Triangle up",
      "Triangle down",
      "Refresh",
      "Camera",
      "Focus",
      "Dot"
    ]);
    clickLibraryTab("icon");
    out.iconLibraryShowsSvgPreviews = doc.querySelectorAll('[data-library-item][data-library-tier="icon"] [data-library-preview] svg').length >= 12;
    out.packageLibraryReady = doc.body && doc.body.dataset.packageLibraryReady === "true";
    out.hasPackageBackedLibraryEntries =
      hasLabels("component", ["Inline editable text", "Dirty dot", "Select dropdown"]) &&
      hasLabels("product", ["Camera Studio", "Environment Studio", "Overlay Box Manager"]) &&
      hasLabels("colour", ["Page accent pink", "Editor field background", "Divider hairline"]) &&
      hasLabels("token", ["Font body size", "Radius full", "Section gap Y"]) &&
      hasLabels("style", ["Panel primary", "Card vibrancy", "Accent warning"]);
    out.hasExtendedStyleInspector = Boolean(
      doc.querySelector("#inBorderColor") &&
      doc.querySelector("#inBorderA") &&
      doc.querySelector("#inTextColor") &&
      doc.querySelector("#inFontSize") &&
      doc.querySelector("#inFontFamily") &&
      doc.querySelector("#inFontWeight") &&
      doc.querySelector("#inBlur") &&
      doc.querySelector("#inSaturation") &&
      doc.querySelector("#inShadowA") &&
      doc.querySelector("#inLineWidth") &&
      doc.querySelector("#inOpacity")
    );

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
    sidebar = treeRowByName(doc, "Sidebar");
    if (sidebar) sidebar.click();
    out.tokenPanelWidthApplied = false;
    if (clickLibraryLabel("token", "Editor panel width 512")) {
      var widthInput = doc.querySelector("#inW");
      out.tokenPanelWidthApplied = Boolean(widthInput) && widthInput.value === "512";
    }
    out.styleEditorChromeApplied = false;
    if (clickLibraryLabel("style", "Editor chrome shell")) {
      try {
        var sidebarId = doc.querySelector(".tree-row.is-selected");
        var selectedText = sidebarId ? textOf(sidebarId.querySelector(".name")) : "";
        var savedAfterStyle = JSON.parse(doc.defaultView.localStorage.getItem("gui-editor.layout.v2") || "{}");
        var selectedIds = Array.isArray(savedAfterStyle.selected) ? savedAfterStyle.selected : [];
        var selectedState = selectedIds.length ? savedAfterStyle.layout[selectedIds[0]] : null;
        out.styleEditorChromeApplied = selectedText === "Sidebar" &&
          selectedState &&
          selectedState.style &&
          selectedState.style.blur === 20 &&
          selectedState.style.saturation === 145;
      } catch (_error) {
        out.styleEditorChromeApplied = false;
      }
    }
    out.productLibraryInstantiation = clickLibraryLabel("product", "Topo material panel") &&
      treeHasName(doc, "Topo material panel");
    sidebar = treeRowByName(doc, "Sidebar");
    if (sidebar) sidebar.click();
    var padTop = doc.querySelector("#inPadT");
    var padLeft = doc.querySelector("#inPadL");
    if (padTop && padLeft) {
      padTop.value = "32";
      dispatchInput(padTop, "input");
      padLeft.value = "40";
      dispatchInput(padLeft, "input");
    }
    out.paddingOverlayVisible = doc.querySelectorAll(".pad-shade").length >= 2;
    var sidebarIdForPadding = sidebar ? sidebar.dataset.id : "";
    var sidebarElForPadding = sidebarIdForPadding ? doc.querySelector('[data-cid="' + sidebarIdForPadding + '"]') : null;

    var textIdsBeforeCreate = treeRows(doc)
      .filter(function (row) { return textOf(row.querySelector(".name")) === "Text"; })
      .map(function (row) { return row.dataset.id; });
    var addText = doc.querySelector("#addText");
    out.hasAddText = Boolean(addText);
    if (addText) addText.click();
    out.textExistsAfterCreate = treeHasName(doc, "Text");
    var textRow = treeRows(doc).find(function (row) {
      return textOf(row.querySelector(".name")) === "Text" &&
        textIdsBeforeCreate.indexOf(row.dataset.id) === -1;
    }) || treeRowByName(doc, "Text");
    var createdTextId = textRow ? textRow.dataset.id : "";
    out.textNestedUnderSidebar = treeDepth(textRow) > treeDepth(sidebar);
    out.paddedNestedChildStartsInsideInset = false;
    if (createdTextId && sidebarElForPadding) {
      var childEl = doc.querySelector('[data-cid="' + createdTextId + '"]');
      var childRect = childEl ? childEl.getBoundingClientRect() : null;
      var parentRect = sidebarElForPadding.getBoundingClientRect();
      out.paddedNestedChildStartsInsideInset = Boolean(childRect) &&
        childRect.left >= parentRect.left + 38 &&
        childRect.top >= parentRect.top + 30;
    }

    var undo = doc.querySelector("#btnUndo");
    var redo = doc.querySelector("#btnRedo");
    out.hasUndoRedo = Boolean(undo && redo);
    if (undo) undo.click();
    out.textRemovedByUndo = Boolean(createdTextId) && !doc.querySelector('.tree-row[data-id="' + createdTextId + '"]');
    if (redo) redo.click();
    out.textRestoredByRedo = Boolean(createdTextId) && Boolean(doc.querySelector('.tree-row[data-id="' + createdTextId + '"]'));

    var saveComponent = doc.querySelector("#saveComponent");
    out.hasSaveComponent = Boolean(saveComponent);
    if (saveComponent) saveComponent.click();
    out.savedComponentInLibrary = Boolean(doc.querySelector('[data-library-item][data-library-tier="component"]'));
    out.savedComponentPreviewHasVisibleContent = previewHasVisibleContent(doc.querySelector('[data-library-item][data-library-tier="component"]'));

    var libraryItem = doc.querySelector('[data-library-item][data-library-tier="component"]');
    if (libraryItem) libraryItem.click();
    out.libraryInstantiationCreatedSelection = /Component|Text/.test(textOf(doc.querySelector("#selInfo")));

    var addLine = doc.querySelector("#addLine");
    var addIcon = doc.querySelector("#addIcon");
    var addDivider = doc.querySelector("#addDivider");
    var addSwatch = doc.querySelector("#addSwatch");
    var addInput = doc.querySelector("#addInput");
    if (addLine) addLine.click();
    if (addIcon) addIcon.click();
    var iconRow = treeRowByName(doc, "Icon");
    if (iconRow) iconRow.click();
    out.iconLibraryInstantiation = clickLibraryLabel("icon", "Camera") &&
      Boolean(doc.querySelector('[data-kind="icon"] svg[aria-label="Camera"]'));
    if (addDivider) addDivider.click();
    if (addSwatch) addSwatch.click();
    if (addInput) addInput.click();
    out.createdLine = treeHasName(doc, "Line");
    out.createdIcon = treeHasName(doc, "Icon");
    out.createdDivider = treeHasName(doc, "Divider");
    out.createdSwatch = treeHasName(doc, "Swatch");
    out.createdInput = treeHasName(doc, "Input");

    out.placement = runPlacementInteractions(doc);

    var zoomBefore = doc.body.dataset.stageZoom || "1";
    var wheelTarget = doc.querySelector("#stageWrap");
    if (wheelTarget) {
      wheelTarget.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -240,
        clientX: 500,
        clientY: 300
      }));
    }
    out.wheelZoomChangesStage = doc.body.dataset.stageZoom !== zoomBefore &&
      Boolean(doc.querySelector("#zoomState")) &&
      /%/.test(textOf(doc.querySelector("#zoomState")));

    var bgInput = doc.querySelector("#bgUrlInput");
    var bgButton = doc.querySelector("#btnBgUrl");
    var bgData = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='%2375c7ff'/%3E%3Ccircle cx='40' cy='30' r='18' fill='%23f4f0e8'/%3E%3C/svg%3E";
    out.backgroundControlsExist = Boolean(bgInput && bgButton && doc.querySelector("#bgImageInput") && doc.querySelector("#btnBgImage"));
    if (bgInput && bgButton) {
      bgInput.value = bgData;
      bgButton.click();
    }
    var stage = doc.querySelector("#stage");
    out.backgroundImageLoads = doc.body.dataset.stageBackground === "true" &&
      Boolean(stage) &&
      /data:image\\/svg/.test(stage.style.getPropertyValue("--stage-bg-image"));

    try {
      var saved = JSON.parse(doc.defaultView.localStorage.getItem("gui-editor.layout.v2") || "{}");
      out.savedHostHtml = typeof saved.hostHTML === "string" && saved.hostHTML.indexOf("data-label=\\"Text\\"") !== -1;
      out.savedViewportState = saved.stageZoom > 1 && saved.stageBackground && /data:image\\/svg/.test(saved.stageBackground.image || "");
    } catch (_error) {
      out.savedHostHtml = false;
      out.savedViewportState = false;
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

  function onFrameLoaded() {
    function runAfterPackageImport(attemptsLeft) {
      try {
        var doc = frame.contentDocument;
        var win = frame.contentWindow;
        if (doc.body && doc.body.dataset.packageLibraryReady !== "true" && attemptsLeft > 0) {
          setTimeout(function () { runAfterPackageImport(attemptsLeft - 1); }, 100);
          return;
        }
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
    }
    runAfterPackageImport(20);
  }

  frame.addEventListener("load", onFrameLoaded);
  try {
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
      onFrameLoaded();
    }
  } catch (_error) {
    // Cross-origin is not expected here, but the load handler will still run.
  }
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
    ["Component/Assembly/Product modes exist", interactions.hasEditorModes],
    ["Top bar is grouped into named sections", interactions.topbarHasNamedSections],
    ["Top bar controls use icons", interactions.topbarUsesIconButtons],
    ["Top bar icon controls keep accessible names", interactions.topbarIconButtonsKeepAccessibleNames],
    ["Assembly mode activates", interactions.assemblyModeActive],
    ["Product mode activates", interactions.productModeActive],
    ["Library panel exists", interactions.hasLibraryPanel],
    ["Library panel is floating over the canvas", interactions.libraryPanelIsFloating],
    ["Library has search and count logic", interactions.libraryHasSearchLogic],
    ["Library tabs cover components/assets/tokens/styles", interactions.hasLibraryTabs],
    ["GeoSee variable presets exist", interactions.hasGeoSeeVariablePresets],
    ["Expanded creation tools exist", interactions.hasExpandedCreateTools],
    ["GeoSee component library contains real editor atoms", interactions.hasGeoSeeComponentLibrary],
    ["GeoSee assembly library contains real editor rows", interactions.hasGeoSeeAssemblyLibrary],
    ["GeoSee product library contains real authoring surfaces", interactions.hasGeoSeeProductLibrary],
    ["GeoSee colour library contains Base GUI and material colors", interactions.hasGeoSeeColourLibrary],
    ["GeoSee token library contains editor and material variables", interactions.hasGeoSeeTokenLibrary],
    ["GeoSee style library contains material presets", interactions.hasGeoSeeStyleLibrary],
    ["Library items show visual thumbnail previews", interactions.libraryItemsHaveVisualPreviews],
    ["Library preview scale control exists", interactions.libraryPreviewScaleControlExists],
    ["Library preview scale control changes thumbnail size", interactions.libraryPreviewScaleApplies],
    ["Package library import completed", interactions.packageLibraryReady],
    ["Package-backed library entries are available", interactions.hasPackageBackedLibraryEntries],
    ["Icon library includes all package SVG icons", interactions.iconLibraryHasAllPackageIcons],
    ["Icon library shows SVG previews", interactions.iconLibraryShowsSvgPreviews],
    ["Inspector exposes extended style variables", interactions.hasExtendedStyleInspector],
    ["Library token applies panel width", interactions.tokenPanelWidthApplied],
    ["Library style applies editor chrome material", interactions.styleEditorChromeApplied],
    ["Product library instantiates Topo material panel", interactions.productLibraryInstantiation],
    ["tree Pages row selectable", interactions.hasPagesRow && interactions.pagesSelected],
    ["Notes visible after selection", interactions.notesVisibleAfterSelection],
    ["Kind picker changes to button", interactions.kindPickerExists && interactions.kindChangedToButton],
    ["Tree glyph updates after kind change", interactions.selectedGlyphAfterKindChange === "B"],
    ["Create text from toolbar", interactions.hasAddText && interactions.textExistsAfterCreate],
    ["Created text is nested under Sidebar", interactions.textNestedUnderSidebar],
    ["Padding overlay appears for padded container", interactions.paddingOverlayVisible],
    ["Nested child starts inside padded inset", interactions.paddedNestedChildStartsInsideInset],
    ["Save selected component to library", interactions.hasSaveComponent && interactions.savedComponentInLibrary],
    ["Saved component preview has visible content", interactions.savedComponentPreviewHasVisibleContent],
    ["Instantiate saved library component", interactions.libraryInstantiationCreatedSelection],
    ["Create line tool", interactions.createdLine],
    ["Create icon tool", interactions.createdIcon],
    ["Icon library applies SVG icon to selected icon", interactions.iconLibraryInstantiation],
    ["Create divider tool", interactions.createdDivider],
    ["Create swatch tool", interactions.createdSwatch],
    ["Create input tool", interactions.createdInput],
    ["Behavior Log panel exists", interactions.placement && interactions.placement.behaviorLogExists],
    ["Drag snaps dragged edge to sibling edge", interactions.placement && interactions.placement.snapToSiblingEdge],
    ["Smart guide appears during snap drag", interactions.placement && interactions.placement.smartGuideVisibleDuringDrag],
    ["Canvas drag auto-nests by clear overlap", interactions.placement && interactions.placement.autoNestByOverlap],
    ["Auto-nest preserves visual placement", interactions.placement && interactions.placement.autoNestPreservesVisualPlacement],
    ["Invalid leaf drop is rejected and logged", interactions.placement && interactions.placement.invalidDropRejectedAndLogged],
    ["Tree drag supports before/after leaf reorder", interactions.placement && interactions.placement.treeReorderBeforeLeaf],
    ["Library drag/drop nests into padded container", interactions.placement && interactions.placement.libraryDragDropIntoPadding],
    ["Placement parent/order persists", interactions.placement && interactions.placement.placementPersistence],
    ["Scroll wheel zooms the editor canvas", interactions.wheelZoomChangesStage],
    ["Background image controls exist", interactions.backgroundControlsExist],
    ["Background image URL loads onto the stage", interactions.backgroundImageLoads],
    ["Undo removes created text", interactions.hasUndoRedo && interactions.textRemovedByUndo],
    ["Redo restores created text", interactions.hasUndoRedo && interactions.textRestoredByRedo],
    ["Saved DOM includes created text", interactions.savedHostHtml],
    ["Zoom and background persist", interactions.savedViewportState],
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
    info("Dependency-free smoke covers render plus synthetic click/change/undo/redo and pointer drag/drop probes.");

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
      "--virtual-time-budget=8000",
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
