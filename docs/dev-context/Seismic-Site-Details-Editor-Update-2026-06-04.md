# Seismic And Site Details Editor Update - 2026-06-04

Status: implementation receipt for current editor/runtime commit.

## Scope

- Seismic capability tooling now exposes figure annotation controls for section products, including title, caption, scale label, text/axis/caption-box colors, horizon polyline, well marker, label size, and outside offset.
- Seismic figure annotation runtime derives labels from product metadata and section geometry instead of hard-coded line, inline, scale, or well text.
- Seismic product visibility state treats explicit product visibility maps as authoritative over stale per-product visibility records, so selecting a new product no longer leaves prior products active.
- Scene section plane controls restore explicit seismic product target toggles through `scene-section-target-product-*` controls.
- Site details now expose always-on-top rendering, topo alignment, and per-source-location label visibility.
- MT station point markers now support topo alignment through `pointMarkerAlignToTopo`.
- Legend figure blocks use compact dark framed styling for seismic and resistivity legends.

## Render Stack Trace

Pre-edit visual trace command:

```powershell
node tools/inspect-effective-state.mjs --page 50_integrated_seismic_resistivity_context --render-stack --json --only-layer utah-forge-phase3-seismic-browser --layer utah-forge-mt-resistivity-volume --layer utah-forge-mt-resistivity-threshold-surfaces --layer terrain
```

Trace result:

- Page: `50_integrated_seismic_resistivity_context`.
- Render preset: `user-3`; no envSnapshot/page override payload reported.
- Seismic layer: `utah-forge-phase3-seismic-browser`, product `gdr-1015-forge3d-velo5d-float-01312018`, render mode `raymarch`, opacity `0.34`, `seismicMtCoRender: "seismic"`, Section ISO disabled, `ShaderMaterial`, `Data3DTexture`, `BoxGeometry`.
- MT volume: hidden on page, product `mt-resistivity-forge-focused-volume`, Section ISO enabled, source opacity `0`, ISO range `[-2, 4.5]`.
- Terrain texture: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`.
- Terrain bounds: `[229069.2, 4094688, 598806, 4414308]`.
- Terrain material preset: `image:naip-2024-aerial`; public clip enabled; material edge fade `rounded-square 10000m`; edge outline enabled; active render preset `user-3`.

Line 301 figure-annotation trace:

- Page: `55_line_301_seismic_products`, title `Line 301 Seismic Products`.
- Scene sources: no active render preset id, no Sub Master `envSnapshot`, no render preset `scenePatch`, no page `sceneOverrides`; inherits global `environment.scene`.
- Scene defaults: background `#383838`, ACES tone mapping, exposure `1.2`, fog enabled.
- Terrain material authority: `image:naip-2024-aerial` over the public topo surface.
- Effective terrain texture: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`.
- Terrain bounds: `[229069.2, 4094688, 598806, 4414308]`; public clip enabled; material edge fade `rounded-square 10000m`; edge outline enabled.
- Seismic product: `gdr-1015-forge2d-301-migr-depth`, render mode `slice`, slice axis `line`, fraction `0.5`, opacity `0.74`, colormap `blue-white-red`, background removal enabled.
- Section data: `2D Line 301 migrated depth section`, GDR 1015, section `321 x 1929`, depth domain `0` to `8165.080078 m`, datum `1800 m`, delivered navigation endpoints.
- Seismic material/geometry: `THREE.DataTexture` amplitude section, `THREE.ShaderMaterial` with section uniforms and colormap/background-removal uniforms, four-corner `THREE.BufferGeometry`.
- Interpretation status: no reviewed horizon/fault/well picks were present in the manifest; optional horizon/well annotations must stay authored controls rather than invented defaults.
- Runtime station-page topo stack: terrain visible, `scale.z = 3.25`, `position.z = -3125`, public clipping active with 6 clip planes, `renderedTopoSurfaceKey = "topo:3.250000:-3125.000"`.

## Runtime Notes

- Seismic figure annotations are attached to visible seismic section meshes and disposed when the source section hides.
- Annotation text is generated through `buildSeismicFigureAnnotationModel`; defaults come from product label, line label, source submission, sample domain, section start/end, and navigation status.
- Topo-aligned overlays are reapplied after topo surface or public-surface style changes through `reapplyTopoAlignedOverlays`.
- Site details always-on-top preserves original object render order and material depth flags before applying authoring overrides.
- Scene section target product controls update `sceneSectionTargetScope: "selected-targets"` and persist `sceneSectionTargetProductIds`.

## Verification

Completed before commit:

- `npm run check:workspace` - exit 0; reported local changes and snapshot-sensitive local work before staging.
- `npx tsc -b --pretty false` - exit 0.
- `node -e "await import('./tests/tools/site-details-source.test.mjs')"` - exit 0; 5 TAP tests passed.
- `node -e "await import('./tests/tools/seismic-figure-annotations.test.mjs')"` - exit 0.
- `node -e "await import('./tests/tools/geophysics-figure-legend-source.test.mjs')"` - exit 0; 2 TAP tests passed.

Browser verification status:

- Focused Playwright was started against seismic/site-details editor specs, then stopped per instruction to avoid additional testing in this run.
- The interrupted browser run had already exposed a timeout in `tests/utah-forge/site-details-labels.spec.ts` for topo-alignment runtime sampling. Treat browser state as not fully verified until a future visual/browser pass is requested.

## Visual Status

Automated checks only prove source and runtime contract health. Final visual status remains `ready for visual check` until human browser validation confirms the updated editor and scene output.
