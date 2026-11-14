# Purpose

> **Owner-approved current direction (14 November 2026):** Free public geoscience use of the existing GeoSee research alpha. **Approved future Gate A** is curated-example exploration with verified PNG; **Gate B** is desktop single-user local-first constrained **2D WGS84 GeoJSON** intake, independent local projects, portable **JSON save/reopen**, inspection/provenance and PNG. These are not current alpha functions or accepted releases. Exact supported geometry, limits, scientific tolerances, browsers and acceptance criteria still need W4 evidence. [W3 decisions](https://app.notion.com/p/418fb09932768185a02cf9cb3492fb3e) | [unmerged W3 PR #8](https://github.com/jamespatrickjackson-lang/GEODE/pull/8). The service and client-presentation model retained below is **historical**, not a competing current product requirement.

## Historical Origin — Service-Led Product Thesis

GeoSee is a service-first visual communication tool for mining and geoscience projects.

The product exists to turn complex technical project material into a spatial, navigable, audience-tuned communication environment. It is not trying to replace specialist modelling software. It is the delivery layer that helps technical material become understandable for investors, public/community stakeholders, government/planning audiences, and regulatory or technical reviewers.

Working thesis:

> GeoSee helps technical mining and geoscience material become understandable, visual, and communicable across different audiences.

## What This Repo Is

The current repo contains the existing GeoSee viewer/editor/presenter alpha and its prepared projects. It originated as an internal production/editor tool used for service-led deliverables; that model is historical rather than the approved future public product.

The current application is a Vite + React + Three.js single-page app. It loads project folders, renders project data in a 3D scene, lets the internal authoring user tune pages and layers, and previews a guided presentation.

The tool currently supports:

- a project landing screen
- selectable folder projects
- Woodjam as the original real/reference project
- Shahbazi Gravel Pit / Case Study B as a high-fidelity quarry demo and source-derived preview project
- Utah FORGE as an active geothermal/geophysics case study with Phase 3 MT, public context, and seismic browser records
- Base GUI Template as a blank/default GUI editing project
- a page-based editor and presenter flow
- layer styling, visibility, provenance fields, page controls, overlay text, and image attachments
- runtime Audience Lens controls for Shahbazi Gravel Pit
- source-derived Shahbazi preview surfaces, contours, QA layers, and projected UAV image previews

**Historical service assumption:** End clients would see a finished artifact rather than the authoring tool. This does **not** prohibit W3's future independent public exploration and local project authoring.

## Current Build State

GeoSee is no longer a Woodjam-only prototype.

Current kept state:

- Woodjam remains the real/reference project.
- Shahbazi Gravel Pit is selectable and is the high-fidelity quarry case study.
- Utah FORGE is selectable as an active geothermal/geophysics case study.
- Case Study B contains a procedural fallback shell plus real source-derived Shahbazi preview layers.
- The Shahbazi source-derived preview includes:
  - TLS sampled and tiled point previews
  - a TLS island mesh preview from `LaserScan.xyz`
  - a broad outer surface preview interpolated from sparse photogrammetry object points, not LiDAR
  - split contour linework from the separate surfaces
  - GCP/check point markers
  - UAV camera poses and frustums
  - dense matching and tie-point QA layers
  - six projected UAV image preview patches
- A Base GUI Template project exists for editing the shared starting GUI/environment style.
- Utah FORGE includes active Phase 3 MT records, public context, scalar/volume/threshold/top-surface records, seismic browser records, and Topo Environment cloud/sun/fog controls.
- The editor and landing page have been restyled toward the dark frosted overlay-box aesthetic used by the Shahbazi viewer.
- The bottom HUD now includes preview, compass, light/dark, and home controls.
- The home control returns to the landing page and prompts before leaving if edits are unsaved.

## Historical Alpha / Market Probe Rationale

The alpha is a market and workflow probe.

The near-term goal is not to build every future GeoSee feature. The goal is to learn which visual communication workflows matter enough to mining/geoscience teams that GeoSee should productize them.

The key questions remain:

1. Does a guided 3D project walkthrough communicate better than a deck, PDF, static map, or ordinary video?
2. Is the visual quality credible enough for real stakeholder use?
3. Are the right technical layers being shown?
4. Which audiences need distinct readings of the same project?
5. Which parts should remain service-led and which parts should become repeatable software?

## Original Service-Era Success Criteria (Historical)

Original recorded service-era criteria:

- Woodjam continues to open and behave as the preserved reference project.
- Shahbazi Gravel Pit opens as a visually credible quarry demo.
- Source-derived layers remain clearly separated from synthetic/demo placeholders.
- The editor can tune the project without breaking presenter output.
- Audience Lens behavior demonstrates one project spine with multiple audience-tuned readings.
- The data/provenance story remains honest: preview layers are preview layers, not final engineering deliverables.
- The build can continue toward publish/export and stronger data products without another structural reset.

## Source-Implemented / Kept (Not Comprehensive Browser Acceptance)

Complete or kept:

- React + Three.js app shell.
- Project landing flow.
- Folder-project loading for Woodjam, Shahbazi Gravel Pit, Utah FORGE, and Base GUI Template.
- Project-aware paths for pages, overlays, saves, and assets.
- Page controller with camera transitions and presenter navigation.
- Editor sidebar with page/layer/environment controls.
- Manual save/dirty-state workflow.
- Shahbazi data intake rails and processed preview folder.
- Shahbazi source-derived preview surfaces and QA layers.
- Shahbazi projected UAV image preview.
- Runtime Audience Lens controls for Shahbazi Gravel Pit.
- Dark frosted GUI style pass for landing/editor/presenter controls.
- Loader registry in `src/scene/layerLoaders.ts`.
- Named surface/photo render policies in `src/loaders/surfaceRenderPolicy.ts`.
- Lazy loading of editor chrome from the landing route.
- Topo Environment under the Topo tool, including local `atmosphere-volume`
  clouds/mist, visible/fake sun controls, and fog grouping.

## What Is Still Unresolved

Unresolved or not complete:

- No final Shahbazi orthomosaic exists yet.
- Utah FORGE registration and precision claims remain review-gated; visual
  alignment is not survey-grade evidence.
- No final textured mesh / GLB exists yet.
- No final Potree/EPT full point-cloud stream exists yet.
- The projected UAV image layer is a first-pass alignment preview only.
- The broad Shahbazi outer surface is IDW interpolation from sparse object points, not measured LiDAR terrain.
- Scale bar is local/raycast-based and should not be treated as a global map scale in every camera pose.
- Save is still sequential and not transactional across all project files.
- Export/publish pipeline is not complete.
- Accepted end-to-end MP4 and still-pack delivery are not complete; source still/record/video routes exist, but their output/browser/codec acceptance remains unverified.
- Some large editor files still need future component extraction.
- Page duplication attempts to copy overlay assets, but asset-copy failures are warnings, not a fully audited package operation.

## What This Alpha Is Not

- Not a geological modelling tool.
- Not an engineering decision tool.
- Not a final GIS system.
- Not a final photogrammetry pipeline.
- Not a client self-serve SaaS product.
- Not a replacement for specialist mining/geoscience software.
- Not a place to present synthetic or placeholder data as measured data.

Any feature that pushes GeoSee toward engineering claims, hidden data provenance, or unsupported measurement should be treated as out of bounds until explicitly approved.
