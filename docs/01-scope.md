# Scope

> **Scope boundary as of 14 November 2026:** Current GeoSee has a **fixed set of prepared geoscience examples**, project-wired data loaders and development-only authoring/save endpoints. **Approved future direction, not implemented:** W3 Gate A public curated-example exploration with accepted PNG, then Gate B desktop single-user local-first **2D WGS84 GeoJSON** import, independent local project creation, portable **JSON save/reopen**, basic inspection/provenance and PNG. [W3 owner decision](https://app.notion.com/p/418fb09932768185a02cf9cb3492fb3e) | [draft PR #8, unmerged](https://github.com/jamespatrickjackson-lang/GEODE/pull/8). Exact geometry subset, data/vertex limits, tolerances, browsers/performance and release evidence require W4. Service-era boundaries below remain historical where inconsistent with that direction.

This document records what the current GeoSee alpha is allowed to do, what it already does, and what remains out of scope.

## Current Scope Summary

The **current alpha** is a multi-project geoscience visualization and developer-authoring app. Its fixed catalog, prepared projects and specialized loaders are **not** an independent project creator, generic direct scientific importer or production-hosted persistence mechanism.

Current project set:

- `woodjam` - original real/reference project.
- `case-study-b` - Shahbazi Gravel Pit high-fidelity quarry demo with source-derived preview layers.
- `utah-forge` - geothermal/geophysics case study with active Phase 3 MT, public context, and seismic browser records.
- `base-gui` - empty/default project for editing shared GUI/environment defaults.

**Historical service-era priority (still useful as evidence discipline, not the W3 future build plan):**

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
  - right-aligned horizontal three-dot drag grip for page reorder
  - floating drag preview, 50% source-row opacity, and before/after insertion line
  - add page
  - duplicate selected page directly below source page
  - reset selected page overrides
  - Sub Master hierarchy actions: `M` / `C` / trash lower row for Make Master,
    Make Child, and delete
  - staff-only Page Archive for editable draft/alternate pages outside
    presentation navigation and built client output
  - M/C relationship badges that reveal and pulse linked master/child rows
    without changing selection
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
- An editable one-puff `Topo test cloud` local atmosphere layer for Topo
  Environment QA; visibility remains authoring-state scoped.

Important scope note:

Utah FORGE is an active case study, not a foundation-only placeholder. Its
current project/source/generated files are authoritative over older prose. Do
not infer survey-grade accuracy from visual alignment; imported geospatial
layers still require explicit registration status and review evidence.
Seismic sections must use trace-header geometry before navigation/envelope
fallback when source coordinates exist.

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
- Historical Shahbazi raw source path `projects/case-study-b/data/raw/shahbazi_gravel_pit/` is **not populated in the public checkout**; see [archive map](archive-map.md). The active runtime uses processed previews.
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
- **Accepted MP4 output** and verified codec/browser/export coverage (capture source paths do exist).
- **Packaged still-set output** (individual still source paths exist; package workflow unverified).
- Provenance PDF output.
- Transactional save.
- Full project creation wizard.
- Robust packaged project duplication/export.
- Stronger code splitting/component extraction for large editor modules.
- Final mobile presenter polish.

## Out of Scope for the Current As-Built Alpha

The following is a present-implementation / earlier service-era boundary, **not** rejection of W3's approved future public local-project workflow.

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

## Deferred / Historical Future Backlog

**Updated intent:** independent local projects, constrained 2D WGS84 GeoJSON intake, portable JSON save/reopen and PNG are now **approved future W3 Gate B targets**, but are **not yet implemented**. Larger science formats, cloud/multi-user operations and packaged video are separate future work. [W3 draft specification](https://github.com/jamespatrickjackson-lang/GEODE/pull/8) remains unmerged.

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

## Historical Service-Era Scope Questions

The original safeguards below preserve scientific honesty but do **not** override the approved W3-D01–D10 future direction or W4 acceptance obligations.

Before building anything new, ask:

1. Does it help the project communicate better?
2. Does it preserve the difference between source-derived, synthetic, placeholder, and future data?
3. Does it avoid pretending preview products are final measured outputs?
4. Does it keep Woodjam working?
5. Does it keep Shahbazi opening even if future data is missing?

If the answer is no, defer it.
