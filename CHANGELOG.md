# GeoSee Change Log

## 2026-05-26 - MT Surface Boundaries And Transition Stability

- Added authorable MT surface-boundary controls for the `3D MT threshold surfaces` layer, including a `Surface boundaries` editor subcontainer, boundary order/style state, per-boundary visibility/color/opacity, and standalone legend handling.
- Added generated MT boundary-bank assets and metadata for focused and full-extent MT isosurface products while preserving the existing Utah FORGE threshold-surface layer id.
- Added scene-section smoothing and persistence work so saved MT section windows, ground trace, and section-helper state survive page navigation and editor interaction.
- Fixed transition artifacts where product-owned shader opacity was overwritten by generic layer fades. MT scalar volumes and seismic section/volume shaders now preserve their product opacity base through page transitions.
- Added a targeted Utah FORGE browser regression proving section-heavy page transitions do not reveal the hidden MT volume source while section ISO overlays are active.
- Verified `npm run build`, `npm run check:utah-runtime`, `git diff --check`, and the targeted MT transition test during the iteration.
- Status: transition stability checkpoint. The current rule is that page transitions must operate on render entities and product-owned opacity, not only layer ids.

## 2026-05-25 - Global MT Resistivity Tool Fidelity Pass

- Added `src/mtResistivity/` as the initial global MT resistivity tool boundary with product roles for point cloud, depth slices, cross-sections, isosurfaces, and scalar volume.
- Added shared slice product metadata and wired the Utah FORGE slice editor to single-slice / stack modes with a depth/elevation slider.
- Added source-count visibility logic so single-slice mode affects both slice meshes and vertical-section top traces.
- Added `tools/audit-mt-resistivity.mjs` and `npm run check:mt-resistivity` to validate source row counts, positive/masked rows, full-density tile totals, slice provenance, volume provenance, threshold surfaces, and prep-script computational inputs.
- Updated `npm run check:utah-runtime` so MT fidelity is part of the Utah runtime integrity gate.
- Documented MT as the second global-tool alignment after topo: Utah FORGE is the first instance, while the 90,000-point preview remains QA/support only and not computational source truth.
- Status: checkpoint toward a full global MT/resistivity workflow, not a final Marching Cubes or arbitrary live-slicing implementation.

## 2026-05-25 - Utah FORGE Topo Image And Site Details Iteration

- Added NAIP 2024 as a second Utah FORGE topo image material with generated active assets, material resolver/runtime support, alpha-aware rendering, detail overlay plumbing, and NAIP quality audit tooling.
- Kept `Ortho photo` and `NAIP 2024 Aerial Image` as separate material choices; NAIP now falls back to procedural topo instead of compositing Ortho underneath.
- Added Utah FORGE Phase 3 demo/orientation borehole data from public GDR survey sources, including two sourced well trajectories and a schematic surface facility block.
- Reworked the FORGE Data controls into `Site Details`, grouping the FORGE site boundary, 16A injection well, 16B production well, and surface facility/orientation block with independent presentation controls.
- Added per-well display controls for visibility, diameter, color, opacity, solid/dashed pipe style, centerline, collars, labels, and presentation-only path cleanup modes.
- Added structured site-detail style defaults under the Utah FORGE project module while keeping legacy borehole style fields readable.
- Updated runtime asset validation, topo settings/runtime tests, NAIP audit tests, and borehole/site-details tests.
- Updated `.gitignore` so local `.tmp/` intake/download staging stays out of the active repo.
- Verified `npm run build`, targeted Utah borehole/site-details Playwright tests, and `git diff --check` during the iteration.
- Status: checkpoint toward Utah FORGE visual/toolset refinement, not a final shipped UI or engineering-grade borehole/building deliverable.

## 2026-05-23 - Toolset Sidebar And Topo Structure Checkpoint

- Continued the topo map cleanup as a global GeoSee toolset pattern rather than a Utah FORGE-specific editor branch.
- Kept `src/topoMap/` and `src/editor/topoMap/` as the current precedent for global defaults, resolver/runtime behavior, editor controls, and project-authored diffs.
- Promoted `Visual Studio` and `UI` to top-level editor sections beside `Page Manager`, `Public Topo Map`, data sections, and overlay tools.
- Refined Page Manager and Global Settings chrome with shared pill, spacing, and dark material tokens instead of local one-off container styling.
- Reworked the Public Topo Map editor into cleaner peer containers for topo surface settings, longitude/latitude grid, title block, and reference layers.
- Added shared transparent legend styling so MT, surface elevation, seismic, section ISO, and scene-section legends no longer carry heavy card backplates.
- Removed explanatory MT legend text from the viewport while preserving the interactive scalar handles and controls.
- Verified `npm run build` and `git diff --check` during the iteration.
- Status: checkpoint toward the editor/toolset structure, not a final shipped UI.

## 2026-05-13 - Utah FORGE Seismic Capability Layer Rows

- Promoted seismic capability controls to virtual layer-level rows in the FORGE Data list, beside the main Utah FORGE Phase 3 seismic browser layer.
- Added separate top-level 3D product containers for the four raymarch-capable seismic products, each with visible, volume, slice, sync, slice axis, position, opacity, amplitude, palette, white-background, and time-scale controls.
- Kept source rendering on the one real seismic scene layer while the virtual capability rows patch its browser style state.
- Kept 2D/legacy theatre, processing comparison, display cleanup, survey geometry, integrated geophysics, and data confidence as top-level capability rows.
- Updated Utah FORGE Playwright coverage to assert four 3D product containers and confirm they are not nested inside the seismic browser or Appearance controls.
- Verified `npx tsc -b`, `npm run build`, and `npm run test:utah-forge`.

## 2026-05-13 - Utah FORGE Seismic Capability Container Follow-Up

- Moved the seismic capability sections out from under Appearance / Seismic browser so each one is now a first-class container under the Utah FORGE Phase 3 seismic browser layer.
- Renamed the Utah FORGE public-data sidebar heading to `FORGE Data`.
- Added a `Display cleanup` capability container exposing opacity, amplitude window, palette, white-background removal, and time-scale controls.
- Added `seismicComparisonSpacingM` and wired side-by-side processing comparisons to physically offset the comparison curtain in the scene.
- Extended Utah FORGE smoke coverage to assert capability containers are not nested under Appearance or Seismic browser and that side-by-side spacing changes real section positions.
- Verified `npx tsc -b`, `npm run build`, and `npm run test:utah-forge`.

## 2026-05-13 - Utah FORGE Seismic Capability Sub-Containers

- Added meeting-ready seismic capability sub-containers under the existing Utah FORGE Phase 3 seismic browser layer.
- Added 3D volume product controls for the four true raymarch-capable products, plus slice and synced volume/slice actions.
- Added 3D slice plane, volume + slice sync, 2D/legacy section theatre, processing comparison, survey geometry, integrated geophysics, and data confidence sections.
- Added seismic style fields for capability preset id, comparison mode, and source/receiver/line navigation role visibility.
- Refactored seismic navigation runtime objects into independent source, receiver, and survey-line visibility roles while preserving the all-navigation toggle.
- Extended generated seismic demo recipe metadata with 14 source-derived capability presets.
- Extended Utah FORGE artifact and Playwright scene tests to validate capability presets, the 4 raymarch products, navigation roles, comparison overlays, synced slicing, and MT coexistence.
- Verified `npx tsc -b`, `npm run build`, and `npm run test:utah-forge`.

## 2026-05-13 - Utah FORGE Investor Seismic Demo Roadmap

- Added a seismic “White bg” toggle that removes neutral/white fill from section curtains and raymarch sampling while preserving strong amplitude colors.
- Section curtains now use a small shader with per-vertex alpha so the neutral seismic background can be hidden without deleting or changing the source-derived amplitude data.
- Added a generated Utah FORGE seismic demo recipe artifact at `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_demo_recipes.json`.
- Extended the Phase 3 seismic manifest with `displayRecipes`, `audiencePresets`, `derivedViews`, `interpretationLayers`, and `exportLayouts`.
- Added `prep/build_utah_forge_seismic_demo_recipes.mjs` so investor, technical, data-room, and export presets can be regenerated from the current 34-product seismic manifest.
- Added seismic editor style fields for audience mode, audience preset, display recipe, synced slice-through-volume, comparison product, export layout, and MT co-render mode.
- Added Utah FORGE seismic panel controls for audience presets, investor disclosure labels, MT coexistence, product comparison, data-room summary, and export layout metadata.
- Added raymarch slice-through-volume support so compatible 3D products can show a synced section plane while the volume remains visible.
- Extended Utah FORGE smoke coverage for demo recipe validation, investor preset switching, 2D line theatre comparison, data-room mode, export layout mode, and MT coexistence opacity.
- Verified `npx tsc -b`, `npm run build`, and `npm run test:utah-forge`.

---

Earlier session-snapshot entries (2026-05-11 and 2026-05-12) moved to
[CHANGELOG-Archive.md](./CHANGELOG-Archive.md) on 2026-05-26 to keep
this log scannable.
