# GEODE

**Scientific data, interactive 3D visualization, and solo-directed, AI-assisted software engineering.**

GEODE is the broader direction for a reusable scientific software platform: turning complex, multidimensional data into understandable, interactive experiences with explicit provenance and engineering evidence. Its executable foundation in this repository is **GeoSee**, a substantial geoscience visualization and authoring alpha built with React, TypeScript, Three.js and Vite.

GeoSee combines terrain, geographic context, drilling, seismic and magnetotelluric data with sectioning, configurable environments, authored pages, camera transitions and cinematic capture. Development is directed by James Patrick Jackson using AI coding assistants, with human decisions, implementation iterations, source contracts and tests recorded alongside the code. AI assistance describes the development method; an embedded AI assistant is not required to run the application.

**Maturity:** research and software-development alpha. Visualization is not certified geospatial measurement, engineering-grade scientific validation, or medical-device clearance.

| Component | State |
| --- | --- |
| GeoSee geoscience application | Implemented here: viewer, editor, presenter, project data and verification tools |
| Independent GEODE common spine | Architecture direction and future extraction; not yet a completely separated runtime |
| Medical imaging development | Separate experimental, non-diagnostic branch; not included in this release |
| Offshore Vancouver Island and DMT method kit | Separate development workspaces; not incorporated into this application |

## Application screenshots

These are authentic, user-supplied screenshots of GeoSee's Utah FORGE visualization, displayed here as web-optimized copies of original 3840 × 2160 PNG captures. They show scientific **visualizations**, not independently verified subsurface interpretations or engineering measurements. The exact active dataset/recipe for each frame has not been independently reconstructed from its image alone.

| Terrain and geographic context | Terrain with subsurface scientific representation |
| --- | --- |
| ![Utah FORGE broad terrain and draped imagery in GeoSee](docs/assets/screenshots/utah-forge-terrain.jpg) | ![Utah FORGE terrain cap and colored subsurface cutaway](docs/assets/screenshots/utah-forge-terrain-mt-section.jpg) |
| Landscape-scale terrain and prepared imagery. | Combined topographic and subsurface 3D rendering, with section/axis indicators. |

| Subsurface section | Layered scalar/volume view |
| --- | --- |
| ![GeoSee Utah FORGE colored subsurface section with a visual sun marker](docs/assets/screenshots/utah-forge-volume-section.jpg) | ![GeoSee layered subsurface visualization with atmospheric lighting](docs/assets/screenshots/utah-forge-layered-volume.jpg) |
| Colored section/volume output; precise active layer not identified from image alone. | Layered scalar representation with scene lighting; image is not an accuracy acceptance result. |

The [image provenance register](docs/assets/screenshots/README.md) lists each original filename, SHA-256, original resolution and scope of the visual evidence. For editable branding/HUD controls and spline-based cinematics, see the source-linked [authoring](#authoring-and-presentation) and [Capture Director](#cinematic-capture) sections below. Separate accepted UI/capture screenshots are not yet published.
## Start here

- [Architecture](docs/02-architecture.md), [scope](docs/01-scope.md) and [decision history](docs/03-decisions.md)
- [Verification and known release limitations](docs/GEODE-release-verification.md)
- [Publication manifest and data attribution](docs/GEODE-publication-manifest.md)
- [Scientific dataset map](docs/dev-context/Dataset-Map.md) and [Utah FORGE layer status](projects/utah-forge/DATA_LAYER_STATUS.md)
- [Capture Director](docs/capture-director/README.md)

- [Developer orientation](docs/START-HERE.md), [agent contract](CLAUDE.md) and [active build context](docs/dev-context/Active-Build-Context.md)

## Run locally

Tested environments: Node 20.20.2 / npm 10.9.10 and Node 24.22.2 / npm 11.19.1 on Windows. CI targets Node 20 and Python 3.14 on Ubuntu; see the [Actions runs](https://github.com/jamespatrickjackson-lang/GEODE/actions) and the recorded initial dependency failure. The release verification record contains the exact outcomes. Python 3 is needed for the Python-backed ingestion tests and selected offline preparation tools, not for the browser application itself.

```sh
git clone https://github.com/jamespatrickjackson-lang/GEODE.git
cd GEODE
npm ci
npm run dev -- --host 127.0.0.1 --port 5189 --strictPort
```

Open [http://127.0.0.1:5189](http://127.0.0.1:5189), select a project, and use the page/editor controls. Direct project URLs include `/?project=woodjam`, `/?project=utah-forge`, `/?project=case-study-b` and `/?project=base-gui`.

```sh
npm run build
npm run check:gate
npm run check:pages
npm run check:runtime-assets
python -m pip install -r tools/requirements-test.txt
npm run test:tools
```

`npm ci` enables the repository's pre-commit checks through its prepare script. Authoring uses development-only Vite endpoints and writes project/page state to the checkout. Use a disposable clone for experimentation. Bind this development server to loopback; it is not a hardened hosted editing service. The Windows launcher can stop a process on port 5173, so the explicit command above is preferable for automated verification.

The build includes prepared project/runtime data and FFmpeg assets, while excluding raw source buckets and selected archived material. Static builds omit the development authoring endpoints. See the release verification record for hosting and export limitations. Raw regeneration inputs may live outside Git. [Archive mapping](docs/archive-map.md) and [the archive manifest](docs/archive-manifest.json) describe historical source locations; local `C:\GeoSee\GeoSee_Archive` paths are developer provenance, not portable download instructions.

## Scientific and geospatial visualization

| Capability | Implementation and representative evidence |
| --- | --- |
| Real terrain and elevation | [GeoTIFF terrain loader](src/loaders/loadTerrain.ts), [coordinate transforms](src/loaders/geoTransform.ts), [topographic runtime](src/topoMap/runtime.ts), [Woodjam terrain](data/terrain_woodjam.tif) |
| Satellite and orthophoto overlays | Terrain-draped prepared imagery, opacity, image adjustments, footprint clipping and edge fading in [Topo Map](src/topoMap/) and its [editor](src/editor/topoMap/TopoMapPanel.tsx) |
| Geographic context | Project-wired GeoJSON points, lines and polygons for roads, hydrography, utilities, claims, geology and surveys; [loaders](src/loaders/), [Woodjam data](docs/woodjam/data-manifest.md) |
| Drillholes, logs, assays and geochemistry | Source-derived trajectories, borehole/log views, assay and sample context; [runtime data](data/), [Utah FORGE project](projects/utah-forge/project.json) |
| Seismic sections and 3D volumes | [Prepared seismic loader](src/loaders/loadSeismicBrowser.ts), [offline SEG-Y preparation](prep/build_utah_forge_seismic_browser.py), [source gates](tools/validate-seismic-source-gates.mjs) |
| MT resistivity | Station context, tiled inversion cells, scalar volumes, slices, threshold surfaces and iso-bands; [MT subsystem](src/mtResistivity/), [scalar-volume loader](src/loaders/loadScalarVolume.ts) |
| Point clouds, surfaces and photogrammetry | Prepared point/tile and mesh previews, contours, camera frustums and projected photography; [Shahbazi processing records](projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md) |
| Composition and sectioning | Layer visibility/style/opacity, clipping, section frames, independent object visibility and working-area focus; [scene controller](src/scene/SceneManager.ts), [section runtime](src/scene/section/), [layer controls](src/editor/layerControls/) |

Spatial manifests, scene origins and dataset-specific transforms allow layers to share a view. They do not automatically establish accepted registration across coordinate systems, vertical datums, or seismic time/depth domains. Source, derived, preview, synthetic and future content must remain distinguishable. Some seismic registration metadata explicitly remains unverified.

### Formats: runtime, preparation and future targets

| Route | Formats and limits |
| --- | --- |
| Direct, project-wired runtime inputs | GeoTIFF terrain; schema-specific GeoJSON; prepared images; GeoSee JSON manifests/mesh previews; manifest-described `.bin`, `.u8` and optional `.f32` products |
| Offline scientific preparation | SEG-Y traces and headers → seismic browser products; EDI MT responses → station/QC products; ASCII/XYZ/CSV and survey inputs → prepared clouds, tables, surfaces or volumes |
| Future or placeholder targets | General LAS/LAZ import, full Potree clouds and final GLB/glTF/textured survey products where a manifest lists only `futureTargets`; these are not completed universal importers |

Binary arrays need their dimensions, coordinate mapping, scalar ranges and other manifest metadata. The Utah FORGE file-drop interface stages intake; it does not automatically validate, interpret or display arbitrary scientific files. PDF/Excel/source archives serve as reference or preprocessing material.

## Authoring and presentation

The [project catalog](src/projects/projectCatalogRuntime.ts) selects separate project loads. [Pages](src/pages/) and the [editor](src/editor/) manage camera poses, visibility, overrides, page creation/duplication/reordering and presentation content. [Transition executors](src/scene/transitions/) coordinate representation-aware opacity, section masks, scalar styles and environment changes within a loaded project. Switching projects is not a seamless geospatial flythrough between coordinate systems.

Environment controls cover lighting, separate sun visuals and light contribution, scene fog, local atmospheric volumes, terrain materials and post-processing. Branding and layout controls configure logos, headers, menus, HUDs and overlays. The [developer inspector](src/editor/DevModeInspector.tsx) supports interface inspection and editing of registered layout properties; it is not a universal no-code UI builder.

[Audience-specific views](src/audience/) and [presentation cards](src/presenter/OverlayDisplay.tsx) provide different explanations of the same project for technical and nontechnical audiences.

## Cinematic capture

[Capture Director](src/capture/) includes Bézier spline camera paths with independent handles, G0–G3 continuity controls, keyframes, holds, a timeline and deterministic camera sampling. Page/scene choreography and camera motion share a clock while retaining separate responsibilities.

Implemented capture paths include realtime screen/viewport recording, composited overlays, still capture, deterministic frame sequences and video encoding through browser or local FFmpeg pipelines. See [production notes](docs/capture-director/README.md), [browser encoding constraints](docs/capture-director/ffmpeg-browser-encode-constraints.md) and [spline runtime tests](tests/tools/capture-director-camera-path-v3-spline-runtime.test.mjs).

High-resolution paths include configured 4K output and tiled still rendering for larger outputs such as 8K. GPU memory, browser/codec support, effects parity and tile seams remain practical constraints. The presence of these code paths is not a claim that every resolution, codec or multipage export has passed visual acceptance.

## Demonstration projects

| Project | What it demonstrates | Interpretation boundary |
| --- | --- | --- |
| [Utah FORGE](projects/utah-forge/) | Terrain/imagery, geothermal context, MT inversion representations, seismic sections/volumes, station and well context, sectioning and authored scientific views | Source-derived visualization; unresolved registration and quantitative validation limits remain explicit |
| [Woodjam](projects/woodjam/) | Terrain, exploration/drilling, assays/geochemistry, geology, roads/water/claims and authored walkthroughs | Measured/source-derived context and interpretation layers retain distinct meanings |
| [Shahbazi Gravel Pit](projects/case-study-b/) | UAV/survey material, TLS previews, prepared meshes/contours, cameras and photography overlays | Demo coordinates and preview geometry; placeholders are not final survey products |
| [Base GUI](projects/base-gui/) | Shared interface, scene/environment and presentation authoring | Local studio/template context, not a scientific survey |

The developer reports comparing Utah FORGE visualizations with published scientific literature and obtaining a geophysics professional's review. Wannamaker et al. (2020), Figure 16, is a candidate reference; the exact paper, comparison record and review scope remain to be confirmed. This is reported qualitative evidence, not formal professional certification or engineering-grade validation. No MIT involvement is asserted.

## Engineering evidence and architecture

The application shell loads project manifests and page state; project-specific preparation supplies browser-ready scientific products; loaders feed the Three.js scene; editor controls author environment/page overrides; the presenter and capture systems consume that state.

| Area | Entry point |
| --- | --- |
| React application and project/page loading | [App.tsx](src/App.tsx), [loadPages.ts](src/pages/loadPages.ts) |
| Rendering, state and layer loading | [scene](src/scene/), [loaders](src/loaders/), [topography](src/topoMap/) |
| Authoring, presentation and capture | [editor](src/editor/), [pages](src/pages/), [presenter](src/presenter/), [capture](src/capture/) |
| Scientific source preparation | [prep](prep/), [computed-artifact pipeline](docs/dev-context/Computed-Artifact-Pipeline.md) |
| Tests, guards and CI | [tests](tests/), [tools](tools/), [GitHub Actions](.github/workflows/checks.yml) |
| Decisions, risks and agent context | [decisions](docs/03-decisions.md), [risk register](docs/risk-management/GeoSee-Risk-Register.md), [AGENTS.md](AGENTS.md), [active build context](docs/dev-context/Active-Build-Context.md) |

Concrete review trails include trace-header-driven seismic geometry and source gating; transition entity identity and interrupted-transition handling; and deterministic spline/capture sampling. Follow their source, tests and decision records rather than treating commit counts as proof of correctness. The risk register and requirements practices support development but do not constitute an audited QMS or regulatory approval.

Meaningful remaining engineering work includes extracting reusable scene/editor boundaries, defining cross-domain module contracts, improving browser regression coverage, bounding large-data memory use, resolving export parity and formalizing numerical registration/uncertainty verification.

## Rights and release status

The repository owner confirmed rights clearance for this release on 12 November 2026. Existing source attribution and provenance remain applicable. No software reuse licence has been selected or added; public visibility alone is not an open-source licence. Dataset terms are distinct from the application's code licence.

[Release verification](docs/GEODE-release-verification.md) records tested commands, failures and publication status. Historical internal-only descriptions document earlier development stages; this README describes the intended public GEODE presentation.
