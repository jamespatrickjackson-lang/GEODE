import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyConsoleMessages,
  isExpectedReadPixelsWarning,
} from "../../tools/lib/console-health.mjs";

test("expected Chromium ReadPixels GPU warning is classified separately", () => {
  const message = {
    type: "warning",
    text: "[.WebGL-0x75c001b9a00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
  };

  assert.equal(isExpectedReadPixelsWarning(message), true);

  const result = classifyConsoleMessages([message]);

  assert.deepEqual(result, {
    expectedWarnings: [message],
    unexpected: [],
  });
});

test("ordinary warnings, errors, and page errors remain unexpected", () => {
  const warning = { type: "warning", text: "application startup warning" };
  const error = { type: "error", text: "application startup error" };
  const pageerror = { type: "pageerror", text: "render crashed" };

  const result = classifyConsoleMessages([warning, error, pageerror]);

  assert.deepEqual(result.expectedWarnings, []);
  assert.deepEqual(result.unexpected, [warning, error, pageerror]);
});
