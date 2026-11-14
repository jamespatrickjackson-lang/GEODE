# Scene runtime — shared agent instructions

Scope: `src/scene/`. These provider-neutral rules preserve the scene-runtime guardrails documented in `src/scene/CLAUDE.md`; that original remains unchanged while routing and preservation are reviewed.

## Architecture and bounded reads

- The Three.js R2 extraction moved scene responsibilities into focused helpers. `SceneManager.ts` and `section/sceneSectionController.ts` have since grown beyond their original post-split targets. Both require scoped, symbol-first inspection rather than whole-file reads. `terrainMaterial.ts` is also large; inspect only relevant shader/material ranges.
- `SceneManager.ts` owns scene lifecycle and the public runtime-facing orchestration. `section/sceneSectionController.ts` handles scene-section apply, helpers and opacity. Historical R2 targets were about 2,550 lines for `SceneManager.ts` and a 1,200-line cap for `sceneSectionController.ts`; these are **historic extraction targets**, not current measurements or permission to disregard safety rules.
- Relevant extracted helpers: `handles/sceneHandleControllers.ts`, `isoOverlays/volumeCutIsoOverlays.ts`, `terrain/terrainStyleController.ts`, `workingArea/workingAreaFocusController.ts`, `transitions/layerTweenRuntime.ts`.
- Other source-navigation anchors: `heightSampler.ts` for terrain height, `postprocessing.ts` for effects, `disposeObjectTree.ts` for Three.js cleanup, `layerDiagnostics.ts` for diagnostics, `layerLoaderRegistry.ts` for registration, `layerLoaders.ts` for per-kind loaders, and `scalarFocus.ts` for focus and clipping. Confirm current file sizes and implementations rather than trusting historical counts.

## Required editing discipline

- Layer registration, opacity and transition handling in `SceneManager.ts` is product-aware. Inspect the precise affected code and its contract before changing behavior. Historical implementation context is recorded in commits `15d3c66`, `bb29e23` and `e326e23`.
- **Keep the transition-opacity regression test passing** after any change affecting product base opacity, page transitions or visual opacity. Read `docs/dev-context/Transition-Runtime-Operating-Spec.md`, `docs/dev-context/Transition-Continuity-Contract.md`, and transition guardrails for broader changes.
- Route Three.js object/geometry/material cleanup through `disposeObjectTree.ts`; do not introduce independent ad-hoc disposal loops.
- Register additional layer types through `layerLoaderRegistry.ts`; do not add inline registration inside `SceneManager.ts`.
- Preserve product-owned shader opacity and derived ISO overlay opacity when composing page/layer transitions. A generic fade must not reveal scientifically hidden products or make section-derived visuals flash.
- Fix generic runtime behavior rather than matching a particular project deck, page ID, page title or page pair. Preserve the distinction between synthetic app-behavior evidence and human visual acceptance.

Source-preservation reference: [`src/scene/CLAUDE.md`](CLAUDE.md). This staged copy does not change the existing Claude instruction-loading path.
