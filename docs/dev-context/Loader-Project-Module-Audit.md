# Loader / Project Module Boundary Audit

## Purpose

This is a read-only audit for a future loader/project-module boundary refactor. It documents how project manifests, environment/page state, layer specs, loader dispatch, and scene registration currently flow through the app.

This pass does not change runtime behavior. It does not implement a loader registry, move loader code, refactor `SceneManager`, change page/schema files, change project manifests, change visibility, change rendering/material/depth behavior, change seismic or MT products, or alter source/generated data.

## Slice 1 implemented: registry shell only

Observed: Loader Registry Slice 1 adds `src/scene/layerLoaderRegistry.ts` and routes the existing `src/scene/layerLoaders.ts` ordered handler list through the registry shell.

Boundary: this is architecture scaffolding only. The public `loadLayerInto(spec, manager)` call shape remains the loader entry point, all handlers remain in `layerLoaders.ts`, handler order is intended to remain unchanged, and no project-module extraction, lazy loading, runtime load-policy behavior, SceneManager refactor, page/config/data change, or render/material/depth change is approved by this slice.

The audit recommendations below remain future guidance for later reviewed extraction slices.

## Slice 1B implemented: reference-stage extraction only

Observed: Loader Registry Slice 1B moves only `base-gui-reference-stage` and `utah-forge-reference-stage` handler definitions into project-module registration files.

Boundary: this satisfies the low-risk reference-stage sentinel extraction from the audit. It does not move Utah FORGE seismic, MT, scalar, volume, threshold, full-density, Shahbazi, Woodjam, public-context, terrain, or generic handlers. Future Utah/Shahbazi/Woodjam extraction remains review-dependent.

## Slice 1B verification note

Observed: historical bounded post-extraction evidence existed before the purge and was removed from reachable Git history. Fresh evidence should be captured if this audit is resumed.

Boundary: this is verification evidence only. It does not accept the extraction, prove full render equivalence, or authorize heavier Utah FORGE, Shahbazi, Woodjam, public-context, seismic, MT, scalar, volume, terrain, or lifecycle/disposal extraction.

## Current load flow

Observed flow:

```text
App/project selection
-> loadProject
-> project manifest/environment/pages
-> mountScene
-> SceneManager
-> register layer groups
-> loadLayerInto
-> ordered layerLoaders dispatch
-> concrete loader function
-> layer group registered/populated
-> manager.reapplyCurrentPageState
-> PageController applies environment, page visibility, page styles, page scene, and overlays
```

Details:

| Step | Observed code | Notes |
| --- | --- | --- |
| Project selection entry point | `src/App.tsx` | `openProject(projectSlug = DEFAULT_PROJECT_SLUG)` reads the selected slug from UI or the `?project=` URL query. |
| Project manifest/environment/pages loading | `src/pages/loadPages.ts` | `loadProject(projectSlug)` uses `getProjectPaths(projectSlug)`, fetches `project.json`, `environment.json`, and each page in `manifest.pageOrder`. |
| Project identity known | `src/App.tsx`, `src/pages/loadPages.ts`, `src/projects/projectPathsRuntime.ts` | `LoadedProject` keeps `projectSlug` and `projectRoot`. Project identity is known at app/editor level. |
| Project identity partly lost | `src/scene.ts`, `src/scene/layerLoaders.ts` | `mountScene(container, manifest.layers, overlays)` receives only layer specs and scene overlays. `loadLayerInto(spec, manager)` does not receive `projectSlug`. Project-specific behavior is therefore inferred mostly from layer IDs/types/files. |
| Page order usage | `src/pages/loadPages.ts`, `projects/*/project.json` | `manifest.pageOrder` drives the page JSON fetch order. |
| Scene mount | `src/App.tsx`, `src/scene.ts` | `App` dynamically imports `./scene` and calls `mountScene(containerRef.current, project.manifest.layers, overlays)`. |
| SceneManager creation | `src/scene.ts` | `mountScene` creates renderer, scene, camera, controls, and `new SceneManager(scene, renderer)`. |
| Layer registration | `src/scene.ts`, `src/scene/SceneManager.ts` | `mountScene` first calls `manager.registerLayer(spec.id)` for every manifest layer spec. |
| Layer dispatch | `src/scene.ts`, `src/scene/layerLoaders.ts` | `mountScene` then calls `loadLayerInto(spec, manager)` for every manifest layer spec. Dispatch uses the ordered `layerLoaders` array. |
| Concrete loader calls | `src/scene/layerLoaders.ts`, `src/loaders/**` | Handler branches call loader functions such as `loadSeismicBrowser`, `loadScalarVolume`, `loadMeshPreview`, `loadLineStrings`, `loadPointMarkers`, `loadTerrain`, and project-specific legacy loaders. |
| Layer group populated | `src/scene/layerLoaders.ts` | Each loader adds objects to the already-registered layer group through `context.onLoaded`. Seismic and scalar-volume `userData` are copied onto the layer group. |
| Visibility/style/page override application | `src/pages/PageController.tsx`, `src/pages/effective.ts`, `src/scene/SceneManager.ts` | `PageController` applies environment, effective visibility, effective styles, page scene, and scene overlays. Async-loaded layers trigger `manager.reapplyCurrentPageState()` when they finish. |
| Fallback behavior | `src/scene/layerLoaders.ts` | If no loader matches, the app logs `[scene] no loader matched layer ...`. This fallback behavior should be preserved until a reviewed missing-loader policy exists. |

## Files inspected

| File/path | Contribution to load flow |
| --- | --- |
| `src/App.tsx` | Project selection, `loadProject`, dynamic `mountScene`, `EditorProvider` project context, dev diagnostics wiring. |
| `src/scene.ts` | Scene/renderer/camera/control setup, `SceneManager` creation, layer registration, layer loading, scene overlays, `resolveDataPath` export. |
| `src/scene/layerLoaders.ts` | Current ordered loader dispatch, generic type/file handlers, project/id-specific handlers, path resolution, async load callback. |
| `src/scene/SceneManager.ts` | Layer group storage, visibility/style/page/environment reapplication, material/style mutation, scene diagnostics state. |
| `src/loaders/**` | Concrete loader implementations called by `layerLoaders.ts`. Only import/call boundaries were inspected. |
| `src/projects/projectCatalogRuntime.ts` | Runtime project catalog and default project slug. |
| `src/projects/projectPathsRuntime.ts` | Asset URL/project path resolution. |
| `src/pages/loadPages.ts` | Runtime project manifest/environment/page fetching. |
| `src/pages/PageController.tsx` | Environment/page composition and style/visibility application after scene mount. |
| `src/pages/effective.ts` | Effective page/environment inheritance model for visibility and styles. |
| `projects/*/project.json` | Current layer IDs, layer types, files/previewFiles, and page order. |
| `projects/*/environment.json` | Default visibility/style and scene environment evidence. |
| `projects/*/pages/` | Page-level visibility/style/scene override evidence. |
| `docs/dev-context/Runtime-Loading-Policy.md` | Existing staged loading-policy design and guardrails. |
| `docs/dev-context/Project-Load-Class-Table.md` | Layer/load-class review evidence. |
| `test-results/project-artifact-coverage/project-artifact-coverage.md` | Current project layer counts, wrapper coverage, and layer family signals when regenerated. |
| `docs/dev-context/Render-Quality-Checks.md` | Render/computed-artifact risk categories and verification expectations. |
| `docs/dev-context/Computed-Artifact-Pipeline.md` | Raw-to-computed artifact guardrail. |
| `projects/utah-forge/artifact_metadata/index.json` | Utah FORGE wrapper/index evidence for MT and seismic artifacts. |
| `projects/utah-forge/DATA_LAYER_STATUS.md` | Utah FORGE project-local artifact/layer status evidence. |

## Current loader dispatch shape

`src/scene/layerLoaders.ts` currently dispatches by walking an ordered `layerLoaders` array and picking the first handler whose `matches(spec)` returns true.

Shared mechanics:

- `layerFiles(spec)` prefers `spec.previewFiles`, then `spec.files`, then `{}`.
- `resolveDataPath(path)` strips leading slashes and a leading `data/`, then resolves through `appAssetUrl`.
- Some handlers use `fileOrLegacyPath` to support older implicit paths such as `/data/roads.geojson`.
- `layerGeoTransform(spec)` derives transform options from `spec.metadata`.
- Loader completion calls `context.onLoaded(obj)`, which adds the object to the registered layer group and reapplies the current page state.
- Seismic and scalar-volume loader outputs copy key `userData` onto the layer group.

Current dispatch shapes include:

| Shape | Examples | Notes |
| --- | --- | --- |
| Generic type/file cases | `seismic-browser`, `scalar-volume`, `pointcloud-preview`, `pointcloud-preview-tiles`, `mesh-preview`, `point-markers`, `geotiff-terrain` | Matched by `spec.type` plus expected manifest/file key. These are good candidates for a generic registry slice. |
| Project/id-specific cases | `utah-forge-phase3-working-area`, `case-study-b-demo-shell`, `shahbazi-split-surface-preview`, `drillholes-2023`, `drillholes-2024-tf` | Matched by exact layer ID and tied to project-specific layer semantics. |
| Hybrid/legacy public context cases | `transport-roads`, `hydrography-streams`, `hydrography-lakes`, `power-lines`, `property-neighbors`, `bedrock-geology`, `claim-boundary`, `trees-vri` | Generic real-world families, but currently implemented through exact IDs, legacy paths, and project-specific assumptions. |
| Placeholder/editor cases | `empty-editor-layer`, `base-gui-reference-stage`, `utah-forge-reference-stage` | Some are no-op/virtual layers or reference stages. Ownership needs review before moving. |
| Fallback | no matching handler | Logs a warning and does not add layer objects. Preserve this behavior during any first registry slice. |

## Generic loader candidates

These cases likely should remain generic if a loader registry is introduced.

| Candidate | Current case/matcher | Files/functions involved | Why generic | Risk if moved incorrectly |
| --- | --- | --- | --- | --- |
| Seismic browser products | `spec.type === "seismic"` with `files.seismicManifest` | `src/scene/layerLoaders.ts`, `src/loaders/loadSeismicBrowser.ts` | The handler is manifest-driven and not hard-coded to one Utah layer ID. | Utah FORGE Phase 3 seismic browser could silently fail, lose product state, or lose `userData` copied to the layer group. |
| Scalar volumes | `spec.type === "volume"` with `files.scalarVolumeManifest` | `src/loaders/loadScalarVolume.ts` | The handler is manifest-driven and generic for render-ready scalar volumes. | MT scalar-volume raymarch/sampling/userData behavior could break. |
| Point cloud preview | `spec.type === "pointcloud"` with `files.preview` | `src/loaders/loadPointCloudPreview.ts` | Preview point clouds are a common layer type. | Shahbazi/other point previews could disappear or lose transform/style behavior. |
| Tiled point cloud preview | `spec.type === "pointcloud"` with `files.previewTiles` | `src/loaders/loadTiledPointCloudPreview.ts` | Tile manifests/tiles are generic high-fidelity artifacts when manifest contracts match. | Utah FORGE MT full-density tile loading could break or be misclassified as disposable bloat. |
| Mesh preview | `spec.type === "mesh"` with `files.meshPreview` | `src/loaders/loadMeshPreview.ts` | Mesh previews are project-agnostic when the manifest contract is sufficient. | Shahbazi/Utah mesh previews could lose material/depth behavior if separated from special cases incorrectly. |
| Point markers | `spec.type === "point"` with `files.geojson` | `src/loaders/loadPointMarkers.ts` | Station/marker GeoJSON is generic enough as a base handler. | MT stations or public markers could lose labels/styles/transforms. |
| Terrain | `spec.type === "geotiff"` with `files.raster` | `src/loaders/loadTerrain.ts`, `geoTransformOptionsFromMetadata` | Terrain/raster loading is a generic asset family. | Terrain alignment, transform metadata, and visual base could break across projects. |
| Scene overlays | `loadSceneOverlays` in `src/scene.ts` | `src/scene.ts` and overlay loader paths | Overlay loading is separate from layer dispatch and already generic by overlay manifest. | Moving it into a layer registry too early could conflate scene overlays with manifest layers. |

## Project-specific loader candidates

### Utah FORGE

| Candidate | Current code branch | Loader/function used | Files touched today | Why project-specific | Must-preserve behavior | Render/data risks |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 3 working area | `utah-forge-phase3-working-area` exact ID | `loadUtahForgePhase3WorkingArea` internal helper in `layerLoaders.ts` | `src/scene/layerLoaders.ts` | Tied to Utah-specific Phase 3 bounds/metadata and working-area semantics. | Boundary/area display, scene-bounds metadata, line style/order. | Boundary could disappear or imply wrong spatial frame; context for MT/seismic pages weakens. |
| Utah reference stage | `utah-forge-reference-stage` exact ID | `loadReferenceStage("Utah FORGE reference stage")` | `src/scene/layerLoaders.ts` | Project-specific reference placeholder. | Reference-stage visibility and no data side effects. | Low render risk, but should not become generic proof of a real artifact. |
| Phase 3 seismic browser | `seismic-browser` generic type/file branch | `loadSeismicBrowser(files.seismicManifest)` | `src/scene/layerLoaders.ts`, `src/loaders/loadSeismicBrowser.ts` | Handler is generic, but current primary product is Utah FORGE Phase 3. | Seismic remains needed/underway; product manifest, section/raymarch behavior, loader `userData`, page/style controls. | Any registry change could hide/deprioritize seismic, break product selection, or lose render controls. |
| MT scalar volume | `scalar-volume` generic type/file branch | `loadScalarVolume(files.scalarVolumeManifest)` | `src/scene/layerLoaders.ts`, `src/loaders/loadScalarVolume.ts` | Handler is generic, but current volume is Utah MT computed artifact. | Scalar/raymarch metadata, masks, transfer function, group `userData`, page reapply after async load. | Sampling, scalar range, opacity, or technical credibility could regress. |
| MT full-density tiled data | `pointcloud-preview-tiles` generic type/file branch | `loadTiledPointCloudPreview(files.previewTiles)` | `src/scene/layerLoaders.ts`, `src/loaders/loadTiledPointCloudPreview.ts` | Generic tile contract, but Utah MT high-fidelity role is project-specific. | Do not treat density/tiles as bloat; preserve tile manifest and style path. | Loss of full-density technical credibility or accidental default/load-policy change. |
| MT stations and public context | `point-markers`, public-context exact-ID branches | `loadPointMarkers`, `loadRoads`, `loadStreams`, `loadLakes` | `src/scene/layerLoaders.ts`, public context loaders | Station markers are generic by type; public context layer IDs overlap with Woodjam naming. | Station network visibility/style, road/hydro context, coordinate transforms. | Wrong transforms or public context dominance can damage spatial credibility. |

### Shahbazi / Case Study B

| Candidate | Current code branch | Loader/function used | Files touched today | Why project-specific | Must-preserve behavior | Render/data risks |
| --- | --- | --- | --- | --- | --- | --- |
| Demo quarry shell | `case-study-b-demo-shell` exact ID | `loadDemoQuarry()` | `src/scene/layerLoaders.ts`, `src/loaders/loadDemoQuarry.ts` | Case Study B demo shell is project/demo-specific. | Demo shell/object presence where pages expect it. | Could disappear from investor-style pages. |
| Split TLS surface preview | `shahbazi-split-surface-preview` exact ID | Two `loadMeshPreview` calls with `SURFACE_RENDER_ORDER` and `depthPolicy` | `src/scene/layerLoaders.ts`, `src/loaders/loadMeshPreview.ts`, `src/loaders/surfaceRenderPolicy.ts` | Combines outer surface and TLS surface with Shahbazi-specific semantics. | Depth-occluding preview, render order, combined surface grouping, material/depth behavior. | Very high risk to surface/photo depth policy and visual polish. |
| Tie-point support isolines | `shahbazi-tie-point-support` exact ID | `loadMeshPreview` + `loadLineStrings` | `src/scene/layerLoaders.ts`, mesh/line loaders | Computed support isolines tied to Shahbazi QA/status. | Mesh/line combination and isoline fidelity. | Computed isoline/mesh relationship could be lost or misrepresented. |
| Split contours | `shahbazi-split-contours` exact ID | Multiple `loadLineStrings` calls for `outerGeojson` and `geojson` | `src/scene/layerLoaders.ts`, `src/loaders/loadLineStrings.ts` | Specific split outer/inner contour product contract. | Contour fidelity, combined grouping, order, style application. | Contours could be simplified, hidden, or lose presentation quality. |
| Photo overlay preview | `shahbazi-photo-overlay-preview` exact ID | `loadPhotoOverlayPreview(files.manifest)` | `src/scene/layerLoaders.ts`, `src/loaders/loadPhotoOverlayPreview.ts` | Currently Shahbazi-specific, though manifest-driven overlay loading could become generic later. | Surface/photo alignment and depth/material behavior. | High risk to visual credibility and photo/surface overlay depth policy. |
| Camera/path QA layers | `shahbazi-camera-poses`, `shahbazi-dense-matching-links`, `shahbazi-camera-frustums` exact IDs | `loadCameraFlightPath`, `loadCameraFrustums` | `src/scene/layerLoaders.ts`, camera loaders | Shahbazi-specific QA/presentation support. | Camera pose/frustum/path evidence. | Could lose QA/provenance context. |

### Woodjam

| Candidate | Current code branch | Loader/function used | Files touched today | Why project-specific | Must-preserve behavior | Render/data risks |
| --- | --- | --- | --- | --- | --- | --- |
| 2023 drillholes with assay split | `drillholes-2023` exact ID | `loadDrills`, then move assay objects into `assay-samples` layer | `src/scene/layerLoaders.ts`, `src/loaders/loadDrills.ts` | Coupled to Woodjam layer IDs and assay companion layer. | Drill trace rendering, assay child migration, `assay-samples` grouping. | Assays can disappear or duplicate if lifecycle/order changes. |
| Empty editor layers | `assay-samples` and `area-outlines` exact IDs | no-op handler | `src/scene/layerLoaders.ts` | Placeholder layers for Woodjam/editor state. | No-op behavior and no warning noise for expected virtual layers. | Could become noisy warnings or unexpected objects. |
| 2024 technical layers | `drillholes-2024-tf`, `ez-gamma-2024`, `geochem-soils-2024`, `ip-survey-lines-2024`, `hyperspectral-coverage-2024`, `imagery-lidar-aoi-2024` exact IDs | Woodjam-specific loaders | `src/scene/layerLoaders.ts`, corresponding `src/loaders/*` | Exact layer IDs and loader semantics are Woodjam/project-program specific. | Drill/collar/geochem/IP/hyperspectral/imagery data visual behavior. | Reference project regression or missing technical layers. |
| Target/anomaly layers | `three-firs-target`, `great-plains-target`, `megaton-dcip-anomaly` exact IDs | `loadThreeFirsTarget`, `loadGreatPlainsTarget`, `loadMegatonDcipAnomaly` | `src/scene/layerLoaders.ts`, target/anomaly loaders | Woodjam-specific target/anomaly objects. | Target/anomaly positions and styles. | Project story/context could degrade. |
| Public/context/geology layers | `bedrock-geology`, `claim-boundary`, `hydrography-*`, `transport-roads`, `power-lines`, `property-neighbors`, `trees-vri` exact IDs | context/geology loaders with legacy fallbacks | `src/scene/layerLoaders.ts`, public context loaders | Names are generic, but current branches assume specific file names/assets. | Context transforms, public layer styles, fallback paths. | High risk of cross-project path/transform mistakes if generalized hastily. |

### Base GUI

| Candidate | Current code branch | Loader/function used | Files touched today | Why project-specific | Must-preserve behavior | Render/data risks |
| --- | --- | --- | --- | --- | --- | --- |
| Base reference stage | `base-gui-reference-stage` exact ID | `loadReferenceStage("Base GUI reference stage")` | `src/scene/layerLoaders.ts` | Base GUI reference placeholder. | Project should still open with reference stage. | Low data risk, but useful first candidate for registry wiring because behavior is simple. |

## Ambiguous cases

| Case | Why ambiguous | Missing evidence | Safest recommendation |
| --- | --- | --- | --- |
| Public context layers | Roads, hydrography, power lines, boundaries, property neighbors, trees, and geology are generic concepts, but current code uses exact IDs, legacy fallback paths, and sometimes transform metadata. | Whether these should become generic `type: vector` handlers or remain project modules with shared helper loaders. | Do not generalize in the first slice. Preserve exact behavior, then design a generic vector/public-context contract later. |
| Seismic browser | Current handler is generic by `type: seismic`, but current active product family is Utah FORGE. | Whether other projects will use the same manifest/product contract. | Keep handler generic, but register it with diagnostics-friendly name and Utah verification coverage. |
| Scalar volume | Current handler is generic by `type: volume`, but Utah MT volume is high-fidelity and acceptance-sensitive. | Whether the manifest schema is stable for future scalar volumes. | Keep generic, preserve group `userData` and `reapplyCurrentPageState`, require Utah verification. |
| Point-cloud tiles | Generic tile manifests are plausible, but Utah MT full-density has special load/default-policy risk. | Whether all point-cloud tile manifests have the same units/scalar expectations. | Keep generic, do not change load policy, require full-density visual/resource checks. |
| Shahbazi photo overlay preview | It is manifest-driven, but exact ID and surface/photo depth relationship are Shahbazi-specific today. | Whether photo overlays will become a generic render-ready artifact family. | Leave in Shahbazi module until a generic overlay contract is reviewed. |
| `empty-editor-layer` | No-op virtual layers could be a generic layer family, but current IDs are Woodjam-specific. | Whether other projects need intentional no-op manifest layers. | Treat as Woodjam-specific first; consider generic virtual layer later. |
| Reference stages | Base GUI and Utah reference stages use the same helper but exact IDs. | Whether project manifests should express a generic reference-stage type. | Safe first registry candidate, but do not expand semantics in the same slice. |

## Proposed future file structure

Recommended future structure, not implemented in this pass:

```text
src/scene/layerLoaderRegistry.ts
src/scene/registerGenericLayerLoaders.ts
src/projectModules/utahForge/registerUtahForgeLoaders.ts
src/projectModules/shahbazi/registerShahbaziLoaders.ts
src/projectModules/woodjam/registerWoodjamLoaders.ts
src/projectModules/baseGui/registerBaseGuiLoaders.ts
```

Generic registrations should own stable manifest/type/file handlers:

- seismic browser manifest
- scalar volume manifest
- mesh preview
- pointcloud preview
- tiled pointcloud preview
- point markers
- terrain/geotiff

Project modules should own exact-ID branches, project constants, special multi-loader compositions, project-specific reference stages, and legacy/path compatibility that should not leak into generic dispatch.

## Proposed future API

Smallest stable API to preserve current behavior:

```ts
type LayerLoaderHandler = {
  id: string;
  match: (spec: ProjectLayerSpec, context: LayerLoaderMatchContext) => boolean;
  load: (context: LayerLoadContext) => void;
};

loadLayerInto(spec, manager)
```

Registry design notes:

- Preserve the current external call shape if possible: `loadLayerInto(spec, manager)`.
- Preserve ordered dispatch. First match wins, matching current `layerLoaders.find(...)` behavior.
- Include handler IDs in diagnostics/logs for future auditability.
- Include project identity in the match context only after confirming where `projectSlug` can be passed without touching unrelated scene behavior.
- Preserve fallback warnings for unmatched layers.
- Preserve `previewFiles` over `files` precedence.
- Preserve `fileOrLegacyPath` compatibility until project manifests are reviewed.
- Preserve `onLoaded` behavior, especially seismic/scalar-volume `userData` copying and `manager.reapplyCurrentPageState()`.

## Touch map for future implementation

| Path | Classification | Reason |
| --- | --- | --- |
| `src/scene/layerLoaders.ts` | Required | Current dispatch lives here; first implementation should delegate to a registry while preserving `loadLayerInto`. |
| `src/scene/layerLoaderRegistry.ts` | Required / future new file | Registry type, ordered handlers, registration helpers, fallback behavior. |
| `src/scene/registerGenericLayerLoaders.ts` | Likely / future new file | Keeps generic type/file handlers separate from project modules. |
| `src/projectModules/utahForge/registerUtahForgeReferenceLoaders.ts` | Required / implemented | Holds only the Utah FORGE placeholder reference-stage handler after Slice 1B; real Utah seismic/MT/data handlers remain in `layerLoaders.ts`. |
| `src/projectModules/utahForge/registerUtahForgeLoaders.ts` | Likely future | Holds Utah exact-ID/special handlers after additional review. |
| `src/projectModules/shahbazi/registerShahbaziLoaders.ts` | Likely | Holds Shahbazi surface/contour/photo/camera special handlers. |
| `src/projectModules/woodjam/registerWoodjamLoaders.ts` | Likely | Holds Woodjam drillhole/assay/technical/context exact-ID handlers. |
| `src/projectModules/baseGui/registerBaseGuiLoaders.ts` | Required / implemented | Simple Base GUI reference-stage handler moved in Slice 1B. |
| `src/projects/projectCatalogRuntime.ts` | Maybe | Only if project module lookup is tied to catalog slugs. Avoid if registry can be composed without catalog changes. |
| `src/projects/projectPathsRuntime.ts` | Maybe | Should not be touched unless project identity/path context must be formalized for loaders. |
| `src/scene.ts` | Maybe | Only if `projectSlug` or project module registration must be passed into `mountScene`. Avoid changing scene behavior. |
| `src/App.tsx` | Should avoid | App already knows project identity and calls `mountScene`; avoid changes unless project identity must be passed. |
| `src/scene/SceneManager.ts` | Should avoid | Style/visibility/page/environment behavior is sensitive; registry refactor should not require changes here. |
| `src/loaders/**` | Should avoid | Concrete loaders should be reused without behavior changes; only import/export cleanup if absolutely required. |
| `src/pages/**` | Should avoid | Page/environment composition should remain unchanged for loader registry slice. |
| `projects/**` | Should not touch | No manifest, environment, page, data, or generated artifact change should be needed for registry implementation. |
| `prep/**` | Should not touch | Loader boundary refactor is app/runtime code only. |

## Behavior preservation checklist

Future implementation must preserve:

- same manifest layers load
- same layer registration order where relevant
- same loader dispatch order or an explicitly verified equivalent
- same fallback warning behavior for unmatched layers
- same `previewFiles` / `files` / `path` / legacy fallback resolution
- same `appAssetUrl` project asset path resolution
- same geo transform metadata handling
- same async completion behavior
- same `manager.reapplyCurrentPageState()` after layer load completion
- same seismic browser group `userData` behavior
- same scalar-volume group `userData` behavior
- same environment default visibility
- same page visibility overrides
- same page style overrides
- same material/depth/render order behavior
- same surfaceRenderPolicy usage for Shahbazi surfaces
- same Utah seismic browser behavior
- same Utah MT full-density/slice/threshold/scalar-volume/top-surface behavior
- same Shahbazi surface/photo/point/contour behavior
- same Woodjam drill/assay/context behavior
- same Base GUI reference behavior
- same build result

## Render/computed-artifact risks

| Area | Risk |
| --- | --- |
| Seismic | Loader registry must not hide, park, filter, or deprioritize seismic. Preserve Phase 3 browser manifest loading, product handling, section/raymarch paths, page controls, and `userData`. |
| MT slices | Slice layer dispatch/style must remain intact; do not change scalar range, color ramp, legend, opacity, or page state. |
| MT full-density | Tiled point-cloud loader must preserve tile manifests, point/scalar buffers, transforms, and high-fidelity role. Do not reclassify as junk or force lazy loading. |
| Scalar volume | Preserve manifest, mask/volume assets, sampling/raymarch behavior, style application, and render-quality checks. |
| Threshold surfaces | Preserve mesh preview dispatch, threshold semantics, material/opacity behavior, and caveats. |
| Top surface | Preserve preview/support-surface role and avoid implying measured terrain/geology unless evidence supports it. |
| Shahbazi TLS/surface/photo overlays | Highest risk from render order/depth policy changes. Preserve `SURFACE_RENDER_ORDER`, `depth-occluding-preview`, and photo overlay alignment. |
| Shahbazi contours/isolines | Preserve multi-file line combination and contour fidelity. |
| Woodjam technical/context layers | Preserve drill/assay split, technical layer IDs, geology/context loaders, and default visibility behavior. |
| Terrain/vector/public context | Preserve transforms, fallback paths, line/material styles, and page-level styling. |
| SceneManager style reapplication | Async loaders rely on `reapplyCurrentPageState`; losing it can cause loaded layers to ignore current page visibility/styles. |

## Verification plan for future implementation

After a future refactor, run:

- `npm run build`
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge`
- `node tools/report-project-artifact-coverage.mjs`
- Utah FORGE open/diagnostics check
- Utah FORGE MT/seismic screenshot comparison if feasible
- Shahbazi / Case Study B open smoke check if feasible
- Woodjam open smoke check if feasible
- Base GUI open smoke check if feasible
- verify no project config/page/environment/data/prep files changed
- compare dev diagnostics layer counts before/after if available
- inspect console warnings for new unmatched layers
- confirm seismic and scalar-volume layer `userData` still powers controls/styles

## Recommended implementation slices

| Slice | Expected files touched | Risk | Verification |
| --- | --- | --- | --- |
| 1. Create registry shell while preserving `loadLayerInto(spec, manager)` | `src/scene/layerLoaders.ts`, new `src/scene/layerLoaderRegistry.ts` | Implemented / needs review | Build, project coverage, Utah metadata validation, and later open/smoke checks. No handlers were moved. |
| 2. Move Base GUI/reference-stage handlers | Registry files, `src/projectModules/baseGui/registerBaseGuiLoaders.ts`, `src/projectModules/utahForge/registerUtahForgeReferenceLoaders.ts` | Implemented / needs review | Build, Utah metadata validation, coverage report, and later Base GUI/Utah open checks. |
| 3. Move Utah FORGE-specific handlers | Registry files, `src/projectModules/utahForge/registerUtahForgeLoaders.ts` | High | Build, Utah open/diagnostics, MT/seismic screenshot, validate wrappers, check Phase 3 seismic and MT full-density/slices/volume/threshold. |
| 4. Move Shahbazi-specific handlers | Registry files, `src/projectModules/shahbazi/registerShahbaziLoaders.ts` | High | Build, Shahbazi open/screenshot, check surface/photo depth, contours, camera QA layers. |
| 5. Move Woodjam-specific handlers only if truly project-specific | Registry files, `src/projectModules/woodjam/registerWoodjamLoaders.ts` | Medium/High | Build, Woodjam open, check drillhole/assay split and context/geology layers. |
| 6. Build and run smoke checks | No new code beyond previous slices | Medium | Run all checks above and document before/after. |
| 7. Only after that consider lifecycle/disposal contract | Future lifecycle files, maybe `SceneManager` | High | Separate prompt; requires render/resource diagnostics and visual regression checks. |

## Do not do yet

- no lazy loading
- no SceneManager split
- no editor split
- no presenter/editor route split
- no load policy enforcement
- no page/schema changes
- no project manifest/environment/page changes
- no data/prep changes
- no render/material/depth changes
- no scalar range/color ramp changes
- no seismic product filtering
- no MT product simplification
- no computed-artifact simplification
- no external control-plane implementation

## Summary recommendation

Recommended next implementation prompt title:

`Implement Loader Registry Slice 1B: Extract Base GUI / Reference-Stage Handlers Only`
