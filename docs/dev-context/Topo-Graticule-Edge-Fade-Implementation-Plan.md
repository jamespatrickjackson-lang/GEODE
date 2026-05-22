# Topo Graticule Edge Fade Implementation Plan

Status: implementation log / build pass return point

## Human Intent

The Utah FORGE longitude/latitude graticule should use the active topo map edge fade as its visual boundary. The interior grid should stay subtle over the topo map. Through the terrain edge fade band, grid lines should blend toward white, and the north/west edge coordinate labels should also read as white edge labels. The graticule must not appear as a fixed circular label ring floating inside the map.

## AI Interpretation

This is a visual map-reference feature. Terrain edge fade is the visual authority for the graticule. Public topo clipping remains separate hard clipping. The graticule should adapt to the terrain fade shape: square, rounded square, or circle.

## Return Point / Current State Before Implementation

- `projects/utah-forge/environment.json` keeps public topo clip and terrain edge fade separate.
- Terrain style currently has public clip fields with `publicSurfaceClipEnabled: false`, `publicSurfaceClipShape: "circle"`, center `[-1750, 0, 2000]`, size `[487600, 484100, 12600]`, and rotation `-20`.
- Active terrain edge fade style currently has `edgeFadeShape: "rounded-square"`, `edgeFadeInsetM: 0`, `edgeFadeCornerRadiusM: 55000`, and `edgeFadeDistanceM: 25000`.
- `projects/utah-forge/project.json` graticule metadata uses public-topo-style clip center, size, rotation, and 0.5 degree latitude/longitude steps.
- `src/loaders/loadTopoGraticule.ts` currently places labels using `localCircleMetric()` and `labelInsetM = radius * 0.965`, creating the internal circle behavior.
- `src/scene/SceneManager.ts` currently applies one graticule color/opacity and public clip planes in `applyTopoGraticuleStyle()`.
- `src/scene/terrainMaterial.ts` owns the square, rounded-square, and circle terrain edge fade math.
- `src/loaders/topoLineMaterial.ts` currently handles distance width and alpha attenuation only.
- `src/pages/PageController.tsx` drives page transitions through `SceneManager.transitionEffectiveLayersForPage()`. Graticule edge adaptation has no dedicated transition path yet.

## Files Expected To Be Touched

- `projects/utah-forge/environment.json`
- `src/pages/types.ts`
- `src/loaders/loadTopoGraticule.ts`
- `src/loaders/topoLineMaterial.ts`
- `src/scene/SceneManager.ts`
- `src/editor/LayerPanel.tsx`
- `tests/utah-forge-smoke.spec.ts`
- `docs/dev-context/Topo-Graticule-Edge-Fade-Implementation-Plan.md`
- fresh implementation notes, if this work resumes

## Implementation Plan

1. Add graticule edge-fade style fields:
   - `graticuleEdgeFadeAware`
   - `graticuleEdgeFadeStrength`
   - `graticuleEdgeLineColor`
   - `graticuleEdgeLabelColor`
   - `graticuleEdgeLabelVisible`
2. Add Utah FORGE defaults under `utah-forge-topo-graticule` with edge awareness enabled, white edge line/label color, strength `1`, and edge labels visible.
3. Store label candidate points on generated label meshes so runtime can re-place labels using the active terrain edge fade state instead of the old fixed circular inset.
4. Add graticule line material uniforms and shader blending so line color transitions from normal grid color to white inside the terrain edge fade band.
5. Add runtime terrain-edge evaluation in `SceneManager` that matches the terrain shader's square, rounded-square, and circle signed-distance behavior.
6. Reposition graticule labels using the active terrain edge fade boundary, while retaining ground-plane alignment, lift, scale, public clip planes, and page-local style behavior.
7. Make terrain style changes reapply graticule styling so changing edge fade shape/distance updates both terrain and graticule.
8. Treat graticule edge-fade style changes as discrete transition changes so page navigation crossfades rather than snapping when boundary-related styling changes.
9. Add editor controls under the longitude/latitude grid layer for edge awareness, strength, edge line color, edge label color, and edge label visibility.
10. Add smoke coverage for controls, uniforms, label placement, public clipping, and nonblank rendering.

## Risks

- Line color blending is shader-based and must not break the existing distance-width patch.
- Labels are canvas-text meshes, so v1 uses material tint and placement updates rather than mutating source data.
- Label placement changes may be visually discrete if page-local terrain edge shape changes. Crossfade handling is required to avoid a hard snap.
- Public topo clipping and terrain edge fade have different authorities and must remain separate.

## Verification Plan

- `npm run build`
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge`
- `node tools/report-project-artifact-coverage.mjs`
- Targeted Playwright smoke coverage for Utah FORGE topo graticule edge fade controls and runtime state.

## Implementation Outcome

Implemented on 2026-05-20.

- The graticule layer now carries edge-fade controls and defaults.
- Runtime line styling now receives terrain edge fade uniforms and blends toward white in the terrain fade band.
- Runtime label placement now evaluates stored graticule candidates against the active terrain edge fade boundary instead of the fixed circular inset.
- The editor exposes edge awareness, edge strength, edge line color, edge label color, and fade-label visibility controls under the longitude/latitude grid layer.
- Targeted build, metadata validation, artifact coverage, and smoke checks should be rerun if this work resumes.
