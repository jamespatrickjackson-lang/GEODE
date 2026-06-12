import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { classifyConsoleMessages } from "./lib/console-health.mjs";

const HOST = "127.0.0.1";
const VIEWPORT = { width: 1280, height: 720 };
const TARGETS = [
  {
    name: "root",
    path: "/",
    requiredText: "Open a project",
    requireCanvas: false,
  },
  {
    name: "utah-direct",
    path: "/?project=utah-forge",
    requiredText: "00. Global Settings",
    requireCanvas: true,
  },
];

const READ_PIXELS_HOOK = `
(() => {
  const calls = [];
  Object.defineProperty(window, "__geoseeStartupReadPixelsCalls", {
    value: calls,
    configurable: true,
  });
  const patch = (ctorName) => {
    const ctor = window[ctorName];
    const proto = ctor && ctor.prototype;
    const original = proto && proto.readPixels;
    if (typeof original !== "function" || original.__geoseeStartupProbe) return;
    function wrappedReadPixels(...args) {
      calls.push({
        context: ctorName,
        x: Number(args[0]),
        y: Number(args[1]),
        width: Number(args[2]),
        height: Number(args[3]),
        stack: String(new Error().stack || "").split("\\n").slice(0, 8),
      });
      return original.apply(this, args);
    }
    Object.defineProperty(wrappedReadPixels, "__geoseeStartupProbe", {
      value: true,
    });
    proto.readPixels = wrappedReadPixels;
  };
  patch("WebGLRenderingContext");
  patch("WebGL2RenderingContext");
})();
`;

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.on("error", rejectPort);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (!port) rejectPort(new Error("Could not allocate a local port."));
        else resolvePort(port);
      });
    });
  });
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function startViteServer({ cwd = process.cwd(), port } = {}) {
  const viteBin = resolve(cwd, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    throw new Error(`Missing Vite executable: ${viteBin}`);
  }

  const logs = [];
  const child = spawn(
    process.execPath,
    [viteBin, "--host", HOST, "--port", String(port)],
    {
      cwd,
      env: { ...process.env, BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  const collect = (streamName) => (chunk) => {
    logs.push(`${streamName}: ${chunk.toString()}`);
    if (logs.length > 80) logs.shift();
  };
  child.stdout.on("data", collect("stdout"));
  child.stderr.on("data", collect("stderr"));

  const baseUrl = `http://${HOST}:${port}`;
  try {
    await waitForHttp(baseUrl);
  } catch (error) {
    child.kill();
    const tail = logs.join("").trim();
    throw new Error(
      `Vite server did not become ready: ${
        error instanceof Error ? error.message : String(error)
      }${tail ? `\n${tail}` : ""}`,
    );
  }

  return {
    baseUrl,
    stop() {
      if (!child.killed) child.kill();
    },
  };
}

async function inspectTarget(page, baseUrl, target) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  const started = Date.now();

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ type: "pageerror", text: error.message });
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText ?? null,
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      badResponses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  });

  await page.addInitScript({ content: READ_PIXELS_HOOK });
  await page.goto(`${baseUrl}${target.path}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.waitForTimeout(4_000);

  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  const canvasCount = await page.locator("canvas").count();
  const viteOverlayCount = await page.locator("vite-error-overlay").count();
  const readPixelsCalls = await page.evaluate(() => {
    return window.__geoseeStartupReadPixelsCalls ?? [];
  });

  return {
    name: target.name,
    url: page.url(),
    title: await page.title(),
    elapsedMs: Date.now() - started,
    consoleMessages,
    pageErrors,
    requestFailures,
    badResponses,
    readPixelsCalls,
    canvasCount,
    viteOverlayCount,
    requiredTextFound: bodyText.includes(target.requiredText),
  };
}

export function summarizeStartupProbeResults(results) {
  const targets = results.map((result) => {
    const consoleHealth = classifyConsoleMessages(result.consoleMessages);
    const failures = [];

    if (!result.requiredTextFound) {
      failures.push(`Missing required text for ${result.name}`);
    }
    if (result.name === "utah-direct" && result.canvasCount < 1) {
      failures.push("Utah FORGE first load did not render a canvas.");
    }
    if (result.viteOverlayCount > 0) {
      failures.push("Vite error overlay is present.");
    }
    if (consoleHealth.unexpected.length > 0) {
      failures.push(
        `Unexpected console messages: ${consoleHealth.unexpected.length}`,
      );
    }
    if (result.pageErrors.length > 0) {
      failures.push(`Page errors: ${result.pageErrors.length}`);
    }
    if (result.requestFailures.length > 0) {
      failures.push(`Failed requests: ${result.requestFailures.length}`);
    }
    if (result.badResponses.length > 0) {
      failures.push(`Bad HTTP responses: ${result.badResponses.length}`);
    }
    if (result.readPixelsCalls.length > 0) {
      failures.push(
        `JS-visible readPixels calls during startup: ${result.readPixelsCalls.length}`,
      );
    }

    return {
      ...result,
      expectedWarnings: consoleHealth.expectedWarnings,
      unexpectedConsoleMessages: consoleHealth.unexpected,
      failures,
    };
  });

  return {
    ok: targets.every((target) => target.failures.length === 0),
    targets,
  };
}

export async function runStartupConsoleProbe({ cwd = process.cwd() } = {}) {
  const { chromium } = await import("@playwright/test");
  const port = await findFreePort();
  const server = await startViteServer({ cwd, port });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const target of TARGETS) {
      const page = await browser.newPage({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
      });
      try {
        results.push(await inspectTarget(page, server.baseUrl, target));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.stop();
  }

  return summarizeStartupProbeResults(results);
}

function formatSummary(summary) {
  const lines = [
    `Startup console health ${summary.ok ? "PASS" : "FAIL"}`,
  ];
  for (const target of summary.targets) {
    lines.push(
      `${target.name}: expectedWarnings=${target.expectedWarnings.length}, unexpectedConsole=${target.unexpectedConsoleMessages.length}, pageErrors=${target.pageErrors.length}, requestFailures=${target.requestFailures.length}, badResponses=${target.badResponses.length}, readPixelsCalls=${target.readPixelsCalls.length}, canvases=${target.canvasCount}`,
    );
    for (const failure of target.failures) {
      lines.push(`  - ${failure}`);
    }
  }
  return lines.join("\n");
}

if (isMainModule()) {
  const summary = await runStartupConsoleProbe({
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  console.log(formatSummary(summary));
  if (!summary.ok || process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
  }
  if (!summary.ok) process.exitCode = 1;
}
