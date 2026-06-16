import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/pages/PageController.tsx", "utf8");

function extractFunctionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`${name} body should close`);
}

const body = extractFunctionBody("pageWithoutLayerDeltas");

assert.doesNotMatch(
  body,
  /delete\s+next\.visibilityOverrides/,
  "preview-environment page resolution must preserve page visibility overrides",
);

assert.doesNotMatch(
  body,
  /visibilityOverrides\s*:\s*undefined/,
  "preview-environment page resolution must not clear page visibility overrides",
);
