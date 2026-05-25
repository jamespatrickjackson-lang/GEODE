import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  openForgeTopoEditorContainers,
  terrainMaterialSceneState,
  type TerrainMaterialSceneState,
} from "../utah-forge/shared";

const OUTPUT_DIR = resolve(
  process.cwd(),
  "docs/dev-context/Audits/naip-quality",
);

type WebGlDiagnostics = {
  devicePixelRatio: number;
  canvasClientSize: { width: number; height: number } | null;
  drawingBufferSize: { width: number; height: number } | null;
  maxTextureSize: number | null;
  maxAnisotropy: number | null;
  renderer: string | null;
};

function globalSettingsRow(page: Page) {
  return page
    .locator('[data-dev-note*="Global Settings is an editor-only pseudo-page"]')
    .filter({ hasText: "Global Settings" });
}

async function selectNaipMaterial(page: Page) {
  await openForgeTopoEditorContainers(page);
  const row = globalSettingsRow(page);
  await expect(row).toHaveCount(1);
  await row.click();
  await openForgeTopoEditorContainers(page);
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) {
      (detail as HTMLDetailsElement).open = true;
    }
  });
  await page
    .getByTestId("topo-material-preset")
    .selectOption("image:naip-2024-aerial");
  await expect(page.getByTestId("topo-material-preset")).toHaveValue(
    "image:naip-2024-aerial",
  );
}

async function browserDiagnostics(page: Page) {
  return page.evaluate((): WebGlDiagnostics => {
    const canvas = document.querySelector("canvas");
    const gl =
      canvas?.getContext("webgl2") ??
      canvas?.getContext("webgl") ??
      null;
    const anisotropyExt =
      gl?.getExtension("EXT_texture_filter_anisotropic") ??
      gl?.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ??
      gl?.getExtension("MOZ_EXT_texture_filter_anisotropic") ??
      null;
    const debugRenderer = gl?.getExtension("WEBGL_debug_renderer_info") ?? null;
    return {
      devicePixelRatio: window.devicePixelRatio,
      canvasClientSize: canvas
        ? { width: canvas.clientWidth, height: canvas.clientHeight }
        : null,
      drawingBufferSize: gl
        ? {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight,
          }
        : null,
      maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : null,
      maxAnisotropy:
        gl && anisotropyExt
          ? gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
          : null,
      renderer:
        gl && debugRenderer
          ? gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL)
          : null,
    };
  });
}

async function setCameraForDetailOverlay(
  page: Page,
  state: TerrainMaterialSceneState,
  shot: "medium" | "close" | "oblique",
) {
  const min = state.topoImageDetailBoundsMin;
  const max = state.topoImageDetailBoundsMax;
  if (!min || !max) return;
  const cx = (min.x + max.x) * 0.5;
  const cy = (min.y + max.y) * 0.5;
  const poses = {
    medium: { dx: 0, dy: -8000, z: 6500 },
    close: { dx: 0, dy: -2400, z: 2600 },
    oblique: { dx: 5200, dy: -6800, z: 3600 },
  };
  const pose = poses[shot];
  await page.evaluate(
    ({ cx, cy, pose }) => {
      const scene = (
        window as unknown as {
          __scene?: {
            camera?: {
              position: {
                set: (x: number, y: number, z: number) => void;
              };
              lookAt: (x: number, y: number, z: number) => void;
              updateMatrixWorld: (force?: boolean) => void;
            };
          };
        }
      ).__scene;
      const camera = scene?.camera;
      if (!camera) return;
      camera.position.set(cx + pose.dx, cy + pose.dy, pose.z);
      camera.lookAt(cx, cy, 0);
      camera.updateMatrixWorld(true);
    },
    { cx, cy, pose },
  );
  await page.waitForTimeout(500);
}

async function captureBudgetState(
  page: Page,
  budget: "4096" | "8192",
) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.getByTestId("topo-ortho-photo-texture-budget").selectOption(budget);
  await expect(page.getByTestId("topo-ortho-photo-texture-budget")).toHaveValue(
    budget,
  );
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.orthoPhotoTextureSrc ?? "",
      ),
    )
    .toContain(`naip_2024_beauty_${budget}.webp`);
  await expect
    .poll(() =>
      terrainMaterialSceneState(page).then(
        (state) => state.topoImageDetailTextureSrc ?? "",
      ),
    )
    .toContain(`naip_2024_forge_detail_${budget}.webp`);

  const state = await terrainMaterialSceneState(page);
  const diagnostics = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    materialPreset: await page.getByTestId("topo-material-preset").inputValue(),
    textureBudget: await page
      .getByTestId("topo-ortho-photo-texture-budget")
      .inputValue(),
    webgl: await browserDiagnostics(page),
    terrain: state,
  };
  writeFileSync(
    resolve(OUTPUT_DIR, `browser-${budget}-diagnostics.json`),
    JSON.stringify(diagnostics, null, 2),
    "utf8",
  );

  for (const shot of ["medium", "close", "oblique"] as const) {
    await setCameraForDetailOverlay(page, state, shot);
    await page.screenshot({
      path: resolve(OUTPUT_DIR, `browser-${budget}-${shot}.png`),
      fullPage: false,
    });
  }
  return state;
}

test.describe("NAIP quality audit", () => {
  test.setTimeout(900_000);

  test("captures selected NAIP texture budgets and close-zoom screenshots", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
    await expect(page.locator("canvas")).toHaveCount(1);
    await selectNaipMaterial(page);

    const state4096 = await captureBudgetState(page, "4096");
    expect(state4096.orthoPhotoTextureSize).toEqual({
      width: 4096,
      height: 1580,
    });
    expect(state4096.topoImageDetailTextureSize).toEqual({
      width: 4096,
      height: 4096,
    });

    const state8192 = await captureBudgetState(page, "8192");
    expect(state8192.orthoPhotoTextureSize).toEqual({
      width: 8192,
      height: 3161,
    });
    expect(state8192.topoImageDetailTextureSize).toEqual({
      width: 8192,
      height: 8192,
    });
    expect(state8192.orthoPhotoTextureSrc ?? "").not.toContain(
      "ortho_photo_context",
    );
    expect(consoleErrors).toEqual([]);
  });
});
