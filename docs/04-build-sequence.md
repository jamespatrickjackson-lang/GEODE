# Build Sequence

> **Historical service-led alpha build sequence.** This file preserves source-development history and previous phase plans, **not** the current W3/W4 free-public GeoSee product plan or release criteria. W3's approved **future** Gate A is curated-example exploration/accepted PNG, and Gate B adds desktop single-user local-first 2D WGS84 GeoJSON, independent projects, portable JSON save/reopen and PNG; these are **not yet implemented**. [W3 requirements in unmerged draft PR #8](https://github.com/jamespatrickjackson-lang/GEODE/pull/8). Existing still, recording and video encoding source paths should not be described as absent; accepted MP4/file/codec/browser outputs remain unverified.

This document records a **historical** current-state snapshot of the service/demo alpha build, not the W3-approved public MVP sequence. Earlier “current” and “next” language below is retained as dated historical context.

## Current Phase

Current phase:

> Multi-project alpha with Woodjam preserved, Shahbazi Gravel Pit active as the
> high-fidelity case study, Utah FORGE active as a geothermal/geophysics case
> study, and Base GUI Template available for shared GUI/environment editing.

## Completed Foundations

Complete:

- Vite + React + TypeScript + Three.js app.
- Project folder loading.
- Project landing screen.
- Woodjam reference project.
- Case Study B / Shahbazi Gravel Pit project.
- Utah FORGE active geothermal/geophysics case-study project.
- Base GUI Template project.
- `project.json` + `environment.json` project model.
- Page JSON loading.
- Overlay markdown loading.
- Project-aware save paths.
- Dev-time file writes.
- Manual save and dirty-state handling.
- Page controller and camera transitions.
- Presenter/preview mode.
- Bottom navigation controls.
- Scale bar.
- Compass and light/dark HUD controls.
- Home button back to landing with unsaved prompt.

## Completed Architecture Moves

Complete:

- React is the locked app framework.
- Environment setup is the world/default state.
- Pages are deltas against the environment.
- Editor chrome is lazy-loaded after project selection.
- Layer loading is delegated to `src/scene/layerLoaders.ts`.
- Surface/photo render policy is centralized in `src/loaders/surfaceRenderPolicy.ts`.
- Project layer specs support `previewFiles` and `futureTargets`.
- Development-only debug logging is routed through `src/utils/debugLog.ts`.
- Base GUI reference stage loader exists in the layer loader registry.
- Utah FORGE reference stage loader exists in the layer loader registry.
- `atmosphere-volume` loader/style runtime exists for local environmental
  cloud/mist volumes.
- Topo Environment groups scene atmosphere, clouds, sun, and fog under the Topo
  tool.

## Completed Woodjam Work

Complete/kept:

- Woodjam remains selectable.
- Woodjam project-aware paths are preserved.
- Woodjam behavior is not intentionally changed by Shahbazi work.
- Woodjam remains the real/reference project.

Still pending for Woodjam's **complete accepted publishing/delivery workflow**:

- Publish/export packaging.
- **Verified MP4 output** and browser/codec acceptance (source-implemented capture/encode routes exist).
- **Accepted still-pack export** (single-image capture paths exist).
- Provenance PDF.
- Any future content polish beyond the current app shell.

## Completed Shahbazi / Case Study B Work

Complete/kept:

- Case Study B renamed/presented as Shahbazi Gravel Pit in the app.
- Procedural quarry shell retained as fallback.
- Shahbazi source/acquisition docs created.
- Shahbazi raw source files are archived outside the active repo; resolve the
  former `projects/case-study-b/data/raw/shahbazi_gravel_pit/` path through
  `docs/archive-map.md`.
- Processed preview outputs created under `projects/case-study-b/data/processed/shahbazi_gravel_pit/`.
- Processed data README updated to describe current preview outputs.
- Shahbazi layers added to project manifest.
- Placeholder/demo layers labelled as placeholders where applicable.
- Audience Lens controls available only for Shahbazi.
- Shahbazi preview surfaces are kept separate:
  - outer sparse-object-point surface
  - TLS island surface
- Shahbazi contour layer is split:
  - outer contours
  - TLS contours
- Shahbazi projected UAV image preview is wired as a visible editor layer.
- GCP/check points, camera path, frustums, dense matching, object/tie-point QA layers are available.

Important kept boundary:

- No combined mesh, seam mesh, or island-knit path is active.
- The broad outer surface is not LiDAR.
- The projected image preview is not an orthomosaic.

## Completed Utah FORGE Work

Complete/kept:

- Utah FORGE appears on the landing page.
- `projects/utah-forge/` contains the current project folder.
- Public topo/terrain, NAIP/topo material choices, graticule, map edge fade,
  public surface clip, and edge outline controls are active.
- Phase 3 MT products, scalar volume/slice/threshold/top-surface records, and
  product-aware transition work are active.
- Phase 3 seismic browser records and capability-product controls are active.
- Section planes, working-area focus, site details, product pages, overlays, and
  legends are active build surfaces.
- Topo Environment controls exist for Scene atmosphere, Clouds, Sun, and Fog.
- Utah FORGE includes an editable one-puff `Topo test cloud` local atmosphere
  layer for QA; visibility is authoring-state scoped.
- Utah FORGE seismic section geometry must be trace-header driven before any
  navigation/envelope fallback when source coordinates exist.

Important kept boundary:

- Visual alignment and presentation usefulness do not equal survey-grade
  registration. Imported geospatial layers still require explicit CRS,
  vertical datum, and registration-status evidence before precise claims.

## Completed UI / Interaction Work

Complete/kept:

- Landing page restyled to dark viewer background.
- Project buttons use overlay-box/HUD visual language.
- Landing image gear panel added.
- Landing image local file load/save/reset/clear controls added.
- Landing image effect controls added.
- Editor shell restyled to dark frosted overlay-box material.
- Editor derives shell material from GUI overlay settings where possible.
- Header/stack interiors made transparent to avoid double darkening.
- Save button rebuilt as compact HUD-style round icon.
- Unsaved save button state uses light red infill.
- Audience Lens label removed from compact editor controls.
- Page row selected state uses flat color infill.
- Top-level section bars use flat dark button style.
- Bottom HUD contains preview, compass, light/dark, home.
- Preview/presentation lens chooser uses overlay-box styling.
- Standalone GUI editor now includes richer Component/Assembly/Product library
  seeds and GeoSee-derived product surfaces, including Topo material and local
  atmosphere concepts.

## Current Open Work Queue

Highest priority unresolved:

1. Keep the visible Utah FORGE cloud fixture or replace it with equivalent QA
   coverage before making clouds subtle.
2. Verify UI spacing after the latest editor margin/header changes in browser.
3. Verify Home button unsaved prompt behavior:
   - clean project exits directly
   - dirty project prompts
   - Save & Exit saves then returns to landing
   - failed save does not exit
4. Continue component extraction from large files:
   - `LayerPanel.tsx`
   - `EnvironmentScenePanel.tsx`
   - `TopoMapPanel.tsx`
   - `SceneManager.ts`
5. Replace first-pass projected UAV images with a real orthomosaic or textured mesh when available.
6. Build the export/publish path.

## Data/Processing Work Remaining

Shahbazi remaining:

- Inspect whether all raw source files are complete and documented.
- Create real orthomosaic or image texture.
- Create final textured mesh / GLB.
- Create full-resolution point cloud stream, likely Potree/EPT.
- Validate CRS/orientation and site position.
- Confirm tie between TLS sub-zone and UAV photogrammetry block.
- Replace/augment preview products with production-grade derivatives.
- Keep provenance sidecars current as artifacts are regenerated.

Woodjam remaining:

- Keep any future source additions project-aware.
- Avoid breaking existing Woodjam behavior while Case Study B evolves.

## Export/Publish Phase - Not Complete

Not complete or acceptance-verified as **end-to-end historical deliverables**:

- one-command static publish package
- hosted artifact packaging
- **accepted** MP4 capture/export across target codecs/browsers (implementation routes exist)
- still-pack export packaging (individual still capture paths exist)
- provenance PDF
- release/draft artifact packaging

## Historical Recommended Next Sequence (Superseded by W3 Direction)

1. Stabilize UI spacing and current editor visual polish.
2. Verify `npm run build`.
3. Run a clean Woodjam open.
4. Run a clean Shahbazi open.
5. Verify layer visibility toggles for Shahbazi source-derived and placeholder layers.
6. Verify projected image preview visibility and top-side orientation.
7. Move large editor sections into smaller components.
8. Build export/publish pipeline.
9. Replace Shahbazi projected preview with real orthomosaic/mesh once generated.

## Historical Alpha Completion Criteria (Not W4 Public Release Criteria)

The current alpha is ready for stronger external demo use when:

- Woodjam opens and presents without regressions.
- Shahbazi opens and presents with honest source-derived previews.
- Placeholder layers are clearly marked.
- Editor save/home/presenter flows are stable.
- The app can produce or package a shareable static artifact.
- Provenance docs clearly state what is measured, derived, placeholder, or future.

## Maintenance Protocol

When a major build change lands:

1. Update this file.
2. Update `03-decisions.md` if the change settles an architectural/product choice.
3. Update `02-architecture.md` if runtime architecture changed.
4. Update `CHANGELOG.md` with what was actually kept.
5. Do not document discarded experiments as active state.
