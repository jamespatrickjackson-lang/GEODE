# Start Here: GeoSee Context for New Developers and Agents

This document is the first-read orientation for people and AI agents joining GeoSee work. It explains what the app is, why it exists, how the code and data are shaped, and what boundaries matter while contributing.

It is intentionally not a full spec. The app is moving quickly, so this file gives the stable mental model and points to the deeper docs/code when needed.

## One-Sentence Product Frame

GeoSee is a service-first visual communication tool that turns complex mining, geoscience, geothermal, and spatial project material into guided 3D presentations for different audiences.

The working thesis:

> One project spine can support multiple audience-tuned readings, as long as the app stays honest about what is measured, derived, preview-only, synthetic, or still pending.

## What The App Is

GeoSee is currently an internal authoring and presentation app built with Vite, React, TypeScript, and Three.js.

It lets a small team:

- open a project folder
- load a 3D scene and layer manifest
- tune pages, camera positions, overlays, layer visibility, styles, lighting, and environment
- preview a guided presentation
- keep project data/provenance organized for later publishing

The current app is not a public SaaS product and not a final modelling/GIS/engineering tool. It is the builder and presenter for GeoSee artifacts.

## Who It Is For

GeoSee is designed around technical projects that need to be explained to multiple audiences:

- investors
- public/community stakeholders
- government/planning audiences
- regulatory or technical reviewers
- internal executives and project teams

The same project can be shown through different lenses, but the underlying source/provenance story must remain clear.

## Current Project Set

The app is now multi-project. Current folder projects include:

```text
projects/woodjam/
projects/case-study-b/
projects/utah-forge/
projects/base-gui/
```

### Woodjam

Woodjam is the preserved real/reference project. Treat it as the regression guard: new app infrastructure should not break it.

### Shahbazi Gravel Pit / Case Study B

Shahbazi Gravel Pit is the high-fidelity quarry demo. It includes real source-derived preview products from the Shahbazi UAV/TLS dataset, plus placeholder/demo layers that must stay clearly labelled.

Important distinctions:

- TLS island surface is derived from `LaserScan.xyz`.
- Broad outer surface is interpolation from sparse photogrammetry object points, not LiDAR.
- Projected UAV image patches are preview alignment layers, not a final orthomosaic.
- Synthetic planning/demo overlays are not measured quarry data.

### Utah FORGE

Utah FORGE is the geothermal/geophysics project. It is no longer only a foundation scaffold: the Phase 3 MT resistivity workstream is active.

It currently has:

- project folder scaffold
- landing page entry
- overview page and overlay copy
- procedural reference stage
- Phase 3 MT source files archived outside the active repo and mapped through
  `docs/archive-map.md`
- Phase 3 MT GeoSee-ready outputs under `geosee_processed/`
- measured MT station markers wired into the viewer
- source-derived MT resistivity point preview wired as a QA layer
- source-derived authored MT resistivity slices wired as the default presentation layer
- editor controls for station markers, scalar color range, slice visibility, and legend visibility
- project-specific handoff and data pipeline docs

Current Phase 3 MT facts:

- CRS: EPSG:26912 / NAD83 UTM Zone 12N
- local scene axes: X east, Y north, Z up
- no crop
- vertical exaggeration 1.0
- 122 physical MT station markers
- 1,094,940 source model rows
- display value: `log10(resistivity_ohm_m)`

Its current client-preprocessed intake structure still expects four dataset slots:

- Forge Southwestern electrical resistivity
- Forge Southwestern seismic analysis
- Utah FORGE Phase 3 electrical resistivity
- Utah FORGE Phase 3 seismic analysis

For Utah FORGE-specific context, start with:

```text
projects/utah-forge/AI_NEXT_AGENT_START_HERE.md
projects/utah-forge/Utah_Forge_Decisions.md
projects/utah-forge/Utah_Forge_DevPlan.md
projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md
```

### Base GUI Template

Base GUI Template is a blank/default editing project. It exists so shared GUI, overlay, navigator, label, lighting, and environment defaults can be tuned outside a real project dataset.

## Core Runtime Flow

The app flow is:

```text
Landing page
  -> choose project
  -> load project.json
  -> load environment.json
  -> load pages/*.json
  -> load overlay markdown/assets
  -> mount Three.js scene
  -> register layer groups
  -> load layers through the loader registry
  -> mount editor/presenter chrome
```

Main files:

```text
src/App.tsx
src/App.css
src/editor/EditorChrome.tsx
src/editor/EditorRoot.tsx
src/editor/EditorContext.tsx
src/scene.ts
src/scene/SceneManager.ts
src/scene/layerLoaders.ts
src/pages/loadPages.ts
src/pages/PageController.tsx
```

## Project Folder Model

Each project is meant to be self-contained:

```text
projects/<slug>/
  project.json
  environment.json
  pages/
  overlays/
  data/
  data_refs/
  intake_staging/
```

`project.json` owns:

- project metadata
- CRS/bounds/origin hints
- layer manifest
- page order
- active preview file references
- future target references

`environment.json` owns:

- default visibility
- global layer styles
- lighting/environment defaults
- GUI/presenter style defaults

`pages/*.json` own:

- page title/subtitle
- camera pose
- overlay path
- page-level visibility/style/environment overrides

`overlays/*` owns:

- page markdown
- local overlay image assets

`data/` owns:

- raw and processed project data that the app may eventually consume

`data_refs/` owns:

- citations
- source notes
- acquisition notes
- processing briefs
- provenance records

`intake_staging/` owns:

- structured notes about what has arrived, what is missing, what is unresolved, and what needs review

## Catalog and Project Selection

Project catalog entries are defined in:

```text
src/projects/projectCatalogRuntime.ts
```

Landing-visible projects are in `PROJECT_CATALOG`. Hidden/development-only projects can still be resolved by slug if they are included in the lookup.

When adding a new project:

1. Create the project folder.
2. Add valid `project.json`.
3. Add valid `environment.json`.
4. Add at least one page.
5. Add overlay text for that page.
6. Add a catalog entry.
7. Add a loader if the layer type/id is not already supported.
8. Run `npm run build`.

## Layer Loading

Layers are not supposed to be hardwired in `scene.ts`.

Layer loading is centralized in:

```text
src/scene/layerLoaders.ts
```

That registry maps layer specs to loader behavior. Generic loaders handle common types such as:

- lines
- polygons
- point markers
- point-cloud previews
- tiled point-cloud previews
- mesh previews
- camera paths/frustums

Some project-specific loaders still exist there where the data shape is special. This is acceptable for the alpha, but new work should prefer reusable loader patterns when possible.

## Scene Manager

`src/scene/SceneManager.ts` owns most scene-level behavior:

- Three.js scene setup
- layer group registry
- visibility application
- style application
- environment application
- camera controls
- lighting handles
- page camera markers
- scale-reference surfaces
- scene overlays and helper objects

It is powerful but large. Be careful with changes there because the blast radius is high.

## Editor Model

The editor is a controlled authoring shell around the scene.

Important files:

```text
src/editor/EditorChrome.tsx
src/editor/EditorRoot.tsx
src/editor/EditorContext.tsx
src/editor/PagePanel.tsx
src/editor/LayerPanel.tsx
src/editor/EnvironmentScenePanel.tsx
```

Current editor capabilities:

- page selection
- add page
- duplicate page directly below source page
- reset page overrides
- layer visibility/style editing
- environment/background/lighting/fog/grid editing
- overlay text/image editing
- manual save and dirty state
- home button with unsaved-work prompt

Save is currently sequential, not transactional. If a multi-file save fails halfway, files can be partially committed. That is acceptable in the alpha but should be improved before production.

## Presenter Model

The presenter is page-based:

- each page has a camera pose
- page transitions tween the camera
- overlay markdown is displayed in a styled overlay box
- bottom navigation controls move between pages
- preview mode reduces editor chrome

Shahbazi also has runtime Audience Lens behavior:

- Investor
- Public
- Government
- Regulatory

Audience Lens is runtime-only at the moment. It does not dirty files, autosave, or create persistent page variants.

## Data Pipeline Mental Model

GeoSee separates data into stages:

```text
source/reference notes
  -> raw user-placed data
  -> processed browser-ready previews
  -> active project layer references
  -> future production targets
```

For each dataset, keep these questions explicit:

1. What is the source?
2. What license/permission applies?
3. What files are actually present?
4. What coordinate system or local frame is used?
5. What has been processed?
6. What is active in GeoSee?
7. What is still future/pending?
8. Is this measured, derived, preview-only, synthetic, or placeholder?

The app now supports `previewFiles` and `futureTargets` in project layer specs:

- `previewFiles` are active browser-ready files currently used by the app.
- `futureTargets` are planned production outputs that should not be treated as available.

This distinction matters. Do not put missing future products in the same mental bucket as active preview files.

## Shahbazi Data Pipeline Example

Shahbazi is the best current example of the data flow.

Raw staged source files keep this historical repo-relative identifier:

```text
projects/case-study-b/data/raw/shahbazi_gravel_pit/
```

The actual Shahbazi source bytes now live under
`C:\GeoSee\GeoSee_Archive\projects\case-study-b\data\raw\shahbazi_gravel_pit\`.

Processed preview files live under:

```text
projects/case-study-b/data/processed/shahbazi_gravel_pit/
```

Reference/provenance docs live under:

```text
projects/case-study-b/data_refs/shahbazi_gravel_pit/
```

Prep scripts live in:

```text
prep/build_shahbazi_*.mjs
```

Current source-derived preview families:

- TLS point previews
- TLS island mesh
- sparse-object-point outer surface
- split contours
- ground control/check points
- UAV camera positions and frustums
- dense matching links
- tie-point/object-point QA
- projected image preview

Current production gaps:

- final orthomosaic
- final textured mesh / GLB
- full-resolution Potree/EPT point-cloud stream
- final CRS/orientation validation
- final publish/export package

## Rendering and Depth Rules

Surface, contour, and projected-photo layering can be fragile. The current app uses named render policies to keep this more explicit:

```text
src/loaders/surfaceRenderPolicy.ts
```

Important current assumptions:

- preview surface meshes should be generated with correct upward/top-side winding
- the app renders surface front faces
- UAV-side projected image geometry should face the camera/top side correctly
- contours should not be visible through their own ground surface
- scale bar uses local raycast/surface sampling, not a guaranteed global map scale

If a visual layer appears on the underside, disappears behind terrain, flickers, or shows through a surface, check:

- mesh winding
- material side
- depth write/test
- render order
- polygon offset
- scale-reference surface flags
- whether the source artifact was generated correctly

Avoid fixing generated data problems with too many runtime hacks. If the artifact is wrong, prefer fixing the prep script and regenerating.

## Provenance and Honesty Rules

This app must remain clear about the status of every layer.

Use precise language:

- `measured` for direct source measurements
- `source-derived` for outputs computed from real source data
- `preview` for browser-ready interim products
- `placeholder` for planned-but-not-real layers
- `synthetic` or `illustrative` for made-up demo layers
- `future target` for products that are planned but not present

Do not claim:

- preview meshes are final terrain models
- projected image patches are orthomosaics
- synthetic overlays are measured data
- missing files exist
- placeholder layers are real

When in doubt, say less and record the uncertainty in `data_refs/` or `intake_staging/`.

## UI Direction

The current visual language is moving toward:

- dark viewer background
- frosted overlay-box panels
- technical mono controls
- flat button interiors
- subtle outline/frost hover states
- no decorative UI for its own sake
- presenter controls that feel like part of the artifact, not a generic admin app

The overlay box is the main aesthetic reference for the editor and landing screen.

## Working Safely

Before editing:

- read the local files first
- prefer existing patterns
- keep changes scoped
- do not remove user work
- do not claim data is real unless the repo proves it

After editing:

- validate JSON if project files changed
- run `npm run build` for code changes
- update docs/changelog when the system shape changes
- note what is still unresolved

Useful commands:

```text
npm run build
npm run dev -- --host 127.0.0.1
```

Preferred search:

```text
rg "thing to find"
rg --files
```

## Where To Read Next

Start here, then read:

```text
docs/00-purpose.md
docs/01-scope.md
docs/02-architecture.md
docs/03-decisions.md
docs/04-build-sequence.md
docs/handover-for-claude.md
CHANGELOG.md
```

For project-specific data context, read the relevant project folder:

```text
projects/<slug>/project.json
projects/<slug>/environment.json
projects/<slug>/data/README.md
projects/<slug>/data_refs/
projects/<slug>/intake_staging/
```

## Current North Star

GeoSee should make technical spatial projects easier to understand without flattening the truth of the data.

The app wins when a viewer can understand the project story, a technical reviewer can trace the data status, and the authoring team can keep building without turning the codebase into a pile of one-off hacks.
