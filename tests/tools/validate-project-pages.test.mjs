import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { validateProjectPages } from "../../tools/validate-project-pages.mjs";

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeProject(page, environment = null) {
  const root = mkdtempSync(join(tmpdir(), "geosee-validate-pages-"));
  const projectDir = join(root, "projects", "fixture");
  mkdirSync(join(projectDir, "pages"), { recursive: true });
  writeJson(join(projectDir, "project.json"), {
    id: "fixture",
    pageOrder: [page.id],
  });
  if (environment) {
    writeJson(join(projectDir, "environment.json"), environment);
  }
  writeJson(join(projectDir, "pages", `${page.id}.json`), page);
  return root;
}

test("validateProjectPages records raw MT visibility mismatches as fixture evidence", () => {
  const root = makeProject({
    id: "page-a",
    title: "Page A",
    camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 0, 1] },
    transition: { duration: 1 },
    holdDuration: 1,
    layerOverrides: {
      "utah-forge-mt-resistivity-threshold-surfaces": {
        mtThresholdSurfaceVisibility: {
          "resistive-ge-1000-ohm-m": true,
        },
        mtSurfaceBoundariesById: {
          "resistive-ge-1000-ohm-m": {
            visible: false,
          },
        },
      },
    },
  });

  const result = validateProjectPages(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.match(
    result.warnings.join("\n"),
    /MT boundary resistive-ge-1000-ohm-m visibility mismatch/,
  );
});

test("validateProjectPages records raw scene section frame mismatch as fixture evidence", () => {
  const root = makeProject({
    id: "page-b",
    title: "Page B",
    camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 0, 1] },
    transition: { duration: 1 },
    holdDuration: 1,
    layerOverrides: {
      "utah-forge-scene-section-planes": {
        sceneSectionActiveAxis: "x",
        sceneSectionActiveFrameId: "axis:y",
        sceneSectionPlanes: {
          y: {
            enabled: false,
            positionM: 10,
            invert: false,
          },
        },
        sceneSectionFrames: [
          {
            id: "axis:x",
            axis: "x",
            plane: {
              enabled: false,
              positionM: 0,
              invert: false,
            },
            frame: {},
          },
          {
            id: "axis:y",
            axis: "y",
            plane: {
              enabled: true,
              positionM: 15,
              invert: false,
            },
            frame: {},
          },
        ],
      },
    },
  });

  const result = validateProjectPages(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /active axis x does not match active frame axis y/);
  assert.match(result.warnings.join("\n"), /frame axis:y plane.enabled true does not match/);
  assert.match(result.warnings.join("\n"), /frame axis:y plane.positionM 15 does not match/);
});

test("validateProjectPages normalizes effective scene section frame state inherited from environment", () => {
  const root = makeProject(
    {
      id: "page-c",
      title: "Page C",
      camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 0, 1] },
      transition: { duration: 1 },
      holdDuration: 1,
      layerOverrides: {
        "utah-forge-scene-section-planes": {
          sceneSectionActiveAxis: "y",
          sceneSectionPlanes: {
            y: {
              enabled: true,
              positionM: 25,
              invert: false,
            },
          },
        },
      },
    },
    {
      layerStyles: {
        "utah-forge-scene-section-planes": {
          sceneSectionActiveAxis: "x",
          sceneSectionActiveFrameId: "axis:x",
          sceneSectionPlanes: {
            x: {
              enabled: true,
              positionM: 10,
              invert: false,
            },
          },
          sceneSectionFrames: [
            {
              id: "axis:x",
              axis: "x",
              plane: {
                enabled: true,
                positionM: 10,
                invert: false,
              },
              frame: {},
            },
            {
              id: "axis:y",
              axis: "y",
              plane: {
                enabled: false,
                positionM: 0,
                invert: false,
              },
              frame: {},
            },
          ],
        },
      },
    },
  );

  const result = validateProjectPages(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateProjectPages rejects effective scene section state that cannot be normalized", () => {
  const root = makeProject({
    id: "page-d",
    title: "Page D",
    camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 0, 1] },
    transition: { duration: 1 },
    holdDuration: 1,
    layerOverrides: {
      "utah-forge-scene-section-planes": {
        sceneSectionActiveAxis: "x",
        sceneSectionActiveFrameId: "custom:missing",
        sceneSectionFrames: [
          {
            id: "axis:x",
            axis: "x",
            plane: {
              enabled: true,
              positionM: 10,
              invert: false,
            },
            frame: {},
          },
        ],
      },
    },
  });

  const result = validateProjectPages(root);
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /page-d:effective:utah-forge-scene-section-planes: active frame custom:missing is missing/,
  );
});
