import { expect, test } from "@playwright/test";
import { hidePublicContextLayers, mtVolumeSceneState } from "./shared";

// App-behaviour test for MT threshold iso-surface rendering. Drives the layer by
// its app-structural layer id (NOT a deck page), so it is independent of the
// disposable Utah FORGE page deck. Guards the R4 binary-tile render path and the
// two render fixes folded into DEC-183:
//   - no per-vertex colour (vertexColors must be OFF, else three multiplies by a
//     default (0,0,0) and the surface renders black);
//   - solid-shell depthWrite always on, so a front surface occludes a back one
//     through fades / lazy loads (and under reverse-Z; gravel-pit class).

const THRESHOLD_LAYER_ID = "utah-forge-mt-resistivity-threshold-surfaces";

test.setTimeout(900_000);

test("Utah FORGE MT threshold surfaces load from binary tiles with correct colour + depth", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await hidePublicContextLayers(page);

  // Make the threshold-surfaces layer visible and enable two boundaries; this
  // triggers the lazy fetch + dequantization of their binary tiles.
  await page.evaluate((layerId) => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene;
    const layer = sceneHandle?.manager?.getLayer?.(layerId);
    if (layer) layer.visible = true;
    sceneHandle?.manager?.applyStyle?.(layerId, {
      opacity: 1,
      mtIsosurfaceProductId: "mt-isosurface-full-extent",
      mtThresholdSurfaceVisibility: {
        "conductive-le-30-ohm-m": true,
        "resistive-ge-1000-ohm-m": true,
      },
      mtThresholdSurfaceWireframe: false,
      mtThresholdSurfaceSide: "double",
    });
  }, THRESHOLD_LAYER_ID);

  // Binary tiles stream in asynchronously.
  await expect
    .poll(
      () =>
        mtVolumeSceneState(page).then(
          (state) => state.visibleThresholdSurfaceIds.length,
        ),
      { timeout: 120_000 },
    )
    .toBeGreaterThanOrEqual(2);

  // The render-fix invariants are material configuration applied when the
  // surfaces load + style — independent of the layer group's page visibility
  // (the default deck page hides this layer), so they are asserted on the loaded
  // surface materials directly. This keeps the test page-deck-independent.
  const state = await mtVolumeSceneState(page);
  const material = state.thresholdMaterial;
  expect(material, "threshold surface material present").not.toBeNull();
  // No-colour fix: binary tiles carry no colour attribute, so vertexColors must
  // be off (material.color drives the per-threshold colour; enabling vertexColors
  // without a colour attribute renders the surface black).
  expect(material?.vertexColors).toBe(false);
  // Depth-occlusion fix: solid shells always write depth, so a front surface
  // occludes a back one through fades / lazy loads (and under reverse-Z).
  expect(material?.depthWrite).toBe(true);
  expect(material?.depthTest).toBe(true);
  // Every loaded surface material must hold both invariants.
  for (const [id, m] of Object.entries(state.thresholdMaterialsBySurfaceId)) {
    expect(m.vertexColors, `${id} vertexColors`).toBe(false);
    expect(m.depthWrite, `${id} depthWrite`).toBe(true);
  }

  // Phase-1 black fix: while a transition attenuates the surface below its
  // authored opacity, depth-write must drop so the fading shell blends instead
  // of occluding the volume behind it and leaving a black hole. Simulate a
  // mid-fade render opacity, assert depth-write is released, then confirm it
  // returns once the layer is back at full render opacity (settled).
  const setRenderOpacity = (factor: number) =>
    page.evaluate(
      ([layerId, value]) => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                applyLayerRenderOpacity?: (id: string, opacity: number) => void;
              };
            };
          }
        ).__scene?.manager;
        manager?.applyLayerRenderOpacity?.(layerId as string, value as number);
      },
      [THRESHOLD_LAYER_ID, factor] as const,
    );

  await setRenderOpacity(0.3);
  const midFade = await mtVolumeSceneState(page);
  expect(midFade.thresholdMaterial?.depthWrite, "depthWrite released mid-fade").toBe(
    false,
  );
  await setRenderOpacity(1);
  const resettled = await mtVolumeSceneState(page);
  expect(
    resettled.thresholdMaterial?.depthWrite,
    "depthWrite restored at settle",
  ).toBe(true);

  // R6 lazy unload: hiding a boundary evicts (disposes) its mesh, not just hides
  // it — bounding GPU memory as pages cycle through boundary subsets.
  const attachedThresholdIds = () =>
    page.evaluate(() => {
      const scene = (
        window as unknown as {
          __scene?: {
            scene?: {
              traverse: (
                fn: (o: { isMesh?: boolean; userData?: Record<string, unknown> }) => void,
              ) => void;
            };
          };
        }
      ).__scene?.scene;
      const ids: string[] = [];
      scene?.traverse((o) => {
        if (o.isMesh && typeof o.userData?.mtThresholdSurfaceId === "string") {
          ids.push(o.userData.mtThresholdSurfaceId as string);
        }
      });
      return ids.sort();
    });

  expect(await attachedThresholdIds()).toContain("resistive-ge-1000-ohm-m");

  // Hide one boundary via the canonical per-boundary map (it takes precedence
  // over the legacy visibility map in resolveMtSurfaceBoundaries).
  await page.evaluate((layerId) => {
    const sceneHandle = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene;
    const layer = sceneHandle?.manager?.getLayer?.(layerId);
    if (layer) layer.visible = true;
    sceneHandle?.manager?.applyStyle?.(layerId, {
      opacity: 1,
      mtIsosurfaceProductId: "mt-isosurface-full-extent",
      mtSurfaceBoundariesById: {
        "conductive-le-30-ohm-m": { visible: true },
        "resistive-ge-1000-ohm-m": { visible: false },
      },
      mtThresholdSurfaceWireframe: false,
      mtThresholdSurfaceSide: "double",
    });
  }, THRESHOLD_LAYER_ID);

  // The hidden boundary's mesh is evicted; the visible one stays attached.
  await expect
    .poll(attachedThresholdIds, { timeout: 30_000 })
    .not.toContain("resistive-ge-1000-ohm-m");
  expect(await attachedThresholdIds()).toContain("conductive-le-30-ohm-m");

  // Lazy binary load + dequantization + unload must not surface console/page errors.
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
