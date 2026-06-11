# Architecture

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
- `atmosphere-volume` local cloud/mist sprite volumes
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
- visible sun orb, halo, and source marker
- local atmosphere/cloud volume groups, generated textures, bounds helpers, and drift ticks
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

`EditorChrome` is lazy-loaded from `App.tsx`, so the landing page does not carry the full editor bundle on first load. `EditorRoot` is also lazy-loaded from `EditorChrome`, keeping the presenter/navigation shell separate from the heavier editor panel tree.

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

## Build Chunking

The app keeps Vite's `chunkSizeWarningLimit` at `600` kB. `App.tsx`
dynamically imports the scene runtime, `EditorChrome` lazy-loads `EditorRoot`,
and `vite.config.ts` routes `src/loaders/` into the `app-scene-loaders` source
chunk before vendor chunking. Manual source chunks should stay narrow and avoid
cutting through mutually dependent scene/editor runtime modules; broad folder
slicing can create Rollup circular chunk warnings even when it hides size
warnings.

Current editor section rule:

- top-level bars represent peer workflows or toolsets;
- `Pages` owns page selection/order/actions;
- `Cinematics` owns global render, per-page render presets, camera, cinematic post, client UI, editor chrome variables, and per-page camera dynamics controls;
- `Topo` owns the global topo map tool editor, including Topo Settings, Extents, Topo Environment, longitude/latitude grid, title block, and reference layers;
- `Sections` owns section planes and crop/focus controls;
- project data and card sections remain separate peer containers.

Use shared style tokens in `src/editor/styles.ts` for sidebar shape, spacing,
contrast, and internal outlines. Do not use local padding or light-gray
backplates to fake hierarchy.

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

### Sub Master pages and staff archive (DEC-079, DEC-094, DEC-095)

A Sub Master is a renderable `PresentationPage` that carries a frozen `envSnapshot: EnvironmentSetup` captured from the live global environment at creation time. Pages with `parentMasterId` referencing a Sub Master inherit from that snapshot instead of from `environment.json`. The hierarchy is single-level (Global -> Sub Master -> child). Active Sub Master blocks in `pageOrder` stay contiguous when the master is active, but DEC-094 allows a master to live in the staff Page Archive while its children remain active. `PageController.resolvePresentationState` chooses the inheritance base per page; the env-change re-apply effect depends on the resolved environment, not the raw `environment`, so editing `environment.json` does not re-apply on Sub Master pages or their children. The author re-syncs explicitly via a `Re-snapshot from Global` affordance on the Sub Master row. Scene controls route through DEC-095 authoring target semantics: Global Settings writes `environment.scene`, a selected Sub Master writes `envSnapshot.scene`, and a selected normal page or child writes `sceneOverrides`. Display numbering is `XX.M.NN` (slot, ordinal, child rank); `pageOrder` slug is unchanged.

`project.json` owns two page-order lists:

- `pageOrder`: active presentation sequence used by presenter navigation.
- `archivedPageOrder?: string[]`: staff-only editable archive shelf. Pages in
  this list are loaded and editable, but are excluded from presenter
  next/previous navigation, audience playback, and built client/project output.

Archived page files remain ordinary `pages/<id>.json` files. The legacy
`pages/_archive/` folder is delete recovery only and is not the staff Page
Archive. Build/export packaging must filter project page files against
`pageOrder` and omit archive-only page JSON.

Archived preview is id-based authoring preview state, not presenter navigation.
Selecting an archived row applies that row's resolved camera and scene state
without changing active `currentIndex`, `targetIndex`, NavControls, or
keyboard next/previous behavior. Selecting an active row after an archived
preview must apply the active row's resolved presentation state even when the
active numeric index is unchanged.

The Pages panel owns the authoring controls for this hierarchy. Reorder uses the
rightmost horizontal three-dot grip and `MOVE_PAGE_BLOCK` for active-page
reorder. The staff Archive adds active-to-archive and archive-to-active drag
targets without making archived pages part of the active controller index list.
Footer hierarchy controls are compact: top row add / duplicate / reset; lower
row `M` / `C` / trash for Make Master, Make Child, and delete. Enabled Page
Manager action buttons use the Global Settings add-button treatment: 28px
target, 14px centered icon, and opaque tinted fill.

## Cinematic Camera And Post Stack

The Cinematics editor is split into focused authoring surfaces:

- `Environment` for background, fog, exposure, tone mapping, and ambient occlusion.
- `Lighting Studio` for sun, key/fill/rim lights, and visible light-source polish.
- `Camera Studio` for render preset, lens type/FOV, and double-click camera focus timing.
- `Post Processing` for Depth of Field, Tilt-Shift, Post Production, Image finish, Glow, Film / Optics, Motion Trails, Composition Guides, Presentation Frame, and Contact Depth.
- `Terrain Grid`, GUI/editor setup, and page-local Camera Dynamics remain separate controls inside the Cinematics workflow.

Runtime post-processing is deterministic:

```text
RenderPass
  -> SSAOPass
  -> BokehPass
  -> UnrealBloomPass
  -> TiltShiftPass
  -> AfterimagePass
  -> LensGradePass
  -> SMAAPass
  -> OutputPass
```

Depth of field, tilt-shift, motion trails, composition guides, presentation
frame mattes, focus debug planes, and other diagnostic visuals are default off.
DOF focus can resolve from the page target, a saved camera-object focus point,
a manual distance, or an authored picked point. The editor presents DOF in
three subgroups: `Focus Target`, `Blur Strength`, and `Focus Debug`.

Page-local cinematic post overrides blend through the
`main-camera/cinematic-post` transition channel. Numeric fields such as grade,
DOF distances/blur, tilt-shift values, lens effects, guide thickness, motion
trails, and frame matte values blend with the page transition easing. Toggles,
focus mode, debug helpers, and aspect-mask choices remain discrete. Dolly,
truck, crane, handheld, and roll are page-local timed-shot camera fields on
`dynamicCamera`.

The diagnostic entry point is:

```text
npm run inspect:effective -- --render-stack
```

For Utah FORGE visual work, the trace must include active preset,
`environment.scene`, Sub Master `envSnapshot`, preset `scenePatch`, page
`sceneOverrides`, layer styles, topo material authority winner, effective
texture URL/cache key, bounds, public clip, edge fade, edge outline,
material/shader, terrain geometry/LOD, and post-processing pass order.

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

It now includes a generic local atmosphere sample layer so the Base GUI project
can exercise the `atmosphere-volume` model without Utah FORGE-specific data.

## Utah FORGE Case Study Architecture

Utah FORGE is the current active geothermal/geophysics case-study project:

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

Utah FORGE is no longer foundation-only. It is an active geothermal/geophysics
case-study project with public topo context, Phase 3 MT products, seismic
browser records, section/working-area tooling, and an editable Topo test cloud
local atmosphere layer. Older prose that describes it as procedural-only is historical unless
confirmed against current project files.

Runtime content is loaded from `project.json`, `environment.json`, pages,
overlays, and source-derived browser-ready products under
`projects/utah-forge/data/geosee_processed/utah_forge_phase_3/`.

The public topo surface is currently authored through environment terrain
material authority. The active material preset is:

```text
image:naip-2024-aerial
```

The effective public raster for the current Utah FORGE cinematic baseline is:

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=14db7e6b94489d80
```

Effective raster bounds:

```text
[229069.2, 4144854, 484164, 4414308]
```

The current terrain edge treatment uses a `rounded-square` edge fade with
`10000m` distance, `10000m` inset, and `75000m` corner radius. Edge outline is
enabled. The current render-stack trace for page `<disposable-utah-page>`
reports public clip enabled with center `[0, 0, 2000]` and size
`[1395706.5, 1139445, 12600]`, while also reporting a
`layer.terrain.publicSurfaceClipEnabled` authority conflict between the
environment value `true` and active preset layer patch value `false`.

Geophysical layers include source-derived Phase 3 MT stations, full-density MT
point/volume/slice/threshold/top-surface products, seismic browser products,
well/site context, and public reference context. Precise registration language
is blocked unless layer metadata records validated CRS/control-point evidence.
Seismic section placement is trace-header driven when source coordinates exist:
visible curtains use stored trace paths or surface grids rather than row/column
image indexes or endpoint-only rectangles. Approximate/envelope fallback remains
renderable visual context only when source trace geometry is unavailable and
must not be described as survey-accurate.

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
- `TopoMapPanel.tsx` is now also large after absorbing Topo Environment and is a future extraction target.
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
