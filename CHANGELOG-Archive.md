# GeoSee Change Log — Archive

Earlier session-snapshot entries archived from `CHANGELOG.md` on
2026-05-26 to keep the active change log scannable. The two entries
below are handover-style state snapshots, not per-change entries.

## 2026-05-12 - Current Session Kept Change Log

This entry records the later-session changes that are still present in the repo and were not fully captured by the 2026-05-11 handover entry below.

### Changelog scope

- Only the repo-level `CHANGELOG.md` exists outside `node_modules`.
- No dependency changelogs were edited.
- This entry records kept state only.
- Discarded mesh-stitching, seam, island-knit, and temporary visual experiments are not recorded as active changes.

### Architecture updates kept

- `src/App.tsx` now lazy-loads `EditorChrome` with React `lazy` / `Suspense`.
- The editor chrome no longer has to be part of the first landing-page bundle.
- This reduces initial project-selector weight and keeps the heavier editor, scene UI, page controller, and overlay controls behind the project-open path.
- `src/editor/EditorChrome.tsx` now acts as the editor shell boundary around:
  - `PageControllerProvider`
  - navigation controls
  - scale bar
  - editor root panel
  - bottom HUD controls
  - scene labels
  - presenter logo
  - overlay display
- Scene layer loading has been moved into `src/scene/layerLoaders.ts`.
- `src/scene.ts` now registers layer ids and delegates individual layer loading to `loadLayerInto`.
- `src/scene/layerLoaders.ts` centralizes loader matching, app asset path resolution, legacy fallback paths, and per-layer load error handling.
- Project-specific loader cases such as the Shahbazi split surface, Shahbazi split contours, Shahbazi photo overlay preview, and the Base GUI reference stage are now contained in the layer loader registry instead of being scattered through `scene.ts`.
- `src/scene/layerLoaders.ts` also supports `previewFiles` first, with fallback to older `files` records.
- A `src/utils/debugLog.ts` helper is now used for development-only diagnostic logging.
- Several runtime loader debug messages now route through `debugLog`, so production builds keep real warnings/errors visible without normal diagnostic chatter.

### Surface render policy kept

- Surface material/depth behavior is centralized in `src/loaders/surfaceRenderPolicy.ts`.
- Kept named render policies include:
  - `depth-occluding-transparent-surface-preview`
  - `projected-image-alignment-preview`
- Kept shared render-order constants include surface mesh, outer mesh, contour, boundary, depth occluder, and photo overlay order values.
- `src/loaders/loadMeshPreview.ts` now uses the named surface-preview material and an optional named depth-occluding policy.
- `src/loaders/loadPhotoOverlayPreview.ts` now uses the named photo-overlay material policy.
- The current mesh preview material renders `THREE.FrontSide`.
- The current surface depth occluder also renders `THREE.FrontSide`.
- The current projected image preview also renders `THREE.FrontSide`.
- Surface preview meshes keep `scaleReferenceSurface` so the screen scale bar can raycast against a meaningful measured surface.
- Photo overlay preview materials retain explicit provenance-oriented user data including the named front-face policy `uav-camera-facing`.

### Surface winding and generated artifacts kept

- Shahbazi surface generators now enforce upward-facing triangle winding for preview meshes instead of relying on runtime face flipping.
- `prep/build_shahbazi_outer_surface_preview.mjs` enforces upward winding for the broad object-point-derived outer surface.
- `prep/build_shahbazi_tls_surface_mesh_preview.mjs` enforces upward winding for the fine TLS island surface.
- `prep/build_shahbazi_tie_point_support_isolines_geojson.mjs` records upward-facing winding for the tie-point support isoband mesh.
- `prep/build_shahbazi_photo_overlay_preview.mjs` flips generated projected-photo triangles where needed so UAV-side projected faces are oriented correctly for the app.
- `src/loaders/loadMeshPreview.ts` stays generic and no longer carries a Shahbazi-only runtime winding correction.
- The kept contract is: source-derived preview artifacts should carry the correct top-side winding; the loader should render the declared mesh front side.

### Project and data wiring kept

- `ProjectLayerSpec` now supports `previewFiles` and `futureTargets` in `src/pages/types.ts`.
- Case Study B active browser-ready preview assets are recorded under `previewFiles`.
- Case Study B missing future production assets are recorded under `futureTargets`.
- This separates active preview files from planned GLB, Potree/EPT, orthomosaic, and derived-overlay targets.
- `projects/case-study-b/data/README.md` now reflects that Shahbazi source-derived preview artifacts exist.
- The data README now explicitly states that the Shahbazi outputs are browser-ready previews, not final GIS or engineering deliverables.
- The data README now calls out:
  - sampled and tiled TLS point previews
  - separate TLS island surface
  - separate sparse-object-point outer surface
  - split contours
  - GCP/check point, camera, frustum, dense-matching, and tie-point QA layers
  - first-pass projected UAV image preview
- Shahbazi layer metadata now separates `sourceDate: "2019"` from `derivedArtifactDate: "2026-05-11"` for kept source-derived preview artifacts where applicable.
- The broad outer ground surface remains described as sparse photogrammetry object-point interpolation, not LiDAR.
- Future targets remain disabled/planned until real processed outputs exist.

### Base GUI project kept

- A Base GUI template project is kept under `projects/base-gui/`.
- Kept Base GUI files include:
  - `projects/base-gui/project.json`
  - `projects/base-gui/environment.json`
- `src/projects/projectCatalogRuntime.ts` includes `BASE_GUI_PROJECT`.
- The normal landing project list still exposes Woodjam and Shahbazi Gravel Pit.
- The Base GUI template is available as a non-listed development/editing target through the landing action.
- The Base GUI scene contains a procedural reference stage layer:
  - `base-gui-reference-stage`
- The Base GUI template is for editing shared GUI, overlay, navigator, label, lighting, and environment defaults without loading a real project dataset.
- `src/scene/layerLoaders.ts` includes a procedural loader for the Base GUI reference stage.

### Utah FORGE foundation project kept

- A Utah FORGE foundation project is kept under `projects/utah-forge/`.
- Kept Utah FORGE files include:
  - `projects/utah-forge/project.json`
  - `projects/utah-forge/environment.json`
  - `projects/utah-forge/pages/01_overview.json`
  - `projects/utah-forge/overlays/01_overview/text.md`
  - `projects/utah-forge/data/README.md`
  - `projects/utah-forge/data_refs/README.md`
- `src/projects/projectCatalogRuntime.ts` includes `UTAH_FORGE_PROJECT`.
- Utah FORGE appears as a normal selectable project on the landing page.
- The Utah FORGE scene contains a procedural reference stage layer:
  - `utah-forge-reference-stage`
- `src/scene/layerLoaders.ts` includes a procedural loader for the Utah FORGE reference stage.
- Utah FORGE now contains first-pass Phase 3 MT source-derived viewer outputs.
- Utah FORGE Phase 3 MT station markers, full-density resistivity point cloud, QA resistivity point preview, and authored resistivity slices are wired as active project layers.
- The Phase 3 MT station layer is classified as measured station-location data.
- The Phase 3 MT resistivity layers are classified as source-derived inversion model previews, not direct field measurements.
- The Phase 3 MT processing frame is documented as EPSG:26912 / NAD83 UTM Zone 12N, rendered as scene-local meters.
- The Phase 3 MT model is kept uncropped with vertical exaggeration 1.0.
- CRS, real site bounds, source manifest, full-density renderer artifacts, and production layer targets are documented for the Phase 3 MT path; Southwestern/regional MT and seismic remain follow-on work.
- Incorrect early folders under `projects/utah-forge/data/` were purged.
- Utah FORGE data intake now has four client-preprocessed dataset slots:
  - Forge Southwestern electrical resistivity
  - Forge Southwestern seismic analysis
  - Utah FORGE Phase 3 electrical resistivity
  - Utah FORGE Phase 3 seismic analysis
- GeoSee-converted outputs are separated under `projects/utah-forge/data/geosee_processed/`.
- Utah FORGE intake staging records now point to the four expected incoming dataset slots.
- Utah FORGE scalar MT layers expose editor controls for color ramp, display range, midpoint, contrast, point size, station-marker lift/radius, slice group toggles, individual slice visibility, and value legend visibility.
- `src/ui/ResistivityLegend.tsx` adds a page-aware MT resistivity legend that follows the visible scalar layer and its effective editor style.

### Utah FORGE Stage 2 Phase 3 MT resistivity kept

- `projects/utah-forge/Stage 2 - Phase 3 MT resistivity.md` records the Stage 2 implementation contract.
- Stage 2 is renderer and full-density data-density work, not story/page presentation work.
- Seismic remains explicitly blocked until the user says to start.
- `prep/build_utah_forge_mt_resistivity_full_density.mjs` generates the full-density Phase 3 MT artifact from all positive-resistivity model rows.
- The full-density artifact is written as tiled binary positions and scalar buffers under `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/`.
- The full-density layer id is `utah-forge-mt-resistivity-full-density`.
- The full-density layer is colored by `log10(resistivity_ohm_m)` through scalar-aware tiled point-cloud loading.
- `prep/build_utah_forge_mt_top_surface.mjs` generates `utah-forge-mt-top-surface`, a preview-derived approximate ground cap from the existing 90,000-point MT resistivity model preview only.
- The preview ground cap writes `mt_top_surface_mesh_preview.json`, `manifest.json`, `stats.json`, and `provenance.json` under `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/`.
- The generated ground cap currently contains 1,135 vertices and 1,844 adjacent-grid triangles. It uses 2,500m bins, p95 upper elevations, largest connected upper-component filtering, light smoothing, and adjacent-cell triangulation to avoid sparse-column icicle sheets.
- The MT ground cap is exposed in the Utah FORGE Public Data editor group with dedicated standalone surface variables for lift, wireframe, roughness, and metalness; it is not controlled by the MT scalar trim/feather legend.
- The existing MT station, authored slice, and QA preview layers remain available.
- Utah FORGE default visible layers are now the MT stations, the full-density MT resistivity layer, and the preview-derived MT ground cap; the QA point preview is hidden by default.
- Playwright is installed for local browser validation.
- `playwright.config.ts` and `tests/utah-forge-smoke.spec.ts` add a reusable Chromium smoke test for the Utah FORGE Stage 2 full-density route.
- `npm run test:utah-forge` verifies the app route, canvas, full-density legend, editor controls, full-density manifest, and binary tile requests.
- `npm run test:e2e`, `npm run test:e2e:headed`, and `npm run test:e2e:ui` are available as Playwright browser-test entry points.
- Utah FORGE scalar MT controls now support a four-handle spectral window: outer trim handles define the hard keep/drop range, while inner feather handles define how soft the two boundary transitions are.
- The MT resistivity legend shows the four spectral handles, dims values outside the trim range, feather-shades the transition bands, and reports both the trim window and feather range.
- Runtime scalar styling rebuilds point/mesh geometry indices so scalar values outside the trim window are hidden and values between each outer trim handle and inner feather handle are deterministically thinned.
- The MT resistivity legend handles are now interactive: drag or keyboard-adjust the outer trim handles and inner feather-boundary handles directly from the legend.
- The spectral window semantics are split explicitly: trim/feather edits never rescale the source MT color spectrum; point colors remain pinned to the original scalar display range.
- Legend spectral-handle edits now push the merged scalar style directly to the live scene manager before saving the page override, so dragging handles changes the rendered MT layer immediately even when the sidebar is not focused on that page.
- Clicking on the MT legend spectrum track now places the nearest spectral handle instead of only responding to direct handle drags.
- Scalar trim now uses the inner feather handles as a sparse/coarse transition band: values inside the inner feather range are fully shown, values outside the outer trim range are hidden, and values between inner/outer handles are deterministically thinned.
- The Utah FORGE Playwright smoke test now compares canvas screenshots before and after legend trimming so UI-only updates cannot pass without a visible scene change.
- Global Settings preview now preserves only the Utah FORGE MT scalar trim/feather page override fields, preventing legend drags from snapping back while keeping unrelated page overrides stripped.
- Utah FORGE MT scalar-window page transitions now crossfade a temporary snapshot of the outgoing scalar-filtered layer against the incoming scalar-filtered layer, so MT subsets blend with camera moves instead of snapping at transition start.

### Utah FORGE handoff and documentation package kept

- Utah FORGE project documentation was updated from planning-only language to the current active Phase 3 MT state.
- `projects/utah-forge/Utah_Forge_Decisions.md` now records the locked folder contract, active Phase 3 MT layer status, CRS/origin, source counts, scale rules, resolved items, unresolved items, and next sequence.
- `projects/utah-forge/Utah_Forge_DevPlan.md` now describes the implementation roadmap as completed/current/future stages instead of mixing old intake notes with next actions.
- `projects/utah-forge/Utah_Forge_Data_Intake_Checklist.md` now records the current Phase 3 MT source files, processed outputs, completed checklist items, and future intake gates.
- `projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md` was added as a reusable guide for bringing future Utah FORGE datasets into GeoSee.
- `projects/utah-forge/AI_NEXT_AGENT_START_HERE.md` was added as the handoff/start-here guide for the next AI agent or developer.
- `projects/utah-forge/Utah_Forge_Next_Stage_Gates.md` was added with acceptance gates for baseline verification, presentation pages, visual tuning, interpretation context, and future dataset selection.
- `projects/utah-forge/data/README.md` now points to the active handoff docs and records current Phase 3 MT source/output state.
- `projects/utah-forge/data_refs/README.md` now records the current known Phase 3 MT data reference state instead of saying briefing/source/CRS are pending.
- `projects/utah-forge/data/geosee_processed/README.md` now describes active and inactive processed-output families.
- `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/README.md` now records the active Phase 3 MT outputs and caveats.
- `docs/START-HERE.md` now reflects that Utah FORGE has live Phase 3 MT data outputs, not only a foundation scaffold.
- `crs_transform.json` for Phase 3 MT was updated from its old pre-wiring status to the current app-wired preview/slice status.

### Landing page kept

- The project landing screen has been restyled away from the old light placeholder layout.
- The landing screen now uses the same dark viewer background family as the Shahbazi Gravel Pit scene.
- The landing screen now uses technical mono typography.
- Project choices are standalone overlay-style buttons, not a single enclosing card.
- Project buttons keep flat interiors and use outline/frost interaction rather than interior hover fills.
- Woodjam, Shahbazi Gravel Pit, and Utah FORGE buttons include white line-style map/project icons.
- The Add New Project action uses a plus-style icon and currently opens the Base GUI template path.
- The former "Skip landing and load Woodjam for development" button is replaced by `EDIT BASE GUI`.
- `EDIT BASE GUI` keeps a compact action-button footprint and opens the Base GUI template.
- The landing background supports a user-selected image from local file input.
- The landing image editor is opened from a bottom HUD-style gear button.
- Landing image settings are persisted in browser local storage under `geosee.landingImageProfile.v1`.
- Landing image controls kept:
  - load image
  - save
  - reset effects
  - clear image
  - effect overlay toggle
  - opacity
  - frost blur
  - saturation
  - brightness
  - contrast
  - darkness
  - vignette
  - grayscale
  - sepia
  - hue
  - scale
  - X position
  - Y position
- Landing image controls use the same dark overlay-box aesthetic as the in-app editor work.

### Editor shell visual style kept

- The editor panel has been rebuilt around the dark frosted overlay-box aesthetic.
- The editor panel now derives its shell material from the active project GUI overlay settings where possible.
- The editor shell reads overlay-style values such as:
  - background color
  - background alpha
  - border color
  - border alpha
  - border width
  - blur
  - saturation
  - shadow alpha
  - shadow blur
  - shadow offset
  - radius
  - text color
  - body font family
- The editor panel uses transparent header/stack interiors so the shell material is not double-darkened by nested fills.
- The editor panel uses a technical mono font family to match the intended product GUI language.
- The editor panel outside margin is governed by `FLOATING_PANEL_MARGIN` in `src/editor/EditorRoot.tsx`.
- The editor panel reserves bottom space for the HUD button row through `BOTTOM_HUD_SAFE_ZONE`.
- The editor panel is box-sized from its outer border so its screen margin behaves as an outside-container margin.
- The old bright editor sidebar material has been replaced with a dark glass style across the main editor container, page manager, section buttons, nested controls, and supporting panels.
- The editor shell highlight/inset artifacts were removed so the outer frame no longer carries an unintended top glow.

### Editor button and row styling kept

- Shared editor style tokens in `src/editor/styles.ts` now describe the current dark overlay-box material.
- Top-level editor section bars use the same flat dark button language as the overlay/landing controls.
- Section bars avoid extra interior gradients.
- Hover treatment is outline-focused rather than an interior color shift.
- Selected page-linked section bars keep a flat accent infill while preserving the normal thin edge treatment.
- Page rows keep flat color infill for selected pages instead of outline-only selection.
- Page row edge styling stays visually consistent with the normal row edges.
- The Page Manager page list no longer shows a duplicate icon inside every page row.
- The dedicated duplicate action remains available as a Page Manager action button for the selected page.
- The old extra duplicate button/visual redundancy was removed from the row-level controls.
- `src/audience/AudienceLensControls.tsx` no longer displays an `Audience Lens` label in the compact editor control block.
- Audience lens buttons now match the dark glass button style.
- The preview-mode audience prompt remains centered and uses the overlay-box style without an extra label.
- The preview-mode audience prompt does not pre-highlight an option before selection.

### Save control kept

- The editor header save control was rebuilt as a compact round HUD-style button.
- The save button now uses a smaller visually aligned disk icon.
- The saved state matches the bottom HUD button style.
- The unsaved state changes only the button infill to a light red signal.
- The save control avoids oversized icon/circle proportions.
- Save status text remains available in the editor header.

### Bottom HUD and home navigation kept

- The bottom HUD cluster now includes:
  - preview/presentation button
  - compass
  - light/dark control
  - home button
- The home button sits at the far right of the bottom HUD cluster.
- The preview/presentation button shifted left to make room for the home button.
- The bottom HUD buttons share the same circular icon-button language.
- `src/ui/LightModeToggle.tsx` owns the bottom HUD control cluster behavior.
- The home button now returns to the project landing page rather than navigating to the first presentation page.
- `src/App.tsx` exposes a `returnToLanding` path that clears the loaded project, scene handle, load error, and project load state back to landing.
- `src/editor/EditorChrome.tsx` passes the home-return callback into the HUD controls.
- If there are unsaved editor changes or a save error, pressing Home opens a prompt before leaving.
- The unsaved-exit prompt offers:
  - `Save & Exit`
  - `Exit`
  - `Cancel`
- `Save & Exit` calls `commitPending` and waits for the editor dirty set to clear before returning to the landing page.
- If save fails, the prompt remains open and reports the save error instead of leaving.

### Page duplication kept

- Page duplication remains available from the Page Manager action area.
- `src/editor/EditorContext.tsx` keeps `duplicatePageById`.
- Duplicating a page copies the page record and markdown overlay text.
- Duplicating a page now also attempts to copy referenced overlay image assets into the duplicated page overlay folder.
- Missing overlay assets are warned about instead of crashing the duplicate operation.
- New duplicated pages are inserted directly below the source page.

### Projected image and surface orientation kept

- Shahbazi projected image preview remains a visual alignment preview, not an orthomosaic.
- The UAV-facing side is treated as the front face for projected image preview geometry.
- Photo overlay geometry is raised only by the named preview clearance value from `PHOTO_OVERLAY_PREVIEW_POLICY`.
- Shahbazi surface meshes and projected image preview now follow the same top-side/front-side expectation.
- The current surface/photo contract is documented through mesh user data and render policy names.

### Kept limitations after this session

- The Shahbazi projected image preview is still a first-pass projection from selected downsampled UAV images.
- It is not a full orthomosaic, final texture, or full photogrammetry product.
- The scale bar remains local/raycast-based against visible `scaleReferenceSurface` objects.
- It can be accurate at the sampled surface point, but it is not a global map-scale guarantee for every camera pose.
- The editor save flow is still sequential and not a true transaction across all files.
- Large editor panels such as `LayerPanel.tsx` and `EnvironmentScenePanel.tsx` remain candidates for future extraction even though the main editor bundle is now lazy-loaded.

## 2026-05-11 - Full Session Kept Change Log

This entry records the work from the current GeoSee session that is still kept in the repository. It is written as a handover record of the current build state, not as a record of discarded experiments.

### Project framing kept

- GeoSee is now treated as a multi-project visual communication app, not a single hardcoded Woodjam-only build.
- Woodjam remains the real/reference project and is preserved as a selectable project.
- Case Study B is kept as the high-fidelity quarry/gravel-pit demo project.
- Project loading is project-folder aware, so project assets, pages, overlays, saves, and editor write targets can resolve through the selected project root.
- Project naming in the app uses the loaded project metadata instead of a hardcoded Woodjam label.

### Multi-project support kept

- Project catalog support remains in `src/projects/projectCatalog.ts`.
- Project path resolution remains in `src/projects/projectPaths.ts`.
- Page loading remains project-aware through `src/pages/loadPages.ts`.
- App/editor state remains wired for the selected project through:
  - `src/App.tsx`
  - `src/editor/EditorRoot.tsx`
  - `src/editor/types.ts`
  - `src/editor/EditorContext.tsx`
  - `src/editor/save.ts`
- Overlay and layer editor paths remain project-aware through:
  - `src/presenter/OverlayDisplay.tsx`
  - `src/editor/OverlayPanel.tsx`
  - `src/editor/LayerPanel.tsx`
  - `src/editor/EnvironmentScenePanel.tsx`

### Case Study B project scaffold kept

- Case Study B remains selectable from the project landing flow.
- The Case Study B folder remains under `projects/case-study-b/`.
- The kept Case Study B project files include:
  - `projects/case-study-b/project.json`
  - `projects/case-study-b/environment.json`
  - `projects/case-study-b/project.config.json`
  - `projects/case-study-b/pages/01_overview.json`
  - `projects/case-study-b/pages/02_bench_walkthrough.json`
  - `projects/case-study-b/pages/03_anomaly_story.json`
  - `projects/case-study-b/pages/04_planning_governance.json`
  - `projects/case-study-b/pages/05_public_communication.json`
  - `projects/case-study-b/overlays/*/text.md`
  - `projects/case-study-b/data/`
  - `projects/case-study-b/data_refs/`
- The project remains framed as a demo/reference quarry project, not a final engineering model.

### Procedural fallback kept

- The procedural quarry shell remains available as fallback scaffolding.
- The procedural demo loader remains in `src/loaders/loadDemoQuarry.ts`.
- Case Study B can still open even if real Shahbazi processed outputs are missing.
- The kept procedural shell includes:
  - quarry base/demo shell
  - bench/grid detail
  - haul-route/equipment path
  - labelled zones for bench walkthrough, hotspot, stockpile/volume, slope anomaly, restoration preview, and public viewpoint/viewshed
- Synthetic/demo layers remain separated from observed or source-derived Shahbazi layers.

### Audience Lens kept

- Audience Lens remains available only for Case Study B.
- Woodjam does not show the Case Study B lens controls.
- Four lenses remain available:
  - Investor
  - Public
  - Government
  - Regulatory
- Lens state remains runtime-only.
- Lens switching does not mark the project dirty.
- Lens switching does not autosave.
- Lens switching does not write project files.
- Lens state resets to Investor on reload.
- Kept lens files include:
  - `src/audience/audienceLenses.ts`
  - `src/audience/AudienceLensControls.tsx`
  - `src/editor/EditorRoot.tsx`
  - `src/loaders/loadDemoQuarry.ts`
  - `src/ui/SceneLabels.tsx`

### Shahbazi source target kept

- The kept real-data target is:
  - Shahbazi, Menard, Sohn, Theau (2019), "Unmanned aerial image dataset: Ready for 3D reconstruction."
  - Data in Brief 25, 103962
  - DOI `10.1016/j.dib.2019.103962`
- The correct paper PDF staged in the raw folder is:
  - `projects/case-study-b/data/raw/shahbazi_gravel_pit/1-s2.0-S2352340919303154-main.pdf`
- The unrelated/suspect paper PDF remains present but is not treated as the Shahbazi source:
  - `projects/case-study-b/data/raw/shahbazi_gravel_pit/1-s2.0-S2352340919304299-main.pdf`

### Shahbazi acquisition and processing documentation kept

- Shahbazi acquisition/provenance documentation remains under `projects/case-study-b/data_refs/shahbazi_gravel_pit/`.
- Kept data-reference documents include:
  - `ACQUISITION_BRIEF.md`
  - `AUTHOR_CONTACT_TEMPLATE.md`
  - `CHAPTER_AND_DEMO_FLOW_NOTES.md`
  - `INGEST_PIPELINE_BRIEF.md`
  - `PROCESSING_TODO.md`
  - `README.md`
  - `SYNTHETIC_OVERLAY_SCHEMA.md`
  - `TRIAGE_CHECKLIST.md`
  - `paper_extracted_images/README.md`
- The processed-output handover notes remain in:
  - `projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md`
- These docs keep the distinction between:
  - raw user-placed source files
  - processed preview files consumed by GeoSee
  - synthetic or placeholder demo layers
  - future final/analysis-grade products

### Source and processed rails kept

- The Shahbazi intake folder remains:
  - `projects/case-study-b/data/raw/shahbazi_gravel_pit/`
- The Shahbazi processed folder remains:
  - `projects/case-study-b/data/processed/shahbazi_gravel_pit/`
- The Shahbazi reference folder remains:
  - `projects/case-study-b/data_refs/shahbazi_gravel_pit/`
- Historical sample staging records were purged from the active repo; recover them from Git history only if a future task explicitly needs them.

### Raw Shahbazi source files currently staged

- Raw images are staged under:
  - `projects/case-study-b/data/raw/shahbazi_gravel_pit/RawImages/`
- The raw image archive remains staged as:
  - `projects/case-study-b/data/raw/shahbazi_gravel_pit/Part3-RawImages.zip`
- Other staged Shahbazi source files include:
  - `DenseMatching.txt`
  - `DirectEOPs.txt`
  - `GCPs.txt`
  - `LaserScan.xyz`
  - `ObjectPoints.txt`
  - `RefinedEOPs.txt`
  - `RefinedIOPs.txt`
  - `TiePoints.txt`
  - `TimeStamps.txt`
- `LaserScan.xyz` is the retained fine TLS source.
- `ObjectPoints.txt` is the retained sparse photogrammetry object-point source for the broad outer preview surface and QA layers.

### Processed Shahbazi outputs kept

- Kept processed outputs under `projects/case-study-b/data/processed/shahbazi_gravel_pit/` include:
  - `tls_preview_points.json`
  - `tls_preview_points.provenance.json`
  - `tls_tiled_preview/`
  - `tls_surface_mesh_preview.json`
  - `tls_surface_mesh_preview.provenance.json`
  - `tls_surface_contours.geojson`
  - `tls_surface_contours.provenance.json`
  - `outer_surface_mesh_preview.json`
  - `outer_surface_mesh_preview.provenance.json`
  - `outer_surface_contours.geojson`
  - `outer_surface_contours.provenance.json`
  - `ground_control_points.geojson`
  - `ground_control_points.provenance.json`
  - `camera_poses.geojson`
  - `camera_poses.provenance.json`
  - `camera_frustums.geojson`
  - `camera_frustums.provenance.json`
  - `photo_overlay_preview/056.png`
  - `photo_overlay_preview/075.png`
  - `photo_overlay_preview/090.png`
  - `photo_overlay_preview/104.png`
  - `photo_overlay_preview/114.png`
  - `photo_overlay_preview/125.png`
  - `photo_overlay_preview/photo_overlay_manifest.json`
  - `photo_overlay_preview/photo_overlay_manifest.provenance.json`
  - `dense_matching_links.geojson`
  - `dense_matching_links.provenance.json`
  - `object_points_preview.json`
  - `object_points_preview.provenance.json`
  - `tie_point_support_isolines.geojson`
  - `tie_point_support_isolines.provenance.json`
  - `tie_point_support_isobands_mesh.json`
  - `tie_point_support_isobands_mesh.provenance.json`

### Kept processing scripts

- Fine TLS point preview processing remains in:
  - `prep/build_shahbazi_tls_preview.mjs`
  - `prep/build_shahbazi_tls_tiled_preview.mjs`
- Fine TLS surface generation remains in:
  - `prep/build_shahbazi_tls_surface_mesh_preview.mjs`
- Fine TLS contour generation remains in:
  - `prep/build_shahbazi_tls_contours_geojson.mjs`
- Broad object-point/outer surface generation remains in:
  - `prep/build_shahbazi_outer_surface_preview.mjs`
- Ground control point processing remains in:
  - `prep/build_shahbazi_gcp_geojson.mjs`
- Camera pose and camera frustum processing remains in:
  - `prep/build_shahbazi_camera_poses_geojson.mjs`
  - `prep/build_shahbazi_camera_frustums_geojson.mjs`
- Projected UAV image overlay preview processing remains in:
  - `prep/build_shahbazi_photo_overlay_preview.mjs`
- Dense matching link processing remains in:
  - `prep/build_shahbazi_dense_matching_links_geojson.mjs`
- Object point and tie-point QA processing remains in:
  - `prep/build_shahbazi_object_points_preview.mjs`
  - `prep/build_shahbazi_tie_point_support_isolines_geojson.mjs`

### Kept active ground surface model

- The active editor layer is:
  - `Shahbazi ground surface preview`
- Its layer id remains:
  - `shahbazi-tls-surface-preview`
- The layer renders two separate meshes:
  - outer object-point surface from `outer_surface_mesh_preview.json`
  - fine TLS island surface from `tls_surface_mesh_preview.json`
- The two surfaces remain separate drawables under one editor layer.
- The active implementation does not stitch, knit, or combine the two surfaces into one mesh.
- The active implementation does not use a seam mesh.
- The active implementation does not use a rectangular TLS cutout.
- The active implementation trims the broad outer surface inside the actual TLS island footprint.
- The active implementation preserves the TLS island as the fine-detail source-derived patch.

### Outer object-point surface kept

- `outer_surface_mesh_preview.json` is retained as the broad context surface.
- It is derived from `ObjectPoints.txt` through `object_points_preview.json`.
- It is generated as an inverse-distance weighted surface from sparse object points.
- Current retained processing settings include:
  - cell size: 2 m
  - search radius: 18 m
  - minimum neighbors: 4
  - maximum neighbors: 14
  - IDW power: 2
- Current retained output metrics:
  - source point rows: 3,682
  - valid vertices: 10,476
  - triangles: 20,364
  - grid size: 129 x 93
- The outer surface is demo-preview-ready only.
- The outer surface is not final spatial analysis output.

### Fine TLS surface kept

- `tls_surface_mesh_preview.json` is retained as the fine TLS island surface.
- It is derived from `LaserScan.xyz`.
- The source file is treated as XYZ text with columns:
  - x
  - y
  - z
- Current retained processing settings include:
  - binned height-field mesh
  - maximum observed TLS Z per populated cell
  - cell size: 0.45 m
  - minimum points per cell: 3
  - small enclosed interior no-data display gaps filled from neighboring TLS cells
- Current retained interior gap fill metrics:
  - candidate components: 14
  - filled components: 12
  - filled cells: 26
  - largest filled component: 8 cells
  - maximum filled component span: 7.2 m
- Current retained output metrics:
  - source point rows: 8,308,685
  - valid cells: 14,044
  - triangles: 27,496
  - grid size: 113 x 186
- Current retained source bounds:
  - min: `[193067.835, 5025190.955, 297.521]`
  - max: `[193117.785, 5025273.755, 305.576]`
  - center: `[193092.759, 5025232.137, 301.491]`
- Current retained scene bounds:
  - min: `[-24.901, -41.116, 115.132]`
  - max: `[25.026, 41.618, 123.171]`
- The TLS surface is demo-preview-ready only.
- The TLS surface is not a final DEM, photogrammetry mesh, or engineered surface.

### Boundary smoothing kept

- Boundary smoothing is kept for the visible edge quality of the separate surfaces.
- Boundary smoothing adjusts existing edge vertices only.
- Boundary smoothing does not create a measured connection between surfaces.
- Boundary smoothing does not create a seam mesh.
- Boundary smoothing does not stitch the TLS island to the outer object-point surface.
- Boundary smoothing does not change authored colors.
- TLS boundary smoothing is retained in `prep/build_shahbazi_tls_surface_mesh_preview.mjs`.
- Current TLS boundary smoothing metrics:
  - candidate loops: 1
  - smoothed loops: 1
  - smoothed vertices: 588
  - iterations: 5
  - maximum horizontal shift: 0.518 m
  - maximum vertical shift: 0.338 m
- Outer surface boundary smoothing is retained in `prep/build_shahbazi_outer_surface_preview.mjs`.
- Current outer boundary smoothing metrics:
  - candidate loops: 2
  - smoothed loops: 2
  - smoothed vertices: 588
  - iterations: 5
  - maximum horizontal shift: 1.8 m
  - maximum vertical shift: 0.9 m

### Kept active contour model

- The active editor layer is:
  - `Shahbazi ground surface contours`
- The layer renders two separate contour outputs:
  - `outer_surface_contours.geojson`
  - `tls_surface_contours.geojson`
- The active contour layer is linework only.
- The contour layer is not itself a surface.
- The contour layer is derived from the separate surface previews.
- No combined contour source is active.
- No seam contour source is active.

### Outer surface contours kept

- `outer_surface_contours.geojson` is retained.
- It is derived from `outer_surface_mesh_preview.json`.
- It uses triangle-plane contour extraction from the standalone outer surface preview.
- Current retained processing metrics:
  - contour interval: 0.5 m
  - contour levels: 73
  - contour segments: 31,040
- The contour output is demo-preview linework for the outer source-derived surface.
- It is not a final surveyed contour product.

### TLS surface contours kept

- `tls_surface_contours.geojson` is retained.
- It is derived from `tls_surface_mesh_preview.json`.
- It uses triangle-plane intersection against the binned observed-cell TLS surface mesh preview.
- Current retained processing metrics:
  - contour interval: 0.5 m
  - render Z offset: 0 m
  - contour levels: 16
  - contour segments: 7,929
- The contour output is legibility linework for the TLS mesh preview.
- It is not a final surveyed contour product.

### Shahbazi QA and support layers kept

- Ground control/check points are retained from `GCPs.txt`.
- Camera positions and flight path are retained from `RefinedEOPs.txt`.
- Camera frustums are retained from `RefinedEOPs.txt` and `RefinedIOPs.txt`.
- Projected UAV image preview overlays are retained from six downsampled raw TIFF previews, `RefinedEOPs.txt`, `RefinedIOPs.txt`, and the current Shahbazi preview surfaces.
- Dense-matching links are retained from `DenseMatching.txt` and processed camera poses.
- Object-point QA remains available from `ObjectPoints.txt`.
- Tie-point support isolines remain available from object/tie point support processing.
- Tie-point support isobands remain available as an infill QA visualization.
- The tie-point support isobands are explicitly not treated as terrain, grade, pressure, or engineering data.

### Projected UAV image preview kept

- `Shahbazi projected image preview` is retained as a toggleable source-derived visual alignment layer.
- The layer id is:
  - `shahbazi-photo-overlay-preview`
- The app loader is:
  - `src/loaders/loadPhotoOverlayPreview.ts`
- The active manifest is:
  - `projects/case-study-b/data/processed/shahbazi_gravel_pit/photo_overlay_preview/photo_overlay_manifest.json`
- The retained selected image ids are:
  - 056
  - 075
  - 090
  - 104
  - 114
  - 125
- Each selected source TIFF was downsampled to a browser-safe PNG preview at 768 x 512 px.
- Each preview image is ray-projected onto the current separate Shahbazi outer and TLS surface preview meshes using the refined exterior and interior orientation tables.
- Texture URLs are resolved from the manifest's app-relative URL so the browser can find the six preview PNGs under Vite.
- The projected preview draws with a small render clearance over the terrain so the surface depth occluder does not hide the image mesh.
- The Shahbazi ground surface loader now corrects negatively wound surface meshes at load time so their front faces point upward in the Z-up scene.
- The projected preview now renders as a top-facing texture layer over the corrected surface side.
- The projected image preview is not an orthomosaic.
- The projected image preview is not a final texture.
- The projected image preview is not a final photogrammetric product.

### Tie-point support isobands kept

- `tie_point_support_isobands_mesh.json` is retained.
- It is derived from:
  - `object_points_preview.json`
  - `ObjectPoints.txt`
  - `TiePoints.txt`
- Current retained processing settings include:
  - inverse-distance interpolation of object-point tie observation counts
  - cell size: 1 m
  - search radius: 10 m
  - minimum neighbors: 4
  - z offset: 0 m
- Current retained output metrics:
  - grid size: 257 x 185
  - valid grid nodes: 40,767
  - vertices: 40,767
  - triangles: 80,488
- This remains a QA layer only.

### Active scene loader wiring kept

- `src/scene.ts` now delegates project-layer loading to `src/scene/layerLoaders.ts`.
- `src/scene/layerLoaders.ts` keeps the active layer loader registry.
- The registry contains the Shahbazi split-surface loader for `shahbazi-tls-surface-preview`.
- That loader loads both:
  - `outerMeshPreview`
  - `meshPreview`
- The two mesh previews are grouped under the same layer id so editor visibility affects them together.
- The registry contains the Shahbazi split-contour loader for `shahbazi-tls-contours`.
- That loader loads both:
  - `outerGeojson`
  - `geojson`
- The two contour sources are grouped under the same layer id so editor visibility affects them together.
- The registry contains the Shahbazi projected-image loader for `shahbazi-photo-overlay-preview`.
- `src/loaders/loadMeshPreview.ts` remains the generic mesh-preview renderer used by the mesh paths.
- `src/loaders/surfaceRenderPolicy.ts` now owns the named surface/photo render policies used by these paths.

### Project layer metadata kept

- Placeholder/demo layers in Case Study B remain marked through metadata in `projects/case-study-b/project.json`.
- Public/customer placeholder labels are surfaced in the editor with `(placeholder)` where applicable.
- Shahbazi source-derived layers are marked separately from placeholders.
- Synthetic overlays remain labelled as synthetic or placeholder where applicable.
- The project watermark remains a demo-placeholder warning.

### Editor controls kept

- Layer visibility controls are kept wired to the active scene objects.
- Global visibility defaults are kept in `projects/case-study-b/environment.json`.
- Page Manager supports duplicating a page directly below the selected/source page.
- Page duplication is wired through:
  - `src/editor/EditorContext.tsx`
  - `src/editor/PagePanel.tsx`
- Duplicate controls are available in the page list and action controls.

### Presentation and preview controls kept

- A working scene scale bar remains in `src/ui/ScaleBar.tsx`.
- The scale bar is tied to the active camera/scene projection rather than being a static decorative bar.
- The bottom UI retains the app-style compass control.
- The north indicator in the compass remains visually distinct.
- The light-mode control remains in the bottom-right control cluster.
- The present/exit control remains a circular icon button matching the bottom-right control style.
- The editor bar/panel spacing remains adjusted so the bottom-right controls have room.
- The preview/presentation audience choice remains a centered overlay-style control.
- The preview-mode audience choice does not show an extra "Audience Lens" text label.
- The preview-mode audience choice does not pre-highlight an option before the user chooses.

### Overlay and presentation text kept

- The Quarry Arrival overlay remains a styled presentation overlay.
- The overlay copy states that the live spine includes a source-derived preview ground surface from sparse photogrammetry object points with a high-detail TLS patch nested inside it.
- The overlay copy states that synthetic planning overlays remain placeholders and should not be read as measured quarry data.

### Lighting controls kept

- Environment > Sun includes `Lock to camera`.
- The sun lock setting is represented in `src/pages/types.ts` as `scene.sun.lockToCamera`.
- The global editor control is in `src/editor/EnvironmentScenePanel.tsx`.
- Runtime camera-aware sun handling is in `src/scene/SceneManager.ts`.
- When camera lock is enabled, the current light vector is captured first so enabling it does not reinterpret the authored sun angles and jump the lighting.
- Camera-locked sun mode updates the key light and terrain hillshade during frame updates while enabled.
- The environment merge path keeps `sun` settings when scene properties are merged.

### Page-level lighting override kept

- Pages can inherit the global sun camera-lock setting, force it on, or force it off.
- Page-level sun camera lock is represented as `sunLockToCamera` on presentation pages.
- Page-level typing is kept in:
  - `src/pages/types.ts`
  - `src/editor/types.ts`
- Page-level editor controls are kept in:
  - `src/editor/LayerPanel.tsx`
- Page reset/override cleanup is kept in:
  - `src/editor/EditorContext.tsx`
- Page application logic is kept in:
  - `src/scene/SceneManager.ts`

### Background and lens stability kept

- Investor mode keeps the authored dark scene background treatment.
- The background/lens state is kept stable across editor variable changes and page movement settling.
- Lens/background behavior remains controlled through the environment/page scene state rather than ad hoc generated geometry.

### Kept boundaries and non-goals

- The app does not claim the Shahbazi preview surfaces are final GIS or engineering outputs.
- The app does not claim synthetic/demo overlays are measured data.
- Source data remains external/user-placed unless intentionally committed.
- The procedural shell remains fallback scaffolding.
- Woodjam remains preserved.
- Case Study B keeps separate source-derived surfaces for broad object-point context and fine TLS detail.
- No active combined mesh, seam mesh, island knit, or rectangular TLS cutout path remains in the current kept state.

### Verification kept

- `npm run build` has passed after the current kept changes.
- Current kept JSON project/environment files parse cleanly.
- Current kept Shahbazi processed outputs include provenance sidecars for the major source-derived preview artifacts.
