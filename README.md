# GEODE / GeoSee

**Open-source geoscience visualization and exploration**

**Status: Research and software-development alpha**

GeoSee is the working geoscience application in the GEODE repository. It began as a **technical capabilities demonstration**, bringing geological, geophysical, geographic and survey information into an interactive 3D environment. It is now being **retooled for public use**, with the goal of enabling geoscientists, researchers and educators to load their own supported data, explore spatial relationships and communicate results.

The current application includes substantial visualization, interaction, authoring and capture functions, but **is not yet a general-purpose bring-your-own-data tool**.

## Architecture

Built with **React, TypeScript, Three.js and Vite**, GeoSee currently uses:

- **Project configuration:** JSON manifests describe projects, layers, coordinate context, environments and presentation pages.
- **Data preparation and loaders:** Project-specific tools convert selected scientific sources into browser-ready geometry, imagery, volumes and metadata; loaders register them as scene layers.
- **Interactive scene:** A Three.js scene/layer manager supports navigation, visual composition, sectioning and controls.
- **Authoring and communication:** Editor, presenter, camera animation and capture systems use saved project/page state.

The current alpha has **no production backend**; some local editing and file-writing functions depend on development-only endpoints. See the [implementation architecture](docs/02-architecture.md).

## Data and current capabilities

| Data family | Current input pathway | Available visualization / interaction |
| --- | --- | --- |
| **Terrain and elevation** | Project-wired GeoTIFF / elevation rasters | 3D terrain, elevation styling, relief and exaggeration, spatial context |
| **Satellite, orthophoto and site imagery** | Prepared JPEG/PNG/WebP and other image assets with project placement | Terrain draping, opacity and colour controls, footprint/edge handling, photo overlays |
| **Geology and geographic context** | Schema-specific GeoJSON points, lines and polygons | Show/style mapped geology, roads, waterways, claims, surveys, boundaries and markers |
| **Drillholes, logs, assays and geochemistry** | Project-specific structured/GeoJSON data; selected source tables prepared offline | Borehole trajectories and labels, log/assay context and overlays with other layers |
| **Seismic reflection data** | SEG-Y traces/headers **preprocessed offline** into GeoSee manifests and scalar products | Prepared 2D sections, 3D volume views, section controls and visual comparisons |
| **Magnetotelluric (MT) data** | EDI station data and inversion models **preprocessed offline** into stations, tiles, slices and volumes | Station/QC context, resistivity point views, scalar volumes, sections and threshold surfaces |
| **Survey scans and point clouds** | ASCII/XYZ/CSV and related sources **prepared offline** as JSON or binary tiles | Point-cloud previews, tiled data, contours, surface previews and survey context |
| **Derived surfaces and scientific volumes** | Project-specific JSON manifests and binary products (`.bin`, `.u8`, optional `.f32`) | Layering, opacity, clipping/sections, surface/volume representations and selected iso/threshold views |

**Input status matters:** Supported runtime loaders are largely tied to existing project schemas. Raw SEG-Y, EDI and survey files are **not generally imported directly through the browser**. The existing file-drop/intake interface stages files; it does not automatically interpret or display them. **General LAS/LAZ import, full Potree point clouds and final GLB/glTF survey products are not completed general-purpose routes.** See [data inventory and provenance](docs/dev-context/Dataset-Map.md).

### Other working capabilities

Projects including **Utah FORGE, Woodjam and Shahbazi Gravel Pit** demonstrate layered 3D exploration, scene styling, configurable visibility, section tools, authored presentation pages, animated camera paths, and supported still/video capture paths. Output formats, resolution and browser behaviour vary by configuration; not every export path has passed full acceptance testing.

### Example visualizations

![Utah FORGE layered geophysics](docs/assets/screenshots/geode-B.jpg)

![Utah FORGE seismic section, boreholes and controls](docs/assets/screenshots/geode-D.jpg)

*Illustrative views from the included Utah FORGE project, not independently verified scientific measurements.*

## Limitations and development priorities

**Current limitations:** Most datasets still require prepared assets and manual/project-specific configuration; full independent project creation and a guided import workflow are incomplete. Scientific registration across coordinate systems, vertical datums and seismic time/depth representations is not universally confirmed. Performance, browser portability, capture/export reliability and safe hosted editing require additional work.

**Development direction (not a committed release schedule):**

1. **User data:** Supported geoscience import paths, clearer metadata/coordinate handling and repeatable project creation.
2. **Practical geoscience work:** More usable visualization, sectioning, overlays, interrogation and scientifically appropriate tools, prioritized from user needs.
3. **Scientific traceability:** Clear source/derived-data distinctions, registration checks, assumptions and uncertainty.
4. **Public usability:** Interface refinement, documentation, supported browser testing, performance and robust outputs.

## Run locally

Requires Node.js and npm.

```bash
git clone https://github.com/jamespatrickjackson-lang/GEODE.git
cd GEODE
npm ci
npm run dev -- --host 127.0.0.1 --port 5189 --strictPort
```

Open `http://127.0.0.1:5189/?project=utah-forge` to explore the principal geophysics example.

## Scientific and engineering-use warning

**Research software under active development. Not qualified for professional engineering or safety-critical decisions.** GeoSee has automated software checks and limited browser testing, but **has not undergone comprehensive scientific verification and validation** of its data registration, measurements, transformations, interpretations or outputs. Visual alignment does not establish numerical accuracy. Do **not** rely on the software alone for engineering design, drilling decisions, resource estimation, hazard/safety assessments, regulatory submissions or other consequential decisions. Any such use requires independent verification of source data, methods, coordinate transformations and results by appropriately qualified professionals.

See the [release verification record](docs/GEODE-release-verification.md) for the scope and limitations of testing.

**License:** GEODE-authored software is distributed under [Apache License 2.0](LICENSE). Scientific datasets, imagery and other third-party materials retain their own applicable rights and attribution conditions.
