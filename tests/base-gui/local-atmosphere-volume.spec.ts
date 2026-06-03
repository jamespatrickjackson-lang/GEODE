import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectPath = "projects/base-gui/project.json";
const environmentPath = "projects/base-gui/environment.json";
const pagePath = "projects/base-gui/pages/00_base_gui.json";
const layerId = "base-gui-local-mist-volume";

type JsonObject = Record<string, unknown>;

function absolute(path: string): string {
  return resolve(process.cwd(), path);
}

function readJson<T = JsonObject>(path: string): T {
  return JSON.parse(readFileSync(absolute(path), "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(absolute(path), `${JSON.stringify(value, null, 2)}\n`);
}

async function openAllDetails(page: Page): Promise<void> {
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) (detail as HTMLDetailsElement).open = true;
  });
}

async function openDataPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Data$/ }).click();
  const otherGroup = page.getByRole("button", { name: /^Other$/ });
  if ((await otherGroup.count()) > 0) {
    await otherGroup.click();
  }
  await openAllDetails(page);
}

async function selectBaseGuiPage(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Pages$/ }).click();
  const pageRow = page
    .locator('[data-dev-note*="panelStyles.pageRow"]')
    .filter({ hasText: "Base GUI" })
    .first();
  await expect(pageRow).toBeVisible();
  await pageRow.click();
}

async function localMistRuntimeState(page: Page) {
  return page.evaluate((targetLayerId) => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          scene?: { fog?: unknown };
          manager?: {
            getLayer?: (
              id: string,
            ) =>
              | {
                  visible?: boolean;
                  children?: unknown[];
                  userData?: Record<string, unknown>;
                  traverse?: (
                    visitor: (obj: {
                      material?:
                        | Record<string, unknown>
                        | Array<Record<string, unknown>>;
                    }) => void,
                  ) => void;
                }
              | undefined;
            styleForLayer?: (id: string) => Record<string, unknown>;
          };
        };
      }
    ).__scene;
    const manager = sceneHandle?.manager;
    const layer = manager?.getLayer?.(targetLayerId);
    const style = manager?.styleForLayer?.(targetLayerId) ?? null;
    const materials: Array<Record<string, unknown>> = [];
    layer?.traverse?.((obj) => {
      const raw = obj.material;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const material of list) materials.push(material);
    });
    return {
      hasSceneHandle: Boolean(sceneHandle),
      sceneFogType:
        sceneHandle?.scene && "fog" in sceneHandle.scene
          ? typeof sceneHandle.scene.fog
          : "missing",
      hasLayer: Boolean(layer),
      visible: layer?.visible ?? null,
      childCount: Array.isArray(layer?.children) ? layer.children.length : null,
      style,
      materialCount: materials.length,
      depthTestValues: materials.map((material) => material.depthTest ?? null),
      userData: layer?.userData ?? null,
      debug: (layer?.userData ?? {}).localAtmosphereDebug ?? null,
    };
  }, layerId);
}

function changedByteCount(before: Buffer, after: Buffer): number {
  const length = Math.min(before.length, after.length);
  let changed = Math.abs(before.length - after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== after[index]) changed += 1;
  }
  return changed;
}

async function setInputValueByTestId(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  await page.getByTestId(testId).evaluate((input, nextValue) => {
    const el = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(el, nextValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("Base GUI local atmosphere volume", () => {
  let originalProject: JsonObject;
  let originalEnvironment: JsonObject;
  let originalPage: JsonObject;

  test.beforeEach(() => {
    originalProject = readJson(projectPath);
    originalEnvironment = readJson(environmentPath);
    originalPage = readJson(pagePath);
  });

  test.afterEach(() => {
    writeJson(projectPath, originalProject);
    writeJson(environmentPath, originalEnvironment);
    writeJson(pagePath, originalPage);
  });

  test("renders default visible mist volume and exposes editor controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/?project=base-gui", { waitUntil: "networkidle" });
    await expect(page.locator("canvas")).toHaveCount(1);
    await openDataPanel(page);

    await expect(page.getByText("Local mist volume")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("atmosphere-volume-opacity")).toBeVisible();
    await expect(page.getByTestId("atmosphere-volume-density")).toBeVisible();
    await expect(page.getByTestId("atmosphere-volume-softness")).toBeVisible();
    await expect(page.getByTestId("atmosphere-volume-puff-count")).toBeVisible();

    const state = await localMistRuntimeState(page);
    expect(state.hasSceneHandle).toBe(true);
    expect(state.hasLayer).toBe(true);
    expect(state.visible).toBe(true);
    expect(state.childCount).toBeGreaterThan(0);
    expect(state.style).toMatchObject({
      atmosphereSubtype: "mist",
      color: "#dfe4e8",
      opacity: 0.28,
      atmosphereDensity: 0.45,
      atmosphereSoftness: 0.75,
      atmospherePuffCount: 72,
      atmosphereScaleJitter: 0.55,
      atmosphereVerticalFalloff: 0.7,
      atmosphereEdgeFade: 0.85,
      atmosphereSeed: 101,
      atmosphereDriftEnabled: false,
      atmosphereDepthTest: true,
      atmosphereRenderOrder: 20,
    });
    expect(state.debug).toMatchObject({
      layerId,
      textureSource: "generated-canvas",
      textureCacheKey: "local-atmosphere:base-gui-local-mist-volume:101:0.75",
      puffCount: 72,
      materialType: "SpriteMaterial",
      geometryType: "Sprite",
      bounds: {
        mode: "box",
        center: [0, 0, 34],
        size: [145, 145, 72],
      },
      depthTest: true,
      renderOrder: 20,
    });
    expect(state.depthTestValues).toContain(true);

    const before = await page.locator("canvas").screenshot();
    await page.evaluate((targetLayerId) => {
      const sceneHandle = (
        window as unknown as {
          __scene?: {
            scene?: unknown;
            camera?: unknown;
            renderer?: { render?: (scene: unknown, camera: unknown) => void };
            manager?: {
              applyStyle?: (id: string, style: Record<string, unknown>) => void;
              styleForLayer?: (id: string) => Record<string, unknown>;
            };
          };
        }
      ).__scene;
      const manager = sceneHandle?.manager;
      manager?.applyStyle?.(targetLayerId, {
        ...(manager.styleForLayer?.(targetLayerId) ?? {}),
        color: "#ff3366",
        opacity: 1,
        atmosphereDensity: 1,
        atmospherePuffScaleM: 42,
      });
      if (sceneHandle?.scene && sceneHandle.camera) {
        sceneHandle.renderer?.render?.(sceneHandle.scene, sceneHandle.camera);
      }
    }, layerId);
    await page.waitForTimeout(250);
    const after = await page.locator("canvas").screenshot();
    expect(changedByteCount(before, after)).toBeGreaterThan(100);
  });

  test("saves global style changes, reloads them, and isolates page overrides", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/?project=base-gui", { waitUntil: "networkidle" });
    await openDataPanel(page);

    await setInputValueByTestId(page, "atmosphere-volume-opacity", "0.18");
    await page.getByRole("button", { name: /^Save \d+ pending edits?$/ }).click();
    await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible({
      timeout: 30_000,
    });

    let savedEnvironment = readJson<{
      layerStyles?: Record<string, Record<string, unknown>>;
    }>(environmentPath);
    expect(savedEnvironment.layerStyles?.[layerId]?.opacity).toBeCloseTo(
      0.18,
      3,
    );

    await page.reload({ waitUntil: "networkidle" });
    await openDataPanel(page);
    await expect.poll(() => localMistRuntimeState(page)).toMatchObject({
      visible: true,
      style: { opacity: 0.18 },
    });

    const pageJson = readJson<{
      layerOverrides?: Record<string, Record<string, unknown>>;
      visibleLayers?: string[];
    }>(pagePath);
    const nextPage = {
      ...pageJson,
      visibilityOverrides: {
        ...(pageJson.visibilityOverrides ?? {}),
        [layerId]: true,
      },
      layerOverrides: {
        ...(pageJson.layerOverrides ?? {}),
        [layerId]: { opacity: 0.06, atmosphereDensity: 0.2 },
      },
    };
    await page.request.post("/api/write-file", {
      data: {
        path: pagePath,
        content: `${JSON.stringify(nextPage, null, 2)}\n`,
      },
    });

    await page.goto("/?project=base-gui&pw=local-atmosphere-page-override", {
      waitUntil: "networkidle",
    });
    await selectBaseGuiPage(page);
    await expect.poll(() => localMistRuntimeState(page)).toMatchObject({
      visible: true,
      style: { opacity: 0.06, atmosphereDensity: 0.2 },
    });

    savedEnvironment = readJson(environmentPath);
    expect(savedEnvironment.layerStyles?.[layerId]?.opacity).toBeCloseTo(
      0.18,
      3,
    );
  });
});
