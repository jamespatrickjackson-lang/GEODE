import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { summarizeStartupProbeResults } from "../../tools/check-startup-console.mjs";

const repoRoot = process.cwd();

test("startup probe accepts only expected ReadPixels warnings", () => {
  const result = summarizeStartupProbeResults([
    {
      name: "utah-direct",
      consoleMessages: [
        {
          type: "warning",
          text: "[.WebGL-0x75c001b9a00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
        },
      ],
      pageErrors: [],
      requestFailures: [],
      badResponses: [],
      readPixelsCalls: [],
      canvasCount: 1,
      viteOverlayCount: 0,
      requiredTextFound: true,
      elapsedMs: 100,
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.targets[0].expectedWarnings.length, 1);
  assert.deepEqual(result.targets[0].failures, []);
});

test("startup probe fails on JS-visible readPixels during first load", () => {
  const result = summarizeStartupProbeResults([
    {
      name: "utah-direct",
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [],
      badResponses: [],
      readPixelsCalls: [{ context: "WebGL2RenderingContext", width: 280, height: 158 }],
      canvasCount: 1,
      viteOverlayCount: 0,
      requiredTextFound: true,
      elapsedMs: 100,
    },
  ]);

  assert.equal(result.ok, false);
  assert.match(result.targets[0].failures[0], /JS-visible readPixels/);
});

test("startup probe source does not take screenshots", () => {
  const source = readFileSync(join(repoRoot, "tools", "check-startup-console.mjs"), "utf8");

  assert.match(source, /addInitScript/);
  assert.doesNotMatch(source, /\.screenshot\(/);
});
