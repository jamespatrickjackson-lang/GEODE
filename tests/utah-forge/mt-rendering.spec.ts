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
const VOLUME_LAYER_ID = "utah-forge-mt-resistivity-volume";

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

  // Hiding a boundary removes it from the VISIBLE set but RETAINS its mesh
  // (no eviction): a boundary hidden on one page reappears on another via a
  // pure visibility toggle, with no async reload that could race a transition
  // commit and leave it stuck off.
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

  // The hidden boundary leaves the visible set...
  await expect
    .poll(
      () => mtVolumeSceneState(page).then((s) => s.visibleThresholdSurfaceIds),
      { timeout: 30_000 },
    )
    .not.toContain("resistive-ge-1000-ohm-m");
  // ...but its mesh is RETAINED (not evicted) so it can reappear cheaply, and
  // the still-authored boundary stays visible.
  expect(await attachedThresholdIds()).toContain("resistive-ge-1000-ohm-m");
  expect(
    (await mtVolumeSceneState(page)).visibleThresholdSurfaceIds,
  ).toContain("conductive-le-30-ohm-m");

  // Lazy binary load + dequantization must not surface console/page errors.
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

// The 3D raymarch volume and the Section ISO overlay share one layer. The
// raymarch's opacity must be driven by its own control (sectionIsoSourceOpacity),
// NOT coupled to sectionIsoEnabled — toggling Section ISO used to force the
// volume to full opacity ("turn off iso section -> volume turns on").
test("3D MT resistivity volume opacity is independent of the Section ISO toggle", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });

  const volumeUOpacity = () =>
    page.evaluate((layerId) => {
      const manager = (
        window as unknown as {
          __scene?: {
            manager?: {
              getLayer?: (id: string) =>
                | {
                    traverse: (
                      fn: (o: {
                        userData?: Record<string, unknown>;
                        material?: unknown;
                      }) => void,
                    ) => void;
                  }
                | undefined;
            };
          };
        }
      ).__scene?.manager;
      let value: number | null = null;
      manager?.getLayer?.(layerId)?.traverse((obj) => {
        if (obj?.userData?.scalarVolume !== true || !obj.material) return;
        const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const uniforms = (material as { uniforms?: { uOpacity?: { value?: unknown } } })
          .uniforms;
        if (uniforms?.uOpacity && typeof uniforms.uOpacity.value === "number") {
          value = uniforms.uOpacity.value;
        }
      });
      return value;
    }, VOLUME_LAYER_ID);

  // Apply an explicit sectionIsoSourceOpacity (0 = volume hidden) over the
  // current style, with sectionIsoEnabled either true or false.
  const applyWithSection = (sectionEnabled: boolean) =>
    page.evaluate(
      ([layerId, enabled]) => {
        const manager = (
          window as unknown as {
            __scene?: {
              manager?: {
                styleForLayer?: (id: string) => Record<string, unknown>;
                applyStyle?: (id: string, style: Record<string, unknown>) => void;
              };
            };
          }
        ).__scene?.manager;
        const current = manager?.styleForLayer?.(layerId as string) ?? {};
        manager?.applyStyle?.(layerId as string, {
          ...current,
          sectionIsoSourceOpacity: 0,
          sectionIsoEnabled: enabled as boolean,
        });
      },
      [VOLUME_LAYER_ID, sectionEnabled] as const,
    );

  await expect.poll(volumeUOpacity, { timeout: 60_000 }).not.toBeNull();

  await applyWithSection(true);
  const withSectionOn = await volumeUOpacity();
  await applyWithSection(false);
  const withSectionOff = await volumeUOpacity();

  // Explicit sectionIsoSourceOpacity=0 ⇒ raymarch hidden; toggling sectionIsoEnabled
  // must NOT change it (before the fix it jumped to full opacity).
  expect(withSectionOn).toBe(0);
  expect(withSectionOff).toBe(withSectionOn);
});

// DEC-186: the MT threshold iso-surfaces are ALWAYS a scene-section cut target,
// independent of the per-page sceneSectionTargetScope. Enabling a section whose
// selected-targets list does NOT include the threshold layer must still clip the
// surfaces — the program-level replacement for per-page scope authoring.
test("3D MT threshold surfaces are section-clipped even when not in the target list", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await hidePublicContextLayers(page);

  // Show the threshold surfaces; their binary tiles stream in asynchronously.
  await page.evaluate((layerId) => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const layer = manager?.getLayer?.(layerId);
    if (layer) layer.visible = true;
    manager?.applyStyle?.(layerId, {
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

  await expect
    .poll(
      () =>
        mtVolumeSceneState(page).then(
          (state) => state.visibleThresholdSurfaceIds.length,
        ),
      { timeout: 120_000 },
    )
    .toBeGreaterThanOrEqual(2);

  // Max section-clip-plane count across visible threshold surface materials.
  const surfaceClip = () =>
    page.evaluate(() => {
      const manager = (
        window as unknown as {
          __scene?: {
            manager?: {
              getLayer?: (
                id: string,
              ) =>
                | {
                    traverse: (
                      fn: (o: {
                        visible?: boolean;
                        userData?: Record<string, unknown>;
                        material?: unknown;
                      }) => void,
                    ) => void;
                  }
                | undefined;
            };
          };
        }
      ).__scene?.manager;
      let total = 0;
      let maxClip = 0;
      manager
        ?.getLayer?.("utah-forge-mt-resistivity-threshold-surfaces")
        ?.traverse((o) => {
          if (o.userData?.mtThresholdSurfacePreview !== true) return;
          if (o.visible !== true) return;
          const mats = (
            Array.isArray(o.material)
              ? o.material
              : o.material
                ? [o.material]
                : []
          ) as Array<{ clippingPlanes?: unknown }>;
          for (const mat of mats) {
            total += 1;
            if (Array.isArray(mat.clippingPlanes)) {
              maxClip = Math.max(maxClip, mat.clippingPlanes.length);
            }
          }
        });
      return { total, maxClip };
    });

  const before = await surfaceClip();
  expect(before.total).toBeGreaterThan(0);

  // Enable a scene section whose selected-targets list contains ONLY the volume —
  // NOT the threshold-surfaces layer.
  await page.evaluate(() => {
    const manager = (
      window as unknown as {
        __scene?: {
          manager?: {
            getLayer?: (id: string) => { visible: boolean } | undefined;
            applyStyle?: (id: string, style: Record<string, unknown>) => void;
          };
        };
      }
    ).__scene?.manager;
    const volume = manager?.getLayer?.("utah-forge-mt-resistivity-volume");
    if (volume) volume.visible = true;
    manager?.applyStyle?.("utah-forge-scene-section-planes", {
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: ["utah-forge-mt-resistivity-volume"],
      sceneSectionTargetProductIds: [],
      sceneSectionActiveAxis: "z",
      sceneSectionPlanes: {
        x: { enabled: true, positionM: -6000, invert: false },
        y: { enabled: true, positionM: 0, invert: false },
        z: { enabled: true, positionM: -6000, invert: false },
      },
      sceneSectionHelperVisible: true,
    });
  });

  // The section's hard clip planes must be applied to the surfaces (the clip-plane
  // count rises above the pre-section baseline) even though the threshold layer is
  // not in sceneSectionTargetLayerIds.
  await expect
    .poll(() => surfaceClip().then((s) => s.maxClip), { timeout: 30_000 })
    .toBeGreaterThan(before.maxClip);
});
