# Code Map

Last populated: 2026-05-15

## App Shape

| Area | Observed role | Status | Evidence |
| --- | --- | --- | --- |
| `package.json` | Vite/TypeScript/Playwright scripts and React/Three/geotiff/marked dependencies | Observed | `dev`, `build`, `test:e2e`, `test:utah-forge` |
| `vite.config.ts` | React plugin, dev author-write plugin, build-time data/project copy plugins, manual chunks | Observed | `authorWritePlugin`, `copyRuntimeDataPlugin`, `copyProjectsPlugin`, `manualChunks` |
| `src/App.tsx` | Landing/project selection and lazy-loading of editor chrome and scene module | Observed | `lazy`, `Suspense`, dynamic `import("./scene")` |
| `src/projects/` | Runtime project catalog/path resolution | Observed | `projectCatalogRuntime.ts`, `projectPathsRuntime.ts` |
| `src/pages/` | Page types, page loading, effective page/environment state, camera tweening | Observed | `types.ts`, `loadPages.ts`, `PageController.tsx` |
| `src/presenter/` | Presenter logo and overlay display components | Observed | `PresenterLogo.tsx`, `OverlayDisplay.tsx` |
| `src/ui/` | Shared presenter/editor UI, legends, labels, HUD controls | Observed | MT/seismic/section legends and nav controls |

## Scene / Loader Surface

| Area | Observed role | Status | Notes |
| --- | --- | --- | --- |
| `src/scene.ts` | Mounts Three.js scene, registers layers, delegates loading, applies page/environment behavior | Observed | Calls `loadLayerInto(spec, manager)` |
| `src/scene/SceneManager.ts` | Central runtime manager for scene layers, environment, styles, scalar/seismic rendering, sectioning, transitions, helpers, overlays | Observed | About 8,886 lines |
| `src/scene/layerLoaders.ts` | Loader registry; resolves `previewFiles` before `files`; contains generic and project-specific loader cases | Observed | Utah FORGE, Base GUI, Shahbazi, seismic, scalar-volume, point/mesh/terrain cases |
| `src/scene/disposeObjectTree.ts` | Disposes geometries, materials, and material maps for object trees | Observed | Existing disposal helper |
| `src/loaders/` | Individual loaders for terrain, lines, point clouds, tiled point clouds, meshes, scalar volumes, seismic browser, Shahbazi previews, Woodjam public data | Observed | 32 loader/helper files |
| `src/loaders/surfaceRenderPolicy.ts` | Named surface/photo render policies for fragile preview depth behavior | Observed | Referenced by docs and loaders |

## Editor Surface

| Area | Observed role | Status | Notes |
| --- | --- | --- | --- |
| `src/editor/EditorContext.tsx` | Project/editor state, dirty/save state, pages, environment, overlays, scene handle | Observed | About 52 KB |
| `src/editor/EditorChrome.tsx` | Loaded app shell around scene/editor/presenter controls, legends, overlay display | Observed | Includes Utah FORGE MT/seismic constants |
| `src/editor/EditorRoot.tsx` | Top-level editor shell and section layout | Observed | About 35 KB |
| `src/editor/LayerPanel.tsx` | Main layer controls, including specialized project controls | Observed | About 12,913 lines |
| `src/editor/EnvironmentScenePanel.tsx` | Environment/background/lighting/fog/grid/GUI controls | Observed | About 3,763 lines |
| `src/editor/PagePanel.tsx` | Page controls and page operations | Observed | About 61 KB |
| `src/editor/save.ts` | Save helpers | Observed | Sequential save is documented as non-transactional |

## Observed Hotspots

| Hotspot | Status | Evidence | Scope posture |
| --- | --- | --- | --- |
| `SceneManager.ts` responsibility breadth | Observed | File size and many scalar/seismic/section/style responsibilities | NEXT candidate, not current task |
| `LayerPanel.tsx` size and specialized controls | Observed | About 12,913 lines | NEXT candidate, not current task |
| `EnvironmentScenePanel.tsx` size | Observed | About 3,763 lines | NEXT candidate, not current task |
| Project-specific loader cases in `layerLoaders.ts` | Observed | Utah FORGE, Shahbazi, Base GUI, seismic cases | NEXT candidate, not current task |
| Heavy Utah FORGE route/test surface | Observed | Smoke test covers public context, seismic, MT full-density, volume, threshold surfaces, sectioning, legend | Stabilization evidence, not refactor instruction |
| Bundle/performance pressure | Observed | Manual chunks, editor lazy-load, large modules, full-density/seismic assets | NOW measurement candidate |
| Layer disposal/memory risk | Observed | Existing disposal helper plus heavy dynamic layer/overlay behavior | NOW audit candidate; implementation later |

## Architecture Inputs Recorded, Not Implemented

- Observed: Project-specific loader isolation has evidence in `src/scene/layerLoaders.ts`.
- Observed: SceneManager split has evidence in `src/scene/SceneManager.ts`.
- Observed: Editor module split has evidence in `src/editor/LayerPanel.tsx` and `src/editor/EnvironmentScenePanel.tsx`.
- Observed: Lightweight presenter route is a candidate because presenter behavior exists inside the loaded app/editor chrome.
- Observed: Page-level lazy loading is a candidate, but only editor chrome lazy-loading is currently observed.
- Observed: Bundle inspection can be done without code changes because Vite chunks and large modules are visible.
- Observed: Layer disposal/memory contract can be audited from current helper and SceneManager behavior before any refactor.
