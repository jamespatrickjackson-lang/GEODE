import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// Regression guard for the section render/state desync (sections leaking into,
// or vanishing from, pages after a transition until a button click refreshed
// them). Root cause: `currentSceneSectionStyle()` -- the style that
// `reapplySceneSectionPlanes()` applies when no section tween is active -- read
// the `applyStyle`-only authored cache (`styleForLayer(SCENE_SECTION_LAYER)`),
// which the page-load and transition paths never update because they call
// `applySceneSectionPlanes` directly. The canonical current section is
// `lastSceneSectionStyle` (updated by every apply and used by the ISO overlays,
// helper visibility, and preview ops). The no-tween branch must read it.

const controllerSource = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);

function currentSceneSectionStyleBody(src) {
  const start = src.indexOf("export function currentSceneSectionStyle");
  assert.notEqual(start, -1, "currentSceneSectionStyle must exist");
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error("unterminated currentSceneSectionStyle");
}

const body = currentSceneSectionStyleBody(controllerSource);

test("currentSceneSectionStyle returns lastSceneSectionStyle when no tween is active", () => {
  assert.match(
    body,
    /if\s*\(!tween\)\s*return\s+this\.lastSceneSectionStyle\s*;/,
    "the no-tween branch must return lastSceneSectionStyle (the canonical applied section)",
  );
  assert.doesNotMatch(
    body,
    /if\s*\(!tween\)\s*return\s+this\.styleForLayer\(/,
    "must not read the applyStyle-only authored cache for the rendered section",
  );
});
