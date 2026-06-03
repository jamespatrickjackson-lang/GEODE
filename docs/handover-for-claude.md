# GeoSee Current Handover

This is the current bootstrap for the next agent/session. It replaces the older May 1 handover.

## Working Directory

```text
C:\GeoSee\GeoSee_Dev
```

Primary local preview URL when dev server is running:

```text
http://127.0.0.1:5173/
```

Build command:

```text
npm run build
```

## Product Frame

GeoSee is a service-first visual communication tool for mining and geoscience projects.

The app is an internal authoring and presentation tool. Clients/stakeholders should see the produced artifact, not the editor.

Current thesis:

> One project spine can support multiple audience-tuned readings without pretending preview or placeholder data is final measured data.

## Current Project Set

### Woodjam

Status: preserved reference project.

Woodjam remains the original real/reference project. Do not break it while working on Shahbazi or UI infrastructure.

### Shahbazi Gravel Pit / Case Study B

Status: active high-fidelity quarry case study.

Purpose:

- high-fidelity quarry/gravel pit demo
- source-derived preview layers from the Shahbazi dataset
- investor/public/government/regulatory runtime Audience Lens demo
- eventual replacement/supplement of preview layers with real orthomosaic, textured mesh, and full point-cloud products

Important:

- The procedural quarry shell remains fallback scaffolding.
- Source-derived Shahbazi preview layers exist.
- Synthetic/planning overlays remain placeholders unless explicitly source-derived.
- The broad outer surface is sparse object-point interpolation, not LiDAR.
- The projected UAV images are preview projections, not an orthomosaic.

### Base GUI Template

Status: development/editing template.

Purpose:

- empty/default project for editing shared GUI, overlay, navigator, label, lighting, and environment defaults
- opened from landing via `EDIT BASE GUI`
- not real data
- includes a generic `atmosphere-volume` sample for local atmosphere/cloud
  authoring checks

### Utah FORGE

Status: active geothermal/geophysics case-study project.

Purpose:

- exercise public topo context, Phase 3 MT, seismic browser, section/working-area
  tooling, and presentation authoring
- keep technical provenance and registration status explicit while improving
  visual communication
- provide current Topo Environment coverage for clouds, sun visuals, and fog

Important:

- Utah FORGE is selectable from the landing page.
- Utah FORGE now has public topo/terrain context, Phase 3 MT products, seismic
  browser records, section tooling, site details, product pages, overlays, and
  legends.
- The current visible cloud QA fixture is `Topo test cloud`, an
  `atmosphere-volume` environmental layer.
- Visual alignment is not survey-grade registration. Imported geospatial layers
  still need explicit CRS, vertical datum, and registration-status evidence
  before precise claims.

## Current Major Files

Core app:

```text
src/App.tsx
src/App.css
src/scene.ts
src/scene/SceneManager.ts
src/scene/layerLoaders.ts
src/loaders/surfaceRenderPolicy.ts
src/projects/projectCatalogRuntime.ts
```

Editor:

```text
src/editor/EditorChrome.tsx
src/editor/EditorRoot.tsx
src/editor/EditorContext.tsx
src/editor/styles.ts
src/editor/PagePanel.tsx
src/editor/LayerPanel.tsx
src/editor/EnvironmentScenePanel.tsx
src/editor/CollapsibleSection.tsx
```

Presenter/UI:

```text
src/ui/LightModeToggle.tsx
src/ui/FloatingPreviewToggle.tsx
src/ui/ScaleBar.tsx
src/ui/NavControls.tsx
src/audience/audienceLenses.ts
src/audience/AudienceLensControls.tsx
src/presenter/OverlayDisplay.tsx
```

Projects:

```text
projects/woodjam/
projects/case-study-b/
projects/utah-forge/
projects/base-gui/
```

Shahbazi prep:

```text
prep/build_shahbazi_*.mjs
projects/case-study-b/data/raw/shahbazi_gravel_pit/
projects/case-study-b/data/processed/shahbazi_gravel_pit/
projects/case-study-b/data_refs/shahbazi_gravel_pit/
```

## What Is Done

### Multi-project app

Done:

- project landing screen
- Woodjam selectable
- Shahbazi Gravel Pit selectable
- Utah FORGE selectable as an active geothermal/geophysics case study
- Base GUI Template load path through `EDIT BASE GUI`
- project-aware paths for pages, overlays, saves, and assets
- project-aware runtime catalog

### Shahbazi data rails and previews

Done:

- intake/reference docs
- raw source staging folder
- processed preview folder
- source-derived preview products
- active layer records in `projects/case-study-b/project.json`
- processed README describing current preview status

Kept active preview products:

- TLS sampled point preview
- TLS tiled point preview
- TLS island surface
- sparse-object-point outer surface
- split contour linework
- GCP/check points
- camera path
- camera frustums
- dense matching links
- object/tie-point QA
- tie-point support isolines/isobands
- projected UAV image preview

### Shahbazi surface model

Done/current:

- separate outer surface and TLS island surface
- no active combined mesh
- no active seam mesh
- no active island knit
- no active rectangular TLS cutout
- generated surface mesh winding corrected upward
- surface/photo material policy centralized

### Audience Lens

Done/current:

- Shahbazi-only runtime Audience Lens
- Investor/Public/Government/Regulatory modes
- no dirty state
- no autosave
- no project file write
- preview entry asks for lens choice

### Editor and landing UI

Done/current:

- dark frosted overlay-box style applied across landing/editor/HUD
- editor shell derives from GUI overlay style where possible
- landing image gear panel with load/save/reset/clear and image effect controls
- compact HUD-style editor save button
- bottom HUD with preview, compass, light/dark, home
- home returns to landing
- unsaved prompt appears before leaving with unsaved edits
- Page Manager duplicate action inserts page directly below source page
- duplicate page attempts to copy overlay markdown/image assets

### Architecture cleanup

Done/current:

- editor chrome lazy-loaded from landing
- layer loader registry in `src/scene/layerLoaders.ts`
- surface/photo render policy in `src/loaders/surfaceRenderPolicy.ts`
- `previewFiles` / `futureTargets` split in layer specs
- development debug logging helper
- `atmosphere-volume` loader/runtime for local cloud/mist volumes
- Topo Environment grouping for Scene atmosphere, Clouds, Sun, and Fog

## What Is Unresolved

### Data products

Still missing:

- final Shahbazi orthomosaic
- final textured mesh / GLB
- full-resolution Potree/EPT point-cloud stream
- final CRS/orientation validation
- final photogrammetry/TLS registration validation
- production-grade derived overlays

### App/product

Still missing:

- export/publish pipeline
- MP4 capture/export
- still-pack export
- provenance PDF export
- production access control decision for non-public client projects
- real project creation wizard
- transactional save

### Engineering debt

Still needs cleanup:

- `LayerPanel.tsx` remains large
- `EnvironmentScenePanel.tsx` remains large
- `TopoMapPanel.tsx` remains large after absorbing Topo Environment controls
- `SceneManager.ts` remains large
- layer registry still contains some project-specific branches
- scale bar is local/raycast-based
- projected image preview is first-pass only

## Current Known Caveats

- Do not treat Shahbazi projected images as an orthomosaic.
- Do not treat the broad outer surface as LiDAR.
- Do not represent synthetic/demo overlays as measured data.
- Do not remove the procedural fallback shell.
- Do not break Woodjam.
- Do not collapse Shahbazi outer and TLS surfaces into a single stitched mesh without explicit approval.
- Do not reintroduce seam/island-knit experiments as active state.

## Recommended Next Work

Near-term:

1. Verify current UI spacing and editor shell in browser.
2. Keep the Utah FORGE visible cloud QA fixture or replace it with equivalent
   single-cloud coverage before making clouds subtle.
3. Verify Home unsaved prompt behavior.
4. Verify Woodjam still opens.
5. Verify Shahbazi opens and layer toggles work.
6. Verify projected image preview renders on the top/UAV-facing side.
7. Run `npm run build`.

Next architecture pass:

1. Extract smaller components from `LayerPanel.tsx`.
2. Extract smaller components from `EnvironmentScenePanel.tsx`.
3. Continue reducing `SceneManager.ts`.
4. Harden save flow.
5. Build publish/export.

Next data pass:

1. Generate real Shahbazi orthomosaic or textured mesh outside the app.
2. Add it as a future/then active preview target.
3. Keep provenance sidecars current.

## Documentation Map

Read in this order:

```text
docs/00-purpose.md
docs/01-scope.md
docs/02-architecture.md
docs/03-decisions.md
docs/04-build-sequence.md
CHANGELOG.md
projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md
projects/case-study-b/data_refs/shahbazi_gravel_pit/ACQUISITION_BRIEF.md
```

## Working Rule

When updating the app:

- implement the change
- preserve Woodjam
- preserve Shahbazi fallback
- keep source-derived vs placeholder vs future target distinctions clear
- run build after code changes
- update changelog/docs when current state changes
