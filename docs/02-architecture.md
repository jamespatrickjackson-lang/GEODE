# Architecture

Last updated: 2026-05-12

This document describes the current GeoSee implementation, not the original planned architecture.

## System Shape

GeoSee is a Vite + React + TypeScript + Three.js single-page app.

It has two primary modes:

- Landing/project selection.
- Loaded project editor/presenter.

There is no production backend in the current alpha. Project files are folder-based, and authoring writes go through the dev-time file write path.

Current project roots:

```text
projects/woodjam/
projects/case-study-b/
projects/utah-forge/
projects/base-gui/
```

## Runtime Flow

```text
Landing page
  -> choose project
  -> load project.json + environment.json + pages + overlays
  -> mount Three.js scene
  -> register layer groups
  -> load project layers through layer registry
  -> mount editor chrome + presenter controls
```

Key runtime files:

```text
src/App.tsx
src/editor/EditorChrome.tsx
src/editor/EditorRoot.tsx
src/scene.ts
src/scene/SceneManager.ts
src/scene/layerLoaders.ts
src/pages/loadPages.ts
src/pages/PageController.tsx
```

## Project Catalog

Project catalog runtime entries live in:

```text
src/projects/projectCatalogRuntime.ts
```

Current entries:

- Woodjam
- Shahbazi Gravel Pit
- Utah FORGE
- Base GUI Template

Woodjam, Shahbazi Gravel Pit, and Utah FORGE appear in the main landing list.

Base GUI Template is a development/editing target opened through `EDIT BASE GUI`.

## Project Folder Model

Typical project structure:

```text
projects/<slug>/
  project.json
  environment.json
  project.config.json
  pages/
  overlays/
  data/
  data_refs/
  intake_staging/
```

`project.json` owns:

- project metadata
- layer manifest
- page order
- active preview files
- future targets
- layer provenance metadata

`environment.json` owns:

- default visible layers
- global layer styles
- scene background/fog/lighting/camera settings
- GUI style defaults
- overlay style defaults

`pages/*.json` own:

- camera pose
- transition timing
- overlay text/image references
- per-page overrides
- optional page-level scene settings

## Layer Loading

Layer loading is centralized in:

```text
src/scene/layerLoaders.ts
```

`scene.ts` registers layer ids, then delegates actual loading through:

```ts
loadLayerInto(spec, manager)
```

The loader registry handles:

- project asset path resolution
- `previewFiles` first
- fallback to older `files` and legacy `path`
- project-specific loaders where needed
- generic loaders for common types

Important loader cases:

- `base-gui-reference-stage`
- `utah-forge-reference-stage`
- `case-study-b-demo-shell`
- point-cloud previews
- tiled point-cloud previews
- Shahbazi split surface preview
- Shahbazi tie-point support
- Shahbazi split contours
- Shahbazi projected image preview
- camera frustums
- camera flight path
- point markers
- lines and polygons
- Woodjam terrain/data layers

## Surface Rendering Policy

Surface/photo render policy lives in:

```text
src/loaders/surfaceRenderPolicy.ts
```

Kept policies:

- `depth-occluding-transparent-surface-preview`
- `projected-image-alignment-preview`

The goal is to keep fragile depth behavior named and explicit instead of scattering magic `renderOrder`, `polygonOffset`, `depthWrite`, and material-side decisions through the codebase.

Current surface preview contract:

- source preview meshes should be generated with upward-facing winding
- app renders them with `THREE.FrontSide`
- depth occluders use the same geometry as the preview mesh
- projected photo overlays use front-facing UAV-side geometry
- photo overlays are preview/alignment layers, not orthomosaics

## Scene Manager

The scene manager owns:

- Three.js scene layer registry
- environment application
- layer style application
- visibility application
- page state application
- presenter/editor mode behavior
- lighting handles
- scene overlays
- page camera markers
- dynamic camera helpers
- terrain/surface sampling references

File:

```text
src/scene/SceneManager.ts
```

Known issue:

`SceneManager.ts` remains large. It is a future extraction target.

## Editor Architecture

`EditorChrome` is lazy-loaded from `App.tsx`, so the landing page does not carry the full editor bundle on first load.

`EditorChrome` wraps:

- `PageControllerProvider`
- navigation controls
- scale bar
- editor root
- bottom HUD controls
- assay legend
- scene labels
- presenter logo
- overlay display

`EditorRoot` owns the visible editor shell and top-level section layout.

Large editor files still present:

- `src/editor/LayerPanel.tsx`
- `src/editor/EnvironmentScenePanel.tsx`
- `src/scene/SceneManager.ts`

These are current future architecture targets.

## Editor State

Editor state is owned by:

```text
src/editor/EditorContext.tsx
```

It tracks:

- project root and slug
- project manifest
- environment
- pages
- overlay markdown
- selected page/global settings
- dirty keys
- save status
- presenter mode
- scene handle

Save is manual and sequential. It is not transactional.

Current save targets:

- `environment.json`
- `pages/*.json`
- `overlays/*/text.md`
- `project.json`
- overlay image assets where applicable

Known issue:

If a multi-file save fails halfway, the project can be partially written. This is acceptable for current alpha but should become transactional or staged before production.

## Page System

Pages are presentation moments in a shared environment.

Global/default state lives in `environment.json`.

Presentation pages apply deltas through:

- visibility overrides
- layer overrides
- camera pose
- transition timing
- overlay layout
- page-level scene fields

`PageController` drives:

- current page index
- next/previous navigation
- camera tweening
- presenter preview
- current-page environment application

## Audience Lens

Audience Lens is currently runtime-only and Shahbazi-only.

Files:

```text
src/audience/audienceLenses.ts
src/audience/AudienceLensControls.tsx
src/editor/EditorChrome.tsx
```

Current behavior:

- appears only for `case-study-b`
- no dirty state
- no autosave
- no project file writes
- defaults to Investor on reload
- lens choice can be made when entering preview mode

This is not yet a persistent multi-audience authoring system.

## Landing Page and Base GUI

Landing page is in:

```text
src/App.tsx
src/App.css
```

Kept behavior:

- dark Shahbazi-style background
- project buttons for Woodjam, Shahbazi Gravel Pit, and Utah FORGE
- Add New Project action
- `EDIT BASE GUI` action
- landing image gear/settings panel
- localStorage persistence for landing image effects

Base GUI files:

```text
projects/base-gui/project.json
projects/base-gui/environment.json
```

Base GUI is a placeholder/reference project for editing shared GUI/environment defaults.

## Utah FORGE Foundation Architecture

Utah FORGE currently exists as a folder-project scaffold:

```text
projects/utah-forge/
  project.json
  environment.json
  pages/
  overlays/
  data/
  data_refs/
  intake_staging/
```

Current active layer:

```text
utah-forge-reference-stage
```

The reference stage is procedural and loaded by `src/scene/layerLoaders.ts`. It is intentionally not real Utah FORGE data. The next briefing should define the real CRS, scene origin, bounds, source package, layer manifest, pages, and provenance rules before any technical layers are added.

## Shahbazi Data Architecture

Raw source folder:

```text
projects/case-study-b/data/raw/shahbazi_gravel_pit/
```

Processed preview folder:

```text
projects/case-study-b/data/processed/shahbazi_gravel_pit/
```

Reference/provenance docs:

```text
projects/case-study-b/data_refs/shahbazi_gravel_pit/
```

Processing scripts:

```text
prep/build_shahbazi_*.mjs
```

Active Shahbazi surface model:

- broad outer surface from sparse object points
- TLS island surface from `LaserScan.xyz`
- separate split contours
- no active seam mesh
- no active combined mesh
- no active island knit
- no rectangular TLS cutout

## Data Provenance Model

Layer metadata distinguishes:

- source file
- source date
- derived artifact date
- source origin
- classification
- confidentiality
- placeholder status
- notes

Current convention:

- `sourceDate` is the date of the source material.
- `derivedArtifactDate` is the date a GeoSee preview artifact was generated.
- `previewFiles` are active browser-ready preview assets.
- `futureTargets` are planned outputs that do not yet exist.

## Known Technical Debt

- `LayerPanel.tsx`, `EnvironmentScenePanel.tsx`, and `SceneManager.ts` remain too large.
- Save is not transactional.
- Some project-specific loader branches remain in the loader registry.
- Surface/photo layering remains depth-sensitive.
- Scale bar is local/raycast-based.
- Projected UAV image preview is not a real orthomosaic.
- Export/publish pipeline is incomplete.
- Full project creation is still a placeholder path through Base GUI.

## Build Verification

Current kept code has been built successfully with:

```text
npm run build
```

Run this after code changes. For docs-only changes, build is not required.
