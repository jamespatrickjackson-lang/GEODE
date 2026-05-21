# Topo Surface Gradient Control Audit

Date: 2026-05-20

## Feature definition

Surface Elevation Gradient controls give the Utah FORGE topo surface an editable five-stop elevation ramp. The goal is to make the current public topo map read better by controlling color stop placement, transition spread, ramp softness, and color blend against the underlying soft-topo ramp.

This is a visual terrain shader/editor feature. It does not create higher-resolution terrain, crop data, process source rasters, or change any geophysical product.

## Source-resolution finding

- Active terrain layer: `terrain`.
- Active terrain raster: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/terrain_public_context_1000m.tif`.
- Project metadata describes this as a regional public terrain context resampled to approximately 1000 m.
- Runtime geometry is built from the GeoTIFF and capped by `terrainMaxVertices`, so visible blockiness can come from the source terrain sample spacing and render downsampling.
- Gradient controls can soften presentation and reduce harsh color-field reads, but they cannot add terrain detail that is not in the raster.

## Current architecture touched

- Terrain shader: `src/scene/terrainMaterial.ts` samples the surface-elevation ramp.
- Terrain schema: `src/pages/types.ts` carries scene terrain settings.
- Topo editor: `src/editor/LayerPanel.tsx` exposes the Global Settings topo controls.
- Legend UI: `src/ui/SurfaceElevationLegend.tsx` displays the same ramp controls as the shader.
- Utah FORGE defaults: `projects/utah-forge/environment.json` stores the active terrain defaults.
- Smoke coverage: `tests/utah-forge-smoke.spec.ts` checks editor controls and shader uniforms.

## New control model

- `surfaceElevationColorPositions`: five normalized stop positions.
- `surfaceElevationMidpoints`: four normalized transition spread handles between neighboring stops.
- `surfaceElevationTransitionSoftness`: global sharp-to-smooth transition control.
- `surfaceElevationColorBlend`: mixes the surface-elevation ramp back toward the underlying soft-topo ramp.

The v1 editor keeps exactly five color stops, matching the existing PDF-style palette model.

## Runtime behavior

- Existing surface elevation min/max remains the value domain.
- Stop positions control where each color maps within that domain.
- Midpoints bias which adjacent color dominates each transition.
- Ramp softness controls whether transitions read stepped, linear, or smooth.
- Color blend reduces harsh color blocks without altering terrain elevation or source data.
- The legend uses the same stop positions and midpoint hints as the shader.

## Remaining limits

- The terrain raster is still coarse regional context.
- Hillshade and color smoothing can improve visual read, but higher-resolution terrain remains a separate data path.
- V1 does not add/remove color stops or provide direct drag interaction on the rail; sliders provide deterministic editor control.

## Verification

- Targeted Playwright: `npx playwright test tests/utah-forge-smoke.spec.ts -g "surface elevation gradient controls"` passed.
- Build: `npm run build` passed.
- Artifact metadata: `node tools/validate-artifact-metadata.mjs --project projects/utah-forge` passed.
- Artifact coverage: `node tools/report-project-artifact-coverage.mjs` passed and refreshed `docs/dev-context/Generated-Reports/project-artifact-coverage.*`.
