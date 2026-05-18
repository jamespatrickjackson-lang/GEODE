# GeoSee Session Changes Through 2026-05-12

This file started as the 2026-05-01 session-change note. It now records the current kept changes through 2026-05-12 so older handover docs do not mislead future work.

For the most detailed kept-change record, also read:

```text
CHANGELOG.md
```

## Major Kept Changes Since the Original May 1 Notes

### Multi-project support

Kept:

- app moved beyond hardcoded Woodjam assumptions
- project catalog/runtime entries added
- Woodjam preserved
- Shahbazi Gravel Pit / Case Study B added
- Utah FORGE foundation project added
- Base GUI Template added
- project-aware paths for pages, overlays, assets, and saves

Important result:

Woodjam, Shahbazi, Utah FORGE, and Base GUI now load as separate folder projects.

### Utah FORGE foundation

Kept:

- new landing-page entry for Utah FORGE
- project folder under `projects/utah-forge/`
- starter `project.json`, `environment.json`, overview page, overlay text, data README, data-reference README, and intake staging sample records
- procedural reference stage loader

Still unresolved:

- no real Utah FORGE technical data has been ingested
- CRS, bounds, source package, layer set, pages, and provenance are pending the briefing

### Shahbazi Gravel Pit source-derived demo

Kept:

- Shahbazi dataset chosen as the high-fidelity quarry case study
- intake folders created
- raw source folder populated
- processed preview folder populated
- acquisition and processing docs created
- source-derived preview layers wired into Case Study B

Raw staged source examples:

- `RawImages/`
- `LaserScan.xyz`
- `ObjectPoints.txt`
- `GCPs.txt`
- `TiePoints.txt`
- `DenseMatching.txt`
- `RefinedEOPs.txt`
- `RefinedIOPs.txt`

Processed preview examples:

- `tls_surface_mesh_preview.json`
- `outer_surface_mesh_preview.json`
- `tls_surface_contours.geojson`
- `outer_surface_contours.geojson`
- `ground_control_points.geojson`
- `camera_poses.geojson`
- `camera_frustums.geojson`
- `photo_overlay_preview/photo_overlay_manifest.json`

### Shahbazi surface decision

Kept:

- two separate surface previews under one editor layer
- outer broad surface from sparse object points
- fine TLS island surface from `LaserScan.xyz`
- split contour layer from the two surfaces

Removed/not active:

- combined mesh
- seam mesh
- island knit
- rectangular TLS cutout

Important:

The outer broad surface is not LiDAR. It is an interpolation from sparse photogrammetry object points. Keep labels and provenance honest.

### Projected image preview

Kept:

- first-pass projected UAV image preview layer
- six downsampled source image previews
- manifest-driven loader
- projection on current Shahbazi preview surfaces
- source/provenance notes

Still unresolved:

- not an orthomosaic
- not final texturing
- not final photogrammetric output

### Audience Lens

Kept:

- Shahbazi-only runtime Audience Lens controls
- Investor/Public/Government/Regulatory modes
- no dirty state
- no autosave
- no project file writes
- preview entry lens choice

Still unresolved:

- no persistent multi-audience authoring model
- no saved lens-specific page variants

### Architecture cleanup

Kept:

- `EditorChrome` lazy-loaded from landing
- layer loading moved to `src/scene/layerLoaders.ts`
- surface/photo policies moved to `src/loaders/surfaceRenderPolicy.ts`
- generated mesh winding corrected in prep scripts
- `previewFiles` and `futureTargets` separated
- debug logging helper added

Still unresolved:

- large editor/scene files remain
- save is not transactional
- some project-specific loader cases remain in the registry

### Landing page

Kept:

- dark Shahbazi-style background
- project buttons for Woodjam and Shahbazi
- Add New Project action
- `EDIT BASE GUI`
- landing image gear panel
- landing image localStorage persistence
- landing image controls for opacity, blur, saturation, brightness, contrast, darkness, vignette, grayscale, sepia, hue, scale, X, and Y

Still unresolved:

- Add New Project currently routes to Base GUI-style behavior rather than a full project creation wizard.

### Editor restyle

Kept:

- dark frosted overlay-box editor shell
- technical mono font language
- flat section buttons
- outline-focused hover
- selected page rows with flat color infill
- transparent editor header/stack interiors
- compact round save button
- save button light-red infill when unsaved
- Audience Lens label removed from compact editor controls

Still unresolved:

- exact visual tuning may continue
- large components remain candidates for extraction

### Bottom HUD and home behavior

Kept:

- bottom HUD cluster includes preview, compass, light/dark, and home
- home goes back to landing page
- unsaved edits trigger a prompt
- prompt supports Save & Exit, Exit, and Cancel
- Save & Exit waits for dirty state to clear before leaving

### Page duplication

Kept:

- duplicate selected page
- insert duplicate directly below source page
- copy page record
- copy overlay markdown
- attempt to copy referenced overlay images
- warn on image-copy failures rather than crashing

## Current Complete List

Complete:

- Woodjam preserved.
- Shahbazi selectable.
- Utah FORGE selectable as a foundation project.
- Base GUI Template available.
- Project-aware loading/saving.
- Page/presenter/editor system.
- Manual save/dirty state.
- Shahbazi source-derived preview rails.
- Shahbazi split surfaces and contours.
- Shahbazi projected image preview.
- Audience Lens runtime demo.
- Landing/editor/HUD dark style pass.
- Layer loader registry.
- Surface render policy.
- Current docs/changelog refreshed.

## Current Unresolved List

Unresolved:

- final orthomosaic
- final textured mesh / GLB
- final full-resolution point cloud stream
- final CRS/orientation validation
- export/publish
- MP4 export
- still-pack export
- provenance PDF
- project creation wizard
- transactional save
- large component extraction
- production auth/access control for private projects

## Files to Check First in a New Session

```text
CHANGELOG.md
docs/00-purpose.md
docs/01-scope.md
docs/02-architecture.md
docs/03-decisions.md
docs/04-build-sequence.md
docs/handover-for-claude.md
projects/case-study-b/project.json
projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md
src/scene/layerLoaders.ts
src/loaders/surfaceRenderPolicy.ts
src/editor/EditorRoot.tsx
src/ui/LightModeToggle.tsx
```

## Do Not Reintroduce

- combined Shahbazi mesh
- seam mesh
- island knit
- rectangular TLS cutout
- claims that preview image projection is an orthomosaic
- claims that the outer object-point surface is LiDAR
- unlabelled synthetic/demo overlays

## Verification

After code changes, run:

```text
npm run build
```

For documentation-only updates, build is not required.
