# Scope

This document records what the current GeoSee alpha is allowed to do, what it already does, and what remains out of scope.

## Current Scope Summary

GeoSee is now a multi-project internal authoring and presentation app.

Current project set:

- `woodjam` - original real/reference project.
- `case-study-b` - Shahbazi Gravel Pit high-fidelity quarry demo with source-derived preview layers.
- `utah-forge` - geothermal/geophysics case study with active Phase 3 MT, public context, and seismic browser records.
- `base-gui` - empty/default project for editing shared GUI/environment defaults.

Current priority:

> Preserve Woodjam, keep Shahbazi honest as a preview/source-derived demo, continue improving the authoring and presentation shell, and avoid claiming that placeholders or preview products are final measured outputs.

## In Scope Now

### Project Model

- Project landing screen.
- Folder-based project selection.
- Project-aware paths for:
  - `project.json`
  - `environment.json`
  - `pages/*.json`
  - `overlays/*`
  - project-local `data/`
  - project-local `data_refs/`
- Project catalog entries for Woodjam, Shahbazi Gravel Pit, and Utah FORGE.
- Hidden/development entry for Base GUI Template through `EDIT BASE GUI`.
- Active preview files separated from future production targets through `previewFiles` and `futureTargets`.

### Authoring Tool

- Desktop browser authoring.
- Three.js scene viewport.
- Page Manager with:
  - global settings pseudo-page
  - page selection
  - add page
  - duplicate selected page directly below source page
  - reset selected page overrides
  - page visibility/navigation controls
- Page duplication that copies page data and attempts to copy overlay markdown/image assets.
- Layer panels for public and customer/project data.
- Per-layer visibility and style controls.
- Environment controls for:
  - background
  - lighting
  - sun lock-to-camera
  - visible/fake sun orb, halo, and source marker
  - camera-aware lighting behavior
  - fog
  - Topo Environment clouds and local atmosphere volumes
  - terrain/grid
  - GUI/overlay style controls
- Overlay text and image editing.
- Manual save with dirty state and save status.
- Unsaved-exit prompt when returning home from the app.
- Base GUI project for editing shared starting GUI defaults.

### Utah FORGE

In scope and currently kept:

- Landing-page entry.
- Folder-project under `projects/utah-forge/`.
- Public topo/terrain context, including NAIP/topo material choices, graticule,
  public surface clipping, edge fade, and edge outline controls.
- Phase 3 MT products, scalar volume/threshold/slice/top-surface records, and
  product-aware transition behavior.
- Phase 3 seismic browser records and capability-product controls.
- Section planes, working-area focus, site details, and current product pages.
- Topo Environment controls for scene atmosphere, clouds, sun, and fog.
- A current visible one-puff `Topo test cloud` used as the cloud visibility QA
  fixture.

Important scope note:

Utah FORGE is an active case study, not a foundation-only placeholder. Its
current project/source/generated files are authoritative over older prose. Do
not infer survey-grade accuracy from visual alignment; imported geospatial
layers still require explicit registration status and review evidence.

### Presenter / Preview

- Page-based camera sequence.
- Bottom navigation controls.
- Preview/presenter toggle.
- Scale bar.
- Compass.
- Light/dark control.
- Home button back to landing.
- Overlay display with dark frosted box styling.
- Audience Lens prompt on Shahbazi presenter entry.

### Shahbazi Gravel Pit / Case Study B

In scope and currently kept:

- Procedural quarry shell as fallback.
- Shahbazi data intake folders and reference docs.
- Raw Shahbazi source staging under `projects/case-study-b/data/raw/shahbazi_gravel_pit/`.
- Processed preview outputs under `projects/case-study-b/data/processed/shahbazi_gravel_pit/`.
- Source-derived preview layers:
  - sampled TLS point preview
  - tiled TLS point preview
  - TLS island surface preview
  - broad outer sparse-object-point surface preview
  - split ground-surface contours
  - ground control/check points
  - UAV camera positions / flight path
  - camera frustums
  - dense matching links
  - raw sparse object/tie-point QA
  - tie-point support isolines/isobands
  - projected UAV image preview
- Runtime Audience Lens modes:
  - Investor
  - Public
  - Government
  - Regulatory

Important scope note:

The Shahbazi broad outer surface is a preview interpolation from sparse photogrammetry object points. It is not LiDAR and is not a final terrain model.

### UI / Visual Language

In scope and active:

- Dark viewer background for Shahbazi-style presentation.
- Dark frosted overlay-box aesthetic for:
  - overlay box
  - editor shell
  - landing image controls
  - project selection buttons
  - bottom HUD controls
- Technical mono font language for the editor/landing controls.
- Flat button interiors with outline-focused hover interaction.
- Selected page rows with flat page-color infill.
- No extra decorative UI container around standalone project buttons on the landing page.

## Complete / Done

- Woodjam preserved as selectable reference project.
- Shahbazi Gravel Pit selectable and loading.
- Utah FORGE selectable and loading as an active geothermal/geophysics case study.
- Base GUI Template selectable via `EDIT BASE GUI`.
- Project-aware page/overlay/save paths.
- Loader registry created in `src/scene/layerLoaders.ts`.
- Editor chrome lazy-loaded from landing.
- Surface/photo render policy centralized.
- Shahbazi surface winding fixed at generated artifact level.
- Shahbazi surface contours and preview surfaces kept as separate surface products, not stitched.
- Runtime Audience Lens controls kept for Shahbazi only.
- Landing page dark restyle and landing image editor kept.
- Home button prompt for unsaved work kept.
- Topo Environment clouds/sun/fog controls added under the Topo tool.
- `atmosphere-volume` layer type added for local environmental cloud/mist
  volumes.
- Visible Utah FORGE single-cloud fixture kept for cloud visual QA.

## Unresolved / Pending

- Final Shahbazi orthomosaic.
- Final Shahbazi textured mesh / GLB.
- Full-resolution Potree/EPT point-cloud stream.
- Full photogrammetry reconstruction workflow inside or alongside GeoSee.
- Export/publish workflow.
- MP4 video output.
- Still-pack output.
- Provenance PDF output.
- Transactional save.
- Full project creation wizard.
- Robust packaged project duplication/export.
- Stronger code splitting/component extraction for large editor modules.
- Final mobile presenter polish.

## Out of Scope for Current Alpha

- Client self-serve editing.
- Multi-user collaboration.
- User accounts or tenant management.
- Billing/subscription infrastructure.
- Production backend service.
- Database-backed project storage.
- Engineering measurement tools.
- Auto-generated mineral/resource claims.
- Treating synthetic overlays as measured source data.
- Treating Shahbazi preview surfaces or projected images as final survey/orthomosaic products.
- Native importers for proprietary modelling packages.
- Automated photogrammetry processing inside the browser.
- Final regulatory-grade GIS exports.

## Deferred to Later Product Work

- Real project creation wizard.
- Release/review workflow.
- Multi-project portal/dashboard.
- Analytics on viewer behavior.
- Client portal.
- Full export pipeline with MP4, stills, provenance PDF, and static publish packaging.
- Orthomosaic/DSM/mesh processing automation.
- Potree/EPT point-cloud streaming integration.
- A more formal data ingestion pipeline with repeatable parameter files.
- Stronger permissions and authentication for non-public client projects.

## Scope Change Rule

Before building anything new, ask:

1. Does it help the project communicate better?
2. Does it preserve the difference between source-derived, synthetic, placeholder, and future data?
3. Does it avoid pretending preview products are final measured outputs?
4. Does it keep Woodjam working?
5. Does it keep Shahbazi opening even if future data is missing?

If the answer is no, defer it.
