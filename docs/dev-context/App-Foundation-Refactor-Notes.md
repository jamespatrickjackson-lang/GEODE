# App Foundation Refactor Notes

## Purpose

This file tracks proposed app-foundation refactor notes without approving implementation. It is a lab-book/control-rail record only.

## Loader / Project Module Boundary Audit

Observed: `docs/dev-context/Loader-Project-Module-Audit.md` now documents the current project load flow and loader dispatch boundary from project selection through `loadProject`, `mountScene`, `SceneManager`, `loadLayerInto`, and concrete loader calls.

Status: no refactor has happened yet. The audit is planning input for human review before any loader registry, project-module split, lifecycle/disposal work, lazy loading, SceneManager split, editor split, page/schema change, render/material change, or project data/config/page change.

Next valid move: review the audit and decide whether a first implementation slice should create a loader registry while preserving the existing `loadLayerInto(spec, manager)` call shape and moving only generic handlers first.

## Loader Registry Slice 1

Observed: Loader Registry Slice 1 now creates `src/scene/layerLoaderRegistry.ts` and routes the existing `src/scene/layerLoaders.ts` handler list through that registry shell.

Status: registry shell only. The public `loadLayerInto(spec, manager)` entry point is preserved, handlers remain in `layerLoaders.ts`, and no project-module extraction has happened yet.

Boundary: no lazy loading, runtime load-policy enforcement, SceneManager split, editor split, page/schema change, project manifest/environment/page/data change, render/material/depth change, or computed-artifact change is intended by this slice.

Next valid move: review Slice 1 results, then decide whether Slice 1B should extract only the Base GUI/reference-stage handlers.

## Loader Registry Slice 1B

Observed: Loader Registry Slice 1B extracts only the placeholder/reference-stage handler definitions for `base-gui-reference-stage` and `utah-forge-reference-stage` into project-module registration files.

Status: low-risk sentinel extraction only. The shared reference-stage object factory remains in `layerLoaders.ts`, the public `loadLayerInto(spec, manager)` entry point is preserved, and the handlers are registered back into the same ordered dispatch position.

Boundary: no real data or heavy loaders moved. Utah FORGE seismic/MT/scalar/volume/threshold/full-density handlers, Shahbazi handlers, Woodjam handlers, public-context handlers, generic handlers, lazy loading, runtime load-policy behavior, SceneManager changes, project config/page/data changes, and render/material/depth behavior remain untouched.

Next valid move: human review of Slice 1B before considering any heavier project-module extraction.

## Loader Registry Slice 1B Visual Regression

Observed: `docs/dev-context/Verification-Receipts/VER-2026-05-16-004-loader-registry-slice-1b-visual-regression.md` records a bounded visual/runtime regression check for Base GUI and Utah FORGE after Slice 1B.

Status: verification evidence only. Base GUI and Utah FORGE opened, screenshots were captured, runtime diagnostics were available, wrapper validation passed, coverage reporting passed, and `npm run build` passed. The receipt remains `needs review` and does not mark the refactor accepted.

Boundary: this verification pass did not change app code, loader behavior, rendering behavior, project manifests, environment JSON, page JSON, overlays, prep scripts, source data, computed artifacts, or acceptance state.
