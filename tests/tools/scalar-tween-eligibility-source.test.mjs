import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// DEC-166 regression guard (review finding 2.3). Scalar-tween eligibility must
// be authoritative from the layer spec type (load-independent), with geometry
// scalarValues presence as a secondary readiness OR -- never the primary gate.
// Before this fix a scalar-colored layer that had not finished loading at
// transition setup classified `none`/`continuous` depending on load timing.

const managerSource = readFileSync("src/scene/SceneManager.ts", "utf8");

function functionWindow(source, name) {
  const start = source.indexOf(`${name}(`);
  assert.notEqual(start, -1, `${name} must exist in SceneManager.ts`);
  // Walk to the function's opening brace, then bracket-match to its close.
  const open = source.indexOf("{", source.indexOf("boolean", start));
  assert.notEqual(open, -1, `${name} must have a body`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unterminated function body for ${name}`);
}

const body = functionWindow(managerSource, "layerSupportsScalarStyleTween");

test("eligibility resolves from the layer spec type", () => {
  assert.match(
    body,
    /this\.layerSpecFor\(id\)\?\.type/,
    "must resolve the spec type via layerSpecFor",
  );
  assert.match(body, /"pointcloud"/, "pointcloud is scalar-tween eligible");
  assert.match(body, /"volume"/, "volume is scalar-tween eligible");
});

test("geometry-presence is a secondary OR, not the primary gate", () => {
  const specTypeAt = body.indexOf("specType");
  const presenceAt = body.indexOf("layerHasScalarPreviewData");
  assert.ok(specTypeAt !== -1, "spec-type check present");
  assert.ok(presenceAt !== -1, "geometry-presence check present");
  assert.ok(
    specTypeAt < presenceAt,
    "the spec-type allowlist must be evaluated before falling back to geometry presence",
  );
});

test("the protected MT volume path stays explicit", () => {
  assert.match(
    body,
    /id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID/,
    "the explicit MT volume eligibility must remain",
  );
});
