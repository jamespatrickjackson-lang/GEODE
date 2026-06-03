# Current State

## Authority

- Observed: This file is a docs/dev-context population record, not accepted scope, not app runtime, and not official DHF.
- Observed: Deterministic state lives in source files, project manifests, generated data artifacts, tests, and explicit human acceptance records.
- Observed: Current project files and generated artifacts are the authority for runtime/data state.

## Current Human Priority

- Observed: Current priority is GeoVox data/system/app structural refinement before further implementation.
- Observed: Current operating mode is software-build mode. Normal work should start from the requested subsystem and current source/project files, not from stale staged-intake traces.
- Observed: Add to Project remains a dormant UI surface. It should only steer agent work when the human explicitly resumes it.
- Observed: External control-plane implementation is parked for now and should not be implemented in the app during this refinement step.
- Observed: Seismic is needed and underway; do not assume seismic should be parked, hidden, removed, or downgraded.
- Observed: Rendering beauty and high-quality client-data visualization are non-negotiable.
- Observed: Bloat reduction means reducing structural confusion, not simplifying visuals, weakening rendering, or reducing rich datasets to thin visual products.
- Observed: Computed artifact generation is explicitly protected; isolines, isobands, contours, heat maps, scalar slices, scalar volumes, threshold surfaces, seismic products, meshes, point-cloud tiles, legends, and provenance/status wrappers are core GeoVox capabilities.
- Observed: Updated time-pressure/demo goals will arrive later; scope remains under refinement and is not locked.
- Observed: `Data-System-App-Refinement-Plan.md` records the current proposed structural refinement plan.
- Observed: Old conceptual control-plane notes are not active app scope.

## Staged-Intake State

- Observed: Staged-intake records, review-route artifacts, old compatibility aliases, and pre-canonical planning notes were purged from active context.
- Observed: The retained Add to Project UI is only a dormant staging surface until explicitly resumed.
- Unverified / needs human review: Any future generalized intake model must be re-specified from current needs rather than old traces.

## What Is Real Now

| Claim | Status | Evidence |
| --- | --- | --- |
| GeoSee is currently a Vite + React + TypeScript + Three.js app. | Observed | `package.json`, `src/App.tsx`, `docs/02-architecture.md` |
| The app is multi-project, with folders for Woodjam, Shahbazi / Case Study B, Utah FORGE, and Base GUI. | Observed | `projects/`, `src/projects/projectCatalogRuntime.ts`, `docs/START-HERE.md` |
| Authoring uses project manifests, environment JSON, page JSON, overlays, and project-local data. | Observed | `projects/*/project.json`, `projects/*/environment.json`, `projects/*/pages/`, `projects/*/overlays/` |
| Local authoring writes are implemented through a dev-only Vite plugin; static builds copy runtime data/projects. | Observed | `vite.config.ts`, `plugins/vite-plugin-author-write.ts` referenced by `CLAUDE.md` |
| Editor chrome is lazy-loaded after project selection. | Observed | `src/App.tsx`, `docs/02-architecture.md`, `CHANGELOG.md` |
| Layer loading is centralized through `src/scene/layerLoaders.ts`, with `previewFiles` preferred over legacy `files`. | Observed | `src/scene/layerLoaders.ts`, `src/pages/types.ts` |
| Woodjam remains a real/reference project with public terrain, drilling, geochem, geology, hydrography, roads, and related layers. | Observed | `projects/woodjam/project.json`, `docs/woodjam/` |
| Shahbazi Gravel Pit / Case Study B has source-derived preview layers plus placeholder/future targets. | Observed | `projects/case-study-b/project.json`, `projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md` |
| Utah FORGE manifests now include Phase 3 MT, public context, scalar volume/threshold/top-surface records, and a Phase 3 seismic browser record. | Observed | `projects/utah-forge/project.json`, `projects/utah-forge/environment.json` |
| Utah FORGE verification is split across runtime validators, presentation snapshot checks, and focused browser suites. | Observed | `tools/validate-utah-derived-assets.mjs`, `tools/validate-utah-presentation-snapshot.mjs`, `tests/utah-forge/`, `package.json` |
| A layer/artifact/computed-artifact classification matrix now exists for Utah FORGE, Case Study B / Shahbazi, and Woodjam. | Observed | `docs/dev-context/Layer-Artifact-Classification.md` |
| A computed-artifact pipeline guardrail now exists and explicitly protects raw-to-derived analytical/render-ready output generation. | Observed | `docs/dev-context/Computed-Artifact-Pipeline.md` |
| Utah FORGE now has a project-local data/layer status guide. | Observed | `projects/utah-forge/DATA_LAYER_STATUS.md`; covers source/client/archived, processed/browser-ready, render-ready, QA/validation, provenance/status wrappers, MT, seismic, public context, and unclear/future artifacts; docs only, no runtime behavior change. Created 2026-05-26 after earlier session entries incorrectly listed this as already present. |
| Public topo map is the first global toolset pattern. | Observed | `src/topoMap/`, `src/editor/topoMap/`, `docs/dev-context/Global-Toolset-Structure.md`, `tests/topo-map/` |
| Topo Environment is now grouped under Topo with Scene atmosphere, Clouds, Sun, and Fog. | Observed | `src/editor/topoMap/TopoMapPanel.tsx`, `src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx`, `docs/dev-context/Topo-Editor-Panel-Audit-2026-06-03.md` |
| Local clouds/mist are `atmosphere-volume` environmental layers with generated-canvas sprite puffs, no external asset, no `Data3DTexture`, and no global fog mutation path. | Observed | `src/scene/atmosphere/`, `src/scene/layerLoaders.ts`, `src/scene/styles/atmosphereVolumeStyle.ts`, `tests/tools/local-atmosphere-volume-source.test.mjs` |
| Utah FORGE has an intentionally visible one-puff Topo test cloud for current visual review. | Observed + human accepted in thread | `projects/utah-forge/project.json`, `projects/utah-forge/environment.json`, `projects/utah-forge/pages/12_mt_volume_overview.json`, `tests/tools/topo-cloud-authoring-source.test.mjs` |
| Sun authoring now separates terrain light source, visible sky orb, halo, and source marker. | Observed | `src/scene/environment/sunVisual.ts`, `src/scene/environment/applyEnvironment.ts`, `tests/tools/topo-environment-sun-source.test.mjs` |
| Cinematic page motion and post-processing transitions are active build surfaces. | Observed | `src/pages/dynamicCameraPose.ts`, `src/scene/transitions/cinematicSceneTransitions.ts`, `docs/rendering/cinematic-render-presets.md`, `tests/topo-map/cinematicCameraMotion.spec.ts` |
| MT resistivity now has product-aware transition handling for sectioned scalar volumes, section ISO overlays, and threshold boundaries. | Observed | `src/scene/SceneManager.ts`, `tests/utah-forge/mt-rendering.spec.ts`, `docs/dev-context/Global-Toolset-Structure.md` |
| Editor sidebar structure is mid-iteration toward peer-level tool/workflow sections. | Observed | `src/editor/EditorRoot.tsx`, `src/editor/PagePanel.tsx`, `src/editor/styles.ts`, `docs/dev-context/Global-Toolset-Structure.md` |
| A user-facing editor tool inventory now exists as a reference doc. | Observed | `docs/tool-manifest.md`; grouped by presentation, scene/rendering, client UI, camera, geographic context, site/spatial, MT, seismic, layer controls, audience, and workflow. Docs only; does not constrain implementation. |

## Placeholder / Future / Parked

| Item | Status | Evidence |
| --- | --- | --- |
| Base GUI Template is a blank/default editing context, not real project data. | Observed | `projects/base-gui/project.json` |
| `base-gui-reference-stage` remains a procedural placeholder; `utah-forge-reference-stage` may remain as legacy/reference context but no longer describes the whole Utah FORGE project state. | Observed | `projects/base-gui/project.json`, `projects/utah-forge/project.json`, `docs/03-decisions.md` DEC-045 |
| Shahbazi orthomosaic, textured mesh/GLB, and full point-cloud stream remain future targets. | Observed | `projects/case-study-b/project.json`, `docs/01-scope.md` |
| Export/publish, MP4, still-pack, provenance PDF, project wizard, transactional save, and production auth remain unresolved product work. | Observed | `docs/01-scope.md`, `docs/04-build-sequence.md`, `docs/handover-for-claude.md` |
| Persistent multi-audience authoring is not implemented; Shahbazi Audience Lens is runtime-only. | Observed | `docs/02-architecture.md`, `src/audience/` |
| External control-plane rails are outside the app unless explicitly reintroduced. | Observed | user instruction for this cleanup |

## Utah FORGE Seismic State

- Observed: Seismic browser products, manifests, prep scripts, source loader/editor/scene code, project config, environment config, and focused Utah browser tests exist.
- Observed: `projects/utah-forge/DATA_LAYER_STATUS.md` records seismic as needed/underway, separates processed/render-ready/QA/provenance roles, and preserves the raw-to-computed artifact guardrail without changing runtime behavior.
- Unverified / needs human review: Final demo loading/visibility policy for seismic remains pending human review.

## Documentation Inventory Risk

- Observed: Active truth appears scattered across root docs, canonical `docs/` files, `CHANGELOG.md`, project-local Utah/Shahbazi/Woodjam docs, generated data READMEs, and `docs/dev-context/`.
- Observed: Current source/project/generated files should be checked before broad prose docs when runtime or data state matters.
- Unverified / needs human review: Which docs should become primary current-state sources after reconciliation.

## Unsafe To Assume

- Observed: No single existing doc is safe as the complete current authority until contradictions are reviewed.
- Observed: Utah FORGE active data status cannot be inferred from old root docs alone.
- Observed: Default-visible layer intent cannot be inferred from prose docs alone.
- Observed: Utah seismic runtime visibility cannot be inferred from `defaultVisibleLayers` alone because the inspected environment style includes the seismic layer in defaults while setting seismic product visibility entries to false.
- Observed: The active repo is `C:\GeoSee\GeoSee_Dev`; Git history remains local unless a remote is added.
- Unverified / needs human review: Whether current Utah public topo/default-visible choices are desired demo state or transient work state.
- Unverified / needs human review: Which existing docs should be active, historical, stale, or proposal.

## Next Valid Move

Observed next valid move: continue bounded Data/System/App refinement from current source and project files. Good next prompts are toolset extraction, page/layer visibility clarity, render-quality preservation checks, seismic status/provenance clarity, or app architecture map refinement. Do not simplify rendering, park seismic by assumption, or turn candidate architecture ideas into committed scope from this pass.

Current 2026-06-03 thread receipt: `docs/dev-context/Topo-Environment-Clouds-Cinematics-Thread-Update-2026-06-03.md`.

## Utah FORGE Staged-Intake Test State

Status: purged from active build context.

The prior Utah FORGE staged-intake tests are over. Active test drops, archived test drops, sample vocabulary, latest pointers, review pages, and review overlays have been removed from the active project surface.

The Add to Project UI remains available as a dormant capability. It is not the problem. The operating rule is that agents should not follow staged-review traces during normal software-build work unless the human explicitly resumes that work.

No staged-intake artifact is accepted project truth. If this area is resumed later, treat it as a new explicit task with fresh staged evidence.
