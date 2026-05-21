# Topo Edge Fade Shape Audit

Date: 2026-05-20

## Feature definition

Topo edge fade shape controls make the public terrain surface fade into the scene fog/background using a configurable boundary shape. This is a visual terrain shader feature only. It does not clip, crop, export, or mutate terrain/source data.

## Current architecture touched

- Terrain shader: `src/scene/terrainMaterial.ts` owns the edge fade color blend.
- Terrain config schema: `src/pages/types.ts` carries scene terrain settings.
- Topo editor: `src/editor/LayerPanel.tsx` exposes global terrain controls under Topo layers.
- Utah FORGE defaults: `projects/utah-forge/environment.json` stores default-preserving terrain values.
- Smoke coverage: `tests/utah-forge-smoke.spec.ts` checks editor controls and shader uniforms.

## Behavior

- `edgeFadeDistanceM` remains the fade width.
- `edgeFadeInsetM` moves the fade boundary inward from the terrain extent.
- `edgeFadeShape` selects square, rounded square, or circle.
- `edgeFadeCornerRadiusM` affects rounded-square mode only.
- The fade base is the raw terrain extent, not the public topo clip box.
- Public topo hard clipping remains separate.

## Verification

- Targeted Playwright: `npx playwright test tests/utah-forge-smoke.spec.ts -g "edge fade shape controls"` passed.
- Build: `npm run build` passed.
- Artifact metadata: `node tools/validate-artifact-metadata.mjs --project projects/utah-forge` passed.
- Artifact coverage: `node tools/report-project-artifact-coverage.mjs` passed.

